import { describe, it } from "vitest";
import { eq, installLocalStorage } from "./helpers";

installLocalStorage(); // must run before the storage module is imported

const { loadEntries, mergeNewest, migrateLegacyData, persistEntries, removeEntry, upsertEntry, toScores } =
  await import("../db");
type Entry = import("../db").Entry;

const at = (iso: string) => new Date(iso);

function makeEntry(date: string, score: number, extra: Partial<Entry> = {}): Entry {
  return {
    id: `fixed-${date}`,
    userId: "u1",
    date,
    score,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-01T10:00:00.000Z",
    ...extra,
  };
}

describe("one entry per local date (duplicate prevention)", () => {
  it("second submission for the same date updates instead of duplicating", () => {
    const first = upsertEntry("u1", {}, { date: "2026-07-14", score: 8 }, at("2026-07-14T20:00:00Z"));
    if (!first.ok) throw new Error("first upsert failed");
    eq("first upsert created", first.created, true);
    const second = upsertEntry("u1", first.entries, { date: "2026-07-14", score: 3 }, at("2026-07-14T21:00:00Z"));
    if (!second.ok) throw new Error("second upsert failed");
    eq("second upsert did not create", second.created, false);
    eq("still exactly one entry", Object.keys(second.entries).length, 1);
    eq("score was updated", second.entries["2026-07-14"].score, 3);
    eq("id preserved across edit", second.entries["2026-07-14"].id, first.entry.id);
    eq("createdAt preserved", second.entries["2026-07-14"].createdAt, first.entry.createdAt);
    eq("updatedAt advanced", second.entries["2026-07-14"].updatedAt > first.entry.updatedAt, true);
  });
});

describe("validation", () => {
  it("rejects bad scores and dates", () => {
    eq("score 0 rejected", upsertEntry("u1", {}, { date: "2026-07-14", score: 0 }).ok, false);
    eq("score 11 rejected", upsertEntry("u1", {}, { date: "2026-07-14", score: 11 }).ok, false);
    eq("score 6.5 rejected", upsertEntry("u1", {}, { date: "2026-07-14", score: 6.5 }).ok, false);
    eq("impossible date rejected", upsertEntry("u1", {}, { date: "2026-02-30", score: 5 }).ok, false);
  });

  it("trims and caps notes at 500 chars", () => {
    const res = upsertEntry("u1", {}, { date: "2026-07-14", score: 5, note: `  ${"x".repeat(600)}  ` });
    if (!res.ok) throw new Error("upsert failed");
    eq("note capped at 500", res.entry.note?.length, 500);
    const empty = upsertEntry("u1", {}, { date: "2026-07-14", score: 5, note: "   " });
    if (!empty.ok) throw new Error("upsert failed");
    eq("whitespace-only note dropped", empty.entry.note, undefined);
  });
});

describe("persistence round trip", () => {
  it("saves and reloads entries", () => {
    localStorage.clear();
    const map = { "2026-07-13": makeEntry("2026-07-13", 6), "2026-07-14": makeEntry("2026-07-14", 8) };
    eq("persist ok", persistEntries("u1", map).ok, true);
    const loaded = loadEntries("u1");
    eq("reloaded 2 entries", Object.keys(loaded.entries).length, 2);
    eq("scores view", toScores(loaded.entries), { "2026-07-13": 6, "2026-07-14": 8 });
    eq("nothing dropped", loaded.dropped, 0);
  });

  it("still reads old-format entries carrying reaction fields", () => {
    localStorage.clear();
    const legacy = { ...makeEntry("2026-07-14", 7), reactionId: "pn1", reactionText: "Not bad." };
    localStorage.setItem("dayscore:entries:u1", JSON.stringify([legacy]));
    const loaded = loadEntries("u1");
    eq("legacy entry kept", loaded.entries["2026-07-14"].score, 7);
    eq("nothing dropped", loaded.dropped, 0);
  });

  it("dedupes duplicate dates on load, keeping the newest", () => {
    localStorage.clear();
    const older = makeEntry("2026-07-14", 4, { id: "old", updatedAt: "2026-07-14T10:00:00.000Z" });
    const newer = makeEntry("2026-07-14", 9, { id: "new", updatedAt: "2026-07-14T12:00:00.000Z" });
    localStorage.setItem("dayscore:entries:u1", JSON.stringify([older, newer]));
    const loaded = loadEntries("u1");
    eq("one survivor", Object.keys(loaded.entries).length, 1);
    eq("newest wins", loaded.entries["2026-07-14"].score, 9);
    eq("duplicate counted as dropped", loaded.dropped, 1);
  });

  it("drops malformed records without losing the rest", () => {
    localStorage.clear();
    const good = makeEntry("2026-07-14", 7);
    localStorage.setItem("dayscore:entries:u1", JSON.stringify([good, { junk: true }, { ...good, date: "2026-99-99" }]));
    const loaded = loadEntries("u1");
    eq("good entry kept", loaded.entries["2026-07-14"].score, 7);
    eq("2 malformed dropped", loaded.dropped, 2);
    eq("store not marked corrupt", loaded.storeCorrupt, false);
  });

  it("handles a fully corrupted store and keeps a backup", () => {
    localStorage.clear();
    localStorage.setItem("dayscore:entries:u1", "{not json!!");
    const loaded = loadEntries("u1");
    eq("corrupt store → empty entries", Object.keys(loaded.entries).length, 0);
    eq("corruption reported", loaded.storeCorrupt, true);
    let backupFound = false;
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith("dayscore:entries:u1:corrupt-")) backupFound = true;
    }
    eq("backup of corrupt payload kept", backupFound, true);
  });
});

describe("delete and merge", () => {
  it("removeEntry drops exactly one date", () => {
    const map = { "2026-07-13": makeEntry("2026-07-13", 6), "2026-07-14": makeEntry("2026-07-14", 8) };
    const next = removeEntry(map, "2026-07-13");
    eq("one entry left", Object.keys(next), ["2026-07-14"]);
  });

  it("mergeNewest keeps the most recently updated entry on conflict", () => {
    const a = { "2026-07-14": makeEntry("2026-07-14", 9, { updatedAt: "2026-07-14T10:00:00.000Z" }) };
    const b = {
      "2026-07-13": makeEntry("2026-07-13", 5),
      "2026-07-14": makeEntry("2026-07-14", 2, { updatedAt: "2026-07-14T12:00:00.000Z" }),
    };
    const merged = mergeNewest(a, b, "guest");
    eq("both dates present", Object.keys(merged).sort(), ["2026-07-13", "2026-07-14"]);
    eq("newer update wins conflict", merged["2026-07-14"].score, 2);
    eq("entries reassigned to target user", merged["2026-07-13"].userId, "guest");
  });
});

describe("legacy migration", () => {
  it("folds an old account's entries into the local store and clears auth keys", () => {
    localStorage.clear();
    localStorage.setItem("dayscore:session", JSON.stringify({ type: "account", id: "acct-1", email: "a@b.co" }));
    localStorage.setItem("dayscore:accounts", JSON.stringify([{ id: "acct-1" }]));
    localStorage.setItem("dayscore:recentReactions:acct-1", JSON.stringify({}));
    persistEntries("acct-1", { "2026-07-13": makeEntry("2026-07-13", 6, { userId: "acct-1" }) });
    persistEntries("guest", { "2026-07-14": makeEntry("2026-07-14", 8, { userId: "guest" }) });

    migrateLegacyData();

    const guest = loadEntries("guest").entries;
    eq("account day migrated", guest["2026-07-13"].score, 6);
    eq("guest day kept", guest["2026-07-14"].score, 8);
    eq("account entry store removed", localStorage.getItem("dayscore:entries:acct-1"), null);
    eq("session key removed", localStorage.getItem("dayscore:session"), null);
    eq("accounts key removed", localStorage.getItem("dayscore:accounts"), null);
    eq("reaction recents removed", localStorage.getItem("dayscore:recentReactions:acct-1"), null);
  });

  it("is a no-op when there is nothing legacy to clean", () => {
    localStorage.clear();
    persistEntries("guest", { "2026-07-14": makeEntry("2026-07-14", 8, { userId: "guest" }) });
    migrateLegacyData();
    eq("guest entries untouched", loadEntries("guest").entries["2026-07-14"].score, 8);
  });
});

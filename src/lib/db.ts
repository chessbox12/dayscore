/**
 * Entry repository. Local-first: entries live in localStorage under a per-user
 * key, keyed by local calendar date, which structurally guarantees at most one
 * entry per user per day. All writes validate before persisting.
 */
import { ISODate, isValidDate } from "./dates";
import { isValidScore } from "./score";
import { keysWithPrefix, loadJSON, removeKey, saveJSON, SaveResult } from "./storage";

export interface Entry {
  id: string;
  userId: string;
  date: ISODate; // local calendar date the entry belongs to
  score: number; // 1..10 integer
  note?: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export type EntryMap = Record<ISODate, Entry>;

export const MAX_NOTE_LENGTH = 500;

/** The single local user everything is stored under. */
export const USER_ID = "guest";

const entriesKey = (userId: string) => `dayscore:entries:${userId}`;

export function isEntry(v: unknown): v is Entry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.userId === "string" &&
    isValidDate(e.date) &&
    isValidScore(e.score) &&
    (e.note === undefined || typeof e.note === "string") &&
    typeof e.createdAt === "string" &&
    typeof e.updatedAt === "string"
  );
}

function isEntryArray(v: unknown): v is Entry[] {
  return Array.isArray(v);
}

export interface LoadEntriesResult {
  entries: EntryMap;
  /** Number of malformed records dropped, and whether whole store was corrupt. */
  dropped: number;
  storeCorrupt: boolean;
}

/**
 * Loads and sanitises a user's entries. Malformed records are dropped (counted,
 * not silently); duplicate dates keep the most recently updated record.
 */
export function loadEntries(userId: string): LoadEntriesResult {
  const res = loadJSON(entriesKey(userId), isEntryArray);
  if (!res.ok) {
    return { entries: {}, dropped: 0, storeCorrupt: "corrupt" in res && res.corrupt === true };
  }
  const entries: EntryMap = {};
  let dropped = 0;
  for (const raw of res.value) {
    if (!isEntry(raw)) {
      dropped++;
      continue;
    }
    const existing = entries[raw.date];
    if (existing) dropped++; // a duplicate date always means one record is discarded
    if (!existing || raw.updatedAt > existing.updatedAt) {
      entries[raw.date] = { ...raw, userId };
    }
  }
  return { entries, dropped, storeCorrupt: false };
}

export function persistEntries(userId: string, entries: EntryMap): SaveResult {
  return saveJSON(entriesKey(userId), Object.values(entries));
}

export function deleteUserEntries(userId: string): void {
  removeKey(entriesKey(userId));
}

export type UpsertInput = {
  date: ISODate;
  score: number;
  note?: string;
};

export type UpsertResult =
  | { ok: true; entry: Entry; entries: EntryMap; created: boolean }
  | { ok: false; error: string };

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

/**
 * Creates or updates the single entry for (userId, date). Pure on the in-memory
 * map; persistence is the caller's job so failures can be surfaced.
 */
export function upsertEntry(userId: string, entries: EntryMap, input: UpsertInput, now: Date = new Date()): UpsertResult {
  if (!isValidDate(input.date)) return { ok: false, error: "That date isn't valid." };
  if (!isValidScore(input.score)) return { ok: false, error: "Scores go from 1 to 10." };
  const note = input.note?.trim().slice(0, MAX_NOTE_LENGTH) || undefined;
  const ts = now.toISOString();
  const existing = entries[input.date];
  const entry: Entry = existing
    ? { ...existing, score: input.score, note, updatedAt: ts }
    : {
        id: newId(),
        userId,
        date: input.date,
        score: input.score,
        note,
        createdAt: ts,
        updatedAt: ts,
      };
  return { ok: true, entry, entries: { ...entries, [input.date]: entry }, created: !existing };
}

export function removeEntry(entries: EntryMap, date: ISODate): EntryMap {
  const next = { ...entries };
  delete next[date];
  return next;
}

/** Scores-by-date view used by all statistics. */
export function toScores(entries: EntryMap): Record<ISODate, number> {
  const out: Record<ISODate, number> = {};
  for (const [date, e] of Object.entries(entries)) out[date] = e.score;
  return out;
}

/** Merge two entry maps; on a date conflict the most recently updated wins. */
export function mergeNewest(a: EntryMap, b: EntryMap, userId: string): EntryMap {
  const merged: EntryMap = { ...a };
  for (const [date, e] of Object.entries(b)) {
    const existing = merged[date];
    if (!existing || e.updatedAt > existing.updatedAt) merged[date] = e;
  }
  for (const date of Object.keys(merged)) merged[date] = { ...merged[date], userId };
  return merged;
}

/**
 * One-time cleanup from the old multi-user build: if an account session was
 * active, fold that account's entries into the single local store (newest
 * wins per date), then drop the legacy auth/reaction keys. Safe to run on
 * every startup — it does nothing once the legacy keys are gone.
 */
export function migrateLegacyData(): void {
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
  const session = loadJSON("dayscore:session", isObj);
  if (session.ok && session.value.type === "account" && typeof session.value.id === "string") {
    const accountId = session.value.id;
    const account = loadEntries(accountId).entries;
    if (Object.keys(account).length > 0) {
      const merged = mergeNewest(loadEntries(USER_ID).entries, account, USER_ID);
      if (persistEntries(USER_ID, merged).ok) deleteUserEntries(accountId);
    }
  }
  removeKey("dayscore:session");
  removeKey("dayscore:accounts");
  for (const key of keysWithPrefix("dayscore:recentReactions:")) removeKey(key);
}

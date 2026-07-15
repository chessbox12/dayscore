import { describe, it } from "vitest";
import { currentStreak, monthlyAverage, totalLogged, yearlyAverage } from "../stats";
import { eq, scoresFrom } from "./helpers";

// Reference day: Tuesday 2026-07-14.
const TODAY = "2026-07-14";

describe("yearly averages", () => {
  it("keeps entries in their own year and averages across months", () => {
    const s = scoresFrom([
      ["2025-12-31", 2],
      ["2026-01-01", 4],
      ["2026-07-14", 8],
    ]);
    eq("2025 avg", yearlyAverage(s, 2025).average, 2);
    eq("2026 avg", yearlyAverage(s, 2026).average, 6);
    eq("2026 count", yearlyAverage(s, 2026).count, 2);
    eq("empty year", yearlyAverage(s, 2024).average, null);
  });
});

describe("monthly averages", () => {
  it("keeps entries in their own month", () => {
    const s = scoresFrom([
      ["2026-06-30", 2],
      ["2026-07-01", 8],
    ]);
    eq("June avg", monthlyAverage(s, 2026, 6).average, 2);
    eq("July avg", monthlyAverage(s, 2026, 7).average, 8);
  });

  it("averages only logged days", () => {
    const s = scoresFrom([
      ["2026-07-13", 6],
      ["2026-07-14", 8],
    ]);
    eq("avg of {6,8}", monthlyAverage(s, 2026, 7).average, 7);
    eq("count", monthlyAverage(s, 2026, 7).count, 2);
  });

  it("returns null with no entries", () => {
    eq("empty month average", monthlyAverage({}, 2026, 7).average, null);
  });

  it("includes Feb 29 in leap years", () => {
    const s = scoresFrom([["2024-02-29", 9]]);
    eq("Feb 2024 avg includes the 29th", monthlyAverage(s, 2024, 2).average, 9);
    eq("Feb 2024 count", monthlyAverage(s, 2024, 2).count, 1);
  });
});

describe("streaks", () => {
  it("counts consecutive days ending today", () => {
    const s = scoresFrom([
      ["2026-07-12", 5],
      ["2026-07-13", 6],
      ["2026-07-14", 7],
    ]);
    eq("3-day streak incl. today", currentStreak(s, TODAY), 3);
  });

  it("is forgiving: today missing doesn't break the streak yet", () => {
    const s = scoresFrom([
      ["2026-07-12", 5],
      ["2026-07-13", 6],
    ]);
    eq("streak counts back from yesterday", currentStreak(s, TODAY), 2);
  });

  it("a missing middle day breaks the run", () => {
    const s = scoresFrom([
      ["2026-07-11", 5],
      ["2026-07-13", 6],
      ["2026-07-14", 7],
    ]);
    eq("gap on the 12th → streak 2", currentStreak(s, TODAY), 2);
  });

  it("zero when nothing recent", () => {
    eq("empty → 0", currentStreak({}, TODAY), 0);
    eq("old entries only → 0", currentStreak(scoresFrom([["2026-07-01", 5]]), TODAY), 0);
  });

  it("crosses month and year boundaries", () => {
    const s = scoresFrom([
      ["2025-12-31", 6],
      ["2026-01-01", 6],
    ]);
    eq("streak across new year", currentStreak(s, "2026-01-01"), 2);
  });
});

describe("edits and deletions recalculate", () => {
  const before = scoresFrom([
    ["2026-07-13", 8],
    ["2026-07-14", 8],
  ]);

  it("editing a score changes the average", () => {
    eq("before edit avg", monthlyAverage(before, 2026, 7).average, 8);
    const after = { ...before, "2026-07-13": 2 };
    eq("after edit avg", monthlyAverage(after, 2026, 7).average, 5);
  });

  it("deleting an entry changes average and streak", () => {
    const after = { "2026-07-14": 8 };
    eq("after delete count", monthlyAverage(after, 2026, 7).count, 1);
    eq("streak before delete", currentStreak(before, TODAY), 2);
    eq("streak after delete", currentStreak(after, TODAY), 1);
    eq("total logged", totalLogged(after), 1);
  });
});

import { describe, it } from "vitest";
import { roastFor, tierForScore } from "../roasts";
import { addDays } from "../dates";
import { eq } from "./helpers";

describe("roasts", () => {
  it("returns a non-empty quote for every score", () => {
    for (let s = 1; s <= 10; s++) {
      eq(`score ${s} has a quote`, roastFor("2026-07-15", s).length > 0, true);
    }
  });

  it("is deterministic: same date + score → same quote", () => {
    eq("stable across calls", roastFor("2026-07-15", 3), roastFor("2026-07-15", 3));
  });

  it("varies by date and by score", () => {
    let d = "2026-01-01";
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      seen.add(roastFor(d, 3));
      d = addDays(d, 1);
    }
    eq("multiple quotes appear over 60 days", seen.size > 3, true);
  });

  it("score-locked lines never leak to other scores", () => {
    let d = "2026-01-01";
    for (let i = 0; i < 120; i++) {
      const q8 = roastFor(d, 8);
      eq(`no 10-only line for an 8 (${d})`, q8.includes("Nobody's day is a ten"), false);
      eq(`no 9-only line for an 8 (${d})`, q8.includes("In this economy"), false);
      d = addDays(d, 1);
    }
  });

  it("tiers split at 4/7", () => {
    eq("4 is low", tierForScore(4), "low");
    eq("5 is neutral", tierForScore(5), "neutral");
    eq("7 is neutral", tierForScore(7), "neutral");
    eq("8 is positive", tierForScore(8), "positive");
  });
});

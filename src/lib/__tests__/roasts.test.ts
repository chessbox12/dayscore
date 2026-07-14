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
      eq(`no 10-only line for an 8 (${d})`, q8.includes("Nobody's day is a 10"), false);
      eq(`no 9-only line for an 8 (${d})`, q8.includes("What was missing"), false);
      d = addDays(d, 1);
    }
  });

  it("spin serves a fresh quote for the same entry, deterministically", () => {
    const base = roastFor("2026-07-15", 3);
    eq("spin 1 differs from base", roastFor("2026-07-15", 3, 1) === base, false);
    eq("same spin, same quote", roastFor("2026-07-15", 3, 1), roastFor("2026-07-15", 3, 1));
  });

  it("every quote mentions the score it was given", () => {
    for (let s = 1; s <= 10; s++) {
      for (let spin = 0; spin < 20; spin++) {
        const q = roastFor("2026-07-15", s, spin);
        eq(`score ${s} spin ${spin} names the number`, q.includes(String(s)), true);
      }
    }
  });

  it("tiers split at 4/7", () => {
    eq("4 is low", tierForScore(4), "low");
    eq("5 is neutral", tierForScore(5), "neutral");
    eq("7 is neutral", tierForScore(7), "neutral");
    eq("8 is positive", tierForScore(8), "positive");
  });
});

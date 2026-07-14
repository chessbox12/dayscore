/**
 * Score domain: 1–10 integers. Colour comes from the CSS ramp
 * (--score-1 … --score-10, one blue hue, light → deep); the exact score is
 * always also available as text (labels, tooltips, aria), so colour is never
 * the only channel.
 */

export const SCORE_LABELS: Record<number, string> = {
  1: "Awful",
  2: "Rough",
  3: "Bad",
  4: "Meh",
  5: "Okay",
  6: "Fine",
  7: "Good",
  8: "Great",
  9: "Excellent",
  10: "Perfect",
};

export function isValidScore(s: unknown): s is number {
  return typeof s === "number" && Number.isInteger(s) && s >= 1 && s <= 10;
}

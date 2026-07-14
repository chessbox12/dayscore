/**
 * The roast shown after rating a day. One style: mean-ish internet heckler
 * with ragebait energy — every line talks back to the number itself.
 * Picked deterministically from (date, score) so an entry keeps its quote;
 * `spin` cycles through the pool when the user asks for a fresh one.
 *
 * Content rule: roast the day and the rating, tease the user — never their
 * worth, health, identity or anything a genuinely bad day could make cruel.
 */
import { ISODate } from "./dates";

interface Roast {
  text: (score: number) => string;
  min?: number; // inclusive score bounds when a line only fits some scores
  max?: number;
}

const r = (text: (score: number) => string, min?: number, max?: number): Roast => ({
  text,
  min,
  max,
});

// "An 8", but "A 9" / "A 10".
const A = (s: number) => (s === 8 ? "An" : "A");

const LOW: Roast[] = [
  r((s) => `A ${s}? Congrats on losing to a random weekday.`),
  r((s) => `${s}/10. The day won, and it wasn't even trying.`),
  r((s) => `A ${s}, and you still logged it. Brave. Pointless, but brave.`),
  r((s) => `${s} out of 10 — the heatmap needed a stain anyway.`),
  r((s) => `A ${s}? Rate it lower. Do it. Coward.`),
  r((s) => `${s}/10. This could've been an email.`),
  r((s) => `A ${s}. Somewhere a better version of today is laughing at this one.`),
  r((s) => `${s}/10. The vibes filed for bankruptcy and you co-signed.`),
  r((s) => `A ${s}. Today gets a participation trophy. A damp one.`),
  r((s) => `${s}/10, and tomorrow you get to try again. Same odds.`),
  r(() => `A 1. The scale doesn't go lower, and that's the only reason.`, 1, 1),
  r(() => `A 2 is just a 1 with delusions of grandeur.`, 2, 2),
  r(() => `A 3? That's a 1 rounded up out of pity.`, 3, 3),
  r(() => `A 4 — couldn't even commit to being mediocre.`, 4, 4),
];

const NEUTRAL: Roast[] = [
  r((s) => `A ${s}. Aggressively forgettable. Iconic behaviour.`),
  r((s) => `${s}/10 — the beige of numbers for the beige of days.`),
  r((s) => `A ${s}? You compressed 24 whole hours into a shrug.`),
  r((s) => `${s}/10. Nothing happened today and you know it.`),
  r((s) => `A ${s}. Not bad enough to be a story, not good enough to matter.`),
  r((s) => `${s} out of 10. You'll forget this day by Thursday. So will the day.`),
  r((s) => `A ${s}. A day that will never be made into a movie.`),
  r((s) => `${s}/10. Riveting stuff. Truly.`),
  r(() => `A 5 is a day doing the bare minimum. Like recognises like.`, 5, 5),
  r(() => `A 6 is a 5 with better marketing.`, 6, 6),
  r(() => `You typed 7, but we both know it was a 6.`, 7, 7),
];

const POSITIVE: Roast[] = [
  r((s) => `${A(s)} ${s}? In this economy?`),
  r((s) => `${s}/10. Screenshot it — it's never happening again.`),
  r((s) => `${A(s)} ${s}. Unbearable. Thrilled for you, though. (No.)`),
  r((s) => `Some of us had a normal day, but sure, flaunt your ${s}.`),
  r((s) => `${A(s)} ${s}? The heatmap will humble you by Friday.`),
  r((s) => `${A(s)} ${s}. Don't get used to it.`),
  r((s) => `${A(s)} ${s}. The universe played favourites and you're bragging about it.`),
  r(() => `A 9? What was missing? Say it. You can't.`, 9, 9),
  r(() => `A 10. Sure. Nobody's day is a 10, but sure.`, 10, 10),
];

export function tierForScore(score: number): "low" | "neutral" | "positive" {
  if (score <= 4) return "low";
  if (score <= 7) return "neutral";
  return "positive";
}

const POOLS = { low: LOW, neutral: NEUTRAL, positive: POSITIVE } as const;

export function roastFor(date: ISODate, score: number, spin = 0): string {
  const pool = POOLS[tierForScore(score)].filter(
    (q) => score >= (q.min ?? 1) && score <= (q.max ?? 10)
  );
  // djb2-ish hash of date+score → stable pick per entry; spin steps the pick.
  const key = `${date}:${score}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return pool[(h + spin) % pool.length].text(score);
}

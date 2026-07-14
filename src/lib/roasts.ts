/**
 * The roast shown after rating a day. One style: mean-ish internet heckler.
 * Picked deterministically from (date, score) so an entry keeps its quote —
 * nothing is stored and nothing reshuffles on re-render.
 *
 * Content rule: roast the day and the rating, tease the user — never their
 * worth, health, identity or anything a genuinely bad day could make cruel.
 */
import { ISODate } from "./dates";

interface Roast {
  text: string;
  min?: number; // inclusive score bounds when a line only fits some scores
  max?: number;
}

const r = (text: string, min?: number, max?: number): Roast => ({ text, min, max });

const LOW: Roast[] = [
  r("Lol. Better luck tomorrow."),
  r("Skill issue, honestly."),
  r("This could've been an email."),
  r("That wasn't a day, that was an ambush."),
  r("This day owes you money."),
  r("Rough. Have you considered simply having a better day?"),
  r("The vibes filed for bankruptcy."),
  r("Somewhere, a better version of today is laughing at this one."),
  r("Today gets a participation trophy. A damp one."),
  r("The calendar flinched."),
  r("Filed under: never speak of this again."),
  r("And the best part? Tomorrow you get to try again. Same odds."),
  r("A 1. Even the scale feels insulted.", 1, 1),
  r("A 2 is just a 1 with delusions.", 2, 2),
];

const NEUTRAL: Roast[] = [
  r("Mid. Proudly, defiantly mid."),
  r("Riveting stuff. Truly."),
  r("A day that will never be made into a movie."),
  r("The beige of days."),
  r("Aggressively okay. Thrilling log entry."),
  r("Nothing happened today and you know it."),
  r("Fine. It was fine. Everyone stay calm."),
  r("You'll forget this day by Thursday. So will the day."),
  r("A five is just a ten doing the bare minimum.", 5, 5),
  r("A 6 is a 5 with better marketing.", 6, 6),
  r("You rated it a 7, but we both know it was a 6.", 7, 7),
];

const POSITIVE: Roast[] = [
  r("Show-off."),
  r("Wow. Some of us had a normal Tuesday, but go on."),
  r("Screenshot it. It's never happening again."),
  r("Insufferable. Thrilled for you, but insufferable."),
  r("Calm down. It was one good day."),
  r("Don't get used to it."),
  r("Great day, huh? The heatmap will humble you eventually."),
  r("The universe played favourites today. Enjoy the bias."),
  r("A nine? In this economy?", 9, 9),
  r("A ten. Sure. Nobody's day is a ten, but sure.", 10, 10),
];

export function tierForScore(score: number): "low" | "neutral" | "positive" {
  if (score <= 4) return "low";
  if (score <= 7) return "neutral";
  return "positive";
}

const POOLS = { low: LOW, neutral: NEUTRAL, positive: POSITIVE } as const;

export function roastFor(date: ISODate, score: number): string {
  const pool = POOLS[tierForScore(score)].filter(
    (q) => score >= (q.min ?? 1) && score <= (q.max ?? 10)
  );
  // djb2-ish hash of date+score → stable pick per entry.
  const key = `${date}:${score}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return pool[h % pool.length].text;
}

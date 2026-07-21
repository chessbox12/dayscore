/**
 * The quote shown after rating a day. One voice: a supportive friend who is
 * slightly annoying — teasing, deadpan, a bit dramatic, but unmistakably on
 * your side. Bad days get absurdist comfort (the bar is on the floor, the day
 * is the villain, never you); good days get full hype-friend energy.
 * Built from research into how people actually cheer each other up online —
 * deadpan affirmation-parody, "you dropped this 👑", low-bar mantras, LET'S GO
 * — and deliberately avoids the greeting-card canon ("look on the bright
 * side", "it could be worse", "good vibes only").
 *
 * Picked deterministically from (date, score) so an entry keeps its quote;
 * `spin` cycles through the pool when the user asks for a fresh one.
 * Every line talks back to the number itself.
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
  r((s) => `A ${s}? Okay. Deep breath. We do not let a random Tuesday win the rematch.`),
  r((s) => `${s}/10. The bar for tomorrow is on the floor. Trip over it. Still counts.`),
  r((s) => `A ${s}. I'm fighting today in the parking lot. Nobody does this to my friend.`),
  r((s) => `A ${s}? Hey, you dropped this 👑. The day's behaviour was not your fault.`),
  r((s) => `${s}/10. Repeat after me: I am epic. I have friends. Tomorrow fears me.`),
  r((s) => `A ${s}. Evict today from your head. You're the landlord. It never paid rent.`),
  r((s) => `${s}/10, survived entirely out of spite. Honestly? Iconic.`),
  r((s) => `A ${s} logged is a day survived. Hydrate and be dramatic about it. You earned it.`),
  r((s) => `${s}/10. New plan: snack, blanket, unearned confidence. No questions at this time.`),
  r((s) => `A ${s}. Tomorrow has no idea who it's dealing with. (You. Rested. Petty.)`),
  r(() => `A 1?! Blanket. Snack. We never speak of this day again. I've got the door.`, 1, 1),
  r(() => `A 2. The bar was in hell and the day still tripped. The day. Not you.`, 2, 2),
  r(() => `A 3. Say it with me: not my fault, not my vibe, not happening twice.`, 3, 3),
  r(() => `A 4 is a 5 that needs a nap. Go acquire the nap.`, 4, 4),
];

const NEUTRAL: Roast[] = [
  r((s) => `A ${s}. Perfectly mid. The fridge light of days. Log it proudly anyway.`),
  r((s) => `${s}/10. Nothing happened today. Rest is a plot point too, you know.`),
  r((s) => `A ${s}. Beige, sure — but beige is a load-bearing colour. Ask any wall.`),
  r((s) => `${s}/10. Coasting is a skill. You're basically an athlete of fine.`),
  r((s) => `A ${s} still feeds the streak, and the streak is the real flex.`),
  r((s) => `${s}/10. The day said "present" and sat down. Honestly? Respect.`),
  r(() => `A 5. Dead centre. Statistically immaculate. Frame it.`, 5, 5),
  r(() => `A 6 is a 5 that tried. I saw it trying. So proud.`, 6, 6),
  r(() => `A 7 is a good day acting humble. Own it a little.`, 7, 7),
];

const POSITIVE: Roast[] = [
  r((s) => `${A(s)} ${s}?? LET'S GO. Don't explain it. Don't jinx it. Just nod.`),
  r((s) => `${A(s)} ${s}. Write down whatever you did today — that's the recipe now.`),
  r((s) => `${A(s)} ${s}. The heatmap's about to look like open ocean. Keep pouring.`),
  r((s) => `${A(s)} ${s}, and the crown stays on. You dropped nothing today, king.`),
  r((s) => `${s}/10?! I'm telling everyone. You can't stop me. This is my news now.`),
  r((s) => `${A(s)} ${s}. Same again tomorrow? The day knows the address now.`),
  r(() => `A 9? Saving the last point for tomorrow. Cocky. I respect it.`, 9, 9),
  r(() => `A 10. A TEN. I need you to be normal about this exactly never.`, 10, 10),
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

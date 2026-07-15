/**
 * Pure statistics over logged entries. Everything here takes plain data and a
 * "today" date so it is deterministic and fully unit-testable.
 */
import { ISODate, addDays, daysInMonth, makeDate } from "./dates";

export interface ScoreByDate {
  [date: ISODate]: number;
}

export interface RangeAverage {
  average: number | null; // null when no entries in range
  count: number;
}

export function monthlyAverage(scores: ScoreByDate, y: number, m: number): RangeAverage {
  const end = makeDate(y, m, daysInMonth(y, m));
  let sum = 0;
  let count = 0;
  for (let d = makeDate(y, m, 1); d <= end; d = addDays(d, 1)) {
    const s = scores[d];
    if (s !== undefined) {
      sum += s;
      count++;
    }
  }
  return { average: count === 0 ? null : sum / count, count };
}

export function yearlyAverage(scores: ScoreByDate, y: number): RangeAverage {
  const prefix = `${String(y).padStart(4, "0")}-`;
  let sum = 0;
  let count = 0;
  for (const [date, s] of Object.entries(scores)) {
    if (date.startsWith(prefix)) {
      sum += s;
      count++;
    }
  }
  return { average: count === 0 ? null : sum / count, count };
}

/**
 * Forgiving current streak: today does not break the streak until the day has
 * fully ended. If today is logged, count back from today; otherwise count back
 * from yesterday.
 */
export function currentStreak(scores: ScoreByDate, today: ISODate): number {
  let d = scores[today] !== undefined ? today : addDays(today, -1);
  let streak = 0;
  while (scores[d] !== undefined) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

export function totalLogged(scores: ScoreByDate): number {
  return Object.keys(scores).length;
}

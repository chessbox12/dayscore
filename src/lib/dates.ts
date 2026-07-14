/**
 * Local-calendar-date math for DayScore.
 *
 * Every entry is keyed by the LOCAL calendar date it was logged on, stored as a
 * plain "YYYY-MM-DD" string. All arithmetic below is pure integer civil-date
 * math (no Date objects), so results are identical in every time zone and are
 * unaffected by DST transitions. `Date` is only touched in two places: reading
 * "now" via local getters (todayLocal) and formatting for display (formatHuman,
 * pinned to noon so DST-shifted midnights can't move the day).
 */

export type ISODate = string; // "YYYY-MM-DD" (local calendar date)

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export function makeDate(y: number, m: number, d: number): ISODate {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

export function parseDate(s: unknown): { y: number; m: number; d: number } | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function isValidDate(s: unknown): s is ISODate {
  return parseDate(s) !== null;
}

/** Days since 1970-01-01 (civil), Howard Hinnant's algorithm. */
export function toEpochDays(date: ISODate): number {
  const p = parseDate(date);
  if (!p) throw new Error(`Invalid date: ${date}`);
  let { y } = p;
  const { m, d } = p;
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromEpochDays(z: number): ISODate {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return makeDate(y + (m <= 2 ? 1 : 0), m, d);
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromEpochDays(toEpochDays(date) + n);
}

/** b - a in days (positive when b is after a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return toEpochDays(b) - toEpochDays(a);
}

/** 0 = Sunday … 6 = Saturday. 1970-01-01 (epoch day 0) was a Thursday. */
export function dayOfWeek(date: ISODate): number {
  const z = toEpochDays(date);
  return ((z % 7) + 7 + 4) % 7;
}

export type WeekStart = 0 | 1; // 0 = Sunday, 1 = Monday

export function weekStart(date: ISODate, weekStartsOn: WeekStart): ISODate {
  const dow = dayOfWeek(date);
  const offset = (dow - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

/** Today's LOCAL calendar date. The only place "now" enters date logic. */
export function todayLocal(now: Date = new Date()): ISODate {
  return makeDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function monthOf(date: ISODate): { y: number; m: number } {
  const p = parseDate(date);
  if (!p) throw new Error(`Invalid date: ${date}`);
  return { y: p.y, m: p.m };
}

export function addMonths(y: number, m: number, n: number): { y: number; m: number } {
  const total = y * 12 + (m - 1) + n;
  return { y: Math.floor(total / 12), m: (((total % 12) + 12) % 12) + 1 };
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Display formatting. Pinned to 12:00 local so DST can never shift the day. */
function toDisplayDate(date: ISODate): Date {
  const p = parseDate(date);
  if (!p) throw new Error(`Invalid date: ${date}`);
  return new Date(p.y, p.m - 1, p.d, 12, 0, 0);
}

export function formatHuman(
  date: ISODate,
  opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }
): string {
  return toDisplayDate(date).toLocaleDateString(undefined, opts);
}

export function formatMonthTitle(y: number, m: number): string {
  return new Date(y, m - 1, 1, 12).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** Short weekday labels honouring the chosen week start, e.g. ["Mon", …]. */
export function weekdayLabels(weekStartsOn: WeekStart): string[] {
  // 2023-01-01 was a Sunday.
  const base = toEpochDays("2023-01-01");
  return Array.from({ length: 7 }, (_, i) => {
    const day = fromEpochDays(base + ((weekStartsOn + i) % 7));
    return formatHuman(day, { weekday: "short" });
  });
}

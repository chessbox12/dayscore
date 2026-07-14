import { describe, it } from "vitest";
import {
  addDays,
  dayOfWeek,
  daysInMonth,
  diffDays,
  isLeapYear,
  isValidDate,
  todayLocal,
  toEpochDays,
  fromEpochDays,
  weekStart,
} from "../dates";
import { eq } from "./helpers";

describe("leap years", () => {
  it("classifies leap years correctly", () => {
    eq("2024 is a leap year", isLeapYear(2024), true);
    eq("2026 is not a leap year", isLeapYear(2026), false);
    eq("2000 is a leap year (÷400)", isLeapYear(2000), true);
    eq("2100 is not a leap year (÷100)", isLeapYear(2100), false);
    eq("Feb 2024 has 29 days", daysInMonth(2024, 2), 29);
    eq("Feb 2026 has 28 days", daysInMonth(2026, 2), 28);
  });

  it("steps across Feb 29 correctly", () => {
    eq("2024-02-28 + 1 day", addDays("2024-02-28", 1), "2024-02-29");
    eq("2024-02-29 + 1 day", addDays("2024-02-29", 1), "2024-03-01");
    eq("2024-03-01 - 1 day", addDays("2024-03-01", -1), "2024-02-29");
    eq("2026-02-28 + 1 day (non-leap)", addDays("2026-02-28", 1), "2026-03-01");
  });
});

describe("month and year boundaries", () => {
  it("crosses boundaries", () => {
    eq("2026-01-31 + 1", addDays("2026-01-31", 1), "2026-02-01");
    eq("2025-12-31 + 1 (year boundary)", addDays("2025-12-31", 1), "2026-01-01");
    eq("2026-01-01 - 1", addDays("2026-01-01", -1), "2025-12-31");
    eq("2026-04-30 + 1", addDays("2026-04-30", 1), "2026-05-01");
  });

  it("round-trips through epoch days", () => {
    for (const d of ["1970-01-01", "2000-02-29", "2026-07-14", "2099-12-31"]) {
      eq(`round-trip ${d}`, fromEpochDays(toEpochDays(d)), d);
    }
  });
});

describe("weekdays and week starts", () => {
  it("computes day of week", () => {
    eq("1970-01-01 was Thursday (4)", dayOfWeek("1970-01-01"), 4);
    eq("2026-07-14 is Tuesday (2)", dayOfWeek("2026-07-14"), 2);
    eq("2026-07-12 is Sunday (0)", dayOfWeek("2026-07-12"), 0);
    eq("2000-01-01 was Saturday (6)", dayOfWeek("2000-01-01"), 6);
  });

  it("finds week start for Monday and Sunday preferences", () => {
    eq("Tue 2026-07-14, Monday start", weekStart("2026-07-14", 1), "2026-07-13");
    eq("Tue 2026-07-14, Sunday start", weekStart("2026-07-14", 0), "2026-07-12");
    eq("Sun 2026-07-12, Monday start", weekStart("2026-07-12", 1), "2026-07-06");
    eq("Sun 2026-07-12, Sunday start", weekStart("2026-07-12", 0), "2026-07-12");
    eq("Mon 2026-07-13, Monday start", weekStart("2026-07-13", 1), "2026-07-13");
  });
});

describe("DST transitions (math is pure — immune by construction)", () => {
  it("US spring-forward 2026-03-08 in America/New_York", () => {
    process.env.TZ = "America/New_York";
    eq("diff 03-07 → 03-09 is 2 days", diffDays("2026-03-07", "2026-03-09"), 2);
    eq("03-07 + 1", addDays("2026-03-07", 1), "2026-03-08");
    eq("03-08 + 1", addDays("2026-03-08", 1), "2026-03-09");
    // 06:59 UTC = 01:59 EST (before the skipped hour)
    eq("today at 01:59 EST", todayLocal(new Date("2026-03-08T06:59:00Z")), "2026-03-08");
    // 07:30 UTC = 03:30 EDT (after the skipped hour)
    eq("today at 03:30 EDT", todayLocal(new Date("2026-03-08T07:30:00Z")), "2026-03-08");
  });

  it("US fall-back 2026-11-01 in America/New_York", () => {
    process.env.TZ = "America/New_York";
    eq("diff 10-31 → 11-02 is 2 days", diffDays("2026-10-31", "2026-11-02"), 2);
    // 05:30 UTC = 01:30 EDT, the repeated hour
    eq("today during repeated hour", todayLocal(new Date("2026-11-01T05:30:00Z")), "2026-11-01");
  });
});

describe("time zone travel (entries stay on their local calendar day)", () => {
  const instant = new Date("2026-07-15T02:00:00Z");
  it("same instant, different local days", () => {
    process.env.TZ = "America/New_York"; // UTC-4 → Jul 14, 22:00
    eq("New York local day", todayLocal(instant), "2026-07-14");
    process.env.TZ = "Asia/Tokyo"; // UTC+9 → Jul 15, 11:00
    eq("Tokyo local day", todayLocal(instant), "2026-07-15");
    process.env.TZ = "Pacific/Kiritimati"; // UTC+14 → Jul 15, 16:00
    eq("Kiritimati local day", todayLocal(instant), "2026-07-15");
    process.env.TZ = "UTC";
  });

  it("new year arrives at different instants per zone", () => {
    const nyeUtcNoon = new Date("2025-12-31T12:00:00Z");
    process.env.TZ = "Pacific/Kiritimati"; // already 2026-01-01 02:00
    eq("Kiritimati is already in 2026", todayLocal(nyeUtcNoon), "2026-01-01");
    process.env.TZ = "America/New_York"; // still 2025-12-31 07:00
    eq("New York is still in 2025", todayLocal(nyeUtcNoon), "2025-12-31");
    process.env.TZ = "UTC";
  });
});

describe("date validation", () => {
  it("accepts real dates, rejects impossible ones", () => {
    eq("2024-02-29 valid (leap)", isValidDate("2024-02-29"), true);
    eq("2026-02-29 invalid (non-leap)", isValidDate("2026-02-29"), false);
    eq("2026-02-30 invalid", isValidDate("2026-02-30"), false);
    eq("2026-13-01 invalid", isValidDate("2026-13-01"), false);
    eq("2026-00-10 invalid", isValidDate("2026-00-10"), false);
    eq("garbage invalid", isValidDate("not-a-date"), false);
    eq("empty invalid", isValidDate(""), false);
    eq("non-string invalid", isValidDate(20260714 as unknown as string), false);
  });
});

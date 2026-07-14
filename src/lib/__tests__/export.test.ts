import { describe, it } from "vitest";
import { buildExportCSV, buildExportJSON } from "../export";
import { Entry } from "../db";
import { eq } from "./helpers";

const entry = (date: string, score: number, note?: string): Entry => ({
  id: `id-${date}`,
  userId: "guest",
  date,
  score,
  note,
  createdAt: `${date}T21:00:00.000Z`,
  updatedAt: `${date}T21:00:00.000Z`,
});

describe("CSV export", () => {
  it("escapes commas, quotes and newlines", () => {
    const csv = buildExportCSV({
      "2026-07-14": entry("2026-07-14", 7, 'a note, with "quotes"\nand a newline'),
    });
    const lines = csv.split("\n");
    eq("header row", lines[0], "date,score,note,created_at,updated_at");
    eq(
      "escaped note survives round trip",
      csv.includes('"a note, with ""quotes""\nand a newline"'),
      true
    );
  });

  it("sorts entries by date", () => {
    const csv = buildExportCSV({
      "2026-07-14": entry("2026-07-14", 7),
      "2026-07-01": entry("2026-07-01", 3),
    });
    const dataLines = csv.split("\n").slice(1);
    eq("earliest first", dataLines[0].startsWith("2026-07-01"), true);
  });
});

describe("JSON export", () => {
  it("contains entries and metadata", () => {
    const json = JSON.parse(buildExportJSON({ "2026-07-14": entry("2026-07-14", 7, "hi") }));
    eq("app name", json.app, "DayScore");
    eq("entry count", json.entries.length, 1);
    eq("entry shape", json.entries[0].date, "2026-07-14");
    eq("note included", json.entries[0].note, "hi");
    eq("missing note exported as null", JSON.parse(buildExportJSON({ "2026-07-01": entry("2026-07-01", 3) })).entries[0].note, null);
  });
});

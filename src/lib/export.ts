/** Data export: JSON and CSV downloads built from the in-memory entry map. */
import { Entry, EntryMap } from "./db";

function sortedEntries(entries: EntryMap): Entry[] {
  return Object.values(entries).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function buildExportJSON(entries: EntryMap): string {
  return JSON.stringify(
    {
      app: "DayScore",
      formatVersion: 2,
      exportedAt: new Date().toISOString(),
      entries: sortedEntries(entries).map((e) => ({
        date: e.date,
        score: e.score,
        note: e.note ?? null,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
    },
    null,
    2
  );
}

const csvCell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function buildExportCSV(entries: EntryMap): string {
  const header = "date,score,note,created_at,updated_at";
  const rows = sortedEntries(entries).map((e) =>
    [e.date, String(e.score), csvCell(e.note ?? ""), e.createdAt, e.updatedAt].join(",")
  );
  return [header, ...rows].join("\n");
}

export type DownloadResult = { ok: true } | { ok: false; error: string };

export function downloadFile(filename: string, content: string, mime: string): DownloadResult {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { ok: true };
  } catch {
    return { ok: false, error: "The download couldn't start. Try again." };
  }
}

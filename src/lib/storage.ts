/**
 * Safe localStorage access. Every read validates; corrupted payloads are backed
 * up (never silently discarded) and reported so the UI can tell the user.
 */

export type LoadResult<T> =
  | { ok: true; value: T }
  | { ok: false; missing: true }
  | { ok: false; missing?: false; corrupt: true };

export type SaveResult = { ok: true } | { ok: false; error: string };

function storageAvailable(): boolean {
  try {
    const k = "dayscore:probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export const hasStorage = typeof window !== "undefined" && storageAvailable();

export function loadJSON<T>(key: string, validate: (v: unknown) => v is T): LoadResult<T> {
  if (!hasStorage) return { ok: false, missing: true };
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return { ok: false, missing: true };
  }
  if (raw === null) return { ok: false, missing: true };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validate(parsed)) return { ok: true, value: parsed };
  } catch {
    /* fall through to corrupt handling */
  }
  // Preserve the broken payload for possible recovery, then report.
  try {
    localStorage.setItem(`${key}:corrupt-${Date.now()}`, raw);
  } catch {
    /* best effort */
  }
  return { ok: false, corrupt: true };
}

export function saveJSON(key: string, value: unknown): SaveResult {
  if (!hasStorage) {
    return { ok: false, error: "Storage is unavailable in this browser." };
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return {
      ok: false,
      error: quota
        ? "Your browser's storage is full, so this couldn't be saved."
        : "Saving failed. Your change is kept in this session — try again.",
    };
  }
}

export function removeKey(key: string): void {
  if (!hasStorage) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* best effort */
  }
}

export function keysWithPrefix(prefix: string): string[] {
  if (!hasStorage) return [];
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) out.push(k);
  }
  return out;
}

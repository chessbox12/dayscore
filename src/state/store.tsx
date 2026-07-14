/**
 * App-wide state: entries, settings, today. All persistence goes through the
 * storage layer; failures surface to the UI (an entry is never silently lost —
 * the in-memory copy stays and the caller gets the error to show with a retry).
 */
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Entry,
  EntryMap,
  loadEntries,
  migrateLegacyData,
  persistEntries,
  removeEntry,
  toScores,
  upsertEntry,
  USER_ID,
  deleteUserEntries,
} from "../lib/db";
import { ISODate, todayLocal } from "../lib/dates";
import { loadSettings, persistSettings, Settings } from "../lib/settings";
import { applyTheme, watchSystemTheme } from "../lib/theme";

export interface LogOutcome {
  ok: boolean;
  error?: string;
  entry?: Entry;
  saveWarning?: string; // entry kept in memory but persistence failed
}

interface AppStore {
  entries: EntryMap;
  scores: Record<ISODate, number>;
  settings: Settings;
  today: ISODate;
  dataNotice: string | null;
  logDay: (date: ISODate, score: number, note?: string) => LogOutcome;
  deleteDay: (date: ISODate) => { ok: boolean; error?: string };
  retryPersist: () => { ok: boolean; error?: string };
  updateSettings: (patch: Partial<Settings>) => { ok: boolean; error?: string };
  deleteAllData: () => void;
}

const Ctx = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // One-shot boot: legacy cleanup must run before the first entry read.
  const [boot] = useState(() => {
    migrateLegacyData();
    return { settings: loadSettings(), load: loadEntries(USER_ID) };
  });
  const [settings, setSettings] = useState<Settings>(boot.settings);
  const [today, setToday] = useState<ISODate>(() => todayLocal());
  const [entries, setEntries] = useState<EntryMap>(boot.load.entries);
  const [dataNotice] = useState<string | null>(() => {
    if (boot.load.storeCorrupt) {
      return "Some saved data couldn't be read, so DayScore started fresh. A backup of the unreadable data was kept on this device.";
    }
    const { dropped } = boot.load;
    if (dropped > 0) {
      return `${dropped} saved ${dropped === 1 ? "entry" : "entries"} couldn't be read and ${dropped === 1 ? "was" : "were"} skipped.`;
    }
    return null;
  });

  // Theme.
  useEffect(() => {
    applyTheme(settings.theme);
    return watchSystemTheme(() => settings.theme, () => undefined);
  }, [settings.theme]);

  // Day rollover (midnight, or coming back to a stale tab).
  useEffect(() => {
    const tick = () => setToday((prev) => (prev === todayLocal() ? prev : todayLocal()));
    const id = window.setInterval(tick, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const logDay = useCallback(
    (date: ISODate, score: number, note?: string): LogOutcome => {
      if (date > today) return { ok: false, error: "You can't rate a day that hasn't happened yet." };
      const res = upsertEntry(USER_ID, entriesRef.current, { date, score, note });
      if (!res.ok) return { ok: false, error: res.error };
      setEntries(res.entries);
      const saved = persistEntries(USER_ID, res.entries);
      return { ok: true, entry: res.entry, ...(saved.ok ? {} : { saveWarning: saved.error }) };
    },
    [today]
  );

  const deleteDay = useCallback((date: ISODate): { ok: boolean; error?: string } => {
    if (!entriesRef.current[date]) return { ok: true };
    const next = removeEntry(entriesRef.current, date);
    setEntries(next);
    const saved = persistEntries(USER_ID, next);
    return saved.ok ? { ok: true } : { ok: false, error: saved.error };
  }, []);

  const retryPersist = useCallback((): { ok: boolean; error?: string } => {
    const saved = persistEntries(USER_ID, entriesRef.current);
    return saved.ok ? { ok: true } : { ok: false, error: saved.error };
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>): { ok: boolean; error?: string } => {
    const next = { ...settingsRef.current, ...patch };
    setSettings(next);
    const res = persistSettings(next);
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }, []);

  const deleteAllData = useCallback(() => {
    deleteUserEntries(USER_ID);
    setEntries({});
  }, []);

  const scores = useMemo(() => toScores(entries), [entries]);

  const store: AppStore = {
    entries,
    scores,
    settings,
    today,
    dataNotice,
    logDay,
    deleteDay,
    retryPersist,
    updateSettings,
    deleteAllData,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useApp(): AppStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

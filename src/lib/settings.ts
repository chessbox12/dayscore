import { WeekStart } from "./dates";
import { loadJSON, saveJSON, SaveResult } from "./storage";

export type ThemeChoice = "light" | "dark" | "system";

export interface Settings {
  version: 1;
  theme: ThemeChoice;
  weekStartsOn: WeekStart;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: "system",
  weekStartsOn: 1,
};

const SETTINGS_KEY = "dayscore:settings";

function isSettings(v: unknown): v is Partial<Settings> {
  return typeof v === "object" && v !== null;
}

/** Loads settings, sanitising field by field so old/unknown data never breaks. */
export function loadSettings(): Settings {
  const res = loadJSON(SETTINGS_KEY, isSettings);
  if (!res.ok) return { ...DEFAULT_SETTINGS };
  const raw = res.value as Partial<Settings>;
  return {
    version: 1,
    theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : "system",
    weekStartsOn: raw.weekStartsOn === 0 ? 0 : 1,
  };
}

export function persistSettings(settings: Settings): SaveResult {
  return saveJSON(SETTINGS_KEY, settings);
}

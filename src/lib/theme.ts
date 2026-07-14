import { ThemeChoice } from "./settings";

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function resolveDark(theme: ThemeChoice): boolean {
  return theme === "dark" || (theme === "system" && media().matches);
}

export function applyTheme(theme: ThemeChoice): void {
  document.documentElement.classList.toggle("dark", resolveDark(theme));
}

/** Re-applies on OS scheme change while in "system" mode. Returns cleanup. */
export function watchSystemTheme(getTheme: () => ThemeChoice, onChange: () => void): () => void {
  const mq = media();
  const handler = () => {
    if (getTheme() === "system") {
      applyTheme("system");
      onChange();
    }
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const THEME_KEY = "synapse_theme_v2";

export type ThemeMode = "light" | "dark";

export function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return "light";
}

export function applyTheme(mode: ThemeMode): void {
  const html = document.documentElement;
  html.setAttribute("data-theme", mode);
  html.classList.remove("light", "dark");
  html.classList.add(mode);
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute("content", mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function toggleTheme(): ThemeMode {
  const next: ThemeMode = readStoredTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

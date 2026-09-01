import type { ChatRigor } from "./api";

const GLOBAL_SETTINGS_KEY = "synapse_global_settings_v1";

export type AccentColor = "teal" | "blue" | "violet" | "amber";
export type BackgroundStyle = "warm" | "clean" | "contrast";
export type ProjectThinkingDefault = "inherit" | ChatRigor;

export type GlobalSettings = {
  thinking: ChatRigor;
  accent: AccentColor;
  background: BackgroundStyle;
  projectThinking: ProjectThinkingDefault;
};

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  thinking: "professional",
  accent: "teal",
  background: "warm",
  projectThinking: "inherit",
};

const RIGORS: ChatRigor[] = ["quick", "professional", "scientific", "discover"];
const ACCENTS: AccentColor[] = ["teal", "blue", "violet", "amber"];
const BACKGROUNDS: BackgroundStyle[] = ["warm", "clean", "contrast"];

export function readStoredGlobalSettings(): GlobalSettings {
  try {
    const raw = localStorage.getItem(GLOBAL_SETTINGS_KEY);
    if (!raw) return DEFAULT_GLOBAL_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<GlobalSettings>;
    return {
      thinking: RIGORS.includes(parsed.thinking as ChatRigor) ? parsed.thinking as ChatRigor : DEFAULT_GLOBAL_SETTINGS.thinking,
      accent: ACCENTS.includes(parsed.accent as AccentColor) ? parsed.accent as AccentColor : DEFAULT_GLOBAL_SETTINGS.accent,
      background: BACKGROUNDS.includes(parsed.background as BackgroundStyle) ? parsed.background as BackgroundStyle : DEFAULT_GLOBAL_SETTINGS.background,
      projectThinking: parsed.projectThinking === "inherit" || RIGORS.includes(parsed.projectThinking as ChatRigor)
        ? parsed.projectThinking as ProjectThinkingDefault
        : DEFAULT_GLOBAL_SETTINGS.projectThinking,
    };
  } catch {
    return DEFAULT_GLOBAL_SETTINGS;
  }
}

export function storeGlobalSettings(settings: GlobalSettings): void {
  try {
    localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Browser storage may be unavailable in hardened sessions. */
  }
}

export function applyGlobalAppearance(settings: GlobalSettings): void {
  const html = document.documentElement;
  html.setAttribute("data-accent", settings.accent);
  html.setAttribute("data-background", settings.background);
}

export function profileForRigor(rigor: ChatRigor): string {
  if (rigor === "quick") return "FAST";
  if (rigor === "scientific" || rigor === "discover") return "DEEP";
  return "BALANCED";
}

export function projectRigor(settings: GlobalSettings): ChatRigor {
  return settings.projectThinking === "inherit" ? settings.thinking : settings.projectThinking;
}

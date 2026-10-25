/**
 * Colour themes. The token VALUES live in index.css as CSS variable sets
 * selected by [data-theme] on <html>; this module is the runtime registry:
 * valid ids, display metadata (including the picker's preview swatches),
 * and how a choice is applied/stored. Adding a future theme = one CSS token
 * set + one entry here — nothing else.
 */

export type ColorTheme = "genji" | "indigo" | "sage" | "plum";

export interface ColorThemeInfo {
  id: ColorTheme;
  name: string;
  /** Picker preview swatches — ink, surface, accent. */
  swatch: { ink: string; surface: string; accent: string };
}

export const COLOR_THEMES: ColorThemeInfo[] = [
  { id: "genji", name: "Genji", swatch: { ink: "#0b0d10", surface: "#f4f0e7", accent: "#c6a15b" } },
  { id: "indigo", name: "Indigo Night", swatch: { ink: "#0e1023", surface: "#f2f3fa", accent: "#8f97e8" } },
  { id: "sage", name: "Sage Press", swatch: { ink: "#101711", surface: "#f5f8f4", accent: "#8fae8b" } },
  { id: "plum", name: "Plum Dusk", swatch: { ink: "#17101d", surface: "#f8f2f5", accent: "#c69ab1" } },
];

const CACHE_KEY = "cr_color_theme";

export function isColorTheme(value: unknown): value is ColorTheme {
  return typeof value === "string" && COLOR_THEMES.some((t) => t.id === value);
}

/** Apply instantly — no reload, no flash. Also caches for next boot. */
export function applyColorTheme(theme: ColorTheme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(CACHE_KEY, theme);
  } catch {
    // localStorage may be unavailable — theme still applies for this session
  }
}

/** Last used theme on this device, applied before first paint. */
export function loadCachedColorTheme(): ColorTheme | null {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    return isColorTheme(v) ? v : null;
  } catch {
    return null;
  }
}

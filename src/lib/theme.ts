export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

/** Browser-chrome colours per theme; keep in sync with --page in globals.css. */
const THEME_COLORS = { light: "#f9f9f7", dark: "#0d0d0d" } as const;

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked (private mode, disabled site data): the choice just won't persist.
  }
}

/**
 * "system" removes the override so globals.css follows prefers-color-scheme;
 * "light"/"dark" pin it via data-theme.
 */
export function applyThemeChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);

  const resolved =
    choice === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : choice;
  // Next emits one theme-color meta per colour scheme; point both at the pinned theme.
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const media = meta.getAttribute("media") ?? "";
    const own = media.includes("dark") ? "dark" : "light";
    meta.setAttribute("content", THEME_COLORS[choice === "system" ? own : resolved]);
  });
}

/**
 * Runs in <head> before first paint so a saved theme never flashes the wrong
 * colours. Must stay dependency-free: it is inlined as a string.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

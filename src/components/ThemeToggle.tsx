"use client";

import { useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  applyThemeChoice,
  readThemeChoice,
  saveThemeChoice,
  type ThemeChoice,
} from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "System",
    icon: (
      <>
        <rect x="2" y="3" width="12" height="8" rx="1.5" />
        <path d="M6 14h4M8 11v3" />
      </>
    ),
  },
  {
    value: "light",
    label: "Light",
    icon: (
      <>
        <circle cx="8" cy="8" r="2.75" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
      </>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: <path d="M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6Z" />,
  },
];

export function ThemeToggle() {
  // Starts at "system" to match the static HTML; the saved choice is already
  // applied to <html> by the head script, and synced into state after mount.
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from storage after hydration
    setChoice(readThemeChoice());

    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const next = readThemeChoice();
      applyThemeChoice(next);
      setChoice(next);
    };
    // Keep the browser-chrome colour right when the OS theme flips under "system".
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => applyThemeChoice(readThemeChoice());

    window.addEventListener("storage", onStorage);
    media.addEventListener("change", onSystemChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      media.removeEventListener("change", onSystemChange);
    };
  }, []);

  const select = (next: ThemeChoice) => {
    setChoice(next);
    saveThemeChoice(next);
    applyThemeChoice(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="no-print inline-flex rounded-md border p-0.5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {OPTIONS.map((opt) => {
        const active = choice === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => select(opt.value)}
            className="grid size-7 place-items-center rounded"
            style={{
              background: active ? "var(--surface-2)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            <svg
              viewBox="0 0 16 16"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {opt.icon}
            </svg>
          </button>
        );
      })}
    </div>
  );
}

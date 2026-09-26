"use client";

import { useEffect, useRef, useState } from "react";
import { toISODate } from "@/lib/format";
import type { Direction } from "@/lib/types";

export interface FilterState {
  from: string;
  to: string;
  types: string[];
  direction: Direction | "all";
  query: string;
}

export interface Preset {
  id: string;
  label: string;
  days: number | null;
}

const PRESETS: Preset[] = [
  { id: "all", label: "Full statement", days: null },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "180", label: "Last 180 days", days: 180 },
];

/** The unfiltered view: the whole statement, every type, both directions. */
export function defaultFilters(bounds: { start: Date; end: Date }): FilterState {
  return {
    from: toISODate(bounds.start),
    to: toISODate(bounds.end),
    types: [],
    direction: "all",
    query: "",
  };
}

export function isDefaultFilters(
  state: FilterState,
  bounds: { start: Date; end: Date },
): boolean {
  const d = defaultFilters(bounds);
  return (
    state.from === d.from &&
    state.to === d.to &&
    state.types.length === 0 &&
    state.direction === "all" &&
    state.query.trim() === ""
  );
}

/**
 * One filter row above everything it scopes — every chart and table below
 * re-renders against the same slice.
 */
export function Filters({
  state,
  onChange,
  allTypes,
  bounds,
  resultCount,
  totalCount,
}: {
  state: FilterState;
  onChange: (next: FilterState) => void;
  allTypes: string[];
  bounds: { start: Date; end: Date };
  resultCount: number;
  totalCount: number;
}) {
  const [typesOpen, setTypesOpen] = useState(false);
  const typesRef = useRef<HTMLDivElement | null>(null);
  const typesButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!typesOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!typesRef.current?.contains(e.target as Node)) setTypesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTypesOpen(false);
        typesButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [typesOpen]);

  // "/" jumps to search, as on most sites with one search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']")
      )
        return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const presetRange = (preset: Preset) => {
    if (preset.days == null) {
      return { from: toISODate(bounds.start), to: toISODate(bounds.end) };
    }
    const from = new Date(bounds.end);
    from.setDate(from.getDate() - preset.days + 1);
    return {
      from: toISODate(from < bounds.start ? bounds.start : from),
      to: toISODate(bounds.end),
    };
  };

  // Presets longer than the statement would all select the same range, so
  // only offer the ones that actually narrow it (plus "Full statement").
  const spanDays =
    Math.round((bounds.end.getTime() - bounds.start.getTime()) / 86_400_000) + 1;
  const presets = PRESETS.filter((p) => p.days == null || p.days < spanDays);

  const activePreset = presets.find((p) => {
    const range = presetRange(p);
    return state.from === range.from && state.to === range.to;
  });

  const toggleType = (type: string) => {
    const next = state.types.includes(type)
      ? state.types.filter((t) => t !== type)
      : [...state.types, type];
    onChange({ ...state, types: next });
  };

  const dirty = !isDefaultFilters(state, bounds);

  const chip =
    "chip-btn rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap";
  const chipStyle = (active: boolean) => ({
    borderColor: active ? "var(--border-strong)" : "var(--border)",
    background: active ? "var(--surface-2)" : "var(--surface)",
    color: active ? "var(--text-primary)" : "var(--text-secondary)",
  });

  // Sticky only from sm up — on a phone the row wraps to four lines and would
  // eat half the viewport.

  return (
    <div
      className="no-print z-30 -mx-4 mb-6 border-b px-4 py-3 backdrop-blur sm:sticky sm:top-0 sm:-mx-6 sm:px-6"
      style={{
        background: "color-mix(in srgb, var(--page) 88%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Date range presets"
        >
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ ...state, ...presetRange(preset) })}
              aria-pressed={activePreset?.id === preset.id}
              className={chip}
              style={chipStyle(activePreset?.id === preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <input
            type="date"
            aria-label="From date"
            value={state.from}
            min={toISODate(bounds.start)}
            max={state.to}
            onChange={(e) =>
              e.target.value && onChange({ ...state, from: e.target.value })
            }
            className="rounded-md border px-2 py-1.5 text-xs"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
            }}
          />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            to
          </span>
          <input
            type="date"
            aria-label="To date"
            value={state.to}
            min={state.from}
            max={toISODate(bounds.end)}
            onChange={(e) =>
              e.target.value && onChange({ ...state, to: e.target.value })
            }
            className="rounded-md border px-2 py-1.5 text-xs"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Direction">
          {(["all", "out", "in"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => onChange({ ...state, direction: dir })}
              aria-pressed={state.direction === dir}
              className={chip}
              style={chipStyle(state.direction === dir)}
            >
              {dir === "all" ? "All" : dir === "out" ? "Money out" : "Money in"}
            </button>
          ))}
        </div>

        <div className="relative" ref={typesRef}>
          <button
            ref={typesButtonRef}
            type="button"
            onClick={() => setTypesOpen((v) => !v)}
            aria-expanded={typesOpen}
            aria-haspopup="true"
            className={`${chip} inline-flex items-center gap-1`}
            style={chipStyle(state.types.length > 0)}
          >
            {state.types.length === 1
              ? state.types[0]
              : state.types.length > 1
                ? `${state.types.length} types`
                : "All types"}
            <svg
              viewBox="0 0 12 12"
              className="size-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path d="M3 4.5 6 7.5 9 4.5" />
            </svg>
          </button>
          {typesOpen ? (
            <div
              className="thin-scroll absolute left-0 top-full z-40 mt-1 max-h-72 w-60 overflow-auto rounded-lg border p-1 shadow-lg"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border-strong)",
              }}
            >
              <button
                type="button"
                onClick={() => onChange({ ...state, types: [] })}
                disabled={state.types.length === 0}
                className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-[var(--surface-2)] disabled:opacity-50"
                style={{ color: "var(--text-muted)" }}
              >
                Clear selection
              </button>
              {allTypes.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-[var(--surface-2)]"
                >
                  <input
                    type="checkbox"
                    checked={state.types.includes(type)}
                    onChange={() => toggleType(type)}
                    className="size-3.5 accent-[var(--series-1)]"
                  />
                  <span style={{ color: "var(--text-secondary)" }}>{type}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative min-w-[12rem] flex-1">
          <input
            ref={searchRef}
            type="search"
            value={state.query}
            onChange={(e) => onChange({ ...state, query: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Escape" && state.query) {
                e.preventDefault();
                onChange({ ...state, query: "" });
              }
            }}
            placeholder="Search name, number, TRX ID…"
            aria-label="Search transactions"
            aria-keyshortcuts="/"
            className="w-full rounded-md border py-1.5 pl-2.5 pr-7 text-xs"
            style={{
              borderColor: state.query ? "var(--border-strong)" : "var(--border)",
              background: "var(--surface)",
              color: "var(--text-primary)",
            }}
          />
          {state.query ? null : (
            <kbd
              aria-hidden
              className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border px-1 text-[10px] sm:block"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              /
            </kbd>
          )}
        </div>

        <a
          href="#transactions"
          className="tnum text-xs whitespace-nowrap hover:underline"
          style={{ color: "var(--text-muted)" }}
          aria-live="polite"
          title="Jump to the transaction list"
        >
          {dirty
            ? `${resultCount} of ${totalCount} transactions`
            : `${totalCount} transactions`}
        </a>

        {dirty ? (
          <button
            type="button"
            onClick={() => onChange(defaultFilters(bounds))}
            className={chip}
            style={{
              borderColor: "var(--border)",
              background: "transparent",
              color: "var(--text-primary)",
            }}
          >
            Reset filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

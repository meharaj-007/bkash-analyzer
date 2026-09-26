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

  useEffect(() => {
    if (!typesOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!typesRef.current?.contains(e.target as Node)) setTypesOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [typesOpen]);

  const applyPreset = (preset: Preset) => {
    if (preset.days == null) {
      onChange({
        ...state,
        from: toISODate(bounds.start),
        to: toISODate(bounds.end),
      });
      return;
    }
    const from = new Date(bounds.end);
    from.setDate(from.getDate() - preset.days + 1);
    onChange({
      ...state,
      from: toISODate(from < bounds.start ? bounds.start : from),
      to: toISODate(bounds.end),
    });
  };

  const activePreset = PRESETS.find((p) => {
    if (p.days == null) {
      return (
        state.from === toISODate(bounds.start) &&
        state.to === toISODate(bounds.end)
      );
    }
    const from = new Date(bounds.end);
    from.setDate(from.getDate() - p.days + 1);
    return (
      state.from === toISODate(from < bounds.start ? bounds.start : from) &&
      state.to === toISODate(bounds.end)
    );
  });

  const toggleType = (type: string) => {
    const next = state.types.includes(type)
      ? state.types.filter((t) => t !== type)
      : [...state.types, type];
    onChange({ ...state, types: next });
  };

  const chip =
    "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors";

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
        <div className="flex flex-wrap items-center gap-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              aria-pressed={activePreset?.id === preset.id}
              className={chip}
              style={{
                borderColor:
                  activePreset?.id === preset.id
                    ? "var(--border-strong)"
                    : "var(--border)",
                background:
                  activePreset?.id === preset.id
                    ? "var(--surface-2)"
                    : "var(--surface)",
                color:
                  activePreset?.id === preset.id
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
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
            onChange={(e) => onChange({ ...state, from: e.target.value })}
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
            onChange={(e) => onChange({ ...state, to: e.target.value })}
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
              style={{
                borderColor:
                  state.direction === dir
                    ? "var(--border-strong)"
                    : "var(--border)",
                background:
                  state.direction === dir ? "var(--surface-2)" : "var(--surface)",
                color:
                  state.direction === dir
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
            >
              {dir === "all" ? "All" : dir === "out" ? "Money out" : "Money in"}
            </button>
          ))}
        </div>

        <div className="relative" ref={typesRef}>
          <button
            type="button"
            onClick={() => setTypesOpen((v) => !v)}
            aria-expanded={typesOpen}
            className={chip}
            style={{
              borderColor:
                state.types.length > 0 ? "var(--border-strong)" : "var(--border)",
              background:
                state.types.length > 0 ? "var(--surface-2)" : "var(--surface)",
              color: "var(--text-secondary)",
            }}
          >
            {state.types.length > 0
              ? `${state.types.length} type${state.types.length > 1 ? "s" : ""}`
              : "All types"}
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
                className="w-full rounded px-2 py-1.5 text-left text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Clear selection
              </button>
              {allTypes.map((type) => (
                <label
                  key={type}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-[var(--surface-2)]"
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

        <input
          type="search"
          value={state.query}
          onChange={(e) => onChange({ ...state, query: e.target.value })}
          placeholder="Search name, number, TRX ID…"
          aria-label="Search transactions"
          className="min-w-[12rem] flex-1 rounded-md border px-2.5 py-1.5 text-xs"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--text-primary)",
          }}
        />

        <span
          className="tnum text-xs whitespace-nowrap"
          style={{ color: "var(--text-muted)" }}
        >
          {resultCount} of {totalCount}
        </span>
      </div>
    </div>
  );
}

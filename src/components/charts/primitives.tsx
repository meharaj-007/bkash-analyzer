"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Measure a container so charts can size themselves to the grid. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.round(w));
    });
    observer.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
}

/** Shared hover layer: one tooltip per chart, positioned against the card. */
export function useTooltip() {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const show = useCallback((state: TooltipState) => setTip(state), []);
  const hide = useCallback(() => setTip(null), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTip(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { tip, show, hide };
}

export function Tooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute z-20 min-w-[9rem] -translate-x-1/2 -translate-y-full rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{
        left: tip.x,
        top: tip.y - 10,
        background: "var(--surface)",
        borderColor: "var(--border-strong)",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="mb-1 font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {tip.title}
      </div>
      {tip.rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-3 leading-5"
        >
          <span className="flex items-center gap-1.5">
            {row.color ? (
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ background: row.color }}
              />
            ) : null}
            <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
          </span>
          <span className="tnum font-medium">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <span
            aria-hidden
            className="inline-block h-[3px] w-3.5 rounded-full"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Chart card. Every chart ships a table twin, so no value is reachable by
 * hover alone.
 */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    // min-w-0 lets the card shrink below its SVG's intrinsic width inside a grid
    // track, so the measured width can go back down on a narrow screen.
    <section
      className={`flex min-w-0 flex-col rounded-xl border p-4 sm:p-5 ${className}`}
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {legend}
          {table ? (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
              className="no-print rounded-md border px-2 py-1 text-[11px] font-medium transition-colors"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                background: showTable ? "var(--surface-2)" : "transparent",
              }}
            >
              {showTable ? "Chart" : "Table"}
            </button>
          ) : null}
        </div>
      </header>
      {showTable && table ? (
        <div className="thin-scroll max-h-80 overflow-auto">{table}</div>
      ) : (
        children
      )}
    </section>
  );
}

/** The WCAG-clean twin of a chart. */
export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr
          className="text-left"
          style={{ color: "var(--text-muted)" }}
        >
          {columns.map((c, i) => (
            <th
              key={c}
              scope="col"
              className={`sticky top-0 border-b px-2 py-1.5 font-medium ${i === 0 ? "text-left" : "text-right"}`}
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ color: "var(--text-secondary)" }}>
            {row.map((cell, j) => (
              <td
                key={j}
                className={`border-b px-2 py-1.5 ${j === 0 ? "text-left" : "tnum text-right"}`}
                style={{ borderColor: "var(--grid)" }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function EmptyChart({ message }: { message: string }) {
  return (
    <div
      className="flex h-40 items-center justify-center text-xs"
      style={{ color: "var(--text-muted)" }}
    >
      {message}
    </div>
  );
}

/** Nice round tick values for a linear axis. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * magnitude);
  const step = candidates.find((c) => c >= rawStep) ?? magnitude * 10;
  // Round the top up so the largest value always fits inside the axis.
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  // Multiply rather than accumulate so steps like 0.2 don't drift (0.6000000000000001).
  for (let i = 0; i * step <= top + step * 0.001; i++) {
    ticks.push(Number((i * step).toPrecision(12)));
  }
  return ticks;
}

"use client";

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  spark,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "bad";
  spark?: number[];
}) {
  const valueColor =
    tone === "good"
      ? "var(--success-text)"
      : tone === "bad"
        ? "var(--status-critical)"
        : "var(--text-primary)";

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      {/* Proportional figures: tabular-nums makes big numbers look loose. */}
      <div
        className="mt-1 text-2xl font-semibold tracking-tight"
        style={{ color: valueColor }}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          {hint}
        </div>
      ) : null}
      {spark && spark.length > 1 ? <Sparkline values={spark} /> : null}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 24;
  const max = Math.max(...values, 1);
  const step = w / Math.max(1, values.length - 1);
  const d = values
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(h - (v / max) * h).toFixed(1)}`,
    )
    .join(" ");
  const lastX = (values.length - 1) * step;
  const lastY = h - (values[values.length - 1] / max) * h;
  return (
    <svg
      width={w}
      height={h}
      className="mt-2 overflow-visible"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--axis)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={3}
        fill="var(--series-1)"
        stroke="var(--surface)"
        strokeWidth={2}
      />
    </svg>
  );
}

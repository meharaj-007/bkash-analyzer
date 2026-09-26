"use client";

import { formatCount, formatHour, formatTaka } from "@/lib/format";
import {
  ChartCard,
  DataTable,
  EmptyChart,
  Tooltip,
  useMeasure,
  useTooltip,
} from "./primitives";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GAP = 2; // surface gap, same width everywhere
const LABEL_W = 30;
const AXIS_BAND = 18;

/** One hue, light to dark. Magnitude is the only thing colour carries here. */
const RAMP = [
  "var(--seq-100)",
  "var(--seq-200)",
  "var(--seq-300)",
  "var(--seq-400)",
  "var(--seq-500)",
  "var(--seq-600)",
];

export interface HeatCell {
  weekday: number;
  hour: number;
  count: number;
  out: number;
}

export function ActivityHeatmap({ data }: { data: HeatCell[] }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const { tip, show, hide } = useTooltip();

  const max = Math.max(...data.map((d) => d.count), 0);

  const busiest = [...data]
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const table = (
    <DataTable
      columns={["Slot", "Transactions", "Sent out"]}
      rows={busiest.map((d) => [
        `${WEEKDAYS[d.weekday]} ${formatHour(d.hour)}`,
        formatCount(d.count),
        formatTaka(d.out),
      ])}
    />
  );

  if (max === 0) {
    return (
      <ChartCard title="When you transact" subtitle="Day of week by hour">
        <EmptyChart message="No transactions in this range." />
      </ChartCard>
    );
  }

  const cell = Math.max(6, (width - LABEL_W - GAP * 23) / 24);
  const height = 7 * (cell + GAP) + AXIS_BAND;

  return (
    <ChartCard
      title="When you transact"
      subtitle={`Transaction count by weekday and hour · peak ${max} in one slot`}
      table={table}
      className="lg:col-span-2"
      legend={
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            fewer
          </span>
          {RAMP.map((c) => (
            <span
              key={c}
              aria-hidden
              className="inline-block size-3 rounded-[2px]"
              style={{ background: c }}
            />
          ))}
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            more
          </span>
        </div>
      }
    >
      <div ref={ref} className="relative w-full min-w-0">
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Heatmap of transaction counts by weekday and hour of day"
          >
            {WEEKDAYS.map((label, wd) => (
              <text
                key={label}
                x={0}
                y={wd * (cell + GAP) + cell / 2 + 4}
                fontSize={10}
                fill="var(--text-muted)"
              >
                {label}
              </text>
            ))}

            {data.map((d) => {
              const x = LABEL_W + d.hour * (cell + GAP);
              const y = d.weekday * (cell + GAP);
              const step =
                d.count === 0
                  ? null
                  : RAMP[
                      Math.min(
                        RAMP.length - 1,
                        Math.floor((d.count / max) * RAMP.length),
                      )
                    ];
              const onMove = (e: React.MouseEvent) => {
                const rect = (
                  e.currentTarget.closest("svg") as SVGSVGElement
                ).getBoundingClientRect();
                show({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  title: `${WEEKDAYS[d.weekday]}, ${formatHour(d.hour)}`,
                  rows: [
                    { label: "Transactions", value: formatCount(d.count) },
                    { label: "Sent out", value: formatTaka(d.out) },
                  ],
                });
              };
              return (
                <rect
                  key={`${d.weekday}-${d.hour}`}
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx={2}
                  fill={step ?? "var(--surface-2)"}
                  onMouseMove={onMove}
                  onMouseLeave={hide}
                />
              );
            })}

            {[0, 6, 12, 18, 23].map((h) => (
              <text
                key={h}
                x={LABEL_W + h * (cell + GAP) + cell / 2}
                y={height - 5}
                textAnchor="middle"
                fontSize={10}
                fill="var(--text-muted)"
              >
                {formatHour(h)}
              </text>
            ))}
          </svg>
        ) : (
          <div style={{ height }} />
        )}
        <Tooltip tip={tip} />
      </div>
    </ChartCard>
  );
}

"use client";

import { formatTaka, formatTakaShort, percent } from "@/lib/format";
import {
  ChartCard,
  DataTable,
  EmptyChart,
  Tooltip,
  useMeasure,
  useTooltip,
} from "./primitives";

export interface HBarDatum {
  key: string;
  label: string;
  value: number;
  /** Extra context shown in the tooltip, e.g. transaction count. */
  note?: string;
}

const ROW_H = 30;
const BAR_H = 14;
const LABEL_W = 132;
const VALUE_W = 78;

/**
 * One measure across nominal categories: a single colour for every bar
 * (a value-ramp here would double-encode length as hue).
 */
export function HBars({
  title,
  subtitle,
  data,
  color = "var(--series-1)",
  valueHeader = "Amount",
  totalForShare,
}: {
  title: string;
  subtitle?: string;
  data: HBarDatum[];
  color?: string;
  valueHeader?: string;
  totalForShare?: number;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const { tip, show, hide } = useTooltip();

  const total = totalForShare ?? data.reduce((a, d) => a + d.value, 0);
  const table = (
    <DataTable
      columns={["Category", valueHeader, "Share"]}
      rows={data.map((d) => [
        d.label,
        formatTaka(d.value),
        percent(d.value, total),
      ])}
    />
  );

  if (data.length === 0) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <EmptyChart message="Nothing to show for this range." />
      </ChartCard>
    );
  }

  const height = data.length * ROW_H;
  const trackW = Math.max(20, width - LABEL_W - VALUE_W);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ChartCard title={title} subtitle={subtitle} table={table}>
      <div ref={ref} className="relative w-full min-w-0">
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${title}, ranked`}
          >
            {data.map((d, i) => {
              const y = i * ROW_H;
              const barW = Math.max(2, (d.value / max) * trackW);
              const onMove = (e: React.MouseEvent) => {
                const rect = (
                  e.currentTarget.closest("svg") as SVGSVGElement
                ).getBoundingClientRect();
                show({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  title: d.label,
                  rows: [
                    { label: valueHeader, value: formatTaka(d.value), color },
                    { label: "Share", value: percent(d.value, total) },
                    ...(d.note ? [{ label: "Detail", value: d.note }] : []),
                  ],
                });
              };
              return (
                <g key={d.key} onMouseMove={onMove} onMouseLeave={hide}>
                  <rect
                    x={0}
                    y={y}
                    width={width}
                    height={ROW_H}
                    fill="transparent"
                  />
                  <text
                    x={0}
                    y={y + ROW_H / 2 + 4}
                    fontSize={11}
                    fill="var(--text-secondary)"
                  >
                    {truncate(d.label, 20)}
                  </text>
                  <RoundedBar
                    x={LABEL_W}
                    y={y + (ROW_H - BAR_H) / 2}
                    width={barW}
                    height={BAR_H}
                    fill={color}
                  />
                  <text
                    x={width}
                    y={y + ROW_H / 2 + 4}
                    textAnchor="end"
                    className="tnum"
                    fontSize={11}
                    fontWeight={500}
                    fill="var(--text-primary)"
                  >
                    {formatTakaShort(d.value)}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div style={{ height }} />
        )}
        <Tooltip tip={tip} />
      </div>
    </ChartCard>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** 4px rounded data-end, square where it meets the baseline. */
function RoundedBar({
  x,
  y,
  width,
  height,
  fill,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}) {
  const r = Math.min(4, width, height / 2);
  const d = `M ${x} ${y} L ${x + width - r} ${y} Q ${x + width} ${y} ${x + width} ${y + r} L ${x + width} ${y + height - r} Q ${x + width} ${y + height} ${x + width - r} ${y + height} L ${x} ${y + height} Z`;
  return <path d={d} fill={fill} />;
}

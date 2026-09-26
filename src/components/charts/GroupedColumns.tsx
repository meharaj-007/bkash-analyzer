"use client";

import { formatAxis, formatTaka } from "@/lib/format";
import {
  ChartCard,
  DataTable,
  EmptyChart,
  Legend,
  Tooltip,
  niceTicks,
  useMeasure,
  useTooltip,
} from "./primitives";

export interface ColumnDatum {
  key: string;
  label: string;
  a: number;
  b: number;
}

const HEIGHT = 220;
const AXIS_BAND = 22;
const PAD_LEFT = 46;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const MAX_BAR = 22;
const GAP = 2; // surface gap between the touching pair

/** Two measures per category, one shared y-axis. Never a second scale. */
export function GroupedColumns({
  title,
  subtitle,
  data,
  seriesA,
  seriesB,
}: {
  title: string;
  subtitle?: string;
  data: ColumnDatum[];
  seriesA: { label: string; color: string };
  seriesB: { label: string; color: string };
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const { tip, show, hide } = useTooltip();

  const table = (
    <DataTable
      columns={["Period", seriesA.label, seriesB.label]}
      rows={data.map((d) => [d.label, formatTaka(d.a), formatTaka(d.b)])}
    />
  );

  if (data.length === 0) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <EmptyChart message="No transactions in this range." />
      </ChartCard>
    );
  }

  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = HEIGHT - PAD_TOP - AXIS_BAND;
  const max = Math.max(...data.flatMap((d) => [d.a, d.b]), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const band = plotW / data.length;
  const barW = Math.min(MAX_BAR, Math.max(4, (band - GAP) / 2 - 6));
  const y = (v: number) => PAD_TOP + plotH - (v / top) * plotH;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      legend={
        <Legend
          items={[
            { label: seriesA.label, color: seriesA.color },
            { label: seriesB.label, color: seriesB.color },
          ]}
        />
      }
      table={table}
    >
      <div ref={ref} className="relative w-full min-w-0">
        {width > 0 ? (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${title}. ${seriesA.label} and ${seriesB.label} per period.`}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD_LEFT}
                  x2={width - PAD_RIGHT}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? "var(--axis)" : "var(--grid)"}
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={y(t) + 4}
                  textAnchor="end"
                  className="tnum"
                  fontSize={10}
                  fill="var(--text-muted)"
                >
                  {formatAxis(t)}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const cx = PAD_LEFT + band * i + band / 2;
              const aX = cx - barW - GAP / 2;
              const bX = cx + GAP / 2;
              const onEnter = (e: React.MouseEvent) => {
                const rect = (
                  e.currentTarget.closest("svg") as SVGSVGElement
                ).getBoundingClientRect();
                show({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  title: d.label,
                  rows: [
                    {
                      label: seriesA.label,
                      value: formatTaka(d.a),
                      color: seriesA.color,
                    },
                    {
                      label: seriesB.label,
                      value: formatTaka(d.b),
                      color: seriesB.color,
                    },
                  ],
                });
              };
              return (
                <g key={d.key} onMouseMove={onEnter} onMouseLeave={hide}>
                  {/* hit area spans the whole band so the target stays large */}
                  <rect
                    x={PAD_LEFT + band * i}
                    y={PAD_TOP}
                    width={band}
                    height={plotH}
                    fill="transparent"
                  />
                  <RoundedColumn
                    x={aX}
                    width={barW}
                    yTop={y(d.a)}
                    yBase={y(0)}
                    fill={seriesA.color}
                  />
                  <RoundedColumn
                    x={bX}
                    width={barW}
                    yTop={y(d.b)}
                    yBase={y(0)}
                    fill={seriesB.color}
                  />
                  <text
                    x={cx}
                    y={HEIGHT - 6}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--text-muted)"
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : (
          <div style={{ height: HEIGHT }} />
        )}
        <Tooltip tip={tip} />
      </div>
    </ChartCard>
  );
}

/** 4px rounded cap, square at the baseline. */
function RoundedColumn({
  x,
  width,
  yTop,
  yBase,
  fill,
}: {
  x: number;
  width: number;
  yTop: number;
  yBase: number;
  fill: string;
}) {
  const h = Math.max(0, yBase - yTop);
  if (h <= 0.5) return null;
  const r = Math.min(4, width / 2, h);
  const d = `M ${x} ${yBase} L ${x} ${yTop + r} Q ${x} ${yTop} ${x + r} ${yTop} L ${x + width - r} ${yTop} Q ${x + width} ${yTop} ${x + width} ${yTop + r} L ${x + width} ${yBase} Z`;
  return <path d={d} fill={fill} />;
}

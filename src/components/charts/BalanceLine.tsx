"use client";

import { useMemo, useRef, useState } from "react";
import { formatAxis, formatDate, formatTaka } from "@/lib/format";
import {
  ChartCard,
  DataTable,
  EmptyChart,
  Tooltip,
  niceTicks,
  useMeasure,
  useTooltip,
} from "./primitives";

const HEIGHT = 260;
const AXIS_BAND = 22;
const PAD_LEFT = 52;
const PAD_RIGHT = 12;
const PAD_TOP = 12;

export interface BalancePoint {
  date: Date;
  balance: number;
}

/** Single series, so no legend box — the title names what is plotted. */
export function BalanceLine({
  data,
  subtitle,
}: {
  data: BalancePoint[];
  subtitle?: string;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const { tip, show, hide } = useTooltip();
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const table = (
    <DataTable
      columns={["Date", "Closing balance"]}
      rows={data.map((d) => [formatDate(d.date), formatTaka(d.balance)])}
    />
  );

  const geometry = useMemo(() => {
    if (data.length === 0 || width === 0) return null;
    const plotW = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
    const plotH = HEIGHT - PAD_TOP - AXIS_BAND;
    const max = Math.max(...data.map((d) => d.balance), 1);
    const ticks = niceTicks(max);
    const top = ticks[ticks.length - 1];
    const t0 = data[0].date.getTime();
    const t1 = data[data.length - 1].date.getTime();
    const span = Math.max(1, t1 - t0);
    const x = (d: Date) => PAD_LEFT + ((d.getTime() - t0) / span) * plotW;
    const y = (v: number) => PAD_TOP + plotH - (v / top) * plotH;
    const points = data.map((d) => ({ ...d, cx: x(d.date), cy: y(d.balance) }));
    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx.toFixed(2)} ${p.cy.toFixed(2)}`)
      .join(" ");
    const area = `${line} L ${points[points.length - 1].cx.toFixed(2)} ${y(0)} L ${points[0].cx.toFixed(2)} ${y(0)} Z`;
    return { plotW, plotH, ticks, y, points, line, area };
  }, [data, width]);

  if (data.length === 0) {
    return (
      <ChartCard title="Balance over time" subtitle={subtitle}>
        <EmptyChart message="No transactions in this range." />
      </ChartCard>
    );
  }

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!geometry) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    geometry.points.forEach((p, i) => {
      const d = Math.abs(p.cx - mx);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    const point = geometry.points[nearest];
    setHover(nearest);
    show({
      x: point.cx,
      y: point.cy,
      title: formatDate(point.date),
      rows: [
        {
          label: "Closing balance",
          value: formatTaka(point.balance),
          color: "var(--series-1)",
        },
      ],
    });
  };

  const last = geometry?.points[geometry.points.length - 1];

  return (
    <ChartCard
      title="Balance over time"
      subtitle={subtitle}
      table={table}
    >
      <div ref={ref} className="relative w-full min-w-0">
        {geometry && width > 0 ? (
          <svg
            ref={svgRef}
            width={width}
            height={HEIGHT}
            role="img"
            aria-label="Wallet closing balance for each active day"
            onMouseMove={handleMove}
            onMouseLeave={() => {
              hide();
              setHover(null);
            }}
          >
            {geometry.ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD_LEFT}
                  x2={width - PAD_RIGHT}
                  y1={geometry.y(t)}
                  y2={geometry.y(t)}
                  stroke={t === 0 ? "var(--axis)" : "var(--grid)"}
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={geometry.y(t) + 4}
                  textAnchor="end"
                  className="tnum"
                  fontSize={10}
                  fill="var(--text-muted)"
                >
                  {formatAxis(t)}
                </text>
              </g>
            ))}

            <path d={geometry.area} fill="var(--series-1)" opacity={0.1} />
            <path
              d={geometry.line}
              fill="none"
              stroke="var(--series-1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {hover != null ? (
              <g>
                <line
                  x1={geometry.points[hover].cx}
                  x2={geometry.points[hover].cx}
                  y1={PAD_TOP}
                  y2={PAD_TOP + geometry.plotH}
                  stroke="var(--axis)"
                  strokeWidth={1}
                />
                <circle
                  cx={geometry.points[hover].cx}
                  cy={geometry.points[hover].cy}
                  r={5}
                  fill="var(--series-1)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              </g>
            ) : null}

            {last ? (
              <g>
                <circle
                  cx={last.cx}
                  cy={last.cy}
                  r={4}
                  fill="var(--series-1)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
                <text
                  x={last.cx - 8}
                  y={last.cy - 10}
                  textAnchor="end"
                  className="tnum"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--text-primary)"
                >
                  {formatTaka(last.balance)}
                </text>
              </g>
            ) : null}

            <text
              x={PAD_LEFT}
              y={HEIGHT - 6}
              fontSize={10}
              fill="var(--text-muted)"
            >
              {formatDate(data[0].date)}
            </text>
            <text
              x={width - PAD_RIGHT}
              y={HEIGHT - 6}
              textAnchor="end"
              fontSize={10}
              fill="var(--text-muted)"
            >
              {formatDate(data[data.length - 1].date)}
            </text>
          </svg>
        ) : (
          <div style={{ height: HEIGHT }} />
        )}
        <Tooltip tip={tip} />
      </div>
    </ChartCard>
  );
}

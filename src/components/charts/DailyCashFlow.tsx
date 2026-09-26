"use client";

import { useState } from "react";
import type { DayBucket } from "@/lib/analyze";
import { formatAxis, formatCount, formatDate, formatTaka } from "@/lib/format";
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

const HEIGHT = 240;
const AXIS_BAND = 22;
const PAD_LEFT = 46;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const MAX_BAR = 14;
const MIN_LABEL_GAP = 64;
const MIN_TICK_GAP = 16;

const IN_COLOR = "var(--series-1)";
const OUT_COLOR = "var(--series-2)";

const shortDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

/**
 * Diverging daily columns: money in rises above the zero line, money out
 * (fees included) drops below it, on one shared scale. Every calendar day gets
 * a slot, so quiet days read as gaps rather than disappearing.
 */
export function DailyCashFlow({
  data,
  className = "",
}: {
  data: DayBucket[];
  className?: string;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const { tip, show, hide } = useTooltip();
  const [active, setActive] = useState<number | null>(null);

  const title = "Daily cash flow";
  const activeDays = data.filter((d) => d.count > 0);
  const subtitle = `Money in above the line, money out (fees included) below · ${formatCount(
    activeDays.length,
  )} active of ${formatCount(data.length)} days`;

  const table = (
    <DataTable
      columns={["Date", "In", "Out", "Net", "Transactions"]}
      rows={activeDays.map((d) => [
        formatDate(d.date),
        formatTaka(d.in),
        formatTaka(d.out),
        formatTaka(d.net, { sign: true }),
        d.count,
      ])}
    />
  );

  if (activeDays.length === 0) {
    return (
      <ChartCard title={title} className={className}>
        <EmptyChart message="No transactions in this range." />
      </ChartCard>
    );
  }

  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = HEIGHT - PAD_TOP - AXIS_BAND;
  const inTicks = niceTicks(Math.max(...data.map((d) => d.in)), 3);
  const outTicks = niceTicks(Math.max(...data.map((d) => d.out)), 3);
  const inTop = inTicks[inTicks.length - 1];
  const outTop = outTicks[outTicks.length - 1];
  const scale = plotH / (inTop + outTop || 1);
  const zeroY = PAD_TOP + inTop * scale;

  const band = plotW / data.length;
  const barW = Math.max(1, Math.min(MAX_BAR, band - (band > 6 ? 2 : 0.5)));
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, plotW / MIN_LABEL_GAP)));

  // Salary-sized inflows can squeeze the other side; when its ticks would sit
  // closer than a label height, keep only its outermost one.
  const spaced = (list: number[]) =>
    list.length > 2 && (list[1] - list[0]) * scale < MIN_TICK_GAP
      ? [list[0], list[list.length - 1]]
      : list;
  const ticks = [
    ...spaced(outTicks).slice(1).map((t) => ({ value: -t, y: zeroY + t * scale })),
    ...spaced(inTicks).map((t) => ({ value: t, y: zeroY - t * scale })),
  ];

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      className={className}
      legend={
        <Legend
          items={[
            { label: "In", color: IN_COLOR },
            { label: "Out", color: OUT_COLOR },
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
            aria-label={`${title}. Money in and money out for each of ${data.length} days from ${formatDate(
              data[0].date,
            )} to ${formatDate(data[data.length - 1].date)}.`}
            onMouseLeave={() => {
              setActive(null);
              hide();
            }}
          >
            {ticks.map((t) => (
              <g key={t.value}>
                <line
                  x1={PAD_LEFT}
                  x2={width - PAD_RIGHT}
                  y1={t.y}
                  y2={t.y}
                  stroke={t.value === 0 ? "var(--axis)" : "var(--grid)"}
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={t.y + 4}
                  textAnchor="end"
                  className="tnum"
                  fontSize={10}
                  fill="var(--text-muted)"
                >
                  {formatAxis(t.value)}
                </text>
              </g>
            ))}

            {data.map((d, i) => {
              const x0 = PAD_LEFT + band * i;
              const x = x0 + (band - barW) / 2;
              const inH = d.in * scale;
              const outH = d.out * scale;
              const onMove = (e: React.MouseEvent) => {
                const rect = (
                  e.currentTarget.closest("svg") as SVGSVGElement
                ).getBoundingClientRect();
                setActive(i);
                show({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                  title: formatDate(d.date),
                  rows: [
                    { label: "In", value: formatTaka(d.in), color: IN_COLOR },
                    { label: "Out", value: formatTaka(d.out), color: OUT_COLOR },
                    { label: "Net", value: formatTaka(d.net, { sign: true }) },
                    { label: "Transactions", value: formatCount(d.count) },
                  ],
                });
              };
              return (
                <g key={d.key} onMouseMove={onMove}>
                  <rect
                    x={x0}
                    y={PAD_TOP}
                    width={band}
                    height={plotH}
                    fill={active === i ? "var(--surface-2)" : "transparent"}
                  />
                  {inH > 0.5 ? (
                    <rect x={x} y={zeroY - inH} width={barW} height={inH} rx={Math.min(2, barW / 2)} fill={IN_COLOR} />
                  ) : null}
                  {outH > 0.5 ? (
                    <rect x={x} y={zeroY} width={barW} height={outH} rx={Math.min(2, barW / 2)} fill={OUT_COLOR} />
                  ) : null}
                  {i % labelEvery === 0 ? (
                    <text
                      x={x0 + band / 2}
                      y={HEIGHT - 6}
                      textAnchor="middle"
                      fontSize={10}
                      fill="var(--text-muted)"
                    >
                      {shortDate(d.date)}
                    </text>
                  ) : null}
                </g>
              );
            })}

            <line
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={zeroY}
              y2={zeroY}
              stroke="var(--axis)"
              strokeWidth={1}
            />
          </svg>
        ) : (
          <div style={{ height: HEIGHT }} />
        )}
        <Tooltip tip={tip} />
      </div>
    </ChartCard>
  );
}

"use client";

import { useMemo, useState } from "react";
import { analyze } from "@/lib/analyze";
import { download, statementToJson, txnsToCsv } from "@/lib/export";
import {
  formatCount,
  formatDate,
  formatMonth,
  formatTaka,
  formatTakaShort,
  percent,
  toISODate,
} from "@/lib/format";
import type { Statement } from "@/lib/types";
import { ActivityHeatmap } from "./charts/ActivityHeatmap";
import { BalanceLine } from "./charts/BalanceLine";
import { GroupedColumns } from "./charts/GroupedColumns";
import { HBars } from "./charts/HBars";
import { ChartCard, DataTable } from "./charts/primitives";
import { Filters, type FilterState } from "./Filters";
import { StatTile } from "./StatTile";
import { TxnTable } from "./TxnTable";

export function Dashboard({
  statement,
  onReset,
}: {
  statement: Statement;
  onReset: () => void;
}) {
  const bounds = useMemo(() => {
    const dates = statement.txns.map((t) => t.date.getTime());
    return {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates)),
    };
  }, [statement]);

  const [filters, setFilters] = useState<FilterState>(() => ({
    from: toISODate(bounds.start),
    to: toISODate(bounds.end),
    types: [],
    direction: "all",
    query: "",
  }));

  const allTypes = useMemo(
    () => [...new Set(statement.txns.map((t) => t.type))].sort(),
    [statement],
  );

  const filtered = useMemo(() => {
    const from = new Date(`${filters.from}T00:00:00`);
    const to = new Date(`${filters.to}T23:59:59`);
    const query = filters.query.trim().toLowerCase();
    return statement.txns.filter((t) => {
      if (t.date < from || t.date > to) return false;
      if (filters.types.length > 0 && !filters.types.includes(t.type))
        return false;
      if (filters.direction !== "all" && t.direction !== filters.direction)
        return false;
      if (query) {
        const haystack =
          `${t.type} ${t.counterparty} ${t.details} ${t.trxId ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [statement, filters]);

  const a = useMemo(() => analyze(filtered), [filtered]);

  const monthData = a.byMonth.map((m) => ({
    key: m.key,
    label: formatMonth(m.key),
    a: m.in,
    b: m.out + m.fee,
  }));

  const scoped =
    filtered.length !== statement.txns.length ? " (filtered)" : "";

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6">
      <Header statement={statement} onReset={onReset} txnCount={filtered.length} filteredTxns={filtered} />

      <Filters
        state={filters}
        onChange={setFilters}
        allTypes={allTypes}
        bounds={bounds}
        resultCount={filtered.length}
        totalCount={statement.txns.length}
      />

      {statement.warnings.length > 0 ? (
        <div
          className="mb-6 rounded-xl border p-4 text-xs"
          style={{
            borderColor: "var(--status-warning)",
            background: "var(--surface)",
            color: "var(--text-secondary)",
          }}
        >
          <strong style={{ color: "var(--text-primary)" }}>
            ⚠ Check these figures
          </strong>
          <ul className="mt-1 list-disc pl-4">
            {statement.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Hero — exactly one per view */}
      <section
        className="mb-4 rounded-xl border p-5 sm:p-6"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Net position{scoped}
            </div>
            <div
              className="mt-1 text-5xl font-semibold tracking-tight sm:text-6xl"
              style={{
                color:
                  a.totals.net >= 0
                    ? "var(--success-text)"
                    : "var(--status-critical)",
              }}
            >
              {a.totals.net >= 0 ? "+" : "−"}
              {formatTaka(Math.abs(a.totals.net))}
            </div>
            <p
              className="mt-2 max-w-xl text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              {formatTaka(a.totals.in)} in and {formatTaka(a.totals.out)} out
              across {formatCount(a.totals.count)} transactions
              {a.range
                ? `, ${formatDate(a.range.start)} – ${formatDate(a.range.end)}`
                : ""}
              .
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <dt style={{ color: "var(--text-muted)" }}>Opening balance</dt>
            <dd className="tnum text-right font-medium">
              {formatTaka(a.totals.openingBalance)}
            </dd>
            <dt style={{ color: "var(--text-muted)" }}>Closing balance</dt>
            <dd className="tnum text-right font-medium">
              {formatTaka(a.totals.closingBalance)}
            </dd>
            <dt style={{ color: "var(--text-muted)" }}>Lowest balance</dt>
            <dd className="tnum text-right font-medium">
              {a.totals.minBalance
                ? formatTaka(a.totals.minBalance.value)
                : "—"}
            </dd>
          </dl>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Money in"
          value={formatTakaShort(a.totals.in)}
          hint={`${formatCount(a.totals.inCount)} credits · avg ${formatTakaShort(a.totals.avgTicketIn)}`}
          spark={a.byMonth.map((m) => m.in)}
        />
        <StatTile
          label="Money out"
          value={formatTakaShort(a.totals.out)}
          hint={`${formatCount(a.totals.outCount)} debits · avg ${formatTakaShort(a.totals.avgTicketOut)}`}
          spark={a.byMonth.map((m) => m.out + m.fee)}
        />
        <StatTile
          label="Fees & charges"
          value={formatTakaShort(a.totals.fees)}
          hint={`${(a.totals.feeRate * 100).toFixed(2)}% of what you sent`}
          tone={a.totals.fees > 0 ? "bad" : "neutral"}
          spark={a.byMonth.map((m) => m.fee)}
        />
        <StatTile
          label="Earned back"
          value={formatTakaShort(a.totals.earned)}
          hint="Cashback, interest and rewards"
          tone={a.totals.earned > 0 ? "good" : "neutral"}
        />
      </div>

      {a.insights.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-2 text-sm font-semibold tracking-tight">
            What the numbers say
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {a.insights.map((insight) => (
              <article
                key={insight.id}
                className="rounded-xl border p-4"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <h3 className="flex items-start gap-2 text-sm font-semibold">
                  <span
                    aria-hidden
                    className="mt-1 inline-block size-2 shrink-0 rounded-full"
                    style={{
                      background:
                        insight.tone === "good"
                          ? "var(--status-good)"
                          : insight.tone === "watch"
                            ? "var(--status-warning)"
                            : "var(--axis)",
                    }}
                  />
                  {insight.title}
                </h3>
                <p
                  className="mt-1.5 pl-4 text-xs leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {insight.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <BalanceLine
          data={a.balanceSeries}
          subtitle="Closing balance on each day you transacted"
        />

        <GroupedColumns
          title="Money in vs money out"
          subtitle="By month, fees included in outflow"
          data={monthData}
          seriesA={{ label: "In", color: "var(--series-1)" }}
          seriesB={{ label: "Out", color: "var(--series-2)" }}
        />

        <HBars
          title="Where the money goes"
          subtitle="Outflow by transaction type, fees included"
          data={a.outByType.slice(0, 8).map((b) => ({
            key: b.key,
            label: b.label,
            value: b.out + b.fee,
            note: `${b.count} transactions`,
          }))}
          color="var(--series-2)"
          valueHeader="Sent"
          totalForShare={a.totals.out}
        />

        <HBars
          title="Where the money comes from"
          subtitle="Inflow by transaction type"
          data={a.inByType.slice(0, 8).map((b) => ({
            key: b.key,
            label: b.label,
            value: b.in,
            note: `${b.count} transactions`,
          }))}
          valueHeader="Received"
          totalForShare={a.totals.in}
        />

        <HBars
          title="Top recipients"
          subtitle="Who you sent the most to"
          data={a.sentTo.slice(0, 8).map((b) => ({
            key: b.key,
            label: b.label,
            value: b.out + b.fee,
            note: `${b.count} transactions · ${b.types.join(", ")}`,
          }))}
          color="var(--series-2)"
          valueHeader="Sent"
          totalForShare={a.totals.out}
        />

        <HBars
          title="Fees by transaction type"
          subtitle="Which services cost you the most"
          data={a.feeByType.slice(0, 8).map((b) => ({
            key: b.key,
            label: b.label,
            value: b.fee,
            note: `${b.count} transactions`,
          }))}
          color="var(--series-2)"
          valueHeader="Fees"
          totalForShare={a.totals.fees}
        />

        <ActivityHeatmap data={a.heatmap} />

        <ChartCard
          title="Recurring payments"
          subtitle="Same counterparty on a steady rhythm"
          table={
            <DataTable
              columns={["Payee", "Every", "Times", "Average", "Total"]}
              rows={a.recurring.map((r) => [
                r.label,
                `${Math.round(r.medianGapDays)} days`,
                r.count,
                formatTaka(r.averageAmount),
                formatTaka(r.total),
              ])}
            />
          }
        >
          {a.recurring.length === 0 ? (
            <p className="py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              No repeating payment pattern found in this range.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--grid)" }}>
              {a.recurring.slice(0, 6).map((r) => (
                <li
                  key={r.key}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{r.label}</div>
                    <div
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {r.type} · {r.count}× · every ~
                      {Math.round(r.medianGapDays)} days
                    </div>
                  </div>
                  <div className="tnum shrink-0 text-right text-xs">
                    <div className="font-medium">{formatTaka(r.total)}</div>
                    <div style={{ color: "var(--text-muted)" }}>
                      {formatTakaShort(r.averageAmount)} each
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard
          title="Biggest single transactions"
          subtitle="Largest debits and credits in this range"
          table={
            <DataTable
              columns={["Date", "Type", "Counterparty", "Amount"]}
              rows={[...a.largestOut, ...a.largestIn].map((t) => [
                formatDate(t.date),
                t.type,
                t.counterparty,
                formatTaka(t.direction === "in" ? t.in : t.out + t.fee),
              ])}
            />
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ExtremeList
              heading="Out"
              color="var(--series-2)"
              rows={a.largestOut.slice(0, 5).map((t) => ({
                id: `${t.id}-out`,
                label: t.counterparty,
                sub: `${t.type} · ${formatDate(t.date)}`,
                value: formatTaka(t.out + t.fee),
              }))}
            />
            <ExtremeList
              heading="In"
              color="var(--series-1)"
              rows={a.largestIn.slice(0, 5).map((t) => ({
                id: `${t.id}-in`,
                label: t.counterparty,
                sub: `${t.type} · ${formatDate(t.date)}`,
                value: formatTaka(t.in),
              }))}
            />
          </div>
        </ChartCard>

        <ChartCard
          title="Monthly detail"
          subtitle="Every month in the selected range"
          className="lg:col-span-2"
        >
          <div className="thin-scroll overflow-x-auto">
            <DataTable
              columns={[
                "Month",
                "In",
                "Out",
                "Fees",
                "Net",
                "Transactions",
                "End balance",
              ]}
              rows={a.byMonth.map((m) => [
                formatMonth(m.key),
                formatTaka(m.in),
                formatTaka(m.out + m.fee),
                formatTaka(m.fee),
                `${m.net >= 0 ? "+" : "−"}${formatTaka(Math.abs(m.net))}`,
                m.count,
                formatTaka(m.endBalance),
              ])}
            />
          </div>
        </ChartCard>
      </div>

      <div className="mt-3">
        <TxnTable txns={filtered} />
      </div>

      <p
        className="mt-6 text-center text-[11px]"
        style={{ color: "var(--text-muted)" }}
      >
        Fees are {percent(a.totals.fees, a.totals.out)} of your total outflow ·
        Parsed and analysed entirely in this browser tab.
      </p>
    </div>
  );
}

function ExtremeList({
  heading,
  color,
  rows,
}: {
  heading: string;
  color: string;
  rows: { id: string; label: string; sub: string; value: string }[];
}) {
  return (
    <div className="min-w-0">
      <h4
        className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        <span
          aria-hidden
          className="inline-block h-[3px] w-3.5 rounded-full"
          style={{ background: color }}
        />
        {heading}
      </h4>
      <ul className="divide-y" style={{ borderColor: "var(--grid)" }}>
        {rows.length === 0 ? (
          <li className="py-2 text-xs" style={{ color: "var(--text-muted)" }}>
            None in range.
          </li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{r.label}</div>
                <div
                  className="truncate text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {r.sub}
                </div>
              </div>
              <span className="tnum shrink-0 text-xs font-medium">{r.value}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function Header({
  statement,
  onReset,
  txnCount,
  filteredTxns,
}: {
  statement: Statement;
  onReset: () => void;
  txnCount: number;
  filteredTxns: Statement["txns"];
}) {
  const { meta } = statement;
  const stamp = new Date().toISOString().slice(0, 10);
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 py-6">
      <div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full"
            style={{ background: "var(--brand)" }}
          />
          <h1 className="text-lg font-semibold tracking-tight">
            {meta.accountName ?? "bKash statement"}
          </h1>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          {meta.accountNumber ? `${maskNumber(meta.accountNumber)} · ` : ""}
          {meta.periodLabel ?? "—"} · {formatCount(statement.txns.length)}{" "}
          transactions · {meta.pages} pages
        </p>
      </div>
      <div className="no-print flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            download(
              `bkash-transactions-${stamp}.csv`,
              txnsToCsv(filteredTxns),
              "text/csv",
            )
          }
          className="rounded-md border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
            background: "var(--surface)",
          }}
        >
          Export CSV ({txnCount})
        </button>
        <button
          type="button"
          onClick={() =>
            download(
              `bkash-statement-${stamp}.json`,
              statementToJson(statement, filteredTxns),
              "application/json",
            )
          }
          className="rounded-md border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
            background: "var(--surface)",
          }}
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor: "var(--border-strong)",
            color: "var(--text-primary)",
            background: "var(--surface)",
          }}
        >
          Clear & start over
        </button>
      </div>
    </header>
  );
}

function maskNumber(n: string): string {
  return n.length > 6 ? `${n.slice(0, 3)}•••••${n.slice(-3)}` : n;
}

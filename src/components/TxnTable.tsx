"use client";

import { Fragment, useMemo, useState } from "react";
import { formatDateTime, formatTaka } from "@/lib/format";
import type { Txn } from "@/lib/types";

type SortKey = "date" | "amount" | "fee" | "balance" | "type";

const PAGE_SIZE = 50;

/**
 * Refinements local to the table. Search, type and direction live in the
 * dashboard's filter row (one search box per page); these only narrow the rows
 * it hands down, so the two never disagree.
 */
interface TableFilters {
  min: string;
  max: string;
  feesOnly: boolean;
}

const EMPTY: TableFilters = {
  min: "",
  max: "",
  feesOnly: false,
};

const CONTROL =
  "rounded-md border px-2 py-1.5 text-xs transition-colors";

export function TxnTable({ txns }: { txns: Txn[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [desc, setDesc] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [filters, setFilters] = useState<TableFilters>(EMPTY);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const dirty =
    filters.min !== "" || filters.max !== "" || filters.feesOnly;

  const filtered = useMemo(() => {
    const min = filters.min === "" ? null : Number(filters.min);
    const max = filters.max === "" ? null : Number(filters.max);
    return txns.filter((t) => {
      if (filters.feesOnly && t.fee <= 0) return false;
      // Compare against the gross movement, fee included, so a search for
      // "everything over 10,000" matches what the Amount column implies.
      const amount = t.direction === "in" ? t.in : t.out + t.fee;
      if (min != null && Number.isFinite(min) && amount < min) return false;
      if (max != null && Number.isFinite(max) && amount > max) return false;
      return true;
    });
  }, [txns, filters]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "amount":
          cmp = Math.abs(a.net) - Math.abs(b.net);
          break;
        case "fee":
          cmp = a.fee - b.fee;
          break;
        case "balance":
          cmp = (a.balance || 0) - (b.balance || 0);
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        default:
          cmp = a.date.getTime() - b.date.getTime();
      }
      return desc ? -cmp : cmp;
    });
    return rows;
  }, [filtered, sortKey, desc]);

  const visible = sorted.slice(0, limit);

  const update = (patch: Partial<TableFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setLimit(PAGE_SIZE);
  };

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setDesc((v) => !v);
    else {
      setSortKey(key);
      setDesc(true);
    }
    setLimit(PAGE_SIZE);
  };

  // Totals reflect what is actually on screen, not the whole statement.
  const shownIn = sorted.reduce((a, t) => a + t.in, 0);
  const shownOut = sorted.reduce((a, t) => a + t.out + t.fee, 0);

  const header = (key: SortKey, label: string, align: "left" | "right") => (
    <th
      scope="col"
      className={`sticky top-0 z-10 border-b px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      aria-sort={sortKey === key ? (desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => sortBy(key)}
        className="inline-flex items-center gap-1 hover:underline"
      >
        {label}
        <span aria-hidden style={{ opacity: sortKey === key ? 1 : 0.25 }}>
          {sortKey === key && !desc ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );

  const cell = "border-b px-3 py-2";

  return (
    <section
      id="transactions"
      className="scroll-mt-32 rounded-xl border"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold tracking-tight">Transactions</h3>
        <span className="tnum text-xs" style={{ color: "var(--text-muted)" }}>
          {dirty ? `${sorted.length} of ${txns.length}` : `${txns.length}`} rows
          {sorted.length > 0 ? (
            <>
              {" · "}
              {formatTaka(shownIn)} in · {formatTaka(shownOut)} out
            </>
          ) : null}
        </span>
      </div>

      <div
        className="no-print flex flex-wrap items-center gap-2 border-b px-4 pb-3 sm:px-5"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Amount
        </span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={filters.min}
            onChange={(e) => update({ min: e.target.value })}
            placeholder="Min ৳"
            aria-label="Minimum amount"
            className={`${CONTROL} tnum w-24`}
            style={{
              borderColor: "var(--border)",
              background: "var(--page)",
              color: "var(--text-primary)",
            }}
          />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            –
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={filters.max}
            onChange={(e) => update({ max: e.target.value })}
            placeholder="Max ৳"
            aria-label="Maximum amount"
            className={`${CONTROL} tnum w-24`}
            style={{
              borderColor: "var(--border)",
              background: "var(--page)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => update({ feesOnly: !filters.feesOnly })}
          aria-pressed={filters.feesOnly}
          className={`chip-btn ${CONTROL} font-medium`}
          style={{
            borderColor: filters.feesOnly
              ? "var(--border-strong)"
              : "var(--border)",
            background: filters.feesOnly ? "var(--surface-2)" : "transparent",
            color: filters.feesOnly
              ? "var(--text-primary)"
              : "var(--text-secondary)",
          }}
        >
          Charged a fee
        </button>

        {dirty ? (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY);
              setLimit(PAGE_SIZE);
            }}
            className="text-xs underline"
            style={{ color: "var(--text-muted)" }}
          >
            Reset
          </button>
        ) : null}

        <span
          className="ml-auto hidden text-[11px] sm:inline"
          style={{ color: "var(--text-muted)" }}
        >
          Click a row for full details
        </span>
      </div>

      <div className="thin-scroll max-h-[36rem] overflow-auto">
        <table className="w-full text-xs">
          <thead style={{ color: "var(--text-muted)" }}>
            <tr>
              {header("date", "Date & time", "left")}
              {header("type", "Type", "left")}
              <th
                scope="col"
                className="sticky top-0 z-10 border-b px-3 py-2 text-left font-medium"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                Counterparty
              </th>
              {header("amount", "Amount", "right")}
              {header("fee", "Fee", "right")}
              {header("balance", "Balance", "right")}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center"
                  style={{ color: "var(--text-muted)" }}
                >
                  No transactions match these filters.
                </td>
              </tr>
            ) : (
              visible.map((t) => {
                const key = `${t.id}-${t.date.getTime()}`;
                const open = openRow === key;
                const toggle = () => setOpenRow(open ? null : key);
                return (
                  <Fragment key={key}>
                    <tr
                      onClick={toggle}
                      className="cursor-pointer hover:bg-[var(--surface-2)]"
                      style={
                        open ? { background: "var(--surface-2)" } : undefined
                      }
                    >
                      <td
                        className={`tnum whitespace-nowrap ${cell}`}
                        style={{
                          borderColor: open ? "transparent" : "var(--grid)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle();
                          }}
                          aria-expanded={open}
                          aria-label={`${formatDateTime(t.date)}, ${t.type}, ${t.counterparty}. ${open ? "Hide" : "Show"} details`}
                          className="inline-flex items-center gap-1.5 text-left"
                        >
                          <svg
                            viewBox="0 0 12 12"
                            className="size-2.5 shrink-0 transition-transform"
                            style={{
                              transform: open ? "rotate(90deg)" : undefined,
                              color: "var(--text-muted)",
                            }}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            aria-hidden
                          >
                            <path d="M4.5 3 7.5 6 4.5 9" />
                          </svg>
                          {formatDateTime(t.date)}
                        </button>
                      </td>
                      <td
                        className={`whitespace-nowrap ${cell}`}
                        style={{
                          borderColor: open ? "transparent" : "var(--grid)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="inline-block size-1.5 rounded-full"
                            style={{
                              background:
                                t.direction === "in"
                                  ? "var(--series-1)"
                                  : "var(--series-2)",
                            }}
                          />
                          {t.type}
                        </span>
                      </td>
                      <td
                        className={cell}
                        style={{
                          borderColor: open ? "transparent" : "var(--grid)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <span className="block max-w-[16rem] truncate">
                          {t.counterparty}
                        </span>
                        {t.trxId ? (
                          <span
                            className="tnum block text-[10px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {t.trxId}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={`tnum whitespace-nowrap ${cell} text-right font-medium`}
                        style={{
                          borderColor: open ? "transparent" : "var(--grid)",
                          color:
                            t.direction === "in"
                              ? "var(--success-text)"
                              : "var(--text-primary)",
                        }}
                      >
                        {t.direction === "in"
                          ? `+${formatTaka(t.in)}`
                          : `-${formatTaka(t.out)}`}
                      </td>
                      <td
                        className={`tnum whitespace-nowrap ${cell} text-right`}
                        style={{
                          borderColor: open ? "transparent" : "var(--grid)",
                          color: t.fee
                            ? "var(--text-secondary)"
                            : "var(--text-muted)",
                        }}
                      >
                        {t.fee ? formatTaka(t.fee) : "—"}
                      </td>
                      <td
                        className={`tnum whitespace-nowrap ${cell} text-right`}
                        style={{
                          borderColor: open ? "transparent" : "var(--grid)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {Number.isFinite(t.balance)
                          ? formatTaka(t.balance)
                          : "—"}
                      </td>
                    </tr>
                    {open ? <DetailRow txn={t} /> : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {limit < sorted.length ? (
        <div
          className="no-print border-t px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={() => setLimit((v) => v + PAGE_SIZE * 4)}
            className="chip-btn rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            Show more ({sorted.length - limit} remaining)
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** Everything the statement printed for one row, with a copyable TRX ID. */
function DetailRow({ txn: t }: { txn: Txn }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!t.trxId) return;
    try {
      await navigator.clipboard.writeText(t.trxId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the ID is
      // still on screen to select by hand.
    }
  };

  const fields: [string, React.ReactNode][] = [
    ["Details", t.details || "—"],
    ["Counterparty", t.counterparty],
    ...(t.msisdn ? ([["Number", t.msisdn]] as [string, string][]) : []),
    ["Date", `${t.dateStr} ${t.timeStr}`.trim()],
    [
      t.direction === "in" ? "Received" : "Sent",
      formatTaka(t.direction === "in" ? t.in : t.out),
    ],
    ...(t.fee ? ([["Fee", formatTaka(t.fee)]] as [string, string][]) : []),
    ...(t.direction === "out" && t.fee
      ? ([["Total debited", formatTaka(t.out + t.fee)]] as [string, string][])
      : []),
  ];

  return (
    <tr style={{ background: "var(--surface-2)" }}>
      <td
        colSpan={6}
        className="border-b px-3 pb-3 pt-0"
        style={{ borderColor: "var(--grid)" }}
      >
        <div className="flex flex-wrap items-start gap-x-8 gap-y-2 pl-4">
          <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {fields.map(([label, value]) => (
              <Fragment key={label}>
                <dt style={{ color: "var(--text-muted)" }}>{label}</dt>
                <dd
                  className="min-w-0 break-words"
                  style={{ color: "var(--text-primary)" }}
                >
                  {value}
                </dd>
              </Fragment>
            ))}
          </dl>
          {t.trxId ? (
            <div className="flex items-center gap-2">
              <code
                className="tnum rounded px-1.5 py-0.5 text-[11px]"
                style={{ background: "var(--surface)" }}
              >
                {t.trxId}
              </code>
              <button
                type="button"
                onClick={() => void copy()}
                className="chip-btn rounded-md border px-2 py-1 text-[11px] font-medium"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                  background: "var(--surface)",
                }}
              >
                {copied ? "Copied" : "Copy TRX ID"}
              </button>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

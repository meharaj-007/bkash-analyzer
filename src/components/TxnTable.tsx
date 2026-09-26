"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime, formatTaka } from "@/lib/format";
import type { Txn } from "@/lib/types";

type SortKey = "date" | "amount" | "fee" | "balance" | "type";

const PAGE_SIZE = 50;

/**
 * Filters local to the table. These narrow the rows already handed down by the
 * dashboard's filter row; they never widen the set, so the two never disagree.
 */
interface TableFilters {
  query: string;
  types: string[];
  direction: "all" | "in" | "out";
  min: string;
  max: string;
  feesOnly: boolean;
}

const EMPTY: TableFilters = {
  query: "",
  types: [],
  direction: "all",
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

  const types = useMemo(
    () => [...new Set(txns.map((t) => t.type))].sort(),
    [txns],
  );

  const dirty =
    filters.query !== "" ||
    filters.types.length > 0 ||
    filters.direction !== "all" ||
    filters.min !== "" ||
    filters.max !== "" ||
    filters.feesOnly;

  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const min = filters.min === "" ? null : Number(filters.min);
    const max = filters.max === "" ? null : Number(filters.max);
    return txns.filter((t) => {
      if (filters.direction !== "all" && t.direction !== filters.direction)
        return false;
      if (filters.types.length > 0 && !filters.types.includes(t.type))
        return false;
      if (filters.feesOnly && t.fee <= 0) return false;
      // Compare against the gross movement, fee included, so a search for
      // "everything over 10,000" matches what the Amount column implies.
      const amount = t.direction === "in" ? t.in : t.out + t.fee;
      if (min != null && Number.isFinite(min) && amount < min) return false;
      if (max != null && Number.isFinite(max) && amount > max) return false;
      if (query) {
        const haystack =
          `${t.type} ${t.counterparty} ${t.details} ${t.trxId ?? ""} ${t.msisdn ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
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

  const toggleType = (type: string) =>
    update({
      types: filters.types.includes(type)
        ? filters.types.filter((t) => t !== type)
        : [...filters.types, type],
    });

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

  return (
    <section
      className="rounded-xl border"
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
        <input
          type="search"
          value={filters.query}
          onChange={(e) => update({ query: e.target.value })}
          placeholder="Filter rows — name, number, TRX ID…"
          aria-label="Filter transaction rows"
          className={`${CONTROL} min-w-[13rem] flex-1`}
          style={{
            borderColor: "var(--border)",
            background: "var(--page)",
            color: "var(--text-primary)",
          }}
        />

        <div className="flex items-center gap-1" role="group" aria-label="Direction">
          {(["all", "out", "in"] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => update({ direction: dir })}
              aria-pressed={filters.direction === dir}
              className={`${CONTROL} font-medium`}
              style={{
                borderColor:
                  filters.direction === dir
                    ? "var(--border-strong)"
                    : "var(--border)",
                background:
                  filters.direction === dir
                    ? "var(--surface-2)"
                    : "transparent",
                color:
                  filters.direction === dir
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
            >
              {dir === "all" ? "All" : dir === "out" ? "Out" : "In"}
            </button>
          ))}
        </div>

        <div className="relative" ref={typesRef}>
          <button
            type="button"
            onClick={() => setTypesOpen((v) => !v)}
            aria-expanded={typesOpen}
            className={`${CONTROL} font-medium`}
            style={{
              borderColor:
                filters.types.length > 0
                  ? "var(--border-strong)"
                  : "var(--border)",
              background:
                filters.types.length > 0 ? "var(--surface-2)" : "transparent",
              color: "var(--text-secondary)",
            }}
          >
            {filters.types.length > 0
              ? `${filters.types.length} type${filters.types.length > 1 ? "s" : ""}`
              : "Any type"}
          </button>
          {typesOpen ? (
            <div
              className="thin-scroll absolute right-0 top-full z-40 mt-1 max-h-72 w-60 overflow-auto rounded-lg border p-1 shadow-lg"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border-strong)",
              }}
            >
              <button
                type="button"
                onClick={() => update({ types: [] })}
                className="w-full rounded px-2 py-1.5 text-left text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Clear selection
              </button>
              {types.map((type) => (
                <label
                  key={type}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-[var(--surface-2)]"
                >
                  <input
                    type="checkbox"
                    checked={filters.types.includes(type)}
                    onChange={() => toggleType(type)}
                    className="size-3.5 accent-[var(--series-1)]"
                  />
                  <span style={{ color: "var(--text-secondary)" }}>{type}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

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
          className={`${CONTROL} font-medium`}
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
              visible.map((t) => (
                <tr key={`${t.id}-${t.date.getTime()}`}>
                  <td
                    className="tnum whitespace-nowrap border-b px-3 py-2"
                    style={{
                      borderColor: "var(--grid)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {formatDateTime(t.date)}
                  </td>
                  <td
                    className="whitespace-nowrap border-b px-3 py-2"
                    style={{
                      borderColor: "var(--grid)",
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
                    className="border-b px-3 py-2"
                    style={{
                      borderColor: "var(--grid)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span
                      className="block max-w-[16rem] truncate"
                      title={t.details}
                    >
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
                    className="tnum whitespace-nowrap border-b px-3 py-2 text-right font-medium"
                    style={{
                      borderColor: "var(--grid)",
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
                    className="tnum whitespace-nowrap border-b px-3 py-2 text-right"
                    style={{
                      borderColor: "var(--grid)",
                      color: t.fee
                        ? "var(--text-secondary)"
                        : "var(--text-muted)",
                    }}
                  >
                    {t.fee ? formatTaka(t.fee) : "—"}
                  </td>
                  <td
                    className="tnum whitespace-nowrap border-b px-3 py-2 text-right"
                    style={{
                      borderColor: "var(--grid)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {Number.isFinite(t.balance) ? formatTaka(t.balance) : "—"}
                  </td>
                </tr>
              ))
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
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
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

import { formatDate } from "./format";
import type { Statement, Txn } from "./types";

function csvCell(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function txnsToCsv(txns: Txn[]): string {
  const header = [
    "Date",
    "Time",
    "Type",
    "Counterparty",
    "Mobile",
    "TRX ID",
    "Out",
    "In",
    "Fee",
    "Net",
    "Balance",
    "Details",
  ];
  const rows = txns.map((t) =>
    [
      t.dateStr,
      t.timeStr,
      t.type,
      t.counterparty,
      t.msisdn,
      t.trxId,
      t.out || "",
      t.in || "",
      t.fee || "",
      t.net.toFixed(2),
      Number.isFinite(t.balance) ? t.balance.toFixed(2) : "",
      t.details,
    ].map(csvCell),
  );
  return [header.map(csvCell), ...rows].map((r) => r.join(",")).join("\n");
}

export function statementToJson(statement: Statement, txns: Txn[]): string {
  return JSON.stringify(
    {
      meta: {
        ...statement.meta,
        periodStart: statement.meta.periodStart
          ? formatDate(statement.meta.periodStart)
          : null,
        periodEnd: statement.meta.periodEnd
          ? formatDate(statement.meta.periodEnd)
          : null,
      },
      transactions: txns.map((t) => ({
        date: t.date.toISOString(),
        type: t.type,
        counterparty: t.counterparty,
        msisdn: t.msisdn,
        trxId: t.trxId,
        out: t.out,
        in: t.in,
        fee: t.fee,
        net: t.net,
        balance: t.balance,
        details: t.details,
      })),
    },
    null,
    2,
  );
}

/** Trigger a download without any network round-trip. */
export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

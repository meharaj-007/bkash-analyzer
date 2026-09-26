export type Direction = "in" | "out";

export interface Txn {
  /** Stable key — the bKash TRX ID when present, otherwise a synthetic index key. */
  id: string;
  /** Parsed timestamp built from the date and time cells. */
  date: Date;
  dateStr: string;
  timeStr: string;
  /** Transaction Type cell, e.g. "Send Money", "Cash Out". */
  type: string;
  /** Transaction Details cell, joined across wrapped lines. */
  details: string;
  trxId: string | null;
  /** Human label for the other side of the transaction. */
  counterparty: string;
  /** Mobile number found in the details, if any. */
  msisdn: string | null;
  /** Money leaving the wallet, excluding the fee. 0 when this is an inbound row. */
  out: number;
  /** Money entering the wallet. 0 when this is an outbound row. */
  in: number;
  /** Charge/Fee as a positive magnitude. */
  fee: number;
  /** Running balance after the transaction. */
  balance: number;
  direction: Direction;
  /** Signed effect on the wallet: `in` or `-(out + fee)`. */
  net: number;
}

export interface StatementMeta {
  accountName: string | null;
  accountNumber: string | null;
  userType: string | null;
  periodLabel: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  issueDate: string | null;
  /** Totals as printed in the statement's own Overview block, when present. */
  reportedTotalOut: number | null;
  reportedTotalIn: number | null;
  pages: number;
}

export interface Statement {
  meta: StatementMeta;
  txns: Txn[];
  /** Non-fatal problems worth surfacing (e.g. totals that do not reconcile). */
  warnings: string[];
}

export class PdfPasswordError extends Error {
  /** True when a password was supplied but rejected. */
  readonly wrong: boolean;
  constructor(wrong: boolean) {
    super(wrong ? "Incorrect password" : "Password required");
    this.name = "PdfPasswordError";
    this.wrong = wrong;
  }
}

export class NotABkashStatementError extends Error {
  constructor(message = "This PDF does not look like a bKash statement") {
    super(message);
    this.name = "NotABkashStatementError";
  }
}

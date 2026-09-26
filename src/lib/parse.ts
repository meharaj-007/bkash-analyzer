import { BASE_PATH } from "./basePath";
import {
  NotABkashStatementError,
  PdfPasswordError,
  type Statement,
  type StatementMeta,
  type Txn,
} from "./types";

/** Row cell as laid out on the page: left edge, right edge, text. */
interface Cell {
  x: number;
  r: number;
  s: string;
}
interface Row {
  y: number;
  cells: Cell[];
}

const AMOUNT = /^-?[\d,]+\.\d{2}$/;
const DATE_CELL = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/;
const TIME_CELL = /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i;
const TRX_ID = /TRX\s*ID:\s*([A-Z0-9]+)/i;
const MSISDN = /(?:^|\s|\/)((?:\+?88)?01\d{9})(?=\s|\/|$)/;
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/** Column headers of the transaction table, right-aligned in the PDF. */
const MONEY_COLUMNS = ["Out", "In", "Charge/Fee", "Balance"] as const;
type MoneyColumn = (typeof MONEY_COLUMNS)[number];

type Pdfjs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<Pdfjs> | null = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = `${BASE_PATH}/pdf/pdf.worker.min.mjs`;
      return lib;
    });
  }
  return pdfjsPromise;
}

function parseAmount(s: string): number {
  return Number.parseFloat(s.replace(/,/g, ""));
}

function parseDateTime(dateStr: string, timeStr: string): Date {
  const m = DATE_CELL.exec(dateStr);
  if (!m) return new Date(NaN);
  const day = Number(m[1]);
  const month = MONTHS.indexOf(m[2].toLowerCase());
  const rawYear = Number(m[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  let hour = 0;
  let minute = 0;
  let second = 0;
  const t = TIME_CELL.exec(timeStr);
  if (t) {
    hour = Number(t[1]) % 12;
    minute = Number(t[2]);
    second = Number(t[3]);
    if (t[4].toUpperCase() === "PM") hour += 12;
  }
  return new Date(year, month < 0 ? 0 : month, day, hour, minute, second);
}

function parseLooseDate(s: string): Date | null {
  // Statement period reads like "11 Feb 2026 to 10 Aug 2026".
  const m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return null;
  return new Date(Number(m[3]), month, Number(m[1]));
}

/**
 * Split the details cell into a counterparty label plus the identifiers.
 * Details come in a handful of shapes, all slash-separated:
 *   "01XXXXXXXXX / TRX ID: X"
 *   "ROBI AXIATA LIMITED-RM0000 / 018XXXXXXXX / TRX ID: X"
 *   "TRX ID: X / DBBL Credit Card"
 *   "Eastern Bank / TRX ID: X / 1031XXXXXX149"
 */
function parseDetails(
  details: string,
  type: string,
): { trxId: string | null; msisdn: string | null; counterparty: string } {
  const trxId = TRX_ID.exec(details)?.[1] ?? null;
  const msisdn = MSISDN.exec(details)?.[1]?.replace(/^\+?88/, "") ?? null;
  // Split on " / " rather than "/" so names like "M/S Example Enterprise" survive.
  const parts = details
    .split(/\s+\/\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !/^TRX\s*ID:/i.test(p));

  const named = parts.find(
    (p) => /[A-Za-z]{3}/.test(p) && !/^TRX\s*ID/i.test(p) && p !== msisdn,
  );

  // Whichever identifier the statement puts first is the counterparty: merchants
  // lead with their name ("ROBI … / 018… / TRX ID"), wallet-to-wallet transfers
  // lead with the number ("018… / TRX ID / Rocket"), where the trailing word is
  // the destination network rather than the person.
  let counterparty = named ?? msisdn ?? type;
  if (named && msisdn) {
    counterparty = details.indexOf(msisdn) < details.indexOf(named)
      ? msisdn
      : named;
  }
  return { trxId, msisdn, counterparty: cleanName(counterparty) };
}

/** Trim merchant-code noise so labels group and read cleanly. */
function cleanName(name: string): string {
  return name
    .replace(/-[A-Z]{2}\d+\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s\-–]+$/, "")
    .trim();
}

function groupRows(
  items: { str: string; x: number; y: number; width: number }[],
): Row[] {
  const rows: Row[] = [];
  for (const it of items) {
    const s = it.str.replace(/\s+/g, " ").trim();
    if (!s) continue;
    let row = rows.find((rw) => Math.abs(rw.y - it.y) <= 3);
    if (!row) {
      row = { y: it.y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ x: it.x, r: it.x + it.width, s });
  }
  rows.sort((a, b) => b.y - a.y);
  for (const row of rows) row.cells.sort((a, b) => a.x - b.x);
  return rows;
}

/** Map an amount's right edge onto a money column using the header's right edges. */
function columnFor(
  right: number,
  headers: Partial<Record<MoneyColumn, number>>,
): MoneyColumn | null {
  let best: MoneyColumn | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const key of MONEY_COLUMNS) {
    const edge = headers[key];
    if (edge == null) continue;
    const dist = Math.abs(edge - right);
    if (dist < bestDist) {
      bestDist = dist;
      best = key;
    }
  }
  return bestDist <= 28 ? best : null;
}

export interface ParseProgress {
  page: number;
  pages: number;
}

export interface ParseOptions {
  onProgress?: (p: ParseProgress) => void;
  /** Use this pdf.js build instead of the browser one (tests pass the Node build). */
  pdfjs?: Pdfjs;
  standardFontDataUrl?: string;
}

/**
 * Read a bKash "Customer App Statement" PDF entirely in the browser.
 * Nothing is uploaded — the ArrayBuffer never leaves this tab.
 */
export async function parseStatement(
  data: ArrayBuffer,
  password: string | undefined,
  { onProgress, pdfjs: injected, standardFontDataUrl }: ParseOptions = {},
): Promise<Statement> {
  const pdfjs = injected ?? (await getPdfjs());

  let doc: import("pdfjs-dist").PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({
      // pdf.js transfers (and detaches) the buffer it is handed.
      data: new Uint8Array(data.slice(0)),
      password,
      standardFontDataUrl:
        standardFontDataUrl ?? `${BASE_PATH}/pdf/standard_fonts/`,
      isEvalSupported: false,
    }).promise;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "PasswordException") {
      const code = (err as { code?: number }).code;
      // 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
      throw new PdfPasswordError(code === 2);
    }
    throw err;
  }

  const meta: StatementMeta = {
    accountName: null,
    accountNumber: null,
    userType: null,
    periodLabel: null,
    periodStart: null,
    periodEnd: null,
    issueDate: null,
    reportedTotalOut: null,
    reportedTotalIn: null,
    pages: doc.numPages,
  };

  const raw: {
    dateStr: string;
    timeStr: string;
    type: string;
    details: string[];
    out: number | null;
    in: number | null;
    fee: number | null;
    balance: number | null;
  }[] = [];

  let sawTable = false;

  for (let p = 1; p <= doc.numPages; p++) {
    onProgress?.({ page: p, pages: doc.numPages });
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((i): i is import("pdfjs-dist/types/src/display/api").TextItem =>
        "str" in i,
      )
      .map((i) => ({
        str: i.str,
        x: i.transform[4] as number,
        y: i.transform[5] as number,
        width: i.width,
      }));
    page.cleanup();

    const rows = groupRows(items);
    const headerRow = rows.find(
      (r) =>
        r.cells.some((c) => c.s === "Balance") &&
        r.cells.some((c) => c.s === "Out") &&
        r.cells.some((c) => c.s === "In"),
    );
    if (!headerRow) continue;
    sawTable = true;

    const headers: Partial<Record<MoneyColumn, number>> = {};
    for (const cell of headerRow.cells) {
      if ((MONEY_COLUMNS as readonly string[]).includes(cell.s)) {
        headers[cell.s as MoneyColumn] = cell.r;
      }
    }
    // Everything left of the "Out" column is text; use it to split type vs details.
    const detailsX =
      headerRow.cells.find((c) => c.s === "Transaction Details")?.x ?? 190;
    const typeX =
      headerRow.cells.find((c) => c.s === "Transaction Type")?.x ?? 90;
    const textSplit = (detailsX + typeX) / 2;

    for (const row of rows) {
      // Above the header sits the cover block (page 1) or nothing (later pages).
      if (row.y >= headerRow.y - 5) {
        readCoverRow(row, meta);
        continue;
      }
      if (
        row.cells.some(
          (c) =>
            /^Page \d+ of \d+$/.test(c.s) ||
            c.s === "End of Statement" ||
            c.s.startsWith("bKash Statement -") ||
            c.s.startsWith("This is a computer-generated") ||
            c.s.startsWith("Thank you for using") ||
            c.s.startsWith("For any queries") ||
            c.s.startsWith("Call: 16247"),
        )
      ) {
        continue;
      }

      const first = row.cells[0];
      if (!first) continue;

      if (DATE_CELL.test(first.s)) {
        const txn = {
          dateStr: first.s,
          timeStr: "",
          type: "",
          details: [] as string[],
          out: null as number | null,
          in: null as number | null,
          fee: null as number | null,
          balance: null as number | null,
        };
        for (const cell of row.cells.slice(1)) {
          if (AMOUNT.test(cell.s)) {
            const col = columnFor(cell.r, headers);
            const value = parseAmount(cell.s);
            if (col === "Out") txn.out = value;
            else if (col === "In") txn.in = value;
            else if (col === "Charge/Fee") txn.fee = value;
            else if (col === "Balance") txn.balance = value;
            continue;
          }
          if (cell.x < textSplit) txn.type += (txn.type ? " " : "") + cell.s;
          else txn.details.push(cell.s);
        }
        raw.push(txn);
        continue;
      }

      // Continuation line: time, wrapped type, or wrapped details.
      const current = raw[raw.length - 1];
      if (!current) continue;
      for (const cell of row.cells) {
        if (TIME_CELL.test(cell.s)) {
          current.timeStr = cell.s;
        } else if (AMOUNT.test(cell.s)) {
          const col = columnFor(cell.r, headers);
          const value = parseAmount(cell.s);
          if (col === "Out" && current.out == null) current.out = value;
          else if (col === "In" && current.in == null) current.in = value;
          else if (col === "Charge/Fee" && current.fee == null)
            current.fee = value;
          else if (col === "Balance" && current.balance == null)
            current.balance = value;
        } else if (cell.x < textSplit) {
          current.type += " " + cell.s;
        } else {
          current.details.push(cell.s);
        }
      }
    }
  }

  await doc.destroy();

  if (!sawTable || raw.length === 0) {
    throw new NotABkashStatementError();
  }

  const txns: Txn[] = raw.map((r, i) => {
    const details = r.details.join(" ").replace(/\s+/g, " ").trim();
    const { trxId, msisdn, counterparty } = parseDetails(details, r.type);
    const outAmount = r.out ?? 0;
    const inAmount = r.in ?? 0;
    const fee = Math.abs(r.fee ?? 0);
    const direction = inAmount > 0 && outAmount === 0 ? "in" : "out";
    return {
      id: trxId ?? `row-${i}`,
      date: parseDateTime(r.dateStr, r.timeStr),
      dateStr: r.dateStr,
      timeStr: r.timeStr,
      type: r.type.replace(/\s+/g, " ").trim() || "Unknown",
      details,
      trxId,
      msisdn,
      counterparty,
      out: outAmount,
      in: inAmount,
      fee,
      balance: r.balance ?? Number.NaN,
      direction,
      net: direction === "in" ? inAmount : -(outAmount + fee),
    };
  });

  txns.sort((a, b) => a.date.getTime() - b.date.getTime());

  const warnings: string[] = [];
  const sumOut = txns.reduce((a, t) => a + t.out + t.fee, 0);
  const sumIn = txns.reduce((a, t) => a + t.in, 0);
  if (
    meta.reportedTotalOut != null &&
    Math.abs(meta.reportedTotalOut - sumOut) > 1
  ) {
    warnings.push(
      `Parsed outgoing total (${sumOut.toFixed(2)}) differs from the statement's printed total (${meta.reportedTotalOut.toFixed(2)}).`,
    );
  }
  if (
    meta.reportedTotalIn != null &&
    Math.abs(meta.reportedTotalIn - sumIn) > 1
  ) {
    warnings.push(
      `Parsed incoming total (${sumIn.toFixed(2)}) differs from the statement's printed total (${meta.reportedTotalIn.toFixed(2)}).`,
    );
  }
  if (txns.some((t) => Number.isNaN(t.date.getTime()))) {
    warnings.push("Some rows had an unreadable date and may be misordered.");
  }

  return { meta, txns, warnings };
}

/** Pull the cover-block fields (name, account, period, overview totals) off a row. */
function readCoverRow(row: Row, meta: StatementMeta) {
  const cells = row.cells;
  for (let i = 0; i < cells.length; i++) {
    const label = cells[i].s;
    const next = cells[i + 1]?.s;
    if (!next) {
      // The account holder's name is the only bare all-caps line on the cover.
      if (
        !meta.accountName &&
        cells.length === 1 &&
        /^[A-Z][A-Z .'-]{4,}$/.test(label) &&
        label !== "BKASH STATEMENT"
      ) {
        meta.accountName = label;
      }
      continue;
    }
    if (label.startsWith("bKash Account Number")) meta.accountNumber = next;
    else if (label.startsWith("User Type")) meta.userType = next;
    else if (label.startsWith("Issue Date")) meta.issueDate = next;
    else if (label.startsWith("Statement Period")) {
      meta.periodLabel = next;
      const [from, to] = next.split(/\s+to\s+/);
      meta.periodStart = from ? parseLooseDate(from) : null;
      meta.periodEnd = to ? parseLooseDate(to) : null;
    } else if (label.startsWith("Total Out") && AMOUNT.test(next)) {
      meta.reportedTotalOut = parseAmount(next);
    } else if (label.startsWith("Total In") && AMOUNT.test(next)) {
      meta.reportedTotalIn = parseAmount(next);
    }
  }
}

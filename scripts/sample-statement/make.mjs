// Writes public/sample/sample-statement.pdf: a password-protected PDF laid out
// like the bKash "Customer App Statement" table, filled with synthetic data.
// It uses a plain layout with no bKash branding; only the text structure the
// parser relies on (column headers, date/time cells, cover labels) matches.
//
//   node scripts/sample-statement/make.mjs

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import {
  SAMPLE_META,
  SAMPLE_PASSWORD,
  buildSampleTransactions,
  formatDate,
  formatLongDate,
  formatTime,
} from "./data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outFile = join(root, "public", "sample", "sample-statement.pdf");

const DISCLAIMER =
  "Sample statement generated with synthetic data. Not issued by bKash Limited.";
const FOOTER =
  "This is a computer-generated sample with synthetic data. Not issued by bKash Limited.";

const COL = {
  date: 30,
  type: 90,
  details: 190,
  detailsWidth: 200,
  // Right edges of the right-aligned money columns
  out: 430,
  in: 480,
  fee: 530,
  balance: 575,
};
const ROW_GAP = 9;
const TXN_GAP = 22;
const TABLE_BOTTOM = 790;

const money = (n) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function right(doc, text, rightEdge, y) {
  const width = doc.widthOfString(text);
  doc.text(text, rightEdge - width, y, { lineBreak: false });
}

/** Split long details at a " / " boundary so they wrap onto the time row. */
function wrapDetails(doc, details) {
  if (doc.widthOfString(details) <= COL.detailsWidth) return [details, null];
  const parts = details.split(" / ");
  let first = parts.shift();
  while (parts.length && doc.widthOfString(`${first} / ${parts[0]} /`) <= COL.detailsWidth) {
    first += ` / ${parts.shift()}`;
  }
  return parts.length ? [`${first} /`, parts.join(" / ")] : [first, null];
}

function tableHeader(doc, y) {
  doc.font("Helvetica-Bold").fontSize(7);
  doc.text("Date", COL.date, y, { lineBreak: false });
  doc.text("Transaction Type", COL.type, y, { lineBreak: false });
  doc.text("Transaction Details", COL.details, y, { lineBreak: false });
  right(doc, "Out", COL.out, y);
  right(doc, "In", COL.in, y);
  right(doc, "Charge/Fee", COL.fee, y);
  right(doc, "Balance", COL.balance, y);
  doc.moveTo(COL.date, y + 10).lineTo(COL.balance, y + 10).lineWidth(0.5).stroke("#999999");
  doc.font("Helvetica").fontSize(7);
  return y + 18;
}

function coverBlock(doc, txns) {
  const totalIn = txns.reduce((a, t) => a + t.in, 0);
  const totalOut = txns.reduce((a, t) => a + t.out + t.fee, 0);
  const pair = (label, value, y, x = COL.date) => {
    doc.font("Helvetica").fontSize(8).text(label, x, y, { lineBreak: false });
    doc.font("Helvetica-Bold").text(value, x + 110, y, { lineBreak: false });
  };

  doc.font("Helvetica-Bold").fontSize(14).text("Wallet Statement", COL.date, 36, { lineBreak: false });
  doc.font("Helvetica-Oblique").fontSize(8).fillColor("#b00020")
    .text(DISCLAIMER, COL.date, 56, { lineBreak: false });
  doc.fillColor("black");
  doc.font("Helvetica-Bold").fontSize(11).text(SAMPLE_META.accountName, COL.date, 80, { lineBreak: false });

  pair("bKash Account Number", SAMPLE_META.accountNumber, 100);
  pair("User Type", SAMPLE_META.userType, 113);
  pair(
    "Statement Period",
    `${formatLongDate(SAMPLE_META.periodStart)} to ${formatLongDate(SAMPLE_META.periodEnd)}`,
    126,
  );
  pair("Issue Date", SAMPLE_META.issueDate, 139);

  doc.font("Helvetica-Bold").fontSize(9).text("Overview", COL.date, 162, { lineBreak: false });
  pair("Opening Balance", money(SAMPLE_META.openingBalance), 178);
  pair("Total In", money(totalIn), 191);
  pair("Total Out", money(totalOut), 191, 300);
  return 220;
}

async function main() {
  const txns = buildSampleTransactions();
  await mkdir(dirname(outFile), { recursive: true });

  const doc = new PDFDocument({
    size: "A4",
    margin: 30,
    autoFirstPage: false,
    // PDF 1.3 encryption is 40-bit RC4, the same scheme bKash statements use
    pdfVersion: "1.3",
    userPassword: SAMPLE_PASSWORD,
    info: {
      Title: "Sample wallet statement (synthetic data)",
      Author: "bkash-analyzer sample generator",
      CreationDate: new Date(2026, 8, 1),
    },
  });
  doc.pipe(createWriteStream(outFile));

  // Lay out rows first so every page can say "Page n of N"
  const pages = [];
  let current = null;
  let y = 0;
  const startPage = (first) => {
    current = { first, rows: [] };
    pages.push(current);
    y = first ? 220 + 18 : 60 + 18;
  };
  startPage(true);
  for (const txn of txns) {
    if (y + TXN_GAP > TABLE_BOTTOM) startPage(false);
    current.rows.push({ txn, y });
    y += TXN_GAP;
  }

  pages.forEach((page, i) => {
    doc.addPage();
    const headerY = page.first ? coverBlock(doc, txns) : 60;
    if (!page.first) {
      doc.font("Helvetica-Oblique").fontSize(8).text(DISCLAIMER, COL.date, 36, { lineBreak: false });
    }
    tableHeader(doc, headerY);

    for (const { txn, y: rowY } of page.rows) {
      const [line1, line2] = wrapDetails(doc, txn.details);
      doc.text(formatDate(txn.date), COL.date, rowY, { lineBreak: false });
      doc.text(txn.type, COL.type, rowY, { lineBreak: false });
      doc.text(line1, COL.details, rowY, { lineBreak: false });
      if (txn.out) right(doc, money(txn.out), COL.out, rowY);
      if (txn.in) right(doc, money(txn.in), COL.in, rowY);
      if (txn.fee) right(doc, money(txn.fee), COL.fee, rowY);
      right(doc, money(txn.balance), COL.balance, rowY);

      doc.text(formatTime(txn.date), COL.date, rowY + ROW_GAP, { lineBreak: false });
      if (line2) doc.text(line2, COL.details, rowY + ROW_GAP, { lineBreak: false });
    }

    doc.font("Helvetica").fontSize(7);
    doc.text(FOOTER, COL.date, 805, { lineBreak: false });
    right(doc, `Page ${i + 1} of ${pages.length}`, COL.balance, 805);
  });

  doc.end();
  console.log(`Wrote ${outFile} (${txns.length} transactions, password ${SAMPLE_PASSWORD})`);
}

await main();

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import {
  SAMPLE_META,
  SAMPLE_PASSWORD,
  buildSampleTransactions,
} from "../../scripts/sample-statement/data.mjs";
import { analyze } from "./analyze";
import { parseStatement } from "./parse";
import { SAMPLE_PASSWORD as APP_SAMPLE_PASSWORD } from "./sample";
import { PdfPasswordError } from "./types";

const require = createRequire(import.meta.url);
const standardFontDataUrl =
  join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts") + "/";
const samplePath = join(__dirname, "..", "..", "public", "sample", "sample-statement.pdf");

async function parseSample(password: string | undefined) {
  const data = await readFile(samplePath);
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  return parseStatement(buffer, password, {
    pdfjs: pdfjs as unknown as typeof import("pdfjs-dist"),
    standardFontDataUrl,
  });
}

describe("parseStatement on the synthetic sample", () => {
  const expected = buildSampleTransactions();

  it("uses the same sample password as the app", () => {
    expect(APP_SAMPLE_PASSWORD).toBe(SAMPLE_PASSWORD);
  });

  it("reads every transaction with the right amounts", async () => {
    const { txns, warnings } = await parseSample(SAMPLE_PASSWORD);
    expect(warnings).toEqual([]);
    expect(txns).toHaveLength(expected.length);

    txns.forEach((txn, i) => {
      const want = expected[i];
      expect(txn.date.getTime()).toBe(want.date.getTime());
      expect(txn.type).toBe(want.type);
      expect(txn.details).toBe(want.details);
      expect(txn.out).toBe(want.out);
      expect(txn.in).toBe(want.in);
      expect(txn.fee).toBe(want.fee);
      expect(txn.balance).toBeCloseTo(want.balance, 2);
    });
  });

  it("reads the cover block", async () => {
    const { meta } = await parseSample(SAMPLE_PASSWORD);
    expect(meta.accountName).toBe(SAMPLE_META.accountName);
    expect(meta.accountNumber).toBe(SAMPLE_META.accountNumber);
    expect(meta.userType).toBe("Customer");
    expect(meta.periodStart).toEqual(SAMPLE_META.periodStart);
    expect(meta.periodEnd).toEqual(SAMPLE_META.periodEnd);
    expect(meta.reportedTotalIn).toBeCloseTo(
      expected.reduce((a, t) => a + t.in, 0),
      2,
    );
  });

  it("splits details into counterparty, number and TRX ID", async () => {
    const { txns } = await parseSample(SAMPLE_PASSWORD);
    const payment = txns.find((t) => t.type === "Payment")!;
    expect(payment.counterparty).toMatch(/^SAMPLE [A-Z ]+$/);
    expect(payment.msisdn).toMatch(/^01000000\d{3}$/);
    expect(payment.trxId).toMatch(/^SMP[A-Z0-9]{7}$/);

    const transfer = txns.find((t) => t.type === "Send Money")!;
    expect(transfer.counterparty).toBe(transfer.msisdn);
  });

  it("asks for the password, then rejects a wrong one", async () => {
    await expect(parseSample(undefined)).rejects.toMatchObject({
      name: "PdfPasswordError",
      wrong: false,
    });
    const err = await parseSample("01999999999").catch((e) => e);
    expect(err).toBeInstanceOf(PdfPasswordError);
    expect(err.wrong).toBe(true);
  });

  it("feeds the analysis: monthly bills show up as recurring", async () => {
    const { txns } = await parseSample(SAMPLE_PASSWORD);
    const analysis = analyze(txns);
    expect(analysis.totals.count).toBe(expected.length);
    const labels = analysis.recurring.map((r) => r.label);
    expect(labels).toEqual(
      expect.arrayContaining(["Sample Electricity Co", "Sample Internet Ltd"]),
    );
  });

  it("builds a daily cash-flow series with quiet days as zeros", async () => {
    const { txns } = await parseSample(SAMPLE_PASSWORD);
    const { daily } = analyze(txns);
    // Every calendar day from the first to the last transaction (01 Jun - 28 Aug)
    expect(daily).toHaveLength(89);
    expect(daily[0].key).toBe("2026-06-01");
    expect(daily.at(-1)!.key).toBe("2026-08-28");
    expect(daily.some((d) => d.count === 0)).toBe(true);

    const sumIn = daily.reduce((a, d) => a + d.in, 0);
    const sumOut = daily.reduce((a, d) => a + d.out, 0);
    expect(sumIn).toBeCloseTo(expected.reduce((a, t) => a + t.in, 0), 2);
    expect(sumOut).toBeCloseTo(expected.reduce((a, t) => a + t.out + t.fee, 0), 2);
  });
});

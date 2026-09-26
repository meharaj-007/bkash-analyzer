import { monthKey, toISODate } from "./format";
import type { Txn } from "./types";

export interface Bucket {
  key: string;
  label: string;
  out: number;
  in: number;
  fee: number;
  count: number;
  net: number;
}

export interface MonthBucket extends Bucket {
  /** Closing balance on the last transaction of the month. */
  endBalance: number;
}

export interface CounterpartyBucket extends Bucket {
  msisdn: string | null;
  types: string[];
  first: Date;
  last: Date;
}

export interface Recurring {
  key: string;
  label: string;
  type: string;
  count: number;
  total: number;
  averageAmount: number;
  /** Median gap between occurrences, in days. */
  medianGapDays: number;
  last: Date;
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  tone: "neutral" | "good" | "watch";
}

export interface Analysis {
  txns: Txn[];
  totals: {
    in: number;
    out: number;
    fees: number;
    net: number;
    count: number;
    inCount: number;
    outCount: number;
    days: number;
    activeDays: number;
    avgOutPerActiveDay: number;
    avgTicketOut: number;
    avgTicketIn: number;
    openingBalance: number;
    closingBalance: number;
    minBalance: { value: number; date: Date } | null;
    maxBalance: { value: number; date: Date } | null;
    feeRate: number;
    earned: number;
  };
  range: { start: Date; end: Date } | null;
  byMonth: MonthBucket[];
  byType: Bucket[];
  outByType: Bucket[];
  inByType: Bucket[];
  feeByType: Bucket[];
  balanceSeries: { date: Date; balance: number }[];
  sentTo: CounterpartyBucket[];
  receivedFrom: CounterpartyBucket[];
  byWeekday: { key: string; label: string; count: number; out: number }[];
  byHour: { key: string; label: string; count: number; out: number }[];
  heatmap: { weekday: number; hour: number; count: number; out: number }[];
  largestOut: Txn[];
  largestIn: Txn[];
  costliestFees: Txn[];
  recurring: Recurring[];
  insights: Insight[];
}

const DAY_MS = 86_400_000;

/**
 * Money the wallet generated on its own: cashback, interest, rewards. Remittance
 * rows carry the words "Govt. Incentive" in their type but are ordinary inflow,
 * so they are excluded explicitly.
 */
const EARNING_TYPES = /\b(cashback|interest|reward|bonus)\b/i;
const NOT_EARNING = /remittance|disbursement to|salary/i;

function isEarning(type: string): boolean {
  return EARNING_TYPES.test(type) && !NOT_EARNING.test(type);
}

function emptyBucket(key: string, label: string): Bucket {
  return { key, label, out: 0, in: 0, fee: 0, count: 0, net: 0 };
}

function addTo(bucket: Bucket, t: Txn) {
  bucket.out += t.out;
  bucket.in += t.in;
  bucket.fee += t.fee;
  bucket.count += 1;
  bucket.net += t.net;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function analyze(txns: Txn[]): Analysis {
  const sorted = [...txns].sort((a, b) => a.date.getTime() - b.date.getTime());

  const totalIn = sorted.reduce((a, t) => a + t.in, 0);
  const totalOutNoFee = sorted.reduce((a, t) => a + t.out, 0);
  const fees = sorted.reduce((a, t) => a + t.fee, 0);
  const totalOut = totalOutNoFee + fees;
  const outCount = sorted.filter((t) => t.direction === "out").length;
  const inCount = sorted.length - outCount;

  const range =
    sorted.length > 0
      ? { start: sorted[0].date, end: sorted[sorted.length - 1].date }
      : null;
  const spanDays = range
    ? Math.max(
        1,
        Math.round((range.end.getTime() - range.start.getTime()) / DAY_MS) + 1,
      )
    : 0;

  // Balance is a running figure, so the opening balance is inferred backwards
  // from the first row rather than printed anywhere in the statement.
  const first = sorted[0];
  const openingBalance = first ? first.balance - first.net : 0;
  const closingBalance = sorted.length
    ? sorted[sorted.length - 1].balance
    : openingBalance;

  const withBalance = sorted.filter((t) => Number.isFinite(t.balance));
  const minRow = withBalance.reduce<Txn | null>(
    (lo, t) => (!lo || t.balance < lo.balance ? t : lo),
    null,
  );
  const maxRow = withBalance.reduce<Txn | null>(
    (hi, t) => (!hi || t.balance > hi.balance ? t : hi),
    null,
  );

  // --- monthly ---
  const monthMap = new Map<string, MonthBucket>();
  for (const t of sorted) {
    const key = monthKey(t.date);
    let bucket = monthMap.get(key);
    if (!bucket) {
      bucket = { ...emptyBucket(key, key), endBalance: t.balance };
      monthMap.set(key, bucket);
    }
    addTo(bucket, t);
    if (Number.isFinite(t.balance)) bucket.endBalance = t.balance;
  }
  const byMonth = [...monthMap.values()].sort((a, b) =>
    a.key.localeCompare(b.key),
  );

  // --- by transaction type ---
  const typeMap = new Map<string, Bucket>();
  for (const t of sorted) {
    let bucket = typeMap.get(t.type);
    if (!bucket) typeMap.set(t.type, (bucket = emptyBucket(t.type, t.type)));
    addTo(bucket, t);
  }
  const byType = [...typeMap.values()];
  const outByType = byType
    .filter((b) => b.out > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.out - a.out);
  const inByType = byType
    .filter((b) => b.in > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.in - a.in);
  const feeByType = byType
    .filter((b) => b.fee > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.fee - a.fee);

  // --- balance over time (closing balance per day) ---
  const dayMap = new Map<string, { date: Date; balance: number }>();
  for (const t of sorted) {
    if (!Number.isFinite(t.balance)) continue;
    const key = toISODate(t.date);
    dayMap.set(key, {
      date: new Date(
        t.date.getFullYear(),
        t.date.getMonth(),
        t.date.getDate(),
      ),
      balance: t.balance,
    });
  }
  const balanceSeries = [...dayMap.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  // --- counterparties ---
  const buildParties = (rows: Txn[]) => {
    const map = new Map<string, CounterpartyBucket>();
    for (const t of rows) {
      const key = (t.msisdn ?? t.counterparty).toLowerCase();
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          ...emptyBucket(key, t.counterparty),
          msisdn: t.msisdn,
          types: [],
          first: t.date,
          last: t.date,
        };
        map.set(key, bucket);
      }
      addTo(bucket, t);
      if (!bucket.types.includes(t.type)) bucket.types.push(t.type);
      if (t.date < bucket.first) bucket.first = t.date;
      if (t.date > bucket.last) bucket.last = t.date;
    }
    return [...map.values()];
  };
  const sentTo = buildParties(sorted.filter((t) => t.direction === "out")).sort(
    (a, b) => b.out + b.fee - (a.out + a.fee),
  );
  const receivedFrom = buildParties(
    sorted.filter((t) => t.direction === "in"),
  ).sort((a, b) => b.in - a.in);

  // --- time-of-activity ---
  const weekdayAgg = Array.from({ length: 7 }, () => ({ count: 0, out: 0 }));
  const hourAgg = Array.from({ length: 24 }, () => ({ count: 0, out: 0 }));
  const grid = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ count: 0, out: 0 })),
  );
  for (const t of sorted) {
    if (Number.isNaN(t.date.getTime())) continue;
    const wd = t.date.getDay();
    const hr = t.date.getHours();
    const spend = t.out + t.fee;
    weekdayAgg[wd].count += 1;
    weekdayAgg[wd].out += spend;
    hourAgg[hr].count += 1;
    hourAgg[hr].out += spend;
    grid[wd][hr].count += 1;
    grid[wd][hr].out += spend;
  }
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byWeekday = weekdayAgg.map((v, i) => ({
    key: String(i),
    label: weekdayLabels[i],
    ...v,
  }));
  const byHour = hourAgg.map((v, i) => ({
    key: String(i),
    label: `${i}`,
    ...v,
  }));
  const heatmap = grid.flatMap((row, wd) =>
    row.map((cell, hr) => ({ weekday: wd, hour: hr, ...cell })),
  );

  const activeDays = new Set(sorted.map((t) => toISODate(t.date))).size;

  // --- extremes ---
  const largestOut = [...sorted]
    .filter((t) => t.direction === "out")
    .sort((a, b) => b.out + b.fee - (a.out + a.fee))
    .slice(0, 8);
  const largestIn = [...sorted]
    .filter((t) => t.direction === "in")
    .sort((a, b) => b.in - a.in)
    .slice(0, 8);
  const costliestFees = [...sorted]
    .filter((t) => t.fee > 0)
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 8);

  // --- recurring payments ---
  const recurringMap = new Map<string, Txn[]>();
  for (const t of sorted) {
    if (t.direction !== "out") continue;
    const key = `${t.type}::${(t.msisdn ?? t.counterparty).toLowerCase()}`;
    const list = recurringMap.get(key);
    if (list) list.push(t);
    else recurringMap.set(key, [t]);
  }
  const recurring: Recurring[] = [];
  for (const [key, list] of recurringMap) {
    if (list.length < 3) continue;
    const gaps: number[] = [];
    for (let i = 1; i < list.length; i++) {
      gaps.push(
        (list[i].date.getTime() - list[i - 1].date.getTime()) / DAY_MS,
      );
    }
    const gap = median(gaps);
    // Keep anything that lands on a weekly-to-monthly-ish rhythm.
    if (gap < 3 || gap > 45) continue;
    const total = list.reduce((a, t) => a + t.out + t.fee, 0);
    recurring.push({
      key,
      label: list[0].counterparty,
      type: list[0].type,
      count: list.length,
      total,
      averageAmount: total / list.length,
      medianGapDays: gap,
      last: list[list.length - 1].date,
    });
  }
  recurring.sort((a, b) => b.total - a.total);

  const earned = sorted
    .filter((t) => isEarning(t.type))
    .reduce((a, t) => a + t.in, 0);

  const totals = {
    in: totalIn,
    out: totalOut,
    fees,
    net: totalIn - totalOut,
    count: sorted.length,
    inCount,
    outCount,
    days: spanDays,
    activeDays,
    avgOutPerActiveDay: activeDays ? totalOut / activeDays : 0,
    avgTicketOut: outCount ? totalOut / outCount : 0,
    avgTicketIn: inCount ? totalIn / inCount : 0,
    openingBalance,
    closingBalance,
    minBalance: minRow ? { value: minRow.balance, date: minRow.date } : null,
    maxBalance: maxRow ? { value: maxRow.balance, date: maxRow.date } : null,
    feeRate: totalOutNoFee ? fees / totalOutNoFee : 0,
    earned,
  };

  return {
    txns: sorted,
    totals,
    range,
    byMonth,
    byType: byType.sort((a, b) => b.count - a.count),
    outByType,
    inByType,
    feeByType,
    balanceSeries,
    sentTo,
    receivedFrom,
    byWeekday,
    byHour,
    heatmap,
    largestOut,
    largestIn,
    costliestFees,
    recurring,
    insights: buildInsights({
      totals,
      byMonth,
      outByType,
      feeByType,
      sentTo,
      byHour,
      byWeekday,
      recurring,
      costliestFees,
    }),
  };
}

function buildInsights(ctx: {
  totals: Analysis["totals"];
  byMonth: MonthBucket[];
  outByType: Bucket[];
  feeByType: Bucket[];
  sentTo: CounterpartyBucket[];
  byHour: Analysis["byHour"];
  byWeekday: Analysis["byWeekday"];
  recurring: Recurring[];
  costliestFees: Txn[];
}): Insight[] {
  const {
    totals,
    byMonth,
    outByType,
    feeByType,
    sentTo,
    byHour,
    byWeekday,
    recurring,
  } = ctx;
  const out: Insight[] = [];
  const taka = (n: number) =>
    `৳${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  if (totals.count === 0) return out;

  out.push({
    id: "net",
    title: totals.net >= 0 ? "You finished ahead" : "You finished behind",
    body: `${taka(totals.in)} came in and ${taka(totals.out)} went out, a net ${totals.net >= 0 ? "gain" : "drain"} of ${taka(Math.abs(totals.net))}. Balance moved from ${taka(totals.openingBalance)} to ${taka(totals.closingBalance)}.`,
    tone: totals.net >= 0 ? "good" : "watch",
  });

  if (totals.fees > 0) {
    const topFee = feeByType[0];
    out.push({
      id: "fees",
      title: `${taka(totals.fees)} lost to fees`,
      body: `Charges were ${(totals.feeRate * 100).toFixed(2)}% of everything you sent${
        topFee
          ? `, and ${taka(topFee.fee)} of it came from ${topFee.label} alone`
          : ""
      }. That is ${taka(totals.fees / Math.max(1, totals.days / 30))} a month.`,
      tone: "watch",
    });
  }

  const topOut = outByType[0];
  if (topOut) {
    out.push({
      id: "top-category",
      title: `${topOut.label} is your biggest outflow`,
      body: `${taka(topOut.out + topOut.fee)} across ${topOut.count} transactions — ${Math.round(((topOut.out + topOut.fee) / Math.max(1, totals.out)) * 100)}% of everything leaving the wallet.`,
      tone: "neutral",
    });
  }

  const topParty = sentTo[0];
  if (topParty && topParty.count > 1) {
    out.push({
      id: "top-party",
      title: `Most money went to ${topParty.label}`,
      body: `${taka(topParty.out + topParty.fee)} over ${topParty.count} transactions, averaging ${taka((topParty.out + topParty.fee) / topParty.count)} each.`,
      tone: "neutral",
    });
  }

  const busiestMonth = [...byMonth].sort(
    (a, b) => b.out + b.fee - (a.out + a.fee),
  )[0];
  if (busiestMonth && byMonth.length > 1) {
    const avg =
      byMonth.reduce((a, m) => a + m.out + m.fee, 0) / byMonth.length;
    const spend = busiestMonth.out + busiestMonth.fee;
    out.push({
      id: "peak-month",
      title: `${new Date(
        Number(busiestMonth.key.split("-")[0]),
        Number(busiestMonth.key.split("-")[1]) - 1,
      ).toLocaleDateString("en-GB", { month: "long", year: "numeric" })} was your heaviest month`,
      body: `${taka(spend)} out, ${Math.round((spend / Math.max(1, avg) - 1) * 100)}% above your ${taka(avg)} monthly average.`,
      tone: "neutral",
    });
  }

  const peakHour = [...byHour].sort((a, b) => b.count - a.count)[0];
  const peakDay = [...byWeekday].sort((a, b) => b.count - a.count)[0];
  if (peakHour && peakDay) {
    const hour = Number(peakHour.key);
    const label12 = `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "am" : "pm"}`;
    out.push({
      id: "rhythm",
      title: `You transact most around ${label12}`,
      body: `${peakHour.count} transactions landed in that hour, and ${peakDay.label} is your busiest day with ${peakDay.count}.`,
      tone: "neutral",
    });
  }

  if (recurring.length > 0) {
    const monthlyish = recurring.slice(0, 3);
    out.push({
      id: "recurring",
      title: `${recurring.length} recurring payment${recurring.length > 1 ? "s" : ""} detected`,
      body: `${monthlyish
        .map(
          (r) =>
            `${r.label} (${taka(r.averageAmount)} every ~${Math.round(r.medianGapDays)} days)`,
        )
        .join(", ")}. Together the recurring set costs ${taka(recurring.reduce((a, r) => a + r.total, 0))} over this period.`,
      tone: "neutral",
    });
  }

  if (totals.earned > 0) {
    const offset =
      totals.fees > 0
        ? ` — covering ${Math.min(100, Math.round((totals.earned / totals.fees) * 100))}% of what you paid in fees`
        : "";
    out.push({
      id: "earned",
      title: `${taka(totals.earned)} earned back`,
      body: `Cashback, interest and rewards credited to the wallet${offset}.`,
      tone: "good",
    });
  }

  if (totals.minBalance && totals.minBalance.value < 200) {
    out.push({
      id: "low-balance",
      title: `Balance bottomed out at ৳${totals.minBalance.value.toFixed(2)}`,
      body: `On ${totals.minBalance.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. Running that thin risks a failed cash out or bill payment.`,
      tone: "watch",
    });
  }

  out.push({
    id: "cadence",
    title: `${taka(totals.avgOutPerActiveDay)} on an average active day`,
    body: `${totals.count} transactions across ${totals.activeDays} active days out of ${totals.days} in the period — you touch bKash roughly ${Math.round((totals.activeDays / Math.max(1, totals.days)) * 100)}% of days.`,
    tone: "neutral",
  });

  return out;
}

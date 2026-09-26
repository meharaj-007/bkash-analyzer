// Synthetic transactions for the sample statement. Every name, number and
// TRX ID here is made up: mobile numbers use the unassigned 010 prefix and
// businesses are called "Sample …", so nothing can be mistaken for a real
// person or merchant. The data is seeded, so every run produces the same rows.

export const SAMPLE_PASSWORD = "01000000000";

export const SAMPLE_META = {
  accountName: "SAMPLE CUSTOMER",
  accountNumber: "01000000000",
  userType: "Customer",
  periodStart: new Date(2026, 5, 1),
  periodEnd: new Date(2026, 7, 31),
  issueDate: "01 Sep 2026",
  openingBalance: 4200,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Reset in buildSampleTransactions so every call returns the same rows.
let rand = mulberry32(20260901);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (lo, hi) => Math.round(lo + rand() * (hi - lo));

function trxId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let id = "SMP";
  for (let i = 0; i < 7; i++) id += chars[Math.floor(rand() * chars.length)];
  return id;
}

const friends = ["01000000101", "01000000102", "01000000103", "01000000104"];
const agents = ["Sample Agent Point-AG0001", "Sample Telecom Store-AG0002"];
const shops = [
  "SAMPLE GROCERY SHOP-MP0001",
  "SAMPLE PHARMACY-MP0002",
  "SAMPLE FOOD COURT-MP0003",
  "SAMPLE RIDE SHARE-MP0004",
  "SAMPLE BOOK STORE-MP0005",
];

/** Fee rules are simplified stand-ins, not bKash's actual tariff. */
function feeFor(type, amount) {
  if (type === "Cash Out") return Math.round(amount * 0.0185 * 100) / 100;
  if (type === "Send Money" && amount > 1000) return 5;
  return 0;
}

function at(day, hour, minute) {
  return { day, hour, minute, second: between(0, 59) };
}

/** Build the month's events, then sort and price them. */
function monthEvents(year, month) {
  const events = [
    { ...at(1, 10, 5), type: "Received Money", dir: "in", amount: 25000, details: `01000000200 / TRX ID: ${trxId()}` },
    { ...at(3, 9, 30), type: "Pay Bill", dir: "out", amount: 1450, details: `Sample Electricity Co / TRX ID: ${trxId()} / 1000XXXXXX001` },
    { ...at(5, 20, 12), type: "Mobile Recharge", dir: "out", amount: 499, details: `01000000000 / TRX ID: ${trxId()} / Sample Mobile` },
    { ...at(10, 18, 40), type: "Pay Bill", dir: "out", amount: 1200, details: `Sample Internet Ltd / TRX ID: ${trxId()} / 1000XXXXXX002` },
    { ...at(25, 11, 0), type: "Transfer to Bank", dir: "out", amount: 5000, details: `TRX ID: ${trxId()} / Sample Bank PLC` },
  ];

  for (let i = 0; i < 12; i++) {
    const shop = pick(shops);
    events.push({
      ...at(between(1, 28), between(8, 22), between(0, 59)),
      type: "Payment",
      dir: "out",
      amount: between(80, 1200),
      details: `${shop} / 01000000${between(300, 399)} / TRX ID: ${trxId()}`,
    });
  }
  for (let i = 0; i < 3; i++) {
    events.push({
      ...at(between(2, 27), between(9, 23), between(0, 59)),
      type: "Send Money",
      dir: "out",
      amount: between(300, 2000),
      details: `${pick(friends)} / TRX ID: ${trxId()}`,
    });
  }
  events.push({
    ...at(between(12, 20), between(10, 19), between(0, 59)),
    type: "Cash Out",
    dir: "out",
    amount: between(2, 6) * 1000,
    details: `${pick(agents)} / 01000000${between(400, 499)} / TRX ID: ${trxId()}`,
  });
  events.push({
    ...at(between(6, 26), between(9, 21), between(0, 59)),
    type: "Cash In",
    dir: "in",
    amount: between(1, 4) * 1000,
    details: `${pick(agents)} / 01000000${between(400, 499)} / TRX ID: ${trxId()}`,
  });
  events.push({
    ...at(between(6, 26), between(9, 21), between(0, 59)),
    type: "Received Money",
    dir: "in",
    amount: between(500, 2500),
    details: `${pick(friends)} / TRX ID: ${trxId()}`,
  });
  events.push({
    ...at(28, 23, 55),
    type: "Cashback",
    dir: "in",
    amount: between(20, 90),
    details: `TRX ID: ${trxId()} / Sample Cashback Offer`,
  });

  return events.map((e) => ({ ...e, date: new Date(year, month, e.day, e.hour, e.minute, e.second) }));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export function formatDate(d) {
  return `${pad(d.getDate())}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

export function formatTime(d) {
  const h = d.getHours() % 12 || 12;
  return `${pad(h)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

export function formatLongDate(d) {
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** All transactions in date order, with fees and running balance filled in. */
export function buildSampleTransactions() {
  rand = mulberry32(20260901);
  const events = [5, 6, 7].flatMap((m) => monthEvents(2026, m));
  events.sort((a, b) => a.date - b.date);

  let balance = SAMPLE_META.openingBalance;
  return events.map((e) => {
    const fee = e.dir === "out" ? feeFor(e.type, e.amount) : 0;
    balance += e.dir === "in" ? e.amount : -(e.amount + fee);
    balance = Math.round(balance * 100) / 100;
    return {
      date: e.date,
      type: e.type,
      details: e.details,
      out: e.dir === "out" ? e.amount : 0,
      in: e.dir === "in" ? e.amount : 0,
      fee,
      balance,
    };
  });
}

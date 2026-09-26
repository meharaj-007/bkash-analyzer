const TAKA = "৳"; // ৳

const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Full precision, for tables and tooltips. */
export function formatTaka(value: number, opts?: { sign?: boolean }): string {
  const sign = opts?.sign && value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${TAKA}${money.format(Math.abs(value))}`;
}

/** Compact, for stat tiles and axis ticks. */
export function formatTakaShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}${TAKA}${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}${TAKA}${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}${TAKA}${(abs / 1000).toFixed(1)}K`;
  return `${sign}${TAKA}${whole.format(abs)}`;
}

/** Axis ticks: no currency mark, so the axis stays quiet. */
export function formatAxis(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}K`;
  return `${sign}${whole.format(abs)}`;
}

export function formatCount(value: number): string {
  return whole.format(value);
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: Date): string {
  return `${formatDate(d)}, ${d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function formatMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
}

export function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
}

export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function percent(part: number, whole: number): string {
  if (!whole) return "0%";
  const p = (part / whole) * 100;
  return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
}

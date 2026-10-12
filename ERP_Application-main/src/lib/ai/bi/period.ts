/** Period parsing + helpers shared by the AI live-data resolver and BI engine. */

export interface Range { from: string; to: string; label: string }
const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const monday = (d: Date) => day(d, -((d.getUTCDay() + 6) % 7));
const firstOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 1));
const lastOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0));
function utcToday() { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); }

/** Natural-language period → date range. Handles today/yesterday/this|last week/month/year. */
export function parsePeriod(q: string): Range {
  const today = utcToday();
  if (/\byesterday\b/.test(q)) { const y = day(today, -1); return { from: iso(y), to: iso(y), label: "yesterday" }; }
  if (/\blast week\b|\bprevious week\b/.test(q)) { const thisMon = monday(today); return { from: iso(day(thisMon, -7)), to: iso(day(thisMon, -1)), label: "last week" }; }
  if (/\bthis week\b|\bweek\b/.test(q)) return { from: iso(monday(today)), to: iso(today), label: "this week" };
  if (/\blast month\b|\bprevious month\b/.test(q)) { const y = today.getUTCFullYear(), m = today.getUTCMonth(); const lm = m === 0 ? 11 : m - 1; const ly = m === 0 ? y - 1 : y; return { from: iso(firstOfMonth(ly, lm)), to: iso(lastOfMonth(ly, lm)), label: "last month" }; }
  if (/\blast year\b|\bprevious year\b/.test(q)) { const y = today.getUTCFullYear() - 1; return { from: `${y}-01-01`, to: `${y}-12-31`, label: "last year" }; }
  if (/\bthis year\b|\byear\b|\bytd\b/.test(q)) return { from: iso(new Date(Date.UTC(today.getUTCFullYear(), 0, 1))), to: iso(today), label: "this year" };
  if (/\btoday\b/.test(q)) return { from: iso(today), to: iso(today), label: "today" };
  return { from: iso(firstOfMonth(today.getUTCFullYear(), today.getUTCMonth())), to: iso(today), label: "this month" };
}

/** Calendar-month range for a YYYY-MM. */
export function monthRange(period: string): Range {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}`, label: monthLabel(period) };
}
export function ym(dateStr: string) { return dateStr.slice(0, 7); }
export function currentYm() { return new Date().toISOString().slice(0, 7); }
export function prevYm(period: string) { const [y, m] = period.split("-").map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; }
export function recentMonths(period: string, n: number): string[] { const [y, m] = period.split("-").map(Number); const out: string[] = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`); } return out; }
export function monthLabel(period: string): string { const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; const [y, m] = period.split("-").map(Number); return `${names[(m ?? 1) - 1]} ${y}`; }
export function monthShort(period: string): string { return monthLabel(period).slice(0, 3); }

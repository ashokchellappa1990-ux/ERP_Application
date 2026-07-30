/**
 * Dashboard date/period helpers — pure, DB-free, safe to import anywhere.
 *
 * All transactional date columns in this app are stored as ISO `yyyy-mm-dd`
 * strings (`new Date().toISOString().slice(0,10)`), so date-range filters are a
 * plain lexicographic string compare (`{ gte, lte }`). Everything here therefore
 * works in ISO strings, never Date objects, so there are zero timezone surprises
 * once "today" has been resolved in the tenant's timezone.
 */

const FY_MONTH: Record<string, number> = { January: 0, April: 3, July: 6, October: 9 };

/** "Today" as an ISO yyyy-mm-dd string in the given IANA timezone. */
export function todayISO(tz = "Asia/Kolkata"): string {
  // en-CA formats as yyyy-mm-dd, which is exactly our storage format.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** Add (or subtract) whole days to an ISO date, returning ISO. UTC math avoids DST drift. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** First day of the month `iso` falls in. */
export function monthStartOf(iso: string): string {
  const [y, m] = iso.split("-");
  return `${y}-${m}-01`;
}

/** Last day of the month `iso` falls in. */
export function monthEndOf(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const t = Date.UTC(y, m, 1) - 86400000; // day before the 1st of next month
  return new Date(t).toISOString().slice(0, 10);
}

/** Short month label e.g. "Jul" for a `yyyy-mm` key. */
export function monthLabel(ym: string): string {
  const [, m] = ym.split("-").map(Number);
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(m - 1) % 12];
}

export interface Periods {
  tz: string;
  today: string;
  yesterday: string;
  monthStart: string;
  monthEnd: string;
  prevMonthStart: string;
  prevMonthEnd: string;
  fyStart: string;
  fyEnd: string;
  fyLabel: string;
  /** Trailing N calendar days ending today, oldest→newest (ISO). */
  lastDays: string[];
  /** Trailing N months incl. current, oldest→newest. */
  lastMonths: { key: string; start: string; end: string; label: string }[];
}

/** Resolve every period the dashboard needs from the tenant's fiscal-year start. */
export function getPeriods(fiscalYearStart = "April", tz = "Asia/Kolkata", opts: { days?: number; months?: number } = {}): Periods {
  const today = todayISO(tz);
  const [Y, M] = today.split("-").map(Number);
  const monthStart = monthStartOf(today);
  const monthEnd = monthEndOf(today);
  const prevMonthEnd = addDays(monthStart, -1);
  const prevMonthStart = monthStartOf(prevMonthEnd);

  // Financial year window.
  const fm = FY_MONTH[fiscalYearStart] ?? 3;
  const fyStartYear = M - 1 >= fm ? Y : Y - 1;
  const fyStart = `${fyStartYear}-${String(fm + 1).padStart(2, "0")}-01`;
  const fyEndDate = Date.UTC(fyStartYear + 1, fm, 1) - 86400000;
  const fyEnd = new Date(fyEndDate).toISOString().slice(0, 10);
  const fyLabel = fm === 0
    ? `FY ${fyStartYear}`
    : `FY ${String(fyStartYear % 100).padStart(2, "0")}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`;

  const nDays = opts.days ?? 14;
  const lastDays: string[] = [];
  for (let i = nDays - 1; i >= 0; i--) lastDays.push(addDays(today, -i));

  const nMonths = opts.months ?? 6;
  const lastMonths: Periods["lastMonths"] = [];
  for (let i = nMonths - 1; i >= 0; i--) {
    const t = Date.UTC(Y, M - 1 - i, 1);
    const start = new Date(t).toISOString().slice(0, 10);
    lastMonths.push({ key: start.slice(0, 7), start, end: monthEndOf(start), label: monthLabel(start.slice(0, 7)) });
  }

  return { tz, today, yesterday: addDays(today, -1), monthStart, monthEnd, prevMonthStart, prevMonthEnd, fyStart, fyEnd, fyLabel, lastDays, lastMonths };
}

/** % change helper: (curr-prev)/prev × 100, rounded to 1 dp; 0 when no base. */
export function pctChange(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
}

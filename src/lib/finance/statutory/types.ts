import { ACC } from "@/lib/accounting/accounts";

/**
 * Statutory type registry — the reusable framework backbone. Every statutory head
 * (GST / TDS / TCS today; PF / ESI / PT / LWF tomorrow) is one entry here. The
 * Government-Payment engine, liability computation, challan flow, return filing and
 * the console are all driven off this registry, so adding a future statutory head is
 * a matter of adding an entry (+ seeding its GL account) — no new tables or screens.
 *
 * `liabilityAccount` is the GL account whose CREDIT balance in a period is the accrued
 * liability; paying it Debits this account and Credits Bank/Cash.
 */
export interface StatutoryTypeDef {
  code: string;              // GST | TDS | TCS | PF | ESI | PT | LWF
  label: string;
  liabilityAccount: string;  // GL code of the payable account (credit = liability)
  breakup: "gst" | "section" | "customer" | "flat"; // how the liability breaks down
  returns: string[];         // return forms filed for this head
  dueDay: number;            // day of the following month the payment is due
  color: string;             // tailwind text/bg accent
  active: boolean;           // GST/TDS/TCS live; others are config-ready placeholders
}

export const STATUTORY_TYPES: StatutoryTypeDef[] = [
  { code: "GST", label: "GST", liabilityAccount: ACC.OUTPUT_GST, breakup: "gst", returns: ["GSTR-1", "GSTR-3B", "GSTR-9"], dueDay: 20, color: "text-primary", active: true },
  { code: "TDS", label: "TDS", liabilityAccount: ACC.TDS_PAYABLE, breakup: "section", returns: ["24Q", "26Q", "27Q"], dueDay: 7, color: "text-info", active: true },
  { code: "TCS", label: "TCS", liabilityAccount: ACC.TCS_PAYABLE, breakup: "customer", returns: ["27EQ"], dueDay: 7, color: "text-success", active: true },
  // Future statutory heads — reuse the exact same framework once their GL account &
  // source capture exist. Marked inactive so they don't yet appear as payable heads.
  { code: "PF", label: "Provident Fund", liabilityAccount: "2150", breakup: "flat", returns: ["ECR"], dueDay: 15, color: "text-warning", active: false },
  { code: "ESI", label: "ESI", liabilityAccount: "2160", breakup: "flat", returns: ["ESI Return"], dueDay: 15, color: "text-warning", active: false },
  { code: "PT", label: "Professional Tax", liabilityAccount: "2170", breakup: "flat", returns: ["PT Return"], dueDay: 20, color: "text-warning", active: false },
  { code: "LWF", label: "Labour Welfare Fund", liabilityAccount: "2180", breakup: "flat", returns: ["LWF Return"], dueDay: 20, color: "text-warning", active: false },
];

export const ACTIVE_STATUTORY_TYPES = STATUTORY_TYPES.filter((t) => t.active);

export function statutoryDef(code: string): StatutoryTypeDef | undefined {
  return STATUTORY_TYPES.find((t) => t.code === code);
}

/** Indian financial year (Apr–Mar) for a YYYY-MM-DD or YYYY-MM string, e.g. "2026-27". */
export function financialYear(dateOrPeriod: string): string {
  const [y, m] = dateOrPeriod.split("-").map(Number);
  const startYear = (m ?? 1) >= 4 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** First & last calendar day of a YYYY-MM tax period. */
export function periodWindow(period: string): { from: string; to: string } {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}` };
}

/** Human month label, e.g. "Jun 2026". */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[(m ?? 1) - 1]} ${y}`;
}

/** Due date (YYYY-MM-DD) for a head's liability accrued in a period — dueDay of next month. */
export function dueDate(typeCode: string, period: string): string {
  const def = statutoryDef(typeCode);
  const [y, m] = period.split("-").map(Number);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const day = def?.dueDay ?? 20;
  return `${nextY}-${String(nextM).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

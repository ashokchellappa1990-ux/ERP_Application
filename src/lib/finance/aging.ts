import type { AgingBuckets, PartyGroup } from "@/lib/contracts/finance";

const r2 = (n: number) => +(Number(n) || 0).toFixed(2);
export const emptyAging = (): AgingBuckets => ({ notDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 });

/** Whole days from `dueDate` to `today` (both yyyy-mm-dd), UTC-safe. */
export function daysPastDue(dueDate: string, today: string): number {
  const p = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, (m || 1) - 1, d || 1); };
  return Math.floor((p(today) - p(dueDate)) / 86400000);
}

/** Which aging bucket an outstanding balance falls into, by days past its due date. */
export function bucketOf(dueDate: string | null | undefined, today: string): keyof AgingBuckets {
  if (!dueDate || dueDate >= today) return "notDue";
  const d = daysPastDue(dueDate, today);
  return d <= 30 ? "d1_30" : d <= 60 ? "d31_60" : d <= 90 ? "d61_90" : "d90";
}

export interface AgeableRow { party: string; gstin?: string; billed: number; paid: number; balance: number; dueDate: string | null; overdue: boolean }

/** Group outstanding rows by party, with per-party + overall aging buckets. */
export function groupByParty(rows: AgeableRow[], today: string): { groups: PartyGroup[]; aging: AgingBuckets } {
  const map = new Map<string, PartyGroup>();
  const overall = emptyAging();
  for (const r of rows) {
    const key = r.party || "—";
    let g = map.get(key);
    if (!g) { g = { party: key, gstin: r.gstin ?? "", count: 0, billed: 0, paid: 0, balance: 0, overdue: 0, oldestDue: null, aging: emptyAging() }; map.set(key, g); }
    g.count += 1;
    g.billed = r2(g.billed + r.billed);
    g.paid = r2(g.paid + r.paid);
    g.balance = r2(g.balance + r.balance);
    if (r.overdue) g.overdue = r2(g.overdue + r.balance);
    if (r.dueDate && (!g.oldestDue || r.dueDate < g.oldestDue)) g.oldestDue = r.dueDate;
    const b = bucketOf(r.dueDate, today);
    g.aging[b] = r2(g.aging[b] + r.balance);
    overall[b] = r2(overall[b] + r.balance);
    if (!r.gstin && g.gstin === "" && r.gstin) g.gstin = r.gstin;
  }
  const groups = [...map.values()].sort((a, b) => b.balance - a.balance);
  return { groups, aging: overall };
}

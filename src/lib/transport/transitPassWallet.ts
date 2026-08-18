import { prisma } from "@/lib/db/prisma";
import { getActiveScope, scopeWhere, type ScopeUser } from "@/lib/auth/scope";
import { settingScope, resolveScoped } from "@/lib/settings/settingScope";

/**
 * Transit Pass Wallet — a read-only reconciliation ledger, not a posting engine.
 * Both sides already book Transit Pass correctly on their own: GRN folds it into
 * Inventory/Payable (see src/lib/accounting/post.ts postPurchaseJournal), Load &
 * Dispatch has its own TRANSIT_PASS_RECOVERY/OPERATING_EXPENSE_DISPATCH accounts
 * (see src/lib/transport/loadDispatch.ts). This module only aggregates those two
 * source documents plus a one-time opening balance (Purchase Configuration) into
 * a single bank-statement-style running balance — it never writes to the GL.
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const r3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const num = (v: unknown) => (v == null ? 0 : Number(v));

export interface TransitPassWalletRow {
  date: string;
  type: "Purchase" | "Sales";
  refId: number;
  refNo: string;
  transitPassNo: string | null;
  party: string | null;
  qty: number;
  rate: number;
  spent: number;
  received: number;
  qtyBalance: number;
  amountBalance: number;
  // Balance carried into this row's calendar date, before that date's first
  // transaction — same value for every row sharing a date, so the UI can
  // print a per-date "Opening Balance" line for whichever date is on screen.
  dayOpeningQty: number;
  dayOpeningAmount: number;
}

export interface TransitPassWalletLedger {
  enabled: boolean;
  from: string;
  to: string;
  // Balance as of the moment just before `from` — i.e. this period's starting point.
  openingQty: number;
  openingAmount: number;
  // Rows within [from, to], newest first, each still carrying its true running
  // balance (computed against full history, not reset per period).
  rows: TransitPassWalletRow[];
  totals: { spent: number; received: number; closingQty: number; closingAmount: number };
}

/** First day of the current month, "YYYY-MM-DD" (server-local). */
function firstOfThisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getTransitPassWalletLedger(
  user: ScopeUser,
  filters?: { from?: string; to?: string },
): Promise<TransitPassWalletLedger> {
  const purchaseCfgRow = await resolveScoped((where) => prisma.purchaseSetting.findFirst({ where }), await settingScope(user));
  const purchaseCfg = (purchaseCfgRow?.config ?? {}) as { fields?: Record<string, string>; flags?: Record<string, boolean> };
  const enabled = !!purchaseCfg.flags?.enableTransitPass;
  const trueOpeningQty = num(purchaseCfg.fields?.transitPassOpeningQty);
  const trueOpeningAmount = num(purchaseCfg.fields?.transitPassOpeningAmount);

  // Default period: current month. The card totals/balances below are always
  // scoped to [from, to] — change the dates to see a different period.
  const from = filters?.from || firstOfThisMonth();
  const to = filters?.to || todayStr();

  const scope = await getActiveScope(user);
  const sw = scopeWhere(scope, { branch: true });

  // Full history (unfiltered) is needed so the running balance at any given
  // row — and this period's opening balance — reflects everything before it,
  // not just what falls inside the selected window.
  const [grns, dispatches] = await Promise.all([
    prisma.goodsReceiptNote.findMany({
      where: { ...sw, status: "Posted", transitPassAmount: { gt: 0 } },
      select: { id: true, grnNo: true, grnDate: true, supplier: true, transitPassRefNo: true, transitPassQty: true, transitPassRate: true, transitPassAmount: true },
      orderBy: { grnDate: "asc" },
    }),
    prisma.loadDispatch.findMany({
      where: {
        ...sw, docType: "Customer", transitPassAmount: { gt: 0 },
        status: { in: ["Dispatched", "Delivery Challan Generated", "Sales Invoice Posted"] },
      },
      select: { id: true, dispatchNo: true, dispatchDate: true, partyName: true, transitPassRefNo: true, transitPassQty: true, transitPassRate: true, transitPassAmount: true },
      orderBy: { dispatchDate: "asc" },
    }),
  ]);

  // Fall back to amount/qty for rows saved before transitPassRate existed.
  const effRate = (rate: unknown, amount: number, qty: number) => (rate != null ? num(rate) : qty > 0 ? r2(amount / qty) : 0);

  const merged: Omit<TransitPassWalletRow, "qtyBalance" | "amountBalance" | "dayOpeningQty" | "dayOpeningAmount">[] = [
    ...grns.map((g) => {
      const qty = g.transitPassQty != null ? num(g.transitPassQty) : 0;
      const spent = num(g.transitPassAmount);
      return {
        date: g.grnDate, type: "Purchase" as const, refId: g.id, refNo: g.grnNo, transitPassNo: g.transitPassRefNo,
        party: g.supplier, qty, rate: effRate(g.transitPassRate, spent, qty), spent, received: 0,
      };
    }),
    ...dispatches.map((d) => {
      const qty = d.transitPassQty != null ? num(d.transitPassQty) : 0;
      const received = num(d.transitPassAmount);
      return {
        date: d.dispatchDate, type: "Sales" as const, refId: d.id, refNo: d.dispatchNo, transitPassNo: d.transitPassRefNo,
        party: d.partyName, qty, rate: effRate(d.transitPassRate, received, qty), spent: 0, received,
      };
    }),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let qtyBalance = trueOpeningQty;
  let amountBalance = trueOpeningAmount;
  let periodOpeningQty = trueOpeningQty;
  let periodOpeningAmount = trueOpeningAmount;
  let lastDate: string | null = null;
  let dayOpeningQty = trueOpeningQty;
  let dayOpeningAmount = trueOpeningAmount;
  const allRows: TransitPassWalletRow[] = merged.map((m) => {
    if (m.date !== lastDate) { dayOpeningQty = qtyBalance; dayOpeningAmount = amountBalance; lastDate = m.date; }
    qtyBalance = r3(qtyBalance + (m.type === "Purchase" ? m.qty : -m.qty));
    amountBalance = r2(amountBalance + m.spent - m.received);
    // The balance carried by the last row strictly before `from` is this
    // period's opening balance — captured as we walk past it.
    if (m.date < from) { periodOpeningQty = qtyBalance; periodOpeningAmount = amountBalance; }
    return { ...m, qtyBalance, amountBalance, dayOpeningQty, dayOpeningAmount };
  });

  const periodRows = allRows.filter((r) => r.date >= from && r.date <= to);
  const totalSpent = r2(periodRows.reduce((s, r) => s + r.spent, 0));
  const totalReceived = r2(periodRows.reduce((s, r) => s + r.received, 0));
  const last = periodRows[periodRows.length - 1];
  const closingQty = last ? last.qtyBalance : periodOpeningQty;
  const closingAmount = last ? last.amountBalance : periodOpeningAmount;

  return {
    enabled, from, to,
    openingQty: periodOpeningQty, openingAmount: periodOpeningAmount,
    rows: periodRows.slice().reverse(), // newest first
    totals: { spent: totalSpent, received: totalReceived, closingQty, closingAmount },
  };
}

import type { ActiveScope } from "@/lib/auth/scope";
import { monthRange, prevYm, currentYm, ym } from "@/lib/ai/bi/period";
import { decisionMetric } from "./catalog";

/**
 * BASELINE — one live snapshot of the current business state that the health, risk,
 * opportunity, recommendation and scenario engines all read from. Computed once (via the
 * decision-metric compute() functions) and shared, so a dashboard load runs the heavy
 * aggregates a single time.
 */

export interface Baseline {
  period: string;
  sales: number; orders: number; avgBill: number; purchases: number;
  revenue: number; expense: number; grossProfit: number; netProfit: number; profitMargin: number;
  cash: number; bank: number; liquid: number; receivable: number; payable: number; workingCapital: number; gstDue: number;
  budgetUtil: number; inventoryValue: number; lowStock: number; activeCustomers: number; activeSuppliers: number;
  prevSales: number; prevExpense: number; prevNetProfit: number;
  salesMoMPct: number; expenseMoMPct: number; profitMoMPct: number;
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (cur: number, prev: number) => (prev !== 0 ? r2(((cur - prev) / Math.abs(prev)) * 100) : 0);
const compute = (key: string, scope: ActiveScope, range: { from: string; to: string; label: string }) => {
  const m = decisionMetric(key); return m ? m.compute(scope, range).catch(() => 0) : Promise.resolve(0);
};

export async function computeBaseline(scope: ActiveScope, opts?: { period?: string }): Promise<Baseline> {
  const period = opts?.period ?? currentYm();
  const cur = monthRange(period);
  const prev = monthRange(prevYm(period));

  const [sales, orders, avgBill, purchases, revenue, expense, grossProfit, netProfit, profitMargin,
    cash, bank, receivable, payable, workingCapital, gstDue, budgetUtil, inventoryValue, lowStock, activeCustomers, activeSuppliers,
    prevSales, prevExpense, prevNetProfit] = await Promise.all([
    compute("sales", scope, cur), compute("orders", scope, cur), compute("avgBill", scope, cur), compute("purchases", scope, cur),
    compute("revenue", scope, cur), compute("expense", scope, cur), compute("grossProfit", scope, cur), compute("netProfit", scope, cur), compute("profitMargin", scope, cur),
    compute("cash", scope, cur), compute("bank", scope, cur), compute("receivable", scope, cur), compute("payable", scope, cur), compute("workingCapital", scope, cur), compute("gstDue", scope, cur),
    compute("budgetUtil", scope, cur), compute("inventoryValue", scope, cur), compute("lowStock", scope, cur), compute("activeCustomers", scope, cur), compute("activeSuppliers", scope, cur),
    compute("sales", scope, prev), compute("expense", scope, prev), compute("netProfit", scope, prev),
  ]);

  return {
    period,
    sales: r2(sales), orders, avgBill: r2(avgBill), purchases: r2(purchases),
    revenue: r2(revenue), expense: r2(expense), grossProfit: r2(grossProfit), netProfit: r2(netProfit), profitMargin: r2(profitMargin),
    cash: r2(cash), bank: r2(bank), liquid: r2(cash + bank), receivable: r2(receivable), payable: r2(payable), workingCapital: r2(workingCapital), gstDue: r2(gstDue),
    budgetUtil: Math.round(budgetUtil), inventoryValue: r2(inventoryValue), lowStock, activeCustomers, activeSuppliers,
    prevSales: r2(prevSales), prevExpense: r2(prevExpense), prevNetProfit: r2(prevNetProfit),
    salesMoMPct: pct(sales, prevSales), expenseMoMPct: pct(expense, prevExpense), profitMoMPct: pct(netProfit, prevNetProfit),
  };
}

export const gstPeriod = (period: string) => ym(monthRange(period).to);

import type { ActiveScope } from "@/lib/auth/scope";
import { computeBaseline, type Baseline } from "./baseline";

/**
 * SCENARIO SIMULATOR (Module 12) — instant what-if analysis. Apply parametric changes
 * (sales, expenses, discount, marketing, supplier price, GST, salary, new branch) to the
 * live baseline and recompute Revenue, Profit, Cash Flow, Budget, Working Capital,
 * Inventory and Customer impact. Deterministic model; nothing is posted.
 */

export interface ScenarioInputs {
  salesChangePct?: number;      // +/- % change in sales volume
  expenseChangePct?: number;    // +/- % change in expenses
  discountPct?: number;         // additional discount on sales
  marketingBudget?: number;     // extra marketing spend (absolute ₹)
  supplierPriceChangePct?: number; // +/- % supplier/purchase price
  gstChangePct?: number;        // change in effective GST rate (points)
  salaryChangePct?: number;     // +/- % salary/payroll (approx via expense)
  newBranch?: boolean;          // open a new branch (one-off + uplift)
}

export interface ScenarioMetric { key: string; label: string; unit: "money" | "count" | "percent"; baseline: number; scenario: number; delta: number; deltaPct: number; better: boolean }
export interface ScenarioResult { inputs: ScenarioInputs; metrics: ScenarioMetric[]; summary: string; baseline: Baseline }

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (cur: number, base: number) => (base !== 0 ? r2(((cur - base) / Math.abs(base)) * 100) : 0);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export async function simulate(scope: ActiveScope, inputs: ScenarioInputs, opts?: { period?: string; baseline?: Baseline }): Promise<ScenarioResult> {
  const b = opts?.baseline ?? (await computeBaseline(scope, opts));
  const i = inputs;
  const salesMul = 1 + (i.salesChangePct ?? 0) / 100;
  const discMul = 1 - (i.discountPct ?? 0) / 100;
  const newBranchUplift = i.newBranch ? 0.25 : 0; // +25% sales capacity
  const newBranchCost = i.newBranch ? b.expense * 0.3 : 0; // one-off + running

  // Revenue: sales change × discount effect × new-branch uplift.
  const revenue = r2(b.revenue * salesMul * discMul * (1 + newBranchUplift));
  const sales = r2(b.sales * salesMul * discMul * (1 + newBranchUplift));

  // Expense: expense change + marketing + supplier price on purchases + salary + new branch.
  const supplierExtra = r2(b.purchases * ((i.supplierPriceChangePct ?? 0) / 100));
  const salaryExtra = r2(b.expense * 0.4 * ((i.salaryChangePct ?? 0) / 100)); // ~40% of expense is payroll
  const expense = r2(b.expense * (1 + (i.expenseChangePct ?? 0) / 100) + (i.marketingBudget ?? 0) + supplierExtra + salaryExtra + newBranchCost);

  const netProfit = r2(revenue - expense);
  const gstEffect = r2(b.gstDue * (1 + (i.gstChangePct ?? 0) / 100));
  const cashFlow = r2(b.liquid + (netProfit - b.netProfit)); // incremental profit flows to cash
  const workingCapital = r2(b.workingCapital + (netProfit - b.netProfit));
  const inventory = r2(b.inventoryValue * salesMul); // stock scales with sales volume
  const customers = Math.round(b.activeCustomers * (1 + (i.salesChangePct ?? 0) / 200 + newBranchUplift / 2));

  const metrics: ScenarioMetric[] = [
    metric("revenue", "Revenue", "money", b.revenue, revenue, "up"),
    metric("netProfit", "Profit", "money", b.netProfit, netProfit, "up"),
    metric("cashFlow", "Cash Flow", "money", b.liquid, cashFlow, "up"),
    metric("workingCapital", "Working Capital", "money", b.workingCapital, workingCapital, "up"),
    metric("expense", "Expenses", "money", b.expense, expense, "down"),
    metric("gst", "GST Liability", "money", b.gstDue, gstEffect, "down"),
    metric("inventory", "Inventory", "money", b.inventoryValue, inventory, "neutral"),
    metric("customers", "Customer Base", "count", b.activeCustomers, customers, "up"),
  ];

  const profitDelta = netProfit - b.netProfit;
  const summary = `This scenario ${profitDelta >= 0 ? "improves" : "reduces"} profit by ${inr(Math.abs(profitDelta))} (${pct(netProfit, b.netProfit)}%), with revenue ${inr(revenue)} and expenses ${inr(expense)}.`;

  return { inputs, metrics, summary, baseline: b };
}

function metric(key: string, label: string, unit: ScenarioMetric["unit"], baseline: number, scenario: number, good: "up" | "down" | "neutral"): ScenarioMetric {
  const delta = r2(scenario - baseline);
  const better = good === "neutral" ? true : good === "up" ? delta >= 0 : delta <= 0;
  return { key, label, unit, baseline: r2(baseline), scenario: r2(scenario), delta, deltaPct: pct(scenario, baseline), better };
}

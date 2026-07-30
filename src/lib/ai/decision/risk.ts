import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere } from "@/lib/auth/scope";
import { computeBaseline, type Baseline } from "./baseline";

/**
 * RISK INTELLIGENCE (Module 10) — automatically detect business risks across cash flow,
 * budget, inventory, compliance, fraud/duplicates, customer credit, supplier dependency,
 * operational, financial, tax and continuity. Each risk carries severity, probability,
 * business impact, explanation and a mitigation plan. Rules over the live baseline + a
 * couple of targeted queries (duplicates, supplier concentration).
 */

export type Severity = "Critical" | "High" | "Medium" | "Low";
export const SEV_RANK: Record<Severity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export interface RiskItem {
  key: string; category: string; module: string; severity: Severity; probability: number;
  impact: number; impactLabel: string; title: string; explanation: string; mitigation: string; href?: string;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function detectRisks(scope: ActiveScope, opts?: { period?: string; baseline?: Baseline }): Promise<RiskItem[]> {
  const b = opts?.baseline ?? (await computeBaseline(scope, opts));
  const out: RiskItem[] = [];
  const monthlyBurn = Math.max(1, b.expense);

  // Cash flow / continuity
  if (b.liquid < 0) out.push(risk("cashflow", "finance", "Critical", 90, Math.abs(b.liquid), "Negative cash & bank position", `Combined cash + bank is ${inr(b.liquid)}.`, "Accelerate collections, delay non-critical payments, arrange short-term funding.", "/finance/cash"));
  else if (b.liquid < monthlyBurn) out.push(risk("continuity", "finance", "High", 70, monthlyBurn - b.liquid, "Cash runway under one month", `Liquidity ${inr(b.liquid)} is below one month of expense (${inr(monthlyBurn)}).`, "Prioritise overdue receivables collection and stagger payables.", "/finance/cash"));

  // Financial
  if (b.netProfit < 0) out.push(risk("financial", "finance", "High", 80, Math.abs(b.netProfit), "Operating at a loss this period", `Net profit is ${inr(b.netProfit)} (${b.profitMargin}% margin).`, "Review top expense heads, cut low-margin lines, revisit pricing.", "/finance/reports"));

  // Budget
  if (b.budgetUtil >= 100) out.push(risk("budget", "budget", "High", 85, 0, "Budget exceeded", `Budget utilization is ${b.budgetUtil}%.`, "Freeze non-essential spend, raise a budget revision/transfer.", "/finance/budget"));
  else if (b.budgetUtil >= 90) out.push(risk("budget", "budget", "Medium", 70, 0, "Budget nearing exhaustion", `Budget utilization is ${b.budgetUtil}%.`, "Monitor committed spend; plan a transfer before overrun.", "/finance/budget"));

  // Inventory
  if (b.lowStock > 0) out.push(risk("inventory", "inventory", b.lowStock >= 10 ? "High" : "Medium", Math.min(90, 40 + b.lowStock * 4), 0, `${b.lowStock} item(s) at/below reorder level`, `${b.lowStock} product(s) risk stock-out.`, "Raise purchase orders for low-stock SKUs; consider stock transfer.", "/inventory/tracking"));

  // Compliance / tax
  if (b.gstDue > 0) out.push(risk("compliance", "statutory", b.gstDue > 100000 ? "High" : "Medium", 75, b.gstDue, "GST liability outstanding", `Net GST payable is ${inr(b.gstDue)}.`, "Reconcile ITC in GSTR-2B and pay before the due date to avoid interest.", "/finance/statutory-compliance"));

  // Customer credit
  if (b.sales > 0 && b.receivable > b.sales * 1.5) out.push(risk("customer-credit", "customer", "Medium", 65, b.receivable, "High customer credit exposure", `Receivable ${inr(b.receivable)} exceeds 1.5× monthly sales.`, "Tighten credit limits, intensify overdue follow-up, offer early-payment incentives.", "/finance/receivables"));

  // Operational
  if (b.orders === 0) out.push(risk("operational", "sales", "Medium", 60, 0, "No sales recorded this period", "Zero completed sale invoices in the current month.", "Verify POS/terminal operation and billing; check if the period just started.", "/sales/history"));

  // Supplier dependency (targeted query)
  try {
    const rows = await prisma.payable.groupBy({ by: ["supplier"], where: { ...(scopeWhere(scope, { branch: true }) as Prisma.PayableWhereInput), status: { in: ["Open", "Partial"] } }, _sum: { balanceAmount: true }, orderBy: { _sum: { balanceAmount: "desc" } }, take: 5 });
    const total = rows.reduce((s, r) => s + num(r._sum.balanceAmount), 0);
    const topVal = num(rows[0]?._sum.balanceAmount);
    if (total > 0 && topVal / total > 0.4) out.push(risk("supplier-dependency", "supplier", "Medium", 55, topVal, "High supplier concentration", `${rows[0]?.supplier ?? "One supplier"} holds ${Math.round((topVal / total) * 100)}% of open payables.`, "Diversify sourcing and negotiate backup suppliers to reduce dependency.", "/finance/payables"));
  } catch { /* skip if model shape differs */ }

  // Fraud / duplicate transactions (targeted query — same supplier + amount + date)
  try {
    const grp = await prisma.supplierPayment.groupBy({ by: ["supplier", "totalAmount", "paymentDate"], where: { ...(scopeWhere(scope, { branch: true }) as Prisma.SupplierPaymentWhereInput), status: "Completed" }, _count: { _all: true }, orderBy: { supplier: "asc" }, take: 500 });
    const dups = grp.filter((g: { _count: { _all: number } }) => g._count._all > 1);
    if (dups.length) out.push(risk("fraud", "finance", "High", 60, num(dups[0]?.totalAmount), `${dups.length} possible duplicate payment(s)`, "Multiple supplier payments share the same supplier, amount and date.", "Review flagged payments for duplication before the next payment run.", "/finance/payables"));
  } catch { /* skip if model shape differs */ }

  return out.sort((a, b2) => SEV_RANK[b2.severity] - SEV_RANK[a.severity] || b2.impact - a.impact);
}

function risk(category: string, module: string, severity: Severity, probability: number, impact: number, title: string, explanation: string, mitigation: string, href?: string): RiskItem {
  return { key: `risk:${category}`, category, module, severity, probability, impact, impactLabel: impact > 0 ? inr(impact) : "—", title, explanation, mitigation, href };
}

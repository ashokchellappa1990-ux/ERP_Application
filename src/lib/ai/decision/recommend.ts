import type { ActiveScope } from "@/lib/auth/scope";
import { computeBaseline, type Baseline } from "./baseline";
import { detectRisks, SEV_RANK, type RiskItem } from "./risk";
import { detectOpportunities, type OppItem } from "./opportunity";

/**
 * RECOMMENDATION CENTER (Module 13) — intelligent, prioritized recommendations. Each
 * carries a reason, business impact, estimated benefit, estimated risk, related reports
 * and a suggested next action (which can deep-link the Command Center to prepare a draft
 * — the AI never posts). Derived from the detected risks + opportunities + baseline.
 */

export interface Recommendation {
  key: string; module: string; title: string; reason: string; impact: string;
  estimatedBenefit: string; estimatedRisk: string; relatedReports: { label: string; href: string }[];
  nextAction?: { label: string; href: string }; priority: number;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export async function recommendations(scope: ActiveScope, opts?: { period?: string; baseline?: Baseline; risks?: RiskItem[]; opps?: OppItem[] }): Promise<Recommendation[]> {
  const b = opts?.baseline ?? (await computeBaseline(scope, opts));
  const [risks, opps] = await Promise.all([
    opts?.risks ? Promise.resolve(opts.risks) : detectRisks(scope, { baseline: b }),
    opts?.opps ? Promise.resolve(opts.opps) : detectOpportunities(scope, { baseline: b }),
  ]);
  const out: Recommendation[] = [];

  // From risks — mitigation recommendations (highest priority).
  for (const r of risks) {
    out.push({
      key: `rec:${r.key}`, module: r.module, title: mitigationTitle(r), reason: r.explanation, impact: r.mitigation,
      estimatedBenefit: r.impact > 0 ? `Avoids ${r.impactLabel} exposure` : "Reduces operational risk",
      estimatedRisk: `${r.severity} if ignored`, relatedReports: reportsFor(r.module),
      nextAction: actionFor(r), priority: 40 + SEV_RANK[r.severity] * 14 + Math.min(20, Math.round(r.probability / 5)),
    });
  }
  // From opportunities — capture recommendations.
  for (const o of opps.slice(0, 6)) {
    out.push({
      key: `rec:${o.key}`, module: o.module, title: o.title, reason: o.rationale, impact: `Potential upside ${o.benefitLabel}`,
      estimatedBenefit: o.benefitLabel, estimatedRisk: "Low — upside action", relatedReports: reportsFor(o.module),
      nextAction: o.href ? { label: "Open", href: o.href } : undefined, priority: 20 + Math.round(o.confidence / 4) + Math.min(20, Math.round(o.estimatedBenefit / 50000)),
    });
  }
  // A couple of always-on finance nudges.
  if (b.receivable > 0) out.push({ key: "rec:collect", module: "finance", title: "Collect overdue receivables", reason: `Outstanding receivable is ${inr(b.receivable)}.`, impact: "Improves cash flow and working capital.", estimatedBenefit: inr(b.receivable), estimatedRisk: "Low", relatedReports: reportsFor("finance"), nextAction: { label: "Open Receivables", href: "/finance/receivables" }, priority: 55 });

  return out.sort((a, b2) => b2.priority - a.priority).slice(0, 24);
}

const mitigationTitle = (r: RiskItem) => ({
  cashflow: "Stabilise cash position", continuity: "Extend cash runway", financial: "Restore profitability", budget: "Control budget overrun",
  inventory: "Replenish low stock", compliance: "Clear GST liability", "customer-credit": "Reduce credit exposure", operational: "Restore sales operations",
  "supplier-dependency": "Diversify suppliers", fraud: "Review duplicate payments", tax: "Clear tax dues",
}[r.category] ?? r.title);

function actionFor(r: RiskItem): Recommendation["nextAction"] {
  switch (r.category) {
    case "inventory": return { label: "Create Purchase Order", href: "/ai/command" };
    case "cashflow": case "continuity": case "customer-credit": return { label: "Open Receivables", href: "/finance/receivables" };
    case "budget": return { label: "Budget Transfer", href: "/finance/budget" };
    case "compliance": case "tax": return { label: "Statutory Payment", href: "/finance/statutory-compliance" };
    case "supplier-dependency": case "fraud": return { label: "Open Payables", href: "/finance/payables" };
    default: return r.href ? { label: "Open", href: r.href } : undefined;
  }
}

const REPORTS: Record<string, { label: string; href: string }[]> = {
  finance: [{ label: "P&L", href: "/finance/reports" }, { label: "Cash Flow", href: "/finance/reports" }],
  sales: [{ label: "Sales Analytics", href: "/sales/analytics" }],
  purchase: [{ label: "Purchase Register", href: "/purchase/invoice" }],
  inventory: [{ label: "Inventory Tracking", href: "/inventory/tracking" }],
  customer: [{ label: "Customer 360", href: "/crm/customer-360" }],
  supplier: [{ label: "Payables Aging", href: "/finance/payables" }],
  budget: [{ label: "Budget Dashboard", href: "/finance/budget" }],
  statutory: [{ label: "GST Compliance", href: "/finance/statutory-compliance" }],
};
const reportsFor = (module: string) => REPORTS[module] ?? [];

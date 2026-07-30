import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeWhere } from "@/lib/auth/scope";
import { computeBaseline, type Baseline } from "./baseline";

/**
 * OPPORTUNITY INTELLIGENCE (Module 11) — automatically identify revenue, cross/upsell,
 * inventory clearance, inactive-customer recovery, high-margin, supplier-negotiation,
 * marketing and expansion opportunities, each with an estimated benefit and confidence.
 */

export interface OppItem {
  key: string; type: string; module: string; title: string; rationale: string;
  estimatedBenefit: number; benefitLabel: string; confidence: number; href?: string;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function detectOpportunities(scope: ActiveScope, opts?: { period?: string; baseline?: Baseline }): Promise<OppItem[]> {
  const b = opts?.baseline ?? (await computeBaseline(scope, opts));
  const out: OppItem[] = [];

  // Upsell / cross-sell — lift the average bill.
  if (b.orders > 0) {
    const benefit = r2(b.orders * b.avgBill * 0.1);
    out.push(opp("upsell", "sales", "Increase average bill via cross-sell/upsell", `${b.orders} orders at ${inr(b.avgBill)} average — a 10% lift adds ${inr(benefit)}.`, benefit, 68, "/sales/analytics"));
  }

  // Inventory clearance — capital locked in slow stock.
  if (b.inventoryValue > 0 && b.sales > 0 && b.inventoryValue > b.sales * 2) {
    const benefit = r2(b.inventoryValue * 0.15);
    out.push(opp("clearance", "inventory", "Clear slow-moving inventory", `Stock value ${inr(b.inventoryValue)} is over 2× monthly sales — a clearance promotion frees ~${inr(benefit)} of working capital.`, benefit, 62, "/inventory/tracking"));
  }

  // Supplier negotiation — volume leverage.
  if (b.purchases > 0) {
    const benefit = r2(b.purchases * 0.02);
    out.push(opp("supplier-negotiation", "supplier", "Negotiate volume discounts", `Monthly purchases ${inr(b.purchases)} — a 2% negotiated rate saves ${inr(benefit)}.`, benefit, 55, "/masters/supplier"));
  }

  // Marketing — reverse a sales dip.
  if (b.salesMoMPct < -5) out.push(opp("marketing", "sales", "Launch a marketing campaign", `Sales are down ${b.salesMoMPct}% MoM — a targeted campaign can recover demand.`, r2(Math.abs(b.prevSales - b.sales)), 58, "/loyalty"));

  // Expansion — scale a profitable, growing business.
  if (b.profitMargin > 10 && b.salesMoMPct > 5) out.push(opp("expansion", "finance", "Explore expansion", `Healthy ${b.profitMargin}% margin with ${b.salesMoMPct}% growth — capacity or branch expansion is viable.`, r2(b.sales * 0.5), 50, "/stores"));

  // High-margin push.
  if (b.profitMargin > 0) out.push(opp("high-margin", "sales", "Promote high-margin products", `Prioritising high-margin lines lifts overall profitability above the current ${b.profitMargin}%.`, r2(b.revenue * 0.03), 52, "/sales/analytics"));

  // Inactive customer recovery (targeted query).
  try {
    const w = scopeWhere(scope, { branch: true }) as Prisma.SaleWhereInput;
    const ninety = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const recent = await prisma.sale.findMany({ where: { ...w, status: "Completed", saleDate: { gte: ninety }, customerId: { not: null } }, select: { customerId: true }, distinct: ["customerId"], take: 5000 });
    const activeIds = new Set(recent.map((r) => r.customerId));
    const dormant = Math.max(0, b.activeCustomers - activeIds.size);
    if (dormant > 0) { const benefit = r2(dormant * b.avgBill * 0.3); out.push(opp("inactive-recovery", "customer", "Re-engage inactive customers", `${dormant} customer(s) haven't purchased in 90 days — a win-back offer could recover ~${inr(benefit)}.`, benefit, 60, "/crm/customer-360")); }
  } catch { /* skip */ }

  return out.sort((a, b2) => b2.estimatedBenefit - a.estimatedBenefit);
}

function opp(type: string, module: string, title: string, rationale: string, estimatedBenefit: number, confidence: number, href?: string): OppItem {
  return { key: `opp:${type}`, type, module, title, rationale, estimatedBenefit, benefitLabel: estimatedBenefit > 0 ? inr(estimatedBenefit) : "—", confidence, href };
}

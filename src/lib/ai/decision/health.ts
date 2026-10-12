import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { computeBaseline, type Baseline } from "./baseline";

/**
 * BUSINESS HEALTH CENTER (Module 1) — one overall Business Health Score built from seven
 * domain sub-scores plus growth/profitability/cash-flow/working-capital scores and an AI
 * confidence score. Deterministic scoring over the live baseline. A daily snapshot is
 * persisted (ai_health_snapshots) so the score trend builds over time.
 */

export interface HealthSubScore { key: string; label: string; score: number; note: string }
export interface BusinessHealth {
  overall: number; band: "Excellent" | "Good" | "Average" | "Critical"; color: "green" | "blue" | "orange" | "red";
  aiConfidence: number;
  domains: HealthSubScore[];      // Financial, Sales, Inventory, Customer, Supplier, Compliance, Operational
  scores: HealthSubScore[];       // Growth, Profitability, Cash Flow, Working Capital
  trend: { name: string; value: number }[];
  baseline: Baseline;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const bandOf = (s: number): BusinessHealth["band"] => (s >= 80 ? "Excellent" : s >= 60 ? "Good" : s >= 40 ? "Average" : "Critical");
const colorOf = (s: number): BusinessHealth["color"] => (s >= 75 ? "green" : s >= 55 ? "blue" : s >= 40 ? "orange" : "red");
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export async function businessHealth(scope: ActiveScope, opts?: { period?: string }): Promise<BusinessHealth> {
  const b = await computeBaseline(scope, opts);

  // --- domain sub-scores (Module 1) ---
  const financial = clamp(50 + b.profitMargin * 2 + (b.liquid > 0 ? 15 : -20) + (b.workingCapital > 0 ? 10 : -15));
  const sales = clamp(55 + b.salesMoMPct * 1.2 + (b.orders > 0 ? 10 : -10));
  const inventory = clamp(80 - b.lowStock * 2 - (b.inventoryValue <= 0 ? 30 : 0));
  const customer = clamp(70 - (b.receivable > b.sales && b.sales > 0 ? 20 : 0) + (b.activeCustomers > 0 ? 10 : -10));
  const supplier = clamp(75 - (b.payable > b.purchases && b.purchases > 0 ? 15 : 0) + (b.activeSuppliers > 0 ? 5 : 0));
  const compliance = clamp(b.gstDue > 0 ? 65 : 90);
  const operational = clamp(60 + (b.orders > 0 ? 15 : -15) + (b.lowStock < 5 ? 10 : -10));

  // --- headline scores ---
  const growth = clamp(55 + b.salesMoMPct * 1.5 + b.profitMoMPct * 0.5);
  const profitability = clamp(45 + b.profitMargin * 3);
  const cashFlow = clamp(50 + (b.liquid > 0 ? 25 : -30) + (b.netProfit > 0 ? 15 : -15));
  const workingCapital = clamp(50 + (b.workingCapital > 0 ? 30 : -30) + (b.receivable < b.payable ? 10 : -5));

  const domains: HealthSubScore[] = [
    { key: "financial", label: "Financial Health", score: financial, note: `${b.profitMargin}% margin` },
    { key: "sales", label: "Sales Health", score: sales, note: `${b.salesMoMPct >= 0 ? "+" : ""}${b.salesMoMPct}% MoM` },
    { key: "inventory", label: "Inventory Health", score: inventory, note: `${b.lowStock} low-stock` },
    { key: "customer", label: "Customer Health", score: customer, note: inr(b.receivable) + " receivable" },
    { key: "supplier", label: "Supplier Health", score: supplier, note: inr(b.payable) + " payable" },
    { key: "compliance", label: "Compliance Health", score: compliance, note: b.gstDue > 0 ? inr(b.gstDue) + " GST due" : "No dues" },
    { key: "operational", label: "Operational Health", score: operational, note: `${b.orders} orders` },
  ];
  const scores: HealthSubScore[] = [
    { key: "growth", label: "Growth Score", score: growth, note: `${b.salesMoMPct >= 0 ? "+" : ""}${b.salesMoMPct}%` },
    { key: "profitability", label: "Profitability Score", score: profitability, note: `${b.profitMargin}%` },
    { key: "cashflow", label: "Cash Flow Score", score: cashFlow, note: inr(b.liquid) },
    { key: "workingCapital", label: "Working Capital Score", score: workingCapital, note: inr(b.workingCapital) },
  ];

  const overall = clamp(domains.reduce((s, d) => s + d.score, 0) / domains.length);
  const aiConfidence = clamp(70 + (b.sales > 0 ? 12 : -20) + (b.orders > 10 ? 10 : 0));

  // Persist a daily snapshot + read the trend. (findFirst+update/create rather than upsert
  // because the compound unique has nullable business/branch columns.)
  const snapDate = new Date().toISOString().slice(0, 10);
  const subScoresJson = JSON.stringify({ domains, scores });
  try {
    const existing = await prisma.aiHealthSnapshot.findFirst({ where: { tenantId: scope.tenantId, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null, snapDate }, select: { id: true } });
    if (existing) await prisma.aiHealthSnapshot.update({ where: { id: existing.id }, data: { overall, band: bandOf(overall), subScoresJson } });
    else await prisma.aiHealthSnapshot.create({ data: { tenantId: scope.tenantId, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null, snapDate, overall, band: bandOf(overall), subScoresJson } });
  } catch { /* snapshot is best-effort */ }
  const snaps = await prisma.aiHealthSnapshot.findMany({ where: { tenantId: scope.tenantId, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null }, orderBy: { snapDate: "asc" }, take: 30, select: { snapDate: true, overall: true } }).catch(() => []);
  const trend = snaps.map((s) => ({ name: s.snapDate.slice(5), value: s.overall }));
  if (!trend.length) trend.push({ name: snapDate.slice(5), value: overall });

  return { overall, band: bandOf(overall), color: colorOf(overall), aiConfidence, domains, scores, trend, baseline: b };
}

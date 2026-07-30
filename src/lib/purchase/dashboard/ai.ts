import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { forecastSeries, type ForecastPoint } from "@/lib/ai/decision/forecast";
import type { PurchaseFilters } from "./filters";
import { piWhere, periodRange } from "./filters";
import { executiveKpis, supplierPerformance, reorder, budgetMonitor } from "./service";

/**
 * PROCUREMENT AI — deterministic insights / risks / recommendations / forecast over the
 * live purchase data (reuses the Phase-5 forecasting primitive). Works fully offline.
 */

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthsBack = (period: string, n: number) => { const [y, m] = period.split("-").map(Number); const out: string[] = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`); } return out; };

// ---------------------------------------------------------------- INSIGHTS
export interface Insight { key: string; severity: "info" | "medium" | "high" | "critical"; title: string; detail: string; metric?: string; href?: string }

export async function purchaseInsights(scope: ActiveScope, f: PurchaseFilters): Promise<Insight[]> {
  const [kpis, suppliers, rd, budget] = await Promise.all([executiveKpis(scope, f), supplierPerformance(scope, f), reorder(scope, f), budgetMonitor(scope, f).catch(() => null)]);
  const kv = (k: string) => kpis.find((x) => x.key === k);
  const out: Insight[] = [];

  const val = kv("valMonth");
  if (val && val.prev > 0 && Math.abs(val.growthPct) >= 8) out.push({ key: "spend", severity: val.growthPct > 0 ? "medium" : "info", title: `Purchase spending ${val.growthPct > 0 ? "increased" : "decreased"} ${Math.abs(val.growthPct)}%`, detail: `${inr(val.value)} this period vs ${inr(val.prev)} last period.`, metric: `${val.growthPct >= 0 ? "+" : ""}${val.growthPct}%`, href: "/purchase?tab=trends" });

  const worst = suppliers.filter((s) => s.onTimePct != null).sort((a, b) => (a.onTimePct ?? 100) - (b.onTimePct ?? 100))[0];
  if (worst && (worst.onTimePct ?? 100) < 70) out.push({ key: "supplier-delay", severity: "high", title: `Supplier ${worst.name} delivery performance reduced`, detail: `On-time delivery ${worst.onTimePct}% with avg lead time ${worst.avgLeadDays ?? "?"} days.`, metric: `${worst.onTimePct}% on-time`, href: "/purchase?tab=suppliers" });

  if (rd.criticalCount + rd.outCount > 0) out.push({ key: "stockout", severity: rd.outCount > 0 ? "critical" : "high", title: `Inventory shortage — ${rd.outCount} out, ${rd.criticalCount} critical`, detail: `${rd.belowCount} item(s) at or below reorder level; raise POs to avoid stock-out.`, metric: `${rd.belowCount} low`, href: "/purchase?tab=delivery" });

  if (budget && budget.utilizationPct >= 85) out.push({ key: "budget", severity: budget.utilizationPct >= 100 ? "critical" : "high", title: `Budget utilization crossed ${budget.utilizationPct}%`, detail: `${inr(budget.consumed)} of ${inr(budget.allocated)} consumed (${budget.fy}).`, metric: `${budget.utilizationPct}%`, href: "/purchase?tab=budget" });

  const late = kv("late"); if (late && late.value > 0) out.push({ key: "late", severity: "high", title: `${late.value} late deliveries`, detail: "Open purchase orders are past their expected delivery date.", metric: `${late.value}`, href: "/purchase?tab=delivery" });

  const dep = suppliers[0]; const totalSpend = suppliers.reduce((s, x) => s + x.spend, 0);
  if (dep && totalSpend > 0 && dep.spend / totalSpend > 0.4) out.push({ key: "dependency", severity: "medium", title: `High dependency on ${dep.name}`, detail: `${Math.round((dep.spend / totalSpend) * 100)}% of spend is with a single supplier — diversify sourcing.`, metric: `${Math.round((dep.spend / totalSpend) * 100)}%`, href: "/purchase?tab=suppliers" });

  return out;
}

// ---------------------------------------------------------------- RISKS
export interface PRisk { key: string; category: string; severity: "Critical" | "High" | "Medium" | "Low"; title: string; explanation: string; mitigation: string; impact: number; impactLabel: string; href?: string }
const SEV: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export async function purchaseRisks(scope: ActiveScope, f: PurchaseFilters): Promise<PRisk[]> {
  const { from, to } = periodRange(f);
  const [kpis, suppliers, rd, budget, dupRows] = await Promise.all([
    executiveKpis(scope, f), supplierPerformance(scope, f), reorder(scope, f), budgetMonitor(scope, f).catch(() => null),
    prisma.purchaseInvoice.groupBy({ by: ["supplier", "netPayable", "supplierInvoiceDate"], where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: from, lte: to } }, _count: { _all: true }, orderBy: { supplier: "asc" }, take: 500 }).catch(() => []),
  ]);
  const kv = (k: string) => kpis.find((x) => x.key === k);
  const out: PRisk[] = [];
  const risk = (key: string, category: string, severity: PRisk["severity"], title: string, explanation: string, mitigation: string, impact = 0, href?: string): PRisk => ({ key, category, severity, title, explanation, mitigation, impact, impactLabel: impact > 0 ? inr(impact) : "—", href });

  const worst = suppliers.filter((s) => s.onTimePct != null).sort((a, b) => (a.onTimePct ?? 100) - (b.onTimePct ?? 100))[0];
  if (worst && (worst.onTimePct ?? 100) < 70) out.push(risk("supplier-delay", "Supplier Delay", (worst.onTimePct ?? 0) < 50 ? "High" : "Medium", `Delivery risk: ${worst.name}`, `On-time ${worst.onTimePct}%, lead ${worst.avgLeadDays ?? "?"}d.`, "Add a backup supplier; expedite open POs.", 0, "/purchase?tab=suppliers"));
  if (budget && budget.utilizationPct >= 90) out.push(risk("budget", "Budget Overrun", budget.utilizationPct >= 100 ? "High" : "Medium", "Purchase budget nearing/over limit", `${budget.utilizationPct}% of ${budget.fy} budget consumed.`, "Freeze non-critical POs; raise a budget revision.", 0, "/purchase?tab=budget"));
  const dups = (dupRows as { _count: { _all: number } }[]).filter((g) => g._count._all > 1);
  if (dups.length) out.push(risk("duplicate", "Duplicate Purchase", "High", `${dups.length} possible duplicate invoice(s)`, "Same supplier, amount and date appear more than once.", "Review flagged invoices before payment.", 0, "/purchase/invoice"));
  if (rd.outCount > 0 || rd.criticalCount >= 5) out.push(risk("stockout", "Stock-Out Risk", rd.outCount > 0 ? "Critical" : "High", `${rd.outCount} out-of-stock, ${rd.criticalCount} critical`, "Items at/below reorder with no incoming PO.", "Raise reorder POs for critical SKUs.", 0, "/purchase?tab=delivery"));
  const dep = suppliers[0]; const total = suppliers.reduce((s, x) => s + x.spend, 0);
  if (dep && total > 0 && dep.spend / total > 0.4) out.push(risk("dependency", "Single-Supplier Dependency", "Medium", `Concentration on ${dep.name}`, `${Math.round((dep.spend / total) * 100)}% of spend with one supplier.`, "Diversify sourcing; negotiate backup suppliers.", dep.spend, "/purchase?tab=suppliers"));
  const pend = kv("pendingAppr"); if (pend && pend.value > 0) out.push(risk("approvals", "Pending Approvals", "Low", `${pend.value} invoice(s) awaiting approval`, "Purchase invoices are pending approval.", "Clear the approval queue.", 0, "/purchase?tab=approvals"));
  const late = kv("late"); if (late && late.value > 3) out.push(risk("late", "Supplier Delay", "Medium", `${late.value} late deliveries`, "Multiple POs past expected delivery.", "Escalate with suppliers; update dates.", 0, "/purchase?tab=delivery"));

  return out.sort((a, b) => SEV[b.severity] - SEV[a.severity]);
}

// ---------------------------------------------------------------- RECOMMENDATIONS
export interface PRec { key: string; title: string; reason: string; expectedBenefit: string; riskLevel: "Low" | "Medium" | "High"; estimatedSavings: string; action: { label: string; href: string } }

export async function purchaseRecommendations(scope: ActiveScope, f: PurchaseFilters): Promise<PRec[]> {
  const [suppliers, rd, budget, kpis] = await Promise.all([supplierPerformance(scope, f), reorder(scope, f), budgetMonitor(scope, f).catch(() => null), executiveKpis(scope, f)]);
  const out: PRec[] = [];
  if (rd.belowCount > 0) out.push({ key: "create-po", title: "Create purchase orders for low stock", reason: `${rd.belowCount} item(s) at/below reorder level.`, expectedBenefit: "Avoid stock-out & lost sales", riskLevel: "Low", estimatedSavings: "—", action: { label: "New PO", href: "/purchase/order/new" } });
  const worst = suppliers.filter((s) => s.onTimePct != null).sort((a, b) => (a.onTimePct ?? 100) - (b.onTimePct ?? 100))[0];
  if (worst && (worst.onTimePct ?? 100) < 70) out.push({ key: "evaluate", title: `Launch supplier evaluation for ${worst.name}`, reason: `On-time ${worst.onTimePct}% is below target.`, expectedBenefit: "Improve delivery reliability", riskLevel: "Medium", estimatedSavings: "—", action: { label: "View supplier", href: "/purchase?tab=suppliers" } });
  const big = suppliers.sort((a, b) => b.spend - a.spend)[0];
  if (big && big.spend > 0) out.push({ key: "negotiate", title: `Negotiate price with ${big.name}`, reason: `Highest spend (${inr(big.spend)}) — leverage volume.`, expectedBenefit: "Lower unit cost", riskLevel: "Low", estimatedSavings: inr(r2(big.spend * 0.02)), action: { label: "View supplier", href: "/purchase?tab=suppliers" } });
  if (budget && budget.utilizationPct >= 90) out.push({ key: "budget-revision", title: "Raise a budget revision", reason: `Budget at ${budget.utilizationPct}% — upcoming POs may breach.`, expectedBenefit: "Maintain budget control", riskLevel: "Medium", estimatedSavings: "—", action: { label: "Budget", href: "/finance/budget" } });
  const openCommit = kpis.find((k) => k.key === "openCommit");
  if (openCommit && openCommit.value > 0) out.push({ key: "consolidate", title: "Consolidate open purchase orders", reason: `${inr(openCommit.value)} in open commitments across suppliers.`, expectedBenefit: "Better freight & pricing", riskLevel: "Low", estimatedSavings: inr(r2(openCommit.value * 0.01)), action: { label: "Open POs", href: "/purchase/order" } });
  if (rd.items.some((i) => i.warehouse)) out.push({ key: "transfer", title: "Transfer inventory between warehouses", reason: "Some warehouses may have excess while others are short.", expectedBenefit: "Reduce fresh purchases", riskLevel: "Low", estimatedSavings: "—", action: { label: "Inventory", href: "/inventory/tracking" } });
  return out;
}

// ---------------------------------------------------------------- FORECAST
export interface PForecast { metric: string; label: string; unit: string; current: number; forecast: number; confidence: number; trendPct: number; series: ForecastPoint[] }

async function monthlySeries(scope: ActiveScope, f: PurchaseFilters): Promise<{ name: string; value: number }[]> {
  const period = f.period || new Date().toISOString().slice(0, 7);
  const months = monthsBack(period, 12);
  const rows = await prisma.purchaseInvoice.findMany({ where: { ...piWhere(scope, f), status: { not: "Cancelled" }, supplierInvoiceDate: { gte: `${months[0]}-01` } }, select: { supplierInvoiceDate: true, netPayable: true } });
  const map = new Map<string, number>();
  for (const r of rows) { if (!r.supplierInvoiceDate) continue; const k = r.supplierInvoiceDate.slice(0, 7); map.set(k, (map.get(k) ?? 0) + num(r.netPayable)); }
  return months.map((k) => ({ name: MON[Number(k.split("-")[1]) - 1], value: r2(map.get(k) ?? 0) }));
}

export async function purchaseForecast(scope: ActiveScope, f: PurchaseFilters): Promise<PForecast[]> {
  const series = await monthlySeries(scope, f);
  const fc = forecastSeries(series, { horizon: 3, method: "auto" });
  const last = series[series.length - 1]?.value ?? 0;
  const forecasts: PForecast[] = [
    { metric: "purchaseValue", label: "Purchase Value", unit: "money", current: last, forecast: fc.nextValue, confidence: fc.confidence, trendPct: fc.trendPct, series: fc.all },
  ];
  // requirement = next-month purchase value; working-capital proxy = payables trend
  const reqNext = r2(fc.nextValue);
  forecasts.push({ metric: "requirement", label: "Purchase Requirement (next month)", unit: "money", current: last, forecast: reqNext, confidence: fc.confidence, trendPct: fc.trendPct, series: fc.all });
  return forecasts;
}

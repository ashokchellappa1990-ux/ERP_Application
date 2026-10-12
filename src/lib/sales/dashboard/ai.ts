import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { forecastSeries, type ForecastPoint } from "@/lib/ai/decision/forecast";
import type { SalesFilters } from "./filters";
import { saleWhere } from "./filters";
import { executiveKpis, topBranches, mix, returnAnalysis, customerAnalytics } from "./service";

/**
 * SALES AI — deterministic insights / risks / recommendations / forecast over the live sales
 * data (reuses the Phase-5 forecasting primitive). Works fully offline; every statement is
 * derived from the numbers the service already computes.
 */

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthsBack = (period: string, n: number) => { const [y, m] = period.split("-").map(Number); const out: string[] = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`); } return out; };

// ---------------------------------------------------------------- INSIGHTS
export interface Insight { key: string; severity: "info" | "medium" | "high" | "critical"; title: string; detail: string; metric?: string; href?: string }

export async function salesInsights(scope: ActiveScope, f: SalesFilters): Promise<Insight[]> {
  const [kpis, branches, mx, ra, ca] = await Promise.all([executiveKpis(scope, f), topBranches(scope, f), mix(scope, f), returnAnalysis(scope, f), customerAnalytics(scope, f)]);
  const kv = (k: string) => kpis.find((x) => x.key === k);
  const out: Insight[] = [];

  const sm = kv("salesMonth");
  if (sm && sm.prev > 0 && Math.abs(sm.growthPct) >= 5) out.push({ key: "sales", severity: sm.growthPct > 0 ? "medium" : "high", title: `Sales ${sm.growthPct > 0 ? "increased" : "decreased"} ${Math.abs(sm.growthPct)}% vs last month`, detail: `${inr(sm.value)} this month vs ${inr(sm.prev)} last month.`, metric: `${sm.growthPct >= 0 ? "+" : ""}${sm.growthPct}%`, href: "/sales?tab=trends" });

  const catTotal = mx.byCategory.reduce((s, x) => s + x.value, 0);
  const topCat = mx.byCategory[0];
  if (topCat && catTotal > 0) out.push({ key: "category", severity: "info", title: `Category ${topCat.name} contributed ${Math.round((topCat.value / catTotal) * 100)}% of revenue`, detail: `${inr(topCat.value)} of ${inr(catTotal)} from the top category.`, metric: `${Math.round((topCat.value / catTotal) * 100)}%`, href: "/sales?tab=analytics" });

  const topB = branches.branches[0];
  if (topB) out.push({ key: "branch", severity: "info", title: `Branch ${topB.name} leads with ${inr(topB.value)}`, detail: topB.growthPct !== 0 ? `${topB.growthPct >= 0 ? "Up" : "Down"} ${Math.abs(topB.growthPct)}% vs last month across ${topB.orders} invoice(s).` : `${topB.orders} invoice(s) this month.`, metric: `${topB.growthPct >= 0 ? "+" : ""}${topB.growthPct}%`, href: "/sales?tab=analytics" });

  if (ra.returnPct >= 3) out.push({ key: "returns", severity: ra.returnPct >= 6 ? "high" : "medium", title: `Sales returns at ${ra.returnPct}% of sales`, detail: `${inr(ra.returnValue)} returned this period${ra.topReturned[0] ? ` — top: ${ra.topReturned[0].name}` : ""}.`, metric: `${ra.returnPct}%`, href: "/sales?tab=trends" });

  const margin = kv("marginPct");
  if (margin && margin.value < 10) out.push({ key: "margin", severity: "high", title: `Gross margin is low at ${margin.value}%`, detail: "Discounts or cost of goods are eroding profitability.", metric: `${margin.value}%`, href: "/sales?tab=overview" });

  if (ca.totals.newCustomers > 0) out.push({ key: "customers", severity: "info", title: `${ca.totals.newCustomers} new customer(s) acquired`, detail: `${ca.totals.repeatPct}% of buyers are repeat customers.`, metric: `+${ca.totals.newCustomers}`, href: "/sales?tab=customer" });

  return out;
}

// ---------------------------------------------------------------- RISKS
export interface SRisk { key: string; category: string; severity: "Critical" | "High" | "Medium" | "Low"; title: string; explanation: string; mitigation: string; impact: number; impactLabel: string; href?: string }
const SEV: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export async function salesRisks(scope: ActiveScope, f: SalesFilters): Promise<SRisk[]> {
  const [kpis, branches, ra, ca] = await Promise.all([executiveKpis(scope, f), topBranches(scope, f), returnAnalysis(scope, f), customerAnalytics(scope, f)]);
  const kv = (k: string) => kpis.find((x) => x.key === k);
  const out: SRisk[] = [];
  const risk = (key: string, category: string, severity: SRisk["severity"], title: string, explanation: string, mitigation: string, impact = 0, href?: string): SRisk => ({ key, category, severity, title, explanation, mitigation, impact, impactLabel: impact > 0 ? inr(impact) : "—", href });

  const sm = kv("salesMonth");
  if (sm && sm.prev > 0 && sm.growthPct <= -10) out.push(risk("decline", "Sales Decline", sm.growthPct <= -25 ? "High" : "Medium", `Sales down ${Math.abs(sm.growthPct)}% month-on-month`, `${inr(sm.value)} vs ${inr(sm.prev)} last month.`, "Review pricing, promotions and under-performing branches.", Math.max(0, sm.prev - sm.value), "/sales?tab=trends"));
  if (ra.returnPct >= 6) out.push(risk("returns", "High Returns", ra.returnPct >= 10 ? "High" : "Medium", `Return rate ${ra.returnPct}%`, `${inr(ra.returnValue)} returned this period.`, "Investigate quality / fitment of top returned items.", ra.returnValue, "/sales?tab=trends"));
  const margin = kv("marginPct");
  if (margin && margin.value < 8) out.push(risk("margin", "Margin Erosion", margin.value < 4 ? "High" : "Medium", `Gross margin only ${margin.value}%`, "Heavy discounting or rising COGS.", "Tighten discount policy; renegotiate purchase cost.", 0, "/sales?tab=overview"));
  const lowB = branches.branches[branches.branches.length - 1];
  if (branches.branches.length > 2 && lowB && lowB.value > 0) out.push(risk("branch", "Underperforming Branch", "Low", `${lowB.name} is the lowest branch`, `Only ${inr(lowB.value)} this month.`, "Coach the branch team; check footfall & stock.", 0, "/sales?tab=analytics"));
  const cancel = kv("cancelled");
  if (cancel && cancel.value > 3) out.push(risk("cancel", "Cancellations", "Medium", `${cancel.value} invoices cancelled`, "Multiple sales voided this period.", "Review cancellation reasons for process gaps.", 0, "/sales/cancellation"));
  if (ca.totals.repeatPct < 20 && ca.totals.totalCustomers > 10) out.push(risk("retention", "Low Retention", "Medium", `Repeat-customer rate ${ca.totals.repeatPct}%`, "Most customers are one-time buyers.", "Launch loyalty / re-engagement campaigns.", 0, "/sales?tab=customer"));

  return out.sort((a, b) => SEV[b.severity] - SEV[a.severity]);
}

// ---------------------------------------------------------------- RECOMMENDATIONS
export interface SRec { key: string; title: string; reason: string; expectedBenefit: string; riskLevel: "Low" | "Medium" | "High"; estimatedImpact: string; action: { label: string; href: string } }

export async function salesRecommendations(scope: ActiveScope, f: SalesFilters): Promise<SRec[]> {
  const [kpis, mx, pp, ca] = await Promise.all([executiveKpis(scope, f), mix(scope, f), import("./service").then((s) => s.productPerformance(scope, f)), customerAnalytics(scope, f)]);
  const kv = (k: string) => kpis.find((x) => x.key === k);
  const out: SRec[] = [];

  const topProfit = pp.topProfit[0];
  if (topProfit) out.push({ key: "promote", title: `Promote high-margin product ${topProfit.name}`, reason: `It drives the most gross profit (${inr(topProfit.value)}).`, expectedBenefit: "Grow profit, not just revenue", riskLevel: "Low", estimatedImpact: inr(r2(topProfit.value * 0.15)), action: { label: "New promo", href: "/rewards/promo" } });
  if (pp.nonMovingCount > 0) out.push({ key: "clear-stock", title: `Clear ${pp.nonMovingCount} non-moving product(s)`, reason: "Active SKUs recorded no sales this period.", expectedBenefit: "Free up working capital", riskLevel: "Low", estimatedImpact: "—", action: { label: "Slow movers", href: "/sales?tab=trends" } });
  const slow = pp.slow[0];
  if (slow) out.push({ key: "bundle", title: `Bundle slow mover ${slow.name}`, reason: "Low quantity sold — pair with a fast seller.", expectedBenefit: "Lift slow-moving stock", riskLevel: "Low", estimatedImpact: "—", action: { label: "Discounts", href: "/masters/discount" } });
  const margin = kv("marginPct");
  if (margin && margin.value < 12) out.push({ key: "discount", title: "Tighten discount policy", reason: `Average discount ${kv("avgDiscount")?.value ?? 0}% is compressing margin to ${margin.value}%.`, expectedBenefit: "Recover margin", riskLevel: "Medium", estimatedImpact: "—", action: { label: "Discount rules", href: "/masters/discount" } });
  if (ca.totals.repeatPct < 30) out.push({ key: "loyalty", title: "Drive repeat purchases", reason: `Only ${ca.totals.repeatPct}% of buyers return.`, expectedBenefit: "Higher lifetime value", riskLevel: "Low", estimatedImpact: "—", action: { label: "Loyalty program", href: "/loyalty/program" } });
  const topCat = mx.byCategory[0];
  if (topCat) out.push({ key: "stock", title: `Deepen stock in ${topCat.name}`, reason: "It is the top-selling category — avoid stock-outs.", expectedBenefit: "Capture demand", riskLevel: "Low", estimatedImpact: "—", action: { label: "Reorder", href: "/inventory/reorder" } });

  return out;
}

// ---------------------------------------------------------------- FORECAST
export interface SForecast { metric: string; label: string; unit: string; current: number; forecast: number; confidence: number; trendPct: number; series: ForecastPoint[] }

async function monthlySeries(scope: ActiveScope, f: SalesFilters): Promise<{ name: string; value: number }[]> {
  const period = f.period || new Date().toISOString().slice(0, 7);
  const months = monthsBack(period, 12);
  const rows = await prisma.sale.findMany({ where: { ...saleWhere(scope, f), status: "Completed", saleDate: { gte: `${months[0]}-01` } }, select: { saleDate: true, total: true } });
  const map = new Map<string, number>();
  for (const r of rows) { const k = r.saleDate.slice(0, 7); map.set(k, (map.get(k) ?? 0) + num(r.total)); }
  return months.map((k) => ({ name: MON[Number(k.split("-")[1]) - 1], value: r2(map.get(k) ?? 0) }));
}

export async function salesForecast(scope: ActiveScope, f: SalesFilters): Promise<SForecast[]> {
  const series = await monthlySeries(scope, f);
  const fc = forecastSeries(series, { horizon: 3, method: "auto" });
  const last = series[series.length - 1]?.value ?? 0;
  return [
    { metric: "sales", label: "Month-end Sales (forecast)", unit: "money", current: last, forecast: r2(fc.nextValue), confidence: fc.confidence, trendPct: fc.trendPct, series: fc.all },
  ];
}

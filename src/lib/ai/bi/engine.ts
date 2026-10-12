import type { ActiveScope } from "@/lib/auth/scope";
import { METRICS, seriesFor, fmtUnit, type Metric } from "./metrics";
import { monthRange, recentMonths, prevYm, currentYm, monthLabel, type Range } from "./period";

/** BI ENGINE — generic analytics over the metric catalog: compare, trend, explain,
 *  summarize, recommend, detect anomalies, and produce chart specs. */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface ChartSpec { type: "bar" | "line" | "donut" | "dualbar"; title: string; unit: "money" | "count" | "percent"; items?: { name: string; value: number }[]; series?: { name: string; a: number; b: number }[]; aLabel?: string; bLabel?: string }
export interface BiComparison { metric: string; aLabel: string; a: number; bLabel: string; b: number; delta: number; pct: number; direction: "up" | "down" | "flat"; better: boolean; unit: Metric["unit"] }
export interface BiKpi { key: string; label: string; value: number; unit: Metric["unit"]; definition: string; formula: string; interpretation: string; status: "good" | "watch" | "bad"; improve: string[]; drilldown: string }
export interface BiAnswer { text: string; facts: string; entity: string; chart?: ChartSpec; comparison?: BiComparison; drilldown?: { label: string; href: string }; kpi?: BiKpi }

const dir = (delta: number): "up" | "down" | "flat" => (Math.abs(delta) < 0.01 ? "flat" : delta > 0 ? "up" : "down");

// ------------------------------------------------------------------- compare
export async function compareMetric(scope: ActiveScope, metric: Metric, a: Range, b: Range): Promise<BiComparison> {
  const [va, vb] = await Promise.all([metric.compute(scope, a), metric.compute(scope, b)]);
  const delta = r2(va - vb);
  const pct = vb !== 0 ? Math.round((delta / Math.abs(vb)) * 100) : va !== 0 ? 100 : 0;
  const d = dir(delta);
  const better = metric.goodDirection === "neutral" ? d !== "down" : (metric.goodDirection === "up" ? d === "up" : d === "down");
  return { metric: metric.key, aLabel: a.label, a: r2(va), bLabel: b.label, b: r2(vb), delta, pct, direction: d, better, unit: metric.unit };
}

// --------------------------------------------------------------------- trend
export async function trendMetric(scope: ActiveScope, metric: Metric, months = 6, period = currentYm()) {
  const ms = recentMonths(period, months);
  const series = await seriesFor(metric, scope, ms);
  const first = series[0]?.value ?? 0, last = series[series.length - 1]?.value ?? 0;
  const delta = r2(last - first);
  const pct = first !== 0 ? Math.round((delta / Math.abs(first)) * 100) : 0;
  const d = dir(delta);
  const chart: ChartSpec = { type: "line", title: `${metric.label} — last ${months} months`, unit: metric.unit, items: series };
  return { series, direction: d, pctChange: pct, first, last, chart };
}

// ------------------------------------------------------------------- explain
export async function explainKpi(scope: ActiveScope, metric: Metric, range: Range): Promise<BiKpi> {
  const value = r2(await metric.compute(scope, range));
  // Judge status by momentum vs the previous period.
  const prev = metric.asOf ? range : monthRange(prevYm(currentYm()));
  const prevVal = metric.asOf ? value : r2(await metric.compute(scope, prev));
  const movingUp = value >= prevVal;
  const favourable = metric.goodDirection === "neutral" ? true : (metric.goodDirection === "up" ? movingUp : !movingUp);
  let status: BiKpi["status"] = favourable ? "good" : "watch";
  // hard flags
  if (metric.key === "netProfit" && value < 0) status = "bad";
  if (metric.key === "budgetUtil" && value > 100) status = "bad";
  if ((metric.key === "cash" || metric.key === "bank") && value <= 0) status = "bad";
  const interpretation = metric.goodDirection === "neutral"
    ? "This is a volume metric — read it alongside related figures."
    : `Higher is ${metric.goodDirection === "up" ? "better" : "worse"} for this KPI. It is currently ${status === "good" ? "healthy" : status === "bad" ? "a concern" : "worth watching"}.`;
  return { key: metric.key, label: metric.label, value, unit: metric.unit, definition: metric.definition, formula: metric.formula, interpretation, status, improve: metric.improve, drilldown: metric.drilldown };
}

// ------------------------------------------------------------------ summary
export async function dashboardSummary(scope: ActiveScope, range: Range) {
  const keys = ["sales", "revenue", "expense", "netProfit", "cash", "receivable", "payable", "gstDue"];
  const metrics = keys.map((k) => METRICS.find((m) => m.key === k)!).filter(Boolean);
  const vals = await Promise.all(metrics.map((m) => m.compute(scope, range)));
  const kpi = metrics.map((m, i) => ({ label: m.label, value: r2(vals[i]), unit: m.unit }));
  const get = (k: string) => r2(vals[metrics.findIndex((m) => m.key === k)] ?? 0);
  const sales = get("sales"), revenue = get("revenue"), expense = get("expense"), net = get("netProfit"), cash = get("cash"), recv = get("receivable"), gst = get("gstDue");

  // MoM revenue vs expense chart
  const ms = recentMonths(currentYm(), 6);
  const revM = METRICS.find((m) => m.key === "revenue")!, expM = METRICS.find((m) => m.key === "expense")!;
  const [revSeries, expSeries] = await Promise.all([seriesFor(revM, scope, ms), seriesFor(expM, scope, ms)]);
  const chart: ChartSpec = { type: "dualbar", title: "Revenue vs Expense (6 months)", unit: "money", aLabel: "Revenue", bLabel: "Expense", series: ms.map((_, i) => ({ name: revSeries[i].name, a: revSeries[i].value, b: expSeries[i].value })) };

  const bullets: string[] = [];
  bullets.push(`Sales ${range.label}: ${fmtUnit("money", sales)}.`);
  bullets.push(`${net >= 0 ? "Net profit" : "Net loss"} of ${fmtUnit("money", Math.abs(net))} (revenue ${fmtUnit("money", revenue)}, expense ${fmtUnit("money", expense)}).`);
  bullets.push(`Liquidity: cash ${fmtUnit("money", cash)}; receivables ${fmtUnit("money", recv)} to collect.`);
  if (gst > 0.5) bullets.push(`GST payable this month: ${fmtUnit("money", gst)}.`);
  const text = `**Executive summary — ${range.label}**\n` + bullets.map((b) => `• ${b}`).join("\n");
  return { text, kpi, chart };
}

// -------------------------------------------------------------- recommend
export async function recommendActions(scope: ActiveScope, range: Range) {
  const recs: { title: string; reason: string; action: string; href: string; priority: number }[] = [];
  const val = async (k: string) => r2(await METRICS.find((m) => m.key === k)!.compute(scope, range));
  const [net, cash, bank, recv, budgetUtil, gst] = await Promise.all([val("netProfit"), val("cash"), val("bank"), val("receivable"), val("budgetUtil"), val("gstDue")]);
  if (recv > 0) recs.push({ title: "Chase overdue receivables", reason: `${fmtUnit("money", recv)} is outstanding from customers.`, action: "Prioritise 60+ day dues and send reminders.", href: "/finance/receivables", priority: 85 });
  if (gst > 0.5) recs.push({ title: "Clear GST liability", reason: `GST payable ${fmtUnit("money", gst)} is due.`, action: "Create a GST government payment before the due date.", href: "/finance/statutory-compliance", priority: 88 });
  if (budgetUtil >= 90) recs.push({ title: budgetUtil > 100 ? "Budget exceeded" : "Budget nearing limit", reason: `Budget utilisation is at ${budgetUtil}%.`, action: "Reallocate unused budget or pause discretionary spend.", href: "/finance/budget", priority: budgetUtil > 100 ? 92 : 80 });
  if (cash + bank < 25000) recs.push({ title: "Improve cash position", reason: `Liquid funds are low (${fmtUnit("money", cash + bank)}).`, action: "Accelerate collections and defer non-critical payments.", href: "/finance/cash", priority: 90 });
  if (net < 0) recs.push({ title: "Reverse the loss", reason: `The period shows a net loss of ${fmtUnit("money", Math.abs(net))}.`, action: "Review top expense heads and low-margin sales.", href: "/finance/reports", priority: 95 });
  if (!recs.length) recs.push({ title: "Maintain course", reason: "Key metrics are within healthy ranges.", action: "Keep monitoring receivables and budget.", href: "/finance", priority: 20 });
  return recs.sort((a, b) => b.priority - a.priority);
}

// -------------------------------------------------------------- anomalies
export async function detectAnomalies(scope: ActiveScope, period = currentYm()) {
  const watch = ["sales", "revenue", "expense", "netProfit", "receivable", "gstDue"];
  const ms = recentMonths(period, 4);
  const out: { metric: string; label: string; message: string; pct: number }[] = [];
  for (const k of watch) {
    const m = METRICS.find((x) => x.key === k)!;
    const series = await seriesFor(m, scope, ms);
    const last = series[series.length - 1]?.value ?? 0;
    const base = series.slice(0, -1).reduce((s, x) => s + x.value, 0) / Math.max(1, series.length - 1);
    if (base <= 0) continue;
    const pct = Math.round(((last - base) / Math.abs(base)) * 100);
    if (Math.abs(pct) >= 25) out.push({ metric: k, label: m.label, message: `${m.label} ${pct > 0 ? "jumped" : "dropped"} ${Math.abs(pct)}% vs the recent average (${fmtUnit(m.unit, last)}).`, pct });
  }
  return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

export { monthLabel };

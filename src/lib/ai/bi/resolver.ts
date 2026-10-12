import type { ActiveScope } from "@/lib/auth/scope";
import { parsePeriod } from "./period";
import { METRICS, findMetric, fmtUnit } from "./metrics";
import { compareMetric, trendMetric, explainKpi, dashboardSummary, recommendActions, detectAnomalies, type BiAnswer, type ChartSpec } from "./engine";

/**
 * BI RESOLVER — the Phase-2 intent router. Detects whether the user wants to
 * explain / compare / trend / chart / summarize / recommend / find-anomalies, picks
 * the metric from the catalog, and returns a rich BiAnswer (text + optional chart,
 * comparison, drill-down, KPI card). Falls through to a plain figure otherwise.
 */

const emoji = (better: boolean, flat: boolean) => (flat ? "➖" : better ? "👍" : "⚠️");

export async function resolveBi(scope: ActiveScope, message: string): Promise<BiAnswer | null> {
  const q = message.toLowerCase();
  try {
    // ---- EXECUTIVE SUMMARY
    if (/\bsummar|\boverview\b|how('?s| is| are)\s+(the\s+|my\s+|our\s+)?business|executive summary|briefing|snapshot/.test(q)) {
      const range = parsePeriod(q);
      const s = await dashboardSummary(scope, range);
      return { text: s.text, facts: s.kpi.map((k) => `${k.label}=${fmtUnit(k.unit, k.value)}`).join(", "), entity: "BI.summary", chart: s.chart, drilldown: { label: "Open Finance Dashboard", href: "/finance" } };
    }

    // ---- RECOMMENDATIONS
    if (/\brecommend|\bsuggest|\badvice\b|\badvise\b|what should i|how (can|do) i improve|action(s)?\b/.test(q)) {
      const recs = await recommendActions(scope, parsePeriod(q));
      const text = "**Recommended actions:**\n" + recs.slice(0, 5).map((r) => `• **${r.title}** — ${r.reason} _${r.action}_`).join("\n");
      return { text, facts: recs.slice(0, 3).map((r) => r.title).join("; "), entity: "BI.recommend", drilldown: { label: recs[0]?.title ?? "Open Finance", href: recs[0]?.href ?? "/finance" } };
    }

    // ---- ANOMALIES
    if (/\banomal|\bunusual\b|\bred flag\b|\bspike\b|\bproblem\b|\bissues?\b|anything wrong/.test(q)) {
      const a = await detectAnomalies(scope);
      const text = a.length ? "**Anomalies detected:**\n" + a.map((x) => `• ${x.message}`).join("\n") : "No significant anomalies detected in the recent months — your key metrics are moving within normal ranges.";
      return { text, facts: a.map((x) => `${x.label} ${x.pct}%`).join(", ") || "none", entity: "BI.anomaly", drilldown: { label: "Open Dashboard", href: "/finance" } };
    }

    // ---- EXPLAIN a KPI
    if (/\bexplain\b|what (is|does|are|do)\b|\bmeaning of\b|\bdefine\b|how (is|do you|to)\b.*(calculat|comput|work)|what'?s\b/.test(q)) {
      const metric = findMetric(q) ?? METRICS.find((m) => m.key === "netProfit")!;
      const kpi = await explainKpi(scope, metric, parsePeriod(q));
      const statusWord = kpi.status === "good" ? "healthy ✅" : kpi.status === "bad" ? "a concern ❗" : "worth watching ⚠️";
      const text = `**${kpi.label}** — currently **${fmtUnit(kpi.unit, kpi.value)}** (${statusWord}).\n\n_What it is:_ ${kpi.definition}\n_How it's calculated:_ ${kpi.formula}.\n_Read it:_ ${kpi.interpretation}\n\n**To improve:** ${kpi.improve.map((i) => `\n• ${i}`).join("")}`;
      return { text, facts: `${kpi.label}=${fmtUnit(kpi.unit, kpi.value)} (${kpi.status})`, entity: `KPI.${kpi.key}`, kpi, drilldown: { label: `Open ${kpi.label}`, href: kpi.drilldown } };
    }

    // ---- COMPARE two periods
    if (/\bcompare\b|\bversus\b|\s+vs\.?\s+|\bcompared to\b|\bagainst\b|\bdifference\b/.test(q)) {
      const metric = findMetric(q) ?? METRICS.find((m) => m.key === "sales")!;
      // Pick the two periods from the phrasing.
      let a = parsePeriod("this month"), b = parsePeriod("last month");
      if (/last week|this week/.test(q)) { a = parsePeriod("this week"); b = parsePeriod("last week"); }
      else if (/last year|this year/.test(q)) { a = parsePeriod("this year"); b = parsePeriod("last year"); }
      const c = await compareMetric(scope, metric, a, b);
      const arrow = c.direction === "flat" ? "unchanged" : `${c.direction === "up" ? "up" : "down"} ${Math.abs(c.pct)}%`;
      const text = `**${metric.label}: ${c.aLabel} vs ${c.bLabel}** ${emoji(c.better, c.direction === "flat")}\n${c.aLabel}: **${fmtUnit(c.unit, c.a)}** · ${c.bLabel}: **${fmtUnit(c.unit, c.b)}** — ${arrow} (${c.delta >= 0 ? "+" : "−"}${fmtUnit(c.unit, Math.abs(c.delta))}). ${c.better ? "That's a favourable move." : c.direction === "flat" ? "" : "Worth a closer look."}`;
      const chart: ChartSpec = { type: "bar", title: `${metric.label}: ${c.aLabel} vs ${c.bLabel}`, unit: metric.unit, items: [{ name: c.aLabel, value: c.a }, { name: c.bLabel, value: c.b }] };
      return { text, facts: `${metric.label}: ${c.aLabel}=${fmtUnit(c.unit, c.a)}, ${c.bLabel}=${fmtUnit(c.unit, c.b)}, ${arrow}`, entity: `Compare.${metric.key}`, comparison: c, chart, drilldown: { label: `Open ${metric.label}`, href: metric.drilldown } };
    }

    // ---- TREND / CHART over time
    if (/\btrend\b|\bover time\b|\bhistory\b|\blast \d+ months?\b|\bgrowth\b|\bmovement\b|\bchart\b|\bgraph\b|\bplot\b|\bvisuali[sz]e\b|\btrajectory\b/.test(q)) {
      const metric = findMetric(q) ?? METRICS.find((m) => m.key === "sales")!;
      const monthsMatch = q.match(/last (\d+) months?/); const months = monthsMatch ? Math.min(12, Math.max(3, Number(monthsMatch[1]))) : 6;
      const t = await trendMetric(scope, metric, months);
      const word = t.direction === "flat" ? "broadly flat" : `${t.direction === "up" ? "up" : "down"} ${Math.abs(t.pctChange)}%`;
      const text = `**${metric.label} — last ${months} months** ${emoji(metric.goodDirection === "neutral" ? true : (t.direction === "up") === (metric.goodDirection === "up"), t.direction === "flat")}\nFrom ${fmtUnit(metric.unit, t.first)} to **${fmtUnit(metric.unit, t.last)}** — ${word} over the period.`;
      return { text, facts: `${metric.label} trend: ${word}, latest ${fmtUnit(metric.unit, t.last)}`, entity: `Trend.${metric.key}`, chart: t.chart, drilldown: { label: `Open ${metric.label}`, href: metric.drilldown } };
    }

    // ---- PLAIN VALUE (single metric for the parsed period)
    const metric = findMetric(q);
    if (metric) {
      const range = parsePeriod(q);
      const v = await metric.compute(scope, range);
      const periodPhrase = metric.asOf ? "" : ` ${range.label} (${range.from}${range.from !== range.to ? ` to ${range.to}` : ""})`;
      const text = `${metric.label}${periodPhrase}: **${fmtUnit(metric.unit, v)}**.`;
      return { text, facts: `${metric.label}=${fmtUnit(metric.unit, v)}`, entity: metric.key, drilldown: { label: `Open ${metric.label}`, href: metric.drilldown } };
    }

    return null;
  } catch {
    return null;
  }
}

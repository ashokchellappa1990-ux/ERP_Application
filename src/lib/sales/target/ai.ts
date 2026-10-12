import type { ActiveScope } from "@/lib/auth/scope";
import { performanceAnalysis, computeAchievement, getConfig } from "./engine";
import { prisma } from "@/lib/db/prisma";
import { targetTypeDef } from "@/lib/contracts/salesTarget";

/**
 * Sales Target AI — deterministic insights answering the spec's questions (which dimensions are
 * behind/ahead, predicted month-end, revision suggestions, top/under performers, variance
 * explanation, suggested next-year target). Works fully offline from the achievement engine.
 */
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface TargetInsight { key: string; severity: "info" | "medium" | "high" | "critical"; title: string; detail: string; metric?: string; href?: string }

export async function targetInsights(scope: ActiveScope, fy: string): Promise<TargetInsight[]> {
  const cfg = await getConfig(scope);
  const { rows } = await performanceAnalysis(scope, fy);
  const out: TargetInsight[] = [];
  if (!rows.length) { out.push({ key: "none", severity: "info", title: "No approved targets for this FY", detail: "Create and approve targets to unlock achievement tracking & AI insights.", href: "/sales/target" }); return out; }

  const behind = rows.filter((r) => r.achievementPct < cfg.trafficLight.yellow).sort((a, b) => a.achievementPct - b.achievementPct);
  const ahead = rows.filter((r) => r.achievementPct >= 100).sort((a, b) => b.achievementPct - a.achievementPct);

  if (behind.length) out.push({ key: "behind", severity: behind[0].achievementPct < cfg.trafficLight.orange ? "critical" : "high", title: `${behind.length} target${behind.length > 1 ? "s are" : " is"} behind`, detail: `Lowest: ${behind[0].subjectLabel} at ${behind[0].achievementPct}% (${inr(behind[0].actual)} of ${inr(behind[0].target)}).`, metric: `${behind[0].achievementPct}%`, href: "/sales/target/achievement" });
  if (ahead.length) out.push({ key: "ahead", severity: "info", title: `${ahead.length} target${ahead.length > 1 ? "s" : ""} exceeded`, detail: `Top: ${ahead[0].subjectLabel} at ${ahead[0].achievementPct}%.`, metric: `${ahead[0].achievementPct}%`, href: "/sales/target/performance" });

  // predict + suggest revision on the most at-risk approved target
  const atRisk = await prisma.salesTarget.findFirst({ where: { tenantId: scope.tenantId, fy, status: { in: ["Approved", "Locked"] } }, orderBy: { id: "desc" }, select: { id: true, targetNo: true } });
  if (atRisk) {
    const a = await computeAchievement(scope, atRisk.id);
    const unit = targetTypeDef(a.targetType)?.unit ?? "money";
    const fmt = (n: number) => (unit === "money" ? inr(n) : unit === "percent" ? `${n}%` : String(n));
    out.push({ key: "forecast", severity: a.band === "red" || a.band === "orange" ? "high" : "info", title: `Predicted year-end for ${a.targetNo}: ${fmt(r2(a.lines.reduce((s, l) => s + l.forecast, 0)))}`, detail: `At ${a.timePct}% of the period elapsed, tracking ${a.achievementPct}% of the pace target.`, metric: a.band, href: `/sales/target/achievement?id=${atRisk.id}` });
    if (a.achievementPct < cfg.trafficLight.yellow) out.push({ key: "revise", severity: "medium", title: `Consider revising ${a.targetNo}`, detail: `Run-rate suggests the annual target may be missed — a revision keeps the plan realistic (revisions never overwrite the original).`, href: "/sales/target/revision" });
  }

  // top / under performers
  if (rows.length > 1) {
    const top = rows[0], low = rows[rows.length - 1];
    out.push({ key: "top", severity: "info", title: `Top performer: ${top.subjectLabel}`, detail: `Overall score ${top.overallScore}/100 at ${top.achievementPct}% achievement.`, metric: `${top.overallScore}`, href: "/sales/target/performance" });
    if (low.achievementPct < cfg.trafficLight.yellow) out.push({ key: "under", severity: "medium", title: `Underperformer: ${low.subjectLabel}`, detail: `Overall score ${low.overallScore}/100 at ${low.achievementPct}% — needs support.`, metric: `${low.overallScore}`, href: "/sales/target/performance" });
  }

  // suggested next-year target (prior actual × growth headroom)
  const totalActual = r2(rows.reduce((s, r) => s + r.actual, 0));
  if (totalActual > 0) out.push({ key: "nextyear", severity: "info", title: `Suggested next-year target: ${inr(r2(totalActual * 1.15))}`, detail: `Based on current-year actual ${inr(totalActual)} + 15% growth headroom.`, metric: "+15%", href: "/sales/target" });

  return out;
}

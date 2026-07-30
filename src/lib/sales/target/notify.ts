import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeData, scopeWhere } from "@/lib/auth/scope";
import type { Prisma } from "@prisma/client";
import { getConfig, computeAchievement } from "./engine";

/**
 * Sales Target notifications — approval-pending, revision-pending, below-threshold and
 * achieved/exceeded. Reuses the in-app `aiNotification` store (deduped one bucket/day) so it
 * shares the bell/notification centre. Email/SMS delivery deferred.
 */
export async function syncTargetNotifications(scope: ActiveScope): Promise<number> {
  const period = new Date().toISOString().slice(0, 10);
  const cfg = await getConfig(scope);
  const sw = scopeWhere(scope, { branch: true }) as Prisma.SalesTargetWhereInput;
  const rows: { category: string; severity: string; title: string; message: string; href: string; key: string }[] = [];

  const pending = await prisma.salesTarget.count({ where: { ...sw, status: "Submitted", approvalStatus: "Pending" } });
  if (pending > 0) rows.push({ category: "target.approval", severity: "High", title: `${pending} sales target${pending > 1 ? "s" : ""} awaiting approval`, message: `${pending} target${pending > 1 ? "s are" : " is"} pending approval.`, href: "/sales/target/approval", key: `target.approval:${period}` });

  const revs = await prisma.salesTargetRevision.count({ where: { tenantId: scope.tenantId, status: "Pending" } });
  if (revs > 0) rows.push({ category: "target.revision", severity: "Medium", title: `${revs} target revision${revs > 1 ? "s" : ""} pending`, message: `${revs} revision request${revs > 1 ? "s are" : " is"} awaiting approval.`, href: "/sales/target/revision", key: `target.revision:${period}` });

  // Below-threshold + achieved (compute over approved targets, capped)
  const approved = await prisma.salesTarget.findMany({ where: { ...sw, status: { in: ["Approved", "Locked"] } }, select: { id: true, targetNo: true }, take: 50 });
  let behind = 0, achieved = 0;
  for (const t of approved) {
    try {
      const a = await computeAchievement(scope, t.id);
      if (a.timePct >= 20 && a.achievementPct < cfg.notifyBelowThresholdPct) behind++;
      if (a.achievementPct >= 100) achieved++;
    } catch { /* skip */ }
  }
  if (behind > 0) rows.push({ category: "target.behind", severity: "High", title: `${behind} target${behind > 1 ? "s" : ""} below ${cfg.notifyBelowThresholdPct}%`, message: `${behind} approved target${behind > 1 ? "s are" : " is"} tracking below the alert threshold.`, href: "/sales/target/achievement", key: `target.behind:${period}` });
  if (achieved > 0) rows.push({ category: "target.achieved", severity: "Low", title: `${achieved} target${achieved > 1 ? "s" : ""} achieved`, message: `${achieved} target${achieved > 1 ? "s have" : " has"} reached 100%+.`, href: "/sales/target/achievement", key: `target.achieved:${period}` });

  let created = 0;
  for (const n of rows) {
    try {
      await prisma.aiNotification.upsert({
        where: { tenantId_dedupeKey: { tenantId: scope.tenantId, dedupeKey: n.key } },
        create: { tenantId: scope.tenantId, ...scopeData(scope, { branch: true }), category: n.category, severity: n.severity, title: n.title.slice(0, 200), message: n.message.slice(0, 500), href: n.href, dedupeKey: n.key, status: "unread" },
        update: { severity: n.severity, title: n.title.slice(0, 200), message: n.message.slice(0, 500) },
      });
      created++;
    } catch { /* dedupe race */ }
  }
  return created;
}

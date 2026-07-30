import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeData } from "@/lib/auth/scope";
import type { RiskItem } from "./risk";
import type { BusinessHealth } from "./health";

/**
 * NOTIFICATION CENTER (Module 16) — auto-notify on stock-out, cash-flow risk, budget
 * overrun, customer churn, supplier delay, compliance risk, low profit, high expense and
 * working-capital risk. Derived from detected risks + health; stored in-app (dedupe by
 * key so the same alert isn't repeated). Delivery channels (email/SMS/WhatsApp) deferred.
 */

const dedupe = (scope: ActiveScope, category: string, period: string) => `${category}:${period}`;

export async function syncNotifications(scope: ActiveScope, input: { risks: RiskItem[]; health: BusinessHealth; period: string }): Promise<number> {
  const rows: { category: string; severity: string; title: string; message: string; href?: string }[] = [];
  for (const r of input.risks) {
    if (r.severity === "Critical" || r.severity === "High") rows.push({ category: r.category, severity: r.severity, title: r.title, message: r.explanation, href: r.href });
  }
  if (input.health.overall < 40) rows.push({ category: "health", severity: "Critical", title: "Business health critical", message: `Overall health score is ${input.health.overall}% (${input.health.band}).`, href: "/intelligence/decision?tab=health" });

  let created = 0;
  for (const n of rows) {
    const key = dedupe(scope, n.category, input.period);
    try {
      await prisma.aiNotification.upsert({
        where: { tenantId_dedupeKey: { tenantId: scope.tenantId, dedupeKey: key } },
        create: { tenantId: scope.tenantId, ...scopeData(scope, { branch: true }), category: n.category, severity: n.severity, title: n.title.slice(0, 200), message: n.message.slice(0, 500), href: n.href ?? null, dedupeKey: key, status: "unread" },
        update: { severity: n.severity, title: n.title.slice(0, 200), message: n.message.slice(0, 500) },
      });
      created++;
    } catch { /* dedupe race — ignore */ }
  }
  return created;
}

export async function listNotifications(scope: ActiveScope, opts?: { status?: string; take?: number }) {
  return prisma.aiNotification.findMany({ where: { tenantId: scope.tenantId, ...(opts?.status ? { status: opts.status } : { status: { not: "dismissed" } }) }, orderBy: { createdAt: "desc" }, take: opts?.take ?? 50 });
}
export async function unreadCount(scope: ActiveScope) { return prisma.aiNotification.count({ where: { tenantId: scope.tenantId, status: "unread" } }); }
export async function setNotificationStatus(scope: ActiveScope, id: number | "all", status: string) {
  if (id === "all") { await prisma.aiNotification.updateMany({ where: { tenantId: scope.tenantId, status: "unread" }, data: { status } }); return true; }
  const n = await prisma.aiNotification.findFirst({ where: { tenantId: scope.tenantId, id }, select: { id: true } });
  if (!n) return false;
  await prisma.aiNotification.update({ where: { id }, data: { status } });
  return true;
}

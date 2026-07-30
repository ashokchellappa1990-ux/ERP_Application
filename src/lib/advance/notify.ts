import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { scopeData, scopeWhere } from "@/lib/auth/scope";
import { OPEN_ADVANCE, type AdvanceConfigData } from "@/lib/contracts/advance";

/**
 * Advance Management notifications — pending approval, settlement reminders and
 * expired advances. Reuses the in-app `aiNotification` store (deduped per day) so it
 * shares the bell/notification centre. Delivery channels (email/SMS) deferred.
 */
const daysSince = (dateStr: string, now: Date) => { const t = Date.parse(dateStr); return Number.isNaN(t) ? 0 : Math.floor((now.getTime() - t) / 86_400_000); };

export async function syncAdvanceNotifications(scope: ActiveScope, cfg: AdvanceConfigData): Promise<number> {
  const period = new Date().toISOString().slice(0, 10); // one bucket per day
  const now = new Date();
  const sw = scopeWhere(scope, { branch: true });
  const rows: { category: string; severity: string; title: string; message: string; href: string; key: string }[] = [];

  const pending = await prisma.advance.count({ where: { ...sw, approvalStatus: "Pending" } });
  if (pending > 0) rows.push({ category: "advance.approval", severity: "High", title: `${pending} advance${pending > 1 ? "s" : ""} awaiting approval`, message: `${pending} advance voucher${pending > 1 ? "s are" : " is"} pending approval.`, href: "/finance/advance/approval", key: `advance.approval:${period}` });

  const open = await prisma.advance.findMany({ where: { ...sw, status: { in: OPEN_ADVANCE }, balanceAmount: { gt: 0 } }, select: { advanceDate: true } });
  if (cfg.settlementReminderDays > 0) {
    const due = open.filter((a) => daysSince(a.advanceDate, now) >= cfg.settlementReminderDays).length;
    if (due > 0) rows.push({ category: "advance.settlement", severity: "Medium", title: `${due} advance${due > 1 ? "s" : ""} pending settlement`, message: `${due} advance${due > 1 ? "s are" : " is"} open beyond ${cfg.settlementReminderDays} days with an unsettled balance.`, href: "/finance/advance/register", key: `advance.settlement:${period}` });
  }
  if (cfg.advanceExpiryDays > 0) {
    const expired = open.filter((a) => daysSince(a.advanceDate, now) >= cfg.advanceExpiryDays).length;
    if (expired > 0) rows.push({ category: "advance.expired", severity: "High", title: `${expired} advance${expired > 1 ? "s" : ""} expired`, message: `${expired} advance${expired > 1 ? "s exceed" : " exceeds"} the ${cfg.advanceExpiryDays}-day expiry with an unsettled balance.`, href: "/finance/advance/register", key: `advance.expired:${period}` });
  }

  let created = 0;
  for (const n of rows) {
    try {
      await prisma.aiNotification.upsert({
        where: { tenantId_dedupeKey: { tenantId: scope.tenantId, dedupeKey: n.key } },
        create: { tenantId: scope.tenantId, ...scopeData(scope, { branch: true }), category: n.category, severity: n.severity, title: n.title.slice(0, 200), message: n.message.slice(0, 500), href: n.href, dedupeKey: n.key, status: "unread" },
        update: { severity: n.severity, title: n.title.slice(0, 200), message: n.message.slice(0, 500) },
      });
      created++;
    } catch { /* dedupe race — ignore */ }
  }
  return created;
}

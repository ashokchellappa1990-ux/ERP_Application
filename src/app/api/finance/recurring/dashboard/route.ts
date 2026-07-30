import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/finance/recurring/dashboard — KPI counts for the operations dashboard.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "finance.recurring");
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const bScope = scope.businessId != null ? { businessId: scope.businessId } : {};
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

  const [configs, cfgRows, execToday, failedToday, monthExp, monthInc] = await Promise.all([
    prisma.recurringConfig.groupBy({ by: ["status"], where: { tenantId: user.tenantId, ...bScope }, _count: true }),
    prisma.recurringConfig.findMany({ where: { tenantId: user.tenantId, status: "Active", ...bScope }, select: { generationMode: true, nextExecution: true, txnType: true } }),
    prisma.recurringExecution.count({ where: { tenantId: user.tenantId, ...bScope, executionDate: today, status: { in: ["Posted", "Generated"] } } }),
    prisma.recurringExecution.count({ where: { tenantId: user.tenantId, ...bScope, executionDate: today, status: "Failed" } }),
    prisma.recurringExecution.aggregate({ where: { tenantId: user.tenantId, ...bScope, executionDate: { startsWith: today.slice(0, 7) }, status: "Posted", config: { txnType: "expense" } }, _sum: { amount: true } }),
    prisma.recurringExecution.aggregate({ where: { tenantId: user.tenantId, ...bScope, executionDate: { startsWith: today.slice(0, 7) }, status: "Posted", config: { txnType: "income" } }, _sum: { amount: true } }),
  ]);
  const statusCount = (s: string) => configs.find((c) => c.status === s)?._count ?? 0;
  const active = cfgRows;
  const kpis = {
    totalConfigs: configs.reduce((s, c) => s + (c._count as number), 0),
    active: statusCount("Active"), paused: statusCount("Paused"), draft: statusCount("Draft"),
    dueToday: active.filter((c) => c.nextExecution && c.nextExecution <= today).length,
    upcoming: active.filter((c) => c.nextExecution && c.nextExecution > today && c.nextExecution <= in7).length,
    pendingManual: active.filter((c) => c.generationMode === "manual" && c.nextExecution && c.nextExecution <= today).length,
    pendingApproval: active.filter((c) => c.generationMode === "scheduler_approval" && c.nextExecution && c.nextExecution <= today).length,
    generatedToday: execToday, failedToday,
    recurringExpense: num(monthExp._sum.amount), recurringIncome: num(monthInc._sum.amount),
  };
  return NextResponse.json({ ok: true, kpis });
}

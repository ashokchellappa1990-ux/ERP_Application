import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { PendingRow, GenMode } from "@/lib/contracts/recurring";

// GET /api/finance/recurring/pending — due/upcoming occurrences needing action
// (Manual / Reminder Only / Scheduler + Approval — Automatic posts on its own).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "finance.recurring");
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const branchName = (id: number | null) => (id == null ? null : allowed.branches.find((b) => b.id === id)?.name ?? null);
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10); // next 30 days

  const rows = await prisma.recurringConfig.findMany({
    where: {
      tenantId: user.tenantId, status: "Active", ...(scope.businessId != null ? { businessId: scope.businessId } : {}),
      generationMode: { in: ["manual", "reminder", "scheduler_approval"] }, nextExecution: { not: null, lte: horizon },
    },
    orderBy: { nextExecution: "asc" },
  });
  const filter = new URL(req.url).searchParams.get("mode");
  const list: PendingRow[] = rows
    .filter((r) => !filter || r.generationMode === filter)
    .map((r) => ({
      configId: r.id, configNo: r.configNo, name: r.name, txnType: r.txnType as "expense" | "income",
      scope: r.branchId != null ? "branch" : "company", branchName: branchName(r.branchId),
      generationMode: r.generationMode as GenMode, dueDate: r.nextExecution!, amount: Number(r.amount) || 0,
      headName: r.headName, partyName: r.partyName, overdue: r.nextExecution! < today,
    }));
  return NextResponse.json({ ok: true, rows: list });
}

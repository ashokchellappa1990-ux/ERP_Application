import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { headUsage } from "@/lib/finance/budgetService";

// GET /api/finance/budget/usage?headId=&date= — per-head budget snapshot for the
// current period (total / utilised / balance), shown on the expense voucher.
// Guarded by the expense permission so the voucher screen can call it.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "finance.petty-cash");
  if (denied) return denied;

  const url = new URL(req.url);
  const headId = Number(url.searchParams.get("headId"));
  if (!headId) return NextResponse.json({ ok: false, message: "headId required." }, { status: 422 });
  const dateStr = (url.searchParams.get("date") || new Date().toISOString().slice(0, 10)).slice(0, 10);

  const scope = await getActiveScope(user);
  const usage = await headUsage(prisma, { tenantId: user.tenantId, businessId: scope.businessId, branchId: scope.branchId, headId, dateStr });
  return NextResponse.json({ ok: true, usage });
}

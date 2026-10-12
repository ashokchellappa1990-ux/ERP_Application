import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

// GET /api/finance/recurring/context — heads/accounts/branches for the config form.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "finance.recurring");
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const businessId = scope.businessId;
  const [expHeads, cats, incomeCats] = await Promise.all([
    prisma.expenseHead.findMany({ where: { tenantId: user.tenantId, active: true, parentId: { not: null }, ...(businessId != null ? { businessId } : {}) }, select: { id: true, name: true, parentId: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    prisma.expenseHead.findMany({ where: { tenantId: user.tenantId, parentId: null }, select: { id: true, name: true } }),
    // Income heads come from the Receipt Configuration (Receipt Category Master).
    prisma.receiptCategory.findMany({ where: { tenantId: user.tenantId, active: true, ...(businessId != null ? { businessId } : {}) }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  return NextResponse.json({
    ok: true,
    expenseHeads: expHeads.map((h) => ({ id: h.id, name: h.name, category: h.parentId != null ? catName.get(h.parentId) ?? null : null })),
    incomeAccounts: incomeCats.map((a) => ({ id: a.id, name: `${a.code} · ${a.name}` })),
    branches: allowed.branches.filter((b) => b.businessId === businessId).map((b) => ({ id: b.id, name: b.name })),
  });
}

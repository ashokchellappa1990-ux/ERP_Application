import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { CentreOption } from "@/lib/contracts/costCentre";

// GET /api/finance/dimensions — active cost centres + profit centres for the
// cost-centre / profit-centre selectors on transaction screens (expense/income etc.).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  // Available to anyone who can post an expense (the primary consumer).
  const denied = await requirePermission(user, "finance.petty-cash");
  if (denied) return denied;
  const scope = await getActiveScope(user);
  const bScope = scope.businessId != null ? { businessId: scope.businessId } : {};
  const [cc, pc] = await Promise.all([
    prisma.costCentre.findMany({ where: { tenantId: user.tenantId, status: "Active", ...bScope }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.profitCentre.findMany({ where: { tenantId: user.tenantId, status: "Active", ...bScope }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  const costCentres: CentreOption[] = cc.map((c) => ({ id: c.id, code: c.code, name: c.name }));
  const profitCentres: CentreOption[] = pc.map((c) => ({ id: c.id, code: c.code, name: c.name }));
  return NextResponse.json({ ok: true, costCentres, profitCentres });
}

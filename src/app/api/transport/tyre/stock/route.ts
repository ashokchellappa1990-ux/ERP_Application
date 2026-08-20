import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { TYRE_STATUS_OPTS } from "@/lib/contracts/tyre";

const PERM = "transport.tyre";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const where: Prisma.TyreMasterWhereInput = { ...scopeWhere(scope, { branch: true }), deletedAt: null };
  const byStatus = await prisma.tyreMaster.groupBy({ by: ["status"], where, _count: true, _sum: { purchaseCost: true } });
  const map = new Map(byStatus.map((r) => [r.status, r]));

  const rows = TYRE_STATUS_OPTS.map((status) => ({
    status, count: map.get(status)?._count ?? 0,
    purchaseCost: map.get(status)?._sum.purchaseCost != null ? Number(map.get(status)!._sum.purchaseCost) : 0,
  }));
  return NextResponse.json({ ok: true, rows });
}

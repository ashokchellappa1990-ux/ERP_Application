import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { LoyaltyBalanceRow } from "@/lib/contracts/loyalty";

// GET /api/loyalty/balance?q= — customer reward balances (search by name/phone).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "loyalty.profile");
  if (denied) return denied;

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const sw = scopeWhere(await getActiveScope(user), { branch: false });
  const where: Prisma.CustomerWhereInput = { ...sw, OR: [{ availableRewardPoints: { gt: 0 } }, { totalRewardPointsEarned: { gt: 0 } }] };
  if (q) where.AND = [{ OR: [{ name: { contains: q } }, { phone: { contains: q } }] }];

  const rows = await prisma.customer.findMany({ where, orderBy: { availableRewardPoints: "desc" }, take: 100, select: { id: true, name: true, phone: true, availableRewardPoints: true, totalRewardPointsEarned: true, totalRewardPointsRedeemed: true, totalRewardPointsExpired: true } });
  const customerIds = rows.map((r) => r.id);
  const last = customerIds.length ? await prisma.loyaltyTransactionLedger.groupBy({ by: ["customerId"], where: { tenantId: user.tenantId, customerId: { in: customerIds } }, _max: { createdAt: true } }) : [];
  const lastMap = new Map(last.map((l) => [l.customerId, l._max.createdAt]));
  const shaped: LoyaltyBalanceRow[] = rows.map((r) => ({ customerId: r.id, customerName: r.name, phone: r.phone ?? "", available: r.availableRewardPoints, earned: r.totalRewardPointsEarned, redeemed: r.totalRewardPointsRedeemed, expired: r.totalRewardPointsExpired, lastTxnAt: lastMap.get(r.id)?.toISOString() ?? null }));

  const agg = await prisma.customer.aggregate({ where: { ...sw }, _sum: { availableRewardPoints: true, totalRewardPointsEarned: true, totalRewardPointsRedeemed: true }, _count: { _all: true } });
  return NextResponse.json({ ok: true, rows: shaped, stats: { customers: rows.length, available: agg._sum.availableRewardPoints ?? 0, earned: agg._sum.totalRewardPointsEarned ?? 0, redeemed: agg._sum.totalRewardPointsRedeemed ?? 0 } });
}

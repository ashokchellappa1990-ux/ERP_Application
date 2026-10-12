import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { LoyaltyLedgerRow } from "@/lib/contracts/loyalty";

// GET /api/loyalty/ledger?customerId=&type= — loyalty transaction ledger.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "loyalty.profile");
  if (denied) return denied;

  const url = new URL(req.url);
  const customerId = Number(url.searchParams.get("customerId"));
  const type = url.searchParams.get("type") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: false });
  const where: Prisma.LoyaltyTransactionLedgerWhereInput = { ...sw };
  if (Number.isInteger(customerId) && customerId > 0) where.customerId = customerId;
  if (type !== "All") where.txnType = type;

  const rows = await prisma.loyaltyTransactionLedger.findMany({ where, orderBy: { id: "desc" }, take: 200 });
  const custIds = Array.from(new Set(rows.map((r) => r.customerId)));
  const custs = custIds.length ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }) : [];
  const cMap = new Map(custs.map((c) => [c.id, c.name]));
  const shaped: LoyaltyLedgerRow[] = rows.map((r) => ({
    id: r.id, txnDate: r.txnDate, customerId: r.customerId, customerName: cMap.get(r.customerId) ?? `#${r.customerId}`, invoiceNo: r.invoiceNo ?? "",
    txnType: r.txnType, earned: r.points > 0 ? r.points : 0, redeemed: r.points < 0 ? -r.points : 0, points: r.points, balanceAfter: r.balanceAfter, remarks: r.remarks ?? "", createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: shaped });
}

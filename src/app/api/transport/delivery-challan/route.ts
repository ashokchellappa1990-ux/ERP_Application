import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

const PERM = "transport";
const num = (v: unknown) => (v == null ? 0 : Number(v));

/** GET /api/transport/delivery-challan — list (scoped), search by dcNo/customerName, status filter. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.DeliveryChallanWhereInput = { ...sw };
  if (q) where.OR = [{ dcNo: { contains: q } }, { customerName: { contains: q } }];
  if (status !== "All") where.status = status;

  const rows = await prisma.deliveryChallan.findMany({ where, orderBy: { id: "desc" }, take: 200 });
  const shaped = rows.map((r) => ({
    id: r.id, dcNo: r.dcNo, dcDate: r.dcDate, dispatchExecutionId: r.dispatchExecutionId,
    customerName: r.customerName ?? "", totalQty: num(r.totalQty), totalValue: num(r.totalValue),
    status: r.status, printedCount: r.printedCount, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: shaped });
}

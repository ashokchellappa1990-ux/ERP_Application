import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { WIP_WAREHOUSE } from "@/lib/inventory/buckets";
import { getAreaAvailableQty } from "@/lib/manufacturing/areaStock";
import type { StockCheckResponse } from "@/lib/contracts/materialProcessing";

const PERM = "manufacturing.material-processing";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r3 = (n: number) => +n.toFixed(3);

// GET /api/manufacturing/material-processing/stock-check?productId=&areaId=&branchId=&qty=
// Live stock availability for the Raw Material Input step — re-checked again,
// server-side, at Initiate Process (this endpoint is for the UI's live display only).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const productId = Number(url.searchParams.get("productId")) || 0;
  const areaId = Number(url.searchParams.get("areaId")) || 0;
  const branchIdParam = Number(url.searchParams.get("branchId")) || 0;
  const requestedQty = Number(url.searchParams.get("qty")) || 0;
  if (!productId || !areaId) return NextResponse.json({ ok: false, message: "productId and areaId are required." }, { status: 422 });

  const area = await prisma.area.findFirst({ where: { id: areaId, tenantId: user.tenantId }, select: { id: true } });
  if (!area) return NextResponse.json({ ok: false, message: "Area not found." }, { status: 404 });

  const scope = await getActiveScope(user);
  const branchId = branchIdParam || scope.branchId;

  const [availableQty, wipBalances] = await Promise.all([
    getAreaAvailableQty(user.tenantId, branchId ?? null, productId, areaId),
    prisma.inventoryBalance.findMany({ where: { tenantId: user.tenantId, productId, warehouse: WIP_WAREHOUSE, ...(branchId ? { branchId } : {}) }, select: { qtyOnHand: true } }),
  ]);
  const wipQty = r3(wipBalances.reduce((s, b) => s + num(b.qtyOnHand), 0));
  const balanceAfterIssue = r3(availableQty - requestedQty);

  const res: StockCheckResponse = { ok: true, availableQty, wipQty, requestedQty: r3(requestedQty), balanceAfterIssue, sufficient: requestedQty > 0 && requestedQty <= availableQty + 0.0005 };
  return NextResponse.json(res);
}

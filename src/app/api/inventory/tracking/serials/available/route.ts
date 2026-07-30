import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { AvailableSerial } from "@/lib/contracts/inventoryTracking";

// GET /api/inventory/tracking/serials/available?productId=&warehouse=&q= — available
// serials for a product (for the sale "select serial" picker).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.pos");
  if (denied) return denied;

  const url = new URL(req.url);
  const productId = Number(url.searchParams.get("productId"));
  if (!Number.isInteger(productId) || productId <= 0) return NextResponse.json({ ok: true, rows: [] });
  const warehouse = (url.searchParams.get("warehouse") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim();
  const sw = scopeWhere(await getActiveScope(user), { branch: true });

  // Only real manufacturer serials (serialNo set) — not bare generated QR codes.
  const where: Prisma.QrCodeMappingWhereInput = { ...sw, productId, status: "Active", serialNo: { not: null } };
  if (warehouse) where.OR = [{ warehouse }, { warehouse: null }];
  if (q) where.AND = [{ OR: [{ serialNo: { contains: q } }, { code: { contains: q } }] }];
  const rows = await prisma.qrCodeMapping.findMany({ where, orderBy: { id: "asc" }, take: 100, select: { id: true, serialNo: true, code: true } });
  const out: AvailableSerial[] = rows.map((r) => ({ id: r.id, serialNo: r.serialNo ?? r.code, code: r.code }));
  return NextResponse.json({ ok: true, rows: out });
}

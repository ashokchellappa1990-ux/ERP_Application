import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { fuelPurchaseInput, type FuelPurchaseRow } from "@/lib/contracts/fuelManagement";

const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }
function dateStr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const tankId = url.searchParams.get("tankId");
  const status = url.searchParams.get("status");
  const scope = await getActiveScope(user);
  const where: Prisma.FuelPurchaseWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (tankId) where.tankId = Number(tankId);
  if (status && status !== "All") where.status = status;

  const rows = await prisma.fuelPurchase.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const tanks = await prisma.fuelTank.findMany({ where: { id: { in: Array.from(new Set(rows.map((r) => r.tankId))) } }, select: { id: true, tankName: true } });
  const tMap = new Map(tanks.map((t) => [t.id, t.tankName]));
  const createdByIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is number => x != null)));
  const users = createdByIds.length ? await prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [];
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));

  const list: FuelPurchaseRow[] = rows.map((r) => ({
    id: r.id, purchaseNo: r.purchaseNo, purchaseDate: dateStr(r.purchaseDate) ?? "", supplierName: r.supplierName,
    tankId: r.tankId, tankName: tMap.get(r.tankId) ?? "—", fuelType: r.fuelType, quantity: num(r.quantity) ?? 0, rate: num(r.rate) ?? 0, amount: num(r.amount) ?? 0,
    status: r.status, createdByName: r.createdBy != null ? uMap.get(r.createdBy) ?? null : null, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: list });
}

// POST — created directly Confirmed (matches how FuelPurchase always adds
// stock on the spot, no separate confirm step); increments the tank in the
// same transaction.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "FuelPurchase" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = fuelPurchaseInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const tank = await prisma.fuelTank.findFirst({ where: { id: b.tankId, tenantId: user.tenantId } });
  if (!tank) return NextResponse.json({ ok: false, message: "Fuel tank not found." }, { status: 422 });

  let supplierName = b.supplierName ?? null;
  if (b.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: b.supplierId, tenantId: user.tenantId }, select: { name: true } });
    if (!supplier) return NextResponse.json({ ok: false, message: "Supplier not found." }, { status: 422 });
    supplierName = supplier.name;
  }

  const amount = b.quantity * b.rate;
  const seg = await resolveWriteScope(user);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.fuelPurchase.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        purchaseNo: "TMP", supplierId: b.supplierId ?? null, supplierName, purchaseDate: new Date(b.purchaseDate),
        fuelType: b.fuelType, tankId: b.tankId, quantity: b.quantity, rate: b.rate, amount,
        invoiceNo: b.invoiceNo ?? null, invoiceDate: b.invoiceDate ? new Date(b.invoiceDate) : null,
        status: "Confirmed", remarks: b.remarks ?? null, createdBy: user.id,
      },
    });
    await tx.fuelTank.update({ where: { id: b.tankId }, data: { currentQty: { increment: b.quantity } } });
    return row;
  });
  const purchaseNo = `FP-${String(created.id).padStart(6, "0")}`;
  await prisma.fuelPurchase.update({ where: { id: created.id }, data: { purchaseNo } });

  await writeAudit(prisma, user, { action: "fuel_purchase.create", entity: "FuelPurchase", entityId: created.id, summary: `Fuel purchase ${purchaseNo} — ${b.quantity}L into ${tank.tankName}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, purchaseNo, message: "Fuel purchase recorded — tank stock updated." }, { status: 201 });
}

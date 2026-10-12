import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { supplierProductPriceInput, type SupplierProductPriceDetail } from "@/lib/contracts/supplierProductPrice";

const PERM = "masters.purchase";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/masters/purchase/supplier-product-price/[id] — current price + full history.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const id = Number(params.id);
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const row = await prisma.supplierProductPrice.findFirst({ where: { ...sw, id, deletedAt: null } });
  if (!row) return NextResponse.json({ ok: false, message: "Purchase price not found." }, { status: 404 });

  const [supplier, product, history] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: row.supplierId }, select: { name: true } }),
    prisma.product.findFirst({ where: { id: row.productId }, select: { name: true, code: true, baseUom: true } }),
    prisma.supplierProductPriceHistory.findMany({ where: { supplierProductPriceId: id }, orderBy: { id: "desc" } }),
  ]);

  const detail: SupplierProductPriceDetail = {
    id: row.id, supplierId: row.supplierId, supplierName: supplier?.name ?? "—",
    productId: row.productId, productCode: product?.code ?? null, productName: product?.name ?? "—",
    uom: product?.baseUom ?? null,
    purchasePrice: num(row.purchasePrice), effectiveFrom: row.effectiveFrom, status: row.status as "Active" | "Inactive",
    remarks: row.remarks, updatedAt: row.updatedAt.toISOString(),
    history: history.map((h) => ({
      id: h.id, oldPrice: h.oldPrice != null ? num(h.oldPrice) : null, newPrice: num(h.newPrice),
      effectiveFrom: h.effectiveFrom, changedByName: h.changedByName, createdAt: h.createdAt.toISOString(),
    })),
  };
  return NextResponse.json({ ok: true, row: detail });
}

// PUT /api/masters/purchase/supplier-product-price/[id] — update the current
// price. Supplier/Product are immutable once created (that's what the unique
// pair identifies) — only purchasePrice/effectiveFrom/status/remarks change.
// A changed purchasePrice writes a SupplierProductPriceHistory row.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "SupplierProductPrice", entityId: id });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = supplierProductPriceInput.partial({ supplierId: true, productId: true }).safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const existing = await prisma.supplierProductPrice.findFirst({ where: { ...sw, id, deletedAt: null } });
  if (!existing) return NextResponse.json({ ok: false, message: "Purchase price not found." }, { status: 404 });
  if (b.purchasePrice == null || b.effectiveFrom == null) return NextResponse.json({ ok: false, message: "Purchase price and effective date are required." }, { status: 422 });

  const priceChanged = Math.abs(num(existing.purchasePrice) - b.purchasePrice) > 0.0001;
  await prisma.$transaction(async (tx) => {
    await tx.supplierProductPrice.update({
      where: { id },
      data: { purchasePrice: b.purchasePrice, effectiveFrom: b.effectiveFrom, status: b.status ?? existing.status, remarks: b.remarks ?? null, updatedBy: user.id },
    });
    if (priceChanged) {
      await tx.supplierProductPriceHistory.create({
        data: {
          tenantId: user.tenantId, supplierProductPriceId: id, supplierId: existing.supplierId, productId: existing.productId,
          oldPrice: existing.purchasePrice, newPrice: b.purchasePrice, effectiveFrom: b.effectiveFrom,
          changedBy: user.id, changedByName: user.fullName ?? null,
        },
      });
    }
  });

  const sc = await getActiveScope(user);
  await writeAudit(prisma, user, {
    action: "supplier_product_price.update", entity: "SupplierProductPrice", entityId: id,
    summary: priceChanged ? `Updated purchase price from ${num(existing.purchasePrice)} to ${b.purchasePrice}` : "Updated purchase price details",
    businessId: sc.businessId ?? null, branchId: sc.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Purchase price saved." });
}

// DELETE /api/masters/purchase/supplier-product-price/[id] — soft delete.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "SupplierProductPrice", entityId: id });
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const existing = await prisma.supplierProductPrice.findFirst({ where: { ...sw, id, deletedAt: null } });
  if (!existing) return NextResponse.json({ ok: false, message: "Purchase price not found." }, { status: 404 });

  await prisma.supplierProductPrice.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: user.id } });
  const sc = await getActiveScope(user);
  await writeAudit(prisma, user, {
    action: "supplier_product_price.delete", entity: "SupplierProductPrice", entityId: id, summary: "Deleted purchase price record",
    businessId: sc.businessId ?? null, branchId: sc.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Deleted." });
}

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { supplierProductPriceInput, type SupplierProductPriceRow } from "@/lib/contracts/supplierProductPrice";

const PERM = "masters.purchase";
const num = (v: unknown) => (v == null ? 0 : Number(v));

async function toRows(rows: { id: number; supplierId: number; productId: number; purchasePrice: unknown; effectiveFrom: string; status: string; remarks: string | null; updatedAt: Date }[]): Promise<SupplierProductPriceRow[]> {
  const supplierIds = Array.from(new Set(rows.map((r) => r.supplierId)));
  const productIds = Array.from(new Set(rows.map((r) => r.productId)));
  const [suppliers, products] = await Promise.all([
    supplierIds.length ? prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    productIds.length ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, code: true, baseUom: true } }) : Promise.resolve([]),
  ]);
  const supplierById = new Map(suppliers.map((s) => [s.id, s.name]));
  const productById = new Map(products.map((p) => [p.id, p]));
  return rows.map((r) => ({
    id: r.id, supplierId: r.supplierId, supplierName: supplierById.get(r.supplierId) ?? "—",
    productId: r.productId, productCode: productById.get(r.productId)?.code ?? null, productName: productById.get(r.productId)?.name ?? "—",
    uom: productById.get(r.productId)?.baseUom ?? null,
    purchasePrice: num(r.purchasePrice), effectiveFrom: r.effectiveFrom, status: r.status as "Active" | "Inactive",
    remarks: r.remarks, updatedAt: r.updatedAt.toISOString(),
  }));
}

// GET /api/masters/purchase/supplier-product-price — list (tenant/business/branch scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim();
  const supplierIdParam = Number(url.searchParams.get("supplierId") ?? "");
  const productIdParam = Number(url.searchParams.get("productId") ?? "");

  const where: Prisma.SupplierProductPriceWhereInput = { ...scopeWhere(await getActiveScope(user), { branch: true }), deletedAt: null };
  if (status && status !== "All") where.status = status;
  // Exact supplier+product pair lookup (used by GRN to auto-fill the purchase price) —
  // short-circuits the free-text search below.
  if (supplierIdParam > 0 && productIdParam > 0) {
    where.supplierId = supplierIdParam;
    where.productId = productIdParam;
  } else if (q) {
    const [supplierHits, productHits] = await Promise.all([
      prisma.supplier.findMany({ where: { tenantId: user.tenantId, name: { contains: q } }, select: { id: true } }),
      prisma.product.findMany({ where: { tenantId: user.tenantId, OR: [{ name: { contains: q } }, { code: { contains: q } }] }, select: { id: true } }),
    ]);
    where.OR = [{ supplierId: { in: supplierHits.map((s) => s.id) } }, { productId: { in: productHits.map((p) => p.id) } }];
  }

  const rows = await prisma.supplierProductPrice.findMany({ where, orderBy: { updatedAt: "desc" }, take: 500 });
  return NextResponse.json({ ok: true, rows: await toRows(rows) });
}

// POST /api/masters/purchase/supplier-product-price — create the current price
// for a Supplier+Product pair (one active row per pair — edit it instead of
// creating a duplicate). Writes the first SupplierProductPriceHistory row
// (oldPrice: null) so the initial price is itself visible in history.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "SupplierProductPrice" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = supplierProductPriceInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  try {
    const id = await prisma.$transaction(async (tx) => {
      const created = await tx.supplierProductPrice.create({
        data: {
          tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
          supplierId: b.supplierId, productId: b.productId, purchasePrice: b.purchasePrice,
          effectiveFrom: b.effectiveFrom, status: b.status, remarks: b.remarks ?? null, createdBy: user.id,
        },
      });
      await tx.supplierProductPriceHistory.create({
        data: {
          tenantId: user.tenantId, supplierProductPriceId: created.id, supplierId: b.supplierId, productId: b.productId,
          oldPrice: null, newPrice: b.purchasePrice, effectiveFrom: b.effectiveFrom,
          changedBy: user.id, changedByName: user.fullName ?? null,
        },
      });
      return created.id;
    });
    await writeAudit(prisma, user, {
      action: "supplier_product_price.create", entity: "SupplierProductPrice", entityId: id,
      summary: `Set purchase price for supplier #${b.supplierId} / product #${b.productId}`,
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    const [row] = await toRows([await prisma.supplierProductPrice.findUniqueOrThrow({ where: { id } })]);
    return NextResponse.json({ ok: true, id, row, message: "Purchase price saved." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A purchase price for this supplier and product already exists — edit it instead." }, { status: 409 });
    }
    console.error("[supplier-product-price] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the purchase price." }, { status: 500 });
  }
}

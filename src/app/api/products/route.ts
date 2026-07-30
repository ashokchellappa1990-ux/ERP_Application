import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { productSchema, validateProduct } from "@/lib/validation/productSchema";
import { fieldsToColumns, variantToChild, attributesToVariants } from "@/lib/masters/productMap";
import { generateBarcode, generateSku } from "@/lib/masters/variantCodes";
import type { ProductRow, ProductListStats, MasterStatus } from "@/lib/contracts/masters";

const PERM = "masters.product";
const hasVariant = (v: { label?: string; dims?: unknown[] }) => !!((v.label && v.label.trim()) || (v.dims && v.dims.length));

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/products — list with search / status filter / pagination + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 8)));

  // Scope to active business + branch visibility (all-branch rows + the branches
  // this user may see). Only top-level products; variants are nested under them.
  const scope = await getActiveScope(user);
  const seg = scopeWhere(scope, { branch: true });
  const branchAnd = seg.AND ?? [];
  const topLevel: Prisma.ProductWhereInput = { tenantId: seg.tenantId, businessId: seg.businessId, parentId: null, AND: branchAnd };
  const where: Prisma.ProductWhereInput = { ...topLevel };
  if (status !== "All") where.status = status;
  if (q) where.AND = [...branchAnd, { OR: [
    { name: { contains: q } }, { code: { contains: q } }, { category: { contains: q } }, { brand: { contains: q } },
    { children: { some: { OR: [{ name: { contains: q } }, { code: { contains: q } }, { sku: { contains: q } }] } } },
  ] }];

  const [total, rows, active, inactive, blocked, recent, grandTotal] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { children: { orderBy: { id: "asc" } } } }),
    prisma.product.count({ where: { ...topLevel, status: "Active" } }),
    prisma.product.count({ where: { ...topLevel, status: "Inactive" } }),
    prisma.product.count({ where: { ...topLevel, status: "Blocked" } }),
    prisma.product.count({ where: { ...topLevel, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
    prisma.product.count({ where: topLevel }),
  ]);

  const lowStock = (await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c FROM products WHERE tenantId = ${user.tenantId} AND reorderLevel IS NOT NULL AND openingQty <= reorderLevel`)[0]?.c ?? 0n;

  const shaped: ProductRow[] = rows.map((p) => ({
    id: p.id, code: p.code ?? "", name: p.name, category: p.category ?? "", brand: p.brand ?? "",
    uom: p.baseUom ?? "", mrp: num(p.mrp), stock: num(p.openingQty), reorder: num(p.reorderLevel),
    status: p.status as MasterStatus, gst: p.gstRate ?? "",
    invBatch: !!p.invBatch, invMfg: !!p.invMfg, invExpiry: !!p.invExpiry, invSerial: !!p.invSerial,
    variantCount: p.children.length,
    variants: p.children.map((c) => ({
      id: c.id, name: c.name, code: c.code ?? "", sku: c.sku ?? "", barcode: c.barcode ?? "",
      mrp: num(c.mrp), stock: num(c.openingQty), status: c.status as MasterStatus,
      invBatch: !!c.invBatch, invMfg: !!c.invMfg, invExpiry: !!c.invExpiry, invSerial: !!c.invSerial,
    })),
  }));
  const stats: ProductListStats = { total: grandTotal, active, inactive, blocked, lowStock: Number(lowStock), nearExpiry: 0, newAdded: recent };
  return NextResponse.json({ ok: true, rows: shaped, total, page, pageSize, stats });
}

// POST /api/products — create a product (+ variant attributes).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "Product" });
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const parsed = productSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid product payload." }, { status: 422 });
  const d = parsed.data;

  const errors = validateProduct(d);
  if (Object.keys(errors).length) {
    return NextResponse.json({ ok: false, message: "Please correct the highlighted fields.", errors }, { status: 422 });
  }

  const cols = fieldsToColumns(d);
  const code = String(cols.code ?? "");
  const name = String(cols.name ?? "");
  const autoUnique = !!d.flags?.autoUniqueCode;
  // Where to store the product: the active business + the chosen branch
  // ("All branches" -> branchId null). seg is stamped on the product + variants.
  const seg = await resolveWriteScope(user, (body as { scopeBranchId?: number | "all" }).scopeBranchId);
  try {
    const productId = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...(cols as Prisma.ProductUncheckedCreateInput),
          tenantId: user.tenantId,
          businessId: seg.businessId ?? undefined,
          branchId: seg.branchId ?? undefined,
          attributes: { create: d.attributes.filter((a) => a.name?.trim()).map((a) => ({ name: a.name || null, type: a.type || null, values: a.values || null })) },
        },
        select: { id: true },
      });
      // Unique Code Generation: produce a unique code + combination SKU + barcode.
      if (autoUnique) {
        const genCode = code.trim() || `PRD-${String(product.id).padStart(5, "0")}`;
        const genSku = String(cols.sku ?? "").trim() || generateSku({ category: cols.category as string | null, subCategory: cols.subCategory as string | null, group: cols.group as string | null, name, code: genCode });
        await tx.product.update({ where: { id: product.id }, data: { code: genCode, sku: genSku, barcode: generateBarcode(product.id) } });
      }
      // Each variant becomes its own child product record (own SKU + barcode).
      const explicit = d.variants.filter(hasVariant);
      const effVariants = explicit.length ? explicit : attributesToVariants(d.attributes);
      for (const v of effVariants) {
        const { cols: childCols, attributes } = variantToChild(cols, name, code, v);
        const child = await tx.product.create({
          data: { ...(childCols as Prisma.ProductUncheckedCreateInput), tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined, parentId: product.id, attributes: { create: attributes } },
          select: { id: true },
        });
        await tx.product.update({ where: { id: child.id }, data: { barcode: generateBarcode(child.id) } });
      }
      return product.id;
    });
    await writeAudit(prisma, user, {
      action: "product.create", entity: "Product", entityId: productId,
      summary: `Created product ${name || code || `#${productId}`}`,
      meta: { name, code, category: cols.category ?? null, autoUnique },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Product created.", productId }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "Product code already exists.", errors: { code: "This product code is already in use." } }, { status: 409 });
    }
    console.error("[products] create error", err);
    return NextResponse.json({ ok: false, message: "Could not create the product." }, { status: 500 });
  }
}

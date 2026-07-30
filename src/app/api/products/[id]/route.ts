import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { productSchema, validateProduct } from "@/lib/validation/productSchema";
import { fieldsToColumns, rowToFormData, variantToChild, attributesToVariants } from "@/lib/masters/productMap";
import { generateBarcode, generateSku } from "@/lib/masters/variantCodes";

const PERM = "masters.product";
const hasVariant = (v: { label?: string; dims?: unknown[] }) => !!((v.label && v.label.trim()) || (v.dims && v.dims.length));

// GET /api/products/[id] — one product reshaped for the editor.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const id = Number(params.id);
  const product = await prisma.product.findFirst({ where: { id, tenantId: user.tenantId }, include: { attributes: true, children: { include: { attributes: true } } } });
  if (!product) return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json({ ok: true, productId: product.id, data: rowToFormData(product as any) });
}

// PUT /api/products/[id] — update (replaces variant attributes).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "Product", entityId: id });
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
  // Ownership guard — never let one tenant edit another's product.
  const owns = await prisma.product.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, businessId: true, branchId: true } });
  if (!owns) return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 });

  // Re-stamp business/branch: keep the product's existing branch unless the form
  // sends a new "Add to" choice (scopeBranchId), in which case re-target it.
  const raw = body as { scopeBranchId?: number | "all" };
  const seg = raw.scopeBranchId !== undefined ? await resolveWriteScope(user, raw.scopeBranchId) : null;
  const effBusinessId = seg ? seg.businessId : owns.businessId; // for stamping child variants
  const effBranchId = seg ? seg.branchId : owns.branchId;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: { ...(cols as Prisma.ProductUncheckedUpdateInput), ...(seg ? { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null } : {}) } });
      // Unique Code Generation: ensure a unique code + combination SKU + barcode.
      if (autoUnique) {
        const genCode = code.trim() || `PRD-${String(id).padStart(5, "0")}`;
        const genSku = String(cols.sku ?? "").trim() || generateSku({ category: cols.category as string | null, subCategory: cols.subCategory as string | null, group: cols.group as string | null, name, code: genCode });
        await tx.product.update({ where: { id }, data: { code: genCode, sku: genSku, barcode: generateBarcode(id) } });
      }
      await tx.productAttribute.deleteMany({ where: { productId: id } });
      const attrs = d.attributes.filter((a) => a.name?.trim());
      if (attrs.length) await tx.productAttribute.createMany({ data: attrs.map((a) => ({ productId: id, name: a.name || null, type: a.type || null, values: a.values || null })) });
      // Replace child variant products (cascade removes their attributes).
      await tx.product.deleteMany({ where: { parentId: id } });
      const explicit = d.variants.filter(hasVariant);
      const effVariants = explicit.length ? explicit : attributesToVariants(d.attributes);
      for (const v of effVariants) {
        const { cols: childCols, attributes } = variantToChild(cols, name, code, v);
        const child = await tx.product.create({
          data: { ...(childCols as Prisma.ProductUncheckedCreateInput), tenantId: user.tenantId, businessId: effBusinessId ?? undefined, branchId: effBranchId ?? undefined, parentId: id, attributes: { create: attributes } },
          select: { id: true },
        });
        await tx.product.update({ where: { id: child.id }, data: { barcode: generateBarcode(child.id) } });
      }
    });
    await writeAudit(prisma, user, {
      action: "product.update", entity: "Product", entityId: id,
      summary: `Updated product ${name || code || `#${id}`}`,
      meta: { name, code, category: cols.category ?? null, autoUnique },
      businessId: effBusinessId ?? null, branchId: effBranchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Product updated.", productId: id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 });
      if (err.code === "P2002") return NextResponse.json({ ok: false, message: "Product code already exists.", errors: { code: "This product code is already in use." } }, { status: 409 });
    }
    console.error("[products] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the product." }, { status: 500 });
  }
}

// DELETE /api/products/[id]
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "Product", entityId: id });
  if (denied) return denied;

  const existing = await prisma.product.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, name: true, code: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Product not found." }, { status: 404 });

  await prisma.product.delete({ where: { id } });
  await writeAudit(prisma, user, {
    action: "product.delete", entity: "Product", entityId: id,
    summary: `Deleted product ${existing.name || existing.code || `#${id}`}`,
    meta: { name: existing.name, code: existing.code },
    businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Product deleted." });
}

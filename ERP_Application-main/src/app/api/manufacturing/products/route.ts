import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import type { ManufacturingProductHit } from "@/lib/contracts/processingSet";

// GET /api/manufacturing/products?q=&category=Raw Material|Finished Product
// Lightweight product typeahead for Processing Set Configuration — restricts
// to leaf (sellable/receivable) products, optionally filtered by
// Product.inventoryCategory so the Raw Material field only offers Raw
// Material items and the Finished Goods table only offers Finished Products.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.ProductWhereInput = { ...sw, status: "Active", children: { none: {} } };
  if (category) where.inventoryCategory = category;
  if (q) where.OR = [{ name: { contains: q } }, { code: { contains: q } }, { sku: { contains: q } }];

  const products = await prisma.product.findMany({
    where, orderBy: { name: "asc" }, take: 30,
    select: { id: true, name: true, code: true, sku: true, baseUom: true },
  });

  const res: ManufacturingProductHit[] = products.map((p) => ({ id: p.id, name: p.name, sku: p.sku ?? p.code ?? "", uom: p.baseUom ?? "" }));
  return NextResponse.json({ ok: true, products: res });
}

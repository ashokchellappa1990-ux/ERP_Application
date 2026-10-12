import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { guardAnyPurchase } from "./_guard";

/** Shared lookup of OPEN purchase orders — used by the Purchase Invoice (direct bill) and
 *  the GRN to create a document "based on a PO". */
const OPEN = ["Approved", "Issued", "Partially Received"];
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/purchase/order/lookup?q= — open POs available to receive / invoice.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await guardAnyPurchase(user))) return NextResponse.json({ ok: false, message: "Not permitted." }, { status: 403 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.PurchaseOrderWhereInput = { ...sw, status: { in: OPEN } };
  if (q) where.OR = [{ poNo: { contains: q } }, { supplier: { contains: q } }, { quotationNo: { contains: q } }];
  const rows = await prisma.purchaseOrder.findMany({ where, orderBy: { id: "desc" }, take: 25, select: { id: true, poNo: true, poDate: true, supplier: true, supplierId: true, itemCount: true, netAmount: true, status: true, expectedDeliveryDate: true } });
  return NextResponse.json({ ok: true, rows: rows.map((r) => ({ ...r, supplier: r.supplier ?? "", netAmount: num(r.netAmount), expectedDeliveryDate: r.expectedDeliveryDate ?? "" })) });
}

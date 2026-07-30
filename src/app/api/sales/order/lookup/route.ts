import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { guardAnySales } from "./_guard";

/** Shared lookup of billable sales orders — used by the B2B Sales Invoice to
 *  create an invoice "based on a Sales Order". Confirmed-and-beyond, not closed. */
const OPEN = ["Confirmed", "Delivered", "Partially Delivered", "Invoiced"];
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/sales/order/lookup?q= — billable sales orders.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await guardAnySales(user))) return NextResponse.json({ ok: false, message: "Not permitted." }, { status: 403 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.SalesDocumentWhereInput = { ...sw, docType: "order", status: { in: OPEN } };
  if (q) where.OR = [{ docNo: { contains: q } }, { customerName: { contains: q } }, { customerGstin: { contains: q } }, { customerRef: { contains: q } }];
  const rows = await prisma.salesDocument.findMany({
    where, orderBy: { id: "desc" }, take: 25,
    select: { id: true, docNo: true, docDate: true, customerName: true, customerGstin: true, itemCount: true, totalValue: true, status: true, expectedDeliveryDate: true },
  });
  return NextResponse.json({ ok: true, rows: rows.map((r) => ({ id: r.id, docNo: r.docNo, docDate: r.docDate, customerName: r.customerName ?? "", customerGstin: r.customerGstin ?? "", itemCount: r.itemCount, netAmount: num(r.totalValue), status: r.status, expectedDeliveryDate: r.expectedDeliveryDate ?? "" })) });
}

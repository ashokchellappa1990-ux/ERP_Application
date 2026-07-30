import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { loadPiReturnContext, toPiReturnSource } from "@/lib/purchase/returnContext";
import type { PiReturnMatch } from "@/lib/contracts/purchaseReturn";

const num = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * GET /api/purchase/returns/invoice?q=<invoiceNo | supplier> | ?id=<piId>
 * Resolve the source purchase invoice for a return. `id` (or an exact invoice no)
 * → full invoice + returnable lines (with serials); free text → matching invoices.
 * Only Posted invoices are returnable.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "purchase.return");
  if (denied) return denied;

  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const q = (url.searchParams.get("q") ?? "").trim();
  const sw = scopeWhere(await getActiveScope(user), { branch: true }) as Prisma.PurchaseInvoiceWhereInput;

  // 1) Resolve a single invoice by id or exact invoice number.
  let piId: number | null = Number.isInteger(id) && id > 0 ? id : null;
  if (!piId && q) {
    const exact = await prisma.purchaseInvoice.findFirst({ where: { ...sw, invoiceNo: q }, select: { id: true } });
    piId = exact?.id ?? null;
  }
  if (piId) {
    const ctx = await loadPiReturnContext(user.tenantId, piId);
    if (ctx) {
      if (ctx.pi.status !== "Posted") return NextResponse.json({ ok: false, message: "Only a posted purchase invoice can be returned." }, { status: 422 });
      return NextResponse.json({ ok: true, source: toPiReturnSource(ctx) });
    }
  }

  if (!q) return NextResponse.json({ ok: true, matches: [] });

  // 2) Free-text search → posted invoices to choose from.
  const where: Prisma.PurchaseInvoiceWhereInput = { ...sw, status: "Posted", OR: [{ invoiceNo: { contains: q } }, { supplierInvoiceNo: { contains: q } }, { supplier: { contains: q } }] };
  const rows = await prisma.purchaseInvoice.findMany({ where, orderBy: { id: "desc" }, take: 20, select: { id: true, invoiceNo: true, supplierInvoiceDate: true, supplier: true, purchaseType: true, totalInvoiceAmount: true, itemCount: true } });
  const matches: PiReturnMatch[] = rows.map((s) => ({ id: s.id, invoiceNo: s.invoiceNo, invoiceDate: s.supplierInvoiceDate ?? "", supplier: s.supplier ?? "", purchaseType: s.purchaseType, total: num(s.totalInvoiceAmount), itemCount: s.itemCount }));
  return NextResponse.json({ ok: true, matches });
}

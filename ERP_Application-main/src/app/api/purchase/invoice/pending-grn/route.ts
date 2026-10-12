import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { grnGrandTotal } from "@/lib/purchase/createPurchaseInvoice";
import type { PendingGrnRow } from "@/lib/contracts/purchaseInvoice";

// GET /api/purchase/invoice/pending-grn — Posted GRNs not yet invoiced, for billing.
// Filters: q (grnNo/supplier/po), supplier, from, to, warehouse.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "purchase.invoice");
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const supplier = (url.searchParams.get("supplier") ?? "").trim();
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  const warehouse = (url.searchParams.get("warehouse") ?? "").trim();

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.GoodsReceiptNoteWhereInput = { ...sw, status: "Posted", invoiceRecorded: false };
  if (q) where.OR = [{ grnNo: { contains: q } }, { supplier: { contains: q } }, { poNo: { contains: q } }];
  if (supplier) where.supplier = supplier;
  if (warehouse) where.warehouse = { contains: warehouse };
  if (from || to) where.grnDate = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const grns = await prisma.goodsReceiptNote.findMany({ where, orderBy: { id: "desc" }, take: 100, include: { lines: true } });
  const rows: PendingGrnRow[] = grns.map((g) => ({
    id: g.id, grnNo: g.grnNo, grnDate: g.grnDate, supplier: g.supplier ?? "", poNo: g.poNo ?? "", warehouse: g.warehouse ?? "",
    lineCount: g.lineCount, grnAmount: grnGrandTotal(g),
  }));
  return NextResponse.json({ ok: true, rows });
}

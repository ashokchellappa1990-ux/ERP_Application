import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { grnGrandTotal } from "@/lib/purchase/createPurchaseInvoice";
import type { PendingGrnDetail } from "@/lib/contracts/purchaseInvoice";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/purchase/invoice/pending-grn/[id] — full GRN header + lines (read-only)
// to auto-load into the Add Purchase Invoice screen.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "purchase.invoice");
  if (denied) return denied;

  const g = await prisma.goodsReceiptNote.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!g) return NextResponse.json({ ok: false, message: "GRN not found." }, { status: 404 });

  const data: PendingGrnDetail = {
    id: g.id, grnNo: g.grnNo, grnDate: g.grnDate, supplier: g.supplier ?? "", supplierGstin: g.supplierGstin ?? "", poNo: g.poNo ?? "",
    businessId: g.businessId, branchId: g.branchId, warehouse: g.warehouse ?? "",
    subtotal: num(g.subtotal), taxTotal: num(g.taxTotal), freightAmount: num(g.freightAmount), otherCharges: num(g.otherCharges), roundOff: num(g.roundOff), grnAmount: grnGrandTotal(g),
    paymentTerms: g.paymentTerms ?? "", creditDays: g.creditDays, dueDate: g.dueDate ?? "",
    lines: g.lines.map((l) => {
      const gross = num(l.qty) * num(l.rate);
      const discAmount = l.discPct != null ? +(gross * (num(l.discPct) / 100)).toFixed(2) : 0;
      return {
        productId: l.productId, productName: l.productName, sku: l.sku ?? "", batchNo: l.batchNo ?? "", mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "",
        qty: num(l.qty), unitPrice: num(l.rate), taxPct: num(l.taxPct), taxAmount: num(l.taxAmount), discPct: num(l.discPct), discAmount, lineValue: num(l.value),
      };
    }),
  };
  return NextResponse.json({ ok: true, data });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { guardAnyPurchase } from "../_guard";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const s = (v: unknown) => (v == null ? "" : String(v));

// GET /api/purchase/order/lookup/[id] — a PO shaped for loading into a bill / GRN.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await guardAnyPurchase(user))) return NextResponse.json({ ok: false, message: "Not permitted." }, { status: 403 });

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const o = await prisma.purchaseOrder.findFirst({ where: { ...sw, id: Number(params.id) }, include: { items: { orderBy: { id: "asc" } } } });
  if (!o) return NextResponse.json({ ok: false, message: "Purchase order not found." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    data: {
      id: o.id, poNo: o.poNo, poDate: o.poDate, status: o.status,
      supplierId: o.supplierId, supplier: s(o.supplier), supplierGstin: s(o.supplierGstin), supplierContact: s(o.supplierContact),
      paymentTerms: s(o.paymentTerms), creditDays: o.creditDays, dueDate: s(o.dueDate), warehouse: s(o.warehouse), purchaseType: o.purchaseType, interState: o.interState,
      lines: o.items.map((it) => ({
        productId: it.productId, description: it.productName, sku: s(it.sku), hsn: s(it.hsn), uom: s(it.uom),
        qty: num(it.qty), rate: num(it.rate), taxPct: it.taxPct == null ? 0 : num(it.taxPct), discPct: it.discPct == null ? 0 : num(it.discPct),
        receivedQty: num(it.receivedQty),
      })),
    },
  });
}

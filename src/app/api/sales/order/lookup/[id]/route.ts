import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { guardAnySales } from "../_guard";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/sales/order/lookup/[id] — a sales order shaped for loading into the
// B2B Sales Invoice (customer + lines pre-filled).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await guardAnySales(user))) return NextResponse.json({ ok: false, message: "Not permitted." }, { status: 403 });

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const order = await prisma.salesDocument.findFirst({ where: { ...sw, id: Number(params.id), docType: "order" }, include: { items: true } });
  if (!order) return NextResponse.json({ ok: false, message: "Sales order not found." }, { status: 404 });

  // Prefer the live customer master record (for state / address needed by the
  // invoice); fall back to the values stored on the order.
  const cust = order.customerId ? await prisma.customer.findFirst({ where: { id: order.customerId, tenantId: user.tenantId } }) : null;
  const customer = {
    id: order.customerId ?? 0,
    name: cust?.name ?? order.customerName ?? "",
    gstin: cust?.gstin ?? order.customerGstin ?? "",
    phone: cust?.phone ?? order.customerPhone ?? "",
    email: cust?.email ?? "",
    contactPerson: cust?.contactPerson ?? order.customerContact ?? "",
    address: cust?.address ?? "",
    city: cust?.city ?? "",
    state: cust?.state ?? "",
    pincode: cust?.pincode ?? "",
  };

  return NextResponse.json({
    ok: true,
    order: {
      id: order.id, docNo: order.docNo, soNumber: order.docNo, interState: order.interState,
      paymentTerms: order.paymentTerms ?? "", dueDate: order.dueDate ?? "", termsConditions: order.termsConditions ?? "",
      customerId: order.customerId, customer,
      lines: order.items.sort((a, b) => a.id - b.id).map((it) => ({
        productId: it.productId ?? 0, name: it.productName, sku: it.sku ?? "", hsn: it.hsn ?? "", uom: it.uom ?? "",
        mrp: it.mrp != null ? num(it.mrp) : num(it.rate), rate: num(it.rate), gst: it.taxPct != null ? num(it.taxPct) : 0,
        qty: num(it.qty), disc: it.discPct != null ? num(it.discPct) : 0, discType: "pct" as const,
      })),
    },
  });
}

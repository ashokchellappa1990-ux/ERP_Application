import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { OpenInvoiceRow } from "@/lib/contracts/sale";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

// GET /api/sales/collection/open?customerId=N — the customer's open credit
// invoices (FIFO, oldest first) + customer info + total outstanding balance.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.collections");
  if (denied) return denied;

  const customerId = Number(new URL(req.url).searchParams.get("customerId")) || 0;
  if (!customerId) return NextResponse.json({ ok: true, customer: null, rows: [], totalBalance: 0 });

  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId: user.tenantId } });
  if (!customer) return NextResponse.json({ ok: false, message: "Customer not found." }, { status: 404 });

  // Oldest invoices first (creation priority) so auto-allocation is FIFO.
  const sales = await prisma.sale.findMany({
    where: { tenantId: user.tenantId, customerId, status: { not: "Cancelled" }, paymentStatus: { in: ["Credit", "Partial"] } },
    orderBy: { id: "asc" },
    select: { id: true, invoiceNo: true, channel: true, saleDate: true, dueDate: true, total: true, tdsAmount: true, amountPaid: true, paymentStatus: true },
  });

  const today = new Date().toISOString().slice(0, 10);
  const rows: OpenInvoiceRow[] = sales.map((s) => {
    const payable = r2(num(s.total) - num(s.tdsAmount));
    const balance = r2(payable - num(s.amountPaid));
    return {
      saleId: s.id, invoiceNo: s.invoiceNo, channel: s.channel, saleDate: s.saleDate, dueDate: s.dueDate ?? "",
      totalAmount: payable, paidAmount: num(s.amountPaid), balanceAmount: balance, status: s.paymentStatus,
      overdue: !!(s.dueDate && s.dueDate < today),
    };
  }).filter((r) => r.balanceAmount > 0);

  const totalBalance = r2(rows.reduce((a, r) => a + r.balanceAmount, 0));

  return NextResponse.json({
    ok: true,
    customer: {
      id: customer.id, name: customer.name, phone: customer.phone ?? "", email: customer.email ?? "", gstin: customer.gstin ?? "",
      address: customer.address ?? "", city: customer.city ?? "", state: customer.state ?? "", pincode: customer.pincode ?? "",
      contactPerson: customer.contactPerson ?? "",
    },
    rows, totalBalance,
  });
}

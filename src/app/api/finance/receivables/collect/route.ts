import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { postReceiptJournal } from "@/lib/accounting/post";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);
const PERM = "finance.receivables";

// POST /api/finance/receivables/collect — record a customer collection against a
// sale's outstanding balance: adds the tender, updates the sale, and posts a
// RECEIPT voucher (Dr Cash/Bank, Cr Accounts Receivable).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "SalePayment" });
  if (denied) return denied;

  let body: { saleId?: number; amount?: number | string; mode?: string; reference?: string; date?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const saleId = Number(body.saleId);
  const amount = r2(num(body.amount));
  if (!saleId || amount <= 0) return NextResponse.json({ ok: false, message: "Enter a valid collection amount." }, { status: 422 });

  const sale = await prisma.sale.findFirst({ where: { id: saleId, tenantId: user.tenantId } });
  if (!sale) return NextResponse.json({ ok: false, message: "Invoice not found." }, { status: 404 });
  if (sale.status === "Cancelled") return NextResponse.json({ ok: false, message: "Invoice is cancelled." }, { status: 422 });

  const payable = r2(num(sale.total) - num(sale.tdsAmount));
  const balance = r2(payable - num(sale.amountPaid));
  if (balance <= 0) return NextResponse.json({ ok: false, message: "This invoice is already fully collected." }, { status: 422 });
  if (amount > balance + 0.01) return NextResponse.json({ ok: false, message: `Amount exceeds the outstanding balance (${balance}).` }, { status: 422 });

  const mode = String(body.mode || "Bank Transfer");
  const date = (body.date || new Date().toISOString().slice(0, 10)).slice(0, 10);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.salePayment.create({ data: { saleId: sale.id, mode, amount, reference: body.reference || null } });
      const newPaid = r2(num(sale.amountPaid) + amount);
      const paymentStatus = newPaid >= payable - 0.01 ? "Paid" : "Partial";
      await tx.sale.update({ where: { id: sale.id }, data: { amountPaid: newPaid, paymentStatus } });
      await postReceiptJournal(tx, {
        tenantId: user.tenantId, date, refNo: sale.invoiceNo, saleId: sale.id, customerName: sale.customerName,
        amount, mode, createdBy: user.id,
      });
      return { newPaid, paymentStatus, balance: r2(payable - newPaid) };
    });
    await writeAudit(prisma, user, {
      action: "receivable.collect", entity: "SalePayment", entityId: sale.id,
      summary: `Collected ${amount.toFixed(2)} against ${sale.invoiceNo}${sale.customerName ? ` — ${sale.customerName}` : ""}`,
      meta: { saleId: sale.id, invoiceNo: sale.invoiceNo, amount, mode, paymentStatus: result.paymentStatus, balance: result.balance },
      businessId: sale.businessId ?? null, branchId: sale.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Collection recorded.", ...result }, { status: 201 });
  } catch (err) {
    console.error("[receivables] collect error", err);
    return NextResponse.json({ ok: false, message: "Could not record the collection." }, { status: 500 });
  }
}

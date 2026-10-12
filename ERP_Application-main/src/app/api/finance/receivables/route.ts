import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { groupByParty } from "@/lib/finance/aging";
import type { ReceivableRow, ReceivableStats } from "@/lib/contracts/finance";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);
const PERM = "finance.receivables";

// GET /api/finance/receivables — customer receivables, derived from sales that
// still have an outstanding balance (credit / partly collected). Tenant-scoped.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";

  // Outstanding = not fully paid and not cancelled. "Paid" filter shows settled credit sales.
  const where: Prisma.SaleWhereInput = { ...scopeWhere(await getActiveScope(user), { branch: true }), status: { not: "Cancelled" } };
  if (status === "All") where.paymentStatus = { in: ["Credit", "Partial"] };
  else where.paymentStatus = status; // Credit | Partial | Paid
  if (status === "Paid") where.channel = "B2B"; // only credit-origin (B2B) settled invoices
  if (q) where.OR = [{ invoiceNo: { contains: q } }, { customerName: { contains: q } }, { customerGstin: { contains: q } }];

  const sales = await prisma.sale.findMany({
    where, orderBy: [{ dueDate: "asc" }, { id: "desc" }], take: 300,
    select: { id: true, invoiceNo: true, channel: true, saleDate: true, dueDate: true, paymentTerms: true, customerName: true, customerGstin: true, total: true, tdsAmount: true, amountPaid: true, paymentStatus: true },
  });

  const today = new Date().toISOString().slice(0, 10);
  const rows: ReceivableRow[] = sales.map((s) => {
    const payable = r2(num(s.total) - num(s.tdsAmount)); // amount the customer must pay (TDS withheld)
    const balance = r2(payable - num(s.amountPaid));
    const overdue = !!(s.dueDate && s.dueDate < today && s.paymentStatus !== "Paid");
    return {
      id: s.id, channel: s.channel, refNo: s.invoiceNo, customer: s.customerName ?? "—", gstin: s.customerGstin ?? "",
      docDate: s.saleDate ?? "", dueDate: s.dueDate ?? "", paymentTerms: s.paymentTerms ?? "",
      totalAmount: payable, paidAmount: num(s.amountPaid), balanceAmount: balance, status: s.paymentStatus, overdue,
    };
  });

  // Un-invoiced dispatch-level receivables — Accounting Configuration's
  // Customer Receivable Creation can recognize a Customer Receivable at
  // Complete Load & Dispatch time (Dispatch Accounting Voucher), before any
  // Sales Invoice exists. Those dispatches have no Sale row at all, so they'd
  // otherwise be invisible here despite the GL already carrying the balance.
  if (status === "All" || status === "Credit") {
    const dispatchWhere: Prisma.LoadDispatchWhereInput = {
      ...scopeWhere(await getActiveScope(user), { branch: true }),
      docType: "Customer", saleId: null, dispatchReceivableAmount: { gt: 0 }, deletedAt: null,
    };
    if (q) dispatchWhere.OR = [{ dispatchNo: { contains: q } }, { partyName: { contains: q } }];
    const dispatches = await prisma.loadDispatch.findMany({
      where: dispatchWhere, orderBy: { id: "desc" }, take: 300,
      select: { id: true, dispatchNo: true, dispatchDate: true, partyName: true, dispatchReceivableAmount: true },
    });
    for (const d of dispatches) {
      const amount = r2(num(d.dispatchReceivableAmount));
      rows.push({
        id: d.id, channel: "Dispatch", refNo: d.dispatchNo, customer: d.partyName ?? "—", gstin: "",
        docDate: d.dispatchDate, dueDate: "", paymentTerms: "",
        totalAmount: amount, paidAmount: 0, balanceAmount: amount, status: "Credit", overdue: false,
        source: "dispatch", loadDispatchId: d.id,
      });
    }
  }

  // Outstanding-only rows drive the customer grouping + aging.
  const openR = rows.filter((r) => r.status !== "Paid" && r.balanceAmount > 0.01);
  const { groups, aging } = groupByParty(openR.map((r) => ({ party: r.customer, gstin: r.gstin, billed: r.totalAmount, paid: r.paidAmount, balance: r.balanceAmount, dueDate: r.dueDate || null, overdue: r.overdue })), today);

  const outstanding = r2(rows.reduce((a, r) => a + r.balanceAmount, 0));
  const overdueAmt = r2(rows.filter((r) => r.overdue).reduce((a, r) => a + r.balanceAmount, 0));
  const billed = r2(rows.reduce((a, r) => a + r.totalAmount, 0));
  const collected = r2(rows.reduce((a, r) => a + r.paidAmount, 0));
  const open = rows.filter((r) => r.status !== "Paid").length;

  const stats: ReceivableStats = { open, outstanding, overdue: overdueAmt, billed, collected, aging };
  return NextResponse.json({ ok: true, rows, groups, stats });
}

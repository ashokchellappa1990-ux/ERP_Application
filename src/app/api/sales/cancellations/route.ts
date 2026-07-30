import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";
import { stampTerminal, getActiveTerminalContext } from "@/lib/pos/terminalContext";
import { getCancellationConfig } from "@/lib/sales/cancellationConfig";
import { createCancellationTx } from "@/lib/sales/createCancellation";
import { SalesCancellationCreateSchema, type SalesCancellationRow } from "@/lib/contracts/salesCancellation";

const PERM = "sales.cancellation";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/sales/cancellations — list + stats (scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.SalesCancellationWhereInput = { ...sw };
  if (q) where.OR = [{ cancellationNo: { contains: q } }, { invoiceNo: { contains: q } }, { customerName: { contains: q } }];
  if (status !== "All") where.status = status;

  const [rows, total, pendingApproval, agg] = await Promise.all([
    prisma.salesCancellation.findMany({ where, orderBy: { id: "desc" }, take: 100 }),
    prisma.salesCancellation.count({ where: sw }),
    prisma.salesCancellation.count({ where: { ...sw, status: "Pending Approval" } }),
    prisma.salesCancellation.aggregate({ where: { ...sw, status: "Approved" }, _sum: { invoiceAmount: true } }),
  ]);
  const shaped: SalesCancellationRow[] = rows.map((r) => ({
    id: r.id, cancellationNo: r.cancellationNo, cancellationDate: r.cancellationDate, invoiceNo: r.invoiceNo ?? "",
    customerName: r.customerName ?? "Walk-in", channel: r.channel ?? "", invoiceAmount: num(r.invoiceAmount), refundAmount: num(r.refundAmount),
    paymentMode: r.paymentMode ?? "", status: r.status, createdAt: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ ok: true, rows: shaped, stats: { total, pendingApproval, cancelledAmount: num(agg._sum.invoiceAmount) } });
}

// POST /api/sales/cancellations — cancel an entire sales invoice.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "SalesCancellation" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = SalesCancellationCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const cfg = await getCancellationConfig(user);
  if (!cfg.cancellationAllowed) return NextResponse.json({ ok: false, message: "Sales Cancellation is turned off in Sales Configuration." }, { status: 422 });
  if (cfg.reasonMandatory && !(body.reason ?? "").trim()) return NextResponse.json({ ok: false, message: "A cancellation reason is required." }, { status: 422 });
  if (cfg.remarksMandatory && !(body.remarks ?? "").trim()) return NextResponse.json({ ok: false, message: "Remarks are required." }, { status: 422 });

  const sale = await prisma.sale.findFirst({ where: { id: body.saleId, tenantId: user.tenantId }, include: { lines: true, payments: true } });
  if (!sale) return NextResponse.json({ ok: false, message: "Original invoice not found." }, { status: 404 });

  // ---- Business validation ----
  if (sale.status !== "Completed") return NextResponse.json({ ok: false, message: `Invoice is ${sale.status} — it cannot be cancelled.` }, { status: 422 });
  const returns = await prisma.salesReturn.count({ where: { saleId: sale.id, status: { not: "Rejected" } } });
  if (returns > 0) return NextResponse.json({ ok: false, message: "Invoice already has a return/exchange — cancel those first." }, { status: 422 });

  // Time restriction (max cancellation period vs the sale).
  const periodErr = checkPeriod(cfg.maxCancellationPeriod, sale.saleDate, sale.createdAt);
  if (periodErr) return NextResponse.json({ ok: false, message: periodErr }, { status: 422 });

  // After-day-close restriction.
  if (!cfg.allowAfterDayClose) {
    const closed = await prisma.dayClosing.findFirst({ where: { tenantId: user.tenantId, branchId: sale.branchId ?? undefined, status: "Closed", closingDate: { gte: sale.saleDate } }, select: { id: true } });
    if (closed) return NextResponse.json({ ok: false, message: "The business day for this invoice is already closed — cancellation after day close is not allowed." }, { status: 422 });
  }

  const invoiceAmount = num(sale.total);
  const status = cfg.approvalEnabled && cfg.approvalAutoLimit > 0 && invoiceAmount > cfg.approvalAutoLimit ? "Pending Approval" : "Approved";
  const seg = scopeData(await getActiveScope(user), { branch: true });
  const stamp = stampTerminal(await getActiveTerminalContext(user), "WEB_POS");
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await prisma.$transaction((tx) => createCancellationTx(tx, {
      user, seg, stamp, sale, cfg, status, cancellationDate: today,
      reason: body.reason || null, remarks: body.remarks || null,
      refundMethod: body.refundMethod || cfg.defaultRefund, refundAmount: num(sale.amountPaid),
    }));
    await writeAudit(prisma, user, {
      action: "sales_cancellation.create", entity: "SalesCancellation", entityId: result.id,
      summary: `Cancelled invoice ${sale.invoiceNo} — ${invoiceAmount.toFixed(2)} (${result.status})`,
      meta: { saleId: sale.id, invoiceNo: sale.invoiceNo, invoiceAmount, reason: body.reason || null, status: result.status },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: result.status === "Pending Approval" ? "Cancellation saved — pending approval." : "Sales invoice cancelled.", ...result }, { status: 201 });
  } catch (err) {
    console.error("[sales-cancellation] create error", err);
    return NextResponse.json({ ok: false, message: "Could not cancel the invoice." }, { status: 500 });
  }
}

/** Max-cancellation-period check. Returns an error string or null. */
function checkPeriod(period: string, saleDate: string, createdAt: Date): string | null {
  const p = (period || "").trim().toLowerCase();
  if (!p || p === "unlimited") return null;
  const today = new Date().toISOString().slice(0, 10);
  if (p === "sameday") return saleDate === today ? null : "Cancellation is only allowed on the same business day as the sale.";
  let minutes = 0;
  if (p.endsWith("hr") || p.endsWith("hour") || p.endsWith("hours")) minutes = (parseFloat(p) || 0) * 60;
  else if (p.endsWith("min") || p.endsWith("minutes")) minutes = parseFloat(p) || 0;
  else minutes = Number(p) || 0; // bare number = minutes
  if (minutes <= 0) return null;
  const elapsed = (Date.now() - createdAt.getTime()) / 60000;
  return elapsed <= minutes ? null : `Cancellation window of ${period} has passed for this invoice.`;
}

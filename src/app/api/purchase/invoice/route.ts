import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { stampTerminal, getActiveTerminalContext } from "@/lib/pos/terminalContext";
import { getPurchaseInvoiceConfig } from "@/lib/purchase/purchaseInvoiceConfig";
import { buildInvoiceFromGrns, buildDirectInvoice, postPurchaseInvoiceTx, type GrnWithLines } from "@/lib/purchase/createPurchaseInvoice";
import { PurchaseInvoiceCreateSchema, type PurchaseInvoiceRow } from "@/lib/contracts/purchaseInvoice";

const PERM = "purchase.invoice";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/purchase/invoice — list + stats (scoped). Payment status derived from
// the linked Payable (the invoice takes over the GRN's outstanding).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.PurchaseInvoiceWhereInput = { ...sw };
  if (q) where.OR = [{ invoiceNo: { contains: q } }, { supplierInvoiceNo: { contains: q } }, { supplier: { contains: q } }];
  if (status !== "All") where.status = status;

  const [rows, total, pendingApproval, payAgg] = await Promise.all([
    prisma.purchaseInvoice.findMany({ where, orderBy: { id: "desc" }, take: 100, include: { grnMap: { select: { grnNo: true } } } }),
    prisma.purchaseInvoice.count({ where: sw }),
    prisma.purchaseInvoice.count({ where: { ...sw, status: "Pending Approval" } }),
    prisma.payable.aggregate({ where: { ...sw, sourceType: "PURCHASE_INVOICE" }, _sum: { balanceAmount: true, paidAmount: true } }),
  ]);

  // Map each invoice → its payable (for the per-row payment badge).
  const ids = rows.map((r) => r.id);
  const payables = ids.length ? await prisma.payable.findMany({ where: { tenantId: user.tenantId, sourceType: "PURCHASE_INVOICE", sourceId: { in: ids } }, select: { sourceId: true, paidAmount: true, balanceAmount: true } }) : [];
  const payMap = new Map(payables.map((p) => [p.sourceId, p]));

  const shaped: PurchaseInvoiceRow[] = rows.map((r) => {
    const p = payMap.get(r.id);
    const balance = p ? num(p.balanceAmount) : (r.status === "Posted" ? 0 : num(r.netPayable));
    const paymentStatus = r.status !== "Posted" ? "—" : !p ? "Fully Paid" : num(p.balanceAmount) <= 0.01 ? "Fully Paid" : num(p.paidAmount) > 0 ? "Partially Paid" : "Unpaid";
    return {
      id: r.id, invoiceNo: r.invoiceNo, invoiceType: r.invoiceType, supplierInvoiceNo: r.supplierInvoiceNo ?? "", supplierInvoiceDate: r.supplierInvoiceDate ?? "",
      supplier: r.supplier ?? "", grnNos: r.invoiceType === "Direct" ? (r.grnRef ?? "") : r.grnMap.map((g) => g.grnNo).join(", "), netPayable: num(r.netPayable),
      status: r.status, paymentStatus, balanceAmount: balance, createdAt: r.createdAt.toISOString(),
    };
  });
  const stats = { total, pendingApproval, outstanding: num(payAgg._sum.balanceAmount), paid: num(payAgg._sum.paidAmount) };
  return NextResponse.json({ ok: true, rows: shaped, stats });
}

// POST /api/purchase/invoice — record a supplier bill against one or more posted GRNs.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "PurchaseInvoice" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = PurchaseInvoiceCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const cfg = await getPurchaseInvoiceConfig(user);
  if (!cfg.enablePurchaseInvoice) return NextResponse.json({ ok: false, message: "Purchase Invoice is turned off in Purchase Configuration." }, { status: 422 });

  // Mandatory-field gates.
  if (cfg.invoiceNoMandatory && !body.supplierInvoiceNo) return NextResponse.json({ ok: false, message: "Supplier invoice number is required." }, { status: 422 });
  if (cfg.invoiceDateMandatory && !body.supplierInvoiceDate) return NextResponse.json({ ok: false, message: "Supplier invoice date is required." }, { status: 422 });
  if (cfg.dueDateMandatory && !body.dueDate) return NextResponse.json({ ok: false, message: "Due date is required." }, { status: 422 });
  if (cfg.billAttachmentMandatory && !body.attachments.length) return NextResponse.json({ ok: false, message: "A supplier bill attachment is required." }, { status: 422 });

  // Resolve the supplier + lines per invoice type, then build the bill.
  let grns: GrnWithLines[] = [];
  let built;
  if (body.invoiceType === "Direct") {
    if (!body.supplierName?.trim()) return NextResponse.json({ ok: false, message: "Select a supplier for the bill." }, { status: 422 });
    if (!body.lines.length) return NextResponse.json({ ok: false, message: "Add at least one line item to the bill." }, { status: 422 });
    built = buildDirectInvoice(body, cfg);
  } else {
    if (!body.grnIds.length) return NextResponse.json({ ok: false, message: "Select a GRN to invoice." }, { status: 422 });
    const sw = scopeWhere(await getActiveScope(user), { branch: true });
    grns = await prisma.goodsReceiptNote.findMany({ where: { ...sw, id: { in: body.grnIds } }, include: { lines: { orderBy: { id: "asc" } } } }) as GrnWithLines[];
    if (grns.length !== body.grnIds.length) return NextResponse.json({ ok: false, message: "One or more selected GRNs were not found." }, { status: 404 });
    built = buildInvoiceFromGrns(grns, body, cfg);
  }
  if ("error" in built) return NextResponse.json({ ok: false, message: built.error }, { status: 422 });

  // Duplicate supplier invoice number per supplier.
  if (body.supplierInvoiceNo && built.supplier) {
    const dup = await prisma.purchaseInvoice.findFirst({ where: { tenantId: user.tenantId, supplier: built.supplier, supplierInvoiceNo: body.supplierInvoiceNo, status: { not: "Cancelled" } }, select: { id: true, invoiceNo: true } });
    if (dup) return NextResponse.json({ ok: false, message: `Supplier invoice ${body.supplierInvoiceNo} is already recorded (${dup.invoiceNo}).` }, { status: 422 });
  }

  const status = cfg.approvalRequired ? "Pending Approval" : "Posted";
  const seg = scopeData(await getActiveScope(user), { branch: true });
  const stamp = stampTerminal(await getActiveTerminalContext(user), "WEB_POS");

  try {
    const result = await prisma.$transaction((tx) => postPurchaseInvoiceTx(tx, { user, seg, stamp, input: body, built, grns, cfg, status }));
    await writeAudit(prisma, user, {
      action: "purchase_invoice.create", entity: "PurchaseInvoice", entityId: result.id,
      summary: `Purchase invoice ${result.invoiceNo} (${built.invoiceType}) ${built.invoiceType === "GRN" ? `vs ${built.grns.map((g) => g.grnNo).join(", ")}` : `— ${built.supplier}`} — ${built.netPayable.toFixed(2)} (${result.status})`,
      meta: { invoiceNo: result.invoiceNo, invoiceType: built.invoiceType, supplier: built.supplier, grnIds: body.grnIds, netPayable: built.netPayable, status: result.status },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: result.status === "Pending Approval" ? "Invoice saved — pending approval." : "Purchase invoice recorded.", ...result }, { status: 201 });
  } catch (err) {
    console.error("[purchase-invoice] create error", err);
    return NextResponse.json({ ok: false, message: "Could not record the purchase invoice." }, { status: 500 });
  }
}

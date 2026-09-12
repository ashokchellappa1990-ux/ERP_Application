import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { paymentCollectionInput } from "@/lib/contracts/loadDispatch";
import { getDispatchConfig } from "@/lib/settings/dispatchConfig";
import { roundInvoiceTotal } from "@/lib/settings/transportConfigDefaults";

const PERM = "warehouse.transfer";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// PATCH /api/warehouse/load-dispatch/[id]/payment — lets Payment Collection
// (Payment Type / Amount Received / Payment Mode / Bank) be entered or
// corrected AFTER the dispatch has left (Dispatched / Delivery Challan
// Generated) — real-world collection is frequently only known once the
// vehicle has actually gone, well after the main record left Draft/Ready/
// Loading and the general PUT route locked. The main PUT route stays the
// path for Draft/Ready/Loading edits; this route only ever touches payment
// fields, and only up to the moment the Sales Invoice actually posts —
// buildPreparedSale() (src/lib/transport/loadDispatch.ts) reads these columns
// fresh at that instant, so whatever is saved here is exactly what flows into
// the posted invoice's Cash/Bank/Receivable split.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "LoadDispatch", entityId: id });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = paymentCollectionInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const input = parsed.data;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const doc = await prisma.loadDispatch.findFirst({
    where: { ...sw, id, deletedAt: null },
    select: { id: true, dispatchNo: true, status: true, businessId: true, branchId: true, saleId: true, vehicleRent: true, transitPassAmount: true, paymentMode: true, paymentAmount: true },
  });
  if (!doc) return NextResponse.json({ ok: false, message: "Load & Dispatch not found." }, { status: 404 });
  if (doc.status === "Cancelled") return NextResponse.json({ ok: false, message: "This dispatch is cancelled." }, { status: 422 });
  if (doc.saleId) return NextResponse.json({ ok: false, message: "The Sales Invoice has already posted — Payment Collection can no longer be changed here." }, { status: 422 });

  // "Full Collection" with no explicit amount means "collect whatever the
  // final total is" — resolve it the same way the view screen displays it.
  let paymentAmount = input.paymentAmount ?? null;
  if (input.paymentMode === "Full" && input.paymentAmount == null) {
    const cfg = await getDispatchConfig(user);
    const agg = await prisma.loadDispatchItem.aggregate({ where: { loadDispatchId: id }, _sum: { taxableValue: true, taxAmount: true } });
    const itemsGrandTotal = num(agg._sum.taxableValue) + num(agg._sum.taxAmount);
    paymentAmount = roundInvoiceTotal(cfg, itemsGrandTotal + num(doc.vehicleRent) + num(doc.transitPassAmount)).total;
  } else if (input.paymentMode === "Credit") {
    paymentAmount = 0;
  }

  const paymentSplits = input.paymentSplits?.length ? input.paymentSplits : null;
  await prisma.loadDispatch.update({
    where: { id },
    data: {
      paymentMode: input.paymentMode, paymentAmount, paymentMethod: input.paymentMethod ?? null,
      bankId: input.bankId ?? null, bankName: input.bankName ?? null, bankAccount: input.bankAccount ?? null,
      paymentSplits: paymentSplits ?? Prisma.DbNull,
      updatedBy: user.id,
    },
  });
  await writeAudit(prisma, user, {
    action: "load_dispatch.payment.update", entity: "LoadDispatch", entityId: id,
    summary: `Payment Collection updated for ${doc.dispatchNo} — ${input.paymentMode}${paymentAmount != null ? ` (₹${paymentAmount})` : ""}`,
    meta: { from: { paymentMode: doc.paymentMode, paymentAmount: doc.paymentAmount }, to: { paymentMode: input.paymentMode, paymentAmount } },
    businessId: doc.businessId ?? null, branchId: doc.branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Payment Collection updated.", paymentMode: input.paymentMode, paymentAmount });
}

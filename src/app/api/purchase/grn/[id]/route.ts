import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { buildGrnPayload, validateBatchTracking } from "@/lib/grn/grnPayload";
import { syncGrnPayable } from "@/lib/grn/payable";
import { generateLineQr } from "@/lib/qr/generate";
import { reverseRef } from "@/lib/inventory/ledger";
import type { GrnDetail, GrnStatus } from "@/lib/contracts/grn";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const PERM = "purchase.grn";

// GET /api/purchase/grn/[id]
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const grn = await prisma.goodsReceiptNote.findFirst({
    where: { id: Number(params.id), tenantId: user.tenantId },
    include: { lines: { orderBy: { id: "asc" } } },
  });
  if (!grn) return NextResponse.json({ ok: false, message: "GRN not found." }, { status: 404 });

  const prods = await prisma.product.findMany({ where: { id: { in: grn.lines.map((l) => l.productId) } }, select: { id: true, qrRequired: true } });
  const qrReqMap = new Map(prods.map((p) => [p.id, p.qrRequired]));

  const gateEntry = grn.gateEntryId
    ? await prisma.vehicleGateEntry.findFirst({ where: { id: grn.gateEntryId, tenantId: user.tenantId }, select: { gateEntryNo: true, grossWeight: true, status: true } })
    : null;

  const data: GrnDetail = {
      id: grn.id, grnNo: grn.grnNo, status: grn.status as GrnStatus, grnDate: grn.grnDate,
      supplier: grn.supplier ?? "", supplierGstin: grn.supplierGstin ?? "", supplierContact: grn.supplierContact ?? "",
      supplierInvoiceNo: grn.supplierInvoiceNo ?? "", supplierInvoiceDate: grn.supplierInvoiceDate ?? "",
      poNo: grn.poNo ?? "", warehouse: grn.warehouse ?? "", notes: grn.notes ?? "",
      gstMode: grn.gstMode, gstPct: grn.gstPct != null ? num(grn.gstPct) : "",
      subtotal: num(grn.subtotal), taxTotal: num(grn.taxTotal), freightAmount: num(grn.freightAmount),
      otherCharges: num(grn.otherCharges), roundOff: num(grn.roundOff), totalInvoiceValue: num(grn.totalInvoiceValue),
      paymentStatus: grn.paymentStatus, amountPaid: num(grn.amountPaid), paymentMode: grn.paymentMode ?? "",
      paymentRef: grn.paymentRef ?? "", paymentDate: grn.paymentDate ?? "", paymentTerms: grn.paymentTerms ?? "",
      creditDays: grn.creditDays ?? "", dueDate: grn.dueDate ?? "",
      transporterName: grn.transporterName ?? "", transportMode: grn.transportMode ?? "", transportType: grn.transportType ?? "", vehicleNo: grn.vehicleNo ?? "",
      lrNo: grn.lrNo ?? "", ewayBillNo: grn.ewayBillNo ?? "", freightPaidBy: grn.freightPaidBy ?? "",
      numPackages: grn.numPackages ?? "", transportRemarks: grn.transportRemarks ?? "", weightSlipRefNo: grn.weightSlipRefNo ?? "",
      inventoryMovement: grn.inventoryMovement ?? "", vehicleOwnerType: grn.vehicleOwnerType ?? "",
      tareWeight: grn.tareWeight != null ? num(grn.tareWeight) : "", grossWeight: grn.grossWeight != null ? num(grn.grossWeight) : "",
      netWeight: grn.netWeight != null ? num(grn.netWeight) : "", billNetWeight: grn.billNetWeight != null ? num(grn.billNetWeight) : "",
      weightUom: grn.weightUom ?? "",
      emptyWeight: grn.emptyWeight != null ? num(grn.emptyWeight) : "", emptyWeightAt: grn.emptyWeightAt ? grn.emptyWeightAt.toISOString() : "",
      emptyWeightRemarks: grn.emptyWeightRemarks ?? "",
      invoiceRecorded: grn.invoiceRecorded, purchaseInvoiceId: grn.purchaseInvoiceId,
      totalQty: num(grn.totalQty), totalValue: num(grn.totalValue), lineCount: grn.lineCount,
      gateEntryId: grn.gateEntryId ?? null,
      gateEntry: gateEntry ? { gateEntryNo: gateEntry.gateEntryNo, grossWeight: gateEntry.grossWeight != null ? num(gateEntry.grossWeight) : null, status: gateEntry.status } : null,
      lines: grn.lines.map((l) => ({
        id: l.id, productId: l.productId, productName: l.productName, sku: l.sku ?? "", uom: l.uom ?? "", category: l.category ?? "",
        qty: num(l.qty), freeQty: l.freeQty != null ? num(l.freeQty) : "", rate: l.rate != null ? num(l.rate) : "",
        sellingPrice: l.sellingPrice != null ? num(l.sellingPrice) : "",
        discPct: l.discPct != null ? num(l.discPct) : "", taxPct: l.taxPct != null ? num(l.taxPct) : "", value: num(l.value),
        mrp: l.mrp != null ? num(l.mrp) : "", batchNo: l.batchNo ?? "", mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "",
        remarks: l.remarks ?? "", qrMode: l.qrMode as "shared" | "unique", qrStatus: l.qrStatus as "Pending" | "Generated" | "Not Required", qrGeneratedCount: l.qrGeneratedCount, printedQty: l.printedQty,
        qrRequired: qrReqMap.get(l.productId) !== false,
      })),
  };
  return NextResponse.json({ ok: true, data });
}

// PUT /api/purchase/grn/[id] — replace lines; re-post inventory when Posted.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "GoodsReceiptNote", entityId: id });
  if (denied) return denied;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const built = buildGrnPayload(body);
  if ("error" in built) return NextResponse.json({ ok: false, message: built.error }, { status: 422 });
  const { header, lines, post, productIds, grandTotal, amountPaid } = built;

  const prods = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: user.tenantId }, select: { id: true, invBatch: true, invMfg: true, invExpiry: true, qrRequired: true } });
  if (prods.length !== productIds.length) return NextResponse.json({ ok: false, message: "One or more products are not in your catalog." }, { status: 422 });
  // Batch-tracked products must carry batch / mfg / expiry on every GRN line.
  const trackErr = validateBatchTracking(lines, new Map(prods.map((p) => [p.id, { invBatch: p.invBatch, invMfg: p.invMfg, invExpiry: p.invExpiry }])));
  if (trackErr) return NextResponse.json({ ok: false, message: trackErr }, { status: 422 });
  const qrRequiredMap = new Map(prods.map((p) => [p.id, p.qrRequired]));

  const existing = await prisma.goodsReceiptNote.findFirst({ where: { id, tenantId: user.tenantId }, include: { lines: { select: { id: true } } } });
  if (!existing) return NextResponse.json({ ok: false, message: "GRN not found." }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      // Undo prior inventory postings + QR for the old lines, then replace them.
      for (const l of existing.lines) await reverseRef(tx, user.tenantId, "GRN", l.id);
      await tx.qrCodeMapping.deleteMany({ where: { sourceType: "GRN", sourceId: { in: existing.lines.map((l) => l.id) } } });
      await tx.goodsReceiptLine.deleteMany({ where: { grnId: id } });

      const grn = await tx.goodsReceiptNote.update({ where: { id }, data: { ...header, lines: { create: lines } }, include: { lines: true } });

      if (post) {
        const setting = (await tx.qrCodeSetting.findFirst({ where: { tenantId: user.tenantId, businessId: grn.businessId, branchId: grn.branchId } })) ?? (await tx.qrCodeSetting.create({ data: { tenantId: user.tenantId, businessId: grn.businessId, branchId: grn.branchId } }));
        let seq = setting.nextSequence;
        for (const line of grn.lines) {
          const qrRequired = qrRequiredMap.get(line.productId) !== false;
          const r = await generateLineQr(tx, {
            tenantId: user.tenantId, businessId: grn.businessId, branchId: grn.branchId, format: setting, sourceType: "GRN", sourceId: line.id,
            productId: line.productId, sku: line.sku, docNo: grn.grnNo, qty: Number(line.qty), mode: !qrRequired ? "none" : line.qrMode === "unique" ? "unique" : "shared",
            txnType: "PURCHASE", refType: "GRN", refNo: grn.grnNo, txnDate: header.grnDate,
            rate: line.rate != null ? Number(line.rate) : null, sellingRate: line.sellingPrice != null ? Number(line.sellingPrice) : null,
            warehouse: header.warehouse, batchNo: line.batchNo, mfgDate: line.mfgDate,
            expiryDate: line.expiryDate, purchaseDate: header.supplierInvoiceDate ?? header.grnDate, grnId: grn.id, createdBy: user.id,
          }, seq);
          seq = r.endSeq;
          await tx.goodsReceiptLine.update({ where: { id: line.id }, data: { qrStatus: qrRequired ? "Generated" : "Not Required", qrGeneratedCount: r.count, printedQty: 0 } });
        }
        await tx.qrCodeSetting.update({ where: { id: setting.id }, data: { nextSequence: seq } });
      }
      const hasInvoice = !!(header.supplierInvoiceNo as string | null);
      await syncGrnPayable(tx, user.tenantId, { id, grnNo: grn.grnNo, supplier: header.supplier as string | null, grnDate: header.grnDate as string, paymentTerms: header.paymentTerms as string | null, dueDate: header.dueDate as string | null }, grandTotal, amountPaid, post, { businessId: grn.businessId, branchId: grn.branchId }, !hasInvoice);
    }, { maxWait: 10_000, timeout: 30_000 }); // sequential ledger/lot/QR writes against a remote RDS instance can exceed Prisma's 5s default (P2028)
    await writeAudit(prisma, user, {
      action: post ? "grn.post" : "grn.update", entity: "GoodsReceiptNote", entityId: id,
      summary: `Updated GRN ${existing.grnNo} for ${header.supplier ?? "supplier"} — ${grandTotal.toFixed(2)}`,
      meta: { supplier: header.supplier, grandTotal, amountPaid, posted: post, lineCount: lines.length },
      businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: post ? "GRN posted and stock received." : "Draft saved.", id });
  } catch (err) {
    console.error("[grn] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the GRN." }, { status: 500 });
  }
}

// DELETE /api/purchase/grn/[id] — remove the GRN and reverse its inventory.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "GoodsReceiptNote", entityId: id });
  if (denied) return denied;

  const existing = await prisma.goodsReceiptNote.findFirst({ where: { id, tenantId: user.tenantId }, include: { lines: { select: { id: true } } } });
  if (!existing) return NextResponse.json({ ok: false, message: "GRN not found." }, { status: 404 });
  if (existing.status === "Posted") return NextResponse.json({ ok: false, message: "A posted GRN can't be deleted — cancel it instead." }, { status: 422 });

  try {
    await prisma.$transaction(async (tx) => {
      for (const l of existing.lines) await reverseRef(tx, user.tenantId, "GRN", l.id);
      await tx.qrCodeMapping.deleteMany({ where: { sourceType: "GRN", sourceId: { in: existing.lines.map((l) => l.id) } } });
      await tx.payable.deleteMany({ where: { tenantId: user.tenantId, sourceType: "GRN", sourceId: id } });
      await tx.goodsReceiptNote.delete({ where: { id } });
    }, { maxWait: 10_000, timeout: 30_000 });
    await writeAudit(prisma, user, {
      action: "grn.delete", entity: "GoodsReceiptNote", entityId: id,
      summary: `Deleted draft GRN ${existing.grnNo}`,
      businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "GRN deleted." });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not delete the GRN." }, { status: 500 });
  }
}

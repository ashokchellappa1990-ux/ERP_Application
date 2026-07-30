import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { buildDocPayload, recomputeProductStock } from "@/lib/inventory/openingStock";
import { validateBatchTracking } from "@/lib/grn/grnPayload";
import { reverseRef } from "@/lib/inventory/ledger";
import type { OpeningStockDetail, OpeningStockStatus } from "@/lib/contracts/openingStock";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const PERM = "masters.opening-stock";

// GET /api/inventory/opening-stock/[id] — one document with its lines.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const doc = await prisma.openingStock.findFirst({
    where: { id: Number(params.id), tenantId: user.tenantId },
    include: { lines: { orderBy: { id: "asc" } } },
  });
  if (!doc) return NextResponse.json({ ok: false, message: "Document not found." }, { status: 404 });

  const data: OpeningStockDetail = {
    id: doc.id, docNo: doc.docNo, asOnDate: doc.asOnDate, warehouse: doc.warehouse ?? "",
    notes: doc.notes ?? "", status: doc.status as OpeningStockStatus,
    totalQty: num(doc.totalQty), totalValue: num(doc.totalValue), lineCount: doc.lineCount,
    lines: doc.lines.map((l) => ({
      id: l.id, productId: l.productId, productName: l.productName, sku: l.sku ?? "", uom: l.uom ?? "",
      category: l.category ?? "", qty: num(l.qty), mrp: l.mrp != null ? num(l.mrp) : "",
      purchasePrice: l.purchasePrice != null ? num(l.purchasePrice) : "", value: num(l.value),
      batchNo: l.batchNo ?? "", mfgDate: l.mfgDate ?? "", expiryDate: l.expiryDate ?? "",
      supplier: l.supplier ?? "", purchaseRef: l.purchaseRef ?? "", purchaseDate: l.purchaseDate ?? "",
      remarks: l.remarks ?? "",
      qrMode: l.qrMode as "shared" | "unique", qrStatus: l.qrStatus as "Pending" | "Generated", qrGeneratedCount: l.qrGeneratedCount, printedQty: l.printedQty,
    })),
  };
  return NextResponse.json({ ok: true, data });
}

// PUT /api/inventory/opening-stock/[id] — update a document (replaces lines).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "OpeningStock", entityId: id });
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const built = buildDocPayload(body);
  if ("error" in built) return NextResponse.json({ ok: false, message: built.error }, { status: 422 });
  const { header, lines, submit, productIds } = built;

  // Referenced products must belong to this tenant.
  const prods = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: user.tenantId }, select: { id: true, invBatch: true, invMfg: true, invExpiry: true } });
  if (prods.length !== productIds.length) return NextResponse.json({ ok: false, message: "One or more products are not in your catalog." }, { status: 422 });
  // Batch-tracked products must carry batch / mfg / expiry on every opening line.
  const trackErr = validateBatchTracking(lines, new Map(prods.map((p) => [p.id, { invBatch: p.invBatch, invMfg: p.invMfg, invExpiry: p.invExpiry }])));
  if (trackErr) return NextResponse.json({ ok: false, message: trackErr }, { status: 422 });

  try {
    const existing = await prisma.openingStock.findFirst({ where: { id, tenantId: user.tenantId }, include: { lines: { select: { id: true, productId: true } } } });
    if (!existing) return NextResponse.json({ ok: false, message: "Document not found." }, { status: 404 });
    const affected = new Set<number>([...productIds, ...existing.lines.map((l) => l.productId)]);

    await prisma.$transaction(async (tx) => {
      // Editing replaces lines: undo their inventory postings; the user re-generates
      // QR afterwards (lines reset to Pending), which re-posts fresh movements.
      for (const l of existing.lines) await reverseRef(tx, user.tenantId, "OPENING", l.id);
      await tx.qrCodeMapping.deleteMany({ where: { sourceType: "OPENING", sourceId: { in: existing.lines.map((l) => l.id) } } });
      await tx.openingStockLine.deleteMany({ where: { openingStockId: id } });
      await tx.openingStock.update({
        where: { id },
        data: { ...header, lines: { create: lines } },
      });
      // Recompute stock for products on this doc (old + new) so edits stay correct,
      // regardless of whether the doc is being submitted or reverted to draft.
      await recomputeProductStock(tx, Array.from(affected));
    });
    await writeAudit(prisma, user, {
      action: submit ? "opening_stock.submit" : "opening_stock.update", entity: "OpeningStock", entityId: id,
      summary: `Updated opening stock ${existing.docNo} — ${header.totalQty} qty, ${header.totalValue.toFixed(2)}`,
      meta: { submitted: submit, lineCount: lines.length, totalQty: header.totalQty, totalValue: header.totalValue },
      businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: submit ? "Opening stock submitted." : "Draft saved.", id });
  } catch (err) {
    console.error("[opening-stock] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update opening stock." }, { status: 500 });
  }
}

// DELETE /api/inventory/opening-stock/[id]
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "OpeningStock", entityId: id });
  if (denied) return denied;

  try {
    const existing = await prisma.openingStock.findFirst({ where: { id, tenantId: user.tenantId }, include: { lines: { select: { id: true, productId: true } } } });
    if (!existing) return NextResponse.json({ ok: false, message: "Document not found." }, { status: 404 });
    const productIds = Array.from(new Set(existing.lines.map((l) => l.productId)));
    await prisma.$transaction(async (tx) => {
      for (const l of existing.lines) await reverseRef(tx, user.tenantId, "OPENING", l.id); // undo inventory postings
      await tx.qrCodeMapping.deleteMany({ where: { sourceType: "OPENING", sourceId: { in: existing.lines.map((l) => l.id) } } });
      await tx.openingStock.delete({ where: { id } });
      await recomputeProductStock(tx, productIds); // drop this doc's contribution
    });
    await writeAudit(prisma, user, {
      action: "opening_stock.delete", entity: "OpeningStock", entityId: id,
      summary: `Deleted opening stock ${existing.docNo}`,
      businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Document deleted." });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not delete the document." }, { status: 500 });
  }
}

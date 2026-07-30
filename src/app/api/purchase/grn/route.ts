import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { buildGrnPayload, validateBatchTracking, validateSerialTracking } from "@/lib/grn/grnPayload";
import { syncGrnPayable } from "@/lib/grn/payable";
import { generateLineQr } from "@/lib/qr/generate";
import { postPurchaseJournal } from "@/lib/accounting/post";
import { getPurchaseInvoiceConfig } from "@/lib/purchase/purchaseInvoiceConfig";
import { buildInvoiceFromGrns, postPurchaseInvoiceTx, type GrnWithLines } from "@/lib/purchase/createPurchaseInvoice";
import { stampTerminal } from "@/lib/pos/terminalContext";
import { requireTerminalForTxn, terminalListWhere } from "@/lib/pos/terminalGuard";
import type { GrnRow, GrnListStats, GrnStatus } from "@/lib/contracts/grn";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const PERM = "purchase.grn";

// GET /api/purchase/grn — list GRNs + stats (tenant-scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const tw = await terminalListWhere(user, url.searchParams.get("terminalId"));
  const where: Prisma.GoodsReceiptNoteWhereInput = { ...sw, ...tw };
  if (q) where.OR = [{ grnNo: { contains: q } }, { supplier: { contains: q } }, { poNo: { contains: q } }, { supplierInvoiceNo: { contains: q } }];
  if (status !== "All") where.status = status;

  const [rows, total, draft, posted, agg] = await Promise.all([
    prisma.goodsReceiptNote.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.goodsReceiptNote.count({ where: sw }),
    prisma.goodsReceiptNote.count({ where: { ...sw, status: "Draft" } }),
    prisma.goodsReceiptNote.count({ where: { ...sw, status: "Posted" } }),
    prisma.goodsReceiptNote.aggregate({ where: sw, _sum: { totalValue: true, totalQty: true } }),
  ]);

  const shaped: GrnRow[] = rows.map((d) => ({
    id: d.id, grnNo: d.grnNo, status: d.status as GrnStatus, grnDate: d.grnDate, supplier: d.supplier ?? "",
    poNo: d.poNo ?? "", warehouse: d.warehouse ?? "", lineCount: d.lineCount,
    totalQty: num(d.totalQty), totalValue: num(d.totalValue), createdAt: d.createdAt.toISOString(),
  }));
  const stats: GrnListStats = { total, draft, posted, totalValue: num(agg._sum.totalValue), totalQty: num(agg._sum.totalQty) };
  return NextResponse.json({ ok: true, rows: shaped, stats });
}

// POST /api/purchase/grn — create a GRN (Draft or Posted). Posting generates
// per-line QR codes and posts the quantities into Inventory.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "GoodsReceiptNote" });
  if (denied) return denied;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const built = buildGrnPayload(body);
  if ("error" in built) return NextResponse.json({ ok: false, message: built.error }, { status: 422 });
  const { header, lines, post, productIds, grandTotal, amountPaid } = built;

  const prods = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId: user.tenantId }, select: { id: true, invBatch: true, invMfg: true, invExpiry: true, invSerial: true } });
  if (prods.length !== productIds.length) return NextResponse.json({ ok: false, message: "One or more products are not in your catalog." }, { status: 422 });
  const flagMap = new Map(prods.map((p) => [p.id, { invBatch: p.invBatch, invMfg: p.invMfg, invExpiry: p.invExpiry, invSerial: p.invSerial }]));
  const serialPids = new Set(prods.filter((p) => p.invSerial).map((p) => p.id));
  // Batch-tracked products must carry batch / mfg / expiry on every GRN line.
  const trackErr = validateBatchTracking(lines, flagMap);
  if (trackErr) return NextResponse.json({ ok: false, message: trackErr }, { status: 422 });
  // Serial-managed products: exactly qty serials, no in-document duplicates.
  const serialErr = validateSerialTracking(lines, built.lineSerials, flagMap);
  if (serialErr) return NextResponse.json({ ok: false, message: serialErr }, { status: 422 });
  // No serial may already exist in stock (re-receiving the same piece).
  const allSerials = built.lineSerials.flat();
  if (allSerials.length) {
    const existing = await prisma.qrCodeMapping.findFirst({ where: { tenantId: user.tenantId, serialNo: { in: allSerials }, status: { notIn: ["Scrapped", "ReturnedToSupplier"] } }, select: { serialNo: true } });
    if (existing) return NextResponse.json({ ok: false, message: `Serial number "${existing.serialNo}" is already in the system — it can't be received again.` }, { status: 422 });
  }

  const seg = scopeData(await getActiveScope(user), { branch: true }); // GRN received at the active branch
  const { denied: tDenied, ctx } = await requireTerminalForTxn(user, { label: "GRN" });
  if (tDenied) return tDenied;
  const stamp = stampTerminal(ctx);
  // Scenario 1: auto-create the Purchase Invoice during GRN when configured and the
  // supplier invoice no. was captured (so the bill exists read-only immediately).
  // Best-effort only — never let the PI module block a GRN from saving.
  let piCfg: Awaited<ReturnType<typeof getPurchaseInvoiceConfig>> | null = null;
  try { piCfg = post ? await getPurchaseInvoiceConfig(user) : null; }
  catch (e) { console.error("[grn] purchase-invoice config load failed (non-fatal)", e); }
  try {
    const grnId = await prisma.$transaction(async (tx) => {
      const grn = await tx.goodsReceiptNote.create({
        data: { ...header, tenantId: user.tenantId, ...seg, grnNo: "TMP", createdBy: user.id, ...stamp, lines: { create: lines } },
        include: { lines: true },
      });
      const grnNo = `GRN-${String(grn.id).padStart(5, "0")}`;
      await tx.goodsReceiptNote.update({ where: { id: grn.id }, data: { grnNo } });

      if (post) {
        const setting = (await tx.qrCodeSetting.findFirst({ where: { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null } })) ?? (await tx.qrCodeSetting.create({ data: { tenantId: user.tenantId, ...seg } }));
        let seq = setting.nextSequence;
        // Created lines align with the build order → zip serials by index.
        const orderedLines = [...grn.lines].sort((a, b) => a.id - b.id);
        for (let li = 0; li < orderedLines.length; li++) {
          const line = orderedLines[li];
          const isSerial = serialPids.has(line.productId);
          const r = await generateLineQr(tx, {
            tenantId: user.tenantId, ...seg, format: setting, sourceType: "GRN", sourceId: line.id,
            productId: line.productId, sku: line.sku, docNo: grnNo, qty: Number(line.qty), mode: isSerial ? "unique" : (line.qrMode === "unique" ? "unique" : "shared"),
            txnType: "PURCHASE", refType: "GRN", refNo: grnNo, txnDate: header.grnDate,
            rate: line.rate != null ? Number(line.rate) : null, sellingRate: line.sellingPrice != null ? Number(line.sellingPrice) : null,
            warehouse: header.warehouse, batchNo: line.batchNo, mfgDate: line.mfgDate,
            expiryDate: line.expiryDate, purchaseDate: header.supplierInvoiceDate ?? header.grnDate, grnId: grn.id, createdBy: user.id,
            serials: isSerial ? (built.lineSerials[li] ?? []) : null,
          }, seq);
          seq = r.endSeq;
          await tx.goodsReceiptLine.update({ where: { id: line.id }, data: { qrStatus: "Generated", qrGeneratedCount: r.count, printedQty: 0 } });
        }
        await tx.qrCodeSetting.update({ where: { id: setting.id }, data: { nextSequence: seq } });
      }
      // When the supplier invoice was entered at GRN, book the full purchase
      // (Dr Inventory + Input GST / Cr Payable) + create the supplier payable. When
      // it wasn't, the goods sit in GRN Clearing (Dr Inventory / Cr GRN Clearing)
      // until the bill is recorded via Purchase Invoice — no payable yet.
      if (post) {
        const hasInvoice = !!(header.supplierInvoiceNo as string | null);
        await postPurchaseJournal(tx, {
          tenantId: user.tenantId, ...seg, grnId: grn.id, grnNo, date: header.grnDate as string, supplier: header.supplier as string | null,
          subtotal: Number(header.subtotal) || 0, taxTotal: Number(header.taxTotal) || 0, freight: Number(header.freightAmount) || 0,
          otherCharges: Number(header.otherCharges) || 0, roundOff: Number(header.roundOff) || 0,
          grandTotal, amountPaid, paymentMode: header.paymentMode as string | null, createdBy: user.id, hasInvoice,
        });
        if (hasInvoice) {
          await syncGrnPayable(tx, user.tenantId, { id: grn.id, grnNo, supplier: header.supplier as string | null, grnDate: header.grnDate as string, paymentTerms: header.paymentTerms as string | null, dueDate: header.dueDate as string | null }, grandTotal, amountPaid, post, seg);
        }
      }

      return grn.id;
    });

    // Scenario 1 auto-create — when supplier-invoice details were entered at GRN,
    // create the Purchase Invoice (clears GRN Clearing + books GST + payable). Runs
    // AFTER the GRN is committed, in its own transaction, fully best-effort so it can
    // never block or revert the GRN.
    if (post && piCfg?.enablePurchaseInvoice && header.supplierInvoiceNo) {
      try {
        await prisma.$transaction(async (tx) => {
          const fresh = (await tx.goodsReceiptNote.findUnique({ where: { id: grnId }, include: { lines: { orderBy: { id: "asc" } } } })) as GrnWithLines | null;
          if (!fresh || fresh.invoiceRecorded) return;
          const piBuilt = buildInvoiceFromGrns([fresh], { invoiceType: "GRN", grnIds: [grnId], lines: [], gstMode: "exclusive", attachments: [] }, piCfg!);
          if ("error" in piBuilt) return;
          await postPurchaseInvoiceTx(tx, {
            user, seg, stamp, cfg: piCfg!, status: "Posted", grns: [fresh], built: piBuilt,
            input: { invoiceType: "GRN", grnIds: [grnId], lines: [], gstMode: "exclusive", supplierInvoiceNo: header.supplierInvoiceNo as string, supplierInvoiceDate: header.supplierInvoiceDate as string | undefined, dueDate: header.dueDate as string | undefined, paymentTerms: header.paymentTerms as string | undefined, attachments: [] },
          });
        });
      } catch (e) { console.error("[grn] auto-create purchase invoice failed (non-fatal)", e); }
    }
    await writeAudit(prisma, user, {
      action: post ? "grn.post" : "grn.create", entity: "GoodsReceiptNote", entityId: grnId,
      summary: `${post ? "Posted" : "Drafted"} GRN for ${header.supplier ?? "supplier"} — ${grandTotal.toFixed(2)}`,
      meta: { supplier: header.supplier, grandTotal, amountPaid, posted: post, lineCount: lines.length },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: post ? "GRN posted and stock received." : "Draft saved.", id: grnId }, { status: 201 });
  } catch (err) {
    console.error("[grn] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the GRN." }, { status: 500 });
  }
}

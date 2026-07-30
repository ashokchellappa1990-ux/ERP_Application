import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { buildQrCode } from "@/lib/qr/codeFormat";
import { postMovement, reverseRef, addLot } from "@/lib/inventory/ledger";
import type { OpeningStockQrResponse } from "@/lib/contracts/openingStock";

const numOrNull = (v: unknown) => (v == null ? null : Number(v));

const MAX_CODES = 5000;
const PERM = "masters.opening-stock";

// POST /api/inventory/opening-stock/[id]/qr — generate QR codes for one line.
// Body: { lineId, mode?: "shared" | "unique" }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "OpeningStock", entityId: Number(params.id) });
  if (denied) return denied;

  const docId = Number(params.id);
  let body: { lineId?: number; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const lineId = Number(body.lineId);
  const line = await prisma.openingStockLine.findFirst({
    where: { id: lineId, openingStockId: docId, document: { tenantId: user.tenantId } },
    include: { document: { select: { docNo: true, warehouse: true, asOnDate: true, businessId: true, branchId: true } } },
  });
  if (!line) return NextResponse.json({ ok: false, message: "Line not found." }, { status: 404 });

  const setting = (await prisma.qrCodeSetting.findFirst({ where: { tenantId: user.tenantId, businessId: line.document.businessId, branchId: line.document.branchId } })) ?? (await prisma.qrCodeSetting.create({ data: { tenantId: user.tenantId, businessId: line.document.businessId, branchId: line.document.branchId } }));
  const mode = body.mode === "unique" ? "unique" : body.mode === "shared" ? "shared" : setting.defaultMode;
  const qty = Math.round(Number(line.qty));
  const count = mode === "unique" ? qty : 1;

  if (count < 1) return NextResponse.json({ ok: false, message: "Line quantity must be at least 1." }, { status: 422 });
  if (count > MAX_CODES) return NextResponse.json({ ok: false, message: `Too many codes (max ${MAX_CODES}). Use shared mode for large lots.` }, { status: 422 });

  try {
    const codes = await prisma.$transaction(async (tx) => {
      await tx.qrCodeMapping.deleteMany({ where: { sourceType: "OPENING", sourceId: lineId } });
      const start = setting.nextSequence;
      // Stock lands at the document's business + branch.
      const seg = { businessId: line.document.businessId ?? undefined, branchId: line.document.branchId ?? undefined };
      const made: string[] = [];
      for (let i = 0; i < count; i++) {
        const code = buildQrCode(setting, line.document.docNo, line.sku, start + i, mode === "unique");
        await tx.qrCodeMapping.create({ data: { code, tenantId: user.tenantId, ...seg, sourceType: "OPENING", sourceId: lineId, productId: line.productId, seq: i + 1, mode, batchNo: line.batchNo, mfgDate: line.mfgDate, expiryDate: line.expiryDate } });
        made.push(code);
      }
      await tx.qrCodeSetting.update({ where: { id: setting.id }, data: { nextSequence: start + count } });
      await tx.openingStockLine.update({ where: { id: lineId }, data: { qrMode: mode, qrStatus: "Generated", qrGeneratedCount: count, printedQty: 0 } });

      // Make the opening stock available in Inventory Management. Replace any
      // prior opening posting for this line, then post the new movement(s):
      // one IN row per QR code (unique) or a single IN row (shared).
      await reverseRef(tx, user.tenantId, "OPENING", lineId);
      const rate = numOrNull(line.purchasePrice) ?? numOrNull(line.mrp);
      const sellingRate = numOrNull(line.mrp);
      const base = {
        tenantId: user.tenantId, ...seg, productId: line.productId, txnType: "OPENING", direction: "IN" as const,
        rate, sellingRate, warehouse: line.document.warehouse, batchNo: line.batchNo, mfgDate: line.mfgDate, expiryDate: line.expiryDate,
        refType: "OPENING", refId: lineId, refNo: line.document.docNo, txnDate: line.document.asOnDate, createdBy: user.id,
      };
      if (mode === "unique") {
        for (const code of made) await postMovement(tx, { ...base, qrCode: code, qty: 1 });
      } else {
        await postMovement(tx, { ...base, qrCode: made[0], qty });
      }
      // One stock layer for this opening line (age-wise / batch-wise reporting).
      await addLot(tx, {
        tenantId: user.tenantId, ...seg, productId: line.productId, warehouse: line.document.warehouse,
        batchNo: line.batchNo, refType: "OPENING", refId: lineId, refNo: line.document.docNo,
        receivedDate: line.document.asOnDate, purchaseDate: line.purchaseDate, mfgDate: line.mfgDate, expiryDate: line.expiryDate,
        qty, unitRate: rate, sellingRate,
      });
      return made;
    });
    await writeAudit(prisma, user, {
      action: "opening_stock.qr_generate", entity: "OpeningStock", entityId: docId,
      summary: `Generated ${codes.length} QR code(s) for ${line.productName} (${mode})`,
      meta: { lineId, mode, count: codes.length, sku: line.sku, docNo: line.document.docNo },
      businessId: line.document.businessId, branchId: line.document.branchId, ip: requestMeta(req).ip,
    });
    const res: OpeningStockQrResponse = { ok: true, message: `Generated ${codes.length} QR code(s).`, mode: mode as "shared" | "unique", count: codes.length, codes };
    return NextResponse.json(res);
  } catch (err) {
    console.error("[opening-stock qr] generate error", err);
    return NextResponse.json({ ok: false, message: "Could not generate QR codes." }, { status: 500 });
  }
}

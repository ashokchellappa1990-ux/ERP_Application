import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { reverseRef } from "@/lib/inventory/ledger";
import { reverseJournalForSource } from "@/lib/accounting/post";

// POST /api/purchase/grn/[id]/cancel — cancel a posted GRN: reverse its stock &
// payable, mark status Cancelled. The document is kept for audit (not deleted).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, "purchase.grn", { req, entity: "GoodsReceiptNote", entityId: id });
  if (denied) return denied;

  const grn = await prisma.goodsReceiptNote.findFirst({ where: { id, tenantId: user.tenantId }, include: { lines: { select: { id: true } } } });
  if (!grn) return NextResponse.json({ ok: false, message: "GRN not found." }, { status: 404 });
  if (grn.status === "Cancelled") return NextResponse.json({ ok: false, message: "GRN is already cancelled." }, { status: 422 });
  if (grn.status !== "Posted") return NextResponse.json({ ok: false, message: "Only a posted GRN can be cancelled." }, { status: 422 });
  if (grn.invoiceRecorded) return NextResponse.json({ ok: false, message: "A purchase invoice is recorded against this GRN. Cancel the purchase invoice first." }, { status: 422 });

  try {
    await prisma.$transaction(async (tx) => {
      for (const l of grn.lines) await reverseRef(tx, user.tenantId, "GRN", l.id); // reverse inventory + lots
      await tx.qrCodeMapping.deleteMany({ where: { sourceType: "GRN", sourceId: { in: grn.lines.map((l) => l.id) } } });
      await tx.payable.deleteMany({ where: { tenantId: user.tenantId, sourceType: "GRN", sourceId: id } });
      // Reverse the purchase accounting voucher (keeps an audit trail).
      await reverseJournalForSource(tx, user.tenantId, "GRN", id, grn.grnDate, user.id);
      await tx.goodsReceiptLine.updateMany({ where: { grnId: id }, data: { qrStatus: "Pending", qrGeneratedCount: 0, printedQty: 0 } });
      await tx.goodsReceiptNote.update({ where: { id }, data: { status: "Cancelled" } });
    }, { maxWait: 10_000, timeout: 30_000 });
    await writeAudit(prisma, user, {
      action: "grn.cancel", entity: "GoodsReceiptNote", entityId: id,
      summary: `Cancelled GRN ${grn.grnNo} — stock & payable reversed`,
      businessId: grn.businessId, branchId: grn.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "GRN cancelled. Stock and payable reversed." });
  } catch (err) {
    console.error("[grn] cancel error", err);
    return NextResponse.json({ ok: false, message: "Could not cancel the GRN." }, { status: 500 });
  }
}

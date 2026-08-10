import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

const PERM = "purchase.grn";

// POST /api/purchase/grn/[id]/empty-weight — capture the post-unload empty
// vehicle weight for a Truck Weight Based GRN, once it's Posted.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "GoodsReceiptNote", entityId: id });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const b = (raw ?? {}) as { emptyWeight?: unknown; remarks?: unknown };
  const emptyWeight = Number(b.emptyWeight);
  if (!Number.isFinite(emptyWeight) || emptyWeight < 0) return NextResponse.json({ ok: false, message: "Enter a valid empty vehicle weight." }, { status: 422 });

  const grn = await prisma.goodsReceiptNote.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!grn) return NextResponse.json({ ok: false, message: "GRN not found." }, { status: 404 });
  if (grn.status !== "Posted") return NextResponse.json({ ok: false, message: "Only a Posted GRN can have its empty weight updated." }, { status: 422 });
  if (!grn.weightUom) return NextResponse.json({ ok: false, message: "This GRN was not received by Truck Weight Based capture." }, { status: 422 });

  await prisma.goodsReceiptNote.update({
    where: { id },
    data: { emptyWeight, emptyWeightAt: new Date(), emptyWeightBy: user.id, emptyWeightRemarks: typeof b.remarks === "string" ? b.remarks.trim() || null : null },
  });
  await writeAudit(prisma, user, {
    action: "grn.empty_weight.update", entity: "GoodsReceiptNote", entityId: id,
    summary: `Captured empty vehicle weight ${emptyWeight} ${grn.weightUom} for GRN ${grn.grnNo}`,
    businessId: grn.businessId, branchId: grn.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Empty weight recorded." });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { reverseRef } from "@/lib/inventory/ledger";
import { CancelProcessSchema } from "@/lib/contracts/materialProcessing";

const PERM = "manufacturing.material-processing";

// POST /api/manufacturing/material-processing/[id]/cancel — Draft or
// InProgress -> Cancelled (only before Completed). If the raw material was
// already moved to WIP (InProgress), reverses that movement in full —
// reverseRef undoes every ledger row tagged to this transaction's refNo and
// deletes the WIP lot, returning the raw material to the source area.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "MaterialProcessing", entityId: id });
  if (denied) return denied;

  const mp = await prisma.materialProcessing.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!mp) return NextResponse.json({ ok: false, message: "Material Processing transaction not found." }, { status: 404 });
  if (mp.status !== "Draft" && mp.status !== "InProgress") return NextResponse.json({ ok: false, message: `This transaction is ${mp.status} and can no longer be cancelled.` }, { status: 422 });

  let raw: unknown; try { raw = await req.json(); } catch { raw = {}; }
  const parsed = CancelProcessSchema.safeParse(raw ?? {});
  const reason = parsed.success ? (parsed.data.reason ?? null) : null;

  try {
    await prisma.$transaction(async (tx) => {
      if (mp.status === "InProgress") await reverseRef(tx, user.tenantId, "MATERIAL_PROCESSING", mp.id);
      await tx.materialProcessing.update({ where: { id: mp.id }, data: { status: "Cancelled", cancelledAt: new Date(), cancelledBy: user.id, cancelReason: reason } });
    }, { maxWait: 10_000, timeout: 30_000 });
    await writeAudit(prisma, user, { action: "material_processing.cancel", entity: "MaterialProcessing", entityId: mp.id, summary: `Cancelled Material Processing ${mp.processingNumber}`, meta: { fromStatus: mp.status, reason }, businessId: mp.businessId ?? null, branchId: mp.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Material Processing cancelled." });
  } catch (err) {
    console.error("[material-processing] cancel error", err);
    return NextResponse.json({ ok: false, message: "Could not cancel the transaction." }, { status: 500 });
  }
}

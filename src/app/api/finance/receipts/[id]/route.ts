import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ReceiptCreateSchema } from "@/lib/contracts/receipt";
import { getReceiptDetail, updateReceipt } from "@/lib/finance/receipt";

const PERM = "finance.receipt";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const scope = await getActiveScope(user);
  const d = await getReceiptDetail({ tenantId: user.tenantId, businessId: scope.businessId ?? null }, Number(params.id));
  if (!d) return NextResponse.json({ ok: false, message: "Receipt not found." }, { status: 404 });
  return NextResponse.json({ ok: true, data: d });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ReceiptTransaction", entityId: Number(params.id) });
  if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ReceiptCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const ctx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName ?? null };
  try {
    await updateReceipt(ctx, Number(params.id), parsed.data);
    await writeAudit(prisma, user, { action: "receipt.update", entity: "ReceiptTransaction", entityId: params.id, summary: "Updated draft receipt", businessId: ctx.businessId, branchId: ctx.branchId, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Receipt updated." });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Could not update." }, { status: 422 }); }
}

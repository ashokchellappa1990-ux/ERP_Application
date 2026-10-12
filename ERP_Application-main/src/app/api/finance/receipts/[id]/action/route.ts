import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ReceiptActionSchema } from "@/lib/contracts/receipt";
import { transitionReceipt, isElevatedAction } from "@/lib/finance/receipt";

const PERM = "finance.receipt";

async function isElevated(user: { role?: string | null; roleId?: number | null }): Promise<boolean> {
  const r = (user.role ?? "").toLowerCase();
  if (["owner", "admin", "super-admin", "business-owner"].includes(r)) return true;
  if (user.roleId) {
    const role = await prisma.role.findUnique({ where: { id: user.roleId }, select: { isAllAccess: true, slug: true } });
    if (role?.isAllAccess) return true;
    if (role && ["business-owner", "admin", "finance-manager", "accountant"].includes(role.slug)) return true;
  }
  return false;
}

// POST /api/finance/receipts/[id]/action — submit | approve | post | cancel | reverse.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ReceiptTransaction", entityId: Number(params.id) });
  if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ReceiptActionSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });

  if (isElevatedAction(parsed.data.action) && !(await isElevated(user))) {
    return NextResponse.json({ ok: false, message: `You are not authorised to ${parsed.data.action} receipts.` }, { status: 403 });
  }

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const ctx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName ?? null };
  try {
    await transitionReceipt(ctx, Number(params.id), parsed.data.action, parsed.data.note);
    await writeAudit(prisma, user, { action: `receipt.${parsed.data.action}`, entity: "ReceiptTransaction", entityId: params.id, summary: `Receipt ${parsed.data.action}`, businessId: ctx.businessId, branchId: ctx.branchId, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Receipt updated." });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Action failed." }, { status: 422 }); }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";
import { manualAdjust } from "@/lib/loyalty/engine";
import { ManualAdjustSchema } from "@/lib/contracts/loyalty";

// POST /api/loyalty/adjust — manual reward-point credit / debit (authorised users).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "loyalty.profile", { req, entity: "LoyaltyTransactionLedger" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ManualAdjustSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const cust = await prisma.customer.findFirst({ where: { id: b.customerId, tenantId: user.tenantId }, select: { id: true, name: true, availableRewardPoints: true } });
  if (!cust) return NextResponse.json({ ok: false, message: "Customer not found." }, { status: 404 });
  const signed = b.type === "debit" ? -b.points : b.points;
  if (b.type === "debit" && b.points > cust.availableRewardPoints) return NextResponse.json({ ok: false, message: `Cannot debit ${b.points} — customer has only ${cust.availableRewardPoints} points.` }, { status: 422 });

  const seg = scopeData(await getActiveScope(user), { branch: true });
  const today = new Date().toISOString().slice(0, 10);
  const remarks = [b.reason, b.remarks].filter(Boolean).join(" — ");
  let balance = 0;
  await prisma.$transaction(async (tx) => {
    balance = await manualAdjust(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, createdBy: user.id, txnDate: today }, { customerId: b.customerId, points: signed, remarks });
    await writeAudit(tx, user, { action: "loyalty.manual_adjust", entity: "Customer", entityId: b.customerId, summary: `Manual ${b.type} ${b.points} pts → ${cust.name} (${b.reason})`, meta: { type: b.type, points: b.points, reason: b.reason }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  });
  return NextResponse.json({ ok: true, message: `${b.type === "credit" ? "Credited" : "Debited"} ${b.points} points.`, balance });
}

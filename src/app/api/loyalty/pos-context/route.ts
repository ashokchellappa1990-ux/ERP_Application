import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { getEffectiveProgram, isCustomerEligible } from "@/lib/loyalty/program";

const num = (v: unknown) => (v == null ? 0 : Number(v));

/**
 * GET /api/loyalty/pos-context?customerId= — the loyalty context the POS needs to
 * show & validate redemption for the selected customer: whether loyalty applies,
 * the available balance, and the redemption rules (so the client can compute the
 * same discount the server will). Returns { enabled:false } when not applicable.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.pos");
  if (denied) return denied;

  const customerId = Number(new URL(req.url).searchParams.get("customerId"));
  if (!Number.isInteger(customerId) || customerId <= 0) return NextResponse.json({ ok: true, enabled: false });

  const scope = await getActiveScope(user);
  const today = new Date().toISOString().slice(0, 10);
  const program = await getEffectiveProgram(prisma, user.tenantId, { businessId: scope.businessId ?? null, branchId: scope.branchId ?? null }, "POS", today);
  if (!program) return NextResponse.json({ ok: true, enabled: false });

  const cust = await prisma.customer.findFirst({ where: { id: customerId, tenantId: user.tenantId }, select: { id: true, customerGroup: true, availableRewardPoints: true } });
  if (!cust || !isCustomerEligible(program, cust)) return NextResponse.json({ ok: true, enabled: false });

  return NextResponse.json({
    ok: true,
    enabled: true,
    available: cust.availableRewardPoints,
    redemptionEnabled: program.redemptionEnabled,
    pointValuePoints: program.pointValuePoints,
    pointValueAmount: num(program.pointValueAmount),
    minRedeemPoints: program.minRedeemPoints,
    maxRedeemPoints: program.maxRedeemPoints,
    maxRedeemPercent: program.maxRedeemPercent == null ? null : num(program.maxRedeemPercent),
    maxRedeemAmount: program.maxRedeemAmount == null ? null : num(program.maxRedeemAmount),
  });
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { getMemberContext } from "@/lib/membership/registration";

/**
 * GET /api/pos/membership?customerId= — membership benefit context for the POS:
 * whether the selected customer is an active member, their level + configured
 * bill-discount benefit (so the client can show it & the server can re-apply it).
 * Returns { isMember:false } when not applicable.
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.pos");
  if (denied) return denied;

  const customerId = Number(new URL(req.url).searchParams.get("customerId"));
  if (!Number.isInteger(customerId) || customerId <= 0) return NextResponse.json({ ok: true, isMember: false });

  const scope = await getActiveScope(user);
  const ctx = await getMemberContext({ tenantId: user.tenantId, businessId: scope.businessId ?? null }, customerId);
  return NextResponse.json({ ok: true, ...ctx });
}

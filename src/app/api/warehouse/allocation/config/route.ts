import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { allocationRequiredForBranch } from "@/lib/warehouse/allocation";

// GET /api/warehouse/allocation/config — is Stock Allocation required for the
// logged-in user's branch? Drives the config gate on the module screens.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const scope = await getActiveScope(user);
  const allocationRequired = await allocationRequiredForBranch(scope, scope.branchId);
  return NextResponse.json({ ok: true, allocationRequired, branchId: scope.branchId ?? null });
}

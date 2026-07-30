import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { getCashEntryDetail } from "@/lib/finance/cash";

const PERM = "finance.cash";

// GET /api/finance/cash/[id] — full cash entry + its posted GL voucher lines.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const detail = await getCashEntryDetail({ tenantId: scope.tenantId, businessId: scope.businessId ?? null }, Number(params.id));
  if (!detail) return NextResponse.json({ ok: false, message: "Entry not found." }, { status: 404 });
  return NextResponse.json({ ok: true, data: detail });
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { loadDeliveryChallanDetail } from "@/lib/transport/deliveryChallan";

const PERM = "transport";

/** GET /api/transport/delivery-challan/[id] — detail for the print/view screen. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const id = Number(params.id);
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const detail = await loadDeliveryChallanDetail(id, sw);
  if (!detail) return NextResponse.json({ ok: false, message: "Delivery challan not found." }, { status: 404 });
  return NextResponse.json({ ok: true, dc: detail });
}

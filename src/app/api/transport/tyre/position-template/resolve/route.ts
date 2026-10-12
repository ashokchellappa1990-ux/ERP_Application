import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { resolveTyrePositionTemplate } from "@/lib/transport/tyre";

const PERM = "transport.tyre";

// GET /api/transport/tyre/position-template/resolve?vehicleId= — the position
// codes valid for a given vehicle (matched by VehicleMaster.vehicleType,
// falling back to the tenant's default template). Used by the Fitting/
// Rotation forms to populate the position dropdown; empty when no template
// is configured yet (position becomes free text in that case).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const vehicleId = Number(new URL(req.url).searchParams.get("vehicleId"));
  if (!vehicleId) return NextResponse.json({ ok: false, message: "vehicleId is required." }, { status: 422 });

  const resolved = await resolveTyrePositionTemplate(user.tenantId, vehicleId);
  return NextResponse.json({ ok: true, codes: resolved?.codes ?? [] });
}

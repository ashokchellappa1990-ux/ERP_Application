import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";

const PERM = "transport.gate-entry";

// GET /api/transport/gate-entry/vehicle-history?vehicleId=123 — the customer
// on this vehicle's most recent past gate entry, for the "Auto-load Customer
// from Vehicle History" Dispatch Configuration option (off by default).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const vehicleId = Number(new URL(req.url).searchParams.get("vehicleId"));
  if (!vehicleId) return NextResponse.json({ ok: false, message: "vehicleId is required." }, { status: 400 });

  const last = await prisma.vehicleGateEntry.findFirst({
    where: { tenantId: user.tenantId, vehicleId, deletedAt: null, customerName: { not: null } },
    orderBy: [{ arrivalTime: "desc" }, { createdAt: "desc" }],
    select: { customerName: true },
  });
  if (!last?.customerName) return NextResponse.json({ ok: true, found: false });

  // Best-effort resolve back to a real Customer master row (name isn't
  // unique) so the field behaves like a normal pick; falls back to the
  // plain name as free text if no match survives.
  const customer = await prisma.customer.findFirst({
    where: { tenantId: user.tenantId, name: last.customerName },
    select: { id: true, name: true },
  });
  return NextResponse.json({ ok: true, found: true, customerId: customer?.id ?? null, customerName: customer?.name ?? last.customerName });
}

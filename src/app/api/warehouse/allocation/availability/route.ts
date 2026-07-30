import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { productAvailability } from "@/lib/warehouse/allocation";

// GET /api/warehouse/allocation/availability?productId&branchId&warehouse&excludeAllocationId
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const u = new URL(req.url);
  const productId = Number(u.searchParams.get("productId"));
  const branchId = Number(u.searchParams.get("branchId"));
  if (!productId || !branchId) return NextResponse.json({ ok: false, message: "productId and branchId required." }, { status: 400 });
  const data = await productAvailability(await getActiveScope(user), { productId, branchId, warehouse: u.searchParams.get("warehouse") || undefined, excludeAllocationId: Number(u.searchParams.get("excludeAllocationId")) || undefined });
  return NextResponse.json({ ok: true, ...data });
}

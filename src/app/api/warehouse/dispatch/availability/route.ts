import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { availabilityAt } from "@/lib/warehouse/dispatch";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const u = new URL(req.url);
  const productId = Number(u.searchParams.get("productId"));
  const branchId = Number(u.searchParams.get("branchId"));
  if (!productId || !branchId) return NextResponse.json({ ok: false, message: "productId and branchId required." }, { status: 400 });
  const data = await availabilityAt(await getActiveScope(user), { productId, branchId, warehouse: u.searchParams.get("warehouse") || undefined });
  return NextResponse.json({ ok: true, ...data });
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { availability } from "@/lib/warehouse/transfer";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const u = new URL(req.url);
  const productId = Number(u.searchParams.get("productId"));
  if (!productId) return NextResponse.json({ ok: false, message: "productId required." }, { status: 400 });
  const data = await availability(await getActiveScope(user), { productId, sourceBranchId: Number(u.searchParams.get("sourceBranchId")) || undefined, sourceWarehouse: u.searchParams.get("sourceWarehouse") || undefined, destBranchId: Number(u.searchParams.get("destBranchId")) || undefined, destWarehouse: u.searchParams.get("destWarehouse") || undefined });
  return NextResponse.json({ ok: true, ...data });
}

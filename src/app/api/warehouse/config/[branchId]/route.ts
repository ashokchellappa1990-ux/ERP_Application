import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { warehouseConfigInput } from "@/lib/contracts/warehouse";
import { getWarehouse, saveConfig } from "@/lib/warehouse/api";

export async function GET(_req: Request, { params }: { params: { branchId: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const data = await getWarehouse(await getActiveScope(user), Number(params.branchId));
  if (!data) return NextResponse.json({ ok: false, message: "Warehouse not found." }, { status: 404 });
  return NextResponse.json({ ok: true, data });
}

export async function PUT(req: Request, { params }: { params: { branchId: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  try {
    const input = warehouseConfigInput.parse(await req.json());
    const res = await saveConfig(await getActiveScope(user), user, Number(params.branchId), input);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}

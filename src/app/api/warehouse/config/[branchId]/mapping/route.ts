import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { parentMappingInput } from "@/lib/contracts/warehouse";
import { listMappings, addMapping, deleteMapping } from "@/lib/warehouse/api";

export async function GET(_req: Request, { params }: { params: { branchId: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  return NextResponse.json({ ok: true, rows: await listMappings(await getActiveScope(user), Number(params.branchId)) });
}

export async function POST(req: Request, { params }: { params: { branchId: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  try {
    const body = await req.json();
    const input = parentMappingInput.parse({ ...body, destinationWarehouseBranchId: Number(params.branchId) });
    const id = await addMapping(await getActiveScope(user), user, input);
    return NextResponse.json({ ok: true, id });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, message: "id required." }, { status: 400 });
  await deleteMapping(await getActiveScope(user), user, id);
  return NextResponse.json({ ok: true });
}

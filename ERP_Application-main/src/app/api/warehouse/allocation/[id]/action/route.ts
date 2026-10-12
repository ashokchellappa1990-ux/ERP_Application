import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { allocActionInput } from "@/lib/contracts/stockAllocation";
import { allocationAction } from "@/lib/warehouse/allocation";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  try {
    const { action, remarks } = allocActionInput.parse(await req.json());
    const res = await allocationAction(await getActiveScope(user), user, Number(params.id), action, remarks);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}

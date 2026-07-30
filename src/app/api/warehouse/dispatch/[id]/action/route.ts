import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { dispatchActionInput } from "@/lib/contracts/stockDispatch";
import { postDispatch, cancelDispatch, generateChallan } from "@/lib/warehouse/dispatch";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  try {
    const { action, remarks } = dispatchActionInput.parse(await req.json());
    const scope = await getActiveScope(user);
    const id = Number(params.id);
    const res = action === "dispatch" ? await postDispatch(scope, user, id) : action === "cancel" ? await cancelDispatch(scope, user, id, remarks) : await generateChallan(scope, user, id);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { receiptActionInput } from "@/lib/contracts/stockReceipt";
import { postReceipt, cancelReceipt } from "@/lib/warehouse/receipt";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "warehouse"); if (denied) return denied;
  try {
    const { action, remarks } = receiptActionInput.parse(await req.json());
    const scope = await getActiveScope(user); const id = Number(params.id);
    const res = action === "receive" ? await postReceipt(scope, user, id) : await cancelReceipt(scope, user, id, remarks);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}

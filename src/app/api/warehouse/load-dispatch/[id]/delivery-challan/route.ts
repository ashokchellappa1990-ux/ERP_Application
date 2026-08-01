import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { requireTerminalForTxn } from "@/lib/pos/terminalGuard";
import { stampTerminal } from "@/lib/pos/terminalContext";
import { generateDeliveryChallanForLoadDispatch } from "@/lib/transport/loadDispatch";

const PERM = "warehouse.transfer";

// POST /api/warehouse/load-dispatch/[id]/delivery-challan — explicit button
// action (Customer dispatches only). Automatic invoice-posting mode fires
// inside the same call per Dispatch Configuration.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "LoadDispatch", entityId: id });
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const sw = scopeWhere(scope, { branch: true });
  const exists = await prisma.loadDispatch.findFirst({ where: { ...sw, id, deletedAt: null }, select: { id: true } });
  if (!exists) return NextResponse.json({ ok: false, message: "Load & Dispatch not found." }, { status: 404 });

  const { denied: tDenied, ctx } = await requireTerminalForTxn(user, { label: "delivery challan" });
  if (tDenied) return tDenied;
  const stamp = stampTerminal(ctx);

  try {
    const res = await generateDeliveryChallanForLoadDispatch(scope, { id: user.id, tenantId: user.tenantId, fullName: user.fullName ?? null }, id, { stamp });
    return NextResponse.json({ ok: true, message: "Delivery Challan generated.", deliveryChallanId: res.deliveryChallanId, invoiceNo: res.invoiceNo });
  } catch (err) {
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Could not generate the Delivery Challan." }, { status: 422 });
  }
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { stockTransferInput } from "@/lib/contracts/stockTransfer";
import { getRequest, updateRequest } from "@/lib/warehouse/transfer";

async function auth() { const user = await getSessionUser(); if (!user) return { err: NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 }) }; const denied = await requirePermission(user, "warehouse"); if (denied) return { err: denied }; return { user, scope: await getActiveScope(user) }; }

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const a = await auth(); if ("err" in a) return a.err;
  const data = await getRequest(a.scope, Number(params.id));
  if (!data) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, data });
}
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const a = await auth(); if ("err" in a) return a.err;
  try { const input = stockTransferInput.parse(await req.json()); const res = await updateRequest(a.scope, a.user, Number(params.id), input); return NextResponse.json({ ok: true, ...res }); }
  catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 400 }); }
}
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const a = await auth(); if ("err" in a) return a.err;
  const t = await prisma.stockTransferRequest.findFirst({ where: { id: Number(params.id), tenantId: a.scope.tenantId }, select: { status: true } });
  if (!t) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (t.status !== "Draft") return NextResponse.json({ ok: false, message: "Only a Draft request can be deleted." }, { status: 400 });
  await prisma.stockTransferRequest.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { resolveQrCode } from "@/lib/qr/resolve";

const PERM = "warehouse.transfer";
const scanInput = z.object({ code: z.string().trim().min(1) });

// POST /api/warehouse/load-dispatch/[id]/scan — barcode/QR lookup-only aid
// (Section 4). Never posts or changes quantities on its own.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "LoadDispatch", entityId: id });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = scanInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "A code is required." }, { status: 422 });

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const doc = await prisma.loadDispatch.findFirst({ where: { ...sw, id, deletedAt: null }, select: { id: true } });
  if (!doc) return NextResponse.json({ ok: false, message: "Load & Dispatch not found." }, { status: 404 });

  const resolved = await resolveQrCode(user.tenantId, parsed.data.code);
  if (!resolved) return NextResponse.json({ ok: false, message: "Code not recognised." }, { status: 404 });

  const match = await prisma.loadDispatchItem.findFirst({ where: { loadDispatchId: id, productId: resolved.productId, ...(resolved.batchNo ? { batchNo: resolved.batchNo } : {}) }, select: { id: true } });
  return NextResponse.json({ ok: true, resolved: true, matchedItemId: match?.id ?? null, productId: resolved.productId, batchNo: resolved.batchNo });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { resolveQrCode } from "@/lib/qr/resolve";

const PERM = "transport";

/**
 * POST /api/transport/dispatch-execution/[id]/scan — { code } — resolves a
 * scanned barcode/QR to its product/batch and, if it matches one of this
 * execution's items, returns that line too. This is purely a lookup /
 * verification aid for Phase 1 — it never posts or mutates anything.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const code = String((raw as { code?: unknown })?.code ?? "").trim();
  if (!code) return NextResponse.json({ ok: false, message: "No code provided." }, { status: 422 });

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const exec = await prisma.dispatchExecution.findFirst({ where: { ...sw, id: Number(params.id), deletedAt: null }, include: { items: true } });
  if (!exec) return NextResponse.json({ ok: false, message: "Dispatch execution not found." }, { status: 404 });

  const resolved = await resolveQrCode(user.tenantId, code);
  if (!resolved) return NextResponse.json({ ok: true, resolved: false, message: "Code not recognised or already consumed." });

  const matchLine = exec.items.find((it) => it.productId === resolved.productId && (!resolved.batchNo || it.batchNo === resolved.batchNo));
  return NextResponse.json({
    ok: true, resolved: true,
    product: { productId: resolved.productId, batchNo: resolved.batchNo, mfgDate: resolved.mfgDate, expiryDate: resolved.expiryDate, warehouse: resolved.warehouse },
    matchedItemId: matchLine?.id ?? null,
  });
}

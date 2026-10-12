import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

const PERM = "operations.day-close";

// POST/PATCH /api/operations/day-close/fund-transfer/[id] — acknowledge (then complete) a transfer.
// First call: Requested → Acknowledged (sets receivedBy + acknowledgedAt).
// Second call (or { complete: true }): → Completed.
async function ack(req: Request, ctx: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TerminalFundTransfer" });
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: "Invalid transfer id." }, { status: 400 });

  let body: { complete?: boolean } = {};
  try { const raw = await req.json(); if (raw && typeof raw === "object") body = raw as { complete?: boolean }; } catch { /* body is optional */ }

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const row = await prisma.terminalFundTransfer.findFirst({ where: { ...sw, id } });
  if (!row) return NextResponse.json({ ok: false, message: "Fund transfer not found." }, { status: 404 });
  if (row.status === "Completed") return NextResponse.json({ ok: false, message: "This transfer is already completed." }, { status: 422 });

  const toCompleted = body.complete === true || row.status === "Acknowledged";
  const status = toCompleted ? "Completed" : "Acknowledged";

  try {
    await prisma.terminalFundTransfer.update({
      where: { id: row.id },
      data: { status, receivedBy: row.receivedBy ?? user.id, acknowledgedAt: row.acknowledgedAt ?? new Date() },
    });

    await writeAudit(prisma, user, {
      action: "fund_transfer.ack", entity: "TerminalFundTransfer", entityId: row.id,
      summary: `Fund transfer ${row.transferNo ?? `#${row.id}`} ${status === "Completed" ? "completed" : "acknowledged"}`,
      meta: { from: row.status, to: status }, businessId: row.businessId ?? null, branchId: row.branchId ?? null, ip: requestMeta(req).ip,
    });

    return NextResponse.json({ ok: true, message: status === "Completed" ? "Fund transfer completed." : "Fund transfer acknowledged.", status });
  } catch (err) {
    console.error("[fund-transfer:ack] error", err);
    return NextResponse.json({ ok: false, message: "Could not update the fund transfer." }, { status: 500 });
  }
}

export const POST = ack;
export const PATCH = ack;

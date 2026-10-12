import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { currentSafeBalance } from "@/lib/eod/balances";
import { SafeTxnSchema, type SafeTxnRow, type SafeTxnDirection } from "@/lib/contracts/eodTransfer";

const PERM = "operations.day-close";
const num = (v: unknown) => (v == null ? 0 : Number(v));

async function shape(rows: Awaited<ReturnType<typeof fetchRows>>): Promise<SafeTxnRow[]> {
  const termIds = Array.from(new Set(rows.map((r) => r.terminalId).filter((v): v is number => v != null)));
  const terms = termIds.length ? await prisma.posTerminal.findMany({ where: { id: { in: termIds } }, select: { id: true, code: true, name: true } }) : [];
  const tMap = new Map(terms.map((t) => [t.id, t]));
  return rows.map((r) => ({
    id: r.id, txnNo: r.txnNo ?? "", direction: r.direction as SafeTxnDirection, terminalId: r.terminalId,
    terminalCode: r.terminalId == null ? "" : (tMap.get(r.terminalId)?.code ?? ""),
    terminalName: r.terminalId == null ? "" : (tMap.get(r.terminalId)?.name ?? ""),
    amount: num(r.amount), reason: r.reason ?? "", refType: r.refType, refId: r.refId,
    status: r.status, createdAt: r.createdAt.toISOString(),
  }));
}
function fetchRows(where: object) {
  return prisma.safeLockerTransaction.findMany({ where, orderBy: { id: "desc" }, take: 50 });
}

// GET /api/operations/day-close/safe-locker — current safe balance + recent ledger.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const sw = scopeWhere(scope, { branch: true });
  const [balance, rows] = await Promise.all([
    currentSafeBalance(user.tenantId, scope.readBranchIds),
    fetchRows(sw),
  ]);
  return NextResponse.json({ ok: true, balance, rows: await shape(rows) });
}

// POST /api/operations/day-close/safe-locker — record a terminal ↔ safe transfer.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "SafeLockerTransaction" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = SafeTxnSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const terminal = await prisma.posTerminal.findFirst({ where: { id: body.terminalId, tenantId: user.tenantId }, select: { id: true, code: true } });
  if (!terminal) return NextResponse.json({ ok: false, message: "Terminal not found." }, { status: 404 });

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });

  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.safeLockerTransaction.create({
        data: {
          tenantId: user.tenantId, ...seg, txnNo: "TMP", direction: body.direction, terminalId: body.terminalId,
          amount: body.amount, transferredBy: user.id, receivedBy: user.id, reason: body.reason || null,
          status: "Completed", createdBy: user.id,
        },
        select: { id: true },
      });
      const txnNo = `SLT-${row.id}`;
      await tx.safeLockerTransaction.update({ where: { id: row.id }, data: { txnNo } });
      return { id: row.id, txnNo };
    });

    await writeAudit(prisma, user, {
      action: "safe_locker.create", entity: "SafeLockerTransaction", entityId: created.id,
      summary: `Safe locker ${created.txnNo} (${body.direction})`,
      meta: { direction: body.direction, terminalId: body.terminalId, amount: body.amount },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });

    return NextResponse.json({ ok: true, message: "Safe locker transaction recorded.", id: created.id, txnNo: created.txnNo }, { status: 201 });
  } catch (err) {
    console.error("[safe-locker] create error", err);
    return NextResponse.json({ ok: false, message: "Could not record the safe locker transaction." }, { status: 500 });
  }
}

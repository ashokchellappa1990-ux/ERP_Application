import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { eodCashierScope } from "@/lib/eod/scope";
import { getActiveTerminalContext } from "@/lib/pos/terminalContext";
import { CashTxnSchema, type CashTxnRow, type CashTxnType } from "@/lib/contracts/eodCash";

const PERM = "operations.day-close";
const num = (v: unknown) => (v == null ? 0 : Number(v));

async function shape(rows: Awaited<ReturnType<typeof fetchRows>>): Promise<CashTxnRow[]> {
  const userIds = Array.from(new Set(rows.map((r) => r.cashierUserId)));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));
  return rows.map((r) => ({
    id: r.id, txnNo: r.txnNo ?? "", dayOpeningId: r.dayOpeningId, terminalId: r.terminalId, terminalSessionId: r.terminalSessionId,
    cashierUserId: r.cashierUserId, cashierName: uMap.get(r.cashierUserId) ?? "",
    type: r.type as CashTxnType, amount: num(r.amount), reason: r.reason ?? "", voucherRef: r.voucherRef ?? "",
    approvalStatus: r.approvalStatus, createdAt: r.createdAt.toISOString(),
  }));
}
function fetchRows(where: object) {
  return prisma.terminalCashTransaction.findMany({ where, orderBy: { id: "desc" }, take: 50 });
}

// GET /api/operations/day-close/cash-txn — recent terminal cash movements for the active day.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const cashier = eodCashierScope(user);
  const ctx = await getActiveTerminalContext(user);
  const where = { ...sw, ...cashier, ...(ctx?.dayOpeningId ? { dayOpeningId: ctx.dayOpeningId } : {}) };
  const rows = await shape(await fetchRows(where));
  return NextResponse.json({ ok: true, rows });
}

// POST /api/operations/day-close/cash-txn — record a terminal cash drawer movement.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TerminalCashTransaction" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = CashTxnSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const ctx = await getActiveTerminalContext(user);
  if (!ctx || !ctx.dayOpeningId) return NextResponse.json({ ok: false, message: "Open the day first." }, { status: 422 });

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const terminalId = body.terminalId ?? ctx.terminalId;

  try {
    const txn = await prisma.terminalCashTransaction.create({
      data: {
        tenantId: user.tenantId, ...seg, txnNo: "TMP", dayOpeningId: ctx.dayOpeningId, terminalId,
        terminalSessionId: ctx.terminalSessionId, cashierUserId: ctx.cashierUserId, type: body.type, amount: body.amount,
        reason: body.reason || null, voucherRef: body.voucherRef || null, createdBy: user.id,
      },
      select: { id: true },
    });
    await prisma.terminalCashTransaction.update({ where: { id: txn.id }, data: { txnNo: `TCX-${txn.id}` } });

    await writeAudit(prisma, user, {
      action: "cash_txn.create", entity: "TerminalCashTransaction", entityId: txn.id,
      summary: `Cash ${body.type} ${body.amount} on terminal ${terminalId}`,
      meta: { type: body.type, amount: body.amount, dayOpeningId: ctx.dayOpeningId, terminalId },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });

    return NextResponse.json({ ok: true, message: "Cash transaction recorded.", id: txn.id, txnNo: `TCX-${txn.id}` }, { status: 201 });
  } catch (err) {
    console.error("[cash-txn] error", err);
    return NextResponse.json({ ok: false, message: "Could not record the cash transaction." }, { status: 500 });
  }
}

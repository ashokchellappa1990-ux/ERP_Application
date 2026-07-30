import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { BankDepositSchema, type BankDepositRow } from "@/lib/contracts/eodTransfer";

const PERM = "operations.day-close";
const num = (v: unknown) => (v == null ? 0 : Number(v));

async function shape(rows: Awaited<ReturnType<typeof fetchRows>>): Promise<BankDepositRow[]> {
  const userIds = Array.from(new Set(rows.map((r) => r.depositBy)));
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));
  return rows.map((r) => ({
    id: r.id, depositNo: r.depositNo ?? "", bankName: r.bankName, bankAccount: r.bankAccount ?? "", depositSlip: r.depositSlip ?? "",
    amount: num(r.amount), depositDate: r.depositDate, depositAt: r.depositAt.toISOString(),
    depositBy: r.depositBy, depositByName: uMap.get(r.depositBy) ?? "", remarks: r.remarks ?? "", status: r.status,
  }));
}
function fetchRows(where: object) {
  return prisma.bankDeposit.findMany({ where, orderBy: { id: "desc" }, take: 50 });
}

// GET /api/operations/day-close/bank-deposit — recent bank deposits.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const rows = await shape(await fetchRows(sw));
  return NextResponse.json({ ok: true, rows });
}

// POST /api/operations/day-close/bank-deposit — deposit safe cash to a bank account.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "BankDeposit" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = BankDepositSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const today = new Date().toISOString().slice(0, 10);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const deposit = await tx.bankDeposit.create({
        data: {
          tenantId: user.tenantId, ...seg, depositNo: "TMP", bankName: body.bankName, bankAccount: body.bankAccount || null,
          depositSlip: body.depositSlip || null, amount: body.amount, depositDate: today, depositAt: new Date(),
          depositBy: user.id, remarks: body.remarks || null, status: "Completed", createdBy: user.id,
        },
        select: { id: true },
      });
      const depositNo = `BNK-${deposit.id}`;
      await tx.bankDeposit.update({ where: { id: deposit.id }, data: { depositNo } });

      // Drop the safe balance: record the matching OUT_TO_BANK safe-locker ledger entry.
      const slt = await tx.safeLockerTransaction.create({
        data: {
          tenantId: user.tenantId, ...seg, txnNo: "TMP", direction: "OUT_TO_BANK", amount: body.amount,
          transferredBy: user.id, reason: `Bank deposit ${depositNo} — ${body.bankName}`,
          refType: "BANK_DEPOSIT", refId: deposit.id, status: "Completed", createdBy: user.id,
        },
        select: { id: true },
      });
      await tx.safeLockerTransaction.update({ where: { id: slt.id }, data: { txnNo: `SLT-${slt.id}` } });

      return { id: deposit.id, depositNo };
    });

    await writeAudit(prisma, user, {
      action: "bank_deposit.create", entity: "BankDeposit", entityId: created.id,
      summary: `Bank deposit ${created.depositNo} — ${body.bankName}`,
      meta: { bankName: body.bankName, amount: body.amount }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });

    return NextResponse.json({ ok: true, message: "Bank deposit recorded.", id: created.id, depositNo: created.depositNo }, { status: 201 });
  } catch (err) {
    console.error("[bank-deposit] create error", err);
    return NextResponse.json({ ok: false, message: "Could not record the bank deposit." }, { status: 500 });
  }
}

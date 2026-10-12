import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { currentSafeBalance } from "@/lib/eod/balances";
import { postJournal } from "@/lib/accounting/post";
import { ACC } from "@/lib/accounting/accounts";
import { TransferSubmitSchema, TRANSFER_TYPE_LABELS, type MovementRow, type TransferType } from "@/lib/contracts/eodTransfer";

const PERM = "operations.day-close";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/operations/day-close/fund-transfer — current safe balance + recent cash movements.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const sw = scopeWhere(scope, { branch: true }) as Prisma.TerminalFundTransferWhereInput;
  const branchW = scope.readBranchIds.length ? { tenantId: user.tenantId, branchId: { in: scope.readBranchIds } } : { tenantId: user.tenantId };

  const [safeBalance, fts, safes, deposits] = await Promise.all([
    currentSafeBalance(user.tenantId, scope.readBranchIds),
    prisma.terminalFundTransfer.findMany({ where: sw, orderBy: { id: "desc" }, take: 20 }),
    prisma.safeLockerTransaction.findMany({ where: { ...branchW, direction: { in: ["IN_FROM_TERMINAL", "OUT_TO_TERMINAL", "IN_FROM_BANK"] } }, orderBy: { id: "desc" }, take: 20 }),
    prisma.bankDeposit.findMany({ where: branchW, orderBy: { id: "desc" }, take: 20 }),
  ]);

  const termIds = Array.from(new Set([...fts.flatMap((r) => [r.fromTerminalId, r.toTerminalId]), ...safes.map((r) => r.terminalId).filter((x): x is number => x != null)]));
  const terms = termIds.length ? await prisma.posTerminal.findMany({ where: { id: { in: termIds } }, select: { id: true, code: true } }) : [];
  const tc = new Map(terms.map((t) => [t.id, t.code]));

  const movements: MovementRow[] = [
    ...fts.map((r) => ({ id: `ft-${r.id}`, kind: "TERMINAL_TO_TERMINAL" as TransferType, label: TRANSFER_TYPE_LABELS.TERMINAL_TO_TERMINAL, amount: num(r.amount), detail: `${tc.get(r.fromTerminalId) ?? `T#${r.fromTerminalId}`} → ${tc.get(r.toTerminalId) ?? `T#${r.toTerminalId}`}`, at: r.createdAt.toISOString() })),
    ...safes.map((r) => {
      const kind = (r.direction === "IN_FROM_TERMINAL" ? "TERMINAL_TO_SAFE" : r.direction === "OUT_TO_TERMINAL" ? "SAFE_TO_TERMINAL" : "BANK_TO_SAFE") as TransferType;
      const detail = r.terminalId ? (tc.get(r.terminalId) ?? `T#${r.terminalId}`) : (r.direction === "IN_FROM_BANK" ? (r.reason ?? "Bank") : "Cash Drawer");
      return { id: `sl-${r.id}`, kind, label: TRANSFER_TYPE_LABELS[kind], amount: num(r.amount), detail, at: r.createdAt.toISOString() };
    }),
    ...deposits.map((r) => ({ id: `bd-${r.id}`, kind: "SAFE_TO_BANK" as TransferType, label: TRANSFER_TYPE_LABELS.SAFE_TO_BANK, amount: num(r.amount), detail: r.bankName, at: r.createdAt.toISOString() })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 30);

  return NextResponse.json({ ok: true, safeBalance, movements });
}

// POST /api/operations/day-close/fund-transfer — record one or more cash movements
// of a single transfer type (consolidated screen).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "CashTransfer" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = TransferSubmitSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const { transferType, lines } = parsed.data;

  // Per-type line validation. Safe↔Terminal needs no terminal: single-user shops
  // have no registered terminal, so it's just the cash counter (terminalId null).
  for (const l of lines) {
    if (transferType === "TERMINAL_TO_TERMINAL") {
      if (!l.terminalId || !l.toTerminalId) return NextResponse.json({ ok: false, message: "Each line needs a From and To terminal." }, { status: 422 });
      if (l.terminalId === l.toTerminalId) return NextResponse.json({ ok: false, message: "From and To terminals must differ." }, { status: 422 });
    } else if (transferType === "BANK_TO_SAFE" || transferType === "SAFE_TO_BANK") {
      if (!l.bankId && !l.bankName) return NextResponse.json({ ok: false, message: "Each line needs a bank." }, { status: 422 });
    }
  }

  // Validate terminals + resolve bank names.
  const termIds = Array.from(new Set(lines.flatMap((l) => [l.terminalId, l.toTerminalId]).filter((x): x is number => x != null)));
  if (termIds.length) {
    const found = await prisma.posTerminal.count({ where: { id: { in: termIds }, tenantId: user.tenantId } });
    if (found !== termIds.length) return NextResponse.json({ ok: false, message: "One or more terminals were not found." }, { status: 404 });
  }
  const bankIds = Array.from(new Set(lines.map((l) => l.bankId).filter((x): x is number => x != null)));
  const bankRows = bankIds.length ? await prisma.setupBank.findMany({ where: { id: { in: bankIds }, setup: { tenantId: user.tenantId } }, select: { id: true, bankName: true, account: true } }) : [];
  const bankMap = new Map(bankRows.map((b) => [b.id, b]));
  const bankNameOf = (l: { bankId?: number; bankName?: string }) => (l.bankId ? bankMap.get(l.bankId)?.bankName : null) ?? l.bankName ?? "Bank";

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const today = new Date().toISOString().slice(0, 10);
  const base = { tenantId: user.tenantId, ...seg, createdBy: user.id };

  try {
    await prisma.$transaction(async (tx) => {
      for (const l of lines) {
        if (transferType === "TERMINAL_TO_TERMINAL") {
          const r = await tx.terminalFundTransfer.create({ data: { ...base, transferNo: "TMP", fromTerminalId: l.terminalId!, toTerminalId: l.toTerminalId!, amount: l.amount, reason: l.reason || null, transferredBy: user.id, receivedBy: user.id, acknowledgedAt: new Date(), status: "Completed" }, select: { id: true } });
          await tx.terminalFundTransfer.update({ where: { id: r.id }, data: { transferNo: `TFT-${r.id}` } });
        } else if (transferType === "TERMINAL_TO_SAFE") {
          const r = await tx.safeLockerTransaction.create({ data: { ...base, txnNo: "TMP", direction: "IN_FROM_TERMINAL", terminalId: l.terminalId ?? null, amount: l.amount, transferredBy: user.id, receivedBy: user.id, reason: l.reason || null, status: "Completed" }, select: { id: true } });
          await tx.safeLockerTransaction.update({ where: { id: r.id }, data: { txnNo: `SLT-${r.id}` } });
        } else if (transferType === "SAFE_TO_TERMINAL") {
          const r = await tx.safeLockerTransaction.create({ data: { ...base, txnNo: "TMP", direction: "OUT_TO_TERMINAL", terminalId: l.terminalId ?? null, amount: l.amount, transferredBy: user.id, receivedBy: user.id, reason: l.reason || null, status: "Completed" }, select: { id: true } });
          await tx.safeLockerTransaction.update({ where: { id: r.id }, data: { txnNo: `SLT-${r.id}` } });
        } else if (transferType === "BANK_TO_SAFE") {
          const r = await tx.safeLockerTransaction.create({ data: { ...base, txnNo: "TMP", direction: "IN_FROM_BANK", amount: l.amount, transferredBy: user.id, receivedBy: user.id, reason: `From ${bankNameOf(l)}${l.reason ? ` — ${l.reason}` : ""}`, refType: "BANK_WITHDRAWAL", status: "Completed" }, select: { id: true } });
          await tx.safeLockerTransaction.update({ where: { id: r.id }, data: { txnNo: `SLT-${r.id}` } });
          // Real-time GL: bank withdrawn into cash in hand (safe is part of cash).
          await postJournal(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, voucherType: "CONTRA", prefix: "CV", date: today, narration: `Bank withdrawal to safe — ${bankNameOf(l)}`, sourceType: "CASH_TRANSFER", sourceId: r.id, refNo: `SLT-${r.id}`, createdBy: user.id, lines: [{ code: ACC.CASH, debit: l.amount }, { code: ACC.BANK, credit: l.amount }] });
        } else { // SAFE_TO_BANK
          const dep = await tx.bankDeposit.create({ data: { ...base, depositNo: "TMP", bankName: bankNameOf(l), bankAccount: l.bankId ? bankMap.get(l.bankId)?.account ?? null : null, amount: l.amount, depositDate: today, depositBy: user.id, remarks: l.reason || null, status: "Completed" }, select: { id: true } });
          await tx.bankDeposit.update({ where: { id: dep.id }, data: { depositNo: `BNK-${dep.id}` } });
          const s = await tx.safeLockerTransaction.create({ data: { ...base, txnNo: "TMP", direction: "OUT_TO_BANK", amount: l.amount, transferredBy: user.id, reason: `To ${bankNameOf(l)}`, refType: "BANK_DEPOSIT", refId: dep.id, status: "Completed" }, select: { id: true } });
          await tx.safeLockerTransaction.update({ where: { id: s.id }, data: { txnNo: `SLT-${s.id}` } });
          // Real-time GL: cash in hand deposited to bank.
          await postJournal(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, voucherType: "CONTRA", prefix: "CV", date: today, narration: `Cash deposited to bank — ${bankNameOf(l)}`, sourceType: "BANK_DEPOSIT", sourceId: dep.id, refNo: `BNK-${dep.id}`, createdBy: user.id, lines: [{ code: ACC.BANK, debit: l.amount }, { code: ACC.CASH, credit: l.amount }] });
        }
      }
    });

    const total = lines.reduce((a, l) => a + l.amount, 0);
    await writeAudit(prisma, user, {
      action: "cash_transfer.create", entity: "CashTransfer", entityId: transferType,
      summary: `${TRANSFER_TYPE_LABELS[transferType]} — ${lines.length} line(s), ${total.toFixed(2)}`,
      meta: { transferType, lines: lines.length, total },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: `${TRANSFER_TYPE_LABELS[transferType]} recorded (${lines.length} line${lines.length > 1 ? "s" : ""}).` }, { status: 201 });
  } catch (err) {
    console.error("[cash-transfer] error", err);
    return NextResponse.json({ ok: false, message: "Could not record the transfer." }, { status: 500 });
  }
}

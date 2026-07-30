import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ACC } from "@/lib/accounting/accounts";
import { postJournal } from "@/lib/accounting/post";
import type { CashEntryCreateInput, CashEntryRow, CashEntryDetail, BankRef, CashKpis } from "@/lib/contracts/cashManagement";
import { FUND_TRANSFER_LABELS } from "@/lib/contracts/cashManagement";

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const pad = (prefix: string, id: number) => `${prefix}-${String(id).padStart(6, "0")}`;

export interface CashWriteCtx { tenantId: number; businessId: number | null; branchId: number | null; userId: number; userName: string | null }

/** Insert a cash entry (fund transfer / misc receipt) and post its GL voucher,
 *  inside the caller's transaction. Returns the entry id + generated doc number. */
export async function createCashEntry(tx: Prisma.TransactionClient, ctx: CashWriteCtx, input: CashEntryCreateInput): Promise<{ id: number; docNo: string }> {
  const date = (input.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const amount = r2(input.amount);
  const seg = { businessId: ctx.businessId ?? undefined, branchId: ctx.branchId ?? undefined };

  // Build the document fields + GL lines per kind.
  let docPrefix: string, data: Prisma.CashEntryUncheckedCreateInput, jLines: { code: string; debit?: number; credit?: number; narration?: string }[], voucherType: string, jPrefix: string;

  if (input.kind === "FUND_TRANSFER") {
    docPrefix = "FT";
    const bankLabel = input.bankName ? `${input.bankName}${input.bankAccount ? ` ••${input.bankAccount.slice(-4)}` : ""}` : "Bank Account";
    const toBank = input.transferType === "CASH_TO_BANK";
    const fromAccount = toBank ? "Cash in Hand" : bankLabel;
    const toAccount = toBank ? bankLabel : "Cash in Hand";
    data = {
      tenantId: ctx.tenantId, ...seg, kind: "FUND_TRANSFER", docNo: "TMP", date, transferType: input.transferType,
      fromAccount, toAccount, bankId: input.bankId ?? null, bankName: input.bankName || null, bankAccount: input.bankAccount || null,
      amount, reference: input.reference || null, remarks: input.remarks || null, mode: "Bank Transfer",
      status: "Posted", createdBy: ctx.userId, createdByName: ctx.userName,
    };
    voucherType = "CONTRA"; jPrefix = "CV";
    jLines = toBank
      ? [{ code: ACC.BANK, debit: amount, narration: `Deposited to ${bankLabel}` }, { code: ACC.CASH, credit: amount, narration: "From cash in hand" }]
      : [{ code: ACC.CASH, debit: amount, narration: "To cash in hand" }, { code: ACC.BANK, credit: amount, narration: `Withdrawn from ${bankLabel}` }];
  } else {
    docPrefix = "MR";
    const intoBank = input.receivedIn === "Bank";
    data = {
      tenantId: ctx.tenantId, ...seg, kind: "MISC_RECEIPT", docNo: "TMP", date, receivedIn: input.receivedIn,
      payer: input.payer, incomeHead: input.incomeHead || "Miscellaneous Income", mode: input.mode || (intoBank ? "Bank Transfer" : "Cash"),
      bankId: input.bankId ?? null, bankName: input.bankName || null, bankAccount: input.bankAccount || null,
      amount, reference: input.reference || null, remarks: input.remarks || null,
      status: "Posted", createdBy: ctx.userId, createdByName: ctx.userName,
    };
    voucherType = "RECEIPT"; jPrefix = "RV";
    jLines = [
      { code: intoBank ? ACC.BANK : ACC.CASH, debit: amount, narration: `Received from ${input.payer}` },
      { code: ACC.MISC_INCOME, credit: amount, narration: input.incomeHead || "Miscellaneous income" },
    ];
  }

  const created = await tx.cashEntry.create({ data, select: { id: true } });
  const docNo = pad(docPrefix, created.id);
  await tx.cashEntry.update({ where: { id: created.id }, data: { docNo } });

  const jid = await postJournal(tx, {
    tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, voucherType, prefix: jPrefix, date,
    narration: input.kind === "FUND_TRANSFER" ? `${FUND_TRANSFER_LABELS[input.transferType]} — ${docNo}` : `Misc receipt ${docNo} — ${input.payer}`,
    sourceType: "CASH_ENTRY", sourceId: created.id, refNo: docNo, createdBy: ctx.userId, lines: jLines,
  });
  if (jid) await tx.cashEntry.update({ where: { id: created.id }, data: { journalRef: pad(jPrefix, jid) } });
  return { id: created.id, docNo };
}

function bizWhere(scope: { tenantId: number; businessId: number | null }) {
  return scope.businessId != null ? { tenantId: scope.tenantId, businessId: scope.businessId } : { tenantId: scope.tenantId };
}

const particulars = (e: { kind: string; transferType: string | null; fromAccount: string | null; toAccount: string | null; payer: string | null }) =>
  e.kind === "FUND_TRANSFER" ? `${e.fromAccount ?? ""} → ${e.toAccount ?? ""}` : (e.payer ?? "Miscellaneous receipt");
const accountOf = (e: { kind: string; receivedIn: string | null; bankName: string | null; transferType: string | null }) =>
  e.kind === "MISC_RECEIPT" ? (e.receivedIn === "Bank" ? (e.bankName || "Bank") : "Cash") : (e.bankName || "Cash / Bank");

export async function listCashEntries(scope: { tenantId: number; businessId: number | null }, opts: { kind?: string; q?: string }): Promise<CashEntryRow[]> {
  const where: Prisma.CashEntryWhereInput = { ...bizWhere(scope) };
  if (opts.kind && opts.kind !== "All") where.kind = opts.kind;
  if (opts.q) where.OR = [{ docNo: { contains: opts.q } }, { payer: { contains: opts.q } }, { bankName: { contains: opts.q } }, { reference: { contains: opts.q } }];
  const rows = await prisma.cashEntry.findMany({ where, orderBy: { id: "desc" }, take: 200 });
  return rows.map((e) => ({
    id: e.id, kind: e.kind as CashEntryRow["kind"], docNo: e.docNo, date: e.date,
    particulars: particulars(e), account: accountOf(e), amount: num(e.amount), mode: e.mode ?? "", status: e.status, createdByName: e.createdByName ?? "",
  }));
}

export async function getCashEntryDetail(scope: { tenantId: number; businessId: number | null }, id: number): Promise<CashEntryDetail | null> {
  const e = await prisma.cashEntry.findFirst({ where: { id, ...bizWhere(scope) } });
  if (!e) return null;
  const je = await prisma.journalEntry.findFirst({ where: { tenantId: scope.tenantId, sourceType: "CASH_ENTRY", sourceId: id }, include: { lines: { include: { account: true } } } });
  return {
    id: e.id, kind: e.kind as CashEntryRow["kind"], docNo: e.docNo, date: e.date, particulars: particulars(e), account: accountOf(e),
    amount: num(e.amount), mode: e.mode ?? "", status: e.status, createdByName: e.createdByName ?? "",
    transferType: e.transferType ?? "", fromAccount: e.fromAccount ?? "", toAccount: e.toAccount ?? "",
    receivedIn: e.receivedIn ?? "", payer: e.payer ?? "", incomeHead: e.incomeHead ?? "", bankName: e.bankName ?? "", bankAccount: e.bankAccount ?? "",
    reference: e.reference ?? "", remarks: e.remarks ?? "", journalRef: e.journalRef ?? "", voucherNo: je?.voucherNo ?? e.journalRef ?? "",
    journal: (je?.lines ?? []).map((l) => ({ account: l.account.name, code: l.account.code, debit: num(l.debit), credit: num(l.credit), narration: l.narration ?? "" })),
  };
}

export async function listBanks(scope: { tenantId: number; businessId: number | null }): Promise<BankRef[]> {
  const rows = await prisma.setupBank.findMany({
    where: { setup: { tenantId: scope.tenantId }, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) },
    orderBy: { id: "asc" }, select: { id: true, bankName: true, account: true },
  });
  return rows.map((b) => ({ id: b.id, bankName: b.bankName ?? "Bank", account: b.account ?? "" }));
}

export async function cashKpis(scope: { tenantId: number; businessId: number | null }, period: string): Promise<CashKpis> {
  const rows = await prisma.cashEntry.findMany({ where: { ...bizWhere(scope), date: { startsWith: period } }, select: { kind: true, transferType: true, receivedIn: true, amount: true } });
  const k: CashKpis = { cashIn: 0, bankIn: 0, toBank: 0, toCash: 0, receiptCount: 0, transferCount: 0 };
  for (const e of rows) {
    const a = num(e.amount);
    if (e.kind === "MISC_RECEIPT") { k.receiptCount++; if (e.receivedIn === "Bank") k.bankIn += a; else k.cashIn += a; }
    else { k.transferCount++; if (e.transferType === "CASH_TO_BANK") k.toBank += a; else k.toCash += a; }
  }
  return { cashIn: r2(k.cashIn), bankIn: r2(k.bankIn), toBank: r2(k.toBank), toCash: r2(k.toCash), receiptCount: k.receiptCount, transferCount: k.transferCount };
}

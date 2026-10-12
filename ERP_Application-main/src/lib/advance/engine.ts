import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { postJournal, reverseJournalForSource } from "@/lib/accounting/post";
import { ACC } from "@/lib/accounting/accounts";
import { recordBankMovement } from "@/lib/finance/bank";
import { DEFAULT_ADVANCE_TYPES, DEFAULT_ADVANCE_CONFIG, OPEN_ADVANCE, type AdvanceConfigData } from "@/lib/contracts/advance";

type Tx = Prisma.TransactionClient;
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Seed the default advance types for a tenant if it has none (idempotent). */
export async function ensureAdvanceTypesSeeded(tx: Tx, tenantId: number) {
  const n = await tx.advanceType.count({ where: { tenantId } });
  if (n > 0) return false;
  await tx.advanceType.createMany({
    data: DEFAULT_ADVANCE_TYPES.map((t, i) => ({ tenantId, code: t.code, name: t.name, direction: t.direction, accountCode: t.accountCode, partyType: t.partyType, displayOrder: i + 1, status: "active" })),
  });
  return true;
}

/** Resolve the effective advance config row for a tenant/business (create default if missing). */
export async function getAdvanceConfigRow(tx: Tx, tenantId: number, businessId: number | null) {
  const row =
    (await tx.advanceConfig.findFirst({ where: { tenantId, businessId, branchId: null } })) ??
    (await tx.advanceConfig.findFirst({ where: { tenantId, businessId: null, branchId: null } }));
  if (row) return row;
  return tx.advanceConfig.create({ data: { tenantId, businessId: null, branchId: null, config: DEFAULT_ADVANCE_CONFIG as unknown as Prisma.InputJsonValue } });
}

export function advanceConfig(row: { config: unknown } | null): AdvanceConfigData {
  return { ...DEFAULT_ADVANCE_CONFIG, ...((row?.config as Partial<AdvanceConfigData>) ?? {}) };
}

/** Reserve + return the next number for an advance / settlement / refund (FOR UPDATE). */
export async function nextAdvanceNumber(tx: Tx, tenantId: number, businessId: number | null, kind: "advance" | "settlement" | "refund"): Promise<string> {
  const row = await getAdvanceConfigRow(tx, tenantId, businessId);
  const col = kind === "settlement" ? "seqSettlement" : kind === "refund" ? "seqRefund" : "seqAdvance";
  const locked = await tx.$queryRawUnsafe<Array<Record<string, number>>>(`SELECT \`${col}\` AS seq FROM \`advance_configs\` WHERE \`id\` = ? FOR UPDATE`, row.id);
  const cfg = advanceConfig(row);
  const prefix = kind === "settlement" ? (cfg.settlementPrefix || "ASL") : kind === "refund" ? (cfg.refundPrefix || "ARF") : (cfg.advancePrefix || "ADV");
  const assigned = Math.max(1, Number(locked[0]?.seq) || 0);
  await tx.advanceConfig.update({ where: { id: row.id }, data: { [col]: assigned + 1 } });
  return `${prefix}/${String(assigned).padStart(5, "0")}`;
}

const cashOrBank = (mode?: string | null) => ((mode ?? "").toLowerCase() === "cash" ? ACC.CASH : ACC.BANK);

type AdvanceRow = Prisma.AdvanceGetPayload<Record<string, never>>;

/** Post the advance voucher on approval. received → Dr Cash/Bank, Cr liability;
 *  paid → Dr asset, Cr Cash/Bank. Returns the journal id. */
export async function postAdvanceVoucher(tx: Tx, a: AdvanceRow): Promise<number | null> {
  const amt = r2(num(a.netAmount));
  if (amt <= 0) return null;
  const control = a.accountCode || (a.direction === "received" ? ACC.CUSTOMER_ADVANCE : ACC.SUPPLIER_ADVANCE);
  const bank = cashOrBank(a.paymentMode);
  const lines = a.direction === "received"
    ? [{ code: bank, debit: amt }, { code: control, credit: amt }]
    : [{ code: control, debit: amt }, { code: bank, credit: amt }];
  const jid = await postJournal(tx, {
    tenantId: a.tenantId, businessId: a.businessId, branchId: a.branchId, voucherType: a.direction === "received" ? "RECEIPT" : "PAYMENT", prefix: "AV",
    date: a.advanceDate, narration: `Advance ${a.advanceNo} — ${a.advanceTypeName ?? ""} — ${a.partyName ?? ""}${a.bankName ? ` — ${a.bankName}` : ""}`,
    sourceType: "ADVANCE", sourceId: a.id, refNo: a.advanceNo, createdBy: a.createdBy,
    costCenterId: a.costCenterId, profitCenterId: a.profitCenterId, department: a.department,
    lines,
  });
  await recordBankMovement(tx, { tenantId: a.tenantId, businessId: a.businessId, branchId: a.branchId, userId: a.createdBy, userName: a.createdByName }, { bankId: a.bankId, bankName: a.bankName, bankAccount: a.bankAccount, date: a.advanceDate, direction: a.direction === "received" ? "in" : "out", amount: amt, mode: a.paymentMode, reference: a.paymentRef, sourceType: "Advance", sourceId: a.id, sourceNo: a.advanceNo, partyName: a.partyName, journalId: typeof jid === "number" ? jid : null, narration: `Advance ${a.advanceNo}` });
  return jid;
}

/** Post a settlement. received (customer) → Dr liability, Cr AR. paid → Dr AP (or
 *  chosen expense), Cr asset. */
export async function postSettlement(tx: Tx, s: Prisma.AdvanceSettlementGetPayload<Record<string, never>>, a: AdvanceRow): Promise<number | null> {
  const amt = r2(num(s.settlementAmount));
  if (amt <= 0) return null;
  const control = a.accountCode || (a.direction === "received" ? ACC.CUSTOMER_ADVANCE : ACC.SUPPLIER_ADVANCE);
  const against = a.direction === "received" ? ACC.RECEIVABLE : (s.expenseAccountCode || ACC.PAYABLE);
  const lines = a.direction === "received"
    ? [{ code: control, debit: amt }, { code: against, credit: amt }]
    : [{ code: against, debit: amt }, { code: control, credit: amt }];
  return postJournal(tx, {
    tenantId: s.tenantId, businessId: s.businessId, branchId: s.branchId, voucherType: "JOURNAL", prefix: "AS",
    date: s.settlementDate, narration: `Advance settlement ${s.settlementNo} vs ${a.advanceNo} — ${a.partyName ?? ""}`,
    sourceType: "ADVANCE_SETTLEMENT", sourceId: s.id, refNo: s.settlementNo, createdBy: s.createdBy,
    costCenterId: a.costCenterId, profitCenterId: a.profitCenterId,
    lines,
  });
}

/** Post a refund. received (customer) → Dr liability, Cr Cash/Bank. paid (employee
 *  returns cash) → Dr Cash/Bank, Cr asset. */
export async function postRefund(tx: Tx, rf: Prisma.AdvanceRefundGetPayload<Record<string, never>>, a: AdvanceRow): Promise<number | null> {
  const amt = r2(num(rf.refundAmount));
  if (amt <= 0) return null;
  const control = a.accountCode || (a.direction === "received" ? ACC.CUSTOMER_ADVANCE : ACC.SUPPLIER_ADVANCE);
  const bank = cashOrBank(rf.refundMode);
  const lines = a.direction === "received"
    ? [{ code: control, debit: amt }, { code: bank, credit: amt }]
    : [{ code: bank, debit: amt }, { code: control, credit: amt }];
  return postJournal(tx, {
    tenantId: rf.tenantId, businessId: rf.businessId, branchId: rf.branchId, voucherType: a.direction === "received" ? "PAYMENT" : "RECEIPT", prefix: "AR",
    date: rf.refundDate, narration: `Advance refund ${rf.refundNo} vs ${a.advanceNo} — ${a.partyName ?? ""}`,
    sourceType: "ADVANCE_REFUND", sourceId: rf.id, refNo: rf.refundNo, createdBy: rf.createdBy,
    lines,
  });
}

export async function reverseAdvanceGl(tx: Tx, tenantId: number, sourceType: string, sourceId: number, date: string, createdBy?: number | null) {
  return reverseJournalForSource(tx, tenantId, sourceType, sourceId, date, createdBy);
}

/** Recompute an advance's settled/refunded/balance + status from its child records. */
export async function recomputeAdvance(tx: Tx, advanceId: number) {
  const a = await tx.advance.findUnique({ where: { id: advanceId } });
  if (!a) return;
  const [sett, ref] = await Promise.all([
    tx.advanceSettlement.aggregate({ where: { advanceId, status: { in: ["Approved", "Settled"] } }, _sum: { settlementAmount: true } }),
    tx.advanceRefund.aggregate({ where: { advanceId, status: { in: ["Approved", "Refunded"] } }, _sum: { refundAmount: true } }),
  ]);
  const net = r2(num(a.netAmount));
  const settled = r2(num(sett._sum.settlementAmount));
  const refunded = r2(num(ref._sum.refundAmount));
  const balance = r2(net - settled - refunded);
  let status = a.status;
  if (["Collected", "Paid", "Partially Settled", "Fully Settled", "Refunded"].includes(a.status)) {
    if (balance <= 0.01) status = settled > 0 ? "Fully Settled" : "Refunded";
    else if (settled > 0 || refunded > 0) status = "Partially Settled";
    else status = a.direction === "received" ? "Collected" : "Paid";
  }
  await tx.advance.update({ where: { id: advanceId }, data: { settledAmount: settled, refundedAmount: refunded, balanceAmount: balance, status } });
}

/** Open advances (with a balance) for a party — used by the invoice/expense
 *  adjustment popups (Phase 2 integration). */
export async function listAvailableAdvances(tenantId: number, businessId: number | null, partyType: string, partyId: number | null) {
  return prisma.advance.findMany({
    where: { tenantId, ...(businessId != null ? { businessId } : {}), partyType, ...(partyId ? { partyId } : {}), status: { in: OPEN_ADVANCE }, balanceAmount: { gt: 0 } },
    orderBy: { id: "asc" },
    select: { id: true, advanceNo: true, advanceDate: true, advanceTypeName: true, direction: true, netAmount: true, balanceAmount: true, accountCode: true },
  });
}

/** Create a settlement whose GL is embedded in the PARENT voucher (invoice/expense)
 *  — no separate journal (avoids double-count). Records it + recomputes the advance.
 *  Returns the settlement, or null if the advance is invalid / over-settled. */
export async function createInlineSettlement(tx: Tx, args: { tenantId: number; businessId: number | null; branchId: number | null; advanceId: number; amount: number; refDocType: string; refDocId: number; refInvoice: string; journalId: number | null; createdBy: number | null; createdByName: string | null }) {
  const amount = r2(args.amount);
  if (amount <= 0) return null;
  const adv = await tx.advance.findFirst({ where: { id: args.advanceId, tenantId: args.tenantId } });
  if (!adv || !["Collected", "Paid", "Partially Settled"].includes(adv.status) || amount > num(adv.balanceAmount) + 0.01) return null;
  const settlementNo = await nextAdvanceNumber(tx, args.tenantId, args.businessId, "settlement");
  const s = await tx.advanceSettlement.create({
    data: { tenantId: args.tenantId, businessId: args.businessId, branchId: args.branchId, settlementNo, settlementDate: new Date().toISOString().slice(0, 10), advanceId: args.advanceId, refDocType: args.refDocType, refDocId: args.refDocId, refInvoice: args.refInvoice, settlementAmount: amount, method: "Automatic", approvalStatus: "Approved", status: "Approved", journalId: args.journalId, createdBy: args.createdBy, createdByName: args.createdByName },
  });
  await recomputeAdvance(tx, args.advanceId);
  return s;
}

/** Reverse the inline advance settlements created by a source document (invoice)
 *  when that document is cancelled — restores the advance balance. The source's own
 *  GL reversal handles the accounting; this just voids the settlement records. */
export async function reverseInlineSettlements(tx: Tx, tenantId: number, refDocType: string, refDocId: number) {
  const setts = await tx.advanceSettlement.findMany({ where: { tenantId, refDocType, refDocId, status: "Approved" } });
  for (const s of setts) { await tx.advanceSettlement.update({ where: { id: s.id }, data: { status: "Reversed", reversedAt: new Date(), reverseReason: "Source document cancelled" } }); await recomputeAdvance(tx, s.advanceId); }
  return setts.length;
}

export { prisma };

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import { ACC } from "@/lib/accounting/accounts";
import { postJournal, reverseJournalForSource } from "@/lib/accounting/post";
import { statutoryDef, financialYear } from "./types";
import type { StatutoryPaymentCreateInput } from "@/lib/contracts/statutory";

/**
 * Government-Payment workflow service — Draft → Submitted → Approved → Paid (or
 * Cancelled). The GL is only touched on Paid (Dr liability + Dr interest/penalty /
 * Cr Bank) and reversed on cancelling a Paid payment. Reused by every statutory head.
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const SOURCE = "STATUTORY_PAYMENT";
type SvcUser = { id: number; tenantId: number; fullName?: string | null };

function bankCode(mode: string | null | undefined): string {
  return (mode || "Bank").toLowerCase().includes("cash") ? ACC.CASH : ACC.BANK;
}

/** Create a Draft government payment with an auto number (SP-000001). */
export async function createPayment(user: SvcUser, scope: ActiveScope, input: StatutoryPaymentCreateInput) {
  const def = statutoryDef(input.statutoryType);
  if (!def) throw new Error("Unknown statutory type.");
  const paymentDate = (input.paymentDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const paid = r2(input.paidAmount);
  const interest = r2(input.interest);
  const penalty = r2(input.penalty);
  const totalPayable = r2(paid + interest + penalty);
  const balance = r2(Math.max(0, r2(input.liabilityAmount) - r2(input.alreadyPaid)));

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.statutoryPayment.create({
      data: {
        tenantId: user.tenantId, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null,
        paymentNo: "TMP", paymentDate, statutoryType: def.code, financialYear: financialYear(input.taxPeriod), taxPeriod: input.taxPeriod,
        liabilityAmount: r2(input.liabilityAmount), alreadyPaid: r2(input.alreadyPaid), balanceAmount: balance,
        interest, penalty, paidAmount: paid, totalPayable, breakupJson: input.breakupJson ?? null,
        paymentMode: input.paymentMode || null, bankAccount: input.bankAccount || null, referenceNo: input.referenceNo || null,
        transactionNo: input.transactionNo || null, remarks: input.remarks || null,
        challanNo: input.challanNo || null, cpin: input.cpin || null, cin: input.cin || null, bsrCode: input.bsrCode || null,
        challanBank: input.challanBank || null, govRef: input.govRef || null, ackNo: input.ackNo || null,
        attachmentsJson: input.attachments && input.attachments.length ? JSON.stringify(input.attachments) : null,
        status: "Draft", createdBy: user.id,
      },
    });
    const paymentNo = `SP-${String(row.id).padStart(6, "0")}`;
    await tx.statutoryPayment.update({ where: { id: row.id }, data: { paymentNo } });
    return { id: row.id, paymentNo };
  });
  return created;
}

/** Move a payment through its workflow. Posting happens on markPaid. */
export async function transition(user: SvcUser, scope: ActiveScope, action: string, id: number, reason?: string) {
  const cur = await prisma.statutoryPayment.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!cur) throw new Error("Payment not found.");
  const def = statutoryDef(cur.statutoryType);
  if (!def) throw new Error("Unknown statutory type.");
  const now = new Date();

  if (action === "submit") {
    if (cur.status !== "Draft") throw new Error("Only a Draft can be submitted.");
    await prisma.statutoryPayment.update({ where: { id }, data: { status: "Submitted", submittedBy: user.id, submittedAt: now } });
    return { status: "Submitted" };
  }

  if (action === "approve") {
    if (cur.status !== "Submitted") throw new Error("Only a Submitted payment can be approved.");
    await prisma.statutoryPayment.update({ where: { id }, data: { status: "Approved", approvedBy: user.id, approvedByName: user.fullName ?? null, approvedAt: now } });
    return { status: "Approved" };
  }

  if (action === "markPaid") {
    if (cur.status !== "Approved") throw new Error("Only an Approved payment can be marked Paid.");
    const total = r2(Number(cur.totalPayable));
    if (total <= 0) throw new Error("Nothing to pay.");
    await prisma.$transaction(async (tx) => {
      const lines: { code: string; debit?: number; credit?: number; narration?: string }[] = [
        { code: def.liabilityAccount, debit: r2(Number(cur.paidAmount)), narration: `${def.label} liability paid — ${cur.taxPeriod}` },
      ];
      const ip = r2(Number(cur.interest) + Number(cur.penalty));
      if (ip > 0) lines.push({ code: ACC.STATUTORY_PENALTY, debit: ip, narration: `${def.label} interest & penalty` });
      lines.push({ code: bankCode(cur.paymentMode), credit: total, narration: `${def.label} government payment ${cur.paymentNo}` });
      const journalId = await postJournal(tx as Prisma.TransactionClient, {
        tenantId: user.tenantId, businessId: cur.businessId, branchId: cur.branchId, voucherType: "PAYMENT", prefix: "SP", date: cur.paymentDate,
        narration: `${def.label} Government Payment — ${cur.paymentNo} (${cur.taxPeriod})`,
        sourceType: SOURCE, sourceId: cur.id, refNo: cur.referenceNo || cur.challanNo || cur.paymentNo, createdBy: user.id, lines,
      });
      await tx.statutoryPayment.update({ where: { id }, data: { status: "Paid", journalId: journalId ?? null } });
    });
    return { status: "Paid" };
  }

  if (action === "cancel") {
    if (cur.status === "Cancelled") throw new Error("Already cancelled.");
    await prisma.$transaction(async (tx) => {
      if (cur.status === "Paid" && cur.journalId) {
        await reverseJournalForSource(tx as Prisma.TransactionClient, user.tenantId, SOURCE, cur.id, new Date().toISOString().slice(0, 10), user.id);
      }
      await tx.statutoryPayment.update({ where: { id }, data: { status: "Cancelled", cancelledBy: user.id, cancelledAt: now, cancelReason: reason || null } });
    });
    return { status: "Cancelled" };
  }

  if (action === "verifyChallan") {
    await prisma.statutoryPayment.update({ where: { id }, data: { challanStatus: "Verified", challanVerifiedBy: user.id, challanVerifiedAt: now } });
    return { challanStatus: "Verified" };
  }

  throw new Error("Unknown action.");
}

export async function saveChallan(user: SvcUser, id: number, data: { challanNo?: string; cpin?: string; cin?: string; bsrCode?: string; challanBank?: string; govRef?: string; ackNo?: string; attachments?: { fileName: string; fileUrl: string; fileType?: string | null; size?: number }[] }) {
  const cur = await prisma.statutoryPayment.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!cur) throw new Error("Payment not found.");
  await prisma.statutoryPayment.update({
    where: { id },
    data: {
      challanNo: data.challanNo ?? cur.challanNo, cpin: data.cpin ?? cur.cpin, cin: data.cin ?? cur.cin, bsrCode: data.bsrCode ?? cur.bsrCode,
      challanBank: data.challanBank ?? cur.challanBank, govRef: data.govRef ?? cur.govRef, ackNo: data.ackNo ?? cur.ackNo,
      ...(data.attachments ? { attachmentsJson: JSON.stringify(data.attachments) } : {}),
    },
  });
  return { ok: true };
}

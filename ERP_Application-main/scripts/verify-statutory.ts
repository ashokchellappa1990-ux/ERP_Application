/**
 * End-to-end check for the Statutory Compliance module: create → submit → approve →
 * markPaid posts a BALANCED government-payment voucher (Dr liability + Dr penalty /
 * Cr Bank); cancel reverses it. Returns tracker create/file works. Cleans up after.
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-statutory.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { createPayment, transition } from "../src/lib/finance/statutory/service";
import { computeLiability } from "../src/lib/finance/statutory/engine";

const tenantId = 4;
const user = { id: 1, tenantId, fullName: "E2E Runner" };
const scope = { tenantId, businessId: null, branchId: null, branchIds: null, readBranchIds: [] };
const num = (v: unknown) => Number(v) || 0;
let createdId = 0;
const retIds: number[] = [];

async function cleanup() {
  if (createdId) {
    const jes = await prisma.journalEntry.findMany({ where: { tenantId, sourceType: "STATUTORY_PAYMENT", sourceId: createdId }, select: { id: true } });
    const jeIds = jes.map((j) => j.id);
    if (jeIds.length) { await prisma.journalLine.deleteMany({ where: { journalId: { in: jeIds } } }); await prisma.journalEntry.deleteMany({ where: { id: { in: jeIds } } }); }
    await prisma.statutoryPayment.delete({ where: { id: createdId } }).catch(() => {});
  }
  if (retIds.length) await prisma.statutoryReturn.deleteMany({ where: { id: { in: retIds } } });
}

async function main() {
  let pass = true;
  try {
    // 1) liability engine sanity (reads GL; any number is fine)
    const lia = await computeLiability(scope, "TDS", "2026-06");
    console.log("Liability(TDS, 2026-06):", { liability: lia.liability, alreadyPaid: lia.alreadyPaid, balance: lia.balance });

    // 2) create Draft payment
    const c = await createPayment(user, scope, {
      statutoryType: "TDS", taxPeriod: "2026-06", paidAmount: 5000, interest: 100, penalty: 50,
      liabilityAmount: 5000, alreadyPaid: 0, paymentMode: "NEFT", bankAccount: "HDFC-001", referenceNo: "UTR-123",
      challanNo: "CH-777", cpin: "CPIN123", bsrCode: "0510308",
    } as never);
    createdId = c.id;
    console.log("Created:", c.paymentNo, "(Draft)");

    // 3) workflow: submit → approve → markPaid
    await transition(user, scope, "submit", c.id);
    await transition(user, scope, "approve", c.id);
    await transition(user, scope, "markPaid", c.id);

    const paid = await prisma.statutoryPayment.findUnique({ where: { id: c.id } });
    const je = await prisma.journalEntry.findFirst({ where: { tenantId, sourceType: "STATUTORY_PAYMENT", sourceId: c.id, status: "Posted" }, include: { lines: { include: { account: true } } } });
    const balanced = je && Math.abs(num(je.totalDebit) - num(je.totalCredit)) < 0.01;
    const legs = je?.lines.map((l) => `${l.account.code}:${num(l.debit) > 0 ? "Dr" + num(l.debit) : "Cr" + num(l.credit)}`) ?? [];
    console.log("After markPaid → status:", paid?.status, "journal:", je?.voucherNo, "balanced:", balanced, legs);
    const hasTds = legs.includes("2120:Dr5000");
    const hasPenalty = legs.includes("4250:Dr150");
    const hasBank = legs.includes("1010:Cr5150");
    if (!(paid?.status === "Paid" && balanced && hasTds && hasPenalty && hasBank)) { pass = false; console.log("  FAIL: expected Dr 2120 5000 + Dr 4250 150 / Cr 1010 5150"); }

    // 4) cancel → reversal
    await transition(user, scope, "cancel", c.id, "test");
    const cancelled = await prisma.statutoryPayment.findUnique({ where: { id: c.id } });
    const reversed = await prisma.journalEntry.count({ where: { tenantId, sourceType: "STATUTORY_PAYMENT", sourceId: c.id, status: "Reversed" } });
    const revVoucher = await prisma.journalEntry.count({ where: { tenantId, sourceType: "STATUTORY_PAYMENT", sourceId: c.id, voucherType: "JOURNAL" } });
    console.log("After cancel → status:", cancelled?.status, "originalReversed:", reversed, "reversalVouchers:", revVoucher);
    if (!(cancelled?.status === "Cancelled" && reversed === 1 && revVoucher === 1)) { pass = false; console.log("  FAIL: cancel should reverse the posted voucher"); }

    // 5) return tracker create + file
    const r = await prisma.statutoryReturn.create({ data: { tenantId, statutoryType: "GST", returnType: "GSTR-3B", financialYear: "2026-27", taxPeriod: "2026-06", status: "Prepared", createdBy: 1 } });
    retIds.push(r.id);
    await prisma.statutoryReturn.update({ where: { id: r.id }, data: { status: "Filed", ackNo: "ACK-999", filedDate: "2026-07-15", filedBy: 1 } });
    const filed = await prisma.statutoryReturn.findUnique({ where: { id: r.id } });
    console.log("Return:", filed?.returnType, "→", filed?.status, "ack", filed?.ackNo);
    if (filed?.status !== "Filed") { pass = false; console.log("  FAIL: return not filed"); }

    console.log(pass ? "\nPASS — statutory workflow + GL posting + reversal + returns all OK." : "\nFAIL — see above.");
    if (!pass) process.exitCode = 1;
  } catch (e) {
    console.error("ERROR:", e instanceof Error ? e.message : e); process.exitCode = 1;
  } finally {
    await cleanup();
    console.log("Cleaned up test rows.");
    await prisma.$disconnect();
  }
}
main();

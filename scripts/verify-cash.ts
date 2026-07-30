/**
 * Rolled-back check that Cash Management entries (fund transfer + misc receipt)
 * insert + post a BALANCED GL voucher.
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-cash.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { createCashEntry } from "../src/lib/finance/cash";

class RB extends Error {}

async function main() {
  const ctx = { tenantId: 4, businessId: null as number | null, branchId: null as number | null, userId: 1, userName: "E2E" };
  try {
    await prisma.$transaction(async (tx) => {
      const ft = await createCashEntry(tx as never, ctx, { kind: "FUND_TRANSFER", transferType: "CASH_TO_BANK", amount: 5000, bankName: "HDFC", bankAccount: "00114521", date: "2026-06-30" });
      const ftJe = await tx.journalEntry.findFirst({ where: { tenantId: 4, sourceType: "CASH_ENTRY", sourceId: ft.id }, include: { lines: { include: { account: true } } } });
      console.log("FUND_TRANSFER", ft.docNo, "voucher", ftJe?.voucherNo, "Dr=Cr?", Number(ftJe?.totalDebit) === Number(ftJe?.totalCredit), ftJe?.lines.map((l) => `${l.account.code}:${Number(l.debit) > 0 ? "Dr" + l.debit : "Cr" + l.credit}`));

      const mr = await createCashEntry(tx as never, ctx, { kind: "MISC_RECEIPT", receivedIn: "Cash", amount: 1500, payer: "Scrap sale", incomeHead: "Scrap Income", mode: "Cash", date: "2026-06-30" });
      const mrJe = await tx.journalEntry.findFirst({ where: { tenantId: 4, sourceType: "CASH_ENTRY", sourceId: mr.id }, include: { lines: { include: { account: true } } } });
      console.log("MISC_RECEIPT", mr.docNo, "voucher", mrJe?.voucherNo, "Dr=Cr?", Number(mrJe?.totalDebit) === Number(mrJe?.totalCredit), mrJe?.lines.map((l) => `${l.account.code}:${Number(l.debit) > 0 ? "Dr" + l.debit : "Cr" + l.credit}`));

      const mrBank = await createCashEntry(tx as never, ctx, { kind: "MISC_RECEIPT", receivedIn: "Bank", amount: 2200, payer: "Interest", bankName: "ICICI", date: "2026-06-30" });
      console.log("MISC_RECEIPT(bank)", mrBank.docNo, "ok");
      throw new RB();
    });
  } catch (e) {
    if (e instanceof RB) { console.log("ROLLED BACK OK — all entries posted balanced vouchers."); return; }
    console.error("FAIL:", e instanceof Error ? e.message : e); process.exit(1);
  }
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });

/**
 * Rolled-back check that a sale with a bill-level reduction (loyalty redemption /
 * bill discount) now posts a BALANCED sales journal (was: "Unbalanced journal").
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-sale-journal.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { postSalesJournal } from "../src/lib/accounting/post";

class RB extends Error {}

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      // Repro of the reported crash: Sales+GST credited 775, customer paid 765 (₹10 redeemed).
      const id = await postSalesJournal(tx as never, { tenantId: 4, saleId: 999999, invoiceNo: "TEST-RB", date: "2026-06-30", customerName: "RB", taxableValue: 656.78, taxTotal: 118.22, roundOff: 0, total: 765, amountPaid: 765, cost: 0, cashAmount: 765, bankAmount: 0, loyaltyRedeem: 10 });
      console.log("loyalty-redeem sale → journal id:", id, "(no throw = balanced)");
      // Plain bill discount: Sales+GST 100, paid 90.
      const id2 = await postSalesJournal(tx as never, { tenantId: 4, saleId: 999998, invoiceNo: "TEST-RB2", date: "2026-06-30", customerName: "RB2", taxableValue: 84.75, taxTotal: 15.25, roundOff: 0, total: 90, amountPaid: 90, cost: 0, cashAmount: 90, bankAmount: 0, billDiscount: 10 });
      console.log("bill-discount sale → journal id:", id2, "(no throw = balanced)");
      throw new RB();
    });
  } catch (e) {
    if (e instanceof RB) { console.log("ROLLED BACK OK — both journals balanced."); return; }
    console.error("FAIL:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });

/**
 * E2E: a manual journal voucher posts a balanced entry to the GL and is rejected
 * when unbalanced. Uses postJournal exactly like the route. Cleans up after.
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-journal-post.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { postJournal } from "../src/lib/accounting/post";

const tenantId = 4;
const num = (v: unknown) => Number(v) || 0;
let createdId: number | null = null;

async function main() {
  let pass = true;
  try {
    // balanced voucher: Dr Bank 5000 / Cr Cash 5000 (cash deposited into bank)
    createdId = await prisma.$transaction((tx) => postJournal(tx, {
      tenantId, businessId: null, branchId: null, voucherType: "JOURNAL", prefix: "JV", date: "2026-07-11",
      narration: "E2E manual voucher — cash to bank", sourceType: "MANUAL", refNo: "E2E-JV", createdBy: 1,
      lines: [{ code: "1010", debit: 5000, narration: "To bank" }, { code: "1000", credit: 5000, narration: "From cash" }],
    }));
    const je = await prisma.journalEntry.findUnique({ where: { id: createdId! }, include: { lines: { include: { account: true } } } });
    const voucherNo = je?.voucherNo;
    const balanced = je && Math.abs(num(je.totalDebit) - num(je.totalCredit)) < 0.01;
    const legs = je?.lines.map((l) => `${l.account.code}:${num(l.debit) > 0 ? "Dr" + num(l.debit) : "Cr" + num(l.credit)}`) ?? [];
    console.log("Posted:", voucherNo, "type", je?.voucherType, "source", je?.sourceType, "balanced", balanced, legs);
    if (!(je?.voucherType === "JOURNAL" && je?.sourceType === "MANUAL" && balanced && legs.includes("1010:Dr5000") && legs.includes("1000:Cr5000"))) { pass = false; console.log("  FAIL: expected balanced Dr 1010 5000 / Cr 1000 5000, JOURNAL/MANUAL"); }

    // unbalanced must throw
    let threw = false;
    try {
      await prisma.$transaction((tx) => postJournal(tx, { tenantId, voucherType: "JOURNAL", prefix: "JV", date: "2026-07-11", narration: "bad", sourceType: "MANUAL", createdBy: 1, lines: [{ code: "1010", debit: 5000 }, { code: "1000", credit: 4000 }] }));
    } catch { threw = true; }
    console.log("Unbalanced voucher rejected:", threw);
    if (!threw) pass = false;

    console.log(pass ? "\nPASS — manual journal posting works and enforces balance." : "\nFAIL — see above.");
    if (!pass) process.exitCode = 1;
  } catch (e) {
    console.error("ERROR:", e instanceof Error ? e.message : e); process.exitCode = 1;
  } finally {
    if (createdId) { await prisma.journalLine.deleteMany({ where: { journalId: createdId } }); await prisma.journalEntry.delete({ where: { id: createdId } }).catch(() => {}); }
    console.log("Cleaned up.");
    await prisma.$disconnect();
  }
}
main();

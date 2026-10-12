/**
 * Rolled-back check that Cost/Profit Centre masters persist and that postJournal
 * stamps costCenterId/profitCenterId/department/project onto the JournalEntry.
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-cost-centre.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { postJournal } from "../src/lib/accounting/post";
import { ensureAccounts } from "../src/lib/accounting/accounts";

class RB extends Error {}

async function main() {
  const tenantId = 4;
  try {
    await prisma.$transaction(async (tx) => {
      await ensureAccounts(tx as never, tenantId);
      const cc = await tx.costCentre.create({ data: { tenantId, code: "TMP", name: "E2E Sales Dept", status: "Active" } });
      await tx.costCentre.update({ where: { id: cc.id }, data: { code: `CC-${String(cc.id).padStart(4, "0")}` } });
      const pc = await tx.profitCentre.create({ data: { tenantId, code: "TMP", name: "E2E Retail BU", status: "Active" } });
      await tx.profitCentre.update({ where: { id: pc.id }, data: { code: `PC-${String(pc.id).padStart(4, "0")}` } });
      console.log("Created cost centre id", cc.id, "profit centre id", pc.id);

      const je = await postJournal(tx as never, {
        tenantId, businessId: null, branchId: null, voucherType: "PAYMENT", prefix: "PC", date: "2026-07-10",
        narration: "E2E dimension test", sourceType: "E2E_TEST", sourceId: cc.id, refNo: "E2E-1", createdBy: 1,
        costCenterId: cc.id, profitCenterId: pc.id, department: "Sales", project: "Diwali Promo",
        lines: [ { code: "4200", debit: 1000, narration: "Expense" }, { code: "1000", credit: 1000, narration: "Cash" } ],
      });
      const row = await tx.journalEntry.findFirst({ where: { tenantId, sourceType: "E2E_TEST", sourceId: cc.id } });
      console.log("Journal", row?.voucherNo ?? `#${je}`, "->",
        "costCenterId=", row?.costCenterId, "profitCenterId=", row?.profitCenterId, "department=", row?.department, "project=", row?.project);
      const pass = row?.costCenterId === cc.id && row?.profitCenterId === pc.id && row?.department === "Sales" && row?.project === "Diwali Promo";
      console.log(pass ? "PASS — dimensions captured on the journal entry." : "FAIL — dimensions NOT captured.");
      if (!pass) process.exitCode = 1;
      throw new RB();
    });
  } catch (e) {
    if (e instanceof RB) { console.log("ROLLED BACK OK."); return; }
    console.error("FAIL:", e instanceof Error ? e.message : e); process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}
main();

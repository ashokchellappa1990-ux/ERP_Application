/**
 * E2E: sub-head + GST receipt → post → balanced multi-credit GL (income + output GST).
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-receipt2.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { listCategories, createReceipt, transitionReceipt, getReceiptDetail } from "../src/lib/finance/receipt";

async function main() {
  const s = { tenantId: 4, businessId: null as number | null };
  const ctx = { ...s, branchId: null as number | null, userId: 1, userName: "E2E" };
  const cats = await listCategories(s);
  const rent = cats.find((c) => c.code === "RENT")!;
  const { id, voucherNo } = await createReceipt(ctx, {
    categoryId: rent.id, amount: 14160, gstApplicable: true, mode: "Bank", bankName: "HDFC", partyType: "Other", partyName: "Tenant ABC", partyGstin: "29ABCDE1234F1Z5",
    heads: [
      { headName: "Shop Rent", taxable: 10000, gstRate: 18, creditCode: "3210", creditName: "Rental Income" },
      { headName: "Maintenance", taxable: 2000, gstRate: 18, creditCode: "3260", creditName: "Employee Recovery" },
    ],
  });
  console.log("created:", voucherNo, "id", id);
  await transitionReceipt(ctx, id, "post");
  const d = await getReceiptDetail(s, id);
  console.log("status:", d!.status, "taxable:", d!.taxableAmount, "gst:", d!.gstAmount, "total:", d!.amount);
  console.log("heads:", d!.heads.map((h) => `${h.headName}:${h.taxable}+gst${h.gstAmount}`));
  const dr = d!.journal.reduce((a, l) => a + l.debit, 0), cr = d!.journal.reduce((a, l) => a + l.credit, 0);
  console.log("GL:", d!.journal.map((l) => `${l.code}:${l.debit ? "Dr" + l.debit : "Cr" + l.credit}`), "balanced?", dr === cr && dr === 14160);

  const je = await prisma.journalEntry.findFirst({ where: { tenantId: 4, sourceType: "RECEIPT_TXN", sourceId: id } });
  if (je) { await prisma.journalLine.deleteMany({ where: { journalId: je.id } }); await prisma.journalEntry.delete({ where: { id: je.id } }); }
  await prisma.receiptTransaction.delete({ where: { id } });
  console.log("cleaned up. OK");
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });

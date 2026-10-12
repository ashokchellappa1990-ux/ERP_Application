/**
 * E2E for the Receipt module: seed categories, create a draft receipt, post it,
 * verify the GL voucher balances, then clean up (delete the test receipt + voucher).
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-receipt.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { listCategories, createReceipt, transitionReceipt, getReceiptDetail } from "../src/lib/finance/receipt";

async function main() {
  const s = { tenantId: 4, businessId: null as number | null };
  const ctx = { ...s, branchId: null as number | null, userId: 1, userName: "E2E" };
  const cats = await listCategories(s);
  console.log("categories:", cats.length, cats.slice(0, 3).map((c) => `${c.code}:${c.creditName}`));
  const rent = cats.find((c) => c.code === "RENT") ?? cats[0];

  const { id, voucherNo } = await createReceipt(ctx, { categoryId: rent.id, amount: 5000, mode: "Bank", bankName: "HDFC", partyType: "Other", partyName: "Tenant ABC", referenceNo: "NEFT123", narration: "June rent" });
  console.log("created:", voucherNo, "id", id);

  await transitionReceipt(ctx, id, "post");
  const d = await getReceiptDetail(s, id);
  const dr = d!.journal.reduce((a, l) => a + l.debit, 0), cr = d!.journal.reduce((a, l) => a + l.credit, 0);
  console.log("posted status:", d!.status, "voucher", d!.voucherJournalNo);
  console.log("GL lines:", d!.journal.map((l) => `${l.code}:${l.debit ? "Dr" + l.debit : "Cr" + l.credit}`), "balanced?", dr === cr && dr === 5000);
  console.log("audit:", d!.audit.map((a) => a.action));

  // cleanup
  const je = await prisma.journalEntry.findFirst({ where: { tenantId: 4, sourceType: "RECEIPT_TXN", sourceId: id } });
  if (je) { await prisma.journalLine.deleteMany({ where: { journalId: je.id } }); await prisma.journalEntry.delete({ where: { id: je.id } }); }
  await prisma.receiptTransaction.delete({ where: { id } });
  const gone = await prisma.receiptTransaction.findUnique({ where: { id } });
  console.log("cleaned up:", gone === null);
  console.log("OK");
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });

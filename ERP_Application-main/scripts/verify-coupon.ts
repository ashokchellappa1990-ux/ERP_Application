/**
 * E2E for the Coupon module: config → campaign → rule → generate → issue →
 * validate → redeem (+GL). Cleans up (deletes the test campaign + voucher).
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-coupon.ts
 */
import { prisma } from "../src/lib/db/prisma";
import * as svc from "../src/lib/coupon/service";

async function main() {
  const s = { tenantId: 4, businessId: null as number | null };
  const ctx = { ...s, branchId: null as number | null, userId: 1, userName: "E2E" };
  const day = new Date().toISOString().slice(0, 10);
  const start = "2020-01-01", end = "2099-12-31";

  const campId = await svc.createCampaign(ctx, { code: `E2E-${Date.now()}`, name: "E2E Diwali 10%", couponType: "Unique", status: "Active", startDate: start, endDate: end, marketingBudget: 5000 });
  await svc.saveRule(ctx, campId, null, { name: "10% off ≥1000", discountType: "Percentage", discountValue: 10, maxDiscount: 500, minBill: 1000, usageType: "SingleUse", gstRule: "AfterGST", reduceTaxable: true, maxPerCampaign: 100 });
  const gen = await svc.generateCoupons(ctx, { campaignId: campId, quantity: 3 });
  console.log("generated:", gen.count, "batch", gen.batchNo, "range", gen.firstNo, "…", gen.lastNo);

  const first = await prisma.coupon.findFirst({ where: { campaignId: campId }, orderBy: { id: "asc" } });
  await svc.issueCoupon(ctx, { couponId: first!.id, issueTo: "WalkIn", partyName: "Walk-in" });
  console.log("issued:", first!.couponNo);

  const v = await svc.validateCoupon(s, { couponCode: first!.couponNo, billAmount: 2000, channel: "POS", paymentMode: "Cash", date: day, items: [{ productId: 1, qty: 2, amount: 2000 }] });
  console.log("validate:", v.valid, "discount", v.discountAmount, "taxableReduced", v.taxableReduced, "reason", v.reason);

  const r = await svc.redeemCoupon(ctx, { couponCode: first!.couponNo, billAmount: 2000, channel: "POS", paymentMode: "Cash", invoiceNo: "INV-E2E", post: true, items: [{ productId: 1, qty: 2, amount: 2000 }] });
  console.log("redeemed:", r.couponNo, "discount", r.discountAmount);
  const je = await prisma.journalEntry.findFirst({ where: { tenantId: 4, sourceType: "COUPON_REDEMPTION", sourceId: first!.id }, include: { lines: { include: { account: true } } } });
  console.log("GL:", je?.lines.map((l) => `${l.account.code}:${Number(l.debit) > 0 ? "Dr" + l.debit : "Cr" + l.credit}`), "balanced?", Number(je?.totalDebit) === Number(je?.totalCredit));

  const v2 = await svc.validateCoupon(s, { couponCode: first!.couponNo, billAmount: 2000 });
  console.log("re-validate (should fail):", v2.valid, "-", v2.reason);
  const low = await svc.validateCoupon(s, { couponCode: (await prisma.coupon.findMany({ where: { campaignId: campId }, orderBy: { id: "asc" } }))[1].couponNo, billAmount: 500 });
  console.log("low-bill validate (should fail):", low.valid, "-", low.reason);

  // cleanup
  if (je) { await prisma.journalLine.deleteMany({ where: { journalId: je.id } }); await prisma.journalEntry.delete({ where: { id: je.id } }); }
  await prisma.couponCampaign.delete({ where: { id: campId } });
  await prisma.couponAudit.deleteMany({ where: { tenantId: 4, byName: "E2E" } });
  console.log("cleaned. OK");
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });

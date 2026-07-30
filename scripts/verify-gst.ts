/**
 * Read-only verification of the GST compliance engine against live data, plus a
 * create/read/delete round-trip on the new GST tables (cleans up after itself).
 * Run: node_modules/.bin/tsx --env-file=.env scripts/verify-gst.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { periodFigures, getDashboard, computeVerification, buildGstr1, buildGstr3b, buildItc } from "../src/lib/finance/gst/engine";
import { getReport } from "../src/lib/finance/gst/reports";
import { parseGstr2b } from "../src/lib/finance/gst/recon";
import type { ActiveScope } from "../src/lib/auth/scope";

async function main() {
  const sale = await prisma.sale.findFirst({ where: { status: "Completed" }, orderBy: { saleDate: "desc" }, select: { tenantId: true, businessId: true, saleDate: true } });
  if (!sale) { console.log("no completed sales — cannot exercise engine"); return; }
  const scope: ActiveScope = { tenantId: sale.tenantId, businessId: sale.businessId ?? null, branchId: null, branchIds: null, readBranchIds: [] };
  const period = sale.saleDate.slice(0, 7);
  console.log(`tenant=${scope.tenantId} business=${scope.businessId} period=${period}`);

  const f = await periodFigures(scope, period);
  console.log("figures:", JSON.stringify(f));
  const dash = await getDashboard(scope, period);
  console.log("dashboard.kpis:", JSON.stringify(dash.kpis));
  console.log("dashboard charts months:", dash.charts.monthlyCollection.length, "alerts:", dash.alerts.length);
  const v = await computeVerification(scope, period);
  console.log("verification findings:", v.length, v.slice(0, 4).map((x) => `${x.severity}:${x.checkCode}`));
  const g1 = await buildGstr1(scope, period);
  console.log("gstr1 rows:", g1.rows.length, "totals:", JSON.stringify(g1.totals));
  const g3 = await buildGstr3b(scope, period);
  console.log("gstr3b totals:", JSON.stringify(g3.totals));
  const itc = await buildItc(scope, period);
  console.log("itc summary:", JSON.stringify(itc.summary), "rows:", itc.rows.length);
  for (const key of ["gst-sales-register", "hsn-summary", "tax-summary", "itc-report", "gst-ledger", "monthly-gst-summary"]) {
    const r = await getReport(scope, period, key);
    console.log(`report ${key}: rows=${r.rows.length} totals=${JSON.stringify(r.totals)}`);
  }

  const sample = JSON.stringify({ data: { docdata: { b2b: [{ ctin: "29ABCDE1234F1Z5", trdnm: "Test Supplier", inv: [{ inum: "INV-1", dt: "10-06-2026", val: 1180, itcavl: "Y", items: [{ rt: 18, txval: 1000, camt: 90, samt: 90, iamt: 0 }] }] }] } } });
  const parsed = parseGstr2b(sample);
  console.log("parse 2B (portal):", parsed.length, JSON.stringify(parsed[0]));
  const flat = parseGstr2b([{ supplierGstin: "27AAA", invoiceNo: "F-9", taxableValue: 500, igst: 90 }]);
  console.log("parse 2B (flat):", flat.length, JSON.stringify(flat[0]));

  // GST table round-trip
  const ret = await prisma.gstReturn.create({ data: { tenantId: scope.tenantId, businessId: scope.businessId, returnType: "GSTR-1", period, fromDate: `${period}-01`, toDate: `${period}-30`, status: "Draft" } });
  await prisma.gstReturnItem.create({ data: { tenantId: scope.tenantId, returnId: ret.id, section: "B2B", taxableValue: 100, cgst: 9, sgst: 9, igst: 0, total: 118 } });
  const back = await prisma.gstReturn.findUnique({ where: { id: ret.id }, include: { items: true } });
  console.log("roundtrip return id:", back?.id, "items:", back?.items.length);
  await prisma.gstReturn.delete({ where: { id: ret.id } });
  const gone = await prisma.gstReturnItem.count({ where: { returnId: ret.id } });
  console.log("cascade-deleted items remaining:", gone, "(expected 0)");
  console.log("OK");
}
main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });

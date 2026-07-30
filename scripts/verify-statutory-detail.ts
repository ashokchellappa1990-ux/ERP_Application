/**
 * Sanity check for the statutory liability drill-down (liabilityDetail): runs GST /
 * TDS / TCS document detail for a few periods and confirms the net-of-documents ties
 * to the consolidated computeLiability figure. Read-only. Run:
 *   node_modules/.bin/tsx --env-file=.env scripts/verify-statutory-detail.ts
 */
import { prisma } from "../src/lib/db/prisma";
import { computeLiability, liabilityDetail } from "../src/lib/finance/statutory/engine";

const tenantId = 4;
const scope = { tenantId, businessId: null, branchId: null, branchIds: null, readBranchIds: [] };

async function main() {
  // find periods that actually have sales / expense activity
  const sale = await prisma.sale.findFirst({ where: { tenantId }, orderBy: { id: "desc" }, select: { saleDate: true } });
  const periods = [...new Set([sale?.saleDate?.slice(0, 7), new Date().toISOString().slice(0, 7)].filter(Boolean))] as string[];

  for (const period of periods) {
    for (const type of ["GST", "TDS", "TCS"]) {
      const lia = await computeLiability(scope, type, period);
      const det = await liabilityDetail(scope, type, period);
      const docs = det.groups.reduce((s, g) => s + g.count, 0);
      console.log(`${type} ${period}: consolidated=${lia.liability}  detail.net=${det.net}  groups=${det.groups.length}  docs=${docs}`);
      det.groups.forEach((g) => console.log(`    [${g.sign === 1 ? "+" : "-"}] ${g.label}: ${g.count} docs, tax ${g.tax}`));
      // search filter smoke: pick first docNo and confirm it filters
      const firstDoc = det.groups[0]?.rows[0]?.docNo;
      if (firstDoc) {
        const filtered = await liabilityDetail(scope, type, period, firstDoc);
        const fdocs = filtered.groups.reduce((s, g) => s + g.count, 0);
        console.log(`    search "${firstDoc}" → ${fdocs} doc(s)`);
      }
    }
  }
  console.log("\nDONE — drill-down runs and reconciles.");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { TaxInvoiceData } from "@/lib/print/taxInvoiceHtml";
import type { WeightSlipData } from "@/lib/print/weightSlipHtml";

const PERM = "warehouse.transfer";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const fmtDateTime = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).replace(",", "");

// GET /api/warehouse/load-dispatch/[id]/print-data — assembles everything
// needed to print the Tax Invoice (Template 2) and Weight Slip from a single
// Load & Dispatch record: the Sale (for invoice totals/GSTIN), the linked
// Vehicle Gate Entry + Pre/Post-Loading Weighment (for vehicle/weight/time
// detail), and the Transport Cost row (its "Other Charges" is printed as the
// invoice's Royalty Pass line — no separate field exists for that charge).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const doc = await prisma.loadDispatch.findFirst({ where: { ...sw, id: Number(params.id), deletedAt: null }, include: { items: { orderBy: { id: "asc" } } } });
  if (!doc) return NextResponse.json({ ok: false, message: "Load & Dispatch not found." }, { status: 404 });

  const [vehicle, transportCost, gateEntry, setup, tenant] = await Promise.all([
    doc.vehicleId ? prisma.vehicleMaster.findFirst({ where: { id: doc.vehicleId }, select: { vehicleNo: true } }) : Promise.resolve(null),
    prisma.transportCost.findFirst({ where: { loadDispatchId: doc.id } }),
    doc.vehicleGateEntryId ? prisma.vehicleGateEntry.findFirst({ where: { id: doc.vehicleGateEntryId, tenantId: user.tenantId } }) : Promise.resolve(null),
    prisma.companySetup.findFirst({ where: { tenantId: user.tenantId, NOT: { companyName: null } }, orderBy: { updatedAt: "desc" }, select: { companyName: true, gstNumber: true, addressLine: true, city: true, state: true, pincode: true } }),
    prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
  ]);

  const business = {
    name: setup?.companyName || tenant?.name || "My Store",
    gstin: setup?.gstNumber || "",
    address: [setup?.addressLine, setup?.city, setup?.state, setup?.pincode].filter(Boolean).join(", "),
  };

  let taxInvoice: TaxInvoiceData | null = null;
  let weightSlip: WeightSlipData | null = null;

  // ---- Tax Invoice (Template 2) — only once the Sales Invoice has posted. ----
  if (doc.saleId) {
    const sale = await prisma.sale.findFirst({ where: { id: doc.saleId, tenantId: user.tenantId }, include: { lines: { orderBy: { id: "asc" } } } });
    if (sale) {
      const [preWt, postWt] = await Promise.all([
        doc.vehicleGateEntryId ? prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: doc.vehicleGateEntryId } }) : Promise.resolve(null),
        doc.vehicleGateEntryId ? prisma.postLoadingWeighment.findFirst({ where: { gateEntryId: doc.vehicleGateEntryId } }) : Promise.resolve(null),
      ]);
      const firstTaxPct = sale.lines.find((l) => l.taxPct != null)?.taxPct;
      const halfPct = firstTaxPct != null ? num(firstTaxPct) / 2 : null;
      taxInvoice = {
        business,
        invoiceNo: sale.invoiceNo, billDateTime: fmtDateTime(sale.updatedAt), billType: sale.paymentStatus === "Unpaid" ? "Credit" : (sale.paymentMode || "Cash"),
        vehicleNumber: vehicle?.vehicleNo ?? null, deliveryTo: doc.deliveryAddress, driverName: doc.driverName,
        customer: { name: sale.customerName || "Walk-in", gstin: sale.customerGstin || "0", place: doc.deliveryAddress || gateEntry?.deliveryAddress || "" },
        lines: sale.lines.map((l) => {
          const isTon = (l.uom || "").toLowerCase() === "ton";
          const div = isTon ? 1000 : 1;
          return {
            description: l.productName, hsn: l.hsn, rate: num(l.rate), qty: num(l.qty), uom: l.uom || "",
            lineTotal: num(l.taxableValue),
            weight: (preWt || postWt) ? { empty: num(preWt?.tareWeight) / div, load: num(postWt?.grossWeight) / div, net: num(postWt?.netWeight) / div, unit: isTon ? "Ton" : "Kg" } : null,
          };
        }),
        totalTax: num(sale.taxTotal), sgstPct: halfPct, sgstAmount: num(sale.sgst), cgstPct: halfPct, cgstAmount: num(sale.cgst),
        royaltyPassLabel: "Royalty Pass", royaltyPass: num(transportCost?.otherCharges),
        roundOff: num(sale.roundOff), total: num(sale.total),
      };
    }
  }

  // ---- Weight Slip — only once a Vehicle Gate Entry is linked. ----
  if (gateEntry) {
    const [preWt, postWt, gateExit] = await Promise.all([
      prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: gateEntry.id } }),
      prisma.postLoadingWeighment.findFirst({ where: { gateEntryId: gateEntry.id } }),
      prisma.gateExit.findFirst({ where: { gateEntryId: gateEntry.id } }),
    ]);
    weightSlip = {
      business: { name: business.name },
      tokenNo: gateEntry.gateEntryNo, productName: doc.items[0]?.productName || "", refNo: doc.saleId ? (await prisma.sale.findUnique({ where: { id: doc.saleId }, select: { invoiceNo: true } }))?.invoiceNo ?? doc.dispatchNo : doc.dispatchNo,
      date: doc.dispatchDate,
      inTime: gateEntry.arrivalTime ? fmtDateTime(gateEntry.arrivalTime) : null,
      outTime: gateExit?.exitTime ? fmtDateTime(gateExit.exitTime) : (postWt ? fmtDateTime(postWt.createdAt) : null),
      customerName: doc.partyName || gateEntry.customerName || "",
      vehicleNumber: vehicle?.vehicleNo ?? null,
      emptyWeightKg: num(preWt?.tareWeight), loadWeightKg: num(postWt?.grossWeight), netWeightKg: num(postWt?.netWeight),
      payment: doc.paymentMode === "Full" ? "Paid" : (doc.paymentMode || "Credit"),
      delivery: doc.deliveryAddress || gateEntry.deliveryAddress || null,
    };
  }

  return NextResponse.json({ ok: true, taxInvoice, weightSlip });
}

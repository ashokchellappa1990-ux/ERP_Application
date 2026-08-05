import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { TaxInvoiceData } from "@/lib/print/taxInvoiceHtml";
import type { WeightSlipData } from "@/lib/print/weightSlipHtml";
import type { TaxInvoiceT3Data } from "@/lib/print/taxInvoiceT3Html";

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

  const [vehicle, transportCost, gateEntry, setup, tenant, deliveryChallan, customer] = await Promise.all([
    doc.vehicleId ? prisma.vehicleMaster.findFirst({ where: { id: doc.vehicleId }, select: { vehicleNo: true } }) : Promise.resolve(null),
    prisma.transportCost.findFirst({ where: { loadDispatchId: doc.id } }),
    doc.vehicleGateEntryId ? prisma.vehicleGateEntry.findFirst({ where: { id: doc.vehicleGateEntryId, tenantId: user.tenantId } }) : Promise.resolve(null),
    prisma.companySetup.findFirst({ where: { tenantId: user.tenantId, NOT: { companyName: null } }, orderBy: { updatedAt: "desc" }, select: { companyName: true, gstNumber: true, addressLine: true, city: true, state: true, pincode: true, companyPhone: true, companyEmail: true } }),
    prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
    doc.deliveryChallanId ? prisma.deliveryChallan.findFirst({ where: { id: doc.deliveryChallanId, tenantId: user.tenantId } }) : Promise.resolve(null),
    doc.partyType === "Customer" && doc.partyId ? prisma.customer.findFirst({ where: { id: doc.partyId, tenantId: user.tenantId }, select: { address: true, city: true, state: true, phone: true, gstin: true } }) : Promise.resolve(null),
  ]);

  const business = {
    name: setup?.companyName || tenant?.name || "My Store",
    gstin: setup?.gstNumber || "",
    address: [setup?.addressLine, setup?.city, setup?.state, setup?.pincode].filter(Boolean).join(", "),
  };

  // Pre/Post-Loading Weighment — shared by the Tax Invoice, Weight Slip AND
  // the Delivery Note, all of which show the same Empty/Load/Net weight line.
  const [preWt, postWt] = await Promise.all([
    doc.vehicleGateEntryId ? prisma.preLoadingWeighment.findFirst({ where: { gateEntryId: doc.vehicleGateEntryId } }) : Promise.resolve(null),
    doc.vehicleGateEntryId ? prisma.postLoadingWeighment.findFirst({ where: { gateEntryId: doc.vehicleGateEntryId } }) : Promise.resolve(null),
  ]);

  let taxInvoice: TaxInvoiceData | null = null;
  let taxInvoiceT3: TaxInvoiceT3Data | null = null;
  let weightSlip: WeightSlipData | null = null;
  let deliveryNote: TaxInvoiceData | null = null;

  // ---- Tax Invoice (Template 2) — only once the Sales Invoice has posted. ----
  if (doc.saleId) {
    const sale = await prisma.sale.findFirst({ where: { id: doc.saleId, tenantId: user.tenantId }, include: { lines: { orderBy: { id: "asc" } } } });
    if (sale) {
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

      // ---- Tax Invoice (Template 3) — same prerequisite (Sales Invoice
      // posted), built for the GST-style design with per-HSN CGST/SGST rows.
      // qrCodeImage/signatureImage aren't assembled here — the caller merges
      // those in from the B2B_T3 InvoiceTemplate row it already fetches
      // alongside this route, same as title/footerNote for every other design.
      const hsnTotals = new Map<string, { taxableAmount: number; taxAmount: number }>();
      for (const l of sale.lines) {
        const hsn = l.hsn || "—";
        const cur = hsnTotals.get(hsn) ?? { taxableAmount: 0, taxAmount: 0 };
        cur.taxableAmount += num(l.taxableValue); cur.taxAmount += num(l.taxAmount);
        hsnTotals.set(hsn, cur);
      }
      taxInvoiceT3 = {
        business: {
          name: business.name, address: business.address, gstin: business.gstin,
          phone: setup?.companyPhone || "", email: setup?.companyEmail || "", state: setup?.state || "",
        },
        invoiceNo: sale.invoiceNo, date: sale.saleDate, placeOfSupply: setup?.state || "", deliveryDate: doc.dispatchDate,
        driverName: doc.driverName, vehicleNumber: vehicle?.vehicleNo ?? null, driverMobile: doc.driverMobile,
        deliveryLocation: doc.deliveryAddress || gateEntry?.deliveryAddress || null,
        customer: {
          name: sale.customerName || "Walk-in",
          address: [customer?.address, customer?.city].filter(Boolean).join(", ") || doc.deliveryAddress || gateEntry?.deliveryAddress || "",
          contact: sale.customerPhone || customer?.phone || null, gstin: sale.customerGstin || customer?.gstin || null,
          state: customer?.state || setup?.state || "",
        },
        lines: sale.lines.map((l) => ({
          productName: l.productName, hsn: l.hsn, qty: num(l.qty), uom: l.uom || "",
          pricePerUnit: num(l.rate), taxablePricePerUnit: num(l.qty) ? num(l.taxableValue) / num(l.qty) : num(l.rate),
          gstPct: l.taxPct != null ? num(l.taxPct) : null, gstAmount: num(l.taxAmount), amount: num(l.value),
        })),
        subTotal: num(sale.total) - num(sale.roundOff), roundOff: num(sale.roundOff), total: num(sale.total),
        paymentMode: sale.paymentStatus === "Unpaid" ? "Credit" : (sale.paymentMode || "Cash"),
        hsnRows: Array.from(hsnTotals.entries()).map(([hsn, v]) => ({
          hsn, taxableAmount: v.taxableAmount,
          cgstPct: 2.5, cgstAmount: v.taxAmount / 2, sgstPct: 2.5, sgstAmount: v.taxAmount / 2, totalTax: v.taxAmount,
        })),
        totalTax: num(sale.taxTotal),
        qrCodeImage: null, signatureImage: null, termsNote: "",
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

  // ---- Delivery Note — printed as "Print DC" / "Preview DC", available as
  // soon as a Delivery Challan has been generated (doesn't require the Sales
  // Invoice to have posted yet, unlike taxInvoice above). Reuses the same
  // TaxInvoiceData shape/template as the Tax Invoice (only the title differs,
  // set by the caller) — built straight from LoadDispatchItem's own
  // invoice-grade fields (rate/discPct/taxPct/taxableValue/taxAmount) rather
  // than from a Sale, since no Sale may exist yet in Manual posting mode.
  if (deliveryChallan) {
    const productIds = Array.from(new Set(doc.items.map((it) => it.productId)));
    const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, hsn: true } }) : [];
    const hsnMap = new Map(products.map((p) => [p.id, p.hsn]));
    const firstTaxPct = doc.items.find((it) => it.taxPct != null)?.taxPct;
    const halfPct = firstTaxPct != null ? num(firstTaxPct) / 2 : null;
    const subtotal = doc.items.reduce((s, it) => s + num(it.taxableValue), 0);
    const totalTax = doc.items.reduce((s, it) => s + num(it.taxAmount), 0);
    const royaltyPass = num(transportCost?.otherCharges);
    const rawTotal = subtotal + totalTax + royaltyPass;
    const total = Math.round(rawTotal);
    deliveryNote = {
      business,
      invoiceNo: deliveryChallan.dcNo, billDateTime: fmtDateTime(deliveryChallan.createdAt),
      billType: doc.paymentMode === "Full" ? "Cash" : (doc.paymentMode || "Credit"),
      vehicleNumber: vehicle?.vehicleNo ?? null, deliveryTo: doc.deliveryAddress, driverName: doc.driverName,
      customer: { name: deliveryChallan.customerName || doc.partyName || "Walk-in", gstin: customer?.gstin || "0", place: doc.deliveryAddress || gateEntry?.deliveryAddress || "" },
      lines: doc.items.map((it) => {
        const isTon = (it.uom || "").toLowerCase() === "ton";
        const div = isTon ? 1000 : 1;
        return {
          description: it.productName, hsn: hsnMap.get(it.productId) ?? null, rate: num(it.rate), qty: num(it.dispatchedQty), uom: it.uom || "",
          lineTotal: num(it.taxableValue),
          weight: (preWt || postWt) ? { empty: num(preWt?.tareWeight) / div, load: num(postWt?.grossWeight) / div, net: num(postWt?.netWeight) / div, unit: isTon ? "Ton" : "Kg" } : null,
        };
      }),
      totalTax, sgstPct: halfPct, sgstAmount: totalTax / 2, cgstPct: halfPct, cgstAmount: totalTax / 2,
      royaltyPassLabel: "Royalty Pass", royaltyPass,
      roundOff: total - rawTotal, total,
    };
  }

  return NextResponse.json({ ok: true, taxInvoice, taxInvoiceT3, weightSlip, deliveryNote });
}

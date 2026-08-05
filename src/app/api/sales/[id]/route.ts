import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { TaxInvoiceT3Data } from "@/lib/print/taxInvoiceT3Html";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/sales/[id] — full sale for reprint / view.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "sales.pos");
  if (denied) return denied;

  const sale = await prisma.sale.findFirst({
    where: { id: Number(params.id), tenantId: user.tenantId },
    include: { lines: { orderBy: { id: "asc" } }, payments: true, customer: true, attachments: { orderBy: { id: "asc" } } },
  });
  if (!sale) return NextResponse.json({ ok: false, message: "Sale not found." }, { status: 404 });

  // Prefer the most recently configured company setup that has a name.
  const setup = await prisma.companySetup.findFirst({
    where: { tenantId: user.tenantId, NOT: { companyName: null } },
    orderBy: { updatedAt: "desc" },
    select: { companyName: true, companyPhone: true, companyEmail: true, gstNumber: true, addressLine: true, city: true, state: true, pincode: true },
  });
  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } });
  // B2B invoices use the B2B template; POS sales use the B2C template.
  const tplType = sale.channel === "B2B" ? "B2B" : "B2C";
  const template = (await prisma.invoiceTemplate.findUnique({ where: { tenantId_type: { tenantId: user.tenantId, type: tplType } } })) ?? (await prisma.invoiceTemplate.create({ data: { tenantId: user.tenantId, type: tplType } }));

  const businessAddress = [setup?.addressLine, setup?.city, setup?.state, setup?.pincode].filter(Boolean).join(", ");

  // ---- Tax Invoice (Template 3) — the GST-style design actually printed
  // from the Sales Invoice (B2B) page's "Print" button (see B2bInvoiceView.tsx).
  // Only assembled for B2B channel sales; driver/vehicle/delivery fields stay
  // null here since a plain Sale (unlike a Load & Dispatch) has none of that.
  let taxInvoiceT3: TaxInvoiceT3Data | null = null;
  let t3Template: { title: string; footerNote: string; qrCodeImage: string | null; signatureImage: string | null } | null = null;
  if (sale.channel === "B2B") {
    const t3Row = (await prisma.invoiceTemplate.findUnique({ where: { tenantId_type: { tenantId: user.tenantId, type: "B2B_T3" } } })) ?? (await prisma.invoiceTemplate.create({ data: { tenantId: user.tenantId, type: "B2B_T3", title: "Tax Invoice" } }));
    t3Template = { title: t3Row.title, footerNote: t3Row.footerNote ?? "", qrCodeImage: t3Row.qrCodeImage ?? null, signatureImage: t3Row.signatureImage ?? null };

    const hsnTotals = new Map<string, { taxableAmount: number; taxAmount: number }>();
    for (const l of sale.lines) {
      const hsn = l.hsn || "—";
      const cur = hsnTotals.get(hsn) ?? { taxableAmount: 0, taxAmount: 0 };
      cur.taxableAmount += num(l.taxableValue); cur.taxAmount += num(l.taxAmount);
      hsnTotals.set(hsn, cur);
    }
    taxInvoiceT3 = {
      business: {
        name: setup?.companyName || tenant?.name || "My Store", address: businessAddress,
        phone: setup?.companyPhone || "", email: setup?.companyEmail || "", gstin: setup?.gstNumber || "", state: setup?.state || "",
      },
      invoiceNo: sale.invoiceNo, date: sale.saleDate, placeOfSupply: setup?.state || "", deliveryDate: null,
      driverName: null, vehicleNumber: null, driverMobile: null, deliveryLocation: null,
      customer: {
        name: sale.customerName || sale.customer?.name || "Walk-in",
        address: [sale.customer?.address, sale.customer?.city].filter(Boolean).join(", "),
        contact: sale.customerPhone || sale.customer?.phone || null, gstin: sale.customerGstin || sale.customer?.gstin || null,
        state: sale.customer?.state || setup?.state || "",
      },
      lines: sale.lines.map((l) => ({
        productName: l.productName, hsn: l.hsn, qty: num(l.qty), uom: l.uom || "",
        pricePerUnit: num(l.rate), taxablePricePerUnit: num(l.qty) ? num(l.taxableValue) / num(l.qty) : num(l.rate),
        gstPct: l.taxPct != null ? num(l.taxPct) : null, gstAmount: num(l.taxAmount), amount: num(l.value),
      })),
      subTotal: num(sale.total) - num(sale.roundOff), roundOff: num(sale.roundOff), total: num(sale.total),
      paymentMode: sale.paymentStatus === "Unpaid" ? "Credit" : (sale.paymentMode || "Cash"),
      // This design has fixed CGST/SGST columns (no IGST column) — inter-state
      // sales still split their total tax evenly across those two columns
      // rather than fabricating a separate IGST layout the template doesn't have.
      hsnRows: Array.from(hsnTotals.entries()).map(([hsn, v]) => ({
        hsn, taxableAmount: v.taxableAmount,
        cgstPct: 2.5, cgstAmount: v.taxAmount / 2, sgstPct: 2.5, sgstAmount: v.taxAmount / 2, totalTax: v.taxAmount,
      })),
      totalTax: num(sale.taxTotal),
      qrCodeImage: null, signatureImage: null, termsNote: "",
    };
  }

  return NextResponse.json({
    ok: true,
    business: {
      name: setup?.companyName || tenant?.name || "My Store",
      phone: setup?.companyPhone || "", email: setup?.companyEmail || "", gstin: setup?.gstNumber || "", address: businessAddress,
    },
    template: {
      title: template.title, paperSize: template.paperSize, headerNote: template.headerNote ?? "",
      thankYouMessage: template.thankYouMessage, footerNote: template.footerNote ?? "",
      showGstin: template.showGstin, showCustomer: template.showCustomer, showHsn: template.showHsn,
      showMrp: template.showMrp, showSavings: template.showSavings, showTaxBreakup: template.showTaxBreakup, showItemTax: template.showItemTax,
    },
    taxInvoiceT3, t3Template,
    sale: {
      id: sale.id, invoiceNo: sale.invoiceNo, saleDate: sale.saleDate, status: sale.status, channel: sale.channel,
      customerName: sale.customerName ?? sale.customer?.name ?? "Walk-in", customerPhone: sale.customerPhone ?? sale.customer?.phone ?? "",
      customerGstin: sale.customerGstin ?? sale.customer?.gstin ?? "", customerAddress: sale.customer?.address ?? "",
      customerCity: sale.customer?.city ?? "", customerState: sale.customer?.state ?? "",
      dueDate: sale.dueDate ?? "", paymentTerms: sale.paymentTerms ?? "", soNumber: sale.soNumber ?? "", termsConditions: sale.termsConditions ?? "", notes: sale.notes ?? "",
      attachments: sale.attachments.map((a) => ({ fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType ?? "", size: a.size })),
      subtotal: num(sale.subtotal), itemDiscount: num(sale.itemDiscount), billDiscount: num(sale.billDiscount),
      taxableValue: num(sale.taxableValue), cgst: num(sale.cgst), sgst: num(sale.sgst), igst: num(sale.igst), taxTotal: num(sale.taxTotal),
      tdsAmount: num(sale.tdsAmount), tcsAmount: num(sale.tcsAmount),
      roundOff: num(sale.roundOff), total: num(sale.total), amountPaid: num(sale.amountPaid), changeDue: num(sale.changeDue),
      paymentMode: sale.paymentMode ?? "", paymentStatus: sale.paymentStatus, itemCount: sale.itemCount,
      lines: sale.lines.map((l) => ({
        productName: l.productName, sku: l.sku ?? "", hsn: l.hsn ?? "", uom: l.uom ?? "", qty: num(l.qty),
        mrp: l.mrp != null ? num(l.mrp) : null, rate: num(l.rate), discAmount: num(l.discAmount), taxPct: l.taxPct != null ? num(l.taxPct) : 0,
        taxAmount: num(l.taxAmount), value: num(l.value),
      })),
      payments: sale.payments.map((p) => ({ mode: p.mode, amount: num(p.amount), reference: p.reference ?? "" })),
    },
  });
}

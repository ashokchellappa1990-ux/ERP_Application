import { Prisma } from "@prisma/client";
import { nextPurchaseOrderNumber } from "./poNumber";
import type { TerminalStamp } from "@/lib/pos/terminalContext";
import type { PurchaseOrderCreateInput } from "@/lib/contracts/purchaseOrder";

/**
 * PURCHASE ORDER builder + writer. Computes line and header totals (GST exclusive or
 * inclusive, intra/inter-state split) and persists the order + items + attachments.
 * NO GL posting and NO payable — a PO is a commitment; goods post at GRN, bill at PI.
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const today = () => new Date().toISOString().slice(0, 10);

export interface BuiltPo {
  supplier: string; supplierGstin: string | null; purchaseType: string;
  taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; gstAmount: number;
  additionalDiscount: number; freight: number; loading: number; packing: number; insurance: number; otherCharges: number; roundOff: number;
  chargesTotal: number; totalOrderValue: number; netAmount: number;
  items: Prisma.PurchaseOrderItemCreateWithoutOrderInput[]; itemCount: number;
}

export function buildPurchaseOrder(input: PurchaseOrderCreateInput): BuiltPo | { error: string } {
  const supplier = (input.supplierName ?? "").trim();
  if (!supplier) return { error: "Select a supplier for the order." };
  if (!input.lines.length) return { error: "Add at least one line item." };
  const gstOn = input.gstApplicable !== false;
  const inclusive = input.gstMode === "inclusive";

  let taxableAmount = 0, gstAmount = 0;
  const items: Prisma.PurchaseOrderItemCreateWithoutOrderInput[] = input.lines.map((l) => {
    const qty = num(l.qty);
    const gross = r2(qty * num(l.rate));
    const discAmount = l.discPct != null ? r2(gross * (num(l.discPct) / 100)) : 0;
    const net = r2(gross - discAmount);
    const taxPct = gstOn ? num(l.taxPct) : 0;
    const taxable = taxPct > 0 && inclusive ? r2(net / (1 + taxPct / 100)) : net;
    const taxAmount = taxPct > 0 ? (inclusive ? r2(net - taxable) : r2(taxable * (taxPct / 100))) : 0;
    taxableAmount = r2(taxableAmount + taxable);
    gstAmount = r2(gstAmount + taxAmount);
    return {
      productId: l.productId ?? null, productName: l.description, sku: l.sku ?? null, hsn: l.hsn ?? null, uom: l.uom ?? null,
      qty, rate: num(l.rate), taxPct: taxPct || null, taxAmount, discPct: l.discPct == null ? null : num(l.discPct), discAmount,
      lineValue: r2(taxable + taxAmount), expectedDate: l.expectedDate ?? null, remarks: l.remarks ?? null,
    };
  });

  const interState = input.interState === true;
  const igst = interState ? gstAmount : 0;
  const cgst = interState ? 0 : r2(gstAmount / 2);
  const sgst = interState ? 0 : r2(gstAmount - cgst);

  const additionalDiscount = r2(num(input.additionalDiscount));
  const freight = r2(num(input.freight)), loading = r2(num(input.loading)), packing = r2(num(input.packing)), insurance = r2(num(input.insurance)), otherCharges = r2(num(input.otherCharges)), roundOff = r2(num(input.roundOff));
  const chargesTotal = r2(freight + loading + packing + insurance + otherCharges);
  const goods = r2(taxableAmount + gstAmount);
  const totalOrderValue = r2(goods + chargesTotal - additionalDiscount + roundOff);

  return {
    supplier, supplierGstin: (input.supplierGstin ?? "").trim() || null, purchaseType: input.purchaseType || "Inventory",
    taxableAmount, cgst, sgst, igst, cess: 0, gstAmount,
    additionalDiscount, freight, loading, packing, insurance, otherCharges, roundOff,
    chargesTotal, totalOrderValue, netAmount: totalOrderValue, items, itemCount: items.length,
  };
}

interface Actor { id: number; tenantId: number; fullName?: string | null }
type Seg = { businessId?: number | null; branchId?: number | null };
type Stamp = TerminalStamp;

export async function createPurchaseOrderTx(
  tx: Prisma.TransactionClient,
  opts: { user: Actor; seg: Seg; stamp: Stamp; input: PurchaseOrderCreateInput; built: BuiltPo; status: string },
): Promise<{ id: number; poNo: string; status: string }> {
  const { user, seg, stamp, input, built, status } = opts;
  const poNo = await nextPurchaseOrderNumber(tx, user.tenantId, { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
  const order = await tx.purchaseOrder.create({
    data: {
      tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null,
      poNo, poDate: input.poDate || today(), status,
      supplierId: input.supplierId ?? null, supplier: built.supplier, supplierGstin: built.supplierGstin,
      supplierContact: input.supplierContact ?? null, supplierRef: input.supplierRef ?? null,
      quotationNo: input.quotationNo ?? null, quotationDate: input.quotationDate ?? null, buyer: input.buyer ?? null, purchaseType: built.purchaseType,
      expectedDeliveryDate: input.expectedDeliveryDate ?? null, warehouse: input.warehouse ?? null, deliveryAddress: input.deliveryAddress ?? null,
      shippingMode: input.shippingMode ?? null, freightPaidBy: input.freightPaidBy ?? null,
      paymentTerms: input.paymentTerms ?? null, creditDays: input.creditDays ?? null, dueDate: input.dueDate ?? null, currency: input.currency || "INR",
      gstApplicable: input.gstApplicable !== false, reverseCharge: input.reverseCharge === true, interState: input.interState === true,
      taxableAmount: built.taxableAmount, cgst: built.cgst, sgst: built.sgst, igst: built.igst, cess: built.cess, gstAmount: built.gstAmount,
      additionalDiscount: built.additionalDiscount, freight: built.freight, loading: built.loading, packing: built.packing, insurance: built.insurance, otherCharges: built.otherCharges, roundOff: built.roundOff,
      totalOrderValue: built.totalOrderValue, netAmount: built.netAmount, itemCount: built.itemCount,
      issuedAt: status === "Issued" ? new Date() : null,
      remarks: input.remarks ?? null, internalNotes: input.internalNotes ?? null, termsConditions: input.termsConditions ?? null,
      createdBy: user.id, createdByName: user.fullName ?? null,
      items: { create: built.items }, ...stamp,
    },
    select: { id: true, poNo: true, status: true },
  });
  if (input.attachments.length) {
    await tx.purchaseOrderAttachment.createMany({ data: input.attachments.map((a) => ({ purchaseOrderId: order.id, docType: a.docType || "quotation", fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType ?? null, size: a.size ?? 0 })) });
  }
  return order;
}

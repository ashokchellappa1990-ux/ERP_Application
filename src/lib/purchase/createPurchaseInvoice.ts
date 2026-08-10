import type { Prisma } from "@prisma/client";
import { ACC, purchaseTypeAccount } from "@/lib/accounting/accounts";
import { postJournal } from "@/lib/accounting/post";
import { nextPurchaseInvoiceNumber } from "@/lib/purchase/piNumber";
import { createAssetRegisterForInvoice } from "@/lib/purchase/assetRegister";
import type { PurchaseInvoiceConfig } from "@/lib/purchase/purchaseInvoiceConfig";
import type { PurchaseInvoiceCreateInput } from "@/lib/contracts/purchaseInvoice";
import type { TerminalStamp } from "@/lib/pos/terminalContext";
import { createInlineSettlement, reverseInlineSettlements } from "@/lib/advance/engine";

const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Supplier advance applied to a bill: reduce AP + credit the advance asset. */
export interface AdvanceApply { total: number; accountCode: string; adjustments: { advanceId: number; amount: number }[] }
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);

export type GrnWithLines = Prisma.GoodsReceiptNoteGetPayload<{ include: { lines: true } }>;

/** The GRN's grand total (supplier bill basis) = goods + tax + GRN-level charges. */
export function grnGrandTotal(g: GrnWithLines): number {
  return r2(num(g.subtotal) + num(g.taxTotal) + num(g.freightAmount) + num(g.otherCharges) + num(g.roundOff));
}

export interface BuiltInvoice {
  invoiceType: "GRN" | "Direct";
  purchaseType: string;
  supplier: string | null; supplierGstin: string | null; poNo: string | null; warehouse: string | null;
  grnAmount: number; taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; gstAmount: number;
  additionalDiscount: number; freight: number; loading: number; packing: number; insurance: number; otherCharges: number; roundOff: number;
  chargesTotal: number; totalInvoiceAmount: number; netPayable: number;
  paymentTerms: string | null; creditDays: number | null; dueDate: string | null;
  items: Prisma.PurchaseInvoiceItemCreateWithoutInvoiceInput[];
  grns: { grnId: number; grnNo: string; grnAmount: number }[];
  itemCount: number;
}

/** Validate the selection + config and compute the invoice from the source GRN(s).
 * No DB writes. Returns `{ error }` on any rule break. */
export function buildInvoiceFromGrns(grns: GrnWithLines[], input: PurchaseInvoiceCreateInput, cfg: PurchaseInvoiceConfig): BuiltInvoice | { error: string } {
  if (!cfg.enablePurchaseInvoice) return { error: "Purchase Invoice is turned off in Purchase Configuration." };
  if (!grns.length) return { error: "Select at least one GRN to invoice." };
  if (grns.length > 1 && !cfg.allowMultipleGrnsPerInvoice) return { error: "Multiple GRNs against one invoice is disabled in configuration." };

  // All GRNs must be Posted, same supplier, and not already invoiced.
  const supplier = grns[0].supplier ?? null;
  for (const g of grns) {
    if (g.status !== "Posted") return { error: `GRN ${g.grnNo} is not posted yet.` };
    if ((g.supplier ?? null) !== supplier) return { error: "All selected GRNs must belong to the same supplier." };
    if (g.invoiceRecorded && !cfg.allowMultipleInvoicesPerGrn) return { error: `GRN ${g.grnNo} already has a purchase invoice.` };
  }

  // Bill amounts. Goods + GST already captured at GRN; charges are additive.
  const grnAmount = r2(grns.reduce((s, g) => s + grnGrandTotal(g), 0));
  const taxableAmount = r2(grns.reduce((s, g) => s + num(g.subtotal), 0));
  const gstAmount = r2(grns.reduce((s, g) => s + num(g.taxTotal), 0));
  const cgst = r2(gstAmount / 2);
  const sgst = r2(gstAmount - cgst);

  const additionalDiscount = r2(num(input.additionalDiscount));
  const freight = r2(num(input.freight));
  const loading = r2(num(input.loading));
  const packing = r2(num(input.packing));
  const insurance = r2(num(input.insurance));
  const otherCharges = r2(num(input.otherCharges));
  const roundOff = r2(num(input.roundOff));
  const chargesTotal = r2(freight + loading + packing + insurance + otherCharges);
  const totalInvoiceAmount = r2(grnAmount + chargesTotal - additionalDiscount + roundOff);
  const netPayable = totalInvoiceAmount;

  const items: Prisma.PurchaseInvoiceItemCreateWithoutInvoiceInput[] = [];
  for (const g of grns) {
    for (const l of g.lines) {
      const qty = num(l.qty);
      const gross = qty * num(l.rate);
      const discAmount = l.discPct != null ? r2(gross * (num(l.discPct) / 100)) : 0;
      items.push({
        grnLineId: l.id, productId: l.productId, productName: l.productName, sku: l.sku ?? null,
        batchNo: l.batchNo ?? null, mfgDate: l.mfgDate ?? null, expiryDate: l.expiryDate ?? null,
        qty, unitPrice: num(l.rate), taxPct: l.taxPct == null ? null : num(l.taxPct), taxAmount: num(l.taxAmount),
        discPct: l.discPct == null ? null : num(l.discPct), discAmount, lineValue: num(l.value),
      });
    }
  }

  return {
    invoiceType: "GRN", purchaseType: input.purchaseType || "Inventory",
    supplier, supplierGstin: grns[0].supplierGstin ?? null, poNo: grns[0].poNo ?? null, warehouse: grns[0].warehouse ?? null,
    grnAmount, taxableAmount, cgst, sgst, igst: 0, cess: 0, gstAmount,
    additionalDiscount, freight, loading, packing, insurance, otherCharges, roundOff,
    chargesTotal, totalInvoiceAmount, netPayable,
    paymentTerms: input.paymentTerms || grns[0].paymentTerms || cfg.defaultPaymentTerms,
    creditDays: input.creditDays ?? grns[0].creditDays ?? cfg.defaultCreditDays,
    dueDate: input.dueDate || grns[0].dueDate || null,
    items, itemCount: items.length,
    grns: grns.map((g) => ({ grnId: g.id, grnNo: g.grnNo, grnAmount: grnGrandTotal(g) })),
  };
}

/** Build a Direct vendor bill (no GRN) from manually-entered lines. GST is treated
 * as exclusive (rate is the pre-tax price). No DB writes. */
export function buildDirectInvoice(input: PurchaseInvoiceCreateInput, cfg: PurchaseInvoiceConfig): BuiltInvoice | { error: string } {
  if (!cfg.enablePurchaseInvoice) return { error: "Purchase Invoice is turned off in Purchase Configuration." };
  const supplier = (input.supplierName ?? "").trim() || null;
  if (!supplier) return { error: "Select a supplier for the bill." };
  if (!input.lines.length) return { error: "Add at least one line item to the bill." };
  const gstOn = input.gstApplicable !== false;
  const inclusive = input.gstMode === "inclusive";

  let taxableAmount = 0, gstAmount = 0;
  const items: Prisma.PurchaseInvoiceItemCreateWithoutInvoiceInput[] = input.lines.map((l) => {
    const qty = num(l.qty);
    const gross = r2(qty * num(l.rate));
    const discAmount = l.discPct != null ? r2(gross * (num(l.discPct) / 100)) : 0;
    const net = r2(gross - discAmount);
    const taxPct = gstOn ? num(l.taxPct) : 0;
    // Inclusive: the rate already contains GST → back it out. Exclusive: GST on top.
    const taxable = taxPct > 0 && inclusive ? r2(net / (1 + taxPct / 100)) : net;
    const taxAmount = taxPct > 0 ? (inclusive ? r2(net - taxable) : r2(taxable * (taxPct / 100))) : 0;
    taxableAmount = r2(taxableAmount + taxable);
    gstAmount = r2(gstAmount + taxAmount);
    return {
      grnLineId: null, productId: l.productId ?? null, productName: l.description, sku: l.sku ?? null, hsn: l.hsn ?? null,
      batchNo: l.batchNo ?? null, mfgDate: null, expiryDate: l.expiryDate ?? null,
      qty, unitPrice: num(l.rate), taxPct: taxPct || null, taxAmount, discPct: l.discPct == null ? null : num(l.discPct), discAmount, lineValue: r2(taxable + taxAmount),
    };
  });

  const grnAmount = r2(taxableAmount + gstAmount); // goods base incl. tax
  const cgst = r2(gstAmount / 2);
  const sgst = r2(gstAmount - cgst);
  const additionalDiscount = r2(num(input.additionalDiscount));
  const freight = r2(num(input.freight)), loading = r2(num(input.loading)), packing = r2(num(input.packing)), insurance = r2(num(input.insurance)), otherCharges = r2(num(input.otherCharges)), roundOff = r2(num(input.roundOff));
  const chargesTotal = r2(freight + loading + packing + insurance + otherCharges);
  const totalInvoiceAmount = r2(grnAmount + chargesTotal - additionalDiscount + roundOff);

  return {
    invoiceType: "Direct", purchaseType: input.purchaseType || "Inventory",
    supplier, supplierGstin: (input.supplierGstin ?? "").trim() || null, poNo: (input.poNo ?? "").trim() || null, warehouse: null,
    grnAmount, taxableAmount, cgst, sgst, igst: 0, cess: 0, gstAmount,
    additionalDiscount, freight, loading, packing, insurance, otherCharges, roundOff,
    chargesTotal, totalInvoiceAmount, netPayable: totalInvoiceAmount,
    paymentTerms: input.paymentTerms || cfg.defaultPaymentTerms,
    creditDays: input.creditDays ?? cfg.defaultCreditDays,
    dueDate: input.dueDate || null,
    items, itemCount: items.length, grns: [],
  };
}

export interface PostPiOpts {
  user: { id: number; tenantId: number };
  seg: { businessId?: number; branchId?: number };
  stamp: TerminalStamp;
  input: PurchaseInvoiceCreateInput;
  built: BuiltInvoice;
  grns: GrnWithLines[];
  cfg: PurchaseInvoiceConfig;
  status: string; // "Posted" | "Pending Approval"
}

/** Shared posting: re-key the GRN payables to the invoice (no double-count) + post
 * the invoice-level delta journal + flag the GRN(s). Used by both create-Posted and
 * approve. `p` carries the invoice's primitive fields. Returns {payableId, journalRef}. */
interface PostingFields {
  invoiceType: "GRN" | "Direct"; purchaseType: string;
  invoiceId: number; invoiceNo: string; supplier: string | null; netPayable: number; dueDate: string | null; paymentTerms: string | null;
  chargesTotal: number; additionalDiscount: number; roundOff: number; taxableAmount: number; gstAmount: number; grnAmount: number; postingDate: string; grnIds: number[];
}
/** A round-off line that balances the voucher: a positive round-off (we owe a bit
 * more) is a loss → Debit; negative is a gain → Credit. */
const roundLine = (ro: number) => (ro >= 0 ? { code: ACC.ROUND_OFF, debit: ro, narration: "Round off" } : { code: ACC.ROUND_OFF, credit: -ro, narration: "Round off" });

async function applyInvoicePosting(tx: Prisma.TransactionClient, tenantId: number, seg: { businessId?: number; branchId?: number }, p: PostingFields, cfg: PurchaseInvoiceConfig, userId: number, advance?: AdvanceApply): Promise<{ payableId: number | null; journalRef: string | null }> {
  const advanceTotal = r2(advance?.total ?? 0);
  // Legacy GRN = GST + Payable were already fully posted at GRN time (the old
  // "hasInvoice" model) — skip re-posting those. A `pendingInvoice` GRN payable is
  // just an early subledger placeholder (created at GRN-post time for Payable
  // Management visibility, before the formal invoice) — GL still needs the normal
  // GRN-Clearing branch below to clear GRN Clearing and book GST now.
  let legacyGrn = false; let grnPaid = 0;
  if (p.invoiceType === "GRN") {
    const existing = await tx.payable.findMany({ where: { tenantId, sourceType: "GRN", sourceId: { in: p.grnIds } } });
    legacyGrn = existing.some((x) => !x.pendingInvoice);
    grnPaid = r2(existing.reduce((s, x) => s + num(x.paidAmount), 0));
    if (existing.length > 0) await tx.payable.deleteMany({ where: { tenantId, sourceType: "GRN", sourceId: { in: p.grnIds } } });
  }

  let payableId: number | null = null;
  if (cfg.autoCreateOutstanding) {
    // Any payment already recorded against the GRN's own (legacy or pendingInvoice)
    // payable, plus a supplier advance applied to this bill, both count as pre-paid.
    const paidAmount = r2(grnPaid + advanceTotal);
    const balance = r2(p.netPayable - paidAmount);
    if (balance > 0.005) {
      const pay = await tx.payable.create({ data: { tenantId, businessId: seg.businessId, branchId: seg.branchId, sourceType: "PURCHASE_INVOICE", sourceId: p.invoiceId, refNo: p.invoiceNo, supplier: p.supplier, docDate: p.dueDate, dueDate: p.dueDate, paymentTerms: p.paymentTerms, totalAmount: p.netPayable, paidAmount, balanceAmount: balance, status: paidAmount > 0 ? "Partial" : "Open" } });
      payableId = pay.id;
    }
  }

  let journalRef: string | null = null;
  if (cfg.autoAccountsPosting) {
    let lines: { code: string; debit?: number; credit?: number; narration?: string }[];
    if (p.invoiceType === "Direct") {
      // Full voucher: Dr goods/expense/asset + charges + Input GST, Cr Payable.
      lines = [
        { code: purchaseTypeAccount(p.purchaseType), debit: p.taxableAmount, narration: `${p.purchaseType} purchase` },
        { code: ACC.INDIRECT_EXPENSE, debit: p.chargesTotal, narration: "Freight & other charges" },
        { code: ACC.INPUT_GST, debit: p.gstAmount, narration: "Input GST (ITC)" },
        { code: ACC.INDIRECT_EXPENSE, credit: p.additionalDiscount, narration: "Discount on bill" },
        roundLine(p.roundOff),
        { code: ACC.PAYABLE, credit: p.netPayable, narration: `Payable to ${p.supplier ?? "supplier"}` },
      ];
    } else if (legacyGrn) {
      // Legacy: goods + GST already booked at GRN — post only the charge/discount delta.
      const delta = r2(p.chargesTotal - p.additionalDiscount + p.roundOff);
      lines = [
        { code: ACC.INDIRECT_EXPENSE, debit: p.chargesTotal, narration: "Freight & other invoice charges" },
        { code: ACC.INDIRECT_EXPENSE, credit: p.additionalDiscount, narration: "Additional discount on bill" },
        roundLine(p.roundOff),
        delta >= 0 ? { code: ACC.PAYABLE, credit: delta, narration: `Bill charges payable to ${p.supplier ?? "supplier"}` } : { code: ACC.PAYABLE, debit: -delta, narration: `Bill adjustment for ${p.supplier ?? "supplier"}` },
      ];
    } else {
      // GRN-Clearing: clear the GRN Clearing (goods value GRN booked) + book Input GST
      // + charges, Cr Payable. Goods stay in inventory from the GRN.
      const clearingValue = r2(p.grnAmount - p.gstAmount);
      lines = [
        { code: ACC.GRN_CLEARING, debit: clearingValue, narration: "GRN clearing settled (invoice recorded)" },
        { code: ACC.INPUT_GST, debit: p.gstAmount, narration: "Input GST (ITC)" },
        { code: ACC.INDIRECT_EXPENSE, debit: p.chargesTotal, narration: "Freight & other charges" },
        { code: ACC.INDIRECT_EXPENSE, credit: p.additionalDiscount, narration: "Discount on bill" },
        roundLine(p.roundOff),
        { code: ACC.PAYABLE, credit: p.netPayable, narration: `Payable to ${p.supplier ?? "supplier"}` },
      ];
    }
    // Supplier advance applied → Dr Accounts Payable (reduces net owed) + Cr the
    // advance asset control account (consumes the prepaid advance). Keeps the voucher
    // balanced and nets AP to (netPayable − advance).
    if (advance && advanceTotal > 0) {
      lines.push({ code: ACC.PAYABLE, debit: advanceTotal, narration: "Supplier advance adjusted" });
      lines.push({ code: advance.accountCode || "1150", credit: advanceTotal, narration: "Supplier advance applied" });
    }
    const entryId = await postJournal(tx, { tenantId, ...seg, voucherType: "PURCHASE_INVOICE", prefix: "PI", date: p.postingDate, narration: `Purchase Invoice — ${p.invoiceNo}${p.supplier ? ` — ${p.supplier}` : ""}`, sourceType: "PURCHASE_INVOICE", sourceId: p.invoiceId, refNo: p.invoiceNo, createdBy: userId, lines });
    if (entryId) journalRef = (await tx.journalEntry.findUnique({ where: { id: entryId }, select: { voucherNo: true } }))?.voucherNo ?? null;
    // Record an Advance Management settlement per applied advance (GL embedded above).
    if (advance && advanceTotal > 0) for (const a of advance.adjustments) await createInlineSettlement(tx, { tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, advanceId: a.advanceId, amount: r2(a.amount), refDocType: "Purchase Invoice", refDocId: p.invoiceId, refInvoice: p.invoiceNo, journalId: entryId, createdBy: userId, createdByName: null });
  }
  if (p.invoiceType === "GRN") {
    await tx.goodsReceiptNote.updateMany({ where: { id: { in: p.grnIds }, tenantId }, data: { purchaseInvoiceId: p.invoiceId, invoiceStatus: "Invoice Recorded", invoiceRecorded: true, accountsPosted: true } });
  }
  // Asset purchases → create the Asset Register entries (idempotent).
  if (p.purchaseType === "Asset") {
    const ai = await tx.purchaseInvoice.findUnique({ where: { id: p.invoiceId }, select: { supplierId: true, supplierInvoiceDate: true } });
    await createAssetRegisterForInvoice(tx, tenantId, seg, { id: p.invoiceId, invoiceNo: p.invoiceNo, supplierId: ai?.supplierId ?? null, supplier: p.supplier, supplierInvoiceDate: ai?.supplierInvoiceDate ?? null }, userId);
  }
  return { payableId, journalRef };
}

/** Create the PurchaseInvoice (+items, attachments, grn-map). When status is
 * "Posted": migrate the payable + post the invoice-level delta journal + flag the
 * GRN(s) as invoiced. Inventory + goods/GST GL are untouched (already at GRN). */
export async function postPurchaseInvoiceTx(tx: Prisma.TransactionClient, opts: PostPiOpts): Promise<{ id: number; invoiceNo: string; status: string }> {
  const { user, seg, stamp, input, built, grns, cfg, status } = opts;
  const invoiceNo = await nextPurchaseInvoiceNumber(tx, user.tenantId, { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });

  const inv = await tx.purchaseInvoice.create({
    data: {
      tenantId: user.tenantId, ...seg, invoiceNo,
      supplierInvoiceNo: input.supplierInvoiceNo || null, supplierInvoiceDate: input.supplierInvoiceDate || null,
      supplierBillNo: input.supplierBillNo || null, supplierBillDate: input.supplierBillDate || null,
      dueDate: built.dueDate, paymentTerms: built.paymentTerms, creditDays: built.creditDays, currency: input.currency || cfg.defaultCurrency, supplierRef: input.supplierRef || null,
      invoiceType: built.invoiceType, grnRef: input.grnRef || null,
      supplier: built.supplier, supplierId: input.supplierId ?? null, supplierGstin: built.supplierGstin, poNo: built.poNo, warehouse: built.warehouse, purchaseType: built.purchaseType,
      grnAmount: built.grnAmount, additionalDiscount: built.additionalDiscount, freight: built.freight, loading: built.loading, packing: built.packing, insurance: built.insurance, otherCharges: built.otherCharges, roundOff: built.roundOff,
      taxableAmount: built.taxableAmount, cgst: built.cgst, sgst: built.sgst, igst: built.igst, cess: built.cess, gstAmount: built.gstAmount,
      gstApplicable: input.gstApplicable !== false, reverseCharge: !!input.reverseCharge,
      totalInvoiceAmount: built.totalInvoiceAmount, netPayable: built.netPayable,
      status, itemCount: built.itemCount, remarks: input.remarks || null, internalNotes: input.internalNotes || null, createdBy: user.id, ...stamp,
      items: { create: built.items },
      attachments: { create: input.attachments.map((a) => ({ docType: a.docType ?? "invoice", fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType ?? null, size: a.size ?? 0 })) },
      grnMap: { create: built.grns.map((g) => ({ grnId: g.grnId, grnNo: g.grnNo, grnAmount: g.grnAmount })) },
    },
    select: { id: true },
  });

  if (status === "Posted") {
    // Supplier advances applied to this bill (Advance Management integration).
    let advance: AdvanceApply | undefined;
    const adjInput = (input.advanceAdjustments ?? []).filter((a) => Number(a.advanceId) > 0 && Number(a.amount) > 0);
    if (adjInput.length && input.supplierId) {
      const advs = await tx.advance.findMany({ where: { id: { in: adjInput.map((a) => Number(a.advanceId)) }, tenantId: user.tenantId, partyType: { in: ["Supplier", "Vendor", "Contractor"] }, partyId: input.supplierId, status: { in: ["Paid", "Partially Settled"] } } });
      const byId = new Map(advs.map((a) => [a.id, a]));
      const adjustments: { advanceId: number; amount: number }[] = [];
      let total = 0;
      for (const a of adjInput) { const adv = byId.get(Number(a.advanceId)); if (!adv) throw new Error("An advance is not available for this supplier."); const amt = r2(num(a.amount)); if (amt > num(adv.balanceAmount) + 0.01) throw new Error(`Advance ${adv.advanceNo} adjustment exceeds its balance.`); adjustments.push({ advanceId: adv.id, amount: amt }); total = r2(total + amt); }
      if (total > r2(built.netPayable) + 0.01) throw new Error("Advance adjustment exceeds the bill payable.");
      advance = { total, accountCode: "1150", adjustments };
    }
    const { payableId, journalRef } = await applyInvoicePosting(tx, user.tenantId, seg, {
      invoiceType: built.invoiceType, purchaseType: built.purchaseType,
      invoiceId: inv.id, invoiceNo, supplier: built.supplier, netPayable: built.netPayable, dueDate: built.dueDate, paymentTerms: built.paymentTerms,
      chargesTotal: built.chargesTotal, additionalDiscount: built.additionalDiscount, roundOff: built.roundOff, taxableAmount: built.taxableAmount, gstAmount: built.gstAmount, grnAmount: built.grnAmount,
      postingDate: input.supplierInvoiceDate || new Date().toISOString().slice(0, 10), grnIds: grns.map((g) => g.id),
    }, cfg, user.id, advance);
    await tx.purchaseInvoice.update({ where: { id: inv.id }, data: { accountsPosted: cfg.autoAccountsPosting, journalRef, payableId } });
  }

  return { id: inv.id, invoiceNo, status };
}

/** Approve a Pending-Approval invoice → Posted: migrate the payable + post the delta
 * journal + flag the GRN(s), reconstructing the posting fields from the stored row. */
export async function postExistingPurchaseInvoiceTx(tx: Prisma.TransactionClient, tenantId: number, invoiceId: number, userId: number, cfg: PurchaseInvoiceConfig, note?: string | null): Promise<void> {
  const inv = await tx.purchaseInvoice.findFirst({ where: { id: invoiceId, tenantId }, include: { grnMap: true } });
  if (!inv) throw new Error("Purchase invoice not found.");
  const seg = { businessId: inv.businessId ?? undefined, branchId: inv.branchId ?? undefined };
  const chargesTotal = r2(num(inv.freight) + num(inv.loading) + num(inv.packing) + num(inv.insurance) + num(inv.otherCharges));
  const { payableId, journalRef } = await applyInvoicePosting(tx, tenantId, seg, {
    invoiceType: (inv.invoiceType as "GRN" | "Direct"), purchaseType: inv.purchaseType,
    invoiceId: inv.id, invoiceNo: inv.invoiceNo, supplier: inv.supplier, netPayable: num(inv.netPayable), dueDate: inv.dueDate, paymentTerms: inv.paymentTerms,
    chargesTotal, additionalDiscount: num(inv.additionalDiscount), roundOff: num(inv.roundOff), taxableAmount: num(inv.taxableAmount), gstAmount: num(inv.gstAmount), grnAmount: num(inv.grnAmount),
    postingDate: inv.supplierInvoiceDate || new Date().toISOString().slice(0, 10), grnIds: inv.grnMap.map((m) => m.grnId),
  }, cfg, userId);
  await tx.purchaseInvoice.update({ where: { id: inv.id }, data: { status: "Posted", accountsPosted: cfg.autoAccountsPosting, journalRef, payableId, approvedBy: userId, approvedAt: new Date(), approvalNote: note || null } });
}

/** Cancel a posted invoice: reverse the delta journal, drop its payable, restore the
 * GRN payable(s), and reset the GRN invoice flags. */
export async function reversePurchaseInvoiceTx(tx: Prisma.TransactionClient, tenantId: number, invoiceId: number, userId: number): Promise<void> {
  const inv = await tx.purchaseInvoice.findFirst({ where: { id: invoiceId, tenantId }, include: { grnMap: true } });
  if (!inv) throw new Error("Purchase invoice not found.");
  const seg = { businessId: inv.businessId ?? undefined, branchId: inv.branchId ?? undefined };

  if (inv.status === "Posted" || inv.status === "Approved") {
    // Reverse the posted invoice journal by reading it back and swapping Dr/Cr — works
    // for every model (direct / GRN-clearing / legacy-delta). Whether it touched GRN
    // Clearing tells us if it was the new (clearing) or legacy (payable) model.
    let bookedGrnClearing = false;
    if (inv.accountsPosted) {
      const entry = await tx.journalEntry.findFirst({ where: { tenantId, sourceType: "PURCHASE_INVOICE", sourceId: inv.id, voucherType: "PURCHASE_INVOICE" }, include: { lines: { include: { account: { select: { code: true } } } } }, orderBy: { id: "desc" } });
      if (entry) {
        bookedGrnClearing = entry.lines.some((l) => l.account.code === ACC.GRN_CLEARING);
        const lines = entry.lines.map((l) => ({ code: l.account.code, debit: num(l.credit), credit: num(l.debit), narration: "Reverse" }));
        await postJournal(tx, { tenantId, ...seg, voucherType: "PI_REVERSAL", prefix: "PIR", date: new Date().toISOString().slice(0, 10), narration: `Cancel Purchase Invoice — ${inv.invoiceNo}`, sourceType: "PURCHASE_INVOICE", sourceId: inv.id, refNo: inv.invoiceNo, createdBy: userId, lines });
      }
    }
    // Void any supplier-advance settlements applied to this bill (restore the advance).
    await reverseInlineSettlements(tx, tenantId, "Purchase Invoice", inv.id);
    // Drop the invoice payable.
    await tx.payable.deleteMany({ where: { tenantId, sourceType: "PURCHASE_INVOICE", sourceId: inv.id } });
    // GRN bills: reset the GRN invoice flags. Legacy GRN bills (which had migrated a
    // GRN payable) also restore that payable; GRN-Clearing bills don't (cancel re-opens
    // GRN Clearing instead, handled by the swapped journal above).
    const legacy = inv.invoiceType === "GRN" && !bookedGrnClearing && inv.accountsPosted;
    for (const m of inv.grnMap) {
      if (legacy) {
        const g = await tx.goodsReceiptNote.findUnique({ where: { id: m.grnId } });
        if (g && g.status === "Posted") {
          const grand = r2(num(g.subtotal) + num(g.taxTotal) + num(g.freightAmount) + num(g.otherCharges) + num(g.roundOff));
          const balance = r2(grand - num(g.amountPaid));
          await tx.payable.deleteMany({ where: { tenantId, sourceType: "GRN", sourceId: g.id } });
          if (balance > 0.005) {
            await tx.payable.create({ data: { tenantId, businessId: g.businessId ?? undefined, branchId: g.branchId ?? undefined, sourceType: "GRN", sourceId: g.id, refNo: g.grnNo, supplier: g.supplier, docDate: g.grnDate, dueDate: g.dueDate, paymentTerms: g.paymentTerms, totalAmount: grand, paidAmount: num(g.amountPaid), balanceAmount: balance, status: num(g.amountPaid) > 0 ? "Partial" : "Open" } });
          }
        }
      }
      await tx.goodsReceiptNote.update({ where: { id: m.grnId }, data: { purchaseInvoiceId: null, invoiceStatus: "Pending", invoiceRecorded: false, accountsPosted: false } });
    }
  }
  // Asset invoice cancelled → drop its still-Active asset-register entries.
  if (inv.purchaseType === "Asset") {
    await tx.fixedAsset.deleteMany({ where: { tenantId, purchaseInvoiceId: inv.id, status: "Active" } });
  }
  await tx.purchaseInvoice.update({ where: { id: inv.id }, data: { status: "Cancelled", payableId: null } });
}

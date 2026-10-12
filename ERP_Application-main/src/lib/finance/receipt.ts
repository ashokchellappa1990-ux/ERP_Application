import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ACC, ensureAccounts } from "@/lib/accounting/accounts";
import { postJournal, reverseJournalForSource } from "@/lib/accounting/post";
import { recordBankMovement } from "@/lib/finance/bank";
import { BANK_MODES, type ReceiptConfig, type ReceiptConfigInput, type ReceiptCategoryRow, type ReceiptCategoryInput, type ReceiptSubHeadInput, type ReceiptCreateInput, type ReceiptRow, type ReceiptDetail, type AccountRef, type ReceiptPartyRow, type ReceiptPartyInput, type TaxType } from "@/lib/contracts/receipt";

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");

export interface Scope { tenantId: number; businessId: number | null }
export interface Ctx extends Scope { branchId: number | null; userId: number; userName: string | null }
const bizWhere = (s: Scope) => (s.businessId != null ? { tenantId: s.tenantId, businessId: s.businessId } : { tenantId: s.tenantId });

// ----------------------------------------------------------------- configuration

const DEFAULT_CONFIG: ReceiptConfig = {
  enableModule: true, enableApproval: false, enableAttachment: true, enableCostCenter: false,
  enableDepartment: false, enableProject: false, enableMultiMode: false, enableSubHead: true, enableGst: true, autoVoucher: true,
  voucherPrefix: "REC", voucherPadding: 4, voucherSeparator: "/", voucherReset: "Yearly", voucherSeq: 0, voucherSeqPeriod: "",
};

async function configRow(s: Scope) {
  return (await prisma.receiptConfiguration.findFirst({ where: bizWhere(s) }))
    ?? prisma.receiptConfiguration.create({ data: { tenantId: s.tenantId, businessId: s.businessId, enableSubHead: true, enableGst: true } });
}

export async function getConfig(s: Scope): Promise<ReceiptConfig> {
  const c = await configRow(s);
  return {
    enableModule: c.enableModule, enableApproval: c.enableApproval, enableAttachment: c.enableAttachment,
    enableCostCenter: c.enableCostCenter, enableDepartment: c.enableDepartment, enableProject: c.enableProject, enableMultiMode: c.enableMultiMode,
    enableSubHead: c.enableSubHead, enableGst: c.enableGst,
    autoVoucher: c.autoVoucher, voucherPrefix: c.voucherPrefix, voucherPadding: c.voucherPadding, voucherSeparator: c.voucherSeparator,
    voucherReset: c.voucherReset as ReceiptConfig["voucherReset"], voucherSeq: c.voucherSeq, voucherSeqPeriod: c.voucherSeqPeriod ?? "",
  };
}

export async function saveConfig(s: Scope, input: ReceiptConfigInput): Promise<ReceiptConfig> {
  const c = await configRow(s);
  await prisma.receiptConfiguration.update({ where: { id: c.id }, data: { ...input } });
  return getConfig(s);
}

// ------------------------------------------------------------------- categories

const DEFAULT_CATEGORIES: { code: string; name: string; credit: [string, string] }[] = [
  { code: "SUPP-REF", name: "Supplier Refund", credit: ["2000", "Accounts Payable"] },
  { code: "BANK-WD", name: "Bank Withdrawal", credit: ["1010", "Bank Account"] },
  { code: "OWN-CAP", name: "Owner Capital", credit: ["3110", "Owner's Capital"] },
  { code: "EMP-REC", name: "Employee Recovery", credit: ["3260", "Employee Recovery"] },
  { code: "RENT", name: "Rental Income", credit: ["3210", "Rental Income"] },
  { code: "COMM", name: "Commission Income", credit: ["3220", "Commission Income"] },
  { code: "SCRAP", name: "Scrap Sales", credit: ["3240", "Scrap Sales"] },
  { code: "INS", name: "Insurance Claim", credit: ["3250", "Insurance Claim Received"] },
  { code: "INT", name: "Interest Income", credit: ["3230", "Interest Income"] },
  { code: "MISC", name: "Miscellaneous Income", credit: ["3200", "Miscellaneous Income"] },
  { code: "OTHER", name: "Other Receipt", credit: ["3270", "Other Receipts"] },
];

type CatWithSub = Prisma.ReceiptCategoryGetPayload<{ include: { subHeads: true } }>;
const toCategoryRow = (c: CatWithSub): ReceiptCategoryRow => ({
  id: c.id, code: c.code, name: c.name, description: c.description ?? "", debitCode: c.debitCode ?? "", debitName: c.debitName ?? "",
  creditCode: c.creditCode ?? "", creditName: c.creditName ?? "", approvalRequired: c.approvalRequired, allowAttachment: c.allowAttachment, active: c.active,
  subHeads: (c.subHeads ?? []).filter((h) => h.active).map((h) => ({ id: h.id, categoryId: h.categoryId, code: h.code ?? "", name: h.name, creditCode: h.creditCode ?? "", creditName: h.creditName ?? "", taxType: (h.taxType ?? "None") as TaxType, taxRate: num(h.taxRate), active: h.active })),
});

export async function listCategories(s: Scope, includeInactive = true): Promise<ReceiptCategoryRow[]> {
  let rows = await prisma.receiptCategory.findMany({ where: bizWhere(s), orderBy: { name: "asc" }, include: { subHeads: { orderBy: { name: "asc" } } } });
  if (!rows.length) {
    await prisma.receiptCategory.createMany({
      data: DEFAULT_CATEGORIES.map((d) => ({ tenantId: s.tenantId, businessId: s.businessId, code: d.code, name: d.name, debitCode: ACC.CASH, debitName: "Cash in Hand", creditCode: d.credit[0], creditName: d.credit[1], approvalRequired: false, allowAttachment: true, active: true })),
    });
    rows = await prisma.receiptCategory.findMany({ where: bizWhere(s), orderBy: { name: "asc" }, include: { subHeads: { orderBy: { name: "asc" } } } });
  }
  return rows.filter((r) => includeInactive || r.active).map(toCategoryRow);
}

export async function createCategory(s: Scope, input: ReceiptCategoryInput): Promise<number> {
  const c = await prisma.receiptCategory.create({ data: { tenantId: s.tenantId, businessId: s.businessId, code: input.code, name: input.name, description: input.description || null, debitCode: input.debitCode || null, debitName: input.debitName || null, creditCode: input.creditCode || null, creditName: input.creditName || null, approvalRequired: !!input.approvalRequired, allowAttachment: input.allowAttachment ?? true, active: input.active ?? true } });
  return c.id;
}

export async function updateCategory(s: Scope, id: number, input: ReceiptCategoryInput): Promise<void> {
  const ex = await prisma.receiptCategory.findFirst({ where: { id, ...bizWhere(s) } });
  if (!ex) throw new Error("Category not found.");
  await prisma.receiptCategory.update({ where: { id }, data: { code: input.code, name: input.name, description: input.description || null, debitCode: input.debitCode || null, debitName: input.debitName || null, creditCode: input.creditCode || null, creditName: input.creditName || null, approvalRequired: !!input.approvalRequired, allowAttachment: input.allowAttachment ?? true, active: input.active ?? true } });
}

/** Hard-delete a category (and its sub-heads). Posted receipts keep their snapshot. */
export async function deleteCategory(s: Scope, id: number): Promise<void> {
  const ex = await prisma.receiptCategory.findFirst({ where: { id, ...bizWhere(s) } });
  if (!ex) throw new Error("Category not found.");
  await prisma.receiptCategory.delete({ where: { id } });
}

// -------------------------------------------------------------------- sub heads

async function assertCategory(s: Scope, categoryId: number) {
  const c = await prisma.receiptCategory.findFirst({ where: { id: categoryId, ...bizWhere(s) } });
  if (!c) throw new Error("Category not found.");
  return c;
}
export async function createSubHead(s: Scope, input: ReceiptSubHeadInput): Promise<number> {
  await assertCategory(s, input.categoryId);
  const h = await prisma.receiptSubHead.create({ data: { tenantId: s.tenantId, businessId: s.businessId, categoryId: input.categoryId, code: input.code || null, name: input.name, creditCode: input.creditCode || null, creditName: input.creditName || null, taxType: input.taxType ?? "None", taxRate: r2(input.taxRate ?? 0), active: input.active ?? true } });
  return h.id;
}
export async function updateSubHead(s: Scope, id: number, input: ReceiptSubHeadInput): Promise<void> {
  const ex = await prisma.receiptSubHead.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!ex) throw new Error("Sub-head not found.");
  await prisma.receiptSubHead.update({ where: { id }, data: { code: input.code || null, name: input.name, creditCode: input.creditCode || null, creditName: input.creditName || null, taxType: input.taxType ?? "None", taxRate: r2(input.taxRate ?? 0), active: input.active ?? true } });
}
export async function deleteSubHead(s: Scope, id: number): Promise<void> {
  const ex = await prisma.receiptSubHead.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!ex) throw new Error("Sub-head not found.");
  await prisma.receiptSubHead.delete({ where: { id } });
}

// ----------------------------------------------------------------------- parties

/** List parties for a type from its CANONICAL master (no duplicate master):
 *  Supplier→suppliers, Customer→customers, Bank→SetupBank, Employee→users,
 *  Owner/Other→receipt_party (the only types without a canonical home). */
export async function listParties(s: Scope, type: string): Promise<ReceiptPartyRow[]> {
  if (type === "Supplier") {
    const rows = await prisma.supplier.findMany({ where: { ...bizWhere(s) }, orderBy: { name: "asc" }, take: 500, select: { id: true, name: true, gstin: true, phone: true } });
    return rows.map((r) => ({ id: r.id, name: r.name, gstin: r.gstin ?? "", phone: r.phone ?? "", type: "Supplier", source: "supplier" as const }));
  }
  if (type === "Customer") {
    const rows = await prisma.customer.findMany({ where: { ...bizWhere(s) }, orderBy: { name: "asc" }, take: 500, select: { id: true, name: true, gstin: true, phone: true } });
    return rows.map((r) => ({ id: r.id, name: r.name, gstin: r.gstin ?? "", phone: r.phone ?? "", type: "Customer", source: "customer" as const }));
  }
  if (type === "Bank") {
    const rows = await prisma.setupBank.findMany({ where: { setup: { tenantId: s.tenantId }, ...(s.businessId != null ? { businessId: s.businessId } : {}) }, orderBy: { id: "asc" }, take: 500, select: { id: true, bankName: true, account: true } });
    return rows.map((r) => ({ id: r.id, name: `${r.bankName ?? "Bank"}${r.account ? ` ••${r.account.slice(-4)}` : ""}`, gstin: "", phone: r.account ?? "", type: "Bank", source: "bank" as const }));
  }
  if (type === "Employee") {
    const rows = await prisma.user.findMany({ where: { tenantId: s.tenantId }, orderBy: { fullName: "asc" }, take: 500, select: { id: true, fullName: true, mobile: true } });
    return rows.map((r) => ({ id: r.id, name: r.fullName, gstin: "", phone: r.mobile ?? "", type: "Employee", source: "employee" as const }));
  }
  const rows = await prisma.receiptParty.findMany({ where: { ...bizWhere(s), type, active: true }, orderBy: { name: "asc" }, take: 500 });
  return rows.map((r) => ({ id: r.id, name: r.name, gstin: r.gstin ?? "", phone: r.phone ?? "", type: r.type, source: "party" as const }));
}

/** Quick-add a party into its canonical master (Supplier→suppliers, Customer→customers,
 *  Owner/Other→receipt_party). Bank & Employee are select-only (managed in their own modules). */
export async function createParty(s: Scope, input: ReceiptPartyInput): Promise<ReceiptPartyRow> {
  if (input.type === "Supplier") {
    const sup = await prisma.supplier.create({ data: { tenantId: s.tenantId, businessId: s.businessId ?? undefined, name: input.name, gstin: input.gstin || null, phone: input.phone || null, email: input.email || null, address: input.address || null, category: "Vendor", status: "Active" } });
    return { id: sup.id, name: sup.name, gstin: sup.gstin ?? "", phone: sup.phone ?? "", type: "Supplier", source: "supplier" };
  }
  if (input.type === "Customer") {
    const cus = await prisma.customer.create({ data: { tenantId: s.tenantId, businessId: s.businessId ?? undefined, name: input.name, gstin: input.gstin || null, phone: input.phone || null, email: input.email || null, address: input.address || null, status: "Active" } });
    return { id: cus.id, name: cus.name, gstin: cus.gstin ?? "", phone: cus.phone ?? "", type: "Customer", source: "customer" };
  }
  if (input.type === "Bank" || input.type === "Employee") throw new Error(`${input.type} parties are managed in their own master — select an existing one.`);
  const p = await prisma.receiptParty.create({ data: { tenantId: s.tenantId, businessId: s.businessId, type: input.type, name: input.name, gstin: input.gstin || null, phone: input.phone || null, email: input.email || null, address: input.address || null } });
  return { id: p.id, name: p.name, gstin: p.gstin ?? "", phone: p.phone ?? "", type: p.type, source: "party" };
}

// ---------------------------------------------------------------- ledger accounts

export async function listAccounts(s: Scope): Promise<AccountRef[]> {
  await prisma.$transaction((tx) => ensureAccounts(tx, s.tenantId));
  const rows = await prisma.ledgerAccount.findMany({ where: { tenantId: s.tenantId }, orderBy: { code: "asc" }, select: { code: true, name: true, type: true } });
  return rows.map((a) => ({ code: a.code, name: a.name, type: a.type }));
}

// --------------------------------------------------------------- voucher number

function periodKey(reset: string, d: Date): string {
  const y = d.getFullYear(), m = d.getMonth();
  if (reset === "Monthly") return `${y}-${String(m + 1).padStart(2, "0")}`;
  if (reset === "Yearly") return `FY${m >= 3 ? y : y - 1}`;
  return "ALL";
}
function fyOf(d: Date): string { const y = d.getFullYear(), m = d.getMonth(); const s = m >= 3 ? y : y - 1; return `${s}-${String(s + 1).slice(-2)}`; }

async function nextVoucherNo(tx: Prisma.TransactionClient, configId: number, now: Date): Promise<string> {
  const locked = await tx.$queryRawUnsafe<Array<{ voucherPrefix: string; voucherPadding: number; voucherSeparator: string; voucherReset: string; voucherSeq: number; voucherSeqPeriod: string | null }>>(
    "SELECT `voucherPrefix`,`voucherPadding`,`voucherSeparator`,`voucherReset`,`voucherSeq`,`voucherSeqPeriod` FROM `receipt_configuration` WHERE `id` = ? FOR UPDATE", configId,
  );
  const c = locked[0]; const period = periodKey(c.voucherReset, now);
  const seq = (c.voucherSeqPeriod === period ? c.voucherSeq : 0) + 1;
  await tx.receiptConfiguration.update({ where: { id: configId }, data: { voucherSeq: seq, voucherSeqPeriod: period } });
  return [c.voucherPrefix || "REC", String(seq).padStart(Math.max(1, c.voucherPadding || 1), "0")].join(c.voucherSeparator || "/");
}

// ------------------------------------------------------------------- transactions

const debitForMode = (mode: string): { code: string; name: string } =>
  BANK_MODES.includes(mode as never) ? { code: ACC.BANK, name: "Bank Account" } : { code: ACC.CASH, name: "Cash in Hand" };

interface BuiltLine { subHeadId: number | null; headName: string; taxable: number; taxType: TaxType; gstRate: number | null; gstAmount: number; cgst: number; sgst: number; tdsAmount: number; tcsAmount: number; amount: number; creditCode: string; creditName: string }
interface BuiltTotals { lines: BuiltLine[]; taxable: number; gst: number; cgst: number; sgst: number; tds: number; tcs: number; total: number }
/** Per-line tax: GST→CGST+SGST (added), TCS→added, TDS→deducted. `total` = net cash received. */
function buildLines(input: ReceiptCreateInput, cat: { name: string; creditCode: string | null; creditName: string | null }): BuiltTotals {
  const raw = (input.heads && input.heads.length) ? input.heads : [{ headName: cat.name, taxable: input.amount, taxType: "None" as TaxType, gstRate: 0, creditCode: cat.creditCode ?? undefined, creditName: cat.creditName ?? undefined, subHeadId: undefined }];
  let taxable = 0, gst = 0, cgst = 0, sgst = 0, tds = 0, tcs = 0, net = 0;
  const lines: BuiltLine[] = raw.map((h) => {
    const t = r2(h.taxable);
    const type = (h.taxType || "None") as TaxType;
    const rate = num(h.gstRate);
    const taxAmt = r2(t * rate / 100);
    let lgst = 0, lcgst = 0, lsgst = 0, ltds = 0, ltcs = 0, lnet = t;
    if (type === "GST") { lgst = taxAmt; lcgst = r2(taxAmt / 2); lsgst = r2(taxAmt - lcgst); lnet = r2(t + taxAmt); }
    else if (type === "TCS") { ltcs = taxAmt; lnet = r2(t + taxAmt); }
    else if (type === "TDS") { ltds = taxAmt; lnet = r2(t - taxAmt); }
    taxable += t; gst += lgst; cgst += lcgst; sgst += lsgst; tds += ltds; tcs += ltcs; net += lnet;
    return { subHeadId: h.subHeadId ?? null, headName: h.headName || cat.name, taxable: t, taxType: type, gstRate: rate || null, gstAmount: lgst, cgst: lcgst, sgst: lsgst, tdsAmount: ltds, tcsAmount: ltcs, amount: lnet, creditCode: h.creditCode || cat.creditCode || ACC.MISC_INCOME, creditName: h.creditName || cat.creditName || "Miscellaneous Income" };
  });
  return { lines, taxable: r2(taxable), gst: r2(gst), cgst: r2(cgst), sgst: r2(sgst), tds: r2(tds), tcs: r2(tcs), total: r2(net) };
}

export async function createReceipt(ctx: Ctx, input: ReceiptCreateInput): Promise<{ id: number; voucherNo: string }> {
  const date = (input.voucherDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const now = new Date();
  const cat = await prisma.receiptCategory.findFirst({ where: { id: input.categoryId, ...bizWhere(ctx) } });
  if (!cat) throw new Error("Receipt category not found.");
  const debit = input.debitCode ? { code: input.debitCode, name: input.debitName || input.debitCode } : debitForMode(input.mode);
  const b = buildLines(input, cat);
  const headCredit = b.lines[0] ?? { creditCode: cat.creditCode ?? ACC.MISC_INCOME, creditName: cat.creditName ?? "Miscellaneous Income" };
  const config = await configRow(ctx);

  const result = await prisma.$transaction(async (tx) => {
    const voucherNo = await nextVoucherNo(tx, config.id, now);
    const rec = await tx.receiptTransaction.create({
      data: {
        tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId,
        voucherNo, voucherDate: date, financialYear: fyOf(new Date(date + "T00:00:00")), accountingPeriod: date.slice(0, 7),
        categoryId: cat.id, categoryCode: cat.code, categoryName: cat.name,
        amount: b.total, taxableAmount: b.taxable, gstApplicable: b.gst > 0, gstAmount: b.gst, cgstAmount: b.cgst, sgstAmount: b.sgst, tdsAmount: b.tds, tcsAmount: b.tcs, partyGstin: input.partyGstin || null,
        mode: input.mode, cashAccountCode: input.mode === "Cash" ? ACC.CASH : null, bankAccountCode: input.mode !== "Cash" ? ACC.BANK : null, bankName: input.bankName || null, bankId: input.bankId ?? null, bankAccount: input.bankAccount || null,
        partyType: input.partyType || null, partyId: input.partyId ?? null, partyName: input.partyName || null,
        referenceNo: input.referenceNo || null, referenceDate: input.referenceDate || null, narration: input.narration || null,
        debitCode: debit.code, debitName: debit.name, creditCode: input.creditCode || headCredit.creditCode, creditName: input.creditName || headCredit.creditName,
        costCenter: input.costCenter || null, department: input.department || null, project: input.project || null, remarks: input.remarks || null,
        status: "Draft", createdBy: ctx.userId, createdByName: ctx.userName,
      },
      select: { id: true, voucherNo: true },
    });
    await tx.receiptTransactionDetail.createMany({ data: b.lines.map((l) => ({ tenantId: ctx.tenantId, receiptId: rec.id, subHeadId: l.subHeadId, headName: l.headName, taxable: l.taxable, taxType: l.taxType, gstRate: l.gstRate, gstAmount: l.gstAmount, cgst: l.cgst, sgst: l.sgst, tdsAmount: l.tdsAmount, tcsAmount: l.tcsAmount, amount: l.amount, creditCode: l.creditCode, creditName: l.creditName })) });
    if (input.attachments?.length) await tx.receiptAttachment.createMany({ data: input.attachments.map((a) => ({ tenantId: ctx.tenantId, receiptId: rec.id, docType: a.docType || "supporting", fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType || null, size: a.size || 0 })) });
    await tx.receiptAudit.create({ data: { tenantId: ctx.tenantId, receiptId: rec.id, action: "Created", byUser: ctx.userId, byName: ctx.userName, note: `${voucherNo} — ${cat.name} ${b.total}` } });
    return rec;
  });
  return { id: result.id, voucherNo: result.voucherNo };
}

export async function updateReceipt(ctx: Ctx, id: number, input: ReceiptCreateInput): Promise<void> {
  const ex = await prisma.receiptTransaction.findFirst({ where: { id, ...bizWhere(ctx) } });
  if (!ex) throw new Error("Receipt not found.");
  if (ex.status !== "Draft") throw new Error("Only a draft receipt can be edited.");
  const cat = await prisma.receiptCategory.findFirst({ where: { id: input.categoryId, ...bizWhere(ctx) } });
  if (!cat) throw new Error("Receipt category not found.");
  const debit = input.debitCode ? { code: input.debitCode, name: input.debitName || input.debitCode } : debitForMode(input.mode);
  const b = buildLines(input, cat);
  const headCredit = b.lines[0] ?? { creditCode: cat.creditCode ?? ACC.MISC_INCOME, creditName: cat.creditName ?? "Miscellaneous Income" };
  const date = (input.voucherDate || ex.voucherDate).slice(0, 10);
  await prisma.$transaction(async (tx) => {
    await tx.receiptTransaction.update({
      where: { id }, data: {
        voucherDate: date, accountingPeriod: date.slice(0, 7), categoryId: cat.id, categoryCode: cat.code, categoryName: cat.name,
        amount: b.total, taxableAmount: b.taxable, gstApplicable: b.gst > 0, gstAmount: b.gst, cgstAmount: b.cgst, sgstAmount: b.sgst, tdsAmount: b.tds, tcsAmount: b.tcs, partyGstin: input.partyGstin || null,
        mode: input.mode, cashAccountCode: input.mode === "Cash" ? ACC.CASH : null, bankAccountCode: input.mode !== "Cash" ? ACC.BANK : null, bankName: input.bankName || null, bankId: input.bankId ?? null, bankAccount: input.bankAccount || null,
        partyType: input.partyType || null, partyId: input.partyId ?? null, partyName: input.partyName || null, referenceNo: input.referenceNo || null, referenceDate: input.referenceDate || null, narration: input.narration || null,
        debitCode: debit.code, debitName: debit.name, creditCode: input.creditCode || headCredit.creditCode, creditName: input.creditName || headCredit.creditName,
        costCenter: input.costCenter || null, department: input.department || null, project: input.project || null, remarks: input.remarks || null,
      },
    });
    await tx.receiptTransactionDetail.deleteMany({ where: { receiptId: id } });
    await tx.receiptTransactionDetail.createMany({ data: b.lines.map((l) => ({ tenantId: ctx.tenantId, receiptId: id, subHeadId: l.subHeadId, headName: l.headName, taxable: l.taxable, taxType: l.taxType, gstRate: l.gstRate, gstAmount: l.gstAmount, cgst: l.cgst, sgst: l.sgst, tdsAmount: l.tdsAmount, tcsAmount: l.tcsAmount, amount: l.amount, creditCode: l.creditCode, creditName: l.creditName })) });
    if (input.attachments) {
      await tx.receiptAttachment.deleteMany({ where: { receiptId: id } });
      if (input.attachments.length) await tx.receiptAttachment.createMany({ data: input.attachments.map((a) => ({ tenantId: ctx.tenantId, receiptId: id, docType: a.docType || "supporting", fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType || null, size: a.size || 0 })) });
    }
    await tx.receiptAudit.create({ data: { tenantId: ctx.tenantId, receiptId: id, action: "Modified", byUser: ctx.userId, byName: ctx.userName } });
  });
}

export async function listReceipts(s: Scope, opts: { status?: string; q?: string }): Promise<ReceiptRow[]> {
  const where: Prisma.ReceiptTransactionWhereInput = { ...bizWhere(s) };
  if (opts.status && opts.status !== "All") where.status = opts.status;
  if (opts.q) where.OR = [{ voucherNo: { contains: opts.q } }, { partyName: { contains: opts.q } }, { categoryName: { contains: opts.q } }, { referenceNo: { contains: opts.q } }];
  const rows = await prisma.receiptTransaction.findMany({ where, orderBy: { id: "desc" }, take: 300 });
  return rows.map((r) => ({ id: r.id, voucherNo: r.voucherNo, voucherDate: r.voucherDate, categoryName: r.categoryName ?? "", mode: r.mode, amount: num(r.amount), partyName: r.partyName ?? "", branchId: r.branchId, status: r.status as ReceiptRow["status"], createdByName: r.createdByName ?? "" }));
}

export async function getReceiptDetail(s: Scope, id: number): Promise<ReceiptDetail | null> {
  const r = await prisma.receiptTransaction.findFirst({ where: { id, ...bizWhere(s) }, include: { details: true, attachments: true, audits: { orderBy: { id: "asc" } } } });
  if (!r) return null;
  const je = r.journalRef ? await prisma.journalEntry.findFirst({ where: { tenantId: s.tenantId, sourceType: "RECEIPT_TXN", sourceId: id }, include: { lines: { include: { account: true } } } }) : null;
  return {
    id: r.id, voucherNo: r.voucherNo, voucherDate: r.voucherDate, categoryName: r.categoryName ?? "", mode: r.mode, amount: num(r.amount), partyName: r.partyName ?? "", branchId: r.branchId, status: r.status as ReceiptDetail["status"], createdByName: r.createdByName ?? "",
    financialYear: r.financialYear ?? "", accountingPeriod: r.accountingPeriod ?? "", categoryId: r.categoryId, categoryCode: r.categoryCode ?? "",
    taxableAmount: num(r.taxableAmount), gstApplicable: r.gstApplicable, gstAmount: num(r.gstAmount), cgstAmount: num(r.cgstAmount), sgstAmount: num(r.sgstAmount), tdsAmount: num(r.tdsAmount), tcsAmount: num(r.tcsAmount), partyGstin: r.partyGstin ?? "",
    cashAccountCode: r.cashAccountCode ?? "", bankAccountCode: r.bankAccountCode ?? "", bankName: r.bankName ?? "",
    partyType: r.partyType ?? "", partyId: r.partyId, referenceNo: r.referenceNo ?? "", referenceDate: r.referenceDate ?? "", narration: r.narration ?? "",
    debitCode: r.debitCode ?? "", debitName: r.debitName ?? "", creditCode: r.creditCode ?? "", creditName: r.creditName ?? "",
    costCenter: r.costCenter ?? "", department: r.department ?? "", project: r.project ?? "", remarks: r.remarks ?? "",
    journalRef: r.journalRef ?? "", voucherJournalNo: je?.voucherNo ?? r.journalRef ?? "",
    submittedByName: r.submittedByName ?? "", approvedByName: r.approvedByName ?? "", postedByName: r.postedByName ?? "", cancelledByName: r.cancelledByName ?? "",
    heads: r.details.map((d) => ({ subHeadId: d.subHeadId, headName: d.headName ?? "", taxable: num(d.taxable), taxType: (d.taxType ?? "None") as TaxType, gstRate: num(d.gstRate), gstAmount: num(d.gstAmount), cgst: num(d.cgst), sgst: num(d.sgst), tdsAmount: num(d.tdsAmount), tcsAmount: num(d.tcsAmount), amount: num(d.amount), creditCode: d.creditCode ?? "", creditName: d.creditName ?? "" })),
    attachments: r.attachments.map((a) => ({ id: a.id, docType: a.docType, fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType ?? "", size: a.size })),
    journal: (je?.lines ?? []).map((l) => ({ account: l.account.name, code: l.account.code, debit: num(l.debit), credit: num(l.credit), narration: l.narration ?? "" })),
    audit: r.audits.map((a) => ({ id: a.id, action: a.action, byName: a.byName ?? "", note: a.note ?? "", at: iso(a.at) })),
  };
}

/** Dr cash/bank (net) + Dr TDS Receivable ; Cr income (taxable, grouped) + Cr Output GST
 *  (single head — the CGST/SGST split lives on the transaction for reports/compliance) + Cr TCS. */
async function postReceiptJournal(tx: Prisma.TransactionClient, ctx: Scope & { branchId: number | null; userId: number }, r: { id: number; voucherNo: string; voucherDate: string; amount: unknown; gstAmount: unknown; tdsAmount: unknown; tcsAmount: unknown; debitCode: string | null; mode: string; categoryName: string | null; partyName: string | null }, details: { taxable: unknown; creditCode: string | null; creditName: string | null }[]): Promise<number | null> {
  const net = r2(num(r.amount));
  const gst = r2(num(r.gstAmount)), tds = r2(num(r.tdsAmount)), tcs = r2(num(r.tcsAmount));
  const byAccount = new Map<string, { name: string; amt: number }>();
  for (const d of details) { const code = d.creditCode || ACC.MISC_INCOME; const e = byAccount.get(code) ?? { name: d.creditName || "Income", amt: 0 }; e.amt = r2(e.amt + num(d.taxable)); byAccount.set(code, e); }
  const lines: { code: string; debit?: number; credit?: number; narration?: string }[] = [
    { code: r.debitCode || (BANK_MODES.includes(r.mode as never) ? ACC.BANK : ACC.CASH), debit: net, narration: `Received via ${r.mode}` },
  ];
  if (tds > 0) lines.push({ code: ACC.TDS_RECEIVABLE, debit: tds, narration: "TDS deducted (receivable)" });
  for (const [code, v] of byAccount) lines.push({ code, credit: v.amt, narration: v.name });
  if (gst > 0) lines.push({ code: ACC.OUTPUT_GST, credit: gst, narration: "Output GST (CGST + SGST)" });
  if (tcs > 0) lines.push({ code: ACC.TCS_PAYABLE, credit: tcs, narration: "TCS collected (payable)" });
  return postJournal(tx, {
    tenantId: ctx.tenantId, businessId: ctx.businessId, branchId: ctx.branchId, voucherType: "RECEIPT", prefix: "RV", date: r.voucherDate,
    narration: `Receipt ${r.voucherNo} — ${r.categoryName ?? "Misc"}${r.partyName ? ` — ${r.partyName}` : ""}`,
    sourceType: "RECEIPT_TXN", sourceId: r.id, refNo: r.voucherNo, createdBy: ctx.userId, lines,
  });
}

const ELEVATED_ACTIONS = new Set(["approve", "post", "reverse"]);
export function isElevatedAction(a: string) { return ELEVATED_ACTIONS.has(a); }

export async function transitionReceipt(ctx: Ctx, id: number, action: string, note?: string): Promise<void> {
  const r = await prisma.receiptTransaction.findFirst({ where: { id, ...bizWhere(ctx) }, include: { details: true } });
  if (!r) throw new Error("Receipt not found.");
  const cfg = await getConfig(ctx);
  const now = new Date();
  const stamp = (a: string): Prisma.ReceiptTransactionUpdateInput => {
    if (a === "submit") return { status: "Submitted", submittedBy: ctx.userId, submittedByName: ctx.userName, submittedAt: now };
    if (a === "approve") return { status: "Approved", approvedBy: ctx.userId, approvedByName: ctx.userName, approvedAt: now };
    if (a === "post") return { status: "Posted", postedBy: ctx.userId, postedByName: ctx.userName, postedAt: now };
    return { status: "Cancelled", cancelledBy: ctx.userId, cancelledByName: ctx.userName, cancelledAt: now };
  };

  if (action === "submit") { if (r.status !== "Draft") throw new Error(`Cannot submit from "${r.status}".`); await mutate(id, ctx, stamp("submit"), "Submitted", note); }
  else if (action === "approve") { if (r.status !== "Submitted") throw new Error(`Cannot approve from "${r.status}".`); await mutate(id, ctx, stamp("approve"), "Approved", note); }
  else if (action === "post") {
    const ok = cfg.enableApproval ? r.status === "Approved" : ["Draft", "Submitted", "Approved"].includes(r.status);
    if (!ok) throw new Error(`Cannot post from "${r.status}"${cfg.enableApproval ? " (approval required)" : ""}.`);
    await prisma.$transaction(async (tx) => {
      const jid = await postReceiptJournal(tx, ctx, r, r.details);
      await recordBankMovement(tx, { tenantId: ctx.tenantId, businessId: r.businessId, branchId: r.branchId, userId: ctx.userId, userName: ctx.userName }, { bankId: r.bankId, bankName: r.bankName, bankAccount: r.bankAccount, date: r.voucherDate, direction: "in", amount: Number(r.amount), mode: r.mode, reference: r.referenceNo, sourceType: "ReceiptTransaction", sourceId: r.id, sourceNo: r.voucherNo, partyName: r.partyName, journalId: typeof jid === "number" ? jid : null, narration: `Income Receipt ${r.voucherNo}` });
      await tx.receiptTransaction.update({ where: { id }, data: { ...stamp("post"), journalRef: jid ? `RV-${String(jid).padStart(6, "0")}` : null } });
      await tx.receiptAudit.create({ data: { tenantId: ctx.tenantId, receiptId: id, action: "Posted", byUser: ctx.userId, byName: ctx.userName, note } });
    });
  } else if (action === "cancel") { if (r.status === "Posted" || r.status === "Cancelled") throw new Error(`Cannot cancel from "${r.status}" — use reverse for a posted receipt.`); await mutate(id, ctx, stamp("cancel"), "Cancelled", note); }
  else if (action === "reverse") {
    if (r.status !== "Posted") throw new Error("Only a posted receipt can be reversed.");
    await prisma.$transaction(async (tx) => {
      await reverseJournalForSource(tx, ctx.tenantId, "RECEIPT_TXN", id, r.voucherDate, ctx.userId);
      await tx.receiptTransaction.update({ where: { id }, data: stamp("cancel") });
      await tx.receiptAudit.create({ data: { tenantId: ctx.tenantId, receiptId: id, action: "Cancelled", byUser: ctx.userId, byName: ctx.userName, note: note || "Reversed (GL reversed)" } });
    });
  } else throw new Error("Unknown action.");
}

async function mutate(id: number, ctx: Ctx, data: Prisma.ReceiptTransactionUpdateInput, auditAction: string, note?: string) {
  await prisma.$transaction(async (tx) => {
    await tx.receiptTransaction.update({ where: { id }, data });
    await tx.receiptAudit.create({ data: { tenantId: ctx.tenantId, receiptId: id, action: auditAction, byUser: ctx.userId, byName: ctx.userName, note } });
  });
}

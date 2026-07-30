import type { Prisma, Supplier, SupplierAddress } from "@prisma/client";
import type { SupplierRow, SupplierDetail } from "@/lib/contracts/masters";

export const s = (v: unknown) => { const t = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim(); return t ? t : null; };
const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);
const int = (v: unknown) => Math.trunc(num(v));
const bool = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";
const PARTY = ["Supplier", "Expense Party", "Vendor", "Employee"];

/** Map a validated supplier body → Prisma column data (master fields; not addresses/scope). */
export function toSupplierData(b: Record<string, unknown>): Prisma.SupplierUncheckedUpdateInput {
  return {
    name: s(b.name) ?? undefined,
    category: PARTY.includes(String(b.category)) ? String(b.category) : "Supplier",
    status: s(b.status) ?? "Active",
    code: s(b.code), legalName: s(b.legalName), type: s(b.type), website: s(b.website), description: s(b.description),
    contactPerson: s(b.contactPerson), contact1Designation: s(b.contact1Designation), phone: s(b.phone), altMobile: s(b.altMobile), email: s(b.email),
    contact2Name: s(b.contact2Name), contact2Designation: s(b.contact2Designation), contact2Mobile: s(b.contact2Mobile), contact2Email: s(b.contact2Email),
    address: s(b.address), city: s(b.city), state: s(b.state), pincode: s(b.pincode),
    gstin: s(b.gstin), pan: s(b.pan), tan: s(b.tan), stateCode: s(b.stateCode), placeOfSupply: s(b.placeOfSupply), tdsPct: num(b.tdsPct),
    bankName: s(b.bankName), bankBranch: s(b.bankBranch), accountHolder: s(b.accountHolder), accountNumber: s(b.accountNumber), ifsc: s(b.ifsc), accountType: s(b.accountType), upi: s(b.upi),
    creditAllowed: bool(b.creditAllowed), creditLimit: num(b.creditLimit), creditPeriod: int(b.creditPeriod), paymentTerms: s(b.paymentTerms),
    ledgerAccount: s(b.ledgerAccount), advanceAccount: s(b.advanceAccount), purchaseAccount: s(b.purchaseAccount), openingPayable: num(b.openingPayable), openingAdvance: num(b.openingAdvance),
    preferred: bool(b.preferred), approvalStatus: s(b.approvalStatus) ?? "draft", notes: s(b.notes),
  };
}

export function toSupplierAddressRows(tenantId: number, b: Record<string, unknown>): Prisma.SupplierAddressCreateManySupplierInput[] {
  const arr = Array.isArray(b.addresses) ? (b.addresses as Record<string, unknown>[]) : [];
  return arr
    .filter((a) => s(a.line1) || s(a.city) || s(a.pincode))
    .map((a) => ({ tenantId, label: s(a.label) ?? "Other", line1: s(a.line1), line2: s(a.line2), city: s(a.city), district: s(a.district), state: s(a.state), country: s(a.country), pincode: s(a.pincode), isDefault: bool(a.isDefault) }));
}

export function toSupplierRow(r: Supplier): SupplierRow {
  return {
    id: r.id, name: r.name, gstin: r.gstin ?? "", contactPerson: r.contactPerson ?? "", phone: r.phone ?? "",
    email: r.email ?? "", address: r.address ?? "", city: r.city ?? "", state: r.state ?? "", pincode: r.pincode ?? "",
    paymentTerms: r.paymentTerms ?? "", category: r.category, status: r.status,
    code: r.code ?? "", type: r.type ?? "", approvalStatus: r.approvalStatus ?? "draft", preferred: r.preferred, outstanding: num(r.openingPayable),
  };
}

export function toSupplierDetail(r: Supplier, addresses: SupplierAddress[]): SupplierDetail {
  return {
    ...toSupplierRow(r),
    legalName: r.legalName ?? "", website: r.website ?? "", description: r.description ?? "",
    contact1Designation: r.contact1Designation ?? "", altMobile: r.altMobile ?? "", contact2Name: r.contact2Name ?? "", contact2Designation: r.contact2Designation ?? "", contact2Mobile: r.contact2Mobile ?? "", contact2Email: r.contact2Email ?? "",
    pan: r.pan ?? "", tan: r.tan ?? "", stateCode: r.stateCode ?? "", placeOfSupply: r.placeOfSupply ?? "", tdsPct: num(r.tdsPct),
    bankName: r.bankName ?? "", bankBranch: r.bankBranch ?? "", accountHolder: r.accountHolder ?? "", accountNumber: r.accountNumber ?? "", ifsc: r.ifsc ?? "", accountType: r.accountType ?? "", upi: r.upi ?? "",
    creditAllowed: r.creditAllowed, creditLimit: num(r.creditLimit), creditPeriod: r.creditPeriod,
    ledgerAccount: r.ledgerAccount ?? "", advanceAccount: r.advanceAccount ?? "", purchaseAccount: r.purchaseAccount ?? "", openingPayable: num(r.openingPayable), openingAdvance: num(r.openingAdvance),
    notes: r.notes ?? "",
    addresses: addresses.map((a) => ({ id: a.id, label: a.label, line1: a.line1 ?? "", line2: a.line2 ?? "", city: a.city ?? "", district: a.district ?? "", state: a.state ?? "", country: a.country ?? "", pincode: a.pincode ?? "", isDefault: a.isDefault })),
  };
}

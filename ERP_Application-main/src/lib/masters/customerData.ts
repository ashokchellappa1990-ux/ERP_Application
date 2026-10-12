import type { Prisma, Customer, CustomerAddress } from "@prisma/client";
import type { CustomerRow, CustomerDetail } from "@/lib/contracts/masters";

export const s = (v: unknown) => { const t = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim(); return t ? t : null; };
const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v) || 0);
const int = (v: unknown) => Math.trunc(num(v));
const bool = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";

/** Map a validated customer body → Prisma column data (master fields only; not
 * addresses / scope). Used by both create and update. */
export function toCustomerData(b: Record<string, unknown>): Prisma.CustomerUncheckedUpdateInput {
  return {
    name: s(b.name) ?? undefined,
    code: s(b.code), legalName: s(b.legalName), type: s(b.type), category: s(b.category),
    status: s(b.status) ?? "Active", regDate: s(b.regDate), since: s(b.since),
    phone: s(b.phone), email: s(b.email), contactPerson: s(b.contactPerson),
    altMobile: s(b.altMobile), whatsapp: s(b.whatsapp),
    contact2Name: s(b.contact2Name), contact2Mobile: s(b.contact2Mobile), contact2Email: s(b.contact2Email),
    dob: s(b.dob), anniversary: s(b.anniversary), gender: s(b.gender),
    address: s(b.address), city: s(b.city), state: s(b.state), pincode: s(b.pincode),
    gstin: s(b.gstin), pan: s(b.pan), tan: s(b.tan), businessName: s(b.businessName), stateCode: s(b.stateCode),
    creditAllowed: bool(b.creditAllowed), creditLimit: num(b.creditLimit), creditPeriod: int(b.creditPeriod),
    ledgerAccount: s(b.ledgerAccount), advanceAccount: s(b.advanceAccount),
    openingReceivable: num(b.openingReceivable), openingAdvance: num(b.openingAdvance),
    approvalStatus: s(b.approvalStatus) ?? "draft", notes: s(b.notes),
  };
}

/** Address rows to create from a customer body's `addresses` array. */
export function toAddressRows(tenantId: number, b: Record<string, unknown>): Prisma.CustomerAddressCreateManyCustomerInput[] {
  const arr = Array.isArray(b.addresses) ? (b.addresses as Record<string, unknown>[]) : [];
  return arr
    .filter((a) => s(a.line1) || s(a.city) || s(a.pincode))
    .map((a) => ({ tenantId, label: s(a.label) ?? "Other", line1: s(a.line1), line2: s(a.line2), city: s(a.city), district: s(a.district), state: s(a.state), country: s(a.country), pincode: s(a.pincode), isDefault: bool(a.isDefault) }));
}

export function toCustomerRow(c: Customer): CustomerRow {
  return {
    id: c.id, name: c.name, phone: c.phone ?? "", email: c.email ?? "", gstin: c.gstin ?? "",
    dob: c.dob ?? "", anniversary: c.anniversary ?? "", gender: c.gender ?? "",
    address: c.address ?? "", city: c.city ?? "", state: c.state ?? "", pincode: c.pincode ?? "", contactPerson: c.contactPerson ?? "",
    loyaltyPoints: c.loyaltyPoints, totalSpent: num(c.totalSpent),
    code: c.code ?? "", type: c.type ?? "", category: c.category ?? "", status: c.status ?? "Active",
    approvalStatus: c.approvalStatus ?? "draft", creditAllowed: c.creditAllowed, outstanding: num(c.openingReceivable),
  };
}

export function toCustomerDetail(c: Customer, addresses: CustomerAddress[]): CustomerDetail {
  return {
    ...toCustomerRow(c),
    legalName: c.legalName ?? "", regDate: c.regDate ?? "", since: c.since ?? "",
    altMobile: c.altMobile ?? "", whatsapp: c.whatsapp ?? "", contact2Name: c.contact2Name ?? "", contact2Mobile: c.contact2Mobile ?? "", contact2Email: c.contact2Email ?? "",
    pan: c.pan ?? "", tan: c.tan ?? "", businessName: c.businessName ?? "", stateCode: c.stateCode ?? "",
    creditLimit: num(c.creditLimit), creditPeriod: c.creditPeriod,
    ledgerAccount: c.ledgerAccount ?? "", advanceAccount: c.advanceAccount ?? "", openingReceivable: num(c.openingReceivable), openingAdvance: num(c.openingAdvance),
    notes: c.notes ?? "",
    addresses: addresses.map((a) => ({ id: a.id, label: a.label, line1: a.line1 ?? "", line2: a.line2 ?? "", city: a.city ?? "", district: a.district ?? "", state: a.state ?? "", country: a.country ?? "", pincode: a.pincode ?? "", isDefault: a.isDefault })),
  };
}

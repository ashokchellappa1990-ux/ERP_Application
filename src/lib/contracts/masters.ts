import { z } from "zod";

/**
 * Shared contract for the Masters module — suppliers, customers, master values
 * (Category → Sub-category → Group tree + flat brands/manufacturers/suppliers)
 * and the product catalogue.
 *
 * Response DTOs are the single source of truth for the JSON shapes shared by the
 * server routes and the masters client pages/components; the routes annotate
 * their payloads with these types and the client imports the same types instead
 * of re-declaring them (no silent drift).
 *
 * The supplier / customer create bodies are hand-parsed in their routes (no
 * existing domain validator), so a small Zod request schema is provided here.
 * Product create/update is validated by the existing `productSchema`, and the
 * master-value create body keeps its lightweight inline parsing — only a Zod
 * request schema for master values is added here.
 */

export type MasterStatus = "Active" | "Inactive" | "Blocked";

/* ------------------------------------------------------------- suppliers */

const sopt = () => z.string().trim().optional();
export const SupplierAddressSchema = z.object({
  label: sopt(), line1: sopt(), line2: sopt(), city: sopt(), district: sopt(), state: sopt(), country: sopt(), pincode: sopt(),
  isDefault: z.boolean().optional(),
});
export type SupplierAddressInput = z.infer<typeof SupplierAddressSchema>;

export const SupplierCreateSchema = z.object({
  // General
  name: sopt(), code: sopt(), legalName: sopt(), type: sopt(), category: sopt(), status: sopt(), website: sopt(), description: sopt(),
  // Contact
  contactPerson: sopt(), contact1Designation: sopt(), phone: sopt(), altMobile: sopt(), email: sopt(),
  contact2Name: sopt(), contact2Designation: sopt(), contact2Mobile: sopt(), contact2Email: sopt(),
  // Address (registered mirrored onto supplier; full set in `addresses`)
  address: sopt(), city: sopt(), state: sopt(), pincode: sopt(),
  addresses: z.array(SupplierAddressSchema).optional(),
  // GST & tax
  gstin: sopt(), pan: sopt(), tan: sopt(), stateCode: sopt(), placeOfSupply: sopt(), tdsPct: sopt(),
  // Banking
  bankName: sopt(), bankBranch: sopt(), accountHolder: sopt(), accountNumber: sopt(), ifsc: sopt(), accountType: sopt(), upi: sopt(),
  // Credit & payment
  creditAllowed: z.boolean().optional(), creditLimit: sopt(), creditPeriod: sopt(), paymentTerms: sopt(),
  // Accounting
  ledgerAccount: sopt(), advanceAccount: sopt(), purchaseAccount: sopt(), openingPayable: sopt(), openingAdvance: sopt(),
  // Misc
  preferred: z.boolean().optional(), approvalStatus: sopt(), notes: sopt(),
  scopeBranchId: z.union([z.number(), z.literal("all")]).optional(),
});
export type SupplierCreateInput = z.infer<typeof SupplierCreateSchema>;

export interface SupplierRow {
  id: number;
  name: string;
  gstin: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  paymentTerms: string;
  category: string;
  status: string;
  // Master fields (additive — purchase supplier search ignores extras).
  code: string;
  type: string;
  approvalStatus: string;
  preferred: boolean;
  outstanding: number;
}
export interface SupplierListResponse {
  ok: true;
  suppliers: SupplierRow[];
}

export interface SupplierAddressRow extends SupplierAddressInput { id: number }
export interface SupplierDetail extends SupplierRow {
  legalName: string; website: string; description: string;
  contact1Designation: string; altMobile: string; contact2Name: string; contact2Designation: string; contact2Mobile: string; contact2Email: string;
  pan: string; tan: string; stateCode: string; placeOfSupply: string; tdsPct: number;
  bankName: string; bankBranch: string; accountHolder: string; accountNumber: string; ifsc: string; accountType: string; upi: string;
  creditAllowed: boolean; creditLimit: number; creditPeriod: number;
  ledgerAccount: string; advanceAccount: string; purchaseAccount: string; openingPayable: number; openingAdvance: number;
  notes: string;
  addresses: SupplierAddressRow[];
}

/* ------------------------------------------------------------- customers */

const opt = () => z.string().trim().optional();
export const CustomerAddressSchema = z.object({
  label: opt(), line1: opt(), line2: opt(), city: opt(), district: opt(), state: opt(), country: opt(), pincode: opt(),
  isDefault: z.boolean().optional(),
});
export type CustomerAddressInput = z.infer<typeof CustomerAddressSchema>;

export const CustomerCreateSchema = z.object({
  // General
  name: opt(), code: opt(), legalName: opt(), type: opt(), category: opt(), status: opt(), regDate: opt(), since: opt(),
  // Contact
  phone: opt(), email: opt(), contactPerson: opt(), altMobile: opt(), whatsapp: opt(),
  contact2Name: opt(), contact2Mobile: opt(), contact2Email: opt(),
  dob: opt(), anniversary: opt(), gender: opt(),
  // Address (primary/billing mirrored onto customer; full set in `addresses`)
  address: opt(), city: opt(), state: opt(), pincode: opt(),
  addresses: z.array(CustomerAddressSchema).optional(),
  // GST & tax
  gstin: opt(), pan: opt(), tan: opt(), businessName: opt(), stateCode: opt(),
  // Credit
  creditAllowed: z.boolean().optional(), creditLimit: opt(), creditPeriod: opt(),
  // Accounting
  ledgerAccount: opt(), advanceAccount: opt(), openingReceivable: opt(), openingAdvance: opt(),
  // Misc
  approvalStatus: opt(), notes: opt(),
  scopeBranchId: z.union([z.number(), z.literal("all")]).optional(),
});
export type CustomerCreateInput = z.infer<typeof CustomerCreateSchema>;

export interface CustomerRow {
  id: number;
  name: string;
  phone: string;
  email: string;
  gstin: string;
  dob: string;
  anniversary: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPerson: string;
  loyaltyPoints: number;
  totalSpent: number;
  // Master fields (additive — POS search ignores extras).
  code: string;
  type: string;
  category: string;
  status: string;
  approvalStatus: string;
  creditAllowed: boolean;
  outstanding: number;
}
export interface CustomerListResponse {
  ok: true;
  customers: CustomerRow[];
}

export interface CustomerAddressRow extends CustomerAddressInput { id: number }
export interface CustomerDetail extends CustomerRow {
  legalName: string; regDate: string; since: string;
  altMobile: string; whatsapp: string; contact2Name: string; contact2Mobile: string; contact2Email: string;
  pan: string; tan: string; businessName: string; stateCode: string;
  creditLimit: number; creditPeriod: number;
  ledgerAccount: string; advanceAccount: string; openingReceivable: number; openingAdvance: number;
  notes: string;
  addresses: CustomerAddressRow[];
}

/* --------------------------------------------------------- master values */

export const MASTER_VALUE_TYPES = ["category", "subCategory", "group", "brand", "manufacturer", "supplier"] as const;
export type MasterValueType = (typeof MASTER_VALUE_TYPES)[number];

export const MasterValueCreateSchema = z.object({
  type: z.string().trim().optional(),
  value: z.string().trim().optional(),
  parentId: z.number().nullable().optional(),
  scopeBranchId: z.union([z.number(), z.literal("all")]).optional(),
});
export type MasterValueCreateInput = z.infer<typeof MasterValueCreateSchema>;

export interface MasterTreeGroup {
  id: number;
  value: string;
}
export interface MasterTreeSub {
  id: number;
  value: string;
  groups: MasterTreeGroup[];
}
export interface MasterTreeCat {
  id: number;
  value: string;
  subCategories: MasterTreeSub[];
}
export interface MasterTree {
  categories: MasterTreeCat[];
  brands: string[];
  manufacturers: string[];
  suppliers: string[];
}
export interface MasterValuesResponse {
  ok: true;
  tree: MasterTree;
}

/* ------------------------------------------------------------- products */

export interface ProductVariantRow {
  id: number;
  name: string;
  code: string;
  sku: string;
  barcode: string;
  mrp: number;
  stock: number;
  status: MasterStatus;
  invBatch: boolean;
  invMfg: boolean;
  invExpiry: boolean;
  invSerial: boolean;
  qrRequired: boolean;
}
export interface ProductRow {
  id: number;
  code: string;
  name: string;
  category: string;
  brand: string;
  uom: string;
  mrp: number;
  stock: number;
  reorder: number;
  status: MasterStatus;
  gst: string;
  invBatch: boolean;
  invMfg: boolean;
  invExpiry: boolean;
  invSerial: boolean;
  qrRequired: boolean;
  variantCount: number;
  variants: ProductVariantRow[];
}
export interface ProductListStats {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
  lowStock: number;
  nearExpiry: number;
  newAdded: number;
}
export interface ProductListResponse {
  ok: true;
  rows: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: ProductListStats;
}

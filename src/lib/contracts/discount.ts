import { z } from "zod";

/**
 * Discount Management contracts — the centralized discount engine's request/DTO
 * shapes. Sales/POS resolves all discounts from this module (no hardcoded logic).
 */

/* -------------------------------------------------------- vocabularies -- */
export const DISCOUNT_TYPES = [
  "Percentage", "Flat Amount", "Fixed Selling Price", "Buy X Get Y", "Buy X Get Discount",
  "Category", "Sub Category", "Brand", "Product", "Department", "Manufacturer",
  "Customer", "Customer Group", "Membership", "Loyalty Redemption", "Coupon", "Promo Code",
  "Gift Voucher", "Festival", "Birthday", "Anniversary", "Happy Hour", "Weekend", "Weekday",
  "First Purchase", "Nth Purchase", "Quantity", "Volume", "Bulk Purchase", "Cash",
  "Employee", "Corporate", "Referral", "Seasonal", "Clearance", "Bundle", "Combo",
  "Invoice Level", "Line Item", "Manual", "Manager Override",
] as const;
export type DiscountTypeName = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_CATEGORIES = ["Standard", "Promotional", "Festival", "Clearance", "Loyalty", "Membership", "Employee", "Corporate", "Seasonal", "Wholesale"] as const;

/**
 * Per-type metadata — a short description + which value form the editor shows, and the
 * default calculation method. `form`: percent | flat | fixed | buyget | buygetdisc | qty | external.
 */
export type DiscountForm = "percent" | "flat" | "fixed" | "buyget" | "buygetdisc" | "qty" | "external";
export const DISCOUNT_TYPE_META: Record<string, { form: DiscountForm; method: "percentage" | "flat" | "fixed_price"; desc: string }> = {
  "Percentage": { form: "percent", method: "percentage", desc: "A percentage off the price. Base can be MRP (incl. tax) or the material value (pre-tax)." },
  "Flat Amount": { form: "flat", method: "flat", desc: "A fixed ₹ amount off the bill or line." },
  "Fixed Selling Price": { form: "fixed", method: "fixed_price", desc: "Mark the item down to a fixed selling price per unit." },
  "Buy X Get Y": { form: "buyget", method: "percentage", desc: "Buy N units of a product and get M units of another (or the same) free." },
  "Buy X Get Discount": { form: "buygetdisc", method: "percentage", desc: "Buy N qualifying units and get a % / ₹ discount on the order." },
  "Category": { form: "percent", method: "percentage", desc: "Discount on items in the selected product categories." },
  "Sub Category": { form: "percent", method: "percentage", desc: "Discount on items in the selected sub-categories (configure via categories)." },
  "Brand": { form: "percent", method: "percentage", desc: "Discount on items of the selected brands." },
  "Product": { form: "percent", method: "percentage", desc: "Discount on the specific selected products." },
  "Department": { form: "percent", method: "percentage", desc: "Discount on items in the selected departments (via categories)." },
  "Manufacturer": { form: "percent", method: "percentage", desc: "Manufacturer-sponsored discount on the selected brands/products." },
  "Customer": { form: "percent", method: "percentage", desc: "Discount for a specific customer." },
  "Customer Group": { form: "percent", method: "percentage", desc: "Discount for customers in the selected groups (e.g. Wholesale)." },
  "Membership": { form: "percent", method: "percentage", desc: "Discount for members of the selected membership levels." },
  "Loyalty Redemption": { form: "flat", method: "flat", desc: "Discount funded by redeeming loyalty points (handled by the Loyalty module at POS)." },
  "Coupon": { form: "external", method: "percentage", desc: "Coupons are managed in the Coupon module — validated & applied at billing." },
  "Promo Code": { form: "external", method: "percentage", desc: "Promo codes are managed in the Promo Code module — validated at billing." },
  "Gift Voucher": { form: "external", method: "flat", desc: "Gift vouchers are stored-value tenders — managed in the Gift Voucher module." },
  "Festival": { form: "percent", method: "percentage", desc: "Time-bound festival offer (set the validity dates/period)." },
  "Birthday": { form: "percent", method: "percentage", desc: "Discount on the customer's birthday (eligibility → Birthday)." },
  "Anniversary": { form: "percent", method: "percentage", desc: "Discount on the customer's anniversary (eligibility → Anniversary)." },
  "Happy Hour": { form: "percent", method: "percentage", desc: "Discount during set hours (set Start/End time in Validity)." },
  "Weekend": { form: "percent", method: "percentage", desc: "Weekend-only discount (Validity → Weekends only)." },
  "Weekday": { form: "percent", method: "percentage", desc: "Weekday-only discount (Validity → Weekdays only)." },
  "First Purchase": { form: "percent", method: "percentage", desc: "Discount on a customer's first purchase (eligibility)." },
  "Nth Purchase": { form: "percent", method: "percentage", desc: "Discount on a milestone purchase count (eligibility)." },
  "Quantity": { form: "qty", method: "percentage", desc: "Discount when the quantity crosses a minimum threshold." },
  "Volume": { form: "qty", method: "percentage", desc: "Volume-slab discount based on quantity." },
  "Bulk Purchase": { form: "qty", method: "percentage", desc: "Discount for bulk quantities (set the minimum quantity)." },
  "Cash": { form: "flat", method: "flat", desc: "Cash-payment discount (Applicability → Payment mode = Cash)." },
  "Employee": { form: "percent", method: "percentage", desc: "Staff discount (eligibility → Employees only)." },
  "Corporate": { form: "percent", method: "percentage", desc: "Corporate customer discount (eligibility → Corporate only)." },
  "Referral": { form: "percent", method: "percentage", desc: "Referral reward discount." },
  "Seasonal": { form: "percent", method: "percentage", desc: "Seasonal offer (set validity period)." },
  "Clearance": { form: "percent", method: "percentage", desc: "Clearance markdown on the selected items." },
  "Bundle": { form: "flat", method: "flat", desc: "Fixed price/amount off when a bundle of items is bought." },
  "Combo": { form: "flat", method: "flat", desc: "Combo offer — fixed amount off the combo." },
  "Invoice Level": { form: "percent", method: "percentage", desc: "Discount on the whole invoice (bill level)." },
  "Line Item": { form: "percent", method: "percentage", desc: "Discount applied per line item (line level)." },
  "Manual": { form: "percent", method: "percentage", desc: "Manually entered discount at billing (cap the max here)." },
  "Manager Override": { form: "percent", method: "percentage", desc: "Manager-approved override discount (set approval + limits)." },
};
export const typeMeta = (t: string) => DISCOUNT_TYPE_META[t] ?? { form: "percent" as DiscountForm, method: "percentage" as const, desc: "Percentage / amount discount." };
export const DISCOUNT_METHODS = ["percentage", "flat", "fixed_price", "per_unit"] as const;
/** Base a % discount is computed on: MRP incl. tax, or the material value (pre-tax). */
export const DISCOUNT_BASES = ["inclusive", "exclusive"] as const;
export const DISCOUNT_STATUSES = ["Draft", "Active", "Inactive", "Expired"] as const;
export const APPLY_LEVELS = ["bill", "line"] as const;
export const GST_TIMINGS = ["before", "after"] as const;
export const CHANNELS = ["POS", "Wholesale", "Online", "Mobile App", "WhatsApp", "Marketplace"] as const;
export const PAYMENT_MODES = ["Cash", "Card", "UPI", "Wallet", "Credit", "Gift Voucher"] as const;
/** The engine resolves the single best discount in this precedence order. */
export const PRIORITY_CHAIN = ["Membership", "Loyalty", "Coupon", "Promo Code", "Gift Voucher", "Manual", "Manager"] as const;

/* --------------------------------------------------------------- rows --- */
export interface DiscountRow {
  id: number; code: string; name: string; description: string; category: string;
  discountType: string; method: string; applyLevel: string; value: number;
  maxDiscount: number; minDiscount: number; priority: number; status: string;
  startDate: string; endDate: string; minBill: number; usageCount: number;
  totalGiven: number; combinable: boolean; requiresApproval: boolean;
  approvedByName: string; createdByName: string;
}

export interface DiscountDetail extends DiscountRow {
  startTime: string; endTime: string; maxBill: number; minQty: number;
  buyProductId: number | null; buyQty: number; getProductId: number | null; getQty: number;
  gstTiming: string; discountBase: string; reduceTaxable: boolean; discountAccount: string; campaignId: number | null;
  applicability: Record<string, unknown>;
  eligibility: Record<string, unknown>;
  validity: Record<string, unknown>;
  combination: Record<string, unknown>;
  approval: Record<string, unknown>;
}

/* ------------------------------------------------------------ schemas --- */
const jsonObj = z.record(z.string(), z.unknown()).optional();

export const DiscountSchema = z.object({
  code: z.string().trim().max(40).optional(),
  name: z.string().trim().min(2, "Name is required.").max(150),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(40).default("Standard"),
  discountType: z.string().trim().min(1, "Discount type is required.").max(48),
  method: z.enum(DISCOUNT_METHODS).default("percentage"),
  applyLevel: z.enum(APPLY_LEVELS).default("bill"),
  value: z.coerce.number().nonnegative().default(0),
  maxDiscount: z.coerce.number().nonnegative().default(0),
  minDiscount: z.coerce.number().nonnegative().default(0),
  priority: z.coerce.number().int().min(1).max(9999).default(100),
  status: z.enum(DISCOUNT_STATUSES).default("Draft"),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  startTime: z.string().trim().max(8).optional(),
  endTime: z.string().trim().max(8).optional(),
  minBill: z.coerce.number().nonnegative().default(0),
  maxBill: z.coerce.number().nonnegative().default(0),
  minQty: z.coerce.number().int().nonnegative().default(0),
  buyProductId: z.coerce.number().int().optional().nullable(),
  buyQty: z.coerce.number().int().nonnegative().default(0),
  getProductId: z.coerce.number().int().optional().nullable(),
  getQty: z.coerce.number().int().nonnegative().default(0),
  applicability: jsonObj,
  eligibility: jsonObj,
  validity: jsonObj,
  combination: jsonObj,
  approval: jsonObj,
  discountAccount: z.string().trim().max(20).optional(),
  gstTiming: z.enum(GST_TIMINGS).default("after"),
  discountBase: z.enum(DISCOUNT_BASES).default("inclusive"),
  reduceTaxable: z.boolean().default(true),
  combinable: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  campaignId: z.coerce.number().int().optional().nullable(),
});
export type DiscountInput = z.infer<typeof DiscountSchema>;

/* --------------------------------------------------------- configuration */
export interface DiscountConfig {
  enableModule: boolean; codePrefix: string; codeLength: number; runningNumber: number;
  priorityOrder: string[]; gstDefault: string; roundOff: boolean;
  discountAccount: string; promoAccount: string; autoApply: boolean;
}
export const DiscountConfigSchema = z.object({
  enableModule: z.boolean().default(true),
  codePrefix: z.string().trim().max(20).default("DISC"),
  codeLength: z.coerce.number().int().min(3).max(10).default(5),
  priorityOrder: z.array(z.string()).default([...PRIORITY_CHAIN]),
  gstDefault: z.enum(GST_TIMINGS).default("after"),
  roundOff: z.boolean().default(true),
  discountAccount: z.string().trim().max(20).default("3060"),
  promoAccount: z.string().trim().max(20).default("4210"),
  autoApply: z.boolean().default(true),
});
export type DiscountConfigInput = z.infer<typeof DiscountConfigSchema>;

/* ---------------------------------------------------------- simulation -- */
export const SimulateSchema = z.object({
  billAmount: z.coerce.number().nonnegative().default(0),
  customerId: z.coerce.number().int().optional().nullable(),
  customerGroup: z.string().trim().optional(),
  membershipLevel: z.string().trim().optional(),
  channel: z.string().trim().default("POS"),
  paymentMode: z.string().trim().optional(),
  date: z.string().trim().optional(),
  time: z.string().trim().optional(),
  items: z.array(z.object({
    productId: z.coerce.number().int().optional().nullable(),
    category: z.string().trim().optional(),
    brand: z.string().trim().optional(),
    qty: z.coerce.number().default(1),
    amount: z.coerce.number().default(0),
  })).default([]),
  flags: z.record(z.string(), z.boolean()).optional(),
}).passthrough();
export type SimulateInput = z.infer<typeof SimulateSchema>;

export interface AccountRef { code: string; name: string }

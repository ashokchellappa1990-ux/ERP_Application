import { z } from "zod";

/** Coupon Campaign & Promotion Management — contracts (coupons only). */

export const COUPON_TYPES = ["Generic", "Unique"] as const;
export const CAMPAIGN_STATUS = ["Draft", "Active", "Paused", "Expired", "Cancelled"] as const;
export const COUPON_STATUS = ["Generated", "Printed", "Issued", "Redeemed", "Expired", "Cancelled"] as const;
export const DISCOUNT_TYPES = ["Flat", "Percentage", "BillDiscount", "ProductDiscount", "CategoryDiscount", "BrandDiscount", "BuyXGetY", "BuyXGetSame", "FreeProduct", "FreeQuantity", "Combo", "Bundle", "Slab"] as const;
export const USAGE_TYPES = ["SingleUse", "MultipleUse", "Reusable", "Unlimited"] as const;
export const GST_RULES = ["BeforeGST", "AfterGST"] as const;
export const CUSTOMER_MAPPING = ["Mandatory", "Optional", "NotRequired"] as const;
export const CONDITION_TYPES = ["Product", "Category", "Brand", "Customer", "CustomerGroup", "Channel", "Payment", "Branch", "Warehouse", "Terminal", "Region", "State", "LoyaltyTier", "Membership", "CustomerType"] as const;
export const ISSUE_TO = ["Customer", "Employee", "WalkIn", "Campaign", "Bulk"] as const;
export const CHANNELS = ["POS", "Online", "Mobile", "Wholesale", "B2B", "B2C"] as const;
export const PAYMENT_MODES = ["Cash", "UPI", "Card", "Wallet", "Cheque", "Bank", "NetBanking"] as const;
export const PRINT_FORMATS = ["PDF", "A4", "Thermal", "Card", "Label"] as const;
export const BATCH_SIZES = [1, 100, 500, 1000, 5000, 10000] as const;

export type DiscountType = (typeof DISCOUNT_TYPES)[number];

// ---------------------------------------------------------------- configuration

export interface CouponConfig {
  enableModule: boolean; enableGeneric: boolean; enableUnique: boolean; enableQr: boolean; enableBarcode: boolean;
  enableCustomerMapping: boolean; customerMapping: (typeof CUSTOMER_MAPPING)[number]; enableMultiPerInvoice: boolean;
  allowWithLoyalty: boolean; allowWithMembership: boolean; allowWithPromo: boolean; allowWithManual: boolean;
  allowReturnRestore: boolean; allowCancelRestore: boolean; enableApproval: boolean; enablePrinting: boolean;
  enableDesigner: boolean; enableBatchGen: boolean;
  couponPrefix: string; couponLength: number; runningNumber: number; qrSize: number; barcodeType: string; defaultStatus: string;
}
const b = z.boolean();
export const CouponConfigSchema = z.object({
  enableModule: b, enableGeneric: b, enableUnique: b, enableQr: b, enableBarcode: b, enableCustomerMapping: b,
  customerMapping: z.enum(CUSTOMER_MAPPING), enableMultiPerInvoice: b, allowWithLoyalty: b, allowWithMembership: b, allowWithPromo: b,
  allowWithManual: b, allowReturnRestore: b, allowCancelRestore: b, enableApproval: b, enablePrinting: b, enableDesigner: b, enableBatchGen: b,
  couponPrefix: z.string().trim().max(20), couponLength: z.coerce.number().int().min(4).max(30), qrSize: z.coerce.number().int().min(40).max(400),
  barcodeType: z.string().trim().max(20), defaultStatus: z.string().trim().max(12),
});
export type CouponConfigInput = z.infer<typeof CouponConfigSchema>;

// ------------------------------------------------------------------- campaign

export interface CampaignRow {
  id: number; code: string; name: string; campaignType: string; priority: number; couponType: string;
  status: string; startDate: string; endDate: string; marketingBudget: number; couponCount: number; redeemedCount: number; createdByName: string;
}

export const CampaignSchema = z.object({
  code: z.string().trim().min(1, "Campaign code is required.").max(40),
  name: z.string().trim().min(1, "Campaign name is required.").max(150),
  description: z.string().trim().max(500).optional(),
  campaignType: z.string().trim().max(30).optional(),
  priority: z.coerce.number().int().optional(),
  couponType: z.enum(COUPON_TYPES),
  status: z.enum(CAMPAIGN_STATUS).optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  marketingBudget: z.coerce.number().nonnegative().optional(),
  remarks: z.string().trim().max(500).optional(),
});
export type CampaignInput = z.infer<typeof CampaignSchema>;

// ---------------------------------------------------------------------- rule

export const RuleConditionSchema = z.object({ condType: z.enum(CONDITION_TYPES), operator: z.enum(["in", "not_in", "eq", "gte", "lte"]).optional(), valueJson: z.string() });
export const RuleActionSchema = z.object({ actionType: z.string().trim().max(24), valueJson: z.string() });

export const RuleSchema = z.object({
  name: z.string().trim().min(1, "Rule name is required.").max(150),
  discountType: z.enum(DISCOUNT_TYPES),
  discountValue: z.coerce.number().nonnegative().optional(),
  maxDiscount: z.coerce.number().nonnegative().optional(),
  minDiscount: z.coerce.number().nonnegative().optional(),
  minBill: z.coerce.number().nonnegative().optional(),
  maxBill: z.coerce.number().nonnegative().optional(),
  minQty: z.coerce.number().nonnegative().optional(),
  maxQty: z.coerce.number().nonnegative().optional(),
  minProductCount: z.coerce.number().int().nonnegative().optional(),
  maxProductCount: z.coerce.number().int().nonnegative().optional(),
  buyProductId: z.coerce.number().int().positive().optional(),
  buyQty: z.coerce.number().nonnegative().optional(),
  getProductId: z.coerce.number().int().positive().optional(),
  getQty: z.coerce.number().nonnegative().optional(),
  sameProduct: z.boolean().optional(),
  gstRule: z.enum(GST_RULES).optional(),
  reduceTaxable: z.boolean().optional(),
  salesDiscountCode: z.string().trim().optional(),
  marketingExpenseCode: z.string().trim().optional(),
  costCenter: z.string().trim().optional(),
  department: z.string().trim().optional(),
  project: z.string().trim().optional(),
  maxPerCustomer: z.coerce.number().int().nonnegative().optional(),
  maxPerInvoice: z.coerce.number().int().nonnegative().optional(),
  maxPerDay: z.coerce.number().int().nonnegative().optional(),
  maxPerCampaign: z.coerce.number().int().nonnegative().optional(),
  usageType: z.enum(USAGE_TYPES).optional(),
  startTime: z.string().trim().optional(),
  endTime: z.string().trim().optional(),
  days: z.string().trim().optional(),
  active: z.boolean().optional(),
  conditions: z.array(RuleConditionSchema).optional(),
  actions: z.array(RuleActionSchema).optional(),
});
export type RuleInput = z.infer<typeof RuleSchema>;

export interface RuleConditionRow { id: number; condType: string; operator: string; valueJson: string }
export interface RuleRow {
  id: number; campaignId: number; name: string; discountType: string; discountValue: number; maxDiscount: number;
  minBill: number; usageType: string; active: boolean; conditions: RuleConditionRow[]; actions: { id: number; actionType: string; valueJson: string }[];
  gstRule: string; reduceTaxable: boolean; salesDiscountCode: string; marketingExpenseCode: string;
  maxPerCustomer: number; maxPerInvoice: number; maxPerDay: number; maxPerCampaign: number;
  minQty: number; minProductCount: number;
}

// ------------------------------------------------------------------ generation

export const GenerateSchema = z.object({
  campaignId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(50000),
  expiryDate: z.string().trim().optional(),
  customerId: z.coerce.number().int().positive().optional(),   // for a single customer-specific coupon
});
export type GenerateInput = z.infer<typeof GenerateSchema>;

export interface CouponRow {
  id: number; couponNo: string; couponCode: string; campaignName: string; status: string;
  customerName: string; expiryDate: string; qrData: string; barcodeData: string; securityCode: string; batchNo: string;
}

// --------------------------------------------------------------------- issue

export const IssueSchema = z.object({
  couponId: z.coerce.number().int().positive().optional(),
  couponNo: z.string().trim().optional(),
  issueTo: z.enum(ISSUE_TO),
  customerId: z.coerce.number().int().positive().optional(),
  partyName: z.string().trim().max(200).optional(),
  issueDate: z.string().trim().optional(),
  remarks: z.string().trim().max(300).optional(),
});
export type IssueInput = z.infer<typeof IssueSchema>;

// ------------------------------------------------------------------- redemption

export const RedeemItemSchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  qty: z.coerce.number().nonnegative().optional(),
  amount: z.coerce.number().nonnegative(),   // line taxable/net amount
});
export const ValidateSchema = z.object({
  couponCode: z.string().trim().min(1, "Enter a coupon number/code."),
  billAmount: z.coerce.number().nonnegative(),
  customerId: z.coerce.number().int().positive().optional(),
  channel: z.string().trim().optional(),
  paymentMode: z.string().trim().optional(),
  date: z.string().trim().optional(),
  items: z.array(RedeemItemSchema).optional(),
});
export type ValidateInput = z.infer<typeof ValidateSchema>;

export const RedeemSchema = ValidateSchema.extend({
  saleId: z.coerce.number().int().positive().optional(),
  invoiceNo: z.string().trim().optional(),
  post: z.boolean().optional(),    // post the GL discount voucher
});
export type RedeemInput = z.infer<typeof RedeemSchema>;

export interface ValidateResult {
  valid: boolean; reason: string; couponId: number | null; campaignName: string;
  discountType: string; discountAmount: number; taxableReduced: number; gstRule: string;
  freeProductId: number | null; freeQty: number;
}

// --------------------------------------------------------------------- print

export const PrintSchema = z.object({
  couponIds: z.array(z.coerce.number().int().positive()).optional(),
  batchId: z.coerce.number().int().positive().optional(),
  templateId: z.coerce.number().int().positive().optional(),
  format: z.enum(PRINT_FORMATS).optional(),
  perPage: z.coerce.number().int().optional(),
  reprint: z.boolean().optional(),
});
export type PrintInput = z.infer<typeof PrintSchema>;

// ---------------------------------------------------------------------- meta

export interface AccountRef { code: string; name: string; type: string }
export interface CouponMeta { config: CouponConfig; accounts: AccountRef[] }

// ------------------------------------------------------------------- designer

export const TEMPLATE_CATEGORIES = ["Retail", "Pharmacy", "Supermarket", "Electronics", "Fashion", "Generic"] as const;
export const OBJECT_TYPES = ["text", "qr", "barcode", "image", "divider"] as const;
export const PLACEHOLDERS = ["{CompanyName}", "{BranchName}", "{CampaignName}", "{CouponNumber}", "{CouponCode}", "{Discount}", "{CustomerName}", "{IssueDate}", "{ExpiryDate}", "{Terms}", "{GeneratedDate}"] as const;

export interface TemplateObject {
  id: string; type: (typeof OBJECT_TYPES)[number]; x: number; y: number; w: number; h: number; rotation: number;
  text?: string; font?: string; size?: number; color?: string; bold?: boolean; italic?: boolean; align?: "left" | "center" | "right";
  bgColor?: string; src?: string;
}
export interface TemplateLayout {
  width: number; height: number; bg: string; bgImage?: string; border: string; borderWidth: number; borderRadius: number; objects: TemplateObject[];
}
export interface CouponTemplateRow { id: number; name: string; category: string; layout: TemplateLayout; isSystem: boolean; active: boolean }

export const TemplateSaveSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "Template name is required.").max(120),
  category: z.string().trim().max(20).optional(),
  layout: z.string().min(2),   // JSON string of TemplateLayout
});
export type TemplateSaveInput = z.infer<typeof TemplateSaveSchema>;

export const RenderPrintSchema = z.object({
  couponIds: z.array(z.coerce.number().int().positive()).min(1),
  templateId: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().optional(),
});
export type RenderPrintInput = z.infer<typeof RenderPrintSchema>;

/** Data injected into placeholders when a coupon is printed. */
export interface CouponRenderData {
  CompanyName: string; BranchName: string; CampaignName: string; CouponNumber: string; CouponCode: string;
  Discount: string; CustomerName: string; IssueDate: string; ExpiryDate: string; Terms: string; GeneratedDate: string;
  qrData: string; barcodeData: string; securityCode: string;
}
export interface CouponAuditRow { id: number; entityType: string; action: string; byName: string; note: string; at: string }
export interface CouponDashboard {
  activeCampaigns: number; generated: number; printed: number; issued: number; redeemed: number; expired: number; cancelled: number;
  totalDiscount: number; topCampaigns: { name: string; redeemed: number; discount: number }[]; monthlyRedemption: { name: string; value: number }[];
}

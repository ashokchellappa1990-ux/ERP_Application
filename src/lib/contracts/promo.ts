import { z } from "zod";
// Reuse the shared promotion rule contracts (single rule engine + rule tables).
export {
  DISCOUNT_TYPES, USAGE_TYPES, GST_RULES, CONDITION_TYPES, PAYMENT_MODES, CHANNELS,
  RuleConditionSchema, RuleActionSchema, RuleSchema,
} from "@/lib/contracts/coupon";
export type { DiscountType, RuleInput, RuleRow, RuleConditionRow } from "@/lib/contracts/coupon";

/** Promo Code Management — contracts (digital promotional codes). */

export const PROMO_CODE_TYPES = ["Public", "Private", "CustomerSpecific"] as const;
export const GENERATION_TYPES = ["Manual", "Auto"] as const;
export const PROMO_CODE_STATUS = ["Active", "Issued", "Redeemed", "Expired", "Cancelled"] as const;
export const PROMO_CAMPAIGN_STATUS = ["Draft", "Active", "Paused", "Expired", "Cancelled", "Closed"] as const;
export const PROMO_CAMPAIGN_TYPES = ["Digital", "Festival", "Seasonal", "Referral", "Launch", "Winback"] as const;
export const PROMO_CUSTOMER_MAPPING = ["Mandatory", "Optional", "Public"] as const;
export const DISTRIBUTION_CHANNELS = ["SMS", "WhatsApp", "Email", "Push", "Website", "QR", "Event", "SocialMedia", "App"] as const;
export const DELIVERY_STATUS = ["Pending", "Sent", "Delivered", "Failed", "Opened"] as const;
export const CONFLICT_RESOLUTION = ["HighestDiscount", "HighestPriority", "FirstApplied", "Exclusive"] as const;
export const CODE_MODELS = ["SameCode", "DifferentCodes"] as const;
export const CODE_MODEL_LABELS: Record<(typeof CODE_MODELS)[number], string> = { SameCode: "Same Code — one shared code, once per customer", DifferentCodes: "Different Codes — unique code per customer" };

const b = z.boolean();

// ---------------------------------------------------------------- configuration

export interface PromoConfig {
  enableModule: boolean; enableManualCode: boolean; enableAutoCode: boolean; enableBulkGen: boolean; enableCustomerMapping: boolean;
  customerMapping: (typeof PROMO_CUSTOMER_MAPPING)[number]; enableApproval: boolean; enableAnalytics: boolean;
  enableExpiryNotify: boolean; enableUsageNotify: boolean; enableMultiPerInvoice: boolean;
  allowWithLoyalty: boolean; allowWithMembership: boolean; allowWithCoupon: boolean; allowWithManual: boolean; allowWithGiftVoucher: boolean;
  allowReturnRestore: boolean; allowCancelRestore: boolean;
  priority: number; conflictResolution: (typeof CONFLICT_RESOLUTION)[number];
  codeModel: (typeof CODE_MODELS)[number];
  codePrefix: string; codeLength: number; runningNumber: number; defaultStatus: string;
}
export const PromoConfigSchema = z.object({
  enableModule: b, enableManualCode: b, enableAutoCode: b, enableBulkGen: b, enableCustomerMapping: b,
  customerMapping: z.enum(PROMO_CUSTOMER_MAPPING), enableApproval: b, enableAnalytics: b, enableExpiryNotify: b, enableUsageNotify: b,
  enableMultiPerInvoice: b, allowWithLoyalty: b, allowWithMembership: b, allowWithCoupon: b, allowWithManual: b, allowWithGiftVoucher: b,
  allowReturnRestore: b, allowCancelRestore: b,
  priority: z.coerce.number().int().optional(), conflictResolution: z.enum(CONFLICT_RESOLUTION), codeModel: z.enum(CODE_MODELS),
  codePrefix: z.string().trim().max(20), codeLength: z.coerce.number().int().min(4).max(30), defaultStatus: z.string().trim().max(12),
});
export type PromoConfigInput = z.infer<typeof PromoConfigSchema>;

// ------------------------------------------------------------------- campaign

export interface PromoCampaignRow {
  id: number; code: string; name: string; campaignType: string; priority: number; campaignOwner: string;
  status: string; startDate: string; endDate: string; marketingBudget: number; codeCount: number; redeemedCount: number; createdByName: string;
}
export const PromoCampaignSchema = z.object({
  code: z.string().trim().min(1, "Campaign code is required.").max(40),
  name: z.string().trim().min(1, "Campaign name is required.").max(150),
  description: z.string().trim().max(500).optional(),
  campaignType: z.string().trim().max(30).optional(),
  marketingBudget: z.coerce.number().nonnegative().optional(),
  campaignOwner: z.string().trim().max(200).optional(),
  priority: z.coerce.number().int().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  status: z.enum(PROMO_CAMPAIGN_STATUS).optional(),
  remarks: z.string().trim().max(500).optional(),
});
export type PromoCampaignInput = z.infer<typeof PromoCampaignSchema>;

// ----------------------------------------------------------------- code master

export interface PromoCodeRow {
  id: number; promoCode: string; name: string; campaignName: string; codeType: string; generationType: string;
  status: string; customerName: string; expiryDate: string; redeemedCount: number; distributedCount: number; batchNo: string;
}

/** Generate one or many promo codes (auto or a single manual code). */
export const PromoGenerateSchema = z.object({
  campaignId: z.coerce.number().int().positive(),
  codeModel: z.enum(CODE_MODELS).optional(),   // defaults to the configured model
  generationType: z.enum(GENERATION_TYPES).optional(),
  manualCode: z.string().trim().max(60).optional(),   // required when generationType = Manual
  quantity: z.coerce.number().int().min(1).max(50000).optional(),
  codeType: z.enum(PROMO_CODE_TYPES).optional(),
  name: z.string().trim().max(150).optional(),
  description: z.string().trim().max(400).optional(),
  prefix: z.string().trim().max(20).optional(),
  suffix: z.string().trim().max(20).optional(),
  expiryDate: z.string().trim().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  usageLimit: z.coerce.number().int().nonnegative().optional(),
});
export type PromoGenerateInput = z.infer<typeof PromoGenerateSchema>;

// ---------------------------------------------------------------- distribution

export interface PromoDistributionRow {
  id: number; distributionDate: string; channel: string; recipient: string; recipientContact: string;
  campaignName: string; promoCode: string; deliveryStatus: string; remarks: string; sentByName: string;
  audience: string; recipientCount: number; messageBody: string; bannerImage: string;
}
export const DistributionSchema = z.object({
  campaignId: z.coerce.number().int().positive(),
  promoCodeId: z.coerce.number().int().positive().optional(),
  channel: z.enum(DISTRIBUTION_CHANNELS),
  distributionDate: z.string().trim().optional(),
  recipient: z.string().trim().max(200).optional(),
  recipientContact: z.string().trim().max(200).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  deliveryStatus: z.enum(DELIVERY_STATUS).optional(),
  remarks: z.string().trim().max(400).optional(),
  // Bulk send: distribute every ACTIVE code of the campaign to the recipient list.
  recipients: z.array(z.object({ name: z.string().optional(), contact: z.string().optional(), customerId: z.coerce.number().int().positive().optional() })).optional(),
});
export type DistributionInput = z.infer<typeof DistributionSchema>;

// -------------------------------------------------------- campaign broadcast

export const AUDIENCE_TYPES = ["All", "HighValue", "Group", "Specific"] as const;
export const AUDIENCE_LABELS: Record<(typeof AUDIENCE_TYPES)[number], string> = { All: "All Customers", HighValue: "High-Value Customers", Group: "Customer Group", Specific: "Specific Customers" };
export const MESSAGE_MODES = ["SMS", "WhatsApp", "Email", "Push"] as const;
export const MESSAGE_PLACEHOLDERS = ["{CustomerName}", "{PromoCode}", "{Discount}", "{CampaignName}", "{ExpiryDate}", "{CompanyName}"] as const;

/** Editable sample content per message mode (shown in the composer, user can edit). */
export const MESSAGE_TEMPLATES: Record<(typeof MESSAGE_MODES)[number], string> = {
  SMS: "Hi {CustomerName}! Use code {PromoCode} to get {Discount} on your next purchase at {CompanyName}. Valid till {ExpiryDate}. T&C apply.",
  WhatsApp: "🎉 Hello {CustomerName}!\n\nHere's a special offer from {CompanyName} — *{CampaignName}*.\n\n🏷️ Promo Code: *{PromoCode}*\n💰 Save {Discount} on your next order.\n⏰ Hurry, valid till {ExpiryDate}!\n\nShow this code at billing to redeem.",
  Email: "Dear {CustomerName},\n\nAs a valued customer of {CompanyName}, we're delighted to share an exclusive offer as part of our {CampaignName} campaign.\n\nUse promo code {PromoCode} at checkout and enjoy {Discount} off your purchase. This offer is valid until {ExpiryDate}.\n\nWe look forward to serving you.\n\nWarm regards,\n{CompanyName}",
  Push: "{CompanyName}: Your {Discount} offer is here! Use code {PromoCode} before {ExpiryDate}. Tap to shop now.",
};

export const CampaignSendSchema = z.object({
  campaignId: z.coerce.number().int().positive(),
  promoCodeId: z.coerce.number().int().positive().optional(),
  channel: z.enum(MESSAGE_MODES),
  audience: z.enum(AUDIENCE_TYPES),
  groupValue: z.string().trim().optional(),          // when audience = Group
  highValueMin: z.coerce.number().nonnegative().optional(), // when audience = HighValue (min total spent)
  customerIds: z.array(z.coerce.number().int().positive()).optional(), // when audience = Specific
  messageBody: z.string().trim().max(4000).optional(),
  bannerImage: z.string().optional(),                 // data URL of the uploaded banner
  remarks: z.string().trim().max(400).optional(),
});
export type CampaignSendInput = z.infer<typeof CampaignSendSchema>;

export interface AudiencePreview { audience: string; count: number; groups: string[]; sample: { id: number; name: string }[] }

// ------------------------------------------------------------------- redemption

export const RedeemItemSchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  qty: z.coerce.number().nonnegative().optional(),
  amount: z.coerce.number().nonnegative(),
});
export const ValidateSchema = z.object({
  promoCode: z.string().trim().min(1, "Enter a promo code."),
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
  post: z.boolean().optional(),
});
export type RedeemInput = z.infer<typeof RedeemSchema>;

export interface ValidateResult {
  valid: boolean; reason: string; promoCodeId: number | null; campaignName: string;
  discountType: string; discountAmount: number; taxableReduced: number; gstRule: string;
  freeProductId: number | null; freeQty: number;
}

// ---------------------------------------------------------------------- meta

export interface AccountRef { code: string; name: string; type: string }
export interface PromoMeta { config: PromoConfig; accounts: AccountRef[] }

// ------------------------------------------------------------------ dashboard

export interface PromoDashboard {
  totalCodes: number; activeCodes: number; expiredCodes: number; redeemedCodes: number; distributedCount: number;
  activeCampaigns: number; totalDiscount: number; redemptionRate: number; distributionRate: number;
  topCampaigns: { name: string; redeemed: number; discount: number; roi: number }[];
  topCustomers: { name: string; redeemed: number; discount: number }[];
  topProducts: { name: string; count: number }[];
  topBranches: { name: string; redeemed: number }[];
  channelBreakup: { name: string; value: number }[];
  monthlyRedemption: { name: string; value: number }[];
}

// -------------------------------------------------------------------- reports

export const REPORT_TYPES = [
  "register", "redemption", "campaign", "distribution", "customer", "branch", "product", "category", "expired", "unused", "roi",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export interface ReportResult { columns: string[]; rows: (string | number)[][]; title: string }

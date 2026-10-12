import { z } from "zod";

/** Membership Management — Configuration module contracts (config only). */

export const MEMBERSHIP_TYPES = ["Free", "Paid", "PurchaseBased", "Invitation", "Hybrid"] as const;
export const NUMBER_GENERATION = ["Auto", "Manual"] as const;
export const LEVEL_STATUS = ["Active", "Inactive", "Draft"] as const;
export const EVAL_PERIODS = ["Monthly", "Quarterly", "HalfYearly", "Yearly", "Lifetime"] as const;
export const QUALIFICATION_METHODS = ["PurchaseValue", "PurchaseFrequency", "BillCount", "LoyaltyPoints", "MembershipFee", "CustomerType", "ManualAssignment", "ReferralCount", "CampaignBased"] as const;
export const VALIDITY_TYPES = ["Lifetime", "Monthly", "Quarterly", "HalfYearly", "Yearly", "Custom"] as const;
export const CARD_TYPES = ["Digital", "Printable", "Both"] as const;
export const COMBINE_LOGIC = ["AND", "OR"] as const;
export const UPGRADE_CRITERIA = ["PurchaseValue", "PurchaseFrequency", "LoyaltyPoints", "MembershipFee", "Campaign"] as const;
export const NOTIFICATION_CHANNELS = ["sms", "email", "whatsapp", "push"] as const;

/** Registration fields the Customer Information config governs (visible / mandatory). */
export const CUSTOMER_FIELDS = [
  "customerName", "mobileNumber", "email", "dateOfBirth", "gender", "anniversaryDate", "address", "city", "state", "country",
  "pincode", "photo", "gstin", "pan", "aadhaar", "idProof", "occupation", "companyName", "referralSource", "emergencyContact",
] as const;
export const CUSTOMER_FIELD_LABELS: Record<string, string> = {
  customerName: "Customer Name", mobileNumber: "Mobile Number", email: "Email", dateOfBirth: "Date of Birth", gender: "Gender",
  anniversaryDate: "Anniversary Date", address: "Address", city: "City", state: "State", country: "Country", pincode: "Pincode",
  photo: "Photo", gstin: "GSTIN", pan: "PAN", aadhaar: "Aadhaar", idProof: "ID Proof", occupation: "Occupation",
  companyName: "Company Name", referralSource: "Referral Source", emergencyContact: "Emergency Contact",
};

/** Notification events (each configurable per channel). */
export const NOTIFICATION_EVENTS = [
  "welcomeSms", "welcomeEmail", "activation", "expiryReminder", "renewalReminder", "upgrade", "downgrade", "birthday", "anniversary", "expired",
] as const;
export const NOTIFICATION_EVENT_LABELS: Record<string, string> = {
  welcomeSms: "Welcome SMS", welcomeEmail: "Welcome Email", activation: "Membership Activation", expiryReminder: "Expiry Reminder",
  renewalReminder: "Renewal Reminder", upgrade: "Upgrade Notification", downgrade: "Downgrade Notification", birthday: "Birthday Wishes",
  anniversary: "Anniversary Wishes", expired: "Membership Expired",
};

export const COUPON_BENEFIT_KEYS = ["welcome", "birthday", "festival", "monthly", "exclusive"] as const;
export const VOUCHER_BENEFIT_KEYS = ["joining", "renewal", "birthday"] as const;
export const SERVICE_BENEFIT_KEYS = ["freeHomeDelivery", "priorityBilling", "prioritySupport", "freeInstallation", "freeService", "healthCheckup", "expressCheckout"] as const;
export const SERVICE_BENEFIT_LABELS: Record<string, string> = {
  freeHomeDelivery: "Free Home Delivery", priorityBilling: "Priority Billing", prioritySupport: "Priority Customer Support",
  freeInstallation: "Free Installation", freeService: "Free Service", healthCheckup: "Health Checkup", expressCheckout: "Express Checkout",
};

const b = z.boolean();
const nn = z.coerce.number().nonnegative();
const boolMap = z.record(z.string(), z.boolean());

// -------------------------------------------------------------- 1. general
export const GeneralConfigSchema = z.object({
  enableModule: b, membershipType: z.enum(MEMBERSHIP_TYPES), numberGeneration: z.enum(NUMBER_GENERATION),
  numberPrefix: z.string().trim().max(20), numberLength: z.coerce.number().int().min(4).max(30),
  defaultStatus: z.string().trim().max(12), allowMultiple: b, allowTransfer: b, autoActivate: b, requireApproval: b,
  enableExpiry: b, enableAutoRenewal: b, enableAutoUpgrade: b, enableAutoDowngrade: b,
  renewalReminderDays: z.coerce.number().int().nonnegative(), expiryReminderDays: z.coerce.number().int().nonnegative(), gracePeriodDays: z.coerce.number().int().nonnegative(),
});
export type GeneralConfigInput = z.infer<typeof GeneralConfigSchema>;
export interface GeneralConfig extends GeneralConfigInput { runningNumber: number }

// ---------------------------------------------------------------- 2. level
export const LevelSchema = z.object({
  code: z.string().trim().min(1, "Level code is required.").max(40),
  name: z.string().trim().min(1, "Level name is required.").max(120),
  description: z.string().trim().max(400).optional(),
  priority: z.coerce.number().int().optional(),
  displayOrder: z.coerce.number().int().optional(),
  themeColor: z.string().trim().max(20).optional(),
  icon: z.string().trim().max(40).optional(),
  status: z.enum(LEVEL_STATUS).optional(),
});
export type LevelInput = z.infer<typeof LevelSchema>;
export interface LevelRow { id: number; code: string; name: string; description: string; priority: number; displayOrder: number; themeColor: string; icon: string; status: string }

// -------------------------------------------------------- 3. qualification
export const QualificationSchema = z.object({
  method: z.enum(QUALIFICATION_METHODS),
  evaluationPeriod: z.enum(EVAL_PERIODS).optional(),
  minPurchase: nn.optional(), minBills: z.coerce.number().int().nonnegative().optional(), minPoints: z.coerce.number().int().nonnegative().optional(),
  minFee: nn.optional(), minFrequency: z.coerce.number().int().nonnegative().optional(), referralCount: z.coerce.number().int().nonnegative().optional(),
  customerType: z.string().trim().max(40).optional(), campaignRef: z.string().trim().max(80).optional(),
  combineLogic: z.enum(COMBINE_LOGIC).optional(), sortOrder: z.coerce.number().int().optional(), active: b.optional(),
});
export type QualificationInput = z.infer<typeof QualificationSchema>;
export interface QualificationRow extends QualificationInput { id: number; levelId: number }

// ------------------------------------------------------------- 4. benefit
export const BenefitSchema = z.object({
  billDiscountPct: nn.optional(), maxDiscount: nn.optional(), productDiscountPct: nn.optional(), categoryDiscountPct: nn.optional(), brandDiscountPct: nn.optional(),
  maxDiscountPerBill: nn.optional(), maxDiscountPerDay: nn.optional(), maxDiscountPerMonth: nn.optional(),
  pointMultiplier: nn.optional(), welcomePoints: z.coerce.number().int().nonnegative().optional(), birthdayPoints: z.coerce.number().int().nonnegative().optional(),
  anniversaryPoints: z.coerce.number().int().nonnegative().optional(), bonusPoints: z.coerce.number().int().nonnegative().optional(),
  exclusivePromo: b.optional(), campaignEligible: b.optional(),
  couponBenefits: boolMap.optional(), voucherBenefits: boolMap.optional(), serviceBenefits: boolMap.optional(),
});
export type BenefitInput = z.infer<typeof BenefitSchema>;

// ----------------------------------------------------------------- 5. fee
export const FeeSchema = z.object({
  registrationFee: nn.optional(), renewalFee: nn.optional(), securityDeposit: nn.optional(), refundable: b.optional(),
  currency: z.string().trim().max(8).optional(), gstApplicable: b.optional(), gstPercentage: nn.optional(),
  discountOnRenewal: nn.optional(), lateRenewalCharge: nn.optional(),
});
export type FeeInput = z.infer<typeof FeeSchema>;

// ------------------------------------------------------------ 6. validity
export const ValiditySchema = z.object({
  validityType: z.enum(VALIDITY_TYPES).optional(), validityDays: z.coerce.number().int().nonnegative().optional(),
  effectiveFrom: z.string().trim().optional(), effectiveTo: z.string().trim().optional(), gracePeriodDays: z.coerce.number().int().nonnegative().optional(),
});
export type ValidityInput = z.infer<typeof ValiditySchema>;

// ------------------------------------------------------------- 7. upgrade
export const UpgradeSchema = z.object({
  autoUpgrade: b.optional(), manualUpgrade: b.optional(), approvalRequired: b.optional(), upgradeBasedOn: z.array(z.string()).optional(),
  minPurchase: nn.optional(), minBills: z.coerce.number().int().nonnegative().optional(), minPoints: z.coerce.number().int().nonnegative().optional(),
  minFee: nn.optional(), evaluationPeriod: z.enum(EVAL_PERIODS).optional(), active: b.optional(),
});
export type UpgradeInput = z.infer<typeof UpgradeSchema>;

// ----------------------------------------------------------- 8. downgrade
export const DowngradeSchema = z.object({
  autoDowngrade: b.optional(), manualDowngrade: b.optional(), approvalRequired: b.optional(), gracePeriodDays: z.coerce.number().int().nonnegative().optional(),
  purchaseThreshold: nn.optional(), billThreshold: z.coerce.number().int().nonnegative().optional(), pointThreshold: z.coerce.number().int().nonnegative().optional(), active: b.optional(),
});
export type DowngradeInput = z.infer<typeof DowngradeSchema>;

// ------------------------------------------------------------- 9. renewal
export const RenewalSchema = z.object({
  autoRenewal: b, manualRenewal: b, renewalFee: nn.optional(), renewalValidityDays: z.coerce.number().int().nonnegative().optional(),
  renewalReminderDays: z.coerce.number().int().nonnegative().optional(), renewalBonusPoints: z.coerce.number().int().nonnegative().optional(),
  renewalCoupon: b, renewalGiftVoucher: b,
});
export type RenewalInput = z.infer<typeof RenewalSchema>;

// ------------------------------------------------------------ 10. customer
export const CustomerConfigSchema = z.object({ fields: z.record(z.string(), z.object({ visible: z.boolean(), mandatory: z.boolean() })) });
export type CustomerConfigInput = z.infer<typeof CustomerConfigSchema>;

// ------------------------------------------------------------- 11. finance
export const FinanceConfigSchema = z.object({
  registrationFeeAccount: z.string().trim().optional(), renewalFeeAccount: z.string().trim().optional(), discountAccount: z.string().trim().optional(),
  refundAccount: z.string().trim().optional(), marketingExpenseAccount: z.string().trim().optional(),
  costCenter: z.string().trim().optional(), department: z.string().trim().optional(), project: z.string().trim().optional(),
});
export type FinanceConfigInput = z.infer<typeof FinanceConfigSchema>;

// -------------------------------------------------------- 12. notification
export const NotificationConfigSchema = z.object({ events: z.record(z.string(), z.record(z.string(), z.boolean())) });
export type NotificationConfigInput = z.infer<typeof NotificationConfigSchema>;

// -------------------------------------------------------------- 13. card
export const CardConfigSchema = z.object({
  enableCard: b, cardType: z.enum(CARD_TYPES), generateQr: b, generateBarcode: b, showCardNumber: b, showLogo: b, showPhoto: b,
  showLevel: b, showIssueDate: b, showExpiryDate: b, showSignature: b, theme: z.string().trim().max(40), cardSize: z.string().trim().max(20), allowReprint: b,
});
export type CardConfigInput = z.infer<typeof CardConfigSchema>;

// ---------------------------------------------------------- 14. approval
export const ApprovalConfigSchema = z.object({
  approvalLevels: z.coerce.number().int().min(1).max(5), approvalRoles: z.array(z.string()).optional(), approvalNotifications: b,
});
export type ApprovalConfigInput = z.infer<typeof ApprovalConfigSchema>;
export const APPROVAL_WORKFLOW = ["Draft", "Submitted", "Approved", "Active", "Suspended", "Expired", "Cancelled"] as const;

// ---------------------------------------------------------------- meta
export interface AccountRef { code: string; name: string; type: string }

// -------------------------------------------------------------- reports
export const REPORT_TYPES = ["configuration", "levels", "qualification", "benefit", "fee", "renewal", "notification", "finance"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export const REPORT_LABELS: Record<ReportType, string> = {
  configuration: "Membership Configuration Report", levels: "Membership Level Report", qualification: "Qualification Rule Report",
  benefit: "Benefit Configuration Report", fee: "Fee Configuration Report", renewal: "Renewal Configuration Report",
  notification: "Notification Configuration Report", finance: "Finance Configuration Report",
};
export interface ReportResult { title: string; columns: string[]; rows: (string | number)[][] }

// ---------------------------------------------------------------- audit
export interface AuditRow { id: number; entityType: string; entityId: number | null; action: string; byName: string; note: string; at: string }

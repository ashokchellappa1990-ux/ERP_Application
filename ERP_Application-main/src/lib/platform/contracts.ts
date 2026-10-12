import { z } from "zod";

/** Platform Administration — contracts (shared by the portal + ERP self-service). */

export const PLAN_TIERS = ["Starter", "Standard", "Professional", "Enterprise", "Custom"] as const;
export const BILLING_CYCLES = ["Monthly", "Quarterly", "HalfYearly", "Yearly", "Lifetime"] as const;
export const SUBSCRIPTION_STATUS = ["Active", "Suspended", "Cancelled", "Expired"] as const;
export const TENANT_STATUS = ["Active", "Suspended", "Deactivated", "Archived"] as const;
export const WORKSPACE_TYPES = ["Trial", "Production", "Sandbox", "Testing", "Training", "Demo"] as const;
export const CONVERSION_TYPES = ["ContinueTrial", "StartFresh", "ArchiveAndFresh"] as const;
export const INVOICE_TYPES = ["Subscription", "Renewal", "CreditNote", "DebitNote", "Refund"] as const;
export const PAYMENT_MODES = ["Bank", "UPI", "Card", "Cheque", "Cash", "Gateway"] as const;
export const MODULE_KEYS = ["sales", "purchase", "inventory", "finance", "crm", "gst", "manufacturing", "hrms", "ai", "reports", "dashboard", "loyalty", "membership", "coupon", "promo", "giftVoucher"] as const;
export const TRIAL_DURATIONS = [7, 15, 30, 45, 60] as const;

const b = z.boolean();
const num = z.coerce.number();
const limits = {
  maxUsers: num.int().nonnegative().optional(), maxCompanies: num.int().nonnegative().optional(), maxBranches: num.int().nonnegative().optional(),
  maxWarehouses: num.int().nonnegative().optional(), maxProducts: num.int().nonnegative().optional(), maxCustomers: num.int().nonnegative().optional(),
  maxSuppliers: num.int().nonnegative().optional(), maxStorageMb: num.int().nonnegative().optional(), maxApiCalls: num.int().nonnegative().optional(),
  maxAiCredits: num.int().nonnegative().optional(), maxTransactions: num.int().nonnegative().optional(),
};

export const PlanSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  code: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(120), tier: z.enum(PLAN_TIERS),
  monthlyPrice: num.nonnegative().optional(), quarterlyPrice: num.nonnegative().optional(), halfYearlyPrice: num.nonnegative().optional(), yearlyPrice: num.nonnegative().optional(), lifetimePrice: num.nonnegative().optional(),
  currency: z.string().trim().max(8).optional(), ...limits, modules: z.record(z.string(), z.boolean()).optional(), active: b.optional(), isCustom: b.optional(),
});
export type PlanInput = z.infer<typeof PlanSchema>;

export const TrialConfigSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(120), durationDays: num.int().min(1).max(365),
  maxUsers: num.int().nonnegative().optional(), maxBranches: num.int().nonnegative().optional(), maxWarehouses: num.int().nonnegative().optional(),
  maxProducts: num.int().nonnegative().optional(), maxCustomers: num.int().nonnegative().optional(), maxSuppliers: num.int().nonnegative().optional(),
  maxStorageMb: num.int().nonnegative().optional(), maxTransactions: num.int().nonnegative().optional(), maxAiCredits: num.int().nonnegative().optional(), maxApiCalls: num.int().nonnegative().optional(),
  modules: z.record(z.string(), z.boolean()).optional(), active: b.optional(),
});
export type TrialConfigInput = z.infer<typeof TrialConfigSchema>;

export const SubscribeSchema = z.object({ tenantId: z.coerce.number().int().positive(), planId: z.coerce.number().int().positive(), billingCycle: z.enum(BILLING_CYCLES), autoRenew: b.optional(), startDate: z.string().trim().optional() });
export const RenewSchema = z.object({ subscriptionId: z.coerce.number().int().positive(), billingCycle: z.enum(BILLING_CYCLES).optional() });
export const ChangePlanSchema = z.object({ subscriptionId: z.coerce.number().int().positive(), planId: z.coerce.number().int().positive(), action: z.enum(["Upgrade", "Downgrade"]) });
export const LifecycleSchema = z.object({ subscriptionId: z.coerce.number().int().positive(), note: z.string().trim().max(400).optional() });

export const WorkspaceSchema = z.object({ tenantId: z.coerce.number().int().positive(), name: z.string().trim().min(1).max(150), type: z.enum(WORKSPACE_TYPES) });
export const WorkspaceActionSchema = z.object({ workspaceId: z.coerce.number().int().positive(), reason: z.string().trim().max(200).optional() });

export const ConversionSchema = z.object({
  tenantId: z.coerce.number().int().positive(), conversionType: z.enum(CONVERSION_TYPES), planId: z.coerce.number().int().positive(), billingCycle: z.enum(BILLING_CYCLES),
  keepScope: z.array(z.string()).optional(), clearScope: z.array(z.string()).optional(),
});
export type ConversionInput = z.infer<typeof ConversionSchema>;

export const LicenseSchema = z.object({
  tenantId: z.coerce.number().int().positive(), ...limits,
  aiEnabled: b.optional(), analyticsEnabled: b.optional(), manufacturingEnabled: b.optional(), financeEnabled: b.optional(), crmEnabled: b.optional(), hrmsEnabled: b.optional(),
  loyaltyEnabled: b.optional(), membershipEnabled: b.optional(), couponEnabled: b.optional(), promoEnabled: b.optional(), giftVoucherEnabled: b.optional(),
  validFrom: z.string().trim().optional(), validTo: z.string().trim().optional(), status: z.string().trim().optional(),
});
export type LicenseInput = z.infer<typeof LicenseSchema>;

export const TenantStatusSchema = z.object({ tenantId: z.coerce.number().int().positive(), status: z.enum(TENANT_STATUS) });
export const InvoiceSchema = z.object({ tenantId: z.coerce.number().int().positive(), subscriptionId: z.coerce.number().int().positive().optional(), invoiceType: z.enum(INVOICE_TYPES).optional(), amount: num.nonnegative(), taxAmount: num.nonnegative().optional(), dueDate: z.string().trim().optional() });
export const PaymentSchema = z.object({ invoiceId: z.coerce.number().int().positive(), amount: num.positive(), mode: z.enum(PAYMENT_MODES), reference: z.string().trim().max(80).optional() });
export const ExtendTrialSchema = z.object({ tenantId: z.coerce.number().int().positive(), days: num.int().min(1).max(365) });
export const NotificationSchema = z.object({ tenantId: z.coerce.number().int().positive().optional(), event: z.string().trim().min(1), channel: z.string().trim().optional(), recipient: z.string().trim().optional() });
export const SettingsSchema = z.object({ config: z.record(z.string(), z.unknown()) });

export const REPORT_TYPES = ["tenants", "trials", "subscriptions", "renewals", "upgrades", "downgrades", "workspaces", "licenses", "revenue", "growth", "usage"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export const REPORT_LABELS: Record<ReportType, string> = {
  tenants: "Tenant Register", trials: "Trial Register", subscriptions: "Subscription Register", renewals: "Subscription Renewal Report", upgrades: "Plan Upgrade Report", downgrades: "Plan Downgrade Report",
  workspaces: "Workspace Report", licenses: "License Report", revenue: "Revenue Report", growth: "Customer Growth Report", usage: "Usage Report",
};
export interface ReportResult { title: string; columns: string[]; rows: (string | number)[][] }

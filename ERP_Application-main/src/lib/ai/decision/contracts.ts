import { z } from "zod";

/** Zod request contracts for the Decision Intelligence APIs. */

export const scenarioSchema = z.object({
  name: z.string().max(160).optional(),
  save: z.boolean().optional(),
  inputs: z.object({
    salesChangePct: z.number().min(-100).max(500).optional(),
    expenseChangePct: z.number().min(-100).max(500).optional(),
    discountPct: z.number().min(0).max(90).optional(),
    marketingBudget: z.number().min(0).optional(),
    supplierPriceChangePct: z.number().min(-100).max(200).optional(),
    gstChangePct: z.number().min(-100).max(200).optional(),
    salaryChangePct: z.number().min(-100).max(200).optional(),
    newBranch: z.boolean().optional(),
  }),
});

export const configSchema = z.object({
  defaultHorizon: z.coerce.number().int().min(7).max(365).optional(),
  defaultMethod: z.enum(["auto", "linear", "moving", "seasonal"]).optional(),
  methods: z.record(z.string(), z.string()).optional(),
  thresholds: z.object({ budgetWarn: z.number().optional(), lowStockAlert: z.number().optional(), receivableDays: z.number().optional() }).optional(),
  enabled: z.object({ predictions: z.boolean().optional(), risks: z.boolean().optional(), opportunities: z.boolean().optional(), notifications: z.boolean().optional() }).optional(),
});

export const feedbackSchema = z.object({ itemType: z.enum(["risk", "opportunity", "recommendation"]), itemKey: z.string().max(200), status: z.enum(["open", "acknowledged", "dismissed", "resolved", "assigned"]), assignedTo: z.string().max(120).optional(), note: z.string().max(300).optional() });
export const decisionLogSchema = z.object({ source: z.enum(["prediction", "risk", "opportunity", "recommendation"]), refKey: z.string().max(160), module: z.string().max(24).optional(), title: z.string().max(240), recommendation: z.string().optional(), decisionTaken: z.enum(["Accepted", "Rejected", "Deferred", "Pending"]).optional() });
export const decisionUpdateSchema = z.object({ id: z.coerce.number().int().positive(), decisionTaken: z.enum(["Accepted", "Rejected", "Deferred", "Pending"]).optional(), actualResult: z.string().max(400).optional(), accuracy: z.coerce.number().int().min(0).max(100).optional(), learningOutcome: z.string().max(400).optional() });
export const actualSchema = z.object({ predictionId: z.coerce.number().int().positive(), actualValue: z.coerce.number() });
export const notifySchema = z.object({ id: z.union([z.coerce.number().int().positive(), z.literal("all")]), status: z.enum(["read", "dismissed", "unread"]) });

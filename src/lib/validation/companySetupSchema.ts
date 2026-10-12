import { z } from "zod";

const dict = z.record(z.string(), z.any()).optional().default({});
const rowArr = z.array(z.record(z.string(), z.any())).optional().default([]);

/** Loose payload schema — the wizard sends the whole SetupData shape. */
export const companySetupSchema = z.object({
  mode: z.string().optional().default("standard"),
  status: z.enum(["draft", "completed"]).optional().default("draft"),
  currentStep: z.coerce.number().int().min(0).optional().default(0),
  company: dict,
  profile: dict,
  org: dict,
  finance: dict,
  gst: dict,
  admin: dict,
  contacts: z
    .object({ primary: dict, secondary: dict })
    .optional()
    .default({ primary: {}, secondary: {} }),
  workingDays: z.array(z.string()).optional().default([]),
  branches: rowArr,
  warehouses: rowArr,
  banks: rowArr,
  users: rowArr,
  inventoryValuation: z.string().optional().default(""),
  paymentDefault: z.string().optional().default(""),
  migrationSource: z.string().optional().default(""),
  industrySelected: z.string().optional().default(""),
  toggles: z.record(z.string(), z.record(z.string(), z.boolean())).optional().default({}),
  flags: z.record(z.string(), z.boolean()).optional().default({}),
});

export type CompanySetupInput = z.infer<typeof companySetupSchema>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Required-field validation applied only when the wizard is being COMPLETED.
 * Returns field errors keyed exactly like the wizard (company.name, primary.mobile, …)
 * plus the first step that needs attention so the UI can jump there.
 */
export function validateCompleted(d: CompanySetupInput): { errors: Record<string, string>; step: string | null } {
  const e: Record<string, string> = {};

  // Step: company
  if (!s(d.company.name)) e["company.name"] = "Company name is required.";
  if (!s(d.company.industry)) e["company.industry"] = "Select an industry category.";
  if (!s(d.company.phone)) e["company.phone"] = "Company phone is required.";
  if (s(d.company.email) && !EMAIL_RE.test(s(d.company.email))) e["company.email"] = "Enter a valid email.";

  // Step: contact
  const p = d.contacts.primary;
  if (!s(p.name)) e["primary.name"] = "Contact name is required.";
  if (!s(p.mobile)) e["primary.mobile"] = "Mobile number is required.";
  if (s(p.email) && !EMAIL_RE.test(s(p.email))) e["primary.email"] = "Enter a valid email.";

  // Step: gst
  const gstin = s(d.gst.gstin);
  if (gstin && gstin.length !== 15) e["gst.gstin"] = "GSTIN must be 15 characters.";

  // First step needing attention (in wizard order).
  const keys = Object.keys(e);
  let step: string | null = null;
  if (keys.some((k) => k.startsWith("company."))) step = "company";
  else if (keys.some((k) => k.startsWith("primary."))) step = "contact";
  else if (keys.some((k) => k.startsWith("gst."))) step = "gst";

  return { errors: e, step };
}

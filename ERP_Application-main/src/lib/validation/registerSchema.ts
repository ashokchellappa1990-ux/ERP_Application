import { z } from "zod";

/** Business types offered on the registration form. */
export const BUSINESS_TYPE_VALUES = [
  "grocery", "pharmacy", "textile", "electronics",
  "hardware", "furniture", "cosmetics", "wholesale", "other",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Server-side registration payload schema — mirrors the UI validation. */
export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name."),
    countryCode: z.string().trim().min(1).max(6).default("+91"),
    mobile: z
      .string()
      .trim()
      .regex(/^\d{7,12}$/, "Enter a valid mobile number."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .regex(EMAIL_RE, "Enter a valid email address."),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters.")
      .regex(/^[a-zA-Z0-9._]+$/, "Use only letters, numbers, dot or underscore."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Add at least one uppercase letter.")
      .regex(/[0-9]/, "Add at least one number.")
      .regex(/[^A-Za-z0-9]/, "Add at least one special character."),
    confirm: z.string().optional(),
    businessName: z.string().trim().min(1, "Business name is required."),
    businessType: z.enum(BUSINESS_TYPE_VALUES, {
      message: "Please select a business type.",
    }),
    agree: z.literal(true, { message: "You must accept the Terms to continue." }),
  })
  .refine((d) => !d.confirm || d.confirm === d.password, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/** Flatten Zod issues into a { field: message } map for the form. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

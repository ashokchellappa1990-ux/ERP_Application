import { z } from "zod";

/** Product Master payload from the editor (loose nested shape). */
export const productSchema = z.object({
  fields: z.record(z.string(), z.any()).optional().default({}),
  toggles: z.record(z.string(), z.record(z.string(), z.boolean())).optional().default({}),
  flags: z.record(z.string(), z.boolean()).optional().default({}),
  attributes: z
    .array(z.object({
      name: z.string().optional().default(""),
      type: z.string().optional().default(""),
      values: z.string().optional().default(""),
    }))
    .optional()
    .default([]),
  variants: z
    .array(z.object({
      label: z.string().optional().default(""),
      dims: z.array(z.object({ name: z.string().optional().default(""), value: z.string().optional().default("") })).optional().default([]),
      sku: z.string().optional().default(""),
      barcode: z.string().optional().default(""),
      mrp: z.string().optional().default(""),
      openingStock: z.string().optional().default(""),
      status: z.string().optional().default("Active"),
    }))
    .optional()
    .default([]),
  approvalStatus: z.enum(["draft", "pending", "approved", "rejected"]).optional().default("draft"),
});

export type ProductInput = z.infer<typeof productSchema>;

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Required-field / format validation; errors keyed by the editor's field names. */
export function validateProduct(d: ProductInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (!s(d.fields.name)) e["name"] = "Product name is required.";
  if (s(d.fields.hsn) && !/^\d{4,8}$/.test(s(d.fields.hsn))) e["hsn"] = "HSN must be 4–8 digits.";
  return e;
}

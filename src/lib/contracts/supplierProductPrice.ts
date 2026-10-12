import { z } from "zod";

/**
 * Supplier Product PP Config — Supplier + Product → Purchase Price, with an
 * effective date on the current price and an insert-only history log of past
 * changes (see prisma/schema.prisma's SupplierProductPrice(History) models).
 */

export const supplierProductPriceInput = z.object({
  supplierId: z.coerce.number().int().positive("Supplier is required"),
  productId: z.coerce.number().int().positive("Product is required"),
  purchasePrice: z.coerce.number().min(0, "Purchase price cannot be negative"),
  effectiveFrom: z.string().trim().min(1, "Effective date is required"),
  status: z.enum(["Active", "Inactive"]).default("Active"),
  remarks: z.string().trim().max(500).optional().nullable(),
});
export type SupplierProductPriceInput = z.infer<typeof supplierProductPriceInput>;

export interface SupplierProductPriceRow {
  id: number;
  supplierId: number;
  supplierName: string;
  productId: number;
  productCode: string | null;
  productName: string;
  uom: string | null;
  purchasePrice: number;
  effectiveFrom: string;
  status: "Active" | "Inactive";
  remarks: string | null;
  updatedAt: string;
}

export interface SupplierProductPriceHistoryRow {
  id: number;
  oldPrice: number | null;
  newPrice: number;
  effectiveFrom: string;
  changedByName: string | null;
  createdAt: string;
}

export interface SupplierProductPriceDetail extends SupplierProductPriceRow {
  history: SupplierProductPriceHistoryRow[];
}

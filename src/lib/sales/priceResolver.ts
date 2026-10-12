import { type PosProduct } from "@/lib/sales/salesData";
import { enabledIds, field } from "@/lib/settings/salesConfigDefaults";

/**
 * Price-source priority used at sales billing. The waterfall order is fixed
 * (most specific → least specific); which sources are active comes from the
 * Sales Configuration (`priceSources` toggle group). The first enabled source
 * that yields a price wins; Product Master is the always-available fallback.
 */
export const PRICE_SOURCE_DEFS = [
  { id: "promotion", label: "Promotion Price" },
  { id: "customer", label: "Customer Price" },
  { id: "batch", label: "Batch Price" },
  { id: "branch", label: "Branch Price" },
  { id: "product", label: "Product Master Price" },
];

export interface PriceContext {
  promotionPrice?: number;
  customerPrice?: number;
  batchPrice?: number;
  branchPrice?: number;
}

/** Product Master tier price chosen by the configured default price source. */
export function productMasterPrice(p: PosProduct, src = field("priceSource")): number {
  switch (src) {
    case "mrp": return p.mrp;
    case "wholesale": return p.prices.wholesale;
    case "dealer": return p.prices.dealer;
    case "distributor": return p.prices.distributor;
    case "online": return p.prices.online;
    case "contract": return p.prices.dealer;
    default: return p.prices.retail;
  }
}

export function resolveSellingPrice(p: PosProduct, ctx: PriceContext = {}): { price: number; source: string } {
  const active = enabledIds("priceSources");
  for (const s of PRICE_SOURCE_DEFS) {
    if (!active.includes(s.id) && s.id !== "product") continue;
    if (s.id === "promotion" && ctx.promotionPrice) return { price: ctx.promotionPrice, source: "Promotion" };
    if (s.id === "customer" && ctx.customerPrice) return { price: ctx.customerPrice, source: "Customer" };
    if (s.id === "batch" && ctx.batchPrice) return { price: ctx.batchPrice, source: "Batch" };
    if (s.id === "branch" && ctx.branchPrice) return { price: ctx.branchPrice, source: "Branch" };
    if (s.id === "product") return { price: productMasterPrice(p), source: "Product Master" };
  }
  return { price: productMasterPrice(p), source: "Product Master" };
}

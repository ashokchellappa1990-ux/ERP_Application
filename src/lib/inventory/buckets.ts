/**
 * Inventory "buckets" for sales-return handling. Each non-sellable bucket is a
 * logical warehouse so it reuses the existing per-(tenant,branch,product,warehouse)
 * balance/lot model and is naturally excluded from sellable stock.
 *
 *   good   → returns to the original sale's sellable warehouse (re-sellable)
 *   damaged/expired/vendor/scrap → its own bucket warehouse (NOT sellable)
 */
export const BUCKET_WAREHOUSE: Record<string, string> = {
  damaged: "Damage Store",
  expired: "Expired Stock",
  vendor: "Vendor Return",
  scrap: "Scrap",
  quarantine: "Quarantine Stock", // held for QC (sales-exchange) — not sellable, not written off
};

/** Virtual warehouse holding stock dispatched on an internal transfer but not yet
 * received at the destination. Excluded from sellable/available stock until the
 * Transfer Receipt moves it into a real destination warehouse. */
export const IN_TRANSIT_WAREHOUSE = "In-Transit";

/** The warehouse names that must be EXCLUDED from sellable stock (POS / billing). */
export const BUCKET_WAREHOUSES: string[] = [...Object.values(BUCKET_WAREHOUSE), IN_TRANSIT_WAREHOUSE];

export type InventoryHandling = "good" | "damaged" | "expired" | "vendor" | "scrap" | "quarantine";

/** Destination warehouse for a returned line given its handling + the sale's
 * sellable warehouse. "good" goes back to the sellable store; everything else to
 * its bucket. */
export function returnWarehouse(handling: string, sellableWarehouse: string): string {
  return BUCKET_WAREHOUSE[handling] ?? sellableWarehouse;
}

/** Whether this handling returns stock to sellable inventory (good condition). */
export const isSellableReturn = (handling: string): boolean => handling === "good" || !BUCKET_WAREHOUSE[handling];

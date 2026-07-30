/**
 * POS Configuration — Inventory, POS and Payment behaviour toggles, moved here
 * from the Business Setup wizard into their own System menu. Mutable in-session
 * config singleton (same pattern as the other Settings pages).
 */
export interface PosConfigState {
  toggles: Record<string, Record<string, boolean>>;
  inventoryValuation: string;
  paymentDefault: string;
  taxMethod: string; // inclusive | exclusive — how the POS interprets the selling price
}

const on = (...ids: string[]) => ids.reduce<Record<string, boolean>>((a, id) => ((a[id] = true), a), {});

export const DEFAULT_POS_CONFIG: PosConfigState = {
  toggles: {
    inventory: on("batch", "expiry", "reorder"),
    inventoryRules: on("reorder"),
    pos: on("barcode", "qr", "quick", "touch", "hold", "recall"),
    receipt: on("print"),
    payment: on("cash", "upi", "credit", "debit"),
  },
  inventoryValuation: "fifo",
  paymentDefault: "cash",
  taxMethod: "inclusive",
};

export const TAX_METHOD_OPTIONS = [
  { value: "inclusive", label: "Inclusive of Tax — selling price already contains GST" },
  { value: "exclusive", label: "Exclusive of Tax — GST is added on top of the price" },
];

export const VALUATION_OPTIONS = [
  { value: "fifo", label: "FIFO (First In First Out)" },
  { value: "lifo", label: "LIFO (Last In First Out)" },
  { value: "weighted", label: "Weighted Average" },
];
export const PAYMENT_DEFAULT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
];

export function clonePosConfig(): PosConfigState {
  return JSON.parse(JSON.stringify(DEFAULT_POS_CONFIG));
}
export function applyPosConfig(next: PosConfigState) {
  DEFAULT_POS_CONFIG.toggles = JSON.parse(JSON.stringify(next.toggles));
  DEFAULT_POS_CONFIG.inventoryValuation = next.inventoryValuation;
  DEFAULT_POS_CONFIG.paymentDefault = next.paymentDefault;
  DEFAULT_POS_CONFIG.taxMethod = next.taxMethod;
}

/** Deep-merge a stored config onto the defaults (so new keys always exist). */
export function mergePosConfig(stored: Partial<PosConfigState> | null | undefined): PosConfigState {
  const base = clonePosConfig();
  if (!stored) return base;
  if (stored.inventoryValuation) base.inventoryValuation = stored.inventoryValuation;
  if (stored.paymentDefault) base.paymentDefault = stored.paymentDefault;
  if (stored.taxMethod) base.taxMethod = stored.taxMethod;
  const toggles = stored.toggles ?? {};
  for (const g of Object.keys(toggles)) base.toggles[g] = { ...(base.toggles[g] ?? {}), ...toggles[g] };
  return base;
}

export const posConfigOn = (group: string, id: string) => !!DEFAULT_POS_CONFIG.toggles[group]?.[id];

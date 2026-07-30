/**
 * DEFAULT_GENERAL_CONFIG — application-wide general settings.
 *
 * Number rounding, decimals, currency formatting, date/time, regional and
 * system-behaviour options that every module can read. Mutable singleton so the
 * General Settings screen edits it and the rest of the app stays in sync within
 * a session. In production this is the persisted `general_settings` document.
 */
export interface GeneralConfigData {
  fields: Record<string, string>;
  flags: Record<string, boolean>;
}

export const DEFAULT_GENERAL_CONFIG: GeneralConfigData = {
  fields: {
    // Currency & numbers
    baseCurrency: "INR",
    currencySymbol: "₹",
    currencyPosition: "before", // before | after
    numberSystem: "indian", // indian (lakh/crore) | international (million)
    thousandSeparator: "indian", // indian | international | none
    amountDecimals: "2",
    qtyDecimals: "2",
    rateDecimals: "2",
    // Rounding
    roundingMethod: "nearest", // nearest | up | down | none
    roundingPrecision: "1", // 1 | 0.5 | 0.10 | 0.05 | 0.01
    // Date & time
    dateFormat: "dd-MMM-yyyy",
    timeFormat: "12h", // 12h | 24h
    timezone: "Asia/Kolkata",
    // Regional / fiscal
    fiscalYearStart: "April",
    weekStart: "Monday",
    language: "en",
    // System behaviour
    defaultPageSize: "25",
    sessionTimeout: "30", // minutes
  },
  flags: {
    enableRounding: true, // apply bill round-off
    roundInPrint: true, // show rounded value on printed documents
    showCurrencyCode: false, // append INR after amount
    negativeInRed: true, // show negative figures in red
    autoLogout: true, // log out after idle session timeout
    confirmBeforeDelete: true, // confirm dialog on destructive actions
    compactDensity: false, // tighter table / list spacing
    soundOnAction: false, // play sound on POS scan / save
    terminalSetupRequired: false, // enforce terminal sessions + per-terminal data scoping on transactions
  },
};

/** Option lists surfaced by the General Settings screen. */
export const GENERAL_OPTIONS = {
  currencyPosition: [
    { value: "before", label: "Before amount (₹100)" },
    { value: "after", label: "After amount (100₹)" },
  ],
  numberSystem: [
    { value: "indian", label: "Indian (Lakh / Crore)" },
    { value: "international", label: "International (Million)" },
  ],
  thousandSeparator: [
    { value: "indian", label: "Indian (1,00,000)" },
    { value: "international", label: "International (100,000)" },
    { value: "none", label: "None (100000)" },
  ],
  decimals: [
    { value: "0", label: "0" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
  ],
  roundingMethod: [
    { value: "nearest", label: "Nearest" },
    { value: "up", label: "Round Up (ceiling)" },
    { value: "down", label: "Round Down (floor)" },
    { value: "none", label: "No Rounding" },
  ],
  roundingPrecision: [
    { value: "1", label: "Nearest ₹1" },
    { value: "0.50", label: "Nearest 50 paise" },
    { value: "0.10", label: "Nearest 10 paise" },
    { value: "0.05", label: "Nearest 5 paise" },
    { value: "0.01", label: "Nearest 1 paise" },
  ],
  dateFormat: [
    { value: "dd-MMM-yyyy", label: "15-Jun-2026" },
    { value: "dd/MM/yyyy", label: "15/06/2026" },
    { value: "MM/dd/yyyy", label: "06/15/2026" },
    { value: "yyyy-MM-dd", label: "2026-06-15" },
  ],
  timeFormat: [
    { value: "12h", label: "12-hour (03:45 PM)" },
    { value: "24h", label: "24-hour (15:45)" },
  ],
  timezone: [
    { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
    { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
    { value: "Asia/Singapore", label: "Asia/Singapore" },
    { value: "UTC", label: "UTC" },
  ],
  fiscalYearStart: [
    { value: "April", label: "April (India)" },
    { value: "January", label: "January (Calendar)" },
    { value: "July", label: "July" },
    { value: "October", label: "October" },
  ],
  weekStart: [
    { value: "Monday", label: "Monday" },
    { value: "Sunday", label: "Sunday" },
  ],
  language: [
    { value: "en", label: "English" },
    { value: "hi", label: "हिन्दी (Hindi)" },
    { value: "ta", label: "தமிழ் (Tamil)" },
    { value: "te", label: "తెలుగు (Telugu)" },
  ],
  pageSize: [
    { value: "10", label: "10 rows" },
    { value: "25", label: "25 rows" },
    { value: "50", label: "50 rows" },
    { value: "100", label: "100 rows" },
  ],
  sessionTimeout: [
    { value: "15", label: "15 minutes" },
    { value: "30", label: "30 minutes" },
    { value: "60", label: "60 minutes" },
    { value: "120", label: "2 hours" },
  ],
} as const;

/** Deep clone so the editor never mutates the shared default. */
export function cloneGeneralConfig(): GeneralConfigData {
  return JSON.parse(JSON.stringify(DEFAULT_GENERAL_CONFIG));
}

/* ---------- live, scope-aware singleton store ----------
 * The active general settings (decimals, separators, currency symbol, …) for the
 * signed-in user's CURRENT business + branch. Loaded app-wide by
 * <GeneralConfigLoader /> and re-fetched whenever the business/branch scope
 * changes, so every formatter below reflects the right scope. Components read it
 * reactively through `useGeneralConfig()` / `useFmt()`; non-React code uses the
 * `formatMoney`/`formatQty`/`gField` helpers, which read the same singleton. */
const listeners = new Set<() => void>();
// Immutable snapshot handed to React's useSyncExternalStore — replaced (new
// reference) on every change so subscribed components re-render.
let snapshot: GeneralConfigData = DEFAULT_GENERAL_CONFIG;
function notifyGeneralConfig() {
  snapshot = { fields: { ...DEFAULT_GENERAL_CONFIG.fields }, flags: { ...DEFAULT_GENERAL_CONFIG.flags } };
  listeners.forEach((l) => l());
}
export function subscribeGeneralConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** Stable reference between changes (for useSyncExternalStore getSnapshot). */
export function getGeneralConfigSnapshot(): GeneralConfigData {
  return snapshot;
}

/* ---------- read helpers other modules use ---------- */
export const gField = (n: string) => DEFAULT_GENERAL_CONFIG.fields[n] ?? "";
export const gFlag = (id: string) => !!DEFAULT_GENERAL_CONFIG.flags[id];

export function setGeneralField(n: string, v: string) { DEFAULT_GENERAL_CONFIG.fields[n] = v; notifyGeneralConfig(); }
export function setGeneralFlag(id: string, v: boolean) { DEFAULT_GENERAL_CONFIG.flags[id] = v; notifyGeneralConfig(); }
export function applyGeneralConfig(next: GeneralConfigData) {
  DEFAULT_GENERAL_CONFIG.fields = { ...next.fields };
  DEFAULT_GENERAL_CONFIG.flags = { ...next.flags };
  notifyGeneralConfig();
}

/** Round an amount per the configured rounding method & precision. */
export function roundAmount(n: number): number {
  if (!gFlag("enableRounding")) return n;
  const method = gField("roundingMethod");
  if (method === "none") return n;
  const step = Number(gField("roundingPrecision")) || 1;
  const units = n / step;
  const rounded = method === "up" ? Math.ceil(units) : method === "down" ? Math.floor(units) : Math.round(units);
  return Math.round(rounded * step * 100) / 100;
}

/* ---------- explicit-config formatters (for reports loaded from the API) ---------- */

/** Format a plain number using an explicit config's separator + decimals. */
export function formatNumberWith(cfg: GeneralConfigData, n: number, decimals?: number): string {
  const dp = decimals ?? (Number(cfg.fields.amountDecimals) || 0);
  const sep = cfg.fields.thousandSeparator;
  const locale = sep === "international" ? "en-US" : "en-IN";
  return sep === "none" ? n.toFixed(dp) : n.toLocaleString(locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** Format a quantity using the configured qty decimals + separator. */
export function formatQtyWith(cfg: GeneralConfigData, n: number): string {
  return formatNumberWith(cfg, n, Number(cfg.fields.qtyDecimals) || 0);
}

/** Format money using an explicit config (currency symbol/position + separator). */
export function formatMoneyWith(cfg: GeneralConfigData, n: number): string {
  let body = formatNumberWith(cfg, n);
  const sym = cfg.fields.currencySymbol || "₹";
  body = cfg.fields.currencyPosition === "after" ? `${body}${sym}` : `${sym}${body}`;
  return cfg.flags.showCurrencyCode ? `${body} ${cfg.fields.baseCurrency}` : body;
}

/** Format a number as money per the currency & separator config (singleton). */
export function formatMoney(n: number): string {
  return formatMoneyWith(DEFAULT_GENERAL_CONFIG, n);
}

/** Format a quantity per the qty-decimals + separator config (singleton). */
export function formatQty(n: number): string {
  return formatQtyWith(DEFAULT_GENERAL_CONFIG, n);
}

/** Format a plain number per the separator + decimals config (singleton). */
export function formatNumber(n: number, decimals?: number): string {
  return formatNumberWith(DEFAULT_GENERAL_CONFIG, n, decimals);
}

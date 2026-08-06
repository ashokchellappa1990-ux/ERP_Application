/**
 * DEFAULT_DISPATCH_CONFIG — the single source of truth for the Transport &
 * Vehicle Operations / Dispatch Execution rule engine. The Dispatch
 * Configuration screen (Sales → Dispatch Configuration) edits it; Dispatch
 * Planning/Execution and the gate/weighment/loading chain obey it. Stored per
 * (tenant, business, branch) in `DispatchConfiguration.config`.
 */
export interface TransportConfigData {
  fields: Record<string, string>;
  flags: Record<string, boolean>;
}

export const DEFAULT_DISPATCH_CONFIG: TransportConfigData = {
  fields: {
    dcPrefix: "DC",
    weightTolerancePct: "2",
    salesInvoicePostingMethod: "Manual", // Automatic | Manual
    // Total Invoice Amount rounding (Direct Customer Dispatch's Payment
    // Details section + the posted Sales Invoice + its printed PDF) — the
    // pre-round figure still shows as its own "Total" line above it.
    roundOffNearest: "10", // 1 | 5 | 10 | 50 | 100
    transportCostMethod: "Manual", // Fixed | Per KM | Per KG | Per Ton | Per Trip | Manual
    // Vehicle Gate Entry preloads these two on the add screen (blank = no
    // preload, user picks as before) so most users never have to touch them.
    defaultDispatchType: "", // "" | Customer | StockTransfer | PurchaseReturn | ... (DispatchDocType)
    defaultReferenceType: "", // "" | Sales Order | Direct Customer Dispatch
    // Gate Entry No auto-numbering prefix — e.g. "GATE" -> GATE-00001, or
    // GATE-0826-00001 with gateEntryNoIncludeMonthYear on (see flags below).
    gateEntryPrefix: "GATE",
    // Load & Dispatch No auto-numbering prefix — e.g. "LD" -> LD-00001
    // (docType-specific suffixes like -ST/-PR/-SR still append after this).
    dispatchNoPrefix: "LD",
    // Payment Details section (Direct Customer Dispatch) — Driver Batta is
    // always auto-calculated as (rounded Ton qty) x this rate; rounding always
    // floors partial tons down to the whole number (14.01-14.99 -> 14), the
    // only method currently implemented.
    driverBattaPerTon: "10",
    driverBattaRounding: "floor", // floor | nearest | ceil
    // Transit Pass amount = qty (Ton) x this rate. transitPassQtyMode decides
    // where that qty comes from: Manual (user types it) or AutoNetWeight
    // (defaults to the same Net-Weight-derived Ton figure Driver Batta uses).
    transitPassPerTon: "140",
    transitPassQtyMode: "Manual", // Manual | AutoNetWeight
    // Vehicle Gate Entry's own Item Details section — None hides it entirely,
    // Single limits it to exactly one product (picking a new one replaces the
    // old), Multiple keeps the existing repeatable-row behavior.
    itemCaptureMode: "Multiple", // None | Single | Multiple
    // Weighment Management's Post-Loading Weight — Both shows the Capture
    // Later/Capture Now toggle so the user picks per dispatch; CaptureLater/
    // CaptureNow force one behavior and hide the toggle entirely (CaptureNow
    // still shows the gross-weight input directly, just without the tabs).
    postLoadWeightCaptureMode: "Both", // Both | CaptureLater | CaptureNow
  },
  flags: {
    // When on, the preloaded Dispatch/Reference Type above is shown disabled —
    // the user sees it but can't change it. When off, it's just a starting
    // value they're free to change.
    lockDefaultDispatchType: false,
    lockDefaultReferenceType: false,
    // When off (the default), Vehicle Gate Entry's Item Details captures only
    // the product name — quantity isn't known yet at gate time for bulk
    // material dispatches; it gets derived later from the Post-Loading
    // Weighment's net weight on the Load & Dispatch screen instead.
    captureQtyAtGate: false,
    // When on, the Gate Entry No includes the entry's creation month+year
    // right after the prefix — GATE-0826-00001 (MM+YY) — instead of just
    // GATE-00001, so the running sequence is visually scoped per month.
    gateEntryNoIncludeMonthYear: true,
    // When on, the Total Invoice Amount (Direct Customer Dispatch / Load &
    // Dispatch / posted Sales Invoice / printed PDF) rounds to the nearest
    // roundOffNearest value; the difference posts to the Round Off ledger
    // account exactly like POS billing's own rounding already does.
    roundOffInvoiceTotal: false,
    // General
    enableDispatchPlanning: true,
    enableDispatchExecution: true,
    enableVehicleGateEntry: true,
    enableVehicleGateExit: true,
    enableLoadingConfirmation: true,
    enableVehicleMovementHistory: true,
    enablePartialDispatch: true,
    allowDirectCustomerDispatch: true,
    allowDispatchWithoutSalesOrder: true,
    allowNegativeDispatch: false,
    enableBarcodeScan: true,
    enableQrCodeScan: true,
    enablePhotoAttachment: true,
    enableDigitalSignature: false, // Phase 2
    enableGpsTracking: false, // Phase 2
    enableRouteManagement: true,
    enableDriverManagement: true,
    enableTransportCompanyManagement: true,
    enableVehicleAssignment: true,
    enableMultipleVehiclesPerDispatch: false,
    enableMultipleDrivers: false,
    requireDispatchApproval: false,
    requireGateExitApproval: false,
    requireWeighment: true,
    requireLoadingConfirmation: true,
    requireVehicleAssignmentBeforeDispatch: true,
    requireDeliveryChallanBeforeInvoice: true,
    // Delivery Challan
    generateDcAutomatically: true,
    allowDcEditing: false,
    autoPrintDc: false,
    allowDcReprint: true,
    allowDcCancellation: true,
    // Transport Cost
    enableTransportCost: true,
    includeLoadingCharges: true,
    includeUnloadingCharges: true,
    includeTollCharges: true,
    includeFuelCharges: true,
    includeDriverBata: true,
    includeHelperCharges: true,
    includeMiscCharges: true,
    allowCostEditing: true,
    autoAllocateCostToDispatch: false,
    postTransportCostToFinance: false, // Phase 2 — no GL posting yet
    requireTransportCostApproval: false,
  },
};

/** Deep clone so editable copies never mutate the shared default. */
export function cloneTransportConfig(): TransportConfigData {
  return JSON.parse(JSON.stringify(DEFAULT_DISPATCH_CONFIG));
}

/** Rounds a Ton quantity per the configured method — "floor" treats any
 * fractional part as belonging to the whole number below it (14.01-14.99 ->
 * 14), matching how Driver Batta is meant to charge only for whole tons
 * carried. */
export function roundTonQty(qty: number, method: string): number {
  if (method === "ceil") return Math.ceil(qty);
  if (method === "nearest") return Math.round(qty);
  return Math.floor(qty);
}

/** Driver Batta = (rounded Ton qty) x the configured per-Ton rate. Shared by
 * the client (live display) and the server (authoritative recompute at
 * save time — never trust the client's own arithmetic for money). */
export function computeDriverBatta(cfg: Pick<TransportConfigData, "fields" | "flags">, tonQty: number): number {
  const rate = Number(cfg.fields.driverBattaPerTon) || 0;
  const rounded = roundTonQty(tonQty, cfg.fields.driverBattaRounding || "floor");
  return Math.max(0, rounded) * rate;
}

/** Transit Pass = qty (Ton, manual or auto from Net Weight per
 * transitPassQtyMode) x the configured per-Ton rate. No rounding — unlike
 * Driver Batta, this isn't specified to floor to whole tons. */
export function computeTransitPass(cfg: Pick<TransportConfigData, "fields" | "flags">, tonQty: number): number {
  const rate = Number(cfg.fields.transitPassPerTon) || 0;
  return Math.max(0, tonQty) * rate;
}

/** Rounds the Total Invoice Amount to the configured nearest value (Direct
 * Customer Dispatch's Payment Details, the Load & Dispatch view page, the
 * posted Sale itself, and its printed PDF all call this so they never
 * disagree) — shared by client (live display) and server (authoritative
 * recompute at posting time). Returns the pre-round figure unchanged, plus
 * the signed difference, when the flag is off. */
export function roundInvoiceTotal(cfg: Pick<TransportConfigData, "fields" | "flags">, rawTotal: number): { total: number; roundOff: number } {
  const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
  if (!cfg.flags.roundOffInvoiceTotal) return { total: r2(rawTotal), roundOff: 0 };
  const step = Number(cfg.fields.roundOffNearest) || 10;
  const rounded = Math.round(rawTotal / step) * step;
  return { total: r2(rounded), roundOff: r2(rounded - rawTotal) };
}

/** Builds a Gate Entry No from the configured prefix (+ month/year, if
 * enabled) and a running sequence number — shared by the actual create route
 * and the next-number preview so both always agree on the format. `at`
 * defaults to now; the create route can pass the entry's own creation time. */
export function buildGateEntryNo(cfg: Pick<TransportConfigData, "fields" | "flags">, seq: number, at: Date = new Date()): string {
  const prefix = cfg.fields.gateEntryPrefix?.trim() || "GATE";
  const seqPart = String(seq).padStart(5, "0");
  if (!cfg.flags.gateEntryNoIncludeMonthYear) return `${prefix}-${seqPart}`;
  const mmYY = `${String(at.getMonth() + 1).padStart(2, "0")}${String(at.getFullYear()).slice(-2)}`;
  return `${prefix}-${mmYY}-${seqPart}`;
}

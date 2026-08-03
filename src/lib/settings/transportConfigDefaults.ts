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
    transportCostMethod: "Manual", // Fixed | Per KM | Per KG | Per Ton | Per Trip | Manual
    // Vehicle Gate Entry preloads these two on the add screen (blank = no
    // preload, user picks as before) so most users never have to touch them.
    defaultDispatchType: "", // "" | Customer | StockTransfer | PurchaseReturn | ... (DispatchDocType)
    defaultReferenceType: "", // "" | Sales Order | Direct Customer Dispatch
    // Gate Entry No auto-numbering prefix — e.g. "GATE" -> GATE-00001.
    gateEntryPrefix: "GATE",
    // Load & Dispatch No auto-numbering prefix — e.g. "LD" -> LD-00001
    // (docType-specific suffixes like -ST/-PR/-SR still append after this).
    dispatchNoPrefix: "LD",
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

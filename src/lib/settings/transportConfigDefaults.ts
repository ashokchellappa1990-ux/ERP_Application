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
  },
  flags: {
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

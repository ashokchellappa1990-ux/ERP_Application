import { z } from "zod";

/**
 * Shared contract for Load & Dispatch — the single warehouse-execution screen
 * that replaced Dispatch Execution + Loading Confirmation. Stock Transfer
 * Dispatch (StockTransferDispatch) is no longer a user-facing screen; Load &
 * Dispatch creates it internally for docType=StockTransfer and calls the
 * existing postDispatch() at completion (src/lib/warehouse/dispatch.ts). This
 * module never posts stock/GL itself for any other docType either — see
 * src/lib/transport/loadDispatch.ts for the two integration points that do
 * (postDispatch, createSaleTx).
 */

export type LoadDispatchDocType =
  | "Customer" | "StockTransfer" | "PurchaseReturn" | "SalesReturnPickup"
  | "ProductionTransfer" | "JobWork" | "Others";
export const LOAD_DISPATCH_DOC_TYPES: { value: LoadDispatchDocType; label: string }[] = [
  { value: "Customer", label: "Customer Dispatch" },
  { value: "StockTransfer", label: "Stock Transfer" },
  { value: "PurchaseReturn", label: "Purchase Return" },
  { value: "SalesReturnPickup", label: "Sales Return Pickup" },
  { value: "ProductionTransfer", label: "Production Transfer" },
  { value: "JobWork", label: "Job Work" },
  { value: "Others", label: "Others" },
];

/** Step 1 — Dispatch Source picker (Customer splits into two source types). */
export type LoadDispatchSource =
  | "SALES_ORDER" | "DIRECT_CUSTOMER" | "STOCK_TRANSFER" | "PURCHASE_RETURN"
  | "SALES_RETURN_PICKUP" | "PRODUCTION_TRANSFER" | "JOB_WORK" | "OTHERS";
export const LOAD_DISPATCH_SOURCES: { value: LoadDispatchSource; label: string; docType: LoadDispatchDocType }[] = [
  { value: "SALES_ORDER", label: "Sales Order Based Dispatch", docType: "Customer" },
  { value: "DIRECT_CUSTOMER", label: "Direct Customer Dispatch", docType: "Customer" },
  { value: "STOCK_TRANSFER", label: "Stock Transfer Dispatch", docType: "StockTransfer" },
  { value: "PURCHASE_RETURN", label: "Purchase Return", docType: "PurchaseReturn" },
  { value: "SALES_RETURN_PICKUP", label: "Sales Return Pickup", docType: "SalesReturnPickup" },
  { value: "PRODUCTION_TRANSFER", label: "Production Transfer", docType: "ProductionTransfer" },
  { value: "JOB_WORK", label: "Job Work", docType: "JobWork" },
  { value: "OTHERS", label: "Others", docType: "Others" },
];

export type LoadDispatchStatus = "Draft" | "Ready" | "Loading" | "Dispatched" | "Delivery Challan Generated" | "Sales Invoice Posted" | "Cancelled";

/* ------------------------------------------------------------ item input */
export const loadDispatchItemInput = z.object({
  productId: z.coerce.number().int().positive(),
  productName: z.string().trim().max(250).optional(),
  sku: z.string().trim().max(60).optional().nullable(),
  uom: z.string().trim().max(20).optional().nullable(),
  batchNo: z.string().trim().max(80).optional().nullable(),
  mfgDate: z.string().trim().max(20).optional().nullable(),
  expiryDate: z.string().trim().max(20).optional().nullable(),
  serialNo: z.string().trim().max(120).optional().nullable(),
  allocationLotId: z.coerce.number().int().positive().optional().nullable(),
  allocatedQty: z.coerce.number().min(0).default(0),
  dispatchedQty: z.coerce.number().min(0),
  rate: z.coerce.number().min(0).optional().nullable(),
  // Invoice-grade line detail (mirrors the Sales Invoice item grid). taxPct
  // is normally read from the product master, but can be overridden per line.
  discPct: z.coerce.number().min(0).max(100).optional().nullable(),
  discAmount: z.coerce.number().min(0).default(0),
  taxPct: z.coerce.number().min(0).optional().nullable(),
  qrCode: z.string().trim().max(80).optional().nullable(),
  remarks: z.string().trim().max(300).optional().nullable(),
});

/** Full/Partial/Credit — same terminology as the existing B2B Sales Invoice
 * screen (src/components/sales/B2bInvoiceForm.tsx). Captured at Load & Dispatch
 * creation/edit time; applied when the invoice actually posts (see
 * buildPreparedSale in src/lib/transport/loadDispatch.ts). */
export const paymentCollectionInput = z.object({
  paymentMode: z.enum(["Full", "Partial", "Credit"]).default("Credit"),
  paymentAmount: z.coerce.number().min(0).optional().nullable(),
  paymentMethod: z.string().trim().max(30).optional().nullable(),
  bankId: z.coerce.number().int().positive().optional().nullable(),
  bankName: z.string().trim().max(150).optional().nullable(),
  bankAccount: z.string().trim().max(60).optional().nullable(),
});

/* --------------------------------------------------------- create inputs */
export const loadFromSalesOrderInput = z.object({
  source: z.literal("SALES_ORDER"),
  salesOrderId: z.coerce.number().int().positive(),
  dispatchDate: z.string().trim().min(1),
  warehouse: z.string().trim().max(120).optional().nullable(),
});

export const directCustomerDispatchInput = z.object({
  source: z.literal("DIRECT_CUSTOMER"),
  dispatchDate: z.string().trim().min(1),
  customerId: z.coerce.number().int().positive().optional().nullable(),
  customerName: z.string().trim().max(200).optional().nullable(),
  deliveryAddress: z.string().trim().max(400).optional().nullable(),
  warehouse: z.string().trim().max(120).optional().nullable(),
  // Linking an existing Vehicle Gate Entry auto-loads Transport/Driver details
  // from it (client-side convenience); the server still stores whatever
  // Transport/Driver fields are submitted below, editable independently.
  vehicleGateEntryId: z.coerce.number().int().positive().optional().nullable(),
  transportCompanyId: z.coerce.number().int().positive().optional().nullable(),
  vehicleId: z.coerce.number().int().positive().optional().nullable(),
  vehicleType: z.string().trim().max(60).optional().nullable(),
  driverName: z.string().trim().max(150).optional().nullable(),
  driverMobile: z.string().trim().max(20).optional().nullable(),
  driverLicenseNo: z.string().trim().max(60).optional().nullable(),
  helperName: z.string().trim().max(150).optional().nullable(),
  helperMobile: z.string().trim().max(20).optional().nullable(),
  sealNumber: z.string().trim().max(60).optional().nullable(),
  payment: paymentCollectionInput.optional(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  items: z.array(loadDispatchItemInput).min(1, "Add at least one item"),
});

export const loadFromTransferRequestInput = z.object({
  source: z.literal("STOCK_TRANSFER"),
  transferRequestId: z.coerce.number().int().positive(),
  dispatchDate: z.string().trim().min(1),
});

export const otherDispatchInput = z.object({
  source: z.enum(["PURCHASE_RETURN", "SALES_RETURN_PICKUP", "PRODUCTION_TRANSFER", "JOB_WORK", "OTHERS"]),
  dispatchDate: z.string().trim().min(1),
  partyName: z.string().trim().max(200).optional().nullable(),
  warehouse: z.string().trim().max(120).optional().nullable(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  items: z.array(loadDispatchItemInput).default([]),
});

/* --------------------------------------------------------------- editing */
export const loadDispatchUpdateInput = z.object({
  vehicleGateEntryId: z.coerce.number().int().positive().optional().nullable(),
  transportCompanyId: z.coerce.number().int().positive().optional().nullable(),
  vehicleId: z.coerce.number().int().positive().optional().nullable(),
  vehicleType: z.string().trim().max(60).optional().nullable(),
  driverName: z.string().trim().max(150).optional().nullable(),
  driverMobile: z.string().trim().max(20).optional().nullable(),
  driverLicenseNo: z.string().trim().max(60).optional().nullable(),
  helperName: z.string().trim().max(150).optional().nullable(),
  helperMobile: z.string().trim().max(20).optional().nullable(),
  routeId: z.coerce.number().int().positive().optional().nullable(),
  sealNumber: z.string().trim().max(60).optional().nullable(),
  trailerNumber: z.string().trim().max(40).optional().nullable(),
  containerNumber: z.string().trim().max(40).optional().nullable(),
  loadingBayId: z.coerce.number().int().positive().optional().nullable(),
  supervisor: z.string().trim().max(160).optional().nullable(),
  loadingStart: z.string().trim().optional().nullable(),
  loadingEnd: z.string().trim().optional().nullable(),
  packages: z.coerce.number().int().min(0).optional(),
  pallets: z.coerce.number().int().min(0).optional(),
  remarks: z.string().trim().max(2000).optional().nullable(),
  items: z.array(loadDispatchItemInput).optional(),
  payment: paymentCollectionInput.optional(),
});

export const loadDispatchActionInput = z.object({
  action: z.enum(["start-loading", "complete", "cancel"]),
  remarks: z.string().trim().max(300).optional(),
});

/* -------------------------------------------------------- transport cost */
export const loadDispatchTransportCostInput = z.object({
  transportCompanyId: z.coerce.number().int().positive().optional().nullable(),
  vehicleId: z.coerce.number().int().positive().optional().nullable(),
  distance: z.coerce.number().min(0).default(0),
  freightCharge: z.coerce.number().min(0).default(0),
  loadingCharge: z.coerce.number().min(0).default(0),
  unloadingCharge: z.coerce.number().min(0).default(0),
  fuelCharge: z.coerce.number().min(0).default(0),
  tollCharge: z.coerce.number().min(0).default(0),
  driverAllowance: z.coerce.number().min(0).default(0),
  helperAllowance: z.coerce.number().min(0).default(0),
  otherCharges: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  gstAmount: z.coerce.number().min(0).default(0),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

/* ----------------------------------------------------------------- DTOs */
export interface LoadDispatchRow {
  id: number; dispatchNo: string; docType: LoadDispatchDocType; sourceRefNo: string | null;
  partyName: string | null; warehouse: string | null; vehicleNo: string | null;
  dispatchDate: string; status: LoadDispatchStatus; createdByName: string | null; createdAt: string;
}
export interface LoadDispatchItemDto {
  id: number; productId: number; productName: string; sku: string | null; uom: string | null;
  batchNo: string | null; mfgDate: string | null; expiryDate: string | null; serialNo: string | null;
  allocationLotId: number | null; allocatedQty: number; dispatchedQty: number; pendingQty: number;
  rate: number | null; value: number;
  discPct: number | null; discAmount: number; taxPct: number | null; taxableValue: number; taxAmount: number;
  qrCode: string | null; remarks: string | null;
}
export interface LoadDispatchDetail {
  id: number; dispatchNo: string; dispatchDate: string; docType: LoadDispatchDocType;
  sourceRefType: string | null; sourceRefId: number | null; sourceRefNo: string | null;
  partyType: string | null; partyId: number | null; partyName: string | null;
  deliveryAddress: string | null; warehouse: string | null; destinationWarehouse: string | null;
  vehicleGateEntryId: number | null;
  transportCompanyId: number | null; vehicleId: number | null; vehicleNo: string | null; vehicleType: string | null;
  driverName: string | null; driverMobile: string | null; driverLicenseNo: string | null;
  helperName: string | null; helperMobile: string | null; routeId: number | null;
  sealNumber: string | null; trailerNumber: string | null; containerNumber: string | null;
  loadingBayId: number | null; supervisor: string | null; loadingStart: string | null; loadingEnd: string | null;
  packages: number; pallets: number;
  status: LoadDispatchStatus;
  totalProducts: number; totalQty: number; totalWeight: number | null; totalPackages: number;
  remarks: string | null; cancelReason: string | null;
  deliveryChallanId: number | null; saleId: number | null;
  paymentMode: "Full" | "Partial" | "Credit" | null; paymentAmount: number | null; paymentMethod: string | null;
  bankId: number | null; bankName: string | null; bankAccount: string | null;
  createdByName: string | null; createdAt: string; updatedAt: string;
  items: LoadDispatchItemDto[];
}

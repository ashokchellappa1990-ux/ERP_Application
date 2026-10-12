import { z } from "zod";

/**
 * Shared contract for the POS Terminal registry (Module 1).
 *
 * Identity / mapping / status / key defaults are typed; the long tail of hardware
 * / billing / cash / offline / mobile toggles lives in the `config` JSON blob
 * (typed here as `TerminalConfig` for the client, validated loosely server-side).
 */

export const TERMINAL_TYPES = ["Desktop POS", "Laptop POS", "Mobile POS", "Self Checkout", "Kiosk"] as const;
export type TerminalType = (typeof TERMINAL_TYPES)[number];
export type TerminalStatus = "active" | "inactive";

/* -------------------------------------------------- config blob shape */
export interface TerminalHardware {
  receiptPrinter?: boolean; labelPrinter?: boolean; barcodeScanner?: boolean; qrScanner?: boolean;
  cashDrawer?: boolean; customerDisplay?: boolean; cardMachine?: boolean; weighingScale?: boolean; camera?: boolean;
}
export interface TerminalBilling {
  allowB2c?: boolean; allowB2b?: boolean; allowReturn?: boolean; allowHold?: boolean; allowResume?: boolean;
  allowExchange?: boolean; allowCredit?: boolean; allowManualDiscount?: boolean; allowPriceOverride?: boolean; allowSplitPayment?: boolean;
}
export interface TerminalCash {
  openingCashMandatory?: boolean; closingCashMandatory?: boolean; cashDifferenceLimit?: number;
  cashDepositAllowed?: boolean; cashWithdrawalAllowed?: boolean; pettyCashAllowed?: boolean;
}
export interface TerminalOffline { offlineEnabled?: boolean; offlineTransactionLimit?: number; autoSync?: boolean }
export interface TerminalMobile {
  mobileAllowed?: boolean; deviceRegistrationRequired?: boolean; pushEnabled?: boolean; gpsValidation?: boolean;
  cameraMandatory?: boolean; qrScannerMandatory?: boolean; offlineSyncEnabled?: boolean;
  androidVersion?: string; iosVersion?: string; imei?: string;
}
export interface TerminalConfig {
  hardware?: TerminalHardware;
  billing?: TerminalBilling;
  cash?: TerminalCash;
  offline?: TerminalOffline;
  mobile?: TerminalMobile;
}

/* --------------------------------------------------------- responses */
export interface TerminalRow {
  id: number;
  code: string;
  name: string;
  type: string;
  branchId: number | null;
  warehouse: string;
  status: TerminalStatus;
  createdAt: string;
  openSessionId: number | null; // status dashboard: live open session, if any
  openSessionCashier: string;
}
export interface TerminalListStats { total: number; active: number; inactive: number; online: number }
export interface TerminalListResponse { ok: true; rows: TerminalRow[]; stats: TerminalListStats }

export interface TerminalDetail {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string;
  branchId: number | null;
  warehouse: string;
  defaultCustomerId: number | null;
  receiptTemplateId: number | null;
  defaultWarehouse: string;
  defaultSalesType: string;
  defaultPriceList: string;
  defaultTaxProfile: string;
  invoiceSeries: string;
  ipAddress: string;
  deviceId: string;
  macAddress: string;
  deviceAuthRequired: boolean;
  status: TerminalStatus;
  config: TerminalConfig;
  createdAt: string;
}

/* ---------------------------------------------------------- requests */
export const TerminalCreateSchema = z.object({
  code: z.string().trim().min(1, "Terminal code is required."),
  name: z.string().trim().min(1, "Terminal name is required."),
  type: z.enum(TERMINAL_TYPES).default("Desktop POS"),
  description: z.string().trim().optional(),
  warehouse: z.string().trim().optional(),
  defaultCustomerId: z.coerce.number().int().positive().optional(),
  receiptTemplateId: z.coerce.number().int().positive().optional(),
  defaultWarehouse: z.string().trim().optional(),
  defaultSalesType: z.string().trim().optional(),
  defaultPriceList: z.string().trim().optional(),
  defaultTaxProfile: z.string().trim().optional(),
  invoiceSeries: z.string().trim().optional(),
  ipAddress: z.string().trim().optional(),
  deviceId: z.string().trim().optional(),
  macAddress: z.string().trim().optional(),
  deviceAuthRequired: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  config: z.record(z.string(), z.any()).optional(),
});
export type TerminalCreateInput = z.infer<typeof TerminalCreateSchema>;

export const TerminalUpdateSchema = TerminalCreateSchema.partial();
export type TerminalUpdateInput = z.infer<typeof TerminalUpdateSchema>;

export const TerminalStatusSchema = z.object({ status: z.enum(["active", "inactive"]) });

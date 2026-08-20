import type { Prisma } from "@prisma/client";

/**
 * Chart of Accounts — the system ledger accounts every tenant needs so purchase
 * and sales vouchers always have somewhere to post. Seeded lazily on first use.
 */
export interface SeedAccount {
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Income" | "Expense" | "Equity";
  group: string;
  normalBalance: "Debit" | "Credit";
}

export const SYSTEM_ACCOUNTS: SeedAccount[] = [
  { code: "1000", name: "Cash in Hand", type: "Asset", group: "Current Asset", normalBalance: "Debit" },
  { code: "1010", name: "Bank Account", type: "Asset", group: "Current Asset", normalBalance: "Debit" },
  { code: "1100", name: "Accounts Receivable", type: "Asset", group: "Current Asset", normalBalance: "Debit" },
  { code: "1200", name: "Inventory", type: "Asset", group: "Current Asset", normalBalance: "Debit" },
  { code: "1210", name: "Inventory In-Transit", type: "Asset", group: "Current Asset", normalBalance: "Debit" }, // internal stock transfer (dispatch → receipt)
  { code: "1300", name: "Input GST (ITC)", type: "Asset", group: "Duties & Taxes", normalBalance: "Debit" },
  { code: "1310", name: "TDS Receivable", type: "Asset", group: "Duties & Taxes", normalBalance: "Debit" },
  { code: "1320", name: "TCS Receivable", type: "Asset", group: "Duties & Taxes", normalBalance: "Debit" }, // TCS charged by suppliers on our purchases/expenses
  { code: "2120", name: "TDS Payable", type: "Liability", group: "Duties & Taxes", normalBalance: "Credit" }, // TDS we deduct on expense bills, payable to govt
  { code: "2000", name: "Accounts Payable", type: "Liability", group: "Current Liability", normalBalance: "Credit" },
  { code: "2050", name: "GRN Clearing (Goods Received Not Invoiced)", type: "Liability", group: "Current Liability", normalBalance: "Credit" },
  { code: "2100", name: "Output GST Payable", type: "Liability", group: "Duties & Taxes", normalBalance: "Credit" },
  { code: "2110", name: "TCS Payable", type: "Liability", group: "Duties & Taxes", normalBalance: "Credit" },
  { code: "3000", name: "Sales Revenue", type: "Income", group: "Direct Income", normalBalance: "Credit" },
  { code: "3050", name: "Sales Returns", type: "Income", group: "Direct Income", normalBalance: "Debit" }, // contra-revenue
  { code: "3060", name: "Discount Allowed", type: "Income", group: "Direct Income", normalBalance: "Debit" }, // contra-revenue (bill-level discount)
  { code: "4000", name: "Cost of Goods Sold", type: "Expense", group: "Direct Expense", normalBalance: "Debit" },
  { code: "4200", name: "Indirect Expenses", type: "Expense", group: "Indirect Expense", normalBalance: "Debit" },
  { code: "4300", name: "Service Expense", type: "Expense", group: "Indirect Expense", normalBalance: "Debit" },
  { code: "1500", name: "Fixed Assets", type: "Asset", group: "Fixed Asset", normalBalance: "Debit" },
  { code: "5000", name: "Round Off", type: "Income", group: "Indirect Income", normalBalance: "Credit" },
  { code: "3200", name: "Miscellaneous Income", type: "Income", group: "Indirect Income", normalBalance: "Credit" },
  { code: "3210", name: "Membership Income", type: "Income", group: "Indirect Income", normalBalance: "Credit" },
  { code: "3110", name: "Owner's Capital", type: "Equity", group: "Capital", normalBalance: "Credit" },
  { code: "3210", name: "Rental Income", type: "Income", group: "Indirect Income", normalBalance: "Credit" },
  { code: "3220", name: "Commission Income", type: "Income", group: "Indirect Income", normalBalance: "Credit" },
  { code: "3230", name: "Interest Income", type: "Income", group: "Indirect Income", normalBalance: "Credit" },
  { code: "3240", name: "Scrap Sales", type: "Income", group: "Indirect Income", normalBalance: "Credit" },
  { code: "3250", name: "Insurance Claim Received", type: "Income", group: "Indirect Income", normalBalance: "Credit" },
  { code: "3260", name: "Employee Recovery", type: "Income", group: "Indirect Income", normalBalance: "Credit" },
  { code: "3270", name: "Other Receipts", type: "Income", group: "Indirect Income", normalBalance: "Credit" },
  { code: "4210", name: "Marketing & Promotion Expense", type: "Expense", group: "Indirect Expense", normalBalance: "Debit" },
  { code: "4250", name: "Statutory Interest & Penalty", type: "Expense", group: "Indirect Expense", normalBalance: "Debit" }, // interest/penalty on late GST/TDS/TCS/PF etc. payments
  { code: "2105", name: "Customer Store Credit / Credit Notes", type: "Liability", group: "Current Liability", normalBalance: "Credit" },
  { code: "2130", name: "Loyalty Points Liability", type: "Liability", group: "Current Liability", normalBalance: "Credit" },
  { code: "2140", name: "Gift Voucher Liability", type: "Liability", group: "Current Liability", normalBalance: "Credit" },
  { code: "4400", name: "Loyalty Points Expense", type: "Expense", group: "Indirect Expense", normalBalance: "Debit" },
  { code: "3100", name: "Opening Balance Equity", type: "Equity", group: "Capital", normalBalance: "Credit" },
  // --- Advance Management control accounts ---
  { code: "2150", name: "Advance from Customers", type: "Liability", group: "Current Liability", normalBalance: "Credit" },
  { code: "2160", name: "Security Deposits Received", type: "Liability", group: "Current Liability", normalBalance: "Credit" },
  { code: "1150", name: "Advance to Suppliers", type: "Asset", group: "Current Asset", normalBalance: "Debit" },
  { code: "1160", name: "Advance to Employees", type: "Asset", group: "Current Asset", normalBalance: "Debit" },
  { code: "1170", name: "Security Deposits Paid", type: "Asset", group: "Current Asset", normalBalance: "Debit" },
  // --- Dispatch operational-charge recoveries (Load & Dispatch) ---
  { code: "3280", name: "Transit Pass Recovery", type: "Income", group: "Operating Income", normalBalance: "Credit" },
  { code: "3290", name: "Vehicle Rent Recovery", type: "Income", group: "Operating Income", normalBalance: "Credit" },
  // --- Dispatch & Sales Accounting engine (configurable dual-stage posting) ---
  { code: "2170", name: "Dispatch Clearing Liability", type: "Liability", group: "Current Liability", normalBalance: "Credit" },
  { code: "4410", name: "Driver Batta Expense", type: "Expense", group: "Indirect Expense", normalBalance: "Debit" },
  { code: "4420", name: "Vehicle Rent Expense", type: "Expense", group: "Indirect Expense", normalBalance: "Debit" },
  { code: "3295", name: "Operating Charges Recovery", type: "Income", group: "Operating Income", normalBalance: "Credit" },
  { code: "4430", name: "Operating Expense — Dispatch", type: "Expense", group: "Indirect Expense", normalBalance: "Debit" },
  { code: "4440", name: "Fuel Expense", type: "Expense", group: "Indirect Expense", normalBalance: "Debit" },
];

// Convenient code constants used by the posting routines.
export const ACC = {
  CASH: "1000", BANK: "1010", RECEIVABLE: "1100", INVENTORY: "1200", INVENTORY_IN_TRANSIT: "1210", INPUT_GST: "1300", TDS_RECEIVABLE: "1310", TCS_RECEIVABLE: "1320", TDS_PAYABLE: "2120",
  PAYABLE: "2000", GRN_CLEARING: "2050", OUTPUT_GST: "2100", TCS_PAYABLE: "2110", STORE_CREDIT: "2105", LOYALTY_LIABILITY: "2130", GIFT_VOUCHER_LIABILITY: "2140", OPENING_EQUITY: "3100", SALES: "3000", SALES_RETURN: "3050", SALES_DISCOUNT: "3060", COGS: "4000", INDIRECT_EXPENSE: "4200", SERVICE_EXPENSE: "4300", LOYALTY_EXPENSE: "4400", FIXED_ASSET: "1500", ROUND_OFF: "5000", MISC_INCOME: "3200", MARKETING_EXPENSE: "4210", MEMBERSHIP_INCOME: "3210", STATUTORY_PENALTY: "4250",
  CUSTOMER_ADVANCE: "2150", DEPOSIT_RECEIVED: "2160", SUPPLIER_ADVANCE: "1150", EMPLOYEE_ADVANCE: "1160", DEPOSIT_PAID: "1170",
  TRANSIT_PASS_RECOVERY: "3280", VEHICLE_RENT_RECOVERY: "3290",
  DISPATCH_CLEARING_LIABILITY: "2170", DRIVER_BATTA_EXPENSE: "4410", VEHICLE_RENT_EXPENSE: "4420",
  OPERATING_CHARGES_RECOVERY: "3295", OPERATING_EXPENSE_DISPATCH: "4430", FUEL_EXPENSE: "4440",
} as const;

/** The Dr account for a direct purchase bill, by purchase type. */
export function purchaseTypeAccount(type: string | null | undefined): string {
  switch ((type ?? "Inventory")) {
    case "Expense": return ACC.INDIRECT_EXPENSE;
    case "Service": return ACC.SERVICE_EXPENSE;
    case "Asset": return ACC.FIXED_ASSET;
    case "Inventory":
    default: return ACC.INVENTORY;
  }
}

/** Seed any missing system accounts for a tenant and return a code → id map.
 * Batched via createMany (2 round trips total) rather than one create per
 * missing account — a fresh tenant with none of the ~45 SYSTEM_ACCOUNTS seeded
 * yet was doing 45 sequential round trips against the remote RDS instance,
 * which alone could exceed even a generous interactive-transaction timeout
 * (observed P2028 "expired transaction" during Load & Dispatch's Post Sales
 * Invoice — first invoice ever posted for that tenant/business). */
export async function ensureAccounts(tx: Prisma.TransactionClient, tenantId: number): Promise<Map<string, number>> {
  const existing = await tx.ledgerAccount.findMany({ where: { tenantId }, select: { id: true, code: true } });
  const map = new Map(existing.map((a) => [a.code, a.id]));
  const missing = SYSTEM_ACCOUNTS.filter((a) => !map.has(a.code));
  if (missing.length) {
    await tx.ledgerAccount.createMany({
      data: missing.map((a) => ({ tenantId, code: a.code, name: a.name, type: a.type, group: a.group, normalBalance: a.normalBalance, isSystem: true })),
      skipDuplicates: true,
    });
    const created = await tx.ledgerAccount.findMany({ where: { tenantId, code: { in: missing.map((a) => a.code) } }, select: { id: true, code: true } });
    for (const c of created) map.set(c.code, c.id);
  }
  return map;
}

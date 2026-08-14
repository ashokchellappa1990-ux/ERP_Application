/**
 * Server-safe field maps for Product Master persistence. Column names match the
 * UI field names (ProductFormData.fields) so mapping stays generic. No JSON —
 * every value goes into its own column.
 */

// Stored as VARCHAR
export const PRODUCT_STRING_FIELDS = [
  // General
  "code", "name", "shortName", "altName", "status", "keywords", "description",
  // Classification
  "industry", "productType", "inventoryCategory", "category", "subCategory", "group", "brand", "manufacturer", "family", "segment",
  // UOM / packaging
  "baseUom", "purchaseUom", "salesUom", "packageType", "weightUnit",
  // Codes
  "sku", "gtin", "upc", "ean", "isbn", "mpn", "internalCode",
  "barcodeType", "barcodePrefix", "qrTemplate",
  // Tax
  "taxPref", "gstRate", "hsn", "sac",
  // Accounting
  "salesRevenueAcct", "salesInventoryAcct", "purchaseExpenseAcct", "purchaseInventoryAcct",
  "costCenter", "profitCenter", "salesDesc", "purchaseDesc",
  // Expiry
  "shelfLifeType", "alertUnit",
  // Inventory valuation
  "valuation", "batchSalesPolicy",
  // Purchase
  "preferredSupplier",
] as const;

// Stored as VARCHAR (date strings "YYYY-MM-DD")
export const PRODUCT_DATE_FIELDS = ["launchDate", "discontinuedDate"] as const;

// Stored as DECIMAL
export const PRODUCT_DECIMAL_FIELDS = [
  "height", "width", "length", "volume", "netWeight", "grossWeight",
  "stdPurchasePrice", "lastPurchasePrice", "mrp", "retailPrice", "wholesalePrice",
  "distributorPrice", "dealerPrice", "franchisePrice", "onlinePrice", "localPrice", "interstatePrice",
  "openingQty", "openingValue", "minStock", "maxStock", "reorderLevel", "safetyStock",
] as const;

// Stored as INT
export const PRODUCT_INT_FIELDS = [
  "unitsPerCase", "barcodeLength", "shelfLifeValue", "alertValue", "leadTime", "purchaseLeadTime",
] as const;

// [column, toggleGroup, toggleId]
export const PRODUCT_TOGGLE_COLS: [string, string, string][] = [
  ["invStockMaintenance", "inventoryTracking", "stockMaintenance"],
  ["invBatch", "inventoryTracking", "batch"],
  ["invLot", "inventoryTracking", "lot"],
  ["invSerial", "inventoryTracking", "serial"],
  ["invMfg", "inventoryTracking", "mfg"],
  ["invExpiry", "inventoryTracking", "expiry"],
  ["invWarranty", "inventoryTracking", "warranty"],
  ["invTrace", "inventoryTracking", "trace"],
  ["ctrlNegative", "inventoryControls", "negative"],
  ["ctrlBackorder", "inventoryControls", "backorder"],
  ["ctrlReservation", "inventoryControls", "reservation"],
  ["ctrlBlocking", "inventoryControls", "blocking"],
  ["salesAllowed", "sales", "salesAllowed"],
  ["salesReturnAllowed", "sales", "salesReturn"],
  ["bulkSales", "sales", "bulkSales"],
  ["creditSales", "sales", "creditSales"],
  ["discountAllowed", "sales", "discountAllowed"],
  ["ageRestricted", "salesControls", "ageRestricted"],
  ["specialApproval", "salesControls", "specialApproval"],
  ["rxPrescription", "pharmacy", "prescription"],
  ["rxSchedule", "pharmacy", "schedule"],
  ["rxBatchMandatory", "pharmacy", "batchMandatory"],
  ["rxExpiryMandatory", "pharmacy", "expiryMandatory"],
  ["rxDrugLicense", "pharmacy", "drugLicense"],
];

// [column, flagId]
export const PRODUCT_FLAG_COLS: [string, string][] = [
  ["autoBarcode", "autoBarcode"],
  ["qrRequired", "qrRequired"],
  ["expiryApplicable", "expiryApplicable"],
  ["purchaseAllowed", "purchaseAllowed"],
  ["maxDiscountEnabled", "maxDiscountEnabled"],
];

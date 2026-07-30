import {
  Store,
  Building2,
  ScanLine,
  Barcode,
  QrCode,
  CalendarClock,
  Hash,
  Users,
  UserCheck,
  IndianRupee,
  Percent,
  Receipt,
  CreditCard,
  Gift,
  GitBranch,
  FileText,
  Monitor,
  Bell,
  Sparkles,
  ScrollText,
  Undo2,
  Repeat,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/* ============================================================= types === */
export interface SField {
  name: string;
  label: string;
  icon?: LucideIcon;
  info?: string;
  sample?: string;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  full?: boolean;
}
export interface SToggle { id: string; label: string; desc?: string; }
export interface SFlag { id: string; label: string; desc?: string; }
export interface SalesTab { id: string; label: string; icon: LucideIcon; group: string; }

/* ================================================================ tabs == */
export const SALES_TABS: SalesTab[] = [
  { id: "mode", label: "Business Mode", icon: Store, group: "Setup" },
  { id: "channel", label: "Sales Channels", icon: Building2, group: "Setup" },
  { id: "product", label: "Product Selection", icon: ScanLine, group: "Identification" },
  { id: "barcode", label: "Barcode", icon: Barcode, group: "Identification" },
  { id: "qr", label: "QR Code", icon: QrCode, group: "Identification" },
  { id: "b2c", label: "B2C Configuration", icon: Users, group: "Customer" },
  { id: "b2b", label: "B2B Configuration", icon: UserCheck, group: "Customer" },
  { id: "pricing", label: "Pricing", icon: IndianRupee, group: "Commercials" },
  { id: "credit", label: "Credit Sales", icon: CreditCard, group: "Commercials" },
  { id: "approval", label: "Approval Workflow", icon: GitBranch, group: "Workflow" },
  { id: "invoice", label: "Invoice", icon: FileText, group: "Workflow" },
  { id: "return", label: "Sales Return", icon: Undo2, group: "Workflow" },
  { id: "exchange", label: "Sales Exchange", icon: Repeat, group: "Workflow" },
  { id: "cancellation", label: "Sales Cancellation", icon: XCircle, group: "Workflow" },
  { id: "pos", label: "POS Screen", icon: Monitor, group: "Experience" },
  { id: "notification", label: "Notifications", icon: Bell, group: "Experience" },
  { id: "ai", label: "AI Sales", icon: Sparkles, group: "Intelligence" },
  { id: "audit", label: "Audit Trail", icon: ScrollText, group: "Intelligence" },
];

/* ============================================== sales return config ===== */
export const RETURN_GENERAL_FLAGS: SFlag[] = [
  { id: "returnAllowed", label: "Return Allowed", desc: "Master switch — allow sales returns at all." },
  { id: "returnWithoutInvoice", label: "Return Without Invoice", desc: "Permit returns when the original invoice can't be found." },
  { id: "qrReturnEnabled", label: "QR Code Based Return", desc: "Scan a product / invoice QR to auto-load the original sale." },
];
export const RETURN_REASON_FLAGS: SFlag[] = [
  { id: "reasonMandatory", label: "Reason Mandatory", desc: "A return reason must be picked for every returned line." },
  { id: "allowCustomReason", label: "Allow Custom Reason", desc: "Let the user type a free-text reason in addition to the list." },
];
export const RETURN_REFUND_FLAGS: SFlag[] = [
  { id: "refundEnabled", label: "Enable Refund", desc: "Settle a monetary refund / credit on return." },
];
export const RETURN_HANDLING_FLAGS: SFlag[] = [
  { id: "inventoryHandlingEnabled", label: "Enable Inventory Handling Selection", desc: "Ask how each returned item re-enters stock (good / damaged / expired / vendor / scrap)." },
];
export const RETURN_APPROVAL_FLAGS: SFlag[] = [
  { id: "approvalEnabled", label: "Enable Approval Workflow", desc: "Returns above the auto-approve limit need approval before posting." },
];
export const RETURN_SEARCH_TOGGLES: SToggle[] = [
  { id: "invoiceNo", label: "Invoice Number" },
  { id: "mobile", label: "Customer Mobile Number" },
  { id: "name", label: "Customer Name" },
  { id: "barcode", label: "Barcode" },
  { id: "qrCode", label: "QR Code" },
];
export const REFUND_MODE_TOGGLES: SToggle[] = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "bank", label: "Bank Transfer" },
  { id: "storeCredit", label: "Store Credit" },
  { id: "creditNote", label: "Credit Note" },
];
export const INVENTORY_HANDLING_TOGGLES: SToggle[] = [
  { id: "good", label: "Good Condition", desc: "Add back to sellable inventory." },
  { id: "damaged", label: "Damaged", desc: "Move to Damage inventory." },
  { id: "expired", label: "Expired", desc: "Move to Expired inventory." },
  { id: "vendor", label: "Vendor Return", desc: "Move to Vendor-Return inventory." },
  { id: "scrap", label: "Scrap", desc: "Move to Scrap inventory." },
];
export const RETURN_APPROVAL_BASIS: SToggle[] = [
  { id: "amount", label: "Return Amount" },
  { id: "qty", label: "Return Quantity" },
  { id: "reason", label: "Return Reason" },
];
export const MAX_RETURN_PERIOD_OPTS = [
  { value: "7", label: "7 Days" },
  { value: "15", label: "15 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
  { value: "unlimited", label: "Unlimited" },
];

/* ============================================ sales exchange config ===== */
export const EXCHANGE_GENERAL_FLAGS: SFlag[] = [
  { id: "exchangeAllowed", label: "Enable Sales Exchange", desc: "Master switch — allow product exchanges at all." },
  { id: "allowB2cExchange", label: "Allow B2C Exchange", desc: "Permit exchanges on retail / walk-in invoices." },
  { id: "allowB2bExchange", label: "Allow B2B Exchange", desc: "Permit exchanges on business invoices." },
  { id: "allowPartialExchange", label: "Allow Partial Exchange", desc: "Exchange only some of the sold quantity of a line." },
  { id: "allowFullExchange", label: "Allow Full Exchange", desc: "Exchange the entire sold quantity." },
  { id: "allowMultipleExchange", label: "Allow Multiple Exchanges Per Invoice", desc: "Permit more than one exchange against the same invoice." },
  { id: "exchangeWithoutInvoice", label: "Allow Exchange Without Invoice", desc: "Permit exchanges when the original invoice can't be found." },
];
export const EXCHANGE_SEARCH_TOGGLES: SToggle[] = [
  { id: "invoiceNo", label: "Invoice Number" },
  { id: "mobile", label: "Customer Mobile Number" },
  { id: "name", label: "Customer Name" },
  { id: "qrCode", label: "QR Code" },
  { id: "barcode", label: "Barcode" },
  { id: "salesOrderNo", label: "Sales Order Number" },
];
export const EXCHANGE_PRODUCT_FLAGS: SFlag[] = [
  { id: "productMustMatch", label: "Product Must Match Original Invoice", desc: "New item must be the same product as the returned one." },
  { id: "allowDifferentProduct", label: "Allow Different Product Exchange", desc: "Exchange against a completely different product." },
  { id: "allowSameProduct", label: "Allow Same Product Exchange", desc: "Exchange for the same product (e.g. fresh piece)." },
  { id: "allowDifferentSize", label: "Allow Different Size", desc: "Permit a different size variant." },
  { id: "allowDifferentColour", label: "Allow Different Colour", desc: "Permit a different colour variant." },
  { id: "allowDifferentVariant", label: "Allow Different Variant", desc: "Permit any other variant attribute." },
  { id: "allowDifferentBatch", label: "Allow Different Batch", desc: "Permit a different batch of the product." },
  { id: "allowDifferentSerial", label: "Allow Different Serial Number", desc: "Permit a different serial / IMEI." },
];
export const EXCHANGE_QTY_FLAGS: SFlag[] = [
  { id: "partialQtyAllowed", label: "Partial Quantity Allowed", desc: "Allow exchanging a fraction of the line quantity." },
  { id: "fullQtyMandatory", label: "Full Quantity Mandatory", desc: "Require the whole sold quantity to be exchanged." },
  { id: "multipleExchangeAllowed", label: "Multiple Exchange Allowed", desc: "Allow the same line to be exchanged across several documents." },
];
export const EXCHANGE_PRICE_FLAGS: SFlag[] = [
  { id: "allowPriceDifference", label: "Allow Price Difference", desc: "Permit the new item to differ in value from the old." },
  { id: "autoCalcDifference", label: "Auto Calculate Difference", desc: "Compute collect / refund automatically." },
  { id: "refundIfLower", label: "Refund If New Item Is Lower", desc: "Refund the difference when the new item is cheaper." },
  { id: "collectIfHigher", label: "Additional Collection If Higher", desc: "Collect the difference when the new item is dearer." },
  { id: "ignorePriceDifference", label: "Ignore Price Difference", desc: "Even exchange — never settle a difference." },
];
export const EXCHANGE_HANDLING_TOGGLES: SToggle[] = [
  { id: "good", label: "Good Condition", desc: "Return to sellable inventory." },
  { id: "damaged", label: "Damaged", desc: "Move to Damage inventory." },
  { id: "quarantine", label: "Quarantine", desc: "Move to Quarantine for inspection." },
];
export const EXCHANGE_HANDLING_FLAGS: SFlag[] = [
  { id: "qualityInspectionRequired", label: "Quality Inspection Required", desc: "Returned items go to quarantine for QC before re-stocking." },
];
export const EXCHANGE_APPROVAL_FLAGS: SFlag[] = [
  { id: "exchangeApprovalEnabled", label: "Enable Approval Workflow", desc: "Exchanges above the auto-approve limit need manager approval before posting." },
];
export const EXCHANGE_APPROVAL_BASIS: SToggle[] = [
  { id: "amount", label: "Price Difference Amount" },
  { id: "days", label: "Days Since Sale" },
  { id: "category", label: "Product Category" },
];
export const EXCHANGE_SETTLEMENT_TOGGLES: SToggle[] = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "card", label: "Card" },
  { id: "creditNote", label: "Credit Note" },
  { id: "storeCredit", label: "Store Credit" },
  { id: "wallet", label: "Wallet" },
];
export const EXCHANGE_PERIOD_BASIS_OPTS = [
  { value: "invoiceDate", label: "Invoice Date" },
  { value: "deliveryDate", label: "Delivery Date" },
];
export const EXCHANGE_VALIDITY_OPTS = [
  { value: "7", label: "7 Days" },
  { value: "15", label: "15 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
  { value: "unlimited", label: "Unlimited" },
];
export const EXCHANGE_PRICE_BASIS_OPTS = [
  { value: "current", label: "Current Price" },
  { value: "original", label: "Original Invoice Price" },
];

/* ===================================================== business modes == */
export interface BusinessMode { value: string; label: string; desc: string; }
export const BUSINESS_MODES: BusinessMode[] = [
  { value: "retail", label: "Retail", desc: "B2C counter & POS billing with MRP/retail pricing." },
  { value: "wholesale", label: "Wholesale", desc: "B2B billing, credit, contract & slab pricing." },
  { value: "retail_wholesale", label: "Retail + Wholesale", desc: "Both B2C and B2B in one outlet." },
  { value: "pharmacy", label: "Pharmacy", desc: "Batch + expiry mandatory, FEFO, schedule drugs." },
  { value: "electronics", label: "Electronics", desc: "Serial/IMEI tracking, warranty, dealer pricing." },
  { value: "textile", label: "Textile", desc: "Size/colour matrix, barcode, season pricing." },
  { value: "multistore", label: "Multi Store Chain", desc: "Branch-wise numbering, central pricing & stock." },
];

/* ========================================================= toggle sets == */
export const CHANNELS: SToggle[] = [
  { id: "b2c", label: "B2C Sales", desc: "Walk-in retail customers." },
  { id: "b2b", label: "B2B Sales", desc: "Registered business customers." },
  { id: "counter", label: "Counter Sales", desc: "In-store POS counter." },
  { id: "online", label: "Online Sales", desc: "Web / e-commerce orders." },
  { id: "mobile", label: "Mobile Sales", desc: "Mobile app / field sales." },
  { id: "tele", label: "Tele Sales", desc: "Phone / call-centre orders." },
];
export const PRODUCT_METHODS: SToggle[] = [
  { id: "name", label: "Product Name Search" },
  { id: "code", label: "Product Code Search" },
  { id: "sku", label: "SKU Search" },
  { id: "barcode", label: "Barcode Scan" },
  { id: "qr", label: "QR Code Scan" },
  { id: "serial", label: "Serial Number Scan" },
  { id: "batchNo", label: "Batch Number Search" },
  { id: "image", label: "Product Image Selection" },
  { id: "grid", label: "Touch POS Product Grid" },
];
export const BARCODE_TYPES: SToggle[] = [
  { id: "ean", label: "EAN" }, { id: "upc", label: "UPC" }, { id: "gs1", label: "GS1" },
  { id: "code128", label: "CODE128" }, { id: "custom", label: "Custom Barcode" },
];
export const QR_CONTAINS: SToggle[] = [
  { id: "code", label: "Product Code" }, { id: "name", label: "Product Name" },
  { id: "batch", label: "Batch Number" }, { id: "expiry", label: "Expiry Date" },
  { id: "mfg", label: "Manufacturing Date" }, { id: "mrp", label: "MRP" },
  { id: "serial", label: "Serial Number" }, { id: "gst", label: "GST Information" },
];
export const QR_ACTIONS: SToggle[] = [
  { id: "autoAdd", label: "Auto Add Product" }, { id: "autoBatch", label: "Auto Select Batch" },
  { id: "autoExpiry", label: "Auto Validate Expiry" }, { id: "autoPrice", label: "Auto Fetch Price" },
];
export const SERIAL_CATEGORIES: SToggle[] = [
  { id: "mobile", label: "Mobile" }, { id: "electronics", label: "Electronics" }, { id: "appliances", label: "Appliances" },
];
export const DISCOUNT_SOURCES: SToggle[] = [
  { id: "product", label: "Product Discount" }, { id: "category", label: "Category Discount" },
  { id: "brand", label: "Brand Discount" }, { id: "customer", label: "Customer Discount" },
  { id: "customerGroup", label: "Customer Group Discount" }, { id: "coupon", label: "Coupon Discount" },
  { id: "loyalty", label: "Loyalty Discount" }, { id: "invoice", label: "Invoice Discount" },
];
export const APPROVAL_FOR: SToggle[] = [
  { id: "discount", label: "Discount Override" }, { id: "price", label: "Price Override" },
  { id: "credit", label: "Credit Override" }, { id: "stock", label: "Stock Override" },
  { id: "expired", label: "Expired Product Sale" },
];
export const PRINT_FORMATS: SToggle[] = [
  { id: "thermal", label: "Thermal (2/3 inch)" }, { id: "a4", label: "A4" }, { id: "custom", label: "Custom" },
];
export const DELIVERY_OPTIONS: SToggle[] = [
  { id: "immediate", label: "Immediate Delivery" }, { id: "partial", label: "Partial Delivery" },
  { id: "scheduled", label: "Scheduled Delivery" }, { id: "challan", label: "Delivery Challan" },
  { id: "pod", label: "Proof of Delivery" },
];
export const POS_SCREEN: SToggle[] = [
  { id: "customerPanel", label: "Customer Panel" }, { id: "stockVisibility", label: "Stock Visibility" },
  { id: "discountColumn", label: "Discount Column" }, { id: "taxColumn", label: "Tax Column" },
  { id: "loyaltyPanel", label: "Loyalty Panel" }, { id: "productImage", label: "Product Image" },
  { id: "productStock", label: "Product Stock" }, { id: "quickKeys", label: "Quick Keys" },
  { id: "touchMode", label: "Touch POS Mode" }, { id: "darkMode", label: "Dark Mode" },
];
export const NOTIFICATIONS: SToggle[] = [
  { id: "invoiceSms", label: "Invoice SMS" }, { id: "invoiceEmail", label: "Invoice Email" },
  { id: "whatsapp", label: "WhatsApp Invoice" }, { id: "loyaltyNotif", label: "Loyalty Notification" },
  { id: "paymentReminder", label: "Payment Reminder" }, { id: "creditReminder", label: "Credit Reminder" },
];
export const AI_FEATURES: SToggle[] = [
  { id: "productRec", label: "AI Product Recommendation" }, { id: "upsell", label: "AI Upselling" },
  { id: "crossSell", label: "AI Cross Selling" }, { id: "customerRec", label: "AI Customer Recommendation" },
  { id: "discountSuggest", label: "AI Discount Suggestion" }, { id: "nearExpiry", label: "AI Near-Expiry Clearance" },
];

/* ============================================================ flag sets == */
export const BATCH_FLAGS: SFlag[] = [
  { id: "allowManualBatchOverride", label: "Allow Manual Batch Override", desc: "Cashier may override the auto-picked batch." },
];
export const EXPIRY_FLAGS: SFlag[] = [
  { id: "allowExpiredSales", label: "Allow Expired Product Sales", desc: "Block by default; enable only with approval." },
  { id: "nearExpiryDiscount", label: "Near-Expiry Discount Integration", desc: "Auto-apply markdown from Discount Master." },
];
export const SERIAL_FLAGS: SFlag[] = [
  { id: "dupSerialValidation", label: "Duplicate Serial Validation", desc: "Reject a serial already sold/in stock." },
  { id: "warrantyIntegration", label: "Warranty Integration", desc: "Register warranty on serial sale." },
];
export const BARCODE_FLAGS: SFlag[] = [
  { id: "enableBarcode", label: "Enable Barcode Billing" },
  { id: "dupBarcodeValidation", label: "Duplicate Barcode Validation" },
  { id: "barcodeMandatory", label: "Barcode Mandatory" },
];
export const B2C_FLAGS: SFlag[] = [
  { id: "walkInAllowed", label: "Walk-In Customer Allowed" },
  { id: "custRegRequired", label: "Customer Registration Required" },
  { id: "mobileMandatoryB2c", label: "Mobile Number Mandatory" },
  { id: "gstMandatoryB2c", label: "GST Number Mandatory" },
  { id: "allowQuickCustomer", label: "Allow Quick Customer Creation" },
];
/** Fields captured when adding a new walk-in customer at the POS — drives campaigns & tier discounts. */
export const B2C_CUSTOMER_FIELDS: SToggle[] = [
  { id: "name", label: "Customer Name" },
  { id: "mobile", label: "Mobile Number", desc: "SMS / WhatsApp campaigns." },
  { id: "email", label: "Email", desc: "Email campaigns." },
  { id: "dob", label: "Date of Birth", desc: "Birthday offers & messages." },
  { id: "anniversary", label: "Marriage / Anniversary Date", desc: "Anniversary offers & messages." },
  { id: "gender", label: "Gender", desc: "Targeted segmentation." },
  { id: "address", label: "Address" },
  { id: "pincode", label: "Pincode / Area", desc: "Area-wise targeting." },
  { id: "group", label: "Customer Group / Tier", desc: "Drives special / tier discounts." },
  { id: "gst", label: "GSTIN" },
];
export const B2B_FLAGS: SFlag[] = [
  { id: "custMasterMandatory", label: "Customer Master Mandatory" },
  { id: "gstMandatoryB2b", label: "GST Number Mandatory" },
  { id: "creditLimitValidationB2b", label: "Credit Limit Validation" },
  { id: "outstandingValidationB2b", label: "Outstanding Validation" },
  { id: "contractPricing", label: "Contract Pricing" },
  { id: "custSpecificPricing", label: "Customer-Specific Pricing" },
  { id: "soMandatory", label: "Sales Order Mandatory Before Invoice" },
];
export const PRICING_FLAGS: SFlag[] = [
  { id: "allowPriceOverride", label: "Allow Price Override" },
  { id: "priceOverrideApproval", label: "Approval Required for Price Override" },
];
/** Price-source priority (waterfall) evaluated at billing — Product Master is always the fallback. */
export const PRICE_SOURCE_TOGGLES: SToggle[] = [
  { id: "promotion", label: "Promotion Price", desc: "1 · Active promotion / scheme price." },
  { id: "customer", label: "Customer Price", desc: "2 · Customer-specific / contract price." },
  { id: "batch", label: "Batch Price", desc: "3 · GRN batch-wise price." },
  { id: "branch", label: "Branch Price", desc: "4 · Branch-level override." },
  { id: "product", label: "Product Master Price", desc: "5 · Default tier price (always on)." },
];
export const DISCOUNT_FLAGS: SFlag[] = [
  { id: "allowDiscounts", label: "Allow Discounts" },
];
export const TAX_FLAGS: SFlag[] = [
  { id: "eInvoice", label: "E-Invoice (IRN) Integration" },
  { id: "eWayBill", label: "E-Way Bill Integration" },
];
export const CREDIT_FLAGS: SFlag[] = [
  { id: "allowCreditSales", label: "Allow Credit Sales" },
  { id: "creditLimitCheck", label: "Credit Limit Check" },
  { id: "outstandingCheck", label: "Outstanding Check" },
  { id: "creditApprovalWorkflow", label: "Credit Approval Workflow" },
];
export const LOYALTY_FLAGS: SFlag[] = [
  { id: "enableLoyalty", label: "Enable Loyalty" },
  { id: "tierBenefits", label: "Tier-Based Benefits" },
  { id: "birthdayBenefits", label: "Birthday Benefits" },
  { id: "specialCustomerBenefits", label: "Special Customer Benefits" },
];
export const INVOICE_FLAGS: SFlag[] = [
  { id: "autoNumbering", label: "Auto Number Generation", desc: "System generates the next bill number automatically." },
  { id: "branchWiseNumbering", label: "Branch-Wise Sequence", desc: "Maintain a separate running number per branch." },
  { id: "separateB2bSequence", label: "Separate B2B Sequence", desc: "B2B invoices run on their own number series." },
  { id: "lockOnReset", label: "Lock Old Series on Reset", desc: "Prevent back-dated bills into a closed period." },
];

/* ============================================================ options === */
export const TRISTATE_OPTS = [
  { value: "mandatory", label: "Mandatory" }, { value: "optional", label: "Optional" }, { value: "not_required", label: "Not Required" },
];
export const EXPIRY_VALIDATION_OPTS = [
  { value: "mandatory", label: "Mandatory" }, { value: "optional", label: "Optional" }, { value: "not_applicable", label: "Not Applicable" },
];
export const BATCH_SELECTION_OPTS = [
  { value: "FIFO", label: "FIFO — First In First Out" }, { value: "FEFO", label: "FEFO — First Expiry First Out" }, { value: "manual", label: "Manual Selection" },
];
export const NEAR_EXPIRY_OPTS = [
  { value: "7", label: "7 Days" }, { value: "15", label: "15 Days" }, { value: "30", label: "30 Days" }, { value: "60", label: "60 Days" }, { value: "90", label: "90 Days" },
];
export const INVENTORY_METHODS = [
  { value: "FIFO", label: "FIFO" }, { value: "FEFO", label: "FEFO" }, { value: "LIFO", label: "LIFO" },
  { value: "moving_avg", label: "Moving Average" }, { value: "manual", label: "Manual Selection" },
];
export const PRICE_SOURCES = [
  { value: "mrp", label: "MRP" }, { value: "retail", label: "Retail Price" }, { value: "wholesale", label: "Wholesale Price" },
  { value: "dealer", label: "Dealer Price" }, { value: "distributor", label: "Distributor Price" }, { value: "contract", label: "Contract Price" },
];
/** Where the effective MRP / selling price is fetched from. */
export const MRP_SOURCE_OPTS = [
  { value: "product_master", label: "Product Master (Standard)" },
  { value: "grn_batch", label: "GRN / Batch Based" },
  { value: "pricing_config", label: "Common Pricing Config Master" },
  { value: "last_purchase", label: "Last Purchase Price" },
  { value: "manual", label: "Manual Entry at Billing" },
];
export const TAX_METHOD_OPTS = [
  { value: "inclusive", label: "Inclusive of Tax" }, { value: "exclusive", label: "Exclusive of Tax" },
];

/* ======================================================== field defs === */
export const TAX_FIELDS: SField[] = [
  { name: "cgst", label: "Default CGST %", icon: Receipt, info: "Central GST default.", sample: "9", type: "number" },
  { name: "sgst", label: "Default SGST %", icon: Receipt, info: "State GST default.", sample: "9", type: "number" },
  { name: "igst", label: "Default IGST %", icon: Receipt, info: "Inter-state GST default.", sample: "18", type: "number" },
  { name: "cess", label: "Default CESS %", icon: Receipt, info: "Compensation cess.", sample: "0", type: "number" },
];
export const INVOICE_FIELDS: SField[] = [
  { name: "b2cSeries", label: "B2C Invoice Prefix", icon: FileText, info: "Prefix for retail invoices.", sample: "INV-RT", type: "text" },
  { name: "b2bSeries", label: "B2B Invoice Prefix", icon: FileText, info: "Prefix for business invoices.", sample: "INV-WS", type: "text" },
];

/* =============================================== bill number sequence == */
export const RESET_FREQUENCY_OPTS = [
  { value: "never", label: "Never — continuous" },
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "financial_year", label: "Financial Year (Apr–Mar)" },
  { value: "calendar_year", label: "Calendar Year (Jan–Dec)" },
];
export const YEAR_FORMAT_OPTS = [
  { value: "fy_short", label: "Financial Year — 26-27" },
  { value: "fy_full", label: "Financial Year — 2026-2027" },
  { value: "cal_full", label: "Calendar Year — 2026" },
  { value: "cal_short", label: "Calendar Year — 26" },
];
export const SEPARATOR_OPTS = [
  { value: "/", label: "Slash  /" },
  { value: "-", label: "Hyphen  -" },
  { value: "", label: "None" },
];
/** Tokens, in fixed composition order, available to the bill-number builder. */
export const NUMBER_TOKENS = ["{PREFIX}", "{BRANCH}", "{FY}", "{MM}", "{SEQ}"];

export const SEQUENCE_FIELDS: SField[] = [
  { name: "seqStart", label: "Starting Number", icon: Hash, info: "First running number after each reset.", sample: "1", type: "number" },
  { name: "seqPadding", label: "Number Padding (digits)", icon: Hash, info: "Zero-pad width — 4 → 0001.", sample: "4", type: "number" },
  { name: "sampleBranchCode", label: "Sample Branch Code", icon: Building2, info: "Used only to render the live preview.", sample: "CHN", type: "text" },
];
/** Which segments are embedded in the bill number, in composition order. */
export const NUMBER_COMPOSITION_FLAGS: SFlag[] = [
  { id: "includeBranchInNumber", label: "Include Branch Code", desc: "Embed the branch code segment." },
  { id: "includeFyInNumber", label: "Include Year / Financial Year", desc: "Embed the (financial) year segment." },
  { id: "includeMonthInNumber", label: "Include Month", desc: "Embed a 2-digit month segment." },
];
export const CREDIT_FIELDS: SField[] = [
  { name: "maxCreditDays", label: "Maximum Credit Days", icon: CalendarClock, info: "Max allowed credit period.", sample: "30", type: "number" },
  { name: "creditApprover", label: "Credit Approver Role", icon: UserCheck, info: "Role that approves credit beyond limit.", type: "select", options: [
    { value: "supervisor", label: "Supervisor" }, { value: "manager", label: "Manager" }, { value: "admin", label: "Admin" } ] },
];
export const LOYALTY_FIELDS: SField[] = [
  { name: "earnRate", label: "Points Earned per ₹100", icon: Gift, info: "Earning rule.", sample: "2", type: "number" },
  { name: "redeemValue", label: "Redemption Value per Point (₹)", icon: IndianRupee, info: "Redemption rule.", sample: "0.25", type: "number" },
];
export const DISCOUNT_FIELDS: SField[] = [
  { name: "maxInvoiceDiscount", label: "Max Invoice Discount %", icon: Percent, info: "Hard ceiling on total invoice discount.", sample: "20", type: "number" },
];

/* =================================================== approval levels === */
export const APPROVAL_LEVELS = [
  { role: "Cashier", limit: "Up to 5%" },
  { role: "Supervisor", limit: "Up to 10%" },
  { role: "Manager", limit: "Up to 20%" },
  { role: "Admin", limit: "Unlimited" },
];

/* ==================================================== validation map === */
export const VALIDATION_AREAS = [
  { id: "product", label: "Product Configuration", tab: "product" },
  { id: "tax", label: "Tax Configuration", tab: "tax" },
  { id: "barcode", label: "Barcode Rules", tab: "barcode" },
  { id: "qr", label: "QR Rules", tab: "qr" },
  { id: "batch", label: "Batch Rules", tab: "batch" },
  { id: "pricing", label: "Pricing Rules", tab: "pricing" },
  { id: "customer", label: "Customer Rules", tab: "b2c" },
];

/* ========================================================= dashboard === */
export const SALES_STATS = {
  activeRules: 86, activeChannels: 4, activeDiscounts: 6, creditRules: 4, pendingApprovals: 3, aiRecommendations: 12,
};

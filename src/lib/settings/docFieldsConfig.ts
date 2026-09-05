/**
 * Screen-wise document field configuration: per document screen, which optional
 * fields/features are enabled and which are mandatory. The 4 commercial documents
 * (Sales Order/Invoice, Purchase Order/Invoice) read this to show/hide fields and
 * enforce required-ness. Mutable singleton (Settings screen edits it in-session).
 */
// `locked` — this field is already hard-required by the form itself (e.g. a
// value the API can't function without); the settings screen shows it purely
// as information — always-on, always-mandatory, no Enabled/Mandatory toggles
// at all — since turning it off would break the screen it belongs to.
export interface DocFieldDef { key: string; label: string; mandatoryable: boolean; gst?: boolean; group: string; locked?: boolean }
export interface DocScreen { key: string; label: string; module: string; feature: string; fields: DocFieldDef[] }

const FEATURES: DocFieldDef[] = [
  { key: "tax", label: "Tax Column", mandatoryable: false, gst: true, group: "Taxes" },
  { key: "hsn", label: "HSN Code Column", mandatoryable: false, gst: true, group: "Taxes" },
  { key: "itemDiscount", label: "Item-level Discount", mandatoryable: false, group: "Discount" },
  { key: "txnDiscount", label: "Transaction-level Discount", mandatoryable: false, group: "Discount" },
  { key: "tds", label: "TDS", mandatoryable: false, group: "Taxes" },
  { key: "tcs", label: "TCS", mandatoryable: false, group: "Taxes" },
  { key: "otherCharges", label: "Other Charges / Tax", mandatoryable: false, group: "Taxes" },
];
const salesFields: DocFieldDef[] = [
  { key: "salesperson", label: "Salesperson", mandatoryable: true, group: "Fields" },
  { key: "paymentTerms", label: "Payment Terms", mandatoryable: true, group: "Fields" },
  { key: "deliveryMethod", label: "Delivery Method", mandatoryable: true, group: "Fields" },
  { key: "customerNote", label: "Customer Note", mandatoryable: false, group: "Fields" },
  { key: "terms", label: "Terms & Conditions", mandatoryable: false, group: "Fields" },
  { key: "attachments", label: "Attachments / File Upload", mandatoryable: false, group: "Fields" },
];
const purchaseFields: DocFieldDef[] = [
  { key: "buyer", label: "Purchaser / Buyer", mandatoryable: true, group: "Fields" },
  { key: "paymentTerms", label: "Payment Terms", mandatoryable: true, group: "Fields" },
  { key: "deliveryMethod", label: "Delivery Method", mandatoryable: true, group: "Fields" },
  { key: "note", label: "Note", mandatoryable: false, group: "Fields" },
  { key: "terms", label: "Terms & Conditions", mandatoryable: false, group: "Fields" },
  { key: "attachments", label: "Attachments / File Upload", mandatoryable: false, group: "Fields" },
];

// Vehicle Gate Entry — field keys match GateEntryEditor.tsx's own state names 1:1
// so the settings screen can drive that form's show/hide + required-ness directly.
// Entry Date & Time, Location, Gate Entry No always show (never optional, not
// listed here). Vehicle Number/Customer/Product ARE listed below despite being
// "core" fields — unlike the others, Vehicle Number defaults to mandatory:true
// (see the override right after DEFAULT_DOC_FIELDS_CONFIG's construction) so
// disabling it is an explicit admin choice, not a silent regression; the API
// still requires a vehicle regardless (a non-nullable FK), so turning this off
// only skips the friendly client-side check, not backend validation.
// Dispatch Type / Reference Type are NOT here — those are handled by Dispatch
// Configuration's own default-value + lock mechanism (a preload/changeability
// concern, not a show/hide one — hiding them would break this form's
// downstream conditional sections).
const vehicleGateEntryFields: DocFieldDef[] = [
  { key: "vehicleNumber", label: "Vehicle Number", mandatoryable: true, group: "Transport Details" },
  { key: "customer", label: "Customer (Direct Customer Dispatch)", mandatoryable: true, group: "Dispatch & Reference" },
  { key: "product", label: "At Least One Item in Item Details", mandatoryable: true, group: "Items" },
  { key: "securityOfficer", label: "Security Officer", mandatoryable: true, group: "Gate Information" },
  { key: "location", label: "Location (Branch)", mandatoryable: false, group: "Gate Information" },
  { key: "deliveryAddress", label: "Delivery Address (Direct Customer Dispatch)", mandatoryable: true, group: "Dispatch & Reference" },
  { key: "transportCompany", label: "Transport Company", mandatoryable: true, group: "Transport Details" },
  { key: "transportMode", label: "Transport Mode", mandatoryable: true, group: "Transport Details" },
  { key: "vehicleType", label: "Vehicle Type", mandatoryable: true, group: "Transport Details" },
  { key: "trailerNumber", label: "Trailer Number", mandatoryable: false, group: "Transport Details" },
  { key: "containerNumber", label: "Container Number", mandatoryable: false, group: "Transport Details" },
  { key: "driverMaster", label: "Known Driver Picker", mandatoryable: false, group: "Driver Details" },
  { key: "driverMobile", label: "Driver Mobile", mandatoryable: true, group: "Driver Details" },
  { key: "driverLicenseNo", label: "Driver License No.", mandatoryable: true, group: "Driver Details" },
  { key: "helperName", label: "Helper Name", mandatoryable: false, group: "Driver Details" },
  { key: "helperMobile", label: "Helper Mobile", mandatoryable: false, group: "Driver Details" },
  { key: "vehicleCapacity", label: "Vehicle Capacity", mandatoryable: false, group: "Vehicle Details" },
  { key: "expectedLoadWeight", label: "Expected Load Weight", mandatoryable: false, group: "Vehicle Details" },
  { key: "gpsAvailable", label: "GPS Available", mandatoryable: false, group: "Vehicle Details" },
  { key: "sealNumber", label: "Seal Number", mandatoryable: false, group: "Vehicle Details" },
  { key: "purpose", label: "Purpose", mandatoryable: false, group: "Entry Details" },
  { key: "expectedExitTime", label: "Expected Exit Time", mandatoryable: false, group: "Entry Details" },
  { key: "loadingBay", label: "Loading Bay", mandatoryable: false, group: "Entry Details" },
  { key: "remarks", label: "Remarks", mandatoryable: false, group: "Entry Details" },
  { key: "itemDetails", label: "Item Details Section", mandatoryable: false, group: "Items" },
];

// Load & Dispatch — field keys match DirectLoadDispatchForm.tsx's state names
// (the "New Vehicle Entry → Dispatch" screen) where a matching field exists;
// LoadDispatchEditor.tsx (the full view/edit screen) doesn't consume this
// config yet — same enabled-by-default fallback applies there via fieldOn's
// default parameter, so nothing breaks, it's just not wired up as show/hide yet.
const loadDispatchFields: DocFieldDef[] = [
  { key: "transportCompany", label: "Transport Company", mandatoryable: true, group: "Transport Details" },
  { key: "vehicleType", label: "Vehicle Type", mandatoryable: true, group: "Transport Details" },
  { key: "route", label: "Route", mandatoryable: false, group: "Transport Details" },
  { key: "sealNumber", label: "Seal Number", mandatoryable: false, group: "Transport Details" },
  { key: "trailerNumber", label: "Trailer Number", mandatoryable: false, group: "Transport Details" },
  { key: "containerNumber", label: "Container Number", mandatoryable: false, group: "Transport Details" },
  { key: "driverName", label: "Driver Name", mandatoryable: false, group: "Driver Details" },
  { key: "driverMobile", label: "Driver Mobile", mandatoryable: true, group: "Driver Details" },
  { key: "driverLicenseNo", label: "Driver License No.", mandatoryable: true, group: "Driver Details" },
  { key: "helperName", label: "Helper Name", mandatoryable: false, group: "Driver Details" },
  { key: "helperMobile", label: "Helper Mobile", mandatoryable: false, group: "Driver Details" },
  { key: "weighmentManagement", label: "Weighment Management Section", mandatoryable: false, group: "Weighment" },
  { key: "loadingBay", label: "Loading Bay", mandatoryable: false, group: "Loading Details" },
  { key: "supervisor", label: "Supervisor", mandatoryable: false, group: "Loading Details" },
  { key: "packages", label: "Packages", mandatoryable: false, group: "Loading Details" },
  { key: "pallets", label: "Pallets", mandatoryable: false, group: "Loading Details" },
  { key: "transportCost", label: "Transport Cost Section", mandatoryable: false, group: "Other" },
  { key: "freightCharge", label: "Freight Charge", mandatoryable: false, group: "Transport Cost" },
  { key: "loadingCharge", label: "Loading Charge", mandatoryable: false, group: "Transport Cost" },
  { key: "unloadingCharge", label: "Unloading Charge", mandatoryable: false, group: "Transport Cost" },
  { key: "fuelCharge", label: "Fuel Charge", mandatoryable: false, group: "Transport Cost" },
  { key: "tollCharge", label: "Toll Charge", mandatoryable: false, group: "Transport Cost" },
  { key: "driverAllowance", label: "Driver Allowance (Bata)", mandatoryable: false, group: "Transport Cost" },
  { key: "helperAllowance", label: "Helper Allowance", mandatoryable: false, group: "Transport Cost" },
  { key: "driverBatta", label: "Driver Batta", mandatoryable: false, group: "Transport Cost" },
  { key: "vehicleRent", label: "Vehicle Rent", mandatoryable: false, group: "Transport Cost" },
  { key: "transitPass", label: "Transit Pass", mandatoryable: false, group: "Transport Cost" },
  { key: "otherTransportCharges", label: "Other Charges", mandatoryable: false, group: "Transport Cost" },
  { key: "transportDiscount", label: "Discount", mandatoryable: false, group: "Transport Cost" },
  { key: "transportGst", label: "GST Amount", mandatoryable: false, group: "Transport Cost" },
  { key: "paymentCollection", label: "Payment Collection Section", mandatoryable: false, group: "Other" },
  { key: "accountingPostingDetails", label: "Accounting Posting Details Section", mandatoryable: false, group: "Other" },
  { key: "remarks", label: "Remarks", mandatoryable: false, group: "Other" },
];

// Supplier Master — field keys mirror supplierConfig.ts's SField.name 1:1
// where a real field exists so SupplierEditor.tsx can drive show/hide +
// required-ness directly off this registry. `locked: true` marks the 3
// fields SupplierFormContext.validate() already hard-requires today (name,
// c1Name, c1Mobile) — those show as "Required", no toggles. Grouped by
// SUPPLIER_TABS label so the settings screen renders one step per tab.
// AI Smart Setup / Approval Workflow tabs carry no data fields of their own
// (they're workflow, not form fields) so they're intentionally not listed.
const supplierMasterFields: DocFieldDef[] = [
  // General Information
  { key: "code", label: "Supplier Code", mandatoryable: true, group: "General Information" },
  { key: "name", label: "Supplier Name", mandatoryable: false, group: "General Information", locked: true },
  { key: "legalName", label: "Legal Entity Name", mandatoryable: false, group: "General Information" },
  { key: "type", label: "Supplier Type", mandatoryable: false, group: "General Information" },
  { key: "category", label: "Supplier Category", mandatoryable: false, group: "General Information" },
  { key: "status", label: "Supplier Status", mandatoryable: false, group: "General Information" },
  { key: "website", label: "Website", mandatoryable: false, group: "General Information" },
  { key: "description", label: "Business Description", mandatoryable: false, group: "General Information" },
  // Contact Information
  { key: "c1Name", label: "Primary Contact Person Name", mandatoryable: false, group: "Contact Information", locked: true },
  { key: "c1Designation", label: "Primary Contact Designation", mandatoryable: false, group: "Contact Information" },
  { key: "c1Mobile", label: "Primary Contact Mobile Number", mandatoryable: false, group: "Contact Information", locked: true },
  { key: "c1AltMobile", label: "Primary Contact Alternate Mobile", mandatoryable: false, group: "Contact Information" },
  { key: "c1Email", label: "Primary Contact Email", mandatoryable: true, group: "Contact Information" },
  { key: "c2Name", label: "Secondary Contact Person Name", mandatoryable: false, group: "Contact Information" },
  { key: "c2Designation", label: "Secondary Contact Designation", mandatoryable: false, group: "Contact Information" },
  { key: "c2Mobile", label: "Secondary Contact Mobile Number", mandatoryable: false, group: "Contact Information" },
  { key: "c2Email", label: "Secondary Contact Email", mandatoryable: false, group: "Contact Information" },
  { key: "commPrefEmail", label: "Communication Preference — Email", mandatoryable: false, group: "Contact Information" },
  { key: "commPrefSms", label: "Communication Preference — SMS", mandatoryable: false, group: "Contact Information" },
  { key: "commPrefWhatsapp", label: "Communication Preference — WhatsApp", mandatoryable: false, group: "Contact Information" },
  // Address Information
  { key: "regLine1", label: "Registered Address Line 1", mandatoryable: true, group: "Address Information" },
  { key: "regLine2", label: "Registered Address Line 2", mandatoryable: false, group: "Address Information" },
  { key: "regCity", label: "Registered Address City", mandatoryable: true, group: "Address Information" },
  { key: "regDistrict", label: "Registered Address District", mandatoryable: false, group: "Address Information" },
  { key: "regState", label: "Registered Address State", mandatoryable: true, group: "Address Information" },
  { key: "regCountry", label: "Registered Address Country", mandatoryable: false, group: "Address Information" },
  { key: "regPincode", label: "Registered Address Pincode", mandatoryable: true, group: "Address Information" },
  { key: "commLine1", label: "Communication Address Line 1", mandatoryable: false, group: "Address Information" },
  { key: "commCity", label: "Communication Address City", mandatoryable: false, group: "Address Information" },
  { key: "commState", label: "Communication Address State", mandatoryable: false, group: "Address Information" },
  { key: "commPincode", label: "Communication Address Pincode", mandatoryable: false, group: "Address Information" },
  // GST & Tax
  { key: "gstin", label: "GSTIN", mandatoryable: true, gst: true, group: "GST & Tax" },
  { key: "pan", label: "PAN Number", mandatoryable: true, group: "GST & Tax" },
  { key: "tan", label: "TAN Number", mandatoryable: false, group: "GST & Tax" },
  { key: "stateCode", label: "State Code", mandatoryable: false, gst: true, group: "GST & Tax" },
  { key: "placeOfSupply", label: "Place of Supply", mandatoryable: false, gst: true, group: "GST & Tax" },
  { key: "tdsPct", label: "TDS Percentage", mandatoryable: false, group: "GST & Tax" },
  // Banking
  { key: "bankName", label: "Bank Name", mandatoryable: true, group: "Banking" },
  { key: "bankBranch", label: "Bank Branch Name", mandatoryable: false, group: "Banking" },
  { key: "bankHolder", label: "Bank Account Holder Name", mandatoryable: false, group: "Banking" },
  { key: "bankAccount", label: "Bank Account Number", mandatoryable: true, group: "Banking" },
  { key: "bankIfsc", label: "Bank IFSC Code", mandatoryable: true, group: "Banking" },
  { key: "bankAccountType", label: "Bank Account Type", mandatoryable: false, group: "Banking" },
  { key: "bankUpi", label: "UPI ID", mandatoryable: false, group: "Banking" },
  // Credit & Payment
  { key: "creditLimit", label: "Credit Limit", mandatoryable: false, group: "Credit & Payment" },
  { key: "creditPeriod", label: "Credit Period (Days)", mandatoryable: false, group: "Credit & Payment" },
  { key: "paymentModeBank", label: "Payment Mode — Bank Transfer", mandatoryable: false, group: "Credit & Payment" },
  { key: "paymentModeUpi", label: "Payment Mode — UPI", mandatoryable: false, group: "Credit & Payment" },
  { key: "paymentModeCheque", label: "Payment Mode — Cheque", mandatoryable: false, group: "Credit & Payment" },
  { key: "paymentModeCash", label: "Payment Mode — Cash", mandatoryable: false, group: "Credit & Payment" },
  // Documents
  { key: "docGst", label: "GST Certificate Upload", mandatoryable: false, group: "Documents" },
  { key: "docPan", label: "PAN Card Upload", mandatoryable: false, group: "Documents" },
  { key: "docMsme", label: "MSME Certificate Upload", mandatoryable: false, group: "Documents" },
  { key: "docFssai", label: "FSSAI Certificate Upload", mandatoryable: false, group: "Documents" },
  { key: "docDrug", label: "Drug License Upload", mandatoryable: false, group: "Documents" },
  { key: "docBank", label: "Bank Proof Upload", mandatoryable: false, group: "Documents" },
  { key: "docAgreement", label: "Agreement Copy Upload", mandatoryable: false, group: "Documents" },
  // Accounting
  { key: "ledger", label: "Supplier Ledger Account", mandatoryable: false, group: "Accounting" },
  { key: "advanceAccount", label: "Advance Account", mandatoryable: false, group: "Accounting" },
  { key: "purchaseAccount", label: "Purchase Account", mandatoryable: false, group: "Accounting" },
  { key: "openingPayable", label: "Opening Payable Amount", mandatoryable: false, group: "Accounting" },
  { key: "openingAdvance", label: "Opening Advance Amount", mandatoryable: false, group: "Accounting" },
];

// Customer Master — mirrors supplierMasterFields; keys match customerConfig.ts's
// SField.name 1:1. `locked: true` on name/c1Mobile reflects the 2 fields
// CustomerFormContext.validate() actually hard-enforces today (c1Name's label
// carries a "*" too but isn't enforced by validate(), so it's left
// mandatoryable rather than locked — an admin can make it mandatory instead).
// Repeatable "Additional Addresses" rows are excluded, matching Supplier's
// exclusion of its repeatable Branch Locations rows.
const customerMasterFields: DocFieldDef[] = [
  // General Information
  { key: "code", label: "Customer Code", mandatoryable: true, group: "General Information" },
  { key: "name", label: "Customer Name", mandatoryable: false, group: "General Information", locked: true },
  { key: "legalName", label: "Legal Name", mandatoryable: false, group: "General Information" },
  { key: "type", label: "Customer Type", mandatoryable: false, group: "General Information" },
  { key: "category", label: "Customer Category", mandatoryable: false, group: "General Information" },
  { key: "status", label: "Status", mandatoryable: false, group: "General Information" },
  { key: "regDate", label: "Date of Registration", mandatoryable: false, group: "General Information" },
  { key: "since", label: "Customer Since", mandatoryable: false, group: "General Information" },
  { key: "dob", label: "Date of Birth", mandatoryable: false, group: "General Information" },
  { key: "anniversary", label: "Marriage / Anniversary Date", mandatoryable: false, group: "General Information" },
  { key: "gender", label: "Gender", mandatoryable: false, group: "General Information" },
  // Contact Information
  { key: "c1Name", label: "Primary Contact Person Name", mandatoryable: true, group: "Contact Information" },
  { key: "c1Mobile", label: "Primary Contact Mobile Number", mandatoryable: false, group: "Contact Information", locked: true },
  { key: "c1AltMobile", label: "Primary Contact Alternate Mobile", mandatoryable: false, group: "Contact Information" },
  { key: "c1Whatsapp", label: "Primary Contact WhatsApp Number", mandatoryable: false, group: "Contact Information" },
  { key: "c1Email", label: "Primary Contact Email", mandatoryable: true, group: "Contact Information" },
  { key: "c2Name", label: "Secondary Contact Person Name", mandatoryable: false, group: "Contact Information" },
  { key: "c2Mobile", label: "Secondary Contact Mobile Number", mandatoryable: false, group: "Contact Information" },
  { key: "c2Email", label: "Secondary Contact Email", mandatoryable: false, group: "Contact Information" },
  { key: "commPrefSms", label: "Communication Preference — SMS", mandatoryable: false, group: "Contact Information" },
  { key: "commPrefEmail", label: "Communication Preference — Email", mandatoryable: false, group: "Contact Information" },
  { key: "commPrefWhatsapp", label: "Communication Preference — WhatsApp", mandatoryable: false, group: "Contact Information" },
  { key: "commPrefCall", label: "Communication Preference — Phone Call", mandatoryable: false, group: "Contact Information" },
  // Address Information
  { key: "billLine1", label: "Billing Address Line 1", mandatoryable: true, group: "Address Information" },
  { key: "billLine2", label: "Billing Address Line 2", mandatoryable: false, group: "Address Information" },
  { key: "billCity", label: "Billing Address City", mandatoryable: true, group: "Address Information" },
  { key: "billDistrict", label: "Billing Address District", mandatoryable: false, group: "Address Information" },
  { key: "billState", label: "Billing Address State", mandatoryable: true, group: "Address Information" },
  { key: "billCountry", label: "Billing Address Country", mandatoryable: false, group: "Address Information" },
  { key: "billPincode", label: "Billing Address Pincode", mandatoryable: true, group: "Address Information" },
  { key: "shipLine1", label: "Shipping Address Line 1", mandatoryable: false, group: "Address Information" },
  { key: "shipCity", label: "Shipping Address City", mandatoryable: false, group: "Address Information" },
  { key: "shipState", label: "Shipping Address State", mandatoryable: false, group: "Address Information" },
  { key: "shipPincode", label: "Shipping Address Pincode", mandatoryable: false, group: "Address Information" },
  // GST & Tax
  { key: "gstin", label: "GSTIN", mandatoryable: false, gst: true, group: "GST & Tax" },
  { key: "pan", label: "PAN Number", mandatoryable: false, group: "GST & Tax" },
  { key: "tan", label: "TAN Number", mandatoryable: false, group: "GST & Tax" },
  { key: "businessName", label: "Business Name", mandatoryable: false, gst: true, group: "GST & Tax" },
  { key: "stateCode", label: "State Code", mandatoryable: false, gst: true, group: "GST & Tax" },
  // Credit Management
  { key: "creditLimit", label: "Credit Limit", mandatoryable: false, group: "Credit Management" },
  { key: "creditPeriod", label: "Credit Period (Days)", mandatoryable: false, group: "Credit Management" },
  // Accounting
  { key: "ledger", label: "Customer Ledger Account", mandatoryable: false, group: "Accounting" },
  { key: "advanceAccount", label: "Advance Account", mandatoryable: false, group: "Accounting" },
  { key: "openingReceivable", label: "Opening Receivable Amount", mandatoryable: false, group: "Accounting" },
  { key: "openingAdvance", label: "Opening Advance Amount", mandatoryable: false, group: "Accounting" },
  // Documents
  { key: "docPan", label: "PAN Card Upload", mandatoryable: false, group: "Documents" },
  { key: "docGst", label: "GST Certificate Upload", mandatoryable: false, group: "Documents" },
  { key: "docBusinessReg", label: "Business Registration Upload", mandatoryable: false, group: "Documents" },
  { key: "docAgreement", label: "Customer Agreement Upload", mandatoryable: false, group: "Documents" },
  { key: "docCreditApproval", label: "Credit Approval Documents Upload", mandatoryable: false, group: "Documents" },
];

// Product Master — keys match productConfig.ts's PField.name 1:1 where a
// real field exists; grouped by PRODUCT_TABS label. Only `name` is locked
// (the sole field ProductFormContext.validate() hard-enforces today).
// Attributes/Variants and Product Media tabs carry no simple scalar fields
// (dynamic row builders / file uploads with no backing keys yet) so they're
// intentionally not listed, matching how Supplier/Customer excluded their
// own repeatable-row tabs.
const productMasterFields: DocFieldDef[] = [
  // General Information
  { key: "productType", label: "Product Type", mandatoryable: false, group: "General Information" },
  { key: "inventoryCategory", label: "Inventory Category", mandatoryable: false, group: "General Information" },
  { key: "code", label: "Product Code", mandatoryable: true, group: "General Information" },
  { key: "name", label: "Product Name", mandatoryable: false, group: "General Information", locked: true },
  { key: "shortName", label: "Short Name", mandatoryable: false, group: "General Information" },
  { key: "altName", label: "Alternate Name", mandatoryable: false, group: "General Information" },
  { key: "status", label: "Status", mandatoryable: false, group: "General Information" },
  { key: "launchDate", label: "Launch Date", mandatoryable: false, group: "General Information" },
  { key: "discontinuedDate", label: "Discontinued Date", mandatoryable: false, group: "General Information" },
  { key: "keywords", label: "Search Keywords", mandatoryable: false, group: "General Information" },
  { key: "description", label: "Product Description", mandatoryable: false, group: "General Information" },
  // Classification
  { key: "industry", label: "Industry", mandatoryable: false, group: "Classification" },
  { key: "category", label: "Category", mandatoryable: true, group: "Classification" },
  { key: "subCategory", label: "Sub-Category", mandatoryable: false, group: "Classification" },
  { key: "group", label: "Group", mandatoryable: false, group: "Classification" },
  { key: "brand", label: "Brand", mandatoryable: false, group: "Classification" },
  { key: "manufacturer", label: "Manufacturer", mandatoryable: false, group: "Classification" },
  { key: "family", label: "Family", mandatoryable: false, group: "Classification" },
  { key: "segment", label: "Segment", mandatoryable: false, group: "Classification" },
  // Packaging & UOM
  { key: "baseUom", label: "Base UOM", mandatoryable: true, group: "Packaging & UOM" },
  { key: "purchaseUom", label: "Purchase UOM", mandatoryable: false, group: "Packaging & UOM" },
  { key: "salesUom", label: "Sales UOM", mandatoryable: false, group: "Packaging & UOM" },
  { key: "unitsPerCase", label: "Units Per Case", mandatoryable: false, group: "Packaging & UOM" },
  { key: "packageType", label: "Package Type", mandatoryable: false, group: "Packaging & UOM" },
  { key: "height", label: "Height", mandatoryable: false, group: "Packaging & UOM" },
  { key: "width", label: "Width", mandatoryable: false, group: "Packaging & UOM" },
  { key: "length", label: "Length", mandatoryable: false, group: "Packaging & UOM" },
  { key: "volume", label: "Volume", mandatoryable: false, group: "Packaging & UOM" },
  { key: "weightUnit", label: "Weight Unit", mandatoryable: false, group: "Packaging & UOM" },
  { key: "netWeight", label: "Net Weight", mandatoryable: false, group: "Packaging & UOM" },
  { key: "grossWeight", label: "Gross Weight", mandatoryable: false, group: "Packaging & UOM" },
  // Product Codes
  { key: "sku", label: "SKU", mandatoryable: false, group: "Product Codes" },
  { key: "gtin", label: "GTIN", mandatoryable: false, group: "Product Codes" },
  { key: "upc", label: "UPC", mandatoryable: false, group: "Product Codes" },
  { key: "ean", label: "EAN", mandatoryable: false, group: "Product Codes" },
  { key: "isbn", label: "ISBN", mandatoryable: false, group: "Product Codes" },
  { key: "mpn", label: "MPN", mandatoryable: false, group: "Product Codes" },
  { key: "internalCode", label: "Internal Code", mandatoryable: false, group: "Product Codes" },
  { key: "barcodeType", label: "Barcode Type", mandatoryable: false, group: "Product Codes" },
  { key: "barcodePrefix", label: "Barcode Prefix", mandatoryable: false, group: "Product Codes" },
  { key: "barcodeLength", label: "Barcode Length", mandatoryable: false, group: "Product Codes" },
  { key: "qrTemplate", label: "QR Template", mandatoryable: false, group: "Product Codes" },
  // Tax Configuration
  { key: "taxPref", label: "Tax Preference", mandatoryable: false, gst: true, group: "Tax Configuration" },
  { key: "gstRate", label: "GST Rate", mandatoryable: true, gst: true, group: "Tax Configuration" },
  { key: "hsn", label: "HSN Code", mandatoryable: true, gst: true, group: "Tax Configuration" },
  { key: "sac", label: "SAC Code", mandatoryable: false, gst: true, group: "Tax Configuration" },
  // Inventory
  { key: "openingQty", label: "Opening Quantity", mandatoryable: false, group: "Inventory" },
  { key: "openingValue", label: "Opening Value", mandatoryable: false, group: "Inventory" },
  // Expiry & Shelf Life
  { key: "shelfLifeType", label: "Shelf Life Type", mandatoryable: false, group: "Expiry & Shelf Life" },
  { key: "shelfLifeValue", label: "Shelf Life Value", mandatoryable: false, group: "Expiry & Shelf Life" },
  { key: "alertUnit", label: "Expiry Alert Unit", mandatoryable: false, group: "Expiry & Shelf Life" },
  { key: "alertValue", label: "Expiry Alert Value", mandatoryable: false, group: "Expiry & Shelf Life" },
  // Stock Control
  { key: "minStock", label: "Minimum Stock", mandatoryable: false, group: "Stock Control" },
  { key: "maxStock", label: "Maximum Stock", mandatoryable: false, group: "Stock Control" },
  { key: "reorderLevel", label: "Reorder Level", mandatoryable: false, group: "Stock Control" },
  { key: "safetyStock", label: "Safety Stock", mandatoryable: false, group: "Stock Control" },
  { key: "leadTime", label: "Lead Time", mandatoryable: false, group: "Stock Control" },
  // Pricing
  { key: "stdPurchasePrice", label: "Standard Purchase Price", mandatoryable: false, group: "Pricing" },
  { key: "lastPurchasePrice", label: "Last Purchase Price", mandatoryable: false, group: "Pricing" },
  { key: "mrp", label: "MRP", mandatoryable: true, group: "Pricing" },
  { key: "retailPrice", label: "Retail Price", mandatoryable: true, group: "Pricing" },
  { key: "wholesalePrice", label: "Wholesale Price", mandatoryable: false, group: "Pricing" },
  { key: "distributorPrice", label: "Distributor Price", mandatoryable: false, group: "Pricing" },
  { key: "dealerPrice", label: "Dealer Price", mandatoryable: false, group: "Pricing" },
  { key: "franchisePrice", label: "Franchise Price", mandatoryable: false, group: "Pricing" },
  { key: "onlinePrice", label: "Online Price", mandatoryable: false, group: "Pricing" },
  { key: "localPrice", label: "Local Price", mandatoryable: false, group: "Pricing" },
  { key: "interstatePrice", label: "Interstate Price", mandatoryable: false, group: "Pricing" },
  // Accounting
  { key: "salesRevenueAcct", label: "Sales Revenue Account", mandatoryable: false, group: "Accounting" },
  { key: "salesInventoryAcct", label: "Sales Inventory Account", mandatoryable: false, group: "Accounting" },
  { key: "purchaseExpenseAcct", label: "Purchase Expense Account", mandatoryable: false, group: "Accounting" },
  { key: "purchaseInventoryAcct", label: "Purchase Inventory Account", mandatoryable: false, group: "Accounting" },
  { key: "costCenter", label: "Cost Center", mandatoryable: false, group: "Accounting" },
  { key: "profitCenter", label: "Profit Center", mandatoryable: false, group: "Accounting" },
  { key: "salesDesc", label: "Sales Description", mandatoryable: false, group: "Accounting" },
  { key: "purchaseDesc", label: "Purchase Description", mandatoryable: false, group: "Accounting" },
];

export const DOC_SCREENS: DocScreen[] = [
  { key: "sales_order", label: "Sales Order", module: "sales", feature: "order", fields: [...salesFields, ...FEATURES] },
  { key: "sales_invoice", label: "Sales Invoice", module: "sales", feature: "invoice", fields: [...salesFields, ...FEATURES] },
  { key: "purchase_order", label: "Purchase Order", module: "purchase", feature: "order", fields: [...purchaseFields, ...FEATURES] },
  { key: "purchase_invoice", label: "Purchase Invoice", module: "purchase", feature: "invoice", fields: [...purchaseFields, ...FEATURES] },
  { key: "vehicle_gate_entry", label: "Vehicle Gate Entry", module: "transport", feature: "gate_entry", fields: vehicleGateEntryFields },
  { key: "load_dispatch", label: "Load & Dispatch", module: "transport", feature: "load_dispatch", fields: loadDispatchFields },
  { key: "supplier_master", label: "Supplier Master", module: "masters", feature: "supplier", fields: supplierMasterFields },
  { key: "customer_master", label: "Customer Master", module: "masters", feature: "customer", fields: customerMasterFields },
  { key: "product_master", label: "Product Master", module: "masters", feature: "product", fields: productMasterFields },
];

/** Keys that are configurable meta-fields (everything else on a form always shows). */
export const CONFIGURABLE_FIELD_KEYS = ["salesperson", "buyer", "paymentTerms", "deliveryMethod", "customerNote", "note", "terms", "attachments"];

export interface FieldSetting { enabled: boolean; mandatory: boolean }
export type DocScreenConfig = Record<string, FieldSetting>;
export type DocFieldsConfig = Record<string, DocScreenConfig>;

function buildDefault(): DocFieldsConfig {
  const cfg: DocFieldsConfig = {};
  for (const s of DOC_SCREENS) {
    cfg[s.key] = {};
    for (const f of s.fields) {
      // sensible defaults: most enabled; mandatory off; composition/no-gst handled by company flag
      // locked fields (already hard-required by the form) always default on+mandatory
      cfg[s.key][f.key] = f.locked ? { enabled: true, mandatory: true } : { enabled: true, mandatory: false };
    }
  }
  return cfg;
}

export const DEFAULT_DOC_FIELDS_CONFIG: DocFieldsConfig = buildDefault();
// Vehicle Number is structurally required (non-nullable FK, API always
// rejects a missing one) — defaults to mandatory:true unlike every other
// mandatoryable field above, so listing it here doesn't silently make it
// optional for existing tenants until an admin deliberately turns it off.
DEFAULT_DOC_FIELDS_CONFIG.vehicle_gate_entry.vehicleNumber.mandatory = true;

/** Resolve a module + feature key to a configured screen key (or null if not configured). */
export function screenKeyFor(module: "sales" | "purchase", feature: string): string | null {
  const s = DOC_SCREENS.find((x) => x.module === module && x.feature === feature);
  return s ? s.key : null;
}
function isLocked(screen: string, key: string): boolean {
  const s = DOC_SCREENS.find((x) => x.key === screen);
  return !!s?.fields.find((f) => f.key === key)?.locked;
}
export function fieldOn(screen: string | null, key: string, fallback = true): boolean {
  if (!screen) return fallback;
  if (isLocked(screen, key)) return true;
  return DEFAULT_DOC_FIELDS_CONFIG[screen]?.[key]?.enabled ?? fallback;
}
export function fieldMust(screen: string | null, key: string, fallback = false): boolean {
  if (!screen) return fallback;
  if (isLocked(screen, key)) return true;
  return DEFAULT_DOC_FIELDS_CONFIG[screen]?.[key]?.mandatory ?? fallback;
}
export function setFieldSetting(screen: string, key: string, patch: Partial<FieldSetting>) {
  const sc = DEFAULT_DOC_FIELDS_CONFIG[screen] ?? (DEFAULT_DOC_FIELDS_CONFIG[screen] = {});
  sc[key] = { ...{ enabled: true, mandatory: false }, ...sc[key], ...patch };
}

/** Hydrate the singleton from a persisted config (DB row) — merges onto the
 * current defaults per screen/field so newly-added screens/fields not present
 * in an older saved row still get sensible defaults, mirroring how
 * DispatchConfiguration's mergeConfig deep-merges onto DEFAULT_DISPATCH_CONFIG. */
export function applyDocFieldsConfig(stored: Partial<DocFieldsConfig> | null | undefined) {
  if (!stored) return;
  for (const s of DOC_SCREENS) {
    const storedScreen = stored[s.key];
    if (!storedScreen) continue;
    for (const f of s.fields) {
      if (f.locked) continue; // never let a persisted row disable/unrequire a locked field
      if (storedScreen[f.key]) setFieldSetting(s.key, f.key, storedScreen[f.key]);
    }
  }
}

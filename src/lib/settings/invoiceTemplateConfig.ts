import {
  FileText,
  FileCog,
  LayoutTemplate,
  Braces,
  Barcode,
  QrCode,
  Sparkles,
  FileStack,
  Mail,
  MessageCircle,
  Printer,
  History,
  GitBranch,
  ScrollText,
  Hash,
  Ruler,
  type LucideIcon,
} from "lucide-react";

/* ============================================================= types === */
export interface TField {
  name: string;
  label: string;
  icon?: LucideIcon;
  info?: string;
  sample?: string;
  type?: "text" | "number" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  full?: boolean;
}
export interface TToggle { id: string; label: string; desc?: string; }
export interface TFlag { id: string; label: string; desc?: string; }
export interface TemplateTab { id: string; label: string; icon: LucideIcon; group: string; }

/* ================================================================ tabs == */
export const TEMPLATE_TABS: TemplateTab[] = [
  { id: "master", label: "Template Master", icon: FileText, group: "Setup" },
  { id: "paper", label: "Paper", icon: FileCog, group: "Setup" },
  { id: "designer", label: "Designer", icon: LayoutTemplate, group: "Design" },
  { id: "fields", label: "Dynamic Fields", icon: Braces, group: "Design" },
  { id: "barcode", label: "Barcode", icon: Barcode, group: "Design" },
  { id: "qr", label: "QR Code", icon: QrCode, group: "Design" },
  { id: "ai", label: "AI Generator", icon: Sparkles, group: "Design" },
  { id: "industry", label: "Industry Library", icon: FileStack, group: "Design" },
  { id: "email", label: "Email Template", icon: Mail, group: "Sharing" },
  { id: "whatsapp", label: "WhatsApp Template", icon: MessageCircle, group: "Sharing" },
  { id: "print", label: "Print Config", icon: Printer, group: "Output" },
  { id: "version", label: "Version Mgmt", icon: History, group: "Governance" },
  { id: "approval", label: "Approval", icon: GitBranch, group: "Governance" },
  { id: "audit", label: "Audit Trail", icon: ScrollText, group: "Governance" },
];

/* ============================================================ options === */
export const TEMPLATE_TYPES = [
  { value: "b2c", label: "B2C Invoice" },
  { value: "b2b", label: "B2B Tax Invoice" },
  { value: "quotation", label: "Sales Quotation" },
  { value: "sales_order", label: "Sales Order" },
  { value: "challan", label: "Delivery Challan" },
  { value: "purchase_order", label: "Purchase Order" },
  { value: "purchase_invoice", label: "Purchase Invoice" },
  { value: "credit_note", label: "Credit Note" },
  { value: "debit_note", label: "Debit Note" },
  { value: "receipt", label: "Payment Receipt" },
  { value: "statement", label: "Customer Statement" },
];
export const STATUS_OPTS = [
  { value: "Draft", label: "Draft" }, { value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" },
];
export const PAPER_CATEGORY_OPTS = [
  { value: "thermal", label: "Thermal Roll" }, { value: "standard", label: "Standard Sheet" }, { value: "custom", label: "Custom Size" },
];
export const THERMAL_SIZES = [
  { value: "58", label: "58 mm" }, { value: "76", label: "76 mm" }, { value: "80", label: "80 mm" }, { value: "110", label: "110 mm" },
];
export const STANDARD_SIZES = [
  { value: "A5", label: "A5" }, { value: "A4", label: "A4" }, { value: "A3", label: "A3" }, { value: "Legal", label: "Legal" }, { value: "Letter", label: "Letter" },
];
export const ORIENTATION_OPTS = [
  { value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" },
];

/* ===================================================== component palette */
export const HEADER_COMPONENTS: TToggle[] = [
  { id: "logo", label: "Company Logo" }, { id: "companyName", label: "Company Name" },
  { id: "address", label: "Address" }, { id: "gst", label: "GST Number" },
  { id: "branchName", label: "Branch Name", desc: "Show the branch name in the header." },
  { id: "contact", label: "Contact / Toll-Free No.", desc: "Show a contact or toll-free number." },
  { id: "fssai", label: "FSSAI Number" }, { id: "license", label: "License Number" },
];
export const CUSTOMER_COMPONENTS: TToggle[] = [
  { id: "custName", label: "Customer Name" }, { id: "custMobile", label: "Mobile Number" },
  { id: "custGst", label: "GST Number" }, { id: "custAddress", label: "Address" },
];
export const INVOICE_COMPONENTS: TToggle[] = [
  { id: "invNumber", label: "Invoice Number" }, { id: "invDate", label: "Invoice Date" }, { id: "salesPerson", label: "Sales Person" },
];
export const PRODUCT_COLUMNS: TToggle[] = [
  { id: "code", label: "Product Code" }, { id: "name", label: "Product Name" }, { id: "hsn", label: "HSN Code" },
  { id: "qty", label: "Quantity" }, { id: "uom", label: "UOM" }, { id: "rate", label: "Rate" },
  { id: "discount", label: "Discount" }, { id: "tax", label: "Tax" }, { id: "amount", label: "Amount" },
];
export const SUMMARY_ROWS: TToggle[] = [
  { id: "subtotal", label: "Subtotal" }, { id: "discount", label: "Discount" }, { id: "tax", label: "Tax" },
  { id: "roundoff", label: "Round Off" }, { id: "netAmount", label: "Net Amount" },
];
export const FOOTER_COMPONENTS: TToggle[] = [
  { id: "terms", label: "Terms & Conditions" }, { id: "signature", label: "Signature" }, { id: "thankyou", label: "Thank You Message" },
];

/* ===================================================== dynamic fields == */
export const DYNAMIC_FIELDS = [
  "{{InvoiceNumber}}", "{{InvoiceDate}}", "{{CustomerName}}", "{{CustomerMobile}}", "{{CustomerGST}}",
  "{{ProductName}}", "{{ProductCode}}", "{{HSNCode}}", "{{Quantity}}", "{{Rate}}", "{{ProductPrice}}",
  "{{DiscountAmount}}", "{{TaxAmount}}", "{{Subtotal}}", "{{RoundOff}}", "{{NetAmount}}",
  "{{SalesPerson}}", "{{BranchName}}", "{{CompanyGST}}", "{{PaymentMode}}", "{{AmountInWords}}",
];

/* =========================================================== barcode === */
export const BARCODE_TYPES: TToggle[] = [
  { id: "ean13", label: "EAN13" }, { id: "upc", label: "UPC" }, { id: "code128", label: "CODE128" },
  { id: "gs1", label: "GS1" }, { id: "custom", label: "Custom" },
];
export const PLACEMENT_OPTS = [
  { value: "header", label: "Header" }, { value: "product", label: "Product Line" }, { value: "footer", label: "Footer" },
];

/* ================================================================ QR === */
export const QR_CONTENT: TToggle[] = [
  { id: "invNumber", label: "Invoice Number" }, { id: "productInfo", label: "Product Information" },
  { id: "paymentLink", label: "Payment Link" }, { id: "customerInfo", label: "Customer Information" },
  { id: "gstInfo", label: "GST Information" }, { id: "upi", label: "UPI Payment QR" },
  { id: "trackTrace", label: "Track & Trace URL" },
];

/* ================================================== AI + industry ====== */
export const AI_FEATURES = [
  "Template Creation", "Layout Suggestions", "Branding Suggestions", "Auto Alignment", "Auto Resize", "Industry Templates",
];
export const AI_PROMPT_EXAMPLES = [
  "Create a professional A4 B2B tax invoice with company logo, GST details, customer details, product table, tax summary, QR code and payment instructions.",
  "Create an 80mm thermal bill for grocery stores with logo, GST number, barcode, item list and thank you message.",
  "Create an A4 delivery challan with consignee details, item table, vehicle number and received-by signature.",
];
export interface IndustryTemplate { id: string; name: string; paper: string; desc: string; }
export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  { id: "grocery", name: "Grocery", paper: "80mm Thermal", desc: "Logo, GST, barcode, item list, thank-you." },
  { id: "pharmacy", name: "Pharmacy", paper: "A5", desc: "Batch, expiry, schedule drugs, pharmacist sign." },
  { id: "textile", name: "Textile", paper: "A4", desc: "Size/colour, HSN, GST, brand header." },
  { id: "electronics", name: "Electronics", paper: "A4", desc: "Serial/IMEI, warranty, dealer terms." },
  { id: "wholesale", name: "Wholesale", paper: "A4", desc: "B2B tax invoice, slab pricing, e-way bill." },
  { id: "hardware", name: "Hardware", paper: "A5", desc: "Bulk units, UOM, transport details." },
  { id: "furniture", name: "Furniture", paper: "A4", desc: "Item images, delivery schedule, warranty." },
];

/* ====================================================== email/whatsapp = */
export const EMAIL_TEMPLATES: TToggle[] = [
  { id: "invoice", label: "Invoice Email" }, { id: "quotation", label: "Quotation Email" }, { id: "statement", label: "Statement Email" },
];
export const WHATSAPP_TEMPLATES: TToggle[] = [
  { id: "invoiceShare", label: "Invoice Sharing" }, { id: "paymentReminder", label: "Payment Reminder" },
  { id: "offer", label: "Offer Message" }, { id: "statementShare", label: "Statement Sharing" },
];

/* =========================================================== printing == */
export const PRINTERS: TToggle[] = [
  { id: "thermal", label: "Thermal Printer" }, { id: "laser", label: "Laser Printer" }, { id: "inkjet", label: "Inkjet Printer" },
];
export const PRINT_FLAGS: TFlag[] = [
  { id: "autoPrint", label: "Auto Print After Billing" },
  { id: "silentPrint", label: "Silent Printing (no dialog)" },
  { id: "previewBeforePrint", label: "Preview Before Print" },
];

/* ============================================================= fields == */
export const MASTER_FIELDS: TField[] = [
  { name: "templateCode", label: "Template Code", icon: Hash, info: "Unique template code.", sample: "TPL-INV-001", type: "text" },
  { name: "templateName", label: "Template Name", icon: FileText, info: "Friendly name.", sample: "Default A4 Tax Invoice", type: "text" },
  { name: "templateType", label: "Template Type", icon: FileStack, info: "Document this template renders.", type: "select", options: TEMPLATE_TYPES },
  { name: "status", label: "Status", icon: FileCog, info: "Lifecycle state.", type: "select", options: STATUS_OPTS },
];
export const MARGIN_FIELDS: TField[] = [
  { name: "marginTop", label: "Top (mm)", icon: Ruler, sample: "5", type: "number" },
  { name: "marginBottom", label: "Bottom (mm)", icon: Ruler, sample: "5", type: "number" },
  { name: "marginLeft", label: "Left (mm)", icon: Ruler, sample: "5", type: "number" },
  { name: "marginRight", label: "Right (mm)", icon: Ruler, sample: "5", type: "number" },
];
export const CUSTOM_SIZE_FIELDS: TField[] = [
  { name: "customWidth", label: "Width (mm)", icon: Ruler, sample: "210", type: "number" },
  { name: "customHeight", label: "Height (mm)", icon: Ruler, sample: "297", type: "number" },
];
export const PRINT_FIELDS: TField[] = [
  { name: "defaultPrinter", label: "Default Printer", icon: Printer, info: "Printer used for this template.", sample: "TVS RP3160", type: "text" },
  { name: "printCopies", label: "Print Copies", icon: Hash, info: "Copies per print.", sample: "1", type: "number" },
];

/* ====================================================== validation ===== */
export const VALIDATION_AREAS = [
  { id: "fields", label: "Missing Dynamic Fields", tab: "fields" },
  { id: "duplicate", label: "Duplicate Templates", tab: "master" },
  { id: "paper", label: "Invalid Paper Sizes", tab: "paper" },
  { id: "barcode", label: "Invalid Barcode Placement", tab: "barcode" },
  { id: "qr", label: "Invalid QR Placement", tab: "qr" },
];

/* ====================================================== sample data ==== */
export type TemplateStatus = "Draft" | "Active" | "Inactive";
export interface TemplateRow {
  id: string; code: string; name: string; type: string; paper: string;
  used: number; ai: boolean; status: TemplateStatus; approval: "Approved" | "Pending" | "Draft" | "Rejected"; isDefault: boolean; version: string;
}
export const SAMPLE_TEMPLATES: TemplateRow[] = [
  { id: "T1", code: "TPL-INV-001", name: "Default A4 Tax Invoice", type: "B2B Tax Invoice", paper: "A4", used: 18420, ai: false, status: "Active", approval: "Approved", isDefault: true, version: "v4" },
  { id: "T2", code: "TPL-INV-002", name: "80mm Grocery Bill", type: "B2C Invoice", paper: "80mm Thermal", used: 92340, ai: true, status: "Active", approval: "Approved", isDefault: true, version: "v7" },
  { id: "T3", code: "TPL-INV-003", name: "Pharmacy A5 Invoice", type: "B2C Invoice", paper: "A5", used: 5210, ai: true, status: "Active", approval: "Approved", isDefault: false, version: "v2" },
  { id: "T4", code: "TPL-CHL-001", name: "Delivery Challan A4", type: "Delivery Challan", paper: "A4", used: 3120, ai: false, status: "Active", approval: "Approved", isDefault: true, version: "v3" },
  { id: "T5", code: "TPL-QTN-002", name: "B2B Quotation A4", type: "Sales Quotation", paper: "A4", used: 4410, ai: true, status: "Active", approval: "Approved", isDefault: true, version: "v5" },
  { id: "T6", code: "TPL-RCT-001", name: "Payment Receipt 80mm", type: "Payment Receipt", paper: "80mm Thermal", used: 7640, ai: false, status: "Active", approval: "Approved", isDefault: false, version: "v1" },
  { id: "T7", code: "TPL-CRN-001", name: "Credit Note A4", type: "Credit Note", paper: "A4", used: 410, ai: false, status: "Draft", approval: "Pending", isDefault: false, version: "v1" },
  { id: "T8", code: "TPL-QTN-001", name: "Quotation A4 Branded", type: "Sales Quotation", paper: "A4", used: 980, ai: true, status: "Inactive", approval: "Draft", isDefault: false, version: "v2" },
];
export const TEMPLATE_STATS = {
  total: 24, active: 18, aiGenerated: 7, pendingApprovals: 3, mostUsedLabel: "80mm Grocery Bill", typesCovered: 11,
};

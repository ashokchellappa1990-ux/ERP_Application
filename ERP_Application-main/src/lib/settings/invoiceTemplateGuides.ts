import type { TabGuide } from "@/components/settings/FieldGuide";

/**
 * Per-tab field guides for the Invoice Template Designer. For every key field:
 * what it is, why it exists, and what it changes on the printed document /
 * billing screen at print time.
 */
export const TEMPLATE_GUIDES: Record<string, TabGuide> = {
  master: {
    summary: "Identifies the template and decides where and when it is used.",
    points: [
      { label: "Template Type", why: "Binds this layout to a specific document.", effect: "When that document (e.g. B2B Tax Invoice) is printed, this template is the one used to render it." },
      { label: "Status", why: "Lifecycle control.", effect: "Only Active templates can be selected at print time; Draft/Inactive are hidden." },
      { label: "Default Template", why: "Removes a choice at the counter.", effect: "Auto-selected when printing its document type, so staff don't pick a template every time." },
    ],
  },
  paper: {
    summary: "Defines the physical paper the document prints on — the whole layout adapts to it.",
    points: [
      { label: "Paper Category / Size", why: "Sets the print canvas.", effect: "Thermal renders a narrow receipt, A4 a full sheet; the live preview and the printer output both match this." },
      { label: "Orientation & Margins", why: "Control rotation and white-space.", effect: "Affect how much content fits per page and where it sits when printed." },
      { label: "Auto Fit", why: "Avoid clipping.", effect: "Scales content to the paper width so nothing is cut off on the printer." },
    ],
  },
  designer: {
    summary: "Pick exactly which blocks appear on the printed document — the preview updates live as you toggle.",
    points: [
      { label: "Header / Customer / Invoice Sections", why: "Branding & statutory details.", effect: "Each enabled component prints in that area — logo, GST, FSSAI, customer details, invoice number/date." },
      { label: "Product Grid Columns", why: "Different documents need different columns.", effect: "Only enabled columns print in the item table — switch on HSN for GST invoices, off for a simple receipt." },
      { label: "Summary & Footer", why: "Totals and closing content.", effect: "Choose which totals (subtotal/tax/round-off/net) and footer items (terms/signature/thank-you) appear on the bill." },
    ],
  },
  fields: {
    summary: "Dynamic tokens that fill with real transaction data the moment a document is printed.",
    points: [
      { label: "Dynamic Field Library", why: "One template, every customer.", effect: "Drop a token like {{NetAmount}} or {{CustomerName}} into the layout or message text; at print it is replaced with the live value from the actual bill." },
    ],
  },
  barcode: {
    summary: "A scannable barcode printed on the document.",
    points: [
      { label: "Enable Barcode", why: "Faster returns & lookups.", effect: "Prints a scannable barcode (e.g. the invoice number) at the chosen position on the bill." },
      { label: "Types / Placement", why: "Match scanners & layout.", effect: "Sets the symbology and where the barcode prints (header / product line / footer)." },
    ],
  },
  qr: {
    summary: "A QR code printed on the document — most often for instant payment.",
    points: [
      { label: "Enable QR", why: "Scan-to-pay & traceability.", effect: "Prints a QR; a UPI QR lets the customer scan and pay the exact bill amount." },
      { label: "Content / Placement", why: "Define the payload.", effect: "Sets what the QR encodes (invoice no, UPI, GST, track-&-trace) and where it prints." },
    ],
  },
  ai: {
    summary: "Generate a complete, ready-to-use template from a plain-language description.",
    points: [
      { label: "AI Prompt", why: "Design without dragging.", effect: "Describe the document in words; AI builds the paper size, sections, columns and barcode/QR, then loads it into the Designer for you to review and save." },
    ],
  },
  industry: {
    summary: "Start from a proven, ready-made layout instead of a blank page.",
    points: [
      { label: "Industry Templates", why: "Best-practice starting point.", effect: "One-click applies a ready layout (e.g. Pharmacy A5) that you can then fine-tune in the Designer." },
    ],
  },
  email: {
    summary: "The email that delivers the document to the customer.",
    points: [
      { label: "Email Templates", why: "Automate document delivery.", effect: "Enables auto-emailing the invoice / quotation / statement; the body uses dynamic fields filled in at send time." },
    ],
  },
  whatsapp: {
    summary: "The WhatsApp message that shares the document or a reminder.",
    points: [
      { label: "WhatsApp Templates", why: "Reach customers where they are.", effect: "Enables sending the bill / payment reminder / offer over WhatsApp with a pre-written, dynamic message." },
    ],
  },
  print: {
    summary: "How and where this document physically prints.",
    points: [
      { label: "Default Printer / Copies", why: "Route output correctly.", effect: "Sends this template to a specific printer and prints the set number of copies." },
      { label: "Supported Printers", why: "Match template to hardware.", effect: "Restricts which printer types this template targets (thermal / laser / inkjet)." },
      { label: "Auto / Silent / Preview", why: "Tune the print flow.", effect: "Auto-print fires right after billing; silent skips the dialog; preview shows the page before it prints." },
    ],
  },
  version: {
    summary: "Every save is versioned, so changes are never lost.",
    points: [
      { label: "Versions & Rollback", why: "Safe experimentation.", effect: "Keeps a history of the layout; you can roll back to any earlier version instantly without redesigning." },
    ],
  },
  approval: {
    summary: "Templates must be approved before they can be used in billing.",
    points: [
      { label: "Approval Status", why: "Governance over printed documents.", effect: "Only Approved templates can be set as default or used at billing; Draft/Rejected are blocked." },
    ],
  },
  audit: {
    summary: "A trail of template changes and usage (it does not change rendering itself).",
    points: [
      { label: "Audit Log", why: "Compliance & insight.", effect: "Records field changes, print history and usage counts for each template." },
    ],
  },
};

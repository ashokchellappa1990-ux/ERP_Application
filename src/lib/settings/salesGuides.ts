import type { TabGuide } from "@/components/settings/FieldGuide";

/**
 * Per-tab field guides for Sales Settings. For every key field: what it is,
 * why it exists, and what it changes on the POS / billing transaction screen.
 */
export const SALES_GUIDES: Record<string, TabGuide> = {
  mode: {
    summary: "The business mode pre-loads sensible defaults across every other tab, so you don't configure the rule engine from a blank slate.",
    points: [
      { label: "Business Mode", why: "Tells the engine what kind of store this is (Retail, Wholesale, Pharmacy, Electronics…).", effect: "Choosing e.g. Pharmacy switches batch + expiry to mandatory and FEFO stock issue, so the billing screen forces batch/expiry capture." },
      { label: "Sales Rule Dashboard", why: "A live snapshot of what is currently switched on.", effect: "Shows how many channels, discount sources and credit rules the POS will actually honour right now." },
    ],
  },
  channel: {
    summary: "Channels decide where a bill can originate and which one opens by default.",
    points: [
      { label: "Enabled Sales Channels", why: "Limits the valid entry points for a sale (B2C, B2B, Counter, Online, Mobile, Tele).", effect: "Only enabled channels appear as bill types on the POS / order screen; disabled ones are hidden from cashiers." },
      { label: "Default Sales Channel", why: "The channel used when the operator doesn't pick one.", effect: "A new bill opens pre-set to this channel (e.g. B2C Counter) so cashiers start without an extra click." },
    ],
  },
  product: {
    summary: "Controls how an item is found and added to a bill — different store types search differently.",
    points: [
      { label: "Product Selection Methods", why: "Enables the ways staff can locate an item (name, code, SKU, barcode, QR, serial, batch, image, grid).", effect: "Each enabled method becomes an active search box or scan input on the billing screen; barcode scan adds the item instantly." },
      { label: "Default Product Selection Method", why: "The fastest path for this store.", effect: "The billing item field is focused on this method (e.g. Barcode) the moment a bill opens." },
    ],
  },
  barcode: {
    summary: "Controls scan-to-bill behaviour and which barcode symbologies are accepted.",
    points: [
      { label: "Enable Barcode Billing", why: "Master switch for scanning.", effect: "Turns on the scan field at POS — scanning a product code adds the matched item to the bill." },
      { label: "Duplicate Barcode Validation", why: "Two products must never share the same code.", effect: "Blocks saving a product with a code already in use, so a scan never bills the wrong item." },
      { label: "Barcode Mandatory", why: "Forces every item to carry a barcode.", effect: "Items without a barcode cannot be billed by scan — the cashier must search by name instead." },
      { label: "Supported Barcode Types", why: "Defines which symbologies (EAN/UPC/GS1/CODE128/Custom) are valid.", effect: "Only these are decoded at the scanner; an unknown symbology is ignored at billing." },
    ],
  },
  qr: {
    summary: "Controls QR-scan billing and what a scanned QR carries onto the bill line.",
    points: [
      { label: "Enable QR Billing", why: "Master switch for QR scanning.", effect: "Adds QR scan support to the billing screen." },
      { label: "QR Code Contains", why: "Defines the QR payload (code, name, batch, expiry, MRP, serial, GST).", effect: "When a QR is scanned, these fields auto-populate the bill line — no manual typing." },
      { label: "When QR Scanned", why: "Automation that runs on each scan.", effect: "Auto-add, auto-select-batch, auto-validate-expiry and auto-fetch-price fire instantly, removing manual steps at the counter." },
    ],
  },
  serial: {
    summary: "Serial / IMEI capture for high-value, warranty-tracked goods.",
    points: [
      { label: "Serial Tracking", why: "Mandatory/Optional/Not-applicable per store.", effect: "If Mandatory, the POS forces a serial scan for these items before the bill line can be saved." },
      { label: "Applicable Categories", why: "Limits which categories need a serial (Mobile, Electronics, Appliances).", effect: "Only these categories prompt the cashier for a serial at billing." },
      { label: "Duplicate Serial Validation", why: "A physical unit can only be sold once.", effect: "Rejects a serial already sold or not in stock, preventing the same unit being billed twice." },
      { label: "Warranty Integration", why: "Links the sale to a warranty record.", effect: "On billing, the scanned serial auto-registers the customer's warranty." },
    ],
  },
  batch: {
    summary: "Batch capture and which batch the system picks at billing.",
    points: [
      { label: "Batch Tracking", why: "Required for FMCG/pharma where stock moves in batches.", effect: "If Mandatory, the cashier must pick or scan a batch before a batch-controlled item can be billed." },
      { label: "Batch Selection Method", why: "The auto-pick logic.", effect: "FEFO auto-selects the earliest-expiry batch at billing, FIFO the oldest received, Manual lets the cashier choose." },
      { label: "Allow Manual Batch Override", why: "Flexibility for exceptions.", effect: "Lets the cashier change the auto-picked batch on a bill line when needed." },
    ],
  },
  expiry: {
    summary: "Expiry checks and near-expiry handling on the billing screen.",
    points: [
      { label: "Expiry Validation", why: "Controls how strictly expiry is enforced.", effect: "If Mandatory, expired stock is blocked from being added to a bill." },
      { label: "Allow Expired Product Sales", why: "A safety switch.", effect: "When off, the POS refuses expired items; when on, it requires an override/approval to proceed." },
      { label: "Near-Expiry Alert", why: "Warns staff before items expire.", effect: "Items within this many days of expiry show a warning badge on the bill line." },
      { label: "Near-Expiry Discount Integration", why: "Drives clearance of ageing stock.", effect: "Auto-applies the markdown from Discount Master to near-expiry items as they're billed." },
    ],
  },
  inventory: {
    summary: "How stock is consumed and from where when a bill is saved.",
    points: [
      { label: "Stock Issue Method", why: "Determines cost & quantity consumption.", effect: "Decides which cost layer / quantity is reduced when a bill is saved (FIFO/FEFO/LIFO/Moving Average)." },
      { label: "Branch / Warehouse Priority", why: "Resolves multi-location stock.", effect: "Determines which location's stock is drawn first when an item exists in several." },
    ],
  },
  b2c: {
    summary: "Walk-in retail customer rules at the counter.",
    points: [
      { label: "Walk-In Customer Allowed", why: "Speed for anonymous sales.", effect: "Lets a bill be saved without selecting a customer (uses the default walk-in)." },
      { label: "Customer Registration Required", why: "Capture every buyer.", effect: "Forces customer capture before a B2C bill can be saved." },
      { label: "Mobile Number Mandatory", why: "Needed for SMS bills & loyalty.", effect: "The POS won't save the bill until a mobile number is entered." },
      { label: "GST Number Mandatory", why: "For large-value B2C GST bills.", effect: "Requires the customer GSTIN before saving." },
      { label: "Allow Quick Customer Creation", why: "Keep the cashier on the bill.", effect: "Adds an inline 'create customer' on the billing screen so staff don't leave the open bill." },
      { label: "New Customer Capture Fields", why: "Data for future campaigns & tier discounts.", effect: "Only the enabled fields (name, mobile, DOB, anniversary, tier…) appear on the POS 'Add New Customer' form — DOB/anniversary drive birthday & anniversary offers and messages." },
    ],
  },
  b2b: {
    summary: "Registered business customer rules for tax invoicing.",
    points: [
      { label: "Customer Master Mandatory", why: "B2B must be a known party.", effect: "A B2B bill cannot be made for an unregistered customer." },
      { label: "GST Number Mandatory", why: "Needed for input tax credit.", effect: "Blocks saving without the buyer's GSTIN." },
      { label: "Credit Limit / Outstanding Validation", why: "Protects receivables.", effect: "The POS stops the bill if it breaches the customer's credit limit or unpaid balance." },
      { label: "Contract / Customer-Specific Pricing", why: "Honour negotiated rates.", effect: "Bill lines pull the agreed contract price for that customer instead of the standard price." },
      { label: "Sales Order Mandatory Before Invoice", why: "Enforce the order-to-invoice flow.", effect: "A B2B invoice can only be raised against an existing approved sales order." },
    ],
  },
  pricing: {
    summary: "Which price a bill line uses and who is allowed to change it.",
    points: [
      { label: "Default Price Source", why: "The base price for the channel.", effect: "Each bill line defaults to this price (MRP / Retail / Wholesale / Dealer / Distributor / Contract)." },
      { label: "Allow Price Override", why: "Flexibility for negotiation.", effect: "Lets the cashier edit the line price on the bill." },
      { label: "Approval Required for Price Override", why: "Control margin leakage.", effect: "An overridden price routes to a supervisor for approval before the bill can be saved." },
    ],
  },
  discount: {
    summary: "What discounts apply and the ceiling on them.",
    points: [
      { label: "Allow Discounts", why: "Master switch.", effect: "When off, no discount fields appear on the bill at all." },
      { label: "Discount Sources", why: "Where a discount can come from.", effect: "Each enabled source (product/category/brand/customer/group/coupon/loyalty/invoice) is evaluated and can reduce the bill total." },
      { label: "Max Invoice Discount %", why: "Hard limit on giveaways.", effect: "The POS won't let total discount exceed this without approval." },
    ],
  },
  tax: {
    summary: "How tax is computed and shown on the bill.",
    points: [
      { label: "Tax Method", why: "Inclusive vs exclusive pricing.", effect: "Inclusive back-calculates tax from MRP; Exclusive adds tax on top of the line price." },
      { label: "CGST / SGST / IGST / CESS Defaults", why: "Fallback rates.", effect: "Used when a product has no specific rate; intra-state bills split CGST+SGST, inter-state use IGST." },
      { label: "E-Invoice / E-Way Bill", why: "Statutory compliance.", effect: "On save, qualifying bills auto-generate an IRN / e-way bill." },
    ],
  },
  credit: {
    summary: "Credit (pay-later) sales control.",
    points: [
      { label: "Allow Credit Sales", why: "Enables deferred payment.", effect: "Adds the 'Credit' payment mode on the billing screen." },
      { label: "Credit Limit / Outstanding Check", why: "Prevents over-exposure.", effect: "Blocks a credit bill that would exceed the customer's limit or overdue balance." },
      { label: "Credit Approval Workflow", why: "Authorise risky credit.", effect: "Over-limit credit bills route to an approver before they can save." },
      { label: "Maximum Credit Days", why: "Sets the due date.", effect: "Drives the bill's due date and the payment reminders that follow." },
    ],
  },
  loyalty: {
    summary: "Points earning and redemption during billing.",
    points: [
      { label: "Enable Loyalty", why: "Master switch.", effect: "Shows the loyalty panel; points accrue on each qualifying bill." },
      { label: "Earn / Redemption Rules", why: "Define the economics.", effect: "Earn rate sets points added per ₹100; redemption value sets how much each point reduces the next bill." },
      { label: "Tier / Birthday / Special Benefits", why: "Reward valuable customers.", effect: "Apply extra discounts or points automatically based on customer tier or birthday at billing." },
    ],
  },
  approval: {
    summary: "Which overrides need sign-off, and who can give it.",
    points: [
      { label: "Approval Required For", why: "Risk controls.", effect: "Each enabled action (discount/price/credit/stock/expired) pauses the bill for approval when triggered." },
      { label: "Approval Levels", why: "Defines the escalation chain.", effect: "Sets each role's limit, e.g. Cashier ≤5%, Supervisor ≤10%, Manager ≤20%, Admin unlimited." },
    ],
  },
  invoice: {
    summary: "How bill numbers are formed and which print layouts are offered.",
    points: [
      { label: "Invoice Prefixes", why: "Identify the series.", effect: "Lead text of every B2C / B2B bill number." },
      { label: "Bill Number Format & Composition", why: "Builds a meaningful number.", effect: "Composes the printed number from Prefix · Branch · Year · Month · Running No., shown live in the preview." },
      { label: "Sequence Reset", why: "Statutory / housekeeping.", effect: "Resets the running number (e.g. each Financial Year) so numbering restarts at the start value." },
      { label: "Branch-Wise / Separate B2B Sequence", why: "Keep series clean.", effect: "Maintains independent running numbers per branch and per B2C/B2B series." },
      { label: "Invoice Print Formats", why: "Match the printer.", effect: "Determines which layouts (Thermal / A4 / Custom) are offered when printing a bill." },
    ],
  },
  delivery: {
    summary: "Delivery handling options available on a bill or order.",
    points: [
      { label: "Delivery Options", why: "Different fulfilment models.", effect: "Each enabled option (immediate / partial / scheduled / challan / proof-of-delivery) appears as a fulfilment choice on the sales screen." },
    ],
  },
  pos: {
    summary: "Show or hide panels and columns on the POS billing screen itself.",
    points: [
      { label: "POS Screen Layout", why: "Tailor the cashier's view.", effect: "Each toggle adds or removes that panel/column — customer, stock, discount, tax, loyalty, product image, quick keys, touch mode, dark mode — from the billing screen." },
    ],
  },
  notification: {
    summary: "Automatic customer messages triggered by billing.",
    points: [
      { label: "Customer Notifications", why: "Engagement & reminders.", effect: "Each enabled channel (SMS / Email / WhatsApp) sends the bill or reminder automatically when a bill is saved or a payment falls due." },
    ],
  },
  ai: {
    summary: "AI assistance surfaced to the cashier during billing.",
    points: [
      { label: "Enable AI", why: "Master switch.", effect: "Turns on AI suggestions on the billing screen." },
      { label: "AI Features", why: "Boost basket size & clearance.", effect: "Each enabled feature surfaces live prompts — upsell/cross-sell items, customer offers, discount or near-expiry clearance suggestions — while billing." },
    ],
  },
  audit: {
    summary: "A read-only trail of changes to this configuration (it does not change billing directly).",
    points: [
      { label: "Change Log", why: "Compliance & accountability.", effect: "Every change to these sales rules is recorded with user, time and old → new value." },
    ],
  },
};

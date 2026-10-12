# Invoice Template Designer & Print Management

Part of **ONE POS** — **Settings → Sales Invoice Template**. A dynamic document template
designer and print-management engine for **sales & print documents**. Supplies the rendered
output for B2C/B2B invoices, quotations, orders, challans, credit/debit notes, receipts and
statements.

> **Scope note:** this module is intentionally limited to sales/print *documents*. **Label
> design (product / shelf / barcode / QR / shipping labels) lives in a separate Label
> Designer module** (Masters / Inventory) since labels are a product-master concern, not a
> sales-document one. Barcodes and QR codes still appear *on* invoices here (tabs 5–6).

## Supported documents

B2C Invoice · B2B Tax Invoice · Sales Quotation · Sales Order · Delivery Challan ·
Purchase Order · Purchase Invoice · Credit Note · Debit Note · Payment Receipt ·
Customer Statement.

## Routes

| Route | Purpose |
| --- | --- |
| `/settings/invoice-template` | Dashboard (6 KPIs) + templates list + Industry Library |
| `/settings/invoice-template/new` | Create a template (14-tab designer) |
| `/settings/invoice-template/[id]` | Edit a template (hydrated from sample data) |

Sidebar: **System → Settings → Sales Invoice Template** (`FileText`), next to Sales Settings.

## Architecture

Mirrors the master-editor pattern (list + 15-tab editor):

- `src/lib/settings/invoiceTemplateConfig.ts` — 14 tabs, template types, paper sizes,
  component palette (header/customer/invoice/product/summary/footer), dynamic-field
  library, barcode/QR options, industry templates, print options, validation areas,
  `SAMPLE_TEMPLATES`, `TEMPLATE_STATS`.
- `src/components/settings/InvoiceTemplateFormContext.tsx` — `InvoiceTemplateProvider` /
  `useInvoiceTemplate()`; `fields`, `toggles` (13 component groups), `flags`,
  `approvalStatus`; `countOn()`, `validate()`, edit-mode `prefill`.
- `src/components/settings/InvoiceTemplateEditor.tsx` — 15 tab bodies via the shared
  `EditorShell`, including a **live paper preview** that re-renders as components toggle.

## The 14 tabs

1. **Template Master** — code, name, type (15 doc types), status, default flag.
2. **Paper** — Thermal (58/76/80/110 mm) · Standard (A5/A4/A3/Legal/Letter) · Custom
   (W×H); orientation; margins (T/B/L/R); auto-fit.
3. **Designer** — drag-style component palette (Header / Customer / Invoice / Product grid
   columns / Summary / Footer) with a **live WYSIWYG preview** that adapts to thermal vs A4
   and reflects barcode/QR placement.
4. **Dynamic Fields** — `{{InvoiceNumber}}`, `{{CustomerName}}`, `{{NetAmount}}`, … 20+
   tokens, draggable into the layout and text bodies.
5. **Barcode** — enable; EAN13/UPC/CODE128/GS1/Custom; placement (header/product/footer).
6. **QR Code** — enable; content (invoice no/product/payment link/customer/GST/**UPI**/
   track-&-trace); placement.
7. **AI Generator** — natural-language prompt → full template; example prompts; AI features
   (creation, layout/branding suggestions, auto-align/resize, industry templates); animated
   generation with preview.
8. **Industry Library** — Grocery/Pharmacy/Textile/Electronics/Wholesale/Hardware/Furniture
   prebuilt templates; preview + one-click apply.
9. **Email Template** — invoice/quotation/statement emails with dynamic-field bodies.
10. **WhatsApp Template** — invoice share / payment reminder / offer / statement messages.
11. **Print Config** — default printer, copies; Thermal/Laser/Inkjet; auto-print, silent
    print, preview-before-print.
12. **Version Mgmt** — version list, created/modified by, status, one-click **rollback**.
13. **Approval** — Draft → Pending → Approved → Rejected; only approved templates billable.
14. **Audit Trail** — template/field changes, print history, usage counts.

## Dashboard (`TEMPLATE_STATS`)

Total Templates · Active · Document Types covered · AI Generated · Most Used · Pending
Approvals. Plus the **Industry Template Library** cards.

## Dynamic field engine

Tokens (`{{...}}`) are resolved at print time against the transaction context (invoice,
customer, branch, company, line items). Same tokens work in the layout, label fields, email
and WhatsApp bodies.

## Validation rules

- Template name & code required, type selected.
- At least one product-grid column.
- If barcode enabled → ≥1 barcode type; if QR enabled → ≥1 QR content option.
- Custom paper requires width & height.
- (Validation areas: missing dynamic fields, duplicate templates, invalid paper sizes,
  invalid barcode placement, invalid QR placement.)

## Database design (reference)

- `doc_template` — id, code, name, type, status, is_default, paper_category, paper_size,
  orientation, margins JSONB, version, approval_status, created_by, updated_by.
- `doc_template_section` — template_id, section (`header`,`products`,…), enabled_components JSONB, order.
- `doc_template_field` — template_id, token, bound_to, format.
- `doc_template_version` — template_id, version, snapshot JSONB, created_by, created_at, note.
- `doc_template_audit` — template_id, user_id, action, detail, at.
- `print_profile` — template_id, printer, copies, auto_print, silent, preview.

## API specification (reference)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/templates` | List templates (filter: type, status) |
| POST | `/api/templates` | Create template |
| GET | `/api/templates/:id` | Fetch template (+ sections/fields) |
| PUT | `/api/templates/:id` | Update (creates a new version) |
| POST | `/api/templates/ai-generate` | Generate template from a prompt |
| POST | `/api/templates/:id/apply-industry/:key` | Apply a prebuilt industry template |
| POST | `/api/templates/:id/render` | Render a document (returns PDF/ESC-POS/ZPL) |
| GET | `/api/templates/:id/versions` | Version history |
| POST | `/api/templates/:id/rollback/:version` | Roll back to a version |
| POST | `/api/templates/:id/approve` | Advance approval state |

Rendering targets: **PDF** (A4/A5 sheets) and **ESC/POS** (thermal). Label rendering
(**ZPL/EPL**) belongs to the separate Label Designer module.

## Responsive design

Built on the shared `EditorShell`. The Designer tab uses a two-column split (palette +
sticky preview) on desktop, stacks the preview below the palette on tablet/mobile, and the
top stepper becomes horizontally scrollable on small screens.

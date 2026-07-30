"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  ScrollText,
  GripVertical,
  Barcode,
  QrCode,
  Check,
  History,
  RotateCcw,
} from "lucide-react";
import { useInvoiceTemplate } from "./InvoiceTemplateFormContext";
import {
  TEMPLATE_TABS,
  TEMPLATE_TYPES,
  MASTER_FIELDS,
  MARGIN_FIELDS,
  CUSTOM_SIZE_FIELDS,
  PRINT_FIELDS,
  PAPER_CATEGORY_OPTS,
  THERMAL_SIZES,
  STANDARD_SIZES,
  ORIENTATION_OPTS,
  HEADER_COMPONENTS,
  CUSTOMER_COMPONENTS,
  INVOICE_COMPONENTS,
  PRODUCT_COLUMNS,
  SUMMARY_ROWS,
  FOOTER_COMPONENTS,
  DYNAMIC_FIELDS,
  BARCODE_TYPES,
  PLACEMENT_OPTS,
  QR_CONTENT,
  AI_FEATURES,
  AI_PROMPT_EXAMPLES,
  INDUSTRY_TEMPLATES,
  EMAIL_TEMPLATES,
  WHATSAPP_TEMPLATES,
  PRINTERS,
  PRINT_FLAGS,
  type TField,
  type TToggle,
  type TFlag,
} from "@/lib/settings/invoiceTemplateConfig";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EditorShell } from "@/components/masters/EditorShell";
import { FieldGuide } from "./FieldGuide";
import { TEMPLATE_GUIDES } from "@/lib/settings/invoiceTemplateGuides";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------- helpers -- */
function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function SubHeading({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="pb-1 pt-1">
      <div className="flex items-center gap-2.5"><span className="h-4 w-1 rounded-full bg-brand-gradient" /><h3 className="text-sm font-semibold text-foreground">{children}</h3><span className="h-px flex-1 bg-border" /></div>
      {hint && <p className="ml-3.5 mt-1 text-2xs text-muted">{hint}</p>}
    </div>
  );
}
function FieldRenderer({ def }: { def: TField }) {
  const { getField, setField, errors } = useInvoiceTemplate();
  const Icon = def.icon;
  const lead = Icon ? <Icon className="h-4 w-4" /> : undefined;
  const common = { label: def.label, info: def.info, sample: def.sample, error: errors[def.name] };
  if (def.type === "textarea") return <Textarea {...common} rows={3} placeholder={def.sample} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
  if (def.type === "select") return <Select {...common} leadingIcon={lead} placeholder="Select…" options={def.options ?? []} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
  return <Input {...common} leadingIcon={lead} type={def.type === "number" ? "number" : "text"} placeholder={def.sample} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
}
function Fields({ defs }: { defs: TField[] }) {
  return <Grid>{defs.map((d) => <div key={d.name} className={d.full ? "sm:col-span-2 lg:col-span-3" : ""}><FieldRenderer def={d} /></div>)}</Grid>;
}
function SelectField({ name, label, options, info }: { name: string; label: string; options: { value: string; label: string }[]; info?: string }) {
  const { getField, setField, errors } = useInvoiceTemplate();
  return <Select label={label} info={info} options={options} error={errors[name]} value={getField(name)} onChange={(e) => setField(name, e.target.value)} placeholder="Select…" />;
}
function ToggleGrid({ group, items, cols = 3 }: { group: string; items: TToggle[]; cols?: 2 | 3 }) {
  const { isOn, toggle, errors } = useInvoiceTemplate();
  return (
    <div className="space-y-2">
      <div className={cn("grid gap-2.5 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3")}>
        {items.map((it) => {
          const active = isOn(group, it.id);
          return (
            <label key={it.id} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition", active ? "border-primary/40 bg-primary-subtle/40" : "border-border bg-surface hover:bg-surface-2")}>
              <span className="flex items-center gap-2"><GripVertical className={cn("h-3.5 w-3.5", active ? "text-primary/50" : "text-subtle")} /><span><span className="block text-sm font-medium text-foreground">{it.label}</span>{it.desc && <span className="text-2xs text-muted">{it.desc}</span>}</span></span>
              <Switch checked={active} onChange={() => toggle(group, it.id)} aria-label={it.label} />
            </label>
          );
        })}
      </div>
      {errors[group] && <p className="text-xs font-medium text-danger">{errors[group]}</p>}
    </div>
  );
}
function Flags({ items, cols = 2 }: { items: TFlag[]; cols?: 1 | 2 | 3 }) {
  const { flag, setFlag } = useInvoiceTemplate();
  return (
    <div className={cn("grid gap-3", cols === 1 ? "grid-cols-1" : cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
      {items.map((it) => (
        <label key={it.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <span><span className="block text-sm font-medium text-foreground">{it.label}</span>{it.desc && <span className="text-2xs text-muted">{it.desc}</span>}</span>
          <Switch checked={flag(it.id)} onChange={(v) => setFlag(it.id, v)} aria-label={it.label} />
        </label>
      ))}
    </div>
  );
}

/* --------------------------------------------------- live paper preview - */
function PaperPreview() {
  const { isOn, flag, getField, countOn } = useInvoiceTemplate();
  const cat = getField("paperCategory");
  const thermal = cat === "thermal";
  const cols = PRODUCT_COLUMNS.filter((c) => isOn("productColumns", c.id));
  const sampleRows = [
    { code: "SKU-1001", name: "Surf Excel 1kg", hsn: "3401", qty: "2", uom: "PCS", rate: "82.50", discount: "5%", tax: "18%", amount: "165.00" },
    { code: "SKU-2087", name: "Tata Salt 1kg", hsn: "2501", qty: "1", uom: "PCS", rate: "28.00", discount: "0%", tax: "5%", amount: "28.00" },
  ];
  return (
    <div className="flex justify-center rounded-2xl bg-surface-2 p-5">
      <div className={cn("origin-top bg-white text-[10px] leading-tight text-slate-800 shadow-lg ring-1 ring-slate-200", thermal ? "w-[280px] p-3" : "w-full max-w-[420px] p-5")}>
        {/* header */}
        <div className={cn("flex items-start gap-3 border-b border-slate-300 pb-2", thermal && "flex-col items-center text-center")}>
          {isOn("headerComponents", "logo") && <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-indigo-600 text-[8px] font-bold text-white">LOGO</div>}
          <div className={cn("flex-1", thermal && "text-center")}>
            {isOn("headerComponents", "companyName") && <p className="text-sm font-bold text-slate-900">{flag("useBranchDetails") ? "One ERP — Chennai Branch" : "One ERP Retail Pvt Ltd"}</p>}
            {isOn("headerComponents", "branchName") && <p className="text-[9px] text-slate-500">Branch: Chennai (CHN)</p>}
            {isOn("headerComponents", "address") && <p className="text-[9px] text-slate-500">12 MG Road, Chennai 600001</p>}
            {isOn("headerComponents", "gst") && <p className="text-[9px] text-slate-500">{flag("useBranchDetails") ? "GSTIN: 33AABCO1234A2Z4 (Branch)" : "GSTIN: 33AABCO1234A1Z5"}</p>}
            {isOn("headerComponents", "contact") && <p className="text-[9px] text-slate-500">Toll-Free: 1800-123-4567</p>}
            {isOn("headerComponents", "fssai") && <p className="text-[9px] text-slate-500">FSSAI: 10012345000123</p>}
            {isOn("headerComponents", "license") && <p className="text-[9px] text-slate-500">DL: TN-20B-1234</p>}
          </div>
          {flag("enableBarcode") && getField("barcodePlacement") === "header" && <BarcodeStub />}
          {flag("enableQr") && getField("qrPlacement") === "header" && <QrStub />}
        </div>
        {/* meta + customer */}
        <div className="flex justify-between gap-2 border-b border-slate-200 py-2">
          <div>
            {isOn("invoiceComponents", "invNumber") && <p><span className="text-slate-400">Invoice:</span> INV-RT/CHN/26-27/0001</p>}
            {isOn("invoiceComponents", "invDate") && <p><span className="text-slate-400">Date:</span> 08-Jun-2026</p>}
            {isOn("invoiceComponents", "salesPerson") && <p><span className="text-slate-400">Sales:</span> Ravi K</p>}
          </div>
          <div className="text-right">
            {isOn("customerComponents", "custName") && <p className="font-semibold">Anand Stores</p>}
            {isOn("customerComponents", "custMobile") && <p className="text-slate-500">+91 98400 11223</p>}
            {isOn("customerComponents", "custGst") && <p className="text-slate-500">33ABCDE9876B1Z2</p>}
            {isOn("customerComponents", "custAddress") && <p className="text-slate-500">Anna Nagar, Chennai</p>}
          </div>
        </div>
        {/* product grid */}
        <table className="my-2 w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[8px] uppercase text-slate-500">
              {cols.length === 0 && <th className="py-1">Add product columns…</th>}
              {cols.map((c) => <th key={c.id} className={cn("py-1", ["rate", "discount", "tax", "amount", "qty"].includes(c.id) && "text-right")}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {sampleRows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                {cols.map((c) => <td key={c.id} className={cn("py-1", ["rate", "discount", "tax", "amount", "qty"].includes(c.id) && "text-right")}>{(r as Record<string, string>)[c.id]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {/* summary */}
        <div className="ml-auto w-1/2 space-y-0.5 border-t border-slate-200 pt-1">
          {isOn("summaryRows", "subtotal") && <Row k="Subtotal" v="193.00" />}
          {isOn("summaryRows", "discount") && <Row k="Discount" v="-8.25" />}
          {isOn("summaryRows", "tax") && <Row k="GST" v="16.84" />}
          {isOn("summaryRows", "roundoff") && <Row k="Round Off" v="0.41" />}
          {isOn("summaryRows", "netAmount") && <div className="flex justify-between border-t border-slate-300 pt-1 text-xs font-bold text-slate-900"><span>Net Amount</span><span>₹202.00</span></div>}
        </div>
        {/* footer */}
        <div className={cn("mt-2 border-t border-slate-200 pt-2", thermal && "text-center")}>
          {flag("enableQr") && getField("qrPlacement") === "footer" && <div className="mb-1 flex justify-center"><QrStub /></div>}
          {flag("enableBarcode") && getField("barcodePlacement") === "footer" && <div className="mb-1 flex justify-center"><BarcodeStub /></div>}
          {isOn("footerComponents", "terms") && <p className="text-[8px] text-slate-400">Terms: Goods once sold will not be taken back.</p>}
          {isOn("footerComponents", "signature") && <p className="mt-2 text-right text-[9px] text-slate-500">Authorised Signatory</p>}
          {isOn("footerComponents", "thankyou") && <p className="mt-1 text-center text-[9px] font-semibold text-indigo-600">Thank you! Visit again 🙏</p>}
        </div>
        <p className="mt-2 text-center text-[7px] text-slate-300">{countOn("productColumns")} cols · {thermal ? `${getField("thermalSize")}mm thermal` : getField("standardSize")}</p>
      </div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-slate-600"><span>{k}</span><span>{v}</span></div>;
}
function BarcodeStub() {
  return <div className="flex flex-col items-center"><div className="flex h-6 items-end gap-[1px]">{[2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3].map((w, i) => <span key={i} className="bg-slate-800" style={{ width: w, height: "100%" }} />)}</div><span className="text-[7px] text-slate-500">8901234567890</span></div>;
}
function QrStub() {
  return <div className="grid grid-cols-4 gap-[1px]">{Array.from({ length: 16 }).map((_, i) => <span key={i} className={cn("h-2 w-2", [0, 1, 2, 4, 6, 8, 9, 11, 13, 15, 3, 12].includes(i) ? "bg-slate-800" : "bg-transparent")} />)}</div>;
}

/* ============================================================== tabs === */
function MasterTab() {
  const { flag, setFlag } = useInvoiceTemplate();
  return (
    <div className="space-y-5">
      <SubHeading>Template Details</SubHeading>
      <Fields defs={MASTER_FIELDS} />
      <Flags items={[{ id: "isDefault", label: "Default Template", desc: "Use this template by default for its document type." }]} cols={1} />
      {!flag("isDefault") && <button onClick={() => setFlag("isDefault", true)} className="text-xs font-medium text-primary hover:underline">Set as default for this document type</button>}
    </div>
  );
}
function PaperTab() {
  const { getField } = useInvoiceTemplate();
  const cat = getField("paperCategory");
  return (
    <div className="space-y-5">
      <SubHeading>Paper Type</SubHeading>
      <Grid>
        <div><SelectField name="paperCategory" label="Paper Category" options={PAPER_CATEGORY_OPTS} /></div>
        {cat === "thermal" && <div><SelectField name="thermalSize" label="Thermal Width" options={THERMAL_SIZES} /></div>}
        {cat === "standard" && <div><SelectField name="standardSize" label="Standard Size" options={STANDARD_SIZES} /></div>}
        <div><SelectField name="orientation" label="Orientation" options={ORIENTATION_OPTS} /></div>
      </Grid>
      {cat === "custom" && <><SubHeading>Custom Dimensions</SubHeading><Fields defs={CUSTOM_SIZE_FIELDS} /></>}
      <SubHeading>Margins (mm)</SubHeading>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{MARGIN_FIELDS.map((d) => <div key={d.name}><FieldRenderer def={d} /></div>)}</div>
      <Flags items={[{ id: "autoFit", label: "Auto Fit", desc: "Scale content to fit the paper width." }]} cols={1} />
    </div>
  );
}
function DesignerTab() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_minmax(300px,420px)]">
      <div className="space-y-5">
        <SubHeading hint="Toggle a component to place it on the layout; drag handles indicate reorderable blocks.">Header Section</SubHeading>
        <ToggleGrid group="headerComponents" items={HEADER_COMPONENTS} />
        <Flags items={[{ id: "useBranchDetails", label: "Use Branch Name & GSTIN", desc: "Header shows branch details instead of the business's common details." }]} cols={1} />
        <SubHeading>Customer Section</SubHeading>
        <ToggleGrid group="customerComponents" items={CUSTOMER_COMPONENTS} />
        <SubHeading>Invoice Section</SubHeading>
        <ToggleGrid group="invoiceComponents" items={INVOICE_COMPONENTS} cols={3} />
        <SubHeading>Product Grid Columns</SubHeading>
        <ToggleGrid group="productColumns" items={PRODUCT_COLUMNS} />
        <SubHeading>Summary Section</SubHeading>
        <ToggleGrid group="summaryRows" items={SUMMARY_ROWS} />
        <SubHeading>Footer Section</SubHeading>
        <ToggleGrid group="footerComponents" items={FOOTER_COMPONENTS} cols={3} />
      </div>
      <div className="xl:sticky xl:top-4 xl:self-start">
        <SubHeading>Live Preview</SubHeading>
        <PaperPreview />
      </div>
    </div>
  );
}
function FieldsTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-info-subtle p-3 text-xs text-info">Drag any token into the designer or paste it into Email/WhatsApp/footer text — it resolves at print time.</div>
      <SubHeading>Dynamic Field Library</SubHeading>
      <div className="flex flex-wrap gap-1.5">
        {DYNAMIC_FIELDS.map((f) => <span key={f} className="cursor-grab rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-2xs font-semibold text-primary transition hover:border-primary hover:bg-primary-subtle">{f}</span>)}
      </div>
    </div>
  );
}
function BarcodeTab() {
  const { flag, setFlag } = useInvoiceTemplate();
  return (
    <div className="space-y-5">
      <Flags items={[{ id: "enableBarcode", label: "Enable Barcode", desc: "Render a barcode on this template." }]} cols={1} />
      <SubHeading>Supported Barcode Types</SubHeading>
      <ToggleGrid group="barcodeTypes" items={BARCODE_TYPES} />
      <SubHeading>Placement</SubHeading>
      <Grid><div><SelectField name="barcodePlacement" label="Barcode Placement" options={PLACEMENT_OPTS} /></div></Grid>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"><Barcode className="h-5 w-5 text-primary" /><span className="text-sm text-muted">Preview reflects the placement in the Designer tab.</span></div>
      {!flag("enableBarcode") && <button onClick={() => setFlag("enableBarcode", true)} className="text-xs font-medium text-primary hover:underline">Enable barcode to configure placement</button>}
    </div>
  );
}
function QrTab() {
  const { flag, setFlag } = useInvoiceTemplate();
  return (
    <div className="space-y-5">
      <Flags items={[{ id: "enableQr", label: "Enable QR Code", desc: "Render a QR code on this template." }]} cols={1} />
      <SubHeading>QR Content</SubHeading>
      <ToggleGrid group="qrContent" items={QR_CONTENT} />
      <SubHeading>Placement</SubHeading>
      <Grid><div><SelectField name="qrPlacement" label="QR Placement" options={PLACEMENT_OPTS} /></div></Grid>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"><QrCode className="h-5 w-5 text-primary" /><span className="text-sm text-muted">UPI QR auto-encodes the bill amount &amp; merchant VPA at print time.</span></div>
      {!flag("enableQr") && <button onClick={() => setFlag("enableQr", true)} className="text-xs font-medium text-primary hover:underline">Enable QR to configure content</button>}
    </div>
  );
}
function AiTab() {
  const { getField, setField } = useInvoiceTemplate();
  const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white"><Sparkles className="h-6 w-6 shrink-0" /><div><p className="text-sm font-bold">AI Template Generator</p><p className="text-xs text-white/85">Describe the document — AI builds the full layout, paper size, fields, barcode &amp; QR automatically.</p></div></div>
      <SubHeading>Describe Your Template</SubHeading>
      <Textarea label="AI Prompt" rows={3} placeholder="Create a professional A4 B2B tax invoice with logo, GST, customer details, product table, tax summary, QR and payment instructions." value={getField("aiPrompt")} onChange={(e) => setField("aiPrompt", e.target.value)} />
      <div className="flex flex-wrap gap-1.5">
        {AI_PROMPT_EXAMPLES.map((p, i) => <button key={i} onClick={() => setField("aiPrompt", p)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-2xs font-medium text-muted transition hover:border-primary hover:text-primary">Example {i + 1}</button>)}
      </div>
      <SubHeading>AI Capabilities</SubHeading>
      <div className="flex flex-wrap gap-1.5">{AI_FEATURES.map((f) => <span key={f} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{f}</span>)}</div>
      {phase === "idle" && <Button size="lg" disabled={!getField("aiPrompt")} onClick={() => { setPhase("processing"); window.setTimeout(() => setPhase("done"), 1500); }}><Sparkles className="h-4 w-4" /> Generate Template</Button>}
      {phase === "processing" && <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium text-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Composing layout, choosing paper size &amp; mapping dynamic fields…</div>}
      {phase === "done" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-success-subtle p-3 text-sm font-semibold text-success"><Check className="h-4 w-4" /> Template generated — applied to the Designer &amp; Paper tabs. Review &amp; save.</div>
          <PaperPreview />
        </div>
      )}
    </div>
  );
}
function IndustryTab() {
  const [applied, setApplied] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <SubHeading hint="One-click apply a battle-tested layout, then fine-tune in the Designer.">Prebuilt Industry Templates</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INDUSTRY_TEMPLATES.map((t) => (
          <div key={t.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold text-foreground">{t.name}</p><Badge tone="info">{t.paper}</Badge></div>
            <p className="flex-1 text-2xs text-muted">{t.desc}</p>
            <Button variant={applied === t.id ? "secondary" : "outline"} size="sm" onClick={() => setApplied(t.id)}>{applied === t.id ? <><Check className="h-3.5 w-3.5" /> Applied</> : "Preview & Apply"}</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
function EmailTab() {
  const { getField, setField } = useInvoiceTemplate();
  return (
    <div className="space-y-5">
      <SubHeading>Email Templates</SubHeading>
      <ToggleGrid group="emailTemplates" items={EMAIL_TEMPLATES} cols={3} />
      <SubHeading>Invoice Email Body</SubHeading>
      <Textarea label="Body (supports dynamic fields)" rows={4} placeholder="Dear {{CustomerName}}, please find attached invoice {{InvoiceNumber}} dated {{InvoiceDate}} for {{NetAmount}}." value={getField("emailBody")} onChange={(e) => setField("emailBody", e.target.value)} />
    </div>
  );
}
function WhatsappTab() {
  const { getField, setField } = useInvoiceTemplate();
  return (
    <div className="space-y-5">
      <SubHeading>WhatsApp Templates</SubHeading>
      <ToggleGrid group="whatsappTemplates" items={WHATSAPP_TEMPLATES} />
      <SubHeading>Invoice Share Message</SubHeading>
      <Textarea label="Message (supports dynamic fields)" rows={3} placeholder="Hi {{CustomerName}}, your bill {{InvoiceNumber}} of {{NetAmount}} is ready. Pay via UPI: {{PaymentLink}}" value={getField("waMessage")} onChange={(e) => setField("waMessage", e.target.value)} />
    </div>
  );
}
function PrintTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Printer Setup</SubHeading>
      <Fields defs={PRINT_FIELDS} />
      <SubHeading>Supported Printers</SubHeading>
      <ToggleGrid group="printers" items={PRINTERS} cols={3} />
      <SubHeading>Print Behaviour</SubHeading>
      <Flags items={PRINT_FLAGS} cols={3} />
    </div>
  );
}
function VersionTab() {
  const versions = [
    { v: "v4", by: "design.admin", at: "2026-06-08 11:02", status: "Active", note: "Added UPI QR to footer" },
    { v: "v3", by: "design.admin", at: "2026-05-20 16:40", status: "Archived", note: "HSN column added" },
    { v: "v2", by: "ravi.k", at: "2026-04-11 10:15", status: "Archived", note: "Switched to A4 from Letter" },
    { v: "v1", by: "ravi.k", at: "2026-03-01 09:00", status: "Archived", note: "Initial template" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg bg-primary-subtle/40 p-3 text-xs text-foreground"><History className="h-4 w-4 text-primary" /> Every save creates a new version. Roll back to any previous version instantly.</div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Version</th><th className="px-4 py-2.5">Change</th><th className="px-4 py-2.5">By</th><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5 text-center">Status</th><th className="px-4 py-2.5 text-right">Action</th></tr></thead>
          <tbody>
            {versions.map((r) => (
              <tr key={r.v} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-mono font-semibold text-foreground">{r.v}</td>
                <td className="px-4 py-2.5 text-muted">{r.note}</td>
                <td className="px-4 py-2.5 text-muted">{r.by}</td>
                <td className="px-4 py-2.5 text-2xs text-muted">{r.at}</td>
                <td className="px-4 py-2.5 text-center"><Badge tone={r.status === "Active" ? "success" : "neutral"}>{r.status}</Badge></td>
                <td className="px-4 py-2.5 text-right">{r.status !== "Active" && <button className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><RotateCcw className="h-3.5 w-3.5" /> Rollback</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function ApprovalTab() {
  const { data, setApproval } = useInvoiceTemplate();
  const steps = ["draft", "pending", "approved", "rejected"] as const;
  return (
    <div className="space-y-5">
      <SubHeading>Template Approval</SubHeading>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s) => (
          <button key={s} onClick={() => setApproval(s)} className={cn("rounded-lg border px-3 py-2.5 text-xs font-semibold capitalize transition", data.approvalStatus === s ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40")}>{s}</button>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Workflow: <strong className="text-foreground">Draft → Pending Approval → Approved</strong>. Only approved templates can be set as default or used at billing.</div>
    </div>
  );
}
function AuditTab() {
  const log = [
    { user: "design.admin", action: "Enabled UPI QR in footer", at: "2026-06-08 11:02", tone: "success" },
    { user: "design.admin", action: "Added HSN column to product grid", at: "2026-05-20 16:40", tone: "info" },
    { user: "ravi.k", action: "Printed 1,240 invoices with this template", at: "2026-05-19 18:20", tone: "info" },
    { user: "fin.mgr", action: "Approved template v3", at: "2026-05-20 17:00", tone: "success" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg bg-primary-subtle/40 p-3 text-xs text-foreground"><ScrollText className="h-4 w-4 text-primary" /> Tracks template &amp; field changes, print history and usage counts.</div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Date &amp; Time</th></tr></thead>
          <tbody>
            {log.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{l.user}</td>
                <td className="px-4 py-2.5"><span className={cn("inline-flex items-center gap-1.5", l.tone === "success" ? "text-success" : "text-muted")}><span className={cn("h-1.5 w-1.5 rounded-full", l.tone === "success" ? "bg-success" : "bg-info")} />{l.action}</span></td>
                <td className="px-4 py-2.5 text-muted">{l.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TAB_BODIES: Record<string, () => ReactNode> = {
  master: MasterTab, paper: PaperTab, designer: DesignerTab, fields: FieldsTab, barcode: BarcodeTab,
  qr: QrTab, ai: AiTab, industry: IndustryTab, email: EmailTab,
  whatsapp: WhatsappTab, print: PrintTab, version: VersionTab, approval: ApprovalTab, audit: AuditTab,
};

export function InvoiceTemplateEditor({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const form = useInvoiceTemplate();
  const isEdit = !!templateId;
  const tabs = useMemo(() => TEMPLATE_TABS, []);
  const [activeId, setActiveId] = useState("master");
  const [saved, setSaved] = useState(false);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const Body = TAB_BODIES[tabs[activeIndex].id];
  const statusTone = form.data.approvalStatus === "approved" ? "success" : form.data.approvalStatus === "rejected" ? "danger" : "warning";
  const typeLabel = TEMPLATE_TYPES.find((t) => t.value === form.getField("templateType"))?.label ?? "—";
  const paper = form.getField("paperCategory") === "thermal" ? `${form.getField("thermalSize")}mm Thermal` : form.getField("paperCategory") === "custom" ? `${form.getField("customWidth")}×${form.getField("customHeight")}mm` : form.getField("standardSize");

  function save() {
    if (!form.validate()) { setActiveId("master"); return; }
    setSaved(true);
    window.setTimeout(() => router.push("/settings/invoice-template"), 1300);
  }

  return (
    <EditorShell
      parentLabel="Invoice Templates"
      parentHref="/settings/invoice-template"
      cancelHref="/settings/invoice-template"
      title={form.getField("templateName") || (isEdit ? "Edit Template" : "New Template")}
      status={{ label: form.data.approvalStatus, tone: statusTone }}
      tabs={tabs}
      activeId={activeId}
      onTab={setActiveId}
      onAi={() => setActiveId("ai")}
      aiLabel="AI Template Generator"
      onSaveDraft={() => form.setApproval("pending")}
      onSave={save}
      saveLabel="Save Template"
      summaryTitle="Template Summary"
      summaryName={form.getField("templateName") || "New Template"}
      summaryCode={form.getField("templateCode") || "—"}
      summaryBadges={[{ label: form.data.approvalStatus, tone: statusTone }, ...(form.flag("isDefault") ? [{ label: "Default", tone: "primary" as const }] : [])]}
      summaryFields={[
        { label: "Type", value: typeLabel },
        { label: "Paper", value: paper || "—" },
        { label: "Orientation", value: form.getField("orientation") },
        { label: "Columns", value: String(form.countOn("productColumns")) },
        { label: "Barcode / QR", value: `${form.flag("enableBarcode") ? "Barcode" : "—"} / ${form.flag("enableQr") ? "QR" : "—"}` },
      ]}
      ai={[
        { ok: form.countOn("productColumns") > 0, text: form.countOn("productColumns") > 0 ? "Product grid configured" : "Add product columns" },
        { ok: form.flag("enableQr"), text: form.flag("enableQr") ? "QR enabled (UPI ready)" : "Add a UPI QR for payments" },
        { ok: form.data.approvalStatus === "approved", text: form.data.approvalStatus === "approved" ? "Template approved" : "Send for approval before use" },
      ]}
      saved={saved}
      savedText={`${form.getField("templateName") || "Template"} has been ${isEdit ? "updated" : "saved"}. Redirecting…`}
      headerAction={<FieldGuide guide={TEMPLATE_GUIDES[activeId]} effectLabel="On the printout" />}
    >
      {Body && <Body />}
    </EditorShell>
  );
}

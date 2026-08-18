"use client";

import { useEffect, useState } from "react";
import { FileText, Save, CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_RECEIPT, PAPER_SIZES, type ReceiptTemplate } from "@/lib/settings/receiptTemplate";
import { buildTaxInvoiceHtml, TAX_INVOICE_SAMPLE } from "@/lib/print/taxInvoiceHtml";
import { buildWeightSlipHtml, WEIGHT_SLIP_SAMPLE } from "@/lib/print/weightSlipHtml";
import { buildTokenSlipHtml, TOKEN_SLIP_SAMPLE } from "@/lib/print/tokenSlipHtml";
import { buildTaxInvoiceT3Html, TAX_INVOICE_T3_SAMPLE } from "@/lib/print/taxInvoiceT3Html";
import { cn } from "@/lib/cn";

const FLAGS: { k: keyof ReceiptTemplate; label: string; desc: string }[] = [
  { k: "showGstin", label: "Show GSTIN", desc: "Print the store GST number in the header." },
  { k: "showCustomer", label: "Show Customer", desc: "Print customer name & phone." },
  { k: "showTaxBreakup", label: "Show GST Breakup", desc: "Print taxable value + CGST/SGST." },
  { k: "showHsn", label: "Show HSN", desc: "Print HSN code per line item." },
  { k: "showItemTax", label: "Show Item Tax %", desc: "Print GST % against each line." },
  { k: "showMrp", label: "Show MRP", desc: "Print MRP when higher than the selling rate." },
  { k: "showSavings", label: "Show Savings", desc: "Print total amount the customer saved." },
];

const TABS = [
  { id: "B2C", label: "Sales Invoice B2C", desc: "Printed POS bill / thermal receipt." },
  { id: "B2B", label: "Sales Invoice B2B", desc: "Tax invoice for business customers." },
  { id: "B2B_T2", label: "Sales Invoice B2B (Template 2)", desc: "Alternate A4 tax invoice design — Bill To/Vehicle/Driver/weight detail. Configurable, but no longer printed by default (superseded by Template 3 below)." },
  { id: "B2B_T3", label: "Sales Invoice B2B (Template 3)", desc: "GST-style A4 tax invoice with a Bank QR code + Signature — this is the design printed from Load & Dispatch and the Sales Invoice page." },
  { id: "WEIGHT_SLIP", label: "Weight Slip", desc: "Weighbridge slip printed alongside the invoice from Load & Dispatch." },
  { id: "TOKEN", label: "Pre Load Weight Slip (Token)", desc: "Gate token printed right after a Pre-Loading Weighment — Empty weight only, Load/Net Weight blank until loading is done." },
  { id: "COLLECTION", label: "Customer Collection", desc: "Receipt given on collecting payment." },
] as const;
type TplType = (typeof TABS)[number]["id"];
// These documents are dynamic, generated-HTML designs (src/lib/print/*Html.ts)
// rather than the toggle-driven receipt this page otherwise edits — only the
// text fields below apply; "What to Print" toggles don't.
const CUSTOM_DESIGN_TYPES: TplType[] = ["B2B_T2", "B2B_T3", "WEIGHT_SLIP", "TOKEN"];

export default function InvoiceTemplatePage() {
  const toast = useToast();
  const [type, setType] = useState<TplType>("B2C");
  const [tpl, setTpl] = useState<ReceiptTemplate>(DEFAULT_RECEIPT);
  // B2B_T3 only — not part of the shared ReceiptTemplate shape (every other
  // template type has no use for them), so kept as separate local state.
  const [qrCodeImage, setQrCodeImage] = useState("");
  const [signatureImage, setSignatureImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const j = await fetch(`/api/settings/invoice-template?type=${type}`, { cache: "no-store" }).then((r) => r.json());
        if (active && j.ok) {
          setTpl({ ...DEFAULT_RECEIPT, ...j.template });
          setQrCodeImage(j.template.qrCodeImage || "");
          setSignatureImage(j.template.signatureImage || "");
        }
      } catch { /**/ } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [type]);
  const set = <K extends keyof ReceiptTemplate>(k: K, v: ReceiptTemplate[K]) => setTpl((t) => ({ ...t, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const body = type === "B2B_T3" ? { ...tpl, type, qrCodeImage, signatureImage } : { ...tpl, type };
      const j = await fetch(`/api/settings/invoice-template?type=${type}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (toast.result(j, "Invoice template saved.", "Could not save the invoice template.")) { setSaved(true); window.setTimeout(() => setSaved(false), 2000); }
    } catch { toast.error("Could not reach the server. Please try again."); }
    setSaving(false);
  }
  function onImageFile(kind: "qr" | "signature", file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const url = String(reader.result); if (kind === "qr") setQrCodeImage(url); else setSignatureImage(url); };
    reader.readAsDataURL(file);
  }

  const activeTab = TABS.find((t) => t.id === type)!;
  const isCustomDesign = CUSTOM_DESIGN_TYPES.includes(type);
  const stripAutoPrint = (html: string) => html.replace(/<script>window\.onload[\s\S]*?<\/script>/, "");
  const buildPreviewHtml = () => (type === "WEIGHT_SLIP"
    ? buildWeightSlipHtml(WEIGHT_SLIP_SAMPLE, { title: tpl.title, footerNote: tpl.footerNote })
    : type === "TOKEN"
    ? buildTokenSlipHtml(TOKEN_SLIP_SAMPLE, { title: tpl.title, footerNote: tpl.footerNote, tokenCodeType: tpl.tokenCodeType, tokenBrandFontSize: tpl.tokenBrandFontSize, tokenBoldValues: tpl.tokenBoldValues }, typeof window !== "undefined" ? window.location.origin : "")
    : type === "B2B_T3"
    ? buildTaxInvoiceT3Html({ ...TAX_INVOICE_T3_SAMPLE, qrCodeImage: qrCodeImage || null, signatureImage: signatureImage || null, termsNote: tpl.footerNote || TAX_INVOICE_T3_SAMPLE.termsNote }, { title: tpl.title, footerNote: tpl.footerNote })
    : buildTaxInvoiceHtml(TAX_INVOICE_SAMPLE, { title: tpl.title, footerNote: tpl.footerNote }));
  const isSlip = type === "WEIGHT_SLIP" || type === "TOKEN";
  const previewHtmlNoAutoPrint = isCustomDesign ? stripAutoPrint(buildPreviewHtml()) : "";
  function openFullPreview() {
    const w = window.open("", "_blank", "width=900,height=800");
    if (!w) return;
    w.document.write(buildPreviewHtml()); w.document.close();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Invoice Template</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileText className="h-5 w-5 text-primary" /> Invoice Template</h1>
          <p className="mt-0.5 text-sm text-muted">{activeTab.desc} Each template is saved separately.</p>
        </div>
        <Button size="md" onClick={save} disabled={saving || loading}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Template"}{saved && <CheckCircle2 className="h-4 w-4" />}</Button>
      </div>

      {/* Template type tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setType(t.id)} className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition", type === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>{t.label}</button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Section title="Layout & Text">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Invoice Title"><input value={tpl.title} onChange={(e) => set("title", e.target.value)} placeholder="Tax Invoice" className={inp} /></Field>
              <Field label="Paper Size">
                <div className="flex flex-wrap gap-1.5">{PAPER_SIZES.map((p) => <button key={p.value} onClick={() => set("paperSize", p.value)} className={cn("rounded-md border px-2.5 py-2 text-2xs font-semibold transition", tpl.paperSize === p.value ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40")}>{p.label}</button>)}</div>
              </Field>
              <div className="sm:col-span-2"><Field label="Header Note (under store name)"><input value={tpl.headerNote} onChange={(e) => set("headerNote", e.target.value)} placeholder="e.g. Branch / address line" className={inp} /></Field></div>
              {!isCustomDesign && <Field label="Thank-You Message"><input value={tpl.thankYouMessage} onChange={(e) => set("thankYouMessage", e.target.value)} className={inp} /></Field>}
              <Field label={isCustomDesign ? "Footer Note" : "Footer Note / Terms"}><input value={tpl.footerNote} onChange={(e) => set("footerNote", e.target.value)} placeholder={isSlip ? "e.g. Thank you for your business." : "e.g. Goods once sold…"} className={inp} /></Field>
            </div>
          </Section>
          {!isCustomDesign && (
            <>
              <Section title="Header Details">
                <p className="mb-3 text-2xs text-muted">Configure the company identity printed at the top of the bill.</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <HeaderToggle label="Use Branch Name &amp; GSTIN" desc="Show the branch's name & GSTIN instead of the business's common details." checked={tpl.useBranchDetails} onChange={() => set("useBranchDetails", !tpl.useBranchDetails)} />
                  <HeaderToggle label="Show Branch Name" desc="Print the branch name line in the header." checked={tpl.showBranchName} onChange={() => set("showBranchName", !tpl.showBranchName)} />
                  <HeaderToggle label="Show Contact / Toll-Free No." desc="Print a contact or toll-free number." checked={tpl.showContact} onChange={() => set("showContact", !tpl.showContact)} />
                </div>
                {tpl.showContact && (
                  <div className="mt-3 max-w-xs">
                    <Field label="Contact / Toll-Free Number"><input value={tpl.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} placeholder="1800-123-4567" className={inp} /></Field>
                  </div>
                )}
              </Section>
              <Section title="What to Print">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {FLAGS.map((f) => (
                    <label key={f.k} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                      <span><span className="block text-sm font-medium text-foreground">{f.label}</span><span className="block text-2xs text-subtle">{f.desc}</span></span>
                      <Switch checked={!!tpl[f.k]} onChange={() => set(f.k, !tpl[f.k] as never)} aria-label={f.label} />
                    </label>
                  ))}
                </div>
              </Section>
            </>
          )}
          {isCustomDesign && (
            <Section title="About this design">
              <p className="text-2xs text-muted">
                {type === "B2B_T2"
                  ? "This is a purpose-built A4 Tax Invoice layout (Bill To / Bill No / Vehicle Number / Delivery To / Driver, a weighbridge-style item line with Empty/Load/Net weight, GST breakup, Royalty Pass and Round Off) — kept configurable, but no longer printed by default from anywhere (Template 3 below replaced it). Only Title and Footer Note are configurable here; every other field (customer, amounts, vehicle, weights) is filled in per-invoice automatically."
                  : type === "B2B_T3"
                  ? "This is the GST-style A4 Tax Invoice (company + invoice-meta header with Driver/Vehicle/Delivery, Bill To, a Price/Taxable Price/GST item table, an HSN-wise CGST/SGST summary table, Bank QR + Signature) printed from a Load & Dispatch record's \"Print Invoice\" button AND from the Sales Invoice (B2B) page's \"Print\" button — this is the design actually used by both, replacing Template 2. Title and Footer Note (used as the Terms note) are configurable here, along with the Bank QR code and Signature images below; everything else is filled in per-invoice automatically."
                  : type === "TOKEN"
                  ? "This is the gate token printed right after a Pre-Loading Weighment is recorded (Token No, product, Ref No, date/in-time, customer, vehicle, Empty weight, payment, delivery) — Load & Net Weight always print blank since they aren't known until the vehicle is loaded and weighed out. Only Title and Footer Note are configurable here; a fixed safety notice always prints below the fields."
                  : "This is the weighbridge slip (Token No, Ref No, In/Out time, vehicle, Empty/Load/Net weight, payment, delivery) printed from a Load & Dispatch record's \"Print Weight Slip\" button. Only Title and Footer Note are configurable here — the rest is filled in per-dispatch automatically."}
              </p>
            </Section>
          )}
          {type === "TOKEN" && (
            <Section title="Scannable Code">
              <p className="mb-3 text-2xs text-muted">QR Code prints a real, scannable QR encoding a link back to this gate entry (for a future mobile loading-confirmation flow). Barcode keeps the plain decorative bar graphic used previously.</p>
              <div className="flex gap-1.5">
                {(["qrcode", "barcode"] as const).map((v) => (
                  <button key={v} onClick={() => set("tokenCodeType", v)} className={cn("rounded-md border px-3 py-2 text-2xs font-semibold transition", tpl.tokenCodeType === v ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40")}>{v === "qrcode" ? "QR Code" : "Barcode"}</button>
                ))}
              </div>
            </Section>
          )}
          {type === "TOKEN" && (
            <Section title="Token Display">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business Name Size">
                  <div className="flex gap-1.5">
                    {(["normal", "large", "xlarge"] as const).map((v) => (
                      <button key={v} onClick={() => set("tokenBrandFontSize", v)} className={cn("rounded-md border px-2.5 py-2 text-2xs font-semibold transition", tpl.tokenBrandFontSize === v ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40")}>{v === "normal" ? "Normal" : v === "large" ? "Large" : "Extra Large"}</button>
                    ))}
                  </div>
                </Field>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                  <span><span className="block text-sm font-medium text-foreground">Bold Values</span><span className="block text-2xs text-subtle">Print field values (Token No, Customer, Vehicle, etc.) in bold.</span></span>
                  <Switch checked={!!tpl.tokenBoldValues} onChange={(v) => set("tokenBoldValues", v)} aria-label="Bold values" />
                </label>
              </div>
            </Section>
          )}
          {type === "B2B_T3" && (
            <Section title="Bank QR & Signature">
              <div className="grid gap-4 sm:grid-cols-2">
                <ImageUpload
                  label="Bank QR Code" desc={'Shown under "Bank Details" — scannable UPI QR for payment.'}
                  value={qrCodeImage} onFile={(f) => onImageFile("qr", f)} onRemove={() => setQrCodeImage("")}
                />
                <ImageUpload
                  label="Authorized Signatory Signature" desc={'Printed above "Authorized Signatory" in the footer.'}
                  value={signatureImage} onFile={(f) => onImageFile("signature", f)} onRemove={() => setSignatureImage("")}
                />
              </div>
            </Section>
          )}
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4">
          {isCustomDesign ? (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Printer className="h-4 w-4 text-primary" /> Design Preview</div>
                <Button variant="outline" size="sm" onClick={openFullPreview}><Printer className="h-3.5 w-3.5" /> Open Full Preview</Button>
              </div>
              <div className="overflow-hidden rounded-lg border border-dashed border-border-strong bg-white" style={{ height: isSlip ? 420 : 520 }}>
                <iframe
                  key={type} title="Template preview" srcDoc={previewHtmlNoAutoPrint}
                  style={{
                    width: isSlip ? 360 : 800,
                    height: isSlip ? 525 : 1444,
                    transform: `scale(${isSlip ? 288 / 360 : 288 / 800})`,
                    transformOrigin: "top left", border: 0,
                  }}
                />
              </div>
              <p className="mt-2 text-center text-2xs text-subtle">Sample data shown — real invoices/dispatches fill every field in automatically.</p>
            </div>
          ) : (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground"><Printer className="h-4 w-4 text-primary" /> Receipt Preview</div>
            <div className="mx-auto max-w-[240px] rounded-lg border border-dashed border-border-strong bg-white p-3 font-mono text-[10px] leading-relaxed text-slate-900">
              <div className="text-center">
                <div className="text-sm font-bold">{tpl.useBranchDetails ? "VSS Textiles — Chennai" : "VSS Textiles"}</div>
                {tpl.showBranchName && <div className="text-slate-500">Branch: Chennai (CHN)</div>}
                {tpl.headerNote && <div className="text-slate-500">{tpl.headerNote}</div>}
                {tpl.showGstin && <div className="text-slate-500">GSTIN: {tpl.useBranchDetails ? "33ABCDE1234F2Z4" : "33ABCDE1234F1Z5"}</div>}
                {tpl.showContact && <div className="text-slate-500">{tpl.contactNumber || "Toll-Free: 1800-123-4567"}</div>}
                <div className="mt-1 font-bold">{tpl.title}</div>
              </div>
              <div className="my-1 border-t border-dashed border-slate-400" />
              <div>Bill: INV-000001</div><div>Date: 2026-06-21</div>{tpl.showCustomer && <div>Customer: Walk-in</div>}
              <div className="my-1 border-t border-dashed border-slate-400" />
              <div className="flex justify-between"><span>Cotton Shirt<br /><span className="text-slate-500">2 x 499.00{tpl.showHsn ? " · HSN 6205" : ""}{tpl.showItemTax ? " · 5%" : ""}{tpl.showMrp ? " · MRP 599" : ""}</span></span><span>998.00</span></div>
              <div className="my-1 border-t border-dashed border-slate-400" />
              {tpl.showTaxBreakup && <><div className="flex justify-between"><span>Taxable</span><span>950.48</span></div><div className="flex justify-between"><span>CGST</span><span>23.76</span></div><div className="flex justify-between"><span>SGST</span><span>23.76</span></div></>}
              <div className="flex justify-between text-xs font-bold"><span>TOTAL</span><span>998.00</span></div>
              <div className="my-1 border-t border-dashed border-slate-400" />
              <div className="text-center">Items: 2{tpl.showSavings ? " · You saved 200.00" : ""}</div>
              <div className="mt-1 text-center">{tpl.thankYouMessage}</div>{tpl.footerNote && <div className="text-center text-slate-500">{tpl.footerNote}</div>}
            </div>
            <p className="mt-2 text-center text-2xs text-subtle">{PAPER_SIZES.find((p) => p.value === tpl.paperSize)?.label}</p>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inp = "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1.5 block text-xs font-semibold text-foreground">{label}</label>{children}</div>; }
function HeaderToggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span><span className="block text-sm font-medium text-foreground">{label}</span><span className="block text-2xs text-subtle">{desc}</span></span>
      <Switch checked={checked} onChange={onChange} aria-label={label} />
    </label>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="mb-4 text-sm font-bold text-foreground">{title}</h2>{children}</div>; }
function ImageUpload({ label, desc, value, onFile, onRemove }: { label: string; desc: string; value: string; onFile: (f: File | undefined) => void; onRemove: () => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-foreground">{label}</label>
      <p className="mb-2 text-2xs text-subtle">{desc}</p>
      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="h-16 w-16 rounded-md border border-border object-contain bg-white p-1" />
          <button type="button" onClick={onRemove} className="text-xs font-medium text-muted transition hover:text-danger">Remove</button>
        </div>
      ) : (
        <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-border-strong bg-surface text-2xs font-medium text-muted hover:border-primary hover:text-primary">
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { FileText, Save, CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_RECEIPT, PAPER_SIZES, type ReceiptTemplate } from "@/lib/settings/receiptTemplate";
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
  { id: "COLLECTION", label: "Customer Collection", desc: "Receipt given on collecting payment." },
] as const;
type TplType = (typeof TABS)[number]["id"];

export default function InvoiceTemplatePage() {
  const toast = useToast();
  const [type, setType] = useState<TplType>("B2C");
  const [tpl, setTpl] = useState<ReceiptTemplate>(DEFAULT_RECEIPT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try { const j = await fetch(`/api/settings/invoice-template?type=${type}`, { cache: "no-store" }).then((r) => r.json()); if (active && j.ok) setTpl({ ...DEFAULT_RECEIPT, ...j.template }); } catch { /**/ } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [type]);
  const set = <K extends keyof ReceiptTemplate>(k: K, v: ReceiptTemplate[K]) => setTpl((t) => ({ ...t, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const j = await fetch(`/api/settings/invoice-template?type=${type}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...tpl, type }) }).then((r) => r.json());
      if (toast.result(j, "Invoice template saved.", "Could not save the invoice template.")) { setSaved(true); window.setTimeout(() => setSaved(false), 2000); }
    } catch { toast.error("Could not reach the server. Please try again."); }
    setSaving(false);
  }

  const activeTab = TABS.find((t) => t.id === type)!;

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
              <Field label="Thank-You Message"><input value={tpl.thankYouMessage} onChange={(e) => set("thankYouMessage", e.target.value)} className={inp} /></Field>
              <Field label="Footer Note / Terms"><input value={tpl.footerNote} onChange={(e) => set("footerNote", e.target.value)} placeholder="e.g. Goods once sold…" className={inp} /></Field>
            </div>
          </Section>
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
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4">
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

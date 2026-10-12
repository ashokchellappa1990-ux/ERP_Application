"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Truck, Save, Loader2, FileText, ShieldCheck, GitCompare, ClipboardCheck, Hash, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { SettingsScopeBanner } from "@/components/scope/SettingsScopeBanner";
import { DEFAULT_PURCHASE_INVOICE_CONFIG, type PurchaseConfigData } from "@/lib/settings/purchaseConfigDefaults";
import { cn } from "@/lib/cn";

interface FlagDef { id: string; label: string; desc?: string }

const GENERAL: FlagDef[] = [
  { id: "enablePurchaseInvoice", label: "Enable Purchase Invoice", desc: "Master switch for the supplier-bill module." },
  { id: "autoCreatePiDuringGrn", label: "Auto Create Purchase Invoice During GRN", desc: "If supplier-invoice details are entered at GRN, auto-create the PI (read-only)." },
  { id: "allowPiAfterGrn", label: "Allow Purchase Invoice After GRN", desc: "Let Accounts record the bill against a pending GRN later." },
  { id: "autoCreateOutstanding", label: "Auto Create Supplier Outstanding", desc: "Record the supplier payable when the invoice posts." },
  { id: "autoAccountsPosting", label: "Auto Accounts Posting", desc: "Post the bill-level accounting automatically on save/approve." },
];
const MANDATORY: FlagDef[] = [
  { id: "invoiceNoMandatory", label: "Supplier Invoice Number Mandatory" },
  { id: "invoiceDateMandatory", label: "Supplier Invoice Date Mandatory" },
  { id: "dueDateMandatory", label: "Due Date Mandatory" },
  { id: "billAttachmentMandatory", label: "Supplier Bill Attachment Mandatory" },
  { id: "gstMandatory", label: "GST Mandatory" },
];
const APPROVAL: FlagDef[] = [
  { id: "approvalRequired", label: "Approval Required", desc: "Route the invoice through approval before posting." },
];
const MATCHING: FlagDef[] = [
  { id: "allowMultipleGrnsPerInvoice", label: "Allow Multiple GRNs Against One Invoice" },
  { id: "allowMultipleInvoicesPerGrn", label: "Allow Multiple Invoices Against One GRN" },
  { id: "twoWayMatch", label: "Enable Two-Way Matching", desc: "PO ↔ Invoice." },
  { id: "threeWayMatch", label: "Enable Three-Way Matching", desc: "PO ↔ GRN ↔ Invoice." },
];

export function PurchaseSettings() {
  const router = useRouter();
  const toast = useToast();
  const [cfg, setCfg] = useState<PurchaseConfigData>(() => JSON.parse(JSON.stringify(DEFAULT_PURCHASE_INVOICE_CONFIG)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/settings/purchase", { cache: "no-store" }).then((r) => r.json());
        if (j.ok && j.config) setCfg(j.config);
      } catch { /* keep defaults */ } finally { setLoading(false); }
    })();
  }, []);

  const flag = (id: string) => !!cfg.flags[id];
  const setFlag = (id: string, v: boolean) => setCfg((c) => ({ ...c, flags: { ...c.flags, [id]: v } }));
  const field = (n: string) => cfg.fields[n] ?? "";
  const setField = (n: string, v: string) => setCfg((c) => ({ ...c, fields: { ...c.fields, [n]: v } }));

  async function save() {
    setSaving(true);
    try {
      const j = await fetch("/api/settings/purchase", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) }).then((r) => r.json());
      if (toast.result(j, "Purchase configuration saved.", "Could not save purchase configuration.")) {
        if (j.config) setCfg(j.config);
      }
    } catch { toast.error("Could not reach the server."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading purchase configuration…" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Purchase Configuration</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> Purchase Configuration</h1>
          <p className="mt-0.5 text-sm text-muted">Rules for recording supplier bills (purchase invoices) against GRNs.</p>
        </div>
        <Button size="md" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Save Configuration"}</Button>
      </div>

      <SettingsScopeBanner />

      <Section icon={FileText} title="General">
        <Flags items={GENERAL} flag={flag} setFlag={setFlag} />
      </Section>

      <Section icon={Hash} title="Numbering & Defaults">
        <Grid>
          <Input label="Invoice Number Prefix" value={field("piPrefix")} onChange={(e) => setField("piPrefix", e.target.value)} placeholder="PINV" />
          <Input label="Default Currency" value={field("defaultCurrency")} onChange={(e) => setField("defaultCurrency", e.target.value)} placeholder="INR" />
          <Input label="Default Payment Terms" value={field("defaultPaymentTerms")} onChange={(e) => setField("defaultPaymentTerms", e.target.value)} placeholder="Net 30" />
          <Input label="Default Credit Days" type="number" value={field("defaultCreditDays")} onChange={(e) => setField("defaultCreditDays", e.target.value)} placeholder="30" />
        </Grid>
      </Section>

      <Section icon={ClipboardCheck} title="Mandatory Fields">
        <Flags items={MANDATORY} flag={flag} setFlag={setFlag} />
      </Section>

      <Section icon={ShieldCheck} title="Approval & Posting">
        <Flags items={APPROVAL} flag={flag} setFlag={setFlag} />
      </Section>

      <Section icon={GitCompare} title="Matching & Variance">
        <Flags items={MATCHING} flag={flag} setFlag={setFlag} />
        <Grid>
          <Input label="Allow Invoice Amount Variance (%)" type="number" value={field("invoiceVariancePct")} onChange={(e) => setField("invoiceVariancePct", e.target.value)} placeholder="5" />
          <Input label="Allow Quantity Variance (%)" type="number" value={field("qtyVariancePct")} onChange={(e) => setField("qtyVariancePct", e.target.value)} placeholder="5" />
        </Grid>
      </Section>

      <Section icon={Scale} title="Truck Weight Based Product GRN">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <span><span className="block text-sm font-medium text-foreground">Enable Truck Weight Based GRN</span><span className="text-2xs text-muted">Capture Tare/Gross/Net vehicle weight on the GRN screen and auto-fill quantity from it.</span></span>
          <Switch checked={flag("enableTruckWeightGrn")} onChange={(v) => setFlag("enableTruckWeightGrn", v)} aria-label="Enable truck weight based GRN" />
        </label>
        {flag("enableTruckWeightGrn") && (
          <Grid>
            <Select label="Weight UOM" options={[{ value: "Kg", label: "Kg" }, { value: "Ton", label: "Ton" }]} value={field("truckWeightUom") || "Kg"} onChange={(e) => setField("truckWeightUom", e.target.value)} />
          </Grid>
        )}
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <span><span className="block text-sm font-medium text-foreground">Enable Weighbridge Fetch</span><span className="text-2xs text-muted">Show a "Fetch Weight" button next to Gross/Tare Weight fields (Gate Entry weighment, GRN) to pull the live reading from a serial-connected weighbridge indicator.</span></span>
          <Switch checked={flag("enableWeighbridgeFetch")} onChange={(v) => setFlag("enableWeighbridgeFetch", v)} aria-label="Enable weighbridge fetch" />
        </label>
      </Section>

      <Section icon={Scale} title="Transit Pass">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <span><span className="block text-sm font-medium text-foreground">Enable Transit Pass</span><span className="text-2xs text-muted">Show the Transit Pass section on the GRN screen (Reference No, Qty, computed Value payable to the supplier).</span></span>
          <Switch checked={flag("enableTransitPass")} onChange={(v) => setFlag("enableTransitPass", v)} aria-label="Enable transit pass" />
        </label>
        {flag("enableTransitPass") && (
          <>
            <Grid>
              <Input label="Transit Pass Rate (₹ per Ton)" type="number" value={field("transitPassPerTon")} onChange={(e) => setField("transitPassPerTon", e.target.value)} placeholder="0" />
            </Grid>
            <Grid>
              <Input label="Wallet Opening Balance Qty (Ton)" type="number" value={field("transitPassOpeningQty")} onChange={(e) => setField("transitPassOpeningQty", e.target.value)} placeholder="0" />
              <Input label="Wallet Opening Balance Amount (₹)" type="number" value={field("transitPassOpeningAmount")} onChange={(e) => setField("transitPassOpeningAmount", e.target.value)} placeholder="0" />
            </Grid>
            <p className="mt-1 text-2xs text-muted">One-time starting balance for the Transit Pass Reconciliation ledger (Transport &amp; Vehicle Operations → Transit Pass Reconciliation) — set once before switching this feature on; every GRN and dispatch after that updates the running balance automatically.</p>
          </>
        )}
        <p className="mt-2 text-2xs text-muted">Used on the GRN screen — Transit Pass Qty (Ton) entered there × this rate = Transit Pass Value, payable to the supplier alongside the goods value.</p>
      </Section>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function Section({ icon: Icon, title, children }: { icon: typeof Truck; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5"><span className="h-4 w-1 rounded-full bg-brand-gradient" /><h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" /> {title}</h3><span className="h-px flex-1 bg-border" /></div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
function Flags({ items, flag, setFlag }: { items: FlagDef[]; flag: (id: string) => boolean; setFlag: (id: string, v: boolean) => void }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2")}>
      {items.map((it) => (
        <label key={it.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
          <span><span className="block text-sm font-medium text-foreground">{it.label}</span>{it.desc && <span className="text-2xs text-muted">{it.desc}</span>}</span>
          <Switch checked={flag(it.id)} onChange={(v) => setFlag(it.id, v)} aria-label={it.label} />
        </label>
      ))}
    </div>
  );
}

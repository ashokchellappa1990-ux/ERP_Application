"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Landmark, Save, Loader2, Settings, Wallet, Truck, ClipboardList, Coins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Select } from "@/components/ui/Select";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { SettingsScopeBanner } from "@/components/scope/SettingsScopeBanner";
import { DEFAULT_ACCOUNTING_CONFIG, ACCOUNTING_GL_MAPPING_KEYS, type AccountingConfigData } from "@/lib/settings/accountingConfigDefaults";
import type { LedgerAccountRow } from "@/lib/contracts/accounting";
import { cn } from "@/lib/cn";

const TIMING_OPTS = [
  { value: "OnDispatch", label: "On Dispatch (Delivery Challan)" },
  { value: "OnInvoice", label: "On Sales Invoice" },
];
const RECOVER_OPTS = [
  { value: "Recoverable", label: "Recoverable from Customer" },
  { value: "CompanyExpense", label: "Company Expense" },
];
const BATTA_MODE_OPTS = [
  { value: "Adjustment", label: "Adjustment" },
  { value: "Payment", label: "Payment" },
];

const OTHER_CHARGE_FIELDS: { id: string; label: string }[] = [
  { id: "otherChargeFreight", label: "Freight Charge" },
  { id: "otherChargeLoading", label: "Loading Charge" },
  { id: "otherChargeUnloading", label: "Unloading Charge" },
  { id: "otherChargeFuel", label: "Fuel / Diesel Charge" },
  { id: "otherChargeToll", label: "Toll Charge" },
  { id: "otherChargeDriverAllowance", label: "Driver Allowance" },
  { id: "otherChargeHelperAllowance", label: "Helper Allowance" },
  { id: "otherChargeMisc", label: "Other / Miscellaneous Charges" },
];

const GL_MAPPING_LABELS: Record<string, string> = {
  customerReceivable: "Customer Receivable", dispatchClearingLiability: "Dispatch Clearing Liability",
  salesRevenue: "Sales Revenue", outputGst: "Output GST", transitPassRecovery: "Transit Pass Recovery",
  vehicleRentRecovery: "Vehicle Rent Recovery", driverBattaExpense: "Driver Batta Expense",
  vehicleRentExpense: "Vehicle Rent Expense", operatingChargesRecovery: "Operating Charges Recovery (other charges)",
  operatingExpenseDispatch: "Operating Expense — Dispatch (other charges)", inventory: "Inventory",
  goodsInTransit: "Goods in Transit", cogs: "Cost of Goods Sold", cash: "Cash", bank: "Bank",
};

export function AccountingConfigSettings() {
  const toast = useToast();
  const [cfg, setCfg] = useState<AccountingConfigData>(() => JSON.parse(JSON.stringify(DEFAULT_ACCOUNTING_CONFIG)));
  const [accounts, setAccounts] = useState<LedgerAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cj, aj] = await Promise.all([
          fetch("/api/settings/accounting-config", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
          fetch("/api/accounting/chart-of-accounts", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        ]);
        if (cj.ok && cj.config) setCfg(cj.config);
        if (aj.ok) setAccounts(aj.rows ?? aj.accounts ?? []);
      } catch { /* keep defaults */ } finally { setLoading(false); }
    })();
  }, []);

  const flag = (id: string) => !!cfg.flags[id];
  const setFlag = (id: string, v: boolean) => setCfg((c) => ({ ...c, flags: { ...c.flags, [id]: v } }));
  const field = (n: string) => cfg.fields[n] ?? "";
  const setField = (n: string, v: string) => setCfg((c) => ({ ...c, fields: { ...c.fields, [n]: v } }));
  const glCode = (k: string) => cfg.glMapping[k] ?? "";
  const setGlCode = (k: string, v: string) => setCfg((c) => ({ ...c, glMapping: { ...c.glMapping, [k]: v } }));

  async function save() {
    setSaving(true);
    try {
      const j = await fetch("/api/settings/accounting-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) }).then((r) => r.json());
      if (toast.result(j, "Accounting configuration saved.", "Could not save accounting configuration.")) {
        if (j.config) setCfg(j.config);
      }
    } catch { toast.error("Could not reach the server."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading accounting configuration…" /></div>;

  const accountOpts = [{ value: "", label: "— Select account —" }, ...accounts.map((a) => ({ value: a.code, label: `${a.code} — ${a.name}` }))];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Finance &amp; Accounting</span><span className="text-subtle">/</span><span>Accounting Configuration</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Dispatch &amp; Sales Accounting</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Landmark className="h-5 w-5 text-primary" /> Dispatch &amp; Sales Accounting</h1>
          <p className="mt-0.5 text-sm text-muted">Configure when Customer Receivable, Sales Revenue, GST, Inventory and dispatch operational charges get accounted.</p>
        </div>
        <Button size="md" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Save Configuration"}</Button>
      </div>

      <SettingsScopeBanner />

      <Section icon={Settings} title="General Configuration">
        <Grid>
          <Select label="Customer Receivable Creation" options={TIMING_OPTS} value={field("customerReceivableTiming") || "OnDispatch"} onChange={(e) => setField("customerReceivableTiming", e.target.value)} />
          <Select label="Sales Revenue Recognition" options={TIMING_OPTS} value={field("salesRevenueTiming") || "OnInvoice"} onChange={(e) => setField("salesRevenueTiming", e.target.value)} />
          <Select label="GST Recognition" options={TIMING_OPTS} value={field("gstRecognitionTiming") || "OnInvoice"} onChange={(e) => setField("gstRecognitionTiming", e.target.value)} />
          <Select label="Inventory Posting / Cost of Goods Sold" options={TIMING_OPTS} value={field("inventoryCogsTiming") || "OnDispatch"} onChange={(e) => setField("inventoryCogsTiming", e.target.value)} />
        </Grid>
        <p className="text-2xs text-muted">Inventory always physically leaves the warehouse the moment Load &amp; Dispatch is completed — this setting only controls whether the GL recognizes Cost of Goods Sold immediately (On Dispatch) or parks it in Goods in Transit until the Sales Invoice posts (On Sales Invoice).</p>
        <div className="border-t border-border pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
              <span><span className="block text-sm font-medium text-foreground">Create Separate Dispatch Accounting Voucher</span><span className="text-2xs text-muted">Posts a DAV at Complete Load &amp; Dispatch. When off, everything posts in one voucher at Sales Invoice time.</span></span>
              <Switch checked={cfg.flags.createSeparateDispatchVoucher ?? true} onChange={(v) => setFlag("createSeparateDispatchVoucher", v)} aria-label="Create separate dispatch accounting voucher" />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
              <span><span className="block text-sm font-medium text-foreground">Reverse Dispatch Voucher During Sales Invoice</span><span className="text-2xs text-muted">Settles the Dispatch Clearing Liability when the invoice posts.</span></span>
              <Switch checked={cfg.flags.reverseDispatchVoucherOnInvoice ?? true} onChange={(v) => setFlag("reverseDispatchVoucherOnInvoice", v)} aria-label="Reverse dispatch voucher during sales invoice" />
            </label>
          </div>
        </div>
      </Section>

      <Section icon={Truck} title="Driver Batta, Transit Pass &amp; Vehicle Rent">
        <Grid>
          <Select label="Driver Batta Accounting Mode (default)" options={BATTA_MODE_OPTS} value={field("driverBattaModeDefault") || "Adjustment"} onChange={(e) => setField("driverBattaModeDefault", e.target.value)} />
          <Select label="Transit Pass Accounting" options={RECOVER_OPTS} value={field("transitPassAccounting") || "Recoverable"} onChange={(e) => setField("transitPassAccounting", e.target.value)} />
          <Select label="Vehicle Rent Accounting" options={RECOVER_OPTS} value={field("vehicleRentAccounting") || "Recoverable"} onChange={(e) => setField("vehicleRentAccounting", e.target.value)} />
        </Grid>
        <p className="text-2xs text-muted">Adjustment nets Driver Batta out of what&apos;s collected from the customer (Dr Driver Batta Expense / Cr Customer Receivable); Payment collects the full invoice and pays the driver separately (Dr Driver Batta Expense / Cr Cash/Bank). This default prefills the per-dispatch toggle on Direct Customer Dispatch — it doesn&apos;t override a choice already made there.</p>
      </Section>

      <Section icon={Coins} title="Other Dispatch Charges">
        <p className="mb-1 text-2xs text-muted">Each charge type can be independently marked Recoverable from Customer or Company Expense; all Recoverable charges post to the shared &quot;Operating Charges Recovery&quot; account, all Company Expense charges post to &quot;Operating Expense — Dispatch&quot;.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {OTHER_CHARGE_FIELDS.map((f) => (
            <Select key={f.id} label={f.label} options={RECOVER_OPTS} value={field(f.id) || "Recoverable"} onChange={(e) => setField(f.id, e.target.value)} />
          ))}
        </div>
      </Section>

      <Section icon={ClipboardList} title="GL Mapping">
        <p className="mb-1 text-2xs text-muted">Which ledger account each posting category credits or debits. Defaults to the system-seeded accounts below — change here to redirect a category to a different account without any code change.</p>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Category</th><th className="px-3 py-2.5">Ledger Account</th></tr></thead>
            <tbody>
              {ACCOUNTING_GL_MAPPING_KEYS.map((k) => (
                <tr key={k} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground">{GL_MAPPING_LABELS[k] ?? k}</td>
                  <td className="px-3 py-2"><select value={glCode(k)} onChange={(e) => setGlCode(k, e.target.value)} className="h-9 w-full max-w-xs rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none">{accountOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section icon={Wallet} title="Example">
        <div className="max-w-sm space-y-1.5 text-sm">
          <Row k="Material Value" v="₹3,575.00" />
          <Row k="GST" v="₹178.75" />
          <Row k="Transit Pass" v="₹560.00" />
          <Row k="Driver Batta" v="₹50.00" />
          <Row k="Vehicle Rent" v="Configurable" />
          <div className="my-1 h-px bg-border" />
          <div className="flex items-center justify-between text-base font-bold text-foreground"><span>Total Receivable</span><span>₹4,313.75</span></div>
        </div>
      </Section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>;
}
function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function Section({ icon: Icon, title, children }: { icon: typeof Truck; title: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm")}>
      <div className="mb-4 flex items-center gap-2.5"><span className="h-4 w-1 rounded-full bg-brand-gradient" /><h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" /> {title}</h3><span className="h-px flex-1 bg-border" /></div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

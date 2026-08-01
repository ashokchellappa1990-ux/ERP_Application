"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Truck, Save, Loader2, Settings, FileText, Receipt, Coins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { SettingsScopeBanner } from "@/components/scope/SettingsScopeBanner";
import { DEFAULT_DISPATCH_CONFIG, type TransportConfigData } from "@/lib/settings/transportConfigDefaults";
import { cn } from "@/lib/cn";

interface FlagDef { id: string; label: string; desc?: string }

const GENERAL: FlagDef[] = [
  { id: "enableDispatchPlanning", label: "Enable Dispatch Planning" },
  { id: "enableDispatchExecution", label: "Enable Dispatch Execution" },
  { id: "enableVehicleGateEntry", label: "Enable Vehicle Gate Entry" },
  { id: "enableVehicleGateExit", label: "Enable Vehicle Gate Exit" },
  { id: "enableLoadingConfirmation", label: "Enable Loading Confirmation" },
  { id: "enableVehicleMovementHistory", label: "Enable Vehicle Movement History" },
  { id: "enablePartialDispatch", label: "Enable Partial Dispatch" },
  { id: "allowDirectCustomerDispatch", label: "Allow Direct Customer Dispatch" },
  { id: "allowDispatchWithoutSalesOrder", label: "Allow Dispatch Without Sales Order" },
  { id: "allowNegativeDispatch", label: "Allow Negative Dispatch" },
  { id: "enableBarcodeScan", label: "Enable Barcode Scan" },
  { id: "enableQrCodeScan", label: "Enable QR Code Scan" },
  { id: "enablePhotoAttachment", label: "Enable Photo Attachment" },
  { id: "enableDigitalSignature", label: "Enable Digital Signature", desc: "Phase 2." },
  { id: "enableGpsTracking", label: "Enable GPS Tracking", desc: "Phase 2." },
  { id: "enableRouteManagement", label: "Enable Route Management" },
  { id: "enableDriverManagement", label: "Enable Driver Management" },
  { id: "enableTransportCompanyManagement", label: "Enable Transport Company Management" },
  { id: "enableVehicleAssignment", label: "Enable Vehicle Assignment" },
  { id: "enableMultipleVehiclesPerDispatch", label: "Enable Multiple Vehicles Per Dispatch" },
  { id: "enableMultipleDrivers", label: "Enable Multiple Drivers" },
  { id: "requireDispatchApproval", label: "Require Dispatch Approval" },
  { id: "requireGateExitApproval", label: "Require Gate Exit Approval" },
  { id: "requireWeighment", label: "Require Weighment" },
  { id: "requireLoadingConfirmation", label: "Require Loading Confirmation" },
  { id: "requireVehicleAssignmentBeforeDispatch", label: "Require Vehicle Assignment Before Dispatch" },
  { id: "requireDeliveryChallanBeforeInvoice", label: "Require Delivery Challan Before Invoice" },
];

const DC_FLAGS: FlagDef[] = [
  { id: "generateDcAutomatically", label: "Generate Delivery Challan Automatically" },
  { id: "allowDcEditing", label: "Allow DC Editing" },
  { id: "autoPrintDc", label: "Auto Print DC" },
  { id: "allowDcReprint", label: "Allow DC Reprint" },
  { id: "allowDcCancellation", label: "Allow DC Cancellation" },
];

const TRANSPORT_FLAGS: FlagDef[] = [
  { id: "enableTransportCost", label: "Enable Transport Cost" },
  { id: "includeLoadingCharges", label: "Include Loading Charges" },
  { id: "includeUnloadingCharges", label: "Include Unloading Charges" },
  { id: "includeTollCharges", label: "Include Toll Charges" },
  { id: "includeFuelCharges", label: "Include Fuel Charges" },
  { id: "includeDriverBata", label: "Include Driver Bata" },
  { id: "includeHelperCharges", label: "Include Helper Charges" },
  { id: "includeMiscCharges", label: "Include Miscellaneous Charges" },
  { id: "allowCostEditing", label: "Allow Cost Editing" },
  { id: "autoAllocateCostToDispatch", label: "Auto Allocate Cost To Dispatch" },
  { id: "postTransportCostToFinance", label: "Post Transport Cost To Finance", desc: "Phase 2 — no GL posting yet." },
  { id: "requireTransportCostApproval", label: "Require Transport Cost Approval" },
];

const POSTING_METHOD_OPTS = [
  { value: "Automatic", label: "Automatic" },
  { value: "Manual", label: "Manual" },
];

const TRANSPORT_COST_METHOD_OPTS = [
  { value: "Fixed", label: "Fixed" },
  { value: "Per KM", label: "Per KM" },
  { value: "Per KG", label: "Per KG" },
  { value: "Per Ton", label: "Per Ton" },
  { value: "Per Trip", label: "Per Trip" },
  { value: "Manual", label: "Manual" },
];

export function DispatchSettings() {
  const toast = useToast();
  const [cfg, setCfg] = useState<TransportConfigData>(() => JSON.parse(JSON.stringify(DEFAULT_DISPATCH_CONFIG)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/settings/dispatch-config", { cache: "no-store" }).then((r) => r.json());
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
      const j = await fetch("/api/settings/dispatch-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) }).then((r) => r.json());
      if (toast.result(j, "Dispatch configuration saved.", "Could not save dispatch configuration.")) {
        if (j.config) setCfg(j.config);
      }
    } catch { toast.error("Could not reach the server."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading dispatch configuration…" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Dispatch Configuration</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Truck className="h-5 w-5 text-primary" /> Dispatch Configuration</h1>
          <p className="mt-0.5 text-sm text-muted">Rules for vehicle gate, loading, delivery challan, sales-invoice posting and transport cost during dispatch.</p>
        </div>
        <Button size="md" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Save Configuration"}</Button>
      </div>

      <SettingsScopeBanner />

      <Section icon={Settings} title="General">
        <Flags items={GENERAL} flag={flag} setFlag={setFlag} />
      </Section>

      <Section icon={FileText} title="Delivery Challan">
        <Flags items={DC_FLAGS} flag={flag} setFlag={setFlag} />
        <Grid>
          <Input label="DC Number Series" value={field("dcPrefix")} onChange={(e) => setField("dcPrefix", e.target.value)} placeholder="DC" />
        </Grid>
      </Section>

      <Section icon={Receipt} title="Sales Invoice">
        <Grid>
          <div>
            <Select label="Sales Invoice Posting Method" options={POSTING_METHOD_OPTS} value={field("salesInvoicePostingMethod")} onChange={(e) => setField("salesInvoicePostingMethod", e.target.value)} />
          </div>
        </Grid>
        <p className="text-2xs text-muted">
          Automatic: invoice auto-posts when DC is generated, quantities not editable. Manual: user reviews and clicks Post Sales Invoice, quantities editable if business rules permit.
        </p>
      </Section>

      <Section icon={Coins} title="Transport Cost Configuration">
        <Grid>
          <div>
            <Select label="Transport Cost Method" options={TRANSPORT_COST_METHOD_OPTS} value={field("transportCostMethod")} onChange={(e) => setField("transportCostMethod", e.target.value)} />
          </div>
        </Grid>
        <Flags items={TRANSPORT_FLAGS} flag={flag} setFlag={setFlag} />
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

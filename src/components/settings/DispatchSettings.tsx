"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Truck, Save, Loader2, Settings, FileText, Receipt, Coins, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { SettingsScopeBanner } from "@/components/scope/SettingsScopeBanner";
import { DEFAULT_DISPATCH_CONFIG, type TransportConfigData } from "@/lib/settings/transportConfigDefaults";
import { GATE_ENTRY_DISPATCH_TYPES } from "@/lib/contracts/transport";
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

const REFERENCE_TYPE_OPTS = [
  { value: "", label: "— No preload —" },
  { value: "Sales Order", label: "Sales Order" },
  { value: "Direct Customer Dispatch", label: "Direct Customer Dispatch" },
];

const ITEM_CAPTURE_OPTS = [
  { value: "None", label: "None — hide Item Details" },
  { value: "Single", label: "Single Product" },
  { value: "Multiple", label: "Multiple Products" },
];

const POST_LOAD_WEIGHT_OPTS = [
  { value: "Both", label: "Both — let the user choose per dispatch" },
  { value: "CaptureLater", label: "By Default Capture Later" },
  { value: "CaptureNow", label: "By Default Capture Now" },
];

const DRIVER_BATTA_ROUNDING_OPTS = [
  { value: "floor", label: "Round Down (14.01-14.99 -> 14)" },
  { value: "nearest", label: "Nearest Whole Ton" },
  { value: "ceil", label: "Round Up" },
];
const TRANSIT_PASS_QTY_MODE_OPTS = [
  { value: "Manual", label: "Manual — user enters the Ton qty" },
  { value: "AutoNetWeight", label: "Auto — same Ton qty as Net Weight" },
];
const ROUND_OFF_NEAREST_OPTS = [
  { value: "1", label: "₹1" }, { value: "5", label: "₹5" }, { value: "10", label: "₹10" }, { value: "50", label: "₹50" }, { value: "100", label: "₹100" },
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

      <Section icon={Truck} title="Vehicle Gate Entry Defaults">
        <p className="mb-3 text-2xs text-muted">Preloads Dispatch Type / Reference Type on the Vehicle Gate Entry add screen so most users never have to pick them. Leave blank for no preload. Locking shows the preloaded value but disables changing it.</p>
        <Grid>
          <div>
            <Select label="Default Dispatch Type" options={[{ value: "", label: "— No preload —" }, ...GATE_ENTRY_DISPATCH_TYPES.map((t) => ({ value: t.value, label: t.label }))]} value={field("defaultDispatchType")} onChange={(e) => setField("defaultDispatchType", e.target.value)} />
            <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
              <span className="text-sm font-medium text-foreground">Lock (not user-changeable)</span>
              <Switch checked={flag("lockDefaultDispatchType")} onChange={(v) => setFlag("lockDefaultDispatchType", v)} aria-label="Lock default dispatch type" />
            </label>
          </div>
          <div>
            <Select label="Default Reference Type" options={REFERENCE_TYPE_OPTS} value={field("defaultReferenceType")} onChange={(e) => setField("defaultReferenceType", e.target.value)} />
            <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
              <span className="text-sm font-medium text-foreground">Lock (not user-changeable)</span>
              <Switch checked={flag("lockDefaultReferenceType")} onChange={(v) => setFlag("lockDefaultReferenceType", v)} aria-label="Lock default reference type" />
            </label>
          </div>
        </Grid>
        <Grid>
          <Input label="Gate Entry No Prefix" value={field("gateEntryPrefix")} onChange={(e) => setField("gateEntryPrefix", e.target.value)} placeholder="GATE" />
          <Input label="Load & Dispatch No Prefix" value={field("dispatchNoPrefix")} onChange={(e) => setField("dispatchNoPrefix", e.target.value)} placeholder="LD" />
        </Grid>
        <p className="text-2xs text-muted">Auto-generated as {`{prefix}-00001`}, {`{prefix}-00002`}, … whenever Gate Entry No is left as the suggested value; Load & Dispatch numbers the same way (StockTransfer/PurchaseReturn/etc. append their own suffix after this prefix).</p>

        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Item Capture on Vehicle Gate Entry</p>
          <Grid>
            <Select
              label="Product Capture"
              options={ITEM_CAPTURE_OPTS}
              value={field("itemCaptureMode") || "Multiple"}
              onChange={(e) => setField("itemCaptureMode", e.target.value)}
            />
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
              <span className="text-sm font-medium text-foreground">Capture Quantity at Gate</span>
              <Switch checked={flag("captureQtyAtGate")} onChange={(v) => setFlag("captureQtyAtGate", v)} aria-label="Capture quantity at gate" />
            </label>
          </Grid>
          <p className="text-2xs text-muted">Controls the Item Details section on the New Vehicle Gate Entry screen — None hides it, Single limits it to exactly one product, Multiple allows several. When Capture Quantity is off (the default), only the product name is captured — quantity is derived later from the Post-Loading Weighment&apos;s net weight on the Load &amp; Dispatch screen.</p>
        </div>
      </Section>

      <Section icon={Scale} title="Weighment Capture">
        <Grid>
          <Select label="Post-Loading Weight" options={POST_LOAD_WEIGHT_OPTS} value={field("postLoadWeightCaptureMode") || "Both"} onChange={(e) => setField("postLoadWeightCaptureMode", e.target.value)} />
        </Grid>
        <p className="text-2xs text-muted">Controls Weighment Management&apos;s Post-Loading Weight on the Load &amp; Dispatch screen. &quot;Both&quot; shows a Capture Later / Capture Now toggle so the user picks per dispatch. &quot;By Default Capture Later&quot;/&quot;By Default Capture Now&quot; force one behavior and hide the toggle — Capture Now still shows the gross-weight field directly, just without the tabs.</p>
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
        <div className="border-t border-border pt-4">
          <Grid>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
              <span><span className="block text-sm font-medium text-foreground">Round Off Total Invoice Amount</span><span className="text-2xs text-muted">Rounds the invoice total; the difference posts to Round Off.</span></span>
              <Switch checked={flag("roundOffInvoiceTotal")} onChange={(v) => setFlag("roundOffInvoiceTotal", v)} aria-label="Round off total invoice amount" />
            </label>
            {flag("roundOffInvoiceTotal") && <Select label="Round To Nearest" options={ROUND_OFF_NEAREST_OPTS} value={field("roundOffNearest") || "10"} onChange={(e) => setField("roundOffNearest", e.target.value)} />}
          </Grid>
          <p className="mt-2 text-2xs text-muted">Applies to Direct Customer Dispatch/Load &amp; Dispatch&apos;s Total Invoice Amount, the posted Sales Invoice, and its printed PDF — a &quot;Total&quot; line above still shows the pre-round figure.</p>
        </div>
      </Section>

      <Section icon={Coins} title="Transport Cost Configuration">
        <Grid>
          <div>
            <Select label="Transport Cost Method" options={TRANSPORT_COST_METHOD_OPTS} value={field("transportCostMethod")} onChange={(e) => setField("transportCostMethod", e.target.value)} />
          </div>
        </Grid>
        <Flags items={TRANSPORT_FLAGS} flag={flag} setFlag={setFlag} />
        <div className="border-t border-border pt-4">
          <p className="mb-3 text-xs font-semibold text-foreground">Payment Details — Driver Batta &amp; Transit Pass</p>
          <Grid>
            <Input type="number" min={0} label="Driver Batta Rate (₹ / Ton)" value={field("driverBattaPerTon")} onChange={(e) => setField("driverBattaPerTon", e.target.value)} />
            <Select label="Driver Batta Rounding" options={DRIVER_BATTA_ROUNDING_OPTS} value={field("driverBattaRounding")} onChange={(e) => setField("driverBattaRounding", e.target.value)} />
            <Input type="number" min={0} label="Transit Pass Rate (₹ / Ton)" value={field("transitPassPerTon")} onChange={(e) => setField("transitPassPerTon", e.target.value)} />
            <Select label="Transit Pass Qty Source" options={TRANSIT_PASS_QTY_MODE_OPTS} value={field("transitPassQtyMode")} onChange={(e) => setField("transitPassQtyMode", e.target.value)} />
          </Grid>
          <p className="mt-2 text-2xs text-muted">Driver Batta is always auto-calculated (rounded Ton qty × rate) on the Direct Customer Dispatch screen's Payment Details section. Transit Pass qty is either typed in directly or defaulted from the dispatch's Net Weight, per the source above.</p>
        </div>
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

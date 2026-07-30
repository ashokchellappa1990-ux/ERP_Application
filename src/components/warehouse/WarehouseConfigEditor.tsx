"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Warehouse, ArrowLeft, Save, ChevronDown, Settings2, PackageCheck, Send, ArrowLeftRight,
  Network, Boxes, ShieldCheck, ListChecks, Plus, Trash2, CheckCircle2, Circle, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  STORAGE_TYPES, CAPACITY_UNITS, WEIGHT_UNITS, RELATIONSHIP_TYPES, PRIORITIES, PROGRESS_STEPS,
  progressPercent, type WhConfig, type WhProgress,
} from "@/lib/contracts/warehouse";

type Detail = {
  header: { branchId: number; name: string; code: string; business: string; entityType: string; status: string };
  warehouseCategoryId: number | null; storageType: string; capacity: number | null; capacityUnit: string; maxWeight: number | null; weightUnit: string;
  config: WhConfig; progress: WhProgress;
  categories: { id: number; name: string }[]; warehouseOptions: { id: number; name: string; code: string }[];
  mappings: { id: number; sourceName: string; destinationName: string; relationshipType: string; priority: string; isDefault: boolean }[];
};

const LBL: Record<string, string> = {
  // receiving
  allowDirectGrn: "Allow Direct GRN", requireQualityInspection: "Require Quality Inspection", mandatoryBarcodeScan: "Mandatory Barcode Scan", mandatoryBatchNumber: "Mandatory Batch Number", mandatorySerialNumber: "Mandatory Serial Number", mandatoryExpiry: "Mandatory Expiry", allowPartialReceipt: "Allow Partial Receipt", allowOverReceipt: "Allow Over Receipt",
  // dispatch
  requirePicking: "Require Picking", requirePacking: "Require Packing", requireDispatchVerification: "Require Dispatch Verification", stockAllocationRequired: "Stock Allocation Required", allowPartialDispatch: "Allow Partial Dispatch", allowBackOrder: "Allow Back Order", allowNegativeDispatch: "Allow Negative Dispatch", approvalRequired: "Approval Required",
  // transfer
  internalEnabled: "Internal Transfer Enabled", requestRequired: "Transfer Request Required", autoDispatch: "Auto Dispatch", autoReceipt: "Auto Receipt", allowPartial: "Allow Partial Transfer", allowCrossWarehouse: "Allow Cross Warehouse", allowInterBranch: "Allow Inter Branch", allowInterBusiness: "Allow Inter Business (Future)",
  // inventory
  binManagement: "Bin Management", zoneManagement: "Zone Management", rackManagement: "Rack Management", shelfManagement: "Shelf Management", fifo: "FIFO", fefo: "FEFO", batchManagement: "Batch Management", serialManagement: "Serial Number Management", expiryManagement: "Expiry Management", cycleCount: "Cycle Count Enabled", physicalVerification: "Physical Verification", negativeStockAllowed: "Negative Stock Allowed", autoReplenishment: "Auto Replenishment", autoPutAway: "Auto Put Away", stockReservation: "Stock Reservation", qualityHold: "Quality Hold", quarantineArea: "Quarantine Area",
  // barcode
  barcodeEnabled: "Barcode Enabled", qrEnabled: "QR Enabled", rfidEnabled: "RFID Enabled", autoPrintLabels: "Auto Print Labels",
  // capabilities
  purchaseReceiving: "Purchase Receiving", salesDispatch: "Sales Dispatch", stockTransfer: "Stock Transfer", customerReturns: "Customer Returns", supplierReturns: "Supplier Returns", productionReceipt: "Production Receipt", productionIssue: "Production Issue", stockAdjustment: "Stock Adjustment",
};

export function WarehouseConfigEditor({ branchId }: { branchId: number }) {
  const router = useRouter();
  const toast = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({ general: true, capabilities: true, progress: true });
  const [nm, setNm] = useState({ sourceWarehouseBranchId: 0, relationshipType: "both", priority: "primary", isDefault: false });

  const load = useCallback(() => { fetch(`/api/warehouse/config/${branchId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setD(j.data); }); }, [branchId]);
  useEffect(() => { load(); }, [load]);

  const setTop = (patch: Partial<Detail>) => setD((p) => (p ? { ...p, ...patch } : p));
  const setSec = <K extends keyof WhConfig>(sec: K, key: keyof WhConfig[K], val: unknown) => setD((p) => (p ? { ...p, config: { ...p.config, [sec]: { ...p.config[sec], [key]: val } } } : p));

  const save = async () => {
    if (!d) return;
    setSaving(true);
    const body = { warehouseCategoryId: d.warehouseCategoryId, storageType: d.storageType, capacity: d.capacity, capacityUnit: d.capacityUnit, maxWeight: d.maxWeight, weightUnit: d.weightUnit, config: d.config, progress: d.progress };
    const res = await fetch(`/api/warehouse/config/${branchId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    setSaving(false);
    if (toast.result(res, "Warehouse configuration saved.")) router.push("/warehouse/settings/configuration");
  };
  const addMapping = async () => {
    if (!nm.sourceWarehouseBranchId) return toast.error("Select a parent warehouse.");
    const res = await fetch(`/api/warehouse/config/${branchId}/mapping`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(nm) }).then((r) => r.json());
    if (toast.result(res, "Parent mapping added.")) { setNm({ sourceWarehouseBranchId: 0, relationshipType: "both", priority: "primary", isDefault: false }); load(); }
  };
  const delMapping = async (id: number) => { await fetch(`/api/warehouse/config/${branchId}/mapping?id=${id}`, { method: "DELETE" }); load(); };

  if (!d) return <div className="p-10"><AppLoader label="Loading warehouse…" /></div>;
  const c = d.config;
  const pct = progressPercent(d.progress);

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/warehouse/settings/configuration")} className="rounded-lg p-1.5 hover:bg-surface-2"><ArrowLeft className="h-5 w-5 text-muted" /></button>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white"><Warehouse className="h-6 w-6" /></span>
          <div>
            <div className="flex items-center gap-2"><h1 className="text-lg font-bold text-foreground">{d.header.name}</h1><Badge tone={d.header.status === "Pending" ? "warning" : d.header.status === "Active" ? "success" : "info"}>{d.header.status}</Badge></div>
            <p className="text-xs text-muted">{d.header.code} · {d.header.business} · {d.header.entityType}</p>
          </div>
        </div>
        <div className="flex items-center gap-3"><div className="text-right"><div className="text-2xs uppercase tracking-wide text-muted">Progress</div><div className="text-lg font-bold text-primary">{pct}%</div></div></div>
      </div>

      {/* Section 1 — General */}
      <Section id="general" title="General Configuration" icon={Settings2} open={open} setOpen={setOpen}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fld label="Warehouse Category" req><select className={inp} value={d.warehouseCategoryId ?? 0} onChange={(e) => setTop({ warehouseCategoryId: Number(e.target.value) || null })}><option value={0}>Select…</option>{d.categories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Fld>
          <Fld label="Warehouse Short Name"><input className={inp} value={c.general.shortName} onChange={(e) => setSec("general", "shortName", e.target.value)} /></Fld>
          <Fld label="Storage Type"><select className={inp} value={d.storageType} onChange={(e) => setTop({ storageType: e.target.value })}><option value="">Select…</option>{STORAGE_TYPES.map((s) => <option key={s}>{s}</option>)}</select></Fld>
          <Fld label="Warehouse Manager"><input className={inp} value={c.general.manager} onChange={(e) => setSec("general", "manager", e.target.value)} /></Fld>
          <Fld label="Contact Number"><input className={inp} value={c.general.contactNumber} onChange={(e) => setSec("general", "contactNumber", e.target.value)} /></Fld>
          <Fld label="Email"><input className={inp} value={c.general.email} onChange={(e) => setSec("general", "email", e.target.value)} /></Fld>
          <Fld label="Warehouse Capacity" req><input type="number" className={inp} value={d.capacity ?? ""} onChange={(e) => setTop({ capacity: e.target.value === "" ? null : Number(e.target.value) })} /></Fld>
          <Fld label="Capacity Unit"><select className={inp} value={d.capacityUnit} onChange={(e) => setTop({ capacityUnit: e.target.value })}><option value="">Select…</option>{CAPACITY_UNITS.map((s) => <option key={s}>{s}</option>)}</select></Fld>
          <Fld label="Maximum Weight"><input type="number" className={inp} value={d.maxWeight ?? ""} onChange={(e) => setTop({ maxWeight: e.target.value === "" ? null : Number(e.target.value) })} /></Fld>
          <Fld label="Weight Unit"><select className={inp} value={d.weightUnit} onChange={(e) => setTop({ weightUnit: e.target.value })}><option value="">Select…</option>{WEIGHT_UNITS.map((s) => <option key={s}>{s}</option>)}</select></Fld>
          <Fld label="Receiving Time"><input className={inp} value={c.general.receivingTime} onChange={(e) => setSec("general", "receivingTime", e.target.value)} placeholder="e.g. 09:00-13:00" /></Fld>
          <Fld label="Dispatch Time"><input className={inp} value={c.general.dispatchTime} onChange={(e) => setSec("general", "dispatchTime", e.target.value)} placeholder="e.g. 14:00-18:00" /></Fld>
          <div className="sm:col-span-2 lg:col-span-3"><Fld label="Description"><textarea className={cn(inp, "h-16 py-2")} value={c.general.description} onChange={(e) => setSec("general", "description", e.target.value)} /></Fld></div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3"><Toggle label="Temperature Controlled" checked={c.general.temperatureControlled} onChange={(v) => setSec("general", "temperatureControlled", v)} />{c.general.temperatureControlled && <div className="mt-2 grid grid-cols-2 gap-2"><Fld label="Min °C"><input className={inp} value={c.general.minTemp} onChange={(e) => setSec("general", "minTemp", e.target.value)} /></Fld><Fld label="Max °C"><input className={inp} value={c.general.maxTemp} onChange={(e) => setSec("general", "maxTemp", e.target.value)} /></Fld></div>}</div>
          <div className="rounded-lg border border-border p-3"><Toggle label="Humidity Controlled" checked={c.general.humidityControlled} onChange={(v) => setSec("general", "humidityControlled", v)} />{c.general.humidityControlled && <div className="mt-2 grid grid-cols-2 gap-2"><Fld label="Min %"><input className={inp} value={c.general.minHumidity} onChange={(e) => setSec("general", "minHumidity", e.target.value)} /></Fld><Fld label="Max %"><input className={inp} value={c.general.maxHumidity} onChange={(e) => setSec("general", "maxHumidity", e.target.value)} /></Fld></div>}</div>
        </div>
      </Section>

      {/* Section 2 — Receiving */}
      <Section id="receiving" title="Receiving Configuration" icon={PackageCheck} open={open} setOpen={setOpen}>
        <Toggle label="Receiving Enabled" checked={c.receiving.enabled} onChange={(v) => setSec("receiving", "enabled", v)} />
        <ToggleGrid keys={["allowDirectGrn", "requireQualityInspection", "mandatoryBarcodeScan", "mandatoryBatchNumber", "mandatorySerialNumber", "mandatoryExpiry", "allowPartialReceipt", "allowOverReceipt"]} vals={c.receiving as unknown as Record<string, boolean>} onChange={(k, v) => setSec("receiving", k as keyof WhConfig["receiving"], v)} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fld label="Default Receiving Zone"><input className={inp} value={c.receiving.defaultZone} onChange={(e) => setSec("receiving", "defaultZone", e.target.value)} /></Fld>
          <Fld label="Default Receiving Bin"><input className={inp} value={c.receiving.defaultBin} onChange={(e) => setSec("receiving", "defaultBin", e.target.value)} /></Fld>
          {c.receiving.allowOverReceipt && <Fld label="Over Receipt %"><input type="number" className={inp} value={c.receiving.overReceiptPercentage} onChange={(e) => setSec("receiving", "overReceiptPercentage", e.target.value)} /></Fld>}
        </div>
      </Section>

      {/* Section 3 — Dispatch */}
      <Section id="dispatch" title="Dispatch Configuration" icon={Send} open={open} setOpen={setOpen}>
        <ToggleGrid keys={["requirePicking", "requirePacking", "requireDispatchVerification", "stockAllocationRequired", "allowPartialDispatch", "allowBackOrder", "allowNegativeDispatch", "approvalRequired"]} vals={c.dispatch as unknown as Record<string, boolean>} onChange={(k, v) => setSec("dispatch", k as keyof WhConfig["dispatch"], v)} />
        <div className="mt-3"><Fld label="Default Dispatch Zone"><input className={cn(inp, "max-w-xs")} value={c.dispatch.defaultZone} onChange={(e) => setSec("dispatch", "defaultZone", e.target.value)} /></Fld></div>
      </Section>

      {/* Section 4 — Stock Transfer */}
      <Section id="transfer" title="Stock Transfer Configuration" icon={ArrowLeftRight} open={open} setOpen={setOpen}>
        <ToggleGrid keys={["internalEnabled", "requestRequired", "approvalRequired", "autoDispatch", "autoReceipt", "allowPartial", "allowCrossWarehouse", "allowInterBranch", "allowInterBusiness"]} vals={c.transfer as unknown as Record<string, boolean>} onChange={(k, v) => setSec("transfer", k as keyof WhConfig["transfer"], v)} />
      </Section>

      {/* Section 5 — Parent Warehouse Mapping */}
      <Section id="mapping" title="Parent Warehouse Mapping" icon={Network} open={open} setOpen={setOpen}>
        <p className="mb-2 text-2xs text-muted">Defines the default warehouse this one receives stock from / dispatches to — used by Stock Transfer to suggest source &amp; destination.</p>
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-2/30 p-3">
          <Fld label="Parent Warehouse"><select className={cn(inp, "min-w-[12rem]")} value={nm.sourceWarehouseBranchId} onChange={(e) => setNm({ ...nm, sourceWarehouseBranchId: Number(e.target.value) })}><option value={0}>Select warehouse…</option>{d.warehouseOptions.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}</select></Fld>
          <Fld label="Relationship"><select className={inp} value={nm.relationshipType} onChange={(e) => setNm({ ...nm, relationshipType: e.target.value })}>{RELATIONSHIP_TYPES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></Fld>
          <Fld label="Priority"><select className={inp} value={nm.priority} onChange={(e) => setNm({ ...nm, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></Fld>
          <label className="flex items-center gap-1.5 pb-2 text-2xs font-semibold text-muted"><input type="checkbox" checked={nm.isDefault} onChange={(e) => setNm({ ...nm, isDefault: e.target.checked })} /> Default Receiving</label>
          <Button size="sm" variant="secondary" onClick={addMapping}><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
        {d.mappings.length > 0 && (
          <table className="mt-3 w-full text-sm"><thead><tr className="border-b border-border text-left text-2xs font-semibold uppercase text-muted"><th className="py-1.5">Source</th><th className="py-1.5">Destination</th><th className="py-1.5">Relationship</th><th className="py-1.5">Priority</th><th className="py-1.5">Default</th><th /></tr></thead>
            <tbody>{d.mappings.map((m) => (<tr key={m.id} className="border-b border-border/40 last:border-0"><td className="py-1.5 font-medium text-foreground">{m.sourceName}</td><td className="py-1.5 text-muted">{m.destinationName}</td><td className="py-1.5 text-2xs">{RELATIONSHIP_TYPES.find((r) => r.key === m.relationshipType)?.label}</td><td className="py-1.5 capitalize text-2xs">{m.priority}</td><td className="py-1.5">{m.isDefault ? <Badge tone="success">Default</Badge> : ""}</td><td className="py-1.5 text-right"><button onClick={() => delMapping(m.id)} className="rounded p-1 hover:bg-surface-2"><Trash2 className="h-4 w-4 text-danger" /></button></td></tr>))}</tbody>
          </table>
        )}
      </Section>

      {/* Section 6 — Inventory */}
      <Section id="inventory" title="Inventory Configuration" icon={Boxes} open={open} setOpen={setOpen}>
        <ToggleGrid keys={["binManagement", "zoneManagement", "rackManagement", "shelfManagement", "fifo", "fefo", "batchManagement", "serialManagement", "expiryManagement", "cycleCount", "physicalVerification", "negativeStockAllowed", "autoReplenishment", "autoPutAway", "stockReservation", "qualityHold", "quarantineArea"]} vals={c.inventory as unknown as Record<string, boolean>} onChange={(k, v) => setSec("inventory", k as keyof WhConfig["inventory"], v)} />
      </Section>

      {/* Operational Capabilities */}
      <Section id="capabilities" title="Operational Capabilities" icon={ShieldCheck} open={open} setOpen={setOpen}>
        <p className="mb-2 text-2xs text-muted">Defines what the warehouse supports. Actual user access is controlled via Role-Based Access Control. <span className="font-semibold text-warning">At least one is required.</span></p>
        <ToggleGrid keys={["purchaseReceiving", "salesDispatch", "stockTransfer", "customerReturns", "supplierReturns", "productionReceipt", "productionIssue", "stockAdjustment", "cycleCount", "physicalVerification"]} vals={c.capabilities as unknown as Record<string, boolean>} onChange={(k, v) => setSec("capabilities", k as keyof WhConfig["capabilities"], v)} />
      </Section>

      {/* Section 9 — Progress */}
      <Section id="progress" title="Configuration Progress" icon={ListChecks} open={open} setOpen={setOpen}>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", pct >= 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} /></div>
        <div className="grid gap-1.5 sm:grid-cols-2">{PROGRESS_STEPS.map((s) => { const done = d.progress[s.key]; return <div key={s.key} className="flex items-center gap-2 text-sm">{done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-subtle" />}<span className={done ? "text-foreground" : "text-muted"}>{s.label}</span></div>; })}</div>
        <p className="mt-2 text-2xs text-subtle">Layout / Zone / Rack / Shelf / Bin steps are completed via their own modules (coming soon).</p>
      </Section>

      {/* Sticky save */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-2xs text-muted">Warehouse Category &amp; Capacity are mandatory · at least one capability.</span>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4" /> Save Configuration</Button>
        </div>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm focus:border-primary focus:outline-none";
function Fld({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{label}{req && <span className="text-danger"> *</span>}</span>{children}</label>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-2 text-left text-sm">
      <span className="text-foreground">{label}</span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-primary" : "bg-surface-2")}><span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", checked ? "left-4" : "left-0.5")} /></span>
    </button>
  );
}
function ToggleGrid({ keys, vals, onChange }: { keys: string[]; vals: Record<string, boolean>; onChange: (k: string, v: boolean) => void }) {
  return <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">{keys.map((k) => <Toggle key={k} label={LBL[k] ?? k} checked={!!vals[k]} onChange={(v) => onChange(k, v)} />)}</div>;
}
function Section({ id, title, icon: Icon, open, setOpen, children }: { id: string; title: string; icon: LucideIcon; open: Record<string, boolean>; setOpen: (u: (p: Record<string, boolean>) => Record<string, boolean>) => void; children: React.ReactNode }) {
  const isOpen = open[id] ?? false;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <button onClick={() => setOpen((p) => ({ ...p, [id]: !p[id] }))} className="flex w-full items-center justify-between border-b border-border bg-primary-subtle/40 px-4 py-2.5 text-left">
        <h3 className="flex items-center gap-2 text-sm font-bold text-primary"><Icon className="h-4 w-4" /> {title}</h3>
        <ChevronDown className={cn("h-4 w-4 text-primary transition", isOpen && "rotate-180")} />
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
}

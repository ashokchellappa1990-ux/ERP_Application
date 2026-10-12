"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ScrollText,
  FileSpreadsheet,
} from "lucide-react";
import { useOpeningStockForm, type RowKey } from "./OpeningStockFormContext";
import {
  OPENING_STOCK_TABS,
  ENTRY_FIELDS,
  LOCATION_FIELDS,
  INVENTORY_FIELDS,
  STOCK_DATE_FIELD,
  BATCH_FIELDS,
  SERIAL_FIELDS,
  LOT_FIELDS,
  UOM_ROW_FIELDS,
  ACCOUNTING_FIELDS,
  STOCK_DIMENSIONS,
  VALUATION_METHODS,
  IMPORT_SOURCES,
  AI_VALIDATIONS,
  VERIFICATION_CHECKS,
  APPROVAL_CHAIN,
  type OField,
  type OToggle,
} from "@/lib/masters/openingStockConfig";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { RadioCard } from "@/components/ui/RadioCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EditorShell } from "./EditorShell";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------- helpers -- */
function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function SubHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pb-1 pt-1">
      <span className="h-4 w-1 rounded-full bg-brand-gradient" />
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">{children}</p>;
}
function FieldRenderer({ def }: { def: OField }) {
  const { getField, setField, errors } = useOpeningStockForm();
  const Icon = def.icon;
  const lead = Icon ? <Icon className="h-4 w-4" /> : undefined;
  const common = { label: def.label, info: def.info, sample: def.sample, error: errors[def.name] };
  if (def.type === "textarea") return <Textarea {...common} rows={2} placeholder={def.sample} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
  if (def.type === "select") return <Select {...common} leadingIcon={lead} placeholder="Select…" options={def.options ?? []} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
  return <Input {...common} leadingIcon={lead} type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"} placeholder={def.sample} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
}
function Fields({ defs }: { defs: OField[] }) {
  return <Grid>{defs.map((d) => <div key={d.name} className={d.full ? "sm:col-span-2 lg:col-span-3" : ""}><FieldRenderer def={d} /></div>)}</Grid>;
}
function ToggleGrid({ group, items, cols = 3 }: { group: string; items: OToggle[]; cols?: 2 | 3 }) {
  const { isOn, toggle } = useOpeningStockForm();
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3")}>
      {items.map((it) => {
        const on = isOn(group, it.id);
        return (
          <label key={it.id} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3.5 transition", on ? "border-primary/40 bg-primary-subtle/40" : "border-border bg-surface hover:bg-surface-2")}>
            <span><span className="block text-sm font-medium text-foreground">{it.label}</span>{it.desc && <span className="text-2xs text-muted">{it.desc}</span>}</span>
            <Switch checked={on} onChange={() => toggle(group, it.id)} aria-label={it.label} />
          </label>
        );
      })}
    </div>
  );
}
function Flag({ id, label, desc }: { id: string; label: string; desc?: string }) {
  const { flag, setFlag } = useOpeningStockForm();
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
      <span><span className="block text-sm font-medium text-foreground">{label}</span>{desc && <span className="text-2xs text-muted">{desc}</span>}</span>
      <Switch checked={flag(id)} onChange={(v) => setFlag(id, v)} aria-label={label} />
    </label>
  );
}
function Repeatable({ rowKey, addLabel, empty, defs }: { rowKey: RowKey; addLabel: string; empty: string; defs: OField[] }) {
  const { rowsOf, addRow, updateRow, removeRow } = useOpeningStockForm();
  const rows = rowsOf(rowKey);
  return (
    <div className="space-y-3">
      {rows.length === 0 && <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-6 text-center text-sm text-muted">{empty}</div>}
      {rows.map((r, i) => (
        <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between"><Badge tone="primary">#{i + 1}</Badge><button type="button" onClick={() => removeRow(rowKey, r.id)} className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"><Trash2 className="h-3.5 w-3.5" /> Remove</button></div>
          <Grid>{defs.map((d) => <div key={d.name}><Input label={d.label} type={d.type === "number" ? "number" : d.type === "date" ? "date" : "text"} placeholder={d.sample} value={r[d.name] ?? ""} onChange={(e) => updateRow(rowKey, r.id, { [d.name]: e.target.value })} /></div>)}</Grid>
        </div>
      ))}
      <Button variant="outline" size="md" onClick={() => addRow(rowKey)}><Plus className="h-4 w-4" /> {addLabel}</Button>
    </div>
  );
}
/* ----------------------------------------------- bulk excel upload ---- */
const TEMPLATE_COLUMNS = [
  "Product Code", "Product Name", "Category", "Brand", "Branch", "Warehouse", "Bin Location",
  "Quantity", "UOM", "Cost Price", "MRP", "Selling Price", "Batch Number", "Mfg Date", "Expiry Date", "Stock Date",
];
const TEMPLATE_SAMPLE = [
  "SKU-100245", "Surf Excel 1kg", "Grocery", "HUL", "Chennai Branch", "Main Warehouse", "A-12-03",
  "120", "PCS", "82.50", "110.00", "99.00", "BATCH-AX2310", "2026-01-15", "2027-01-14", "2026-06-08",
];
function downloadTemplate() {
  const esc = (c: string) => `"${String(c).replace(/"/g, '""')}"`;
  const csv = [TEMPLATE_COLUMNS, TEMPLATE_SAMPLE].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "opening-stock-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function BulkUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<string | null>(null);
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-surface-2 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"><FileSpreadsheet className="h-5 w-5" /></span>
          <div>
            <p className="text-sm font-semibold text-foreground">Bulk Quantity Update</p>
            <p className="text-2xs text-muted">Download the Excel template, fill in quantities &amp; costs, then upload to load many products at once.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="md" onClick={downloadTemplate}><Download className="h-4 w-4" /> Download Excel Template</Button>
          <Button variant="outline" size="md" onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Upload File</Button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
        </div>
      </div>
      {file && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-success/30 bg-success-subtle px-3 py-2 text-xs">
          <span className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="h-4 w-4" /> {file} — ready to import. Review in the Import &amp; Verification tabs.</span>
          <button type="button" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }} className="grid h-6 w-6 place-items-center rounded text-muted transition hover:text-danger" aria-label="Remove file"><X className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

/* ============================================================== tabs === */
function EntryTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Product</SubHeading>
      <Fields defs={ENTRY_FIELDS} />
      <SubHeading>Location</SubHeading>
      <Fields defs={LOCATION_FIELDS} />
      <SubHeading>Inventory Details</SubHeading>
      <Fields defs={INVENTORY_FIELDS} />
      <BulkUpload />
      <SubHeading>Stock Date</SubHeading>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div><FieldRenderer def={STOCK_DATE_FIELD} /></div></div>
      <SubHeading>Stock Tracking Dimensions</SubHeading>
      <ToggleGrid group="dimensions" items={STOCK_DIMENSIONS} />
    </div>
  );
}
function BatchTab() {
  return (
    <div className="space-y-4">
      <Hint>For batch-controlled products (FMCG, pharma, food). Multiple batches per product are supported — each with its own expiry, quantity & cost.</Hint>
      <Repeatable rowKey="batches" addLabel="Add Batch" empty="No batches added yet." defs={BATCH_FIELDS} />
    </div>
  );
}
function SerialTab() {
  return (
    <div className="space-y-4">
      <Hint>For serial-controlled products (mobiles, laptops, electronics). Each unit carries a unique serial / IMEI. Bulk upload is supported via the Import tab.</Hint>
      <Repeatable rowKey="serials" addLabel="Add Serial" empty="No serial numbers added yet." defs={SERIAL_FIELDS} />
    </div>
  );
}
function LotTab() {
  return (
    <div className="space-y-4">
      <Hint>For lot / consignment tracking (chemicals, textiles, agro). A lot groups quantity received together under one mfg/expiry window.</Hint>
      <Repeatable rowKey="lots" addLabel="Add Lot" empty="No lots added yet." defs={LOT_FIELDS} />
    </div>
  );
}
function UomTab() {
  return (
    <div className="space-y-4">
      <Hint>Define base &amp; alternate units with conversion factors. Example — Rice: stock UOM = KG, purchase UOM = Bag, 1 Bag = 25 KG.</Hint>
      <Repeatable rowKey="uoms" addLabel="Add UOM Conversion" empty="No alternate UOMs defined." defs={UOM_ROW_FIELDS} />
    </div>
  );
}
function ValuationTab() {
  const { getField, setField } = useOpeningStockForm();
  const fmt = useFmt();
  const method = getField("method") || "WAVG";
  const qty = Number(getField("quantity")) || 0;
  const cost = Number(getField("costPrice")) || 0;
  const value = qty * cost;
  return (
    <div className="space-y-5">
      <SubHeading>Valuation Method</SubHeading>
      <div className="grid gap-3 lg:grid-cols-3">
        {VALUATION_METHODS.map((m) => <RadioCard key={m.value} selected={method === m.value} onSelect={() => setField("method", m.value)} title={m.label} description={m.desc} />)}
      </div>
      <SubHeading>Computed Valuation</SubHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[["Opening Stock Value", fmt.money(value)], ["Inventory Cost / Unit", fmt.money(cost)], ["Average Cost", fmt.money(cost)]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-surface p-4"><p className="text-lg font-bold text-foreground">{v}</p><p className="text-2xs text-muted">{k}</p></div>
        ))}
      </div>
    </div>
  );
}
function AccountingTab() {
  const { getField } = useOpeningStockForm();
  const fmt = useFmt();
  const qty = Number(getField("quantity")) || 0;
  const cost = Number(getField("costPrice")) || 0;
  const value = qty * cost || 1000000;
  return (
    <div className="space-y-5">
      <SubHeading>Account Mapping</SubHeading>
      <Fields defs={ACCOUNTING_FIELDS} />
      <Flag id="autoAccounting" label="Auto-generate accounting entry on approval" desc="Posts the opening journal automatically when the batch is approved." />
      <SubHeading>Accounting Preview</SubHeading>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Account</th><th className="px-4 py-2.5 text-right">Debit</th><th className="px-4 py-2.5 text-right">Credit</th></tr></thead>
          <tbody>
            <tr className="border-b border-border"><td className="px-4 py-2.5 font-medium text-foreground">Inventory Account (Dr)</td><td className="px-4 py-2.5 text-right font-semibold text-foreground">{fmt.money(value)}</td><td className="px-4 py-2.5 text-right text-subtle">—</td></tr>
            <tr><td className="px-4 py-2.5 font-medium text-foreground">Opening Balance Account (Cr)</td><td className="px-4 py-2.5 text-right text-subtle">—</td><td className="px-4 py-2.5 text-right font-semibold text-foreground">{fmt.money(value)}</td></tr>
          </tbody>
          <tfoot><tr className="border-t border-border bg-surface-2"><td className="px-4 py-2.5 text-2xs font-semibold uppercase text-subtle">Balanced</td><td className="px-4 py-2.5 text-right font-bold text-success">{fmt.money(value)}</td><td className="px-4 py-2.5 text-right font-bold text-success">{fmt.money(value)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}
function ImportTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Import Source</SubHeading>
      <ToggleGrid group="importSources" items={IMPORT_SOURCES} />
      <SubHeading>Import Fields</SubHeading>
      <div className="flex flex-wrap gap-1.5">
        {["Product", "Batch", "Expiry", "Quantity", "Cost", "MRP", "Warehouse"].map((f) => <span key={f} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{f}</span>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Button variant="outline" size="lg"><Download className="h-4 w-4" /> Download Template</Button>
        <Button variant="outline" size="lg"><Upload className="h-4 w-4" /> Upload File</Button>
        <Button variant="outline" size="lg"><FileSpreadsheet className="h-4 w-4" /> Validation Report</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-success/30 bg-success-subtle p-4"><p className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> 1,240 rows valid</p><p className="mt-1 text-2xs text-muted">Ready to import.</p></div>
        <div className="rounded-xl border border-warning/30 bg-warning-subtle p-4"><p className="flex items-center gap-2 text-sm font-semibold text-warning"><AlertTriangle className="h-4 w-4" /> 18 rows with errors</p><p className="mt-1 text-2xs text-muted">Download the error report to fix &amp; re-upload.</p></div>
      </div>
    </div>
  );
}
function AiTab() {
  const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");
  const mapping = [
    { source: "Item Name", target: "Product Name", conf: 99 },
    { source: "Batch No.", target: "Batch Number", conf: 97 },
    { source: "Exp", target: "Expiry Date", conf: 94 },
    { source: "Qty On Hand", target: "Quantity", conf: 98 },
    { source: "Pur. Rate", target: "Cost Price", conf: 92 },
    { source: "Godown", target: "Warehouse", conf: 90 },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white"><Sparkles className="h-6 w-6 shrink-0" /><div><p className="text-sm font-bold">AI Import Assistant</p><p className="text-xs text-white/85">Upload an Excel, ERP export, stock sheet or PDF stock report — AI maps columns, products &amp; warehouses and validates the data.</p></div></div>
      <SubHeading>Upload Source</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {["Excel Upload", "ERP Export", "Stock Sheet", "PDF Stock Report"].map((s) => (
          <button key={s} className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2 p-4 text-center transition hover:border-primary hover:bg-primary-subtle/30"><Upload className="h-5 w-5 text-primary" /><span className="text-xs font-medium text-foreground">{s}</span></button>
        ))}
      </div>
      <SubHeading>AI Validations</SubHeading>
      <div className="flex flex-wrap gap-1.5">
        {AI_VALIDATIONS.map((v) => <span key={v} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{v}</span>)}
      </div>
      {phase === "idle" && <Button size="lg" onClick={() => { setPhase("processing"); window.setTimeout(() => setPhase("done"), 1400); }}><Sparkles className="h-4 w-4" /> Run AI Mapping &amp; Validation</Button>}
      {phase === "processing" && <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium text-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Detecting columns, mapping products &amp; validating batches…</div>}
      {phase === "done" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-success-subtle p-3 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Overall confidence 95% · 6 columns mapped · 1,240 products matched · 18 duplicates flagged</div>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Source Column</th><th className="px-4 py-2.5">Mapped To</th><th className="px-4 py-2.5 text-right">Confidence</th></tr></thead>
              <tbody>
                {mapping.map((m) => (
                  <tr key={m.source} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                    <td className="px-4 py-2.5 font-medium text-foreground">{m.source}</td>
                    <td className="px-4 py-2.5 text-muted">{m.target}</td>
                    <td className="px-4 py-2.5 text-right"><span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", m.conf >= 95 ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning")}>{m.conf}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="md"><CheckCircle2 className="h-4 w-4" /> Accept Mapping &amp; Stage Import</Button>
        </div>
      )}
    </div>
  );
}
function VerificationTab() {
  const counts: Record<string, number> = { duplicate: 12, negative: 0, invalidBatch: 3, invalidExpiry: 9, missingWarehouse: 0, missingProduct: 6, zeroCost: 14 };
  const errors = VERIFICATION_CHECKS.filter((c) => c.severity === "error").reduce((s, c) => s + (counts[c.id] || 0), 0);
  const warnings = VERIFICATION_CHECKS.filter((c) => c.severity === "warning").reduce((s, c) => s + (counts[c.id] || 0), 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-danger/30 bg-danger-subtle p-4"><p className="flex items-center gap-2 text-2xl font-bold text-danger"><XCircle className="h-5 w-5" /> {errors}</p><p className="mt-1 text-2xs font-medium text-muted">Errors — must be fixed before approval</p></div>
        <div className="rounded-xl border border-warning/30 bg-warning-subtle p-4"><p className="flex items-center gap-2 text-2xl font-bold text-warning"><AlertTriangle className="h-5 w-5" /> {warnings}</p><p className="mt-1 text-2xs font-medium text-muted">Warnings — review recommended</p></div>
      </div>
      <SubHeading>Verification Checks</SubHeading>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Check</th><th className="px-4 py-2.5 text-center">Severity</th><th className="px-4 py-2.5 text-center">Records</th><th className="px-4 py-2.5 text-center">Status</th></tr></thead>
          <tbody>
            {VERIFICATION_CHECKS.map((c) => {
              const n = counts[c.id] || 0;
              return (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{c.label}</td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={c.severity === "error" ? "danger" : "warning"}>{c.severity}</Badge></td>
                  <td className="px-4 py-2.5 text-center font-semibold text-foreground">{n}</td>
                  <td className="px-4 py-2.5 text-center">{n === 0 ? <Badge tone="success">Pass</Badge> : <Badge tone={c.severity === "error" ? "danger" : "warning"}>Review</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function ApprovalTab() {
  const { data, setApproval } = useOpeningStockForm();
  return (
    <div className="space-y-5">
      <SubHeading>Approval Workflow</SubHeading>
      <div className="space-y-2">
        {APPROVAL_CHAIN.map((s, i) => (
          <div key={s.role} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white">{i + 1}</span>
            <div className="flex-1"><p className="text-sm font-semibold text-foreground">{s.role}</p><p className="text-2xs text-muted">{s.action}</p></div>
            {i < APPROVAL_CHAIN.length - 1 && <span className="text-subtle">↓</span>}
          </div>
        ))}
      </div>
      <Flag id="approvalRequired" label="Require approval before Go-Live lock" desc="Opening stock cannot be locked until the chain is fully approved." />
      <SubHeading>Current Status</SubHeading>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["draft", "pending", "approved", "rejected"] as const).map((s) => (
          <button key={s} onClick={() => setApproval(s)} className={cn("rounded-lg border px-3 py-2.5 text-xs font-semibold capitalize transition", data.approvalStatus === s ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40")}>{s}</button>
        ))}
      </div>
    </div>
  );
}
function AuditTab() {
  const log = [
    { user: "ravi.inv", action: "Imported 1,240 rows (Marg)", qty: "+1,240", cost: "—", at: "2026-06-08 09:10", tone: "info" },
    { user: "ravi.inv", action: "Corrected 18 error rows", qty: "0", cost: "₹ adj", at: "2026-06-08 09:48", tone: "warning" },
    { user: "store.mgr", action: "Verified physical stock", qty: "0", cost: "—", at: "2026-06-08 11:20", tone: "success" },
    { user: "fin.mgr", action: "Approved valuation ₹48.2L", qty: "0", cost: "₹48.2L", at: "2026-06-08 14:02", tone: "success" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg bg-primary-subtle/40 p-3 text-xs text-foreground"><ScrollText className="h-4 w-4 text-primary" /> Tracks user, date, action, quantity &amp; cost changes and the full approval history.</div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5 text-center">Qty Δ</th><th className="px-4 py-2.5 text-center">Cost Δ</th><th className="px-4 py-2.5">Date &amp; Time</th></tr></thead>
          <tbody>
            {log.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{l.user}</td>
                <td className="px-4 py-2.5"><span className={cn("inline-flex items-center gap-1.5", l.tone === "warning" ? "text-warning" : l.tone === "success" ? "text-success" : "text-muted")}><span className={cn("h-1.5 w-1.5 rounded-full", l.tone === "warning" ? "bg-warning" : l.tone === "success" ? "bg-success" : "bg-info")} />{l.action}</span></td>
                <td className="px-4 py-2.5 text-center text-muted">{l.qty}</td>
                <td className="px-4 py-2.5 text-center text-muted">{l.cost}</td>
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
  entry: EntryTab, batch: BatchTab, serial: SerialTab, lot: LotTab, uom: UomTab,
  valuation: ValuationTab, accounting: AccountingTab, import: ImportTab, ai: AiTab,
  verification: VerificationTab, approval: ApprovalTab, audit: AuditTab,
};

export function OpeningStockEditor({ stockId }: { stockId?: string }) {
  const router = useRouter();
  const form = useOpeningStockForm();
  const fmt = useFmt();
  const isEdit = !!stockId;
  const tabs = useMemo(() => OPENING_STOCK_TABS, []);
  const [activeId, setActiveId] = useState("entry");
  const [saved, setSaved] = useState(false);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const Body = TAB_BODIES[tabs[activeIndex].id];
  const statusTone = form.data.approvalStatus === "approved" ? "success" : form.data.approvalStatus === "rejected" ? "danger" : "warning";
  const qty = Number(form.getField("quantity")) || 0;
  const cost = Number(form.getField("costPrice")) || 0;

  function save() {
    if (!form.validate()) { setActiveId("entry"); return; }
    setSaved(true);
    window.setTimeout(() => router.push("/masters/opening-stock"), 1300);
  }

  return (
    <EditorShell
      parentLabel="Opening Stock"
      parentHref="/masters/opening-stock"
      cancelHref="/masters/opening-stock"
      title={form.getField("productName") || (isEdit ? "Edit Opening Stock" : "New Opening Stock")}
      status={{ label: form.data.approvalStatus, tone: statusTone }}
      tabs={tabs}
      activeId={activeId}
      onTab={setActiveId}
      onAi={() => setActiveId("ai")}
      aiLabel="AI Import Assistant"
      onSaveDraft={() => form.setApproval("pending")}
      onSave={save}
      saveLabel="Save Opening Stock"
      summaryTitle="Opening Stock Summary"
      summaryName={form.getField("productName") || "New Opening Stock"}
      summaryCode={form.getField("productCode") || "—"}
      summaryBadges={[{ label: form.data.approvalStatus, tone: statusTone }, ...(form.getField("branch") ? [{ label: form.getField("branch"), tone: "primary" as const }] : [])]}
      summaryFields={[
        { label: "Warehouse", value: form.getField("warehouse") || "—" },
        { label: "Quantity", value: form.getField("quantity") ? `${fmt.qty(qty)} ${form.getField("uom")}` : "—" },
        { label: "Cost / Unit", value: cost ? fmt.money(cost) : "—" },
        { label: "Stock Value", value: qty && cost ? fmt.money(qty * cost) : "—" },
        { label: "Valuation", value: form.getField("method") },
      ]}
      ai={[
        { ok: qty > 0, text: qty > 0 ? "Quantity captured" : "Enter opening quantity" },
        { ok: cost > 0, text: cost > 0 ? "Cost price set" : "Cost must be greater than zero" },
        { ok: form.flag("autoAccounting"), text: form.flag("autoAccounting") ? "Accounting auto-posts on approval" : "Enable auto-accounting" },
      ]}
      saved={saved}
      savedText={`${form.getField("productName") || "Opening stock"} has been ${isEdit ? "updated" : "saved"}. Redirecting…`}
    >
      {Body && <Body />}
    </EditorShell>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Factory, ArrowLeft, Save, Plus, Trash2, Search, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { ManufacturingProductHit, ProcessingSetStatus } from "@/lib/contracts/processingSet";

interface OutputRow { key: string; productId: number; name: string; sku: string; percentage: string; remarks: string }
let keySeq = 1;
const n = (v: string) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const inp = "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus";

export function ProcessingSetEditor() {
  const router = useRouter();
  const toast = useToast();
  const [setId, setSetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [rawMaterial, setRawMaterial] = useState<{ id: number; name: string; sku: string } | null>(null);
  const [status, setStatus] = useState<ProcessingSetStatus>("Active");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<OutputRow[]>([]);
  // Process Loss / Wastage % — NOT a Finished Good; the raw material share
  // expected to be lost during processing. Not a product line, but folds
  // into the same 100% tally (a future Processing Transaction posts this
  // share to a wastage inventory movement, not to any output product).
  const [processLoss, setProcessLoss] = useState("0");

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("id"));
    if (!id) { setLoading(false); return; }
    (async () => {
      const j = await fetch(`/api/manufacturing/processing-set/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (!j.ok) { toast.error(j?.message || "Could not load the Processing Set."); setLoading(false); return; }
      const d = j.data;
      setSetId(d.id); setCode(d.code); setName(d.name);
      setRawMaterial({ id: d.rawMaterialProductId, name: d.rawMaterialName, sku: d.rawMaterialSku });
      setStatus(d.status); setDescription(d.description ?? "");
      setProcessLoss(String(d.processLossPercentage ?? 0));
      setRows(d.outputs.map((o: { finishedGoodProductId: number; finishedGoodName: string; finishedGoodSku: string; expectedPercentage: number; remarks: string | null }) => ({
        key: `k${keySeq++}`, productId: o.finishedGoodProductId, name: o.finishedGoodName, sku: o.finishedGoodSku, percentage: String(o.expectedPercentage), remarks: o.remarks ?? "",
      })));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outputTotal = useMemo(() => +rows.reduce((s, r) => s + n(r.percentage), 0).toFixed(3), [rows]);
  const total = useMemo(() => +(outputTotal + n(processLoss)).toFixed(3), [outputTotal, processLoss]);
  const dupeIds = useMemo(() => {
    const seen = new Set<number>(); const dupes = new Set<number>();
    for (const r of rows) { if (seen.has(r.productId)) dupes.add(r.productId); seen.add(r.productId); }
    return dupes;
  }, [rows]);
  const hasDupes = dupeIds.size > 0;
  const validPct = total === 100;
  const canSave = !!name.trim() && !!rawMaterial && rows.length > 0 && !hasDupes && validPct && !saving;

  function addOutput(p: ManufacturingProductHit) {
    if (rows.some((r) => r.productId === p.id)) { toast.error("Finished Good already added to this Processing Set."); return; }
    setRows((prev) => [...prev, { key: `k${keySeq++}`, productId: p.id, name: p.name, sku: p.sku, percentage: "", remarks: "" }]);
  }
  function updateRow(key: string, patch: Partial<OutputRow>) { setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r))); }
  function removeRow(key: string) { setRows((prev) => prev.filter((r) => r.key !== key)); }

  async function save() {
    if (!canSave || !rawMaterial) return;
    setSaving(true);
    const payload = {
      name: name.trim(), rawMaterialProductId: rawMaterial.id, description: description.trim() || null, status,
      processLossPercentage: n(processLoss),
      outputs: rows.map((r) => ({ finishedGoodProductId: r.productId, expectedPercentage: n(r.percentage), remarks: r.remarks.trim() || null })),
    };
    try {
      const res = await fetch(setId ? `/api/manufacturing/processing-set/${setId}` : "/api/manufacturing/processing-set", {
        method: setId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { toast.error(j?.message || "Could not save the Processing Set."); setSaving(false); return; }
      toast.success(j.message || "Processing Set saved.");
      router.push(`/manufacturing/processing-set/${setId ?? j.id}`);
    } catch { toast.error("Network error — could not save."); setSaving(false); }
  }

  if (loading) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/manufacturing/processing-set" className="hover:text-foreground">Processing Set Configuration</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{setId ? "Edit" : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Factory className="h-5 w-5 text-primary" /> {setId ? "Edit Processing Set" : "Add Processing Set"}</h1>
        </div>
        <Link href="/manufacturing/processing-set"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <SectionCard icon={Factory} title="Basic Configuration">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Processing Set Code"><input readOnly value={code || "Auto on save"} className={cn(inp, "bg-surface-2 font-mono text-primary")} /></Field>
          <Field label="Processing Set Name *"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rough Stone - Aggregate" className={inp} /></Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as ProcessingSetStatus)} className={inp}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-1">
            <Field label="Raw Material *">
              <ProductSearchField value={rawMaterial} onPick={(p) => setRawMaterial(p)} category="Raw Material" placeholder="Search Raw Material…" />
            </Field>
          </div>
        </div>
        <div className="mt-3"><Field label="Description"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" className={cn(inp, "h-auto py-2")} /></Field></div>
      </SectionCard>

      <SectionCard icon={Factory} title="Finished Goods Output Configuration" allowOverflow>
        <div className="mb-3 max-w-md">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="h-3.5 w-3.5" /> Add Finished Good</p>
          <ProductPicker category="Finished Product" placeholder="Search a Finished Good to add…" disabledIds={rows.map((r) => r.productId)} onPick={addOutput} />
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-2.5">Finished Good Product</th>
                <th className="px-4 py-2.5 w-40 text-right">Expected Output %</th>
                <th className="px-4 py-2.5">Remarks</th>
                <th className="px-4 py-2.5 w-12" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const dupe = dupeIds.has(r.productId);
                return (
                  <tr key={r.key} className={cn("border-b border-border last:border-0", dupe && "bg-danger-subtle/30")}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="font-mono text-2xs text-subtle">{r.sku}</div>
                      {dupe && <div className="mt-0.5 text-2xs font-semibold text-danger">Finished Good already added to this Processing Set.</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <input type="number" min={0} max={100} step="0.01" value={r.percentage} onChange={(e) => updateRow(r.key, { percentage: e.target.value })} placeholder="0" className="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" />
                    </td>
                    <td className="px-4 py-2.5"><input value={r.remarks} onChange={(e) => updateRow(r.key, { remarks: e.target.value })} placeholder="Optional" className="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none" /></td>
                    <td className="px-4 py-2.5 text-center"><button onClick={() => removeRow(r.key)} className="text-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">No Finished Goods added yet — search above to add one.</td></tr>}
              <tr className="border-b border-border bg-warning-subtle/20 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-foreground">Process Loss / Wastage</div>
                  <div className="text-2xs text-subtle">Expected raw-material loss during processing — not a product; posted to wastage, not output.</div>
                </td>
                <td className="px-4 py-2.5">
                  <input type="number" min={0} max={100} step="0.01" value={processLoss} onChange={(e) => setProcessLoss(e.target.value)} placeholder="0" className="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" />
                </td>
                <td className="px-4 py-2.5 text-2xs text-subtle">—</td>
                <td className="px-4 py-2.5" />
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-2">
                <td className="px-4 py-2.5 text-right text-sm font-bold text-foreground">Total (Finished Goods + Process Loss)</td>
                <td className={cn("px-4 py-2.5 text-right text-sm font-bold", validPct ? "text-success" : "text-warning")}>{total}%</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={cn("mt-3 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold", validPct ? "border-success/30 bg-success-subtle/40 text-success" : "border-warning/30 bg-warning-subtle/40 text-warning")}>
          {validPct ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {validPct ? "Output allocation is valid" : total > 100 ? "Output allocation cannot exceed 100%." : "Output allocation is incomplete. Total must be 100%."}
        </div>
      </SectionCard>

      <div className="flex items-center justify-end gap-2">
        <Link href="/manufacturing/processing-set"><Button variant="outline" size="lg">Cancel</Button></Link>
        <Button size="lg" onClick={save} disabled={!canSave}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Save Processing Set"}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>;
}

/* ------------------------------------------------- single-value product search (Raw Material) */
function ProductSearchField({ value, onPick, category, placeholder }: { value: { id: number; name: string; sku: string } | null; onPick: (p: ManufacturingProductHit) => void; category: string; placeholder: string }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ManufacturingProductHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q.trim()) { setRes([]); return; }
    if (timer.current) clearTimeout(timer.current);
    const ctrl = new AbortController();
    timer.current = setTimeout(() => {
      fetch(`/api/manufacturing/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`, { cache: "no-store", signal: ctrl.signal })
        .then((r) => r.json()).then((j) => { if (j.ok) { setRes(j.products); setOpen(true); } }).catch(() => {});
    }, 220);
    return () => { clearTimeout(timer.current!); ctrl.abort(); };
  }, [q, category]);

  if (value && !open) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border-strong bg-surface-2 px-3 py-2">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{value.name}</p><p className="font-mono text-2xs text-subtle">{value.sku}</p></div>
        <button onClick={() => { setOpen(true); setQ(""); }} className="shrink-0 text-2xs font-semibold text-primary hover:underline">Change</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => res.length && setOpen(true)} placeholder={placeholder} className="h-10 w-full rounded-md border border-primary/40 bg-card pl-9 pr-3 text-sm focus:border-primary focus:outline-none" />
      {open && q && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
          {res.length === 0 && <div className="px-3 py-2 text-sm text-muted">No Raw Material products matched.</div>}
          {res.map((p) => (
            <button key={p.id} onClick={() => { onPick(p); setOpen(false); setQ(""); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-primary-subtle/50">
              <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{p.name}</span><span className="font-mono text-2xs text-subtle">{p.sku || "—"}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------- multi-add product picker (Finished Goods) */
function ProductPicker({ category, placeholder, disabledIds, onPick }: { category: string; placeholder: string; disabledIds: number[]; onPick: (p: ManufacturingProductHit) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ManufacturingProductHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q.trim()) { setRes([]); return; }
    if (timer.current) clearTimeout(timer.current);
    const ctrl = new AbortController();
    timer.current = setTimeout(() => {
      fetch(`/api/manufacturing/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`, { cache: "no-store", signal: ctrl.signal })
        .then((r) => r.json()).then((j) => { if (j.ok) { setRes(j.products); setOpen(true); } }).catch(() => {});
    }, 220);
    return () => { clearTimeout(timer.current!); ctrl.abort(); };
  }, [q, category]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => res.length && setOpen(true)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-primary/40 bg-card pl-9 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none" />
      {open && q && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
          {res.length === 0 && <div className="px-3 py-2 text-sm text-muted">No Finished Product matched.</div>}
          {res.map((p) => {
            const added = disabledIds.includes(p.id);
            return (
              <button key={p.id} disabled={added} onClick={() => { onPick(p); setOpen(false); setQ(""); }} className={cn("flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left", added ? "cursor-not-allowed opacity-50" : "hover:bg-primary-subtle/50")}>
                <span className="min-w-0"><span className="block truncate text-sm font-medium text-foreground">{p.name}</span><span className="font-mono text-2xs text-subtle">{p.sku || "—"}</span></span>
                {added && <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-2xs font-semibold text-muted">Added</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Factory, ArrowLeft, Save, Play, Plus, Trash2, Search, CheckCircle2, AlertTriangle, Loader2, Gauge } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { ManufacturingProductHit } from "@/lib/contracts/processingSet";
import type { StockCheckResponse } from "@/lib/contracts/materialProcessing";

interface AreaOpt { id: number; code: string; name: string; type: string; branchId: number }
interface OutputRow {
  key: string; productId: number; name: string; sku: string;
  configuredPercentage: number | null; actualPercentage: string; actualQuantity: string;
  outputAreaId: number | ""; remarks: string; lastEdited: "pct" | "qty";
}
let keySeq = 1;
const n = (v: string) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r3 = (v: number) => +v.toFixed(3);
const inp = "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus";

export function MaterialProcessingEditor() {
  const router = useRouter();
  const toast = useToast();
  const [mpId, setMpId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"draft" | "initiate" | null>(null);

  const [processingDate, setProcessingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [branchId, setBranchId] = useState<number | "">("");
  const [processingAreas, setProcessingAreas] = useState<AreaOpt[]>([]);
  const [processingAreaId, setProcessingAreaId] = useState<number | "">("");
  const [processingUnit, setProcessingUnit] = useState("");
  const [branchAreas, setBranchAreas] = useState<AreaOpt[]>([]); // all active areas under the branch — for source/output pickers

  const [sets, setSets] = useState<{ id: number; code: string; name: string }[]>([]);
  const [processingSetId, setProcessingSetId] = useState<number | "">("");
  const [pickingSet, setPickingSet] = useState(false);
  const [rawMaterial, setRawMaterial] = useState<{ id: number; name: string; sku: string } | null>(null);
  // Process Loss / Wastage % from the Processing Set master — not a Finished
  // Good line; the actual value is always DERIVED (100 − Finished Goods %) so
  // the total reconciles to exactly 100% by construction. Shown alongside the
  // configured figure copied from the set for reference.
  const [configuredProcessLossPct, setConfiguredProcessLossPct] = useState<number | null>(null);

  // The raw material is issued from — and WIP is received into — the same
  // Processing Area selected above; no separate Source Storage Area picker.
  const [inputQuantity, setInputQuantity] = useState("");
  const [inputUom, setInputUom] = useState("");
  const [stock, setStock] = useState<StockCheckResponse | null>(null);
  const [stockLoading, setStockLoading] = useState(false);

  const [rows, setRows] = useState<OutputRow[]>([]);
  const [removeTarget, setRemoveTarget] = useState<OutputRow | null>(null);

  // Load branches once (Area Config's branch list, scoped to what this user may see).
  useEffect(() => {
    (async () => {
      const j = await fetch("/api/system/areas", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) { setBranches(j.branches ?? []); if (!mpId && j.branches?.[0]) setBranchId(j.branches[0].id); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Active Processing Sets once (not branch-scoped).
  useEffect(() => {
    (async () => {
      const j = await fetch("/api/manufacturing/processing-set?status=Active", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) setSets(j.rows.map((s: { id: number; code: string; name: string }) => ({ id: s.id, code: s.code, name: s.name })));
    })();
  }, []);

  // Reload Processing Areas + all active branch areas whenever the branch changes.
  useEffect(() => {
    if (!branchId) { setProcessingAreas([]); setBranchAreas([]); return; }
    (async () => {
      const [proc, all] = await Promise.all([
        fetch(`/api/system/areas?branchId=${branchId}&type=Processing&status=Active`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/system/areas?branchId=${branchId}&status=Active`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ]);
      if (proc.ok) setProcessingAreas(proc.rows);
      if (all.ok) setBranchAreas(all.rows);
    })();
  }, [branchId]);

  // Load an existing transaction for editing.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("id"));
    if (!id) { setLoading(false); return; }
    (async () => {
      const j = await fetch(`/api/manufacturing/material-processing/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (!j.ok) { toast.error(j?.message || "Could not load this transaction."); setLoading(false); return; }
      const d = j.data;
      if (d.status !== "Draft") { toast.error("Only a Draft transaction can be edited here."); router.replace(`/manufacturing/material-processing/${id}`); return; }
      setMpId(d.id); setProcessingDate(d.processingDate); setBranchId(d.branchId ?? "");
      setProcessingAreaId(d.processingAreaId); setProcessingUnit(d.processingUnit ?? "");
      setProcessingSetId(d.processingSetId); setRawMaterial({ id: d.rawMaterialProductId, name: d.rawMaterialName, sku: d.rawMaterialSku });
      setInputQuantity(String(d.inputQuantity)); setInputUom(d.inputUom ?? "");
      setRows(d.outputs.map((o: { productId: number; finishedGoodName?: string; productName: string; productSku: string; configuredPercentage: number | null; actualPercentage: number; actualQuantity: number; outputAreaId: number; remarks: string | null }) => ({
        key: `k${keySeq++}`, productId: o.productId, name: o.productName, sku: o.productSku,
        configuredPercentage: o.configuredPercentage, actualPercentage: String(o.actualPercentage), actualQuantity: String(o.actualQuantity),
        outputAreaId: o.outputAreaId, remarks: o.remarks ?? "", lastEdited: "pct",
      })));
      // Re-fetch the set purely for its configured Process Loss % (reference
      // only — display, not persisted on this transaction).
      fetch(`/api/manufacturing/processing-set/${d.processingSetId}`, { cache: "no-store" }).then((r) => r.json()).then((sj) => { if (sj.ok) setConfiguredProcessLossPct(sj.data.processLossPercentage); }).catch(() => {});
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selecting a Processing Set copies its raw material + output % — a
  // SNAPSHOT. The master is never re-read again after this copy.
  async function pickSet(id: number) {
    setProcessingSetId(id);
    setPickingSet(true);
    const j = await fetch(`/api/manufacturing/processing-set/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    setPickingSet(false);
    if (!j.ok) { toast.error(j?.message || "Could not load the Processing Set."); return; }
    const d = j.data;
    setRawMaterial({ id: d.rawMaterialProductId, name: d.rawMaterialName, sku: d.rawMaterialSku });
    setInputUom(d.rawMaterialUom || "");
    setConfiguredProcessLossPct(d.processLossPercentage);
    const qty = n(inputQuantity);
    setRows(d.outputs.map((o: { finishedGoodProductId: number; finishedGoodName: string; finishedGoodSku: string; expectedPercentage: number }) => ({
      key: `k${keySeq++}`, productId: o.finishedGoodProductId, name: o.finishedGoodName, sku: o.finishedGoodSku,
      configuredPercentage: o.expectedPercentage, actualPercentage: String(o.expectedPercentage),
      actualQuantity: qty > 0 ? String(r3(qty * (o.expectedPercentage / 100))) : "",
      outputAreaId: "", remarks: "", lastEdited: "pct",
    })));
  }

  // Recompute every row still in "pct" mode when the Processing Quantity
  // itself changes; rows the user has manually fixed to a quantity are left alone.
  useEffect(() => {
    const qty = n(inputQuantity);
    setRows((prev) => prev.map((r) => (r.lastEdited === "pct" ? { ...r, actualQuantity: qty > 0 ? String(r3(qty * (n(r.actualPercentage) / 100))) : "" } : r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputQuantity]);

  // Live stock check, debounced — stock is checked in the Processing Area
  // itself (the raw material's issue point and WIP receipt point are the
  // same Area, selected once at the top of the form).
  const stockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!rawMaterial || !processingAreaId || !inputQuantity) { setStock(null); return; }
    if (stockTimer.current) clearTimeout(stockTimer.current);
    setStockLoading(true);
    stockTimer.current = setTimeout(() => {
      const u = new URLSearchParams({ productId: String(rawMaterial.id), areaId: String(processingAreaId), qty: inputQuantity });
      if (branchId) u.set("branchId", String(branchId));
      fetch(`/api/manufacturing/material-processing/stock-check?${u}`, { cache: "no-store" })
        .then((r) => r.json()).then((j) => { if (j.ok) setStock(j); }).catch(() => {}).finally(() => setStockLoading(false));
    }, 300);
    return () => { if (stockTimer.current) clearTimeout(stockTimer.current); };
  }, [rawMaterial, processingAreaId, inputQuantity, branchId]);

  function setPct(key: string, pct: string) {
    const qty = n(inputQuantity);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, actualPercentage: pct, actualQuantity: qty > 0 ? String(r3(qty * (n(pct) / 100))) : r.actualQuantity, lastEdited: "pct" } : r)));
  }
  function setQty(key: string, qty: string) {
    const inQty = n(inputQuantity);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, actualQuantity: qty, actualPercentage: inQty > 0 ? String(r3((n(qty) / inQty) * 100)) : r.actualPercentage, lastEdited: "qty" } : r)));
  }
  function setOutputArea(key: string, areaId: number) { setRows((prev) => prev.map((r) => (r.key === key ? { ...r, outputAreaId: areaId } : r))); }
  function setRemarks(key: string, remarks: string) { setRows((prev) => prev.map((r) => (r.key === key ? { ...r, remarks } : r))); }
  function addOutput(p: ManufacturingProductHit) {
    if (rows.some((r) => r.productId === p.id)) { toast.error("This Finished Good is already added to this transaction."); return; }
    const defaultArea = branchAreas.find((a) => a.type === "Finished Goods")?.id ?? "";
    setRows((prev) => [...prev, { key: `k${keySeq++}`, productId: p.id, name: p.name, sku: p.sku, configuredPercentage: null, actualPercentage: "0", actualQuantity: "0", outputAreaId: defaultArea, remarks: "", lastEdited: "qty" }]);
  }
  function confirmRemove() { if (removeTarget) setRows((prev) => prev.filter((r) => r.key !== removeTarget.key)); setRemoveTarget(null); }

  const totalActualQty = useMemo(() => r3(rows.reduce((s, r) => s + n(r.actualQuantity), 0)), [rows]);
  const totalActualPct = useMemo(() => r3(rows.reduce((s, r) => s + n(r.actualPercentage), 0)), [rows]);
  const diffQty = useMemo(() => r3(n(inputQuantity) - totalActualQty), [inputQuantity, totalActualQty]);
  // Process Loss / Wastage — always the REMAINDER after Finished Goods, so
  // Finished Goods % + Process Loss % reconciles to exactly 100% by construction.
  const processLossPct = useMemo(() => r3(100 - totalActualPct), [totalActualPct]);
  const processLossQty = useMemo(() => r3(n(inputQuantity) - totalActualQty), [inputQuantity, totalActualQty]);

  const canSaveDraft = !!processingAreaId && !!processingSetId && n(inputQuantity) > 0 && rows.length > 0 && rows.every((r) => r.outputAreaId);
  const canInitiate = canSaveDraft && (stock ? stock.sufficient : true);

  function buildPayload() {
    return {
      processingDate, branchId: branchId || null, processingAreaId, processingUnit: processingUnit.trim() || null,
      processingSetId, rawMaterialProductId: rawMaterial?.id, sourceAreaId: processingAreaId, inputQuantity: n(inputQuantity), inputUom: inputUom || null,
      outputs: rows.map((r) => ({ id: undefined, productId: r.productId, configuredPercentage: r.configuredPercentage, actualPercentage: n(r.actualPercentage), actualQuantity: n(r.actualQuantity), outputAreaId: r.outputAreaId, remarks: r.remarks.trim() || null })),
    };
  }

  async function save(mode: "draft" | "initiate") {
    if (mode === "draft" && !canSaveDraft) return;
    if (mode === "initiate" && !canInitiate) return;
    setSaving(mode);
    try {
      const payload = buildPayload();
      const res = await fetch(mpId ? `/api/manufacturing/material-processing/${mpId}` : "/api/manufacturing/material-processing", {
        method: mpId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) { toast.error(j?.message || "Could not save."); setSaving(null); return; }
      const id = mpId ?? j.id;
      if (mode === "draft") { toast.success(j.message || "Saved as Draft."); router.push(`/manufacturing/material-processing/${id}`); return; }
      const initRes = await fetch(`/api/manufacturing/material-processing/${id}/initiate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const initJ = await initRes.json().catch(() => ({}));
      if (!initRes.ok || !initJ.ok) { toast.error(initJ?.message || "Saved as Draft, but could not initiate."); router.push(`/manufacturing/material-processing/${id}`); return; }
      toast.success(initJ.message || "Material Processing initiated.");
      router.push(`/manufacturing/material-processing/${id}`);
    } catch { toast.error("Network error — could not save."); setSaving(null); }
  }

  if (loading) return <div className="py-16 text-center text-sm text-muted">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/manufacturing/material-processing" className="hover:text-foreground">Material Processing</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{mpId ? "Edit" : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Factory className="h-5 w-5 text-primary" /> {mpId ? "Edit Material Processing" : "Add Material Processing"}</h1>
        </div>
        <Link href="/manufacturing/material-processing"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      <SectionCard icon={Factory} title="Processing Location">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Branch *">
            <select value={branchId} onChange={(e) => { setBranchId(e.target.value ? Number(e.target.value) : ""); setProcessingAreaId(""); }} className={inp}>
              <option value="">— Select —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Area / Processing Area *">
            <select value={processingAreaId} onChange={(e) => setProcessingAreaId(e.target.value ? Number(e.target.value) : "")} disabled={!branchId} className={inp}>
              <option value="">{branchId ? "— Select —" : "Select a branch first"}</option>
              {processingAreas.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </Field>
          <Field label="Processing Unit"><input value={processingUnit} onChange={(e) => setProcessingUnit(e.target.value)} placeholder="e.g. Crusher Unit 01 (optional)" className={inp} /></Field>
        </div>
      </SectionCard>

      {processingAreaId && (
        <SectionCard icon={Factory} title="Processing Set">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Processing Set *">
              <div className="relative">
                <select value={processingSetId} onChange={(e) => e.target.value && pickSet(Number(e.target.value))} disabled={pickingSet} className={inp}>
                  <option value="">— Select —</option>
                  {sets.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                </select>
                {pickingSet && <Loader2 className="pointer-events-none absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
              </div>
            </Field>
            <Field label="Processing Date"><input type="date" value={processingDate} onChange={(e) => setProcessingDate(e.target.value)} className={inp} /></Field>
          </div>
          {pickingSet && <p className="mt-2 text-2xs text-muted">Loading Raw Material and Finished Goods from the Processing Set…</p>}
        </SectionCard>
      )}

      {rawMaterial && !pickingSet && (
        <SectionCard icon={Gauge} title="Raw Material Input">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Raw Material"><input readOnly value={`${rawMaterial.name}${rawMaterial.sku ? ` (${rawMaterial.sku})` : ""}`} className={cn(inp, "bg-surface-2")} /></Field>
            <Field label="Source / Processing Area"><input readOnly value={processingAreas.find((a) => a.id === processingAreaId)?.name ?? ""} className={cn(inp, "bg-surface-2")} /></Field>
            <Field label="Processing Quantity *">
              <div className="flex gap-2">
                <input type="number" min={0} step="any" value={inputQuantity} onChange={(e) => setInputQuantity(e.target.value)} placeholder="0" className={inp} />
                <input readOnly value={inputUom} placeholder="UOM" className="h-10 w-24 rounded-md border border-border-strong bg-surface-2 px-2 text-center text-sm text-muted" />
              </div>
            </Field>
          </div>

          {inputQuantity && (
            <div className={cn("mt-3 rounded-lg border p-3", stock == null ? "border-border bg-surface-2" : stock.sufficient ? "border-success/30 bg-success-subtle/30" : "border-danger/30 bg-danger-subtle/30")}>
              {stockLoading && <p className="text-2xs text-muted">Checking stock…</p>}
              {!stockLoading && stock && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span>Available Stock: <strong className="text-foreground">{stock.availableQty}</strong></span>
                  <span>{stock.sufficient ? "Processing Quantity" : "Requested Quantity"}: <strong className="text-foreground">{stock.requestedQty}</strong></span>
                  {stock.sufficient && <span>Balance After Issue: <strong className="text-foreground">{stock.balanceAfterIssue}</strong></span>}
                  {stock.wipQty > 0 && <span className="text-2xs text-subtle">(WIP already in process: {stock.wipQty})</span>}
                  <span className={cn("inline-flex items-center gap-1 font-semibold", stock.sufficient ? "text-success" : "text-danger")}>
                    {stock.sufficient ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {stock.sufficient ? "Sufficient Stock" : "Insufficient Stock"}
                  </span>
                </div>
              )}
              {!stockLoading && stock && !stock.sufficient && <p className="mt-1 text-2xs font-medium text-danger">Processing quantity cannot exceed available stock in the selected storage area.</p>}
            </div>
          )}
        </SectionCard>
      )}

      {rawMaterial && (
        <SectionCard icon={Factory} title="Finished Goods Output" allowOverflow>
          <div className="mb-3 max-w-md">
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-primary"><Plus className="h-3.5 w-3.5" /> Add Finished Good</p>
            <ProductPicker placeholder="Search a Finished Good to add…" disabledIds={rows.map((r) => r.productId)} onPick={addOutput} />
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-auto" /><col className="w-24" /><col className="w-28" /><col className="w-32" /><col className="w-56" /><col className="w-12" />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                  <th className="px-4 py-2.5 whitespace-nowrap">Finished Good</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">Configured %</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">Actual %</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">Actual Qty</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Output Storage Area *</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5"><div className="font-medium text-foreground">{r.name}</div><div className="font-mono text-2xs text-subtle">{r.sku}{r.configuredPercentage == null && <span className="ml-1.5 rounded-full bg-accent/20 px-1.5 text-accent-foreground">Added</span>}</div></td>
                    <td className="px-4 py-2.5 text-right align-middle text-muted">{r.configuredPercentage != null ? `${r.configuredPercentage}%` : "—"}</td>
                    <td className="px-4 py-2.5 align-middle"><input type="number" min={0} step="0.01" value={r.actualPercentage} onChange={(e) => setPct(r.key, e.target.value)} className="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" /></td>
                    <td className="px-4 py-2.5 align-middle"><input type="number" min={0} step="any" value={r.actualQuantity} onChange={(e) => setQty(r.key, e.target.value)} className="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none" /></td>
                    <td className="px-4 py-2.5 align-middle">
                      <select value={r.outputAreaId} onChange={(e) => setOutputArea(r.key, Number(e.target.value))} className="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none">
                        <option value="">— Select —</option>
                        {branchAreas.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-center align-middle"><button onClick={() => setRemoveTarget(r)} className="text-subtle hover:text-danger"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">No Finished Goods yet — select a Processing Set above, or search to add one.</td></tr>}
                {rows.length > 0 && (
                  <tr className="border-b border-border bg-warning-subtle/20 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">Process Loss / Wastage</div>
                      <div className="text-2xs text-subtle">Not a product — the remainder after Finished Goods, so the total reconciles to 100%.</div>
                    </td>
                    <td className="px-4 py-2.5 text-right align-middle text-muted">{configuredProcessLossPct != null ? `${configuredProcessLossPct}%` : "—"}</td>
                    <td className={cn("px-4 py-2.5 text-right align-middle font-semibold", processLossPct < 0 ? "text-danger" : "text-warning")}>{processLossPct}%</td>
                    <td className={cn("px-4 py-2.5 text-right align-middle font-semibold", processLossQty < 0 ? "text-danger" : "text-warning")}>{processLossQty}</td>
                    <td className="px-4 py-2.5 align-middle text-2xs text-subtle">—</td>
                    <td />
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border bg-surface-2">
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-foreground">Total (Finished Goods + Process Loss)</td>
                    <td />
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-foreground">{r3(totalActualPct + processLossPct)}%</td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold text-foreground">{r3(totalActualQty + processLossQty)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {rows.length > 0 && inputQuantity && (
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm">
              <span>Total Finished Goods Output Qty: <strong className="text-foreground">{totalActualQty}</strong></span>
              <span>Process Loss / Wastage Qty: <strong className="text-foreground">{processLossQty}</strong></span>
              <span>Input Quantity: <strong className="text-foreground">{n(inputQuantity)}</strong></span>
              <span className={cn("font-semibold", Math.abs(diffQty) < 0.001 ? "text-success" : "text-warning")}>
                {Math.abs(diffQty) < 0.001 ? "Fully allocated" : `Unallocated / Difference: ${diffQty}`}
              </span>
            </div>
          )}
        </SectionCard>
      )}

      <div className="flex items-center justify-end gap-2">
        <Link href="/manufacturing/material-processing"><Button variant="outline" size="lg">Cancel</Button></Link>
        <Button variant="outline" size="lg" disabled={!canSaveDraft || !!saving} onClick={() => save("draft")}>{saving === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft</Button>
        <Button size="lg" disabled={!canInitiate || !!saving} onClick={() => save("initiate")}>{saving === "initiate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Initiate Process</Button>
      </div>

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setRemoveTarget(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4"><h3 className="text-base font-bold text-foreground">Remove Finished Good?</h3><p className="mt-1.5 text-sm text-muted">Remove <strong className="text-foreground">{removeTarget.name}</strong> from this processing transaction?</p></div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
              <Button variant="outline" size="md" onClick={() => setRemoveTarget(null)}>Cancel</Button>
              <Button variant="danger" size="md" onClick={confirmRemove}>Remove</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>;
}

function ProductPicker({ placeholder, disabledIds, onPick }: { placeholder: string; disabledIds: number[]; onPick: (p: ManufacturingProductHit) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ManufacturingProductHit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q.trim()) { setRes([]); return; }
    if (timer.current) clearTimeout(timer.current);
    const ctrl = new AbortController();
    timer.current = setTimeout(() => {
      fetch(`/api/manufacturing/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent("Finished Product")}`, { cache: "no-store", signal: ctrl.signal })
        .then((r) => r.json()).then((j) => { if (j.ok) { setRes(j.products); setOpen(true); } }).catch(() => {});
    }, 220);
    return () => { clearTimeout(timer.current!); ctrl.abort(); };
  }, [q]);

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

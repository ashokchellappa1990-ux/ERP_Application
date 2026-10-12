"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useScope } from "@/components/scope/ScopeProvider";
import {
  Warehouse,
  Search,
  Save,
  Send,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  IndianRupee,
  ListChecks,
  Plus,
  Copy,
  Trash2,
  ChevronDown,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

interface Candidate {
  productId: number;
  productName: string;
  sku: string;
  uom: string;
  category: string;
  mrp: number;
  stock: number;
  invBatch: boolean;
  invMfg: boolean;
  invExpiry: boolean;
}
interface Line extends Candidate {
  key: string;
  qty: string;
  mrpStr: string;
  purchasePrice: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  supplier: string;
  purchaseRef: string;
  purchaseDate: string;
  remarks: string;
  expanded: boolean;
}

const WAREHOUSES = ["Main Store", "Warehouse A", "Cold Storage", "Back Office"];
let keySeq = 1;

// productId -> tracking flags, used to resolve required fields for lines loaded
// from a saved document (those don't come through the picker which carries flags).
type TrackFlags = { invBatch?: boolean; invMfg?: boolean; invExpiry?: boolean };

/** Flatten the product list API (parents + nested variants) into SKU candidates. */
function flatten(rows: Array<{
  id: number; name: string; code: string; category: string; uom: string; mrp: number; stock: number;
  variantCount: number; variants: ({ id: number; name: string; code: string; sku: string; mrp: number; stock: number } & TrackFlags)[];
} & TrackFlags>): Candidate[] {
  const out: Candidate[] = [];
  for (const p of rows) {
    if (p.variantCount > 0) {
      // Variants inherit the parent's tracking flags unless they carry their own.
      for (const v of p.variants) out.push({ productId: v.id, productName: v.name, sku: v.sku || v.code, uom: p.uom, category: p.category, mrp: v.mrp, stock: v.stock, invBatch: !!(v.invBatch ?? p.invBatch), invMfg: !!(v.invMfg ?? p.invMfg), invExpiry: !!(v.invExpiry ?? p.invExpiry) });
    } else {
      out.push({ productId: p.id, productName: p.name, sku: p.code, uom: p.uom, category: p.category, mrp: p.mrp, stock: p.stock, invBatch: !!p.invBatch, invMfg: !!p.invMfg, invExpiry: !!p.invExpiry });
    }
  }
  return out;
}

export default function QuickOpeningStockPage() {
  const router = useRouter();
  const fmt = useFmt();
  const toastPopup = useToast();
  const [docId, setDocId] = useState<number | null>(null);
  const [docNo, setDocNo] = useState("");
  const [asOn, setAsOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [warehouse, setWarehouse] = useState(WAREHOUSES[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  // productId -> tracking flags, used to resolve required fields for lines loaded
  // from a saved document (those don't come through the picker which carries flags).
  const [trackMap, setTrackMap] = useState<Record<number, TrackFlags>>({});
  // Has the user attempted to save? Used to highlight missing required fields.
  const [attempted, setAttempted] = useState(false);
  // Resolve the effective tracking flags for a line: prefer flags on the line
  // itself (set when picked), fall back to the productId map (edit-load path).
  const reqFor = (l: Line) => {
    const m = trackMap[l.productId];
    return {
      batch: !!(l.invBatch || m?.invBatch),
      mfg: !!(l.invMfg || m?.invMfg),
      expiry: !!(l.invExpiry || m?.invExpiry),
    };
  };
  const missingFor = (l: Line) => {
    const r = reqFor(l);
    return {
      batch: r.batch && !l.batchNo.trim(),
      mfg: r.mfg && !l.mfgDate.trim(),
      expiry: r.expiry && !l.expiryDate.trim(),
    };
  };
  // Look up tracking flags for a set of productIds via the product catalog and
  // merge them into trackMap. Used on edit-load; the picker path carries flags inline.
  async function loadTrackFlags(ids: number[]) {
    try {
      const results = await Promise.all(ids.map((id) =>
        fetch(`/api/products/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null)));
      const next: Record<number, TrackFlags> = {};
      results.forEach((j, i) => {
        if (!j?.ok) return;
        // /api/products/[id] returns data.toggles.inventoryTracking.{batch,mfg,expiry}.
        const t = j?.data?.toggles?.inventoryTracking ?? {};
        next[ids[i]] = { invBatch: !!t.batch, invMfg: !!t.mfg, invExpiry: !!t.expiry };
      });
      if (Object.keys(next).length) setTrackMap((m) => ({ ...m, ...next }));
    } catch { /* ignore — server still enforces 422 */ }
  }

  // Branch list, restricted to what the logged-in user may see (active business).
  const { ready: scopeReady, branches: scopeBranches, businessId: scopeBusinessId, branchIds } = useScope();
  const myBranches = useMemo(() => scopeBranches.filter((b) => b.businessId === scopeBusinessId), [scopeBranches, scopeBusinessId]);
  const defaultedBranch = useRef(false);
  // Default to the user's active branch once scope loads (new documents only).
  useEffect(() => {
    if (!scopeReady || defaultedBranch.current) return;
    if (new URLSearchParams(window.location.search).get("id")) { defaultedBranch.current = true; return; }
    const active = (branchIds && branchIds.length ? myBranches.find((b) => b.id === branchIds[0]) : null) ?? myBranches[0];
    if (active) { setWarehouse(active.name); defaultedBranch.current = true; }
  }, [scopeReady, myBranches, branchIds]);

  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [openPicker, setOpenPicker] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "submit">(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load an existing draft when ?id= is present.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("id"));
    if (!id) return;
    (async () => {
      const res = await fetch(`/api/inventory/opening-stock/${id}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) return;
      const d = j.data;
      setDocId(d.id); setDocNo(d.docNo); setAsOn(d.asOnDate); setWarehouse(d.warehouse || WAREHOUSES[0]); setNotes(d.notes || "");
      setLines(d.lines.map((l: Record<string, unknown>) => ({
        key: `k${keySeq++}`, productId: l.productId as number, productName: l.productName as string, sku: (l.sku as string) || "",
        uom: (l.uom as string) || "", category: (l.category as string) || "", mrp: Number(l.mrp) || 0, stock: 0,
        invBatch: !!l.invBatch, invMfg: !!l.invMfg, invExpiry: !!l.invExpiry,
        qty: String(l.qty ?? ""), mrpStr: l.mrp === "" ? "" : String(l.mrp), purchasePrice: l.purchasePrice === "" ? "" : String(l.purchasePrice),
        batchNo: (l.batchNo as string) || "", mfgDate: (l.mfgDate as string) || "", expiryDate: (l.expiryDate as string) || "",
        supplier: (l.supplier as string) || "", purchaseRef: (l.purchaseRef as string) || "", purchaseDate: (l.purchaseDate as string) || "",
        remarks: (l.remarks as string) || "", expanded: false,
      })));
      // Resolve tracking flags for the loaded products so required fields are known
      // even though these lines didn't come through the picker.
      const ids: number[] = Array.from(new Set((d.lines ?? []).map((l: Record<string, unknown>) => Number(l.productId)).filter(Boolean)));
      if (ids.length) loadTrackFlags(ids);
    })();
  }, []);

  // Debounced product search (by name / sku / code).
  useEffect(() => {
    if (!query.trim()) { setCandidates([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(query)}&pageSize=20`, { cache: "no-store", signal: ctrl.signal });
        const j = await res.json().catch(() => ({}));
        if (j.ok) { setCandidates(flatten(j.rows)); setOpenPicker(true); }
      } catch { /* ignore */ }
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpenPicker(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function addLine(c: Candidate) {
    // Auto-expand the batch section when the product is batch/mfg/expiry tracked so
    // the required fields are visible immediately.
    const tracked = !!(c.invBatch || c.invMfg || c.invExpiry);
    setLines((prev) => [
      ...prev,
      {
        ...c, key: `k${keySeq++}`, qty: "", mrpStr: c.mrp ? String(c.mrp) : "", purchasePrice: "",
        batchNo: "", mfgDate: "", expiryDate: "", supplier: "", purchaseRef: "", purchaseDate: "", remarks: "", expanded: tracked,
      },
    ]);
    // Keep trackMap in sync so validation works even if flags are read from the map.
    setTrackMap((m) => ({ ...m, [c.productId]: { invBatch: c.invBatch, invMfg: c.invMfg, invExpiry: c.invExpiry } }));
    setQuery(""); setCandidates([]); setOpenPicker(false);
  }
  function duplicate(key: string) {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.key === key);
      if (i < 0) return prev;
      const copy: Line = { ...prev[i], key: `k${keySeq++}`, qty: "", batchNo: "", expiryDate: "", mfgDate: "", expanded: true };
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next;
    });
  }
  const update = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const valid = useMemo(() => lines.filter((l) => Number(l.qty) > 0), [lines]);
  const totalQty = valid.reduce((s, l) => s + Number(l.qty), 0);
  const totalValue = valid.reduce((s, l) => s + Number(l.qty) * (Number(l.purchasePrice) || Number(l.mrpStr) || 0), 0);

  async function save(status: "Draft" | "Submitted") {
    setError(""); setToast(""); setAttempted(true);
    if (!valid.length) { setError("Add at least one product line with a quantity."); return; }
    // Client-side guard: tracked products must carry their required batch/mfg/expiry
    // values. The server also enforces this (422); this surfaces it early + clearly.
    for (const l of lines) {
      const miss = missingFor(l);
      const field = miss.batch ? { label: "Batch number", noun: "batch-tracked" }
        : miss.mfg ? { label: "Manufacturing date", noun: "manufacturing-date tracked" }
        : miss.expiry ? { label: "Expiry date", noun: "expiry-tracked" }
        : null;
      if (field) {
        const msg = `${field.label} is required for "${l.productName}" — it is ${field.noun}.`;
        setError(msg); toastPopup.error(msg);
        update(l.key, { expanded: true }); // reveal the batch section for this line
        return;
      }
    }
    setBusy(status === "Draft" ? "draft" : "submit");
    const payload = {
      asOnDate: asOn, warehouse, notes, status,
      scopeBranchId: myBranches.find((b) => b.name === warehouse)?.id ?? "all", // route stock to the chosen branch

      lines: lines.map((l) => ({
        productId: l.productId, productName: l.productName, sku: l.sku, uom: l.uom, category: l.category,
        qty: l.qty, mrp: l.mrpStr, purchasePrice: l.purchasePrice,
        batchNo: l.batchNo, mfgDate: l.mfgDate, expiryDate: l.expiryDate,
        supplier: l.supplier, purchaseRef: l.purchaseRef, purchaseDate: l.purchaseDate, remarks: l.remarks,
      })),
    };
    try {
      const res = await fetch(docId ? `/api/inventory/opening-stock/${docId}` : "/api/inventory/opening-stock", {
        method: docId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j?.message || "Could not save."); toastPopup.error(j?.message || "Could not save the opening stock."); setBusy(null); return; }
      toastPopup.success(j.message || (status === "Submitted" ? "Opening stock submitted." : "Opening stock saved."));
      if (status === "Submitted") { router.push("/masters/opening-stock"); return; }
      // Draft saved — stay on page, become an editable doc.
      if (!docId && j.id) setDocId(j.id);
      setToast(j.message || "Draft saved.");
      window.setTimeout(() => setToast(""), 2500);
    } catch {
      setError("Network error — could not save.");
      toastPopup.error("Could not reach the server. Please try again.");
    }
    setBusy(null);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <Link href="/masters/opening-stock" className="hover:text-foreground">Opening Stock Setup</Link>
            <span className="text-subtle">/</span>
            <span className="font-medium text-foreground">{docId ? docNo || "Edit" : "Quick Stock Entry"}</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Quick Opening Stock Entry</h1>
          <p className="mt-0.5 text-sm text-muted">Search a product by name, enter quantity &amp; rate, and submit. Use “Add more” for batch / rate-wise stock of the same SKU.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/masters/opening-stock"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button variant="secondary" size="md" onClick={() => save("Draft")} disabled={!!busy}>
            <Save className="h-4 w-4" /> {busy === "draft" ? "Saving…" : "Save as Draft"}
          </Button>
          <Button size="md" onClick={() => save("Submitted")} disabled={!!busy}>
            <Send className="h-4 w-4" /> {busy === "submit" ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </div>

      {/* Context */}
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">As-on Date</label>
          <input type="date" value={asOn} onChange={(e) => setAsOn(e.target.value)} className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Branch</label>
          <div className="relative">
            <Warehouse className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} disabled={myBranches.length <= 1} className="h-10 w-full rounded-md border border-border-strong bg-surface pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-70">
              {myBranches.length === 0 && <option value={warehouse}>{warehouse}</option>}
              {myBranches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional remarks for this opening stock" className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus" />
        </div>
      </div>

      {/* Product search picker */}
      <div ref={pickerRef} className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => candidates.length && setOpenPicker(true)}
            placeholder="Search product by name, code or SKU to add a line…"
            className="h-12 w-full rounded-xl border border-border-strong bg-card pl-11 pr-3 text-sm text-foreground shadow-sm placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus"
          />
        </div>
        {openPicker && candidates.length > 0 && (
          <div className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
            {candidates.map((c) => (
              <button
                key={c.productId}
                onClick={() => addLine(c)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-primary-subtle/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{c.productName}</span>
                  <span className="font-mono text-2xs text-subtle">{c.sku || "—"} · {c.category || "—"} · {c.uom || "—"}</span>
                </span>
                <span className="flex items-center gap-2 text-2xs text-muted">
                  <span>{fmt.money(c.mrp || 0)}</span>
                  <Plus className="h-4 w-4 text-primary" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat icon={Boxes} label="Lines" value={lines.length} tone="primary" />
        <MiniStat icon={ListChecks} label="With qty" value={valid.length} tone="info" />
        <MiniStat icon={CheckCircle2} label="Total quantity" value={fmt.qty(totalQty)} tone="success" />
        <MiniStat icon={IndianRupee} label="Opening value" value={fmt.money(totalValue)} tone="accent" />
      </div>

      {/* Lines table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-center">UOM</th>
                <th className="px-3 py-3 text-right">MRP</th>
                <th className="px-3 py-3 text-right">Purchase Price</th>
                <th className="px-3 py-3 text-right">Value</th>
                <th className="px-3 py-3 text-center">Batch / Purchase</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const value = Number(l.qty) * (Number(l.purchasePrice) || Number(l.mrpStr) || 0);
                const hasDetails = !!(l.batchNo || l.expiryDate || l.supplier || l.purchaseRef);
                const lineMiss = missingFor(l);
                const anyMiss = lineMiss.batch || lineMiss.mfg || lineMiss.expiry;
                return (
                  <Fragmentish key={l.key}>
                    <tr className={cn("border-b border-border transition", Number(l.qty) > 0 ? "bg-primary-subtle/15" : "")}>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">{l.productName}</div>
                        <div className="font-mono text-2xs text-subtle">{l.sku || "—"} · {l.category || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input type="number" min={0} value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} placeholder="0"
                          className={cn("h-9 w-24 rounded-md border bg-surface px-2 text-right text-sm font-semibold text-foreground focus:outline-none focus:shadow-focus", Number(l.qty) > 0 ? "border-primary" : "border-border-strong focus:border-primary")} />
                      </td>
                      <td className="px-3 py-2.5 text-center"><span className="rounded-md bg-surface-2 px-2 py-0.5 text-2xs font-medium text-muted">{l.uom || "—"}</span></td>
                      <td className="px-3 py-2.5 text-right">
                        <input type="number" min={0} value={l.mrpStr} onChange={(e) => update(l.key, { mrpStr: e.target.value })} placeholder="0"
                          className="h-9 w-24 rounded-md border border-border-strong bg-surface px-2 text-right text-sm text-foreground focus:border-primary focus:outline-none" />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input type="number" min={0} value={l.purchasePrice} onChange={(e) => update(l.key, { purchasePrice: e.target.value })} placeholder="0"
                          className="h-9 w-24 rounded-md border border-border-strong bg-surface px-2 text-right text-sm text-foreground focus:border-primary focus:outline-none" />
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-foreground">{value ? fmt.money(value) : "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => update(l.key, { expanded: !l.expanded })}
                          title={anyMiss ? "Batch / Mfg / Expiry required for this tracked product" : undefined}
                          className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-2xs font-semibold transition", attempted && anyMiss ? "border-danger bg-danger-subtle text-danger" : anyMiss ? "border-warning/50 bg-warning-subtle text-warning" : hasDetails || l.expanded ? "border-primary/40 bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40")}>
                          <Layers className="h-3 w-3" /> {hasDetails ? "Added" : "Add"}{anyMiss && <Req />}
                          <ChevronDown className={cn("h-3 w-3 transition-transform", l.expanded && "rotate-180")} />
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => duplicate(l.key)} title="Add more (same product, different batch/rate)" className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-primary-subtle hover:text-primary"><Copy className="h-3.5 w-3.5" /></button>
                          <button onClick={() => remove(l.key)} title="Remove" className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-danger-subtle hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                    {l.expanded && (
                      <tr className="border-b border-border bg-surface-2/40">
                        <td colSpan={8} className="px-3 py-3">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {(() => { const req = reqFor(l); const miss = missingFor(l); return (<>
                            <Field label={<>Batch No{req.batch && <Req />}</>}><input value={l.batchNo} onChange={(e) => update(l.key, { batchNo: e.target.value })} placeholder="BATCH-001" className={cn(detInput, attempted && miss.batch && "border-danger focus:border-danger")} /></Field>
                            <Field label={<>Mfg Date{req.mfg && <Req />}</>}><input type="date" value={l.mfgDate} onChange={(e) => update(l.key, { mfgDate: e.target.value })} className={cn(detInput, attempted && miss.mfg && "border-danger focus:border-danger")} /></Field>
                            <Field label={<>Expiry Date{req.expiry && <Req />}</>}><input type="date" value={l.expiryDate} onChange={(e) => update(l.key, { expiryDate: e.target.value })} className={cn(detInput, attempted && miss.expiry && "border-danger focus:border-danger")} /></Field>
                            </>); })()}
                            <Field label="Supplier"><input value={l.supplier} onChange={(e) => update(l.key, { supplier: e.target.value })} placeholder="Supplier name" className={detInput} /></Field>
                            <Field label="Purchase Ref / Invoice"><input value={l.purchaseRef} onChange={(e) => update(l.key, { purchaseRef: e.target.value })} placeholder="INV-1023" className={detInput} /></Field>
                            <Field label="Purchase Date"><input type="date" value={l.purchaseDate} onChange={(e) => update(l.key, { purchaseDate: e.target.value })} className={detInput} /></Field>
                            <div className="sm:col-span-2"><Field label="Remarks"><input value={l.remarks} onChange={(e) => update(l.key, { remarks: e.target.value })} placeholder="Optional notes" className={detInput} /></Field></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragmentish>
                );
              })}
              {lines.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                  Search a product above to add your first line.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky submit bar */}
      <div className="sticky bottom-4 z-10 flex flex-col items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row">
        <div className="text-sm text-muted">
          <strong className="text-foreground">{valid.length}</strong> line{valid.length === 1 ? "" : "s"} · qty <strong className="text-foreground">{fmt.qty(totalQty)}</strong> · value <strong className="text-foreground">{fmt.money(totalValue)}</strong>
          {error && <span className="ml-3 font-medium text-danger">{error}</span>}
          {toast && <span className="ml-3 inline-flex items-center gap-1 font-medium text-success"><CheckCircle2 className="h-4 w-4" /> {toast}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="lg" onClick={() => save("Draft")} disabled={!!busy}>
            <Save className="h-4 w-4" /> {busy === "draft" ? "Saving…" : "Save as Draft"}
          </Button>
          <Button size="lg" onClick={() => save("Submitted")} disabled={!!busy || !valid.length}>
            <Send className="h-4 w-4" /> {busy === "submit" ? "Submitting…" : `Submit Opening Stock (${valid.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

const detInput = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none";

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</label>
      {children}
    </div>
  );
}
const Req = () => <span className="text-danger"> *</span>;

function Fragmentish({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

const TONES = {
  primary: "text-primary bg-primary-subtle",
  info: "text-info bg-info-subtle",
  success: "text-success bg-success-subtle",
  accent: "text-accent bg-accent/15",
} as const;

function MiniStat({ icon: Icon, label, value, tone }: { icon: typeof Boxes; label: string; value: string | number; tone: keyof typeof TONES }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", TONES[tone])}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <div className="text-base font-bold text-foreground">{value}</div>
        <div className="text-2xs text-subtle">{label}</div>
      </div>
    </div>
  );
}

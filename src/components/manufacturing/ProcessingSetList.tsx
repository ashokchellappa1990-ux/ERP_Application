"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Factory, Plus, Search, Eye, Pencil, Power, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { ProcessingSetRow, ProcessingSetStatus } from "@/lib/contracts/processingSet";

const STATUS_TONE: Record<ProcessingSetStatus, "success" | "neutral"> = { Active: "success", Inactive: "neutral" };

export function ProcessingSetList() {
  const toast = useToast();
  const [rows, setRows] = useState<ProcessingSetRow[]>([]);
  const [rawMaterials, setRawMaterials] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [status, setStatus] = useState("All");
  const [rawMaterialProductId, setRawMaterialProductId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [confirm, setConfirm] = useState<ProcessingSetRow | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const u = new URLSearchParams();
    if (appliedQ.trim()) u.set("q", appliedQ.trim());
    if (status !== "All") u.set("status", status);
    if (rawMaterialProductId) u.set("rawMaterialProductId", rawMaterialProductId);
    const res = await fetch(`/api/manufacturing/processing-set?${u}`, { cache: "no-store" });
    if (res.status === 401) { setNotAuthed(true); setLoading(false); return; }
    const j = await res.json().catch(() => ({}));
    if (j.ok) { setNotAuthed(false); setRows(j.rows); setRawMaterials(j.rawMaterials ?? []); }
    else toast.error(j?.message || "Could not load Processing Sets.");
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQ, status, rawMaterialProductId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [appliedQ, status, rawMaterialProductId]);

  async function toggleStatus(r: ProcessingSetRow) {
    setConfirmBusy(true);
    const next = r.status === "Active" ? "Inactive" : "Active";
    const j = await fetch(`/api/manufacturing/processing-set/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }).then((x) => x.json()).catch(() => ({}));
    setConfirmBusy(false);
    setConfirm(null);
    if (j.ok) { toast.success(j.message || "Updated."); load(); } else toast.error(j.message || "Could not update status.");
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Production</span><span className="text-subtle">/</span><span>Processing</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Processing Set Configuration</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Factory className="h-5 w-5 text-primary" /> Processing Set Configuration</h1>
          <p className="mt-0.5 text-sm text-muted">Configure raw material and expected finished goods output percentages for processing.</p>
        </div>
        <Link href="/manufacturing/processing-set/new"><Button size="md"><Plus className="h-4 w-4" /> Add Processing Set</Button></Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") setAppliedQ(q); }}
                placeholder="Processing Set name or Raw Material…"
                className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setAppliedQ(q)}>Search</Button>
            <FilterSelect value={rawMaterialProductId} onChange={setRawMaterialProductId} options={[{ value: "", label: "All Raw Materials" }, ...rawMaterials.map((r) => ({ value: String(r.id), label: r.name }))]} />
          </div>
          <div className="flex items-center gap-1.5">
            {(["All", "Active", "Inactive"] as const).map((s) => (
              <button key={s} onClick={() => setStatus(s)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", status === s ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground")}>
                {s === "All" ? "All Status" : s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Set Code</th>
                <th className="px-4 py-3">Processing Set Name</th>
                <th className="px-4 py-3">Raw Material</th>
                <th className="px-4 py-3 text-center">Output Products</th>
                <th className="px-4 py-3 text-center">Total %</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/20">
                  <td className="px-4 py-3 font-mono text-2xs text-primary">{r.code}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">{r.name}</td>
                  <td className="px-4 py-3 text-muted">{r.rawMaterialName || "—"}</td>
                  <td className="px-4 py-3 text-center text-foreground">{r.outputCount}</td>
                  <td className="px-4 py-3 text-center font-semibold">
                    <span className={r.totalPercentage === 100 ? "text-success" : "text-warning"}>{r.totalPercentage}%</span>
                  </td>
                  <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/manufacturing/processing-set/${r.id}`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                      <Link href={`/manufacturing/processing-set/new?id=${r.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></Link>
                      <button onClick={() => setConfirm(r)} title={r.status === "Active" ? "Deactivate" : "Activate"} className={cn("grid h-8 w-8 place-items-center rounded-md border transition", r.status === "Active" ? "border-warning/30 text-warning hover:bg-warning hover:text-white" : "border-success/30 text-success hover:bg-success hover:text-white")}><Power className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={7} className="px-4 py-10"><AppLoader label="Loading Processing Sets…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                  {notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : <>No Processing Sets configured yet. Click <Link href="/manufacturing/processing-set/new" className="font-semibold text-primary hover:underline">Add Processing Set</Link> to create one.</>}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <Pagination page={currentPage} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="processing sets" />
        )}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => !confirmBusy && setConfirm(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4">
              <h3 className="text-base font-bold text-foreground">{confirm.status === "Active" ? "Deactivate" : "Activate"} Processing Set</h3>
              <p className="mt-1.5 text-sm text-muted">
                {confirm.status === "Active"
                  ? <>Are you sure you want to deactivate <strong className="text-foreground">{confirm.name}</strong>? It will no longer be available for new processing transactions. Existing transactions are unaffected.</>
                  : <>Reactivate <strong className="text-foreground">{confirm.name}</strong>? It will become available for new processing transactions again.</>}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
              <Button variant="outline" size="md" disabled={confirmBusy} onClick={() => setConfirm(null)}>Cancel</Button>
              <Button size="md" disabled={confirmBusy} onClick={() => toggleStatus(confirm)}>{confirmBusy ? "Please wait…" : confirm.status === "Active" ? "Deactivate" : "Activate"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 appearance-none rounded-md border border-border bg-surface pl-3 pr-8 text-sm font-medium text-foreground transition hover:border-primary/40 focus:border-primary focus:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
    </div>
  );
}

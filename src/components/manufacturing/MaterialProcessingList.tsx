"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Factory, Plus, Search, Eye, Pencil, Play, CheckCircle2, Ban, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { MaterialProcessingRow, MaterialProcessingStatus } from "@/lib/contracts/materialProcessing";

const STATUS_TONE: Record<MaterialProcessingStatus, "neutral" | "warning" | "success" | "danger"> = {
  Draft: "neutral", InProgress: "warning", Completed: "success", Cancelled: "danger",
};
const STATUS_LABEL: Record<MaterialProcessingStatus, string> = { Draft: "Draft", InProgress: "In Progress", Completed: "Completed", Cancelled: "Cancelled" };
const STATUSES: ("All" | MaterialProcessingStatus)[] = ["All", "Draft", "InProgress", "Completed", "Cancelled"];

export function MaterialProcessingList() {
  const toast = useToast();
  const [rows, setRows] = useState<MaterialProcessingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"All" | MaterialProcessingStatus>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [applied, setApplied] = useState({ q: "", status: "All" as "All" | MaterialProcessingStatus, dateFrom: "", dateTo: "" });

  const [confirm, setConfirm] = useState<{ row: MaterialProcessingRow; action: "initiate" | "cancel" } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const u = new URLSearchParams();
    if (applied.q.trim()) u.set("q", applied.q.trim());
    if (applied.status !== "All") u.set("status", applied.status);
    if (applied.dateFrom) u.set("dateFrom", applied.dateFrom);
    if (applied.dateTo) u.set("dateTo", applied.dateTo);
    const res = await fetch(`/api/manufacturing/material-processing?${u}`, { cache: "no-store" });
    if (res.status === 401) { setNotAuthed(true); setLoading(false); return; }
    const j = await res.json().catch(() => ({}));
    if (j.ok) { setNotAuthed(false); setRows(j.rows); } else toast.error(j?.message || "Could not load Material Processing transactions.");
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);
  useEffect(() => { load(); }, [load]);

  function search() { setApplied({ q, status, dateFrom, dateTo }); }
  function reset() { setQ(""); setStatus("All"); setDateFrom(""); setDateTo(""); setApplied({ q: "", status: "All", dateFrom: "", dateTo: "" }); }

  async function runAction() {
    if (!confirm) return;
    setBusy(true);
    const path = confirm.action === "initiate" ? "initiate" : "cancel";
    const j = await fetch(`/api/manufacturing/material-processing/${confirm.row.id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false); setConfirm(null);
    if (j.ok) { toast.success(j.message || "Updated."); load(); } else toast.error(j.message || "Action failed.");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Production</span><span className="text-subtle">/</span><span>Processing</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Material Processing</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Factory className="h-5 w-5 text-primary" /> Material Processing</h1>
          <p className="mt-0.5 text-sm text-muted">Manage raw material processing and finished goods conversion.</p>
        </div>
        <Link href="/manufacturing/material-processing/new"><Button size="md"><Plus className="h-4 w-4" /> Add Material Processing</Button></Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Material Processing Number…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
            </div>
            <FilterSelect value={status} onChange={(v) => setStatus(v as "All" | MaterialProcessingStatus)} options={STATUSES.map((s) => ({ value: s, label: s === "All" ? "All Status" : STATUS_LABEL[s] }))} />
            <div className="flex items-center gap-1 text-2xs text-muted">
              <span className="font-semibold">From</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none" />
              <span className="font-semibold">To</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none" />
            </div>
            <Button size="sm" onClick={search}>Search</Button>
            <Button size="sm" variant="outline" onClick={reset}>Reset</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Processing No</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Processing Area</th>
                <th className="px-4 py-3">Processing Set</th>
                <th className="px-4 py-3">Raw Material</th>
                <th className="px-4 py-3 text-right">Input Qty</th>
                <th className="px-4 py-3 text-center">Output Products</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/20">
                  <td className="px-4 py-3 font-mono text-2xs text-primary">{r.processingNumber}</td>
                  <td className="px-4 py-3 text-muted">{r.processingDate}</td>
                  <td className="px-4 py-3 text-muted">{r.branchName}</td>
                  <td className="px-4 py-3 text-muted">{r.processingAreaName}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.processingSetName}</td>
                  <td className="px-4 py-3 text-muted">{r.rawMaterialName}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{r.inputQuantity} <span className="text-2xs font-normal text-subtle">{r.inputUom}</span></td>
                  <td className="px-4 py-3 text-center text-foreground">{r.outputCount}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/manufacturing/material-processing/${r.id}`} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></Link>
                      {r.status === "Draft" && (
                        <>
                          <Link href={`/manufacturing/material-processing/new?id=${r.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></Link>
                          <button onClick={() => setConfirm({ row: r, action: "initiate" })} title="Initiate Process" className="grid h-8 w-8 place-items-center rounded-md border border-success/30 text-success transition hover:bg-success hover:text-white"><Play className="h-4 w-4" /></button>
                        </>
                      )}
                      {r.status === "InProgress" && (
                        <Link href={`/manufacturing/material-processing/${r.id}`} title="Complete Process" className="grid h-8 w-8 place-items-center rounded-md border border-success/30 text-success transition hover:bg-success hover:text-white"><CheckCircle2 className="h-4 w-4" /></Link>
                      )}
                      {(r.status === "Draft" || r.status === "InProgress") && (
                        <button onClick={() => setConfirm({ row: r, action: "cancel" })} title="Cancel" className="grid h-8 w-8 place-items-center rounded-md border border-danger/30 text-danger transition hover:bg-danger hover:text-white"><Ban className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {loading && <tr><td colSpan={10} className="px-4 py-10"><AppLoader label="Loading Material Processing…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">
                  {notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : <>No Material Processing transactions yet. Click <Link href="/manufacturing/material-processing/new" className="font-semibold text-primary hover:underline">Add Material Processing</Link> to create one.</>}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => !busy && setConfirm(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4">
              <h3 className="text-base font-bold text-foreground">{confirm.action === "initiate" ? "Initiate Material Processing?" : "Cancel Material Processing?"}</h3>
              <div className="mt-2 space-y-1 rounded-lg border border-border bg-surface-2 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted">Raw Material</span><span className="font-semibold text-foreground">{confirm.row.rawMaterialName}</span></div>
                <div className="flex justify-between"><span className="text-muted">Processing Quantity</span><span className="font-semibold text-foreground">{confirm.row.inputQuantity} {confirm.row.inputUom}</span></div>
                <div className="flex justify-between"><span className="text-muted">Processing Area</span><span className="font-semibold text-foreground">{confirm.row.processingAreaName}</span></div>
                <div className="flex justify-between"><span className="text-muted">Outputs</span><span className="font-semibold text-foreground">{confirm.row.outputCount} products</span></div>
              </div>
              {confirm.action === "initiate" && <p className="mt-2 text-2xs text-subtle">Raw material stock will move from the source area into WIP. This cannot be undone by editing — cancel the transaction to reverse it.</p>}
              {confirm.action === "cancel" && <p className="mt-2 text-2xs text-subtle">{confirm.row.status === "InProgress" ? "Any raw material already moved to WIP will be returned to its source area." : "This draft has no stock impact yet."}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3">
              <Button variant="outline" size="md" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button>
              <Button size="md" variant={confirm.action === "cancel" ? "danger" : "primary"} disabled={busy} onClick={runAction}>{busy ? "Please wait…" : confirm.action === "initiate" ? "Initiate Process" : "Confirm Cancel"}</Button>
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

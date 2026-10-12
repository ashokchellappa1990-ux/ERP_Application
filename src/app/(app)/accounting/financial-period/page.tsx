"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, Settings2, Plus, X, Lock, CheckCircle2, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { financeNotesFor } from "@/lib/finance/financeData";
import { fin } from "@/lib/finance/financeConfig";
import type { FinancialPeriodRow, FinancialPeriodStatus } from "@/lib/contracts/accounting";

type Status = FinancialPeriodStatus;
type Period = FinancialPeriodRow;
const STATUS_TONE: Record<Status, "success" | "warning" | "info" | "neutral"> = { Open: "success", "Soft-Closed": "warning", Locked: "info", "Audit-Locked": "neutral" };
const NEXT: Record<Status, Status | null> = { Open: "Soft-Closed", "Soft-Closed": "Locked", Locked: "Audit-Locked", "Audit-Locked": null };
const ADVANCE_LABEL: Record<Status, string> = { Open: "Soft-Close", "Soft-Closed": "Lock", Locked: "Audit-Lock", "Audit-Locked": "" };

export default function FinancialPeriodPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | "new" | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", fy: "FY 26-27", type: "Monthly", from: "", to: "" });
  const notes = financeNotesFor("period");

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/accounting/financial-period", { cache: "no-store" }).then((r) => r.json());
      if (j.ok) setPeriods(j.rows);
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const valid = form.name.trim() && form.from && form.to && form.from <= form.to;

  async function addPeriod() {
    if (!valid) return;
    setBusy("new"); setError("");
    try {
      const j = await fetch("/api/accounting/financial-period", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, fy: form.fy, type: form.type, from: form.from, to: form.to }),
      }).then((r) => r.json());
      if (!j.ok) { setError(j.message || "Could not add the period."); return; }
      setForm({ name: "", fy: "FY 26-27", type: "Monthly", from: "", to: "" });
      setOpen(false);
      await load();
    } catch { setError("Network error — please try again."); } finally { setBusy(null); }
  }

  async function setStatus(id: number, status: Status) {
    setBusy(id); setError("");
    try {
      const j = await fetch(`/api/accounting/financial-period/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      }).then((r) => r.json());
      if (!j.ok) { setError(j.message || "Could not update the period."); return; }
      setPeriods((ps) => ps.map((p) => (p.id === id ? { ...p, status } : p)));
    } catch { setError("Network error — please try again."); } finally { setBusy(null); }
  }

  async function remove(id: number) {
    setBusy(id); setError("");
    try {
      const j = await fetch(`/api/accounting/financial-period/${id}`, { method: "DELETE" }).then((r) => r.json());
      if (!j.ok) { setError(j.message || "Could not delete the period."); return; }
      setPeriods((ps) => ps.filter((p) => p.id !== id));
    } catch { setError("Network error — please try again."); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/accounting/chart-of-accounts" className="hover:text-foreground">Accounting</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Financial Period</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><CalendarRange className="h-5 w-5 text-primary" /> Financial Period</h1>
          <p className="mt-0.5 text-sm text-muted">Open, close &amp; lock accounting periods. Locked periods reject new / backdated entries.</p>
        </div>
        <Button size="md" onClick={() => { setError(""); setOpen(true); }}><Plus className="h-4 w-4" /> Add Period</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">Current FY: {fin("fyStart")} → {fin("fyEnd")}</span>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-subtle px-4 py-2.5 text-sm font-medium text-danger"><AlertCircle className="h-4 w-4 shrink-0" /> {error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Period</th><th className="px-4 py-3">FY</th><th className="px-4 py-3 text-center">Type</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/30">
                <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                <td className="px-4 py-3 text-muted">{p.fy}</td>
                <td className="px-4 py-3 text-center"><span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-muted">{p.type}</span></td>
                <td className="px-4 py-3 text-muted">{p.fromDate}</td>
                <td className="px-4 py-3 text-muted">{p.toDate}</td>
                <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {NEXT[p.status] && <button disabled={busy === p.id} onClick={() => setStatus(p.id, NEXT[p.status] as Status)} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-muted transition hover:border-primary/40 hover:text-primary disabled:opacity-50"><Lock className="h-3 w-3" /> {ADVANCE_LABEL[p.status]}</button>}
                    {p.status !== "Open" && p.status !== "Audit-Locked" && <button disabled={busy === p.id} onClick={() => setStatus(p.id, "Open")} className="rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-muted transition hover:border-success/40 hover:text-success disabled:opacity-50">Reopen</button>}
                    {p.status === "Open" && <button disabled={busy === p.id} onClick={() => remove(p.id)} className="rounded-md border border-border bg-surface p-1.5 text-muted transition hover:border-danger/40 hover:text-danger disabled:opacity-50" title="Delete period"><Trash2 className="h-3 w-3" /></button>}
                  </div>
                </td>
              </tr>
            ))}
            {loading && periods.length === 0 && <tr><td colSpan={7} className="px-4 py-10"><AppLoader label="Loading periods…" size="sm" /></td></tr>}
            {!loading && periods.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">No financial periods yet. Click <strong>Add Period</strong> to create one.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center gap-2.5 border-b border-border bg-primary-subtle/40 px-5 py-3.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><CalendarRange className="h-4 w-4" /></span>
              <h3 className="flex-1 text-sm font-bold text-foreground">Add Financial Period</h3>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {error && <p className="rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{error}</p>}
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Period Name <span className="text-danger">*</span></label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jul 2026 / Q1 FY26-27" className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-2xs font-semibold text-muted">Financial Year</label><select value={form.fy} onChange={(e) => setForm({ ...form, fy: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:outline-none"><option>FY 26-27</option><option>FY 25-26</option></select></div>
                <div><label className="mb-1 block text-2xs font-semibold text-muted">Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:outline-none"><option>Monthly</option><option>Quarterly</option><option>Half-Yearly</option><option>Yearly</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-2xs font-semibold text-muted">From <span className="text-danger">*</span></label><input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
                <div><label className="mb-1 block text-2xs font-semibold text-muted">To <span className="text-danger">*</span></label><input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="ghost" size="md" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="md" onClick={addPeriod} disabled={!valid || busy === "new"}><CheckCircle2 className="h-4 w-4" /> {busy === "new" ? "Adding…" : "Add Period"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Search, Plus, Pencil, Power, Copy, Trash2, CalendarClock, CircleDot, Moon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { ShiftRow, ShiftListStats } from "@/lib/contracts/shift";

const EMPTY: ShiftListStats = { total: 0, active: 0, inactive: 0 };
const FILTERS = ["All", "active", "inactive"] as const;

export function ShiftList() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("All");
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [stats, setStats] = useState<ShiftListStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = new URLSearchParams();
      if (status !== "All") u.set("status", status);
      if (query.trim()) u.set("q", query.trim());
      const res = await fetch(`/api/pos/shifts?${u}`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403) { setNotAuthed(true); return; }
      const j = await res.json().catch(() => ({}));
      if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
    } finally { setLoading(false); }
  }, [query, status]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function toggle(s: ShiftRow) {
    const next = s.status === "active" ? "inactive" : "active";
    const j = await fetch(`/api/pos/shifts/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }).then((r) => r.json()).catch(() => ({}));
    if (toast.result(j, `Shift ${next === "active" ? "activated" : "deactivated"}.`, "Could not change status.")) load();
  }
  async function clone(s: ShiftRow) {
    const code = window.prompt(`New code for the clone of ${s.code}:`, `${s.code}-COPY`);
    if (!code) return;
    const j = await fetch(`/api/pos/shifts/${s.id}/clone`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).then((r) => r.json()).catch(() => ({}));
    if (toast.result(j, "Shift cloned (inactive).", "Could not clone the shift.")) load();
  }
  async function remove(s: ShiftRow) {
    if (!window.confirm(`Delete shift ${s.code}? This cannot be undone.`)) return;
    const j = await fetch(`/api/pos/shifts/${s.id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({}));
    if (toast.result(j, "Shift deleted.", "Could not delete the shift.")) load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>POS Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Shifts</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Clock className="h-5 w-5 text-primary" /> Shift Management</h1>
          <p className="mt-0.5 text-sm text-muted">Define reusable shift timings, cash rules and operational policies.</p>
        </div>
        <Link href="/pos/shifts/new"><Button size="md"><Plus className="h-4 w-4" /> Add Shift</Button></Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={CalendarClock} label="Total Shifts" value={String(stats.total)} tone="primary" />
        <Stat icon={CircleDot} label="Active" value={String(stats.active)} tone="success" />
        <Stat icon={Power} label="Inactive" value={String(stats.inactive)} tone="warning" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code or name…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
            {FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All statuses" : f === "active" ? "Active" : "Inactive"}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End</th><th className="px-4 py-3 text-center">Cross Day</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><Link href={`/pos/shifts/${s.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{s.code}</Link></td>
                  <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                  <td className="px-4 py-3 text-muted">{s.startTime}</td>
                  <td className="px-4 py-3 text-muted">{s.endTime}</td>
                  <td className="px-4 py-3 text-center">{s.crossDay ? <Badge tone="warning"><Moon className="h-3 w-3" /> Yes</Badge> : <span className="text-2xs text-subtle">—</span>}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/pos/shifts/${s.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Pencil className="h-4 w-4" /></Link>
                      <button onClick={() => toggle(s)} title={s.status === "active" ? "Deactivate" : "Activate"} className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-warning/40 hover:text-warning"><Power className="h-4 w-4" /></button>
                      <button onClick={() => clone(s)} title="Clone" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Copy className="h-4 w-4" /></button>
                      <button onClick={() => remove(s)} title="Delete" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-danger/40 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading shifts…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? "You don't have access to Shifts." : <>No shifts yet. Click <Link href="/pos/shifts/new" className="font-semibold text-primary hover:underline">Add Shift</Link>.</>}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TONES = { primary: "bg-primary text-white", success: "bg-success text-white", warning: "bg-warning text-white" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Clock; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Monitor, Search, Plus, Pencil, Power, Copy, Trash2, MonitorSmartphone, CircleDot, Radio } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { TerminalRow, TerminalListStats } from "@/lib/contracts/posTerminal";

const EMPTY: TerminalListStats = { total: 0, active: 0, inactive: 0, online: 0 };
const FILTERS = ["All", "active", "inactive"] as const;

export function TerminalList() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("All");
  const [rows, setRows] = useState<TerminalRow[]>([]);
  const [stats, setStats] = useState<TerminalListStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = new URLSearchParams();
      if (status !== "All") u.set("status", status);
      if (query.trim()) u.set("q", query.trim());
      const res = await fetch(`/api/pos/terminals?${u}`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403) { setNotAuthed(true); return; }
      const j = await res.json().catch(() => ({}));
      if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
    } finally { setLoading(false); }
  }, [query, status]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function toggle(t: TerminalRow) {
    const next = t.status === "active" ? "inactive" : "active";
    const j = await fetch(`/api/pos/terminals/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }).then((r) => r.json()).catch(() => ({}));
    if (toast.result(j, `Terminal ${next === "active" ? "activated" : "deactivated"}.`, "Could not change status.")) load();
  }
  async function clone(t: TerminalRow) {
    const code = window.prompt(`New code for the clone of ${t.code}:`, `${t.code}-COPY`);
    if (!code) return;
    const j = await fetch(`/api/pos/terminals/${t.id}/clone`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }).then((r) => r.json()).catch(() => ({}));
    if (toast.result(j, "Terminal cloned (inactive).", "Could not clone the terminal.")) load();
  }
  async function remove(t: TerminalRow) {
    if (!window.confirm(`Delete terminal ${t.code}? This cannot be undone.`)) return;
    const j = await fetch(`/api/pos/terminals/${t.id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({}));
    if (toast.result(j, "Terminal deleted.", "Could not delete the terminal.")) load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>POS Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Terminals</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Monitor className="h-5 w-5 text-primary" /> POS Terminals</h1>
          <p className="mt-0.5 text-sm text-muted">Register and configure every billing counter and mobile POS device.</p>
        </div>
        <Link href="/pos/terminals/new"><Button size="md"><Plus className="h-4 w-4" /> Add Terminal</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={MonitorSmartphone} label="Total Terminals" value={String(stats.total)} tone="primary" />
        <Stat icon={CircleDot} label="Active" value={String(stats.active)} tone="success" />
        <Stat icon={Power} label="Inactive" value={String(stats.inactive)} tone="warning" />
        <Stat icon={Radio} label="Online (open session)" value={String(stats.online)} tone="success" />
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
                <th className="px-4 py-3">Code</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Warehouse</th><th className="px-4 py-3 text-center">Session</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><Link href={`/pos/terminals/${t.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{t.code}</Link></td>
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-muted">{t.type}</td>
                  <td className="px-4 py-3 text-muted">{t.warehouse || "—"}</td>
                  <td className="px-4 py-3 text-center">{t.openSessionId ? <Badge tone="success">● {t.openSessionCashier || "Open"}</Badge> : <span className="text-2xs text-subtle">—</span>}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/pos/terminals/${t.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Pencil className="h-4 w-4" /></Link>
                      <button onClick={() => toggle(t)} title={t.status === "active" ? "Deactivate" : "Activate"} className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-warning/40 hover:text-warning"><Power className="h-4 w-4" /></button>
                      <button onClick={() => clone(t)} title="Clone" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Copy className="h-4 w-4" /></button>
                      <button onClick={() => remove(t)} title="Delete" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-danger/40 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading terminals…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? "You don't have access to POS Terminals." : <>No terminals yet. Click <Link href="/pos/terminals/new" className="font-semibold text-primary hover:underline">Add Terminal</Link>.</>}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TONES = { primary: "bg-primary text-white", success: "bg-success text-white", warning: "bg-warning text-white" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Monitor; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}

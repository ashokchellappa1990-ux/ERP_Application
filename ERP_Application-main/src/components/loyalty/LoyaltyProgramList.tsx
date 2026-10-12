"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Search, Plus, Pencil, FileStack, CheckCircle2, Coins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import type { LoyaltyProgramRow as Row } from "@/lib/contracts/loyalty";

const TONE: Record<string, "success" | "warning" | "neutral"> = { Active: "success", Draft: "warning", Inactive: "neutral" };
const FILTERS = ["All", "Draft", "Active", "Inactive"] as const;
const METHOD_LABEL: Record<string, string> = { fixed: "Fixed / invoice", amount: "Amount based", percentage: "Percentage" };

export function LoyaltyProgramList() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("All");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const u = new URLSearchParams();
        if (status !== "All") u.set("status", status);
        if (query.trim()) u.set("q", query.trim());
        const res = await fetch(`/api/loyalty/programs?${u}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 401 || res.status === 403) { setNotAuthed(true); return; }
        const j = await res.json().catch(() => ({}));
        if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Loyalty</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Loyalty Program</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Award className="h-5 w-5 text-primary" /> Loyalty Program Master</h1>
          <p className="mt-0.5 text-sm text-muted">Configure reward-point earn, redemption &amp; validity rules.</p>
        </div>
        <Link href="/loyalty/program/new"><Button size="md"><Plus className="h-4 w-4" /> New Program</Button></Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={FileStack} label="Total Programs" value={String(stats.total)} tone="primary" />
        <Stat icon={CheckCircle2} label="Active Programs" value={String(stats.active)} tone="success" />
        <Stat icon={Coins} label="Engine" value="Phase 1" tone="warning" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code or name…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
            {FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All statuses" : f}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Code</th><th className="px-4 py-3">Program</th><th className="px-4 py-3">Earn Method</th>
                <th className="px-4 py-3 text-center">Priority</th><th className="px-4 py-3">Effective</th><th className="px-4 py-3 text-center">Redeem</th>
                <th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><Link href={`/loyalty/program/${p.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{p.code}</Link></td>
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-muted">{METHOD_LABEL[p.calcMethod] ?? p.calcMethod}</td>
                  <td className="px-4 py-3 text-center text-muted">{p.priority}</td>
                  <td className="px-4 py-3 text-2xs text-muted">{p.effectiveFrom || "—"}{p.effectiveTo ? ` → ${p.effectiveTo}` : ""}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={p.redemptionEnabled ? "success" : "neutral"}>{p.redemptionEnabled ? "On" : "Off"}</Badge></td>
                  <td className="px-4 py-3 text-center"><Badge tone={TONE[p.status] ?? "neutral"}>{p.status}</Badge></td>
                  <td className="px-4 py-3"><div className="flex items-center justify-end"><Link href={`/loyalty/program/${p.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary"><Pencil className="h-4 w-4" /></Link></div></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8"><AppLoader label="Loading programs…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? "You don't have access to loyalty programs." : <>No programs yet. Click <Link href="/loyalty/program/new" className="font-semibold text-primary hover:underline">New Program</Link>.</>}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TONES = { primary: "bg-primary text-white", success: "bg-success text-white", warning: "bg-warning text-white" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof FileStack; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Plus, Radio, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { TerminalFilter } from "@/components/pos/TerminalFilter";
import { cn } from "@/lib/cn";
import type { SessionRow, SessionListStats } from "@/lib/contracts/terminalSession";

const EMPTY: SessionListStats = { open: 0, today: 0 };
const FILTERS = ["All", "Open", "Closed"] as const;

export function SessionList() {
  const fmt = useFmt();
  const money = (n: number | null) => (n == null ? "—" : fmt.money(n));
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("All");
  const [terminalId, setTerminalId] = useState("");
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [stats, setStats] = useState<SessionListStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = new URLSearchParams();
      if (status !== "All") u.set("status", status);
      if (terminalId) u.set("terminalId", terminalId);
      const res = await fetch(`/api/pos/sessions?${u}`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403) { setNotAuthed(true); return; }
      const j = await res.json().catch(() => ({}));
      if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
    } finally { setLoading(false); }
  }, [status, terminalId]);
  useEffect(() => { const t = setTimeout(load, 150); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>POS Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Terminal Sessions</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wallet className="h-5 w-5 text-primary" /> Terminal Sessions</h1>
          <p className="mt-0.5 text-sm text-muted">Cashier login sessions with opening / closing cash reconciliation.</p>
        </div>
        <Link href="/pos/sessions/new"><Button size="md"><Plus className="h-4 w-4" /> Open Session</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={Radio} label="Open Now" value={String(stats.open)} tone="success" />
        <Stat icon={ClipboardList} label="Today" value={String(stats.today)} tone="primary" />
        <Stat icon={Wallet} label="Total Shown" value={String(rows.length)} tone="primary" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-end gap-2 border-b border-border p-4">
          <TerminalFilter value={terminalId} onChange={setTerminalId} />
          <select value={status} onChange={(e) => setStatus(e.target.value as (typeof FILTERS)[number])} className="h-9 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:shadow-focus">
            {FILTERS.map((f) => <option key={f} value={f}>{f === "All" ? "All sessions" : f}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Session</th><th className="px-4 py-3">Terminal</th><th className="px-4 py-3">Cashier</th><th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3 text-right">Opening</th><th className="px-4 py-3 text-right">Closing</th><th className="px-4 py-3 text-right">Diff</th><th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><Link href={`/pos/sessions/${s.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{s.sessionNo}</Link></td>
                  <td className="px-4 py-3 text-muted">{s.terminalCode || "—"}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{s.cashierName || `#${s.cashierUserId}`}</td>
                  <td className="px-4 py-3 text-muted">{s.shiftName || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{money(s.openingCash)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{money(s.closingCash)}</td>
                  <td className={cn("px-4 py-3 text-right tabular-nums font-semibold", s.cashDifference == null ? "text-subtle" : s.cashDifference === 0 ? "text-success" : "text-danger")}>{money(s.cashDifference)}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={s.status === "Open" ? "success" : "neutral"}>{s.status}</Badge></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8"><AppLoader label="Loading sessions…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? "You don't have access to Terminal Sessions." : <>No sessions yet. Click <Link href="/pos/sessions/new" className="font-semibold text-primary hover:underline">Open Session</Link>.</>}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TONES = { primary: "bg-primary text-white", success: "bg-success text-white" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Wallet; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}

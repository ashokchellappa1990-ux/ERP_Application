"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Target, Plus, Search, Settings2, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { isEditable } from "@/lib/contracts/salesTarget";
import { fetchJson, useOptions, StatusBadge, useValueFmt } from "./shared";

interface Row { id: number; targetNo: string; fy: string; title: string | null; dimension: string; targetType: string; period: string; distribution: string; totalTarget: number; status: string; approvalStatus: string; lineCount: number }

export function TargetList() {
  const opt = useOptions();
  const vfmt = useValueFmt();
  const [fy, setFy] = useState("");
  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = () => { setRows(null); const p = new URLSearchParams(); if (fy) p.set("fy", fy); if (status !== "All") p.set("status", status); if (q) p.set("q", q); fetchJson<{ ok: boolean; rows: Row[] }>(`/api/sales/target?${p}`).then((j) => setRows(j.ok ? j.rows : [])); };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [fy, status, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white"><Target className="h-6 w-6" /></span>
          <div><h1 className="text-lg font-bold text-foreground">Target Planning</h1><p className="text-xs text-muted">Multi-dimensional sales targets — plan, distribute, submit for approval.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/sales/target/config"><Button size="sm" variant="outline"><Settings2 className="h-3.5 w-3.5" /> Configure</Button></Link>
          <Link href="/sales/target/new"><Button size="sm"><Plus className="h-3.5 w-3.5" /> New Target</Button></Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="relative"><Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search target no / title" className="h-8 w-56 rounded-md border border-border-strong bg-surface pl-8 pr-2 text-sm focus:border-primary focus:outline-none" /></div>
        <select value={fy} onChange={(e) => setFy(e.target.value)} className={inp}><option value="">All FYs</option>{opt?.fyList.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>{["All", "Draft", "Submitted", "Approved", "Rejected", "Returned", "Locked", "Completed", "Cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {!rows ? <div className="p-10"><AppLoader label="Loading targets…" /></div> : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">No targets yet. Click <span className="font-semibold text-foreground">New Target</span> to plan one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2/50 text-left text-2xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Target No</th><th className="px-3 py-2">FY</th><th className="px-3 py-2">Dimension</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Period</th><th className="px-3 py-2 text-right">Target</th><th className="px-3 py-2 text-center">Lines</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Approval</th><th className="px-3 py-2 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/30">
                    <td className="px-3 py-2 font-semibold text-foreground">{t.targetNo}{t.title && <div className="text-2xs font-normal text-muted">{t.title}</div>}</td>
                    <td className="px-3 py-2 text-muted">{t.fy}</td>
                    <td className="px-3 py-2 capitalize">{t.dimension}</td>
                    <td className="px-3 py-2">{opt?.targetTypes.find((x) => x.key === t.targetType)?.label ?? t.targetType}</td>
                    <td className="px-3 py-2 capitalize text-muted">{t.period}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{vfmt(t.totalTarget, t.targetType)}</td>
                    <td className="px-3 py-2 text-center text-muted">{t.lineCount}</td>
                    <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                    <td className="px-3 py-2"><StatusBadge status={t.approvalStatus} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/sales/target/${t.id}`} title="View" className="rounded p-1 hover:bg-surface-2"><Eye className="h-4 w-4 text-muted" /></Link>
                        {isEditable(t.status) && <Link href={`/sales/target/${t.id}/edit`} title="Edit" className="rounded p-1 hover:bg-surface-2"><Pencil className="h-4 w-4 text-primary" /></Link>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
const inp = "h-8 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none";

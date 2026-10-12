"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NotebookPen, Search, ChevronDown, Plus } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";
import type { JournalRow as Voucher } from "@/lib/contracts/finance";

const inr = (x: number) => formatMoney(x || 0);
const TYPE_TONE: Record<string, "primary" | "success" | "warning" | "info" | "neutral"> = { PURCHASE: "warning", SALES: "success", JOURNAL: "info", PAYMENT: "primary", RECEIPT: "primary" };

export function JournalView() {
  const [rows, setRows] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [open, setOpen] = useState<Record<number, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const u = new URLSearchParams(); if (type !== "All") u.set("type", type); if (query.trim()) u.set("q", query.trim());
      const j = await fetch(`/api/finance/journal?${u}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) setRows(j.rows);
    } catch { /* */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query]);

  const totalPosted = useMemo(() => rows.filter((r) => r.status === "Posted").reduce((s, r) => s + r.totalDebit, 0), [rows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Finance</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Journal</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><NotebookPen className="h-5 w-5 text-primary" /> Journal Vouchers</h1>
          <p className="mt-0.5 text-sm text-muted">Posted purchases &amp; sales write balanced vouchers here automatically — and you can post a manual voucher too.</p>
        </div>
        <Link href="/finance/journal/new"><Button size="md"><Plus className="h-4 w-4" /> New Journal Voucher</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Vouchers" value={String(rows.length)} />
        <Kpi label="Posted value" value={inr(totalPosted)} />
        <Kpi label="Sales / Purchase" value={`${rows.filter((r) => r.voucherType === "SALES").length} / ${rows.filter((r) => r.voucherType === "PURCHASE").length}`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search voucher, ref or narration…" className="h-10 w-full rounded-xl border border-border-strong bg-card pl-10 pr-3 text-sm focus:border-primary focus:outline-none" />
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-border text-xs">
          {["All", "PURCHASE", "SALES", "JOURNAL"].map((t) => (
            <button key={t} onClick={() => setType(t)} className={cn("px-3 py-2 font-semibold transition", type === t ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2")}>{t === "All" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}</button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Voucher</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Narration</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows.map((v) => (
                <FragmentRow key={v.id}>
                  <tr className={cn("cursor-pointer border-b border-border transition hover:bg-primary-subtle/10", v.status === "Reversed" && "opacity-60")} onClick={() => setOpen((o) => ({ ...o, [v.id]: !o[v.id] }))}>
                    <td className="px-4 py-2.5"><span className="font-mono text-xs font-semibold text-primary">{v.voucherNo}</span>{v.refNo && <span className="ml-1.5 text-2xs text-subtle">· {v.refNo}</span>}</td>
                    <td className="px-4 py-2.5 text-muted">{v.date}</td>
                    <td className="px-4 py-2.5"><Badge tone={TYPE_TONE[v.voucherType] ?? "neutral"}>{v.voucherType}</Badge>{v.status === "Reversed" && <Badge tone="danger" className="ml-1">Reversed</Badge>}</td>
                    <td className="px-4 py-2.5 max-w-[280px] truncate text-foreground">{v.narration}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{inr(v.totalDebit)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{inr(v.totalCredit)}</td>
                    <td className="px-4 py-2.5 text-right"><ChevronDown className={cn("inline h-4 w-4 text-subtle transition", open[v.id] && "rotate-180")} /></td>
                  </tr>
                  {open[v.id] && (
                    <tr className="border-b border-border bg-surface-2/40"><td colSpan={7} className="px-4 py-3">
                      <table className="w-full text-xs">
                        <thead><tr className="text-left text-2xs uppercase tracking-wider text-subtle"><th className="py-1">Account</th><th className="py-1">Narration</th><th className="py-1 text-right">Debit</th><th className="py-1 text-right">Credit</th></tr></thead>
                        <tbody>
                          {v.lines.map((l, i) => (
                            <tr key={i} className="border-t border-border/60">
                              <td className="py-1.5"><span className="font-mono text-2xs text-subtle">{l.code}</span> <span className="font-medium text-foreground">{l.account}</span></td>
                              <td className="py-1.5 text-muted">{l.narration}</td>
                              <td className="py-1.5 text-right tabular-nums text-foreground">{l.debit ? inr(l.debit) : ""}</td>
                              <td className="py-1.5 text-right tabular-nums text-foreground">{l.credit ? inr(l.credit) : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td></tr>
                  )}
                </FragmentRow>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10"><AppLoader label="Loading vouchers…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No vouchers yet. Post a GRN / POS sale to auto-generate entries, or <Link href="/finance/journal/new" className="font-semibold text-primary hover:underline">post a manual journal voucher →</Link></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><p className="text-lg font-bold tabular-nums text-foreground">{value}</p><p className="mt-0.5 text-2xs font-medium text-muted">{label}</p></div>;
}
function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }

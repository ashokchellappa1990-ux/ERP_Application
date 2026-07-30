"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ReceiptText, Search, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { TerminalFilter } from "@/components/pos/TerminalFilter";
import { cn } from "@/lib/cn";
// Shared API contract — one source of truth for the B2B invoice list shapes.
import type { B2bInvoiceRow as Row, B2bInvoiceListStats as Stats } from "@/lib/contracts/sale";

const PAY_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { Paid: "success", Partial: "warning", Credit: "danger" };

export function B2bInvoiceList() {
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [terminalId, setTerminalId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const u = new URLSearchParams(); if (status !== "All") u.set("status", status); if (query.trim()) u.set("q", query.trim()); if (terminalId) u.set("terminalId", terminalId);
      const j = await fetch(`/api/sales/invoice?${u}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) { setRows(j.rows); setStats(j.stats); }
    } catch { /* */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status, terminalId]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query]);

  const filtered = useMemo(() => rows, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Sales</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Sales Invoice (B2B)</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ReceiptText className="h-5 w-5 text-primary" /> Sales Invoice (B2B)</h1>
          <p className="mt-0.5 text-sm text-muted">GST tax invoices for registered business customers.</p>
        </div>
        <Link href="/sales/invoice/new"><Button size="md"><Plus className="h-4 w-4" /> New Invoice</Button></Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Invoices" value={String(stats.invoices)} tone="primary" />
          <Kpi label="This month" value={inr(stats.mtdValue)} tone="success" />
          <Kpi label="Outstanding" value={inr(stats.outstanding)} tone="danger" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoice, customer or GSTIN…" className="h-10 w-full rounded-xl border border-border-strong bg-card pl-10 pr-3 text-sm focus:border-primary focus:outline-none" />
        </div>
        <TerminalFilter value={terminalId} onChange={setTerminalId} />
        <div className="inline-flex overflow-hidden rounded-lg border border-border text-xs">
          {["All", "Paid", "Partial", "Credit"].map((t) => (
            <button key={t} onClick={() => setStatus(t)} className={cn("px-3 py-2 font-semibold transition", status === t ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2")}>{t}</button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Invoice No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">GSTIN</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3 text-center">Payment</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/10">
                  <td className="px-4 py-2.5"><Link href={`/sales/invoice/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.invoiceNo}</Link></td>
                  <td className="px-4 py-2.5 text-muted">{r.saleDate}{r.dueDate && <div className="text-2xs text-subtle">due {r.dueDate}</div>}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.customerName || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-2xs text-muted">{r.customerGstin || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{inr(r.total)}</td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={PAY_TONE[r.paymentStatus] ?? "neutral"}>{r.paymentStatus}</Badge></td>
                  <td className="px-4 py-2.5 text-right"><Link href={`/sales/invoice/${r.id}`} className="inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline"><Eye className="h-3.5 w-3.5" /> View</Link></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10"><AppLoader label="Loading invoices…" size="sm" /></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">No B2B invoices yet. Click <strong>New Invoice</strong> to create one.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "primary" | "success" | "danger" }) {
  const tones = { primary: "text-primary", success: "text-success", danger: "text-danger" };
  return <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><p className={cn("text-lg font-bold tabular-nums", tones[tone])}>{value}</p><p className="mt-0.5 text-2xs font-medium text-muted">{label}</p></div>;
}

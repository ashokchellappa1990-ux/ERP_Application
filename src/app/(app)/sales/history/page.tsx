"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReceiptText, Search, Eye, Printer, X, ShoppingCart, IndianRupee, FileStack } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { formatMoneyWith, formatQtyWith } from "@/lib/settings/generalConfig";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";
import { buildReceiptHtml } from "@/components/sales/PosBilling";
import { TerminalFilter } from "@/components/pos/TerminalFilter";
import { cn } from "@/lib/cn";
// Shared API contract — one source of truth for the sales list shapes.
import type { SaleRow as Row, SaleListStats as Stats } from "@/lib/contracts/sale";

const TONE: Record<string, "success" | "warning" | "danger" | "info"> = { Paid: "success", Partial: "warning", Credit: "danger" };

export default function SalesHistoryPage() {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>({ todaySales: 0, todayBills: 0 });
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const cfg = useGeneralConfig();
  const [view, setView] = useState<{ business: Record<string, string>; template: Record<string, unknown>; sale: Record<string, unknown> } | null>(null);
  const fm = (n: number) => formatMoneyWith(cfg, n);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, from, to });
        if (terminalId) params.set("terminalId", terminalId);
        const res = await fetch(`/api/sales?${params}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 401) { setNotAuthed(true); return; }
        const j = await res.json().catch(() => ({}));
        if (j.ok) { setNotAuthed(false); setRows(j.rows); setStats(j.stats); }
      } catch { /**/ } finally { setLoading(false); }
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, from, to, terminalId]);

  async function open(id: number) {
    const j = await fetch(`/api/sales/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setView({ business: j.business, template: j.template, sale: j.sale });
  }
  function reprint() { if (!view) return; const w = window.open("", "_blank", "width=420,height=680"); if (!w) return; w.document.write(buildReceiptHtml(view.business, view.template, view.sale)); w.document.close(); }

  const s = view?.sale as Record<string, unknown> | undefined;
  const N = (v: unknown) => Number(v) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Sales</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Sales History</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ReceiptText className="h-5 w-5 text-primary" /> Sales History</h1>
          <p className="mt-0.5 text-sm text-muted">All POS bills — view details and reprint the receipt.</p>
        </div>
        <Link href="/sales/pos"><Button size="md"><ShoppingCart className="h-4 w-4" /> New Sale</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={IndianRupee} label="Today's Sales" value={fm(stats.todaySales)} tone="success" />
        <Stat icon={FileStack} label="Today's Bills" value={String(stats.todayBills)} tone="primary" />
        <Stat icon={ReceiptText} label="Recent (shown)" value={String(rows.length)} tone="info" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search bill no / customer / phone…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <TerminalFilter value={terminalId} onChange={setTerminalId} />
            <span className="font-medium text-muted">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none" />
            <span className="font-medium text-muted">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none" />
            {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="rounded-md border border-border bg-surface px-2 py-1.5 font-semibold text-muted hover:border-primary hover:text-primary">Clear</button>}
            <button onClick={() => { const d = new Date().toISOString().slice(0, 10); setFrom(d); setTo(d); }} className="rounded-md border border-border bg-surface px-2 py-1.5 font-semibold text-muted hover:border-primary hover:text-primary">Today</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Bill No</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-center">Items</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-center">Payment</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                  <td className="px-4 py-3 font-mono font-semibold text-foreground">{r.invoiceNo}</td>
                  <td className="px-4 py-3 text-muted">{r.saleDate}</td>
                  <td className="px-4 py-3"><div className="text-foreground">{r.customerName}</div><div className="text-2xs text-subtle">{r.customerPhone}</div></td>
                  <td className="px-4 py-3 text-center text-muted">{r.itemCount}</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">{fm(r.total)}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={TONE[r.paymentStatus] ?? "neutral"}>{r.paymentMode || r.paymentStatus}</Badge></td>
                  <td className="px-4 py-3"><div className="flex items-center justify-end gap-1.5"><button onClick={() => open(r.id)} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-muted hover:border-primary hover:text-primary"><Eye className="h-3.5 w-3.5" /> View</button></div></td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8"><AppLoader label="Loading sales…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : <>No sales yet. <Link href="/sales/pos" className="font-semibold text-primary hover:underline">Start billing</Link>.</>}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill detail */}
      {view && s && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => setView(null)}>
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5"><div><h2 className="text-sm font-bold text-foreground">{String(s.invoiceNo)}</h2><p className="text-2xs text-muted">{String(view.business.name)} · {String(s.saleDate)}</p></div><button onClick={() => setView(null)} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button></div>
            <div className="overflow-y-auto p-5">
              <div className="mb-2 text-xs text-muted">Customer: <span className="font-medium text-foreground">{String(s.customerName)}</span>{s.customerPhone ? ` (${String(s.customerPhone)})` : ""}</div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-2xs font-semibold uppercase text-subtle"><th className="py-1.5">Item</th><th className="py-1.5 text-center">Qty</th><th className="py-1.5 text-right">Rate</th><th className="py-1.5 text-right">Amount</th></tr></thead>
                <tbody>
                  {((s.lines as Array<Record<string, unknown>>) ?? []).map((l, i) => (
                    <tr key={i} className="border-b border-border last:border-0"><td className="py-1.5 text-foreground">{String(l.productName)}</td><td className="py-1.5 text-center">{formatQtyWith(cfg, N(l.qty))}</td><td className="py-1.5 text-right text-muted">{fm(N(l.rate))}</td><td className="py-1.5 text-right font-medium">{fm(N(l.value))}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 space-y-1 text-sm">
                <Kv k="Taxable" v={fm(N(s.taxableValue))} /><Kv k="CGST" v={fm(N(s.cgst))} /><Kv k="SGST" v={fm(N(s.sgst))} />
                {!!N(s.billDiscount) && <Kv k="Bill Discount" v={`- ${fm(N(s.billDiscount))}`} />}
                {!!N(s.roundOff) && <Kv k="Round Off" v={fm(N(s.roundOff))} />}
                <div className="flex items-center justify-between text-base font-bold text-foreground"><span>Total</span><span>{fm(N(s.total))}</span></div>
                {((s.payments as Array<Record<string, unknown>>) ?? []).map((p, i) => <Kv key={i} k={String(p.mode)} v={fm(N(p.amount))} />)}
                {!!N(s.changeDue) && <Kv k="Change" v={fm(N(s.changeDue))} />}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="md" onClick={() => setView(null)}>Close</Button><Button size="md" onClick={reprint}><Printer className="h-4 w-4" /> Reprint Bill</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) { return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="font-medium text-foreground">{v}</span></div>; }
const TONES = { success: "bg-success text-white", primary: "bg-primary text-white", info: "bg-info text-white" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof ReceiptText; label: string; value: string; tone: keyof typeof TONES }) {
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div><p className="mt-2 text-xs font-medium text-muted">{label}</p></div>;
}

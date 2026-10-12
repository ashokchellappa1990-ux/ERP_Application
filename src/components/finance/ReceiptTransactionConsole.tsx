"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptText, Plus, Eye, X, Search, SlidersHorizontal, Paperclip, Printer, CheckCircle2, Send, Ban, RotateCcw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type { ReceiptRow, ReceiptDetail, ReceiptMeta, ReceiptStatus } from "@/lib/contracts/receipt";

const API = "/api/finance/receipts";
const today = () => new Date().toISOString().slice(0, 10);
const STATUSES: (ReceiptStatus | "All")[] = ["All", "Draft", "Submitted", "Approved", "Posted", "Cancelled"];
const statusTone = (s: string) => s === "Posted" ? "success" : s === "Cancelled" ? "danger" : s === "Approved" ? "info" : s === "Submitted" ? "warning" : "neutral";

export function ReceiptTransactionConsole() {
  const toast = useToast();
  const router = useRouter();
  const fmt = useFmt();
  const inr = (n: number) => fmt.money(n || 0);
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [meta, setMeta] = useState<ReceiptMeta | null>(null);
  const [status, setStatus] = useState<ReceiptStatus | "All">("All");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [view, setView] = useState<ReceiptDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status, q });
    const j = await fetch(`${API}?${params}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) { setRows(j.rows); setMeta(j.meta); }
    setLoading(false);
  }, [status, q]);
  useEffect(() => { load(); }, [load]);

  const openView = async (id: number) => { const j = await fetch(`${API}/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setView(j.data); else toast.error("Could not load receipt."); };

  const kpis = useMemo(() => {
    const tm = today().slice(0, 7);
    const posted = rows.filter((r) => r.status === "Posted");
    return {
      todayAmt: posted.filter((r) => r.voucherDate === today()).reduce((s, r) => s + r.amount, 0),
      monthAmt: posted.filter((r) => r.voucherDate.startsWith(tm)).reduce((s, r) => s + r.amount, 0),
      pending: rows.filter((r) => r.status === "Submitted").length,
      drafts: rows.filter((r) => r.status === "Draft").length,
    };
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const paged = rows.slice((current - 1) * pageSize, current * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/finance" className="hover:text-foreground">Finance</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">Income Receipt Transaction</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ReceiptText className="h-5 w-5 text-primary" /> Income Receipt Transaction</h1>
          <p className="mt-0.5 text-sm text-muted">Record miscellaneous (non-sales) receipts with automatic GL posting &amp; approval workflow.</p>
        </div>
        <Link href="/finance/receipt/new"><Button size="md" disabled={meta ? !meta.config.enableModule : false}><Plus className="h-4 w-4" /> New Receipt</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Today's Receipts" value={inr(kpis.todayAmt)} tone="success" />
        <Kpi label="This Month (posted)" value={inr(kpis.monthAmt)} tone="primary" />
        <Kpi label="Pending Approval" value={String(kpis.pending)} tone="warning" />
        <Kpi label="Drafts" value={String(kpis.drafts)} tone="info" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUSES.map((s) => <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", status === s ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground")}>{s}</button>)}
            <button className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted hover:border-primary/40 hover:text-primary"><SlidersHorizontal className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Voucher No</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-center">Mode</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Party</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3">By</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">Loading…</td></tr>
                : paged.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">No receipts match your search.</td></tr>
                : paged.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                    <td className="px-4 py-3 font-medium text-foreground">{r.voucherNo}</td>
                    <td className="px-4 py-3 text-muted">{r.voucherDate}</td>
                    <td className="px-4 py-3 text-foreground">{r.categoryName}</td>
                    <td className="px-4 py-3 text-center"><span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-muted">{r.mode}</span></td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{inr(r.amount)}</td>
                    <td className="px-4 py-3 text-muted">{r.partyName || "—"}</td>
                    <td className="px-4 py-3 text-center"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                    <td className="px-4 py-3 text-muted">{r.createdByName || "—"}</td>
                    <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
                      <button onClick={() => openView(r.id)} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></button>
                      {r.status === "Draft" && <Link href={`/finance/receipt/${r.id}/edit`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></Link>}
                    </div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <Pagination page={current} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="receipts" />
      </div>

      {view && meta && <ReceiptView d={view} cfg={meta.config} inr={inr} onClose={() => setView(null)} onChanged={() => { openView(view.id); load(); }} onEdit={() => router.push(`/finance/receipt/${view.id}/edit`)} />}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  const c: Record<string, string> = { success: "text-success", primary: "text-primary", info: "text-info", warning: "text-warning" };
  return <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><p className="text-xs font-medium text-muted">{label}</p><p className={cn("mt-1 text-lg font-bold tracking-tight", c[tone] || "text-foreground")}>{value}</p></div>;
}

// ------------------------------------------------------------------------ view

function ReceiptView({ d, cfg, inr, onClose, onChanged, onEdit }: { d: ReceiptDetail; cfg: ReceiptMeta["config"]; inr: (n: number) => string; onClose: () => void; onChanged: () => void; onEdit: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const act = async (action: string) => {
    if ((action === "cancel" || action === "reverse") && !window.confirm(`${action === "reverse" ? "Reverse" : "Cancel"} this receipt?`)) return;
    setBusy(true);
    const j = await fetch(`${API}/${d.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).then((r) => r.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (toast.result(j)) onChanged();
  };
  function print() {
    const w = window.open("", "_blank", "width=720,height=820"); if (!w) return;
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.voucherNo)}</title><style>body{font-family:Arial;margin:28px;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border:1px solid #ccc;padding:6px 8px;font-size:13px;text-align:left}.r{text-align:right}</style></head><body><h1>Receipt Voucher — ${esc(d.voucherNo)}</h1><p>Date: ${esc(d.voucherDate)} &nbsp; Status: ${esc(d.status)}</p><table><tr><th>Category</th><td>${esc(d.categoryName)}</td><th>Mode</th><td>${esc(d.mode)}</td></tr><tr><th>Party</th><td>${esc(d.partyName || "-")}</td><th>Amount</th><td class="r">${esc(inr(d.amount))}</td></tr><tr><th>Debit</th><td>${esc(d.debitName)}</td><th>Credit</th><td>${esc(d.creditName)}</td></tr><tr><th>Reference</th><td>${esc(d.referenceNo || "-")}</td><th>Narration</th><td>${esc(d.narration || "-")}</td></tr></table><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  const next: { a: string; label: string; icon: typeof Send; variant?: "outline" }[] = [];
  if (d.status === "Draft") { if (cfg.enableApproval) next.push({ a: "submit", label: "Submit", icon: Send }); else next.push({ a: "post", label: "Post", icon: CheckCircle2 }); next.push({ a: "cancel", label: "Cancel", icon: Ban, variant: "outline" }); }
  else if (d.status === "Submitted") { next.push({ a: "approve", label: "Approve", icon: CheckCircle2 }); next.push({ a: "cancel", label: "Cancel", icon: Ban, variant: "outline" }); }
  else if (d.status === "Approved") { next.push({ a: "post", label: "Post", icon: CheckCircle2 }); next.push({ a: "cancel", label: "Cancel", icon: Ban, variant: "outline" }); }
  else if (d.status === "Posted") { next.push({ a: "reverse", label: "Reverse", icon: RotateCcw, variant: "outline" }); }

  const KV = ({ k, v }: { k: string; v: string }) => v ? <div className="flex justify-between gap-3 py-1 text-sm"><span className="text-muted">{k}</span><span className="text-right font-medium text-foreground">{v}</span></div> : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><ReceiptText className="h-4 w-4 text-primary" /> {d.voucherNo} <Badge tone={statusTone(d.status)}>{d.status}</Badge></h2><button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-border bg-surface-2/30 px-3 py-2">
            <KV k="Date" v={d.voucherDate} /><KV k="Category" v={d.categoryName} /><KV k="Mode" v={d.mode} />
            <KV k="Bank" v={d.bankName} /><KV k="Party" v={[d.partyType, d.partyName].filter(Boolean).join(": ")} /><KV k="Party GSTIN" v={d.partyGstin} />
            <KV k="Reference" v={[d.referenceNo, d.referenceDate].filter(Boolean).join(" · ")} /><KV k="Narration" v={d.narration} />
            <KV k="Cost Center" v={d.costCenter} /><KV k="Department" v={d.department} /><KV k="Project" v={d.project} />
            <KV k="Taxable" v={inr(d.taxableAmount)} />{d.cgstAmount > 0 && <KV k="CGST" v={inr(d.cgstAmount)} />}{d.sgstAmount > 0 && <KV k="SGST" v={inr(d.sgstAmount)} />}{d.tdsAmount > 0 && <KV k="TDS (receivable)" v={inr(d.tdsAmount)} />}{d.tcsAmount > 0 && <KV k="TCS (payable)" v={inr(d.tcsAmount)} />}<KV k="Net Received" v={inr(d.amount)} /><KV k="Created By" v={d.createdByName} />
          </div>
          {d.heads.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-subtle"><span className="h-3 w-1 rounded-full bg-primary" /> Sub-Head Details</p>
              <div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-left text-sm"><thead className="bg-surface-2/60 text-2xs uppercase text-subtle"><tr><th className="px-3 py-1.5">Head</th><th className="px-3 py-1.5 text-right">Taxable</th><th className="px-3 py-1.5 text-right">Tax</th><th className="px-3 py-1.5 text-right">Net</th></tr></thead><tbody className="divide-y divide-border">{d.heads.map((h, i) => {
                const tax = h.taxType === "GST" ? `CGST ${inr(h.cgst)} / SGST ${inr(h.sgst)}` : h.taxType === "TDS" ? `TDS -${inr(h.tdsAmount)}` : h.taxType === "TCS" ? `TCS +${inr(h.tcsAmount)}` : "";
                return <tr key={i}><td className="px-3 py-1.5">{h.headName}{h.taxType !== "None" && h.gstRate ? <span className="text-2xs text-subtle"> · {h.taxType} @{h.gstRate}%</span> : ""}</td><td className="px-3 py-1.5 text-right tabular-nums">{inr(h.taxable)}</td><td className="px-3 py-1.5 text-right text-2xs tabular-nums text-muted">{tax}</td><td className="px-3 py-1.5 text-right tabular-nums font-semibold">{inr(h.amount)}</td></tr>;
              })}</tbody></table></div>
            </div>
          )}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-subtle"><span className="h-3 w-1 rounded-full bg-primary" /> Account Posting {d.voucherJournalNo ? `· ${d.voucherJournalNo}` : "(posts on Post)"}</p>
            {d.journal.length ? (
              <div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-left text-sm"><thead className="bg-surface-2/60 text-2xs uppercase text-subtle"><tr><th className="px-3 py-1.5">Account</th><th className="px-3 py-1.5 text-right">Debit</th><th className="px-3 py-1.5 text-right">Credit</th></tr></thead><tbody className="divide-y divide-border">{d.journal.map((l, i) => <tr key={i}><td className="px-3 py-1.5"><span className="font-mono text-2xs text-subtle">{l.code}</span> {l.account}</td><td className="px-3 py-1.5 text-right tabular-nums">{l.debit ? inr(l.debit) : ""}</td><td className="px-3 py-1.5 text-right tabular-nums">{l.credit ? inr(l.credit) : ""}</td></tr>)}</tbody></table></div>
            ) : <p className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-2.5 text-center text-xs text-muted">Dr {d.debitName} / Cr {d.creditName} — posts when the receipt is Posted.</p>}
          </div>
          {d.attachments.length > 0 && <div><p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">Attachments</p><div className="space-y-1">{d.attachments.map((a) => <a key={a.id} href={a.fileUrl} download={a.fileName} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-primary hover:bg-primary-subtle"><Paperclip className="h-3.5 w-3.5" /> {a.fileName}</a>)}</div></div>}
          <div>
            <p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">Audit Trail</p>
            <div className="space-y-1">{d.audit.map((a) => <div key={a.id} className="flex items-center justify-between gap-2 text-2xs"><span><Badge tone="neutral">{a.action}</Badge> <span className="text-muted">{a.byName}</span></span><span className="text-subtle">{a.at ? new Date(a.at).toLocaleString() : ""}</span></div>)}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          {d.status === "Draft" && <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
          {d.status === "Posted" && <Button size="sm" variant="outline" onClick={print}><Printer className="h-3.5 w-3.5" /> Print</Button>}
          {next.map((n) => { const Icon = n.icon; return <Button key={n.a} size="sm" variant={n.variant} disabled={busy} onClick={() => act(n.a)}><Icon className="h-3.5 w-3.5" /> {n.label}</Button>; })}
        </div>
      </div>
    </div>
  );
}

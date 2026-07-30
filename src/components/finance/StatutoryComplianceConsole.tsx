"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, LayoutDashboard, Landmark, ReceiptText, GitCompare, FileCheck2, FileBarChart, TrendingUp, Plus, Eye, CheckCircle2, XCircle, BadgeCheck, Send, Wallet, CircleAlert, CalendarClock, ListTree, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";
import { StatutoryPaymentModal } from "./StatutoryPaymentModal";
import type { StatutoryPaymentRow, StatutoryReturnRow } from "@/lib/contracts/statutory";
import type { StatLiabilityDetail } from "@/lib/finance/statutory/engine";

const API = "/api/finance/statutory";
const inr = (x: number) => formatMoney(x || 0);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "gst", label: "GST", icon: ShieldCheck },
  { id: "tds", label: "TDS", icon: ShieldCheck },
  { id: "tcs", label: "TCS", icon: ShieldCheck },
  { id: "payments", label: "Government Payment", icon: Landmark },
  { id: "challans", label: "Challan Management", icon: ReceiptText },
  { id: "reconciliation", label: "Reconciliation", icon: GitCompare },
  { id: "returns", label: "Return Filing", icon: FileCheck2 },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
] as const;
type TabId = (typeof TABS)[number]["id"];

const statusTone = (s: string): "success" | "warning" | "info" | "neutral" | "danger" =>
  s === "Paid" || s === "Filed" || s === "Matched" || s === "Verified" ? "success" : s === "Approved" || s === "Prepared" ? "info" : s === "Submitted" ? "warning" : s === "Cancelled" || s === "Difference" ? "danger" : "neutral";

export function StatutoryComplianceConsole() {
  const toast = useToast();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [period, setPeriod] = useState(thisMonth());
  const [modal, setModal] = useState<{ type?: string } | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [types, setTypes] = useState<{ code: string; label: string }[]>([]);
  const [cache, setCache] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);

  const key = (t: string) => `${t}:${period}`;
  const load = useCallback(async (t: TabId, force = false) => {
    const k = key(t);
    if (!force && cache[k] !== undefined) return;
    setLoading(true);
    const usePeriod = ["dashboard", "gst", "tds", "tcs", "reconciliation", "returns", "analytics"].includes(t);
    const section = ["gst", "tds", "tcs"].includes(t) ? `liability?type=${t.toUpperCase()}&period=${period}` : `${t}${usePeriod ? `?period=${period}` : ""}`;
    const j = await fetch(`${API}/${section}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    setCache((c) => ({ ...c, [k]: j?.ok ? j.data : null }));
    setLoading(false);
  }, [period, cache]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(`${API}/header?period=${period}-01`).then((r) => r.json()).then((j) => { if (j.ok) setTypes(j.data.types); }).catch(() => {}); }, [period]);
  useEffect(() => { load(tab); }, [tab, period]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = (t: TabId) => load(t, true);
  const data = cache[key(tab)];

  async function act(body: Record<string, unknown>, okMsg?: string): Promise<boolean> {
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    if (j.ok) { toast.show(okMsg || j.message || "Done.", { type: "success" }); return true; } else { toast.show(j.message || "Failed.", { type: "error" }); return false; }
  }
  const afterChange = () => { setCache({}); load(tab, true); };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><ShieldCheck className="h-6 w-6" /></span>
            <div>
              <h1 className="text-lg font-bold text-foreground">Statutory Compliance &amp; Government Payment</h1>
              <p className="mt-0.5 text-xs text-muted">GST · TDS · TCS liabilities, challan, reconciliation &amp; return filing — one framework.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-muted">Period</label>
            <input type="month" value={period} onChange={(e) => { setPeriod(e.target.value || thisMonth()); setCache({}); }} className="h-9 rounded-md border border-border-strong bg-surface px-2.5 text-sm focus:border-primary focus:outline-none" />
            <Button size="sm" onClick={() => setModal({})}><Plus className="h-3.5 w-3.5" /> New Payment</Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 -mx-1 overflow-x-auto rounded-xl border border-border bg-card/95 px-1 py-1 backdrop-blur">
        <div className="flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon; const active = tab === t.id;
            return <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition", active ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-surface-2")}><Icon className="h-3.5 w-3.5" /> {t.label}</button>;
          })}
        </div>
      </div>

      {/* Body */}
      <div>
        {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
          <>
            {tab === "dashboard" && <DashboardTab data={data as DashboardData | null} onPay={(type) => setModal({ type })} />}
            {(tab === "gst" || tab === "tds" || tab === "tcs") && <HeadTab type={tab.toUpperCase()} lia={data as LiabilityData | null} period={period} onPay={() => setModal({ type: tab.toUpperCase() })} onView={setViewId} />}
            {tab === "payments" && <PaymentsTab rows={data as StatutoryPaymentRow[] | null} onView={setViewId} onNew={() => setModal({})} />}
            {tab === "challans" && <ChallansTab rows={data as ChallanRow[] | null} onView={setViewId} onVerify={async (id) => { if (await act({ action: "transition", op: "verifyChallan", id }, "Challan verified.")) afterChange(); }} />}
            {tab === "reconciliation" && <ReconTab rows={data as ReconRow[] | null} />}
            {tab === "returns" && <ReturnsTab data={data as ReturnsData | null} period={period} onCreate={act} onFile={act} refresh={afterChange} />}
            {tab === "reports" && <ReportsTab rows={data as StatutoryPaymentRow[] | null} types={types} />}
            {tab === "analytics" && <AnalyticsTab data={data as AnalyticsData | null} />}
          </>
        )}
      </div>

      {modal && <StatutoryPaymentModal types={types.length ? types : [{ code: "GST", label: "GST" }, { code: "TDS", label: "TDS" }, { code: "TCS", label: "TCS" }]} initialType={modal.type} initialPeriod={period} onClose={() => setModal(null)} onSaved={() => { setModal(null); afterChange(); }} />}
      {viewId != null && <PaymentView id={viewId} onClose={() => setViewId(null)} onAct={act} onChanged={() => { setViewId(null); afterChange(); }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ Dashboard */
interface DashboardData { period: string; heads: { type: string; label: string; color: string; liability: number; paid: number; balance: number; due: string; overdue: boolean }[]; totals: { totalLiability: number; totalPaid: number; totalPending: number; overdue: number }; upcoming: { type: string; label: string; due: string; amount: number }[]; trend: { name: string; value: number }[]; returnsFiled: number }

function DashboardTab({ data, onPay }: { data: DashboardData | null; onPay: (t: string) => void }) {
  if (!data) return <Empty />;
  const kpis = [
    { k: "Total Liability", v: data.totals.totalLiability, icon: ShieldCheck, tone: "text-foreground" },
    { k: "Paid", v: data.totals.totalPaid, icon: CheckCircle2, tone: "text-success" },
    { k: "Pending", v: data.totals.totalPending, icon: Wallet, tone: "text-warning" },
    { k: "Overdue", v: data.totals.overdue, icon: CircleAlert, tone: "text-danger" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((c) => <div key={c.k} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{c.k}</span><c.icon className={cn("h-4 w-4", c.tone)} /></div><div className={cn("mt-1 text-xl font-bold tabular-nums", c.tone)}>{inr(c.v)}</div></div>)}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {data.heads.map((h) => (
          <div key={h.type} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between"><span className={cn("text-sm font-bold", h.color)}>{h.label}</span>{h.overdue ? <Badge tone="danger">Overdue</Badge> : h.balance > 0.5 ? <Badge tone="warning">Due {h.due.slice(5)}</Badge> : <Badge tone="success">Clear</Badge>}</div>
            <div className="mt-2 space-y-1 text-sm">
              <Row k="Liability" v={inr(h.liability)} />
              <Row k="Paid" v={inr(h.paid)} />
              <div className="flex items-center justify-between border-t border-border pt-1 font-bold text-foreground"><span>Balance</span><span className="tabular-nums">{inr(h.balance)}</span></div>
            </div>
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => onPay(h.type)} disabled={h.balance <= 0.5}><Landmark className="h-3.5 w-3.5" /> Pay {h.label}</Button>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Monthly Payment Trend"><BarRow data={data.trend} /></Panel>
        <Panel title="Upcoming Due Dates">
          {data.upcoming.length === 0 ? <p className="py-3 text-center text-2xs text-muted">Nothing due.</p> : (
            <div className="space-y-1.5">{data.upcoming.map((u) => <div key={u.type} className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-sm"><span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-warning" /> {u.label} · {u.due}</span><span className="font-semibold tabular-nums text-foreground">{inr(u.amount)}</span></div>)}</div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Head (GST/TDS/TCS) */
interface LiabilityData { type: string; period: string; liability: number; alreadyPaid: number; balance: number; receivable: number; breakup: { key: string; label: string; amount: number }[]; gst?: { cgst: number; sgst: number; igst: number; cess: number; outputTax: number; itc: number } }
function HeadTab({ type, lia, period, onPay, onView }: { type: string; lia: LiabilityData | null; period: string; onPay: () => void; onView: (id: number) => void }) {
  const [rows, setRows] = useState<StatutoryPaymentRow[] | null>(null);
  const [detail, setDetail] = useState(false);
  useEffect(() => { fetch(`${API}/payments?type=${type}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.data : [])).catch(() => setRows([])); }, [type, period]);
  if (!lia) return <Empty />;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard k="Liability" v={inr(lia.liability)} />
        <StatCard k="Already Paid" v={inr(lia.alreadyPaid)} tone="text-success" />
        <StatCard k="Balance" v={inr(lia.balance)} tone="text-warning" />
        {lia.receivable > 0 ? <StatCard k={type === "GST" ? "ITC / Credit" : "Credit"} v={inr(lia.receivable)} tone="text-info" /> : <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><Button size="sm" className="w-full" onClick={onPay} disabled={lia.balance <= 0.5}><Landmark className="h-3.5 w-3.5" /> Pay {type}</Button></div>}
      </div>
      {lia.breakup.length > 0 && (
        <Panel title={`${type} Liability Break-up`} action={<Button size="sm" variant="outline" onClick={() => setDetail(true)}><ListTree className="h-3.5 w-3.5" /> View Details</Button>}>
          <table className="w-full text-sm"><tbody>{lia.breakup.map((b) => <tr key={b.key} className="border-b border-border/60 last:border-0"><td className="py-1.5 text-muted">{b.label}</td><td className="py-1.5 text-right font-semibold tabular-nums text-foreground">{inr(b.amount)}</td></tr>)}</tbody></table>
          <p className="mt-2 text-2xs text-muted">Click <b>View Details</b> to drill into every voucher / invoice / receipt behind this figure and cross-verify by document number.</p>
        </Panel>
      )}
      <Panel title={`${type} Government Payments`} action={<Button size="sm" variant="outline" onClick={onPay}><Plus className="h-3.5 w-3.5" /> Pay</Button>}>
        <PaymentTable rows={rows} onView={onView} />
      </Panel>
      {detail && <LiabilityDetailModal type={type} period={period} liability={lia.liability} onClose={() => setDetail(false)} />}
    </div>
  );
}

/* -------------------------------------------------- Liability drill-down modal */
function LiabilityDetailModal({ type, period, liability, onClose }: { type: string; period: string; liability: number; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [data, setData] = useState<StatLiabilityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true);
    const t = setTimeout(() => {
      fetch(`${API}/detail?type=${type}&period=${period}&q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then((r) => r.json()).then((j) => { if (active) { setData(j.ok ? j.data : null); setLoading(false); } }).catch(() => active && setLoading(false));
    }, q ? 250 : 0);
    return () => { active = false; clearTimeout(t); };
  }, [type, period, q]);

  function csv() {
    if (!data) return;
    const head = ["Group", "Doc Type", "Doc No", "Date", "Party", "Section", "Taxable", "Rate%", "Tax"];
    const lines = data.groups.flatMap((g) => g.rows.map((r) => [g.label, r.docType, r.docNo, r.date, r.party, r.section ?? "", r.taxable, r.rate ?? "", r.tax].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${type}-liability-detail-${period}.csv`; a.click();
  }

  const isTds = type === "TDS";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground"><ListTree className="h-4 w-4 text-primary" /> {type} Liability — Document Detail <span className="text-2xs font-normal text-muted">({period})</span></h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
          <div className="relative flex-1 min-w-[220px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by voucher / receipt / invoice no · party · section…" className="h-9 w-full rounded-md border border-border-strong bg-surface pl-9 pr-3 text-sm focus:border-primary focus:outline-none" /></div>
          <Button size="sm" variant="outline" onClick={csv}><FileBarChart className="h-3.5 w-3.5" /> Export CSV</Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? <AppLoader label="Loading detail…" size="sm" /> : !data || data.groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{q ? `No documents match "${q}".` : "No source documents for this period."}</p>
          ) : (
            <div className="space-y-5">
              {data.groups.map((g) => (
                <div key={g.key}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Badge tone={g.sign === 1 ? "info" : "neutral"}>{g.sign === 1 ? "Add" : "Less"}</Badge><span className="text-sm font-bold text-foreground">{g.label}</span><span className="text-2xs text-subtle">· {g.note}</span></div>
                    <span className="text-2xs text-muted">{g.count} docs · <b className="text-foreground">{inr(g.tax)}</b></span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead><tr className="border-b border-border bg-surface-2/50 text-2xs uppercase tracking-wide text-muted"><th className="px-2.5 py-2 text-left">Document</th><th className="px-2.5 py-2 text-left">Doc No.</th><th className="px-2.5 py-2 text-left">Date</th><th className="px-2.5 py-2 text-left">Party</th>{isTds && <th className="px-2.5 py-2 text-left">Section</th>}<th className="px-2.5 py-2 text-right">Taxable</th>{isTds && <th className="px-2.5 py-2 text-right">Rate%</th>}<th className="px-2.5 py-2 text-right">Tax</th></tr></thead>
                      <tbody>
                        {g.rows.map((r, i) => (
                          <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-surface-2/20">
                            <td className="px-2.5 py-1.5 text-2xs text-muted">{r.docType}</td>
                            <td className="px-2.5 py-1.5 font-mono text-2xs font-semibold text-foreground">{r.docNo}</td>
                            <td className="px-2.5 py-1.5 text-2xs text-muted">{r.date}</td>
                            <td className="px-2.5 py-1.5 text-foreground">{r.party}</td>
                            {isTds && <td className="px-2.5 py-1.5 text-2xs text-muted">{r.section ?? "—"}</td>}
                            <td className="px-2.5 py-1.5 text-right tabular-nums text-muted">{inr(r.taxable)}</td>
                            {isTds && <td className="px-2.5 py-1.5 text-right tabular-nums text-muted">{r.rate != null ? `${r.rate}%` : "—"}</td>}
                            <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-foreground">{inr(r.tax)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t border-border bg-surface-2/40 font-bold text-foreground"><td className="px-2.5 py-1.5" colSpan={isTds ? 5 : 4}>Subtotal ({g.count})</td><td className="px-2.5 py-1.5 text-right tabular-nums">{inr(g.taxable)}</td>{isTds && <td />}<td className="px-2.5 py-1.5 text-right tabular-nums">{inr(g.tax)}</td></tr></tfoot>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {data && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm">
            <span className="text-2xs text-muted">Net of documents shown{q ? " (filtered)" : ""}</span>
            <div className="flex items-center gap-4">
              <span className="text-muted">Consolidated liability: <b className="text-foreground tabular-nums">{inr(liability)}</b></span>
              <span className="font-bold text-foreground">Net: <span className="tabular-nums text-primary">{inr(data.net)}</span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Government Payment */
function PaymentsTab({ rows, onView, onNew }: { rows: StatutoryPaymentRow[] | null; onView: (id: number) => void; onNew: () => void }) {
  return (
    <Panel title="Government Payments" action={<Button size="sm" onClick={onNew}><Plus className="h-3.5 w-3.5" /> New Payment</Button>}>
      <PaymentTable rows={rows} onView={onView} full />
    </Panel>
  );
}

function PaymentTable({ rows, onView, full }: { rows: StatutoryPaymentRow[] | null; onView: (id: number) => void; full?: boolean }) {
  if (rows === null) return <AppLoader label="Loading…" size="sm" />;
  if (!rows.length) return <p className="py-4 text-center text-2xs text-muted">No payments.</p>;
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
      <thead><tr className="border-b border-border text-2xs uppercase tracking-wide text-muted"><th className="px-2 py-2 text-left">Payment No.</th><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Type</th><th className="px-2 py-2 text-left">Period</th>{full && <th className="px-2 py-2 text-right">Liability</th>}<th className="px-2 py-2 text-right">Paid</th><th className="px-2 py-2 text-right">Total</th><th className="px-2 py-2 text-center">Challan</th><th className="px-2 py-2 text-center">Status</th><th className="px-2 py-2 text-right">Actions</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
          <td className="px-2 py-2 font-mono text-2xs text-foreground">{r.paymentNo}</td>
          <td className="px-2 py-2 text-2xs text-muted">{r.paymentDate}</td>
          <td className="px-2 py-2"><Badge tone="neutral">{r.statutoryType}</Badge></td>
          <td className="px-2 py-2 text-2xs text-muted">{r.taxPeriod}</td>
          {full && <td className="px-2 py-2 text-right tabular-nums text-muted">{inr(r.liabilityAmount)}</td>}
          <td className="px-2 py-2 text-right tabular-nums text-foreground">{inr(r.paidAmount)}</td>
          <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">{inr(r.totalPayable)}</td>
          <td className="px-2 py-2 text-center">{r.challanNo ? <Badge tone={r.challanStatus === "Verified" ? "success" : "neutral"}>{r.challanNo}</Badge> : <span className="text-2xs text-subtle">—</span>}</td>
          <td className="px-2 py-2 text-center"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
          <td className="px-2 py-2 text-right"><button onClick={() => onView(r.id)} className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></button></td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

/* ---------------------------------------------------------------- Challan Management */
interface ChallanRow { id: number; challanNo: string | null; paymentNo: string; statutoryType: string; taxPeriod: string; amount: number; bank: string | null; cpin: string | null; cin: string | null; bsrCode: string | null; status: string; challanStatus: string; hasAttachment: boolean }
function ChallansTab({ rows, onView, onVerify }: { rows: ChallanRow[] | null; onView: (id: number) => void; onVerify: (id: number) => void }) {
  if (rows === null) return <div className="rounded-2xl border border-border bg-card p-6 shadow-sm"><AppLoader label="Loading…" size="sm" /></div>;
  return (
    <Panel title="Challan Management">
      {!rows.length ? <p className="py-4 text-center text-2xs text-muted">No challans.</p> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-border text-2xs uppercase tracking-wide text-muted"><th className="px-2 py-2 text-left">Challan No.</th><th className="px-2 py-2 text-left">Payment</th><th className="px-2 py-2 text-left">Type</th><th className="px-2 py-2 text-left">Period</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2 text-left">CPIN / CIN</th><th className="px-2 py-2 text-left">Bank</th><th className="px-2 py-2 text-center">Verification</th><th className="px-2 py-2 text-right">Actions</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
              <td className="px-2 py-2 font-mono text-2xs text-foreground">{r.challanNo || <span className="text-subtle">—</span>}</td>
              <td className="px-2 py-2 font-mono text-2xs text-muted">{r.paymentNo}</td>
              <td className="px-2 py-2"><Badge tone="neutral">{r.statutoryType}</Badge></td>
              <td className="px-2 py-2 text-2xs text-muted">{r.taxPeriod}</td>
              <td className="px-2 py-2 text-right tabular-nums text-foreground">{inr(r.amount)}</td>
              <td className="px-2 py-2 text-2xs text-muted">{r.cpin || "—"}{r.cin ? ` / ${r.cin}` : ""}</td>
              <td className="px-2 py-2 text-2xs text-muted">{r.bank || "—"}</td>
              <td className="px-2 py-2 text-center"><Badge tone={statusTone(r.challanStatus)}>{r.challanStatus}</Badge></td>
              <td className="px-2 py-2"><div className="flex items-center justify-end gap-1">
                <button onClick={() => onView(r.id)} title="View" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted hover:border-primary/40 hover:text-primary"><Eye className="h-4 w-4" /></button>
                {r.challanNo && r.challanStatus !== "Verified" && <button onClick={() => onVerify(r.id)} title="Verify" className="grid h-8 w-8 place-items-center rounded-md border border-success/30 text-success hover:bg-success hover:text-white"><BadgeCheck className="h-4 w-4" /></button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------- Reconciliation */
interface ReconRow { type: string; label: string; ledgerLiability: number; paid: number; challans: number; difference: number; status: string }
function ReconTab({ rows }: { rows: ReconRow[] | null }) {
  if (!rows) return <Empty />;
  return (
    <Panel title="Reconciliation — Ledger vs Government Payment vs Challan">
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-border text-2xs uppercase tracking-wide text-muted"><th className="px-2 py-2 text-left">Head</th><th className="px-2 py-2 text-right">Ledger Liability</th><th className="px-2 py-2 text-right">Paid</th><th className="px-2 py-2 text-center">Challans</th><th className="px-2 py-2 text-right">Difference</th><th className="px-2 py-2 text-center">Status</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.type} className="border-b border-border/60 last:border-0">
            <td className="px-2 py-2 font-semibold text-foreground">{r.label}</td>
            <td className="px-2 py-2 text-right tabular-nums text-foreground">{inr(r.ledgerLiability)}</td>
            <td className="px-2 py-2 text-right tabular-nums text-foreground">{inr(r.paid)}</td>
            <td className="px-2 py-2 text-center text-muted">{r.challans}</td>
            <td className={cn("px-2 py-2 text-right font-semibold tabular-nums", Math.abs(r.difference) < 0.5 ? "text-success" : "text-danger")}>{inr(r.difference)}</td>
            <td className="px-2 py-2 text-center"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
          </tr>
        ))}</tbody>
      </table></div>
    </Panel>
  );
}

/* --------------------------------------------------------------------- Return Filing */
interface ReturnsData { rows: StatutoryReturnRow[]; expected: { statutoryType: string; returnType: string }[]; period: string }
function ReturnsTab({ data, period, onCreate, onFile, refresh }: { data: ReturnsData | null; period: string; onCreate: (b: Record<string, unknown>, m?: string) => Promise<boolean>; onFile: (b: Record<string, unknown>, m?: string) => Promise<boolean>; refresh: () => void }) {
  if (!data) return <Empty />;
  return (
    <div className="space-y-4">
      <Panel title={`Expected Returns — ${period}`}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.expected.map((e) => {
            const existing = data.rows.find((r) => r.statutoryType === e.statutoryType && r.returnType === e.returnType && r.taxPeriod === period);
            return (
              <div key={`${e.statutoryType}-${e.returnType}`} className="flex items-center justify-between rounded-lg border border-border bg-surface-2/30 px-3 py-2">
                <div><div className="text-sm font-semibold text-foreground">{e.returnType}</div><div className="text-2xs text-muted">{e.statutoryType}</div></div>
                {existing ? (existing.status === "Filed" ? <Badge tone="success">Filed</Badge> : <Button size="sm" variant="outline" onClick={async () => { const ack = window.prompt("Acknowledgement no. (optional):") ?? ""; if (await onFile({ action: "fileReturn", id: existing.id, ackNo: ack }, "Filed.")) refresh(); }}><Send className="h-3.5 w-3.5" /> File</Button>)
                  : <Button size="sm" variant="ghost" onClick={async () => { if (await onCreate({ action: "createReturn", statutoryType: e.statutoryType, returnType: e.returnType, taxPeriod: period }, "Prepared.")) refresh(); }}>Prepare</Button>}
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Filed & Prepared Returns">
        {!data.rows.length ? <p className="py-3 text-center text-2xs text-muted">No returns yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-border text-2xs uppercase tracking-wide text-muted"><th className="px-2 py-2 text-left">Return</th><th className="px-2 py-2 text-left">Type</th><th className="px-2 py-2 text-left">Period</th><th className="px-2 py-2 text-left">Filed</th><th className="px-2 py-2 text-left">Ack No.</th><th className="px-2 py-2 text-center">Status</th></tr></thead>
            <tbody>{data.rows.map((r) => <tr key={r.id} className="border-b border-border/60 last:border-0"><td className="px-2 py-2 font-semibold text-foreground">{r.returnType}</td><td className="px-2 py-2 text-muted">{r.statutoryType}</td><td className="px-2 py-2 text-muted">{r.taxPeriod}</td><td className="px-2 py-2 text-2xs text-muted">{r.filedDate || "—"}</td><td className="px-2 py-2 font-mono text-2xs text-muted">{r.ackNo || "—"}</td><td className="px-2 py-2 text-center"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td></tr>)}</tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------------- Reports */
function ReportsTab({ rows, types }: { rows: StatutoryPaymentRow[] | null; types: { code: string; label: string }[] }) {
  if (!rows) return <Empty />;
  function csv() {
    const head = ["Payment No", "Date", "Type", "Period", "Liability", "Paid", "Interest", "Penalty", "Total", "Status", "Challan"];
    const lines = rows!.map((r) => [r.paymentNo, r.paymentDate, r.statutoryType, r.taxPeriod, r.liabilityAmount, r.paidAmount, r.interest, r.penalty, r.totalPayable, r.status, r.challanNo ?? ""].join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "statutory-payment-register.csv"; a.click();
  }
  return (
    <Panel title="Government Payment Register" action={<Button size="sm" variant="outline" onClick={csv}><FileBarChart className="h-3.5 w-3.5" /> Export CSV</Button>}>
      <p className="mb-2 text-2xs text-muted">Registers for GST / TDS / TCS payments, challans &amp; compliance. {types.length ? `Heads: ${types.map((t) => t.label).join(" · ")}.` : ""}</p>
      <PaymentTable rows={rows} onView={() => {}} full />
    </Panel>
  );
}

/* ----------------------------------------------------------------------- Analytics */
interface AnalyticsData { byType: { type: string; label: string; color: string; series: { name: string; value: number }[] }[]; payments: { name: string; value: number }[]; compliance: number }
function AnalyticsTab({ data }: { data: AnalyticsData | null }) {
  if (!data) return <Empty />;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard k="Compliance %" v={`${data.compliance}%`} tone={data.compliance >= 90 ? "text-success" : data.compliance >= 50 ? "text-warning" : "text-danger"} />
        <StatCard k="Heads Tracked" v={String(data.byType.length)} />
        <StatCard k="Months" v={String(data.payments.length)} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.byType.map((s) => <Panel key={s.type} title={`${s.label} Liability Trend`}><BarRow data={s.series} /></Panel>)}
        <Panel title="Monthly Payments"><BarRow data={data.payments} /></Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Payment detail */
function PaymentView({ id, onClose, onAct, onChanged }: { id: number; onClose: () => void; onAct: (b: Record<string, unknown>, m?: string) => Promise<boolean>; onChanged: () => void }) {
  const [v, setV] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { fetch(`${API}/payment?id=${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setV(j.ok ? j.data : null)).catch(() => setV(null)); }, [id]);
  const p = v as (StatutoryPaymentRow & { alreadyPaid: number; balanceAmount: number; bankAccount: string | null; transactionNo: string | null; remarks: string | null; cpin: string | null; cin: string | null; bsrCode: string | null; challanBank: string | null; govRef: string | null; ackNo: string | null; approvedAt: string | null; journalId: number | null; attachments: { fileName: string; fileUrl: string }[] }) | null;
  const op = async (verb: string, reason?: string) => { if (await onAct({ action: "transition", op: verb, id, ...(reason != null ? { reason } : {}) }, undefined)) onChanged(); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3"><h3 className="text-base font-bold text-foreground">{p?.paymentNo ?? "Payment"}</h3><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2"><XCircle className="h-4 w-4" /></button></div>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">
          {!p ? <AppLoader label="Loading…" size="sm" /> : (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><Badge tone="neutral">{p.statutoryType}</Badge><Badge tone={statusTone(p.status)}>{p.status}</Badge></div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <KV k="Tax Period" v={p.taxPeriod} /><KV k="FY" v={p.financialYear} />
                <KV k="Liability" v={inr(p.liabilityAmount)} /><KV k="Already Paid" v={inr(p.alreadyPaid)} />
                <KV k="Paid (tax)" v={inr(p.paidAmount)} /><KV k="Interest" v={inr(p.interest)} />
                <KV k="Penalty" v={inr(p.penalty)} /><KV k="Total Payable" v={inr(p.totalPayable)} bold />
                <KV k="Mode" v={p.paymentMode || "—"} /><KV k="Reference" v={p.referenceNo || "—"} />
              </div>
              {(p.challanNo || p.cpin) && <div className="rounded-lg border border-border bg-surface-2/30 p-2.5"><div className="mb-1 text-2xs font-bold uppercase text-subtle">Challan</div><div className="grid grid-cols-2 gap-1.5 text-xs"><KV k="Challan No" v={p.challanNo || "—"} /><KV k="CPIN" v={p.cpin || "—"} /><KV k="CIN" v={p.cin || "—"} /><KV k="BSR" v={p.bsrCode || "—"} /><KV k="Bank" v={p.challanBank || "—"} /><KV k="Ack No" v={p.ackNo || "—"} /></div></div>}
              {p.journalId && <div className="text-2xs text-success">✓ Posted to GL (journal #{p.journalId})</div>}
              {p.attachments?.length > 0 && <div className="space-y-1">{p.attachments.map((a, i) => <a key={i} href={a.fileUrl} target="_blank" rel="noreferrer" className="block text-2xs text-primary hover:underline">📎 {a.fileName}</a>)}</div>}
            </div>
          )}
        </div>
        {p && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
            {p.status === "Draft" && <Button size="sm" onClick={() => op("submit")}><Send className="h-3.5 w-3.5" /> Submit</Button>}
            {p.status !== "Cancelled" && p.status !== "Paid" && <Button size="sm" variant="outline" onClick={() => op("cancel", window.prompt("Cancel reason:") ?? "")}>Cancel</Button>}
            {p.status === "Submitted" && <Button size="sm" onClick={() => op("approve")}><CheckCircle2 className="h-3.5 w-3.5" /> Approve</Button>}
            {p.status === "Approved" && <Button size="sm" onClick={() => op("markPaid")}><Landmark className="h-3.5 w-3.5" /> Mark Paid &amp; Post</Button>}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- primitives */
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-foreground">{title}</h3>{action}</div>{children}</div>;
}
function StatCard({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="text-2xs font-semibold uppercase tracking-wide text-muted">{k}</div><div className={cn("mt-1 text-lg font-bold tabular-nums", tone ?? "text-foreground")}>{v}</div></div>;
}
function Row({ k, v }: { k: string; v: string }) { return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="tabular-nums text-foreground">{v}</span></div>; }
function KV({ k, v, bold }: { k: string; v: string; bold?: boolean }) { return <div><div className="text-2xs text-muted">{k}</div><div className={cn("tabular-nums", bold ? "font-bold text-foreground" : "text-foreground")}>{v}</div></div>; }
function Empty() { return <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No data for this period.</div>; }
function BarRow({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return <div className="space-y-1.5">{data.map((d, i) => <div key={i} className="flex items-center gap-2 text-2xs"><span className="w-8 shrink-0 text-muted">{d.name}</span><div className="h-4 flex-1 overflow-hidden rounded bg-surface-2"><div className="h-full rounded bg-primary/70" style={{ width: `${Math.max(2, (Math.abs(d.value) / max) * 100)}%` }} /></div><span className="w-20 shrink-0 text-right tabular-nums text-foreground">{inr(d.value)}</span></div>)}</div>;
}

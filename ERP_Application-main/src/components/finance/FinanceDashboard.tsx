"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Activity, ShieldCheck, RefreshCw, Printer, Wallet, Landmark, HandCoins, AlertCircle, TrendingUp, TrendingDown, PiggyBank, Target, Sparkles, Receipt, CalendarClock, ArrowRight, Coins, Repeat, GitCompare, ScrollText, Truck, Maximize2, X, Brain } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";
import { Bars, Donut, DualBars, Gauge, LineChart, EmptyChart } from "@/components/dashboard/charts";
import { AiFinancePanel } from "@/components/finance/AiFinancePanel";

/* ---------------- widget drill-down: a shared detail modal via context ------- */
interface Detail {
  title: string;
  value?: string;
  description?: string;
  rows?: [string, string][];            // key / value list
  items?: NV[];                         // rendered as ranked table + bars
  columns?: [string, string];           // column headers for `items`
  table?: { head: string[]; body: (string | number)[][] }; // free-form table
  href?: string;
  hrefLabel?: string;
  fmt?: (n: number) => string;
  drill?: string;                       // widget key → live breakup from /api/finance/dashboard/drill
}
const DetailCtx = createContext<(d: Detail) => void>(() => {});
const useDetail = () => useContext(DetailCtx);

const inr = (x: number) => formatMoney(x || 0);
const compact = (n: number) => { const a = Math.abs(n); if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`; if (a >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`; if (a >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`; return `₹${Math.round(n)}`; };
const thisMonth = () => new Date().toISOString().slice(0, 7);

const TABS = [
  { id: "executive", label: "Executive", icon: LayoutDashboard, sub: "Owner · CEO · Directors" },
  { id: "operations", label: "Finance Operations", icon: Activity, sub: "Finance Manager · Accountant" },
  { id: "controller", label: "Financial Controller", icon: ShieldCheck, sub: "Controller · Auditor · CFO" },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface Centre { id: number; code: string; name: string }

export function FinanceDashboard() {
  const [tab, setTab] = useState<TabId>("executive");
  const [period, setPeriod] = useState(thisMonth());
  const [cc, setCc] = useState("");
  const [pc, setPc] = useState("");
  const [filters, setFilters] = useState<{ costCentres: Centre[]; profitCentres: Centre[] }>({ costCentres: [], profitCentres: [] });
  const [cache, setCache] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const qs = `period=${period}${cc ? `&costCenterId=${cc}` : ""}${pc ? `&profitCenterId=${pc}` : ""}`;
  const key = (t: string) => `${t}:${qs}`;

  const load = useCallback(async (t: TabId, force = false) => {
    const k = key(t);
    if (!force && cache[k] !== undefined) return;
    setLoading(true);
    const j = await fetch(`/api/finance/dashboard/${t}?${qs}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    setCache((c) => ({ ...c, [k]: j?.ok ? j.data : null }));
    setLoading(false);
  }, [qs, cache]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch("/api/finance/dashboard/filters").then((r) => r.json()).then((j) => { if (j.ok) setFilters(j.data); }).catch(() => {}); }, []);
  useEffect(() => { load(tab); }, [tab, qs]); // eslint-disable-line react-hooks/exhaustive-deps

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (auto) timer.current = setInterval(() => load(tab, true), 90000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [auto, tab, qs]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = cache[key(tab)];
  const refresh = () => { setCache({}); load(tab, true); };

  return (
    <DetailCtx.Provider value={setDetail}>
    <div className="space-y-4">
      {/* Header + tabs */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><LayoutDashboard className="h-6 w-6" /></span>
            <div>
              <h1 className="text-lg font-bold text-foreground">Enterprise Finance Dashboard</h1>
              <p className="mt-0.5 text-xs text-muted">Real-time performance across GL, AR/AP, budget, statutory, cost &amp; profit centres.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setAiOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-brand-gradient px-3 py-1.5 text-2xs font-bold text-white shadow-sm transition hover:opacity-90" title="AI Finance Intelligence"><Brain className="h-4 w-4" /> AI Intelligence</button>
            <button onClick={() => setAuto((a) => !a)} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-2xs font-semibold transition", auto ? "border-success/40 bg-success-subtle text-success" : "border-border text-muted hover:text-foreground")} title="Auto refresh (90s)"><RefreshCw className={cn("h-3.5 w-3.5", auto && "animate-spin")} /> Auto</button>
            <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print</Button>
          </div>
        </div>

        {/* Global filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Filter label="Month"><input type="month" value={period} onChange={(e) => { setPeriod(e.target.value || thisMonth()); setCache({}); }} className={fInp} /></Filter>
          <Filter label="Cost Centre"><select value={cc} onChange={(e) => { setCc(e.target.value); setCache({}); }} className={fInp}><option value="">All</option>{filters.costCentres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></Filter>
          <Filter label="Profit Centre"><select value={pc} onChange={(e) => { setPc(e.target.value); setCache({}); }} className={fInp}><option value="">All</option>{filters.profitCentres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></Filter>
          <Filter label="Currency"><span className="flex h-8 items-center rounded-md border border-border bg-surface-2/40 px-2.5 text-sm font-semibold text-foreground">₹ INR</span></Filter>
        </div>
      </div>

      {/* Tab bar */}
      <div className="grid gap-2 sm:grid-cols-3">
        {TABS.map((t) => {
          const Icon = t.icon; const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition", active ? "border-primary bg-primary text-white shadow-md" : "border-border bg-card text-foreground hover:border-primary/40")}>
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", active ? "bg-white/20" : "bg-primary-subtle text-primary")}><Icon className="h-5 w-5" /></span>
              <div className="min-w-0"><div className="text-sm font-bold">{t.label}</div><div className={cn("truncate text-2xs", active ? "text-white/80" : "text-muted")}>{t.sub}</div></div>
            </button>
          );
        })}
      </div>

      {/* Body */}
      {loading && data === undefined ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading dashboard…" /></div> : (
        <div className={cn(loading && "opacity-60 transition-opacity")}>
          {tab === "executive" && <ExecutiveTab data={data as ExecData | null} />}
          {tab === "operations" && <OperationsTab data={data as OpsData | null} />}
          {tab === "controller" && <ControllerTab data={data as CtrlData | null} />}
        </div>
      )}
      {detail && <DetailModal detail={detail} qs={qs} onClose={() => setDetail(null)} />}
      <AiFinancePanel open={aiOpen} onClose={() => setAiOpen(false)} period={period} costCenterId={cc} profitCenterId={pc} />
    </div>
    </DetailCtx.Provider>
  );
}

/* ---------------------------------------------------- widget detail modal */
interface LiveDrill { summary?: { label: string; value: string; tone?: string }[]; columns: { key: string; label: string; type?: string; align?: string }[]; rows: Record<string, string | number>[] }
function DetailModal({ detail, qs, onClose }: { detail: Detail; qs: string; onClose: () => void }) {
  const fmt = detail.fmt ?? inr;
  const [live, setLive] = useState<null | "loading" | LiveDrill>(detail.drill ? "loading" : null);
  useEffect(() => {
    if (!detail.drill) return;
    let abort = false;
    fetch(`/api/finance/dashboard/drill?widget=${encodeURIComponent(detail.drill)}&${qs}`, { cache: "no-store" })
      .then((r) => r.json()).then((j) => { if (!abort) setLive(j?.ok ? (j as LiveDrill) : null); }).catch(() => { if (!abort) setLive(null); });
    return () => { abort = true; };
  }, [detail.drill, qs]);
  const fmtLive = (v: string | number, type?: string) => v == null || v === "" ? "—" : type === "money" ? fmt(Number(v) || 0) : type === "percent" ? `${(Number(v) || 0).toFixed(2)}%` : type === "number" ? (Number(v) || 0).toLocaleString("en-IN") : String(v);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-primary px-5 py-3 text-white">
          <h3 className="text-base font-bold">{detail.title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {detail.value != null && <div className="text-2xl font-bold tabular-nums text-foreground">{detail.value}</div>}
          {detail.description && <p className="text-sm text-muted">{detail.description}</p>}

          {detail.drill && (
            <div className="space-y-2">
              <div className="text-2xs font-bold uppercase tracking-wide text-primary">Breakup / Drill-down</div>
              {live === "loading" ? <p className="py-2 text-sm text-muted">Loading breakup…</p>
                : !live ? <p className="py-1 text-sm text-muted">No breakup available.</p>
                : live.rows.length === 0 ? <p className="py-1 text-sm text-muted">No records for this selection.</p>
                : (
                  <>
                    {live.summary && live.summary.length > 0 && <div className="flex flex-wrap gap-2">{live.summary.map((sm, i) => <span key={i} className="rounded-lg border border-border bg-surface-2/40 px-2.5 py-1 text-2xs"><span className="text-muted">{sm.label}: </span><span className={cn("font-bold", sm.tone === "danger" ? "text-danger" : "text-foreground")}>{sm.value}</span></span>)}</div>}
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border bg-surface-2/50 text-2xs uppercase tracking-wide text-muted">{live.columns.map((c) => <th key={c.key} className={cn("px-3 py-2", c.align === "right" ? "text-right" : "text-left")}>{c.label}</th>)}</tr></thead>
                        <tbody>{live.rows.map((row, i) => <tr key={i} className="border-b border-border/50 last:border-0">{live.columns.map((c) => <td key={c.key} className={cn("px-3 py-1.5 tabular-nums", c.align === "right" ? "text-right" : "text-left", c.type === "text" && "font-medium text-foreground")}>{fmtLive(row[c.key], c.type)}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  </>
                )}
            </div>
          )}

          {detail.rows && detail.rows.length > 0 && (
            <div className="divide-y divide-border rounded-lg border border-border">
              {detail.rows.map(([k, v]) => <div key={k} className="flex items-center justify-between px-3 py-2 text-sm"><span className="text-muted">{k}</span><span className="font-semibold tabular-nums text-foreground">{v}</span></div>)}
            </div>
          )}

          {detail.items && detail.items.length > 0 && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-surface-2/50 text-2xs uppercase tracking-wide text-muted"><th className="px-3 py-2 text-left">{detail.columns?.[0] ?? "Name"}</th><th className="px-3 py-2 text-right">{detail.columns?.[1] ?? "Value"}</th><th className="px-3 py-2 text-right">Share</th></tr></thead>
                  <tbody>
                    {(() => { const total = detail.items!.reduce((s, i) => s + i.value, 0) || 1; return detail.items!.map((it, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0"><td className="px-3 py-1.5 text-foreground">{it.name}</td><td className="px-3 py-1.5 text-right font-semibold tabular-nums text-foreground">{fmt(it.value)}</td><td className="px-3 py-1.5 text-right tabular-nums text-muted">{Math.round((it.value / total) * 100)}%</td></tr>
                    )); })()}
                  </tbody>
                </table>
              </div>
              <Bars items={detail.items} fmt={fmt} />
            </div>
          )}

          {detail.table && detail.table.body.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2/50 text-2xs uppercase tracking-wide text-muted">{detail.table.head.map((h, i) => <th key={i} className={cn("px-3 py-2", i === 0 ? "text-left" : "text-right")}>{h}</th>)}</tr></thead>
                <tbody>{detail.table.body.map((r, i) => <tr key={i} className="border-b border-border/50 last:border-0">{r.map((c, j) => <td key={j} className={cn("px-3 py-1.5 tabular-nums", j === 0 ? "text-left font-medium text-foreground" : "text-right text-muted")}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
        {detail.href && (
          <div className="border-t border-border px-5 py-3 text-right">
            <Link href={detail.href} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">{detail.hrefLabel ?? "Open in module"} <ArrowRight className="h-4 w-4" /></Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================ EXECUTIVE */
type NV = { name: string; value: number };
interface ExecData {
  summary: Record<string, number>;
  revenueExpenseTrend: { name: string; a: number; b: number }[];
  cashFlow: { opening: number; receipts: number; payments: number; closing: number; forecast: number };
  profitability: { grossProfit: number; netProfit: number; profitMargin: number; ebitda: number; operatingMargin: number };
  budget: { budget: number; actual: number; committed: number; available: number; utilization: number; topOverBudget: { name: string; budget: number; actual: number; pct: number }[] };
  performance: { byBranch: NV[]; byCategory: NV[]; byChannel: NV[] };
  tops: { customers: NV[]; suppliers: NV[]; categories: NV[]; expenseHeads: NV[] };
  health: { score: number; label: string; factors: { name: string; score: number }[] };
  insights: string[];
}
function ExecutiveTab({ data }: { data: ExecData | null }) {
  if (!data) return <Empty />;
  const s = data.summary;
  const kpis = [
    { k: "Cash In Hand", v: s.cashInHand, icon: Wallet, href: "/finance/cash", tone: "text-foreground", desc: "Closing balance of the Cash-in-Hand ledger (1000) as of the period end, from all posted vouchers.", drill: "cashInHand" },
    { k: "Bank Balance", v: s.bankBalance, icon: Landmark, href: "/finance/bank-recon", tone: "text-foreground", desc: "Closing balance of the Bank ledger (1010) as of the period end, split by posting branch.", drill: "bankBalance" },
    { k: "Receivable", v: s.receivable, icon: HandCoins, href: "/finance/receivables", tone: "text-info", desc: "Outstanding Accounts Receivable (1100) — amounts customers owe, party-wise with overdue.", drill: "receivable" },
    { k: "Payable", v: s.payable, icon: AlertCircle, href: "/finance/payables", tone: "text-warning", desc: "Outstanding Accounts Payable (2000) — amounts owed to suppliers, supplier-wise.", drill: "payable" },
    { k: "Working Capital", v: s.workingCapital, icon: PiggyBank, tone: s.workingCapital >= 0 ? "text-success" : "text-danger", desc: "Current Assets − Current Liabilities. A positive figure means short-term obligations are comfortably covered.", rows: [["Current Assets", inr(s.currentAssets)], ["Current Liabilities", inr(s.currentLiabilities)], ["Working Capital", inr(s.workingCapital)]] as [string, string][], drill: "workingCapital" },
    { k: "Monthly Revenue", v: s.monthlyRevenue, icon: TrendingUp, tone: "text-success", desc: "Total Income (all income ledgers) posted within the selected period, account-wise.", drill: "revenue" },
    { k: "Monthly Expense", v: s.monthlyExpense, icon: TrendingDown, tone: "text-danger", desc: "Total Expense (all expense ledgers) posted within the selected period, account-wise.", drill: "expense" },
    { k: "Gross Profit", v: s.grossProfit, icon: TrendingUp, tone: "text-success", desc: "Direct Income − Direct Expense for the period (trading result before indirect items).", drill: "grossProfit" },
    { k: "Net Profit", v: s.netProfit, icon: PiggyBank, tone: s.netProfit >= 0 ? "text-success" : "text-danger", desc: "Total Income − Total Expense for the period.", rows: [["Revenue", inr(s.monthlyRevenue)], ["Expense", inr(s.monthlyExpense)], ["Net Profit", inr(s.netProfit)]] as [string, string][], drill: "netProfit" },
    { k: "Budget Used %", v: s.budgetUtilization, icon: Target, pct: true, href: "/finance/budget", tone: "text-foreground", desc: "Actual spend as a percentage of the approved budget for the current financial year, head-wise.", drill: "budget" },
    { k: "Current Assets", v: s.currentAssets, icon: Wallet, tone: "text-foreground", desc: "All asset ledgers except fixed assets, as of the period end (cash, bank, receivables, inventory, input tax, etc.).", drill: "currentAssets" },
    { k: "Current Liabilities", v: s.currentLiabilities, icon: AlertCircle, tone: "text-foreground", desc: "All liability ledgers as of the period end (payables, GST/TDS/TCS payable, store credit, etc.).", drill: "currentLiabilities" },
  ];
  return (
    <div className="space-y-4">
      <Section title="Financial Summary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{kpis.map((c) => <Kpi key={c.k} {...c} />)}</div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Revenue vs Expense (12 months)" className="lg:col-span-2" detail={{ title: "Revenue vs Expense — 12 Months", description: "Monthly total income vs total expense from posted ledger entries.", table: { head: ["Month", "Revenue", "Expense", "Net"], body: data.revenueExpenseTrend.map((t) => [t.name, inr(t.a), inr(t.b), inr(t.a - t.b)]) } }}><DualBars series={data.revenueExpenseTrend} fmt={compact} aLabel="Revenue" bLabel="Expense" /></Panel>
        <HealthPanel health={data.health} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cash Flow" detail={{ title: "Cash Flow", description: "Movement across Cash (1000) + Bank (1010) for the period. Forecast projects the closing balance by the average net cash flow of the last 3 months.", rows: [["Opening Balance", inr(data.cashFlow.opening)], ["Receipts (inflow)", inr(data.cashFlow.receipts)], ["Payments (outflow)", inr(data.cashFlow.payments)], ["Closing Balance", inr(data.cashFlow.closing)], ["Forecast (next month)", inr(data.cashFlow.forecast)]] }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Mini k="Opening" v={data.cashFlow.opening} /><Mini k="Receipts" v={data.cashFlow.receipts} tone="text-success" /><Mini k="Payments" v={data.cashFlow.payments} tone="text-danger" />
            <Mini k="Closing" v={data.cashFlow.closing} bold /><Mini k="Forecast (next mo.)" v={data.cashFlow.forecast} tone={data.cashFlow.forecast >= 0 ? "text-success" : "text-danger"} />
          </div>
        </Panel>
        <Panel title="Profitability" detail={{ title: "Profitability", description: "Gross Profit = Direct Income − Direct Expense. Net Profit = Total Income − Total Expense. Margins are relative to revenue; EBITDA adds back interest.", rows: [["Gross Profit", inr(data.profitability.grossProfit)], ["Net Profit", inr(data.profitability.netProfit)], ["EBITDA", inr(data.profitability.ebitda)], ["Profit Margin", `${data.profitability.profitMargin}%`], ["Operating Margin", `${data.profitability.operatingMargin}%`]] }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Mini k="Gross Profit" v={data.profitability.grossProfit} /><Mini k="Net Profit" v={data.profitability.netProfit} bold tone={data.profitability.netProfit >= 0 ? "text-success" : "text-danger"} /><Mini k="EBITDA" v={data.profitability.ebitda} />
            <Mini k="Profit Margin" v={data.profitability.profitMargin} pct /><Mini k="Operating Margin" v={data.profitability.operatingMargin} pct />
          </div>
        </Panel>
      </div>

      <Panel title="Budget" action={<Link href="/finance/budget" className="text-2xs font-semibold text-primary hover:underline">Open Budget →</Link>} detail={{ title: "Budget Utilization", description: "Approved budget vs actual spend and committed (open payables) for the current financial year. Available = Budget − Actual − Committed.", rows: [["Budget", inr(data.budget.budget)], ["Actual", inr(data.budget.actual)], ["Committed", inr(data.budget.committed)], ["Available", inr(data.budget.available)], ["Utilization", `${data.budget.utilization}%`]], items: data.budget.topOverBudget.map((h) => ({ name: `${h.name} (${h.pct}%)`, value: h.actual })), columns: ["Over-Budget Head", "Actual"] }}>
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Mini k="Budget" v={data.budget.budget} /><Mini k="Actual" v={data.budget.actual} /><Mini k="Committed" v={data.budget.committed} />
            <Mini k="Available" v={data.budget.available} tone={data.budget.available >= 0 ? "text-success" : "text-danger"} /><Mini k="Utilization" v={data.budget.utilization} pct bold />
          </div>
          <div><div className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">Top Over-Budget</div>{data.budget.topOverBudget.length ? <Bars items={data.budget.topOverBudget.map((h) => ({ name: `${h.name} (${h.pct}%)`, value: h.actual }))} fmt={compact} tone="danger" /> : <p className="py-3 text-center text-2xs text-muted">No heads over budget. 👍</p>}</div>
        </div>
      </Panel>

      <Section title="Business Performance">
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Revenue by Branch" detail={{ title: "Revenue by Branch", description: "Completed-sale revenue grouped by branch for the period.", items: data.performance.byBranch, columns: ["Branch", "Revenue"], fmt: inr }}>{data.performance.byBranch.length ? <Donut items={data.performance.byBranch} fmt={compact} /> : <EmptyChart />}</Panel>
          <Panel title="Revenue by Business Unit / Channel" detail={{ title: "Revenue by Business Unit / Channel", description: "Completed-sale revenue grouped by sales channel / business unit.", items: data.performance.byChannel, columns: ["Channel", "Revenue"], fmt: inr }}>{data.performance.byChannel.length ? <Donut items={data.performance.byChannel} fmt={compact} /> : <EmptyChart />}</Panel>
          <Panel title="Revenue by Category" detail={{ title: "Revenue by Category", description: "Sale-line value grouped by product category for the period.", items: data.performance.byCategory, columns: ["Category", "Revenue"], fmt: inr }}><Bars items={data.performance.byCategory} fmt={compact} tone="accent" /></Panel>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Panel title="Top Customers" detail={{ title: "Top Customers", description: "Highest-billing customers by completed-sale value for the period.", items: data.tops.customers, columns: ["Customer", "Sales"], fmt: inr }}><Bars items={data.tops.customers} fmt={compact} tone="success" /></Panel>
        <Panel title="Top Suppliers" detail={{ title: "Top Suppliers", description: "Highest suppliers by posted purchase value for the period.", items: data.tops.suppliers, columns: ["Supplier", "Purchases"], fmt: inr }}><Bars items={data.tops.suppliers} fmt={compact} tone="accent" /></Panel>
        <Panel title="Top Selling Categories" detail={{ title: "Top Selling Categories", description: "Product categories ranked by sale-line value for the period.", items: data.tops.categories, columns: ["Category", "Sales"], fmt: inr }}><Bars items={data.tops.categories} fmt={compact} /></Panel>
        <Panel title="Highest Expense Heads" detail={{ title: "Highest Expense Heads", description: "Expense heads ranked by petty-cash / business-expense spend for the period.", items: data.tops.expenseHeads, columns: ["Expense Head", "Amount"], fmt: inr }}><Bars items={data.tops.expenseHeads} fmt={compact} tone="danger" /></Panel>
      </div>

      <Panel title="AI Insights" icon={Sparkles}>
        <div className="space-y-2">{data.insights.map((t, i) => <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/30 px-3 py-2 text-sm text-foreground">{t}</div>)}</div>
      </Panel>
    </div>
  );
}

/* =============================================================== OPERATIONS */
interface OpsData {
  today: Record<string, { count: number; amount: number }>;
  ar: { outstanding: number; overdue: number; collectionDue: number; aging: Record<string, number>; top: NV[] };
  ap: { outstanding: number; paymentDue: number; aging: Record<string, number>; top: NV[] };
  cashBank: { cash: number; bank: number; todayCollection: number; todayPayment: number };
  recurring: Record<string, number>;
  budget: ExecData["budget"];
  approvals: { items: { key: string; label: string; count: number; href: string }[]; total: number };
}
const QUICK = [
  { label: "Expense Voucher", href: "/finance/petty-cash/new", icon: Coins }, { label: "Income Receipt", href: "/finance/receipt", icon: Receipt },
  { label: "Journal Voucher", href: "/finance/journal", icon: ScrollText }, { label: "Supplier Payment", href: "/purchase/payments", icon: Truck },
  { label: "Customer Receipt", href: "/sales/collections", icon: HandCoins }, { label: "Bank / Fund Transfer", href: "/finance/cash/fund-transfer", icon: Repeat },
  { label: "Government Payment", href: "/finance/statutory-compliance", icon: Landmark }, { label: "Recurring Transactions", href: "/finance/recurring", icon: Repeat },
];
function OperationsTab({ data }: { data: OpsData | null }) {
  const open = useDetail();
  if (!data) return <Empty />;
  const t = data.today;
  const acts = [
    { k: "Receipts", d: t.receipts, href: "/finance/receipt" }, { k: "Expense Vouchers", d: t.expenseVouchers, href: "/finance/petty-cash" }, { k: "Journal Vouchers", d: t.journalVouchers, href: "/finance/journal" },
    { k: "Sales Collection", d: t.salesCollection, href: "/sales/collections" }, { k: "Purchase Payment", d: t.purchasePayment, href: "/purchase/payments" },
  ];
  const agingRow = (a: Record<string, number>) => [{ name: "0-30", value: a.d1_30 }, { name: "31-60", value: a.d31_60 }, { name: "61-90", value: a.d61_90 }, { name: "90+", value: a.d90 }];
  return (
    <div className="space-y-4">
      <Section title="Today's Activities">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{acts.map((a) => <button type="button" key={a.k} onClick={() => open({ title: `Today · ${a.k}`, href: a.href, hrefLabel: "Open module", description: `${a.d.count} ${a.k.toLowerCase()} recorded today${a.d.amount > 0 ? ` totalling ${inr(a.d.amount)}` : ""}.`, rows: [["Count", String(a.d.count)], ...(a.d.amount > 0 ? [["Amount", inr(a.d.amount)] as [string, string]] : [])] })} className="group rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="text-2xs font-semibold uppercase tracking-wide text-muted">{a.k}</div><div className="mt-1 text-lg font-bold text-foreground">{a.d.count}</div>{a.d.amount > 0 && <div className="text-2xs text-muted">{inr(a.d.amount)}</div>}</button>)}</div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Accounts Receivable" action={<Link href="/finance/receivables" className="text-2xs font-semibold text-primary hover:underline">View →</Link>} detail={{ title: "Accounts Receivable", href: "/finance/receivables", hrefLabel: "Open Receivables", description: "Outstanding customer balances with aging. Overdue = past due date.", rows: [["Outstanding", inr(data.ar.outstanding)], ["Overdue", inr(data.ar.overdue)], ["Collection Due (not yet overdue)", inr(data.ar.collectionDue)], ["0-30 days", inr(data.ar.aging.d1_30)], ["31-60 days", inr(data.ar.aging.d31_60)], ["61-90 days", inr(data.ar.aging.d61_90)], ["90+ days", inr(data.ar.aging.d90)]], items: data.ar.top, columns: ["Top Customer", "Balance"], fmt: inr }}>
          <div className="mb-2 grid grid-cols-3 gap-2"><Mini k="Outstanding" v={data.ar.outstanding} bold /><Mini k="Overdue" v={data.ar.overdue} tone="text-danger" /><Mini k="Collection Due" v={data.ar.collectionDue} tone="text-warning" /></div>
          <Bars items={agingRow(data.ar.aging)} fmt={compact} tone="accent" />
        </Panel>
        <Panel title="Accounts Payable" action={<Link href="/finance/payables" className="text-2xs font-semibold text-primary hover:underline">View →</Link>} detail={{ title: "Accounts Payable", href: "/finance/payables", hrefLabel: "Open Payables", description: "Outstanding supplier balances with aging. Payment Due = past due date.", rows: [["Outstanding", inr(data.ap.outstanding)], ["Payment Due (overdue)", inr(data.ap.paymentDue)], ["0-30 days", inr(data.ap.aging.d1_30)], ["31-60 days", inr(data.ap.aging.d31_60)], ["61-90 days", inr(data.ap.aging.d61_90)], ["90+ days", inr(data.ap.aging.d90)]], items: data.ap.top, columns: ["Top Supplier", "Balance"], fmt: inr }}>
          <div className="mb-2 grid grid-cols-2 gap-2"><Mini k="Outstanding" v={data.ap.outstanding} bold /><Mini k="Payment Due (overdue)" v={data.ap.paymentDue} tone="text-danger" /></div>
          <Bars items={agingRow(data.ap.aging)} fmt={compact} tone="danger" />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cash & Bank" detail={{ title: "Cash & Bank", description: "Live Cash (1000) and Bank (1010) ledger balances, plus today's cash movement.", rows: [["Cash Balance", inr(data.cashBank.cash)], ["Bank Balance", inr(data.cashBank.bank)], ["Today's Collection", inr(data.cashBank.todayCollection)], ["Today's Payment", inr(data.cashBank.todayPayment)]] }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Mini k="Cash Balance" v={data.cashBank.cash} /><Mini k="Bank Balance" v={data.cashBank.bank} /><Mini k="Today Collection" v={data.cashBank.todayCollection} tone="text-success" /><Mini k="Today Payment" v={data.cashBank.todayPayment} tone="text-danger" /></div>
        </Panel>
        <Panel title="Recurring Transactions" action={<Link href="/finance/recurring" className="text-2xs font-semibold text-primary hover:underline">View →</Link>} detail={{ title: "Recurring Transactions", href: "/finance/recurring", hrefLabel: "Open Recurring", description: "Status of recurring expense / income schedules.", table: { head: ["Bucket", "Count"], body: [["Due Today", data.recurring.todaySchedule], ["Pending Manual", data.recurring.pendingManual], ["Pending Approval", data.recurring.pendingApproval], ["Upcoming (7 days)", data.recurring.upcoming], ["Failed", data.recurring.failed], ["Completed", data.recurring.completed]] } }}>
          <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            <Tile k="Today" v={data.recurring.todaySchedule} /><Tile k="Manual" v={data.recurring.pendingManual} /><Tile k="Approval" v={data.recurring.pendingApproval} tone="text-warning" /><Tile k="Upcoming" v={data.recurring.upcoming} /><Tile k="Failed" v={data.recurring.failed} tone="text-danger" /><Tile k="Completed" v={data.recurring.completed} tone="text-success" />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Budget Monitoring" action={<Link href="/finance/budget" className="text-2xs font-semibold text-primary hover:underline">View →</Link>} detail={{ title: "Budget Monitoring", href: "/finance/budget", hrefLabel: "Open Budget", description: "Financial-year budget vs actual and committed.", rows: [["Budget", inr(data.budget.budget)], ["Actual", inr(data.budget.actual)], ["Committed", inr(data.budget.committed)], ["Available", inr(data.budget.available)], ["Utilization", `${data.budget.utilization}%`]], items: data.budget.topOverBudget.map((h) => ({ name: `${h.name} (${h.pct}%)`, value: h.actual })), columns: ["Over-Budget Head", "Actual"] }}>
          <div className="grid grid-cols-3 gap-2"><Mini k="Available" v={data.budget.available} tone="text-success" /><Mini k="Committed" v={data.budget.committed} /><Mini k="Actual" v={data.budget.actual} /></div>
          <div className="mt-2 flex items-center gap-2 text-2xs"><span className="text-muted">Utilization</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", data.budget.utilization > 100 ? "bg-danger" : data.budget.utilization > 80 ? "bg-warning" : "bg-success")} style={{ width: `${Math.min(100, data.budget.utilization)}%` }} /></div><span className="font-bold text-foreground">{data.budget.utilization}%</span></div>
          {data.budget.topOverBudget.length > 0 && <p className="mt-1 text-2xs text-danger">{data.budget.topOverBudget.length} head(s) exceeded budget.</p>}
        </Panel>
        <Panel title="Approval Center" action={<Badge tone={data.approvals.total ? "warning" : "success"}>{data.approvals.total} pending</Badge>} detail={{ title: "Approval Center", description: "Documents awaiting approval across finance modules. Open each queue from its own screen.", table: { head: ["Approval Queue", "Pending"], body: data.approvals.items.map((a) => [a.label, a.count]) } }}>
          <div className="space-y-1.5">{data.approvals.items.map((a) => <Link key={a.key} href={a.href} className="flex items-center justify-between rounded-lg border border-border bg-surface-2/30 px-3 py-2 text-sm transition hover:border-primary/40"><span className="text-foreground">{a.label}</span><span className="flex items-center gap-2">{a.count > 0 ? <Badge tone="warning">{a.count}</Badge> : <span className="text-2xs text-subtle">0</span>}<ArrowRight className="h-3.5 w-3.5 text-subtle" /></span></Link>)}</div>
        </Panel>
      </div>

      <Panel title="Quick Actions">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{QUICK.map((q) => { const Icon = q.icon; return <Link key={q.href} href={q.href} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground transition hover:border-primary hover:bg-primary-subtle/40"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary-subtle text-primary"><Icon className="h-4 w-4" /></span>{q.label}</Link>; })}</div>
      </Panel>
    </div>
  );
}

/* =============================================================== CONTROLLER */
interface CtrlData {
  statutory: { gst: Record<string, number | string>; tds: Record<string, number | string>; tcs: Record<string, number | string> };
  govPayments: { gstPaid: number; tdsPaid: number; tcsPaid: number; pendingChallans: number; upcoming: { type: string; due: string; amount: number }[] };
  reconciliation: { name: string; status: string; pending: number }[];
  journals: { posted: number; reversed: number; adjustment: number; today: number };
  budgetControl: { utilization: number; variance: number; overBudget: number; transferPending: number; revisionPending: number };
  costCentre: { total: number; top: NV[]; byDepartment: NV[] };
  profitCentre: { rows: { name: string; revenue: number; expense: number; profit: number; margin: number }[]; totals: { revenue: number; expense: number; profit: number } };
  audit: { todayCount: number; configChanges: number; voucherChanges: number; deleted: number; approvals: number; recent: { action: string; entity: string; summary: string; user: string; at: string }[] };
}
function ControllerTab({ data }: { data: CtrlData | null }) {
  if (!data) return <Empty />;
  const st = data.statutory;
  return (
    <div className="space-y-4">
      <Section title="Statutory Compliance">
        <div className="grid gap-3 lg:grid-cols-3">
          <StatBox title="GST" tone="text-primary" desc="Net GST = Output GST − eligible Input Tax Credit for the period. Payment Due is the balance after payments already made; Return Due is the statutory filing date." rows={[["Input GST", inr(Number(st.gst.input))], ["Output GST", inr(Number(st.gst.output))], ["Net GST", inr(Number(st.gst.net))], ["Payment Due", inr(Number(st.gst.paymentDue))], ["Return Due", String(st.gst.returnDue)]]} href="/finance/statutory-compliance" />
          <StatBox title="TDS" tone="text-info" desc="TDS deducted on expense/vendor bills (payable to government), how much has been paid, and the pending balance." rows={[["Deducted", inr(Number(st.tds.deducted))], ["Paid", inr(Number(st.tds.paid))], ["Pending", inr(Number(st.tds.pending))], ["Return Due", String(st.tds.returnDue)]]} href="/finance/statutory-compliance" />
          <StatBox title="TCS" tone="text-success" desc="TCS collected from customers (payable to government), paid so far, and the pending balance." rows={[["Collected", inr(Number(st.tcs.collected))], ["Paid", inr(Number(st.tcs.paid))], ["Pending", inr(Number(st.tcs.pending))], ["Return Due", String(st.tcs.returnDue)]]} href="/finance/statutory-compliance" />
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Government Payments" action={<Link href="/finance/statutory-compliance" className="text-2xs font-semibold text-primary hover:underline">View →</Link>} detail={{ title: "Government Payments", href: "/finance/statutory-compliance", hrefLabel: "Open Statutory Compliance", description: "Statutory amounts paid to government this period, unverified challans, and upcoming due dates.", rows: [["GST Paid", inr(data.govPayments.gstPaid)], ["TDS Paid", inr(data.govPayments.tdsPaid)], ["TCS Paid", inr(data.govPayments.tcsPaid)], ["Pending Challans", String(data.govPayments.pendingChallans)]], table: data.govPayments.upcoming.length ? { head: ["Head", "Due Date", "Amount"], body: data.govPayments.upcoming.map((u) => [u.type, u.due, inr(u.amount)]) } : undefined }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Mini k="GST Paid" v={data.govPayments.gstPaid} /><Mini k="TDS Paid" v={data.govPayments.tdsPaid} /><Mini k="TCS Paid" v={data.govPayments.tcsPaid} /><Tile k="Pending Challans" v={data.govPayments.pendingChallans} tone="text-warning" /></div>
          {data.govPayments.upcoming.length > 0 && <div className="mt-2 space-y-1">{data.govPayments.upcoming.map((u) => <div key={u.type} className="flex items-center justify-between rounded-lg border border-border bg-surface-2/30 px-3 py-1.5 text-sm"><span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-warning" /> {u.type} · due {u.due}</span><span className="font-semibold tabular-nums text-foreground">{inr(u.amount)}</span></div>)}</div>}
        </Panel>
        <Panel title="Reconciliation" detail={{ title: "Reconciliation", description: "Cross-checks between the ledger, statutory data and sub-ledgers. 'Open' counts show items needing attention.", table: { head: ["Reconciliation", "Status", "Open"], body: data.reconciliation.map((r) => [r.name, r.status, r.pending]) } }}>
          <div className="space-y-1.5">{data.reconciliation.map((r) => <div key={r.name} className="flex items-center justify-between rounded-lg border border-border bg-surface-2/30 px-3 py-2 text-sm"><span className="flex items-center gap-1.5 text-foreground"><GitCompare className="h-4 w-4 text-muted" /> {r.name}</span><span className="flex items-center gap-2">{r.pending > 0 && <span className="text-2xs text-muted">{r.pending} open</span>}<Badge tone={r.status === "Matched" ? "success" : r.status === "Pending" ? "warning" : "neutral"}>{r.status}</Badge></span></div>)}</div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Journal Analysis" action={<Link href="/finance/journal" className="text-2xs font-semibold text-primary hover:underline">View →</Link>} detail={{ title: "Journal Analysis", href: "/finance/journal", hrefLabel: "Open Journal", description: "Journal voucher counts across the ledger. Reversed entries have a netting reversal voucher; adjustments are manual JOURNAL-type vouchers.", rows: [["Posted", String(data.journals.posted)], ["Reversed", String(data.journals.reversed)], ["Adjustment (Journal type)", String(data.journals.adjustment)], ["Posted Today", String(data.journals.today)]] }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Tile k="Posted" v={data.journals.posted} tone="text-success" /><Tile k="Reversed" v={data.journals.reversed} tone="text-danger" /><Tile k="Adjustments" v={data.journals.adjustment} /><Tile k="Today" v={data.journals.today} /></div>
        </Panel>
        <Panel title="Budget Control" action={<Link href="/finance/budget" className="text-2xs font-semibold text-primary hover:underline">View →</Link>} detail={{ title: "Budget Control", href: "/finance/budget", hrefLabel: "Open Budget", description: "Variance = Budget − Actual. Pending transfers/revisions await approval.", rows: [["Utilization", `${data.budgetControl.utilization}%`], ["Variance", inr(data.budgetControl.variance)], ["Over-Budget Heads", String(data.budgetControl.overBudget)], ["Transfers Pending", String(data.budgetControl.transferPending)], ["Revisions Pending", String(data.budgetControl.revisionPending)]] }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><Mini k="Utilization" v={data.budgetControl.utilization} pct /><Mini k="Variance" v={data.budgetControl.variance} /><Tile k="Over Budget" v={data.budgetControl.overBudget} tone="text-danger" /><Tile k="Transfers" v={data.budgetControl.transferPending} /><Tile k="Revisions" v={data.budgetControl.revisionPending} /></div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cost Centre Analysis" action={<Link href="/system/cost-centre" className="text-2xs font-semibold text-primary hover:underline">Manage →</Link>} detail={{ title: "Cost Centre Analysis", href: "/system/cost-centre", hrefLabel: "Manage Cost Centres", description: `Expense posted to each cost centre for the period (total ${inr(data.costCentre.total)}), plus the highest-spending departments.`, items: data.costCentre.top, columns: ["Cost Centre", "Expense"], fmt: inr, table: data.costCentre.byDepartment.length ? { head: ["Department", "Expense"], body: data.costCentre.byDepartment.map((d) => [d.name, inr(d.value)]) } : undefined }}>
          <div className="mb-2 text-2xs text-muted">Total expense by cost centre: <b className="text-foreground">{inr(data.costCentre.total)}</b></div>
          {data.costCentre.top.length ? <Bars items={data.costCentre.top} fmt={compact} tone="accent" /> : <EmptyChart msg="No cost-centre-tagged postings." />}
          {data.costCentre.byDepartment.length > 0 && <div className="mt-3 border-t border-border pt-2"><div className="mb-1 text-2xs font-bold uppercase tracking-wide text-subtle">Highest Spending Departments</div><Bars items={data.costCentre.byDepartment} fmt={compact} tone="danger" /></div>}
        </Panel>
        <Panel title="Profit Centre Analysis" action={<Link href="/system/profit-centre" className="text-2xs font-semibold text-primary hover:underline">Manage →</Link>} detail={{ title: "Profit Centre Analysis", href: "/system/profit-centre", hrefLabel: "Manage Profit Centres", description: "Revenue, expense and profit posted to each profit centre for the period, with profit margin.", rows: [["Total Revenue", inr(data.profitCentre.totals.revenue)], ["Total Expense", inr(data.profitCentre.totals.expense)], ["Net Profit", inr(data.profitCentre.totals.profit)]], table: data.profitCentre.rows.length ? { head: ["Profit Centre", "Revenue", "Expense", "Profit", "Margin"], body: data.profitCentre.rows.map((r) => [r.name, inr(r.revenue), inr(r.expense), inr(r.profit), `${r.margin}%`]) } : undefined }}>
          <div className="mb-2 grid grid-cols-3 gap-2"><Mini k="Revenue" v={data.profitCentre.totals.revenue} tone="text-success" /><Mini k="Expense" v={data.profitCentre.totals.expense} tone="text-danger" /><Mini k="Net Profit" v={data.profitCentre.totals.profit} bold /></div>
          {data.profitCentre.rows.length ? (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-2xs uppercase text-muted"><th className="px-2 py-1.5 text-left">Profit Centre</th><th className="px-2 py-1.5 text-right">Revenue</th><th className="px-2 py-1.5 text-right">Expense</th><th className="px-2 py-1.5 text-right">Profit</th><th className="px-2 py-1.5 text-right">Margin</th></tr></thead>
              <tbody>{data.profitCentre.rows.map((r) => <tr key={r.name} className="border-b border-border/50 last:border-0"><td className="px-2 py-1.5 font-medium text-foreground">{r.name}</td><td className="px-2 py-1.5 text-right tabular-nums text-muted">{compact(r.revenue)}</td><td className="px-2 py-1.5 text-right tabular-nums text-muted">{compact(r.expense)}</td><td className={cn("px-2 py-1.5 text-right font-semibold tabular-nums", r.profit >= 0 ? "text-success" : "text-danger")}>{compact(r.profit)}</td><td className="px-2 py-1.5 text-right tabular-nums text-foreground">{r.margin}%</td></tr>)}</tbody>
            </table></div>
          ) : <EmptyChart msg="No profit-centre-tagged postings." />}
        </Panel>
      </div>

      <Panel title="Audit Monitoring" icon={ScrollText} action={<Link href="/finance/audit" className="text-2xs font-semibold text-primary hover:underline">Audit Trail →</Link>} detail={{ title: "Audit Monitoring — Today", href: "/finance/audit", hrefLabel: "Open Audit Trail", description: "Audit-log activity recorded today, classified by type, with the most recent entries.", rows: [["Total Logs Today", String(data.audit.todayCount)], ["Config Changes", String(data.audit.configChanges)], ["Voucher Changes", String(data.audit.voucherChanges)], ["Deleted / Voided", String(data.audit.deleted)], ["Approval Logs", String(data.audit.approvals)]], table: data.audit.recent.length ? { head: ["Activity", "User", "Time"], body: data.audit.recent.map((l) => [l.summary || l.action, l.user, l.at.slice(11, 16)]) } : undefined }}>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5"><Tile k="Today's Logs" v={data.audit.todayCount} /><Tile k="Config Changes" v={data.audit.configChanges} /><Tile k="Voucher Changes" v={data.audit.voucherChanges} /><Tile k="Deleted / Voided" v={data.audit.deleted} tone="text-danger" /><Tile k="Approval Logs" v={data.audit.approvals} /></div>
        {data.audit.recent.length > 0 ? <div className="space-y-1">{data.audit.recent.map((l, i) => <div key={i} className="flex items-center justify-between gap-2 border-b border-border/40 py-1.5 text-2xs last:border-0"><span className="min-w-0 truncate text-foreground">{l.summary || l.action}</span><span className="shrink-0 text-subtle">{l.user} · {l.at.slice(11, 16)}</span></div>)}</div> : <p className="py-2 text-center text-2xs text-muted">No audit activity today.</p>}
      </Panel>
    </div>
  );
}

/* ================================================================ primitives */
function HealthPanel({ health }: { health: ExecData["health"] }) {
  const open = useDetail();
  const detail: Detail = {
    title: "Financial Health Score",
    value: `${health.score} / 100 — ${health.label}`,
    description: "A composite 0–100 score averaging four weighted signals of financial well-being: liquidity (current ratio), profitability (net margin), budget discipline and cash position. Bands: ≥80 Excellent · 60–79 Good · 40–59 Average · <40 Poor.",
    items: health.factors.map((f) => ({ name: f.name, value: f.score })),
    columns: ["Factor", "Score / 100"],
  };
  return (
    <Panel title="Financial Health Score" detail={detail}>
      <button type="button" onClick={() => open(detail)} className="flex w-full flex-col items-center gap-3 text-left">
        <div className={cn("text-current", health.score >= 60 ? "text-success" : health.score >= 40 ? "text-warning" : "text-danger")}><Gauge score={health.score} size={120} /></div>
        <Badge tone={health.score >= 80 ? "success" : health.score >= 60 ? "info" : health.score >= 40 ? "warning" : "danger"}>{health.label}</Badge>
        <div className="w-full space-y-1.5">{health.factors.map((f) => <div key={f.name}><div className="flex justify-between text-2xs"><span className="text-muted">{f.name}</span><span className="font-semibold text-foreground">{f.score}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", f.score >= 60 ? "bg-success" : f.score >= 40 ? "bg-warning" : "bg-danger")} style={{ width: `${f.score}%` }} /></div></div>)}</div>
        <span className="mt-1 flex items-center gap-1 text-2xs font-semibold text-primary">Click for score breakdown <ArrowRight className="h-3 w-3" /></span>
      </button>
    </Panel>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex items-center gap-1.5"><span className="text-2xs font-semibold text-muted">{label}</span>{children}</label>;
}
const fInp = "h-8 rounded-md border border-border-strong bg-surface px-2 text-sm focus:border-primary focus:outline-none";

function useCountUp(value: number) {
  const [n, setN] = useState(value);
  useEffect(() => {
    const start = n, diff = value - start, t0 = performance.now(), dur = 500;
    let raf = 0;
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / dur); setN(start + diff * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return n;
}

function Kpi({ k, v, icon: Icon, tone, href, pct, desc, rows, drill }: { k: string; v: number; icon: typeof Wallet; tone: string; href?: string; pct?: boolean; desc?: string; rows?: [string, string][]; drill?: string }) {
  const n = useCountUp(v);
  const open = useDetail();
  return (
    <button type="button" onClick={() => open({ title: k, value: pct ? `${Math.round(v)}%` : inr(v), description: desc, rows, href, hrefLabel: "Open in module", drill })} className="group block w-full text-left">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        <div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{k}</span><Icon className={cn("h-4 w-4", tone)} /></div>
        <div className={cn("mt-1 text-xl font-bold tabular-nums", tone)}>{pct ? `${Math.round(n)}%` : inr(n)}</div>
        <div className="mt-0.5 flex items-center gap-0.5 text-2xs text-primary opacity-0 transition group-hover:opacity-100">View details <ArrowRight className="h-3 w-3" /></div>
      </div>
    </button>
  );
}

function Mini({ k, v, tone, bold, pct }: { k: string; v: number; tone?: string; bold?: boolean; pct?: boolean }) {
  return <div className="rounded-lg border border-border bg-surface-2/30 px-3 py-2"><div className="text-2xs text-muted">{k}</div><div className={cn("tabular-nums", bold ? "text-base font-bold" : "text-sm font-semibold", tone ?? "text-foreground")}>{pct ? `${Math.round(v)}%` : inr(v)}</div></div>;
}
function Tile({ k, v, tone }: { k: string; v: number; tone?: string }) {
  return <div className="rounded-lg border border-border bg-surface-2/30 px-2 py-2 text-center"><div className={cn("text-lg font-bold tabular-nums", tone ?? "text-foreground")}>{v}</div><div className="text-2xs text-muted">{k}</div></div>;
}
function StatBox({ title, tone, rows, href, desc }: { title: string; tone: string; rows: [string, string][]; href: string; desc?: string }) {
  const open = useDetail();
  return <button type="button" onClick={() => open({ title: `${title} — Statutory Detail`, description: desc, rows, href, hrefLabel: "Open Statutory Compliance" })} className="block w-full rounded-2xl border border-border bg-card text-left shadow-sm transition hover:border-primary/40 hover:shadow-md">
    <div className={cn("flex items-center justify-between rounded-t-2xl border-b border-border bg-primary-subtle/50 px-4 py-2 text-sm font-bold", tone)}>{title}<Maximize2 className="h-3.5 w-3.5 opacity-60" /></div>
    <div className="space-y-1 p-4">{rows.map(([k, v]) => <div key={k} className="flex justify-between text-sm"><span className="text-muted">{k}</span><span className="font-semibold tabular-nums text-foreground">{v}</span></div>)}</div>
  </button>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-2"><h2 className="rounded-lg bg-brand-gradient px-3 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm">{title}</h2>{children}</div>;
}
function Panel({ title, action, icon: Icon, className, detail, children }: { title: string; action?: React.ReactNode; icon?: typeof Wallet; className?: string; detail?: Detail; children: React.ReactNode }) {
  const open = useDetail();
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      <div className="flex items-center justify-between border-b border-border bg-primary-subtle/40 px-4 py-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary">{Icon && <Icon className="h-4 w-4" />}{title}</h3>
        <div className="flex items-center gap-2">{action}{detail && <button type="button" onClick={() => open(detail)} title="View details" className="grid h-7 w-7 place-items-center rounded-md text-primary/70 transition hover:bg-primary/10 hover:text-primary"><Maximize2 className="h-3.5 w-3.5" /></button>}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Empty() { return <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No finance data available for the selected filters.</div>; }

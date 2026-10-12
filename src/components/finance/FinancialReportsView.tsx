"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileBarChart, ArrowRight, ArrowLeft, Printer, Scale, TrendingUp, ShoppingCart, ArrowLeftRight,
  GitCompare, BookOpen, ScrollText, Wallet, Landmark, NotebookPen, Clock, type LucideIcon,
} from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/settings/generalConfig";
import { cn } from "@/lib/cn";

const inr = (x: number) => formatMoney(Number(x) || 0);
const fyStart = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01`; };
const todayStr = () => new Date().toISOString().slice(0, 10);

interface Rep { id: string; label: string; icon: LucideIcon; asOf?: boolean; soon?: boolean }
const GROUPS: { group: string; items: Rep[] }[] = [
  { group: "Financial Statements", items: [
    { id: "trial-balance", label: "Trial Balance", icon: FileBarChart, asOf: true },
    { id: "trading", label: "Trading Account", icon: ShoppingCart },
    { id: "profit-loss", label: "Profit & Loss A/c", icon: TrendingUp },
    { id: "balance-sheet", label: "Balance Sheet", icon: Scale, asOf: true },
    { id: "cash-flow", label: "Cash Flow Statement", icon: ArrowLeftRight },
    { id: "fund-flow", label: "Fund Flow Statement", icon: GitCompare },
  ] },
  { group: "Books of Account", items: [
    { id: "day-book", label: "Day Book", icon: BookOpen },
    { id: "general-ledger", label: "General Ledger", icon: ScrollText },
    { id: "cash-book", label: "Cash Book", icon: Wallet },
    { id: "bank-book", label: "Bank Book", icon: Landmark },
    { id: "journal-register", label: "Journal Register", icon: NotebookPen },
  ] },
  { group: "More Reports (coming soon)", items: [
    { id: "ledger-summary", label: "Ledger Summary", icon: ScrollText, soon: true },
    { id: "group-summary", label: "Group Summary", icon: FileBarChart, soon: true },
    { id: "receivables-ageing", label: "Receivables Ageing", icon: Clock, soon: true },
    { id: "payables-ageing", label: "Payables Ageing", icon: Clock, soon: true },
    { id: "gst-summary", label: "GST Summary", icon: FileBarChart, soon: true },
    { id: "ratio-analysis", label: "Ratio Analysis", icon: TrendingUp, soon: true },
  ] },
];
const ALL = GROUPS.flatMap((g) => g.items);

export function FinancialReportsView() {
  const [selected, setSelected] = useState<Rep | null>(null);

  // Deep-link: /finance/reports?report=<id> selects that report. Reactive to the
  // query param so switching reports from the sidebar works even while already on
  // this page (soft navigation only changes the query, not the mounted component).
  const reportParam = useSearchParams().get("report");
  useEffect(() => {
    if (!reportParam) return;
    const r = ALL.find((x) => x.id === reportParam);
    if (r && !r.soon) setSelected(r);
  }, [reportParam]);

  if (!selected) {
    return (
      <div className="space-y-6">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Finance</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Financial Reports</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileBarChart className="h-5 w-5 text-primary" /> Financial Reports</h1>
          <p className="mt-0.5 text-sm text-muted">Statements &amp; books of account, computed live from the double-entry ledger.</p>
        </div>
        {GROUPS.map((g) => (
          <div key={g.group}>
            <h2 className="mb-3 text-sm font-semibold text-foreground">{g.group}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.items.map((r) => (
                <button key={r.id} onClick={() => !r.soon && setSelected(r)} disabled={r.soon}
                  className={cn("group flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition", r.soon ? "cursor-not-allowed border-border opacity-60" : "border-border hover:border-primary hover:shadow-md")}>
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg transition", r.soon ? "bg-surface-2 text-subtle" : "bg-primary-subtle text-primary group-hover:bg-brand-gradient group-hover:text-white")}><r.icon className="h-5 w-5" /></span>
                  <span className="flex-1 text-sm font-semibold text-foreground">{r.label}{r.soon && <Badge tone="neutral" className="ml-1.5">Soon</Badge>}</span>
                  {!r.soon && <ArrowRight className="h-4 w-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-primary" />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <ReportDetail rep={selected} onBack={() => setSelected(null)} />;
}

function ReportDetail({ rep, onBack }: { rep: Rep; onBack: () => void }) {
  const [from, setFrom] = useState(fyStart);
  const [to, setTo] = useState(todayStr);
  const [code, setCode] = useState("3000");
  const [data, setData] = useState<any>(null);
  const [dataKey, setDataKey] = useState("");
  const [accounts, setAccounts] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const key = useMemo(() => `${rep.id}|${from}|${to}|${code}`, [rep.id, from, to, code]);

  useEffect(() => {
    let active = true; setLoading(true);
    (async () => {
      try {
        const u = new URLSearchParams({ report: rep.id, to }); if (!rep.asOf) u.set("from", from); if (rep.id === "general-ledger") u.set("code", code);
        const j = await fetch(`/api/finance/reports?${u}`, { cache: "no-store" }).then((r) => r.json());
        if (!active) return;
        if (j.ok) { setData(j.data); setDataKey(key); if (j.accounts) setAccounts(j.accounts); }
      } catch { /* */ } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [key, rep.id, rep.asOf, from, to, code]);

  // Only render once the loaded data matches the current request (prevents a
  // stale-shape crash while a new report/period is loading).
  const ready = !loading && data && dataKey === key;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <button onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> All Reports</button>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><rep.icon className="h-5 w-5 text-primary" /> {rep.label}</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {!rep.asOf && <div><label className="mb-1 block text-2xs font-semibold text-muted">From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div>}
          <div><label className="mb-1 block text-2xs font-semibold text-muted">{rep.asOf ? "As on" : "To"}</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div>
          {rep.id === "general-ledger" && <div><label className="mb-1 block text-2xs font-semibold text-muted">Account</label><select value={code} onChange={(e) => setCode(e.target.value)} className={cn(inp, "w-48")}>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></div>}
          <button onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-muted hover:border-primary hover:text-primary"><Printer className="h-3.5 w-3.5" /> Print</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
          <span className="text-sm font-bold text-foreground">{rep.label}</span>
          <span className="text-2xs text-muted">{rep.asOf ? `As on ${to}` : `${from} → ${to}`}</span>
        </div>
        {!ready ? <div className="p-10"><AppLoader label="Computing…" size="sm" /></div> : <div className="p-4">{renderReport(rep.id, data)}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- renderers */
function renderReport(report: string, d: any) {
  if (!d) return <Empty />;
  switch (report) {
    case "trial-balance": return <TrialBalance d={d} />;
    case "trading": return <Trading d={d} />;
    case "profit-loss": return <ProfitLoss d={d} />;
    case "balance-sheet": return <BalanceSheet d={d} />;
    case "cash-flow": return <CashFlow d={d} />;
    case "fund-flow": return <FundFlow d={d} />;
    case "day-book":
    case "journal-register": return <DayBook d={d} />;
    case "cash-book":
    case "bank-book":
    case "general-ledger": return <Ledger d={d} />;
    default: return <Empty />;
  }
}
const Empty = () => <p className="py-8 text-center text-sm text-muted">No data for this period.</p>;
const Th = ({ children, r }: { children?: React.ReactNode; r?: boolean }) => <th className={cn("px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-subtle", r ? "text-right" : "text-left")}>{children}</th>;
const Td = ({ children, r, b }: { children?: React.ReactNode; r?: boolean; b?: boolean }) => <td className={cn("px-3 py-1.5 tabular-nums", r && "text-right", b && "font-bold text-foreground")}>{children}</td>;
const money = (n: number) => (n ? inr(n) : "—");

function TrialBalance({ d }: { d: any }) {
  const ok = Math.abs(d.totals.debit - d.totals.credit) < 0.05;
  return (
    <>
      <table className="w-full text-sm">
        <thead className="border-b border-border"><tr><Th>Code</Th><Th>Account</Th><Th>Type</Th><Th r>Debit</Th><Th r>Credit</Th></tr></thead>
        <tbody>{d.rows.map((r: any, i: number) => <tr key={i} className="border-b border-border/60"><Td>{r.code}</Td><Td>{r.name}</Td><Td><span className="text-2xs text-muted">{r.type}</span></Td><Td r>{money(r.debit)}</Td><Td r>{money(r.credit)}</Td></tr>)}</tbody>
        <tfoot><tr className="border-t-2 border-border bg-surface-2"><Td b>Total</Td><Td /><Td /><Td r b>{inr(d.totals.debit)}</Td><Td r b>{inr(d.totals.credit)}</Td></tr></tfoot>
      </table>
      <p className={cn("pt-2 text-2xs font-medium", ok ? "text-success" : "text-danger")}>{ok ? "✓ Debits equal credits." : "⚠ Out of balance."}</p>
    </>
  );
}

function SimpleList({ rows }: { rows: any[] }) {
  if (!rows?.length) return <div className="py-1 text-2xs text-muted">—</div>;
  return <>{rows.map((r, i) => <div key={i} className="flex items-center justify-between border-b border-border/50 py-1 text-sm"><span className="text-foreground">{r.name}</span><span className="tabular-nums text-foreground">{inr(r.amount)}</span></div>)}</>;
}

function Trading({ d }: { d: any }) {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Box title="Sales / Direct Income"><SimpleList rows={d.revenue} /><Row k="Total Revenue" v={inr(d.revenueTotal)} bold /></Box>
      <Box title="Direct Costs (COGS)"><SimpleList rows={d.costs} /><Row k="Total Direct Cost" v={inr(d.costsTotal)} bold /></Box>
      <Result label={d.grossProfit >= 0 ? "Gross Profit" : "Gross Loss"} value={Math.abs(d.grossProfit)} positive={d.grossProfit >= 0} />
    </div>
  );
}

function ProfitLoss({ d }: { d: any }) {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Box title="Gross Profit (Sales − COGS)"><Row k="Gross Profit b/d" v={inr(d.grossProfit)} bold /></Box>
      <Box title="Indirect Income"><SimpleList rows={d.indirectIncome} /><Row k="Total" v={inr(d.indirectIncomeTotal)} bold /></Box>
      <Box title="Indirect Expenses"><SimpleList rows={d.indirectExpense} /><Row k="Total" v={inr(d.indirectExpenseTotal)} bold /></Box>
      <Result label={d.netProfit >= 0 ? "Net Profit" : "Net Loss"} value={Math.abs(d.netProfit)} positive={d.netProfit >= 0} />
    </div>
  );
}

function BalanceSheet({ d }: { d: any }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Box title="Assets"><SimpleList rows={d.assets} /><Row k="Total Assets" v={inr(d.assetsTotal)} bold /></Box>
      <Box title="Liabilities & Equity">
        <SimpleList rows={d.liabilities} />
        {d.equity.map((e: any, i: number) => <div key={i} className="flex items-center justify-between border-b border-border/50 py-1 text-sm"><span className="text-foreground">{e.name}</span><span className="tabular-nums">{inr(e.amount)}</span></div>)}
        <div className="flex items-center justify-between border-b border-border/50 py-1 text-sm"><span className="text-foreground">Retained Earnings (P&amp;L)</span><span className={cn("tabular-nums", d.netProfit >= 0 ? "text-success" : "text-danger")}>{inr(d.netProfit)}</span></div>
        <Row k="Total Liabilities & Equity" v={inr(d.liabAndEquityTotal)} bold />
      </Box>
      <div className={cn("lg:col-span-2 rounded-lg px-4 py-2 text-center text-2xs font-medium", d.balanced ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger")}>{d.balanced ? "✓ Assets equal Liabilities + Equity." : "⚠ Balance sheet does not tie out."}</div>
    </div>
  );
}

function CashFlow({ d }: { d: any }) {
  return (
    <div className="mx-auto max-w-xl space-y-1.5 text-sm">
      <Row k="Opening Cash & Bank" v={inr(d.openingBalance)} />
      <div className="my-1 h-px bg-border" />
      {d.rows.length ? d.rows.map((r: any, i: number) => <div key={i} className="flex items-center justify-between py-1"><span className="text-foreground">{r.label}</span><span className={cn("tabular-nums font-medium", r.net >= 0 ? "text-success" : "text-danger")}>{r.net >= 0 ? "+" : "−"} {inr(Math.abs(r.net))}</span></div>) : <div className="py-1 text-2xs text-muted">No cash movement.</div>}
      <div className="my-1 h-px bg-border" />
      <Row k="Net Cash Flow" v={`${d.netChange >= 0 ? "+" : "−"} ${inr(Math.abs(d.netChange))}`} bold />
      <Row k="Closing Cash & Bank" v={inr(d.closingBalance)} bold />
    </div>
  );
}

function FundFlow({ d }: { d: any }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Box title="Sources of Funds"><SimpleList rows={d.sources.map((s: any) => ({ name: s.label, amount: s.amount }))} /><Row k="Total Sources" v={inr(d.sourcesTotal)} bold /></Box>
      <Box title="Application of Funds"><SimpleList rows={d.applications.map((s: any) => ({ name: s.label, amount: s.amount }))} /><Row k="Total Applications" v={inr(d.applicationsTotal)} bold /></Box>
      <div className="lg:col-span-2 flex items-center justify-between rounded-lg bg-primary-subtle/50 px-4 py-2.5 text-sm font-bold text-primary"><span>Net Increase / (Decrease) in Funds</span><span>{inr(d.netChangeInFunds)}</span></div>
    </div>
  );
}

function DayBook({ d }: { d: any }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border"><tr><Th>Date</Th><Th>Voucher</Th><Th>Type</Th><Th>Narration / Accounts</Th><Th r>Debit</Th><Th r>Credit</Th></tr></thead>
        <tbody>
          {d.rows.length ? d.rows.map((e: any, i: number) => (
            <tr key={i} className={cn("border-b border-border/60 align-top", e.status === "Reversed" && "opacity-60")}>
              <Td>{e.date}</Td>
              <Td><span className="font-mono text-xs font-semibold text-primary">{e.voucherNo}</span>{e.refNo && <div className="text-2xs text-subtle">{e.refNo}</div>}</Td>
              <Td><span className="text-2xs text-muted">{e.voucherType}</span></Td>
              <Td><div className="text-2xs text-muted">{e.narration}</div><div className="mt-0.5 space-y-0.5">{e.lines.map((l: any, j: number) => <div key={j} className="text-2xs"><span className="font-mono text-subtle">{l.code}</span> {l.account} <span className="text-subtle">{l.debit ? `Dr ${inr(l.debit)}` : `Cr ${inr(l.credit)}`}</span></div>)}</div></Td>
              <Td r>{money(e.debit)}</Td><Td r>{money(e.credit)}</Td>
            </tr>
          )) : <tr><td colSpan={6}><Empty /></td></tr>}
        </tbody>
        <tfoot><tr className="border-t-2 border-border bg-surface-2"><Td b>Total</Td><Td /><Td /><Td /><Td r b>{inr(d.totals.debit)}</Td><Td r b>{inr(d.totals.credit)}</Td></tr></tfoot>
      </table>
    </div>
  );
}

function Ledger({ d }: { d: any }) {
  if (!d) return <p className="py-8 text-center text-sm text-muted">Account not found.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="mb-2 text-sm font-bold text-foreground"><span className="font-mono text-xs text-subtle">{d.account.code}</span> · {d.account.name} <span className="text-2xs font-normal text-muted">({d.account.type})</span></div>
      <table className="w-full text-sm">
        <thead className="border-b border-border"><tr><Th>Date</Th><Th>Voucher</Th><Th>Narration</Th><Th r>Debit</Th><Th r>Credit</Th><Th r>Balance</Th></tr></thead>
        <tbody>
          <tr className="border-b border-border/60 bg-surface-2/40"><Td>—</Td><Td /><Td><span className="font-semibold text-foreground">Opening Balance</span></Td><Td /><Td /><Td r b>{inr(d.openingBalance)}</Td></tr>
          {d.rows.map((r: any, i: number) => (
            <tr key={i} className="border-b border-border/60">
              <Td>{r.date}</Td>
              <Td><span className="font-mono text-xs font-semibold text-primary">{r.voucherNo}</span></Td>
              <Td><span className="text-2xs text-muted">{r.narration}{r.refNo ? ` · ${r.refNo}` : ""}</span></Td>
              <Td r>{money(r.debit)}</Td><Td r>{money(r.credit)}</Td><Td r b>{inr(r.balance)}</Td>
            </tr>
          ))}
          {d.rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-muted">No movements in this period.</td></tr>}
        </tbody>
        <tfoot><tr className="border-t-2 border-border bg-surface-2"><Td b>Total · Closing</Td><Td /><Td /><Td r b>{inr(d.totals.debit)}</Td><Td r b>{inr(d.totals.credit)}</Td><Td r b>{inr(d.totals.closing)}</Td></tr></tfoot>
      </table>
    </div>
  );
}

const inp = "h-9 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none";
function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-surface-2/30 p-3"><p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-subtle">{title}</p>{children}</div>;
}
function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={cn("flex items-center justify-between py-1", bold && "mt-1 border-t border-border pt-2 font-bold text-foreground")}><span className={bold ? "" : "text-muted"}>{k}</span><span className="tabular-nums">{v}</span></div>;
}
function Result({ label, value, positive }: { label: string; value: number; positive: boolean }) {
  return <div className={cn("flex items-center justify-between rounded-lg px-4 py-3 text-base font-bold", positive ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger")}><span>{label}</span><span>{inr(value)}</span></div>;
}

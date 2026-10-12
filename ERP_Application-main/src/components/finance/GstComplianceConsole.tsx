"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, ShieldCheck, GitCompareArrows, Wallet, FileText, FileSpreadsheet,
  FileJson, FileBarChart, Lock, History, ScrollText, Play, RefreshCw, Download, Printer, CheckCircle2, XCircle, AlertTriangle, Info, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { downloadCsv, downloadExcel, printTable } from "@/lib/export/download";
import type {
  GstHeader, GstKpis, GstDashboard, GstVerificationSummary, GstValidationRow, GstItcReport,
  GstReconResult, GstReturnRow, GstJsonExportRow, GstFilingRow, GstPeriodRow, GstReport, GstAuditRow,
} from "@/lib/contracts/gstCompliance";

const API = "/api/finance/gst-compliance";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "verify", label: "Verification", icon: ShieldCheck },
  { id: "recon", label: "GSTR-2B Recon", icon: GitCompareArrows },
  { id: "itc", label: "Input Tax Credit", icon: Wallet },
  { id: "gstr1", label: "GSTR-1", icon: FileText },
  { id: "gstr3b", label: "GSTR-3B", icon: FileSpreadsheet },
  { id: "json", label: "JSON Export", icon: FileJson },
  { id: "reports", label: "Reports", icon: FileBarChart },
  { id: "closing", label: "Period Closing", icon: Lock },
  { id: "filing", label: "Filing History", icon: History },
  { id: "audit", label: "Audit Trail", icon: ScrollText },
] as const;
type TabId = (typeof TABS)[number]["id"];

function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

export function GstComplianceConsole() {
  const toast = useToast();
  const fmt = useFmt();
  const inr = (n: number) => fmt.money(n || 0);
  const [period, setPeriod] = useState(thisMonth());
  const [tab, setTab] = useState<TabId>("dashboard");
  const [header, setHeader] = useState<GstHeader | null>(null);
  const [cache, setCache] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const ckey = (t: string) => `${t}:${period}`;

  const loadHeader = useCallback(async () => {
    const j = await fetch(`${API}/header?period=${period}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) setHeader(j.data);
  }, [period]);

  const loadTab = useCallback(async (t: TabId, force = false) => {
    const section = t === "json" ? "json-exports" : t === "closing" ? "periods" : t === "reports" ? "" : t;
    if (t === "reports") return; // reports load on demand by key
    if (!force && cache[ckey(t)] !== undefined) return;
    setLoading(true);
    const j = await fetch(`${API}/${section}?period=${period}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    setCache((c) => ({ ...c, [ckey(t)]: j?.ok ? j.data : null }));
    setLoading(false);
  }, [period, cache]);

  useEffect(() => { loadHeader(); }, [loadHeader]);
  useEffect(() => { setCache({}); }, [period]);
  useEffect(() => { loadTab(tab); /* eslint-disable-next-line */ }, [tab, period]);

  const action = useCallback(async (body: Record<string, unknown>, okMsg?: string): Promise<{ ok: boolean; id?: number; data?: unknown }> => {
    setBusy(true);
    const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ ok: false, message: "Network error." }));
    setBusy(false);
    toast.result(j, okMsg);
    return j;
  }, [toast]);

  const reload = (t: TabId) => loadTab(t, true);
  const data = cache[ckey(tab)] as unknown;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-sm"><ShieldCheck className="h-6 w-6" /></span>
            <div className="min-w-0">
              <div className="mb-0.5 flex items-center gap-2 text-xs text-muted"><span>Finance</span><span className="text-subtle">/</span><span>GST Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">GST Compliance</span></div>
              <h1 className="truncate text-lg font-bold tracking-tight text-foreground">{header?.legalName || "GST Compliance & Statutory Management"}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-subtle">
                <span>GSTIN: <b className="text-foreground">{header?.gstin || "—"}</b></span>
                <span>{header?.regType} · {header?.filingFrequency}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-muted">Period</label>
              <input type="month" value={period} onChange={(e) => setPeriod(e.target.value || thisMonth())} className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none" />
            </div>
            {header && (header.periodLocked ? <Badge tone="danger"><Lock className="h-3 w-3" /> Locked</Badge> : <Badge tone={header.closingStatus === "Verified" ? "info" : "success"}>{header.closingStatus}</Badge>)}
            <Button size="sm" variant="outline" disabled={busy} onClick={async () => { const j = await action({ action: "verify", period }, "Verification complete."); if (j.ok) { reload("verify"); reload("dashboard"); setTab("verify"); } }}><ShieldCheck className="h-3.5 w-3.5" /> Verify</Button>
          </div>
        </div>
        {header && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs sm:grid-cols-4">
            <HeaderChip label="Tax Period" value={header.periodLabel} />
            <HeaderChip label="GSTR-1 Due" value={header.gstr1DueDate} />
            <HeaderChip label="GSTR-3B Due" value={header.returnDueDate} />
            <HeaderChip label="State Code" value={header.stateCode || "—"} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 -mx-1 overflow-x-auto rounded-xl border border-border bg-card/95 px-1 py-1 shadow-sm backdrop-blur">
        <div className="flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon; const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition", active ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-surface-2 hover:text-foreground")}>
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div>
        {loading && tab !== "reports" ? <Loader /> : null}
        {tab === "dashboard" && <DashboardTab data={data as GstDashboard | null} inr={inr} />}
        {tab === "verify" && <VerifyTab data={data as GstVerificationSummary | null} period={period} busy={busy} action={action} reload={() => reload("verify")} />}
        {tab === "recon" && <ReconTab data={data as GstReconResult | null} period={period} busy={busy} action={action} reload={() => reload("recon")} inr={inr} />}
        {tab === "itc" && <ItcTab data={data as GstItcReport | null} period={period} header={header} inr={inr} />}
        {tab === "gstr1" && <ReturnTab type="GSTR-1" data={data as ReturnTabData | null} period={period} busy={busy} action={action} reload={() => reload("gstr1")} inr={inr} />}
        {tab === "gstr3b" && <ReturnTab type="GSTR-3B" data={data as ReturnTabData | null} period={period} busy={busy} action={action} reload={() => reload("gstr3b")} inr={inr} />}
        {tab === "json" && <JsonTab data={data as GstJsonExportRow[] | null} />}
        {tab === "reports" && <ReportsTab period={period} header={header} inr={inr} />}
        {tab === "closing" && <ClosingTab data={data as GstPeriodRow[] | null} busy={busy} action={action} reload={() => reload("closing")} />}
        {tab === "filing" && <FilingTab data={data as GstFilingRow[] | null} />}
        {tab === "audit" && <AuditTab data={data as GstAuditRow[] | null} />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ shared bits

type Action = (body: Record<string, unknown>, okMsg?: string) => Promise<{ ok: boolean; id?: number; data?: unknown }>;

function Loader() { return <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted"><RefreshCw className="h-4 w-4 animate-spin" /> Loading…</div>; }
function Empty({ msg }: { msg: string }) { return <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted"><span className="grid h-10 w-10 place-items-center rounded-full bg-surface-2"><Info className="h-5 w-5 text-subtle" /></span>{msg}</div>; }
function HeaderChip({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border bg-surface-2/40 px-2.5 py-1.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-subtle">{label}</p><p className="truncate text-sm font-semibold text-foreground">{value}</p></div>; }
function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><span className="h-3.5 w-1 rounded-full bg-primary" />{title}</p>{action}</div>{children}</div>;
}
const sevTone = (s: string): "danger" | "warning" | "info" => (s === "Error" ? "danger" : s === "Warning" ? "warning" : "info");
const statusTone = (s: string) => {
  if (["Filed", "Approved", "Matched", "Locked"].includes(s)) return "success" as const;
  if (["Mismatch", "MissingInErp", "Rejected"].includes(s)) return "danger" as const;
  if (["Verified", "ReadyForFiling", "PartiallyMatched", "Prepared"].includes(s)) return "info" as const;
  if (["Pending", "Draft", "SupplierNotFiled", "Open"].includes(s)) return "warning" as const;
  return "neutral" as const;
};

function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-surface-2/60 text-xs uppercase tracking-wide text-subtle">{head}</thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

type ExportCol = { key: string; label: string; money?: boolean; qty?: boolean };
/** Reusable CSV + Excel (+ optional Print) toolbar for any table. */
function ExportBar({ columns, rows, fileName, title, subtitle, totals, print = true }: { columns: ExportCol[]; rows: Record<string, unknown>[]; fileName: string; title: string; subtitle?: string; totals?: Record<string, number>; print?: boolean }) {
  const disabled = !rows.length;
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => downloadCsv(columns, rows, `${fileName}.csv`)}><Download className="h-3.5 w-3.5" /> CSV</Button>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => downloadExcel(columns, rows, `${fileName}.xls`, { title, totals })}><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</Button>
      {print && <Button size="sm" variant="outline" disabled={disabled} onClick={() => printTable({ title, subtitle, columns, rows, totals })}><Printer className="h-3.5 w-3.5" /> Print</Button>}
    </div>
  );
}

// ------------------------------------------------------------------- Dashboard

const KPI_DEF: { key: keyof GstKpis; label: string; money?: boolean; tone: string }[] = [
  { key: "totalSales", label: "Total Sales", money: true, tone: "primary" },
  { key: "totalPurchase", label: "Total Purchase", money: true, tone: "info" },
  { key: "taxableSales", label: "Taxable Sales", money: true, tone: "primary" },
  { key: "taxablePurchase", label: "Taxable Purchase", money: true, tone: "info" },
  { key: "outputCgst", label: "Output CGST", money: true, tone: "accent" },
  { key: "outputSgst", label: "Output SGST", money: true, tone: "accent" },
  { key: "outputIgst", label: "Output IGST", money: true, tone: "accent" },
  { key: "inputCgst", label: "Input CGST", money: true, tone: "success" },
  { key: "inputSgst", label: "Input SGST", money: true, tone: "success" },
  { key: "inputIgst", label: "Input IGST", money: true, tone: "success" },
  { key: "eligibleItc", label: "Eligible ITC", money: true, tone: "success" },
  { key: "blockedItc", label: "Blocked ITC", money: true, tone: "danger" },
  { key: "gstPayable", label: "GST Payable", money: true, tone: "danger" },
  { key: "gstReceivable", label: "GST Receivable", money: true, tone: "success" },
  { key: "pendingReconciliation", label: "Pending Recon", tone: "warning" },
  { key: "gstMismatches", label: "GST Mismatches", tone: "danger" },
  { key: "returnsPending", label: "Returns Pending", tone: "warning" },
  { key: "returnsFiled", label: "Returns Filed", tone: "success" },
];
const KTONE: Record<string, string> = { primary: "text-primary", info: "text-info", success: "text-success", danger: "text-danger", warning: "text-warning", accent: "text-accent-foreground" };

function DashboardTab({ data, inr }: { data: GstDashboard | null; inr: (n: number) => string }) {
  if (!data) return <Empty msg="No dashboard data for this period." />;
  const k = data.kpis;
  return (
    <div className="space-y-4">
      {data.alerts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {data.alerts.map((a, i) => (
            <div key={i} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", a.severity === "Error" ? "border-danger/30 bg-danger-subtle/40 text-danger" : "border-warning/30 bg-warning-subtle/40 text-warning")}>
              <AlertTriangle className="h-4 w-4 shrink-0" /><b>{a.type}:</b> {a.message}
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiTile label="GST Period" value={data.header.periodLabel} tone="primary" />
        {KPI_DEF.map((d) => <KpiTile key={d.key} label={d.label} value={d.money ? inr(Number(k[d.key])) : String(k[d.key])} tone={d.tone} />)}
        <KpiTile label="Return Due" value={k.returnDueDate || data.header.returnDueDate} tone="warning" />
        <KpiTile label="Filing Status" value={k.filingStatus} tone={k.filingStatus === "Filed" ? "success" : "warning"} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Monthly GST Collection (Output Tax)"><BarChart data={data.charts.monthlyCollection} color="#6366f1" inr={inr} /></Card>
        <Card title="Monthly ITC"><BarChart data={data.charts.monthlyItc} color="#22c55e" inr={inr} /></Card>
        <Card title="Output vs Input GST"><DualBar data={data.charts.outputVsInput} a="Output" b="ITC" inr={inr} /></Card>
        <Card title="GST Liability Trend"><BarChart data={data.charts.liabilityTrend} color="#f59e0b" inr={inr} /></Card>
        <Card title="Sales GST vs Purchase GST"><DualBar data={data.charts.salesVsPurchaseGst} a="Sales" b="Purchase" inr={inr} /></Card>
        <Card title="GST Filing Status"><Donut data={data.charts.filingStatus} /></Card>
      </div>
    </div>
  );
}

function KpiTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="rounded-xl border border-border bg-card p-3 shadow-sm"><p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p><p className={cn("mt-1.5 truncate text-[15px] font-bold leading-tight", KTONE[tone] || "text-foreground")} title={value}>{value}</p></div>;
}

function BarChart({ data, color, inr }: { data: { name: string; value: number }[]; color: string; inr: (n: number) => string }) {
  if (!data.length) return <Empty msg="No data." />;
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div className="flex h-44 items-end justify-between gap-2">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[9px] font-semibold text-muted">{inr(d.value).replace(/\.00$/, "")}</span>
          <div className="w-full rounded-t" style={{ height: `${Math.max(2, (Math.abs(d.value) / max) * 130)}px`, background: color, opacity: d.value < 0 ? 0.5 : 1 }} />
          <span className="text-[10px] text-subtle">{d.name}</span>
        </div>
      ))}
    </div>
  );
}
function DualBar({ data, a, b, inr }: { data: { name: string; a: number; b: number }[]; a: string; b: string; inr: (n: number) => string }) {
  if (!data.length) return <Empty msg="No data." />;
  const max = Math.max(...data.flatMap((d) => [d.a, d.b]), 1);
  return (
    <div>
      <div className="flex h-40 items-end justify-between gap-3">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <div className="flex w-full items-end justify-center gap-0.5" style={{ height: 130 }}>
              <div className="w-1/2 rounded-t bg-primary" style={{ height: `${Math.max(2, (d.a / max) * 130)}px` }} title={`${a}: ${inr(d.a)}`} />
              <div className="w-1/2 rounded-t bg-success" style={{ height: `${Math.max(2, (d.b / max) * 130)}px` }} title={`${b}: ${inr(d.b)}`} />
            </div>
            <span className="text-[10px] text-subtle">{d.name}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />{a}</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" />{b}</span></div>
    </div>
  );
}
function Donut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <Empty msg="No data." />;
  const colors = ["#22c55e", "#f59e0b", "#ef4444", "#6366f1"];
  let acc = 0;
  const segs = data.map((d, i) => { const start = acc / total; acc += d.value; return { ...d, start, end: acc / total, color: colors[i % colors.length] }; });
  const grad = segs.map((s) => `${s.color} ${s.start * 360}deg ${s.end * 360}deg`).join(", ");
  return (
    <div className="flex items-center justify-center gap-6 py-2">
      <div className="relative h-32 w-32 rounded-full" style={{ background: `conic-gradient(${grad})` }}><div className="absolute inset-[22%] grid place-items-center rounded-full bg-card text-center"><span className="text-lg font-bold text-foreground">{total}</span></div></div>
      <div className="space-y-1.5">{segs.map((s, i) => <div key={i} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /><span className="text-muted">{s.name}</span><span className="font-semibold text-foreground">{s.value}</span></div>)}</div>
    </div>
  );
}

// ----------------------------------------------------------------- Verification

function VerifyTab({ data, period, busy, action, reload }: { data: GstVerificationSummary | null; period: string; busy: boolean; action: Action; reload: () => void }) {
  const run = async () => { const j = await action({ action: "verify", period }, "Verification complete."); if (j.ok) reload(); };
  const resolve = async (id: number, status: string) => { const j = await action({ action: "resolveValidation", id, status }, "Updated."); if (j.ok) reload(); };
  if (!data) return <div className="space-y-3"><div className="flex justify-end"><Button size="sm" disabled={busy} onClick={run}><Play className="h-3.5 w-3.5" /> Run Verification</Button></div><Empty msg="No verification run yet for this period. Click Run Verification." /></div>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Stat label="Errors" value={data.errors} tone="danger" />
          <Stat label="Warnings" value={data.warnings} tone="warning" />
          <Stat label="Information" value={data.info} tone="info" />
          <Stat label="Open" value={data.open} tone="warning" />
          <Stat label="Resolved" value={data.resolved} tone="success" />
        </div>
        <div className="flex gap-2">
          <ExportBar columns={[{ key: "severity", label: "Severity" }, { key: "checkCode", label: "Check" }, { key: "sourceType", label: "Source" }, { key: "docNo", label: "Doc" }, { key: "partyName", label: "Party" }, { key: "message", label: "Message" }, { key: "status", label: "Status" }]} rows={data.rows as unknown as Record<string, unknown>[]} fileName={`gst-verification-${period}`} title="GST Transaction Verification" subtitle={period} />
          <Button size="sm" disabled={busy} onClick={run}><RefreshCw className="h-3.5 w-3.5" /> Re-run</Button>
        </div>
      </div>
      {!data.rows.length ? <Empty msg="No issues found — all GST transactions look clean." /> : (
        <Table head={<tr><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Check</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Doc</th><th className="px-3 py-2">Party</th><th className="px-3 py-2">Message</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
          {data.rows.map((r: GstValidationRow) => (
            <tr key={r.id} className="hover:bg-surface-2/30">
              <td className="px-3 py-2"><Badge tone={sevTone(r.severity)}>{r.severity}</Badge></td>
              <td className="px-3 py-2 font-mono text-xs text-muted">{r.checkCode}</td>
              <td className="px-3 py-2 text-xs">{r.sourceType}</td>
              <td className="px-3 py-2 font-medium text-foreground">{r.docNo}</td>
              <td className="px-3 py-2 text-muted">{r.partyName}</td>
              <td className="px-3 py-2 text-xs text-muted">{r.message}</td>
              <td className="px-3 py-2"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
              <td className="px-3 py-2 text-right">
                {r.status === "Open" ? (
                  <div className="flex justify-end gap-1">
                    <button onClick={() => resolve(r.id, "Ignored")} className="rounded px-1.5 py-0.5 text-xs font-semibold text-muted hover:bg-surface-2">Ignore</button>
                    <button onClick={() => resolve(r.id, "Approved")} className="rounded px-1.5 py-0.5 text-xs font-semibold text-success hover:bg-success-subtle">Approve</button>
                  </div>
                ) : <span className="text-xs text-subtle">{r.resolvedByName}</span>}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-lg border border-border bg-card px-3 py-1.5 shadow-sm"><span className={cn("text-base font-bold", KTONE[tone])}>{value}</span> <span className="text-xs text-muted">{label}</span></div>;
}

// ------------------------------------------------------------------ Recon

function ReconTab({ data, period, busy, action, reload, inr }: { data: GstReconResult | null; period: string; busy: boolean; action: Action; reload: () => void; inr: (n: number) => string }) {
  const [raw, setRaw] = useState("");
  const [show, setShow] = useState(false);
  const doImport = async () => { const j = await action({ action: "import2b", period, source: "JSON", rawJson: raw }, "Imported & reconciled."); if (j.ok) { setRaw(""); setShow(false); reload(); } };
  const runRecon = async () => { const j = await action({ action: "runRecon", period }, "Reconciled."); if (j.ok) reload(); };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Compare your ERP purchase register with the imported GSTR-2B from the GST portal.</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShow((s) => !s)}><Upload className="h-3.5 w-3.5" /> Import GSTR-2B</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={runRecon}><RefreshCw className="h-3.5 w-3.5" /> Re-reconcile</Button>
        </div>
      </div>
      {show && (
        <Card title="Import GSTR-2B (JSON)">
          <p className="mb-2 text-xs text-muted">Paste the GST-portal GSTR-2B JSON (or a normalised <code>{`{ "rows": [...] }`}</code> array). Excel & API import are supported by the same pipeline.</p>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} placeholder='{ "data": { "docdata": { "b2b": [ ... ] } } }' className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none" />
          <div className="mt-2 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setShow(false)}>Cancel</Button><Button size="sm" disabled={busy || !raw.trim()} onClick={doImport}><Upload className="h-3.5 w-3.5" /> Import & Reconcile</Button></div>
        </Card>
      )}
      {!data ? <Empty msg="No reconciliation data." /> : (
        <>
          <div className="flex flex-wrap gap-2">
            <Stat label="Imported" value={data.imported} tone="info" />
            <Stat label="Matched" value={data.matched} tone="success" />
            <Stat label="Partial" value={data.partially} tone="info" />
            <Stat label="Mismatch" value={data.mismatch} tone="danger" />
            <Stat label="Missing in ERP" value={data.missingInErp} tone="warning" />
            <Stat label="Not in 2B" value={data.missingInPortal} tone="warning" />
          </div>
          {data.rows.length > 0 && (
            <Card title="Reconciliation Result" action={<ExportBar columns={[{ key: "supplierGstin", label: "GSTIN" }, { key: "supplierName", label: "Supplier" }, { key: "invoiceNo", label: "Invoice" }, { key: "invoiceDate", label: "Date" }, { key: "erpTaxable", label: "ERP Taxable", money: true }, { key: "erpGst", label: "ERP GST", money: true }, { key: "portalTaxable", label: "Portal Taxable", money: true }, { key: "portalGst", label: "Portal GST", money: true }, { key: "gstDifference", label: "Diff", money: true }, { key: "status", label: "Status" }, { key: "issue", label: "Issue" }]} rows={data.rows as unknown as Record<string, unknown>[]} fileName={`gst-recon-${period}`} title="GSTR-2B Reconciliation" subtitle={period} />}>
              <Table head={<tr><th className="px-3 py-2">GSTIN</th><th className="px-3 py-2">Supplier</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2 text-right">ERP GST</th><th className="px-3 py-2 text-right">Portal GST</th><th className="px-3 py-2 text-right">Diff</th><th className="px-3 py-2">Status</th></tr>}>
                {data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2/30">
                    <td className="px-3 py-2 font-mono text-xs">{r.supplierGstin}</td>
                    <td className="px-3 py-2 text-muted">{r.supplierName}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{r.invoiceNo}</td>
                    <td className="px-3 py-2 text-right">{inr(r.erpGst)}</td>
                    <td className="px-3 py-2 text-right">{inr(r.portalGst)}</td>
                    <td className={cn("px-3 py-2 text-right font-semibold", Math.abs(r.gstDifference) > 0.5 ? "text-danger" : "text-muted")}>{inr(r.gstDifference)}</td>
                    <td className="px-3 py-2"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
          {data.importRows.length > 0 && (
            <Card title="Imported GSTR-2B Invoices" action={<ExportBar columns={[{ key: "supplierGstin", label: "GSTIN" }, { key: "supplierName", label: "Supplier" }, { key: "invoiceNo", label: "Invoice" }, { key: "invoiceDate", label: "Date" }, { key: "invoiceValue", label: "Value", money: true }, { key: "gstAmount", label: "GST", money: true }, { key: "eligibleItc", label: "Eligible ITC", money: true }, { key: "itcStatus", label: "ITC Status" }, { key: "matchStatus", label: "Match" }]} rows={data.importRows as unknown as Record<string, unknown>[]} fileName={`gstr2b-import-${period}`} title="Imported GSTR-2B Invoices" subtitle={period} />}>
              <Table head={<tr><th className="px-3 py-2">GSTIN</th><th className="px-3 py-2">Supplier</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2 text-right">GST</th><th className="px-3 py-2 text-right">Eligible ITC</th><th className="px-3 py-2">Match</th></tr>}>
                {data.importRows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2/30">
                    <td className="px-3 py-2 font-mono text-xs">{r.supplierGstin}</td>
                    <td className="px-3 py-2 text-muted">{r.supplierName}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{r.invoiceNo}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.invoiceDate}</td>
                    <td className="px-3 py-2 text-right">{inr(r.invoiceValue)}</td>
                    <td className="px-3 py-2 text-right">{inr(r.gstAmount)}</td>
                    <td className="px-3 py-2 text-right">{inr(r.eligibleItc)}</td>
                    <td className="px-3 py-2"><Badge tone={statusTone(r.matchStatus)}>{r.matchStatus}</Badge></td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- ITC

function ItcTab({ data, period, header, inr }: { data: GstItcReport | null; period: string; header: GstHeader | null; inr: (n: number) => string }) {
  if (!data) return <Empty msg="No ITC data." />;
  const cols = [{ key: "supplierName", label: "Supplier" }, { key: "supplierGstin", label: "GSTIN" }, { key: "invoiceNo", label: "Invoice" }, { key: "invoiceDate", label: "Date" }, { key: "purchaseType", label: "Type" }, { key: "gstAmount", label: "GST", money: true }, { key: "eligibleAmount", label: "Eligible", money: true }, { key: "pendingAmount", label: "Pending", money: true }, { key: "itcStatus", label: "Status" }];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile label="Total GST" value={inr(data.totalGst)} tone="info" />
        <KpiTile label="Eligible ITC" value={inr(data.eligible)} tone="success" />
        <KpiTile label="Ineligible" value={inr(data.ineligible)} tone="warning" />
        <KpiTile label="Blocked" value={inr(data.blocked)} tone="danger" />
        <KpiTile label="Pending" value={inr(data.pending)} tone="warning" />
        <KpiTile label="Reverse Charge" value={inr(data.reverseCharge)} tone="accent" />
      </div>
      <Card title="Input Tax Credit Register" action={<ExportBar columns={cols} rows={data.rows as unknown as Record<string, unknown>[]} fileName={`gst-itc-${period}`} title="Input Tax Credit Register" subtitle={`${header?.gstin ?? ""} · ${period}`} totals={{ gstAmount: data.totalGst, eligibleAmount: data.eligible, pendingAmount: data.pending }} />}>
        {!data.rows.length ? <Empty msg="No purchase invoices with ITC for this period." /> : (
          <Table head={<tr><th className="px-3 py-2">Supplier</th><th className="px-3 py-2">GSTIN</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">GST</th><th className="px-3 py-2 text-right">Eligible</th><th className="px-3 py-2">Status</th></tr>}>
            {data.rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2/30">
                <td className="px-3 py-2 font-medium text-foreground">{r.supplierName}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.supplierGstin}</td>
                <td className="px-3 py-2">{r.invoiceNo}</td>
                <td className="px-3 py-2 text-xs text-muted">{r.purchaseType}</td>
                <td className="px-3 py-2 text-right">{inr(r.gstAmount)}</td>
                <td className="px-3 py-2 text-right font-semibold text-success">{inr(r.eligibleAmount)}</td>
                <td className="px-3 py-2"><Badge tone={r.itcStatus === "Eligible" ? "success" : r.itcStatus === "ReverseCharge" ? "info" : "warning"}>{r.itcStatus}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------- Returns (GSTR-1/3B)

interface ReturnTabData { preview: { rows: Record<string, unknown>[]; totals: Record<string, number> }; saved: GstReturnRow[] }
const WORKFLOW: { status: string; action: string; label: string }[] = [
  { status: "Draft", action: "prepare", label: "Mark Prepared" },
  { status: "Prepared", action: "verify", label: "Verify" },
  { status: "Verified", action: "approve", label: "Approve" },
  { status: "Approved", action: "ready", label: "Ready for Filing" },
  { status: "ReadyForFiling", action: "file", label: "Mark Filed" },
];

function ReturnTab({ type, data, period, busy, action, reload, inr }: { type: "GSTR-1" | "GSTR-3B"; data: ReturnTabData | null; period: string; busy: boolean; action: Action; reload: () => void; inr: (n: number) => string }) {
  if (!data) return <Empty msg="No data." />;
  const saved = data.saved[0];
  const gen = async () => { const j = await action({ action: "generateReturn", returnType: type, period }, `${type} generated.`); if (j.ok) reload(); };
  const step = async (act: string) => { if (!saved) return; const j = await action({ action: "transitionReturn", id: saved.id, subAction: act, arn: act === "file" ? prompt("ARN (acknowledgement ref, optional):") || undefined : undefined }, "Return updated."); if (j.ok) reload(); };
  const genJson = async () => { if (!saved) return; const j = await action({ action: "generateJson", returnId: saved.id }, "JSON generated."); if (j.ok) reload(); };
  const next = saved ? WORKFLOW.find((w) => w.status === saved.status) : null;
  const t = data.preview.totals;
  const exportCols: ExportCol[] = type === "GSTR-1"
    ? [{ key: "section", label: "Section" }, { key: "invoiceNo", label: "No." }, { key: "invoiceDate", label: "Date" }, { key: "partyName", label: "Party" }, { key: "partyGstin", label: "GSTIN" }, { key: "hsn", label: "HSN" }, { key: "rate", label: "Rate" }, { key: "taxableValue", label: "Taxable", money: true }, { key: "cgst", label: "CGST", money: true }, { key: "sgst", label: "SGST", money: true }, { key: "igst", label: "IGST", money: true }, { key: "total", label: "Total", money: true }]
    : [{ key: "description", label: "Particulars" }, { key: "taxableValue", label: "Taxable", money: true }, { key: "cgst", label: "CGST", money: true }, { key: "sgst", label: "SGST", money: true }, { key: "igst", label: "IGST", money: true }, { key: "total", label: "Amount", money: true }];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary">{type}</Badge>
          {saved ? <Badge tone={statusTone(saved.status)}>{saved.status}</Badge> : <Badge tone="neutral">Not generated</Badge>}
          {saved && saved.jsonVersion > 0 && <span className="text-xs text-muted">JSON v{saved.jsonVersion}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={gen}><RefreshCw className="h-3.5 w-3.5" /> {saved ? "Regenerate" : "Generate"}</Button>
          {next && <Button size="sm" variant="outline" disabled={busy} onClick={() => step(next.action)}><CheckCircle2 className="h-3.5 w-3.5" /> {next.label}</Button>}
          <ExportBar columns={exportCols} rows={data.preview.rows} fileName={`${type.toLowerCase()}-${period}`} title={`${type} — ${period}`} totals={data.preview.totals} />
          {saved && <Button size="sm" variant="outline" disabled={busy} onClick={genJson}><FileJson className="h-3.5 w-3.5" /> Export JSON</Button>}
        </div>
      </div>

      {/* workflow tracker */}
      {saved && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs">
          {["Draft", "Prepared", "Verified", "Approved", "ReadyForFiling", "Filed"].map((s, i, arr) => {
            const order = arr.indexOf(saved.status);
            const done = i <= order;
            return <span key={s} className="flex items-center gap-1.5">{i > 0 && <span className="text-subtle">→</span>}<span className={cn("rounded-full px-2 py-0.5 font-semibold", done ? "bg-primary text-white" : "bg-surface-2 text-muted")}>{s}</span></span>;
          })}
        </div>
      )}

      {type === "GSTR-3B" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiTile label="Outward Taxable" value={inr(t.outwardTaxable)} tone="primary" />
          <KpiTile label="Output Tax" value={inr(t.outputTax)} tone="accent" />
          <KpiTile label="Reverse Charge" value={inr(t.rcm)} tone="info" />
          <KpiTile label="Net ITC" value={inr(t.itc)} tone="success" />
          <KpiTile label="Net Liability" value={inr(t.netLiability)} tone={t.netLiability > 0 ? "danger" : "success"} />
          <KpiTile label="GST Payable" value={inr(t.gstPayable)} tone="danger" />
          <KpiTile label="GST Receivable" value={inr(t.gstReceivable)} tone="success" />
          <KpiTile label="Output CGST" value={inr(t.outputCgst)} tone="accent" />
          <KpiTile label="Output SGST" value={inr(t.outputSgst)} tone="accent" />
          <KpiTile label="Output IGST" value={inr(t.outputIgst)} tone="accent" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiTile label="Taxable Value" value={inr(t.taxableValue)} tone="primary" />
          <KpiTile label="CGST" value={inr(t.cgst)} tone="accent" />
          <KpiTile label="SGST" value={inr(t.sgst)} tone="accent" />
          <KpiTile label="IGST" value={inr(t.igst)} tone="accent" />
          <KpiTile label="B2B" value={inr(t.b2b)} tone="info" />
          <KpiTile label="B2C" value={inr(t.b2c)} tone="info" />
        </div>
      )}

      {type === "GSTR-1" && <Gstr1Sections rows={data.preview.rows as unknown as Record<string, string | number>[]} inr={inr} />}

      {saved && (
        <p className="text-xs text-muted">Prepared by {saved.preparedByName || "—"}{saved.preparedAt ? ` on ${saved.preparedAt.slice(0, 10)}` : ""}{saved.verifiedByName ? ` · Verified by ${saved.verifiedByName}` : ""}{saved.approvedByName ? ` · Approved by ${saved.approvedByName}` : ""}.</p>
      )}
    </div>
  );
}

function Gstr1Sections({ rows, inr }: { rows: Record<string, string | number>[]; inr: (n: number) => string }) {
  const groups = useMemo(() => {
    const m = new Map<string, Record<string, string | number>[]>();
    for (const r of rows) { const s = String(r.section); (m.get(s) ?? m.set(s, []).get(s)!).push(r); }
    return [...m.entries()];
  }, [rows]);
  const LABELS: Record<string, string> = { B2B: "B2B Invoices", B2CS: "B2C (Small)", B2CL: "B2C (Large)", CDNR: "Credit/Debit Notes (Registered)", CDNUR: "Credit/Debit Notes (Unregistered)", HSN: "HSN Summary", EXP: "Exports", SEZ: "SEZ Supplies" };
  if (!rows.length) return <Empty msg="No outward supplies for this period." />;
  return (
    <div className="space-y-3">
      {groups.map(([section, list]) => (
        <Card key={section} title={`${LABELS[section] || section} (${list.length})`}>
          <Table head={<tr>{section === "HSN" ? <><th className="px-3 py-2">HSN</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Qty</th></> : <><th className="px-3 py-2">No.</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Party</th><th className="px-3 py-2">GSTIN</th></>}<th className="px-3 py-2 text-right">Taxable</th><th className="px-3 py-2 text-right">CGST</th><th className="px-3 py-2 text-right">SGST</th><th className="px-3 py-2 text-right">IGST</th><th className="px-3 py-2 text-right">Total</th></tr>}>
            {list.map((r, i) => (
              <tr key={i} className="hover:bg-surface-2/30">
                {section === "HSN" ? <><td className="px-3 py-2 font-mono text-xs">{r.hsn}</td><td className="px-3 py-2 text-muted">{r.description}</td><td className="px-3 py-2 text-right">{r.qty}</td></> : <><td className="px-3 py-2 font-medium text-foreground">{r.invoiceNo}</td><td className="px-3 py-2 text-xs text-muted">{r.invoiceDate}</td><td className="px-3 py-2 text-muted">{r.partyName}</td><td className="px-3 py-2 font-mono text-xs">{r.partyGstin}</td></>}
                <td className="px-3 py-2 text-right">{inr(Number(r.taxableValue))}</td>
                <td className="px-3 py-2 text-right">{inr(Number(r.cgst))}</td>
                <td className="px-3 py-2 text-right">{inr(Number(r.sgst))}</td>
                <td className="px-3 py-2 text-right">{inr(Number(r.igst))}</td>
                <td className="px-3 py-2 text-right font-semibold">{inr(Number(r.total))}</td>
              </tr>
            ))}
          </Table>
        </Card>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ JSON Export

function JsonTab({ data }: { data: GstJsonExportRow[] | null }) {
  if (!data) return <Empty msg="No JSON exports." />;
  if (!data.length) return <Empty msg="No JSON files generated yet. Generate one from the GSTR-1 / GSTR-3B tab." />;
  return (
    <Card title="GST JSON Export — Version History" action={<ExportBar print={false} columns={[{ key: "returnType", label: "Return" }, { key: "period", label: "Period" }, { key: "version", label: "Version" }, { key: "fileName", label: "File" }, { key: "validationStatus", label: "Validation" }, { key: "generatedByName", label: "Generated By" }, { key: "generatedAt", label: "Date" }, { key: "downloadCount", label: "Downloads" }]} rows={data as unknown as Record<string, unknown>[]} fileName="gst-json-exports" title="GST JSON Export History" />}>
      <Table head={<tr><th className="px-3 py-2">Return</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">Version</th><th className="px-3 py-2">File</th><th className="px-3 py-2">Validation</th><th className="px-3 py-2">Generated By</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Action</th></tr>}>
      {data.map((e) => (
        <tr key={e.id} className="hover:bg-surface-2/30">
          <td className="px-3 py-2"><Badge tone="primary">{e.returnType}</Badge></td>
          <td className="px-3 py-2">{e.period}</td>
          <td className="px-3 py-2 font-semibold">v{e.version}</td>
          <td className="px-3 py-2 font-mono text-xs text-muted">{e.fileName}</td>
          <td className="px-3 py-2"><Badge tone={e.validationStatus === "Valid" ? "success" : e.validationStatus === "Warning" ? "warning" : "danger"}>{e.validationStatus}</Badge></td>
          <td className="px-3 py-2 text-muted">{e.generatedByName}</td>
          <td className="px-3 py-2 text-xs text-muted">{e.generatedAt.slice(0, 10)}</td>
          <td className="px-3 py-2 text-right"><a href={`${API}/json/${e.id}`} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-subtle"><Download className="h-3.5 w-3.5" /> Download</a></td>
        </tr>
      ))}
      </Table>
    </Card>
  );
}

// ------------------------------------------------------------------- Reports

const REPORTS = [
  "gst-sales-register", "gst-purchase-register", "output-gst-register", "input-gst-register",
  "tax-summary", "hsn-summary", "sac-summary", "itc-report", "gst-ledger", "gst-difference", "gst-reconciliation", "monthly-gst-summary",
];
const REPORT_LABELS: Record<string, string> = {
  "gst-sales-register": "GST Sales Register", "gst-purchase-register": "GST Purchase Register", "output-gst-register": "Output GST Register", "input-gst-register": "Input GST Register",
  "tax-summary": "Tax Summary", "hsn-summary": "HSN Summary", "sac-summary": "SAC Summary", "itc-report": "ITC Report", "gst-ledger": "GST Ledger", "gst-difference": "GST Difference", "gst-reconciliation": "Reconciliation Report", "monthly-gst-summary": "Monthly GST Summary",
};

function ReportsTab({ period, header, inr }: { period: string; header: GstHeader | null; inr: (n: number) => string }) {
  const [key, setKey] = useState("gst-sales-register");
  const [rep, setRep] = useState<GstReport | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let on = true; setLoading(true);
    fetch(`${API}/report?period=${period}&key=${key}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (on) setRep(j?.ok ? j.data : null); }).finally(() => on && setLoading(false));
    return () => { on = false; };
  }, [key, period]);
  const fmtCell = (v: string | number, col: { money?: boolean; qty?: boolean }) => (col.money ? inr(Number(v)) : col.qty ? String(v) : String(v));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {REPORTS.map((r) => <button key={r} onClick={() => setKey(r)} className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold transition", key === r ? "bg-primary text-white" : "border border-border bg-surface text-muted hover:text-foreground")}>{REPORT_LABELS[r]}</button>)}
        </div>
        {rep && rep.rows.length > 0 && (
          <ExportBar columns={rep.columns} rows={rep.rows} fileName={`${key}-${period}`} title={rep.title} subtitle={`${header?.gstin ?? ""} · ${header?.periodLabel ?? period}`} totals={rep.totals} />
        )}
      </div>
      {loading ? <Loader /> : !rep || !rep.rows.length ? <Empty msg="No data for this report." /> : (
        <Card title={rep.title}>
          <Table head={<tr>{rep.columns.map((c) => <th key={c.key} className={cn("px-3 py-2", c.money && "text-right")}>{c.label}</th>)}</tr>}>
            {rep.rows.map((r, i) => (
              <tr key={i} className="hover:bg-surface-2/30">
                {rep.columns.map((c) => <td key={c.key} className={cn("px-3 py-2", c.money && "text-right tabular-nums")}>{fmtCell(r[c.key] as string | number, c)}</td>)}
              </tr>
            ))}
            <tr className="bg-surface-2/40 font-bold">
              {rep.columns.map((c, i) => <td key={c.key} className={cn("px-3 py-2", c.money && "text-right")}>{i === 0 ? "Total" : c.key in rep.totals ? inr(rep.totals[c.key]) : ""}</td>)}
            </tr>
          </Table>
        </Card>
      )}
    </div>
  );
}

// --------------------------------------------------------------- Period Closing

function ClosingTab({ data, busy, action, reload }: { data: GstPeriodRow[] | null; busy: boolean; action: Action; reload: () => void }) {
  if (!data) return <Empty msg="No periods." />;
  return (
    <Card title="GST Period Closing" action={<ExportBar print={false} columns={[{ key: "periodLabel", label: "Period" }, { key: "fromDate", label: "From" }, { key: "toDate", label: "To" }, { key: "filingStatus", label: "Filing" }, { key: "closingStatus", label: "Closing" }, { key: "lockedByName", label: "Locked By" }]} rows={data as unknown as Record<string, unknown>[]} fileName="gst-period-closing" title="GST Period Closing" />}>
      <p className="mb-3 text-xs text-muted">Verify and lock a GST period after filing. A locked period blocks return regeneration; only authorised users can reopen it.</p>
      <Table head={<tr><th className="px-3 py-2">Period</th><th className="px-3 py-2">Window</th><th className="px-3 py-2">Filing</th><th className="px-3 py-2">Closing</th><th className="px-3 py-2">Locked By</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
        {data.map((p) => <ClosingRow key={p.period} p={p} busy={busy} action={action} reload={reload} />)}
      </Table>
    </Card>
  );
}
function ClosingRow({ p, busy, action, reload }: { p: GstPeriodRow; busy: boolean; action: Action; reload: () => void }) {
  const run = async (sub: "verify" | "lock" | "reopen") => {
    const reason = sub === "reopen" ? (prompt("Reason for reopening this period:") || undefined) : undefined;
    if (sub === "reopen" && !reason) return;
    const j = await action({ action: "closePeriod", period: p.period, subAction: sub, reason } as Record<string, unknown>, sub === "lock" ? "Period locked." : sub === "reopen" ? "Period reopened." : "Period verified.");
    if (j.ok) reload();
  };
  return (
    <tr className="hover:bg-surface-2/30">
      <td className="px-3 py-2 font-semibold text-foreground">{p.periodLabel}</td>
      <td className="px-3 py-2 text-xs text-muted">{p.fromDate} → {p.toDate}</td>
      <td className="px-3 py-2"><Badge tone={statusTone(p.filingStatus)}>{p.filingStatus}</Badge></td>
      <td className="px-3 py-2"><Badge tone={statusTone(p.closingStatus)}>{p.closingStatus}</Badge></td>
      <td className="px-3 py-2 text-xs text-muted">{p.lockedByName || "—"}</td>
      <td className="px-3 py-2 text-right">
        <div className="flex justify-end gap-1">
          {p.closingStatus === "Open" && <><button disabled={busy} onClick={() => run("verify")} className="rounded px-1.5 py-0.5 text-xs font-semibold text-info hover:bg-info-subtle">Verify</button><button disabled={busy} onClick={() => run("lock")} className="rounded px-1.5 py-0.5 text-xs font-semibold text-danger hover:bg-danger-subtle">Lock</button></>}
          {p.closingStatus === "Verified" && <button disabled={busy} onClick={() => run("lock")} className="rounded px-1.5 py-0.5 text-xs font-semibold text-danger hover:bg-danger-subtle">Lock</button>}
          {p.closingStatus === "Locked" && <button disabled={busy} onClick={() => run("reopen")} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-warning hover:bg-warning-subtle"><XCircle className="h-3 w-3" /> Reopen</button>}
        </div>
      </td>
    </tr>
  );
}

// --------------------------------------------------------------- Filing / Audit

function FilingTab({ data }: { data: GstFilingRow[] | null }) {
  if (!data) return <Empty msg="No filing history." />;
  if (!data.length) return <Empty msg="No returns filed yet." />;
  return (
    <Card title="GST Filing History" action={<ExportBar columns={[{ key: "returnType", label: "Return" }, { key: "period", label: "Period" }, { key: "gstin", label: "GSTIN" }, { key: "arn", label: "ARN" }, { key: "filingDate", label: "Filed On" }, { key: "jsonVersion", label: "JSON v" }, { key: "filedByName", label: "Filed By" }, { key: "status", label: "Status" }]} rows={data as unknown as Record<string, unknown>[]} fileName="gst-filing-history" title="GST Filing History" />}>
      <Table head={<tr><th className="px-3 py-2">Return</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">GSTIN</th><th className="px-3 py-2">ARN</th><th className="px-3 py-2">Filed On</th><th className="px-3 py-2">JSON</th><th className="px-3 py-2">Filed By</th><th className="px-3 py-2">Status</th></tr>}>
        {data.map((h) => (
          <tr key={h.id} className="hover:bg-surface-2/30">
            <td className="px-3 py-2"><Badge tone="primary">{h.returnType}</Badge></td>
            <td className="px-3 py-2">{h.period}</td>
            <td className="px-3 py-2 font-mono text-xs">{h.gstin}</td>
            <td className="px-3 py-2 font-mono text-xs text-muted">{h.arn || "—"}</td>
            <td className="px-3 py-2 text-xs text-muted">{h.filingDate}</td>
            <td className="px-3 py-2">v{h.jsonVersion}</td>
            <td className="px-3 py-2 text-muted">{h.filedByName}</td>
            <td className="px-3 py-2"><Badge tone={statusTone(h.status)}>{h.status}</Badge></td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
function AuditTab({ data }: { data: GstAuditRow[] | null }) {
  if (!data) return <Empty msg="No audit trail." />;
  if (!data.length) return <Empty msg="No GST activity recorded yet." />;
  return (
    <Card title="GST Audit Trail" action={<ExportBar columns={[{ key: "action", label: "Action" }, { key: "entity", label: "Entity" }, { key: "summary", label: "Summary" }, { key: "userName", label: "User" }, { key: "at", label: "When" }]} rows={data as unknown as Record<string, unknown>[]} fileName="gst-audit-trail" title="GST Audit Trail" />}>
      <Table head={<tr><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th><th className="px-3 py-2">Summary</th><th className="px-3 py-2">User</th><th className="px-3 py-2">When</th></tr>}>
        {data.map((a) => (
          <tr key={a.id} className="hover:bg-surface-2/30">
            <td className="px-3 py-2 font-mono text-xs text-primary">{a.action}</td>
            <td className="px-3 py-2 text-xs text-muted">{a.entity}</td>
            <td className="px-3 py-2 text-muted">{a.summary}</td>
            <td className="px-3 py-2 text-muted">{a.userName}</td>
            <td className="px-3 py-2 text-xs text-subtle">{a.at ? new Date(a.at).toLocaleString() : ""}</td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

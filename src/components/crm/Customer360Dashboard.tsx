"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users, Search, Pencil, Printer, Download, MessageCircle, Mail, History, Phone, MapPin, ReceiptText,
  ShoppingBag, Wallet, Gift, RotateCcw, Repeat, XCircle, MessageSquare, Wrench, FileText, BarChart3, Activity, IndianRupee, Plus, Loader2, Info, Star, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import type {
  C360Summary, C360Overview, C360SalesPage, C360Analysis, C360Loyalty, C360Financial,
  C360ReturnRow, C360ExchangeRow, C360CancellationRow, C360Analytics, C360AuditRow, C360Note, C360SearchRow, C360NameVal,
} from "@/lib/contracts/customer360";

const TABS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "sales", label: "Sales History", icon: ShoppingBag },
  { id: "analysis", label: "Purchase Analysis", icon: BarChart3 },
  { id: "loyalty", label: "Loyalty", icon: Gift },
  { id: "financial", label: "Financial", icon: Wallet },
  { id: "returns", label: "Sales Return", icon: RotateCcw },
  { id: "exchanges", label: "Sales Exchange", icon: Repeat },
  { id: "cancellations", label: "Sales Cancellation", icon: XCircle },
  { id: "communication", label: "Communication", icon: MessageSquare },
  { id: "service", label: "Customer Service", icon: Wrench },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "analytics", label: "Analytics", icon: TrendingUp },
  { id: "audit", label: "Audit History", icon: History },
];

export function Customer360Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const fmt = useFmt();
  const toast = useToast();
  const inr = (n: number) => fmt.money(n || 0);

  const idParam = Number(params.get("id"));
  const [selId, setSelId] = useState<number | null>(Number.isInteger(idParam) && idParam > 0 ? idParam : null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<C360SearchRow[] | null>(null);
  const [summary, setSummary] = useState<C360Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [tab, setTab] = useState("overview");
  const [cache, setCache] = useState<Record<string, unknown>>({});
  const [tabLoading, setTabLoading] = useState(false);

  // Search
  useEffect(() => {
    if (selId) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const j = await fetch(`/api/crm/customer-360/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store", signal: ctrl.signal }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) setHits(j.customers);
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, selId]);

  // Summary on select
  useEffect(() => {
    if (!selId) { setSummary(null); return; }
    setLoadingSummary(true); setCache({}); setTab("overview");
    (async () => {
      const j = await fetch(`/api/crm/customer-360/${selId}/summary`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) setSummary({ header: j.header, kpis: j.kpis }); else setSummary(null);
      setLoadingSummary(false);
    })();
  }, [selId]);

  const loadTab = useCallback(async (section: string) => {
    if (!selId || cache[section] !== undefined) return;
    setTabLoading(true);
    const j = await fetch(`/api/crm/customer-360/${selId}/${section}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    setCache((c) => ({ ...c, [section]: j.ok ? j.data : null }));
    setTabLoading(false);
  }, [selId, cache]);

  // Lazy-load the active tab (data-backed tabs only).
  useEffect(() => {
    const real = ["overview", "sales", "analysis", "loyalty", "financial", "returns", "exchanges", "cancellations", "analytics", "audit", "communication"];
    if (selId && real.includes(tab)) loadTab(tab === "communication" ? "notes" : tab);
  }, [tab, selId, loadTab]);

  function select(id: number) { setSelId(id); setHits(null); setQuery(""); router.replace(`/crm/customer-360?id=${id}`); }
  function clearSel() { setSelId(null); setSummary(null); router.replace(`/crm/customer-360`); }

  // ---------- search screen ----------
  if (!selId) {
    return (
      <div className="space-y-5">
        <Head />
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-subtle/40 to-card p-8 shadow-sm">
          <div className="mx-auto max-w-xl text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-white shadow-md"><Users className="h-7 w-7" /></span>
            <h2 className="mt-3 text-lg font-bold text-foreground">Find a customer</h2>
            <p className="mt-1 text-sm text-muted">Search by name, code, mobile, email or GST to open the complete 360° view.</p>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer…" className="h-12 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm shadow-sm placeholder:text-subtle focus:border-primary focus:outline-none focus:shadow-focus" />
            </div>
          </div>
          {hits && hits.length > 0 && (
            <div className="mx-auto mt-4 grid max-w-xl gap-2">
              {hits.map((c) => (
                <button key={c.id} onClick={() => select(c.id)} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                  <span className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white">{c.name.charAt(0)}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-foreground">{c.name}</span><span className="block truncate text-2xs text-muted">{c.code} · {c.phone || "—"}{c.city ? ` · ${c.city}` : ""}</span></span></span>
                  <Badge tone={c.status === "Active" ? "success" : "neutral"}>{c.status}</Badge>
                </button>
              ))}
            </div>
          )}
          {hits !== null && hits.length === 0 && <p className="mx-auto mt-4 max-w-xl text-center text-sm text-muted">No customers matched{query ? ` “${query}”` : ""}.</p>}
        </div>
      </div>
    );
  }

  if (loadingSummary || !summary) return (<div className="space-y-5"><Head /><div className="py-24">{loadingSummary ? <AppLoader label="Loading customer 360…" /> : <div className="text-center text-sm text-muted">Customer not found. <button onClick={clearSel} className="font-semibold text-primary hover:underline">Search again</button></div>}</div></div>);

  const h = summary.header; const k = summary.kpis;
  const waLink = h.phone ? `https://wa.me/${h.phone.replace(/[^\d]/g, "")}` : null;

  return (
    <div className="space-y-5">
      <Head onChange={clearSel} />

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-2xl font-bold text-white shadow-sm">{(h.name || h.code || "?").charAt(0).toUpperCase()}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">{h.name || "Unnamed Customer"}</h1>
                <Badge tone={h.status === "Active" ? "success" : h.status === "Blocked" ? "danger" : "neutral"}>{h.status}</Badge>
                {h.customerGroup && <Badge tone="primary">{h.customerGroup}</Badge>}
                {h.type && <Badge tone="info">{h.type}</Badge>}
              </div>
              <p className="mt-1 font-mono text-xs text-subtle">{h.code}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
              <Link href={`/masters/customer/${h.id}`}><Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" /> Edit</Button></Link>
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Statement</Button>
              <Button size="sm" variant="outline" onClick={() => toast.info("Export — coming soon.")}><Download className="h-3.5 w-3.5" /> Export</Button>
              {waLink && <a href={waLink} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button></a>}
              {h.email && <a href={`mailto:${h.email}`}><Button size="sm" variant="outline"><Mail className="h-3.5 w-3.5" /> Email</Button></a>}
              <Button size="sm" variant="outline" onClick={() => setTab("audit")}><History className="h-3.5 w-3.5" /> Audit</Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoChip icon={Phone} label="Mobile" value={[h.phone, h.altMobile].filter(Boolean).join(" · ") || "—"} />
            <InfoChip icon={Mail} label="Email" value={h.email || "—"} />
            <InfoChip icon={ReceiptText} label="GSTIN" value={h.gstin || "—"} />
            <InfoChip icon={Users} label="Business" value={h.businessName || h.type || "—"} />
            <InfoChip icon={MapPin} label="Address" value={[h.address, h.city, h.state, h.country].filter(Boolean).join(", ") || "—"} className="sm:col-span-2" />
            <InfoChip icon={History} label="Customer Since" value={h.regDate || "—"} />
            <InfoChip icon={ShoppingBag} label="Last Purchase" value={h.lastPurchase || "—"} />
          </div>
      </div>

      {/* KPI cards */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-subtle">Key Metrics</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <Kpi icon={IndianRupee} label="Lifetime Purchase" value={inr(k.lifetimePurchase)} tone="primary" />
          <Kpi icon={IndianRupee} label="This Month" value={inr(k.monthPurchase)} tone="info" />
          <Kpi icon={IndianRupee} label="Today" value={inr(k.todayPurchase)} tone="success" />
          <Kpi icon={ShoppingBag} label="Total Orders" value={String(k.totalOrders)} tone="accent" />
          <Kpi icon={IndianRupee} label="Avg Bill" value={inr(k.avgBill)} tone="neutral" />
          <Kpi icon={IndianRupee} label="Highest Bill" value={inr(k.highestBill)} tone="neutral" />
          <Kpi icon={IndianRupee} label="Last Purchase" value={inr(k.lastPurchaseAmount)} tone="neutral" />
          <Kpi icon={Wallet} label="Outstanding" value={inr(k.outstanding)} tone={k.outstanding > 0 ? "danger" : "success"} />
          <Kpi icon={Wallet} label="Advance" value={inr(k.advance)} tone="neutral" />
          <Kpi icon={Gift} label="Reward Points" value={k.availablePoints.toLocaleString()} tone="primary" />
          <Kpi icon={Gift} label="Earned Points" value={k.earnedPoints.toLocaleString()} tone="neutral" />
          <Kpi icon={Gift} label="Redeemed" value={k.redeemedPoints.toLocaleString()} tone="neutral" />
          <Kpi icon={RotateCcw} label="Returns" value={String(k.totalReturns)} tone="warning" />
          <Kpi icon={Repeat} label="Exchanges" value={String(k.totalExchanges)} tone="warning" />
          <Kpi icon={XCircle} label="Cancelled" value={String(k.totalCancelled)} tone="danger" />
          <Kpi icon={History} label="Days Since Buy" value={k.daysSinceLastPurchase == null ? "—" : String(k.daysSinceLastPurchase)} tone="neutral" />
          <Kpi icon={Users} label="Customer Since" value={k.customerSince || "—"} tone="neutral" />
          <Kpi icon={IndianRupee} label="Total Sales" value={inr(k.totalSales)} tone="primary" />
        </div>
      </div>

      {/* Tabs — sticky pill bar */}
      <div className="sticky top-2 z-10 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card/85 p-1 shadow-sm backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition", tab === t.id ? "bg-brand-gradient text-white shadow-sm" : "text-muted hover:bg-surface-2 hover:text-foreground")}><t.icon className="h-4 w-4" /> {t.label}</button>
        ))}
      </div>

      <div className="min-h-[200px]">
        {tabLoading && cache[tab === "communication" ? "notes" : tab] === undefined ? <div className="py-16"><AppLoader label="Loading…" size="sm" /></div> : (
          <>
            {tab === "overview" && <OverviewTab d={cache.overview as C360Overview | null} inr={inr} />}
            {tab === "sales" && <SalesTab id={selId} inr={inr} fmtQty={fmt.qty} />}
            {tab === "analysis" && <AnalysisTab d={cache.analysis as C360Analysis | null} inr={inr} />}
            {tab === "loyalty" && <LoyaltyTab d={cache.loyalty as C360Loyalty | null} />}
            {tab === "financial" && <FinancialTab d={cache.financial as C360Financial | null} inr={inr} />}
            {tab === "returns" && <TableTab rows={(cache.returns as C360ReturnRow[] | null) ?? []} cols={["Return No", "Date", "Invoice", "Reason", "Amount", "Status"]} render={(r) => [r.returnNo, r.date, r.invoiceNo, r.reason || "—", inr(r.amount), <Badge key="s" tone="warning">{r.status}</Badge>]} empty="No returns." />}
            {tab === "exchanges" && <TableTab rows={(cache.exchanges as C360ExchangeRow[] | null) ?? []} cols={["Exchange No", "Date", "Old Product", "New Product", "Difference", "Status"]} render={(e) => [e.exchangeNo, e.date, e.oldProduct, e.newProduct, inr(e.difference), <Badge key="s" tone="info">{e.status}</Badge>]} empty="No exchanges." />}
            {tab === "cancellations" && <TableTab rows={(cache.cancellations as C360CancellationRow[] | null) ?? []} cols={["Cancellation No", "Date", "Invoice", "Reason", "Cancelled By", "Amount", "Status"]} render={(c) => [c.cancellationNo, c.date, c.invoiceNo, c.reason || "—", c.cancelledBy, inr(c.amount), <Badge key="s" tone="danger">{c.status}</Badge>]} empty="No cancellations." />}
            {tab === "communication" && <CommunicationTab id={selId} notes={cache.notes as C360Note[] | null} onAdded={() => { setCache((c) => ({ ...c, notes: undefined })); loadTab("notes"); }} />}
            {tab === "service" && <EmptyTab icon={Wrench} title="Customer Service" msg="Complaints, tickets, warranty claims, replacements, AMC & service requests will appear here once the Customer Service module is enabled." />}
            {tab === "documents" && <EmptyTab icon={FileText} title="Documents" msg="Customer documents (GST, PAN, ID proof, attachments) will appear here once the Documents module is enabled." />}
            {tab === "analytics" && <AnalyticsTab d={cache.analytics as C360Analytics | null} inr={inr} />}
            {tab === "audit" && <AuditTab rows={(cache.audit as C360AuditRow[] | null) ?? []} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- tabs -- */

function OverviewTab({ d, inr }: { d: C360Overview | null; inr: (n: number) => string }) {
  if (!d) return <EmptyState msg="No overview data." />;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Preferences" className="lg:col-span-1">
        <KV k="Purchase Frequency" v={d.purchaseFrequencyDays == null ? "—" : `every ${d.purchaseFrequencyDays} days`} />
        <KV k="Favourite Category" v={d.favouriteCategory} />
        <KV k="Favourite Brand" v={d.favouriteBrand} />
        <KV k="Preferred Payment" v={d.preferredPayment} />
        <KV k="Preferred Branch" v={d.preferredBranch} />
        <KV k="Preferred Salesperson" v={d.preferredSalesperson} />
      </Card>
      <Card title="Top Products (by value)"><Bars items={d.topProducts} fmt={inr} /></Card>
      <Card title="Favourite Products (by qty)"><Bars items={d.favouriteProducts} fmt={(n) => String(n)} tone="accent" /></Card>
      <Card title="Recent Activity" className="lg:col-span-3">
        {d.recentActivities.length ? (
          <ol className="space-y-2">
            {d.recentActivities.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><Badge tone={a.type === "Sale" ? "success" : a.type === "Return" ? "warning" : a.type === "Exchange" ? "info" : "danger"}>{a.type}</Badge><span className="text-foreground">{a.title}</span></span>
                <span className="flex items-center gap-3 text-2xs text-muted">{a.date}<span className="font-semibold text-foreground">{inr(a.amount)}</span></span>
              </li>
            ))}
          </ol>
        ) : <EmptyState msg="No recent activity." />}
      </Card>
    </div>
  );
}

function SalesTab({ id, inr, fmtQty }: { id: number; inr: (n: number) => string; fmtQty: (n: number) => string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<C360SalesPage | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); fetch(`/api/crm/customer-360/${id}/sales?page=${page}&pageSize=20`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setData(j.data); }).finally(() => setLoading(false)); }, [id, page]);
  if (loading && !data) return <div className="py-12"><AppLoader label="Loading sales…" size="sm" /></div>;
  if (!data) return <EmptyState msg="No sales." />;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Branch</th><th className="px-3 py-2">Salesperson</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Disc</th><th className="px-3 py-2 text-right">Tax</th><th className="px-3 py-2 text-right">Net</th><th className="px-3 py-2">Payment</th><th className="px-3 py-2 text-center">Status</th></tr></thead>
          <tbody>
            {data.rows.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                <td className="px-3 py-2"><Link href={`/sales/history`} className="font-mono text-2xs font-semibold text-primary hover:underline">{s.invoiceNo}</Link></td>
                <td className="px-3 py-2 text-muted">{s.date}</td><td className="px-3 py-2 text-muted">{s.branch}</td><td className="px-3 py-2 text-muted">{s.salesperson}</td>
                <td className="px-3 py-2 text-right text-foreground">{inr(s.amount)}</td><td className="px-3 py-2 text-right text-muted">{s.discount ? inr(s.discount) : "—"}</td><td className="px-3 py-2 text-right text-muted">{inr(s.tax)}</td>
                <td className="px-3 py-2 text-right font-semibold text-foreground">{inr(s.net)}</td><td className="px-3 py-2 text-muted">{s.paymentType}</td>
                <td className="px-3 py-2 text-center"><Badge tone={s.status === "Completed" ? "success" : s.status === "Cancelled" ? "danger" : "neutral"}>{s.status}</Badge></td>
              </tr>
            ))}
            {!data.rows.length && <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-muted">No sales.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && <div className="flex items-center justify-between border-t border-border px-3 py-2 text-2xs text-muted"><span>{data.total} invoices · page {page}/{pages}</span><span className="flex gap-1"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Prev</button><button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button></span></div>}
    </div>
  );
}

function AnalysisTab({ d, inr }: { d: C360Analysis | null; inr: (n: number) => string }) {
  if (!d) return <EmptyState msg="No purchase data." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Monthly Purchase Trend" className="lg:col-span-2"><LineChart items={d.monthly} fmt={inr} /></Card>
      <Card title="Category-wise"><Donut items={d.byCategory} fmt={inr} /></Card>
      <Card title="Brand-wise"><Donut items={d.byBrand} fmt={inr} /></Card>
      <Card title="Branch-wise"><Bars items={d.byBranch} fmt={inr} /></Card>
      <Card title="Weekday Analysis"><Bars items={d.byWeekday} fmt={inr} tone="info" /></Card>
      <Card title="Top Products"><Bars items={d.byProduct} fmt={inr} /></Card>
      <Card title="Yearly Trend"><Bars items={d.yearly} fmt={inr} tone="accent" /></Card>
    </div>
  );
}

function LoyaltyTab({ d }: { d: C360Loyalty | null }) {
  if (!d) return <EmptyState msg="No loyalty data." />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={Gift} label="Available" value={d.available.toLocaleString()} tone="primary" />
        <Kpi icon={Gift} label="Earned" value={d.earned.toLocaleString()} tone="success" />
        <Kpi icon={Gift} label="Redeemed" value={d.redeemed.toLocaleString()} tone="warning" />
        <Kpi icon={Gift} label="Expired" value={d.expired.toLocaleString()} tone="neutral" />
      </div>
      <Card title="Reward Ledger">
        {d.ledger.length ? (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2 text-right">Earned</th><th className="px-3 py-2 text-right">Redeemed</th><th className="px-3 py-2 text-right">Balance</th></tr></thead><tbody>
            {d.ledger.map((l) => <tr key={l.id} className="border-b border-border last:border-0"><td className="px-3 py-2 text-muted">{l.date}</td><td className="px-3 py-2"><Badge tone="neutral">{l.type.replace(/([A-Z])/g, " $1").trim()}</Badge></td><td className="px-3 py-2 font-mono text-2xs text-muted">{l.ref || "—"}</td><td className="px-3 py-2 text-right text-success">{l.earned || "—"}</td><td className="px-3 py-2 text-right text-danger">{l.redeemed || "—"}</td><td className="px-3 py-2 text-right font-semibold text-foreground">{l.balance}</td></tr>)}
          </tbody></table></div>
        ) : <EmptyState msg="No loyalty transactions." />}
      </Card>
    </div>
  );
}

function FinancialTab({ d, inr }: { d: C360Financial | null; inr: (n: number) => string }) {
  if (!d) return <EmptyState msg="No financial data." />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icon={Wallet} label="Outstanding" value={inr(d.outstanding)} tone={d.outstanding > 0 ? "danger" : "success"} />
        <Kpi icon={Wallet} label="Advance" value={inr(d.advance)} tone="neutral" />
        <Kpi icon={IndianRupee} label="Credit Limit" value={inr(d.creditLimit)} tone="info" />
        <Kpi icon={IndianRupee} label="Credit Available" value={inr(d.creditAvailable)} tone="success" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Ageing of Outstanding"><Bars items={d.ageing.map((a) => ({ name: a.bucket, value: a.amount }))} fmt={inr} tone="danger" /></Card>
        <Card title="Recent Payments">
          {d.payments.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Mode</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody>{d.payments.map((p, i) => <tr key={i} className="border-b border-border last:border-0"><td className="px-3 py-2 text-muted">{p.date}</td><td className="px-3 py-2 font-mono text-2xs text-muted">{p.invoiceNo}</td><td className="px-3 py-2 text-muted">{p.mode}</td><td className="px-3 py-2 text-right font-semibold text-foreground">{inr(p.amount)}</td></tr>)}</tbody></table></div> : <EmptyState msg="No payments." />}
        </Card>
      </div>
      <Card title="Customer Ledger">
        {d.ledger.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Particular</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-right">Balance</th></tr></thead><tbody>{d.ledger.map((l, i) => <tr key={i} className="border-b border-border last:border-0"><td className="px-3 py-2 text-muted">{l.date}</td><td className="px-3 py-2 text-foreground">{l.particular}</td><td className="px-3 py-2 text-right text-muted">{l.debit ? inr(l.debit) : "—"}</td><td className="px-3 py-2 text-right text-muted">{l.credit ? inr(l.credit) : "—"}</td><td className="px-3 py-2 text-right font-semibold text-foreground">{inr(l.balance)}</td></tr>)}</tbody></table></div> : <EmptyState msg="No ledger entries." />}
      </Card>
    </div>
  );
}

function AnalyticsTab({ d, inr }: { d: C360Analytics | null; inr: (n: number) => string }) {
  if (!d) return <EmptyState msg="No analytics." />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card title="Customer Health"><div className="flex items-center gap-3"><Ring pct={d.healthScore} /><div><div className="text-lg font-bold text-foreground">{d.healthScore}/100</div><Badge tone={d.healthLabel === "Healthy" ? "success" : d.healthLabel === "At Watch" ? "warning" : "danger"}>{d.healthLabel}</Badge></div></div></Card>
      <Card title="RFM"><KV k="Recency" v={d.recencyDays == null ? "—" : `${d.recencyDays} days`} /><KV k="Frequency" v={`${d.frequency} orders`} /><KV k="Monetary" v={inr(d.monetary)} /><KV k="RFM Score" v={d.rfmScore} /></Card>
      <Card title="Risk"><div className="flex items-center gap-3"><Ring pct={d.riskScore} tone="danger" /><Badge tone={d.riskLabel === "High" ? "danger" : d.riskLabel === "Medium" ? "warning" : "success"}>{d.riskLabel} risk</Badge></div></Card>
      <Card title="Repeat Purchase"><div className="text-2xl font-bold text-foreground">{d.repeatPurchasePct}%</div></Card>
      <Card title="Profit Contribution"><div className="text-2xl font-bold text-foreground">{inr(d.profitContribution)}</div></Card>
      <Card title="Customer Ranking"><div className="text-2xl font-bold text-foreground">{d.ranking == null ? "—" : `#${d.ranking}`}</div><p className="text-2xs text-muted">by lifetime spend</p></Card>
    </div>
  );
}

function CommunicationTab({ id, notes, onAdded }: { id: number; notes: C360Note[] | null; onAdded: () => void }) {
  const toast = useToast();
  const [type, setType] = useState("Note");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!body.trim()) { toast.error("Enter a note."); return; }
    setBusy(true);
    const j = await fetch(`/api/crm/customer-360/${id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, body }) }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (j.ok) { setBody(""); onAdded(); toast.success("Note added."); } else toast.error(j.message || "Could not add note.");
  }
  const inp = "h-9 rounded-md border border-border bg-surface px-2.5 text-sm focus:border-primary focus:outline-none";
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Log Note / Communication" className="lg:col-span-1">
        <div className="space-y-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className={cn(inp, "w-full")}>{["Note", "Call", "SMS", "Email", "WhatsApp"].map((t) => <option key={t}>{t}</option>)}</select>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Type a note or log a conversation…" className="w-full resize-y rounded-md border border-border bg-surface px-2.5 py-2 text-sm focus:border-primary focus:outline-none" />
          <Button size="md" onClick={add} disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add</Button>
        </div>
        <p className="mt-3 text-2xs text-subtle">SMS / Email / WhatsApp history sync will populate automatically once the messaging module is enabled.</p>
      </Card>
      <Card title="Notes & Communication Log" className="lg:col-span-2">
        {notes && notes.length ? (
          <ol className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-2xs text-muted"><Badge tone="info">{n.type}</Badge><span>{new Date(n.createdAt).toLocaleString()}{n.createdByName ? ` · ${n.createdByName}` : ""}</span></div>
                <p className="mt-1 text-sm text-foreground">{n.body}</p>
              </li>
            ))}
          </ol>
        ) : <EmptyState msg="No notes yet — add the first one." />}
      </Card>
    </div>
  );
}

function AuditTab({ rows }: { rows: C360AuditRow[] }) {
  if (!rows.length) return <EmptyState msg="No audit history." />;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">When</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th><th className="px-3 py-2">Summary</th><th className="px-3 py-2">User</th></tr></thead>
      <tbody>{rows.map((a) => <tr key={a.id} className="border-b border-border last:border-0"><td className="px-3 py-2 text-2xs text-muted">{new Date(a.date).toLocaleString()}</td><td className="px-3 py-2 font-mono text-2xs text-primary">{a.action}</td><td className="px-3 py-2 text-muted">{a.entity}</td><td className="px-3 py-2 text-foreground">{a.summary || "—"}</td><td className="px-3 py-2 text-muted">{a.user}</td></tr>)}</tbody>
    </table></div></div>
  );
}

function TableTab<T>({ rows, cols, render, empty }: { rows: T[]; cols: string[]; render: (r: T) => React.ReactNode[]; empty: string }) {
  if (!rows.length) return <EmptyState msg={empty} />;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">{cols.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">{render(r).map((cell, j) => <td key={j} className="px-3 py-2 text-foreground">{cell}</td>)}</tr>)}</tbody>
    </table></div></div>
  );
}

function EmptyTab({ icon: Icon, title, msg }: { icon: typeof Wrench; title: string; msg: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><Icon className="mx-auto h-8 w-8 text-subtle" /><p className="mt-2 text-sm font-semibold text-foreground">{title}</p><p className="mx-auto mt-1 max-w-md text-2xs text-muted">{msg}</p></div>;
}

/* ----------------------------------------------------------- primitives -- */

function Head({ onChange }: { onChange?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>CRM</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Customer 360</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Users className="h-5 w-5 text-primary" /> Customer 360 Dashboard</h1>
      </div>
      {onChange && <Button size="sm" variant="outline" onClick={onChange}><Search className="h-3.5 w-3.5" /> Change Customer</Button>}
    </div>
  );
}

const KPI_TONE = { primary: "bg-primary/10 text-primary", info: "bg-info/10 text-info", success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning", danger: "bg-danger/10 text-danger", accent: "bg-accent/15 text-accent-foreground", neutral: "bg-surface-2 text-muted" } as const;
function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone: keyof typeof KPI_TONE }) {
  return (
    <div className="group rounded-xl border border-border bg-card p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase leading-tight tracking-wider text-muted">{label}</p>
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg transition group-hover:scale-110", KPI_TONE[tone])}><Icon className="h-3.5 w-3.5" /></span>
      </div>
      <p className="mt-2 truncate text-[17px] font-bold leading-tight tabular-nums text-foreground" title={value}>{value}</p>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md", className)}><p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-subtle"><span className="h-3.5 w-1 rounded-full bg-primary" />{title}</p>{children}</div>;
}
function KV({ k, v }: { k: string; v: string }) { return <div className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 text-sm last:border-0"><span className="text-muted">{k}</span><span className="font-semibold text-foreground">{v}</span></div>; }
function InfoChip({ icon: Icon, label, value, className }: { icon: typeof Users; label: string; value: string; className?: string }) {
  return <div className={cn("flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/40 px-3 py-2", className)}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{label}</p><p className="truncate text-sm font-medium text-foreground" title={value}>{value}</p></div></div>;
}
function EmptyState({ msg }: { msg: string }) { return <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted"><span className="grid h-10 w-10 place-items-center rounded-full bg-surface-2"><Info className="h-5 w-5 text-subtle" /></span>{msg}</div>; }

/* -------------------------------------------------------------- charts -- */

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#84cc16", "#ec4899"];

function Bars({ items, fmt, tone = "primary" }: { items: C360NameVal[]; fmt: (n: number) => string; tone?: "primary" | "info" | "accent" | "danger" }) {
  if (!items.length) return <EmptyState msg="No data." />;
  const max = Math.max(...items.map((i) => i.value), 1);
  const bar = { primary: "bg-primary", info: "bg-info", accent: "bg-accent", danger: "bg-danger" }[tone];
  return <div className="space-y-2">{items.map((it, i) => (
    <div key={i}><div className="mb-0.5 flex items-center justify-between text-2xs"><span className="truncate text-muted">{it.name}</span><span className="font-semibold text-foreground">{fmt(it.value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} /></div></div>
  ))}</div>;
}

function Donut({ items, fmt }: { items: C360NameVal[]; fmt: (n: number) => string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <EmptyState msg="No data." />;
  let acc = 0; const R = 32, C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 80 80" className="h-28 w-28 -rotate-90">
        {items.map((it, i) => { const frac = it.value / total; const seg = <circle key={i} cx="40" cy="40" r={R} fill="none" stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth="14" strokeDasharray={`${frac * C} ${C}`} strokeDashoffset={-acc * C} />; acc += frac; return seg; })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1">{items.map((it, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-2xs"><span className="flex min-w-0 items-center gap-1.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /><span className="truncate text-muted">{it.name}</span></span><span className="font-semibold text-foreground">{fmt(it.value)}</span></div>
      ))}</div>
    </div>
  );
}

function LineChart({ items, fmt }: { items: C360NameVal[]; fmt: (n: number) => string }) {
  if (items.length < 2) return <Bars items={items} fmt={fmt} />;
  const max = Math.max(...items.map((i) => i.value), 1);
  const W = 600, H = 140, pad = 8;
  const pts = items.map((it, i) => { const x = pad + (i / (items.length - 1)) * (W - 2 * pad); const y = H - pad - (it.value / max) * (H - 2 * pad); return `${x},${y}`; });
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="h-44 w-full min-w-[480px]">
        <polyline fill="none" stroke="var(--color-primary, #6366f1)" strokeWidth="2.5" points={pts.join(" ")} />
        {items.map((it, i) => { const [x, y] = pts[i].split(",").map(Number); return <g key={i}><circle cx={x} cy={y} r="3" fill="var(--color-primary, #6366f1)" /><text x={x} y={H + 16} textAnchor="middle" className="fill-subtle text-[8px]">{it.name.slice(2)}</text></g>; })}
      </svg>
      <div className="mt-1 text-right text-2xs text-muted">Peak: <span className="font-semibold text-foreground">{fmt(max)}</span></div>
    </div>
  );
}

function Ring({ pct, tone = "primary" }: { pct: number; tone?: "primary" | "danger" }) {
  const R = 26, C = 2 * Math.PI * R; const color = tone === "danger" ? "#ef4444" : "#6366f1";
  return <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90"><circle cx="32" cy="32" r={R} fill="none" stroke="var(--color-surface-2,#eee)" strokeWidth="8" /><circle cx="32" cy="32" r={R} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} /></svg>;
}

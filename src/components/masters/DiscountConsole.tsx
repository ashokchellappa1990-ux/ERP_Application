"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  LayoutDashboard, Percent, FlaskConical, History, BarChart3, ScrollText, Settings2,
  Plus, Search, Pencil, Trash2, CheckCircle2, XCircle, Save, X, Play, TrendingUp,
  IndianRupee, CalendarClock, Clock, SlidersHorizontal, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { DISCOUNT_STATUSES, CHANNELS, PAYMENT_MODES, GST_TIMINGS, PRIORITY_CHAIN, type DiscountRow, type AccountRef } from "@/lib/contracts/discount";
import { API, inp, lbl, inr, lakh, STATUS_TONE, post, Grid, F, Sel, Tog, MultiSelect } from "@/components/masters/discountUi";
import { cn } from "@/lib/cn";

const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "discounts", label: "Discount Master", icon: Percent },
  { id: "simulation", label: "Simulation", icon: FlaskConical },
  { id: "usage", label: "Usage History", icon: History },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "config", label: "Configuration", icon: Settings2 },
];

export function DiscountConsole() {
  const initialTab = useSearchParams().get("tab") || "dashboard";
  const [tab, setTab] = useState(initialTab);
  const [flash, setFlash] = useState("");
  const say = useCallback((m: string) => { setFlash(m); window.setTimeout(() => setFlash(""), 3200); }, []);
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>System</span><span className="text-subtle">/</span><span>Masters</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Discount Management</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Percent className="h-5 w-5 text-primary" /> Discount Management</h1>
        <p className="mt-0.5 text-sm text-muted">The centralized discount rule engine — every billing transaction resolves discounts here.</p>
      </div>

      {flash && <div className="rounded-lg border border-primary/30 bg-primary-subtle px-4 py-2.5 text-sm font-medium text-primary shadow-sm">{flash}</div>}

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-semibold transition", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "discounts" && <DiscountsTab say={say} />}
      {tab === "simulation" && <SimulationTab />}
      {tab === "usage" && <UsageTab />}
      {tab === "analytics" && <AnalyticsTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "config" && <ConfigTab say={say} />}
    </div>
  );
}

/* ------------------------------------------------------------ dashboard -- */
const STAT_TONES = { primary: "bg-primary text-white", success: "bg-success text-white", warning: "bg-warning text-white", danger: "bg-danger text-white", secondary: "bg-secondary text-white", accent: "bg-accent text-accent-foreground" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: keyof typeof STAT_TONES }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg shadow-sm", STAT_TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-xl font-bold tracking-tight text-foreground">{value}</p></div>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}
function DashboardTab() {
  const [d, setD] = useState<{ kpis: Record<string, number>; byType: { label: string; value: number; count: number }[]; top: { code: string; name: string; type: string; given: number; used: number }[] } | null>(null);
  useEffect(() => { fetch(`${API}/dashboard`, { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setD(j)).catch(() => {}); }, []);
  if (!d) return <div className="py-16"><AppLoader label="Loading dashboard…" /></div>;
  const k = d.kpis; const max = Math.max(1, ...d.byType.map((t) => t.value));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={Percent} label="Active Discounts" value={String(k.active)} tone="success" />
        <Stat icon={CalendarClock} label="Scheduled" value={String(k.scheduled)} tone="secondary" />
        <Stat icon={XCircle} label="Expired" value={String(k.expired)} tone="danger" />
        <Stat icon={IndianRupee} label="Today's Discount" value={lakh(k.todayValue)} tone="warning" />
        <Stat icon={TrendingUp} label="Total Given" value={lakh(k.totalGiven)} tone="primary" />
        <Stat icon={History} label="Total Usage" value={k.usage.toLocaleString("en-IN")} tone="accent" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-foreground">Discount by Type</h3>
          {d.byType.length === 0 ? <Empty /> : (
            <div className="space-y-2.5">
              {d.byType.map((t) => (
                <div key={t.label}>
                  <div className="mb-0.5 flex justify-between text-xs"><span className="font-medium text-foreground">{t.label}</span><span className="text-muted">{inr(t.value)} · {t.count}</span></div>
                  <div className="h-2 rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${(t.value / max) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-foreground">Top Discounts</h3>
          {d.top.length === 0 ? <Empty /> : (
            <div className="space-y-1.5">
              {d.top.map((t, i) => (
                <div key={t.code} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-subtle text-xs font-bold text-primary">{i + 1}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-foreground">{t.name}</div><div className="text-2xs text-subtle">{t.code} · {t.type}</div></div>
                  <div className="text-right"><div className="text-sm font-bold text-foreground">{inr(t.given)}</div><div className="text-2xs text-muted">{t.used} uses</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
const Empty = () => <p className="py-8 text-center text-sm text-muted">No data yet — create & apply discounts to see insights.</p>;

/* ---------------------------------------------------------- discount list */
// User-customizable columns — Discount (name), Status & Actions always show;
// everything else here can be toggled on/off, persisted per-browser.
const TOGGLE_COLS = [
  { key: "type", label: "Type" },
  { key: "customer", label: "Customer" },
  { key: "product", label: "Product" },
  { key: "value", label: "Value" },
  { key: "priority", label: "Priority" },
  { key: "period", label: "Period" },
  { key: "used", label: "Used" },
] as const;
type ColKey = (typeof TOGGLE_COLS)[number]["key"];
const COLS_STORAGE_KEY = "discount-list-columns";

function ColumnPicker({ cols, onToggle }: { cols: Set<ColKey>; onToggle: (k: ColKey) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((o) => !o)}><SlidersHorizontal className="h-4 w-4" /> Columns</Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-border bg-card p-3 shadow-xl">
            <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-subtle">Visible Columns</p>
            <div className="space-y-1.5">
              {TOGGLE_COLS.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={cols.has(c.key)} onChange={() => onToggle(c.key)} className="h-4 w-4 accent-primary" />
                  {c.label}
                </label>
              ))}
            </div>
            <p className="mt-2 border-t border-border pt-2 text-2xs text-subtle">Discount, Status &amp; Actions always show.</p>
          </div>
        </>
      )}
    </div>
  );
}

function DiscountsTab({ say }: { say: (m: string) => void }) {
  const [rows, setRows] = useState<DiscountRow[] | null>(null);
  const [q, setQ] = useState(""); const [status, setStatus] = useState("All");
  const [cols, setCols] = useState<Set<ColKey>>(new Set(TOGGLE_COLS.map((c) => c.key)));
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(COLS_STORAGE_KEY) ?? "null"); if (Array.isArray(saved)) setCols(new Set(saved)); } catch { /* ignore */ }
  }, []);
  const toggleCol = (k: ColKey) => setCols((prev) => {
    const next = new Set(prev); if (next.has(k)) next.delete(k); else next.add(k);
    try { localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
    return next;
  });

  const load = useCallback(() => {
    const p = new URLSearchParams({ status, q }); setRows(null);
    fetch(`${API}/list?${p}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : [])).catch(() => setRows([]));
  }, [status, q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const changeStatus = async (id: number, st: string) => { const j = await post({ action: "setStatus", id, status: st }); say(j.message || "Updated"); load(); };
  const del = async (id: number) => { if (!confirm("Delete this discount?")) return; const j = await post({ action: "delete", id }); say(j.message || "Deleted"); load(); };
  const colSpan = 3 + cols.size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code, type…" className={cn(inp, "pl-9")} /></div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(inp, "w-auto")}>{["All", ...DISCOUNT_STATUSES].map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="flex items-center gap-2">
          <ColumnPicker cols={cols} onToggle={toggleCol} />
          <Link href="/masters/discount/new"><Button><Plus className="h-4 w-4" /> Create Discount</Button></Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
              <th className="px-4 py-3">Discount</th>
              {cols.has("type") && <th className="px-4 py-3">Type</th>}
              {cols.has("customer") && <th className="px-4 py-3">Customer</th>}
              {cols.has("product") && <th className="px-4 py-3">Product</th>}
              {cols.has("value") && <th className="px-4 py-3 text-center">Value</th>}
              {cols.has("priority") && <th className="px-4 py-3 text-center">Priority</th>}
              {cols.has("period") && <th className="px-4 py-3">Period</th>}
              {cols.has("used") && <th className="px-4 py-3 text-right">Used</th>}
              <th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {rows === null && <tr><td colSpan={colSpan} className="px-4 py-10"><AppLoader label="Loading discounts…" size="sm" /></td></tr>}
              {rows?.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-white shadow-sm"><Percent className="h-4 w-4" /></span><div className="min-w-0"><div className="truncate font-semibold text-foreground">{d.name}</div><div className="text-2xs text-subtle">{d.code}{d.combinable ? " · combinable" : ""}</div></div></div></td>
                  {cols.has("type") && <td className="px-4 py-3 text-muted">{d.discountType}</td>}
                  {cols.has("customer") && <td className="px-4 py-3 text-2xs text-muted"><span className="block max-w-[200px] truncate" title={d.customerNames}>{d.customerNames || "—"}</span></td>}
                  {cols.has("product") && <td className="px-4 py-3 text-2xs text-muted"><span className="block max-w-[200px] truncate" title={d.productNames}>{d.productNames || "—"}</span></td>}
                  {cols.has("value") && <td className="px-4 py-3 text-center"><span className="rounded-full bg-primary-subtle px-2 py-0.5 text-xs font-bold text-primary">{d.method === "percentage" ? `${d.value}%` : d.method === "fixed_price" ? `₹${d.value} SP` : inr(d.value)}</span></td>}
                  {cols.has("priority") && <td className="px-4 py-3 text-center text-muted">{d.priority}</td>}
                  {cols.has("period") && <td className="px-4 py-3 text-2xs text-muted">{d.startDate || "—"} → {d.endDate || "—"}</td>}
                  {cols.has("used") && <td className="px-4 py-3 text-right font-medium text-foreground">{d.usageCount.toLocaleString("en-IN")}</td>}
                  <td className="px-4 py-3 text-center"><Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status}</Badge></td>
                  <td className="px-4 py-3"><div className="flex items-center justify-end gap-1">
                    {d.status !== "Active" ? <button onClick={() => changeStatus(d.id, "Active")} title="Activate" className="grid h-8 w-8 place-items-center rounded-md border border-success/30 bg-success/10 text-success transition hover:bg-success hover:text-white"><CheckCircle2 className="h-4 w-4" /></button>
                      : <button onClick={() => changeStatus(d.id, "Inactive")} title="Deactivate" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-warning hover:text-warning"><XCircle className="h-4 w-4" /></button>}
                    <Link href={`/masters/discount/${d.id}`} title="Edit" className="grid h-8 w-8 place-items-center rounded-md border border-primary/30 bg-primary-subtle text-primary transition hover:bg-primary hover:text-white"><Pencil className="h-4 w-4" /></Link>
                    <button onClick={() => del(d.id)} title="Delete" className="grid h-8 w-8 place-items-center rounded-md border border-transparent text-muted transition hover:border-danger/40 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              ))}
              {rows?.length === 0 && <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted">No discounts yet. Click <b>Create Discount</b> to add the first rule.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ simulation */
interface SimLine { key: string; id: number; name: string; rate: number; gst: number; qty: number; disc: number }
interface SimProduct { value: string; label: string; name: string; rate: number; gst: number; category: string; brand: string }
function SimulationTab() {
  const [products, setProducts] = useState<SimProduct[]>([]);
  const [groups, setGroups] = useState<string[]>([]); const [levels, setLevels] = useState<string[]>([]);
  const [cart, setCart] = useState<SimLine[]>([]);
  const [channel, setChannel] = useState("POS"); const [group, setGroup] = useState(""); const [membership, setMembership] = useState(""); const [pay, setPay] = useState("Cash");
  const [auto, setAuto] = useState<{ total: number; netReduction: number; applied: { code: string; name: string; discountType: string; discountAmount: number; account: string }[]; skipped: { code: string; name: string; reason: string }[] }>({ total: 0, netReduction: 0, applied: [], skipped: [] });

  useEffect(() => { fetch(`${API}/options`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { setProducts(j.products); setGroups(j.customerGroups); setLevels(j.membershipLevels); } }); }, []);
  const add = (id: string) => { const p = products.find((x) => x.value === id); if (!p) return; setCart((c) => [...c, { key: `${id}-${c.length}-${p.name.length}`, id: Number(p.value), name: p.name, rate: p.rate || 0, gst: p.gst || 0, qty: 1, disc: 0 }]); };
  const upd = (key: string, patch: Partial<SimLine>) => setCart((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const del = (key: string) => setCart((c) => c.filter((l) => l.key !== key));

  const t = useMemo(() => {
    const rows = cart.map((l) => { const gross = l.qty * l.rate; const d = gross * (l.disc || 0) / 100; const net = gross - d; const tv = l.gst > 0 ? net / (1 + l.gst / 100) : net; const p = products.find((x) => x.value === String(l.id)); return { ...l, net, tv, category: p?.category, brand: p?.brand }; });
    const subtotal = cart.reduce((s, l) => s + l.qty * l.rate, 0);
    const netOfItem = +rows.reduce((s, r) => s + r.net, 0).toFixed(2);
    const engLines = rows.map((r) => ({ productId: r.id, qty: r.qty, amount: +r.net.toFixed(2), taxable: +r.tv.toFixed(2), category: r.category, brand: r.brand }));
    const key = netOfItem.toFixed(2) + "|" + engLines.map((l) => `${l.productId}:${l.qty}:${l.amount}`).join(",");
    const netReduction = Math.max(0, Math.min(auto.netReduction, netOfItem));
    let taxable = 0, tax = 0; const perLine: Record<string, { material: number; tax: number; amount: number; auto: number }> = {};
    for (const r of rows) { const share = netOfItem > 0 ? r.net / netOfItem : 0; const newNet = r.net - netReduction * share; const tv = r.gst > 0 ? newNet / (1 + r.gst / 100) : newNet; const lt = r.gst > 0 ? newNet - tv : 0; taxable += tv; tax += lt; perLine[r.key] = { material: +tv.toFixed(2), tax: +lt.toFixed(2), amount: +newNet.toFixed(2), auto: +(Math.min(auto.total, netOfItem) * share).toFixed(2) }; }
    const total = Math.max(0, Math.round(taxable + tax));
    return { subtotal, netOfItem, engLines, key, taxable: +taxable.toFixed(2), tax: +tax.toFixed(2), cgst: +(tax / 2).toFixed(2), sgst: +(tax - tax / 2).toFixed(2), total, roundOff: +(total - (taxable + tax)).toFixed(2), perLine, autoTotal: +Math.min(auto.total, netOfItem).toFixed(2) };
  }, [cart, products, auto.total, auto.netReduction]);

  useEffect(() => {
    if (!cart.length || t.netOfItem <= 0) { setAuto((a) => (a.total === 0 && !a.applied.length ? a : { total: 0, netReduction: 0, applied: [], skipped: [] })); return; }
    const ctrl = new AbortController();
    const id = window.setTimeout(async () => {
      const j = await fetch(`${API}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal, body: JSON.stringify({ action: "preview", channel, customerGroup: group || undefined, membershipLevel: membership || undefined, paymentMode: pay, billAmount: t.netOfItem, lines: t.engLines }) }).then((r) => r.json()).catch(() => null);
      if (j?.ok && j.result) setAuto({ total: +(j.result.totalDiscount || 0), netReduction: +(j.result.netReductionTotal || 0), applied: j.result.applied || [], skipped: j.result.skipped || [] });
      else setAuto({ total: 0, netReduction: 0, applied: [], skipped: [] });
    }, 300);
    return () => { clearTimeout(id); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.key, channel, group, membership, pay]);

  const Row = ({ k, v, tone }: { k: string; v: string; tone?: string }) => <div className="flex justify-between text-sm"><span className="text-muted">{k}</span><span className={cn("font-medium", tone === "danger" ? "text-danger" : "text-foreground")}>{v}</span></div>;
  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-primary/20 bg-primary-subtle/30 px-3 py-2 text-2xs text-muted">Build a mock bill exactly like the POS screen — add products, set qty & line discount, pick the customer context — and see live which discount rule applies, the recomputed GST and the final payable.</p>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <F label="Channel"><Sel v={channel} opts={[...CHANNELS]} on={setChannel} /></F>
            <F label="Payment"><Sel v={pay} opts={[...PAYMENT_MODES]} on={setPay} /></F>
            <F label="Customer Group"><Sel v={group} opts={["", ...groups]} on={setGroup} /></F>
            <F label="Membership"><Sel v={membership} opts={["", ...levels]} on={setMembership} /></F>
          </div>
          <div><span className={lbl}>Add product to bill</span><MultiSelect single options={products} value={[]} onChange={(v) => v[0] && add(v[0])} placeholder="Search & add product…" /></div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Disc %</th><th className="px-3 py-2 text-right">Taxable</th><th className="px-3 py-2 text-right">Tax</th><th className="px-3 py-2 text-right">Amount</th><th /></tr></thead>
              <tbody>
                {cart.map((l) => (
                  <tr key={l.key} className="border-b border-border last:border-0">
                    <td className="px-3 py-2"><div className="font-medium text-foreground">{l.name}</div><div className="text-2xs text-subtle">{l.gst}% GST{(t.perLine[l.key]?.auto ?? 0) > 0 ? ` · Offer −${inr(t.perLine[l.key].auto)}` : ""}</div></td>
                    <td className="px-3 py-2 text-center"><input type="number" value={l.qty} onChange={(e) => upd(l.key, { qty: Math.max(1, Number(e.target.value)) })} className={cn(inp, "h-7 w-14 px-1 text-center")} /></td>
                    <td className="px-3 py-2 text-right"><input type="number" value={l.rate} onChange={(e) => upd(l.key, { rate: Number(e.target.value) })} className={cn(inp, "h-7 w-20 px-1 text-right")} /></td>
                    <td className="px-3 py-2 text-right"><input type="number" value={l.disc || ""} onChange={(e) => upd(l.key, { disc: Math.max(0, Number(e.target.value)) })} placeholder="0" className={cn(inp, "h-7 w-14 px-1 text-right")} /></td>
                    <td className="px-3 py-2 text-right text-foreground">{inr(t.perLine[l.key]?.material ?? 0)}</td>
                    <td className="px-3 py-2 text-right text-muted">{inr(t.perLine[l.key]?.tax ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{inr(t.perLine[l.key]?.amount ?? 0)}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => del(l.key)} className="text-danger hover:opacity-70"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
                {cart.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">Add a product to start the simulation.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Row k={`Items (${cart.length})`} v={inr(t.subtotal)} />
            {t.autoTotal > 0 && <Row k={`Discount${auto.applied.length === 1 ? ` (${auto.applied[0].name})` : auto.applied.length > 1 ? ` (${auto.applied.length} offers)` : ""}`} v={`− ${inr(t.autoTotal)}`} tone="danger" />}
            <Row k="Taxable Value" v={inr(t.taxable)} />
            <Row k="CGST" v={inr(t.cgst)} /><Row k="SGST" v={inr(t.sgst)} />
            {Math.abs(t.roundOff) > 0.001 && <Row k="Round Off" v={inr(t.roundOff)} />}
            <div className="mt-1 flex justify-between border-t border-border pt-1.5 text-lg font-bold text-foreground"><span>Total</span><span>{inr(t.total)}</span></div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-bold text-foreground">Applied discounts</h3>
            {auto.applied.length === 0 ? <p className="py-3 text-center text-2xs text-muted">No rule matches this bill yet.</p> : auto.applied.map((a) => (
              <div key={a.code} className="mb-1.5 flex items-center justify-between rounded-lg border border-success/30 bg-success/5 px-3 py-2"><div><div className="text-sm font-semibold text-foreground">{a.name}</div><div className="text-2xs text-subtle">{a.code} · {a.discountType} · Ledger {a.account}</div></div><div className="text-sm font-bold text-success">− {inr(a.discountAmount)}</div></div>
            ))}
            {auto.skipped.length > 0 && <div className="mt-2"><div className={lbl}>Not applied</div>{auto.skipped.slice(0, 6).map((sk) => <div key={sk.code} className="flex justify-between rounded border border-border bg-surface px-2.5 py-1 text-2xs"><span className="font-medium text-foreground">{sk.name}</span><span className="text-muted">{sk.reason}</span></div>)}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- usage / audit */
function UsageTab() {
  const [rows, setRows] = useState<{ id: number; discountCode: string; discountName: string; invoiceNo: string; customerName: string; billAmount: number; discountAmount: number; channel: string; at: string }[] | null>(null);
  useEffect(() => { fetch(`${API}/usage`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : [])); }, []);
  if (rows === null) return <div className="py-16"><AppLoader label="Loading usage…" /></div>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Date</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Bill</th><th className="px-4 py-3 text-right">Discount</th><th className="px-4 py-3">Channel</th></tr></thead>
      <tbody>{rows.map((u) => <tr key={u.id} className="border-b border-border last:border-0"><td className="px-4 py-2.5 text-2xs text-muted">{u.at.slice(0, 10)}</td><td className="px-4 py-2.5"><div className="font-semibold text-foreground">{u.discountName}</div><div className="text-2xs text-subtle">{u.discountCode}</div></td><td className="px-4 py-2.5 text-muted">{u.invoiceNo || "—"}</td><td className="px-4 py-2.5 text-muted">{u.customerName || "—"}</td><td className="px-4 py-2.5 text-right">{inr(u.billAmount)}</td><td className="px-4 py-2.5 text-right font-semibold text-success">− {inr(u.discountAmount)}</td><td className="px-4 py-2.5 text-2xs text-muted">{u.channel || "—"}</td></tr>)}
      {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No discount usage recorded yet.</td></tr>}</tbody>
    </table></div></div>
  );
}
function AuditTab() {
  const [rows, setRows] = useState<{ id: number; entityType: string; action: string; byName: string; note: string; at: string }[] | null>(null);
  useEffect(() => { fetch(`${API}/audit`, { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : [])); }, []);
  if (rows === null) return <div className="py-16"><AppLoader label="Loading audit log…" /></div>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="divide-y divide-border">
      {rows.map((a) => <div key={a.id} className="flex items-center gap-3 px-4 py-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-subtle text-primary"><ScrollText className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="text-sm font-medium text-foreground">{a.action} <span className="text-muted">· {a.entityType}</span></div><div className="text-2xs text-subtle">{a.note}</div></div><div className="text-right text-2xs text-muted"><div>{a.byName}</div><div className="flex items-center gap-1"><Clock className="h-3 w-3" />{a.at.slice(0, 16).replace("T", " ")}</div></div></div>)}
      {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No audit entries yet.</p>}
    </div></div>
  );
}
function AnalyticsTab() {
  const [d, setD] = useState<{ topUsed: { code: string; name: string; used: number; given: number }[]; unused: { code: string; name: string; type: string }[]; expiringSoon: { code: string; name: string; endDate: string }[] } | null>(null);
  useEffect(() => { fetch(`${API}/analytics`, { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setD(j)); }, []);
  if (!d) return <div className="py-16"><AppLoader label="Loading analytics…" /></div>;
  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h3 className="mb-3 text-sm font-bold text-foreground">{title}</h3>{children}</div>;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Most Used"><div className="space-y-1.5">{d.topUsed.map((t) => <div key={t.code} className="flex justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"><span className="font-medium text-foreground">{t.name}</span><span className="text-muted">{t.used} · {inr(t.given)}</span></div>)}{d.topUsed.length === 0 && <Empty />}</div></Card>
      <Card title="Unused (Active)"><div className="space-y-1.5">{d.unused.map((u) => <div key={u.code} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"><div className="font-medium text-foreground">{u.name}</div><div className="text-2xs text-subtle">{u.type}</div></div>)}{d.unused.length === 0 && <Empty />}</div></Card>
      <Card title="Expiring in 7 days"><div className="space-y-1.5">{d.expiringSoon.map((e) => <div key={e.code} className="flex justify-between rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm"><span className="font-medium text-foreground">{e.name}</span><span className="text-2xs text-warning">{e.endDate}</span></div>)}{d.expiringSoon.length === 0 && <Empty />}</div></Card>
    </div>
  );
}

/* --------------------------------------------------------- configuration */
function ConfigTab({ say }: { say: (m: string) => void }) {
  const [c, setC] = useState<Record<string, unknown> | null>(null);
  const [accounts, setAccounts] = useState<AccountRef[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch(`${API}/config`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { setC(j.config); setAccounts(j.accounts); } }); }, []);
  if (!c) return <div className="py-16"><AppLoader label="Loading configuration…" /></div>;
  const set = (k: string, v: unknown) => setC({ ...c, [k]: v });
  const save = async () => { setBusy(true); const j = await post({ action: "saveConfig", ...c }); setBusy(false); if (j.ok) { setC(j.config); say(j.message); } };
  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="space-y-3">
          <Tog label="Enable Discount Module (billing resolves discounts from here)" on={!!c.enableModule} set={(v) => set("enableModule", v)} />
          <Tog label="Auto-apply best discount at billing" on={!!c.autoApply} set={(v) => set("autoApply", v)} />
          <Tog label="Round off final amount" on={!!c.roundOff} set={(v) => set("roundOff", v)} />
          <Grid>
            <F label="Code Prefix"><input className={inp} value={String(c.codePrefix)} onChange={(e) => set("codePrefix", e.target.value)} /></F>
            <F label="Code Length"><input type="number" className={inp} value={Number(c.codeLength)} onChange={(e) => set("codeLength", Number(e.target.value))} /></F>
            <F label="Next Number"><input className={cn(inp, "opacity-60")} value={Number(c.runningNumber)} disabled /></F>
            <F label="GST Default"><Sel v={String(c.gstDefault)} opts={[...GST_TIMINGS]} on={(v) => set("gstDefault", v)} /></F>
            <F label="Discount Ledger"><select className={inp} value={String(c.discountAccount)} onChange={(e) => set("discountAccount", e.target.value)}>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></F>
            <F label="Promotion Ledger"><select className={inp} value={String(c.promoAccount)} onChange={(e) => set("promoAccount", e.target.value)}>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></F>
          </Grid>
          <div><span className={lbl}>Priority Chain (best-discount resolution order)</span><div className="flex flex-wrap gap-1.5">{(c.priorityOrder as string[] ?? PRIORITY_CHAIN).map((p, i) => <span key={p} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-subtle px-2.5 py-1 text-2xs font-semibold text-primary">{i + 1}. {p}</span>)}</div></div>
        </div>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Configuration"}</Button></div>
    </div>
  );
}


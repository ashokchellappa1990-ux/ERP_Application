"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ScrollText, Search, Boxes, IndianRupee, ArrowDownLeft, ArrowUpRight, Layers, Package, LineChart, Eye, ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { formatNumberWith, formatMoneyWith } from "@/lib/settings/generalConfig";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";
import { MONTHS, currentYM, monthRange, yearOptions } from "@/lib/inventory/period";
import { cn } from "@/lib/cn";
import { UomConvert } from "@/components/uom/UomConvert";
import { StockPositionDrillIn, type DrillTarget } from "@/components/inventory/StockPositionDrillIn";
import type {
  LedgerRow,
  LedgerBalance as Balance,
  LedgerLot as Lot,
  LedgerStats as Stats,
  StockPositionRow as PosRow,
} from "@/lib/contracts/openingStock";

function ageDays(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}
const ageTone = (d: number | null) => (d == null ? "text-subtle" : d <= 30 ? "text-success" : d <= 90 ? "text-warning" : "text-danger");

const TYPE_TONE: Record<string, "success" | "danger" | "info" | "warning" | "neutral" | "primary"> = {
  OPENING: "primary", PURCHASE: "success", INWARD: "success", SALES: "danger",
  SALES_RETURN: "info", PURCHASE_RETURN: "warning", ADJUSTMENT: "neutral",
};
const TYPES = ["All", "OPENING", "PURCHASE", "INWARD", "SALES", "SALES_RETURN", "PURCHASE_RETURN", "ADJUSTMENT"];
const label = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function InventoryLedgerPage() {
  // Current Balance is the default first view.
  const [tab, setTab] = useState<"balances" | "movements" | "position" | "lots">("balances");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  // Day-wise movement view: "summary" collapses the per-QR-code rows into one row
  // per movement (default); "qr" shows one row per scanned QR code.
  const [qrView, setQrView] = useState<"summary" | "qr">("summary");
  // Movement date range — defaults to the current month (1st → today).
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(todayStr.slice(0, 8) + "01");
  const [dateTo, setDateTo] = useState(todayStr);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [stats, setStats] = useState<Stats>({ skuCount: 0, totalQty: 0, totalValue: 0, totalSellingValue: 0, movements: 0 });
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  // Area / Brand / Inventory Category filters — narrow both the movement log
  // and the current-balance view (Area only tags GRN + Load & Dispatch
  // movements today, so it filters the movement/lots views; Brand and
  // Inventory Category apply everywhere via the Product relation).
  const [areas, setAreas] = useState<{ id: number; name: string; code: string }[]>([]);
  const [areaId, setAreaId] = useState<number | "">("");
  const [brand, setBrand] = useState("");
  const [invCategory, setInvCategory] = useState("All");
  useEffect(() => {
    (async () => {
      const j = await fetch("/api/system/areas", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) setAreas(j.rows.map((a: { id: number; name: string; code: string }) => ({ id: a.id, name: a.name, code: a.code })));
    })();
  }, []);
  const brandOptions = useMemo(() => Array.from(new Set(balances.map((b) => b.brand).filter(Boolean))).sort(), [balances]);

  // General settings (value formatting + report column visibility)
  const cfg = useGeneralConfig();
  const fq = (n: number) => formatNumberWith(cfg, n, Number(cfg.fields.qtyDecimals) || 0);
  const fm = (n: number) => formatMoneyWith(cfg, n);

  // Stock Position (day-wise OB/Receipt/Sales/Return/Damage/CB) — defaults to current month.
  const [posProduct, setPosProduct] = useState<Balance | null>(null);
  const [posRows, setPosRows] = useState<PosRow[]>([]);
  const [openingBal, setOpeningBal] = useState(0);
  const [posLoading, setPosLoading] = useState(false);
  const cur = currentYM();
  const [year, setYear] = useState(cur.year);
  const [month, setMonth] = useState(cur.month);
  const openPosition = (b: Balance) => { setPosProduct(b); setTab("position"); };
  const [drill, setDrill] = useState<DrillTarget | null>(null);
  useEffect(() => {
    if (!posProduct) return;
    let active = true;
    setPosLoading(true);
    (async () => {
      try {
        const { from, to } = monthRange(year, month);
        const params = new URLSearchParams({ productId: String(posProduct.productId), from, to });
        if (areaId) params.set("areaId", String(areaId));
        const j = await fetch(`/api/inventory/stock-position?${params}`, { cache: "no-store" }).then((r) => r.json());
        if (active && j.ok) { setPosRows(j.rows); setOpeningBal(j.openingBalance ?? 0); }
      } catch { /* ignore */ } finally { if (active) setPosLoading(false); }
    })();
    return () => { active = false; };
  }, [posProduct, year, month, areaId]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, type, from: dateFrom, to: dateTo });
        if (areaId) params.set("areaId", String(areaId));
        if (brand) params.set("brand", brand);
        if (invCategory !== "All") params.set("inventoryCategory", invCategory);
        const res = await fetch(`/api/inventory/ledger?${params}`, { cache: "no-store", signal: ctrl.signal });
        if (res.status === 401) { setNotAuthed(true); return; }
        const j = await res.json().catch(() => ({}));
        if (j.ok) { setNotAuthed(false); setRows(j.rows); setBalances(j.balances); setLots(j.lots ?? []); setStats(j.stats); }
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, type, dateFrom, dateTo, areaId, brand, invCategory]);

  // Non-QR (summary) view collapses the per-QR-code rows into one row per movement
  // (same day · product · type · direction · ref · batch) — summing qty/value and
  // keeping the latest running balance. QR view shows every per-code row.
  const displayRows = useMemo(() => {
    if (qrView === "qr") return rows;
    const map = new Map<string, LedgerRow>();
    for (const r of rows) {
      const key = `${r.txnDate}|${r.productName}|${r.sku}|${r.txnType}|${r.direction}|${r.refNo}|${r.batchNo}`;
      const cur = map.get(key);
      if (cur) {
        cur.qty += r.qty;
        if (r.value != null) cur.value = (cur.value ?? 0) + r.value;
        if (r.id > cur.id) { cur.balanceQty = r.balanceQty; cur.id = r.id; }
      } else {
        map.set(key, { ...r, qrCode: "" });
      }
    }
    return Array.from(map.values());
  }, [rows, qrView]);

  // Group movements by day for the day-wise log.
  const byDay = useMemo(() => {
    const map = new Map<string, LedgerRow[]>();
    for (const r of displayRows) { (map.get(r.txnDate) ?? map.set(r.txnDate, []).get(r.txnDate)!).push(r); }
    return Array.from(map.entries());
  }, [displayRows]);


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Inventory</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Inventory Ledger</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ScrollText className="h-5 w-5 text-primary" /> Inventory Ledger</h1>
          <p className="mt-0.5 text-sm text-muted">Day-wise stock movements per product &amp; QR code — opening, purchase, inward, sales, returns &amp; adjustments.</p>
        </div>
        <Link href="/masters/opening-stock" className="text-xs font-semibold text-primary hover:underline">Opening Stock →</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={Boxes} label="SKUs in stock" value={String(stats.skuCount)} tone="primary" />
        <Stat icon={Layers} label="Units on hand" value={fq(stats.totalQty)} tone="info" />
        <Stat icon={IndianRupee} label="Stock value" value={fm(stats.totalValue)} tone="success" />
        <Stat icon={ScrollText} label="Movements" value={String(stats.movements)} tone="accent" />
      </div>

      {/* Toolbar */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <TabBtn active={tab === "balances"} onClick={() => setTab("balances")}>Current Balances</TabBtn>
            <TabBtn active={tab === "position"} onClick={() => setTab("position")}>Stock Position</TabBtn>
            <TabBtn active={tab === "movements"} onClick={() => setTab("movements")}>Day-wise Movements</TabBtn>
            <TabBtn active={tab === "lots"} onClick={() => setTab("lots")}>Age-wise (Lots)</TabBtn>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product, SKU or QR code…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
            </div>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : "")} className="h-9 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none">
              <option value="">All areas</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none">
              <option value="">All brands</option>
              {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              {(["All", "Raw Material", "Finished Product"] as const).map((c) => (
                <button key={c} onClick={() => setInvCategory(c)} className={cn("px-2.5 py-1.5 text-xs font-semibold transition", invCategory === c ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{c}</button>
              ))}
            </div>
            {tab === "movements" && (
              <>
                {/* Movement date range — defaults to the current month (1st → today). */}
                <div className="flex items-center gap-1 text-2xs text-muted">
                  <span className="font-semibold">From</span>
                  <input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none" />
                  <span className="font-semibold">To</span>
                  <input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none" />
                </div>
                {/* Movement view — collapse per-QR rows (default) or show per QR code. */}
                <div className="inline-flex overflow-hidden rounded-md border border-border">
                  <button onClick={() => setQrView("summary")} className={cn("px-2.5 py-1.5 text-xs font-semibold transition", qrView === "summary" ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>Non-QR</button>
                  <button onClick={() => setQrView("qr")} className={cn("px-2.5 py-1.5 text-xs font-semibold transition", qrView === "qr" ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>QR Code</button>
                </div>
                <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none">
                  {TYPES.map((t) => <option key={t} value={t}>{t === "All" ? "All types" : label(t)}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Movements (day-wise) */}
        {tab === "movements" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                  <th className="px-4 py-3">Product</th>{qrView === "qr" && <th className="px-4 py-3">QR Code</th>}<th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">In</th><th className="px-4 py-3 text-right">Out</th>
                  <th className="px-4 py-3 text-right">Balance</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3">Ref</th>
                </tr>
              </thead>
              <tbody>
                {byDay.map(([day, items]) => (
                  <FragmentRows key={day} day={day} items={items} fq={fq} fm={fm} showQr={qrView === "qr"} />
                ))}
                {loading && rows.length === 0 && <tr><td colSpan={qrView === "qr" ? 8 : 7} className="px-4 py-8"><AppLoader label="Loading ledger…" size="sm" /></td></tr>}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={qrView === "qr" ? 8 : 7} className="px-4 py-10 text-center text-sm text-muted">
                    {notAuthed ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</> : <>No movements yet. Generate QR for an <Link href="/masters/opening-stock" className="font-semibold text-primary hover:underline">opening stock</Link> to populate the ledger.</>}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Balances */}
        {tab === "balances" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                  <th className="px-4 py-3">Product</th><th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3 text-right">On Hand</th><th className="px-4 py-3 text-right">WIP / In-Process</th><th className="px-4 py-3 text-right">Purchase Rate</th><th className="px-4 py-3 text-right">Selling Price</th><th className="px-4 py-3 text-right">Purchase Value</th><th className="px-4 py-3 text-right">Selling Value</th><th className="px-4 py-3 text-center">Position</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                    <td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-subtle text-primary"><Package className="h-4 w-4" /></span><div><div className="font-medium text-foreground">{b.productName}</div><div className="font-mono text-2xs text-subtle">{b.sku}</div></div></div></td>
                    <td className="px-4 py-3 text-muted">{b.brand || "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground"><span className="inline-flex items-center gap-1.5">{fq(b.qtyOnHand)} <span className="text-2xs font-normal text-subtle">{b.uom}</span><UomConvert qty={b.qtyOnHand} uom={b.uom} /></span></td>
                    <td className="px-4 py-3 text-right font-semibold text-warning">{b.wipQty > 0 ? `${fq(b.wipQty)} ${b.uom}` : "—"}</td>
                    <td className="px-4 py-3 text-right text-muted">{b.purchaseRate != null ? fm(b.purchaseRate) : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-success">{b.sellingRate != null ? fm(b.sellingRate) : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{fm(b.value)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-success">{b.sellingRate != null ? fm(b.qtyOnHand * b.sellingRate) : "—"}</td>
                    <td className="px-4 py-3 text-center"><button onClick={() => openPosition(b)} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-muted transition hover:border-primary hover:text-primary"><Eye className="h-3.5 w-3.5" /> View</button></td>
                  </tr>
                ))}
                {loading && balances.length === 0 && <tr><td colSpan={9} className="px-4 py-8"><AppLoader label="Loading…" size="sm" /></td></tr>}
                {!loading && balances.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">No stock on hand yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Stock Position — day-wise OB / Receipt / Sales / Return / Damage / CB */}
        {tab === "position" && (
          <div>
            {!posProduct ? (
              <div className="px-4 py-12 text-center text-sm text-muted">
                Pick a product from <button onClick={() => setTab("balances")} className="font-semibold text-primary hover:underline">Current Balances</button> → <strong>View</strong> to see its day-wise stock position.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
                  <button onClick={() => { setTab("balances"); setPosProduct(null); }} className="inline-flex items-center gap-1 text-2xs font-semibold text-muted hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> Back to balances</button>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <LineChart className="h-4 w-4 text-primary" /><span className="font-bold text-foreground">{posProduct.productName}</span><span className="font-mono text-2xs text-subtle">{posProduct.sku}</span>
                    <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none">{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none">{yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}</select>
                    <Badge tone="info">Opening {fq(openingBal)}</Badge><Badge tone="primary">On hand {fq(posProduct.qtyOnHand)}</Badge>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <colgroup><col className="w-36" /><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
                    <thead>
                      <tr className="border-b border-border bg-surface-2 text-2xs font-semibold uppercase tracking-wider text-subtle">
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-right">OB</th>
                        {cfg.flags.rptShowReceipt && <th className="px-4 py-3 text-right text-success">Receipt</th>}
                        {cfg.flags.rptShowSales && <th className="px-4 py-3 text-right text-danger">Sales</th>}
                        {cfg.flags.rptShowReturn && <th className="px-4 py-3 text-right text-info">Sales Return</th>}
                        <th className="px-4 py-3 text-right text-primary">Purch. Return</th>
                        <th className="px-4 py-3 text-right text-warning">In-Transit</th>
                        <th className="px-4 py-3 text-right text-primary">Transfer Out</th>
                        <th className="px-4 py-3 text-right text-warning">Wastage</th>
                        <th className="px-4 py-3 text-right font-bold">CB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!posLoading && (
                        <tr className="border-b border-border bg-info-subtle/30">
                          <td className="px-4 py-2.5 text-left font-semibold text-foreground">Opening Balance</td>
                          <td className="px-4 py-2.5 text-right text-muted">—</td>
                          {cfg.flags.rptShowReceipt && <td className="px-4 py-2.5 text-right">—</td>}
                          {cfg.flags.rptShowSales && <td className="px-4 py-2.5 text-right">—</td>}
                          {cfg.flags.rptShowReturn && <td className="px-4 py-2.5 text-right">—</td>}
                          <td className="px-4 py-2.5 text-right">—</td>
                          <td className="px-4 py-2.5 text-right">—</td>
                          <td className="px-4 py-2.5 text-right">—</td>
                          <td className="px-4 py-2.5 text-right">—</td>
                          <td className="px-4 py-2.5 text-right font-bold text-foreground">{fq(openingBal)}</td>
                        </tr>
                      )}
                      {posRows.map((r, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                          <td className="px-4 py-2.5 text-left font-medium text-foreground">{r.date}</td>
                          <td className="px-4 py-2.5 text-right text-muted">{fq(r.ob)}</td>
                          {cfg.flags.rptShowReceipt && <DrillCell value={r.receipt} sign="+" tone="text-success" onClick={() => setDrill({ productId: posProduct!.productId, date: r.date, bucket: "receipt", areaId })} fq={fq} />}
                          {cfg.flags.rptShowSales && <DrillCell value={r.sales} sign="-" tone="text-danger" onClick={() => setDrill({ productId: posProduct!.productId, date: r.date, bucket: "sales", areaId })} fq={fq} />}
                          {cfg.flags.rptShowReturn && <DrillCell value={r.ret} sign="+" tone="text-info" onClick={() => setDrill({ productId: posProduct!.productId, date: r.date, bucket: "ret", areaId })} fq={fq} />}
                          <DrillCell value={r.purchaseRet} sign="-" tone="text-primary" onClick={() => setDrill({ productId: posProduct!.productId, date: r.date, bucket: "purchaseRet", areaId })} fq={fq} />
                          <DrillCell value={r.inTransit} sign="-" tone="text-warning" onClick={() => setDrill({ productId: posProduct!.productId, date: r.date, bucket: "inTransit", areaId })} fq={fq} />
                          <DrillCell value={r.transfer} sign="-" tone="text-primary" onClick={() => setDrill({ productId: posProduct!.productId, date: r.date, bucket: "transfer", areaId })} fq={fq} />
                          <DrillCell value={r.wastage} sign="-" tone="text-warning" onClick={() => setDrill({ productId: posProduct!.productId, date: r.date, bucket: "wastage", areaId })} fq={fq} />
                          <td className="px-4 py-2.5 text-right font-bold text-foreground">{fq(r.cb)}</td>
                        </tr>
                      ))}
                      {posLoading && <tr><td colSpan={10} className="px-4 py-8"><AppLoader label="Loading position…" size="sm" /></td></tr>}
                      {!posLoading && posRows.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">No movements in {MONTHS[month]} {year} — closing stays at the opening balance.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Age-wise lots */}
        {tab === "lots" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                  <th className="px-4 py-3">Product</th><th className="px-4 py-3">Batch / Source</th><th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3 text-center">Age</th><th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3 text-right">Closing Qty</th><th className="px-4 py-3 text-right">Purchase Rate</th><th className="px-4 py-3 text-right">Selling Price</th><th className="px-4 py-3 text-right">Purchase Value</th><th className="px-4 py-3 text-right">Selling Value</th>
                </tr>
              </thead>
              <tbody>
                {lots.filter((l) => { const q = query.trim().toLowerCase(); return !q || [l.productName, l.sku, l.batchNo, l.refNo].some((v) => (v || "").toLowerCase().includes(q)); }).map((l, i) => {
                  const age = ageDays(l.receivedDate);
                  return (
                    <tr key={i} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                      <td className="px-4 py-2.5"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku}</div></td>
                      <td className="px-4 py-2.5 text-2xs"><div className="text-foreground">{l.batchNo || "—"}</div><div className="text-subtle">{l.refNo} {l.refType && `(${label(l.refType)})`}</div></td>
                      <td className="px-4 py-2.5 text-muted">{l.receivedDate || "—"}</td>
                      <td className={cn("px-4 py-2.5 text-center font-semibold", ageTone(age))}>{age != null ? `${age}d` : "—"}</td>
                      <td className="px-4 py-2.5 text-2xs text-muted">{l.expiryDate || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-foreground"><span className="inline-flex items-center gap-1.5">{fq(l.qtyOnHand)} <span className="text-2xs font-normal text-subtle">{l.uom}</span><UomConvert qty={l.qtyOnHand} uom={l.uom} /></span></td>
                      <td className="px-4 py-2.5 text-right text-muted">{l.purchaseRate != null ? fm(l.purchaseRate) : "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-success">{l.sellingRate != null ? fm(l.sellingRate) : "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-foreground">{fm(l.value)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-success">{l.sellingRate != null ? fm(l.qtyOnHand * l.sellingRate) : "—"}</td>
                    </tr>
                  );
                })}
                {loading && lots.length === 0 && <tr><td colSpan={10} className="px-4 py-8"><AppLoader label="Loading…" size="sm" /></td></tr>}
                {!loading && lots.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">No stock layers yet. Receive a GRN or opening stock to build age-wise lots.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {drill && <StockPositionDrillIn target={drill} onClose={() => setDrill(null)} fq={fq} fm={fm} />}
    </div>
  );
}

function DrillCell({ value, sign, tone, onClick, fq }: { value: number; sign: "+" | "-"; tone: string; onClick: () => void; fq: (n: number) => string }) {
  if (!value) return <td className="px-4 py-2.5 text-right text-subtle">—</td>;
  return (
    <td className="px-4 py-2.5 text-right">
      <button onClick={onClick} className={cn("font-semibold underline decoration-dotted underline-offset-2 hover:decoration-solid", tone)}>{sign}{fq(value)}</button>
    </td>
  );
}

function FragmentRows({ day, items, fq, fm, showQr }: { day: string; items: LedgerRow[]; fq: (n: number) => string; fm: (n: number) => string; showQr: boolean }) {
  return (
    <>
      <tr className="bg-surface-2/60"><td colSpan={showQr ? 8 : 7} className="px-4 py-1.5 text-2xs font-bold uppercase tracking-wider text-subtle">{day}</td></tr>
      {items.map((r) => (
        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
          <td className="px-4 py-2.5"><div className="font-medium text-foreground">{r.productName}</div><div className="font-mono text-2xs text-subtle">{r.sku}</div></td>
          {showQr && <td className="px-4 py-2.5 font-mono text-2xs text-muted">{r.qrCode || "—"}</td>}
          <td className="px-4 py-2.5"><Badge tone={TYPE_TONE[r.txnType] ?? "neutral"}>{label(r.txnType)}</Badge></td>
          <td className="px-4 py-2.5 text-right">{r.direction === "IN" ? <span className="inline-flex items-center gap-0.5 font-semibold text-success"><ArrowDownLeft className="h-3.5 w-3.5" />{fq(r.qty)}</span> : <span className="text-subtle">—</span>}</td>
          <td className="px-4 py-2.5 text-right">{r.direction === "OUT" ? <span className="inline-flex items-center gap-0.5 font-semibold text-danger"><ArrowUpRight className="h-3.5 w-3.5" />{fq(r.qty)}</span> : <span className="text-subtle">—</span>}</td>
          <td className="px-4 py-2.5 text-right font-bold text-foreground">{fq(r.balanceQty)}</td>
          <td className="px-4 py-2.5 text-right text-muted">{r.value != null ? fm(r.value) : "—"}</td>
          <td className="px-4 py-2.5 text-2xs text-subtle">{r.refNo}{r.batchNo ? ` · ${r.batchNo}` : ""}</td>
        </tr>
      ))}
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition", active ? "bg-brand-gradient text-white shadow-sm" : "border border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground")}>{children}</button>;
}

const STAT_TONES = { primary: "bg-primary text-white", info: "bg-info text-white", success: "bg-success text-white", accent: "bg-accent text-accent-foreground" } as const;
function Stat({ icon: Icon, label, value, tone }: { icon: typeof Boxes; label: string; value: string; tone: keyof typeof STAT_TONES }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5"><span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", STAT_TONES[tone])}><Icon className="h-[18px] w-[18px]" /></span><p className="text-lg font-bold tracking-tight text-foreground">{value}</p></div>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}

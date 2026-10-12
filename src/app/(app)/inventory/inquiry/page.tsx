"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ScanSearch, Search, LineChart } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { formatNumberWith, formatMoneyWith } from "@/lib/settings/generalConfig";
import { useGeneralConfig } from "@/components/settings/GeneralConfigProvider";
import { MONTHS, currentYM, monthRange, yearOptions } from "@/lib/inventory/period";
import { cn } from "@/lib/cn";
import { UomConvert } from "@/components/uom/UomConvert";
import { StockPositionDrillIn, type DrillTarget } from "@/components/inventory/StockPositionDrillIn";
import type { LedgerBalance as Balance, StockPositionRow as PosRow } from "@/lib/contracts/openingStock";

export default function StockInquiryPage() {
  const [query, setQuery] = useState("");
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const cfg = useGeneralConfig();
  const [sel, setSel] = useState<Balance | null>(null);
  const [posRows, setPosRows] = useState<PosRow[]>([]);
  const [openingBal, setOpeningBal] = useState(0);
  const [posLoading, setPosLoading] = useState(false);
  const cur = currentYM();
  const [year, setYear] = useState(cur.year);
  const [month, setMonth] = useState(cur.month);

  // Area / Brand / Inventory Category filters, same convention as the Inventory Ledger page.
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
  const [drill, setDrill] = useState<DrillTarget | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (areaId) params.set("areaId", String(areaId));
        if (brand) params.set("brand", brand);
        if (invCategory !== "All") params.set("inventoryCategory", invCategory);
        const b = await fetch(`/api/inventory/ledger?${params}`, { cache: "no-store" }).then((r) => r.json());
        if (b.ok) setBalances(b.balances);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, [areaId, brand, invCategory]);

  const fq = (n: number) => formatNumberWith(cfg, n, Number(cfg.fields.qtyDecimals) || 0);
  const fm = (n: number) => formatMoneyWith(cfg, n);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? balances.filter((b) => [b.productName, b.sku, b.brand].some((v) => (v || "").toLowerCase().includes(q))) : balances;
  }, [balances, query]);

  // Load the day-wise position for the selected product + chosen month (default: current month).
  useEffect(() => {
    if (!sel) return;
    let active = true;
    setPosLoading(true);
    (async () => {
      try {
        const { from, to } = monthRange(year, month);
        const params = new URLSearchParams({ productId: String(sel.productId), from, to });
        if (areaId) params.set("areaId", String(areaId));
        const j = await fetch(`/api/inventory/stock-position?${params}`, { cache: "no-store" }).then((r) => r.json());
        if (active && j.ok) { setPosRows(j.rows); setOpeningBal(j.openingBalance ?? 0); }
      } catch { /* ignore */ } finally { if (active) setPosLoading(false); }
    })();
    return () => { active = false; };
  }, [sel, year, month, areaId]);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Inventory</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Stock Inquiry</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ScanSearch className="h-5 w-5 text-primary" /> Stock Inquiry</h1>
        <p className="mt-0.5 text-sm text-muted">Look up live on-hand stock by product, SKU or brand — and drill into the day-wise position.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product, SKU or brand…" className="h-11 w-full rounded-xl border border-border-strong bg-card pl-11 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:shadow-focus" />
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
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-surface-2 px-4 py-2.5 text-sm font-bold text-foreground">On-hand Stock ({rows.length})</div>
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">On Hand</th><th className="px-4 py-3" /></tr></thead>
              <tbody>
                {rows.map((b, i) => (
                  <tr key={i} className={cn("cursor-pointer border-b border-border last:border-0 transition", sel?.productId === b.productId ? "bg-primary-subtle/40" : "hover:bg-primary-subtle/15")} onClick={() => setSel(b)}>
                    <td className="px-4 py-3"><div className="font-medium text-foreground">{b.productName}</div><div className="font-mono text-2xs text-subtle">{b.sku}{b.brand ? ` · ${b.brand}` : ""}</div>{b.wipQty > 0 && <div className="mt-0.5 text-2xs font-semibold text-warning">WIP: {fq(b.wipQty)} {b.uom}</div>}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground"><span className="inline-flex items-center gap-1.5">{fq(b.qtyOnHand)} <span className="text-2xs font-normal text-subtle">{b.uom}</span><UomConvert qty={b.qtyOnHand} uom={b.uom} /></span></td>
                    <td className="px-4 py-3 text-right text-2xs font-semibold text-primary">View →</td>
                  </tr>
                ))}
                {loading && balances.length === 0 && <tr><td colSpan={3} className="px-4 py-8"><AppLoader label="Loading stock…" size="sm" /></td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-sm text-muted">No stock found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Day-wise position for the selected product */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm font-bold text-foreground"><LineChart className="h-4 w-4 text-primary" /> Day-wise Stock Position</span>
            {sel && (
              <div className="flex items-center gap-1.5">
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none">{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none">{yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}</select>
              </div>
            )}
          </div>
          {!sel ? (
            <div className="px-4 py-16 text-center text-sm text-muted">Select a product to see its date-wise OB / Receipt / Sales / Return / Damage / CB.</div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <div><div className="font-semibold text-foreground">{sel.productName}</div><div className="font-mono text-2xs text-subtle">{sel.sku}</div></div>
                <div className="flex items-center gap-2"><Badge tone="info">Opening {fq(openingBal)}</Badge><Badge tone="primary">On hand {fq(sel.qtyOnHand)}</Badge></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <colgroup><col className="w-32" /><col /><col /><col /><col /><col /><col /><col /><col /></colgroup>
                  <thead><tr className="border-b border-border bg-surface-2 text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5 text-left">Date</th><th className="px-3 py-2.5 text-right">OB</th>{cfg.flags.rptShowReceipt && <th className="px-3 py-2.5 text-right text-success">Receipt</th>}{cfg.flags.rptShowSales && <th className="px-3 py-2.5 text-right text-danger">Sales</th>}{cfg.flags.rptShowReturn && <th className="px-3 py-2.5 text-right text-info">Return</th>}<th className="px-3 py-2.5 text-right text-warning">In-Transit</th><th className="px-3 py-2.5 text-right text-primary">Transfer Out</th><th className="px-3 py-2.5 text-right text-warning">Wastage</th><th className="px-4 py-2.5 text-right font-bold">CB</th></tr></thead>
                  <tbody>
                    {!posLoading && (
                      <tr className="border-b border-border bg-info-subtle/30">
                        <td className="px-4 py-2 text-left font-semibold text-foreground">Opening</td>
                        <td className="px-3 py-2 text-right text-muted">—</td>
                        {cfg.flags.rptShowReceipt && <td className="px-3 py-2 text-right">—</td>}
                        {cfg.flags.rptShowSales && <td className="px-3 py-2 text-right">—</td>}
                        {cfg.flags.rptShowReturn && <td className="px-3 py-2 text-right">—</td>}
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-3 py-2 text-right">—</td>
                        <td className="px-4 py-2 text-right font-bold text-foreground">{fq(openingBal)}</td>
                      </tr>
                    )}
                    {posRows.map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-primary-subtle/10">
                        <td className="px-4 py-2 text-left font-medium text-foreground">{r.date}</td>
                        <td className="px-3 py-2 text-right text-muted">{fq(r.ob)}</td>
                        {cfg.flags.rptShowReceipt && <DrillCell value={r.receipt} tone="text-success" onClick={() => setDrill({ productId: sel!.productId, date: r.date, bucket: "receipt" })} fq={fq} />}
                        {cfg.flags.rptShowSales && <DrillCell value={r.sales} tone="text-danger" onClick={() => setDrill({ productId: sel!.productId, date: r.date, bucket: "sales" })} fq={fq} />}
                        {cfg.flags.rptShowReturn && <DrillCell value={r.ret} tone="text-info" onClick={() => setDrill({ productId: sel!.productId, date: r.date, bucket: "ret" })} fq={fq} />}
                        <DrillCell value={r.inTransit} tone="text-warning" onClick={() => setDrill({ productId: sel!.productId, date: r.date, bucket: "inTransit" })} fq={fq} />
                        <DrillCell value={r.transfer} tone="text-primary" onClick={() => setDrill({ productId: sel!.productId, date: r.date, bucket: "transfer" })} fq={fq} />
                        <DrillCell value={r.wastage} tone="text-warning" onClick={() => setDrill({ productId: sel!.productId, date: r.date, bucket: "wastage" })} fq={fq} />
                        <td className="px-4 py-2 text-right font-bold text-foreground">{fq(r.cb)}</td>
                      </tr>
                    ))}
                    {posLoading && <tr><td colSpan={9} className="px-3 py-6"><AppLoader label="Loading…" size="sm" /></td></tr>}
                    {!posLoading && posRows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-muted">No movements in {MONTHS[month]} {year}. Closing stock stays at the opening balance.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-border px-4 py-2 text-right text-2xs text-muted"><Link href="/inventory/ledger" className="font-semibold text-primary hover:underline">Open full Inventory Ledger →</Link></div>
            </div>
          )}
        </div>
      </div>
      {drill && <StockPositionDrillIn target={drill} onClose={() => setDrill(null)} fq={fq} fm={fm} />}
    </div>
  );
}

function DrillCell({ value, tone, onClick, fq }: { value: number; tone: string; onClick: () => void; fq: (n: number) => string }) {
  if (!value) return <td className="px-3 py-2 text-right text-subtle">—</td>;
  return (
    <td className="px-3 py-2 text-right">
      <button onClick={onClick} className={cn("font-semibold underline decoration-dotted underline-offset-2 hover:decoration-solid", tone)}>{fq(value)}</button>
    </td>
  );
}


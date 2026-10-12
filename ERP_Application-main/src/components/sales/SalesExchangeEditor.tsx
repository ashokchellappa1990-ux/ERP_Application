"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Repeat, Search, ArrowLeft, ReceiptText, Boxes, PackagePlus, IndianRupee, Wallet, ShieldCheck, Info, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { ExchangeLookupSale as Sale, ExchangeLookupLine as SaleLine, ExchangeInvoiceMatch as Match, ExchangeConfigDTO } from "@/lib/contracts/salesExchange";

const n = (v: unknown) => Number(v) || 0;
const r2 = (x: number) => +x.toFixed(2);

const HANDLING_LABEL: Record<string, string> = { good: "Good Condition", damaged: "Damaged", quarantine: "Quarantine (QC)" };
const SETTLE_LABEL: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", creditNote: "Credit Note", storeCredit: "Store Credit", wallet: "Wallet" };

interface ReturnLineState { selected: boolean; qty: string; reason: string; handling: string }
interface NewLineState { id: string; productId: number; productName: string; sku: string; qty: string; rate: string; taxPct: number; batchNo: string | null; qrCode: string | null }
interface ProductHit { id: number; name: string; sku: string; price: number; gst: number; stock: number; batchNo: string | null; qrCode: string | null; qrMode: string | null; qrSold: boolean }

export function SalesExchangeEditor() {
  const router = useRouter();
  const fmt = useFmt();
  const money = (x: number) => fmt.money(x);
  const toast = useToast();

  const [config, setConfig] = useState<ExchangeConfigDTO | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [searching, setSearching] = useState(false);

  const [retState, setRetState] = useState<Record<number, ReturnLineState>>({});
  const [newLines, setNewLines] = useState<NewLineState[]>([]);

  // New-item product search
  const [pq, setPq] = useState("");
  const [hits, setHits] = useState<ProductHit[] | null>(null);
  const [pSearching, setPSearching] = useState(false);

  const [settlementMode, setSettlementMode] = useState("");
  const [settlementRef, setSettlementRef] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load config on mount (lookup with empty q returns the effective config).
  useEffect(() => {
    (async () => {
      try {
        const j = await fetch(`/api/sales/exchanges/lookup?q=`, { cache: "no-store" }).then((r) => r.json());
        if (j.ok && j.config) { setConfig(j.config); setSettlementMode(j.config.defaultSettlement || "cash"); }
      } catch { /* degrade gracefully */ }
    })();
  }, []);

  const exchangeAllowed = config?.exchangeAllowed !== false;
  const handlingModes = config?.handlingModes ?? ["good", "damaged", "quarantine"];
  const settlementModes = config?.settlementModes ?? ["cash"];
  const reasons = config?.reasons ?? [];

  /* ---- invoice lookup ---- */
  async function lookup(rawq: string) {
    const q = rawq.trim();
    if (!q) { setMatches(null); return; }
    setSearching(true);
    try {
      const j = await fetch(`/api/sales/exchanges/lookup?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json());
      if (!j.ok) { toast.error(j.message || "Lookup failed."); return; }
      if (j.config) setConfig(j.config);
      if (j.sale) { loadSale(j.sale); setMatches(null); }
      else setMatches(j.matches ?? []);
    } catch { toast.error("Could not reach the server. Please try again."); }
    finally { setSearching(false); }
  }
  async function pickMatch(m: Match) {
    setSearching(true);
    try {
      const j = await fetch(`/api/sales/exchanges/lookup?q=${encodeURIComponent(m.invoiceNo)}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok && j.sale) { loadSale(j.sale); setMatches(null); setQuery(m.invoiceNo); } else toast.error("Could not load that invoice.");
    } catch { toast.error("Could not reach the server."); }
    finally { setSearching(false); }
  }
  function loadSale(s: Sale) {
    setSale(s);
    const next: Record<number, ReturnLineState> = {};
    for (const l of s.lines) next[l.saleLineId] = { selected: false, qty: "0", reason: "", handling: config?.defaultHandling || "good" };
    setRetState(next);
  }
  function toggleRet(l: SaleLine) {
    setRetState((p) => {
      const cur = p[l.saleLineId];
      const selected = !cur.selected;
      const qty = selected && n(cur.qty) <= 0 ? String(l.exchangeableQty) : cur.qty;
      return { ...p, [l.saleLineId]: { ...cur, selected, qty } };
    });
  }
  function setRetQty(l: SaleLine, v: string) {
    let q = n(v); if (q < 0) q = 0; if (q > l.exchangeableQty) q = l.exchangeableQty;
    setRetState((p) => ({ ...p, [l.saleLineId]: { ...p[l.saleLineId], qty: q === n(v) ? v : String(q) } }));
  }

  /* ---- new-item search + add ---- */
  async function searchProducts(rawq: string) {
    const q = rawq.trim();
    if (!q) { setHits(null); return; }
    setPSearching(true);
    try {
      const j = await fetch(`/api/pos/products?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok) setHits(j.products ?? []);
    } catch { toast.error("Could not search products."); }
    finally { setPSearching(false); }
  }
  function addNewLine(p: ProductHit) {
    setNewLines((prev) => [...prev, { id: `${p.id}-${prev.length}-${p.qrCode ?? ""}`, productId: p.id, productName: p.name, sku: p.sku, qty: "1", rate: String(p.price || 0), taxPct: p.gst || 0, batchNo: p.batchNo, qrCode: p.qrCode }]);
    setHits(null); setPq("");
  }
  function updNewLine(id: string, patch: Partial<NewLineState>) { setNewLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l))); }
  function removeNewLine(id: string) { setNewLines((prev) => prev.filter((l) => l.id !== id)); }

  /* ---- value calc ---- */
  const selectedRet = useMemo(() => (sale ? sale.lines.filter((l) => { const s = retState[l.saleLineId]; return s?.selected && n(s.qty) > 0; }) : []), [sale, retState]);
  const returnValue = useMemo(() => {
    let v = 0;
    for (const l of selectedRet) { const q = n(retState[l.saleLineId].qty); if (l.soldQty > 0) v += (l.value / l.soldQty) * q; }
    return r2(v);
  }, [selectedRet, retState]);
  const newSaleValue = useMemo(() => r2(newLines.reduce((s, l) => s + n(l.qty) * n(l.rate), 0)), [newLines]);
  const priceDifference = useMemo(() => r2(newSaleValue - returnValue), [newSaleValue, returnValue]);
  const settlementType = priceDifference > 0.004 ? "collect" : priceDifference < -0.004 ? "refund" : "even";

  const canSave = exchangeAllowed && !!sale && selectedRet.length > 0 && newLines.length > 0 && !submitting;

  async function save() {
    if (!sale) { toast.error("Load an invoice first."); return; }
    if (!exchangeAllowed) { toast.error("Sales exchange is turned off in configuration."); return; }
    if (!selectedRet.length) { toast.error("Select at least one item to return."); return; }
    if (!newLines.length) { toast.error("Add at least one new item to issue."); return; }
    setSubmitting(true);
    const payload = {
      originalSaleId: sale.id,
      returnLines: selectedRet.map((l) => { const s = retState[l.saleLineId]; return { saleLineId: l.saleLineId, returnQty: n(s.qty), reason: s.reason || reason || undefined, inventoryHandling: s.handling }; }),
      newLines: newLines.map((l) => ({ productId: l.productId, productName: l.productName, sku: l.sku, qty: n(l.qty), rate: n(l.rate), taxPct: l.taxPct, batchNo: l.batchNo || undefined, qrCodes: l.qrCode ? [l.qrCode] : undefined })),
      settlementMode, settlementRef: settlementRef.trim() || undefined, reason: reason || undefined, remarks: remarks.trim() || undefined,
    };
    try {
      const res = await fetch("/api/sales/exchanges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) { toast.success(j.message || "Exchange created."); router.push(j.id ? `/sales/exchange/${j.id}` : "/sales/exchange"); }
      else { toast.error(j.message || "Could not create the exchange."); setSubmitting(false); }
    } catch { toast.error("Network error — could not save."); setSubmitting(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales/exchange" className="hover:text-foreground">Sales Exchange</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Repeat className="h-5 w-5 text-primary" /> New Sales Exchange</h1>
          <p className="mt-0.5 text-sm text-muted">Find the invoice, return the old item(s), issue new item(s), and settle the difference.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/exchange"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        </div>
      </div>

      {!exchangeAllowed && (
        <div className="flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger-subtle/50 px-3 py-2 text-2xs font-medium text-danger">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Sales exchange is currently turned off in <Link href="/settings/sales" className="font-semibold underline">Sales Exchange Configuration</Link>.</span>
        </div>
      )}

      {/* Identify invoice */}
      <SectionCard icon={Search} title="Identify Invoice" allowOverflow>
        <div className="relative">
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookup(query); } }} placeholder="Invoice No · Mobile · Name · scan QR / Barcode" className="h-11 w-full rounded-lg border border-primary/40 bg-card px-3 text-sm shadow-sm placeholder:text-subtle focus:border-primary focus:outline-none" />
            <Button size="md" onClick={() => lookup(query)} disabled={searching || !query.trim()}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search</Button>
          </div>
          {matches !== null && (matches.length ? (
            <div className="mt-2 overflow-hidden rounded-lg border border-border">
              <div className="bg-surface-2 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle">{matches.length} matching invoice{matches.length === 1 ? "" : "s"} — pick one</div>
              {matches.map((m) => (
                <button key={m.id} onClick={() => pickMatch(m)} className="flex w-full items-center justify-between gap-3 border-t border-border px-3 py-2 text-left text-sm transition hover:bg-primary-subtle/40">
                  <span className="min-w-0"><span className="block font-mono text-sm font-semibold text-foreground">{m.invoiceNo}</span><span className="block text-2xs text-muted">{m.saleDate} · {m.customerName}{m.customerPhone ? ` · ${m.customerPhone}` : ""} · {m.itemCount} item{m.itemCount === 1 ? "" : "s"}</span></span>
                  <span className="shrink-0 text-sm font-semibold text-foreground">{money(m.total)}</span>
                </button>
              ))}
            </div>
          ) : <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">No invoice matched that search.</div>)}
        </div>
      </SectionCard>

      {sale && (
        <>
          <SectionCard icon={ReceiptText} title="Bill Details" action={<Badge tone="primary">{sale.warehouse}</Badge>}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info2 label="Invoice No" value={<span className="font-mono">{sale.invoiceNo}</span>} />
              <Info2 label="Invoice Date" value={sale.saleDate} />
              <Info2 label="Customer" value={sale.customerName} />
              <Info2 label="Phone" value={sale.customerPhone || "—"} />
            </div>
          </SectionCard>

          {/* Return section */}
          <SectionCard icon={Boxes} title="Return Section — items to take back">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                    <th className="px-3 py-2.5 text-center">Return</th>
                    <th className="px-3 py-2.5">Product</th>
                    <th className="px-3 py-2.5 text-right">Sold</th>
                    <th className="px-3 py-2.5 text-right">Prev. Exchanged</th>
                    <th className="px-3 py-2.5 text-right">Available</th>
                    <th className="px-3 py-2.5 text-right">Rate</th>
                    <th className="px-3 py-2.5 text-center">Exchange Qty</th>
                    <th className="px-3 py-2.5">Reason</th>
                    <th className="px-3 py-2.5">Handling</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((l) => {
                    const s = retState[l.saleLineId];
                    const noStock = l.exchangeableQty <= 0;
                    const over = n(s?.qty) > l.exchangeableQty;
                    return (
                      <tr key={l.saleLineId} className={cn("border-b border-border align-top", s?.selected ? "bg-primary-subtle/15" : "")}>
                        <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={!!s?.selected} disabled={noStock} onChange={() => toggleRet(l)} className="h-4 w-4 accent-primary disabled:opacity-40" /></td>
                        <td className="px-3 py-2.5"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div></td>
                        <td className="px-3 py-2.5 text-right text-foreground">{fmt.qty(l.soldQty)}</td>
                        <td className="px-3 py-2.5 text-right text-muted">{fmt.qty(l.alreadyReturned)}</td>
                        <td className={cn("px-3 py-2.5 text-right font-semibold", noStock ? "text-danger" : "text-success")}>{fmt.qty(l.exchangeableQty)}</td>
                        <td className="px-3 py-2.5 text-right text-muted">{money(l.rate)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <input type="number" min={0} max={l.exchangeableQty} step="any" disabled={!s?.selected || noStock} value={s?.qty ?? "0"} onChange={(e) => setRetQty(l, e.target.value)} className={cn("h-8 w-20 rounded border bg-surface px-2 text-right text-xs focus:outline-none disabled:opacity-50", over ? "border-danger" : "border-border-strong focus:border-primary")} />
                        </td>
                        <td className="px-3 py-2.5">
                          <select disabled={!s?.selected} value={s?.reason ?? ""} onChange={(e) => setRetState((p) => ({ ...p, [l.saleLineId]: { ...p[l.saleLineId], reason: e.target.value } }))} className={cn(selCls, "w-40")}>
                            <option value="">Use header reason</option>
                            {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <select disabled={!s?.selected} value={s?.handling ?? "good"} onChange={(e) => setRetState((p) => ({ ...p, [l.saleLineId]: { ...p[l.saleLineId], handling: e.target.value } }))} className={cn(selCls, "w-36")}>
                            {handlingModes.map((h) => <option key={h} value={h}>{HANDLING_LABEL[h] ?? h}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* New item section */}
          <SectionCard icon={PackagePlus} title="New Item Selection — items to issue" allowOverflow>
            <div className="relative mb-3">
              <div className="flex gap-2">
                <input value={pq} onChange={(e) => setPq(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchProducts(pq); } }} placeholder="Scan barcode / QR or search product name, code, SKU…" className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm placeholder:text-subtle focus:border-primary focus:outline-none" />
                <Button size="md" variant="outline" onClick={() => searchProducts(pq)} disabled={pSearching || !pq.trim()}>{pSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find</Button>
              </div>
              {hits !== null && (hits.length ? (
                <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-border">
                  {hits.map((p) => (
                    <button key={`${p.id}-${p.qrCode ?? ""}`} onClick={() => addNewLine(p)} disabled={p.qrSold} className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm transition last:border-0 hover:bg-primary-subtle/40 disabled:opacity-40">
                      <span className="min-w-0"><span className="block font-medium text-foreground">{p.name}</span><span className="block text-2xs text-muted">{p.sku || "—"} · Stock {fmt.qty(p.stock)}{p.qrSold ? " · QR already sold" : ""}</span></span>
                      <span className="flex shrink-0 items-center gap-2"><span className="text-sm font-semibold text-foreground">{money(p.price)}</span><Plus className="h-4 w-4 text-primary" /></span>
                    </button>
                  ))}
                </div>
              ) : <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">No products matched.</div>)}
            </div>

            {newLines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5 text-center">Qty</th><th className="px-3 py-2.5 text-right">Rate</th><th className="px-3 py-2.5 text-right">Tax %</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5"></th></tr></thead>
                  <tbody>
                    {newLines.map((l) => (
                      <tr key={l.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2.5"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}{l.batchNo ? ` · ${l.batchNo}` : ""}</div></td>
                        <td className="px-3 py-2.5 text-center"><input type="number" min={0} step="any" value={l.qty} onChange={(e) => updNewLine(l.id, { qty: e.target.value })} className="h-8 w-16 rounded border border-border-strong bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" /></td>
                        <td className="px-3 py-2.5 text-right"><input type="number" min={0} step="any" value={l.rate} onChange={(e) => updNewLine(l.id, { rate: e.target.value })} className="h-8 w-24 rounded border border-border-strong bg-surface px-2 text-right text-xs focus:border-primary focus:outline-none" /></td>
                        <td className="px-3 py-2.5 text-right text-muted">{l.taxPct || 0}%</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">{money(n(l.qty) * n(l.rate))}</td>
                        <td className="px-3 py-2.5 text-right"><button onClick={() => removeNewLine(l.id)} className="text-subtle hover:text-danger"><X className="h-4 w-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="py-4 text-center text-sm text-muted">No new items yet — search and add the replacement product(s).</p>}
          </SectionCard>

          {/* Price difference + settlement + save */}
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <SectionCard icon={Wallet} title="Settlement">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Fld label="Settlement Mode">
                    <select value={settlementMode} onChange={(e) => setSettlementMode(e.target.value)} className={selCls}>
                      {settlementModes.map((m) => <option key={m} value={m}>{SETTLE_LABEL[m] ?? m}</option>)}
                    </select>
                  </Fld>
                  <Fld label="Reference No"><input value={settlementRef} onChange={(e) => setSettlementRef(e.target.value)} placeholder="UTR / txn / note" className={inpSm} /></Fld>
                  <Fld label="Exchange Reason">
                    <select value={reason} onChange={(e) => setReason(e.target.value)} className={selCls}>
                      <option value="">Select reason…</option>
                      {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Fld>
                </div>
                <div className="mt-3"><Fld label="Remarks"><input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" className={inpSm} /></Fld></div>
              </SectionCard>
            </div>

            <aside className="space-y-4">
              <SectionCard icon={IndianRupee} title="Price Difference">
                <div className="space-y-1.5 text-sm">
                  <Row k="Returned Value" v={money(returnValue)} />
                  <Row k="New Item Value" v={money(newSaleValue)} />
                  <div className="my-1.5 h-px bg-border" />
                  <div className={cn("flex items-center justify-between text-lg font-bold", settlementType === "collect" ? "text-success" : settlementType === "refund" ? "text-danger" : "text-foreground")}>
                    <span>{settlementType === "collect" ? "Collect" : settlementType === "refund" ? "Refund" : "Even"}</span>
                    <span>{money(Math.abs(priceDifference))}</span>
                  </div>
                </div>
                {config && config.maxExchangeDays != null && <p className="mt-2 text-2xs text-subtle">Exchange window: {config.maxExchangeDays} days from sale.</p>}
                <Button size="lg" className="mt-3 w-full" onClick={save} disabled={!canSave}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {submitting ? "Saving…" : "Create Exchange"}</Button>
                {!selectedRet.length && <p className="mt-2 text-center text-2xs text-subtle">Select item(s) to return.</p>}
                {selectedRet.length > 0 && !newLines.length && <p className="mt-2 text-center text-2xs text-subtle">Add the replacement item(s).</p>}
                {config && <div className="mt-2 flex justify-center"><Badge tone="info" className="gap-1"><ShieldCheck className="h-3 w-3" /> Rules enforced on save</Badge></div>}
              </SectionCard>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

const inpSm = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none disabled:opacity-50";
const selCls = "h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50";

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>;
}
function Info2({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</div><div className="mt-0.5 text-sm font-medium text-foreground">{value}</div></div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="text-foreground">{v}</span></div>;
}

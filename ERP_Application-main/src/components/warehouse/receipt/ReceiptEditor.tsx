"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageOpen, ArrowLeft, Save, ShieldCheck, CheckCircle2, ListChecks, Info, Boxes, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { receiptLineMath, validateReceipt as validateLines } from "@/lib/contracts/stockReceipt";

interface Item { dispatchItemId: number; productId: number; productName: string; sku: string | null; uom: string | null; batchNo: string | null; expiryDate: string | null; serials: string[]; dispatchQty: number; receivedQty: number; damagedQty: number; purchasePrice: number; sellingPrice: number; mrp: number; remarks: string | null }
interface Header { dispatchId: number; dispatchNo: string; dispatchDate: string; sourceName: string; destinationName: string; destinationWarehouse: string | null; vehicleNo: string | null; driverName: string | null; transportName: string | null }
interface DispRow { dispatchId: number; dispatchNo: string; dispatchDate: string; source: string; destination: string; totalItems: number; totalDispatchQty: number; status: string }

const inp2 = "h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none";
const n = (v: unknown) => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const Fld = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>;

export function ReceiptEditor({ dispatchId }: { dispatchId?: number }) {
  const router = useRouter();
  const [header, setHeader] = useState<Header | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [receiptDate, setReceiptDate] = useState(today());
  const [remarks, setRemarks] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DispRow[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [validateMsg, setValidateMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function loadDispatch(id: number) {
    setBusy("load"); setErr("");
    const j = await fetch(`/api/warehouse/receipt/load-dispatch?dispatchId=${id}`, { cache: "no-store" }).then((r) => r.json());
    setBusy("");
    if (!j.ok) { setErr(j.message || "Could not load dispatch."); return; }
    setHeader(j.header); setItems(j.items.map((i: any) => ({ ...i, remarks: i.remarks ?? null }))); setHits([]); setQ("");
  }
  useEffect(() => { if (dispatchId) loadDispatch(dispatchId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dispatchId]);
  useEffect(() => {
    if (header) return;
    const t = setTimeout(() => { fetch(`/api/warehouse/receipt/pending?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setHits(j.ok ? j.rows : [])); }, 200);
    return () => clearTimeout(t);
  }, [q, header]);

  const setItem = (i: number, patch: Partial<Item>) => setItems((it) => it.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const receiveAll = () => setItems((it) => it.map((x) => ({ ...x, receivedQty: x.dispatchQty, damagedQty: 0 })));
  const totals = useMemo(() => {
    let rec = 0, dmg = 0, miss = 0, acc = 0;
    for (const i of items) { const m = receiptLineMath(i.dispatchQty, i.receivedQty, i.damagedQty); rec += n(i.receivedQty); dmg += n(i.damagedQty); miss += m.missingQty; acc += m.acceptedQty; }
    return { rec, dmg, miss, acc };
  }, [items]);

  function clientValidate(): string | null {
    return validateLines(items.map((i) => ({ dispatchQty: i.dispatchQty, receivedQty: i.receivedQty, damagedQty: i.damagedQty, productName: i.productName })));
  }
  function buildBody() { return { dispatchId: header!.dispatchId, receiptDate, remarks: remarks || null, items: items.map((i) => ({ ...i })) }; }

  async function save(thenReceive: boolean) {
    setErr(""); setValidateMsg(null);
    const v = clientValidate();
    if (v) { setErr(v); return; }
    setBusy(thenReceive ? "receive" : "draft");
    try {
      const j = await fetch("/api/warehouse/receipt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildBody()) }).then((r) => r.json());
      if (!j.ok) { setErr(j.message || "Failed to save."); setBusy(""); return; }
      if (thenReceive) {
        const d = await fetch(`/api/warehouse/receipt/${j.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "receive" }) }).then((r) => r.json());
        if (!d.ok) { setErr(d.message || "Saved as draft, but receive failed."); router.push(`/warehouse/transfer/receipt/${j.id}`); return; }
      }
      router.push(`/warehouse/transfer/receipt/${j.id}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); setBusy(""); }
  }
  function validate() { const v = clientValidate(); setValidateMsg(v ? { ok: false, text: v } : { ok: true, text: `Valid — accept ${totals.acc}, damaged ${totals.dmg}, missing ${totals.miss}.` }); }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/receipt" className="hover:text-foreground">Stock Transfer Receipt</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageOpen className="h-5 w-5 text-primary" /> New Receipt</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/warehouse/transfer/receipt"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {header && <>
            <Button variant="outline" size="md" disabled={!!busy} onClick={receiveAll}><ListChecks className="h-4 w-4" /> Receive All</Button>
            <Button variant="outline" size="md" disabled={!!busy} onClick={validate}><ShieldCheck className="h-4 w-4" /> Validate</Button>
            <Button variant="secondary" size="md" disabled={!!busy} onClick={() => save(false)}><Save className="h-4 w-4" /> Save Draft</Button>
            <Button size="md" disabled={!!busy} onClick={() => save(true)}><CheckCircle2 className="h-4 w-4" /> {busy === "receive" ? "Receiving…" : "Receive"}</Button>
          </>}
        </div>
      </div>

      <div className="flex items-start gap-1.5 rounded-lg border border-info/30 bg-info-subtle/40 px-3 py-2 text-2xs text-info">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Receipt moves stock from <strong>In-Transit</strong> into your branch: accepted qty → sellable stock, damaged qty → {`Damage / Quality Hold`}, missing qty stays in-transit. Posts <strong>Inventory Dr / Inventory In-Transit Cr</strong> only. The selling price you enter becomes this branch&apos;s default selling price.</span>
      </div>

      {err && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{err}</div>}
      {validateMsg && <div className={cn("rounded-lg px-3 py-2 text-2xs font-medium", validateMsg.ok ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning")}>{validateMsg.text}</div>}

      {/* Dispatch lookup */}
      {!header && (
        <SectionCard icon={FileText} title="Select Dispatch to Receive" bodyClass="p-4" allowOverflow>
          <div className="relative max-w-xl">
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-subtle/20 px-2"><Search className="h-4 w-4 text-primary" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dispatched documents to your branch (dispatch no)…" className="h-10 w-full bg-transparent text-sm focus:outline-none" /></div>
            {hits.length > 0 && (
              <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl">
                {hits.map((r) => (
                  <button key={r.dispatchId} onClick={() => loadDispatch(r.dispatchId)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-primary-subtle/50">
                    <span className="min-w-0"><span className="block font-mono text-xs font-semibold text-primary">{r.dispatchNo}</span><span className="block text-2xs text-subtle">{r.source} → {r.destination} · {r.dispatchDate} · {r.totalItems} item(s)</span></span>
                    <span className="shrink-0 text-right text-2xs text-subtle">{r.status}</span>
                  </button>
                ))}
              </div>
            )}
            {q && hits.length === 0 && <p className="mt-2 text-2xs text-muted">No dispatches awaiting receipt at your branch.</p>}
          </div>
          {busy === "load" && <div className="mt-3"><AppLoader label="Loading dispatch…" size="sm" /></div>}
        </SectionCard>
      )}

      {header && (<>
        <SectionCard icon={FileText} title="Receipt Details" bodyClass="p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Fld label="Receipt No."><input readOnly value="Auto on save" className={cn(inp2, "bg-surface-2 font-mono text-primary")} /></Fld>
            <Fld label="Receipt Date"><input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className={inp2} /></Fld>
            <Fld label="Dispatch No."><input readOnly value={header.dispatchNo} className={cn(inp2, "bg-surface-2 font-mono text-primary")} /></Fld>
            <Fld label="Dispatch Date"><input readOnly value={header.dispatchDate} className={cn(inp2, "bg-surface-2")} /></Fld>
            <Fld label="Source (From)"><input readOnly value={header.sourceName || "—"} className={cn(inp2, "bg-surface-2")} /></Fld>
            <Fld label="Destination (To)"><input readOnly value={`${header.destinationName || "—"}${header.destinationWarehouse ? ` · ${header.destinationWarehouse}` : ""}`} className={cn(inp2, "bg-surface-2")} /></Fld>
            <Fld label="Vehicle No."><input readOnly value={header.vehicleNo || "—"} className={cn(inp2, "bg-surface-2")} /></Fld>
            <Fld label="Driver / Transport"><input readOnly value={[header.driverName, header.transportName].filter(Boolean).join(" · ") || "—"} className={cn(inp2, "bg-surface-2")} /></Fld>
            <div className="sm:col-span-2 lg:col-span-4"><Fld label="Remarks"><input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes…" className={inp2} /></Fld></div>
          </div>
        </SectionCard>

        <SectionCard icon={Boxes} title="Items" action={<span className="text-2xs font-medium text-muted">Recd <span className="font-bold text-foreground tabular-nums">{totals.rec}</span> · Acc <span className="font-bold text-success tabular-nums">{totals.acc}</span> · Dmg <span className="font-bold text-warning tabular-nums">{totals.dmg}</span> · Miss <span className="font-bold text-danger tabular-nums">{totals.miss}</span></span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5">Batch / Serial</th><th className="px-3 py-2.5 text-right">Dispatch</th><th className="px-3 py-2.5 text-center">Received</th><th className="px-3 py-2.5 text-center">Damaged</th><th className="px-3 py-2.5 text-right">Accepted</th><th className="px-3 py-2.5 text-right">Missing</th><th className="px-3 py-2.5 text-right">Purch. Price</th><th className="px-3 py-2.5 text-center">Selling Price</th><th className="px-3 py-2.5 text-center">MRP</th></tr></thead>
              <tbody>
                {items.map((it, i) => {
                  const m = receiptLineMath(it.dispatchQty, it.receivedQty, it.damagedQty);
                  const recOver = n(it.receivedQty) > n(it.dispatchQty) + 0.001;
                  const dmgOver = n(it.damagedQty) > n(it.receivedQty) + 0.001;
                  return (
                    <tr key={it.dispatchItemId} className="border-b border-border last:border-0 align-top">
                      <td className="px-3 py-2"><div className="font-medium text-foreground">{it.productName}</div>{it.sku && <div className="font-mono text-2xs text-subtle">{it.sku}</div>}</td>
                      <td className="px-3 py-2 text-2xs text-muted">{it.serials.length ? <span className="font-mono">{it.serials.length} serial(s)</span> : it.batchNo ? <>{it.batchNo}{it.expiryDate ? ` · exp ${it.expiryDate}` : ""}</> : "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{it.dispatchQty}</td>
                      <td className="px-3 py-2 text-center"><input type="number" min={0} max={it.dispatchQty} step="any" value={it.receivedQty} onChange={(e) => setItem(i, { receivedQty: n(e.target.value) })} className={cn("h-8 w-16 rounded border bg-surface-2 text-center text-xs focus:outline-none", recOver ? "border-danger" : "border-border focus:border-primary")} /></td>
                      <td className="px-3 py-2 text-center"><input type="number" min={0} max={it.receivedQty} step="any" value={it.damagedQty} onChange={(e) => setItem(i, { damagedQty: n(e.target.value) })} className={cn("h-8 w-16 rounded border bg-surface-2 text-center text-xs focus:outline-none", dmgOver ? "border-danger" : "border-border focus:border-primary")} /></td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-success">{m.acceptedQty}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-danger">{m.missingQty || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{it.purchasePrice ? it.purchasePrice.toLocaleString() : "—"}</td>
                      <td className="px-3 py-2 text-center"><input type="number" min={0} step="any" value={it.sellingPrice} onChange={(e) => setItem(i, { sellingPrice: n(e.target.value) })} className="h-8 w-20 rounded border border-border bg-surface-2 text-center text-xs focus:border-primary focus:outline-none" /></td>
                      <td className="px-3 py-2 text-center"><input type="number" min={0} step="any" value={it.mrp} onChange={(e) => setItem(i, { mrp: n(e.target.value) })} className="h-8 w-20 rounded border border-border bg-surface-2 text-center text-xs focus:border-primary focus:outline-none" /></td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">Nothing left to receive on this dispatch.</td></tr>}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </>)}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageCheck, ArrowLeft, Save, CheckCircle2, ListChecks, Undo2, RotateCcw, Ban, Printer, Info, Boxes, Building2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { ALLOC_STATUS_TONE, LINE_STATUS_TONE } from "@/lib/contracts/stockAllocation";

interface Lot { batchNo: string | null; expiryDate: string | null; serialNo: string | null; qty: number }
interface Line { id: number; productId: number; productName: string; sku: string | null; uom: string | null; requestedQty: number; availableQty: number; reservedQty: number; allocatedQty: number; remainingQty: number; policy: string; allocationStatus: string; remarks: string | null; lots: Lot[] }
interface Header { id: number; allocationNo: string; allocationDate: string; requestNo: string; transferType: string | null; priority: string; status: string; approvalStatus: string; remarks: string | null; sourceName: string; sourceWarehouse: string | null; destinationName: string; destinationWarehouse: string | null; sourceBranchId: number; destinationBranchId: number }
interface Data { header: Header; lines: Line[]; editable: boolean; dispatched: boolean }
interface Avail { available: number; onHand: number; reserved: number; policy: string; order: string | null; lots: { priority: number; batchNo: string | null; expiryDate: string | null; available: number }[]; serials: { serialNo: string; batchNo: string | null; expiryDate: string | null }[] }

const n = (v: unknown) => Number(v) || 0;
const F = ({ k, v }: { k: string; v: React.ReactNode }) => <div><div className="text-2xs font-semibold uppercase tracking-wide text-muted">{k}</div><div className="text-sm text-foreground">{v ?? "—"}</div></div>;
const POLICY_TONE: Record<string, "info" | "primary" | "success" | "neutral"> = { FEFO: "info", FIFO: "primary", Serial: "success", Batch: "info", Qty: "neutral" };

export function StockAllocationEditor({ id }: { id: number }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [avail, setAvail] = useState<Record<number, Avail>>({});
  const [qty, setQty] = useState<Record<number, number>>({});
  const [serials, setSerials] = useState<Record<number, string[]>>({});
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [serialModal, setSerialModal] = useState<number | null>(null);

  async function loadAll() {
    const j = await fetch(`/api/warehouse/allocation/${id}`, { cache: "no-store" }).then((r) => r.json());
    if (!j.ok) { setErr(j.message || "Not found"); return; }
    const d: Data = j.data;
    setData(d); setRemarks(d.header.remarks || "");
    setQty(Object.fromEntries(d.lines.map((l) => [l.id, l.allocatedQty || 0])));
    setSerials(Object.fromEntries(d.lines.map((l) => [l.id, l.lots.filter((x) => x.serialNo).map((x) => x.serialNo!)])));
    // Live availability per line (exclude this allocation's own reservations).
    const entries = await Promise.all(d.lines.map(async (l) => {
      const a = await fetch(`/api/warehouse/allocation/availability?productId=${l.productId}&branchId=${d.header.destinationBranchId}&excludeAllocationId=${id}${d.header.destinationWarehouse ? `&warehouse=${encodeURIComponent(d.header.destinationWarehouse)}` : ""}`, { cache: "no-store" }).then((r) => r.json());
      return [l.id, a.ok ? a : null] as const;
    }));
    setAvail(Object.fromEntries(entries.filter(([, a]) => a)) as Record<number, Avail>);
  }
  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const totals = useMemo(() => {
    if (!data) return { req: 0, alloc: 0 };
    return { req: data.lines.reduce((s, l) => s + n(l.requestedQty), 0), alloc: data.lines.reduce((s, l) => s + n(qty[l.id]), 0) };
  }, [data, qty]);

  async function post(url: string, body: unknown, label: string) {
    setBusy(label); setErr("");
    const j = await fetch(url, { method: url.endsWith("/save") ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    setBusy("");
    if (!j.ok) { setErr(j.message || "Action failed."); return null; }
    return j;
  }
  const linesPayload = () => (data?.lines ?? []).map((l) => ({ lineId: l.id, allocatedQty: n(qty[l.id]), serials: serials[l.id], remarks: l.remarks }));

  async function saveDraft() { if (await post(`/api/warehouse/allocation/${id}/save`, { remarks, lines: linesPayload() }, "draft")) await loadAll(); }
  async function allocate(all: boolean) { const j = await post(`/api/warehouse/allocation/${id}/allocate`, all ? { all: true } : { lines: linesPayload() }, all ? "all" : "allocate"); if (j) router.push(`/warehouse/transfer/allocation/${id}`); }
  async function action(a: string) {
    if (a === "cancel" && !window.confirm("Cancel this allocation and free reserved stock?")) return;
    if (a === "release" && !window.confirm("Release the reserved stock?")) return;
    const j = await post(`/api/warehouse/allocation/${id}/action`, { action: a }, a);
    if (j) { if (a === "reallocate") await loadAll(); else router.push(`/warehouse/transfer/allocation/${id}`); }
  }

  if (!data) return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">{err ? <p className="text-center text-sm text-danger">{err}</p> : <AppLoader label="Loading allocation…" size="sm" />}</div>;
  const h = data.header;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/warehouse/transfer/allocation" className="hover:text-foreground">Stock Allocation</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{h.allocationNo}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><PackageCheck className="h-5 w-5 text-primary" /> {h.allocationNo} <Badge tone={ALLOC_STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/warehouse/transfer/allocation"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {data.editable && <><Button variant="secondary" size="md" disabled={!!busy} onClick={saveDraft}><Save className="h-4 w-4" /> Save Draft</Button>
          <Button variant="outline" size="md" disabled={!!busy} onClick={() => allocate(true)}><ListChecks className="h-4 w-4" /> Allocate All</Button>
          <Button size="md" disabled={!!busy} onClick={() => allocate(false)}><CheckCircle2 className="h-4 w-4" /> {busy === "allocate" ? "Allocating…" : "Allocate"}</Button></>}
          {(h.status === "Allocated" || h.status === "Partially Allocated") && <>
            <Button variant="secondary" size="md" disabled={!!busy} onClick={() => action("reallocate")}><RotateCcw className="h-4 w-4" /> Reallocate</Button>
            <Button variant="outline" size="md" disabled={!!busy} onClick={() => action("release")}><Undo2 className="h-4 w-4" /> Release</Button></>}
          {h.status !== "Cancelled" && h.status !== "Released" && <Button variant="ghost" size="md" disabled={!!busy} onClick={() => action("cancel")}><Ban className="h-4 w-4" /> Cancel</Button>}
          <Button variant="outline" size="md" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      <div className="flex items-start gap-1.5 rounded-lg border border-info/30 bg-info-subtle/40 px-3 py-2 text-2xs text-info">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Allocation <strong>reserves</strong> stock at the <strong>destination branch — {h.destinationName}</strong>{h.destinationWarehouse ? ` · ${h.destinationWarehouse}` : ""} (the stock-receiving entity). The <strong>Available</strong> column is that destination&apos;s on-hand stock, and the allocated qty is validated against it. It increases reserved qty and decreases available qty; physical inventory is unchanged and no stock-ledger or accounting entry is posted. Batches are picked by the product&apos;s policy (FEFO / FIFO); serial products need explicit serial selection.</span>
      </div>

      {err && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{err}</div>}

      <SectionCard icon={Building2} title="Allocation Details" bodyClass="p-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <F k="Transfer Request" v={<span className="font-mono text-primary">{h.requestNo}</span>} />
          <F k="Allocation Date" v={h.allocationDate} />
          <F k="Transfer Type" v={h.transferType} />
          <F k="Priority" v={<Badge tone={h.priority === "Urgent" ? "danger" : h.priority === "High" ? "warning" : "neutral"}>{h.priority}</Badge>} />
          <F k="Source" v={<>{h.sourceName}{h.sourceWarehouse ? ` · ${h.sourceWarehouse}` : ""}</>} />
          <F k="Destination" v={<>{h.destinationName}{h.destinationWarehouse ? ` · ${h.destinationWarehouse}` : ""}</>} />
          <F k="Status" v={<Badge tone={ALLOC_STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge>} />
          <F k="Approval" v={<Badge tone={ALLOC_STATUS_TONE[h.approvalStatus] ?? "neutral"}>{h.approvalStatus}</Badge>} />
        </div>
      </SectionCard>

      {(() => {
        const short = data.lines.filter((l) => { const a = avail[l.id]; const av = a ? a.available : l.availableQty; return av < n(l.requestedQty) - 0.001; });
        if (!short.length) return null;
        return (
          <div className="flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2 text-2xs font-medium text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Insufficient stock at <strong>{h.destinationName}</strong> for {short.length} item(s): {short.map((l) => `${l.productName} — requested ${l.requestedQty}, available ${avail[l.id] ? avail[l.id].available : l.availableQty}`).join("; ")}. You can allocate only up to the available quantity.</span>
          </div>
        );
      })()}

      <SectionCard icon={Boxes} title={<>Items <span className="text-2xs font-normal text-muted">· available at {h.destinationName}</span></>} action={<span className="text-2xs font-medium text-muted">Allocated: <span className="font-bold text-foreground tabular-nums">{totals.alloc}</span> / {totals.req}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5">Policy</th><th className="px-3 py-2.5">UoM</th><th className="px-3 py-2.5 text-right">Requested</th><th className="px-3 py-2.5 text-right">Available</th><th className="px-3 py-2.5 text-right">Reserved</th><th className="px-3 py-2.5 text-center">Allocate</th><th className="px-3 py-2.5 text-right">Remaining</th><th className="px-3 py-2.5 text-center">Status</th></tr></thead>
            <tbody>
              {data.lines.map((l) => {
                const a = avail[l.id];
                const availableQty = a ? a.available : l.availableQty;
                const isSerial = (a?.policy || l.policy) === "Serial";
                const allocQty = n(qty[l.id]);
                const remaining = Math.max(0, n(l.requestedQty) - allocQty);
                const over = allocQty > availableQty + 0.001;
                return (
                  <tr key={l.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-3 py-2"><div className="font-medium text-foreground">{l.productName}</div>{l.sku && <div className="font-mono text-2xs text-subtle">{l.sku}</div>}{a && a.lots.length > 0 && <div className="mt-0.5 text-[10px] text-subtle">Batches: {a.lots.slice(0, 3).map((x) => `${x.batchNo || "—"}(${x.available})`).join(", ")}{a.lots.length > 3 ? "…" : ""}</div>}{isSerial && (serials[l.id]?.length ?? 0) > 0 && <div className="mt-0.5 text-[10px] text-success">Serials: {serials[l.id].length} selected</div>}</td>
                    <td className="px-3 py-2"><Badge tone={POLICY_TONE[a?.policy || l.policy] ?? "neutral"}>{a?.policy || l.policy}</Badge></td>
                    <td className="px-3 py-2 text-muted">{l.uom || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">{l.requestedQty}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{a ? availableQty : <span className="text-subtle">…</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{l.reservedQty || 0}</td>
                    <td className="px-3 py-2 text-center">
                      {!data.editable ? <span className="tabular-nums text-foreground">{l.allocatedQty}</span> : isSerial ? (
                        <Button size="sm" variant="outline" onClick={() => setSerialModal(l.id)}>{(serials[l.id]?.length ?? 0) > 0 ? `${serials[l.id].length} serial(s)` : "Select serials"}</Button>
                      ) : (
                        <input type="number" min={0} max={availableQty} step="any" value={qty[l.id] ?? 0} onChange={(e) => setQty((q) => ({ ...q, [l.id]: n(e.target.value) }))} className={cn("h-8 w-20 rounded border bg-surface-2 text-center text-xs focus:outline-none", over ? "border-danger" : "border-border focus:border-primary")} />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{remaining}</td>
                    <td className="px-3 py-2 text-center"><Badge tone={LINE_STATUS_TONE[l.allocationStatus] ?? "neutral"}>{l.allocationStatus}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.editable && <div className="mt-3"><label className="mb-1 block text-2xs font-semibold text-muted">Remarks</label><textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Allocation notes…" className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>}
      </SectionCard>

      {/* Serial picker modal */}
      {serialModal != null && (() => {
        const l = data.lines.find((x) => x.id === serialModal)!;
        const a = avail[serialModal];
        const chosen = new Set(serials[serialModal] ?? []);
        const cap = n(l.requestedQty);
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => setSerialModal(null)} />
            <div className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <div className="flex items-center gap-2.5 border-b border-border bg-primary-subtle/40 px-5 py-3.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><ListChecks className="h-4 w-4" /></span><div className="flex-1"><h3 className="text-sm font-bold text-foreground">Select Serials — {l.productName}</h3><p className="text-2xs text-muted">Choose up to {cap} · {chosen.size} selected</p></div><button onClick={() => setSerialModal(null)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
              <div className="flex-1 overflow-auto p-3">
                {!a || a.serials.length === 0 ? <p className="py-8 text-center text-sm text-muted">No available serials for this product at the source.</p> : (
                  <div className="space-y-1">{a.serials.map((s) => {
                    const on = chosen.has(s.serialNo);
                    return <label key={s.serialNo} className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm", on ? "border-primary bg-primary-subtle/40" : "border-border hover:bg-surface-2")}>
                      <span className="flex items-center gap-2"><input type="checkbox" checked={on} onChange={(e) => setSerials((sm) => { const cur = new Set(sm[serialModal] ?? []); if (e.target.checked) { if (cur.size >= cap) return sm; cur.add(s.serialNo); } else cur.delete(s.serialNo); return { ...sm, [serialModal]: [...cur] }; })} /><span className="font-mono text-xs text-foreground">{s.serialNo}</span></span>
                      {s.expiryDate && <span className="text-2xs text-subtle">exp {s.expiryDate}</span>}
                    </label>;
                  })}</div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <span className="text-2xs text-muted">{chosen.size} / {cap} selected</span>
                <Button size="md" onClick={() => { setQty((q) => ({ ...q, [serialModal]: chosen.size })); setSerialModal(null); }}><CheckCircle2 className="h-4 w-4" /> Confirm</Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

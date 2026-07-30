"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Undo2, Search, ArrowLeft, Loader2, Boxes, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";
import { PR_REASONS, type PiReturnSource, type PiReturnMatch, type PiReturnLine } from "@/lib/contracts/purchaseReturn";

interface LineState { returnQty: string; reason: string; remarks: string; handling: string; serials: string[] }

const TYPE_TONE: Record<string, "primary" | "info" | "warning" | "success"> = { Inventory: "primary", Service: "info", Expense: "warning", Asset: "success" };

export function PurchaseReturnEditor() {
  const router = useRouter();
  const fmt = useFmt();
  const inr = (x: number) => fmt.money(x || 0);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<PiReturnMatch[] | null>(null);
  const [src, setSrc] = useState<PiReturnSource | null>(null);
  const [lines, setLines] = useState<Record<number, LineState>>({});
  const [headReason, setHeadReason] = useState("");
  const [headRemarks, setHeadRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInventory = src?.purchaseType === "Inventory";

  async function search(q: string) {
    if (!q.trim()) return;
    setSearching(true); setError(null);
    try {
      const res = await fetch(`/api/purchase/returns/invoice?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) { setError(j.message || "Lookup failed."); setMatches([]); return; }
      if (j.source) { loadSource(j.source); setMatches(null); }
      else setMatches(j.matches ?? []);
    } catch { setError("Lookup failed."); } finally { setSearching(false); }
  }

  async function pick(id: number) {
    setSearching(true); setError(null);
    try {
      const res = await fetch(`/api/purchase/returns/invoice?id=${id}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) { setError(j.message || "Could not load invoice."); return; }
      if (j.source) { loadSource(j.source); setMatches(null); }
    } catch { setError("Could not load invoice."); } finally { setSearching(false); }
  }

  function loadSource(s: PiReturnSource) {
    setSrc(s);
    const init: Record<number, LineState> = {};
    for (const l of s.lines) init[l.piItemId] = { returnQty: "", reason: "", remarks: "", handling: "vendor", serials: [] };
    setLines(init);
  }

  function setLine(id: number, patch: Partial<LineState>) { setLines((p) => ({ ...p, [id]: { ...p[id], ...patch } })); }

  function toggleSerial(l: PiReturnLine, code: string) {
    const st = lines[l.piItemId]; if (!st) return;
    const has = st.serials.includes(code);
    const serials = has ? st.serials.filter((c) => c !== code) : [...st.serials, code];
    setLine(l.piItemId, { serials, returnQty: String(serials.length) });
  }

  const selected = src ? src.lines.filter((l) => Number(lines[l.piItemId]?.returnQty) > 0) : [];
  const totalValue = selected.reduce((s, l) => {
    const q = Number(lines[l.piItemId]?.returnQty) || 0;
    const frac = l.invoicedQty > 0 ? q / l.invoicedQty : 0;
    return s + l.lineValue * frac;
  }, 0);

  async function submit() {
    if (!src) return;
    if (!selected.length) { setError("Enter a return quantity on at least one line."); return; }
    setSaving(true); setError(null);
    const payloadLines = selected.map((l) => {
      const st = lines[l.piItemId];
      return { piItemId: l.piItemId, returnQty: Number(st.returnQty), reason: st.reason || headReason || undefined, remarks: st.remarks || headRemarks || undefined, inventoryHandling: st.handling, qrCodes: l.serialTracked ? st.serials : undefined };
    });
    try {
      const res = await fetch("/api/purchase/returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseInvoiceId: src.id, reason: headReason || undefined, remarks: headRemarks || undefined, lines: payloadLines }) });
      const j = await res.json().catch(() => ({}));
      if (!j.ok) { setError(j.message || "Could not save the return."); setSaving(false); return; }
      router.push(`/purchase/return/${j.id}`);
    } catch { setError("Could not save the return."); setSaving(false); }
  }

  const inp = "h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase/return" className="hover:text-foreground">Purchase Return</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Undo2 className="h-5 w-5 text-primary" /> New Purchase Return</h1>
          <p className="mt-0.5 text-sm text-muted">Select a posted purchase invoice — type, supplier, GRN, batch &amp; serial are inherited.</p>
        </div>
        <Link href="/purchase/return"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>

      {error && <div className="flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger-subtle/50 px-3 py-2 text-2xs font-medium text-danger"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</div>}

      {!src && (
        <SectionCard icon={Search} title="Select Purchase Invoice" allowOverflow>
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(query); } }} placeholder="Search posted invoice by number, supplier bill no or supplier…" className="h-11 w-full rounded-lg border border-primary/40 bg-card px-3 text-sm shadow-sm placeholder:text-subtle focus:border-primary focus:outline-none" />
            <Button size="md" onClick={() => search(query)} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Find</Button>
          </div>
          {matches !== null && (matches.length ? (
            <div className="mt-2 overflow-hidden rounded-lg border border-border">
              <div className="bg-surface-2 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle">{matches.length} posted invoice{matches.length === 1 ? "" : "s"} — pick one</div>
              {matches.map((m) => (
                <button key={m.id} onClick={() => pick(m.id)} className="flex w-full items-center justify-between gap-3 border-t border-border px-3 py-2 text-left text-sm transition hover:bg-primary-subtle/40">
                  <span className="min-w-0"><span className="block font-mono text-sm font-semibold text-foreground">{m.invoiceNo}</span><span className="block text-2xs text-muted">{m.invoiceDate || "—"} · {m.supplier} · {m.itemCount} item{m.itemCount === 1 ? "" : "s"}</span></span>
                  <span className="flex shrink-0 items-center gap-2"><Badge tone={TYPE_TONE[m.purchaseType] ?? "neutral"}>{m.purchaseType}</Badge><span className="text-sm font-semibold text-foreground">{inr(m.total)}</span></span>
                </button>
              ))}
            </div>
          ) : <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">No posted invoices matched.</div>)}
        </SectionCard>
      )}

      {src && (
        <>
          <SectionCard icon={Boxes} title="Invoice Details (inherited)" action={<div className="flex items-center gap-2"><Badge tone={TYPE_TONE[src.purchaseType] ?? "neutral"}>{src.purchaseType}</Badge><Button variant="outline" size="sm" onClick={() => { setSrc(null); setMatches(null); }}>Change</Button></div>}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info2 label="Invoice No" value={<span className="font-mono">{src.invoiceNo}</span>} />
              <Info2 label="Invoice Date" value={src.invoiceDate || "—"} />
              <Info2 label="Supplier" value={src.supplier || "—"} />
              <Info2 label="Supplier GSTIN" value={src.supplierGstin || "—"} />
              <Info2 label="GRN No" value={src.grnNo || "—"} />
              <Info2 label="Warehouse" value={src.warehouse || "—"} />
              <Info2 label="Invoice Value" value={inr(src.totalInvoiceAmount)} />
              <Info2 label="Purchase Type" value={<span className="font-medium">{src.purchaseType}</span>} />
            </div>
          </SectionCard>

          <SectionCard icon={Undo2} title="Return Lines">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                  <th className="px-3 py-2">{isInventory ? "Product" : "Description"}</th>
                  {isInventory && <th className="px-3 py-2">Batch / Exp</th>}
                  <th className="px-3 py-2 text-right">Invoiced</th>
                  <th className="px-3 py-2 text-right">Returned</th>
                  <th className="px-3 py-2 text-right">Available</th>
                  <th className="px-3 py-2 text-right">Return Qty</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Remarks</th>
                </tr></thead>
                <tbody>
                  {src.lines.map((l) => {
                    const st = lines[l.piItemId];
                    const avail = l.returnableQty;
                    return (
                      <tr key={l.piItemId} className="border-b border-border align-top last:border-0">
                        <td className="px-3 py-2"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div>
                          {l.serialTracked && (
                            <div className="mt-1.5">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-subtle">Select serial(s) to return</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {l.availableSerials.length ? l.availableSerials.map((s) => {
                                  const on = st?.serials.includes(s.code);
                                  return <button key={s.id} type="button" onClick={() => toggleSerial(l, s.code)} className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] transition", on ? "border-primary bg-primary-subtle text-primary" : "border-border bg-surface text-muted hover:border-primary/40")}>{on && <Check className="h-3 w-3" />}{s.serialNo}</button>;
                                }) : <span className="text-2xs text-subtle">No available serials</span>}
                              </div>
                            </div>
                          )}
                        </td>
                        {isInventory && <td className="px-3 py-2 text-2xs text-muted">{l.batchNo || "—"}{l.expiryDate ? <div className="text-[10px] text-subtle">Exp {l.expiryDate}</div> : null}</td>}
                        <td className="px-3 py-2 text-right text-foreground">{fmt.qty(l.invoicedQty)}</td>
                        <td className="px-3 py-2 text-right text-muted">{fmt.qty(l.alreadyReturned)}</td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">{fmt.qty(avail)}</td>
                        <td className="px-3 py-2 text-right">
                          <input value={st?.returnQty ?? ""} onChange={(e) => setLine(l.piItemId, { returnQty: e.target.value })} disabled={l.serialTracked || avail <= 0} inputMode="decimal" placeholder="0" className={cn("h-9 w-20 rounded-md border border-border bg-surface px-2 text-right text-sm focus:border-primary focus:outline-none", (l.serialTracked || avail <= 0) && "cursor-not-allowed opacity-60")} />
                        </td>
                        <td className="px-3 py-2"><select value={st?.reason ?? ""} onChange={(e) => setLine(l.piItemId, { reason: e.target.value })} className={cn(inp, "w-36")}><option value="">— Reason —</option>{PR_REASONS.map((r) => <option key={r}>{r}</option>)}</select></td>
                        <td className="px-3 py-2"><input value={st?.remarks ?? ""} onChange={(e) => setLine(l.piItemId, { remarks: e.target.value })} placeholder="Remarks…" className={cn(inp, "w-40")} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div><label className="text-2xs font-semibold uppercase tracking-wide text-subtle">Default Reason</label><select value={headReason} onChange={(e) => setHeadReason(e.target.value)} className={cn(inp, "mt-1")}><option value="">— Select —</option>{PR_REASONS.map((r) => <option key={r}>{r}</option>)}</select></div>
              <div><label className="text-2xs font-semibold uppercase tracking-wide text-subtle">Default Remarks</label><input value={headRemarks} onChange={(e) => setHeadRemarks(e.target.value)} placeholder="Applied to lines without their own remarks" className={cn(inp, "mt-1")} /></div>
            </div>

            <div className="mt-4 flex flex-col items-stretch justify-between gap-3 border-t border-border pt-3 sm:flex-row sm:items-center">
              <div className="text-sm text-muted">Returning <span className="font-semibold text-foreground">{selected.length}</span> line{selected.length === 1 ? "" : "s"} · Total <span className="font-semibold text-foreground">{inr(totalValue)}</span></div>
              <Button size="md" onClick={submit} disabled={saving || !selected.length}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Create Return</Button>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function Info2({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</div><div className="mt-0.5 text-sm text-foreground">{value}</div></div>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCcw, Search, ArrowLeft, ReceiptText, Boxes, IndianRupee, Wallet, ShieldCheck, Info, CheckCircle2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
// Shared API contract — one source of truth for the invoice-lookup shapes.
import type { InvoiceLookupSale as Sale, InvoiceLookupLine as SaleLine, InvoiceMatch as Match } from "@/lib/contracts/salesReturn";

/* ------------------------------------------------------------------ types */
interface SalesConfig {
  fields: Record<string, string>;
  toggles: Record<string, Record<string, boolean>>;
  flags: Record<string, boolean>;
}

// Per-line return selection state, keyed by saleLineId.
interface LineState { selected: boolean; returnQty: string; reason: string; customReason: string; remarks: string; inventoryHandling: string }

const n = (v: unknown) => Number(v) || 0;
// All five inventory-handling options. Filtered by the `inventoryHandling` toggle
// group when the config provides one, otherwise all are shown.
const HANDLING_OPTIONS: { id: string; label: string }[] = [
  { id: "good", label: "Good Condition" },
  { id: "damaged", label: "Damaged" },
  { id: "expired", label: "Expired" },
  { id: "vendorReturn", label: "Vendor Return" },
  { id: "scrap", label: "Scrap" },
];
const REFUND_LABELS: Record<string, string> = { cash: "Cash", upi: "UPI", bank: "Bank Transfer", storeCredit: "Store Credit", creditNote: "Credit Note" };
const enabledIds = (g?: Record<string, boolean>) => Object.entries(g ?? {}).filter(([, v]) => v).map(([k]) => k);

export function SalesReturnEditor() {
  const router = useRouter();
  const fmt = useFmt();
  const money = (x: number) => fmt.money(x);
  const toast = useToast();

  const [config, setConfig] = useState<SalesConfig | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [searching, setSearching] = useState(false);
  const [lineState, setLineState] = useState<Record<number, LineState>>({});

  const [refundMode, setRefundMode] = useState("");
  const [refundRef, setRefundRef] = useState("");
  const [refundRemarks, setRefundRemarks] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ---- config (step 0): drives which sections appear and their defaults ----
  useEffect(() => {
    (async () => {
      try {
        const j = await fetch("/api/settings/sales", { cache: "no-store" }).then((r) => r.json());
        if (j.ok && j.config) {
          setConfig(j.config);
          if (j.config.fields?.defaultRefund) setRefundMode(j.config.fields.defaultRefund);
        }
      } catch { /* keep nulls — UI degrades gracefully */ }
    })();
  }, []);

  const flags = config?.flags ?? {};
  const fields = config?.fields ?? {};
  const toggles = config?.toggles ?? {};

  const returnAllowed = flags.returnAllowed !== false;
  const refundEnabled = !!flags.refundEnabled;
  const inventoryEnabled = !!flags.inventoryHandlingEnabled;
  const reasonMandatory = !!flags.reasonMandatory;
  const allowCustomReason = !!flags.allowCustomReason;
  const approvalEnabled = !!flags.approvalEnabled;
  const qrEnabled = !!flags.qrReturnEnabled;
  const approvalLimit = n(fields.approvalAutoLimit);

  // Configured reasons (returnReasons is stored as a JSON string array).
  const reasons = useMemo<string[]>(() => {
    try { const a = JSON.parse(fields.returnReasons || "[]"); return Array.isArray(a) ? a.map(String) : []; }
    catch { return []; }
  }, [fields.returnReasons]);

  // Refund modes enabled in config, in canonical order, defaulting to all.
  const refundModes = useMemo(() => {
    const e = enabledIds(toggles.refundModes);
    const order = ["cash", "upi", "bank", "storeCredit", "creditNote"];
    return (e.length ? order.filter((m) => e.includes(m)) : order);
  }, [toggles.refundModes]);

  // Inventory-handling options enabled in config (filter if the toggle group exists).
  const handlingOptions = useMemo(() => {
    const e = enabledIds(toggles.inventoryHandling);
    return e.length ? HANDLING_OPTIONS.filter((o) => e.includes(o.id)) : HANDLING_OPTIONS;
  }, [toggles.inventoryHandling]);

  // Enabled search methods, for the placeholder hint (step 1).
  const searchMethods = useMemo(() => enabledIds(toggles.returnSearch), [toggles.returnSearch]);
  const placeholder = useMemo(() => {
    const map: Record<string, string> = { invoiceNo: "Invoice No", mobile: "Mobile", name: "Name", barcode: "Barcode", qrCode: "scan QR" };
    const parts = searchMethods.map((m) => map[m]).filter(Boolean);
    return (parts.length ? parts.join(" · ") : "Invoice No · Mobile · Name · scan QR");
  }, [searchMethods]);

  // ---- invoice lookup (step 1): resolves a sale or a match list ----
  async function lookup(raw: string) {
    const q = raw.trim();
    if (!q) { setMatches(null); return; }
    setSearching(true);
    try {
      const j = await fetch(`/api/sales/returns/invoice?q=${encodeURIComponent(q)}`, { cache: "no-store" }).then((r) => r.json());
      if (!j.ok) { toast.error(j.message || "Lookup failed."); return; }
      if (j.sale) { loadSale(j.sale); setMatches(null); }
      else { setMatches(j.matches ?? []); }
    } catch { toast.error("Could not reach the server. Please try again."); }
    finally { setSearching(false); }
  }
  // A clicked match re-calls the lookup with the exact invoiceNo → full sale.
  async function pickMatch(m: Match) {
    setSearching(true);
    try {
      const j = await fetch(`/api/sales/returns/invoice?q=${encodeURIComponent(m.invoiceNo)}`, { cache: "no-store" }).then((r) => r.json());
      if (j.ok && j.sale) { loadSale(j.sale); setMatches(null); setQuery(m.invoiceNo); }
      else toast.error("Could not load that invoice.");
    } catch { toast.error("Could not reach the server. Please try again."); }
    finally { setSearching(false); }
  }
  function loadSale(s: Sale) {
    setSale(s);
    const next: Record<number, LineState> = {};
    for (const l of s.lines) next[l.saleLineId] = { selected: false, returnQty: "0", reason: "", customReason: "", remarks: "", inventoryHandling: fields.defaultInventoryHandling || "good" };
    setLineState(next);
  }

  function updateLine(id: number, patch: Partial<LineState>) {
    setLineState((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  }
  // Toggle inclusion; selecting defaults the return qty to the full returnable qty
  // (if currently zero) so the common "return everything" case is one click.
  function toggleLine(l: SaleLine) {
    setLineState((p) => {
      const cur = p[l.saleLineId];
      const selected = !cur.selected;
      const qty = selected && n(cur.returnQty) <= 0 ? String(l.returnableQty) : cur.returnQty;
      return { ...p, [l.saleLineId]: { ...cur, selected, returnQty: qty } };
    });
  }
  // Clamp the return qty to [0, returnableQty].
  function setQty(l: SaleLine, v: string) {
    let q = n(v);
    if (q < 0) q = 0;
    if (q > l.returnableQty) q = l.returnableQty;
    updateLine(l.saleLineId, { returnQty: q === n(v) ? v : String(q) });
  }

  // ---- refund calculation (step 6): proportional per selected line ----
  const calc = useMemo(() => {
    let returnAmount = 0, taxAdj = 0;
    if (sale) {
      for (const l of sale.lines) {
        const st = lineState[l.saleLineId];
        if (!st?.selected) continue;
        const q = n(st.returnQty);
        if (q <= 0 || l.soldQty <= 0) continue;
        returnAmount += (l.value / l.soldQty) * q;
        taxAdj += (l.taxAmount / l.soldQty) * q;
      }
    }
    return { returnAmount: +returnAmount.toFixed(2), taxAdj: +taxAdj.toFixed(2), refundAmount: +returnAmount.toFixed(2) };
  }, [sale, lineState]);

  // Lines the user actually selected with a positive qty (the ones we POST).
  const selectedLines = useMemo(() => {
    if (!sale) return [] as SaleLine[];
    return sale.lines.filter((l) => { const st = lineState[l.saleLineId]; return st?.selected && n(st.returnQty) > 0; });
  }, [sale, lineState]);

  // ---- approval indicator (step 8) ----
  const willNeedApproval = approvalEnabled && approvalLimit > 0 && calc.refundAmount > approvalLimit;

  // ---- save (steps 9–10) ----
  async function save() {
    if (!sale) { toast.error("Load an invoice first."); return; }
    if (!returnAllowed) { toast.error("Sales returns are turned off in Sales Return Configuration."); return; }
    if (!selectedLines.length) { toast.error("Select at least one line with a return quantity."); return; }
    // Reason validation when mandatory.
    if (reasonMandatory) {
      for (const l of selectedLines) {
        const st = lineState[l.saleLineId];
        const reason = st.reason === "__custom__" ? st.customReason.trim() : st.reason.trim();
        if (!reason) { toast.error(`Select a reason for "${l.productName}".`); return; }
      }
    }
    setSubmitting(true);
    const payload = {
      saleId: sale.id,
      lines: selectedLines.map((l) => {
        const st = lineState[l.saleLineId];
        const reason = st.reason === "__custom__" ? st.customReason.trim() : st.reason.trim();
        return {
          saleLineId: l.saleLineId, returnQty: n(st.returnQty), reason, remarks: st.remarks.trim(),
          inventoryHandling: inventoryEnabled ? st.inventoryHandling : undefined,
        };
      }),
      refundMode: refundEnabled ? refundMode : undefined,
      refundRef: refundEnabled ? refundRef.trim() : undefined,
      refundRemarks: refundEnabled ? refundRemarks.trim() : undefined,
      notes: notes.trim(),
    };
    try {
      const res = await fetch("/api/sales/returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        toast.success(j.message || "Sales return created.");
        router.push(j.id ? `/sales/return/${j.id}` : "/sales/return");
      } else {
        toast.error(j.message || "Could not create the sales return.");
        setSubmitting(false);
      }
    } catch { toast.error("Network error — could not save."); setSubmitting(false); }
  }

  const saveDisabled = submitting || !returnAllowed || !selectedLines.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales/return" className="hover:text-foreground">Sales Return</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><RotateCcw className="h-5 w-5 text-primary" /> New Sales Return</h1>
          <p className="mt-0.5 text-sm text-muted">Find the original invoice, pick the items to return, then settle the refund.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/return"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={save} disabled={saveDisabled}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {submitting ? "Saving…" : "Create Sales Return"}</Button>
        </div>
      </div>

      {/* Returns disabled notice (step 9–10 gating) */}
      {!returnAllowed && (
        <div className="flex items-start gap-1.5 rounded-lg border border-danger/30 bg-danger-subtle/50 px-3 py-2 text-2xs font-medium text-danger">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Sales returns are currently turned off in <Link href="/settings/sales" className="font-semibold underline">Sales Return Configuration</Link>. You can browse an invoice but cannot create a return.</span>
        </div>
      )}

      {/* Step 1 — Identify invoice */}
      <SectionCard icon={Search} title="Identify Invoice" allowOverflow>
        <div className="relative">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookup(query); } }}
              placeholder={placeholder}
              className="h-11 w-full rounded-lg border border-primary/40 bg-card px-3 text-sm shadow-sm placeholder:text-subtle focus:border-primary focus:outline-none"
            />
            <Button size="md" onClick={() => lookup(query)} disabled={searching || !query.trim()}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search</Button>
          </div>
          <p className="mt-1.5 text-2xs text-subtle">Press Enter or Search to look up.{qrEnabled ? " Scanning a product / invoice QR loads the sale directly." : ""}{searchMethods.length ? ` Enabled: ${searchMethods.join(", ")}.` : ""}</p>

          {matches !== null && (
            matches.length ? (
              <div className="mt-2 overflow-hidden rounded-lg border border-border">
                <div className="bg-surface-2 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-subtle">{matches.length} matching invoice{matches.length === 1 ? "" : "s"} — pick one</div>
                {matches.map((m) => (
                  <button key={m.id} onClick={() => pickMatch(m)} className="flex w-full items-center justify-between gap-3 border-t border-border px-3 py-2 text-left text-sm transition hover:bg-primary-subtle/40">
                    <span className="min-w-0">
                      <span className="block font-mono text-sm font-semibold text-foreground">{m.invoiceNo}</span>
                      <span className="block text-2xs text-muted">{m.saleDate} · {m.customerName}{m.customerPhone ? ` · ${m.customerPhone}` : ""} · {m.itemCount} item{m.itemCount === 1 ? "" : "s"}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-foreground">{money(m.total)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted">No invoice matched that search.</div>
            )
          )}
        </div>
      </SectionCard>

      {sale && (
        <>
          {/* Step 2 — Bill details */}
          <SectionCard icon={ReceiptText} title="Bill Details" action={<Badge tone="primary">{sale.warehouse}</Badge>}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info2 label="Invoice No" value={<span className="font-mono">{sale.invoiceNo}</span>} />
              <Info2 label="Invoice Date" value={sale.saleDate} />
              <Info2 label="Customer" value={sale.customerName} />
              <Info2 label="Phone" value={sale.customerPhone || "—"} />
            </div>
            <div className="mt-3 grid gap-2 rounded-lg bg-surface-2 p-3 sm:grid-cols-4">
              <Tot label="Gross" value={money(sale.subtotal)} />
              <Tot label="Taxable" value={money(sale.taxableValue)} />
              <Tot label="Tax" value={money(sale.taxTotal)} />
              <Tot label="Net" value={money(sale.total)} strong />
            </div>
          </SectionCard>

          {/* Steps 3, 4 & 5 — Sold products + return selection + inventory handling */}
          <SectionCard icon={Boxes} title="Items — Select what to return" bodyClass="">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                    <th className="px-3 py-2.5 text-center">Return</th>
                    <th className="px-3 py-2.5">Product</th>
                    <th className="px-3 py-2.5">Batch / Exp</th>
                    <th className="px-3 py-2.5 text-right">Sold</th>
                    <th className="px-3 py-2.5 text-right">Returned</th>
                    <th className="px-3 py-2.5 text-right">Returnable</th>
                    <th className="px-3 py-2.5 text-right">Rate</th>
                    <th className="px-3 py-2.5 text-right">Tax</th>
                    <th className="px-3 py-2.5 text-right">Net</th>
                    <th className="px-3 py-2.5 text-center">Return Qty</th>
                    <th className="px-3 py-2.5">Reason</th>
                    {inventoryEnabled && <th className="px-3 py-2.5">Handling</th>}
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((l) => {
                    const st = lineState[l.saleLineId];
                    const noStock = l.returnableQty <= 0;
                    const over = n(st?.returnQty) > l.returnableQty;
                    return (
                      <FragmentRow key={l.saleLineId}>
                        <tr className={cn("border-b border-border align-top transition", st?.selected ? "bg-primary-subtle/15" : "")}>
                          <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={!!st?.selected} disabled={noStock} onChange={() => toggleLine(l)} className="h-4 w-4 accent-primary disabled:opacity-40" /></td>
                          <td className="px-3 py-2.5"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}{l.uom ? ` · ${l.uom}` : ""}</div></td>
                          <td className="px-3 py-2.5 text-2xs text-muted">{l.batchNo || "—"}{l.expiryDate ? <div className="text-[10px] text-subtle">Exp {l.expiryDate}</div> : null}</td>
                          <td className="px-3 py-2.5 text-right text-foreground">{fmt.qty(l.soldQty)}</td>
                          <td className="px-3 py-2.5 text-right text-muted">{fmt.qty(l.alreadyReturned)}</td>
                          <td className={cn("px-3 py-2.5 text-right font-semibold", noStock ? "text-danger" : "text-success")}>{fmt.qty(l.returnableQty)}</td>
                          <td className="px-3 py-2.5 text-right text-muted">{money(l.rate)}</td>
                          <td className="px-3 py-2.5 text-right text-muted">{l.taxPct > 0 ? <>{money(l.taxAmount)}<div className="text-[10px] text-subtle">@{l.taxPct}%</div></> : "—"}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-foreground">{money(l.value)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <input type="number" min={0} max={l.returnableQty} step="any" disabled={!st?.selected || noStock} value={st?.returnQty ?? "0"} onChange={(e) => setQty(l, e.target.value)} className={cn("h-8 w-20 rounded border bg-surface px-2 text-right text-xs focus:outline-none disabled:opacity-50", over ? "border-danger" : "border-border-strong focus:border-primary")} />
                            {over && <div className="text-[10px] font-medium text-danger">Max {fmt.qty(l.returnableQty)}</div>}
                          </td>
                          <td className="px-3 py-2.5">
                            <select disabled={!st?.selected} value={st?.reason ?? ""} onChange={(e) => updateLine(l.saleLineId, { reason: e.target.value })} className={cn(selCls, "w-44", st?.selected && reasonMandatory && !((st.reason === "__custom__" ? st.customReason.trim() : st.reason.trim())) && "border-danger")}>
                              <option value="">{reasonMandatory ? "Select reason…" : "No reason"}</option>
                              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                              {allowCustomReason && <option value="__custom__">Other / custom…</option>}
                            </select>
                            {st?.reason === "__custom__" && allowCustomReason && (
                              <input value={st.customReason} disabled={!st.selected} onChange={(e) => updateLine(l.saleLineId, { customReason: e.target.value })} placeholder="Custom reason" className={cn(inpSm, "mt-1 w-44")} />
                            )}
                            <input value={st?.remarks ?? ""} disabled={!st?.selected} onChange={(e) => updateLine(l.saleLineId, { remarks: e.target.value })} placeholder="Remarks (optional)" className={cn(inpSm, "mt-1 w-44")} />
                          </td>
                          {inventoryEnabled && (
                            <td className="px-3 py-2.5">
                              <select disabled={!st?.selected} value={st?.inventoryHandling ?? ""} onChange={(e) => updateLine(l.saleLineId, { inventoryHandling: e.target.value })} className={cn(selCls, "w-40")}>
                                {handlingOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                              </select>
                            </td>
                          )}
                        </tr>
                      </FragmentRow>
                    );
                  })}
                  {sale.lines.length === 0 && <tr><td colSpan={inventoryEnabled ? 12 : 11} className="px-4 py-10 text-center text-sm text-muted">This invoice has no lines.</td></tr>}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Bottom grid: refund calc + settlement + approval */}
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {/* Step 7 — Refund settlement (only when refundEnabled) */}
              {refundEnabled && (
                <SectionCard icon={Wallet} title="Refund Settlement">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Fld label="Refund Mode">
                      <select value={refundMode} onChange={(e) => setRefundMode(e.target.value)} className={selCls}>
                        {refundModes.map((m) => <option key={m} value={m}>{REFUND_LABELS[m] ?? m}</option>)}
                      </select>
                    </Fld>
                    <Fld label="Reference No"><input value={refundRef} onChange={(e) => setRefundRef(e.target.value)} placeholder="UTR / txn / note no" className={inpSm} /></Fld>
                    <Fld label="Remarks"><input value={refundRemarks} onChange={(e) => setRefundRemarks(e.target.value)} placeholder="Optional" className={inpSm} /></Fld>
                  </div>
                </SectionCard>
              )}

              {/* Notes */}
              <SectionCard icon={ReceiptText} title="Return Notes">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal note for this return (optional)…" className={cn(inpSm, "h-auto py-2")} />
              </SectionCard>
            </div>

            {/* Step 6 — Refund calculation + Step 8 — Approval + Save */}
            <aside className="space-y-4">
              <SectionCard icon={IndianRupee} title="Refund Calculation">
                <div className="space-y-1.5 text-sm">
                  <Row k={`Return Amount (${selectedLines.length} line${selectedLines.length === 1 ? "" : "s"})`} v={money(calc.returnAmount - calc.taxAdj)} />
                  <Row k="Tax Adjustment" v={money(calc.taxAdj)} />
                  <div className="my-1.5 h-px bg-border" />
                  <div className="flex items-center justify-between text-lg font-bold text-foreground"><span>Refund Amount</span><span>{money(calc.refundAmount)}</span></div>
                </div>

                {/* Step 8 — Approval indicator */}
                {approvalEnabled && (
                  <div className="mt-3">
                    {willNeedApproval ? (
                      <Badge tone="warning" className="w-full justify-center py-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Will require approval (over {money(approvalLimit)})</Badge>
                    ) : (
                      <Badge tone="success" className="w-full justify-center py-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Auto-approved</Badge>
                    )}
                  </div>
                )}

                <Button size="lg" className="mt-3 w-full" onClick={save} disabled={saveDisabled}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {submitting ? "Saving…" : `Create Sales Return (${money(calc.refundAmount)})`}</Button>
                {!selectedLines.length && returnAllowed && <p className="mt-2 text-center text-2xs text-subtle">Select at least one item to return.</p>}
              </SectionCard>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ bits */
const inpSm = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none disabled:opacity-50";
const selCls = "h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50";

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>;
}
function Info2({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</div><div className="mt-0.5 text-sm font-medium text-foreground">{value}</div></div>;
}
function Tot({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div><div className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</div><div className={cn("mt-0.5", strong ? "text-base font-bold text-foreground" : "text-sm font-medium text-foreground")}>{value}</div></div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted">{k}</span><span className="text-foreground">{v}</span></div>;
}
function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</>; }

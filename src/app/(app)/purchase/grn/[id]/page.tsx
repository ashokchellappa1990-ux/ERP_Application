"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Boxes, IndianRupee, CalendarClock, Truck, Pencil, X, XCircle, Scale, FileText, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { SectionCard } from "@/components/ui/SectionCard";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { GrnFlowStepper } from "@/components/purchase/GrnFlowStepper";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { FetchWeightButton } from "@/components/shared/FetchWeightButton";
import { WeighbridgeReadout } from "@/components/shared/WeighbridgeReadout";
import { useWeighbridgeContext } from "@/components/shared/WeighbridgeProvider";

// Shared API contract — one source of truth for the GRN detail shapes.
import type { GrnDetail as Grn } from "@/lib/contracts/grn";

const hasVal = (v: unknown) => v !== "" && v != null;
const fmtWt = (v: number | string) => (hasVal(v) ? Number(v).toFixed(2) : "");
/** Profit % on the pre-GST selling base over purchase cost — same formula the add page uses. */
function profitPctFor(l: { rate: number | string; sellingPrice: number | string; taxPct: number | string }, taxIncl: boolean): string {
  const cost = Number(l.rate) || 0;
  const selling = Number(l.sellingPrice) || 0;
  const tax = Number(l.taxPct) || 0;
  if (cost <= 0 || selling <= 0) return "—";
  const base = taxIncl && tax > 0 ? selling / (1 + tax / 100) : selling;
  return `${(((base - cost) / cost) * 100).toFixed(2)}%`;
}

export default function GrnViewPage() {
  const fmt = useFmt();
  const money = (n: number) => fmt.money(n);
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const id = Number(params.id);
  const [grn, setGrn] = useState<Grn | null>(null);
  const [loading, setLoading] = useState(true);
  const [emptyWeightOpen, setEmptyWeightOpen] = useState(false);
  const [piBusy, setPiBusy] = useState(false);
  const [piConfirmOpen, setPiConfirmOpen] = useState(false);
  const [piError, setPiError] = useState("");
  // Purchase Configuration → "Enable Purchase Invoice" being off hides these fields
  // on the GRN add screen, so they may still be blank at posting time — collected here.
  const [piInvoiceNo, setPiInvoiceNo] = useState("");
  const [piInvoiceDate, setPiInvoiceDate] = useState("");
  const [piPoNo, setPiPoNo] = useState("");
  const [piRefNo, setPiRefNo] = useState("");
  // POS Configuration → Tax Treatment, needed to derive Profit % the same way the add page does.
  const [taxIncl, setTaxIncl] = useState(true);
  useEffect(() => {
    (async () => {
      try { const p = await fetch("/api/settings/pos", { cache: "no-store" }).then((r) => r.json()); if (p.ok && p.config?.taxMethod) setTaxIncl(p.config.taxMethod !== "exclusive"); } catch { /* default inclusive */ }
    })();
  }, []);

  const load = useCallback(async () => {
    const d = await fetch(`/api/purchase/grn/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (d.ok) setGrn(d.data);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function cancelGrn() {
    if (!window.confirm("Cancel this GRN? Its received stock and any payable will be reversed. The record is kept with status Cancelled.")) return;
    const j = await fetch(`/api/purchase/grn/${id}/cancel`, { method: "POST" }).then((r) => r.json()).catch(() => ({}));
    if (!j.ok && j.message) window.alert(j.message);
    await load();
  }

  function openPiConfirm() {
    if (!grn) return;
    setPiInvoiceNo(grn.supplierInvoiceNo || "");
    setPiInvoiceDate(grn.supplierInvoiceDate || "");
    setPiPoNo(grn.poNo || "");
    setPiRefNo("");
    setPiError("");
    setPiConfirmOpen(true);
  }

  // Books the GST + supplier payable for this GRN (Inventory was already posted at
  // GRN time — this only clears GRN Clearing into GST + Payable, no double posting).
  async function postPurchaseInvoice() {
    if (!grn) return;
    if (!piInvoiceNo.trim()) { setPiError("Supplier Invoice No is required."); return; }
    if (!piInvoiceDate.trim()) { setPiError("Invoice Date is required."); return; }
    setPiError("");
    setPiBusy(true);
    const j = await fetch("/api/purchase/invoice", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceType: "GRN", grnIds: [grn.id], gstMode: "exclusive",
        supplierInvoiceNo: piInvoiceNo.trim(), supplierInvoiceDate: piInvoiceDate.trim(),
        poNo: piPoNo.trim() || undefined, supplierRef: piRefNo.trim() || undefined,
      }),
    }).then((r) => r.json()).catch(() => ({}));
    if (!j.ok) { setPiBusy(false); setPiError(j.message || "Could not post the purchase invoice."); return; }
    setPiConfirmOpen(false);
    toast.success("Purchase Invoice posted.");
    // A gate-entry sourced GRN returns to that list (Raw Material tab) — same
    // rule as GrnEditor's post-save redirect — rather than staying on this page.
    if (grn?.gateEntryId) { router.push("/transport/gate-entry?entryType=RawMaterial"); return; }
    setPiBusy(false);
    await load();
  }

  if (loading) return <div className="py-16"><AppLoader label="Loading GRN…" /></div>;
  if (!grn) return <div className="py-16 text-center text-sm text-muted">GRN not found. <Link href="/purchase/grn" className="font-semibold text-primary hover:underline">Back to list</Link></div>;

  // Purchase Invoice can only be posted after the GRN itself is Posted, and — for
  // Truck Weight Based receipts — after the post-unload weight has been captured.
  // Gate-entry sourced GRNs capture that as Tare Weight (see the repurposed
  // "Update Tare Weight" modal below); other truck-weight GRNs use Empty Weight.
  const canPostInvoice = grn.status === "Posted" && !grn.invoiceRecorded && (!grn.weightUom || hasVal(grn.gateEntryId ? grn.tareWeight : grn.emptyWeight));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase/grn" className="hover:text-foreground">Goods Receipt Note</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{grn.grnNo}</span></div>
          <div className="flex items-center gap-2.5"><h1 className="text-xl font-bold tracking-tight text-foreground">{grn.grnNo}</h1><Badge tone={grn.status === "Posted" ? "success" : grn.status === "Cancelled" ? "danger" : "warning"}>{grn.status}</Badge></div>
          <p className="mt-1 text-xs text-subtle">{grn.supplier || "—"}{grn.poNo ? ` · PO ${grn.poNo}` : ""} — QR labels per received line below.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/purchase/grn"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          {grn.status !== "Cancelled" && <Link href={`/purchase/grn/new?id=${grn.id}`}><Button size="md"><Pencil className="h-4 w-4" /> Edit</Button></Link>}
          {canPostInvoice && <Button size="md" onClick={openPiConfirm} disabled={piBusy}>{piBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {piBusy ? "Posting…" : "Post Purchase Invoice"}</Button>}
          {grn.status === "Posted" && <Button variant="outline" size="md" onClick={cancelGrn}><XCircle className="h-4 w-4" /> Cancel GRN</Button>}
        </div>
      </div>

      <GrnProgressFlow grn={grn} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Meta icon={CalendarClock} label="GRN Date" value={grn.grnDate} />
        <Meta icon={Truck} label="Warehouse" value={grn.warehouse || "—"} />
        <Meta icon={Boxes} label="Total Qty" value={fmt.qty(grn.totalQty)} />
        <Meta icon={IndianRupee} label="Grand Total" value={money(grn.totalValue)} />
      </div>

      {/* Detail cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard icon={FileText} title="Supplier & Invoice">
          <KV k="Supplier" v={grn.supplier} /><KV k="GSTIN" v={grn.supplierGstin} /><KV k="Contact" v={grn.supplierContact} />
          <KV k="Invoice No" v={grn.supplierInvoiceNo} /><KV k="Invoice Date" v={grn.supplierInvoiceDate} /><KV k="PO No" v={grn.poNo} />
        </SectionCard>
        <SectionCard icon={Wallet} title="Payment">
          <KV k="Status" v={grn.paymentStatus} tone={grn.paymentStatus === "Paid" ? "success" : grn.paymentStatus === "Partial" ? "info" : "warning"} />
          <KV k="Paid" v={money(grn.amountPaid)} /><KV k="Balance" v={money(grn.totalValue - grn.amountPaid)} />
          {grn.paymentMode && <KV k="Mode" v={grn.paymentMode} />}{grn.paymentRef && <KV k="Ref" v={grn.paymentRef} />}{grn.paymentDate && <KV k="Paid On" v={grn.paymentDate} />}
          {grn.paymentTerms && <KV k="Terms" v={grn.paymentTerms} />}{grn.dueDate && <KV k="Due Date" v={grn.dueDate} />}
        </SectionCard>
        <SectionCard icon={Truck} title="Transport & Logistics">
          <KV k="Transporter" v={grn.transporterName} /><KV k="Vehicle Owner Type" v={grn.vehicleOwnerType} /><KV k="Mode" v={grn.transportMode} /><KV k="Vehicle" v={grn.vehicleNo} />
          <KV k="LR / Docket" v={grn.lrNo} /><KV k="E-Way Bill" v={grn.ewayBillNo} /><KV k="Packages" v={grn.numPackages ? String(grn.numPackages) : ""} />
          <KV k="Freight" v={grn.freightAmount ? money(grn.freightAmount) : ""} /><KV k="Freight By" v={grn.freightPaidBy} />
        </SectionCard>
      </div>

      <SectionCard icon={Boxes} title="Received Lines & QR Labels" bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="min-w-[200px] px-4 py-3">Product</th><th className="whitespace-nowrap px-4 py-3">UOM</th><th className="whitespace-nowrap px-4 py-3 text-right">Qty</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Purchase Price</th>
                {!grn.weightUom && <th className="whitespace-nowrap px-4 py-3 text-right">Selling Price</th>}
                {!grn.weightUom && <th className="whitespace-nowrap px-4 py-3 text-right">Profit %</th>}
                {!grn.weightUom && <th className="whitespace-nowrap px-4 py-3 text-right">Disc %</th>}
                <th className="whitespace-nowrap px-4 py-3 text-right">Tax %</th><th className="whitespace-nowrap px-4 py-3 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><div className="font-medium text-foreground">{l.productName}</div><div className="font-mono text-2xs text-subtle">{l.sku || "—"}</div></td>
                  <td className="whitespace-nowrap px-4 py-3 text-2xs text-muted">{l.uom || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">{fmt.qty(l.qty)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{l.rate !== "" ? money(Number(l.rate)) : "—"}</td>
                  {!grn.weightUom && <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{l.sellingPrice !== "" ? money(Number(l.sellingPrice)) : "—"}</td>}
                  {!grn.weightUom && <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{profitPctFor(l, taxIncl)}</td>}
                  {!grn.weightUom && <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{l.discPct !== "" ? `${l.discPct}%` : "—"}</td>}
                  <td className="whitespace-nowrap px-4 py-3 text-right text-muted">{l.taxPct !== "" ? `${l.taxPct}%` : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">{money(l.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {grn.status === "Draft" && <div className="border-t border-border px-4 py-3 text-2xs text-muted">This GRN is a <strong>Draft</strong> — inventory is posted when you <strong>Post</strong> it (Edit → Post GRN).</div>}
      </SectionCard>

      <div className={cn("grid gap-4", grn.weightUom ? "lg:grid-cols-2" : "lg:grid-cols-1")}>
        {!!grn.weightUom && (
          <SectionCard icon={Scale} title="Vehicle Weighment">
            <KV k={`Gross Weight (${grn.weightUom})`} v={fmtWt(grn.grossWeight)} />
            {hasVal(grn.billNetWeight) && <KV k={`Net Weight as per Bill (${grn.weightUom})`} v={fmtWt(grn.billNetWeight)} tone="info" />}
            {grn.weightSlipRefNo && <KV k="Weight Slip Ref Number" v={grn.weightSlipRefNo} />}
            {grn.areaName && <KV k="Inventory Movement Area" v={grn.areaName} tone="info" />}
            <div className="my-1 h-px bg-border" />
            {grn.gateEntryId ? (
              hasVal(grn.tareWeight) ? (
                <>
                  <KV k={`Tare Weight (${grn.weightUom})`} v={fmtWt(grn.tareWeight)} tone="success" />
                  <KV k={`Net Weight Calculated (${grn.weightUom})`} v={fmtWt(grn.netWeight)} strong />
                  {hasVal(grn.billNetWeight) && (
                    <KV k={`Difference (${grn.weightUom})`} v={fmtWt(+(Number(grn.netWeight) - Number(grn.billNetWeight)).toFixed(3))} tone={Number(grn.netWeight) === Number(grn.billNetWeight) ? "success" : "warning"} />
                  )}
                </>
              ) : grn.status === "Posted" ? (
                <div className="flex justify-end"><Button variant="secondary" size="sm" onClick={() => setEmptyWeightOpen(true)}><Scale className="h-3.5 w-3.5" /> Update Tare Weight</Button></div>
              ) : (
                <p className="text-2xs text-subtle">Available once this GRN is Posted.</p>
              )
            ) : (
              <>
                <KV k={`Tare Weight (${grn.weightUom})`} v={fmtWt(grn.tareWeight)} />
                <KV k={`Net Weight (${grn.weightUom})`} v={fmtWt(grn.netWeight)} strong />
                <div className="my-1 h-px bg-border" />
                {hasVal(grn.emptyWeight) ? (
                  <>
                    <KV k={`Empty Weight (${grn.weightUom})`} v={fmtWt(grn.emptyWeight)} tone="success" />
                    {grn.emptyWeightAt && <KV k="Captured On" v={new Date(grn.emptyWeightAt).toLocaleString()} />}
                    {grn.emptyWeightRemarks && <KV k="Remarks" v={grn.emptyWeightRemarks} />}
                  </>
                ) : grn.status === "Posted" ? (
                  <div className="flex justify-end"><Button variant="secondary" size="sm" onClick={() => setEmptyWeightOpen(true)}><Scale className="h-3.5 w-3.5" /> Update Empty Weight</Button></div>
                ) : (
                  <p className="text-2xs text-subtle">Available once this GRN is Posted.</p>
                )}
              </>
            )}
          </SectionCard>
        )}
        <SectionCard icon={IndianRupee} title="Bill Summary" className={grn.weightUom ? "" : "lg:max-w-md"}>
          <KV k="Subtotal" v={money(grn.subtotal)} />
          <KV k={`GST ${grn.gstMode === "invoice" ? `(@ ${grn.gstPct}%)` : "(line-wise)"}`} v={money(grn.taxTotal)} />
          <KV k="Freight" v={money(grn.freightAmount)} /><KV k="Other" v={money(grn.otherCharges)} />
          {!!grn.roundOff && <KV k="Round Off" v={money(grn.roundOff)} />}
          <div className="my-1 h-px bg-border" />
          <KV k="Grand Total" v={money(grn.totalValue)} strong />
          {!!grn.totalInvoiceValue && <KV k="Invoice Value" v={money(grn.totalInvoiceValue)} />}
        </SectionCard>
      </div>

      {emptyWeightOpen && (grn.gateEntryId ? (
        <TareWeightModal id={id} weightUom={grn.weightUom} grossWeight={grn.grossWeight} billNetWeight={grn.billNetWeight} onClose={() => setEmptyWeightOpen(false)} onSaved={async () => { setEmptyWeightOpen(false); await load(); }} />
      ) : (
        <EmptyWeightModal id={id} weightUom={grn.weightUom} onClose={() => setEmptyWeightOpen(false)} onSaved={async () => { setEmptyWeightOpen(false); await load(); }} />
      ))}
      {piConfirmOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={() => setPiConfirmOpen(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary"><FileText className="h-5 w-5" /></span>
              <div><h3 className="text-base font-bold text-foreground">Post Purchase Invoice</h3><p className="text-2xs text-muted">Books GST and the supplier payable for this GRN.</p></div>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm text-muted">
              <p>
                Inventory was already posted when the GRN was received — this step books <strong className="text-foreground">Input GST</strong> and clears <strong className="text-foreground">GRN Clearing</strong>. The supplier payable is already on the books from the GRN itself.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">Supplier Invoice No *</label>
                  <input value={piInvoiceNo} onChange={(e) => setPiInvoiceNo(e.target.value)} placeholder="INV-1234" className="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">Invoice Date *</label>
                  <input type="date" value={piInvoiceDate} onChange={(e) => setPiInvoiceDate(e.target.value)} className="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">PO No</label>
                  <input value={piPoNo} onChange={(e) => setPiPoNo(e.target.value)} placeholder="Optional" className="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">Reference No</label>
                  <input value={piRefNo} onChange={(e) => setPiRefNo(e.target.value)} placeholder="Optional" className="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none" />
                </div>
              </div>
              {piError && <p className="text-2xs font-medium text-danger">{piError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2/50 px-5 py-3">
              <Button variant="ghost" size="md" onClick={() => setPiConfirmOpen(false)}>Cancel</Button>
              <Button size="md" onClick={postPurchaseInvoice} disabled={piBusy}>{piBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {piBusy ? "Posting…" : "Post Invoice"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GrnProgressFlow({ grn }: { grn: Grn }) {
  const isWeightGrn = !!grn.weightUom;
  const posted = grn.status === "Posted";
  // GRNs sourced from a Raw Material Vehicle Gate Entry narrate the whole
  // gate-to-GRN journey; other GRNs keep the generic document-only steps.
  const steps = grn.gateEntryId
    ? [
        { label: "Vehicle Entry", done: true },
        { label: "Weight Update", done: hasVal(grn.gateEntry?.grossWeight ?? "") },
        { label: "GRN Posted", done: posted },
        { label: "Empty Vehicle Weight Update", done: hasVal(grn.tareWeight) },
        { label: "Purchase Invoice Update", done: grn.invoiceRecorded },
      ]
    : [
        { label: "GRN Submitted", done: posted },
        { label: "Inventory Updated", done: posted },
        ...(isWeightGrn ? [{ label: "Empty Weight Updated", done: hasVal(grn.emptyWeight) }] : []),
        { label: "Purchase Invoice", done: grn.invoiceRecorded },
      ];
  return <GrnFlowStepper steps={steps} />;
}

function EmptyWeightModal({ id, weightUom, onClose, onSaved }: { id: number; weightUom: string; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit() {
    setError("");
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) { setError("Enter a valid weight."); return; }
    setSaving(true);
    const j = await fetch(`/api/purchase/grn/${id}/empty-weight`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emptyWeight: n, remarks }) }).then((r) => r.json()).catch(() => ({}));
    setSaving(false);
    if (!j.ok) { setError(j.message || "Could not save."); return; }
    onSaved();
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><Scale className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-foreground">Update Empty Weight</h2><p className="text-2xs text-muted">After the product is unloaded from the vehicle</p></div></div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">{`Empty Vehicle Weight (${weightUom})`}</label>
            <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">Remarks (optional)</label>
            <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          </div>
          {error && <p className="text-2xs font-medium text-danger">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button size="md" onClick={submit} disabled={saving}><Scale className="h-4 w-4" /> {saving ? "Saving…" : "Save"}</Button></div>
      </div>
    </div>
  );
}

function TareWeightModal({ id, weightUom, grossWeight, billNetWeight, onClose, onSaved }: { id: number; weightUom: string; grossWeight: number | string; billNetWeight: number | string; onClose: () => void; onSaved: () => void }) {
  const [tareWeight, setTareWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [enableWeighbridgeFetch, setEnableWeighbridgeFetch] = useState(false);
  const wb = useWeighbridgeContext();
  useEffect(() => {
    (async () => {
      const j = await fetch("/api/settings/purchase", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok && j.config) setEnableWeighbridgeFetch(!!j.config.flags?.enableWeighbridgeFetch);
    })();
  }, []);
  const netCalc = tareWeight.trim() !== "" && Number.isFinite(Number(tareWeight)) ? +(Number(grossWeight || 0) - Number(tareWeight)).toFixed(3) : null;
  async function submit() {
    setError("");
    const n = Number(tareWeight);
    if (!Number.isFinite(n) || n < 0) { setError("Enter a valid tare weight."); return; }
    setSaving(true);
    const j = await fetch(`/api/purchase/grn/${id}/empty-weight`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tareWeight: n }) }).then((r) => r.json()).catch(() => ({}));
    setSaving(false);
    if (!j.ok) { setError(j.message || "Could not save."); return; }
    onSaved();
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-5 py-3.5">
          <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><Scale className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-foreground">Update Tare Weight</h2><p className="text-2xs text-muted">After the vehicle is unloaded and weighed empty</p></div></div>
          <div className="flex items-center gap-2">
            {enableWeighbridgeFetch && <WeighbridgeReadout state={wb.state} liveWeight={wb.liveWeight} />}
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="space-y-3 p-5">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-2 p-3 text-sm">
            <div><p className="text-2xs text-subtle">Gross Weight</p><p className="font-semibold text-foreground">{fmtWt(grossWeight)} {weightUom}</p></div>
            <div><p className="text-2xs text-subtle">Net Weight as per Bill</p><p className="font-semibold text-foreground">{hasVal(billNetWeight) ? `${fmtWt(billNetWeight)} ${weightUom}` : "—"}</p></div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-foreground">{`Tare Weight (${weightUom})`}</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} autoFocus value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} placeholder="0" className="h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
              {enableWeighbridgeFetch && <FetchWeightButton connected={wb.state === "connected"} liveWeight={wb.liveWeight} onFetch={(kg) => setTareWeight(String(kg))} />}
            </div>
          </div>
          {netCalc != null && <p className="text-2xs text-muted">Net Weight (calculated): <span className="font-semibold text-primary">{netCalc} {weightUom}</span></p>}
          {error && <p className="text-2xs font-medium text-danger">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-5 py-3"><Button variant="ghost" size="md" onClick={onClose}>Cancel</Button><Button size="md" onClick={submit} disabled={saving}><Scale className="h-4 w-4" /> {saving ? "Saving…" : "Save"}</Button></div>
      </div>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0"><div className="truncate text-sm font-bold text-foreground">{value}</div><div className="text-2xs text-subtle">{label}</div></div></div>;
}
function KV({ k, v, tone, strong }: { k: string; v: string; tone?: "success" | "info" | "warning"; strong?: boolean }) {
  if (!v) return null;
  return <div className="flex items-center justify-between gap-2"><span className="text-muted">{k}</span>{tone ? <Badge tone={tone}>{v}</Badge> : <span className={cn("text-right", strong ? "font-bold text-foreground" : "font-medium text-foreground")}>{v}</span>}</div>;
}

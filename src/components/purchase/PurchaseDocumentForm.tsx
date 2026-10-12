"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, Search, Truck, Settings2, CheckCircle2, Save, Paperclip, ChevronDown, Tag, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PURCHASE_LISTS, PURCHASE_FORM_META, PURCHASE_FEATURES, PURCHASE_CATALOG, SAMPLE_SUPPLIERS, purchaseNotesFor, type PFormField, type PurchaseProduct } from "@/lib/purchase/purchaseData";
import { pf, pflag, purchaseDocNo } from "@/lib/purchase/purchaseConfig";
import { computeDoc, EMPTY_TXN, type TxnInput, type DiscType } from "@/lib/shared/docMath";
import { DocTotals } from "@/components/shared/DocTotals";
import { screenKeyFor, fieldOn, fieldMust, CONFIGURABLE_FIELD_KEYS } from "@/lib/settings/docFieldsConfig";
import { companyFlag } from "@/lib/settings/companyConfig";
import { GRN_LINE_FIELDS, grnFieldOn, grnFieldMust, ruleFor } from "@/lib/settings/grnPricingConfig";
import { cn } from "@/lib/cn";
import { useFmt } from "@/components/settings/GeneralConfigProvider";

interface Line { product: PurchaseProduct; qty: number; rate: number; disc: number; discType: DiscType; bp?: Record<string, string> }

export function PurchaseDocumentForm({ featureKey }: { featureKey: string }) {
  const router = useRouter();
  const fmt = useFmt();
  const inr = (n: number) => fmt.money(n);
  const meta = PURCHASE_FORM_META[featureKey];
  const list = PURCHASE_LISTS[featureKey];
  const feature = PURCHASE_FEATURES.find((f) => f.key === featureKey);
  const Icon = (feature?.icon ?? Truck) as LucideIcon;
  const notes = useMemo(() => purchaseNotesFor(featureKey), [featureKey]);
  const gstRequired = pflag("gstMandatorySupplier");

  // ---- screen-wise field config + company GST ----
  const screen = screenKeyFor("purchase", featureKey);
  const gstEnabled = companyFlag("gstEnabled");
  const showTax = gstEnabled && fieldOn(screen, "tax");
  const showHsn = gstEnabled && companyFlag("showHsn") && fieldOn(screen, "hsn");
  const allowItemDisc = fieldOn(screen, "itemDiscount");
  const allowTxnDisc = fieldOn(screen, "txnDiscount");
  const showTds = fieldOn(screen, "tds");
  const showTcs = fieldOn(screen, "tcs");
  const showOther = fieldOn(screen, "otherCharges");

  const backHref = `/purchase/${featureKey}`;
  const [sup, setSup] = useState<Record<string, string>>({});
  const [docFields, setDocFields] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [discLevel, setDiscLevel] = useState<"item" | "transaction">("item");
  const [txn, setTxn] = useState<TxnInput>(EMPTY_TXN);
  const [taxMethod, setTaxMethod] = useState(pf("taxMethod")); // configurable per doc, defaults from policy / supplier
  const [interState, setInterState] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const isGrn = featureKey === "grn";

  function pickSupplier(name: string) {
    const s = SAMPLE_SUPPLIERS.find((x) => x.name === name);
    if (!s) { setSup({ ...sup, name }); return; }
    setSup({ name: s.name, gst: s.gst, contact: s.contact });
    setDocFields((d) => ({ ...d, paymentTerms: s.terms }));
    setTaxMethod(s.taxMethod); // purchase details default from supplier master
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? PURCHASE_CATALOG.filter((p) => `${p.code} ${p.name}`.toLowerCase().includes(q)) : PURCHASE_CATALOG.slice(0, 6);
  }, [query]);

  // GRN batch pricing prefilled from Product Master (the Default Price Repository)
  function defaultBp(p: PurchaseProduct): Record<string, string> {
    const margin = p.price ? Math.round(((p.mrp - p.price) / p.price) * 100) : 0;
    return { cost: String(p.price), mrp: String(p.mrp), retail: String(p.prices.retail), wholesale: String(p.prices.wholesale), dealer: String(p.prices.dealer), distributor: String(p.prices.distributor), online: String(p.prices.online), margin: String(margin), effectiveDate: "", batchNo: "", mfgDate: "", expDate: "", reason: "" };
  }
  function add(p: PurchaseProduct) {
    setLines((ls) => { const i = ls.findIndex((l) => l.product.code === p.code); if (i >= 0) { const c = [...ls]; c[i] = { ...c[i], qty: c[i].qty + 1 }; return c; } return [...ls, { product: p, qty: 1, rate: p.price, disc: 0, discType: "pct", ...(isGrn ? { bp: defaultBp(p) } : {}) }]; });
    if (isGrn) setExpanded((e) => ({ ...e, [p.code]: true }));
    setQuery("");
  }
  const upd = (code: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => l.product.code === code ? { ...l, ...patch } : l));
  const updBp = (code: string, key: string, value: string) => setLines((ls) => ls.map((l) => {
    if (l.product.code !== code) return l;
    const bp = { ...(l.bp ?? {}), [key]: value };
    if (key === "cost" || key === "mrp") { const c = Number(bp.cost) || 0, m = Number(bp.mrp) || 0; bp.margin = c ? String(Math.round(((m - c) / c) * 100)) : "0"; }
    return { ...l, bp };
  }));
  const setQty = (code: string, d: number) => setLines((ls) => ls.flatMap((l) => l.product.code === code ? (l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }]) : [l]));
  const remove = (code: string) => setLines((ls) => ls.filter((l) => l.product.code !== code));

  const effDiscLevel: "item" | "transaction" = !allowItemDisc && allowTxnDisc ? "transaction" : !allowTxnDisc ? "item" : discLevel;
  const docLines = lines.map((l) => ({ gross: l.rate * l.qty, taxPct: showTax ? l.product.tax : 0, disc: l.disc, discType: l.discType }));
  const totals = useMemo(() => computeDoc(docLines, txn, effDiscLevel, taxMethod, interState), [lines, txn, effDiscLevel, taxMethod, showTax, interState]);

  if (!meta || !list) return <div className="p-6 text-sm text-muted">Unknown purchase document.</div>;
  const isItems = meta.kind === "items";
  const isSupplier = meta.party === "supplier";
  const showLineDisc = allowItemDisc && effDiscLevel === "item";
  const visibleFields = meta.fields.filter((f) => !CONFIGURABLE_FIELD_KEYS.includes(f.key) || fieldOn(screen, f.key));
  const isRequired = (f: PFormField) => CONFIGURABLE_FIELD_KEYS.includes(f.key) ? fieldMust(screen, f.key, f.required) : !!f.required;
  const refAmount = Number(docFields.amount || ((Number(docFields.freight) || 0) + (Number(docFields.duty) || 0) + (Number(docFields.insurance) || 0) + (Number(docFields.clearing) || 0)) || 0);
  const supOk = !isSupplier || (sup.name && (!gstRequired || sup.gst));
  const grnLineOk = (l: Line) => {
    if (!isGrn) return true;
    const rule = ruleFor(l.product.category); const bp = l.bp ?? {};
    for (const f of GRN_LINE_FIELDS) if (grnFieldOn(f.key) && grnFieldMust(f.key) && !(bp[f.key] ?? "").trim()) return false;
    if (rule.batch === "Mandatory" && !(bp.batchNo ?? "").trim()) return false;
    if (rule.expiry === "Mandatory" && !(bp.expDate ?? "").trim()) return false;
    if (rule.batchPrice === "Mandatory" && (!(bp.cost ?? "").trim() || !(bp.mrp ?? "").trim())) return false;
    return true;
  };
  const grnOk = !isGrn || lines.every(grnLineOk);
  const canSave = isItems ? lines.length > 0 && supOk && grnOk && visibleFields.filter(isRequired).every((f) => (docFields[f.key] ?? "").trim() !== "") : visibleFields.filter(isRequired).every((f) => (docFields[f.key] ?? "").trim() !== "") && supOk;

  function save() { if (!canSave) return; setSaved(true); window.setTimeout(() => router.push(backHref), 1200); }

  const renderField = (f: PFormField) => (
    <div key={f.key} className={cn(f.full && "sm:col-span-2 lg:col-span-3")}>
      <label className="mb-1 block text-2xs font-semibold text-muted">{f.label}{isRequired(f) && <span className="text-danger"> *</span>}</label>
      {f.type === "select"
        ? <select value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:bg-surface focus:outline-none"><option value="">Select…</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        : f.type === "textarea"
          ? <textarea rows={2} value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} placeholder={f.label} className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
          : f.type === "file"
            ? <div>
                <label className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted transition hover:border-primary/40 hover:text-primary">
                  <Paperclip className="h-4 w-4" /> Click to upload files
                  <input type="file" multiple className="hidden" onChange={(e) => setDocFields({ ...docFields, [f.key]: Array.from(e.target.files ?? []).map((x) => x.name).join(", ") })} />
                </label>
                {docFields[f.key] && <div className="mt-1.5 flex flex-wrap gap-1.5">{docFields[f.key].split(", ").map((n, i) => <span key={i} className="rounded-full bg-primary-subtle px-2 py-0.5 text-2xs font-medium text-primary">{n}</span>)}</div>}
              </div>
            : <input type={f.type} value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} placeholder={f.label} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/purchase" className="hover:text-foreground">Purchase</Link><span className="text-subtle">/</span><Link href={backHref} className="hover:text-foreground">{list.title}</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> New {list.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={backHref}><Button variant="ghost" size="md">Cancel</Button></Link>
          <Button variant="outline" size="md" onClick={save} disabled={!canSave}><Save className="h-4 w-4" /> Save Draft</Button>
          <Button size="md" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> {meta.saveLabel}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Procurement policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {isSupplier && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Truck className="h-4 w-4 text-primary" /> Supplier <span className="text-2xs font-normal text-danger">required</span></p>
                <div className="flex items-center gap-1.5 text-2xs"><span className="font-medium text-muted">Pick from master:</span>
                  <select onChange={(e) => pickSupplier(e.target.value)} className="h-8 rounded-md border border-border bg-surface-2 px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"><option value="">Select supplier…</option>{SAMPLE_SUPPLIERS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}</select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className="mb-1 block text-2xs font-semibold text-muted">Supplier Name <span className="text-danger">*</span></label><input value={sup.name ?? ""} onChange={(e) => setSup({ ...sup, name: e.target.value })} placeholder="Supplier" className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
                <div><label className="mb-1 block text-2xs font-semibold text-muted">Contact</label><input value={sup.contact ?? ""} onChange={(e) => setSup({ ...sup, contact: e.target.value })} placeholder="Phone / email" className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
                <div><label className="mb-1 block text-2xs font-semibold text-muted">GSTIN{gstRequired && <span className="text-danger"> *</span>}</label><input value={sup.gst ?? ""} onChange={(e) => setSup({ ...sup, gst: e.target.value })} placeholder="GSTIN" className={cn("h-9 w-full rounded-md border bg-surface-2 px-3 text-sm focus:bg-surface focus:outline-none", gstRequired && !sup.gst ? "border-danger/50 focus:border-danger" : "border-border focus:border-primary")} /></div>
              </div>
            </div>
          )}

          {isItems ? (
            <>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Items</p>
                  <div className="flex flex-wrap items-center gap-3 text-2xs">
                    {gstEnabled && (
                      <div className="flex items-center gap-1.5"><span className="font-medium text-muted">GST:</span>
                        <div className="inline-flex overflow-hidden rounded-md border border-border">
                          {(["exclusive", "inclusive"] as const).map((m) => <button key={m} type="button" onClick={() => setTaxMethod(m)} className={cn("px-2.5 py-1 font-semibold capitalize transition", taxMethod === m ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{m}</button>)}
                        </div>
                      </div>
                    )}
                    {allowItemDisc && allowTxnDisc && (
                      <div className="flex items-center gap-1.5"><span className="font-medium text-muted">Discount:</span>
                        <div className="inline-flex overflow-hidden rounded-md border border-border">
                          {(["item", "transaction"] as const).map((m) => <button key={m} type="button" onClick={() => setDiscLevel(m)} className={cn("px-2.5 py-1 font-semibold capitalize transition", effDiscLevel === m ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{m === "item" ? "Item-level" : "Transaction-level"}</button>)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search & add product…" className="h-10 w-full rounded-lg border border-border bg-surface-2 pl-10 pr-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" />
                  {query && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">{results.map((p) => <button key={p.code} onClick={() => add(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-primary-subtle/40"><span className="font-medium text-foreground">{p.name}</span><span className="text-muted">{p.tax}% GST</span></button>)}{results.length === 0 && <p className="px-3 py-2 text-sm text-muted">No product found.</p>}</div>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="py-2">Item</th>{showHsn && <th className="py-2 text-center">HSN</th>}<th className="py-2 text-center">Qty</th><th className="py-2 text-right">Cost Rate</th>{showLineDisc && <th className="py-2 text-center">Discount</th>}{showTax && <th className="py-2 text-center">GST</th>}<th className="py-2 text-right">Amount</th><th></th></tr></thead>
                    <tbody>
                      {lines.map((l) => {
                        const gross = l.rate * l.qty;
                        const d = showLineDisc ? (l.discType === "pct" ? gross * l.disc / 100 : Math.min(l.disc, gross)) : 0;
                        const net = gross - d;
                        const amt = !showTax ? net : taxMethod === "inclusive" ? net : net + net * (l.product.tax / 100);
                        return (
                          <Fragment key={l.product.code}>
                          <tr className="border-b border-border last:border-0">
                            <td className="py-2">
                              <div className="flex items-center gap-1.5">
                                {isGrn && <button onClick={() => setExpanded((e) => ({ ...e, [l.product.code]: !e[l.product.code] }))} className="grid h-5 w-5 place-items-center rounded text-muted hover:text-primary" title="Batch & pricing"><ChevronDown className={cn("h-3.5 w-3.5 transition", expanded[l.product.code] && "rotate-180")} /></button>}
                                <div><p className="font-medium text-foreground">{l.product.name}</p><p className="text-2xs text-subtle">{l.product.code}{isGrn && ` · ${ruleFor(l.product.category).pricing} pricing`}</p></div>
                              </div>
                            </td>
                            {showHsn && <td className="py-2 text-center text-2xs text-muted">{l.product.hsn}</td>}
                            <td className="py-2"><div className="flex items-center justify-center gap-1"><button onClick={() => setQty(l.product.code, -1)} className="grid h-6 w-6 place-items-center rounded border border-border text-muted hover:text-primary"><Minus className="h-3 w-3" /></button><span className="w-7 text-center font-semibold">{l.qty}</span><button onClick={() => setQty(l.product.code, 1)} className="grid h-6 w-6 place-items-center rounded border border-border text-muted hover:text-primary"><Plus className="h-3 w-3" /></button></div></td>
                            <td className="py-2 text-right"><input type="number" value={l.rate} onChange={(e) => upd(l.product.code, { rate: Number(e.target.value) })} className="h-7 w-20 rounded border border-border bg-surface-2 px-1 text-right text-xs focus:border-primary focus:outline-none" /></td>
                            {showLineDisc && <td className="py-2"><div className="flex items-center justify-center gap-1"><input type="number" value={l.disc || ""} onChange={(e) => upd(l.product.code, { disc: Math.max(0, Number(e.target.value)) })} placeholder="0" className="h-7 w-14 rounded border border-border bg-surface-2 px-1 text-center text-xs focus:border-primary focus:outline-none" /><button type="button" onClick={() => upd(l.product.code, { discType: l.discType === "pct" ? "val" : "pct" })} className="grid h-7 w-7 place-items-center rounded border border-border bg-surface text-2xs font-bold text-muted hover:text-primary">{l.discType === "pct" ? "%" : "₹"}</button></div></td>}
                            {showTax && <td className="py-2 text-center text-2xs text-muted">{l.product.tax}%</td>}
                            <td className="py-2 text-right font-semibold text-foreground">{inr(amt)}</td>
                            <td className="py-2 text-right"><button onClick={() => remove(l.product.code)} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button></td>
                          </tr>
                          {isGrn && expanded[l.product.code] && (
                            <tr><td colSpan={8} className="bg-surface-2/50 px-3 pb-3 pt-1">
                              <BatchPricing line={l} updBp={updBp} />
                            </td></tr>
                          )}
                          </Fragment>
                        );
                      })}
                      {lines.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-sm text-muted">Search and add products above.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {visibleFields.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <p className="mb-3 text-sm font-semibold text-foreground">{list.title} Details &amp; Terms</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleFields.map(renderField)}</div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-foreground">{list.title} Details</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleFields.map(renderField)}</div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Document</p>
            <div className="space-y-3">
              <div><label className="mb-1 block text-2xs font-semibold text-muted">{list.title} No.</label><input readOnly value={purchaseDocNo(meta.prefix, 1)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 font-mono text-sm text-primary" /></div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">{meta.docDate}</label><input type="date" value={docFields.docDate ?? ""} onChange={(e) => setDocFields({ ...docFields, docDate: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Summary</p>
            {isItems ? (
              <DocTotals discLevel={effDiscLevel} txn={txn} setTxn={setTxn} totals={totals} taxMethod={taxMethod} discountsOn={allowItemDisc || allowTxnDisc} showTax={showTax} showTxnDiscount={allowTxnDisc} showTds={showTds} showTcs={showTcs} showOther={showOther} interState={interState} setInterState={setInterState} />
            ) : (
              <div className="flex items-center justify-between text-base font-bold text-foreground"><span>Amount</span><span>{inr(refAmount)}</span></div>
            )}
            <Button size="lg" className="mt-4 w-full" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> {meta.saveLabel}</Button>
            {!canSave && <p className="mt-2 text-center text-2xs font-medium text-danger">{isItems ? "Add items & supplier details." : "Fill required fields."}</p>}
          </div>
        </aside>
      </div>

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">{list.title} saved</p><p className="text-2xs text-muted">Redirecting…</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** GRN per-line batch & pricing — fields shown/required come from Settings + category rules. */
function BatchPricing({ line, updBp }: { line: Line; updBp: (code: string, key: string, value: string) => void }) {
  const bp = line.bp ?? {};
  const rule = ruleFor(line.product.category);
  const fields = GRN_LINE_FIELDS.filter((f) => grnFieldOn(f.key));
  const must = (key: string) => grnFieldMust(key) || (key === "batchNo" && rule.batch === "Mandatory") || (key === "expDate" && rule.expiry === "Mandatory") || ((key === "cost" || key === "mrp") && rule.batchPrice === "Mandatory");
  const typeOf = (key: string) => /Date$/.test(key) ? "date" : ["cost", "mrp", "retail", "wholesale", "dealer", "distributor", "online", "margin"].includes(key) ? "number" : "text";
  return (
    <div className="rounded-lg border border-primary/20 bg-card p-3">
      <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-primary"><Tag className="h-3.5 w-3.5" /> Batch &amp; Pricing — {rule.category} ({rule.batchPrice} batch price · prefilled from Product Master)</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-0.5 block text-[10px] font-semibold text-muted">{f.label}{must(f.key) && <span className="text-danger"> *</span>}</label>
            <input type={typeOf(f.key)} readOnly={f.key === "margin"} value={bp[f.key] ?? ""} onChange={(e) => updBp(line.product.code, f.key, e.target.value)} placeholder={f.label} className={cn("h-8 w-full rounded border px-2 text-xs focus:border-primary focus:bg-surface focus:outline-none", f.key === "margin" ? "border-border bg-surface text-muted" : must(f.key) && !(bp[f.key] ?? "").trim() ? "border-danger/50 bg-surface-2" : "border-border bg-surface-2")} />
          </div>
        ))}
      </div>
    </div>
  );
}

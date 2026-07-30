"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, Search, User, Settings2, ArrowRight, CheckCircle2, Save, Paperclip, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SALES_LISTS, SALES_FORM_META, SALES_FEATURES, configNotesFor, POS_CATALOG, type PosProduct, type SFormField } from "@/lib/sales/salesData";
import { field, flag, sampleBillNumber } from "@/lib/settings/salesConfigDefaults";
import { PRICE_SOURCES } from "@/lib/settings/salesConfig";
import { computeDoc, EMPTY_TXN, type TxnInput, type DiscType } from "@/lib/shared/docMath";
import { DocTotals } from "@/components/shared/DocTotals";
import { screenKeyFor, fieldOn, fieldMust, CONFIGURABLE_FIELD_KEYS } from "@/lib/settings/docFieldsConfig";
import { companyFlag } from "@/lib/settings/companyConfig";
import { lyFlag } from "@/lib/loyalty/loyaltyConfig";
import { LoyaltyRewardsButton } from "@/components/loyalty/LoyaltyRewardsButton";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

interface Line { product: PosProduct; qty: number; disc: number; discType: DiscType }

export function SalesDocumentForm({ featureKey }: { featureKey: string }) {
  const router = useRouter();
  const fmt = useFmt();
  const inr = (n: number) => fmt.money(n);
  const meta = SALES_FORM_META[featureKey];
  const list = SALES_LISTS[featureKey];
  const feature = SALES_FEATURES.find((f) => f.key === featureKey);
  const Icon = (feature?.icon ?? User) as LucideIcon;
  const notes = useMemo(() => configNotesFor(featureKey), [featureKey]);

  const taxMethod = field("taxMethod");
  const priceLabel = PRICE_SOURCES.find((p) => p.value === field("priceSource"))?.label ?? "Rate";
  const discountsOn = flag("allowDiscounts");
  const isB2B = !!meta?.b2b;
  const gstRequired = isB2B ? flag("gstMandatoryB2b") : flag("gstMandatoryB2c");
  const custMandatory = isB2B ? flag("custMasterMandatory") : flag("custRegRequired");

  // ---- screen-wise field config + company GST ----
  const screen = screenKeyFor("sales", featureKey);
  const gstEnabled = companyFlag("gstEnabled");
  const showTax = gstEnabled && fieldOn(screen, "tax");
  const showHsn = gstEnabled && companyFlag("showHsn") && fieldOn(screen, "hsn");
  const allowItemDisc = discountsOn && fieldOn(screen, "itemDiscount");
  const allowTxnDisc = discountsOn && fieldOn(screen, "txnDiscount");
  const showTds = fieldOn(screen, "tds");
  const showTcs = fieldOn(screen, "tcs");
  const showOther = fieldOn(screen, "otherCharges");

  const backHref = `/sales/${featureKey === "dashboard" ? "" : featureKey}`;
  const [cust, setCust] = useState<Record<string, string>>({});
  const [docFields, setDocFields] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [discLevel, setDiscLevel] = useState<"item" | "transaction">("item");
  const [txn, setTxn] = useState<TxnInput>(EMPTY_TXN);
  const [interState, setInterState] = useState(false);
  const [redeemed, setRedeemed] = useState(0); // loyalty points redeemed → bill discount
  const [saved, setSaved] = useState(false);
  const showLoyalty = featureKey === "invoice" && lyFlag("enabled");

  function applyRedeem(amount: number) { setRedeemed(amount); setDiscLevel("transaction"); setTxn((t) => ({ ...t, discType: "val", disc: amount })); }
  function clearRedeem() { setRedeemed(0); setTxn((t) => ({ ...t, disc: 0 })); }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? POS_CATALOG.filter((p) => `${p.code} ${p.name}`.toLowerCase().includes(q)) : POS_CATALOG.slice(0, 6);
  }, [query]);

  function add(p: PosProduct) {
    setLines((ls) => { const i = ls.findIndex((l) => l.product.code === p.code); if (i >= 0) { const c = [...ls]; c[i] = { ...c[i], qty: c[i].qty + 1 }; return c; } return [...ls, { product: p, qty: 1, disc: 0, discType: "pct" }]; });
    setQuery("");
  }
  const upd = (code: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => l.product.code === code ? { ...l, ...patch } : l));
  const setQty = (code: string, d: number) => setLines((ls) => ls.flatMap((l) => l.product.code === code ? (l.qty + d <= 0 ? [] : [{ ...l, qty: l.qty + d }]) : [l]));
  const remove = (code: string) => setLines((ls) => ls.filter((l) => l.product.code !== code));

  const effDiscLevel: "item" | "transaction" = redeemed > 0 ? "transaction" : !allowItemDisc && allowTxnDisc ? "transaction" : !allowTxnDisc ? "item" : discLevel;
  const docLines = lines.map((l) => ({ gross: l.product.price * l.qty, taxPct: showTax ? l.product.tax : 0, disc: l.disc, discType: l.discType }));
  const totals = useMemo(() => computeDoc(docLines, txn, effDiscLevel, taxMethod, interState), [lines, txn, effDiscLevel, taxMethod, showTax, interState]);

  if (!meta || !list) return <div className="p-6 text-sm text-muted">Unknown sales document.</div>;
  const isItems = meta.kind === "items";
  const showLineDisc = allowItemDisc && effDiscLevel === "item";
  // honour per-screen field enable + mandatory
  const visibleFields = meta.fields.filter((f) => !CONFIGURABLE_FIELD_KEYS.includes(f.key) || fieldOn(screen, f.key));
  const isRequired = (f: SFormField) => CONFIGURABLE_FIELD_KEYS.includes(f.key) ? fieldMust(screen, f.key, f.required) : !!f.required;
  const refAmount = Number(docFields.amount || docFields.difference || 0);
  const custOk = (!custMandatory || cust.name) && (!gstRequired || cust.gst) && (!flag("mobileMandatoryB2c") || isB2B || cust.mobile);
  const canSave = isItems ? lines.length > 0 && custOk && visibleFields.filter(isRequired).every((f) => (docFields[f.key] ?? "").trim() !== "") : visibleFields.filter(isRequired).every((f) => (docFields[f.key] ?? "").trim() !== "");

  function save() { if (!canSave) return; setSaved(true); window.setTimeout(() => router.push(backHref), 1200); }

  const renderField = (f: SFormField) => (
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
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/sales" className="hover:text-foreground">Sales</Link><span className="text-subtle">/</span><Link href={backHref} className="hover:text-foreground">{list.title}</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> New {list.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={backHref}><Button variant="ghost" size="md">Cancel</Button></Link>
          <Button variant="outline" size="md" onClick={save} disabled={!canSave}><Save className="h-4 w-4" /> Save Draft</Button>
          <Button size="md" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> {meta.saveLabel}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Driven by Sales Settings:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
        <Link href="/settings/sales" className="ml-auto inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline">Configure <ArrowRight className="h-3 w-3" /></Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><User className="h-4 w-4 text-primary" /> {isB2B ? "Business Customer" : "Customer"}{custMandatory && <span className="text-2xs font-normal text-danger">required</span>}</p>
              {showLoyalty && <LoyaltyRewardsButton billTotal={totals.total + redeemed} redeemedAmount={redeemed} onRedeem={applyRedeem} onClear={clearRedeem} />}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Name{custMandatory && <span className="text-danger"> *</span>}</label><input value={cust.name ?? ""} onChange={(e) => setCust({ ...cust, name: e.target.value })} placeholder="Customer name" className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">Mobile</label><input value={cust.mobile ?? ""} onChange={(e) => setCust({ ...cust, mobile: e.target.value })} placeholder="Mobile" className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">GSTIN{gstRequired && <span className="text-danger"> *</span>}</label><input value={cust.gst ?? ""} onChange={(e) => setCust({ ...cust, gst: e.target.value })} placeholder="GSTIN" className={cn("h-9 w-full rounded-md border bg-surface-2 px-3 text-sm focus:bg-surface focus:outline-none", gstRequired && !cust.gst ? "border-danger/50 focus:border-danger" : "border-border focus:border-primary")} /></div>
            </div>
          </div>

          {isItems ? (
            <>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Items</p>
                  {allowItemDisc && allowTxnDisc && (
                    <div className="flex items-center gap-1.5 text-2xs">
                      <span className="font-medium text-muted">Discount:</span>
                      <div className="inline-flex overflow-hidden rounded-md border border-border">
                        {(["item", "transaction"] as const).map((m) => <button key={m} type="button" onClick={() => setDiscLevel(m)} className={cn("px-2.5 py-1 font-semibold capitalize transition", effDiscLevel === m ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground")}>{m === "item" ? "Item-level" : "Transaction-level"}</button>)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search & add product…" className="h-10 w-full rounded-lg border border-border bg-surface-2 pl-10 pr-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" />
                  {query && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">{results.map((p) => <button key={p.code} onClick={() => add(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-primary-subtle/40"><span className="font-medium text-foreground">{p.name}</span><span className="text-primary">{inr(p.price)}</span></button>)}{results.length === 0 && <p className="px-3 py-2 text-sm text-muted">No product found.</p>}</div>}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="py-2">Item</th>{showHsn && <th className="py-2 text-center">HSN</th>}<th className="py-2 text-center">Qty</th><th className="py-2 text-right">{priceLabel}</th>{showLineDisc && <th className="py-2 text-center">Discount</th>}{showTax && <th className="py-2 text-center">GST</th>}<th className="py-2 text-right">Amount</th><th></th></tr></thead>
                    <tbody>
                      {lines.map((l) => {
                        const gross = l.product.price * l.qty;
                        const d = showLineDisc ? (l.discType === "pct" ? gross * l.disc / 100 : Math.min(l.disc, gross)) : 0;
                        const net = gross - d;
                        const amt = !showTax ? net : taxMethod === "inclusive" ? net : net + net * (l.product.tax / 100);
                        return (
                          <tr key={l.product.code} className="border-b border-border last:border-0">
                            <td className="py-2"><p className="font-medium text-foreground">{l.product.name}</p><p className="text-2xs text-subtle">{l.product.code}</p></td>
                            {showHsn && <td className="py-2 text-center text-2xs text-muted">{l.product.hsn}</td>}
                            <td className="py-2"><div className="flex items-center justify-center gap-1"><button onClick={() => setQty(l.product.code, -1)} className="grid h-6 w-6 place-items-center rounded border border-border text-muted hover:text-primary"><Minus className="h-3 w-3" /></button><span className="w-7 text-center font-semibold">{l.qty}</span><button onClick={() => setQty(l.product.code, 1)} className="grid h-6 w-6 place-items-center rounded border border-border text-muted hover:text-primary"><Plus className="h-3 w-3" /></button></div></td>
                            <td className="py-2 text-right text-muted">{inr(l.product.price)}</td>
                            {showLineDisc && <td className="py-2"><div className="flex items-center justify-center gap-1"><input type="number" value={l.disc || ""} onChange={(e) => upd(l.product.code, { disc: Math.max(0, Number(e.target.value)) })} placeholder="0" className="h-7 w-14 rounded border border-border bg-surface-2 px-1 text-center text-xs focus:border-primary focus:outline-none" /><button type="button" onClick={() => upd(l.product.code, { discType: l.discType === "pct" ? "val" : "pct" })} className="grid h-7 w-7 place-items-center rounded border border-border bg-surface text-2xs font-bold text-muted hover:text-primary">{l.discType === "pct" ? "%" : "₹"}</button></div></td>}
                            {showTax && <td className="py-2 text-center text-2xs text-muted">{l.product.tax}%</td>}
                            <td className="py-2 text-right font-semibold text-foreground">{inr(amt)}</td>
                            <td className="py-2 text-right"><button onClick={() => remove(l.product.code)} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button></td>
                          </tr>
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
              <div><label className="mb-1 block text-2xs font-semibold text-muted">{list.title} No.</label><input readOnly value={sampleBillNumber(isB2B ? "b2b" : "b2c")} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 font-mono text-sm text-primary" /></div>
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
            {!canSave && <p className="mt-2 text-center text-2xs font-medium text-danger">{isItems ? "Add items & required customer details." : "Fill the required fields."}</p>}
          </div>
        </aside>
      </div>

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">{list.title} saved</p>
            <p className="text-2xs text-muted">Redirecting…</p>
          </div>
        </div>
      )}
    </div>
  );
}

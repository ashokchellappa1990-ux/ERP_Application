"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Save, Tag, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import {
  DISCOUNT_TYPES, DISCOUNT_CATEGORIES, DISCOUNT_STATUSES, APPLY_LEVELS,
  CHANNELS, PAYMENT_MODES, GST_TIMINGS, PRIORITY_CHAIN, typeMeta, type DiscountDetail, type AccountRef,
} from "@/lib/contracts/discount";
import { API, inp, post, Grid, F, Sel, Tog, Chips, MultiSelect, type Option } from "@/components/masters/discountUi";
import { cn } from "@/lib/cn";

const EDITOR_TABS = ["Basics", "Eligibility", "Validity", "Combination", "Approval", "GST & Accounting"];
type Form = Record<string, unknown>;
const blank = (): Form => ({ name: "", category: "Standard", discountType: "Percentage", method: "percentage", applyLevel: "bill", value: 0, maxDiscount: 0, minDiscount: 0, priority: 100, status: "Draft", minBill: 0, maxBill: 0, minQty: 0, buyQty: 0, getQty: 0, gstTiming: "after", discountBase: "inclusive", reduceTaxable: true, combinable: false, requiresApproval: false, applicability: { channels: [], paymentModes: [], categories: [], brands: [], products: [], customerIds: [], customerGroups: [], membershipLevels: [] }, eligibility: {}, validity: { days: [] }, combination: { maxDiscounts: 3, canCombineWith: [] }, approval: {} });
const normalize = (d: DiscountDetail): Form => ({ ...d, applicability: d.applicability ?? {}, eligibility: d.eligibility ?? {}, validity: d.validity ?? { days: [] }, combination: d.combination ?? { maxDiscounts: 3, canCombineWith: [] }, approval: d.approval ?? {} });

/** Full-page create / edit screen (standard app layout — replaces the drawer). */
export function DiscountEditorPage({ id }: { id?: string }) {
  const router = useRouter();
  const isNew = !id;
  const [tab, setTab] = useState(0);
  const [f, setF] = useState<Form | null>(isNew ? blank() : null);
  const [accounts, setAccounts] = useState<AccountRef[]>([]);
  const [opts, setOpts] = useState<{ categories: string[]; brands: string[]; products: Option[]; customerGroups: string[]; membershipLevels: string[]; customers: Option[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: unknown) => setF((p) => ({ ...(p as Form), [k]: v }));
  const setNest = (grp: string, k: string, v: unknown) => setF((p) => ({ ...(p as Form), [grp]: { ...(((p as Form)[grp] as Record<string, unknown>) ?? {}), [k]: v } }));
  const g = (grp: string) => ((f?.[grp] as Record<string, unknown>) ?? {});

  useEffect(() => { fetch(`${API}/meta`, { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setAccounts(j.accounts)); }, []);
  useEffect(() => { fetch(`${API}/options`, { cache: "no-store" }).then((r) => r.json()).then((j) => j.ok && setOpts({ categories: j.categories, brands: j.brands, products: j.products, customerGroups: j.customerGroups, membershipLevels: j.membershipLevels, customers: j.customers })); }, []);
  const asOpts = (xs?: string[]): Option[] => (xs ?? []).map((x) => ({ value: x, label: x }));
  useEffect(() => { if (id) fetch(`${API}/detail?id=${id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok && j.discount) setF(normalize(j.discount)); }); }, [id]);

  async function save() {
    setBusy(true); setErr("");
    const j = await post({ action: "save", id: id ?? undefined, ...(f as Form) });
    setBusy(false);
    if (j.ok) router.push("/masters/discount?tab=discounts");
    else setErr(j.message || "Could not save the discount.");
  }
  if (!f) return <div className="py-24"><AppLoader label="Loading discount…" /></div>;

  return (
    <div className="space-y-4 pb-24">
      {/* standard page header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <Link href="/masters/discount?tab=discounts" className="hover:text-primary">Discount Management</Link>
            <span className="text-subtle">/</span><span className="font-medium text-foreground">{isNew ? "New Discount" : "Edit Discount"}</span>
          </div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Tag className="h-5 w-5 text-primary" /> {isNew ? "Create Discount" : String(f.name || "Edit Discount")}</h1>
          <p className="mt-0.5 text-sm text-muted">Define the rule, applicability, eligibility, combination, approval, GST &amp; ledger — resolved centrally at billing.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/masters/discount?tab=discounts"><Button variant="outline"><ChevronLeft className="h-4 w-4" /> Back</Button></Link>
          <Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Discount"}</Button>
        </div>
      </div>

      {err && <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger">{err}</div>}

      {/* tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {EDITOR_TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} className={cn("shrink-0 border-b-2 px-3.5 py-2 text-sm font-semibold transition", tab === i ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>{t}</button>)}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {tab === 0 && (() => {
          const meta = typeMeta(String(f.discountType));
          const chooseType = (v: string) => { const m = typeMeta(v); setF((p) => ({ ...(p as Form), discountType: v, method: m.method, applyLevel: v === "Line Item" ? "line" : (p as Form).applyLevel })); };
          const prodSel = (key: string) => ({ value: (f[key] ? [String(f[key])] : []) as string[], onChange: (v: string[]) => set(key, v[0] ? Number(v[0]) : null) });
          const baseSel = <F label="Discount Base"><select className={inp} value={String(f.discountBase ?? "inclusive")} onChange={(e) => set("discountBase", e.target.value)}><option value="inclusive">On MRP — incl. tax</option><option value="exclusive">On material value — excl. tax</option></select></F>;
          const applySel = <F label="Apply Level"><Sel v={String(f.applyLevel)} opts={[...APPLY_LEVELS]} on={(v) => set("applyLevel", v)} /></F>;
          const numF = (label: string, key: string) => <F label={label}><input type="number" className={inp} value={Number(f[key] ?? 0)} onChange={(e) => set(key, Number(e.target.value))} /></F>;
          return (
            <div className="space-y-6">
              <Section title="General">
                <Grid>
                  <F label="Discount Name *" full><input className={inp} value={String(f.name)} onChange={(e) => set("name", e.target.value)} placeholder="Diwali 10% Off" /></F>
                  <F label="Discount Code"><input className={inp} value={String(f.code ?? "")} onChange={(e) => set("code", e.target.value)} placeholder="Auto-generated if blank" /></F>
                  <F label="Category"><Sel v={String(f.category)} opts={[...DISCOUNT_CATEGORIES]} on={(v) => set("category", v)} /></F>
                  <F label="Status"><Sel v={String(f.status)} opts={[...DISCOUNT_STATUSES]} on={(v) => set("status", v)} /></F>
                  <F label="Priority (lower wins)"><input type="number" className={inp} value={Number(f.priority)} onChange={(e) => set("priority", Number(e.target.value))} /></F>
                  <F label="Start Date"><input type="date" className={inp} value={String(f.startDate ?? "")} onChange={(e) => set("startDate", e.target.value)} /></F>
                  <F label="End Date"><input type="date" className={inp} value={String(f.endDate ?? "")} onChange={(e) => set("endDate", e.target.value)} /></F>
                  <F label="Description" full><textarea className={cn(inp, "h-20 py-2")} value={String(f.description ?? "")} onChange={(e) => set("description", e.target.value)} /></F>
                </Grid>
              </Section>

              <Section title="Type & Value">
                <div className="space-y-4">
                  <F label="Discount Type" full><Sel v={String(f.discountType)} opts={[...DISCOUNT_TYPES]} on={chooseType} /></F>
                  <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-subtle/40 px-3 py-2 text-2xs text-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span>{meta.desc}</span></div>

                  {meta.form === "external" ? (
                    <div className="rounded-lg border border-border bg-surface px-4 py-4 text-sm text-muted">This discount is delivered by its own module — create & manage the offer there. The billing engine validates and applies it automatically at POS. No value setup is needed here.</div>
                  ) : meta.form === "buyget" ? (
                    <Grid>
                      <F label="Buy Product"><MultiSelect single options={opts?.products ?? []} placeholder="Select product" {...prodSel("buyProductId")} /></F>
                      {numF("Buy Quantity (X)", "buyQty")}
                      <F label="Get (Free) Product"><MultiSelect single options={opts?.products ?? []} placeholder="Same as buy product if blank" {...prodSel("getProductId")} /></F>
                      {numF("Get (Free) Quantity (Y)", "getQty")}
                    </Grid>
                  ) : meta.form === "buygetdisc" ? (
                    <Grid>
                      <F label="Buy Product"><MultiSelect single options={opts?.products ?? []} placeholder="Select product" {...prodSel("buyProductId")} /></F>
                      {numF("Buy Quantity (X)", "buyQty")}
                      {baseSel}
                      {numF("Discount %", "value")}
                      {numF("Maximum Discount (₹)", "maxDiscount")}
                    </Grid>
                  ) : meta.form === "fixed" ? (
                    <Grid>{numF("Fixed Selling Price (₹/unit)", "value")}{applySel}</Grid>
                  ) : meta.form === "flat" ? (
                    <Grid>{numF("Discount Amount (₹)", "value")}{applySel}{numF("Maximum Discount (₹)", "maxDiscount")}{numF("Minimum Discount (₹)", "minDiscount")}</Grid>
                  ) : meta.form === "qty" ? (
                    <Grid>{numF("Minimum Quantity", "minQty")}{baseSel}{numF("Discount %", "value")}{numF("Maximum Discount (₹)", "maxDiscount")}</Grid>
                  ) : (String(f.discountType) === "Customer" || String(f.discountType) === "Customer Group") ? (
                    <Grid>
                      <F label="Method">
                        <select className={inp} value={String(f.method)} onChange={(e) => set("method", e.target.value)}>
                          <option value="percentage">Percentage</option>
                          <option value="flat">Flat Amount (whole bill)</option>
                          <option value="per_unit">Amount per Quantity</option>
                        </select>
                      </F>
                      {f.method !== "per_unit" && baseSel}
                      {f.method === "percentage" && applySel}
                      {numF(f.method === "percentage" ? "Discount %" : f.method === "per_unit" ? "Discount Amount per Unit Qty (₹)" : "Discount Amount (₹)", "value")}
                      {numF("Maximum Discount (₹)", "maxDiscount")}
                      {f.method !== "per_unit" && numF("Minimum Discount (₹)", "minDiscount")}
                      {f.method === "per_unit" && <p className="col-span-full text-2xs text-muted">Calculated as this amount × the total quantity billed to the customer — e.g. ₹5/unit × 12 units = ₹60 off.</p>}
                    </Grid>
                  ) : (
                    <Grid>{baseSel}{applySel}{numF("Discount %", "value")}{numF("Maximum Discount (₹)", "maxDiscount")}{numF("Minimum Discount (₹)", "minDiscount")}</Grid>
                  )}
                </div>
              </Section>

              <Section title="Applicability">
                <div className="space-y-4">
                  <Chips label="Sales Channels" opts={[...CHANNELS]} sel={g("applicability").channels as string[]} on={(v) => setNest("applicability", "channels", v)} />
                  <Chips label="Payment Modes" opts={[...PAYMENT_MODES]} sel={g("applicability").paymentModes as string[]} on={(v) => setNest("applicability", "paymentModes", v)} />
                  {!opts ? <div className="py-6"><AppLoader label="Loading masters…" size="sm" /></div> : <Grid>
                    <MultiSelect label="Product Categories" options={asOpts(opts.categories)} value={g("applicability").categories as string[]} onChange={(v) => setNest("applicability", "categories", v)} placeholder="All categories" />
                    <MultiSelect label="Brands" options={asOpts(opts.brands)} value={g("applicability").brands as string[]} onChange={(v) => setNest("applicability", "brands", v)} placeholder="All brands" />
                    <MultiSelect label="Products" options={opts.products} value={g("applicability").products as string[]} onChange={(v) => setNest("applicability", "products", v)} placeholder="All products" />
                    <MultiSelect label="Customers" options={opts.customers} value={g("applicability").customerIds as string[]} onChange={(v) => setNest("applicability", "customerIds", v)} placeholder="All customers" />
                    <MultiSelect label="Customer Groups" options={asOpts(opts.customerGroups)} value={g("applicability").customerGroups as string[]} onChange={(v) => setNest("applicability", "customerGroups", v)} placeholder="All customer groups" />
                    <MultiSelect label="Membership Levels" options={asOpts(opts.membershipLevels)} value={g("applicability").membershipLevels as string[]} onChange={(v) => setNest("applicability", "membershipLevels", v)} placeholder="All levels" />
                  </Grid>}
                  <p className="text-2xs text-muted">Leave a field empty to apply to <b>all</b>. Use <b>Select all</b> to target every option. Categories, brands, products, customers, customer groups &amp; levels are loaded live from your masters.</p>
                </div>
              </Section>
            </div>
          );
        })()}

        {tab === 1 && <Grid>
          <F label="Minimum Bill (₹)"><input type="number" className={inp} value={Number(f.minBill)} onChange={(e) => set("minBill", Number(e.target.value))} /></F>
          <F label="Maximum Bill (₹)"><input type="number" className={inp} value={Number(f.maxBill)} onChange={(e) => set("maxBill", Number(e.target.value))} /></F>
          <F label="Minimum Quantity"><input type="number" className={inp} value={Number(f.minQty)} onChange={(e) => set("minQty", Number(e.target.value))} /></F>
          <F label="Minimum Item Count"><input type="number" className={inp} value={Number(g("eligibility").minItems ?? 0)} onChange={(e) => setNest("eligibility", "minItems", Number(e.target.value))} /></F>
          <F label="Segment / occasion rules" full><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[["membershipRequired", "Members only"], ["firstPurchaseOnly", "First purchase"], ["birthdayOnly", "Birthday"], ["anniversaryOnly", "Anniversary"], ["employeeOnly", "Employees"], ["corporateOnly", "Corporate"]].map(([k, l]) => <Tog key={k} label={l} on={!!g("eligibility")[k]} set={(v) => setNest("eligibility", k, v)} />)}
          </div></F>
        </Grid>}

        {tab === 2 && <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tog label="Weekdays only" on={!!g("validity").weekdaysOnly} set={(v) => setNest("validity", "weekdaysOnly", v)} />
            <Tog label="Weekends only" on={!!g("validity").weekendsOnly} set={(v) => setNest("validity", "weekendsOnly", v)} />
          </div>
          <Chips label="Active Days" opts={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]} sel={g("validity").days as string[]} on={(v) => setNest("validity", "days", v)} />
          <Grid>
            <F label="Start Time (HH:MM)"><input type="time" className={inp} value={String(f.startTime ?? "")} onChange={(e) => set("startTime", e.target.value)} /></F>
            <F label="End Time (HH:MM)"><input type="time" className={inp} value={String(f.endTime ?? "")} onChange={(e) => set("endTime", e.target.value)} /></F>
          </Grid>
        </div>}

        {tab === 3 && <div className="space-y-4">
          <Tog label="Combinable with other discounts" on={!!f.combinable} set={(v) => set("combinable", v)} />
          <Grid><F label="Maximum Discounts on a Bill"><input type="number" className={inp} value={Number(g("combination").maxDiscounts ?? 3)} onChange={(e) => setNest("combination", "maxDiscounts", Number(e.target.value))} /></F></Grid>
          <Chips label="Can Combine With" opts={[...PRIORITY_CHAIN]} sel={g("combination").canCombineWith as string[]} on={(v) => setNest("combination", "canCombineWith", v)} />
          <p className="rounded-lg border border-border bg-surface px-3 py-2 text-2xs text-muted">Priority engine order: {PRIORITY_CHAIN.join(" → ")}. The engine auto-selects the best applicable discount; combinable ones stack up to the limit.</p>
        </div>}

        {tab === 4 && <Grid>
          <F label="Requires approval" full><Tog label="Route through the approval workflow before activation" on={!!f.requiresApproval} set={(v) => set("requiresApproval", v)} /></F>
          <F label="Auto-approve up to % discount"><input type="number" className={inp} value={Number(g("approval").thresholdPct ?? 0)} onChange={(e) => setNest("approval", "thresholdPct", Number(e.target.value))} /></F>
          <F label="Auto-approve up to ₹ amount"><input type="number" className={inp} value={Number(g("approval").thresholdAmt ?? 0)} onChange={(e) => setNest("approval", "thresholdAmt", Number(e.target.value))} /></F>
          <F label="Reason mandatory" full><Tog label="Cashier must enter a reason for manual override" on={!!g("approval").reasonMandatory} set={(v) => setNest("approval", "reasonMandatory", v)} /></F>
        </Grid>}

        {tab === 5 && <Grid>
          <F label="GST Timing"><Sel v={String(f.gstTiming)} opts={[...GST_TIMINGS]} on={(v) => set("gstTiming", v)} /></F>
          <F label="Reduce taxable value"><Tog label="Discount reduces the GST taxable base" on={!!f.reduceTaxable} set={(v) => set("reduceTaxable", v)} /></F>
          <F label="Discount Ledger Account" full><select className={inp} value={String(f.discountAccount ?? "")} onChange={(e) => set("discountAccount", e.target.value)}><option value="">Default (Sales Discount 3060)</option>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></F>
        </Grid>}
      </div>

      {/* sticky footer actions (standard) */}
      <div className="flex items-center justify-end gap-2">
        <Link href="/masters/discount?tab=discounts"><Button variant="outline">Cancel</Button></Link>
        <Button onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Discount"}</Button>
      </div>
    </div>
  );
}

/** Labeled divider grouping a set of fields within the combined "Basics" tab. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 border-b border-border pb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

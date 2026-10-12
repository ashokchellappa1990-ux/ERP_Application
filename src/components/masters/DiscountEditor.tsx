"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Check,
  Sparkles,
  Loader2,
  ArrowUp,
  ArrowDown,
  ScrollText,
} from "lucide-react";
import { useDiscountForm, type RowKey } from "./DiscountFormContext";
import {
  DISCOUNT_TABS,
  GENERAL_FIELDS,
  VALUE_FIELDS,
  COUPON_FIELDS,
  PROMO_FIELDS,
  CUSTOMER_FIELDS,
  BUYGET_FIELDS,
  ACCOUNTING_FIELDS,
  DISCOUNT_TYPES,
  APPLY_ON,
  CHANNELS,
  METHOD_OPTS,
  TIER_OPTS,
  PRIORITY_BEHAVIOR,
  PRIORITY_ORDER,
  ROLE_LIMITS,
  AI_TARGETS,
  AI_MODES,
  type DField,
  type DToggle,
} from "@/lib/masters/discountConfig";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { RadioCard } from "@/components/ui/RadioCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EditorShell } from "./EditorShell";
import { useFmt } from "@/components/settings/GeneralConfigProvider";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------- helpers -- */
function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function SubHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 pb-1 pt-1">
      <span className="h-4 w-1 rounded-full bg-brand-gradient" />
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
function FieldRenderer({ def }: { def: DField }) {
  const { getField, setField, errors } = useDiscountForm();
  const Icon = def.icon;
  const lead = Icon ? <Icon className="h-4 w-4" /> : undefined;
  const common = { label: def.label, info: def.info, sample: def.sample, error: errors[def.name] };
  if (def.type === "textarea") return <Textarea {...common} rows={2} placeholder={def.sample} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
  if (def.type === "select") return <Select {...common} leadingIcon={lead} placeholder="Select…" options={def.options ?? []} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
  return <Input {...common} leadingIcon={lead} type={def.type === "number" ? "number" : "text"} placeholder={def.sample} value={getField(def.name)} onChange={(e) => setField(def.name, e.target.value)} />;
}
function Fields({ defs }: { defs: DField[] }) {
  return <Grid>{defs.map((d) => <div key={d.name} className={d.full ? "sm:col-span-2 lg:col-span-3" : ""}><FieldRenderer def={d} /></div>)}</Grid>;
}
function ToggleGrid({ group, items, cols = 3 }: { group: string; items: DToggle[]; cols?: 2 | 3 }) {
  const { isOn, toggle } = useDiscountForm();
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3")}>
      {items.map((it) => {
        const on = isOn(group, it.id);
        return (
          <label key={it.id} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3.5 transition", on ? "border-primary/40 bg-primary-subtle/40" : "border-border bg-surface hover:bg-surface-2")}>
            <span className="text-sm font-medium text-foreground">{it.label}</span>
            <Switch checked={on} onChange={() => toggle(group, it.id)} aria-label={it.label} />
          </label>
        );
      })}
    </div>
  );
}
function Flag({ id, label, desc }: { id: string; label: string; desc?: string }) {
  const { flag, setFlag } = useDiscountForm();
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3.5">
      <span><span className="block text-sm font-medium text-foreground">{label}</span>{desc && <span className="text-2xs text-muted">{desc}</span>}</span>
      <Switch checked={flag(id)} onChange={(v) => setFlag(id, v)} aria-label={label} />
    </label>
  );
}
function Repeatable({ rowKey, addLabel, empty, defs }: { rowKey: RowKey; addLabel: string; empty: string; defs: DField[] }) {
  const { rowsOf, addRow, updateRow, removeRow } = useDiscountForm();
  const rows = rowsOf(rowKey);
  return (
    <div className="space-y-3">
      {rows.length === 0 && <div className="rounded-lg border border-dashed border-border-strong bg-surface-2 p-6 text-center text-sm text-muted">{empty}</div>}
      {rows.map((r, i) => (
        <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between"><Badge tone="primary">#{i + 1}</Badge><button type="button" onClick={() => removeRow(rowKey, r.id)} className="inline-flex items-center gap-1 text-xs font-medium text-danger hover:underline"><Trash2 className="h-3.5 w-3.5" /> Remove</button></div>
          <Grid>{defs.map((d) => <div key={d.name}><Input label={d.label} type={d.type === "number" ? "number" : "text"} placeholder={d.sample} value={r[d.name] ?? ""} onChange={(e) => updateRow(rowKey, r.id, { [d.name]: e.target.value })} /></div>)}</Grid>
        </div>
      ))}
      <Button variant="outline" size="md" onClick={() => addRow(rowKey)}><Plus className="h-4 w-4" /> {addLabel}</Button>
    </div>
  );
}

/* ============================================================== tabs === */
function GeneralTab() {
  return (
    <div className="space-y-5">
      <Fields defs={GENERAL_FIELDS} />
      <SubHeading>Supported Discount Types</SubHeading>
      <div className="flex flex-wrap gap-1.5">
        {DISCOUNT_TYPES.map((t) => <span key={t} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{t}</span>)}
      </div>
    </div>
  );
}
function ApplicabilityTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Apply On</SubHeading>
      <ToggleGrid group="applyOn" items={APPLY_ON} />
      <SubHeading>Sales Channels</SubHeading>
      <ToggleGrid group="channels" items={CHANNELS} />
    </div>
  );
}
function ValueTab() {
  const { getField, setField } = useDiscountForm();
  return (
    <div className="space-y-5">
      <SubHeading>Discount Method</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        {METHOD_OPTS.map((m) => <RadioCard key={m.value} selected={getField("method") === m.value} onSelect={() => setField("method", m.value)} title={m.label} description={m.value === "Percentage" ? "% off the eligible amount" : "Fixed ₹ amount off"} />)}
      </div>
      <SubHeading>Value Configuration</SubHeading>
      <Fields defs={VALUE_FIELDS} />
    </div>
  );
}
function QuantityTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Quantity-Based Discount</SubHeading>
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">e.g. Buy 5 = 5%, Buy 10 = 10%, Buy 20 = 15%.</p>
      <Repeatable rowKey="qtyTiers" addLabel="Add Quantity Tier" empty="No quantity tiers." defs={[{ name: "qty", label: "Buy Quantity", type: "number", sample: "5" }, { name: "disc", label: "Discount %", type: "number", sample: "5" }]} />
      <SubHeading>Slab-Based Discount</SubHeading>
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">e.g. ₹1000–₹5000 = 5%, ₹5001–₹10000 = 10%, Above ₹10000 = 15%.</p>
      <Repeatable rowKey="slabs" addLabel="Add Slab" empty="No slabs." defs={[{ name: "from", label: "From (₹)", type: "number", sample: "1000" }, { name: "to", label: "To (₹)", type: "number", sample: "5000" }, { name: "disc", label: "Discount %", type: "number", sample: "5" }]} />
    </div>
  );
}
function ComboTab() {
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">e.g. Shampoo + Soap = 10% off · Laptop + Mouse + Keyboard = fixed combo price.</p>
      <Repeatable rowKey="combos" addLabel="Add Combo" empty="No combos defined." defs={[{ name: "products", label: "Products (comma separated)", sample: "Shampoo, Soap", full: true }, { name: "comboPrice", label: "Combo Price (₹) / Discount %", sample: "10%" }]} />
    </div>
  );
}
function BuyGetTab() {
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">e.g. Buy 2 Get 1 Free · Buy 5 Get 2 Free.</p>
      <Fields defs={BUYGET_FIELDS} />
    </div>
  );
}
function CustomerTab() {
  const { getField, setField } = useDiscountForm();
  return (
    <div className="space-y-5">
      <SubHeading>Customer-Specific Discount</SubHeading>
      <Fields defs={CUSTOMER_FIELDS} />
      <SubHeading>Loyalty Tier Discounts (%)</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TIER_OPTS.map((t) => (
          <div key={t.value}>
            <Input label={t.label} type="number" placeholder="%" leadingIcon={<span className="text-2xs font-bold">%</span>} value={getField(`tier_${t.value}`)} onChange={(e) => setField(`tier_${t.value}`, e.target.value)} />
          </div>
        ))}
      </div>
    </div>
  );
}
function CouponTab() {
  return <Fields defs={COUPON_FIELDS} />;
}
function PromotionTab() {
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">Campaigns: Diwali Offer · Pongal Offer · New Year Sale · Independence Day.</p>
      <Fields defs={PROMO_FIELDS} />
    </div>
  );
}
function ExpiryTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Near-Expiry Discount</SubHeading>
      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">e.g. 30 days = 10%, 15 days = 20%, 7 days = 40%.</p>
      <Repeatable rowKey="expiryRules" addLabel="Add Expiry Rule" empty="No expiry rules." defs={[{ name: "days", label: "Days to Expiry", type: "number", sample: "30" }, { name: "disc", label: "Discount %", type: "number", sample: "10" }]} />
      <SubHeading>Dead Stock Discount</SubHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        {[["30", "No sales 30 days"], ["60", "No sales 60 days"], ["90", "No sales 90 days"]].map(([d, label]) => (
          <DeadStock key={d} k={`dead_${d}`} label={label} />
        ))}
      </div>
    </div>
  );
}
function DeadStock({ k, label }: { k: string; label: string }) {
  const { getField, setField } = useDiscountForm();
  return <Input label={label} type="number" placeholder="Discount %" value={getField(k)} onChange={(e) => setField(k, e.target.value)} />;
}
function BranchTab() {
  const { getField, setField } = useDiscountForm();
  return (
    <div className="space-y-5">
      <SubHeading>Maximum Discount by Role (%)</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_LIMITS.map((r) => <Input key={r.role} label={r.role} type="number" placeholder={r.sample} value={getField(`role_${r.role}`)} onChange={(e) => setField(`role_${r.role}`, e.target.value)} />)}
      </div>
      <SubHeading>Branch-Wise Maximum Discount</SubHeading>
      <Repeatable rowKey="branchPolicy" addLabel="Add Branch Policy" empty="No branch policies." defs={[{ name: "branch", label: "Branch", sample: "Whitefield Branch" }, { name: "max", label: "Max Discount Allowed %", type: "number", sample: "25" }]} />
    </div>
  );
}
function ApprovalTab() {
  const { flag, data, setApproval } = useDiscountForm();
  const flow = [{ id: "draft", label: "Draft" }, { id: "pending", label: "Pending Approval" }, { id: "approved", label: "Approved" }, { id: "rejected", label: "Rejected" }] as const;
  return (
    <div className="space-y-5">
      <Flag id="approvalRequired" label="Discount Approval Required" desc="Discounts above threshold need approval" />
      {flag("approvalRequired") && (
        <>
          <SubHeading>Approval Thresholds (max % per level)</SubHeading>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ROLE_LIMITS.map((r) => <ThresholdInput key={r.role} role={r.role} sample={r.sample} />)}
          </div>
        </>
      )}
      <SubHeading>Approval Status</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        {flow.map((s) => (
          <button key={s.id} type="button" onClick={() => setApproval(s.id)} className={cn("flex items-center gap-3 rounded-xl border p-4 text-left transition", data.approvalStatus === s.id ? "border-primary bg-primary-subtle/40 ring-1 ring-primary" : "border-border bg-surface hover:bg-surface-2")}>
            <span className={cn("grid h-8 w-8 place-items-center rounded-full text-2xs font-bold", data.approvalStatus === s.id ? "bg-brand-gradient text-white" : "bg-surface-2 text-muted")}>{data.approvalStatus === s.id ? <Check className="h-4 w-4" /> : ""}</span>
            <span className="text-sm font-semibold text-foreground">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
function ThresholdInput({ role, sample }: { role: string; sample: string }) {
  const { getField, setField } = useDiscountForm();
  return <Input label={role} type="number" placeholder={sample} value={getField(`thr_${role}`)} onChange={(e) => setField(`thr_${role}`, e.target.value)} />;
}
function PriorityTab() {
  const { getField, setField } = useDiscountForm();
  const [order, setOrder] = useState(PRIORITY_ORDER);
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  }
  return (
    <div className="space-y-5">
      <SubHeading>When Multiple Discounts Apply</SubHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        {PRIORITY_BEHAVIOR.map((b) => <RadioCard key={b} selected={getField("behavior") === b} onSelect={() => setField("behavior", b)} title={b} />)}
      </div>
      <SubHeading>Priority Order</SubHeading>
      <div className="space-y-2">
        {order.map((o, i) => (
          <div key={o} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-2xs font-bold text-white">{i + 1}</span>
            <span className="flex-1 text-sm font-medium text-foreground">{o}</span>
            <button onClick={() => move(i, -1)} disabled={i === 0} className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted transition hover:text-primary disabled:opacity-40"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button onClick={() => move(i, 1)} disabled={i === order.length - 1} className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted transition hover:text-primary disabled:opacity-40"><ArrowDown className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
function AiTab() {
  const { getField, setField } = useDiscountForm();
  const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");
  const mode = (getField("aiMode") || "regular") as (typeof AI_MODES)[number]["id"];
  const activeMode = AI_MODES.find((m) => m.id === mode) ?? AI_MODES[0];
  const results = [
    { product: "Surf Excel 1kg (Overstock)", disc: "12%", sales: "+38%", inv: "-420 units", rev: "+₹46k" },
    { product: "Paracetamol Strip (Near Expiry)", disc: "30%", sales: "+62%", inv: "-180 units", rev: "+₹12k" },
    { product: "Winter Jacket (Seasonal)", disc: "25%", sales: "+44%", inv: "-90 units", rev: "+₹78k" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl bg-brand-gradient p-4 text-white"><Sparkles className="h-6 w-6 shrink-0" /><div><p className="text-sm font-bold">AI Discount Engine</p><p className="text-xs text-white/85">Recommends discounts for slow-moving, dead, near-expiry, seasonal & overstocked products.</p></div></div>

      <SubHeading>AI Discount Mode</SubHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        {AI_MODES.map((m) => {
          const on = m.id === mode;
          const Icon = m.icon;
          return (
            <button key={m.id} type="button" onClick={() => { setField("aiMode", m.id); setPhase("idle"); }} className={cn("flex h-full flex-col gap-2 rounded-xl border p-4 text-left transition", on ? "border-primary bg-primary-subtle shadow-sm ring-1 ring-primary/30" : "border-border bg-surface hover:border-primary/40")}>
              <span className="flex items-center gap-2">
                <span className={cn("grid h-8 w-8 place-items-center rounded-lg", on ? "bg-brand-gradient text-white" : "bg-surface-2 text-muted")}><Icon className="h-4 w-4" /></span>
                <span className={cn("text-sm font-semibold", on ? "text-primary" : "text-foreground")}>{m.label}</span>
                {on && <Check className="ml-auto h-4 w-4 text-primary" />}
              </span>
              <span className="text-2xs leading-snug text-muted">{m.desc}</span>
            </button>
          );
        })}
      </div>

      <SubHeading>{activeMode.label} — AI Configuration</SubHeading>
      <Fields defs={activeMode.fields} />

      <SubHeading>Recommend for</SubHeading>
      <ToggleGrid group="aiTargets" items={AI_TARGETS} />
      {phase === "idle" && <Button size="lg" onClick={() => { setPhase("processing"); window.setTimeout(() => setPhase("done"), 1400); }}><Sparkles className="h-4 w-4" /> Generate Recommendations</Button>}
      {phase === "processing" && <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 text-sm font-medium text-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Analyzing inventory & sales velocity…</div>}
      {phase === "done" && (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5 text-center">Suggested</th><th className="px-4 py-2.5 text-center">Sales ↑</th><th className="px-4 py-2.5 text-center">Inventory ↓</th><th className="px-4 py-2.5 text-right">Revenue</th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.product} className="border-b border-border last:border-0 hover:bg-primary-subtle/20">
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.product}</td>
                  <td className="px-4 py-2.5 text-center"><span className="rounded-full bg-primary-subtle px-2 py-0.5 text-xs font-bold text-primary">{r.disc}</span></td>
                  <td className="px-4 py-2.5 text-center font-semibold text-success">{r.sales}</td>
                  <td className="px-4 py-2.5 text-center text-muted">{r.inv}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-success">{r.rev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function AccountingTab() {
  return (
    <div className="space-y-5">
      <SubHeading>Discount Account Mapping</SubHeading>
      <Fields defs={ACCOUNTING_FIELDS} />
      <SubHeading>Margin Impact</SubHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Discount Cost", "₹1.28L"], ["Margin Impact", "-2.4%"], ["Mfg Reimbursed", "₹38k"], ["Net Cost", "₹90k"]].map(([k, v]) => <div key={k} className="rounded-xl border border-border bg-surface p-3"><p className="text-lg font-bold text-foreground">{v}</p><p className="text-2xs text-muted">{k}</p></div>)}
      </div>
    </div>
  );
}
function AuditTab() {
  const log = [
    { user: "arjun.rao", action: "Created discount DISC-1001", at: "2026-06-08 09:10", tone: "success" },
    { user: "divya.n", action: "Modified value 8% → 10%", at: "2026-06-08 10:02", tone: "warning" },
    { user: "arjun.rao", action: "Approved discount", at: "2026-06-08 10:20", tone: "success" },
    { user: "meena.r", action: "Applied coupon DIWALI10 (override)", at: "2026-06-08 11:14", tone: "info" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg bg-primary-subtle/40 p-3 text-xs text-foreground"><ScrollText className="h-4 w-4 text-primary" /> Tracks creation, modification, approval history, coupon usage &amp; overrides.</div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Date &amp; Time</th></tr></thead>
          <tbody>
            {log.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{l.user}</td>
                <td className="px-4 py-2.5"><span className={cn("inline-flex items-center gap-1.5", l.tone === "warning" ? "text-warning" : l.tone === "success" ? "text-success" : "text-muted")}><span className={cn("h-1.5 w-1.5 rounded-full", l.tone === "warning" ? "bg-warning" : l.tone === "success" ? "bg-success" : "bg-info")} />{l.action}</span></td>
                <td className="px-4 py-2.5 text-muted">{l.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TAB_BODIES: Record<string, () => ReactNode> = {
  general: GeneralTab, applicability: ApplicabilityTab, value: ValueTab, quantity: QuantityTab,
  combo: ComboTab, buyget: BuyGetTab, customer: CustomerTab, coupon: CouponTab, promotion: PromotionTab,
  expiry: ExpiryTab, branch: BranchTab, approval: ApprovalTab, priority: PriorityTab, ai: AiTab,
  accounting: AccountingTab, audit: AuditTab,
};

export function DiscountEditor({ discountId }: { discountId?: string }) {
  const router = useRouter();
  const form = useDiscountForm();
  const fmt = useFmt();
  const isEdit = !!discountId;
  const tabs = useMemo(() => DISCOUNT_TABS, []);
  const [activeId, setActiveId] = useState("general");
  const [saved, setSaved] = useState(false);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const Body = TAB_BODIES[tabs[activeIndex].id];
  const statusTone = form.data.approvalStatus === "approved" ? "success" : "warning";

  function save() {
    if (!form.validate()) { setActiveId("general"); return; }
    setSaved(true);
    window.setTimeout(() => router.push("/masters/discount"), 1300);
  }

  return (
    <EditorShell
      parentLabel="Discounts"
      parentHref="/masters/discount"
      cancelHref="/masters/discount"
      title={form.getField("name") || (isEdit ? "Edit Discount" : "New Discount")}
      status={{ label: form.data.approvalStatus, tone: statusTone }}
      tabs={tabs}
      activeId={activeId}
      onTab={setActiveId}
      onAi={() => setActiveId("ai")}
      aiLabel="AI Discount Engine"
      onSaveDraft={() => form.setApproval("pending")}
      onSave={save}
      saveLabel="Save Discount"
      summaryTitle="Discount Summary"
      summaryName={form.getField("name") || "New Discount"}
      summaryCode={form.getField("code") || "—"}
      summaryBadges={[{ label: form.data.approvalStatus, tone: statusTone }, ...(form.getField("type") ? [{ label: form.getField("type"), tone: "primary" as const }] : [])]}
      summaryFields={[
        { label: "Type", value: form.getField("type") },
        { label: "Method", value: form.getField("method") },
        { label: "Value", value: form.getField("value") ? (form.getField("method") === "Percentage" ? `${form.getField("value")}%` : fmt.money(Number(form.getField("value")) || 0)) : "—" },
        { label: "Priority", value: form.getField("priority") },
        { label: "Valid", value: form.getField("start") && form.getField("end") ? `${form.getField("start")} → ${form.getField("end")}` : "—" },
      ]}
      ai={[
        { ok: !!form.getField("value"), text: form.getField("value") ? "Discount value set" : "Set a discount value" },
        { ok: form.isOn("channels", "pos"), text: form.isOn("channels", "pos") ? "Applies at POS" : "Enable a sales channel" },
        { ok: form.flag("approvalRequired"), text: form.flag("approvalRequired") ? "Approval workflow enabled" : "Consider an approval threshold" },
      ]}
      saved={saved}
      savedText={`${form.getField("name") || "Discount"} has been ${isEdit ? "updated" : "saved"}. Redirecting…`}
    >
      {Body && <Body />}
    </EditorShell>
  );
}

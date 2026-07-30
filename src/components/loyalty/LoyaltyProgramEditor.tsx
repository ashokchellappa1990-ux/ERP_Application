"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, ArrowLeft, Loader2, Settings2, Calculator, Coins, CalendarClock, ShoppingCart, Users, History, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { LoyaltyProgramInput } from "@/lib/contracts/loyalty";

type Form = Record<string, unknown>;
const DEFAULTS: Form = {
  name: "", description: "", status: "Draft", priority: 0, effectiveFrom: "", effectiveTo: "", remarks: "",
  eligibility: "all", eligibleGroups: "", applyPos: true, applyB2c: true, applyB2b: false, applyOnline: false,
  calcMethod: "amount", fixedPoints: 10, amountPer: 100, amountPoints: 1, percentageRate: 1, minBillAmount: 0, maxPointsPerInvoice: null, maxDailyPoints: null, maxMonthlyPoints: null, roundOff: "floor",
  redemptionEnabled: true, minRedeemPoints: 100, maxRedeemPoints: null, maxRedeemPercent: 20, maxRedeemAmount: null, allowPartialRedeem: true, pointValuePoints: 1, pointValueAmount: 1,
  validityType: "never", validityDays: null, validityMonths: 12, autoExpiry: false, expiryNotification: false,
};

const TABS = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "calc", label: "Reward Calculation", icon: Calculator },
  { id: "redeem", label: "Redemption Rules", icon: Coins },
  { id: "validity", label: "Point Validity", icon: CalendarClock },
  { id: "sales", label: "Sales Integration", icon: ShoppingCart },
  { id: "eligibility", label: "Customer Eligibility", icon: Users },
  { id: "audit", label: "Audit History", icon: History },
];

export function LoyaltyProgramEditor({ id }: { id?: number }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!id;
  const [tab, setTab] = useState("general");
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [code, setCode] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const j = await fetch(`/api/loyalty/programs/${id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      if (j.ok) { const { id: _i, code: c, createdAt: ca, ...rest } = j.program; setCode(c); setCreatedAt(ca); setForm({ ...DEFAULTS, ...rest }); }
      setLoading(false);
    })();
  }, [id, isEdit]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const v = (k: string) => form[k];
  const numv = (k: string) => (form[k] == null || form[k] === "" ? "" : String(form[k]));

  async function save() {
    if (!String(form.name || "").trim()) { toast.error("Program name is required."); setTab("general"); return; }
    setSaving(true);
    const payload = { ...form } as LoyaltyProgramInput;
    const res = await fetch(isEdit ? `/api/loyalty/programs/${id}` : "/api/loyalty/programs", { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await res.json().catch(() => ({}));
    const ok = toast.result(j, isEdit ? "Program updated." : "Program created.", "Could not save the program.");
    setSaving(false);
    if (ok) router.push("/loyalty/program");
  }

  const inp = "h-9 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none";
  const previewEarn = useMemo(() => {
    const m = String(form.calcMethod);
    if (m === "fixed") return `${Number(form.fixedPoints) || 0} pts / invoice`;
    if (m === "percentage") return `${Number(form.percentageRate) || 0}% of bill → pts`;
    return `${Number(form.amountPoints) || 0} pt per ₹${Number(form.amountPer) || 0}`;
  }, [form.calcMethod, form.fixedPoints, form.percentageRate, form.amountPoints, form.amountPer]);
  const previewRedeem = `${Number(form.pointValuePoints) || 1} pt = ₹${Number(form.pointValueAmount) || 0}`;

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/loyalty/program" className="hover:text-foreground">Loyalty Program</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">{isEdit ? code : "New"}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Award className="h-5 w-5 text-primary" /> {isEdit ? code : "New Loyalty Program"}{isEdit && <Badge tone={String(form.status) === "Active" ? "success" : String(form.status) === "Inactive" ? "neutral" : "warning"}>{String(form.status)}</Badge>}</h1>
          <p className="mt-0.5 text-2xs text-muted">Earn: {previewEarn} · Redeem: {previewRedeem}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/loyalty/program"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button size="md" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {isEdit ? "Save Changes" : "Create Program"}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}><t.icon className="h-4 w-4" /> {t.label}</button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {tab === "general" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fld label="Program Code"><input value={isEdit ? code : "Auto-generated"} disabled className={cn(inp, "cursor-not-allowed opacity-70")} /></Fld>
            <Fld label="Program Name *"><input value={String(v("name") ?? "")} onChange={(e) => set("name", e.target.value)} className={inp} /></Fld>
            <Fld label="Status"><select value={String(v("status"))} onChange={(e) => set("status", e.target.value)} className={inp}><option>Draft</option><option>Active</option><option>Inactive</option></select></Fld>
            <Fld label="Priority"><input type="number" value={numv("priority")} onChange={(e) => set("priority", e.target.value)} className={inp} /></Fld>
            <Fld label="Effective From"><input type="date" value={String(v("effectiveFrom") ?? "")} onChange={(e) => set("effectiveFrom", e.target.value)} className={inp} /></Fld>
            <Fld label="Effective To"><input type="date" value={String(v("effectiveTo") ?? "")} onChange={(e) => set("effectiveTo", e.target.value)} className={inp} /></Fld>
            <Fld label="Description" full><input value={String(v("description") ?? "")} onChange={(e) => set("description", e.target.value)} className={inp} /></Fld>
            <Fld label="Remarks" full><input value={String(v("remarks") ?? "")} onChange={(e) => set("remarks", e.target.value)} className={inp} /></Fld>
          </div>
        )}

        {tab === "calc" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Fld label="Calculation Method"><select value={String(v("calcMethod"))} onChange={(e) => set("calcMethod", e.target.value)} className={inp}><option value="fixed">Fixed (per invoice)</option><option value="amount">Amount based</option><option value="percentage">Percentage based</option></select></Fld>
              <Fld label="Round Off"><select value={String(v("roundOff"))} onChange={(e) => set("roundOff", e.target.value)} className={inp}><option value="floor">Floor (round down)</option><option value="round">Nearest</option><option value="ceil">Ceil (round up)</option></select></Fld>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {v("calcMethod") === "fixed" && <Fld label="Points per Invoice"><input type="number" value={numv("fixedPoints")} onChange={(e) => set("fixedPoints", e.target.value)} className={inp} /></Fld>}
              {v("calcMethod") === "amount" && <><Fld label="Per Amount (₹)"><input type="number" value={numv("amountPer")} onChange={(e) => set("amountPer", e.target.value)} className={inp} /></Fld><Fld label="Award Points"><input type="number" value={numv("amountPoints")} onChange={(e) => set("amountPoints", e.target.value)} className={inp} /></Fld></>}
              {v("calcMethod") === "percentage" && <Fld label="Percentage of Bill (%)"><input type="number" value={numv("percentageRate")} onChange={(e) => set("percentageRate", e.target.value)} className={inp} /></Fld>}
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <Fld label="Minimum Bill Amount"><input type="number" value={numv("minBillAmount")} onChange={(e) => set("minBillAmount", e.target.value)} className={inp} /></Fld>
              <Fld label="Max Points / Invoice"><input type="number" value={numv("maxPointsPerInvoice")} onChange={(e) => set("maxPointsPerInvoice", e.target.value === "" ? null : e.target.value)} placeholder="No limit" className={inp} /></Fld>
              <Fld label="Max Daily Points"><input type="number" value={numv("maxDailyPoints")} onChange={(e) => set("maxDailyPoints", e.target.value === "" ? null : e.target.value)} placeholder="No limit" className={inp} /></Fld>
              <Fld label="Max Monthly Points"><input type="number" value={numv("maxMonthlyPoints")} onChange={(e) => set("maxMonthlyPoints", e.target.value === "" ? null : e.target.value)} placeholder="No limit" className={inp} /></Fld>
            </div>
          </div>
        )}

        {tab === "redeem" && (
          <div className="space-y-4">
            <Toggle label="Enable Reward Redemption" checked={!!v("redemptionEnabled")} onChange={(c) => set("redemptionEnabled", c)} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Fld label="Reward Value — Points"><input type="number" value={numv("pointValuePoints")} onChange={(e) => set("pointValuePoints", e.target.value)} className={inp} /></Fld>
              <Fld label="Reward Value — equals ₹"><input type="number" value={numv("pointValueAmount")} onChange={(e) => set("pointValueAmount", e.target.value)} className={inp} /></Fld>
              <div className="flex items-end pb-1 text-2xs text-muted">e.g. {Number(v("pointValuePoints")) || 1} point(s) = ₹{Number(v("pointValueAmount")) || 0}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <Fld label="Minimum Redemption Points"><input type="number" value={numv("minRedeemPoints")} onChange={(e) => set("minRedeemPoints", e.target.value)} className={inp} /></Fld>
              <Fld label="Maximum Redemption Points"><input type="number" value={numv("maxRedeemPoints")} onChange={(e) => set("maxRedeemPoints", e.target.value === "" ? null : e.target.value)} placeholder="No limit" className={inp} /></Fld>
              <Fld label="Max Redemption %"><input type="number" value={numv("maxRedeemPercent")} onChange={(e) => set("maxRedeemPercent", e.target.value === "" ? null : e.target.value)} placeholder="No limit" className={inp} /></Fld>
              <Fld label="Max Redemption Amount"><input type="number" value={numv("maxRedeemAmount")} onChange={(e) => set("maxRedeemAmount", e.target.value === "" ? null : e.target.value)} placeholder="No limit" className={inp} /></Fld>
            </div>
            <Toggle label="Allow Partial Redemption" checked={!!v("allowPartialRedeem")} onChange={(c) => set("allowPartialRedeem", c)} />
          </div>
        )}

        {tab === "validity" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Fld label="Validity"><select value={String(v("validityType"))} onChange={(e) => set("validityType", e.target.value)} className={inp}><option value="never">Never Expire</option><option value="days">Expire After Days</option><option value="months">Expire After Months</option></select></Fld>
              {v("validityType") === "days" && <Fld label="Expire After (days)"><input type="number" value={numv("validityDays")} onChange={(e) => set("validityDays", e.target.value === "" ? null : e.target.value)} className={inp} /></Fld>}
              {v("validityType") === "months" && <Fld label="Expire After (months)"><input type="number" value={numv("validityMonths")} onChange={(e) => set("validityMonths", e.target.value === "" ? null : e.target.value)} className={inp} /></Fld>}
            </div>
            <Toggle label="Enable Automatic Expiry" checked={!!v("autoExpiry")} onChange={(c) => set("autoExpiry", c)} />
            <Toggle label="Enable Expiry Notification" checked={!!v("expiryNotification")} onChange={(c) => set("expiryNotification", c)} />
            <p className="text-2xs text-muted">Automatic expiry runs as a scheduled job (Phase 2). For now expiry rules are recorded on the program.</p>
          </div>
        )}

        {tab === "sales" && (
          <div className="space-y-3">
            <p className="text-2xs text-muted">Which sales channels this program applies to.</p>
            <Toggle label="POS Sales" checked={!!v("applyPos")} onChange={(c) => set("applyPos", c)} />
            <Toggle label="B2C Sales" checked={!!v("applyB2c")} onChange={(c) => set("applyB2c", c)} />
            <Toggle label="B2B Sales (Future)" checked={!!v("applyB2b")} onChange={(c) => set("applyB2b", c)} />
            <Toggle label="Online Sales (Future)" checked={!!v("applyOnline")} onChange={(c) => set("applyOnline", c)} />
          </div>
        )}

        {tab === "eligibility" && (
          <div className="space-y-4">
            <Fld label="Customer Eligibility"><select value={String(v("eligibility"))} onChange={(e) => set("eligibility", e.target.value)} className={cn(inp, "max-w-xs")}><option value="all">All Customers</option><option value="registered">Registered Customers</option><option value="groups">Customer Groups</option></select></Fld>
            {v("eligibility") === "groups" && <Fld label="Eligible Groups (comma separated)" full><input value={String(v("eligibleGroups") ?? "")} onChange={(e) => set("eligibleGroups", e.target.value)} placeholder="VIP, Gold, Wholesale" className={inp} /></Fld>}
            <p className="text-2xs text-muted">Walk-in (unidentified) customers never earn points — a customer must be selected on the bill.</p>
          </div>
        )}

        {tab === "audit" && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 rounded-lg bg-primary-subtle/40 p-3 text-xs text-foreground"><Info className="h-4 w-4 text-primary" /> Every program create/update is recorded in the global Audit Trail (action <span className="font-mono">loyalty_program.*</span>).</div>
            {isEdit && <p className="text-2xs text-muted">Created: {createdAt ? new Date(createdAt).toLocaleString() : "—"}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Fld({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={cn(full && "sm:col-span-2 lg:col-span-3")}><label className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</label>{children}</div>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary" /> {label}</label>;
}

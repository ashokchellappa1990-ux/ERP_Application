"use client";

import { useEffect, useState } from "react";
import { Settings2, Tag, Plus, Save, Check, Ban, HandCoins, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { DEFAULT_ADVANCE_CONFIG, type AdvanceConfigData, type AdvanceTypeRow } from "@/lib/contracts/advance";

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm focus:border-primary focus:outline-none";
const TOGGLES: [keyof AdvanceConfigData, string, string][] = [
  ["enableCustomerAdvance", "Customer Advance", "Allow advances received from customers."],
  ["enableSupplierAdvance", "Supplier Advance", "Allow advances paid to suppliers."],
  ["enableEmployeeAdvance", "Employee Advance", "Allow advances paid to employees."],
  ["enableSecurityDeposit", "Security Deposit", "Allow security deposit advances."],
  ["enableRefund", "Advance Refund", "Allow refunding unsettled advance balances."],
  ["enablePartialSettlement", "Partial Settlement", "Allow settling part of an advance."],
  ["enableMultipleSettlement", "Multiple Settlement", "Allow several settlements per advance."],
  ["allowWithoutOrder", "Advance Without Order", "Allow advances not tied to an order."],
  ["enableAutoAdjustment", "Auto Adjustment", "Auto-suggest advances during invoicing."],
  ["separateSeriesPerType", "Separate Number Series Per Type", "Use a distinct number series per advance type."],
  ["allowNegativeAdjustment", "Allow Negative Adjustment", "Permit settlements beyond the advance balance."],
  ["requireConfirmationBeforeSettlement", "Confirm Before Settlement", "Require user confirmation before settling."],
];

export function AdvanceConsole() {
  const toast = useToast();
  const [tab, setTab] = useState<"config" | "types">("config");
  const [cfg, setCfg] = useState<AdvanceConfigData | null>(null);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<AdvanceTypeRow[]>([]); const [loadingTypes, setLoadingTypes] = useState(true);
  const [adding, setAdding] = useState(false);
  const [nt, setNt] = useState({ name: "", code: "", direction: "received" as "received" | "paid", accountCode: "2150", partyType: "Customer" });

  useEffect(() => { fetch("/api/finance/advance/config", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setCfg(j.config); }).catch(() => {}); loadTypes(); }, []);
  async function loadTypes() { setLoadingTypes(true); const j = await fetch("/api/finance/advance/types", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})); if (j.ok) setTypes(j.rows); setLoadingTypes(false); }

  async function saveConfig() { if (!cfg) return; setSaving(true); const j = await fetch("/api/finance/advance/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) }).then((r) => r.json()); setSaving(false); toast.result(j, "Configuration saved."); }
  async function addType() { if (!nt.name.trim()) return toast.error("Name is required."); const j = await fetch("/api/finance/advance/types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nt) }).then((r) => r.json()); if (toast.result(j, "Type added.")) { setNt({ name: "", code: "", direction: "received", accountCode: "2150", partyType: "Customer" }); setAdding(false); loadTypes(); } }
  async function patchType(id: number, body: Partial<AdvanceTypeRow>) { const j = await fetch(`/api/finance/advance/types/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()); if (toast.result(j, "Updated.")) loadTypes(); }
  const set = (patch: Partial<AdvanceConfigData>) => setCfg((c) => (c ? { ...c, ...patch } : c));
  const matrix = cfg?.approvalMatrix ?? [];
  const updRule = (i: number, patch: Partial<AdvanceConfigData["approvalMatrix"][number]>) => set({ approvalMatrix: matrix.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><HandCoins className="h-6 w-6" /></span>
          <div><div className="mb-0.5 flex items-center gap-2 text-2xs text-muted"><span>System</span><span className="text-subtle">/</span><span>Accounting</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Advance Management</span></div>
            <h1 className="text-lg font-bold text-foreground">Advance Management Configuration</h1>
            <p className="mt-0.5 text-xs text-muted">Enable advance types, settlement rules, approval threshold & the Advance Type master.</p></div>
        </div>
        <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
          {([["config", "Configuration", Settings2], ["types", "Advance Types", Tag]] as const).map(([id, label, Icon]) => { const active = tab === id; return (
            <button key={id} onClick={() => setTab(id)} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition", active ? "border-primary bg-primary text-white shadow-md" : "border-border bg-card text-foreground hover:border-primary/40")}>
              <span className={cn("grid h-9 w-9 place-items-center rounded-lg", active ? "bg-white/20" : "bg-primary-subtle text-primary")}><Icon className="h-5 w-5" /></span><div className="text-sm font-bold">{label}</div>
            </button>
          ); })}
        </div>
      </div>

      {tab === "config" && (!cfg ? <AppLoader label="Loading…" /> : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-primary-subtle/30 px-5 py-3 text-sm font-semibold text-foreground">Options</div>
            <div className="grid gap-px bg-border sm:grid-cols-2">
              {TOGGLES.map(([k, label, desc]) => (
                <label key={k} className="flex cursor-pointer items-center justify-between gap-3 bg-card px-4 py-3">
                  <span><span className="block text-sm font-medium text-foreground">{label}</span><span className="block text-2xs text-muted">{desc}</span></span>
                  <input type="checkbox" checked={!!cfg[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<AdvanceConfigData>)} className="h-4 w-4 accent-primary" />
                </label>
              ))}
            </div>
            <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fld label="Default Adjustment Mode"><select value={cfg.defaultAdjustmentMode} onChange={(e) => set({ defaultAdjustmentMode: e.target.value as AdvanceConfigData["defaultAdjustmentMode"] })} className={inp}>{["Manual", "Automatic", "FIFO", "Oldest First", "Latest First"].map((m) => <option key={m}>{m}</option>)}</select></Fld>
              <Fld label="Approval Required Above (₹)"><input type="number" value={cfg.approvalRequiredAboveAmount} onChange={(e) => set({ approvalRequiredAboveAmount: Number(e.target.value) })} className={inp} placeholder="0 = no approval" /></Fld>
              <Fld label="Advance Expiry Days"><input type="number" value={cfg.advanceExpiryDays} onChange={(e) => set({ advanceExpiryDays: Number(e.target.value) })} className={inp} /></Fld>
              <Fld label="Settlement Reminder Days"><input type="number" value={cfg.settlementReminderDays} onChange={(e) => set({ settlementReminderDays: Number(e.target.value) })} className={inp} /></Fld>
              <Fld label="Advance Prefix"><input value={cfg.advancePrefix} onChange={(e) => set({ advancePrefix: e.target.value })} className={inp} /></Fld>
              <Fld label="Settlement Prefix"><input value={cfg.settlementPrefix} onChange={(e) => set({ settlementPrefix: e.target.value })} className={inp} /></Fld>
              <Fld label="Refund Prefix"><input value={cfg.refundPrefix} onChange={(e) => set({ refundPrefix: e.target.value })} className={inp} /></Fld>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border bg-primary-subtle/30 px-5 py-3"><span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Approval Matrix</span><Button size="sm" variant="outline" onClick={() => set({ approvalMatrix: [...matrix, { advanceType: "any", minAmount: 0, requiresApproval: true }] })}><Plus className="h-3.5 w-3.5" /> Add Rule</Button></div>
            <div className="p-4">
              <p className="mb-2 text-2xs text-muted">A submitted advance routes to the Approval Queue when a rule matches — the advance&apos;s type (or Any) AND its net amount ≥ Min Amount. The global &quot;Approval Required Above&quot; threshold applies in addition.</p>
              {matrix.length === 0 ? <p className="py-1 text-2xs text-subtle">No rules — only the global threshold applies.</p> : (
                <div className="space-y-2">
                  {matrix.map((r, i) => (
                    <div key={i} className="grid items-center gap-2 sm:grid-cols-[1.4fr_1fr_auto_auto]">
                      <select value={r.advanceType} onChange={(e) => updRule(i, { advanceType: e.target.value })} className={inp}><option value="any">Any type</option>{types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
                      <input type="number" value={r.minAmount} onChange={(e) => updRule(i, { minAmount: Number(e.target.value) })} placeholder="Min amount (₹)" className={inp} />
                      <label className="flex items-center gap-1.5 text-2xs text-muted whitespace-nowrap"><input type="checkbox" checked={r.requiresApproval} onChange={(e) => updRule(i, { requiresApproval: e.target.checked })} className="h-4 w-4 accent-primary" /> Requires approval</label>
                      <button onClick={() => set({ approvalMatrix: matrix.filter((_, j) => j !== i) })} className="justify-self-end text-subtle hover:text-danger"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end"><Button size="md" onClick={saveConfig} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Configuration"}</Button></div>
        </div>
      ))}

      {tab === "types" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-primary-subtle/30 px-5 py-3"><span className="text-sm font-semibold text-foreground">Advance Types</span>{!adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add Type</Button>}</div>
          {adding && (
            <div className="grid gap-2 border-b border-border bg-surface-2/40 p-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
              <input className={inp} placeholder="Name (e.g. Rent Deposit)" value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} />
              <select className={inp} value={nt.direction} onChange={(e) => setNt({ ...nt, direction: e.target.value as "received" | "paid", accountCode: e.target.value === "received" ? "2150" : "1150" })}><option value="received">Received (Liability)</option><option value="paid">Paid (Asset)</option></select>
              <input className={inp} placeholder="GL account code" value={nt.accountCode} onChange={(e) => setNt({ ...nt, accountCode: e.target.value })} />
              <input className={inp} placeholder="Party type" value={nt.partyType} onChange={(e) => setNt({ ...nt, partyType: e.target.value })} />
              <div className="flex items-center gap-1.5"><Button size="sm" onClick={addType}>Save</Button><Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button></div>
            </div>
          )}
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Direction</th><th className="px-4 py-2.5">GL Account</th><th className="px-4 py-2.5">Party</th><th className="px-4 py-2.5 text-center">Used</th><th className="px-4 py-2.5 text-center">Status</th></tr></thead>
            <tbody>
              {loadingTypes ? <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Loading…</td></tr> :
                types.map((t) => <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface-2/40">
                  <td className="px-4 py-2.5"><span className="font-medium text-foreground">{t.name}</span> <span className="font-mono text-2xs text-subtle">{t.code}</span></td>
                  <td className="px-4 py-2.5"><Badge tone={t.direction === "received" ? "info" : "warning"}>{t.direction === "received" ? "Received" : "Paid"}</Badge></td>
                  <td className="px-4 py-2.5 font-mono text-2xs text-muted">{t.accountCode}</td>
                  <td className="px-4 py-2.5 text-muted">{t.partyType}</td>
                  <td className="px-4 py-2.5 text-center text-muted">{t.usage}</td>
                  <td className="px-4 py-2.5 text-center"><button onClick={() => patchType(t.id, { status: t.status === "active" ? "inactive" : "active" })}><Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status}</Badge></button></td>
                </tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>{children}</div>; }

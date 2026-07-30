"use client";

import { useState } from "react";
import Link from "next/link";
import { Monitor, Plus, Pencil, Trash2, CheckCircle2, Printer, X, Settings2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SettingsScopeBanner } from "@/components/scope/SettingsScopeBanner";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import {
  getTerminals, saveTerminal, deleteTerminal, emptyTerminal,
  POS_TERMINAL_GLOBAL, setTerminalGlobal,
  PRINTER_TYPES, PAYMENT_DEFAULTS, BRANCHES,
  type PosTerminal, type PosTerminalGlobal,
} from "@/lib/settings/posTerminalConfig";
import { cn } from "@/lib/cn";

export function PosTerminalSettings() {
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [editing, setEditing] = useState<PosTerminal | null>(null);
  const [global, setGlobal] = useState<PosTerminalGlobal>(() => ({ ...POS_TERMINAL_GLOBAL }));
  const [saved, setSaved] = useState(false);
  const terminals = getTerminals();

  const setG = <K extends keyof PosTerminalGlobal>(k: K, v: PosTerminalGlobal[K]) => setGlobal((g) => ({ ...g, [k]: v }));

  function persist(t: PosTerminal) { saveTerminal(t); setEditing(null); rerender(); }
  function remove(id: string) { deleteTerminal(id); rerender(); }
  function saveGlobal() {
    (Object.keys(global) as (keyof PosTerminalGlobal)[]).forEach((k) => setTerminalGlobal(k, global[k]));
    setSaved(true); window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <SettingsScopeBanner />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">POS Terminal</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Monitor className="h-5 w-5 text-primary" /> POS Terminal</h1>
          <p className="mt-0.5 text-sm text-muted">Register / till setup — define each billing counter and the global POS behaviour.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/sales/pos"><Button variant="outline" size="md"><ShoppingCart className="h-4 w-4" /> Open POS</Button></Link>
          <Button size="md" onClick={() => setEditing(emptyTerminal())}><Plus className="h-4 w-4" /> Add Terminal</Button>
        </div>
      </div>

      {/* stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Terminals" value={terminals.length} />
        <Stat label="Active" value={terminals.filter((t) => t.status === "active").length} tone="success" />
        <Stat label="With Drawer" value={terminals.filter((t) => t.cashDrawer).length} />
        <Stat label="Offline-capable" value={terminals.filter((t) => t.allowOffline).length} />
      </div>

      {/* terminals table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-primary-subtle/30 px-5 py-3 text-sm font-semibold text-foreground"><Monitor className="h-4 w-4 text-primary" /> Registered Terminals</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
              <th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Branch</th><th className="px-4 py-2.5">Printer</th><th className="px-4 py-2.5 text-center">Drawer</th><th className="px-4 py-2.5">IP</th><th className="px-4 py-2.5 text-center">Status</th><th className="px-4 py-2.5 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {terminals.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No terminals yet. Click <span className="font-semibold text-foreground">Add Terminal</span> to register one.</td></tr>
              ) : terminals.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                  <td className="px-4 py-2.5 font-mono font-semibold text-foreground">{t.code}</td>
                  <td className="px-4 py-2.5 text-foreground">{t.name}</td>
                  <td className="px-4 py-2.5 text-muted">{t.branch}</td>
                  <td className="px-4 py-2.5 text-muted"><Printer className="mr-1 inline h-3.5 w-3.5" />{t.printerName || PRINTER_TYPES.find((p) => p.value === t.printerType)?.label}</td>
                  <td className="px-4 py-2.5 text-center">{t.cashDrawer ? <Badge tone="info">Yes</Badge> : <span className="text-subtle">—</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-2xs text-muted">{t.ipAddress || "—"}</td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status}</Badge></td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing({ ...t })} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-primary" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(t.id)} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-danger-subtle hover:text-danger" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* global behaviour */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-primary-subtle/30 px-5 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><Settings2 className="h-4 w-4 text-primary" /> Global POS Behaviour</span>
          <Button size="sm" onClick={saveGlobal}><CheckCircle2 className="h-4 w-4" /> Save</Button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Sel label="Default Branch" value={global.defaultBranch} opts={BRANCHES.map((b) => ({ value: b, label: b }))} onChange={(v) => setG("defaultBranch", v)} />
          <Sel label="Default Printer" value={global.defaultPrinterType} opts={PRINTER_TYPES.filter((p) => p.value !== "dotmatrix")} onChange={(v) => setG("defaultPrinterType", v as PosTerminalGlobal["defaultPrinterType"])} />
          <Num label="Auto-lock after (min idle)" value={global.autoLockMinutes} onChange={(v) => setG("autoLockMinutes", v)} />
        </div>
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          <Flag label="Opening Float Required" desc="Declare opening cash before billing starts." checked={global.openingFloatRequired} onChange={(v) => setG("openingFloatRequired", v)} />
          <Flag label="Blind Close" desc="Count drawer without seeing the expected amount." checked={global.blindClose} onChange={(v) => setG("blindClose", v)} />
          <Flag label="Kick Drawer on Cash Sale" desc="Auto-open the cash drawer on cash payment." checked={global.drawerKickOnSale} onChange={(v) => setG("drawerKickOnSale", v)} />
          <Flag label="Allow Receipt Re-print" desc="Cashier can re-print a completed bill." checked={global.reprintAllowed} onChange={(v) => setG("reprintAllowed", v)} />
          <Flag label="Park / Hold Bills" desc="Hold multiple bills and resume them." checked={global.parkBills} onChange={(v) => setG("parkBills", v)} />
        </div>
      </div>

      <p className="rounded-lg bg-info-subtle p-3 text-xs text-info">The active terminal&apos;s printer, drawer &amp; payment defaults — plus these global rules — drive the <Link href="/sales/pos" className="font-semibold hover:underline">POS Billing</Link> screen.</p>

      {editing && <TerminalModal initial={editing} onClose={() => setEditing(null)} onSave={persist} />}

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">POS settings saved</p><p className="text-2xs text-muted">Applied to the POS terminals.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TerminalModal({ initial, onClose, onSave }: { initial: PosTerminal; onClose: () => void; onSave: (t: PosTerminal) => void }) {
  const [t, setT] = useState<PosTerminal>(initial);
  const set = <K extends keyof PosTerminal>(k: K, v: PosTerminal[K]) => setT((p) => ({ ...p, [k]: v }));
  const canSave = t.code.trim() && t.name.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center gap-2.5 border-b border-border bg-primary-subtle/40 px-5 py-3.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><Monitor className="h-4 w-4" /></span>
          <h3 className="flex-1 text-sm font-bold text-foreground">{initial.id ? "Edit Terminal" : "Add Terminal"}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          <Inp label="Terminal Code" value={t.code} onChange={(v) => set("code", v)} placeholder="TILL-04" required />
          <Inp label="Terminal Name" value={t.name} onChange={(v) => set("name", v)} placeholder="Counter 4" required />
          <Sel label="Branch" value={t.branch} opts={BRANCHES.map((b) => ({ value: b, label: b }))} onChange={(v) => set("branch", v)} />
          <Sel label="Status" value={t.status} opts={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} onChange={(v) => set("status", v as PosTerminal["status"])} />
          <Sel label="Printer Type" value={t.printerType} opts={PRINTER_TYPES} onChange={(v) => set("printerType", v as PosTerminal["printerType"])} />
          <Inp label="Printer Name" value={t.printerName} onChange={(v) => set("printerName", v)} placeholder="EPSON TM-T82" />
          <Sel label="Default Payment" value={t.defaultPayment} opts={PAYMENT_DEFAULTS} onChange={(v) => set("defaultPayment", v)} />
          <Inp label="IP Address" value={t.ipAddress} onChange={(v) => set("ipAddress", v)} placeholder="192.168.1.24" />
          <Flag label="Cash Drawer Attached" desc="Drawer connected to this till." checked={t.cashDrawer} onChange={(v) => set("cashDrawer", v)} />
          <Flag label="Offline Billing" desc="Allow billing when network is down." checked={t.allowOffline} onChange={(v) => set("allowOffline", v)} />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
          <Button size="md" disabled={!canSave} onClick={() => onSave(t)}><CheckCircle2 className="h-4 w-4" /> {initial.id ? "Update" : "Add"} Terminal</Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className={cn("text-2xl font-bold", tone === "success" ? "text-success" : "text-foreground")}>{value}</p>
      <p className="text-2xs font-medium text-muted">{label}</p>
    </div>
  );
}

function Inp({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-2xs font-semibold text-muted">{label}{required && <span className="text-danger"> *</span>}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:bg-surface focus:outline-none" />
    </div>
  );
}

function Sel({ label, value, opts, onChange }: { label: string; value: string; opts: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:bg-surface focus:outline-none">
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Flag({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
      <span><span className="block text-sm font-medium text-foreground">{label}</span><span className="text-2xs text-muted">{desc}</span></span>
      <Switch checked={checked} onChange={onChange} aria-label={label} />
    </label>
  );
}

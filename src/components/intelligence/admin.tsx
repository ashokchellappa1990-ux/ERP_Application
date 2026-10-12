"use client";

import { useCallback, useEffect, useState } from "react";
import { Cpu, Check, Bell, Trash2, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { jget, jsend, SEV_TONE } from "./api";

/** MODEL MANAGER — forecast method/horizon, per-metric overrides, thresholds, toggles. */
interface Config { defaultHorizon: number; defaultMethod: string; methods: Record<string, string>; thresholds: { budgetWarn: number; lowStockAlert: number; receivableDays: number }; enabled: { predictions: boolean; risks: boolean; opportunities: boolean; notifications: boolean } }
const METHODS = ["auto", "linear", "moving", "seasonal"];

export function ModelManager() {
  const toast = useToast();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [metrics, setMetrics] = useState<{ key: string; label: string; module: string }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { jget<{ ok: boolean; config: Config; metrics: { key: string; label: string; module: string }[] }>("/api/ai/decision/config").then((j) => { if (j.ok) { setCfg(j.config); setMetrics(j.metrics); } }); }, []);
  const save = async () => { if (!cfg) return; setBusy(true); const j = await jsend<{ ok: boolean }>("/api/ai/decision/config", "PUT", cfg); setBusy(false); if (j.ok) toast.success("Model configuration saved."); };
  if (!cfg) return <AppLoader label="Loading model configuration…" />;
  const set = (patch: Partial<Config>) => setCfg((c) => c ? { ...c, ...patch } : c);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-bold text-foreground"><Cpu className="h-4 w-4 text-primary" /> Forecast Model</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-2xs font-semibold text-muted">Default method
            <select value={cfg.defaultMethod} onChange={(e) => set({ defaultMethod: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground outline-none">{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          </label>
          <label className="text-2xs font-semibold text-muted">Default horizon (days)
            <select value={cfg.defaultHorizon} onChange={(e) => set({ defaultHorizon: Number(e.target.value) })} className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground outline-none">{[7, 30, 90, 180, 365].map((h) => <option key={h} value={h}>{h}</option>)}</select>
          </label>
        </div>
        <p className="mt-2 text-[10px] text-subtle">Deterministic statistical models — linear trend, moving average or seasonal (12-month) index. This selects the method; it does not train a neural network.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 text-sm font-bold text-foreground">Per-metric method override</div>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {metrics.map((m) => <div key={m.key} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5"><span className="text-2xs text-foreground">{m.label} <span className="text-subtle">· {m.module}</span></span><select value={cfg.methods[m.key] ?? ""} onChange={(e) => set({ methods: { ...cfg.methods, [m.key]: e.target.value } })} className="h-7 rounded border border-border bg-surface px-1 text-[10px] outline-none"><option value="">default</option>{METHODS.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>)}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm font-bold text-foreground">Thresholds</div>
          <Row label="Budget warning %"><input type="number" value={cfg.thresholds.budgetWarn} onChange={(e) => set({ thresholds: { ...cfg.thresholds, budgetWarn: Number(e.target.value) } })} className="h-8 w-20 rounded border border-border bg-surface px-2 text-sm outline-none" /></Row>
          <Row label="Low-stock alert at"><input type="number" value={cfg.thresholds.lowStockAlert} onChange={(e) => set({ thresholds: { ...cfg.thresholds, lowStockAlert: Number(e.target.value) } })} className="h-8 w-20 rounded border border-border bg-surface px-2 text-sm outline-none" /></Row>
          <Row label="Receivable overdue days"><input type="number" value={cfg.thresholds.receivableDays} onChange={(e) => set({ thresholds: { ...cfg.thresholds, receivableDays: Number(e.target.value) } })} className="h-8 w-20 rounded border border-border bg-surface px-2 text-sm outline-none" /></Row>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm font-bold text-foreground">Engine toggles</div>
          {(["predictions", "risks", "opportunities", "notifications"] as const).map((k) => <Toggle key={k} label={k} checked={cfg.enabled[k]} onChange={(v) => set({ enabled: { ...cfg.enabled, [k]: v } })} />)}
        </div>
      </div>
      <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-4 py-2 text-2xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" /> {busy ? "Saving…" : "Save Configuration"}</button>
    </div>
  );
}
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="flex items-center justify-between gap-2 py-1"><span className="text-2xs text-muted">{label}</span>{children}</div>;
const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between py-1"><span className="text-2xs capitalize text-muted">{label}</span><span className={cn("relative h-5 w-9 rounded-full transition", checked ? "bg-primary" : "bg-surface-2")}><span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition", checked ? "left-[1.15rem]" : "left-0.5")} /></span></button>;

/** DECISION SETTINGS — AI connection + platform note. */
export function DecisionSettings() {
  const [ai, setAi] = useState<{ apiKeyPresent: boolean; model: string } | null>(null);
  useEffect(() => { jget<{ ok: boolean; config: unknown }>("/api/ai/decision/config").then(() => {}); jget<{ ok: boolean; ai?: { apiKeyPresent: boolean; model: string } }>("/api/documents/settings").then((j) => { if (j.ok && j.ai) setAi(j.ai); }); }, []);
  return (
    <div className="space-y-4">
      <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-2xs", ai?.apiKeyPresent ? "border-success/30 bg-success/5 text-success" : "border-warning/30 bg-warning/5 text-warning")}>
        <KeyRound className="h-4 w-4" />
        {ai?.apiKeyPresent ? <span>Claude AI connected ({ai.model}) — forecasts, risks and recommendations get richer AI narratives.</span> : <span>No Claude API key — the platform still predicts, scores risk and recommends fully offline (deterministic models); connect a key in Platform → AI for AI-written explanations.</span>}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 text-2xs text-muted shadow-sm">
        <div className="mb-1 text-sm font-bold text-foreground">About Decision Intelligence</div>
        The platform continuously analyses your ERP data to predict outcomes, detect risks, surface opportunities, recommend actions and simulate scenarios — integrated with Finance, Sales, Purchase, Inventory, CRM, Budget and Cost/Profit centres, and with the AI Copilot (ask “predict next month sales” or “what are my risks”). It never posts transactions; recommendations prepare drafts you confirm. Tune the models in the <b className="text-foreground">Model Manager</b>.
      </div>
    </div>
  );
}

/** NOTIFICATION CENTER (Module 16). */
export function NotificationsPanel() {
  const toast = useToast();
  const [rows, setRows] = useState<{ id: number; category: string; severity: string; title: string; message: string; href: string | null; status: string; createdAt: string }[] | null>(null);
  const load = useCallback(() => { jget<{ ok: boolean; notifications: typeof rows }>("/api/ai/decision/notifications").then((j) => { if (j.ok) setRows(j.notifications); }); }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (id: number | "all", status: string) => { const j = await jsend<{ ok: boolean }>("/api/ai/decision/notifications", "POST", { id, status }); if (j.ok) { load(); if (id === "all") toast.success("All marked read."); } };
  if (!rows) return <AppLoader label="Loading notifications…" />;
  return (
    <div className="space-y-2">
      <div className="flex justify-end"><button onClick={() => act("all", "read")} className="text-2xs font-semibold text-primary hover:underline">Mark all read</button></div>
      {rows.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-2xs text-muted">No notifications. Critical risks and health alerts appear here automatically.</p> : rows.map((n) => (
        <div key={n.id} className={cn("flex items-start gap-3 rounded-xl border border-border p-3 shadow-sm", n.status === "unread" ? "bg-primary-subtle/10" : "bg-card")}>
          <Bell className={cn("mt-0.5 h-4 w-4", n.status === "unread" ? "text-primary" : "text-subtle")} />
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-2xs font-bold text-foreground">{n.title}</span><Badge tone={SEV_TONE[n.severity] ?? "neutral"}>{n.severity}</Badge></div><p className="text-[10px] text-muted">{n.message}</p></div>
          <div className="flex shrink-0 gap-1">{n.status === "unread" && <button onClick={() => act(n.id, "read")} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted hover:text-primary">Read</button>}<button onClick={() => act(n.id, "dismissed")} className="rounded border border-border px-1 py-0.5 text-[10px] text-muted hover:text-danger"><Trash2 className="h-3 w-3" /></button></div>
        </div>
      ))}
    </div>
  );
}

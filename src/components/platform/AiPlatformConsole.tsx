"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Save, Boxes, BookText, MessagesSquare, HeartPulse, SlidersHorizontal, Plus, Trash2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

/** Platform (SaaS control-plane) AI configuration — GLOBAL defaults + cross-tenant health.
 *  Rendered inside PlatformPortal; uses the platform's light slate/indigo styling. */

const inp = "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-slate-500";
const btn = "inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50";
const btnO = "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-2xs font-semibold text-slate-700 transition hover:border-indigo-400";
const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const api = (s: string) => `/api/platform/ai/${s}`;
async function post(action: string, body: Record<string, unknown> = {}) { return fetch(api("action"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) }).then((r) => r.json()).catch(() => ({ ok: false, message: "Network error." })); }

const TABS = [
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
  { id: "modules", label: "Module Registry", icon: Boxes },
  { id: "semantic", label: "Semantic Dictionary", icon: BookText },
  { id: "prompts", label: "Prompt Library", icon: MessagesSquare },
  { id: "health", label: "Health & Usage", icon: HeartPulse },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function AiPlatformConsole({ flash }: { flash: (m: string) => void }) {
  const [tab, setTab] = useState<Tab>("settings");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-white"><Sparkles className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-bold text-slate-900">AI Platform</h2><p className="text-2xs text-slate-500">Global AI Foundation configuration — applies to every tenant unless overridden.</p></div>
      </div>
      <div className="inline-flex flex-wrap overflow-hidden rounded-xl border border-slate-200 bg-white">
        {TABS.map((t) => { const Icon = t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition", tab === t.id ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100")}><Icon className="h-3.5 w-3.5" /> {t.label}</button>; })}
      </div>
      {tab === "settings" && <SettingsTab flash={flash} />}
      {tab === "modules" && <ModulesTab flash={flash} />}
      {tab === "semantic" && <SemanticTab flash={flash} />}
      {tab === "prompts" && <PromptsTab flash={flash} />}
      {tab === "health" && <HealthTab />}
    </div>
  );
}

/* ------------------------------------------------------------------- Settings */
function SettingsTab({ flash }: { flash: (m: string) => void }) {
  const [s, setS] = useState<Record<string, unknown> | null>(null);
  const [keyPresent, setKeyPresent] = useState(false);
  const [source, setSource] = useState<"env" | "stored" | "none">("none");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const load = useCallback(() => { fetch(api("settings"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) { setS(j.settings); setKeyPresent(j.apiKeyPresent); setSource(j.apiKeySource ?? "none"); } }); }, []);
  useEffect(() => { load(); }, [load]);
  if (!s) return <div className={cn(card, "p-6 text-sm text-slate-500")}>Loading…</div>;
  const set = (k: string, v: unknown) => setS({ ...s, [k]: v });
  async function save() { setBusy(true); const j = await post("saveSettings", s!); setBusy(false); flash(j.message || (j.ok ? "Saved." : "Failed.")); }
  async function saveKey(clear = false) { setKeyBusy(true); const j = await post("saveApiKey", { apiKey: clear ? "" : apiKey }); setKeyBusy(false); flash(j.message || ""); if (j.ok) { setApiKey(""); load(); } }
  async function testConn() { setKeyBusy(true); const j = await post("testConnection"); setKeyBusy(false); flash(j.message || ""); }

  return (
    <div className="space-y-4">
      <div className={cn(card, "flex items-center gap-3 p-4")}>
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl", keyPresent ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600")}>{keyPresent ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</span>
        <div className="flex-1"><div className="text-sm font-bold text-slate-900">{keyPresent ? (source === "env" ? "Claude connected (environment variable)" : "Claude connected (key saved here)") : "No Claude API key — running in fallback mode"}</div><div className="text-2xs text-slate-500">{keyPresent ? "Live conversational answers are enabled. Data questions (sales, cash, GST…) already work even without a key." : "Enter a key below, or set the ANTHROPIC_API_KEY environment variable. Common data questions already return real numbers without a key."}</div></div>
        <button className={btnO} onClick={async () => { const j = await post("reseed"); flash(j.message || "Re-seeded."); }}><RefreshCw className="h-3.5 w-3.5" /> Re-seed registry</button>
      </div>

      {/* Anthropic API key — connect Claude from the UI */}
      <div className={cn(card, "p-5")}>
        <div className="mb-1 text-sm font-bold text-slate-900">Anthropic API Key</div>
        {source === "env" ? (
          <p className="text-2xs text-slate-500">A key is set via the <code>ANTHROPIC_API_KEY</code> environment variable, which takes precedence and can&apos;t be overridden here.</p>
        ) : (
          <>
            <p className="mb-2 text-2xs text-slate-500">Paste your key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">console.anthropic.com</a> (starts with <code>sk-ant-</code>). Stored server-side and never shown again; env var is more secure for production.</p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={source === "stored" ? "•••••••• (a key is saved — enter a new one to replace)" : "sk-ant-…"} className={cn(inp, "max-w-md flex-1")} autoComplete="off" />
              <button className={btn} onClick={() => saveKey(false)} disabled={keyBusy || !apiKey.trim()}><Save className="h-4 w-4" /> {keyBusy ? "…" : "Save & Connect"}</button>
              {keyPresent && <button className={btnO} onClick={testConn} disabled={keyBusy}>Test Connection</button>}
              {source === "stored" && <button className={btnO} onClick={() => saveKey(true)} disabled={keyBusy}>Remove Key</button>}
            </div>
          </>
        )}
      </div>
      <div className={cn(card, "p-5")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={!!s.enabled} onChange={(e) => set("enabled", e.target.checked)} className="h-4 w-4 accent-indigo-600" /> AI Copilot enabled</label>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={!!s.streaming} onChange={(e) => set("streaming", e.target.checked)} className="h-4 w-4 accent-indigo-600" /> Streaming responses</label>
          <div />
          <div><label className={lbl}>Model</label><select value={String(s.model)} onChange={(e) => set("model", e.target.value)} className={inp}>{["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"].map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
          <div><label className={lbl}>Max Tokens</label><input type="number" value={Number(s.maxTokens)} onChange={(e) => set("maxTokens", e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Temperature (0–1)</label><input type="number" step="0.05" value={Number(s.temperature)} onChange={(e) => set("temperature", e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Timeout (ms)</label><input type="number" value={Number(s.timeoutMs)} onChange={(e) => set("timeoutMs", e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Max Retries</label><input type="number" value={Number(s.maxRetries)} onChange={(e) => set("maxRetries", e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Conversation Retention (days)</label><input type="number" value={Number(s.retentionDays ?? 0)} onChange={(e) => set("retentionDays", e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Daily Token Limit (optional)</label><input type="number" value={Number(s.dailyTokenLimit ?? 0)} onChange={(e) => set("dailyTokenLimit", e.target.value)} className={inp} /></div>
        </div>
        <div className="mt-3"><label className={lbl}>System Prompt Override (optional)</label><textarea value={String(s.systemPrompt ?? "")} onChange={(e) => set("systemPrompt", e.target.value)} rows={3} className={cn(inp, "h-auto py-2")} placeholder="Leave blank to use the built-in OASYS Orbit copilot system prompt." /></div>
        <div className="mt-4 flex justify-end"><button className={btn} onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Settings"}</button></div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- Modules */
interface Mod { id: number; moduleKey: string; name: string; description: string | null; menu: string | null; enabled: boolean; businessTerms: string[]; kpis: string[]; questions: string[]; permissions: string[] }
function ModulesTab({ flash }: { flash: (m: string) => void }) {
  const [mods, setMods] = useState<Mod[] | null>(null);
  const load = useCallback(() => { fetch(api("modules"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setMods(j.modules); }); }, []);
  useEffect(() => { load(); }, [load]);
  async function toggle(m: Mod) { const j = await post("toggleModule", { moduleKey: m.moduleKey, enabled: !m.enabled }); flash(j.message || ""); load(); }
  if (!mods) return <div className={cn(card, "p-6 text-sm text-slate-500")}>Loading…</div>;
  return (
    <div className={cn(card, "overflow-hidden")}>
      <div className="border-b border-slate-200 px-4 py-2.5 text-2xs text-slate-500">A module is AI-enabled by registering here. Future modules only add a row — no AI code changes.</div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs uppercase text-slate-500"><th className="px-4 py-2">Module</th><th className="px-4 py-2">Menu</th><th className="px-4 py-2">KPIs</th><th className="px-4 py-2">Terms</th><th className="px-4 py-2 text-center">Enabled</th></tr></thead>
        <tbody>{mods.map((m) => (
          <tr key={m.id} className="border-b border-slate-100 last:border-0">
            <td className="px-4 py-2"><div className="font-semibold text-slate-900">{m.name}</div><div className="text-2xs text-slate-400">{m.moduleKey} · {m.description}</div></td>
            <td className="px-4 py-2 text-2xs text-slate-500">{m.menu ?? "—"}</td>
            <td className="px-4 py-2 text-2xs text-slate-500">{m.kpis.length}</td>
            <td className="px-4 py-2 text-2xs text-slate-500">{m.businessTerms.length}</td>
            <td className="px-4 py-2 text-center"><button onClick={() => toggle(m)} className={cn("inline-flex h-6 w-11 items-center rounded-full px-0.5 transition", m.enabled ? "bg-emerald-500 justify-end" : "bg-slate-300 justify-start")}><span className="h-5 w-5 rounded-full bg-white shadow" /></button></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

/* ------------------------------------------------------------------ Semantic */
interface Term { id: number; term: string; entity: string; kpi: string | null; moduleKey: string | null; definition: string | null; synonyms: string[] }
function SemanticTab({ flash }: { flash: (m: string) => void }) {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [editing, setEditing] = useState<Partial<Term> | null>(null);
  const load = useCallback(() => { fetch(api("semantic"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setTerms(j.terms); }); }, []);
  useEffect(() => { load(); }, [load]);
  async function save() { const e = editing!; const j = await post("upsertTerm", { id: e.id, term: e.term, entity: e.entity, kpi: e.kpi, moduleKey: e.moduleKey, definition: e.definition, synonyms: (e.synonyms ?? []).join(",") }); flash(j.message || ""); setEditing(null); load(); }
  async function del(id: number) { if (!window.confirm("Delete term?")) return; const j = await post("deleteTerm", { id }); flash(j.message || ""); load(); }
  if (!terms) return <div className={cn(card, "p-6 text-sm text-slate-500")}>Loading…</div>;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button className={btn} onClick={() => setEditing({ synonyms: [] })}><Plus className="h-4 w-4" /> Add Term</button></div>
      <div className={cn(card, "overflow-x-auto")}><table className="w-full text-sm">
        <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-2xs uppercase text-slate-500"><th className="px-4 py-2">Business Term</th><th className="px-4 py-2">Entity / KPI</th><th className="px-4 py-2">Module</th><th className="px-4 py-2">Synonyms</th><th className="px-4 py-2" /></tr></thead>
        <tbody>{terms.map((t) => (
          <tr key={t.id} className="border-b border-slate-100 last:border-0">
            <td className="px-4 py-2 font-semibold text-slate-900">{t.term}</td>
            <td className="px-4 py-2 text-2xs text-slate-600">{t.entity}{t.kpi ? ` · ${t.kpi}` : ""}</td>
            <td className="px-4 py-2 text-2xs text-slate-500">{t.moduleKey ?? "—"}</td>
            <td className="px-4 py-2 text-2xs text-slate-400">{t.synonyms.join(", ")}</td>
            <td className="px-4 py-2"><div className="flex justify-end gap-1"><button onClick={() => setEditing(t)} className={btnO}>Edit</button><button onClick={() => del(t.id)} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
          </tr>
        ))}</tbody>
      </table></div>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className={cn(card, "w-full max-w-md p-5")} onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-bold text-slate-900">{editing.id ? "Edit" : "Add"} Term</h3>
            <div className="grid gap-2.5">
              <div><label className={lbl}>Term</label><input value={editing.term ?? ""} onChange={(e) => setEditing({ ...editing, term: e.target.value })} className={inp} /></div>
              <div className="grid grid-cols-2 gap-2"><div><label className={lbl}>Entity</label><input value={editing.entity ?? ""} onChange={(e) => setEditing({ ...editing, entity: e.target.value })} className={inp} placeholder="Sales.today" /></div><div><label className={lbl}>KPI</label><input value={editing.kpi ?? ""} onChange={(e) => setEditing({ ...editing, kpi: e.target.value })} className={inp} /></div></div>
              <div><label className={lbl}>Module Key</label><input value={editing.moduleKey ?? ""} onChange={(e) => setEditing({ ...editing, moduleKey: e.target.value })} className={inp} placeholder="sales" /></div>
              <div><label className={lbl}>Definition</label><input value={editing.definition ?? ""} onChange={(e) => setEditing({ ...editing, definition: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Synonyms (comma-separated)</label><input value={(editing.synonyms ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, synonyms: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} className={inp} /></div>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button className={btnO} onClick={() => setEditing(null)}>Cancel</button><button className={btn} onClick={save} disabled={!editing.term || !editing.entity}><Save className="h-4 w-4" /> Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- Prompts */
interface SysPrompt { id: number; category: string; title: string; promptText: string; description: string | null; usageCount: number }
function PromptsTab({ flash }: { flash: (m: string) => void }) {
  const [prompts, setPrompts] = useState<SysPrompt[] | null>(null);
  const [editing, setEditing] = useState<Partial<SysPrompt> | null>(null);
  const load = useCallback(() => { fetch(api("prompts"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setPrompts(j.prompts); }); }, []);
  useEffect(() => { load(); }, [load]);
  async function save() { const e = editing!; const j = await post("upsertPrompt", { id: e.id, category: e.category ?? "General", title: e.title, promptText: e.promptText, description: e.description }); flash(j.message || ""); setEditing(null); load(); }
  async function del(id: number) { if (!window.confirm("Delete prompt?")) return; const j = await post("deletePrompt", { id }); flash(j.message || ""); load(); }
  if (!prompts) return <div className={cn(card, "p-6 text-sm text-slate-500")}>Loading…</div>;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button className={btn} onClick={() => setEditing({ category: "General" })}><Plus className="h-4 w-4" /> Add System Prompt</button></div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{prompts.map((p) => (
        <div key={p.id} className={cn(card, "flex flex-col p-3.5")}>
          <div className="mb-1 flex items-center justify-between"><span className="rounded-full bg-indigo-50 px-2 py-0.5 text-2xs font-semibold text-indigo-600">{p.category}</span><span className="text-2xs text-slate-400">{p.usageCount} uses</span></div>
          <div className="text-sm font-bold text-slate-900">{p.title}</div>
          <div className="mt-0.5 line-clamp-2 flex-1 text-2xs text-slate-500">{p.promptText}</div>
          <div className="mt-2 flex justify-end gap-1"><button onClick={() => setEditing(p)} className={btnO}>Edit</button><button onClick={() => del(p.id)} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></div>
        </div>
      ))}</div>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className={cn(card, "w-full max-w-md p-5")} onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-bold text-slate-900">{editing.id ? "Edit" : "Add"} System Prompt</h3>
            <div className="grid gap-2.5">
              <div className="grid grid-cols-2 gap-2"><div><label className={lbl}>Category</label><select value={editing.category ?? "General"} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className={inp}>{["Finance", "Sales", "Purchase", "Inventory", "CRM", "HR", "Dashboard", "Budget", "General"].map((c) => <option key={c}>{c}</option>)}</select></div><div><label className={lbl}>Title</label><input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inp} /></div></div>
              <div><label className={lbl}>Prompt Text</label><textarea value={editing.promptText ?? ""} onChange={(e) => setEditing({ ...editing, promptText: e.target.value })} rows={3} className={cn(inp, "h-auto py-2")} /></div>
              <div><label className={lbl}>Description</label><input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inp} /></div>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button className={btnO} onClick={() => setEditing(null)}>Cancel</button><button className={btn} onClick={save} disabled={!editing.title || !editing.promptText}><Save className="h-4 w-4" /> Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- Health */
function HealthTab() {
  const [h, setH] = useState<Record<string, unknown> | null>(null);
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { fetch(api("health"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setH(j.health); }); fetch(api("dashboard"), { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setD(j.dashboard); }); }, []);
  if (!h || !d) return <div className={cn(card, "p-6 text-sm text-slate-500")}>Loading…</div>;
  const g = h as { apiKeyConfigured: boolean; claudeApi: string; avgLatencyMs: number; maxLatencyMs: number; apiErrors24h: number; retryCount24h: number; fallback24h: number; successRate: number; recentErrors: { message: string; at: string }[] };
  const gd = d as { totalConversations: number; todaysConversations: number; totalTokens: number; byTenant: { tenantId: number; conversations: number }[] };
  const tiles = [
    { k: "Claude API", v: g.claudeApi }, { k: "Success Rate", v: `${g.successRate}%` }, { k: "Avg Latency", v: `${g.avgLatencyMs}ms` }, { k: "Max Latency", v: `${g.maxLatencyMs}ms` },
    { k: "Errors (24h)", v: g.apiErrors24h }, { k: "Retries (24h)", v: g.retryCount24h }, { k: "Fallbacks (24h)", v: g.fallback24h }, { k: "Total Conversations", v: gd.totalConversations },
    { k: "Today's Conversations", v: gd.todaysConversations }, { k: "Total Tokens", v: gd.totalTokens.toLocaleString() },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{tiles.map((t) => <div key={t.k} className={cn(card, "p-3.5")}><div className="text-2xs font-semibold uppercase text-slate-500">{t.k}</div><div className="mt-1 text-lg font-bold text-slate-900">{t.v}</div></div>)}</div>
      {g.recentErrors.length > 0 && <div className={cn(card, "p-4")}><h3 className="mb-2 text-sm font-bold text-slate-900">Recent Errors (24h)</h3><div className="space-y-1">{g.recentErrors.map((e, i) => <div key={i} className="flex justify-between gap-2 border-b border-slate-100 py-1 text-2xs last:border-0"><span className="min-w-0 truncate text-rose-600">{e.message}</span><span className="shrink-0 text-slate-400">{new Date(e.at).toLocaleString()}</span></div>)}</div></div>}
    </div>
  );
}

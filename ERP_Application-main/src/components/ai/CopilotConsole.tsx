"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, MessageSquarePlus, Search, Pin, PinOff, Pencil, Trash2, MessagesSquare, BookMarked, BarChart3, HeartPulse, Star, Plus, Zap, Bot, Activity, CheckCircle2, AlertCircle, Clock, Cpu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { AiChat } from "./AiChat";

const TABS = [
  { id: "chat", label: "Chat", icon: MessagesSquare },
  { id: "prompts", label: "Prompt Library", icon: BookMarked },
  { id: "dashboard", label: "AI Dashboard", icon: BarChart3 },
  { id: "health", label: "Health", icon: HeartPulse },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface Conv { id: number; title: string; category: string | null; pinned: boolean; messageCount: number; lastMessageAt: string }

export function CopilotConsole() {
  const toast = useToast();
  const [tab, setTab] = useState<TabId>("chat");
  const [convId, setConvId] = useState<number | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [q, setQ] = useState("");
  const [autoSend, setAutoSend] = useState<string | undefined>();
  const [chatKey, setChatKey] = useState(0);

  const loadConvs = useCallback(async () => {
    const j = await fetch(`/api/ai/history${q ? `?q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) setConvs(j.conversations);
  }, [q]);
  useEffect(() => { const t = setTimeout(loadConvs, 200); return () => clearTimeout(t); }, [loadConvs]);

  function newChat() { setConvId(null); setAutoSend(undefined); setChatKey((k) => k + 1); setTab("chat"); }
  function usePrompt(text: string) { setConvId(null); setAutoSend(text); setChatKey((k) => k + 1); setTab("chat"); }

  async function act(body: Record<string, unknown>) {
    const j = await fetch("/api/ai/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    if (j.ok) { loadConvs(); if (body.action === "delete" && convId === body.id) newChat(); } else toast.show(j.message || "Failed.", { type: "error" });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><Sparkles className="h-5 w-5" /></span> AI Copilot</h1>
          <p className="mt-0.5 text-sm text-muted">Your enterprise financial &amp; operations assistant — scoped to your role and permissions.</p>
        </div>
        <div className="inline-flex overflow-hidden rounded-xl border border-border">
          {TABS.map((t) => { const Icon = t.icon; return <button key={t.id} onClick={() => setTab(t.id)} className={cn("inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition", tab === t.id ? "bg-primary text-white" : "bg-surface text-muted hover:bg-surface-2")}><Icon className="h-3.5 w-3.5" /> {t.label}</button>; })}
        </div>
      </div>

      {tab === "chat" && (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          {/* History sidebar */}
          <div className="flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="space-y-2 border-b border-border p-2.5">
              <Button size="sm" className="w-full" onClick={newChat}><MessageSquarePlus className="h-4 w-4" /> New Chat</Button>
              <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats…" className="h-8 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-xs focus:border-primary focus:outline-none" /></div>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {convs.length === 0 && <p className="py-6 text-center text-2xs text-muted">No conversations yet.</p>}
              {convs.map((c) => (
                <div key={c.id} className={cn("group flex items-center gap-1 rounded-lg border px-2 py-1.5 text-left transition", convId === c.id ? "border-primary bg-primary-subtle/30" : "border-transparent hover:bg-surface-2")}>
                  <button onClick={() => { setConvId(c.id); setAutoSend(undefined); }} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1"><span className="truncate text-xs font-medium text-foreground">{c.title}</span></div>
                    <div className="flex items-center gap-1.5 text-[10px] text-subtle">{c.category && <Badge tone="neutral">{c.category}</Badge>}<span>{c.messageCount} msgs</span></div>
                  </button>
                  <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
                    <button title={c.pinned ? "Unpin" : "Pin"} onClick={() => act({ action: "pin", id: c.id, pinned: !c.pinned })} className="grid h-6 w-6 place-items-center rounded text-subtle hover:text-primary">{c.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}</button>
                    <button title="Rename" onClick={() => { const t = window.prompt("Rename chat:", c.title); if (t) act({ action: "rename", id: c.id, title: t }); }} className="grid h-6 w-6 place-items-center rounded text-subtle hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                    <button title="Delete" onClick={() => { if (window.confirm("Delete this chat?")) act({ action: "delete", id: c.id }); }} className="grid h-6 w-6 place-items-center rounded text-subtle hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {c.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                </div>
              ))}
            </div>
          </div>
          {/* Chat */}
          <div className="h-[70vh] overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <AiChat key={chatKey} conversationId={convId} autoSend={autoSend} onConversationChange={(id) => { setConvId(id); loadConvs(); }} />
          </div>
        </div>
      )}

      {tab === "prompts" && <PromptsTab onUse={usePrompt} />}
      {tab === "dashboard" && <DashboardTab />}
      {tab === "health" && <HealthTab />}
    </div>
  );
}

/* ------------------------------------------------------------ Prompt Library */
interface Prompt { id: number; category: string; title: string; promptText: string; description: string | null; isSystem: boolean; mine: boolean; favourite: boolean; usageCount: number; createdByName: string | null }
function PromptsTab({ onUse }: { onUse: (t: string) => void }) {
  const toast = useToast();
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [cats, setCats] = useState<{ key: string; name: string }[]>([]);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const j = await fetch(`/api/ai/prompts?${cat ? `category=${cat}&` : ""}${q ? `q=${encodeURIComponent(q)}&` : ""}${favOnly ? "fav=1" : ""}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) { setPrompts(j.prompts); setCats(j.categories); }
  }, [cat, q, favOnly]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function fav(id: number) { await fetch("/api/ai/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "favourite", promptId: id }) }); load(); }
  async function del(id: number) { if (!window.confirm("Delete this prompt?")) return; const j = await fetch("/api/ai/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deletePrompt", id }) }).then((r) => r.json()); if (j.ok) { toast.show("Deleted.", { type: "success" }); load(); } }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts…" className="h-9 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-sm focus:border-primary focus:outline-none" /></div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 rounded-lg border border-border-strong bg-surface px-2.5 text-sm focus:border-primary focus:outline-none"><option value="">All categories</option>{cats.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select>
        <button onClick={() => setFavOnly((v) => !v)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold", favOnly ? "border-warning/40 bg-warning-subtle text-warning" : "border-border text-muted")}><Star className={cn("h-3.5 w-3.5", favOnly && "fill-current")} /> Favourites</button>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Prompt</Button>
      </div>
      {!prompts ? <div className="rounded-2xl border border-border bg-card p-8 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {prompts.map((p) => (
            <div key={p.id} className="flex flex-col rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
              <div className="mb-1 flex items-center justify-between gap-2"><Badge tone="info">{p.category}</Badge><button onClick={() => fav(p.id)} className={cn("grid h-6 w-6 place-items-center rounded", p.favourite ? "text-warning" : "text-subtle hover:text-warning")}><Star className={cn("h-4 w-4", p.favourite && "fill-current")} /></button></div>
              <p className="text-sm font-bold text-foreground">{p.title}</p>
              <p className="mt-0.5 line-clamp-2 flex-1 text-2xs text-muted">{p.promptText}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-subtle">{p.isSystem ? "System" : p.mine ? "You" : p.createdByName ?? "Shared"} · {p.usageCount} uses</span>
                <div className="flex items-center gap-1">{p.mine && <button onClick={() => del(p.id)} className="grid h-7 w-7 place-items-center rounded-md text-subtle hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button>}<button onClick={() => onUse(p.promptText)} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-2xs font-semibold text-white hover:opacity-90"><Zap className="h-3 w-3" /> Use</button></div>
              </div>
            </div>
          ))}
        </div>
      )}
      {creating && <PromptModal cats={cats} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
    </div>
  );
}
function PromptModal({ cats, onClose, onSaved }: { cats: { key: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ category: cats[0]?.key ?? "General", title: "", promptText: "", description: "", shared: false });
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!f.title.trim() || !f.promptText.trim()) { toast.show("Title and prompt text are required.", { type: "error" }); return; }
    setBusy(true);
    const j = await fetch("/api/ai/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).then((r) => r.json());
    setBusy(false);
    if (j.ok) { toast.show("Prompt saved.", { type: "success" }); onSaved(); } else toast.show(j.message || "Failed.", { type: "error" });
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-bold text-foreground">New Prompt</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2"><div><label className={lbl}>Category</label><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inp}>{cats.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></div><div><label className={lbl}>Title</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inp} /></div></div>
          <div><label className={lbl}>Prompt Text</label><textarea value={f.promptText} onChange={(e) => setF({ ...f, promptText: e.target.value })} rows={3} className={cn(inp, "h-auto py-2")} /></div>
          <div><label className={lbl}>Description</label><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inp} /></div>
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={f.shared} onChange={(e) => setF({ ...f, shared: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" /> Share with my team</label>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button><Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- AI Dashboard */
function DashboardTab() {
  const [d, setD] = useState<Record<string, unknown> | null>(null);
  useEffect(() => { fetch("/api/ai/dashboard", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setD(j.data); }).catch(() => {}); }, []);
  if (!d) return <div className="rounded-2xl border border-border bg-card p-8 shadow-sm"><AppLoader label="Loading analytics…" size="sm" /></div>;
  const g = d as { totalConversations: number; todaysConversations: number; avgResponseTimeMs: number; totalMessages: number; tokenUsage: { total: number }; claudeStatus: string; successRate: number; faqs: { q: string; count: number }[]; popularPrompts: { title: string; uses: number }[]; topUsers: { name: string; conversations: number }[]; mostUsedModules: { module: string; count: number }[] };
  const kpis = [
    { k: "Total Conversations", v: g.totalConversations, icon: MessagesSquare }, { k: "Today's Conversations", v: g.todaysConversations, icon: Activity },
    { k: "Avg Response Time", v: `${g.avgResponseTimeMs}ms`, icon: Clock }, { k: "Total Messages", v: g.totalMessages, icon: Bot },
    { k: "Token Usage", v: g.tokenUsage.total.toLocaleString(), icon: Cpu }, { k: "Success Rate", v: `${g.successRate}%`, icon: CheckCircle2 },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{kpis.map((c) => <div key={c.k} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="flex items-center justify-between"><span className="text-2xs font-semibold uppercase tracking-wide text-muted">{c.k}</span><c.icon className="h-4 w-4 text-primary" /></div><div className="mt-1 text-lg font-bold text-foreground">{c.v}</div></div>)}</div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm shadow-sm"><Bot className="h-4 w-4 text-primary" /> Claude API: <Badge tone={g.claudeStatus.includes("Connected") ? "success" : "warning"}>{g.claudeStatus}</Badge></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Frequently Asked">{g.faqs.length ? <ol className="space-y-1 text-sm">{g.faqs.map((f, i) => <li key={i} className="flex justify-between gap-2 border-b border-border/50 py-1 last:border-0"><span className="min-w-0 truncate text-foreground">{f.q}</span><Badge tone="neutral">{f.count}</Badge></li>)}</ol> : <Empty />}</Panel>
        <Panel title="Popular Prompts">{g.popularPrompts.length ? <ol className="space-y-1 text-sm">{g.popularPrompts.map((p, i) => <li key={i} className="flex justify-between gap-2 border-b border-border/50 py-1 last:border-0"><span className="min-w-0 truncate text-foreground">{p.title}</span><span className="text-2xs text-muted">{p.uses} uses</span></li>)}</ol> : <Empty />}</Panel>
        <Panel title="Top Users">{g.topUsers.length ? <ol className="space-y-1 text-sm">{g.topUsers.map((u, i) => <li key={i} className="flex justify-between gap-2 border-b border-border/50 py-1 last:border-0"><span className="text-foreground">{u.name}</span><span className="text-2xs text-muted">{u.conversations} chats</span></li>)}</ol> : <Empty />}</Panel>
        <Panel title="Most Used Modules">{g.mostUsedModules.length ? <ol className="space-y-1 text-sm">{g.mostUsedModules.map((m, i) => <li key={i} className="flex justify-between gap-2 border-b border-border/50 py-1 last:border-0"><span className="text-foreground">{m.module}</span><Badge tone="info">{m.count}</Badge></li>)}</ol> : <Empty />}</Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- AI Health */
function HealthTab() {
  const [h, setH] = useState<Record<string, unknown> | null>(null);
  const [pinging, setPinging] = useState(false);
  const load = useCallback((ping = false) => { setPinging(ping); fetch(`/api/ai/health${ping ? "?ping=1" : ""}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setH(j.health); setPinging(false); }).catch(() => setPinging(false)); }, []);
  useEffect(() => { load(); }, [load]);
  if (!h) return <div className="rounded-2xl border border-border bg-card p-8 shadow-sm"><AppLoader label="Checking health…" size="sm" /></div>;
  const g = h as { claudeApi: string; online: boolean; apiKeyConfigured: boolean; responseTimeMs: number; avgLatencyMs: number; maxLatencyMs: number; apiErrors24h: number; retryCount24h: number; fallback24h: number; totalCalls24h: number; successRate: number; recentErrors: { message: string; at: string }[] };
  const tiles = [
    { k: "Claude API", v: g.claudeApi, tone: g.online ? "text-success" : "text-warning" }, { k: "Response Time", v: `${g.responseTimeMs}ms`, tone: "text-foreground" },
    { k: "Avg Latency", v: `${g.avgLatencyMs}ms`, tone: "text-foreground" }, { k: "Max Latency", v: `${g.maxLatencyMs}ms`, tone: "text-foreground" },
    { k: "Success Rate", v: `${g.successRate}%`, tone: g.successRate >= 90 ? "text-success" : "text-warning" }, { k: "API Errors (24h)", v: g.apiErrors24h, tone: g.apiErrors24h ? "text-danger" : "text-success" },
    { k: "Retries (24h)", v: g.retryCount24h, tone: "text-foreground" }, { k: "Fallbacks (24h)", v: g.fallback24h, tone: "text-muted" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3"><span className={cn("grid h-11 w-11 place-items-center rounded-xl", g.online ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{g.online ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}</span><div><div className="text-base font-bold text-foreground">{g.online ? "AI Service Online" : g.apiKeyConfigured ? "AI Service Degraded" : "Fallback Mode (no API key)"}</div><div className="text-2xs text-muted">{g.apiKeyConfigured ? "Claude API key configured" : "Add ANTHROPIC_API_KEY in Platform → AI Platform to enable live answers"}</div></div></div>
        <Button size="sm" variant="outline" onClick={() => load(true)} disabled={pinging}><Activity className={cn("h-3.5 w-3.5", pinging && "animate-pulse")} /> {pinging ? "Pinging…" : "Ping Claude"}</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{tiles.map((t) => <div key={t.k} className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"><div className="text-2xs font-semibold uppercase tracking-wide text-muted">{t.k}</div><div className={cn("mt-1 text-lg font-bold", t.tone)}>{t.v}</div></div>)}</div>
      {g.recentErrors.length > 0 && <Panel title="Recent Errors"><div className="space-y-1">{g.recentErrors.map((e, i) => <div key={i} className="flex justify-between gap-2 border-b border-border/50 py-1 text-2xs last:border-0"><span className="min-w-0 truncate text-danger">{e.message}</span><span className="shrink-0 text-subtle">{new Date(e.at).toLocaleString()}</span></div>)}</div></Panel>}
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold text-muted";
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><h3 className="mb-2 text-sm font-bold text-foreground">{title}</h3>{children}</div>; }
function Empty() { return <p className="py-3 text-center text-2xs text-muted">No data yet.</p>; }

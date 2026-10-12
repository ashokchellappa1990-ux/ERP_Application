"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Send, Sparkles, ThumbsUp, ThumbsDown, Loader2, Bot, User as UserIcon, Zap, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Bars, LineChart, Donut, DualBars } from "@/components/dashboard/charts";
import { formatMoney } from "@/lib/settings/generalConfig";

interface ChartSpec { type: string; title: string; unit: string; items?: { name: string; value: number }[]; series?: { name: string; a: number; b: number }[]; aLabel?: string; bLabel?: string }
interface DraftExtra { id: number; txLabel: string; module: string; status: string; targetHref?: string; summary?: string | null; issues?: string[]; warnings?: string[] }
interface Extras { chart?: ChartSpec; comparison?: { aLabel: string; a: number; bLabel: string; b: number; pct: number; direction: string; better: boolean; unit: string }; kpi?: { label: string; value: number; unit: string; status: string }; drilldown?: { label: string; href: string }; navigate?: { href: string; label: string }; draft?: DraftExtra; createMaster?: { href: string; label: string }; docSources?: { id: number; title: string; href: string }[] }
interface Msg { id?: number; role: string; content: string; status?: string | null; model?: string | null; latencyMs?: number | null; feedback?: string | null; extras?: Extras }
interface Suggestion { id: number; title: string; promptText: string }

const fmtBy = (unit?: string) => (n: number) => unit === "percent" ? `${Math.round(n)}%` : unit === "count" ? Math.round(n).toLocaleString("en-IN") : formatMoney(n || 0);

/** Reusable AI Copilot chat surface — used by the full page and the floating dock. */
export function AiChat({ conversationId, onConversationChange, compact, autoSend }: { conversationId?: number | null; onConversationChange?: (id: number) => void; compact?: boolean; autoSend?: string }) {
  const [convId, setConvId] = useState<number | null>(conversationId ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  useEffect(() => { setConvId(conversationId ?? null); }, [conversationId]);
  useEffect(() => { if (autoSend && !autoSent.current) { autoSent.current = true; send(autoSend); } }, [autoSend]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!convId) { setMessages([]); return; }
    fetch(`/api/ai/history?id=${convId}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setMessages(j.conversation.messages); }).catch(() => {});
  }, [convId]);

  useEffect(() => { fetch("/api/ai/prompts", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setSuggestions(j.prompts.slice(0, 6)); }).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, sending]);

  async function send(text: string, promptId?: number) {
    const message = text.trim(); if (!message || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setSending(true);
    try {
      const j = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, conversationId: convId, promptId }) }).then((r) => r.json());
      if (j.ok) {
        setMessages((m) => [...m, { id: j.assistantMessageId, role: "assistant", content: j.answer, status: j.status, model: j.model, latencyMs: j.latencyMs, extras: j.extras }]);
        if (!convId) { setConvId(j.conversationId); onConversationChange?.(j.conversationId); }
        else onConversationChange?.(j.conversationId);
      } else setMessages((m) => [...m, { role: "assistant", content: j.message || "Something went wrong.", status: "error" }]);
    } catch { setMessages((m) => [...m, { role: "assistant", content: "Network error. Please try again.", status: "error" }]); }
    setSending(false);
  }

  async function feedback(messageId: number, rating: "up" | "down") {
    setMessages((m) => m.map((x) => (x.id === messageId ? { ...x, feedback: rating } : x)));
    await fetch("/api/ai/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "feedback", messageId, rating }) }).catch(() => {});
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && !sending && (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-white shadow-lg"><Sparkles className="h-7 w-7" /></span>
            <div><p className="text-base font-bold text-foreground">One ERP Copilot</p><p className="mt-0.5 text-xs text-muted">Ask about sales, finance, inventory, GST, budget and more.</p></div>
            <div className={cn("grid w-full gap-1.5", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
              {suggestions.map((s) => <button key={s.id} onClick={() => send(s.promptText, s.id)} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-foreground transition hover:border-primary/40 hover:bg-primary-subtle/30"><Zap className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{s.title}</span></button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role !== "user" && <span className="grid h-7 w-7 shrink-0 place-items-center self-start rounded-lg bg-brand-gradient text-white"><Bot className="h-4 w-4" /></span>}
            <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", m.role === "user" ? "bg-primary text-white" : "border border-border bg-card text-foreground")}>
              <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              {m.role === "assistant" && m.extras && <ExtrasView extras={m.extras} />}
              {m.role === "assistant" && (
                <div className="mt-1.5 flex items-center gap-2 border-t border-border/60 pt-1.5 text-2xs text-muted">
                  {m.status === "fallback" && <span className="rounded bg-warning-subtle px-1.5 py-0.5 font-semibold text-warning">offline</span>}
                  {m.model && <span className="truncate">{m.model}</span>}
                  {m.latencyMs != null && <span>· {m.latencyMs}ms</span>}
                  {m.id && <span className="ml-auto flex items-center gap-1">
                    <button onClick={() => feedback(m.id!, "up")} className={cn("grid h-5 w-5 place-items-center rounded hover:bg-surface-2", m.feedback === "up" && "text-success")}><ThumbsUp className="h-3 w-3" /></button>
                    <button onClick={() => feedback(m.id!, "down")} className={cn("grid h-5 w-5 place-items-center rounded hover:bg-surface-2", m.feedback === "down" && "text-danger")}><ThumbsDown className="h-3 w-3" /></button>
                  </span>}
                </div>
              )}
            </div>
            {m.role === "user" && <span className="grid h-7 w-7 shrink-0 place-items-center self-start rounded-lg bg-surface-2 text-muted"><UserIcon className="h-4 w-4" /></span>}
          </div>
        ))}
        {sending && <div className="flex items-center gap-2 text-xs text-muted"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-gradient text-white"><Bot className="h-4 w-4" /></span><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-border p-2.5">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the copilot…" className="h-10 flex-1 rounded-xl border border-border-strong bg-surface px-3.5 text-sm focus:border-primary focus:outline-none" />
        <button type="submit" disabled={sending || !input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white transition hover:opacity-90 disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </form>
      {!compact && <p className="px-3 pb-2 text-center text-2xs text-subtle">Answers are scoped to your permissions. <Link href="/copilot" className="text-primary hover:underline">Open full Copilot</Link></p>}
    </div>
  );
}

/** Renders the BI extras (chart, comparison, KPI, drill-down) under an answer. */
function ExtrasView({ extras }: { extras: Extras }) {
  const c = extras.chart;
  return (
    <div className="mt-2 space-y-2">
      {extras.navigate && <Link href={extras.navigate.href} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-2xs font-bold text-white transition hover:opacity-90">Open {extras.navigate.label} <ArrowRight className="h-3.5 w-3.5" /></Link>}
      {extras.createMaster && <Link href={extras.createMaster.href} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-subtle/30 px-3 py-1.5 text-2xs font-bold text-primary transition hover:bg-primary hover:text-white">➕ {extras.createMaster.label}</Link>}
      {extras.docSources && extras.docSources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-subtle">📄 Sources:</span>
          {extras.docSources.map((d) => <Link key={d.id} href={d.href} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2/40 px-2 py-1 text-[10px] font-semibold text-foreground hover:border-primary/40 hover:text-primary">{d.title}</Link>)}
        </div>
      )}
      {extras.draft && (
        <div className={cn("rounded-lg border p-2.5", extras.draft.status === "Draft" ? "border-success/40 bg-success/5" : "border-border bg-surface-2/30")}>
          <div className="flex items-center justify-between gap-2"><span className="text-2xs font-bold text-foreground">📝 Draft · {extras.draft.txLabel}</span><span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{extras.draft.status}</span></div>
          {extras.draft.summary && <p className="mt-0.5 text-2xs text-muted">{extras.draft.summary}</p>}
          {extras.draft.status === "Draft" && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {extras.draft.targetHref && <Link href={`${extras.draft.targetHref}?aiDraft=${extras.draft.id}`} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-white hover:opacity-90">Create in module <ArrowRight className="h-3 w-3" /></Link>}
              <Link href="/ai/drafts" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted hover:text-primary">Review in Draft Center</Link>
            </div>
          )}
        </div>
      )}
      {extras.comparison && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2">
          <div className="text-2xs"><div className="text-muted">{extras.comparison.aLabel}</div><div className="font-bold text-foreground">{fmtBy(extras.comparison.unit)(extras.comparison.a)}</div></div>
          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold", extras.comparison.better ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>{extras.comparison.direction === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{extras.comparison.pct >= 0 ? "+" : ""}{extras.comparison.pct}%</span>
          <div className="text-right text-2xs"><div className="text-muted">{extras.comparison.bLabel}</div><div className="font-bold text-foreground">{fmtBy(extras.comparison.unit)(extras.comparison.b)}</div></div>
        </div>
      )}
      {c && (c.items?.length || c.series?.length) ? (
        <div className="rounded-lg border border-border bg-surface-2/30 p-2.5">
          <div className="mb-1.5 text-2xs font-bold text-foreground">{c.title}</div>
          {c.type === "line" && c.items ? <LineChart items={c.items} fmt={fmtBy(c.unit)} />
            : c.type === "donut" && c.items ? <Donut items={c.items} fmt={fmtBy(c.unit)} />
            : c.type === "dualbar" && c.series ? <DualBars series={c.series} fmt={fmtBy(c.unit)} aLabel={c.aLabel ?? "A"} bLabel={c.bLabel ?? "B"} />
            : c.items ? <Bars items={c.items} fmt={fmtBy(c.unit)} /> : null}
        </div>
      ) : null}
      {extras.drilldown && <Link href={extras.drilldown.href} className="inline-flex items-center gap-1 rounded-md bg-primary-subtle/50 px-2.5 py-1 text-2xs font-semibold text-primary transition hover:bg-primary hover:text-white">{extras.drilldown.label} <ArrowRight className="h-3 w-3" /></Link>}
    </div>
  );
}

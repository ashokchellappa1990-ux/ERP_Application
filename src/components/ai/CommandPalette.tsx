"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Command, Search, CornerDownLeft, Loader2, ArrowRight, Sparkles, Bot, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Global AI Command Center — CTRL/⌘+K palette. Understands NL: navigate, create a draft
 *  (multi-turn), or answer. Never posts — it stages drafts / navigates. */

interface Turn { role: "user" | "ai"; text: string; navigate?: { href: string; label: string }; draft?: { id: number; txLabel: string; status: string; targetHref?: string; summary?: string | null }; createMaster?: { href: string; label: string } }
const SUGGESTIONS = ["Create Expense Voucher", "Show today's sales", "Open Supplier Master", "Show pending payments", "Show cash flow", "Compare sales this month vs last month", "Open Budget Dashboard", "Show low stock"];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<number | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((v: boolean) => { setOpen(v); if (v) setTimeout(() => inputRef.current?.focus(), 40); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); toggle(!open); }
      if (e.key === "Escape" && open) toggle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggle]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, busy]);

  async function run(text: string) {
    const message = text.trim(); if (!message || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text: message }]);
    setBusy(true);
    const j = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, conversationId: convId }) }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!j?.ok) { setTurns((t) => [...t, { role: "ai", text: j?.message || "Something went wrong." }]); return; }
    setConvId(j.conversationId);
    // Navigation → go straight there.
    if (j.extras?.navigate) { toggle(false); setTurns([]); setConvId(null); router.push(j.extras.navigate.href); return; }
    setTurns((t) => [...t, { role: "ai", text: j.answer, draft: j.extras?.draft, createMaster: j.extras?.createMaster }]);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-sm" onClick={() => toggle(false)}>
      <div className="flex max-h-[76vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border bg-brand-gradient px-4 py-2.5 text-white">
          <Command className="h-4 w-4" /><span className="text-sm font-bold">AI Command Center</span><span className="ml-auto rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">Ctrl K</span>
        </div>

        {turns.length > 0 && (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {turns.map((t, i) => (
              <div key={i} className={cn("flex gap-2", t.role === "user" ? "justify-end" : "justify-start")}>
                {t.role === "ai" && <span className="grid h-6 w-6 shrink-0 place-items-center self-start rounded-md bg-brand-gradient text-white"><Bot className="h-3.5 w-3.5" /></span>}
                <div className={cn("max-w-[85%] rounded-xl px-3 py-1.5 text-sm", t.role === "user" ? "bg-primary text-white" : "border border-border bg-card text-foreground")}>
                  <div className="whitespace-pre-wrap leading-relaxed">{t.text}</div>
                  {(t.draft?.status === "Draft" || t.createMaster) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {t.createMaster && <Link onClick={() => toggle(false)} href={t.createMaster.href} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary-subtle/30 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary hover:text-white">➕ {t.createMaster.label}</Link>}
                      {t.draft?.status === "Draft" && t.draft.targetHref && <Link onClick={() => toggle(false)} href={`${t.draft.targetHref}?aiDraft=${t.draft.id}`} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-white hover:opacity-90">Create in module <ArrowRight className="h-3 w-3" /></Link>}
                      {t.draft?.status === "Draft" && <Link onClick={() => toggle(false)} href="/ai/drafts" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted hover:text-primary">Draft Center</Link>}
                    </div>
                  )}
                </div>
                {t.role === "user" && <span className="grid h-6 w-6 shrink-0 place-items-center self-start rounded-md bg-surface-2 text-muted"><UserIcon className="h-3.5 w-3.5" /></span>}
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-2xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…</div>}
            <div ref={endRef} />
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); run(input); }} className="flex items-center gap-2 border-t border-border p-2.5">
          <Search className="h-4 w-4 shrink-0 text-subtle" />
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a command or question… (e.g. Create Expense Voucher)" className="h-9 flex-1 bg-transparent text-sm text-foreground outline-none" />
          <button type="submit" disabled={busy || !input.trim()} className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white disabled:opacity-50"><CornerDownLeft className="h-4 w-4" /></button>
        </form>

        {turns.length === 0 && (
          <div className="border-t border-border p-3">
            <div className="mb-1.5 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-subtle"><Sparkles className="h-3 w-3" /> Try</div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => run(s)} className="rounded-lg border border-border bg-card px-2.5 py-1 text-2xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary-subtle/30">{s}</button>)}
            </div>
            <p className="mt-2 text-[10px] text-subtle">The AI prepares drafts &amp; navigates — it never posts, approves or deletes. You review and confirm.</p>
          </div>
        )}
      </div>
    </div>
  );
}

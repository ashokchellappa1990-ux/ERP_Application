"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Command, Search, CornerDownLeft, Loader2, ArrowRight, Bot, User as UserIcon, FilePlus2, Compass, LineChart, FileText, History, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";

/** AI COMMAND CENTER — an ACTION cockpit (distinct from the conversational AI Copilot).
 *  Run commands to prepare drafts & navigate; see recent command actions + pending drafts.
 *  The AI never posts — it stages drafts you confirm in the module. */

interface Turn { role: "user" | "ai"; text: string; draft?: { id: number; txLabel: string; status: string; targetHref?: string }; createMaster?: { href: string; label: string } }
interface Action { id: number; actionNo: string; prompt: string; intent: string; status: string; module: string | null; txType: string | null; at: string }
interface Draft { id: number; txLabel: string; status: string; summary: string | null; targetHref: string }

const GROUPS: { title: string; icon: typeof FilePlus2; tone: string; cmds: string[] }[] = [
  { title: "Create a transaction", icon: FilePlus2, tone: "text-primary", cmds: ["Create Expense Voucher", "Create Supplier Payment", "Create Income Receipt", "Create Journal Voucher", "Create Sales Invoice", "Create Purchase Order", "Create Customer", "Create Supplier", "Create Budget Revision", "Create Budget Transfer"] },
  { title: "Navigate", icon: Compass, tone: "text-info", cmds: ["Open Supplier Master", "Open Product Master", "Open Customer Master", "Open Budget Dashboard", "Open Payables", "Open Receivables", "Open Statutory Compliance", "Open Inventory Tracking"] },
  { title: "Ask & analyse", icon: LineChart, tone: "text-success", cmds: ["Show today's sales", "Compare this month vs last month sales", "What is my GST liability", "Show cash flow", "Show low stock", "Give me an executive summary"] },
];

export function AiCommandCenter() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState<number | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [actions, setActions] = useState<Action[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadPanels = useCallback(() => {
    fetch("/api/ai/actions", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setActions(j.actions.slice(0, 8)); }).catch(() => {});
    fetch("/api/ai/drafts?status=Draft", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setDrafts(j.drafts.slice(0, 6)); }).catch(() => {});
  }, []);
  useEffect(() => { loadPanels(); }, [loadPanels]);
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
    if (j.extras?.navigate) { router.push(j.extras.navigate.href); return; }
    setTurns((t) => [...t, { role: "ai", text: j.answer, draft: j.extras?.draft, createMaster: j.extras?.createMaster }]);
    loadPanels();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><Command className="h-5 w-5" /></span> AI Command Center</h1>
        <p className="mt-0.5 text-sm text-muted">Run commands to prepare transactions &amp; navigate — press <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-2xs font-semibold">Ctrl K</kbd> anywhere. The AI stages drafts for you to confirm; it never posts, approves or deletes.</p>
      </div>

      {/* Command bar + inline results */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {turns.length > 0 && (
          <div className="max-h-[38vh] space-y-2 overflow-y-auto border-b border-border p-3">
            {turns.map((t, i) => (
              <div key={i} className={cn("flex gap-2", t.role === "user" ? "justify-end" : "justify-start")}>
                {t.role === "ai" && <span className="grid h-6 w-6 shrink-0 place-items-center self-start rounded-md bg-brand-gradient text-white"><Bot className="h-3.5 w-3.5" /></span>}
                <div className={cn("max-w-[85%] rounded-xl px-3 py-1.5 text-sm", t.role === "user" ? "bg-primary text-white" : "border border-border bg-surface-2/40 text-foreground")}>
                  <div className="whitespace-pre-wrap leading-relaxed">{t.text}</div>
                  {(t.draft?.status === "Draft" || t.createMaster) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {t.createMaster && <Link href={t.createMaster.href} className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary-subtle/30 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary hover:text-white">➕ {t.createMaster.label}</Link>}
                      {t.draft?.status === "Draft" && t.draft.targetHref && <Link href={`${t.draft.targetHref}?aiDraft=${t.draft.id}`} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-white hover:opacity-90">Create in module <ArrowRight className="h-3 w-3" /></Link>}
                      {t.draft?.status === "Draft" && <Link href="/ai/drafts" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted hover:text-primary">Draft Center</Link>}
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
        <form onSubmit={(e) => { e.preventDefault(); run(input); }} className="flex items-center gap-2 p-2.5">
          <Search className="h-4 w-4 shrink-0 text-subtle" />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a command… e.g. Create Expense Voucher · Open Supplier Master · Show today's sales" className="h-10 flex-1 bg-transparent text-sm text-foreground outline-none" />
          <button type="submit" disabled={busy || !input.trim()} className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white disabled:opacity-50"><CornerDownLeft className="h-4 w-4" /></button>
        </form>
      </div>

      {/* Command catalog */}
      <div className="grid gap-3 lg:grid-cols-3">
        {GROUPS.map((g) => (
          <div key={g.title} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground"><g.icon className={cn("h-4 w-4", g.tone)} /> {g.title}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.cmds.map((c) => <button key={c} onClick={() => run(c)} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary-subtle/30">{c}</button>)}
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity + drafts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><History className="h-4 w-4 text-primary" /> Recent Commands</h3><Link href="/ai/actions" className="text-2xs font-semibold text-primary hover:underline">View all →</Link></div>
          {!actions ? <AppLoader label="Loading…" size="sm" /> : actions.length === 0 ? <Empty msg="No commands yet — try one above." /> : (
            <div className="space-y-1">{actions.map((a) => <div key={a.id} className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5 text-2xs last:border-0"><span className="min-w-0 truncate text-foreground">{a.prompt}</span><Badge tone={a.status === "draft-created" || a.status === "navigated" ? "success" : a.status === "blocked" ? "danger" : "info"}>{a.intent}</Badge></div>)}</div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><FileText className="h-4 w-4 text-primary" /> Pending Drafts</h3><Link href="/ai/drafts" className="text-2xs font-semibold text-primary hover:underline">Draft Center →</Link></div>
          {!drafts ? <AppLoader label="Loading…" size="sm" /> : drafts.length === 0 ? <Empty msg="No pending drafts." /> : (
            <div className="space-y-1.5">{drafts.map((d) => <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/30 px-2.5 py-1.5 text-sm"><span className="min-w-0"><span className="font-medium text-foreground">{d.txLabel}</span> <span className="text-2xs text-muted">— {d.summary}</span></span><Link href={`${d.targetHref}?aiDraft=${d.id}`} className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-2xs font-semibold text-white hover:opacity-90">Create</Link></div>)}</div>
          )}
        </div>
      </div>

      <p className="flex items-center justify-center gap-1 text-2xs text-subtle"><Sparkles className="h-3 w-3" /> Looking to chat or explore data? Use the <Link href="/copilot" className="font-semibold text-primary hover:underline">AI Copilot</Link> instead.</p>
    </div>
  );
}

function Empty({ msg }: { msg: string }) { return <p className="py-3 text-center text-2xs text-muted">{msg}</p>; }

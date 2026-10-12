"use client";

import { useCallback, useEffect, useState } from "react";
import { BookMarked, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { jget, jsend } from "./api";

interface KbEntry { id: number; question: string; answer: string; source: string; status: string; views: number; department: string | null }
const SRC_TONE: Record<string, "neutral" | "primary" | "success" | "info" | "warning"> = { manual: "neutral", document: "info", faq: "primary", erp: "success" };

export function KnowledgeBaseConsole() {
  const toast = useToast();
  const [entries, setEntries] = useState<KbEntry[] | null>(null);
  const [q, setQ] = useState(""); const [adding, setAdding] = useState(false);
  const [nq, setNq] = useState(""); const [na, setNa] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const p = new URLSearchParams(); if (q) p.set("q", q); const j = await jget<{ ok: boolean; entries: KbEntry[] }>(`/api/knowledge?${p}`); if (j.ok) setEntries(j.entries); }, [q]);
  useEffect(() => { load(); }, [load]);
  const add = async () => { if (!nq.trim() || !na.trim()) return; setBusy(true); const j = await jsend<{ ok: boolean; message?: string }>("/api/knowledge", "POST", { question: nq, answer: na, source: "manual" }); setBusy(false); if (j.ok) { toast.success("Added to Knowledge Base."); setNq(""); setNa(""); setAdding(false); load(); } else toast.error(j.message || "Failed."); };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><BookMarked className="h-5 w-5" /></span> Knowledge Base</h1>
          <p className="mt-0.5 text-sm text-muted">Enterprise Q&amp;A built from documents, FAQs and manual entries — searchable by everyone.</p>
        </div>
        <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2 text-2xs font-bold text-white"><Plus className="h-4 w-4" /> New Entry</button>
      </div>

      {adding && (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <input value={nq} onChange={(e) => setNq(e.target.value)} placeholder="Question" className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none" />
          <textarea value={na} onChange={(e) => setNa(e.target.value)} placeholder="Answer" rows={3} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none" />
          <div className="flex justify-end gap-2"><button onClick={() => setAdding(false)} className="rounded-lg border border-border px-3 py-1.5 text-2xs font-semibold text-muted">Cancel</button><button disabled={busy} onClick={add} className="rounded-lg bg-brand-gradient px-3 py-1.5 text-2xs font-bold text-white disabled:opacity-50">Save</button></div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3"><Search className="h-4 w-4 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the knowledge base…" className="h-9 flex-1 bg-transparent text-sm outline-none" /></div>

      {!entries ? <AppLoader label="Loading knowledge base…" /> : entries.length === 0 ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No entries yet. Generate FAQs from a document (and promote them), or add one manually.</p> : (
        <div className="space-y-2">
          {entries.map((e) => (
            <details key={e.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground"><span className="flex-1">{e.question}</span><Badge tone={SRC_TONE[e.source] ?? "neutral"}>{e.source}</Badge></summary>
              <p className="mt-2 whitespace-pre-wrap text-2xs text-muted">{e.answer}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

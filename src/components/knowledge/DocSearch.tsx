"use client";

import { useState } from "react";
import { FileSearch, Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DocDrawer } from "./DocDrawer";
import { jget, STATUS_TONE, type DocHit } from "./api";

export function DocSearch() {
  const [q, setQ] = useState(""); const [hits, setHits] = useState<DocHit[] | null>(null); const [busy, setBusy] = useState(false); const [open, setOpen] = useState<number | null>(null);
  const run = async (query: string) => { if (query.trim().length < 2) return; setBusy(true); const j = await jget<{ ok: boolean; hits: DocHit[] }>(`/api/documents/search?q=${encodeURIComponent(query)}`); setBusy(false); if (j.ok) setHits(j.hits); };
  const examples = ["supplier agreement", "leave policy", "GST rules", "AMC warranty", "purchase policy", "cancellation clause"];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><FileSearch className="h-5 w-5" /></span> AI Document Search</h1>
        <p className="mt-0.5 text-sm text-muted">Natural-language + semantic search across every uploaded document — by title, content, tags, dates, amounts and parties.</p>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-sm">
        <Search className="h-5 w-5 text-subtle" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find supplier agreement · GST rules for interstate sales · employee leave policy…" className="h-10 flex-1 bg-transparent text-sm outline-none" />
        <button type="submit" disabled={busy} className="rounded-lg bg-brand-gradient px-4 py-2 text-2xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}</button>
      </form>
      {!hits && <div className="flex flex-wrap gap-1.5">{examples.map((e) => <button key={e} onClick={() => { setQ(e); run(e); }} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-2xs hover:border-primary/40 hover:text-primary">{e}</button>)}</div>}
      {hits && (hits.length === 0 ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No documents matched “{q}”.</p> : (
        <div className="space-y-2">
          {hits.map((h) => (
            <button key={h.id} onClick={() => setOpen(h.id)} className="block w-full rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-primary/40">
              <div className="flex items-center gap-2"><span className="text-sm font-semibold text-foreground">{h.title}</span><Badge tone={STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge><span className="ml-auto text-[10px] text-subtle">score {h.score}</span></div>
              <p className="mt-1 line-clamp-2 text-2xs text-muted">{h.snippet}</p>
            </button>
          ))}
        </div>
      ))}
      {open && <DocDrawer documentId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

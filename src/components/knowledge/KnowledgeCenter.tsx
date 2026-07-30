"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen, Search, Upload, Loader2, ArrowRight, FileText, GitCompare, FileQuestion, Languages, ScanSearch,
  BarChart3, SlidersHorizontal, FolderTree, BookMarked, MessagesSquare, FileSearch, Sparkles, Layers, Cpu,
  Library, type LucideIcon,
} from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { DocDrawer } from "./DocDrawer";
import { jget, fmtDate, STATUS_TONE, EXT_ICON, type DocRow, type DocHit } from "./api";

/** THE KNOWLEDGE CENTER — the single hub for the whole Document Intelligence platform.
 *  It explains the process (why each stage matters) and launches every tool from one screen,
 *  so no separate menu items are needed. */

interface Analytics { totalDocuments: number; knowledgeEntries: number; ocrCompleted: number; ocrPending: number; coverage: number; totalQueries: number }

interface Stage { n: number; icon: LucideIcon; title: string; why: string; auto?: boolean; actions: { label: string; href: string; icon: LucideIcon }[] }
const STAGES: Stage[] = [
  { n: 1, icon: Upload, title: "Capture", why: "Bring every contract, policy, SOP, invoice, agreement and manual into one secure, searchable place — instead of files scattered across drives and inboxes.", actions: [{ label: "Upload Documents", href: "/ai/documents", icon: Library }, { label: "OCR a Scan", href: "/ai/documents/ocr", icon: ScanSearch }] },
  { n: 2, icon: FolderTree, title: "Organize & Govern", why: "Classify each document by category, and move it through the Draft → Review → Approved → Published workflow so everyone trusts the right, current version.", actions: [{ label: "Categories", href: "/ai/documents/categories", icon: FolderTree }, { label: "Document Library", href: "/ai/documents", icon: Library }] },
  { n: 3, icon: Cpu, title: "Understand — automatic", why: "The moment a file lands, the platform extracts its text, pulls out the dates, amounts, GST numbers and parties, and splits it into chunks the AI can read. Scanned images are read with OCR. Nothing to do by hand.", auto: true, actions: [] },
  { n: 4, icon: Sparkles, title: "Ask & Use", why: "Now put the knowledge to work — search across everything, chat with a document, get an instant summary, compare two versions, translate, or auto-generate FAQs.", actions: [{ label: "Search", href: "/ai/documents/search", icon: FileSearch }, { label: "Chat", href: "/ai/documents/chat", icon: MessagesSquare }, { label: "Summary", href: "/ai/documents/summary", icon: FileText }, { label: "Compare", href: "/ai/documents/compare", icon: GitCompare }, { label: "Translate", href: "/ai/documents/translate", icon: Languages }, { label: "FAQ", href: "/ai/documents/faq", icon: FileQuestion }] },
  { n: 5, icon: BookMarked, title: "Build Institutional Knowledge", why: "Promote the best document answers and generated FAQs into a reusable enterprise Knowledge Base — so the same question is never researched twice.", actions: [{ label: "Knowledge Base", href: "/ai/knowledge-base", icon: BookMarked }] },
  { n: 6, icon: BarChart3, title: "Measure & Improve", why: "See how your knowledge is growing and being used — coverage, most-viewed documents, most-asked questions and average AI response time.", actions: [{ label: "Analytics", href: "/ai/knowledge-analytics", icon: BarChart3 }, { label: "AI Settings", href: "/ai/documents/settings", icon: SlidersHorizontal }] },
];

export function KnowledgeCenter() {
  const router = useRouter();
  const toast = useToast();
  const [a, setA] = useState<Analytics | null>(null);
  const [recent, setRecent] = useState<DocRow[] | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DocHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadStats = useCallback(() => {
    jget<{ ok: boolean; analytics: Analytics }>("/api/documents/analytics").then((j) => j.ok && setA(j.analytics));
    jget<{ ok: boolean; documents: DocRow[] }>("/api/documents?take=6").then((j) => j.ok && setRecent(j.documents));
  }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  const search = async (query: string) => {
    if (query.trim().length < 2) { setHits(null); return; }
    setSearching(true);
    const j = await jget<{ ok: boolean; hits: DocHit[] }>(`/api/documents/search?q=${encodeURIComponent(query)}`);
    setSearching(false); if (j.ok) setHits(j.hits);
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setUploading(true);
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append("file", f);
      const j = await fetch("/api/documents/upload", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
      if (j?.ok) toast.success(`Uploaded "${j.document.title}"${j.extract?.needsOcr ? " — run OCR to read it" : ""}.`);
      else toast.error(j?.message || `Failed to upload ${f.name}.`);
    }
    setUploading(false); loadStats();
  };

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border border-border bg-brand-gradient p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight"><BookOpen className="h-6 w-6" /> Knowledge Center</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/85">Your enterprise brain. Upload any document and the AI reads, understands and answers from it — search, chat, summarise, compare, translate and build a living knowledge base, all from this one screen.</p>
          </div>
        </div>
        {/* Global search */}
        <form onSubmit={(e) => { e.preventDefault(); search(q); }} className="mt-4 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur">
          <Search className="h-5 w-5 text-white/80" />
          <input value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setHits(null); }} placeholder="Ask or search your documents — leave policy, supplier agreement, warranty period, GST notice…" className="h-9 flex-1 bg-transparent text-sm text-white placeholder:text-white/60 outline-none" />
          <button type="submit" className="rounded-lg bg-white px-4 py-1.5 text-2xs font-bold text-primary">{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}</button>
        </form>
      </div>

      {/* Inline search results */}
      {hits !== null && (
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-1.5 flex items-center justify-between"><span className="text-2xs font-bold uppercase tracking-wide text-subtle">Results for “{q}”</span><button onClick={() => { setHits(null); setQ(""); }} className="text-2xs text-muted hover:text-primary">Clear</button></div>
          {hits.length === 0 ? <p className="py-4 text-center text-2xs text-muted">No documents matched. Try different words, or upload the document below.</p> : (
            <div className="space-y-1.5">{hits.slice(0, 6).map((h) => (
              <button key={h.id} onClick={() => setOpen(h.id)} className="block w-full rounded-lg border border-border bg-surface-2/20 p-2.5 text-left transition hover:border-primary/40">
                <div className="flex items-center gap-2"><span className="text-sm font-semibold text-foreground">{h.title}</span><Badge tone={STATUS_TONE[h.status] ?? "neutral"}>{h.status}</Badge></div>
                <p className="mt-0.5 line-clamp-2 text-2xs text-muted">{h.snippet}</p>
              </button>
            ))}</div>
          )}
        </div>
      )}

      {/* Stats + inline upload */}
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_1.4fr]">
        <Stat label="Documents" value={a?.totalDocuments ?? "—"} />
        <Stat label="Knowledge Entries" value={a?.knowledgeEntries ?? "—"} />
        <Stat label="OCR Completed" value={a ? `${a.ocrCompleted}` : "—"} sub={a ? `${a.ocrPending} pending` : ""} />
        <Stat label="Searchable" value={a ? `${a.coverage}%` : "—"} sub={a ? `${a.totalQueries} AI queries` : ""} />
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }} onClick={() => fileRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-primary/40 bg-primary-subtle/20 p-3 text-center transition hover:bg-primary-subtle/40">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Upload className="h-5 w-5 text-primary" />}
          <span className="text-2xs font-bold text-foreground">{uploading ? "Uploading…" : "Drop or click to upload"}</span>
          <span className="text-[10px] text-muted">PDF · Word · Excel · images · text</span>
        </div>
      </div>

      {/* THE FLOW */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-1 flex items-center gap-2 text-sm font-bold text-foreground"><Layers className="h-4 w-4 text-primary" /> How the Knowledge Center works</div>
        <p className="mb-4 text-2xs text-muted">Six stages take a raw file all the way to answered questions and reusable knowledge. Each step below explains why it matters — and lets you do it right away.</p>
        <div className="space-y-2.5">
          {STAGES.map((s, i) => (
            <div key={s.n} className="relative flex gap-3 rounded-xl border border-border bg-surface-2/20 p-3">
              <div className="flex flex-col items-center">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white">{s.n}</span>
                {i < STAGES.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><s.icon className="h-4 w-4 text-primary" /><span className="text-sm font-bold text-foreground">{s.title}</span>{s.auto && <Badge tone="success">Automatic</Badge>}</div>
                <p className="mt-0.5 text-2xs leading-relaxed text-muted">{s.why}</p>
                {s.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.actions.map((ac) => <Link key={ac.href} href={ac.href} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-2xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"><ac.icon className="h-3.5 w-3.5" /> {ac.label}</Link>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent + all tools */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5"><h3 className="text-sm font-bold text-foreground">Recent Documents</h3><Link href="/ai/documents" className="text-2xs font-semibold text-primary hover:underline">Open Library →</Link></div>
          {!recent ? <div className="p-4"><AppLoader size="sm" /></div> : recent.length === 0 ? <p className="p-6 text-center text-2xs text-muted">No documents yet — upload your first file above to get started.</p> : (
            <div className="divide-y divide-border">
              {recent.map((d) => (
                <button key={d.id} onClick={() => setOpen(d.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2/40">
                  <span className="text-lg">{EXT_ICON[d.fileExt ?? ""] ?? "📄"}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{d.title}</span><span className="block truncate text-2xs text-muted">{d.docNo} · {fmtDate(d.updatedAt)}</span></span>
                  <Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-sm font-bold text-foreground">All Tools</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_TOOLS.map((t) => (
              <Link key={t.href} href={t.href} className="group flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 transition hover:border-primary/40">
                <t.icon className="h-4 w-4 text-primary" />
                <span className="min-w-0"><span className="block truncate text-2xs font-semibold text-foreground group-hover:text-primary">{t.label}</span></span>
              </Link>
            ))}
          </div>
          <Link href="/ai/documents/settings" className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-2xs font-semibold text-muted hover:text-primary"><SlidersHorizontal className="h-3.5 w-3.5" /> AI Settings &amp; configuration <ArrowRight className="h-3 w-3" /></Link>
        </div>
      </div>

      {open && <DocDrawer documentId={open} onClose={() => setOpen(null)} onChanged={loadStats} />}
    </div>
  );
}

const ALL_TOOLS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Library", href: "/ai/documents", icon: Library },
  { label: "Search", href: "/ai/documents/search", icon: FileSearch },
  { label: "Chat", href: "/ai/documents/chat", icon: MessagesSquare },
  { label: "Summary", href: "/ai/documents/summary", icon: FileText },
  { label: "Compare", href: "/ai/documents/compare", icon: GitCompare },
  { label: "FAQ", href: "/ai/documents/faq", icon: FileQuestion },
  { label: "Translate", href: "/ai/documents/translate", icon: Languages },
  { label: "OCR", href: "/ai/documents/ocr", icon: ScanSearch },
  { label: "Versions", href: "/ai/documents/versions", icon: FileText },
  { label: "Categories", href: "/ai/documents/categories", icon: FolderTree },
  { label: "Knowledge Base", href: "/ai/knowledge-base", icon: BookMarked },
  { label: "Analytics", href: "/ai/knowledge-analytics", icon: BarChart3 },
];

const Stat = ({ label, value, sub }: { label: string; value: number | string; sub?: string }) => <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="text-2xl font-bold text-foreground">{value}</div><div className="text-2xs text-muted">{label}</div>{sub ? <div className="text-[10px] text-subtle">{sub}</div> : null}</div>;

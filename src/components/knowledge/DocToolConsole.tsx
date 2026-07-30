"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, MessagesSquare, Sparkles, FileQuestion, Languages, ScanSearch, History, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";
import { ChatPanel, SummaryPanel, FaqPanel, TranslatePanel, OcrPanel, DocDrawer, Empty } from "./DocDrawer";
import { jget, fmtDate, STATUS_TONE, EXT_ICON, type DocRow } from "./api";

type Tool = "chat" | "summary" | "faq" | "translate" | "ocr" | "versions";
const META: Record<Tool, { title: string; sub: string; icon: LucideIcon }> = {
  chat: { title: "AI Document Chat", sub: "Pick a document and ask questions — answers come only from that document.", icon: MessagesSquare },
  summary: { title: "AI Document Summary", sub: "Generate executive summaries, key points, risks, dates, amounts and clauses.", icon: Sparkles },
  faq: { title: "FAQ Generator", sub: "Auto-generate frequently asked questions from any policy, SOP or manual.", icon: FileQuestion },
  translate: { title: "AI Document Translation", sub: "Translate documents into Tamil, Hindi, Arabic, French and more.", icon: Languages },
  ocr: { title: "OCR Processing", sub: "Extract text and key fields from scanned images and invoices.", icon: ScanSearch },
  versions: { title: "AI Document Versioning", sub: "Track versions, compare and roll back to a previous revision.", icon: History },
};

export function DocToolConsole({ tool }: { tool: Tool }) {
  const m = META[tool];
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [q, setQ] = useState(""); const [sel, setSel] = useState<DocRow | null>(null);
  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (q) p.set("q", q); if (tool === "ocr") p.set("ocr", "pending");
    const j = await jget<{ ok: boolean; documents: DocRow[] }>(`/api/documents?${p}`);
    if (j.ok) setDocs(j.documents);
  }, [q, tool]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><m.icon className="h-5 w-5" /></span> {m.title}</h1>
        <p className="mt-0.5 text-sm text-muted">{m.sub}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Doc picker */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2"><Search className="h-4 w-4 text-subtle" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a document…" className="h-8 flex-1 bg-transparent text-sm outline-none" /></div>
          {!docs ? <div className="p-4"><AppLoader size="sm" /></div> : docs.length === 0 ? <p className="p-6 text-center text-2xs text-muted">{tool === "ocr" ? "No documents pending OCR." : "No documents. Upload in the Document Library."}</p> : (
            <div className="max-h-[64vh] divide-y divide-border overflow-y-auto">
              {docs.map((d) => (
                <button key={d.id} onClick={() => setSel(d)} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-surface-2/40", sel?.id === d.id && "bg-primary-subtle/30")}>
                  <span>{EXT_ICON[d.fileExt ?? ""] ?? "📄"}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-2xs font-semibold text-foreground">{d.title}</span><span className="block truncate text-[10px] text-muted">{d.docNo} · {fmtDate(d.updatedAt)}</span></span>
                  <Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tool panel */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {!sel ? <Empty msg="Select a document on the left to begin." /> : tool === "versions" ? (
            <Empty msg={`Opening version history for "${sel.title}"…`} />
          ) : (
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><span>{EXT_ICON[sel.fileExt ?? ""] ?? "📄"}</span> {sel.title}</div>
              {tool === "chat" && <ChatPanel documentId={sel.id} title={sel.title} />}
              {tool === "summary" && <SummaryPanel documentId={sel.id} />}
              {tool === "faq" && <FaqPanel documentId={sel.id} />}
              {tool === "translate" && <TranslatePanel documentId={sel.id} />}
              {tool === "ocr" && <OcrPanel documentId={sel.id} ext={sel.fileExt ?? ""} onChanged={load} />}
            </div>
          )}
        </div>
      </div>

      {/* Versioning opens the full drawer at the versions tab */}
      {tool === "versions" && sel && <DocDrawer documentId={sel.id} initialTab="versions" onClose={() => setSel(null)} onChanged={load} />}
    </div>
  );
}

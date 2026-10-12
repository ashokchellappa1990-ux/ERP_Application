"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, FileText, Sparkles, MessagesSquare, FileQuestion, History, ScanSearch, Languages, Download, Send, Loader2, RotateCcw, Upload, CheckCircle2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { SUPPORTED_LANGS, DOC_TRANSITIONS, type DocStatus } from "@/lib/documents/types";
import { jget, jsend, fmtBytes, fmtDate, STATUS_TONE, EXT_ICON, type DocFull } from "./api";

type Tab = "details" | "summary" | "chat" | "faq" | "compare" | "translate" | "ocr" | "versions";
const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "details", label: "Details", icon: FileText },
  { id: "summary", label: "Summary", icon: Sparkles },
  { id: "chat", label: "Chat", icon: MessagesSquare },
  { id: "faq", label: "FAQ", icon: FileQuestion },
  { id: "translate", label: "Translate", icon: Languages },
  { id: "ocr", label: "OCR", icon: ScanSearch },
  { id: "versions", label: "Versions", icon: History },
];

export function DocDrawer({ documentId, initialTab = "details", onClose, onChanged }: { documentId: number; initialTab?: Tab; onClose: () => void; onChanged?: () => void }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [doc, setDoc] = useState<DocFull | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    const j = await jget<{ ok: boolean; document: DocFull }>(`/api/documents/${documentId}`);
    if (j.ok) setDoc(j.document);
  }, [documentId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-3xl flex-col bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border bg-brand-gradient px-4 py-3 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold"><span className="text-lg">{EXT_ICON[doc?.fileExt ?? ""] ?? "📄"}</span><span className="truncate">{doc?.title ?? "Loading…"}</span></div>
            <div className="mt-0.5 flex items-center gap-2 text-2xs text-white/80">{doc?.docNo} · {doc && fmtBytes(doc.fileSize)} · v{doc?.currentVersion}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-white/20"><X className="h-5 w-5" /></button>
        </div>
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-2/40 px-2">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-2xs font-semibold transition", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!doc ? <AppLoader label="Loading document…" /> : (
            <>
              {tab === "details" && <DetailsPanel doc={doc} onChanged={() => { load(); onChanged?.(); }} />}
              {tab === "summary" && <SummaryPanel documentId={documentId} />}
              {tab === "chat" && <ChatPanel documentId={documentId} title={doc.title} />}
              {tab === "faq" && <FaqPanel documentId={documentId} />}
              {tab === "translate" && <TranslatePanel documentId={documentId} />}
              {tab === "ocr" && <OcrPanel documentId={documentId} ext={doc.fileExt ?? ""} onChanged={load} />}
              {tab === "versions" && <VersionsPanel documentId={documentId} onChanged={() => { load(); onChanged?.(); }} toast={toast} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Details + workflow
function DetailsPanel({ doc, onChanged }: { doc: DocFull; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const from = doc.status as DocStatus;
  const nexts = DOC_TRANSITIONS[from] ?? [];
  const move = async (to: string) => {
    setBusy(true);
    const j = await jsend<{ ok: boolean; message?: string }>(`/api/documents/${doc.id}/approve`, "POST", { to });
    setBusy(false);
    if (j.ok) { toast.success(`Moved to ${to}.`); onChanged(); } else toast.error(j.message || "Failed.");
  };
  const ent = doc.entities ?? {};
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[doc.status] ?? "neutral"}>{doc.status}</Badge>
        {doc.ocrStatus !== "none" && <Badge tone={doc.ocrStatus === "completed" ? "success" : doc.ocrStatus === "pending" ? "warning" : "neutral"}>OCR: {doc.ocrStatus}</Badge>}
        {doc.tags.map((t) => <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs text-muted">#{t}</span>)}
        <a href={`/api/documents/${doc.id}/download`} className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-2xs font-semibold hover:border-primary/40 hover:text-primary"><Download className="h-3.5 w-3.5" /> Download</a>
      </div>

      {doc.description && <p className="text-sm text-foreground">{doc.description}</p>}

      <div className="grid grid-cols-2 gap-2 text-2xs">
        <Meta label="Owner" value={doc.ownerName ?? "—"} /><Meta label="Department" value={doc.department ?? "—"} />
        <Meta label="Language" value={doc.language} /><Meta label="Uploaded" value={fmtDate(doc.createdAt)} />
        <Meta label="Views" value={String(doc.viewCount)} /><Meta label="Downloads" value={String(doc.downloadCount)} />
      </div>

      {/* Workflow */}
      <div className="rounded-lg border border-border bg-surface-2/30 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-subtle"><CheckCircle2 className="h-3.5 w-3.5" /> Approval Workflow</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {["Draft", "Review", "Approved", "Published"].map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("rounded-full px-2 py-0.5 text-2xs font-semibold", doc.status === s ? "bg-primary text-white" : "bg-surface-2 text-muted")}>{s}</span>
              {i < 3 && <ChevronRight className="h-3 w-3 text-subtle" />}
            </span>
          ))}
        </div>
        {nexts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {nexts.map((n) => <button key={n} disabled={busy} onClick={() => move(n)} className="rounded-md border border-primary/40 bg-primary-subtle/30 px-2.5 py-1 text-2xs font-semibold text-primary hover:bg-primary hover:text-white disabled:opacity-50">→ {n}</button>)}
          </div>
        )}
      </div>

      {/* Entities */}
      {Object.entries(ent).some(([, v]) => (v as string[])?.length) && (
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 text-2xs font-bold uppercase tracking-wide text-subtle">Extracted Entities</div>
          <div className="space-y-1.5">
            {(["dates", "amounts", "gstins", "invoiceNos", "poNos", "emails", "relationships"] as const).map((k) => (ent[k]?.length ? (
              <div key={k} className="flex gap-2 text-2xs"><span className="w-24 shrink-0 capitalize text-muted">{k}</span><span className="flex flex-wrap gap-1">{ent[k].slice(0, 8).map((v, i) => <span key={i} className="rounded bg-surface-2 px-1.5 py-0.5 text-foreground">{v}</span>)}</span></div>
            ) : null))}
          </div>
        </div>
      )}

      {/* Text preview */}
      <div>
        <div className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">Extracted Text {doc.keywords.length > 0 && <span className="ml-1 font-normal normal-case text-subtle">· {doc.keywords.length} keywords</span>}</div>
        {doc.extractedText ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2/30 p-3 text-2xs leading-relaxed text-foreground">{doc.extractedText.slice(0, 4000)}</pre>
          : <p className="rounded-lg border border-dashed border-border p-4 text-center text-2xs text-muted">No extracted text. {doc.fileExt && ["png", "jpg", "jpeg", "tiff", "tif"].includes(doc.fileExt) ? "Run OCR to read this image." : "This format may need OCR or is unsupported."}</p>}
      </div>
    </div>
  );
}
const Meta = ({ label, value }: { label: string; value: string }) => <div className="rounded border border-border bg-surface px-2 py-1"><div className="text-subtle">{label}</div><div className="font-semibold text-foreground">{value}</div></div>;

// ---------------------------------------------------------------- Summary
export function SummaryPanel({ documentId }: { documentId: number }) {
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<Record<string, unknown> | null>(null);
  const run = async (kind: string) => { setBusy(true); const j = await jsend<{ ok: boolean; summary: Record<string, unknown> }>(`/api/documents/${documentId}/summary`, "POST", { kind }); setBusy(false); if (j.ok) setS(j.summary); };
  const list = (k: string) => (s?.[k] as string[] | undefined) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">{["executive", "detailed"].map((k) => <button key={k} disabled={busy} onClick={() => run(k)} className="rounded-md bg-brand-gradient px-3 py-1.5 text-2xs font-bold text-white disabled:opacity-50">{busy ? "Generating…" : `${k === "executive" ? "Executive" : "Detailed"} Summary`}</button>)}</div>
      {busy && <AppLoader label="Analysing document…" size="sm" />}
      {s && !busy && (
        <div className="space-y-3">
          {s.generatedBy === "fallback" && <p className="rounded bg-warning/10 px-2 py-1 text-[10px] text-warning">Offline summary (connect a Claude API key for richer AI analysis).</p>}
          <Block title="Overview">{String(s.executive || "—")}</Block>
          {String(s.detailed || "") && <Block title="Summary"><span className="whitespace-pre-wrap">{String(s.detailed)}</span></Block>}
          <ListBlock title="Key Points" items={list("keyPoints")} />
          <ListBlock title="Risks" items={list("risks")} tone="danger" />
          <ListBlock title="Important Clauses" items={list("importantClauses")} />
          <div className="grid grid-cols-2 gap-2">
            <ListBlock title="Important Dates" items={list("importantDates")} />
            <ListBlock title="Important Amounts" items={list("importantAmounts")} />
          </div>
          <ListBlock title="Compliance Notes" items={list("complianceNotes")} />
          <ListBlock title="Recommended Actions" items={list("recommendedActions")} tone="success" />
        </div>
      )}
      {!s && !busy && <Empty msg="Generate an AI summary — executive overview, key points, risks, important dates & amounts, clauses, compliance notes and recommended actions." />}
    </div>
  );
}
const Block = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="rounded-lg border border-border bg-surface-2/20 p-3"><div className="mb-1 text-2xs font-bold uppercase tracking-wide text-subtle">{title}</div><div className="text-sm text-foreground">{children}</div></div>;
const ListBlock = ({ title, items, tone }: { title: string; items: string[]; tone?: string }) => items.length ? <div className="rounded-lg border border-border p-3"><div className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-subtle">{title}</div><ul className="space-y-1">{items.map((it, i) => <li key={i} className={cn("flex gap-1.5 text-2xs", tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-foreground")}><span>•</span><span>{it}</span></li>)}</ul></div> : null;

// ---------------------------------------------------------------- Chat
export function ChatPanel({ documentId, title }: { documentId: number; title: string }) {
  const [turns, setTurns] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns, busy]);
  const ask = async (q: string) => {
    const question = q.trim(); if (!question || busy) return;
    setInput(""); setTurns((t) => [...t, { role: "user", text: question }]); setBusy(true);
    const j = await jsend<{ ok: boolean; answer?: string; message?: string }>(`/api/documents/${documentId}/chat`, "POST", { question });
    setBusy(false); setTurns((t) => [...t, { role: "ai", text: j.ok ? (j.answer ?? "") : (j.message ?? "Failed.") }]);
  };
  const suggestions = ["Summarise this document", "What are the key dates?", "What are the payment terms?", "Any risks or penalties?"];
  return (
    <div className="flex h-full min-h-[50vh] flex-col">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {turns.length === 0 && <div className="space-y-2"><Empty msg={`Ask anything about "${title}". Answers come only from this document.`} /><div className="flex flex-wrap gap-1.5">{suggestions.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-2xs hover:border-primary/40 hover:text-primary">{s}</button>)}</div></div>}
        {turns.map((t, i) => (
          <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-1.5 text-sm", t.role === "user" ? "bg-primary text-white" : "border border-border bg-surface-2/40 text-foreground")}>{t.text}</div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-2xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the document…</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="mt-2 flex items-center gap-2 border-t border-border pt-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about this document…" className="h-9 flex-1 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary/50" />
        <button type="submit" disabled={busy || !input.trim()} className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- FAQ
export function FaqPanel({ documentId }: { documentId: number }) {
  const [busy, setBusy] = useState(false); const [items, setItems] = useState<{ question: string; answer: string }[] | null>(null); const [genBy, setGenBy] = useState("");
  const toast = useToast();
  const load = useCallback(async () => { const j = await jget<{ ok: boolean; faqs: { question: string; answer: string }[] }>(`/api/documents/${documentId}/faqs`); if (j.ok && j.faqs.length) setItems(j.faqs); }, [documentId]);
  useEffect(() => { load(); }, [load]);
  const gen = async (promote: boolean) => { setBusy(true); const j = await jsend<{ ok: boolean; items?: { question: string; answer: string }[]; generatedBy?: string; promoted?: number; message?: string }>(`/api/documents/${documentId}/faqs`, "POST", { count: 12, promote }); setBusy(false); if (j.ok) { setItems(j.items ?? []); setGenBy(j.generatedBy ?? ""); if (promote) toast.success(`Promoted ${j.promoted ?? 0} FAQs to the Knowledge Base.`); } else toast.error(j.message || "Failed."); };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button disabled={busy} onClick={() => gen(false)} className="rounded-md bg-brand-gradient px-3 py-1.5 text-2xs font-bold text-white disabled:opacity-50">{busy ? "Generating…" : "Generate FAQs"}</button>
        <button disabled={busy || !items?.length} onClick={() => gen(true)} className="rounded-md border border-primary/40 px-3 py-1.5 text-2xs font-semibold text-primary hover:bg-primary hover:text-white disabled:opacity-50">Generate + Add to Knowledge Base</button>
      </div>
      {genBy === "fallback" && <p className="rounded bg-warning/10 px-2 py-1 text-[10px] text-warning">Offline FAQs (connect a Claude API key for richer Q&A).</p>}
      {busy && <AppLoader label="Generating FAQs…" size="sm" />}
      {items && !busy && (items.length ? <div className="space-y-2">{items.map((f, i) => <details key={i} className="rounded-lg border border-border bg-surface-2/20 p-2.5"><summary className="cursor-pointer text-2xs font-semibold text-foreground">{f.question}</summary><p className="mt-1.5 text-2xs text-muted">{f.answer}</p></details>)}</div> : <Empty msg="No FAQs yet." />)}
      {!items && !busy && <Empty msg="Auto-generate frequently asked questions from this document — great for policies, SOPs and manuals." />}
    </div>
  );
}

// ---------------------------------------------------------------- Translate
export function TranslatePanel({ documentId }: { documentId: number }) {
  const [lang, setLang] = useState("ta"); const [busy, setBusy] = useState(false); const [out, setOut] = useState<string | null>(null); const [status, setStatus] = useState("");
  const run = async () => { setBusy(true); const j = await jsend<{ ok: boolean; text?: string; status?: string }>(`/api/documents/${documentId}/translate`, "POST", { lang }); setBusy(false); if (j.ok) { setOut(j.text ?? ""); setStatus(j.status ?? ""); } };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm outline-none">{SUPPORTED_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
        <button disabled={busy} onClick={run} className="rounded-md bg-brand-gradient px-3 py-1.5 text-2xs font-bold text-white disabled:opacity-50">{busy ? "Translating…" : "Translate"}</button>
      </div>
      {busy && <AppLoader label="Translating…" size="sm" />}
      {status === "fallback" && !busy && <p className="rounded bg-warning/10 px-2 py-1 text-[10px] text-warning">Translation needs a connected Claude API key.</p>}
      {out && !busy && <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2/30 p-3 text-2xs leading-relaxed text-foreground">{out}</pre>}
      {!out && !busy && <Empty msg="Translate the document text into Tamil, Hindi, Arabic, French and more." />}
    </div>
  );
}

// ---------------------------------------------------------------- OCR
export function OcrPanel({ documentId, ext, onChanged }: { documentId: number; ext: string; onChanged?: () => void }) {
  const [busy, setBusy] = useState(false); const [res, setRes] = useState<{ status: string; text: string; fields: Record<string, unknown>; note?: string } | null>(null);
  const isImage = ["png", "jpg", "jpeg", "tiff", "tif", "gif", "webp", "pdf"].includes(ext);
  const run = async () => { setBusy(true); const j = await jsend<{ ok: boolean; result: { status: string; text: string; fields: Record<string, unknown>; note?: string } }>(`/api/documents/${documentId}/ocr`, "POST"); setBusy(false); if (j.ok) { setRes(j.result); onChanged?.(); } };
  return (
    <div className="space-y-3">
      {!isImage ? <Empty msg="OCR applies to scanned images (PNG/JPG/TIFF) and scanned PDFs." /> : (
        <>
          <button disabled={busy} onClick={run} className="rounded-md bg-brand-gradient px-3 py-1.5 text-2xs font-bold text-white disabled:opacity-50">{busy ? "Reading image…" : "Run OCR"}</button>
          {busy && <AppLoader label="Extracting text + fields…" size="sm" />}
          {res && !busy && (
            <div className="space-y-2">
              <Badge tone={res.status === "completed" ? "success" : res.status === "pending" ? "warning" : "danger"}>{res.status}</Badge>
              {res.note && <p className="rounded bg-warning/10 px-2 py-1 text-[10px] text-warning">{res.note}</p>}
              {Object.values(res.fields || {}).some(Boolean) && <div className="grid grid-cols-2 gap-1.5 text-2xs">{Object.entries(res.fields).filter(([, v]) => v && !Array.isArray(v)).map(([k, v]) => <div key={k} className="rounded border border-border bg-surface px-2 py-1"><div className="capitalize text-subtle">{k}</div><div className="font-semibold text-foreground">{String(v)}</div></div>)}</div>}
              {res.text && <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2/30 p-3 text-2xs text-foreground">{res.text}</pre>}
            </div>
          )}
          {!res && !busy && <Empty msg="Extract text, invoice number, supplier, amount, GST and date from the scanned document (needs a Claude API key with vision)." />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Versions
function VersionsPanel({ documentId, onChanged, toast }: { documentId: number; onChanged: () => void; toast: ReturnType<typeof useToast> }) {
  const [versions, setVersions] = useState<{ id: number; versionNo: number; fileName: string; author: string | null; reason: string | null; isCurrent: boolean; createdAt: string }[] | null>(null);
  const [busy, setBusy] = useState(false); const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { const j = await jget<{ ok: boolean; versions: typeof versions }>(`/api/documents/${documentId}/versions`); if (j.ok) setVersions(j.versions); }, [documentId]);
  useEffect(() => { load(); }, [load]);
  const rollback = async (versionNo: number) => { const j = await jsend<{ ok: boolean; message?: string }>(`/api/documents/${documentId}/versions`, "POST", { versionNo }); if (j.ok) { toast.success(`Rolled back to v${versionNo}.`); load(); onChanged(); } else toast.error(j.message || "Failed."); };
  const upload = async (f: File) => { setBusy(true); const fd = new FormData(); fd.append("file", f); fd.append("documentId", String(documentId)); fd.append("reason", "New version uploaded"); const r = await fetch("/api/documents/upload", { method: "POST", body: fd }).then((x) => x.json()).catch(() => null); setBusy(false); if (r?.ok) { toast.success(`Uploaded v${r.version}.`); load(); onChanged(); } else toast.error(r?.message || "Upload failed."); };
  return (
    <div className="space-y-3">
      <div>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <button disabled={busy} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md bg-brand-gradient px-3 py-1.5 text-2xs font-bold text-white disabled:opacity-50"><Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload New Version"}</button>
      </div>
      {!versions ? <AppLoader size="sm" /> : (
        <div className="space-y-1.5">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/20 px-3 py-2">
              <div className="min-w-0"><div className="flex items-center gap-2 text-2xs font-semibold text-foreground">v{v.versionNo} {v.isCurrent && <Badge tone="success">Current</Badge>}</div><div className="truncate text-[10px] text-muted">{v.reason} · {v.author ?? "—"} · {fmtDate(v.createdAt)}</div></div>
              {!v.isCurrent && <button onClick={() => rollback(v.versionNo)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted hover:border-primary/40 hover:text-primary"><RotateCcw className="h-3 w-3" /> Rollback</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Empty({ msg }: { msg: string }) { return <p className="rounded-lg border border-dashed border-border p-4 text-center text-2xs text-muted">{msg}</p>; }

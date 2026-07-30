"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Library, Upload, Search, Loader2, Eye, Download, Filter } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { DocDrawer } from "./DocDrawer";
import { jget, fmtBytes, fmtDate, STATUS_TONE, EXT_ICON, type DocRow, type CategoryRow } from "./api";

const STATUSES = ["", "Draft", "Review", "Approved", "Published", "Archived"];

export function DocumentLibrary() {
  const params = useSearchParams();
  const toast = useToast();
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [categoryId, setCategoryId] = useState<number | 0>(0);
  const [open, setOpen] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (q) p.set("q", q); if (status) p.set("status", status); if (categoryId) p.set("categoryId", String(categoryId));
    const j = await jget<{ ok: boolean; documents: DocRow[]; total: number }>(`/api/documents?${p}`);
    if (j.ok) { setDocs(j.documents); setTotal(j.total); }
  }, [q, status, categoryId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { jget<{ ok: boolean; categories: CategoryRow[] }>("/api/documents/categories").then((j) => j.ok && setCats(j.categories)); }, []);
  useEffect(() => { const d = params.get("doc"); if (d) setOpen(Number(d)); }, [params]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append("file", f);
      const j = await fetch("/api/documents/upload", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
      if (j?.ok) toast.success(`Uploaded "${j.document.title}"${j.extract?.needsOcr ? " — run OCR to read it" : ""}.`);
      else toast.error(j?.message || `Failed to upload ${f.name}.`);
    }
    setUploading(false); load();
  };

  return (
    <div className="space-y-4">
      <Header />

      {/* Upload + filters */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-6 text-center transition hover:border-primary/50 hover:bg-primary-subtle/20"
        >
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
          <div className="text-sm font-semibold text-foreground">{uploading ? "Uploading…" : "Drop files or click to upload"}</div>
          <div className="text-2xs text-muted">PDF, Word, Excel, CSV, images, text — extracted &amp; indexed automatically</div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3">
            <Search className="h-4 w-4 text-subtle" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" className="h-9 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg border border-border bg-surface px-2 text-2xs outline-none">{STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}</select>
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className="h-9 rounded-lg border border-border bg-surface px-2 text-2xs outline-none"><option value={0}>All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5"><h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Filter className="h-4 w-4 text-primary" /> Documents {docs && <span className="text-2xs font-normal text-muted">({total})</span>}</h3></div>
        {!docs ? <div className="p-6"><AppLoader label="Loading documents…" /></div> : docs.length === 0 ? <p className="p-8 text-center text-sm text-muted">No documents yet — upload your first file above.</p> : (
          <div className="divide-y divide-border">
            {docs.map((d) => (
              <button key={d.id} onClick={() => setOpen(d.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2/40">
                <span className="text-xl">{EXT_ICON[d.fileExt ?? ""] ?? "📄"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-foreground">{d.title}</span><Badge tone={STATUS_TONE[d.status] ?? "neutral"}>{d.status}</Badge>{d.ocrStatus === "pending" && <Badge tone="warning">OCR pending</Badge>}</div>
                  <div className="truncate text-2xs text-muted">{d.docNo} · {fmtBytes(d.fileSize)} · {d.ownerName ?? "—"} · {fmtDate(d.updatedAt)}{d.tags.length ? ` · ${d.tags.map((t) => "#" + t).join(" ")}` : ""}</div>
                </div>
                <span className="flex items-center gap-3 text-2xs text-subtle"><span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{d.viewCount}</span><span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" />{d.downloadCount}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {open && <DocDrawer documentId={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}

export function Header() {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><Library className="h-5 w-5" /></span> Document Library</h1>
      <p className="mt-0.5 text-sm text-muted">Upload, organise and manage every enterprise document. Text is extracted &amp; indexed so the AI can search, chat, summarise and translate it.</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { GitCompare, Loader2, Plus, Minus, Pencil } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { jget, jsend, type DocRow } from "./api";
import { Empty } from "./DocDrawer";

interface Diff { added: string[]; removed: string[]; modified: { before: string; after: string }[]; stats: { added: number; removed: number; modified: number; similarity: number }; narrative: string; generatedBy: string }

export function DocCompare() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [left, setLeft] = useState<number | 0>(0); const [right, setRight] = useState<number | 0>(0);
  const [busy, setBusy] = useState(false); const [diff, setDiff] = useState<Diff | null>(null);
  useEffect(() => { jget<{ ok: boolean; documents: DocRow[] }>("/api/documents?take=200").then((j) => j.ok && setDocs(j.documents)); }, []);
  const run = async () => { if (!left || !right || left === right) return; setBusy(true); const j = await jsend<{ ok: boolean; diff: Diff }>("/api/documents/compare", "POST", { leftId: left, rightId: right }); setBusy(false); if (j.ok) setDiff(j.diff); };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><GitCompare className="h-5 w-5" /></span> AI Document Comparison</h1>
        <p className="mt-0.5 text-sm text-muted">Compare two documents or versions — Contract v1 vs v2, PO vs Invoice, old policy vs new — and highlight what changed.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <Picker label="Document A" value={left} onChange={setLeft} docs={docs} />
        <Picker label="Document B" value={right} onChange={setRight} docs={docs} />
        <button disabled={busy || !left || !right || left === right} onClick={run} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-4 text-2xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compare"}</button>
      </div>
      {busy && <AppLoader label="Comparing documents…" />}
      {diff && !busy && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Added" value={diff.stats.added} tone="text-success" />
            <Stat label="Removed" value={diff.stats.removed} tone="text-danger" />
            <Stat label="Modified" value={diff.stats.modified} tone="text-warning" />
            <Stat label="Similarity" value={`${diff.stats.similarity}%`} tone="text-primary" />
          </div>
          <div className="rounded-xl border border-border bg-surface-2/20 p-3 text-sm text-foreground"><div className="mb-1 text-2xs font-bold uppercase tracking-wide text-subtle">Summary of changes</div><span className="whitespace-pre-wrap">{diff.narrative}</span></div>
          <div className="grid gap-3 lg:grid-cols-2">
            <DiffList title="Added" items={diff.added} icon={Plus} tone="text-success border-success/30 bg-success/5" />
            <DiffList title="Removed" items={diff.removed} icon={Minus} tone="text-danger border-danger/30 bg-danger/5" />
          </div>
          {diff.modified.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-warning"><Pencil className="h-3.5 w-3.5" /> Modified</div>
              <div className="space-y-2">{diff.modified.map((m, i) => <div key={i} className="text-2xs"><div className="text-danger line-through">{m.before}</div><div className="text-success">{m.after}</div></div>)}</div>
            </div>
          )}
        </div>
      )}
      {!diff && !busy && <Empty msg="Pick two documents and click Compare." />}
    </div>
  );
}
const Picker = ({ label, value, onChange, docs }: { label: string; value: number; onChange: (n: number) => void; docs: DocRow[] }) => (
  <div className="min-w-[220px] flex-1"><label className="mb-1 block text-2xs font-semibold text-muted">{label}</label>
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm outline-none"><option value={0}>Select…</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.title} ({d.docNo})</option>)}</select>
  </div>
);
const Stat = ({ label, value, tone }: { label: string; value: number | string; tone: string }) => <div className="rounded-xl border border-border bg-card p-3 text-center shadow-sm"><div className={`text-xl font-bold ${tone}`}>{value}</div><div className="text-2xs text-muted">{label}</div></div>;
const DiffList = ({ title, items, icon: Icon, tone }: { title: string; items: string[]; icon: typeof Plus; tone: string }) => (
  <div className={`rounded-xl border p-3 ${tone.split(" ").slice(1).join(" ")}`}>
    <div className={`mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide ${tone.split(" ")[0]}`}><Icon className="h-3.5 w-3.5" /> {title} ({items.length})</div>
    {items.length ? <ul className="max-h-64 space-y-1 overflow-auto">{items.slice(0, 60).map((it, i) => <li key={i} className="text-2xs text-foreground">{it}</li>)}</ul> : <p className="text-2xs text-muted">None.</p>}
  </div>
);

"use client";

import { useEffect, useState } from "react";
import { BarChart3, FileText, ScanText, BookMarked, Clock, Layers } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { jget } from "./api";

interface Analytics {
  totalDocuments: number; published: number; drafts: number; archived: number; ocrCompleted: number; ocrPending: number;
  knowledgeEntries: number; totalQueries: number; avgResponseMs: number; coverage: number; storageMb: number;
  mostViewed: { id: number; title: string; viewCount: number }[]; mostAsked: { query: string; count: number }[]; popularCategories: { name: string; count: number }[];
}

export function KnowledgeAnalytics() {
  const [a, setA] = useState<Analytics | null>(null);
  useEffect(() => { jget<{ ok: boolean; analytics: Analytics }>("/api/documents/analytics").then((j) => j.ok && setA(j.analytics)); }, []);
  if (!a) return <div className="space-y-4"><Head /><AppLoader label="Loading analytics…" /></div>;
  const maxCat = Math.max(1, ...a.popularCategories.map((c) => c.count));
  return (
    <div className="space-y-4">
      <Head />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={FileText} label="Total Documents" value={a.totalDocuments} sub={`${a.published} published · ${a.drafts} draft`} />
        <Kpi icon={ScanText} label="OCR Completed" value={a.ocrCompleted} sub={`${a.ocrPending} pending`} />
        <Kpi icon={BookMarked} label="Knowledge Entries" value={a.knowledgeEntries} sub={`${a.totalQueries} AI queries`} />
        <Kpi icon={Clock} label="Avg AI Response" value={`${a.avgResponseMs} ms`} sub={`${a.coverage}% searchable`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Knowledge Coverage" icon={Layers}>
          <div className="flex items-center justify-center py-4">
            <div className="relative grid h-28 w-28 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-primary,#2563eb) ${a.coverage * 3.6}deg, var(--color-surface-2,#e5e7eb) 0deg)` }}>
              <div className="grid h-20 w-20 place-items-center rounded-full bg-card text-lg font-bold text-foreground">{a.coverage}%</div>
            </div>
          </div>
          <p className="text-center text-2xs text-muted">{a.storageMb} MB stored · {a.archived} archived</p>
        </Panel>
        <Panel title="Popular Categories" icon={BarChart3}>
          {a.popularCategories.length ? <div className="space-y-1.5">{a.popularCategories.map((c) => <div key={c.name}><div className="flex justify-between text-2xs"><span className="text-foreground">{c.name}</span><span className="text-muted">{c.count}</span></div><div className="h-1.5 rounded-full bg-surface-2"><div className="h-1.5 rounded-full bg-brand-gradient" style={{ width: `${(c.count / maxCat) * 100}%` }} /></div></div>)}</div> : <p className="text-2xs text-muted">No documents yet.</p>}
        </Panel>
        <Panel title="Most Asked" icon={Clock}>
          {a.mostAsked.length ? <ul className="space-y-1.5">{a.mostAsked.map((m, i) => <li key={i} className="flex items-center justify-between gap-2 text-2xs"><span className="min-w-0 truncate text-foreground">{m.query}</span><span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[10px] text-muted">{m.count}</span></li>)}</ul> : <p className="text-2xs text-muted">No AI queries yet.</p>}
        </Panel>
      </div>
      <Panel title="Most Viewed Documents" icon={FileText}>
        {a.mostViewed.length ? <div className="divide-y divide-border">{a.mostViewed.map((d) => <div key={d.id} className="flex items-center justify-between gap-2 py-1.5 text-2xs"><span className="min-w-0 truncate text-foreground">{d.title}</span><span className="text-muted">{d.viewCount} views</span></div>)}</div> : <p className="text-2xs text-muted">No views yet.</p>}
      </Panel>
    </div>
  );
}
const Head = () => <div><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><BarChart3 className="h-5 w-5" /></span> AI Knowledge Analytics</h1><p className="mt-0.5 text-sm text-muted">How your enterprise knowledge is growing and being used.</p></div>;
const Kpi = ({ icon: Icon, label, value, sub }: { icon: typeof FileText; label: string; value: number | string; sub: string }) => <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-2xs font-semibold text-muted">{label}</span><Icon className="h-4 w-4 text-primary" /></div><div className="mt-1 text-2xl font-bold text-foreground">{value}</div><div className="text-2xs text-subtle">{sub}</div></div>;
const Panel = ({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) => <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground"><Icon className="h-4 w-4 text-primary" /> {title}</div>{children}</div>;

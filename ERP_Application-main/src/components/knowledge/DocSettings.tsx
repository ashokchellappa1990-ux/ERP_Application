"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, Check, KeyRound } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { jget, jsend } from "./api";

interface Settings { maxFileSizeMb: number; allowedTypes: string[]; langs: string[]; ocrEnabled: boolean; autoIndex: boolean; autoSummary: boolean; embeddingEnabled: boolean }
interface Options { langs: { code: string; label: string }[]; allTypes: string[] }
interface Ai { apiKeyPresent: boolean; model: string; enabled: boolean }

export function DocSettings() {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null); const [opt, setOpt] = useState<Options | null>(null); const [ai, setAi] = useState<Ai | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { jget<{ ok: boolean; settings: Settings; options: Options; ai: Ai }>("/api/documents/settings").then((j) => { if (j.ok) { setS(j.settings); setOpt(j.options); setAi(j.ai); } }); }, []);
  const save = async () => { if (!s) return; setBusy(true); const j = await jsend<{ ok: boolean; message?: string }>("/api/documents/settings", "PUT", s); setBusy(false); if (j.ok) toast.success("Settings saved."); else toast.error(j.message || "Failed."); };
  const set = (patch: Partial<Settings>) => setS((p) => p ? { ...p, ...patch } : p);
  const toggleType = (t: string) => set({ allowedTypes: s!.allowedTypes.includes(t) ? s!.allowedTypes.filter((x) => x !== t) : [...s!.allowedTypes, t] });
  const toggleLang = (c: string) => set({ langs: s!.langs.includes(c) ? s!.langs.filter((x) => x !== c) : [...s!.langs, c] });

  if (!s || !opt) return <div className="space-y-4"><Head /><AppLoader label="Loading settings…" /></div>;
  return (
    <div className="space-y-4">
      <Head />
      {ai && (
        <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-2xs", ai.apiKeyPresent ? "border-success/30 bg-success/5 text-success" : "border-warning/30 bg-warning/5 text-warning")}>
          <KeyRound className="h-4 w-4" />
          {ai.apiKeyPresent ? <span>Claude AI is connected ({ai.model}) — chat, summary, OCR, translation and FAQ run at full power.</span> : <span>No Claude API key — the platform still extracts, indexes and searches documents offline; connect a key in Platform → AI to enable chat, OCR, translation and richer summaries.</span>}
        </div>
      )}
      <Section title="Uploads">
        <Row label="Max file size (MB)"><input type="number" value={s.maxFileSizeMb} onChange={(e) => set({ maxFileSizeMb: Number(e.target.value) })} className="h-9 w-24 rounded-lg border border-border bg-surface px-3 text-sm outline-none" /></Row>
        <div><div className="mb-1.5 text-2xs font-semibold text-muted">Allowed file types</div><div className="flex flex-wrap gap-1.5">{opt.allTypes.map((t) => <button key={t} onClick={() => toggleType(t)} className={cn("rounded-md border px-2 py-1 text-2xs font-semibold uppercase", s.allowedTypes.includes(t) ? "border-primary bg-primary text-white" : "border-border text-muted")}>{t}</button>)}</div></div>
      </Section>
      <Section title="AI Processing">
        <Toggle label="OCR for scanned images" checked={s.ocrEnabled} onChange={(v) => set({ ocrEnabled: v })} />
        <Toggle label="Auto-index text on upload" checked={s.autoIndex} onChange={(v) => set({ autoIndex: v })} />
        <Toggle label="Auto-summarise on upload" checked={s.autoSummary} onChange={(v) => set({ autoSummary: v })} />
        <Toggle label="Vector embeddings (future)" checked={s.embeddingEnabled} onChange={(v) => set({ embeddingEnabled: v })} />
      </Section>
      <Section title="Translation Languages">
        <div className="flex flex-wrap gap-1.5">{opt.langs.map((l) => <button key={l.code} onClick={() => toggleLang(l.code)} className={cn("rounded-md border px-2 py-1 text-2xs font-semibold", s.langs.includes(l.code) ? "border-primary bg-primary text-white" : "border-border text-muted")}>{l.label}</button>)}</div>
      </Section>
      <button disabled={busy} onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-4 py-2 text-2xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" /> {busy ? "Saving…" : "Save Settings"}</button>
    </div>
  );
}
const Head = () => <div><h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><SlidersHorizontal className="h-5 w-5" /></span> AI Settings</h1><p className="mt-0.5 text-sm text-muted">Configure uploads, OCR, indexing and translation for the Document Intelligence platform.</p></div>;
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="text-sm font-bold text-foreground">{title}</div>{children}</div>;
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="flex items-center justify-between gap-2"><span className="text-2xs font-semibold text-muted">{label}</span>{children}</div>;
const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between"><span className="text-2xs font-semibold text-muted">{label}</span><span className={cn("relative h-5 w-9 rounded-full transition", checked ? "bg-primary" : "bg-surface-2")}><span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition", checked ? "left-[1.15rem]" : "left-0.5")} /></span></button>;

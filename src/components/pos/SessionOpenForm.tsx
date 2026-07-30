"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet, ArrowLeft, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/Toast";

interface Opt { id: number; label: string }

export function SessionOpenForm() {
  const router = useRouter();
  const toast = useToast();
  const [terminals, setTerminals] = useState<Opt[]>([]);
  const [shifts, setShifts] = useState<Opt[]>([]);
  const [terminalId, setTerminalId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/pos/terminals?status=active", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok) setTerminals(j.rows.map((t: { id: number; code: string; name: string }) => ({ id: t.id, label: `${t.code} — ${t.name}` })));
    }).catch(() => {});
    fetch("/api/pos/shifts?status=active", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      if (j.ok && Array.isArray(j.rows)) setShifts(j.rows.map((s: { id: number; code?: string; name: string }) => ({ id: s.id, label: s.code ? `${s.code} — ${s.name}` : s.name })));
    }).catch(() => {});
  }, []);

  async function open() {
    if (!terminalId) { toast.error("Select a terminal."); return; }
    setBusy(true);
    const j = await fetch("/api/pos/sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terminalId: Number(terminalId), shiftId: shiftId ? Number(shiftId) : undefined, openingCash: openingCash ? Number(openingCash) : undefined, openingNote: note.trim() || undefined }),
    }).then((r) => r.json()).catch(() => ({}));
    setBusy(false);
    if (toast.result(j, "Session opened.", "Could not open the session.") && j.id) router.push(`/pos/sessions/${j.id}`);
  }

  const inp = "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus";
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Wallet className="h-5 w-5 text-primary" /> Open Terminal Session</h1>
        <Link href="/pos/sessions"><Button variant="outline" size="md"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>
      <SectionCard title="Session Start" icon={Wallet}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">Terminal *</span>
            <select value={terminalId} onChange={(e) => setTerminalId(e.target.value)} className={inp}><option value="">Select terminal…</option>{terminals.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">Shift</span>
            <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={inp}><option value="">— None —</option>{shifts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">Opening Cash</span>
            <input value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} type="number" className={inp} placeholder="0.00" /></label>
          <label className="block"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">Opening Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inp} /></label>
        </div>
        <div className="mt-4 flex justify-end"><Button size="md" onClick={open} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {busy ? "Opening…" : "Open Session"}</Button></div>
      </SectionCard>
    </div>
  );
}

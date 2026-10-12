"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Link2, Plus, Power, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import type { TerminalShiftRow } from "@/lib/contracts/terminalShift";

type Option = { id: number; code: string; name: string };

export function TerminalShiftList({ withForm }: { withForm?: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<TerminalShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/terminal-shifts`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403) { setNotAuthed(true); return; }
      const j = await res.json().catch(() => ({}));
      if (j.ok) { setNotAuthed(false); setRows(j.rows); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(m: TerminalShiftRow) {
    const next = m.status === "active" ? "inactive" : "active";
    const j = await fetch(`/api/pos/terminal-shifts/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) }).then((r) => r.json()).catch(() => ({}));
    if (toast.result(j, `Mapping ${next === "active" ? "activated" : "deactivated"}.`, "Could not change status.")) load();
  }
  async function remove(m: TerminalShiftRow) {
    if (!window.confirm(`Remove mapping ${m.terminalCode} → ${m.shiftCode}?`)) return;
    const j = await fetch(`/api/pos/terminal-shifts/${m.id}`, { method: "DELETE" }).then((r) => r.json()).catch(() => ({}));
    if (toast.result(j, "Mapping deleted.", "Could not delete the mapping.")) load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>POS Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Terminal Shifts</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Link2 className="h-5 w-5 text-primary" /> Terminal-Shift Mapping</h1>
          <p className="mt-0.5 text-sm text-muted">Authorise which shifts each terminal can run.</p>
        </div>
        {!withForm && <Link href="/pos/terminal-shifts/new"><Button size="md"><Plus className="h-4 w-4" /> Add Mapping</Button></Link>}
      </div>

      {withForm && <MappingForm onCreated={load} />}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-4 py-3">Terminal</th><th className="px-4 py-3">Shift</th><th className="px-4 py-3">Effective From</th>
                <th className="px-4 py-3">Effective To</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <td className="px-4 py-3"><span className="font-mono text-xs font-semibold text-primary">{m.terminalCode}</span><span className="ml-2 text-muted">{m.terminalName}</span></td>
                  <td className="px-4 py-3"><span className="font-mono text-xs font-semibold text-foreground">{m.shiftCode}</span><span className="ml-2 text-muted">{m.shiftName}</span></td>
                  <td className="px-4 py-3 text-muted">{m.effectiveFrom || "—"}</td>
                  <td className="px-4 py-3 text-muted">{m.effectiveTo || "—"}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={m.status === "active" ? "success" : "neutral"}>{m.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => toggle(m)} title={m.status === "active" ? "Deactivate" : "Activate"} className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-warning/40 hover:text-warning"><Power className="h-4 w-4" /></button>
                      <button onClick={() => remove(m)} title="Delete" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-muted transition hover:border-danger/40 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8"><AppLoader label="Loading mappings…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">{notAuthed ? "You don't have access to Terminal Shifts." : <>No mappings yet{!withForm && <> — click <Link href="/pos/terminal-shifts/new" className="font-semibold text-primary hover:underline">Add Mapping</Link></>}.</>}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const inp = "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</span>{children}</label>;
}

export function MappingForm({ onCreated }: { onCreated?: () => void }) {
  const toast = useToast();
  const [terminals, setTerminals] = useState<Option[]>([]);
  const [shifts, setShifts] = useState<Option[]>([]);
  const [terminalId, setTerminalId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/pos/terminals`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setTerminals(j.rows); }).catch(() => {});
    fetch(`/api/pos/shifts`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setShifts(j.rows); }).catch(() => {});
  }, []);

  async function save() {
    if (!terminalId || !shiftId) { toast.error("Select a terminal and a shift."); return; }
    setSaving(true);
    const payload = {
      terminalId: Number(terminalId), shiftId: Number(shiftId),
      effectiveFrom: effectiveFrom || undefined, effectiveTo: effectiveTo || undefined,
    };
    const j = await fetch(`/api/pos/terminal-shifts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json()).catch(() => ({}));
    const ok = toast.result(j, "Mapping created.", "Could not create the mapping.");
    setSaving(false);
    if (ok) { setShiftId(""); setEffectiveFrom(""); setEffectiveTo(""); onCreated?.(); }
  }

  return (
    <SectionCard title="New Mapping" icon={Link2}>
      <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Terminal *"><select value={terminalId} onChange={(e) => setTerminalId(e.target.value)} className={inp}><option value="">Select terminal…</option>{terminals.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}</select></Field>
        <Field label="Shift *"><select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={inp}><option value="">Select shift…</option>{shifts.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select></Field>
        <Field label="Effective From"><input value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} type="date" className={inp} /></Field>
        <Field label="Effective To"><input value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} type="date" className={inp} /></Field>
        <Button size="md" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Add Mapping"}</Button>
      </div>
    </SectionCard>
  );
}

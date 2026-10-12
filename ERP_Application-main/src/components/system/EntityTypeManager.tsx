"use client";

import { useEffect, useState } from "react";
import { X, Plus, Tag, Check, Ban } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { iconFor } from "./branchShared";

interface Row {
  id: number; code: string; name: string; description: string | null; icon: string | null;
  color: string | null; allowChild: boolean; displayOrder: number; status: string; branchCount: number;
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none";

export function EntityTypeManager({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ code: "", name: "", allowChild: true });

  async function load() {
    setLoading(true);
    const j = await fetch("/api/system/entity-types").then((r) => r.json()).catch(() => ({}));
    if (j.ok) setRows(j.rows);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!nf.name.trim()) return toast.error("Name is required.");
    const j = await fetch("/api/system/entity-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nf) }).then((r) => r.json());
    if (toast.result(j, "Entity type added.")) { setNf({ code: "", name: "", allowChild: true }); setAdding(false); await load(); onChanged(); }
  }
  async function patch(id: number, body: Partial<Row>) {
    const j = await fetch(`/api/system/entity-types/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
    if (toast.result(j, "Updated.")) { await load(); onChanged(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="my-6 w-full max-w-xl rounded-2xl border border-border bg-card shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-primary-subtle/30 px-5 py-3">
          <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /><h2 className="text-sm font-bold text-foreground">Entity Types</h2></div>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-2xs text-muted">Categories used to classify each org node. Add your own as needed.</p>
            {!adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add Type</Button>}
          </div>

          {adding && (
            <div className="mb-3 grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface-2/40 p-3 sm:grid-cols-[1fr_1fr_auto]">
              <input className={inp} placeholder="Name (e.g. Zonal Office)" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
              <input className={inp} placeholder="Code (auto)" value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value })} />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-2xs text-muted"><input type="checkbox" checked={nf.allowChild} onChange={(e) => setNf({ ...nf, allowChild: e.target.checked })} /> Allow child</label>
                <Button size="sm" onClick={add}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                <th className="px-3 py-2">Type</th><th className="px-3 py-2 text-center">Allow Child</th><th className="px-3 py-2 text-center">Used</th><th className="px-3 py-2 text-center">Status</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={4} className="px-3 py-6 text-center text-muted">Loading…</td></tr> :
                  rows.map((r) => { const Icon = iconFor(r.icon); return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2/40">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-md" style={{ backgroundColor: (r.color ?? "#64748b") + "22", color: r.color ?? "#64748b" }}><Icon className="h-3.5 w-3.5" /></span>
                          <span className="font-medium text-foreground">{r.name}</span>
                          <span className="font-mono text-2xs text-subtle">{r.code}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => patch(r.id, { allowChild: !r.allowChild })} title="Toggle">
                          {r.allowChild ? <Check className="mx-auto h-4 w-4 text-success" /> : <Ban className="mx-auto h-4 w-4 text-muted" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center text-muted">{r.branchCount}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => patch(r.id, { status: r.status === "active" ? "inactive" : "active" })}>
                          <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge>
                        </button>
                      </td>
                    </tr>
                  ); })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-5 py-3"><Button size="sm" variant="outline" onClick={onClose}>Done</Button></div>
      </div>
    </div>
  );
}

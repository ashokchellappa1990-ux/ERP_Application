"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ItemLineInput, LabourLineInput } from "@/lib/contracts/vehicleMaintenance";

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-foreground focus:border-primary focus:outline-none";

export function ItemLinesEditor({ items, onChange }: { items: ItemLineInput[]; onChange: (rows: ItemLineInput[]) => void }) {
  const [draft, setDraft] = useState<ItemLineInput>({ itemName: "", qty: 1, uom: "", rate: 0 });

  function add() {
    if (!draft.itemName.trim()) return;
    onChange([...items, draft]);
    setDraft({ itemName: "", qty: 1, uom: "", rate: 0 });
  }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-xs">
            <thead><tr className="border-b border-border bg-surface-2/60 text-2xs uppercase tracking-wide text-muted"><th className="px-2 py-1.5 text-left">Item</th><th className="px-2 py-1.5 text-right">Qty</th><th className="px-2 py-1.5 text-left">UOM</th><th className="px-2 py-1.5 text-right">Rate</th><th className="px-2 py-1.5 text-right">Amount</th><th className="px-2 py-1.5"></th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-2 py-1.5">{it.itemName}</td>
                  <td className="px-2 py-1.5 text-right">{it.qty}</td>
                  <td className="px-2 py-1.5">{it.uom ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{it.rate}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{(it.qty * it.rate).toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right"><button onClick={() => remove(i)} className="text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <input value={draft.itemName} onChange={(e) => setDraft((d) => ({ ...d, itemName: e.target.value }))} placeholder="Item name" className={inp + " sm:col-span-2"} />
        <input type="number" min={0} value={draft.qty} onChange={(e) => setDraft((d) => ({ ...d, qty: Number(e.target.value) || 0 }))} placeholder="Qty" className={inp} />
        <input value={draft.uom ?? ""} onChange={(e) => setDraft((d) => ({ ...d, uom: e.target.value }))} placeholder="UOM" className={inp} />
        <input type="number" min={0} value={draft.rate} onChange={(e) => setDraft((d) => ({ ...d, rate: Number(e.target.value) || 0 }))} placeholder="Rate" className={inp} />
      </div>
      <Button size="sm" variant="outline" onClick={add}><Plus className="h-3.5 w-3.5" /> Add Item</Button>
    </div>
  );
}

export function LabourLinesEditor({ labour, onChange }: { labour: LabourLineInput[]; onChange: (rows: LabourLineInput[]) => void }) {
  const [draft, setDraft] = useState<LabourLineInput>({ description: "", hours: null, rate: 0, technician: "" });

  function add() {
    if (!draft.description.trim()) return;
    onChange([...labour, draft]);
    setDraft({ description: "", hours: null, rate: 0, technician: "" });
  }
  function remove(i: number) { onChange(labour.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-2">
      {labour.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-xs">
            <thead><tr className="border-b border-border bg-surface-2/60 text-2xs uppercase tracking-wide text-muted"><th className="px-2 py-1.5 text-left">Description</th><th className="px-2 py-1.5 text-right">Hours</th><th className="px-2 py-1.5 text-right">Rate</th><th className="px-2 py-1.5 text-left">Technician</th><th className="px-2 py-1.5 text-right">Amount</th><th className="px-2 py-1.5"></th></tr></thead>
            <tbody>
              {labour.map((l, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-2 py-1.5">{l.description}</td>
                  <td className="px-2 py-1.5 text-right">{l.hours ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{l.rate}</td>
                  <td className="px-2 py-1.5">{l.technician || "—"}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{((l.hours ?? 1) * l.rate).toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right"><button onClick={() => remove(i)} className="text-muted hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Labour description" className={inp + " sm:col-span-2"} />
        <input type="number" min={0} value={draft.hours ?? ""} onChange={(e) => setDraft((d) => ({ ...d, hours: e.target.value ? Number(e.target.value) : null }))} placeholder="Hours" className={inp} />
        <input type="number" min={0} value={draft.rate} onChange={(e) => setDraft((d) => ({ ...d, rate: Number(e.target.value) || 0 }))} placeholder="Rate" className={inp} />
        <input value={draft.technician ?? ""} onChange={(e) => setDraft((d) => ({ ...d, technician: e.target.value }))} placeholder="Technician" className={inp} />
      </div>
      <Button size="sm" variant="outline" onClick={add}><Plus className="h-3.5 w-3.5" /> Add Labour</Button>
    </div>
  );
}

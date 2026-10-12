"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ChevronDown, Settings2, Save, Building2, MapPin, Phone, Landmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { type BranchData, type BranchNode, subtreeIds } from "./branchShared";
import { isWarehouseEntity } from "@/lib/contracts/warehouse";

interface Props {
  data: BranchData;
  branch: BranchNode | null;          // null = add
  presetParentId?: number | null;     // used when adding a child (or main = null)
  onClose: () => void;
  onSaved: () => void;
}

const inp = "h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm focus:border-primary focus:outline-none";
const lbl = "mb-1 block text-2xs font-semibold uppercase tracking-wide text-subtle";

function Field({ label, children, req }: { label: string; children: React.ReactNode; req?: boolean }) {
  return (
    <div>
      <label className={lbl}>{label}{req && <span className="text-danger"> *</span>}</label>
      {children}
    </div>
  );
}

export function BranchEditor({ data, branch, presetParentId, onClose, onSaved }: Props) {
  const toast = useToast();
  const editing = !!branch;
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const [f, setF] = useState(() => ({
    name: branch?.name ?? "",
    code: branch?.code ?? "",
    entityTypeId: branch?.entityTypeId ?? (data.entityTypes[0]?.id ?? 0),
    warehouseCategoryId: 0,
    parentBranchId: (branch ? branch.parentBranchId : presetParentId ?? null) as number | null,
    status: branch?.status ?? "active",
    manager: branch?.manager ?? "",
    contactPerson: branch?.contactPerson ?? "",
    phone: branch?.phone ?? "",
    email: branch?.email ?? "",
    gstin: branch?.gstin ?? "",
    address: branch?.address ?? "",
    city: branch?.city ?? "",
    state: branch?.state ?? "",
    pincode: branch?.pincode ?? "",
    openTime: branch?.openTime ?? "",
    closeTime: branch?.closeTime ?? "",
    bankName: branch?.bankName ?? "",
    bankAccount: branch?.bankAccount ?? "",
    bankIfsc: branch?.bankIfsc ?? "",
    bankUpi: branch?.bankUpi ?? "",
    defaultCostCenterId: branch?.defaultCostCenterId ?? 0,
    defaultProfitCenterId: branch?.defaultProfitCenterId ?? 0,
    allowChild: branch?.allowChild ?? true,
    displayOrder: branch?.displayOrder ?? 1,
    latitude: branch?.latitude != null ? String(branch.latitude) : "",
    longitude: branch?.longitude != null ? String(branch.longitude) : "",
    remarks: branch?.remarks ?? "",
  }));
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  // Warehouse categories (shown only when the entity type is a warehouse).
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => { fetch("/api/warehouse/options", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setCategories(j.categories); }).catch(() => {}); if (editing && branch?.entityTypeId) fetch(`/api/warehouse/config/${branch.id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok && j.data.warehouseCategoryId) set({ warehouseCategoryId: j.data.warehouseCategoryId }); }).catch(() => {}); /* eslint-disable-next-line */ }, []);

  // When the entity type changes, adopt its default allowChild (user can override).
  useEffect(() => {
    const et = data.entityTypes.find((e) => e.id === f.entityTypeId);
    if (et && !editing) set({ allowChild: et.allowChild });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.entityTypeId]);

  // Parent candidates: any branch that allows children and is not the node itself
  // or one of its descendants (would create a cycle). Indented by level.
  const excluded = useMemo(() => (branch ? subtreeIds(data.branches, branch.id) : new Set<number>()), [branch, data.branches]);
  const parentOptions = useMemo(
    () => data.branches
      .filter((b) => b.allowChild && !excluded.has(b.id))
      .slice()
      .sort((a, z) => (a.hierarchyPath ?? "").localeCompare(z.hierarchyPath ?? "")),
    [data.branches, excluded],
  );

  async function save() {
    if (!f.name.trim()) return toast.error("Branch name is required.");
    if (!f.code.trim()) return toast.error("Branch code is required.");
    setSaving(true);
    try {
      const payload = {
        businessId: data.business?.id,
        name: f.name, code: f.code,
        entityTypeId: f.entityTypeId || null,
        warehouseCategoryId: isWh ? (f.warehouseCategoryId || null) : undefined,
        parentBranchId: f.parentBranchId || null,
        status: f.status,
        manager: f.manager, contactPerson: f.contactPerson, phone: f.phone, email: f.email, gstin: f.gstin,
        address: f.address, city: f.city, state: f.state, pincode: f.pincode, openTime: f.openTime, closeTime: f.closeTime,
        bankName: f.bankName, bankAccount: f.bankAccount, bankIfsc: f.bankIfsc, bankUpi: f.bankUpi,
        defaultCostCenterId: f.defaultCostCenterId || null,
        defaultProfitCenterId: f.defaultProfitCenterId || null,
        allowChild: f.allowChild,
        displayOrder: Number(f.displayOrder) || 1,
        latitude: f.latitude.trim() === "" ? null : Number(f.latitude),
        longitude: f.longitude.trim() === "" ? null : Number(f.longitude),
        remarks: f.remarks,
      };
      const res = await fetch(editing ? `/api/system/branches/${branch!.id}` : "/api/system/branches", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (toast.result(j, editing ? "Branch updated." : "Branch added.")) { onSaved(); onClose(); }
    } finally { setSaving(false); }
  }

  const et = data.entityTypes.find((e) => e.id === f.entityTypeId);
  const isWh = isWarehouseEntity(et ? { name: et.name, code: (et as { code?: string }).code } : null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="my-6 w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-primary-subtle/30 px-5 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              {editing ? `Edit — ${branch!.name}` : f.parentBranchId ? "Add Child Branch" : "Add Main Branch"}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
          {/* Identity */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Branch Name" req><input className={inp} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Chennai Head Office" /></Field>
            <Field label="Branch Code" req><input className={inp} value={f.code} onChange={(e) => set({ code: e.target.value })} placeholder="e.g. CHN-HO" /></Field>
            <Field label="Entity Type" req>
              <select className={inp} value={f.entityTypeId} onChange={(e) => set({ entityTypeId: Number(e.target.value) })}>
                {data.entityTypes.length === 0 && <option value={0}>No entity types</option>}
                {data.entityTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            {isWh && (
              <Field label="Warehouse Category" req>
                <select className={inp} value={f.warehouseCategoryId} onChange={(e) => set({ warehouseCategoryId: Number(e.target.value) })}>
                  <option value={0}>Select category…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Parent Branch">
              <select className={inp} value={f.parentBranchId ?? 0} onChange={(e) => set({ parentBranchId: Number(e.target.value) || null })}>
                <option value={0}>— None (Main / Root) —</option>
                {parentOptions.map((b) => (
                  <option key={b.id} value={b.id}>{`${"— ".repeat(Math.max(0, b.hierarchyLevel - 1))}${b.name} (${b.code})`}</option>
                ))}
              </select>
            </Field>
          </section>

          {/* Contact */}
          <section>
            <div className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-primary"><Phone className="h-3.5 w-3.5" /> Contact</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Manager"><input className={inp} value={f.manager} onChange={(e) => set({ manager: e.target.value })} /></Field>
              <Field label="Contact Person"><input className={inp} value={f.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} /></Field>
              <Field label="Phone"><input className={inp} value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
              <Field label="Email"><input className={inp} value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="GSTIN"><input className={inp} value={f.gstin} onChange={(e) => set({ gstin: e.target.value })} /></Field>
            </div>
          </section>

          {/* Location */}
          <section>
            <div className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-primary"><MapPin className="h-3.5 w-3.5" /> Location</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Address"><input className={inp} value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
              <Field label="City"><input className={inp} value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
              <Field label="State"><input className={inp} value={f.state} onChange={(e) => set({ state: e.target.value })} /></Field>
              <Field label="Pincode"><input className={inp} value={f.pincode} onChange={(e) => set({ pincode: e.target.value })} /></Field>
              <Field label="Open Time"><input className={inp} value={f.openTime} onChange={(e) => set({ openTime: e.target.value })} placeholder="09:00" /></Field>
              <Field label="Close Time"><input className={inp} value={f.closeTime} onChange={(e) => set({ closeTime: e.target.value })} placeholder="21:00" /></Field>
            </div>
          </section>

          {/* Bank */}
          <section>
            <div className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-primary"><Landmark className="h-3.5 w-3.5" /> Bank</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Bank Name"><input className={inp} value={f.bankName} onChange={(e) => set({ bankName: e.target.value })} /></Field>
              <Field label="Account No."><input className={inp} value={f.bankAccount} onChange={(e) => set({ bankAccount: e.target.value })} /></Field>
              <Field label="IFSC"><input className={inp} value={f.bankIfsc} onChange={(e) => set({ bankIfsc: e.target.value })} /></Field>
              <Field label="UPI"><input className={inp} value={f.bankUpi} onChange={(e) => set({ bankUpi: e.target.value })} /></Field>
            </div>
          </section>

          {/* Advanced Configuration (collapsible) */}
          <section className="rounded-xl border border-border">
            <button onClick={() => setAdvanced((v) => !v)} className="flex w-full items-center justify-between px-4 py-2.5 text-left">
              <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-primary"><Settings2 className="h-3.5 w-3.5" /> Advanced Configuration</span>
              <ChevronDown className={cn("h-4 w-4 text-muted transition", advanced && "rotate-180")} />
            </button>
            {advanced && (
              <div className="grid grid-cols-1 gap-3 border-t border-border p-4 sm:grid-cols-2">
                <Field label="Default Cost Centre">
                  <select className={inp} value={f.defaultCostCenterId} onChange={(e) => set({ defaultCostCenterId: Number(e.target.value) })}>
                    <option value={0}>— None —</option>
                    {data.costCentres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
                  </select>
                </Field>
                <Field label="Default Profit Centre">
                  <select className={inp} value={f.defaultProfitCenterId} onChange={(e) => set({ defaultProfitCenterId: Number(e.target.value) })}>
                    <option value={0}>— None —</option>
                    {data.profitCentres.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
                  </select>
                </Field>
                <Field label="Display Order"><input type="number" className={inp} value={f.displayOrder} onChange={(e) => set({ displayOrder: Number(e.target.value) })} /></Field>
                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={f.allowChild} onChange={(e) => set({ allowChild: e.target.checked })} className="h-4 w-4 rounded border-border-strong" />
                    Allow child branches under this node
                  </label>
                </div>
                <Field label="Latitude"><input className={inp} value={f.latitude} onChange={(e) => set({ latitude: e.target.value })} placeholder="13.0827" /></Field>
                <Field label="Longitude"><input className={inp} value={f.longitude} onChange={(e) => set({ longitude: e.target.value })} placeholder="80.2707" /></Field>
                <div className="sm:col-span-2">
                  <Field label="Remarks"><textarea className={cn(inp, "h-16 py-2")} value={f.remarks} onChange={(e) => set({ remarks: e.target.value })} /></Field>
                </div>
              </div>
            )}
          </section>

          {et && !et.allowChild && f.allowChild === false && (
            <p className="text-2xs text-muted">This entity type ({et.name}) is typically a leaf/operating node — it won't allow child branches unless you enable it above.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : editing ? "Save Changes" : "Add Branch"}</Button>
        </div>
      </div>
    </div>
  );
}

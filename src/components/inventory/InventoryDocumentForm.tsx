"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Search, Settings2, CheckCircle2, Save, Package, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { INVENTORY_LISTS, INVENTORY_FORM_META, INVENTORY_FEATURES, INV_CATALOG, invNotesFor, type IFormField, type InvProduct } from "@/lib/inventory/inventoryData";
import { inventoryDocNo } from "@/lib/inventory/inventoryConfig";
import { cn } from "@/lib/cn";

interface Line { product: InvProduct; qty: number }

export function InventoryDocumentForm({ featureKey }: { featureKey: string }) {
  const router = useRouter();
  const meta = INVENTORY_FORM_META[featureKey];
  const list = INVENTORY_LISTS[featureKey];
  const feature = INVENTORY_FEATURES.find((f) => f.key === featureKey);
  const Icon = (feature?.icon ?? Package) as LucideIcon;
  const notes = useMemo(() => invNotesFor(featureKey), [featureKey]);
  const title = list?.title ?? feature?.label ?? "Document";
  const backHref = `/inventory/${featureKey}`;

  const [docFields, setDocFields] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? INV_CATALOG.filter((p) => `${p.code} ${p.name}`.toLowerCase().includes(q)) : INV_CATALOG.slice(0, 6);
  }, [query]);

  function add(p: InvProduct) {
    setLines((ls) => ls.some((l) => l.product.code === p.code) ? ls : [...ls, { product: p, qty: featureKey === "adjustment" ? 0 : 1 }]);
    setQuery("");
  }
  const setQty = (code: string, qty: number) => setLines((ls) => ls.map((l) => l.product.code === code ? { ...l, qty } : l));
  const remove = (code: string) => setLines((ls) => ls.filter((l) => l.product.code !== code));

  if (!meta || !feature) return <div className="p-6 text-sm text-muted">Unknown inventory document.</div>;
  const isItems = meta.kind === "items";
  const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const canSave = (isItems ? lines.length > 0 : true) && meta.fields.filter((f) => f.required).every((f) => (docFields[f.key] ?? "").trim() !== "");

  function save() { if (!canSave) return; setSaved(true); window.setTimeout(() => router.push(backHref), 1200); }

  const renderField = (f: IFormField) => (
    <div key={f.key} className={cn(f.full && "sm:col-span-2 lg:col-span-3")}>
      <label className="mb-1 block text-2xs font-semibold text-muted">{f.label}{f.required && <span className="text-danger"> *</span>}</label>
      {f.type === "select"
        ? <select value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:bg-surface focus:outline-none"><option value="">Select…</option>{f.options?.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        : f.type === "textarea"
          ? <textarea rows={2} value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} placeholder={f.label} className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
          : <input type={f.type} value={docFields[f.key] ?? ""} onChange={(e) => setDocFields({ ...docFields, [f.key]: e.target.value })} placeholder={f.label} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />}
    </div>
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><Link href="/inventory" className="hover:text-foreground">Inventory</Link><span className="text-subtle">/</span><Link href={backHref} className="hover:text-foreground">{title}</Link><span className="text-subtle">/</span><span className="font-medium text-foreground">New</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> New {title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={backHref}><Button variant="ghost" size="md">Cancel</Button></Link>
          <Button variant="outline" size="md" onClick={save} disabled={!canSave}><Save className="h-4 w-4" /> Save Draft</Button>
          <Button size="md" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> {meta.saveLabel}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-subtle/25 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"><Settings2 className="h-4 w-4" /> Inventory policy:</span>
        {notes.map((n, i) => <span key={i} className="rounded-full border border-border bg-surface px-2.5 py-1 text-2xs font-medium text-muted">{n}</span>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-foreground">{title} Details</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{meta.fields.map(renderField)}</div>
          </div>

          {isItems && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-foreground">{featureKey === "adjustment" ? "Items to Adjust (+ excess / − short)" : featureKey === "verification" ? "Items to Count" : "Items"}</p>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search & add product…" className="h-10 w-full rounded-lg border border-border bg-surface-2 pl-10 pr-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" />
                {query && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg">{results.map((p) => <button key={p.code} onClick={() => add(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-primary-subtle/40"><span className="font-medium text-foreground">{p.name}</span><span className="text-2xs text-muted">Stk {p.stock}</span></button>)}{results.length === 0 && <p className="px-3 py-2 text-sm text-muted">No product found.</p>}</div>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="py-2">Item</th><th className="py-2 text-center">System Qty</th><th className="py-2 text-center">{featureKey === "verification" ? "Counted" : featureKey === "adjustment" ? "Adjust (±)" : "Qty"}</th>{featureKey === "verification" && <th className="py-2 text-center">Variance</th>}<th></th></tr></thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.product.code} className="border-b border-border last:border-0">
                        <td className="py-2"><p className="font-medium text-foreground">{l.product.name}</p><p className="text-2xs text-subtle">{l.product.code}</p></td>
                        <td className="py-2 text-center text-muted">{l.product.stock}</td>
                        <td className="py-2 text-center"><input type="number" value={l.qty} onChange={(e) => setQty(l.product.code, Number(e.target.value))} className="h-7 w-20 rounded border border-border bg-surface-2 px-1 text-center text-xs focus:border-primary focus:outline-none" /></td>
                        {featureKey === "verification" && <td className={cn("py-2 text-center font-semibold", l.qty - l.product.stock !== 0 ? "text-danger" : "text-success")}>{l.qty - l.product.stock > 0 ? "+" : ""}{l.qty - l.product.stock}</td>}
                        <td className="py-2 text-right"><button onClick={() => remove(l.product.code)} className="text-danger hover:text-danger/70"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    ))}
                    {lines.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-muted">Search and add products above.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Document</p>
            <div className="space-y-3">
              <div><label className="mb-1 block text-2xs font-semibold text-muted">{title} No.</label><input readOnly value={inventoryDocNo(meta.prefix, 1)} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 font-mono text-sm text-primary" /></div>
              <div><label className="mb-1 block text-2xs font-semibold text-muted">{meta.docDate}</label><input type="date" value={docFields.docDate ?? ""} onChange={(e) => setDocFields({ ...docFields, docDate: e.target.value })} className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm focus:border-primary focus:bg-surface focus:outline-none" /></div>
            </div>
          </div>
          {isItems && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Summary</p>
              <div className="flex items-center justify-between text-sm"><span className="text-muted">Line Items</span><span className="font-semibold text-foreground">{lines.length}</span></div>
              <div className="mt-1 flex items-center justify-between text-base font-bold text-foreground"><span>Total Qty</span><span>{totalQty}</span></div>
            </div>
          )}
          <Button size="lg" className="w-full" onClick={save} disabled={!canSave}><CheckCircle2 className="h-4 w-4" /> {meta.saveLabel}</Button>
          {!canSave && <p className="text-center text-2xs font-medium text-danger">{isItems ? "Add items & required fields." : "Fill required fields."}</p>}
        </aside>
      </div>

      {saved && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-7 text-center shadow-2xl">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success"><CheckCircle2 className="h-7 w-7" /></span>
            <p className="text-sm font-bold text-foreground">{title} saved</p><p className="text-2xs text-muted">Redirecting…</p>
          </div>
        </div>
      )}
    </div>
  );
}

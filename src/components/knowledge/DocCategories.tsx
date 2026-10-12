"use client";

import { useEffect, useState } from "react";
import { FolderTree, Plus } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { useToast } from "@/components/ui/Toast";
import { jget, jsend, type CategoryRow } from "./api";

export function DocCategories() {
  const toast = useToast();
  const [cats, setCats] = useState<CategoryRow[] | null>(null);
  const [name, setName] = useState(""); const [color, setColor] = useState("#2563eb"); const [busy, setBusy] = useState(false);
  const load = () => jget<{ ok: boolean; categories: CategoryRow[] }>("/api/documents/categories").then((j) => j.ok && setCats(j.categories));
  useEffect(() => { load(); }, []);
  const add = async () => { if (!name.trim()) return; setBusy(true); const j = await jsend<{ ok: boolean; message?: string }>("/api/documents/categories", "POST", { name, color }); setBusy(false); if (j.ok) { toast.success("Category added."); setName(""); load(); } else toast.error(j.message || "Failed."); };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white"><FolderTree className="h-5 w-5" /></span> Document Categories</h1>
        <p className="mt-0.5 text-sm text-muted">Configurable classification for every document — Finance, HR, Legal, GST, SOP, Contracts and more.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div><label className="mb-1 block text-2xs font-semibold text-muted">Category name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vendor Agreements" className="h-9 w-56 rounded-lg border border-border bg-surface px-3 text-sm outline-none" /></div>
        <div><label className="mb-1 block text-2xs font-semibold text-muted">Colour</label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 rounded-lg border border-border bg-surface" /></div>
        <button disabled={busy} onClick={add} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-3 text-2xs font-bold text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Add Category</button>
      </div>
      {!cats ? <AppLoader label="Loading categories…" /> : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: c.color ?? "#94a3b8" }} /><span className="text-sm font-semibold text-foreground">{c.name}</span></div>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-semibold text-muted">{c.count} docs</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

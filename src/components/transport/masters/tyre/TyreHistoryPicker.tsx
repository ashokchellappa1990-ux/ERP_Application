"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { History as HistoryIcon, Search } from "lucide-react";
import type { TyreRow } from "@/lib/contracts/tyre";
import { TyreHistory } from "@/components/transport/masters/tyre/TyreHistory";

/** Standalone Tyre History page — a tyre picker wrapping the embeddable
 * <TyreHistory>, which is also reused inside the Master hub's row action
 * and VehicleMasterList's row-icon modal. */
export function TyreHistoryPicker() {
  const searchParams = useSearchParams();
  const preselect = searchParams.get("tyreId");
  const [tyres, setTyres] = useState<TyreRow[]>([]);
  const [tyreId, setTyreId] = useState<number | "">(preselect ? Number(preselect) : "");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch(`/api/transport/tyre/master${q ? `?q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.ok) setTyres(j.rows); });
  }, [q]);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Tyre History</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><HistoryIcon className="h-5 w-5 text-primary" /> Tyre History</h1>
        <p className="mt-0.5 text-sm text-muted">Pick a tyre to see its complete lifecycle timeline — Purchase→Fitting→Inspection→Rotation→Repair/Retreading→Removal→Scrap.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tyre code, serial, brand…" className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none" />
        </div>
        <select value={tyreId} onChange={(e) => setTyreId(Number(e.target.value) || "")} className="h-9 min-w-[220px] rounded-md border border-border bg-surface-2 px-2.5 text-xs text-foreground focus:border-primary focus:outline-none">
          <option value="">— Select a tyre —</option>
          {tyres.map((t) => <option key={t.id} value={t.id}>{t.tyreCode} {t.brand ? `(${t.brand})` : ""}</option>)}
        </select>
      </div>

      {tyreId ? <TyreHistory embedded tyreFilter={tyreId} /> : <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">Select a tyre above to view its history.</div>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { History as HistoryIcon } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { Badge } from "@/components/ui/Badge";
import type { MovementHistoryRow } from "@/lib/contracts/tyre";

const EVENT_TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "info"> = {
  Purchased: "neutral", Fitted: "primary", Removed: "warning", Rotated: "info", Inspected: "info",
  SentForRepair: "warning", RepairCompleted: "success", SentForRetreading: "warning", RetreadReceived: "success",
  WarrantyClaimed: "info", Scrapped: "danger", Sold: "neutral", Lost: "danger", MadeAvailable: "success",
};

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

export function TyreHistory({ embedded, tyreFilter, vehicleFilter }: { embedded?: boolean; tyreFilter?: number; vehicleFilter?: number } = {}) {
  const [rows, setRows] = useState<MovementHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tyreFilter && !vehicleFilter) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const qs = tyreFilter ? `tyreId=${tyreFilter}` : `vehicleId=${vehicleFilter}`;
    const j = await fetch(`/api/transport/tyre/history?${qs}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) setRows(j.rows);
    setLoading(false);
  }, [tyreFilter, vehicleFilter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {!embedded && (
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Tyre History</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><HistoryIcon className="h-5 w-5 text-primary" /> Tyre History</h1>
          <p className="mt-0.5 text-sm text-muted">Complete lifecycle timeline for a tyre — Purchase→Fitting→Inspection→Rotation→Repair/Retreading→Removal→Scrap, in one place.</p>
        </div>
      )}
      {loading ? <AppLoader label="Loading…" size="sm" /> : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No lifecycle events recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
              <Badge tone={EVENT_TONE[r.eventType] ?? "neutral"}>{r.eventType}</Badge>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-muted">
                  <span className="font-semibold text-foreground">{r.tyreCode}</span>
                  {r.vehicleNo && <span>{r.vehicleNo}{r.positionCode ? ` @ ${r.positionCode}` : ""}</span>}
                  {r.odometer != null && <span>{r.odometer.toLocaleString()} km</span>}
                  {r.cost != null && <span>₹{r.cost.toLocaleString()}</span>}
                  <span>{fmt(r.eventAt)}</span>
                  {r.actorName && <span>by {r.actorName}</span>}
                </div>
                {r.remarks && <p className="mt-1 text-xs text-muted">{r.remarks}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

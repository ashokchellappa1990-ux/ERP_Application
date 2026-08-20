"use client";

import { useCallback, useEffect, useState } from "react";
import { FileBarChart } from "lucide-react";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";

const REPORTS = [
  { key: "register", label: "Tyre Register", columns: ["tyreCode", "brand", "size", "status", "purchaseDate", "purchaseCost", "retreadCount"] },
  { key: "life", label: "Tyre Life Report", columns: ["tyreCode", "brand", "firstLifeKm", "retreadLifeKm", "lifeKm"] },
  { key: "cost", label: "Tyre Cost Report", columns: ["tyreCode", "brand", "netCost", "lifeKm", "costPerKm"] },
  { key: "vehicle", label: "Vehicle Tyre Report", columns: ["vehicleNo", "totalTyres", "totalTyreKm", "totalTyreCost", "costPerKm"] },
  { key: "inspection", label: "Tyre Inspection Report", columns: ["inspectionNo", "tyreCode", "inspectionDate", "treadDepthMm", "pressurePsi", "condition"] },
  { key: "failure", label: "Tyre Failure Report", columns: ["tyreCode", "brand", "inspectionDate", "condition", "defectType"] },
] as const;

const LABELS: Record<string, string> = {
  tyreCode: "Tyre Code", brand: "Brand", size: "Size", status: "Status", purchaseDate: "Purchase Date", purchaseCost: "Purchase Cost", retreadCount: "Retreads",
  firstLifeKm: "First Life (km)", retreadLifeKm: "Retread Life (km)", lifeKm: "Total Life (km)", netCost: "Net Cost", costPerKm: "Cost/km",
  vehicleNo: "Vehicle", totalTyres: "Total Tyres", totalTyreKm: "Total Tyre KM", totalTyreCost: "Total Tyre Cost",
  inspectionNo: "Inspection No.", inspectionDate: "Date", treadDepthMm: "Tread (mm)", pressurePsi: "Pressure (psi)", condition: "Condition", defectType: "Defect",
};

export function TyreReports({ embedded }: { embedded?: boolean } = {}) {
  const [type, setType] = useState<(typeof REPORTS)[number]["key"]>("register");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`/api/transport/tyre/reports?type=${type}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (j?.ok) setRows(j.rows);
    setLoading(false);
  }, [type]);
  useEffect(() => { load(); }, [load]);

  const report = REPORTS.find((r) => r.key === type)!;
  const fmt = (col: string, v: unknown) => {
    if (v == null) return "—";
    if (col.endsWith("Date")) return new Date(String(v)).toLocaleDateString("en-IN");
    if (["purchaseCost", "netCost", "costPerKm", "totalTyreCost"].includes(col)) return typeof v === "number" ? `₹${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : String(v);
    if (typeof v === "number") return v.toLocaleString();
    return String(v);
  };

  return (
    <div className="space-y-4">
      {!embedded && (
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Tyre Reports &amp; Analytics</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><FileBarChart className="h-5 w-5 text-primary" /> Tyre Reports &amp; Analytics</h1>
          <p className="mt-0.5 text-sm text-muted">Register, life, cost, vehicle-wise cost, inspection and failure reports — driven by the same lifecycle data as the Tyre Management screens.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {REPORTS.map((r) => (
          <button key={r.key} onClick={() => setType(r.key)} className={cn("rounded-full px-3 py-1.5 text-2xs font-semibold transition", type === r.key ? "bg-primary text-white" : "bg-surface-2 text-muted hover:text-foreground")}>{r.label}</button>
        ))}
      </div>

      {loading ? <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading…" size="sm" /></div> : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-card p-10 text-center text-sm text-muted">No data for this report yet.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead><tr className="border-b border-border bg-surface-2/40 text-2xs uppercase tracking-wide text-muted">
              {report.columns.map((c) => <th key={c} className="px-3 py-2.5 text-left">{LABELS[c] ?? c}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-surface-2/20">
                  {report.columns.map((c) => <td key={c} className="px-3 py-2 text-2xs text-muted first:font-medium first:text-foreground">{fmt(c, r[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  );
}

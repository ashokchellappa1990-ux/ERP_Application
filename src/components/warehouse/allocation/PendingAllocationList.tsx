"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, PackagePlus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";
import { cn } from "@/lib/cn";

interface Row { requestId: number; requestNo: string; requestDate: string; transferType: string | null; source: string; destination: string; priority: string; itemCount: number; requestedQty: number; allocatedQty: number; allocStatus: string }
const PRIO_TONE: Record<string, "danger" | "warning" | "neutral"> = { Urgent: "danger", High: "warning" };
const STATUS_TONE: Record<string, "neutral" | "warning"> = { "Not Allocated": "neutral", "Partially Allocated": "warning" };

export function PendingAllocationList({ embedded }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");

  const load = () => { setRows(null); fetch("/api/warehouse/allocation/pending", { cache: "no-store" }).then((r) => r.json()).then((j) => setRows(j.ok ? j.rows : [])); };
  useEffect(() => { load(); }, []);

  async function allocate(requestId: number) {
    setBusy(requestId); setErr("");
    const j = await fetch("/api/warehouse/allocation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId }) }).then((r) => r.json());
    setBusy(0);
    if (!j.ok) { setErr(j.message || "Could not start allocation."); return; }
    router.push(`/warehouse/transfer/allocation/${j.id}/edit`);
  }

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Warehouse Management</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Pending Allocation</span></div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><ClipboardList className="h-5 w-5 text-primary" /> Pending Allocation</h1>
            <p className="mt-0.5 text-sm text-muted">Approved Stock Transfer Requests awaiting inventory reservation. Start an allocation to reserve stock before dispatch.</p>
          </div>
        </div>
      )}

      {err && <div className="rounded-lg bg-danger-subtle px-3 py-2 text-2xs font-medium text-danger">{err}</div>}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle"><th className="px-4 py-3">Request No.</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Destination</th><th className="px-4 py-3 text-center">Priority</th><th className="px-4 py-3 text-right">Items</th><th className="px-4 py-3 text-right">Requested</th><th className="px-4 py-3 text-right">Allocated</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {rows && rows.map((r) => (
                <tr key={r.requestId} className="border-b border-border last:border-0 hover:bg-primary-subtle/10">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{r.requestNo}</td>
                  <td className="px-4 py-2.5 text-muted">{r.requestDate}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.source}</td>
                  <td className="px-4 py-2.5 text-muted">{r.destination}</td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={PRIO_TONE[r.priority] ?? "neutral"}>{r.priority}</Badge></td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.itemCount}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">{r.requestedQty}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.allocatedQty}</td>
                  <td className="px-4 py-2.5 text-center"><Badge tone={STATUS_TONE[r.allocStatus] ?? "neutral"}>{r.allocStatus}</Badge></td>
                  <td className="px-4 py-2.5 text-right"><Button size="sm" disabled={busy === r.requestId} onClick={() => allocate(r.requestId)}><PackagePlus className="h-3.5 w-3.5" /> {busy === r.requestId ? "…" : r.allocStatus === "Partially Allocated" ? "Continue" : "Allocate"}</Button></td>
                </tr>
              ))}
              {!rows && <tr><td colSpan={10} className="px-4 py-10"><AppLoader label="Loading pending requests…" size="sm" /></td></tr>}
              {rows && rows.length === 0 && <tr><td colSpan={10} className={cn("px-4 py-12 text-center text-sm text-muted")}>No approved requests are awaiting allocation.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

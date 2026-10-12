"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { Attachment, BudgetLogEntry } from "@/lib/contracts/budgetTxn";

/** Attachment upload state shared by the Revision & Transfer add forms. */
export function useTxnAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  async function upload(files: FileList | null) {
    if (!files?.length) return; setUploading(true);
    for (const f of Array.from(files)) {
      const fd = new FormData(); fd.append("file", f);
      const j = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
      if (j?.ok) setAttachments((a) => [...a, j.file]);
    }
    setUploading(false);
  }
  const remove = (i: number) => setAttachments((a) => a.filter((_, j) => j !== i));
  return { attachments, uploading, upload, remove };
}

export function SnapshotCards({ items, inr, highlight }: { items: [string, number][]; inr: (n: number) => string; highlight?: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label} className={cn("rounded-xl border p-2.5", highlight === label ? "border-primary/40 bg-primary-subtle/30" : "border-border bg-surface-2/30")}>
          <p className="text-2xs font-medium text-muted">{label}</p>
          <p className={cn("mt-0.5 text-sm font-bold tracking-tight", label === "Available" ? (value < 0 ? "text-danger" : "text-success") : "text-foreground")}>{inr(value)}</p>
        </div>
      ))}
    </div>
  );
}

export function ApprovalBar({ requestedByName, approvedByName, status, approvedAt, rejectReason, createdAt }: { requestedByName: string | null; approvedByName: string | null; status: string; approvedAt: string | null; rejectReason: string | null; createdAt: string }) {
  const fmtDt = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="mb-2 text-sm font-semibold text-foreground">Approval Details</p>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div><p className="text-2xs text-muted">Requested By</p><p className="font-medium text-foreground">{requestedByName ?? "—"}</p><p className="text-2xs text-subtle">{fmtDt(createdAt)}</p></div>
        <div><p className="text-2xs text-muted">{status === "Rejected" ? "Rejected By" : "Approved By"}</p><p className="font-medium text-foreground">{approvedByName ?? "—"}</p><p className="text-2xs text-subtle">{status === "Pending" ? "Awaiting approval" : fmtDt(approvedAt)}</p></div>
        <div><p className="text-2xs text-muted">Status</p><p className={cn("font-semibold", status === "Approved" ? "text-success" : status === "Rejected" ? "text-danger" : "text-warning")}>{status}</p>{rejectReason && <p className="text-2xs text-danger">{rejectReason}</p>}</div>
      </div>
    </div>
  );
}

const TYPE_TONE: Record<string, string> = {
  "Budget Planning": "text-primary", "Revision (Increase)": "text-success", "Revision (Decrease)": "text-danger",
  "Transfer In": "text-success", "Transfer Out": "text-danger",
};

export function BudgetTimeline({ entries, inr }: { entries: BudgetLogEntry[]; inr: (n: number) => string }) {
  if (!entries.length) return <p className="py-2 text-2xs text-muted">No movements yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead><tr className="border-b border-border text-2xs uppercase tracking-wide text-muted">
          <th className="px-2 py-1.5 text-left">Date</th><th className="px-2 py-1.5 text-left">Type</th><th className="px-2 py-1.5 text-left">Reference</th><th className="px-2 py-1.5 text-left">Head</th>
          <th className="px-2 py-1.5 text-right">Previous</th><th className="px-2 py-1.5 text-right">Amount</th><th className="px-2 py-1.5 text-right">Current</th><th className="px-2 py-1.5 text-center">Status</th><th className="px-2 py-1.5 text-left">By</th>
        </tr></thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="px-2 py-1.5 text-muted">{e.date}</td>
              <td className={cn("px-2 py-1.5 font-medium", TYPE_TONE[e.type] ?? "text-foreground")}>{e.type}</td>
              <td className="px-2 py-1.5 text-2xs text-muted">{e.refNo}</td>
              <td className="px-2 py-1.5 text-foreground">{e.headName}</td>
              <td className="px-2 py-1.5 text-right text-muted">{inr(e.previousBudget)}</td>
              <td className={cn("px-2 py-1.5 text-right font-semibold", e.amount < 0 ? "text-danger" : "text-success")}>{e.amount < 0 ? "−" : "+"}{inr(Math.abs(e.amount))}</td>
              <td className="px-2 py-1.5 text-right font-semibold text-foreground">{inr(e.currentBudget)}</td>
              <td className="px-2 py-1.5 text-center text-2xs">{e.status}</td>
              <td className="px-2 py-1.5 text-2xs text-muted">{e.createdByName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

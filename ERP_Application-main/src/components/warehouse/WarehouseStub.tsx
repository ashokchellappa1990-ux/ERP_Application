import { Warehouse } from "lucide-react";

/** Placeholder for Warehouse Dashboard / Operations / Reports (Phase-2). */
export function WarehouseStub({ title, note }: { title: string; note: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white"><Warehouse className="h-6 w-6" /></span>
        <div><h1 className="text-lg font-bold text-foreground">{title}</h1><p className="text-xs text-muted">Warehouse Management</p></div>
      </div>
      <div className="rounded-2xl border border-dashed border-border-strong bg-card p-12 text-center">
        <p className="text-sm font-semibold text-foreground">Coming soon</p>
        <p className="mx-auto mt-1 max-w-lg text-sm text-muted">{note}</p>
      </div>
    </div>
  );
}

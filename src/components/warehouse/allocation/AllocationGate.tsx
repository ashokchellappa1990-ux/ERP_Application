"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, ArrowRight, X, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppLoader } from "@/components/ui/AppLoader";

/**
 * Config gate. Reads the logged-in branch's Warehouse Configuration; if Stock
 * Allocation is NOT required, it blocks the module and shows the guidance card
 * (per spec) instead of rendering the children.
 */
export function AllocationGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ok" | "blocked">("loading");

  useEffect(() => {
    fetch("/api/warehouse/allocation/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setState(j.ok && j.allocationRequired === false ? "blocked" : "ok"))
      .catch(() => setState("ok"));
  }, []);

  if (state === "loading") return <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Checking warehouse configuration…" size="sm" /></div>;

  if (state === "blocked") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-border bg-primary-subtle/40 px-5 py-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white"><PackageCheck className="h-5 w-5" /></span>
            <h1 className="text-sm font-bold text-foreground">Stock Allocation</h1>
          </div>
          <div className="space-y-4 px-6 py-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-info-subtle text-info"><Info className="h-7 w-7" /></div>
            <div>
              <p className="text-base font-bold text-foreground">Stock Allocation is not required for this Warehouse.</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">Based on the current Warehouse Configuration, inventory can be dispatched directly after the Stock Transfer Request. Please continue with Stock Transfer Dispatch.</p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="md" onClick={() => router.push("/warehouse/transfer/request")}>Go To Stock Transfer Dispatch <ArrowRight className="h-4 w-4" /></Button>
              <Button size="md" variant="outline" onClick={() => router.push("/warehouse")}><X className="h-4 w-4" /> Close</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

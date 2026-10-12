"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { SummaryView } from "@/components/operations/SummaryView";
import type { LiveSummary } from "@/lib/contracts/eod";

export function LiveSummaryTab({ terminalId = "" }: { terminalId?: string }) {
  const [data, setData] = useState<LiveSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const q = terminalId ? `?terminalId=${terminalId}` : "";
    const j = await fetch(`/api/operations/day-close/summary${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (j.ok) setData(j.summary);
    setLoading(false);
  }, [terminalId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-12"><AppLoader label="Aggregating today…" /></div>;
  if (!data) return <div className="py-12 text-center text-sm text-muted">No summary available.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm text-muted"><CalendarDays className="h-4 w-4 text-primary" /> Live for <span className="font-semibold text-foreground">{data.period.date}</span> <Badge tone="neutral">{data.period.level} level</Badge></p>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </div>
      <SummaryView data={data} />
    </div>
  );
}

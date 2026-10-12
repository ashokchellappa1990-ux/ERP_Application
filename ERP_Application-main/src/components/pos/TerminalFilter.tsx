"use client";

import { useEffect, useState } from "react";
import type { TerminalRow } from "@/lib/contracts/posTerminal";

/**
 * Reusable terminal filter dropdown.
 * Fetches active terminals on mount and renders a styled <select> matching the
 * existing filter selects (h-9 rounded-md border border-border bg-surface …).
 */
export function TerminalFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [rows, setRows] = useState<TerminalRow[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/pos/terminals?status=active", { cache: "no-store", signal: ctrl.signal });
        const j = await res.json().catch(() => ({}));
        if (j.ok && Array.isArray(j.rows)) setRows(j.rows);
      } catch { /* ignore */ }
    })();
    return () => ctrl.abort();
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:shadow-focus"
    >
      <option value="">All terminals</option>
      {rows.map((t) => (
        <option key={t.id} value={String(t.id)}>{`${t.code} — ${t.name}`}</option>
      ))}
    </select>
  );
}

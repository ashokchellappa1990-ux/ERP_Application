"use client";

import { useCallback, useEffect, useState } from "react";

/** Client types + lazy per-section fetch for the Inventory Dashboard. */
export interface KpiT { key: string; label: string; unit: "money" | "count" | "qty" | "percent"; value: number; prev: number; growthPct: number; tone: string }
export interface HealthCardT { key: string; label: string; count: number; qty: number; tone: string }
export interface NV { name: string; value: number }
export interface DualPt { name: string; a: number; b: number }
export interface MovementT { trend: NV[]; inOut: DualPt[]; typeMix: NV[]; totalIn: number; totalOut: number; net: number }
export interface AnalyticsT { byCategory: NV[]; byBranch: NV[]; byWarehouse: NV[] }
export interface OperationalT { items: { key: string; label: string; count: number; href: string }[] }
export interface InsightT { key: string; severity: string; title: string; detail: string; metric?: string; href?: string }
export interface FiltersT { options: { categories: string[]; warehouses: string[]; branches: { id: number; name: string }[] } }

export function useSection<T>(section: string, qs: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setError(false);
    try { const j = await fetch(`/api/inventory/dashboard/${section}?${qs}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setData(j as T); else setError(true); }
    catch { setError(true); } finally { setLoading(false); }
  }, [section, qs, enabled]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

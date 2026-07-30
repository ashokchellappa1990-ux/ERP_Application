"use client";

import { useCallback, useEffect, useState } from "react";

/** Client types + lazy per-section fetch for the Sales Command Center. */

export interface NV { name: string; value: number }
export interface KpiT { key: string; label: string; unit: "money" | "count" | "percent"; value: number; prev: number; growthPct: number; spark: number[]; tone: string }
export interface TrendT { granularity: string; points: NV[]; currentTotal: number; growthPct: number }
export interface ScorecardT { overall: number; band: string; subScores: { label: string; score: number }[] }
export interface BranchRow { name: string; value: number; orders: number; growthPct: number }
export interface ExecRow { name: string; sales: number; orders: number }
export interface ActivityRow { id: number; no: string; customer: string; amount: number; date: string; status: string; href: string }
export interface RecentT { orders: ActivityRow[]; invoices: ActivityRow[]; returns: ActivityRow[] }
export interface ProductsT { topRevenue: NV[]; topQty: NV[]; topProfit: NV[]; slow: NV[]; movingCount: number; nonMovingCount: number; activeCount: number }
export interface MixT { byCategory: NV[]; byBrand: NV[]; categoryContribution: NV[]; brandContribution: NV[] }
export interface ReturnsT { trend: NV[]; topReturned: NV[]; returnValue: number; returnPct: number }
export interface CustomersT {
  totals: { totalCustomers: number; activeCustomers: number; inactiveCustomers: number; newCustomers: number; repeatCustomers: number; repeatPct: number };
  byType: NV[]; byCategory: NV[]; byCity: NV[]; byState: NV[]; topCustomers: NV[]; acquisition: NV[];
}
export interface AnalyticsT {
  byBranch: NV[]; byChannel: NV[]; byState: NV[]; byCity: NV[]; byCategory: NV[]; byBrand: NV[]; byCustomerCategory: NV[]; byCustomerType: NV[];
  comparativeMoM: { current: number; previous: number; growthPct: number }; comparativeYoY: { current: number; previous: number; growthPct: number };
  discount: { total: number; pct: number }; cancellation: { value: number; count: number };
  ranking: { topBranch: NV | null; lowBranch: NV | null; topExec: NV | null; lowExec: NV | null };
}
export interface InsightT { key: string; severity: string; title: string; detail: string; metric?: string; href?: string }
export interface RiskT { key: string; category: string; severity: string; title: string; explanation: string; mitigation: string; impactLabel: string; href?: string }
export interface RecT { key: string; title: string; reason: string; expectedBenefit: string; riskLevel: string; estimatedImpact: string; action: { label: string; href: string } }
export interface ForecastT { metric: string; label: string; unit: string; current: number; forecast: number; confidence: number; trendPct: number; series: { name: string; value: number; lower: number; upper: number; forecast: boolean }[] }
export interface FiltersT {
  options: { channels: string[]; branches: { id: number; name: string }[]; customerCategories: string[]; customerTypes: string[]; categories: string[]; brands: string[]; executives: { id: number; name: string }[] };
  role: string | null; tabs: string[];
}

export function useSection<T>(section: string, qs: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setError(false);
    try { const j = await fetch(`/api/sales/command/${section}?${qs}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setData(j as T); else setError(true); }
    catch { setError(true); } finally { setLoading(false); }
  }, [section, qs, enabled]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

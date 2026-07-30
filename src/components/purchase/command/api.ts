"use client";

import { useCallback, useEffect, useState } from "react";

/** Client types + lazy per-section fetch for the Procurement Command Center. */

export interface KpiT { key: string; label: string; unit: "money" | "count" | "percent" | "days"; value: number; prev: number; growthPct: number; spark: number[]; tone: string }
export interface StageT { name: string; count: number; value: number }
export interface TrendT { granularity: string; points: { name: string; value: number }[]; currentTotal: number; growthPct: number }
export interface SupplierT { name: string; spend: number; orders: number; onTimePct: number | null; avgLeadDays: number | null; returnPct: number; rating: number; riskScore: number; outstanding: number; tag: string }
export interface AnalyticsT { byType: NV[]; bySupplier: NV[]; byBuyer: NV[]; byWarehouse: NV[]; byCategory: NV[]; byBrand: NV[]; topProducts: NV[]; leastProducts: NV[] }
export interface NV { name: string; value: number }
export interface DeliveryRow { id: number; poNo: string; supplier: string; date: string; value: number; status: string; href: string }
export interface DeliveryT { counts: { late: number; today: number; upcoming: number; partial: number }; late: DeliveryRow[]; today: DeliveryRow[]; upcoming: DeliveryRow[]; later: DeliveryRow[]; partial: DeliveryRow[] }
export interface ReorderT { belowCount: number; criticalCount: number; outCount: number; items: { name: string; warehouse: string; onHand: number; reorderLevel: number; suggestedQty: number; level: string; leadDays: number }[] }
export interface BudgetT { fy: string; allocated: number; consumed: number; committed: number; remaining: number; utilizationPct: number; variancePct: number; topHeads: { name: string; budget: number; actual: number; pct: number }[]; alerts: string[] }
export interface FinancialT { commitment: number; liability: number; advancePaid: number; outstandingPayables: number; purchaseValue: number; gstInput: number; freight: number; additionalCharges: number; returnValue: number }
export interface ApprovalRow { id: number; no: string; supplier: string; amount: number; date: string; href: string; kind: "invoice" | "order" }
export interface ApprovalsT { invoices: ApprovalRow[]; orders: ApprovalRow[] }
export interface CalendarT { period: string; events: { date: string; type: string; label: string; href?: string }[] }
export interface ScorecardT { overall: number; band: string; subScores: { label: string; score: number }[] }
export interface InsightT { key: string; severity: string; title: string; detail: string; metric?: string; href?: string }
export interface RiskT { key: string; category: string; severity: string; title: string; explanation: string; mitigation: string; impactLabel: string; href?: string }
export interface RecT { key: string; title: string; reason: string; expectedBenefit: string; riskLevel: string; estimatedSavings: string; action: { label: string; href: string } }
export interface ForecastT { metric: string; label: string; unit: string; current: number; forecast: number; confidence: number; trendPct: number; series: { name: string; value: number; lower: number; upper: number; forecast: boolean }[] }
export interface NotifT { id: number; category: string; severity: string; title: string; message: string; href: string | null; status: string; createdAt: string }
export interface FiltersT { options: { suppliers: string[]; buyers: string[]; warehouses: string[]; categories: string[]; purchaseTypes: string[]; statuses: string[] }; role: string | null; tabs: string[] }

export function useSection<T>(section: string, qs: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true); setError(false);
    try { const j = await fetch(`/api/purchase/command/${section}?${qs}`, { cache: "no-store" }).then((r) => r.json()); if (j.ok) setData(j as T); else setError(true); }
    catch { setError(true); } finally { setLoading(false); }
  }, [section, qs, enabled]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload };
}

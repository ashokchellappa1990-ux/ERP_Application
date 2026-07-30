/** Client fetch helpers + shared types for the Decision Intelligence UI. */

export interface FPointT { name: string; value: number; lower?: number; upper?: number; forecast?: boolean }
export interface PredictionT {
  metric: string; label: string; module: string; unit: "money" | "count" | "percent"; goodDirection: string;
  current: number; forecastValue: number; horizonDays: number; method: string; confidence: number; trendPct: number; riskScore: number;
  formattedCurrent: string; formattedForecast: string; series: FPointT[];
  explain: { why: string; historicalComparison: string; dataSources: string[]; rulesApplied: string[]; confidencePct: number; expectedImpact: string };
}
export interface RiskT { key: string; category: string; module: string; severity: "Critical" | "High" | "Medium" | "Low"; probability: number; impact: number; impactLabel: string; title: string; explanation: string; mitigation: string; href?: string }
export interface OppT { key: string; type: string; module: string; title: string; rationale: string; estimatedBenefit: number; benefitLabel: string; confidence: number; href?: string }
export interface RecT { key: string; module: string; title: string; reason: string; impact: string; estimatedBenefit: string; estimatedRisk: string; relatedReports: { label: string; href: string }[]; nextAction?: { label: string; href: string }; priority: number }
export interface HealthT {
  overall: number; band: string; color: string; aiConfidence: number;
  domains: { key: string; label: string; score: number; note: string }[];
  scores: { key: string; label: string; score: number; note: string }[];
  trend: { name: string; value: number }[];
}
export interface OverviewT {
  generatedAt: string; period: string;
  health: { overall: number; band: string; color: string; aiConfidence: number; domains: HealthT["domains"] };
  predictions: PredictionT[]; risks: RiskT[]; opportunities: OppT[]; recommendations: RecT[]; notifications: number;
  counts: { risks: number; opportunities: number; recommendations: number };
}
export interface ScenarioMetricT { key: string; label: string; unit: string; baseline: number; scenario: number; delta: number; deltaPct: number; better: boolean }
export interface ScenarioResultT { inputs: Record<string, number | boolean>; metrics: ScenarioMetricT[]; summary: string }

export const SEV_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = { Critical: "danger", High: "danger", Medium: "warning", Low: "info" };
export const BAND_COLOR: Record<string, string> = { Excellent: "text-success", Good: "text-info", Average: "text-warning", Critical: "text-danger" };

export async function jget<T = unknown>(url: string): Promise<T> { const r = await fetch(url, { cache: "no-store" }); return r.json(); }
export async function jsend<T = unknown>(url: string, method: string, body?: unknown): Promise<T> { const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return r.json(); }

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const qs = (o: Record<string, string | number | undefined>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") p.set(k, String(v)); return p.toString(); };

/** Shared types for the in-app AI Copilot engine. */

export interface AiActor {
  id: number;
  tenantId: number;
  fullName?: string | null;
  role?: string | null;
  roleId?: number | null;
  businessId?: number | null;
  branchId?: number | null;
}

export type ChatRole = "user" | "assistant" | "system";
export interface ChatMessage { role: ChatRole; content: string }

export interface ClaudeResult {
  text: string;
  model: string;
  status: "success" | "error" | "fallback";
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  retries: number;
  error?: string;
}

export interface ResolvedContext {
  terms: { term: string; entity: string; kpi: string | null; moduleKey: string | null; definition: string | null }[];
  modules: { moduleKey: string; name: string; kpis: string[]; questions: string[] }[];
  category: string;
}

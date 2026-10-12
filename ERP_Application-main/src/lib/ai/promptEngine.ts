import type { ChatMessage, ResolvedContext } from "./types";
import type { RegisteredModule } from "./moduleRegistry";
import type { SemanticMatch } from "./semanticLayer";

/**
 * MODULE 2 — PROMPT ENGINE. Builds the system + user prompts dynamically from: a base
 * template, the resolved semantic terms, the registered module context, the user's role
 * and data scope, and the conversation history. Categories: Finance / Sales / Purchase /
 * Inventory / CRM / HR / Dashboard / General.
 */

export const PROMPT_CATEGORIES = ["Finance", "Sales", "Purchase", "Inventory", "CRM", "HR", "Dashboard", "General"] as const;
export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

const BASE_SYSTEM = `You are the One ERP Copilot — an enterprise financial & operations assistant embedded in a multi-tenant Retail ERP + POS.
Rules:
- Be concise, professional and accurate. Prefer short answers, bullet points and tables.
- Use Indian number formatting and ₹ for currency.
- Only discuss the ERP modules and data the user is permitted to access.
- NEVER expose raw database table or column names, SQL, or internal identifiers.
- If a request is outside the user's permission or scope, say so politely.
- If you lack the live figure, explain which screen/report shows it rather than guessing.`;

export function categorize(query: string, modules: RegisteredModule[]): PromptCategory {
  const q = query.toLowerCase();
  const map: [PromptCategory, RegExp][] = [
    ["Finance", /finance|cash|gst|tds|tcs|profit|budget|payable|receivable|ledger|journal|expense|invoice|tax/],
    ["Sales", /sale|revenue|customer|order|pos|billing/],
    ["Purchase", /purchase|supplier|vendor|grn|procure/],
    ["Inventory", /stock|inventory|item|warehouse|batch|serial/],
    ["CRM", /crm|loyalty|membership|lead/],
    ["HR", /hr|payroll|employee|attendance/],
    ["Dashboard", /dashboard|kpi|report|analytics|trend|summary/],
  ];
  for (const [cat, re] of map) if (re.test(q)) return cat;
  // else prefer the category of the first implicated module
  const m = modules[0]?.moduleKey ?? "";
  const byMod: Record<string, PromptCategory> = { finance: "Finance", sales: "Sales", purchase: "Purchase", inventory: "Inventory", crm: "CRM", hr: "HR", dashboard: "Dashboard" };
  return byMod[m] ?? "General";
}

export function buildContext(matches: SemanticMatch[], modules: RegisteredModule[], category: string): ResolvedContext {
  return {
    category,
    terms: matches.map((m) => ({ term: m.term, entity: m.entity, kpi: m.kpi, moduleKey: m.moduleKey, definition: m.definition })),
    modules: modules.map((m) => ({ moduleKey: m.moduleKey, name: m.name, kpis: m.kpis, questions: m.questions })),
  };
}

/** Assemble the final system prompt + message list sent to the Claude Client. */
export function buildPrompt(input: {
  scopeStatement: string;
  context: ResolvedContext;
  history: ChatMessage[];
  userMessage: string;
  systemOverride?: string | null;
  liveData?: string | null;
}): { system: string; messages: ChatMessage[] } {
  const { context } = input;
  const lines: string[] = [input.systemOverride?.trim() || BASE_SYSTEM, "", input.scopeStatement];
  if (input.liveData) { lines.push("", "LIVE FIGURES from the ERP for this question (authoritative — use these exact numbers, do NOT recompute or guess):", input.liveData); }
  if (context.modules.length) {
    lines.push("", "Relevant ERP modules the user can access:");
    for (const m of context.modules) lines.push(`- ${m.name}: KPIs [${m.kpis.slice(0, 8).join(", ")}]`);
  }
  if (context.terms.length) {
    lines.push("", "Business terms resolved from the question:");
    for (const t of context.terms) lines.push(`- "${t.term}" → ${t.entity}${t.kpi ? ` (KPI: ${t.kpi})` : ""}${t.definition ? ` — ${t.definition}` : ""}`);
  }
  lines.push("", `Question category: ${context.category}.`);
  const messages: ChatMessage[] = [...input.history.slice(-8), { role: "user", content: input.userMessage }];
  return { system: lines.join("\n"), messages };
}

/** A useful deterministic answer when Claude is not configured (fallback mode). */
export function fallbackAnswer(context: ResolvedContext, userMessage: string): string {
  const parts: string[] = [];
  parts.push(`I understood your question as a **${context.category}** query.`);
  if (context.terms.length) parts.push(`Business terms detected: ${context.terms.map((t) => `“${t.term}” → ${t.entity}`).join("; ")}.`);
  if (context.modules.length) parts.push(`Relevant modules: ${context.modules.map((m) => m.name).join(", ")}.`);
  parts.push("\nThe live AI model isn't connected yet, so I can't compute the exact figure here. To enable full natural-language answers, an administrator can add an **ANTHROPIC_API_KEY** in Platform → AI Platform → Settings.");
  if (context.modules[0]?.questions?.length) parts.push(`\nMeanwhile you can ask things like: ${context.modules[0].questions.slice(0, 3).map((q) => `“${q}”`).join(", ")}.`);
  void userMessage;
  return parts.join("\n");
}

import { prisma } from "@/lib/db/prisma";
import type { ActiveScope } from "@/lib/auth/scope";
import type { AiActor } from "./types";
import { getAiSettings } from "./config";
import { callClaude, streamClaude } from "./claudeClient";
import { resolveTerms, inferModules } from "./semanticLayer";
import { listModules, getModules } from "./moduleRegistry";
import { canUseAi, allowedModules, scopeStatement } from "./permissionEngine";
import { buildContext, buildPrompt, categorize, fallbackAnswer } from "./promptEngine";
import { createConversation, addMessage, historyMessages } from "./conversationManager";
import { resolveData, type DataAnswer } from "./dataResolver";
import { resolveBi } from "./bi/resolver";
import type { BiAnswer } from "./bi/engine";
import { runCommand, type CommandExtras } from "./command/router";
import { resolveDocs, type DocsAnswer } from "@/lib/documents/retrieval";
import { resolveDecision, type DecisionAnswer } from "@/lib/ai/decision/resolver";

/** Rich structured extras from the BI engine (charts/comparison/KPI/drilldown) + the
 *  command center (navigate/draft). Attached to an answer regardless of the Claude key. */
export interface AnswerExtras { chart?: BiAnswer["chart"]; comparison?: BiAnswer["comparison"]; kpi?: BiAnswer["kpi"]; drilldown?: BiAnswer["drilldown"]; navigate?: CommandExtras["navigate"]; draft?: CommandExtras["draft"]; createMaster?: CommandExtras["createMaster"]; docSources?: DocsAnswer["sources"] }
const biExtras = (b: BiAnswer): AnswerExtras => ({ chart: b.chart, comparison: b.comparison, kpi: b.kpi, drilldown: b.drilldown });

/**
 * THE ORCHESTRATOR — the copilot brain. Wires the engine together for every question:
 *   permission → semantic resolve → module registry context → prompt build →
 *   Claude Client (the ONLY Claude gateway) → persist question + answer → return.
 * ERP modules never touch any of this directly; they only register metadata.
 */

async function prepare(user: AiActor, message: string) {
  const [matches, inferred] = await Promise.all([resolveTerms(user.tenantId, message), inferModules(user.tenantId, message)]);
  const registered = inferred.length ? await getModules(user.tenantId, inferred) : await listModules(user.tenantId);
  const permitted = await allowedModules(user, registered);
  const category = categorize(message, permitted);
  const context = buildContext(matches, permitted.slice(0, 6), category);
  const settings = await getAiSettings(user.tenantId);
  return { context, settings };
}

export interface AskResult {
  conversationId: number; userMessageId: number; assistantMessageId: number;
  answer: string; status: string; model: string; latencyMs: number; tokensOut: number; category: string;
  extras?: AnswerExtras;
}

export async function ask(user: AiActor, opts: { conversationId?: number; message: string; category?: string }, scope?: ActiveScope): Promise<AskResult> {
  if (!(await canUseAi(user))) throw new Error("Not permitted to use the AI copilot.");
  const message = opts.message.trim();
  if (!message) throw new Error("Empty message.");

  const { context, settings } = await prepare(user, message);
  if (!settings.enabled) throw new Error("The AI copilot is disabled for this tenant.");

  // Resolve / create the conversation up front (the command center needs it for the
  // multi-turn "collect missing fields" flow).
  let conversationId = opts.conversationId ?? 0;
  if (conversationId) {
    const owned = await prisma.aiConversation.findFirst({ where: { id: conversationId, tenantId: user.tenantId, userId: user.id }, select: { id: true } });
    if (!owned) conversationId = 0;
  }
  if (!conversationId) { const c = await createConversation(user, message.slice(0, 60), opts.category ?? context.category); conversationId = c.id; }
  const userMsg = await addMessage(user.tenantId, conversationId, { role: "user", content: message, createdBy: user.id, contextJson: JSON.stringify(context) });

  // Phase-3 COMMAND CENTER first — navigate / create-draft / continue-collection. It
  // NEVER posts; it stages a draft or navigates. Deterministic → no Claude call needed.
  const cmd = scope ? await runCommand(user, scope, message, conversationId).catch(() => null) : null;
  if (cmd) {
    const extras: AnswerExtras = { navigate: cmd.extras?.navigate, draft: cmd.extras?.draft, createMaster: cmd.extras?.createMaster };
    const asst = await addMessage(user.tenantId, conversationId, { role: "assistant", content: cmd.text, model: "command-center", status: cmd.kind, createdBy: user.id, contextJson: JSON.stringify({ extras }) });
    return { conversationId, userMessageId: userMsg.id, assistantMessageId: asst.id, answer: cmd.text, status: cmd.kind, model: "command-center", latencyMs: 0, tokensOut: 0, category: "Command", extras };
  }

  // Grounding sources, in priority order. Phase-4 DOCUMENT KNOWLEDGE runs first (strong doc
  // match answers directly); then Phase-5 DECISION INTELLIGENCE for predict/forecast/risk/
  // opportunity/recommend intents; then the Phase-2 BI engine; then the live-data resolver.
  const docs: DocsAnswer | null = scope ? await resolveDocs(scope, message).catch(() => null) : null;
  const decision: DecisionAnswer | null = docs ? null : (scope ? await resolveDecision(scope, message).catch(() => null) : null);
  const bi: BiAnswer | null = (docs || decision) ? null : (scope ? await resolveBi(scope, message).catch(() => null) : null);
  const data: DataAnswer | null = (docs || decision || bi) ? null : (scope ? await resolveData(scope, message).catch(() => null) : null);
  const facts = docs?.facts ?? decision?.facts ?? bi?.facts ?? data?.facts;
  const groundedText = docs?.text ?? decision?.text ?? bi?.text ?? data?.text;
  const extras: AnswerExtras | undefined = docs ? { docSources: docs.sources } : decision ? (decision.chart ? { chart: decision.chart } : undefined) : (bi ? biExtras(bi) : undefined);

  const history = await historyMessages(conversationId);
  const { system, messages } = buildPrompt({ scopeStatement: scopeStatement(user), context, history: history.slice(0, -1), userMessage: message, systemOverride: settings.systemPrompt, liveData: facts });

  // The Claude Client is the sole gateway. With a key it phrases the LIVE FIGURES; with
  // no key the fallback returns the resolved real answer directly (or a generic hint).
  const result = await callClaude({
    system, messages, model: settings.model, maxTokens: settings.maxTokens, temperature: settings.temperature,
    timeoutMs: settings.timeoutMs, maxRetries: settings.maxRetries, tenantId: user.tenantId, userId: user.id, operation: "chat",
    fallback: groundedText ?? fallbackAnswer(context, message),
  });

  const asst = await addMessage(user.tenantId, conversationId, {
    role: "assistant", content: result.text, model: result.model, tokensIn: result.tokensIn, tokensOut: result.tokensOut,
    latencyMs: result.latencyMs, status: result.status, createdBy: user.id, contextJson: extras ? JSON.stringify({ extras }) : null,
  });

  return { conversationId, userMessageId: userMsg.id, assistantMessageId: asst.id, answer: result.text, status: result.status, model: result.model, latencyMs: result.latencyMs, tokensOut: result.tokensOut, category: context.category, extras };
}

/** Streaming variant — yields text chunks, persists the full turn at the end. */
export async function* askStream(user: AiActor, opts: { conversationId?: number; message: string }, scope?: ActiveScope): AsyncGenerator<{ chunk?: string; done?: AskResult }, void, unknown> {
  if (!(await canUseAi(user))) throw new Error("Not permitted.");
  const message = opts.message.trim(); if (!message) throw new Error("Empty message.");
  const { context, settings } = await prepare(user, message);
  if (!settings.enabled) throw new Error("AI copilot disabled.");

  let conversationId = opts.conversationId ?? 0;
  if (conversationId) { const owned = await prisma.aiConversation.findFirst({ where: { id: conversationId, tenantId: user.tenantId, userId: user.id }, select: { id: true } }); if (!owned) conversationId = 0; }
  if (!conversationId) { const c = await createConversation(user, message.slice(0, 60), context.category); conversationId = c.id; }
  const userMsg = await addMessage(user.tenantId, conversationId, { role: "user", content: message, createdBy: user.id, contextJson: JSON.stringify(context) });

  // Command center first (deterministic; never posts). Emitted as one chunk.
  const cmd = scope ? await runCommand(user, scope, message, conversationId).catch(() => null) : null;
  if (cmd) {
    const cx: AnswerExtras = { navigate: cmd.extras?.navigate, draft: cmd.extras?.draft, createMaster: cmd.extras?.createMaster };
    const asst = await addMessage(user.tenantId, conversationId, { role: "assistant", content: cmd.text, model: "command-center", status: cmd.kind, createdBy: user.id, contextJson: JSON.stringify({ extras: cx }) });
    yield { chunk: cmd.text };
    yield { done: { conversationId, userMessageId: userMsg.id, assistantMessageId: asst.id, answer: cmd.text, status: cmd.kind, model: "command-center", latencyMs: 0, tokensOut: 0, category: "Command", extras: cx } };
    return;
  }

  const docs: DocsAnswer | null = scope ? await resolveDocs(scope, message).catch(() => null) : null;
  const decision: DecisionAnswer | null = docs ? null : (scope ? await resolveDecision(scope, message).catch(() => null) : null);
  const bi: BiAnswer | null = (docs || decision) ? null : (scope ? await resolveBi(scope, message).catch(() => null) : null);
  const data: DataAnswer | null = (docs || decision || bi) ? null : (scope ? await resolveData(scope, message).catch(() => null) : null);
  const facts = docs?.facts ?? decision?.facts ?? bi?.facts ?? data?.facts; const groundedText = docs?.text ?? decision?.text ?? bi?.text ?? data?.text;
  const extras: AnswerExtras | undefined = docs ? { docSources: docs.sources } : decision ? (decision.chart ? { chart: decision.chart } : undefined) : (bi ? biExtras(bi) : undefined);

  const history = await historyMessages(conversationId);
  const { system, messages } = buildPrompt({ scopeStatement: scopeStatement(user), context, history: history.slice(0, -1), userMessage: message, systemOverride: settings.systemPrompt, liveData: facts });

  const gen = streamClaude({ system, messages, model: settings.model, maxTokens: settings.maxTokens, temperature: settings.temperature, timeoutMs: settings.timeoutMs, maxRetries: settings.maxRetries, tenantId: user.tenantId, userId: user.id, operation: "stream", fallback: groundedText ?? fallbackAnswer(context, message) });
  let full = "";
  let res = await gen.next();
  while (!res.done) { const chunk = res.value; full += chunk; yield { chunk }; res = await gen.next(); }
  const r = res.value;
  const asst = await addMessage(user.tenantId, conversationId, { role: "assistant", content: r.text || full, model: r.model, tokensIn: r.tokensIn, tokensOut: r.tokensOut, latencyMs: r.latencyMs, status: r.status, createdBy: user.id, contextJson: extras ? JSON.stringify({ extras }) : null });
  yield { done: { conversationId, userMessageId: userMsg.id, assistantMessageId: asst.id, answer: r.text || full, status: r.status, model: r.model, latencyMs: r.latencyMs, tokensOut: r.tokensOut, category: context.category, extras } };
}

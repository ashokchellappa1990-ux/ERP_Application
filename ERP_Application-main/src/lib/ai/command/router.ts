import type { AiActor } from "../types";
import type { ActiveScope } from "@/lib/auth/scope";
import { detectCommandIntent } from "./intent";
import { txByKey, type TxType } from "./transactions";
import { activeDraft, startDraft, attachValidation, cancelDraft, parseFields, missingRequired, patchDraft } from "./drafts";
import { validateDraft, hasTxPermission, type ValidationResult } from "./validate";
import { resolveMaster } from "./masters";
import { logAction } from "./actions";

/**
 * AI COMMAND ROUTER — intent → permission → MASTER cross-validation → validation →
 * draft generator / navigation. It NEVER posts, approves or deletes. Each collected
 * master value (expense head, supplier, customer) is validated against the real master
 * exactly like the module screen; if not found it offers the closest matches + an option
 * to CREATE it in the master (with the user's acknowledgement). Returns null for non-commands.
 */

export interface CommandExtras {
  navigate?: { href: string; label: string };
  draft?: { id: number; txLabel: string; module: string; status: string; targetHref?: string; summary?: string | null; missing?: string[]; issues?: string[]; warnings?: string[] };
  createMaster?: { href: string; label: string };
}
export interface CommandResult { kind: "navigate" | "collect" | "draft" | "blocked"; intent: string; text: string; extras?: CommandExtras; done: boolean }

const CANCEL = /\b(cancel|stop|nevermind|never mind|forget it|abort)\b/i;
const YES_CREATE = /^\s*(create|add|add it|create it|yes,?\s*(create|add|please)?|make it)\b/i;
const USE_ANYWAY = /^\s*(use anyway|use it|use as|continue|proceed|skip|as is|keep it|one-?off|new payee)\b/i;
const askOf = (tx: TxType, key: string | null) => tx.fields.find((f) => f.key === key)?.ask ?? "Anything else?";
const draftChip = (tx: TxType, id: number, status: string, missing?: string[]) => ({ id, txLabel: tx.label, module: tx.module, status, missing });

function draftResult(tx: TxType, draft: { id: number; summary: string | null; targetHref: string }, v: ValidationResult, createMaster?: CommandExtras["createMaster"]): CommandResult {
  const head = `✅ **Draft ready — ${tx.label}**\n${draft.summary ?? tx.label}`;
  const issue = v.issues.length ? `\n\n⚠️ ${v.issues.join(" ")}` : "";
  const warn = v.warnings.length ? `\n\n_Note:_ ${v.warnings.join(" ")}` : "";
  const cta = v.ok ? `\n\nReview it in the **AI Draft Center**, then create the real ${tx.label.toLowerCase()} in the module — nothing is posted until you do.` : "";
  return { kind: "draft", intent: "create", done: true, text: head + issue + warn + cta, extras: { draft: { id: draft.id, txLabel: tx.label, module: tx.module, status: "Draft", targetHref: draft.targetHref, summary: draft.summary, issues: v.issues, warnings: v.warnings }, createMaster } };
}

export async function runCommand(actor: AiActor, scope: ActiveScope, message: string, conversationId?: number | null): Promise<CommandResult | null> {
  const t0 = Date.now();

  // 1) Continue an in-progress collection (with master validation) for this conversation.
  if (conversationId) {
    const draft = await activeDraft(actor.tenantId, conversationId);
    if (draft) {
      const tx = txByKey(draft.txType)!;
      if (CANCEL.test(message)) { await cancelDraft(actor, draft.id); await logAction(actor, { prompt: message, intent: "create", txType: tx.key, module: tx.module, draftId: draft.id, status: "blocked", detail: "cancelled", latencyMs: Date.now() - t0 }); return { kind: "blocked", intent: "create", text: "Okay — I've cancelled that draft.", done: true }; }

      const fields = parseFields(draft.fieldsJson);
      const pending = fields.__pending ? (JSON.parse(fields.__pending) as { key: string; value: string; createHref: string; masterLabel: string }) : null;
      const reply = message.trim();
      let createMaster: CommandExtras["createMaster"] | undefined;
      let validateKey: string | null = null;

      if (pending) {
        if (YES_CREATE.test(reply)) { fields[pending.key] = pending.value; delete fields.__pending; createMaster = { href: `${pending.createHref}?prefillName=${encodeURIComponent(pending.value)}`, label: `Create ${pending.masterLabel} “${pending.value}”` }; }
        else if (USE_ANYWAY.test(reply)) { fields[pending.key] = pending.value; delete fields.__pending; }
        else { fields[pending.key] = reply; delete fields.__pending; validateKey = pending.key; }
      } else {
        if (draft.askKey) fields[draft.askKey] = reply;
        validateKey = draft.askKey;
      }

      // ---- MASTER cross-validation of the just-answered field
      if (validateKey) {
        const vf = tx.fields.find((f) => f.key === validateKey);
        if (vf?.master && (fields[validateKey] ?? "").trim()) {
          const res = await resolveMaster(vf.master, actor.tenantId, fields[validateKey]);
          if (res.ok) { if (res.canonical) fields[validateKey] = res.canonical; if (res.id) fields[`${validateKey}Id`] = String(res.id); }
          else {
            const bad = fields[validateKey];
            delete fields[validateKey];
            fields.__pending = JSON.stringify({ key: validateKey, value: bad, createHref: res.createHref, masterLabel: res.masterLabel });
            await patchDraft(draft.id, { fields, askKey: validateKey, status: "Collecting" });
            await logAction(actor, { prompt: message, intent: "collect", txType: tx.key, module: tx.module, draftId: draft.id, status: "collecting", detail: `${res.masterLabel} not found: ${bad}`, latencyMs: Date.now() - t0 });
            const sugg = res.suggestions.length ? ` Did you mean: **${res.suggestions.join("**, **")}**?` : "";
            return { kind: "collect", intent: "create", done: false, text: `“${bad}” isn't in the ${res.masterLabel} master.${sugg}\nReply the correct name, or **create** to add it to the master, or **use anyway** (as a one-off).`, extras: { draft: draftChip(tx, draft.id, "Collecting") } };
          }
        }
      }

      // ---- advance / finalize
      const missing = missingRequired(tx, fields);
      const askKey = missing[0] ?? null;
      const status = askKey ? "Collecting" : "Draft";
      const summary = status === "Draft" ? tx.summarize(fields) : null;
      await patchDraft(draft.id, { fields, missing, askKey, status, summary });
      if (status === "Collecting") { await logAction(actor, { prompt: message, intent: "collect", txType: tx.key, module: tx.module, draftId: draft.id, status: "collecting", latencyMs: Date.now() - t0 }); return { kind: "collect", intent: "create", done: false, text: askOf(tx, askKey), extras: { draft: draftChip(tx, draft.id, "Collecting", missing), createMaster } }; }
      const v = await validateDraft(actor, tx, fields, scope);
      await attachValidation(draft.id, v);
      await logAction(actor, { prompt: message, intent: "create", txType: tx.key, module: tx.module, draftId: draft.id, target: tx.createHref, status: "draft-created", detail: summary, latencyMs: Date.now() - t0 });
      return draftResult(tx, { id: draft.id, summary, targetHref: tx.createHref }, v, createMaster);
    }
  }

  // 2) Fresh command intent.
  const intent = detectCommandIntent(message);
  if (!intent) return null;

  if (intent.kind === "navigate") {
    await logAction(actor, { prompt: message, intent: "navigate", target: intent.target.href, status: "navigated", detail: intent.target.label, latencyMs: Date.now() - t0 });
    return { kind: "navigate", intent: "navigate", text: `Opening **${intent.target.label}** for you…`, done: true, extras: { navigate: { href: intent.target.href, label: intent.target.label } } };
  }

  const tx = intent.tx;
  if (!(await hasTxPermission(actor, tx))) {
    await logAction(actor, { prompt: message, intent: "create", txType: tx.key, module: tx.module, status: "blocked", detail: "permission denied", latencyMs: Date.now() - t0 });
    return { kind: "blocked", intent: "create", text: `You don't have permission to create a **${tx.label}**. Please ask an administrator for access.`, done: true };
  }
  const draft = await startDraft(actor, scope, tx, conversationId ?? null, message);
  const fields0 = parseFields(draft.fieldsJson);
  if (draft.status === "Collecting") { await logAction(actor, { prompt: message, intent: "create", txType: tx.key, module: tx.module, draftId: draft.id, status: "collecting", latencyMs: Date.now() - t0 }); return { kind: "collect", intent: "create", done: false, text: askOf(tx, draft.askKey), extras: { draft: draftChip(tx, draft.id, "Collecting", draft.missingJson ? JSON.parse(draft.missingJson) : undefined) } }; }
  const v = await validateDraft(actor, tx, fields0, scope);
  await attachValidation(draft.id, v);
  await logAction(actor, { prompt: message, intent: "create", txType: tx.key, module: tx.module, draftId: draft.id, target: tx.createHref, status: "draft-created", detail: draft.summary, latencyMs: Date.now() - t0 });
  return draftResult(tx, draft, v);
}

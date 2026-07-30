import { prisma } from "@/lib/db/prisma";
import type { AiActor } from "../types";
import type { ActiveScope } from "@/lib/auth/scope";
import { TX_TYPES, txByKey, type TxType } from "./transactions";

/** AI draft store + smart field collection. A draft is staged ONLY — never posted. */

export const parseFields = (s: string | null): Record<string, string> => { if (!s) return {}; try { return JSON.parse(s); } catch { return {}; } };
const parse = parseFields;
export const missingRequired = (tx: TxType, fields: Record<string, string>) => tx.fields.filter((f) => f.required && !(fields[f.key] ?? "").trim()).map((f) => f.key);

/** Low-level draft patch used by the validation state machine in the router. */
export async function patchDraft(id: number, data: { fields?: Record<string, string>; missing?: string[]; askKey?: string | null; status?: string; summary?: string | null }) {
  const d: Record<string, unknown> = {};
  if (data.fields) d.fieldsJson = JSON.stringify(data.fields);
  if (data.missing) d.missingJson = JSON.stringify(data.missing);
  if ("askKey" in data) d.askKey = data.askKey;
  if (data.status) d.status = data.status;
  if ("summary" in data) d.summary = data.summary;
  return prisma.aiCommandDraft.update({ where: { id }, data: d });
}

/** Extract obvious values from the initial message (e.g. an amount) to skip a question. */
function prefillFrom(message: string, tx: TxType): Record<string, string> {
  const out: Record<string, string> = {};
  if (tx.fields.some((f) => f.key === "amount")) { const m = message.replace(/,/g, "").match(/(?:rs\.?|inr|₹)?\s*(\d{3,})/i); if (m) out.amount = m[1]; }
  return out;
}

export async function activeDraft(tenantId: number, conversationId: number) {
  return prisma.aiCommandDraft.findFirst({ where: { tenantId, conversationId, status: "Collecting" }, orderBy: { id: "desc" } });
}

export async function startDraft(actor: AiActor, scope: ActiveScope, tx: TxType, conversationId: number | null, message: string) {
  const fields = prefillFrom(message, tx);
  const missing = missingRequired(tx, fields);
  const askKey = missing[0] ?? null;
  const status = askKey ? "Collecting" : "Draft";
  return prisma.aiCommandDraft.create({ data: {
    tenantId: actor.tenantId, businessId: scope.businessId ?? null, branchId: scope.branchId ?? null, userId: actor.id, conversationId,
    module: tx.module, txType: tx.key, txLabel: tx.label, intent: message.slice(0, 200),
    fieldsJson: JSON.stringify(fields), missingJson: JSON.stringify(missing), askKey,
    targetHref: tx.createHref, priority: tx.priority ?? "Medium", status,
    summary: status === "Draft" ? tx.summarize(fields) : null, createdBy: actor.id,
  } });
}

/** Apply the user's reply to the field currently being asked, then advance. */
export async function answerField(draft: { id: number; txType: string; fieldsJson: string | null; askKey: string | null }, value: string) {
  const tx = txByKey(draft.txType)!;
  const fields = parse(draft.fieldsJson);
  if (draft.askKey) fields[draft.askKey] = value.trim();
  const missing = missingRequired(tx, fields);
  const askKey = missing[0] ?? null;
  const status = askKey ? "Collecting" : "Draft";
  return prisma.aiCommandDraft.update({ where: { id: draft.id }, data: {
    fieldsJson: JSON.stringify(fields), missingJson: JSON.stringify(missing), askKey, status,
    summary: status === "Draft" ? tx.summarize(fields) : null,
  } });
}

export async function attachValidation(draftId: number, validation: unknown) {
  await prisma.aiCommandDraft.update({ where: { id: draftId }, data: { validationJson: JSON.stringify(validation) } });
}

export async function listDrafts(actor: AiActor, status?: string) {
  const rows = await prisma.aiCommandDraft.findMany({ where: { tenantId: actor.tenantId, userId: actor.id, ...(status ? { status } : {}) }, orderBy: { id: "desc" }, take: 200 });
  return rows.map(shape);
}
export async function getDraft(actor: AiActor, id: number) {
  const r = await prisma.aiCommandDraft.findFirst({ where: { id, tenantId: actor.tenantId, userId: actor.id } });
  return r ? shape(r) : null;
}
export async function cancelDraft(actor: AiActor, id: number) {
  await prisma.aiCommandDraft.updateMany({ where: { id, tenantId: actor.tenantId, userId: actor.id }, data: { status: "Cancelled", askKey: null } });
}
export async function markSubmitted(actor: AiActor, id: number) {
  await prisma.aiCommandDraft.updateMany({ where: { id, tenantId: actor.tenantId, userId: actor.id, status: "Draft" }, data: { status: "Submitted" } });
}

function shape(r: NonNullable<Awaited<ReturnType<typeof prisma.aiCommandDraft.findFirst>>>) {
  const tx = txByKey(r.txType);
  const fields = parse(r.fieldsJson);
  return {
    id: r.id, module: r.module, txType: r.txType, txLabel: r.txLabel, status: r.status, priority: r.priority,
    summary: r.summary, targetHref: r.targetHref, intent: r.intent, createdAt: r.createdAt.toISOString(),
    fields: tx ? tx.fields.map((f) => ({ label: f.label, value: fields[f.key] ?? "" })) : Object.entries(fields).map(([label, value]) => ({ label, value })),
    values: fields, // raw key→value for one-click prefill into the module screen
    validation: r.validationJson ? JSON.parse(r.validationJson) : null,
  };
}

export const draftCounts = async (actor: AiActor) => {
  const rows = await prisma.aiCommandDraft.groupBy({ by: ["status"], where: { tenantId: actor.tenantId, userId: actor.id }, _count: true });
  const m: Record<string, number> = {}; for (const r of rows) m[r.status] = r._count as number; return m;
};
export { TX_TYPES };

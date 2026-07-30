import { prisma } from "@/lib/db/prisma";
import type { AiActor } from "../types";

/** MODULE 7 — ACTION HISTORY (audit of the command center). */

export async function logAction(actor: AiActor, data: { prompt: string; intent: string; module?: string | null; txType?: string | null; draftId?: number | null; target?: string | null; status: string; detail?: string | null; latencyMs?: number | null }) {
  try {
    const row = await prisma.aiCommandAction.create({ data: {
      tenantId: actor.tenantId, businessId: actor.businessId ?? null, branchId: actor.branchId ?? null, userId: actor.id,
      actionNo: "TMP", prompt: data.prompt.slice(0, 500), intent: data.intent, module: data.module ?? null, txType: data.txType ?? null,
      draftId: data.draftId ?? null, target: data.target ?? null, status: data.status, detail: data.detail?.slice(0, 400) ?? null, latencyMs: data.latencyMs ?? null,
    } });
    await prisma.aiCommandAction.update({ where: { id: row.id }, data: { actionNo: `ACT-${String(row.id).padStart(6, "0")}` } });
    return row.id;
  } catch { return null; }
}

export async function listActions(actor: AiActor, limit = 100) {
  const rows = await prisma.aiCommandAction.findMany({ where: { tenantId: actor.tenantId, userId: actor.id }, orderBy: { id: "desc" }, take: limit });
  return rows.map((r) => ({ id: r.id, actionNo: r.actionNo, prompt: r.prompt, intent: r.intent, module: r.module, txType: r.txType, draftId: r.draftId, target: r.target, status: r.status, detail: r.detail, latencyMs: r.latencyMs, at: r.createdAt.toISOString() }));
}

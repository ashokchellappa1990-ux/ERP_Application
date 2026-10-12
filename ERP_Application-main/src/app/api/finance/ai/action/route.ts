import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

const PERM = "finance";
const Schema = z.object({
  itemType: z.enum(["insight", "alert"]),
  itemKey: z.string().min(1).max(160),
  status: z.enum(["dismissed", "reviewed", "ignored", "resolved", "open"]),
  assignedTo: z.string().max(120).optional(),
  note: z.string().max(300).optional(),
});

// POST /api/finance/ai/action — record a disposition on an insight/alert.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "AiFinanceFeedback" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const d = parsed.data;
  const scope = await getActiveScope(user);
  const businessId = scope.businessId ?? null;

  try {
    // "open" clears any prior disposition (undo).
    if (d.status === "open") {
      await prisma.aiFinanceFeedback.deleteMany({ where: { tenantId: user.tenantId, itemType: d.itemType, itemKey: d.itemKey } });
    } else {
      const existing = await prisma.aiFinanceFeedback.findFirst({ where: { tenantId: user.tenantId, itemType: d.itemType, itemKey: d.itemKey }, select: { id: true } });
      if (existing) await prisma.aiFinanceFeedback.update({ where: { id: existing.id }, data: { status: d.status, assignedTo: d.assignedTo ?? null, note: d.note ?? null, businessId } });
      else await prisma.aiFinanceFeedback.create({ data: { tenantId: user.tenantId, businessId, itemType: d.itemType, itemKey: d.itemKey, status: d.status, assignedTo: d.assignedTo ?? null, note: d.note ?? null, createdBy: user.id } });
    }
    await writeAudit(prisma, user, { action: `ai.finance.${d.status}`, entity: "AiFinanceFeedback", entityId: d.itemKey, summary: `${d.itemType} ${d.itemKey} → ${d.status}`, meta: { itemType: d.itemType, assignedTo: d.assignedTo ?? null }, businessId, branchId: scope.branchId, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: `Marked ${d.status}.` });
  } catch (err) {
    console.error("[finance-ai] action", err);
    return NextResponse.json({ ok: false, message: "Could not save." }, { status: 500 });
  }
}

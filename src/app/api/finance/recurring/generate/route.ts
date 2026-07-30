import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { generateVoucher, advanceSchedule } from "@/lib/finance/recurring";

const PERM = "finance.recurring";

// POST /api/finance/recurring/generate — generate the voucher for a due config, or
// skip the occurrence. Body: { configId, action?: "generate" | "skip", amount?, remarks? }.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "RecurringExecution" });
  if (denied) return denied;

  let b: { configId?: number; action?: string; amount?: number; remarks?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const cfg = await prisma.recurringConfig.findFirst({ where: { id: Number(b.configId), tenantId: user.tenantId } });
  if (!cfg) return NextResponse.json({ ok: false, message: "Configuration not found." }, { status: 404 });
  if (cfg.status !== "Active") return NextResponse.json({ ok: false, message: `Configuration is ${cfg.status}, not Active.` }, { status: 422 });
  // Scope safety: only act within the active business.
  const scope = await getActiveScope(user);
  if (scope.businessId != null && cfg.businessId != null && cfg.businessId !== scope.businessId) return NextResponse.json({ ok: false, message: "Out of scope." }, { status: 403 });

  const dueDate = (cfg.nextExecution || new Date().toISOString().slice(0, 10)).slice(0, 10);

  if (b.action === "skip") {
    const n = await prisma.recurringExecution.count({ where: { tenantId: user.tenantId } });
    const ex = await prisma.recurringExecution.create({ data: { tenantId: user.tenantId, configId: cfg.id, businessId: cfg.businessId, branchId: cfg.branchId, executionNo: `RXN-${String(n + 1).padStart(6, "0")}`, executionDate: new Date().toISOString().slice(0, 10), dueDate, amount: Number(cfg.amount) || 0, status: "Skipped", generatedBy: "user", generatedByUserId: user.id, remarks: b.remarks || "Skipped by user" } });
    await advanceSchedule(prisma, cfg, dueDate);
    await writeAudit(prisma, user, { action: "recurring.skip", entity: "RecurringExecution", entityId: ex.id, summary: `Skipped ${cfg.configNo} due ${dueDate}`, meta: { configNo: cfg.configNo, dueDate }, businessId: cfg.businessId ?? null, branchId: cfg.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, status: "Skipped", message: "Occurrence skipped." });
  }

  try {
    const result = await generateVoucher(prisma, cfg, { userId: user.id, generatedBy: "user", amount: b.amount });
    await writeAudit(prisma, user, {
      action: result.ok ? "recurring.generate" : "recurring.generate_failed", entity: "RecurringExecution", entityId: result.executionId ?? 0,
      summary: result.ok ? `Generated voucher ${result.voucherNo} for ${cfg.configNo}` : `Generation blocked for ${cfg.configNo}: ${result.message}`,
      meta: { configNo: cfg.configNo, voucherNo: result.voucherNo ?? null, status: result.status }, businessId: cfg.businessId ?? null, branchId: cfg.branchId ?? null, ip: requestMeta(req).ip,
    });
    if (!result.ok) return NextResponse.json({ ok: false, message: result.message || "Generation failed.", status: result.status }, { status: 422 });
    return NextResponse.json({ ...result, message: `Voucher ${result.voucherNo ?? ""} generated.` });
  } catch (err) {
    console.error("[recurring] generate error", err);
    return NextResponse.json({ ok: false, message: "Could not generate the voucher." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { normalizeLines, parseLines } from "@/lib/finance/recurring";
import { ConfigSaveSchema, DEFAULT_EXEC_OPTIONS, DEFAULT_NOTIFICATIONS, type RecurringConfigDto, type ExecOptions, type Notifications } from "@/lib/contracts/recurring";

const PERM = "finance.recurring";
const num = (v: unknown) => (v == null ? 0 : Number(v));

function toDto(r: NonNullable<Awaited<ReturnType<typeof prisma.recurringConfig.findFirst>>>, branchName: string | null): RecurringConfigDto {
  const parse = <T,>(j: string | null, d: T): T => { try { return { ...d, ...(j ? JSON.parse(j) : {}) }; } catch { return d; } };
  return {
    id: r.id, businessId: r.businessId, branchId: r.branchId, branchName,
    configNo: r.configNo, name: r.name, description: r.description, txnType: r.txnType as "expense" | "income",
    department: r.department, costCenter: r.costCenter, project: r.project,
    generationMode: r.generationMode as RecurringConfigDto["generationMode"], postingMethod: r.postingMethod,
    headId: r.headId, headName: r.headName, lines: parseLines(r), partyId: r.partyId, partyName: r.partyName, partyType: r.partyType,
    gstApplicable: r.gstApplicable, gstPct: num(r.gstPct), tdsRate: num(r.tdsRate), tcsRate: num(r.tcsRate), budgetValidation: r.budgetValidation,
    amountType: r.amountType as "fixed" | "variable", amount: num(r.amount), minAmount: num(r.minAmount), maxAmount: num(r.maxAmount),
    startDate: r.startDate, endDate: r.endDate, frequency: r.frequency as RecurringConfigDto["frequency"], customDays: r.customDays,
    nextExecution: r.nextExecution, lastExecution: r.lastExecution,
    execOptions: parse<ExecOptions>(r.execOptionsJson, DEFAULT_EXEC_OPTIONS), notifications: parse<Notifications>(r.notificationsJson, DEFAULT_NOTIFICATIONS),
    status: r.status as RecurringConfigDto["status"],
  };
}

// GET — view a configuration.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const r = await prisma.recurringConfig.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!r) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  const allowed = await getAllowedScope(user);
  return NextResponse.json({ ok: true, config: toDto(r, r.branchId == null ? null : allowed.branches.find((b) => b.id === r.branchId)?.name ?? null) });
}

// PUT — update a configuration (blocked once Cancelled/Completed).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "RecurringConfig" });
  if (denied) return denied;
  const cur = await prisma.recurringConfig.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (["Cancelled", "Completed"].includes(cur.status)) return NextResponse.json({ ok: false, message: `A ${cur.status} configuration cannot be edited.` }, { status: 422 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ConfigSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  const allowed = await getAllowedScope(user);
  const branchId = b.branchId && allowed.branches.some((x) => x.id === Number(b.branchId) && x.businessId === cur.businessId) ? Number(b.branchId) : null;
  const nl = await normalizeLines(user.tenantId, b.txnType, b);
  if (!nl.lines.length) return NextResponse.json({ ok: false, message: "Add at least one head with an amount." }, { status: 422 });

  await prisma.recurringConfig.update({
    where: { id: cur.id },
    data: {
      name: b.name, description: b.description ?? null, txnType: b.txnType, branchId, department: b.department ?? null, costCenter: b.costCenter ?? null, project: b.project ?? null,
      generationMode: b.generationMode, postingMethod: b.postingMethod, headId: nl.headId, headName: nl.headName, linesJson: nl.linesJson, partyId: b.partyId ?? null, partyName: b.partyName ?? null, partyType: b.partyType ?? null,
      gstApplicable: b.gstApplicable, gstPct: b.gstPct, tdsRate: b.tdsRate, tcsRate: b.tcsRate, budgetValidation: b.budgetValidation,
      amountType: b.amountType, amount: nl.total, minAmount: b.minAmount, maxAmount: b.maxAmount,
      startDate: b.startDate.slice(0, 10), endDate: b.endDate ? b.endDate.slice(0, 10) : null, frequency: b.frequency, customDays: b.customDays ?? null,
      nextExecution: cur.lastExecution ? cur.nextExecution : b.startDate.slice(0, 10),
      execOptionsJson: JSON.stringify({ ...DEFAULT_EXEC_OPTIONS, ...(b.execOptions ?? {}) }), notificationsJson: JSON.stringify({ ...DEFAULT_NOTIFICATIONS, ...(b.notifications ?? {}) }),
    },
  });
  await writeAudit(prisma, user, { action: "recurring_config.update", entity: "RecurringConfig", entityId: cur.id, summary: `Recurring config ${cur.configNo} updated`, meta: { name: b.name }, businessId: cur.businessId ?? null, branchId: branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Configuration updated." });
}

// PATCH — lifecycle (Activate/Pause/Cancel/Draft) or clone.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "RecurringConfig" });
  if (denied) return denied;
  const cur = await prisma.recurringConfig.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });

  let b: { action?: string; status?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  if (b.action === "clone") {
    const clone = await prisma.$transaction(async (tx) => {
      const c = await tx.recurringConfig.create({ data: {
        tenantId: cur.tenantId, businessId: cur.businessId, branchId: cur.branchId, configNo: "TMP", name: `${cur.name} (Copy)`, description: cur.description, txnType: cur.txnType,
        department: cur.department, costCenter: cur.costCenter, project: cur.project, generationMode: cur.generationMode, postingMethod: cur.postingMethod,
        headId: cur.headId, headName: cur.headName, linesJson: cur.linesJson, partyId: cur.partyId, partyName: cur.partyName, partyType: cur.partyType,
        gstApplicable: cur.gstApplicable, gstPct: cur.gstPct, tdsRate: cur.tdsRate, tcsRate: cur.tcsRate, budgetValidation: cur.budgetValidation,
        amountType: cur.amountType, amount: cur.amount, minAmount: cur.minAmount, maxAmount: cur.maxAmount,
        startDate: cur.startDate, endDate: cur.endDate, frequency: cur.frequency, customDays: cur.customDays, nextExecution: cur.startDate, lastExecution: null,
        execOptionsJson: cur.execOptionsJson, notificationsJson: cur.notificationsJson, status: "Draft", createdBy: user.id,
      } });
      const configNo = `RTC-${String(c.id).padStart(5, "0")}`;
      await tx.recurringConfig.update({ where: { id: c.id }, data: { configNo } });
      return { id: c.id, configNo };
    });
    await writeAudit(prisma, user, { action: "recurring_config.clone", entity: "RecurringConfig", entityId: clone.id, summary: `Cloned ${cur.configNo} → ${clone.configNo}`, meta: { from: cur.configNo }, businessId: cur.businessId ?? null, branchId: cur.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, id: clone.id, configNo: clone.configNo, message: "Configuration cloned." });
  }

  const status = b.status;
  if (!["Active", "Paused", "Cancelled", "Draft"].includes(String(status))) return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 422 });
  if (cur.status === "Cancelled" || cur.status === "Completed") return NextResponse.json({ ok: false, message: `A ${cur.status} configuration cannot change status.` }, { status: 422 });
  await prisma.recurringConfig.update({ where: { id: cur.id }, data: { status: status! } });
  await writeAudit(prisma, user, { action: "recurring_config.status", entity: "RecurringConfig", entityId: cur.id, summary: `Recurring config ${cur.configNo} → ${status}`, meta: { from: cur.status, to: status }, businessId: cur.businessId ?? null, branchId: cur.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, status, message: `Configuration ${status}.` });
}

// DELETE — remove a Draft configuration (executions cascade).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "RecurringConfig" });
  if (denied) return denied;
  const cur = await prisma.recurringConfig.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId }, include: { _count: { select: { executions: true } } } });
  if (!cur) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (cur._count.executions > 0) return NextResponse.json({ ok: false, message: "Cannot delete — this configuration has execution history. Cancel it instead." }, { status: 422 });
  await prisma.recurringConfig.delete({ where: { id: cur.id } });
  await writeAudit(prisma, user, { action: "recurring_config.delete", entity: "RecurringConfig", entityId: cur.id, summary: `Recurring config ${cur.configNo} deleted`, meta: { configNo: cur.configNo }, businessId: cur.businessId ?? null, branchId: cur.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Configuration deleted." });
}

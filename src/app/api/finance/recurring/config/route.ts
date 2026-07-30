import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { normalizeLines } from "@/lib/finance/recurring";
import { ConfigSaveSchema, DEFAULT_EXEC_OPTIONS, DEFAULT_NOTIFICATIONS, type RecurringConfigRow, type Frequency, type GenMode } from "@/lib/contracts/recurring";

const PERM = "finance.recurring";
const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/finance/recurring/config — configuration list.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const branchName = (id: number | null) => (id == null ? null : allowed.branches.find((b) => b.id === id)?.name ?? null);
  const rows = await prisma.recurringConfig.findMany({ where: { tenantId: user.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) }, orderBy: { id: "desc" } });
  const list: RecurringConfigRow[] = rows.map((r) => ({
    id: r.id, configNo: r.configNo, name: r.name, txnType: r.txnType as "expense" | "income",
    scope: r.branchId != null ? "branch" : "company", branchName: branchName(r.branchId),
    generationMode: r.generationMode as GenMode, postingMethod: r.postingMethod, frequency: r.frequency as Frequency,
    startDate: r.startDate, endDate: r.endDate, nextExecution: r.nextExecution, lastExecution: r.lastExecution,
    amount: num(r.amount), status: r.status as RecurringConfigRow["status"],
  }));
  return NextResponse.json({ ok: true, rows: list });
}

// POST /api/finance/recurring/config — create a configuration (Draft).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "RecurringConfig" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ConfigSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const businessId = scope.businessId;
  const branchId = b.branchId && allowed.branches.some((x) => x.id === Number(b.branchId) && x.businessId === businessId) ? Number(b.branchId) : null;
  const nl = await normalizeLines(user.tenantId, b.txnType, b);
  if (!nl.lines.length) return NextResponse.json({ ok: false, message: "Add at least one head with an amount." }, { status: 422 });

  const created = await prisma.$transaction(async (tx) => {
    const c = await tx.recurringConfig.create({
      data: {
        tenantId: user.tenantId, businessId, branchId, configNo: "TMP", name: b.name, description: b.description ?? null, txnType: b.txnType,
        department: b.department ?? null, costCenter: b.costCenter ?? null, project: b.project ?? null,
        generationMode: b.generationMode, postingMethod: b.postingMethod, headId: nl.headId, headName: nl.headName, linesJson: nl.linesJson,
        partyId: b.partyId ?? null, partyName: b.partyName ?? null, partyType: b.partyType ?? null,
        gstApplicable: b.gstApplicable, gstPct: b.gstPct, tdsRate: b.tdsRate, tcsRate: b.tcsRate, budgetValidation: b.budgetValidation,
        amountType: b.amountType, amount: nl.total, minAmount: b.minAmount, maxAmount: b.maxAmount,
        startDate: b.startDate.slice(0, 10), endDate: b.endDate ? b.endDate.slice(0, 10) : null, frequency: b.frequency, customDays: b.customDays ?? null,
        nextExecution: b.startDate.slice(0, 10), lastExecution: null,
        execOptionsJson: JSON.stringify({ ...DEFAULT_EXEC_OPTIONS, ...(b.execOptions ?? {}) }),
        notificationsJson: JSON.stringify({ ...DEFAULT_NOTIFICATIONS, ...(b.notifications ?? {}) }),
        status: "Draft", createdBy: user.id,
      },
    });
    const configNo = `RTC-${String(c.id).padStart(5, "0")}`;
    await tx.recurringConfig.update({ where: { id: c.id }, data: { configNo } });
    return { id: c.id, configNo };
  });

  await writeAudit(prisma, user, {
    action: "recurring_config.create", entity: "RecurringConfig", entityId: created.id,
    summary: `Recurring config ${created.configNo} — ${b.name} (${b.txnType})`,
    meta: { configNo: created.configNo, txnType: b.txnType, frequency: b.frequency, amount: nl.total, heads: nl.lines.length },
    businessId: businessId ?? null, branchId: branchId ?? null, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, id: created.id, configNo: created.configNo, message: "Recurring configuration created." }, { status: 201 });
}

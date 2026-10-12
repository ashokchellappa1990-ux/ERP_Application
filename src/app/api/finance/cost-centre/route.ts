import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { CostCentreSaveSchema, type CostCentreRow } from "@/lib/contracts/costCentre";

const PERM = "system.cost-centre";

// GET /api/finance/cost-centre — cost centre list (flat; UI renders the hierarchy).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const branchName = (id: number | null) => (id == null ? null : allowed.branches.find((b) => b.id === id)?.name ?? null);
  const [rows, childCounts] = await Promise.all([
    prisma.costCentre.findMany({ where: { tenantId: user.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) }, orderBy: [{ code: "asc" }] }),
    prisma.costCentre.groupBy({ by: ["parentId"], where: { tenantId: user.tenantId, parentId: { not: null } }, _count: true }),
  ]);
  const cc = new Map(childCounts.map((c) => [c.parentId, c._count as number]));
  const list: CostCentreRow[] = rows.map((r) => ({
    id: r.id, code: r.code, name: r.name, shortName: r.shortName, department: r.department, manager: r.manager,
    parentId: r.parentId, allowChildren: r.allowChildren, budgetApplicable: r.budgetApplicable, status: r.status as CostCentreRow["status"],
    branchName: branchName(r.branchId), childCount: cc.get(r.id) ?? 0,
  }));
  const branches = allowed.branches.filter((b) => b.businessId === scope.businessId).map((b) => ({ id: b.id, name: b.name }));
  return NextResponse.json({ ok: true, rows: list, branches });
}

// POST /api/finance/cost-centre — create a cost centre (auto code CC-0001).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "CostCentre" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = CostCentreSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const businessId = scope.businessId;
  const branchId = b.branchId && allowed.branches.some((x) => x.id === Number(b.branchId) && x.businessId === businessId) ? Number(b.branchId) : null;
  // A child must have an allow-children parent within the tenant.
  if (b.parentId) { const p = await prisma.costCentre.findFirst({ where: { id: Number(b.parentId), tenantId: user.tenantId } }); if (!p) return NextResponse.json({ ok: false, message: "Parent cost centre not found." }, { status: 422 }); if (!p.allowChildren) return NextResponse.json({ ok: false, message: `"${p.name}" does not allow child cost centres.` }, { status: 422 }); }

  const created = await prisma.$transaction(async (tx) => {
    const c = await tx.costCentre.create({ data: {
      tenantId: user.tenantId, businessId, branchId, code: "TMP", name: b.name, shortName: b.shortName ?? null, description: b.description ?? null,
      department: b.department ?? null, parentId: b.parentId ?? null, allowChildren: b.allowChildren, manager: b.manager ?? null,
      budgetApplicable: b.budgetApplicable, status: b.status, effectiveFrom: b.effectiveFrom ?? null, effectiveTo: b.effectiveTo ?? null, remarks: b.remarks ?? null, createdBy: user.id,
    } });
    const code = `CC-${String(c.id).padStart(4, "0")}`;
    await tx.costCentre.update({ where: { id: c.id }, data: { code } });
    return { id: c.id, code };
  });
  await writeAudit(prisma, user, { action: "cost_centre.create", entity: "CostCentre", entityId: created.id, summary: `Cost centre ${created.code} — ${b.name}`, meta: { code: created.code, name: b.name, parentId: b.parentId ?? null }, businessId: businessId ?? null, branchId: branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, code: created.code, message: "Cost centre created." }, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ProfitCentreSaveSchema, type ProfitCentreRow } from "@/lib/contracts/costCentre";

const PERM = "system.profit-centre";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const branchName = (id: number | null) => (id == null ? null : allowed.branches.find((b) => b.id === id)?.name ?? null);
  const [rows, childCounts] = await Promise.all([
    prisma.profitCentre.findMany({ where: { tenantId: user.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) }, orderBy: [{ code: "asc" }] }),
    prisma.profitCentre.groupBy({ by: ["parentId"], where: { tenantId: user.tenantId, parentId: { not: null } }, _count: true }),
  ]);
  const cc = new Map(childCounts.map((c) => [c.parentId, c._count as number]));
  const list: ProfitCentreRow[] = rows.map((r) => ({
    id: r.id, code: r.code, name: r.name, businessUnit: r.businessUnit, division: r.division, manager: r.manager,
    parentId: r.parentId, status: r.status as ProfitCentreRow["status"], branchName: branchName(r.branchId), childCount: cc.get(r.id) ?? 0,
  }));
  const branches = allowed.branches.filter((b) => b.businessId === scope.businessId).map((b) => ({ id: b.id, name: b.name }));
  return NextResponse.json({ ok: true, rows: list, branches });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ProfitCentre" });
  if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = ProfitCentreSaveSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  const scope = await getActiveScope(user);
  const allowed = await getAllowedScope(user);
  const businessId = scope.businessId;
  const branchId = b.branchId && allowed.branches.some((x) => x.id === Number(b.branchId) && x.businessId === businessId) ? Number(b.branchId) : null;
  if (b.parentId) { const p = await prisma.profitCentre.findFirst({ where: { id: Number(b.parentId), tenantId: user.tenantId } }); if (!p) return NextResponse.json({ ok: false, message: "Parent profit centre not found." }, { status: 422 }); }

  const created = await prisma.$transaction(async (tx) => {
    const c = await tx.profitCentre.create({ data: {
      tenantId: user.tenantId, businessId, branchId, code: "TMP", name: b.name, description: b.description ?? null,
      businessUnit: b.businessUnit ?? null, division: b.division ?? null, parentId: b.parentId ?? null, manager: b.manager ?? null,
      status: b.status, effectiveDate: b.effectiveDate ?? null, remarks: b.remarks ?? null, createdBy: user.id,
    } });
    const code = `PC-${String(c.id).padStart(4, "0")}`;
    await tx.profitCentre.update({ where: { id: c.id }, data: { code } });
    return { id: c.id, code };
  });
  await writeAudit(prisma, user, { action: "profit_centre.create", entity: "ProfitCentre", entityId: created.id, summary: `Profit centre ${created.code} — ${b.name}`, meta: { code: created.code, name: b.name }, businessId: businessId ?? null, branchId: branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: created.id, code: created.code, message: "Profit centre created." }, { status: 201 });
}

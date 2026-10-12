import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { loadingOperatorInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

function toRow(r: { id: number; name: string; status: string; remarks: string | null }) {
  return { id: r.id, name: r.name, status: r.status, remarks: r.remarks };
}

// GET /api/transport/masters/loading-operator — list loading operators (tenant/business/branch scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.LoadingOperatorWhereInput = { ...scopeWhere(scope, { branch: true }), deletedAt: null };
  if (q) where.name = { contains: q };
  if (status && status !== "All") where.status = status;

  const rows = await prisma.loadingOperator.findMany({ where, orderBy: { id: "desc" }, take: 500 });
  return NextResponse.json({ ok: true, rows: rows.map(toRow) });
}

// POST /api/transport/masters/loading-operator — create a loading operator.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoadingOperator" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = loadingOperatorInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  try {
    const created = await prisma.loadingOperator.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        name: b.name, status: b.status, remarks: b.remarks ?? null, createdBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_loading_operator.create", entity: "LoadingOperator", entityId: created.id,
      summary: `Created loading operator ${created.name}`, meta: { name: created.name },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, id: created.id, row: toRow(created), message: "Loading operator created." }, { status: 201 });
  } catch (err) {
    console.error("[transport/loading-operator] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the loading operator." }, { status: 500 });
  }
}

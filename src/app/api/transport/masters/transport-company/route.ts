import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { transportCompanyInput } from "@/lib/contracts/transport";

const PERM = "masters.transport";

function toRow(r: {
  id: number; code: string; name: string; contactPerson: string | null; phone: string | null;
  gstin: string | null; address: string | null; status: string; remarks: string | null;
}) {
  return {
    id: r.id, code: r.code, name: r.name, contactPerson: r.contactPerson, phone: r.phone,
    gstin: r.gstin, address: r.address, status: r.status, remarks: r.remarks,
  };
}

// GET /api/transport/masters/transport-company — list transport companies (tenant/business/branch scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.TransportCompanyWhereInput = { ...scopeWhere(scope, { branch: true }), deletedAt: null };
  if (q) where.OR = [{ code: { contains: q } }, { name: { contains: q } }, { contactPerson: { contains: q } }, { phone: { contains: q } }, { gstin: { contains: q } }];
  if (status && status !== "All") where.status = status;

  const rows = await prisma.transportCompany.findMany({ where, orderBy: { id: "desc" }, take: 500 });
  return NextResponse.json({ ok: true, rows: rows.map(toRow) });
}

// POST /api/transport/masters/transport-company — create a transport company.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TransportCompany" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = transportCompanyInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const seg = await resolveWriteScope(user);
  try {
    const created = await prisma.transportCompany.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        code: b.code, name: b.name, contactPerson: b.contactPerson ?? null, phone: b.phone ?? null,
        gstin: b.gstin ?? null, address: b.address ?? null, status: b.status, remarks: b.remarks ?? null,
        createdBy: user.id,
      },
    });
    await writeAudit(prisma, user, {
      action: "transport_company.create", entity: "TransportCompany", entityId: created.id,
      summary: `Created transport company ${created.code} — ${created.name}`, meta: { code: created.code, name: created.name },
      businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, id: created.id, row: toRow(created), message: "Transport company created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: "A transport company with this code already exists.", errors: { code: "Already in use." } }, { status: 409 });
    }
    console.error("[transport/transport-company] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the transport company." }, { status: 500 });
  }
}

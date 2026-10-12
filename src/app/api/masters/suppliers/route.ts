import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { SupplierCreateSchema, type SupplierRow } from "@/lib/contracts/masters";
import { toSupplierData, toSupplierAddressRows, toSupplierRow } from "@/lib/masters/supplierData";

const PERM = "masters.supplier";

// GET /api/masters/suppliers — list / search suppliers (tenant-scoped).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const category = (url.searchParams.get("category") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim();
  const where: Prisma.SupplierWhereInput = scopeWhere(await getActiveScope(user), { branch: true });
  if (q) where.OR = [{ name: { contains: q } }, { gstin: { contains: q } }, { phone: { contains: q } }, { code: { contains: q } }];
  if (category && category !== "All") where.category = { in: category.split(",").map((c) => c.trim()).filter(Boolean) };
  if (status && status !== "All") where.status = status;

  const rows = await prisma.supplier.findMany({ where, orderBy: { name: "asc" }, take: 500 });
  const suppliers: SupplierRow[] = rows.map(toSupplierRow);
  return NextResponse.json({ ok: true, suppliers });
}

// POST /api/masters/suppliers — create (or reuse by name) a supplier + addresses.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "Supplier" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = SupplierCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const name = (b.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, message: "Supplier name is required.", errors: { name: "Required." } }, { status: 422 });

  // Reuse an existing same-name supplier (idempotent pick-or-create for purchase flows).
  const existing = await prisma.supplier.findFirst({ where: { tenantId: user.tenantId, name } });
  if (existing) return NextResponse.json({ ok: true, id: existing.id, reused: true, supplier: toSupplierRow(existing) });

  try {
    const seg = await resolveWriteScope(user, b.scopeBranchId);
    const data = toSupplierData(b as Record<string, unknown>);
    const addresses = toSupplierAddressRows(user.tenantId, b as Record<string, unknown>);
    const created = await prisma.supplier.create({
      data: {
        ...(data as Prisma.SupplierUncheckedCreateInput), name,
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        ...(addresses.length ? { addresses: { createMany: { data: addresses } } } : {}),
      },
    });
    await writeAudit(prisma, user, {
      action: "supplier.create", entity: "Supplier", entityId: created.id, summary: `Created supplier ${created.name}`,
      meta: { name: created.name, category: created.category, code: created.code }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, id: created.id, supplier: toSupplierRow(created) }, { status: 201 });
  } catch (err) {
    console.error("[suppliers] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the supplier." }, { status: 500 });
  }
}

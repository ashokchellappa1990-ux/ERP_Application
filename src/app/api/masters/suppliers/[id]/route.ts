import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { SupplierCreateSchema } from "@/lib/contracts/masters";
import { toSupplierData, toSupplierAddressRows, toSupplierDetail } from "@/lib/masters/supplierData";

const PERM = "masters.supplier";

// GET /api/masters/suppliers/[id] — full supplier detail + addresses (for view/edit).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const r = await prisma.supplier.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId }, include: { addresses: { orderBy: { id: "asc" } } } });
  if (!r) return NextResponse.json({ ok: false, message: "Supplier not found." }, { status: 404 });
  return NextResponse.json({ ok: true, supplier: toSupplierDetail(r, r.addresses) });
}

// PUT /api/masters/suppliers/[id] — update a supplier + replace its addresses.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.supplier.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Supplier not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "Supplier", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = SupplierCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  if (!(b.name ?? "").trim()) return NextResponse.json({ ok: false, message: "Supplier name is required." }, { status: 422 });

  try {
    const data = toSupplierData(b as Record<string, unknown>);
    const addresses = toSupplierAddressRows(user.tenantId, b as Record<string, unknown>);
    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({ where: { id }, data });
      await tx.supplierAddress.deleteMany({ where: { supplierId: id } });
      if (addresses.length) await tx.supplierAddress.createMany({ data: addresses.map((a) => ({ ...a, supplierId: id })) });
    });
    await writeAudit(prisma, user, { action: "supplier.update", entity: "Supplier", entityId: id, summary: `Updated supplier ${(b.name ?? "").trim()}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, id, message: "Supplier updated." });
  } catch (err) {
    console.error("[suppliers] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the supplier." }, { status: 500 });
  }
}

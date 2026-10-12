import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { CustomerCreateSchema } from "@/lib/contracts/masters";
import { toCustomerData, toAddressRows, toCustomerDetail } from "@/lib/masters/customerData";

const PERM = "masters.customer";

// GET /api/masters/customers/[id] — full customer detail + addresses (for view/edit).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const c = await prisma.customer.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId }, include: { addresses: { orderBy: { id: "asc" } } } });
  if (!c) return NextResponse.json({ ok: false, message: "Customer not found." }, { status: 404 });
  return NextResponse.json({ ok: true, customer: toCustomerDetail(c, c.addresses) });
}

// PUT /api/masters/customers/[id] — update a customer + replace its addresses.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const existing = await prisma.customer.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true, businessId: true, branchId: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "Customer not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "Customer", entityId: id, businessId: existing.businessId, branchId: existing.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = CustomerCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  if (!(b.name ?? "").trim()) return NextResponse.json({ ok: false, message: "Customer name is required." }, { status: 422 });

  try {
    const data = toCustomerData(b as Record<string, unknown>);
    const addresses = toAddressRows(user.tenantId, b as Record<string, unknown>);
    await prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id }, data });
      await tx.customerAddress.deleteMany({ where: { customerId: id } });
      if (addresses.length) await tx.customerAddress.createMany({ data: addresses.map((a) => ({ ...a, customerId: id })) });
    });
    await writeAudit(prisma, user, { action: "customer.update", entity: "Customer", entityId: id, summary: `Updated customer ${(b.name ?? "").trim()}`, businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, id, message: "Customer updated." });
  } catch (err) {
    console.error("[customers] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the customer." }, { status: 500 });
  }
}

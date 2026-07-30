import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { CustomerCreateSchema, type CustomerRow } from "@/lib/contracts/masters";
import { toCustomerData, toAddressRows, toCustomerRow } from "@/lib/masters/customerData";

const PERM = "masters.customer";

// GET /api/masters/customers?q=  — list / search customers (name / phone / code).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const where: Prisma.CustomerWhereInput = scopeWhere(await getActiveScope(user), { branch: true });
  if (q) where.OR = [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }, { code: { contains: q } }];
  if (status !== "All") where.status = status;

  const rows = await prisma.customer.findMany({ where, orderBy: { name: "asc" }, take: 200 });
  const customers: CustomerRow[] = rows.map(toCustomerRow);
  return NextResponse.json({ ok: true, customers });
}

// POST /api/masters/customers — create (or reuse by phone) a customer + addresses.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "Customer" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = CustomerCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const name = (b.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, message: "Customer name is required.", errors: { name: "Required." } }, { status: 422 });

  // Reuse an existing customer with the same phone (POS quick-add behaviour).
  const phone = (b.phone ?? "").trim();
  if (phone) {
    const existing = await prisma.customer.findFirst({ where: { tenantId: user.tenantId, phone } });
    if (existing) return NextResponse.json({ ok: true, id: existing.id, reused: true, customer: toCustomerRow(existing) });
  }

  try {
    const seg = await resolveWriteScope(user, b.scopeBranchId);
    const data = toCustomerData(b as Record<string, unknown>);
    const addresses = toAddressRows(user.tenantId, b as Record<string, unknown>);
    const c = await prisma.customer.create({
      data: {
        ...(data as Prisma.CustomerUncheckedCreateInput), name,
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        ...(addresses.length ? { addresses: { createMany: { data: addresses } } } : {}),
      },
    });
    await writeAudit(prisma, user, {
      action: "customer.create", entity: "Customer", entityId: c.id, summary: `Created customer ${c.name}`,
      meta: { name: c.name, phone: c.phone, code: c.code }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, id: c.id, customer: toCustomerRow(c) }, { status: 201 });
  } catch (err) {
    console.error("[customers] create error", err);
    return NextResponse.json({ ok: false, message: "Could not save the customer." }, { status: 500 });
  }
}

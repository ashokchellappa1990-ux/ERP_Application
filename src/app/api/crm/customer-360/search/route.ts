import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { C360SearchRow } from "@/lib/contracts/customer360";

// GET /api/crm/customer-360/search?q= — find a customer (name/code/phone/email/GST).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "crm.customer-360");
  if (denied) return denied;

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const sw = scopeWhere(await getActiveScope(user), { branch: false }) as Prisma.CustomerWhereInput;
  const where: Prisma.CustomerWhereInput = { ...sw };
  if (q) where.OR = [{ name: { contains: q } }, { code: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }, { gstin: { contains: q } }];

  const rows = await prisma.customer.findMany({ where, orderBy: { name: "asc" }, take: 25, select: { id: true, code: true, name: true, phone: true, email: true, gstin: true, city: true, status: true } });
  const customers: C360SearchRow[] = rows.map((c) => ({ id: c.id, code: c.code ?? `CUST-${c.id}`, name: c.name, phone: c.phone ?? "", email: c.email ?? "", gstin: c.gstin ?? "", city: c.city ?? "", status: c.status ?? "Active" }));
  return NextResponse.json({ ok: true, customers });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";

// GET /api/system/branches/me — the signed-in user's own branch (full record incl.
// bank details) for the dashboard "View Branch Setup" read-only panel. A branch
// user resolves to their assigned branch; otherwise the active business's default.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });

  const scope = await getActiveScope(user);
  const where = scope.branchId
    ? { id: scope.branchId, tenantId: user.tenantId }
    : { tenantId: user.tenantId, ...(scope.businessId ? { businessId: scope.businessId } : {}), isDefault: true };

  const branch = await prisma.branch.findFirst({
    where,
    include: { business: { select: { name: true, gstNumber: true } } },
  }) ?? (scope.businessId ? await prisma.branch.findFirst({ where: { tenantId: user.tenantId, businessId: scope.businessId }, include: { business: { select: { name: true, gstNumber: true } } }, orderBy: { id: "asc" } }) : null);

  if (!branch) return NextResponse.json({ ok: false, message: "No branch is set up for your account yet." }, { status: 404 });

  return NextResponse.json({
    ok: true,
    branch: {
      id: branch.id, name: branch.name, code: branch.code, type: branch.type, status: branch.status, isDefault: branch.isDefault,
      manager: branch.manager ?? "", contactPerson: branch.contactPerson ?? "", phone: branch.phone ?? "", email: branch.email ?? "",
      gstin: branch.gstin ?? "", address: branch.address ?? "", city: branch.city ?? "", state: branch.state ?? "", pincode: branch.pincode ?? "",
      openTime: branch.openTime ?? "", closeTime: branch.closeTime ?? "",
      bankName: branch.bankName ?? "", bankAccount: branch.bankAccount ?? "", bankIfsc: branch.bankIfsc ?? "", bankUpi: branch.bankUpi ?? "",
      businessName: branch.business?.name ?? "", businessGstin: branch.business?.gstNumber ?? "",
    },
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, getAllowedScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import type { BankOption } from "@/lib/contracts/eodTransfer";

// GET /api/operations/day-close/banks — bank accounts in scope (from Banking/Branch
// Setup), same rule as the Opening Balance screen: a branch user sees only their
// branch's banks; business/owner sees business-level + branch banks.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "operations.day-close");
  if (denied) return denied;

  const [scope, allowed] = await Promise.all([getActiveScope(user), getAllowedScope(user)]);
  const branchOr = allowed.lockBranch
    ? [{ branchId: { in: scope.readBranchIds } }]
    : [{ branchId: null }, { branchId: { in: scope.readBranchIds } }];
  const rows = await prisma.setupBank.findMany({
    where: { setup: { tenantId: user.tenantId }, ...(scope.businessId ? { businessId: scope.businessId } : {}), OR: branchOr },
    orderBy: { id: "asc" },
    select: { id: true, bankName: true, account: true },
  });
  const banks: BankOption[] = rows.map((b) => ({ id: b.id, bankName: b.bankName ?? "Bank", account: b.account ?? "" }));
  return NextResponse.json({ ok: true, banks });
}

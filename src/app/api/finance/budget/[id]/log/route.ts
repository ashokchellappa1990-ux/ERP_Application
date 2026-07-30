import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { buildBudgetLog } from "@/lib/finance/budgetTxn";

// GET /api/finance/budget/:id/log[?headId=] — read-only budget movement log/timeline.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "finance.budget");
  if (denied) return denied;

  const header = await prisma.budgetHeader.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId }, select: { id: true } });
  if (!header) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  const headId = Number(new URL(req.url).searchParams.get("headId")) || undefined;
  const log = await buildBudgetLog(prisma, header.id, headId);
  return NextResponse.json({ ok: true, log });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { loadDeliveryChallanDetail } from "@/lib/transport/deliveryChallan";

const PERM = "transport";

/** POST /api/transport/delivery-challan/[id]/print — bumps printedCount, flips
 *  Generated -> Printed, then returns the same detail payload as GET [id]. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const id = Number(params.id);
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const existing = await prisma.deliveryChallan.findFirst({ where: { id, ...sw } });
  if (!existing) return NextResponse.json({ ok: false, message: "Delivery challan not found." }, { status: 404 });

  await prisma.deliveryChallan.update({
    where: { id },
    data: {
      printedCount: { increment: 1 },
      status: existing.status === "Generated" ? "Printed" : existing.status,
    },
  });

  const detail = await loadDeliveryChallanDetail(id, sw);
  if (!detail) return NextResponse.json({ ok: false, message: "Delivery challan not found." }, { status: 404 });
  return NextResponse.json({ ok: true, dc: detail });
}

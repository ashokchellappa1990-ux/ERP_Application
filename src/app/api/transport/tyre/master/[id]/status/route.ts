import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { tyreStatusInput } from "@/lib/contracts/tyre";
import { logTyreMovement } from "@/lib/transport/tyre";

const PERM = "transport.tyre";
type Action = "makeAvailable" | "scrap" | "sell" | "reportLost" | "fileWarrantyClaim";
// Rule #6: a scrapped tyre can never be fitted again — scrap allows Available/
// Removed/Under Inspection/Under Repair but never a currently-Fitted tyre.
const NEXT: Record<Action, Record<string, string>> = {
  makeAvailable: { "In Stock": "Available", "Under Repair": "Available", "Under Retreading": "Available", "Under Inspection": "Available" },
  scrap: { "Available": "Scrapped", "Removed": "Scrapped", "Under Inspection": "Scrapped", "Under Repair": "Scrapped" },
  sell: { "Available": "Sold", "Removed": "Sold", "Scrapped": "Sold" },
  reportLost: { "Fitted": "Lost", "Available": "Lost" },
  fileWarrantyClaim: { "Available": "Warranty Claim", "Removed": "Warranty Claim", "Under Inspection": "Warranty Claim" },
};
const EVENT: Record<Action, string> = { makeAvailable: "MadeAvailable", scrap: "Scrapped", sell: "Sold", reportLost: "Lost", fileWarrantyClaim: "WarrantyClaimed" };

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const tyre = await prisma.tyreMaster.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null } });
  if (!tyre) return NextResponse.json({ ok: false, message: "Tyre not found." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "TyreMaster", entityId: id, businessId: tyre.businessId, branchId: tyre.branchId });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = tyreStatusInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const to = NEXT[b.action]?.[tyre.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${b.action} a tyre that is ${tyre.status}.` }, { status: 422 });

  await prisma.tyreMaster.update({ where: { id }, data: { status: to, updatedBy: user.id } });
  await logTyreMovement(prisma, { tenantId: user.tenantId, businessId: tyre.businessId, branchId: tyre.branchId, tyreId: id, eventType: EVENT[b.action], refEntity: "TyreMaster", refId: id, actorUserId: user.id, actorName: user.fullName ?? null, remarks: b.remarks ?? null });
  await writeAudit(prisma, user, { action: `tyre.${b.action}`, entity: "TyreMaster", entityId: id, summary: `Tyre ${tyre.tyreCode} ${tyre.status} → ${to}`, meta: { from: tyre.status, to }, businessId: tyre.businessId, branchId: tyre.branchId, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, status: to, message: "Tyre status updated." });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { complianceConfigInput } from "@/lib/contracts/vehicleDocument";
import { getComplianceConfig } from "@/lib/transport/vehicleCompliance";

const PERM = "masters.transport";

// GET/PUT the Section 22 compliance control config — off (warning-safe) by
// default so this module never breaks existing Trip/Sales/Purchase flows
// unless an admin explicitly opts in.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const config = await getComplianceConfig(user.tenantId);
  return NextResponse.json({ ok: true, config });
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "VehicleComplianceConfig" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = complianceConfigInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  const seg = await resolveWriteScope(user);

  const existing = await prisma.vehicleComplianceConfig.findFirst({ where: { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: null } });
  if (existing) {
    await prisma.vehicleComplianceConfig.update({ where: { id: existing.id }, data: { checkEnabled: b.checkEnabled, enforcementMode: b.enforcementMode, alertDaysJson: JSON.stringify(b.alertDays), expiringSoonDays: b.expiringSoonDays } });
  } else {
    await prisma.vehicleComplianceConfig.create({ data: { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: null, checkEnabled: b.checkEnabled, enforcementMode: b.enforcementMode, alertDaysJson: JSON.stringify(b.alertDays), expiringSoonDays: b.expiringSoonDays } });
  }
  await writeAudit(prisma, user, { action: "vehicle_compliance_config.update", entity: "VehicleComplianceConfig", entityId: String(user.tenantId), summary: `Compliance config updated — checkEnabled=${b.checkEnabled}, mode=${b.enforcementMode}`, businessId: seg.businessId ?? null, branchId: null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Compliance configuration saved." });
}

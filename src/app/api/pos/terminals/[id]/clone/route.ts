import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";

const PERM = "pos.terminals";

// POST /api/pos/terminals/[id]/clone — duplicate a terminal's configuration under
// a new code/name. Body: { code, name? }.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "PosTerminal", entityId: id });
  if (denied) return denied;

  let body: { code?: string; name?: string } = {};
  try { body = await req.json(); } catch { /* code may be auto-derived */ }

  const src = await prisma.posTerminal.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!src) return NextResponse.json({ ok: false, message: "Terminal not found." }, { status: 404 });

  const code = (body.code || `${src.code}-COPY`).trim();
  const dupe = await prisma.posTerminal.findFirst({ where: { tenantId: user.tenantId, code }, select: { id: true } });
  if (dupe) return NextResponse.json({ ok: false, message: `Terminal code "${code}" already exists.` }, { status: 422 });

  const created = await prisma.posTerminal.create({
    data: {
      tenantId: src.tenantId, businessId: src.businessId, branchId: src.branchId,
      code, name: (body.name || `${src.name} (Copy)`).trim(), type: src.type, description: src.description,
      warehouse: src.warehouse, defaultCustomerId: src.defaultCustomerId, receiptTemplateId: src.receiptTemplateId,
      defaultWarehouse: src.defaultWarehouse, defaultSalesType: src.defaultSalesType, defaultPriceList: src.defaultPriceList,
      defaultTaxProfile: src.defaultTaxProfile, invoiceSeries: src.invoiceSeries,
      ipAddress: null, deviceId: null, macAddress: null, // device identity is not cloned
      deviceAuthRequired: src.deviceAuthRequired, status: "inactive", // clones start inactive
      config: (src.config ?? {}) as Prisma.InputJsonValue, createdBy: user.id,
    },
    select: { id: true, code: true },
  });
  await writeAudit(prisma, user, {
    action: "terminal.clone", entity: "PosTerminal", entityId: created.id,
    summary: `Cloned terminal ${src.code} → ${created.code}`,
    meta: { sourceId: src.id, sourceCode: src.code }, businessId: src.businessId, branchId: src.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Terminal cloned (inactive).", id: created.id }, { status: 201 });
}

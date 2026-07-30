import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { TerminalUpdateSchema, TerminalStatusSchema, type TerminalDetail, type TerminalConfig, type TerminalStatus } from "@/lib/contracts/posTerminal";

const PERM = "pos.terminals";

// GET /api/pos/terminals/[id]
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const t = await prisma.posTerminal.findFirst({ where: { id: Number(params.id), tenantId: user.tenantId } });
  if (!t) return NextResponse.json({ ok: false, message: "Terminal not found." }, { status: 404 });

  const data: TerminalDetail = {
    id: t.id, code: t.code, name: t.name, type: t.type, description: t.description ?? "",
    branchId: t.branchId, warehouse: t.warehouse ?? "",
    defaultCustomerId: t.defaultCustomerId, receiptTemplateId: t.receiptTemplateId,
    defaultWarehouse: t.defaultWarehouse ?? "", defaultSalesType: t.defaultSalesType ?? "",
    defaultPriceList: t.defaultPriceList ?? "", defaultTaxProfile: t.defaultTaxProfile ?? "", invoiceSeries: t.invoiceSeries ?? "",
    ipAddress: t.ipAddress ?? "", deviceId: t.deviceId ?? "", macAddress: t.macAddress ?? "", deviceAuthRequired: t.deviceAuthRequired,
    status: t.status as TerminalStatus, config: (t.config ?? {}) as TerminalConfig, createdAt: t.createdAt.toISOString(),
  };
  return NextResponse.json({ ok: true, data });
}

// PUT /api/pos/terminals/[id] — edit terminal.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "PosTerminal", entityId: id });
  if (denied) return denied;

  const existing = await prisma.posTerminal.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Terminal not found." }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = TerminalUpdateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  if (b.code && b.code !== existing.code) {
    const dupe = await prisma.posTerminal.findFirst({ where: { tenantId: user.tenantId, code: b.code, NOT: { id } }, select: { id: true } });
    if (dupe) return NextResponse.json({ ok: false, message: `Terminal code "${b.code}" already exists.` }, { status: 422 });
  }

  try {
    await prisma.posTerminal.update({
      where: { id },
      data: {
        code: b.code, name: b.name, type: b.type,
        description: b.description !== undefined ? b.description || null : undefined,
        warehouse: b.warehouse !== undefined ? b.warehouse || null : undefined,
        defaultCustomerId: b.defaultCustomerId ?? undefined, receiptTemplateId: b.receiptTemplateId ?? undefined,
        defaultWarehouse: b.defaultWarehouse !== undefined ? b.defaultWarehouse || null : undefined,
        defaultSalesType: b.defaultSalesType !== undefined ? b.defaultSalesType || null : undefined,
        defaultPriceList: b.defaultPriceList !== undefined ? b.defaultPriceList || null : undefined,
        defaultTaxProfile: b.defaultTaxProfile !== undefined ? b.defaultTaxProfile || null : undefined,
        invoiceSeries: b.invoiceSeries !== undefined ? b.invoiceSeries || null : undefined,
        ipAddress: b.ipAddress !== undefined ? b.ipAddress || null : undefined,
        deviceId: b.deviceId !== undefined ? b.deviceId || null : undefined,
        macAddress: b.macAddress !== undefined ? b.macAddress || null : undefined,
        deviceAuthRequired: b.deviceAuthRequired, status: b.status,
        config: b.config !== undefined ? (b.config as Prisma.InputJsonValue) : undefined,
      },
    });
    await writeAudit(prisma, user, {
      action: "terminal.update", entity: "PosTerminal", entityId: id,
      summary: `Updated terminal ${b.code ?? existing.code}`,
      businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Terminal updated.", id });
  } catch (err) {
    console.error("[pos-terminal] update error", err);
    return NextResponse.json({ ok: false, message: "Could not update the terminal." }, { status: 500 });
  }
}

// PATCH /api/pos/terminals/[id] — activate / deactivate.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "PosTerminal", entityId: id });
  if (denied) return denied;

  const existing = await prisma.posTerminal.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Terminal not found." }, { status: 404 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = TerminalStatusSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid status." }, { status: 422 });

  await prisma.posTerminal.update({ where: { id }, data: { status: parsed.data.status } });
  await writeAudit(prisma, user, {
    action: "terminal.status", entity: "PosTerminal", entityId: id,
    summary: `Terminal ${existing.code} set ${parsed.data.status}`,
    businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: `Terminal ${parsed.data.status === "active" ? "activated" : "deactivated"}.` });
}

// DELETE /api/pos/terminals/[id]
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const id = Number(params.id);
  const denied = await requirePermission(user, PERM, { req, entity: "PosTerminal", entityId: id });
  if (denied) return denied;

  const existing = await prisma.posTerminal.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Terminal not found." }, { status: 404 });
  const openSession = await prisma.terminalSession.findFirst({ where: { terminalId: id, status: "Open" }, select: { id: true } });
  if (openSession) return NextResponse.json({ ok: false, message: "Close the open session before deleting this terminal." }, { status: 422 });

  await prisma.posTerminal.delete({ where: { id } });
  await writeAudit(prisma, user, {
    action: "terminal.delete", entity: "PosTerminal", entityId: id,
    summary: `Deleted terminal ${existing.code}`,
    businessId: existing.businessId, branchId: existing.branchId, ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Terminal deleted." });
}

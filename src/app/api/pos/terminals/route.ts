import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { TerminalCreateSchema, type TerminalRow, type TerminalListStats, type TerminalStatus } from "@/lib/contracts/posTerminal";

const PERM = "pos.terminals";

// GET /api/pos/terminals — registry list + status dashboard stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.PosTerminalWhereInput = { ...sw };
  if (q) where.OR = [{ code: { contains: q } }, { name: { contains: q } }];
  if (status !== "All") where.status = status;

  const [rows, total, active] = await Promise.all([
    prisma.posTerminal.findMany({ where, orderBy: { id: "desc" }, take: 200 }),
    prisma.posTerminal.count({ where: sw }),
    prisma.posTerminal.count({ where: { ...sw, status: "active" } }),
  ]);

  // Status dashboard: which terminals have a live (Open) session + the cashier.
  const openSessions = await prisma.terminalSession.findMany({
    where: { tenantId: user.tenantId, status: "Open", terminalId: { in: rows.map((r) => r.id) } },
    select: { id: true, terminalId: true, cashierUserId: true },
  });
  const cashierIds = Array.from(new Set(openSessions.map((s) => s.cashierUserId)));
  const cashiers = cashierIds.length
    ? await prisma.user.findMany({ where: { id: { in: cashierIds } }, select: { id: true, fullName: true } })
    : [];
  const cashierName = new Map(cashiers.map((c) => [c.id, c.fullName]));
  const sessionByTerminal = new Map(openSessions.map((s) => [s.terminalId, s]));

  const shaped: TerminalRow[] = rows.map((t) => {
    const sess = sessionByTerminal.get(t.id);
    return {
      id: t.id, code: t.code, name: t.name, type: t.type, branchId: t.branchId,
      warehouse: t.warehouse ?? "", status: t.status as TerminalStatus, createdAt: t.createdAt.toISOString(),
      openSessionId: sess?.id ?? null, openSessionCashier: sess ? (cashierName.get(sess.cashierUserId) ?? "") : "",
    };
  });
  const stats: TerminalListStats = { total, active, inactive: total - active, online: openSessions.length };
  return NextResponse.json({ ok: true, rows: shaped, stats });
}

// POST /api/pos/terminals — register a new terminal.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "PosTerminal" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = TerminalCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const seg = scopeData(await getActiveScope(user), { branch: true });
  const dupe = await prisma.posTerminal.findFirst({ where: { tenantId: user.tenantId, code: body.code }, select: { id: true } });
  if (dupe) return NextResponse.json({ ok: false, message: `Terminal code "${body.code}" already exists.` }, { status: 422 });

  try {
    const created = await prisma.posTerminal.create({
      data: {
        tenantId: user.tenantId, ...seg,
        code: body.code, name: body.name, type: body.type, description: body.description || null,
        warehouse: body.warehouse || null,
        defaultCustomerId: body.defaultCustomerId ?? null, receiptTemplateId: body.receiptTemplateId ?? null,
        defaultWarehouse: body.defaultWarehouse || null, defaultSalesType: body.defaultSalesType || null,
        defaultPriceList: body.defaultPriceList || null, defaultTaxProfile: body.defaultTaxProfile || null,
        invoiceSeries: body.invoiceSeries || null,
        ipAddress: body.ipAddress || null, deviceId: body.deviceId || null, macAddress: body.macAddress || null,
        deviceAuthRequired: body.deviceAuthRequired ?? false, status: body.status ?? "active",
        config: (body.config ?? {}) as Prisma.InputJsonValue, createdBy: user.id,
      },
      select: { id: true, code: true, name: true },
    });
    await writeAudit(prisma, user, {
      action: "terminal.create", entity: "PosTerminal", entityId: created.id,
      summary: `Registered terminal ${created.code} — ${created.name}`,
      meta: { code: created.code, type: body.type }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Terminal registered.", id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[pos-terminal] create error", err);
    return NextResponse.json({ ok: false, message: "Could not register the terminal." }, { status: 500 });
  }
}

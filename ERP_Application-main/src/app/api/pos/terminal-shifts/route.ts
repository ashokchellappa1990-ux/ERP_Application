import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { MappingCreateSchema, type TerminalShiftRow, type TerminalShiftStatus } from "@/lib/contracts/terminalShift";

const PERM = "pos.terminal-shifts";

// GET /api/pos/terminal-shifts — mappings joined with terminal + shift.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.TerminalShiftMapWhereInput = { ...sw };
  if (status !== "All") where.status = status;

  const rows = await prisma.terminalShiftMap.findMany({
    where, orderBy: { id: "desc" }, take: 300,
    include: {
      terminal: { select: { id: true, code: true, name: true } },
      shift: { select: { id: true, code: true, name: true } },
    },
  });

  const shaped: TerminalShiftRow[] = rows
    .map((m) => ({
      id: m.id, terminalId: m.terminalId, terminalCode: m.terminal.code, terminalName: m.terminal.name,
      shiftId: m.shiftId, shiftCode: m.shift.code, shiftName: m.shift.name,
      effectiveFrom: m.effectiveFrom ?? "", effectiveTo: m.effectiveTo ?? "",
      status: m.status as TerminalShiftStatus, createdAt: m.createdAt.toISOString(),
    }))
    .sort((a, b) => a.terminalCode.localeCompare(b.terminalCode) || a.shiftCode.localeCompare(b.shiftCode));

  return NextResponse.json({ ok: true, rows: shaped });
}

// POST /api/pos/terminal-shifts — authorise a shift on a terminal.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "TerminalShiftMap" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = MappingCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;

  const seg = scopeData(await getActiveScope(user), { branch: true });

  const [terminal, shift] = await Promise.all([
    prisma.posTerminal.findFirst({ where: { id: body.terminalId, tenantId: user.tenantId }, select: { id: true, code: true } }),
    prisma.shift.findFirst({ where: { id: body.shiftId, tenantId: user.tenantId }, select: { id: true, code: true } }),
  ]);
  if (!terminal) return NextResponse.json({ ok: false, message: "Terminal not found." }, { status: 422 });
  if (!shift) return NextResponse.json({ ok: false, message: "Shift not found." }, { status: 422 });

  const dupe = await prisma.terminalShiftMap.findFirst({
    where: { tenantId: user.tenantId, terminalId: body.terminalId, shiftId: body.shiftId, status: "active" },
    select: { id: true },
  });
  if (dupe) return NextResponse.json({ ok: false, message: `Shift ${shift.code} is already mapped to terminal ${terminal.code}.` }, { status: 422 });

  try {
    const created = await prisma.terminalShiftMap.create({
      data: {
        tenantId: user.tenantId, ...seg,
        terminalId: body.terminalId, shiftId: body.shiftId,
        effectiveFrom: body.effectiveFrom || null, effectiveTo: body.effectiveTo || null,
        status: body.status ?? "active", createdBy: user.id,
      },
      select: { id: true },
    });
    await writeAudit(prisma, user, {
      action: "terminal_shift.create", entity: "TerminalShiftMap", entityId: created.id,
      summary: `Mapped shift ${shift.code} → terminal ${terminal.code}`,
      meta: { terminalId: body.terminalId, shiftId: body.shiftId }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Mapping created.", id: created.id }, { status: 201 });
  } catch (err) {
    console.error("[terminal-shift] create error", err);
    return NextResponse.json({ ok: false, message: "Could not create the mapping." }, { status: 500 });
  }
}

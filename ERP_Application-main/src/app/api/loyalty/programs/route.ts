import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/guard";
import { nextProgramCode } from "@/lib/loyalty/numbering";
import { toProgramData } from "@/lib/loyalty/programData";
import { LoyaltyProgramSchema, type LoyaltyProgramRow } from "@/lib/contracts/loyalty";

const PERM = "loyalty.program";

// GET /api/loyalty/programs — list + stats.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.LoyaltyProgramWhereInput = { ...sw };
  if (q) where.OR = [{ code: { contains: q } }, { name: { contains: q } }];
  if (status !== "All") where.status = status;
  const [rows, total, active] = await Promise.all([
    prisma.loyaltyProgram.findMany({ where, orderBy: [{ priority: "desc" }, { id: "desc" }], take: 100 }),
    prisma.loyaltyProgram.count({ where: sw }),
    prisma.loyaltyProgram.count({ where: { ...sw, status: "Active" } }),
  ]);
  const shaped: LoyaltyProgramRow[] = rows.map((p) => ({ id: p.id, code: p.code, name: p.name, status: p.status, priority: p.priority, calcMethod: p.calcMethod, effectiveFrom: p.effectiveFrom ?? "", effectiveTo: p.effectiveTo ?? "", redemptionEnabled: p.redemptionEnabled, createdAt: p.createdAt.toISOString() }));
  return NextResponse.json({ ok: true, rows: shaped, stats: { total, active } });
}

// POST /api/loyalty/programs — create a program.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "LoyaltyProgram" });
  if (denied) return denied;
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = LoyaltyProgramSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  const seg = scopeData(await getActiveScope(user), { branch: true });
  try {
    const created = await prisma.$transaction(async (tx) => {
      const code = (b.code ?? "").trim() || await nextProgramCode(tx, user.tenantId, { businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
      return tx.loyaltyProgram.create({ data: { tenantId: user.tenantId, ...seg, code, name: b.name, createdBy: user.id, ...toProgramData(b as Record<string, unknown>) } as Prisma.LoyaltyProgramUncheckedCreateInput, select: { id: true, code: true } });
    });
    await writeAudit(prisma, user, { action: "loyalty_program.create", entity: "LoyaltyProgram", entityId: created.id, summary: `Created loyalty program ${created.code} — ${b.name}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, id: created.id, code: created.code, message: "Loyalty program created." }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return NextResponse.json({ ok: false, message: "A program with this code already exists." }, { status: 422 });
    console.error("[loyalty-program] create error", err);
    return NextResponse.json({ ok: false, message: "Could not create the program." }, { status: 500 });
  }
}

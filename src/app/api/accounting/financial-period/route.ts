import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import type { FinancialPeriodStats } from "@/lib/contracts/accounting";

const STATUSES = ["Open", "Soft-Closed", "Locked", "Audit-Locked"] as const;
const TYPES = ["Monthly", "Quarterly", "Half-Yearly", "Yearly"] as const;
const iso = (v: unknown) => String(v ?? "").slice(0, 10);
const PERM = "accounting.financial-period";

// GET /api/accounting/financial-period — list periods (newest first) + stats.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const rows = await prisma.financialPeriod.findMany({
    where: scopeWhere(await getActiveScope(user), { branch: true }),
    orderBy: [{ fromDate: "desc" }, { id: "desc" }],
  });

  const stats: FinancialPeriodStats = {
    total: rows.length,
    open: rows.filter((p) => p.status === "Open").length,
    locked: rows.filter((p) => p.status === "Locked" || p.status === "Audit-Locked").length,
    current: rows.find((p) => p.status === "Open")?.name ?? "—",
  };

  return NextResponse.json({ ok: true, rows, stats });
}

// POST /api/accounting/financial-period — create a period (status always Open).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "FinancialPeriod" });
  if (denied) return denied;

  let b: { name?: string; fy?: string; type?: string; from?: string; to?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const name = (b.name ?? "").trim().slice(0, 60);
  const fy = (b.fy ?? "").trim().slice(0, 20);
  const type = TYPES.includes(b.type as (typeof TYPES)[number]) ? String(b.type) : "Monthly";
  const fromDate = iso(b.from);
  const toDate = iso(b.to);
  if (!name) return NextResponse.json({ ok: false, message: "Period name is required." }, { status: 422 });
  if (!fromDate || !toDate) return NextResponse.json({ ok: false, message: "From and To dates are required." }, { status: 422 });
  if (fromDate > toDate) return NextResponse.json({ ok: false, message: "From date must be on or before the To date." }, { status: 422 });

  const seg = scopeData(await getActiveScope(user), { branch: true });

  try {
    const period = await prisma.financialPeriod.create({
      data: { tenantId: user.tenantId, ...seg, name, fy: fy || "—", type, fromDate, toDate, status: "Open", createdBy: user.id },
    });
    await writeAudit(prisma, user, {
      action: "financial_period.create", entity: "FinancialPeriod", entityId: period.id,
      summary: `Added financial period ${period.name} (${fromDate} → ${toDate})`,
      meta: { name: period.name, fy: period.fy, type: period.type, fromDate, toDate },
      businessId: period.businessId, branchId: period.branchId, ip: requestMeta(req).ip,
    });
    return NextResponse.json({ ok: true, message: "Financial period added.", period }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: false, message: `A period named "${name}" already exists.` }, { status: 409 });
    }
    console.error("[financial-period] create error", err);
    return NextResponse.json({ ok: false, message: "Could not add the period." }, { status: 500 });
  }
}

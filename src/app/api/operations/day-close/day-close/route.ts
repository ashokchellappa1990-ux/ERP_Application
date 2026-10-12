import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { buildLiveSummary } from "@/lib/eod/summary";
import { branchOpeningSnapshot } from "@/lib/eod/balances";
import { resolveEodTerminalId } from "@/lib/eod/scope";
import { DayCloseSchema, type DayClosingRow } from "@/lib/contracts/eodClose";

const PERM = "operations.day-close";

function shape(rows: Awaited<ReturnType<typeof fetchRows>>): DayClosingRow[] {
  return rows.map((r) => ({
    id: r.id,
    dayClosingNo: r.dayClosingNo,
    closingDate: r.closingDate,
    closedAt: r.closedAt.toISOString(),
    status: r.status,
    remarks: r.remarks ?? "",
    createdBy: r.createdBy ?? null,
  }));
}
function fetchRows(where: object) {
  return prisma.dayClosing.findMany({ where, orderBy: { id: "desc" }, take: 50 });
}

// GET /api/operations/day-close/day-close?date=YYYY-MM-DD
//   Recent closings + whether today (date) is already closed + the branch live summary.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const date = (url.searchParams.get("date") || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const filterTerminalId = await resolveEodTerminalId(user, url.searchParams.get("terminalId"));

  const scope = await getActiveScope(user);
  const sw = scopeWhere(scope, { branch: true });

  // Opening snapshot: terminal-filtered view uses that terminal's day opening; else branch level.
  const opening = filterTerminalId
    ? await (async () => {
        const day = await prisma.dayOpening.findFirst({
          where: { tenantId: user.tenantId, terminalId: filterTerminalId, status: "Open" }, orderBy: { id: "desc" },
          select: { openingCash: true, openingBankBalance: true, openingSafeBalance: true },
        }) ?? await prisma.dayOpening.findFirst({
          where: { tenantId: user.tenantId, terminalId: filterTerminalId, openingDate: date }, orderBy: { id: "desc" },
          select: { openingCash: true, openingBankBalance: true, openingSafeBalance: true },
        });
        const n = (v: unknown) => (v == null ? 0 : Number(v));
        return { cash: n(day?.openingCash), bank: n(day?.openingBankBalance), safe: n(day?.openingSafeBalance) };
      })()
    : await branchOpeningSnapshot(user.tenantId, scope.readBranchIds, date);

  const [list, existing, summary] = await Promise.all([
    fetchRows(sw),
    scope.branchId
      ? prisma.dayClosing.findFirst({ where: { tenantId: user.tenantId, branchId: scope.branchId, closingDate: date }, select: { id: true } })
      : Promise.resolve(null),
    buildLiveSummary({ tenantId: user.tenantId, businessId: scope.businessId, branchIds: scope.readBranchIds, terminalId: filterTerminalId, date }, opening),
  ]);

  return NextResponse.json({ ok: true, rows: shape(list), closedToday: !!existing, summary, date });
}

// POST /api/operations/day-close/day-close — consolidate & close the business day for the active branch.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "DayClosing" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { raw = {}; }
  const parsed = DayCloseSchema.safeParse(raw ?? {});
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const body = parsed.data;
  const date = body.date;

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const branchId = scope.branchId ?? null;
  if (!branchId) return NextResponse.json({ ok: false, message: "Select a branch before closing the day." }, { status: 422 });

  // Block a duplicate close for this branch + date (unique [tenantId, branchId, dayDate] on the summary).
  const already = await prisma.dayClosing.findFirst({ where: { tenantId: user.tenantId, branchId, closingDate: date }, select: { id: true } });
  if (already) return NextResponse.json({ ok: false, message: "This business day is already closed." }, { status: 409 });

  // Warn if any shift/day-opening for this branch+date is still Open (unless forced).
  if (!body.force) {
    const openCount = await prisma.dayOpening.count({ where: { tenantId: user.tenantId, branchId, openingDate: date, status: "Open" } });
    if (openCount > 0) {
      return NextResponse.json(
        { ok: false, needsShiftClose: true, openCount, message: `${openCount} open day/shift session(s) remain for this date. Close them first or force-close.` },
        { status: 422 },
      );
    }
  }

  // Consolidated branch-level snapshot (read-only) captured at the moment of closing.
  const opening = await branchOpeningSnapshot(user.tenantId, scope.readBranchIds, date);
  const summary = await buildLiveSummary(
    { tenantId: user.tenantId, businessId: scope.businessId, branchIds: scope.readBranchIds, date },
    opening,
  );

  // Branch scope for the back-fill / open-shift updates.
  const branchScope = scope.readBranchIds.length ? { branchId: { in: scope.readBranchIds } } : { branchId };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const closing = await tx.dayClosing.create({
        data: {
          tenantId: user.tenantId, ...seg, dayClosingNo: "TMP", closingDate: date,
          status: "Closed", remarks: body.remarks || null, createdBy: user.id,
        },
        select: { id: true },
      });
      const dayClosingNo = `DC-${date.replace(/-/g, "")}-${String(closing.id).padStart(4, "0")}`;
      await tx.dayClosing.update({ where: { id: closing.id }, data: { dayClosingNo } });

      // Upsert the consolidated summary snapshot (unique [tenantId, branchId, dayDate]).
      await tx.daySummary.upsert({
        where: { tenantId_branchId_dayDate: { tenantId: user.tenantId, branchId, dayDate: date } },
        create: {
          tenantId: user.tenantId, ...seg, dayDate: date, dayClosingId: closing.id,
          summary: summary as unknown as Prisma.InputJsonValue, createdBy: user.id,
        },
        update: { dayClosingId: closing.id, summary: summary as unknown as Prisma.InputJsonValue },
      });

      // Close any still-open day/shift sessions for this branch + date.
      await tx.dayOpening.updateMany({
        where: { tenantId: user.tenantId, ...branchScope, openingDate: date, status: "Open" },
        data: { status: "Closed" },
      });

      // Back-fill dayClosingId on the day's transaction headers (per-model date field).
      const link = { dayClosingId: closing.id };
      const linkBase = { tenantId: user.tenantId, ...branchScope, dayClosingId: null };
      await Promise.all([
        tx.sale.updateMany({ where: { ...linkBase, saleDate: date }, data: link }),
        tx.salesReturn.updateMany({ where: { ...linkBase, returnDate: date }, data: link }),
        tx.goodsReceiptNote.updateMany({ where: { ...linkBase, grnDate: date }, data: link }),
        tx.supplierPayment.updateMany({ where: { ...linkBase, paymentDate: date }, data: link }),
        tx.customerCollection.updateMany({ where: { ...linkBase, collectionDate: date }, data: link }),
        tx.pettyCashVoucher.updateMany({ where: { ...linkBase, voucherDate: date }, data: link }),
        tx.journalEntry.updateMany({ where: { ...linkBase, date: date }, data: link }),
        tx.openingStock.updateMany({ where: { ...linkBase, asOnDate: date }, data: link }),
      ]);

      await writeAudit(tx, user, {
        action: "day_closing.create", entity: "DayClosing", entityId: closing.id,
        summary: `Closed business day ${date} (${dayClosingNo})`,
        meta: { date, branchId, sales: summary.sales, cash: summary.cash, forced: !!body.force },
        businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip,
      });

      return { id: closing.id, dayClosingNo };
    });

    return NextResponse.json({ ok: true, message: "Business day closed.", id: result.id, dayClosingNo: result.dayClosingNo }, { status: 201 });
  } catch (err) {
    console.error("[day-close] error", err);
    return NextResponse.json({ ok: false, message: "Could not close the business day." }, { status: 500 });
  }
}

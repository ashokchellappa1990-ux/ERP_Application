import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

// GET /api/transport/weighment-queue — the First / Second Weighment list pages.
//   stage=first|second  type=Sales|Purchase  tab=pending|completed
//   q (gate entry / vehicle / customer / supplier / weighment no)  from, to (YYYY-MM-DD)
//   page, pageSize
// Pending  = gate entries of that type waiting for this weighment (same rules
//            as the New Weighment forms' vehicle list); dated by arrival time.
// Completed = weighments already recorded; dated by when they were recorded.
// Stats (cards) ignore the search/date filters — they're the whole queue.
//
// Raw SQL because the weighment tables have no Prisma relation to the gate
// entry, and both the pending rules (NOT EXISTS …) and scoped search need a join.

const ACTIVE = Prisma.sql`('Waiting','Inside Factory')`;
const num = (v: unknown) => (v == null ? null : Number(v));

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const url = new URL(req.url);
  const stage = url.searchParams.get("stage") === "second" ? "second" : "first";
  const denied = await requirePermission(user, stage === "first" ? "transport.pre-weighment" : "transport.post-weighment");
  if (denied) return denied;

  const type = url.searchParams.get("type") === "Purchase" ? "Purchase" : "Sales";
  const entryType = type === "Purchase" ? "RawMaterial" : "Dispatch";
  const tab = url.searchParams.get("tab") === "completed" ? "completed" : "pending";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("from") ?? "") ? url.searchParams.get("from")! : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to") ?? "") ? url.searchParams.get("to")! : "";
  const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get("pageSize")) || 25));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  // Same tenant / business / branch rules as scopeWhere({ branch: true }).
  const scope = await getActiveScope(user);
  const branchIds = scope.readBranchIds.length ? scope.readBranchIds : [-1];
  const scopeSql = Prisma.sql`g.tenantId = ${scope.tenantId} AND g.deletedAt IS NULL AND g.entryType = ${entryType}
    ${scope.businessId ? Prisma.sql`AND g.businessId = ${scope.businessId}` : Prisma.empty}
    AND (g.branchId IS NULL OR g.branchId IN (${Prisma.join(branchIds)}))`;

  const hasFirst = Prisma.sql`EXISTS (SELECT 1 FROM pre_loading_weighment p0 WHERE p0.gateEntryId = g.id AND p0.tenantId = g.tenantId)`;
  const hasSecond = Prisma.sql`EXISTS (SELECT 1 FROM post_loading_weighment q0 WHERE q0.gateEntryId = g.id)`;

  // Rows waiting for THIS weighment (mirrors the New First/Second Weighment forms).
  // Sales second weighment includes "Completed": a "Capture Later" dispatch
  // completes before the loaded truck is weighed.
  const pendingSql =
    stage === "first"
      ? type === "Sales"
        ? Prisma.sql`g.status IN ${ACTIVE} AND NOT ${hasFirst}`
        // Raw Material already weighed via the old gate-entry step, or already on a GRN, is past this step.
        : Prisma.sql`g.status IN ${ACTIVE} AND NOT ${hasFirst} AND g.grossWeight IS NULL AND g.grnId IS NULL`
      : type === "Sales"
        ? Prisma.sql`g.status IN ('Inside Factory','Loading','Completed') AND ${hasFirst} AND NOT ${hasSecond}`
        : Prisma.sql`g.status <> 'Exited' AND NOT ${hasSecond} AND COALESCE(p.grossWeight, g.grossWeight) > 0 AND NOT COALESCE(grn.tareWeight > 0, FALSE)`;

  const like = `%${q}%`;
  const searchSql = q
    ? Prisma.sql`AND (g.gateEntryNo LIKE ${like} OR v.vehicleNo LIKE ${like} OR g.customerName LIKE ${like} OR g.supplierName LIKE ${like}
        ${tab === "completed" && stage === "first" ? Prisma.sql`OR w.weighmentNo LIKE ${like}` : Prisma.empty})`
    : Prisma.empty;

  const dayStart = (d: string) => new Date(`${d}T00:00:00`);
  const dayEnd = (d: string) => new Date(`${d}T23:59:59.999`);
  const dateCol = tab === "completed" ? Prisma.sql`w.createdAt` : Prisma.sql`COALESCE(g.arrivalTime, g.createdAt)`;
  const dateSql = Prisma.sql`${from ? Prisma.sql`AND ${dateCol} >= ${dayStart(from)}` : Prisma.empty} ${to ? Prisma.sql`AND ${dateCol} <= ${dayEnd(to)}` : Prisma.empty}`;

  const wTable = stage === "first" ? Prisma.sql`pre_loading_weighment` : Prisma.sql`post_loading_weighment`;
  const joins = Prisma.sql`
    LEFT JOIN vehicle_master v ON v.id = g.vehicleId
    LEFT JOIN pre_loading_weighment p ON p.gateEntryId = g.id AND p.tenantId = g.tenantId
    LEFT JOIN goods_receipt_notes grn ON grn.id = g.grnId`;
  const completedFrom = Prisma.sql`FROM ${wTable} w JOIN vehicle_gate_entry g ON g.id = w.gateEntryId ${joins} WHERE w.tenantId = ${scope.tenantId} AND ${scopeSql}`;
  const pendingFrom = Prisma.sql`FROM vehicle_gate_entry g ${joins} WHERE ${scopeSql} AND ${pendingSql}`;

  // The weight the stat card totals: First = tare (Sales) / gross (Purchase); Second = net.
  const weightExpr = stage === "first"
    ? (type === "Purchase" ? Prisma.sql`w.grossWeight` : Prisma.sql`w.tareWeight`)
    : Prisma.sql`w.netWeight`;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  try {
    const [pendingCount, completedStats, rowsAndTotal] = await Promise.all([
      prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c ${pendingFrom}`,
      prisma.$queryRaw<{ c: bigint; todayCount: bigint | null; todayWeight: unknown }[]>`
        SELECT COUNT(*) AS c,
               SUM(CASE WHEN w.createdAt >= ${dayStart(today)} AND w.createdAt <= ${dayEnd(today)} THEN 1 ELSE 0 END) AS todayCount,
               SUM(CASE WHEN w.createdAt >= ${dayStart(today)} AND w.createdAt <= ${dayEnd(today)} THEN ${weightExpr} ELSE 0 END) AS todayWeight
        ${completedFrom}`,
      (async () => {
        const offset = (page - 1) * pageSize;
        if (tab === "pending") {
          const [t, rows] = await Promise.all([
            prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c ${pendingFrom} ${searchSql} ${dateSql}`,
            prisma.$queryRaw<Record<string, unknown>[]>`
              SELECT g.id AS gateEntryId, g.gateEntryNo, v.vehicleNo, g.customerName, g.supplierName, g.status AS gateStatus,
                     COALESCE(g.arrivalTime, g.createdAt) AS arrivalTime, g.expectedMaterial, g.grnId, grn.grnNo,
                     p.weighmentNo AS firstWeighmentNo, p.tareWeight AS firstTare, COALESCE(p.grossWeight, g.grossWeight) AS firstGross
              ${pendingFrom} ${searchSql} ${dateSql}
              ORDER BY COALESCE(g.arrivalTime, g.createdAt) ASC, g.id ASC
              LIMIT ${pageSize} OFFSET ${offset}`,
          ]);
          return { total: Number(t[0]?.c ?? 0), rows: rows.map((r) => ({
            gateEntryId: Number(r.gateEntryId), gateEntryNo: r.gateEntryNo, vehicleNo: r.vehicleNo ?? "—",
            party: (type === "Purchase" ? r.supplierName : r.customerName) ?? null, gateStatus: r.gateStatus,
            arrivalTime: r.arrivalTime ? new Date(r.arrivalTime as string).toISOString() : null,
            expectedMaterial: r.expectedMaterial ?? null, grnId: num(r.grnId), grnNo: r.grnNo ?? null,
            firstWeighmentNo: r.firstWeighmentNo ?? null,
            // The First Weighment's figure the Second Weighment nets against.
            firstWeight: stage === "second" ? num(type === "Purchase" ? r.firstGross : r.firstTare) : null,
          })) };
        }
        const [t, rows] = await Promise.all([
          prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*) AS c ${completedFrom} ${searchSql} ${dateSql}`,
          stage === "first"
            ? prisma.$queryRaw<Record<string, unknown>[]>`
                SELECT w.id, w.weighmentNo, w.tareWeight, w.grossWeight, w.operator, w.weighDate, w.weighTime, w.createdAt,
                       g.id AS gateEntryId, g.gateEntryNo, v.vehicleNo, g.customerName, g.supplierName, g.status AS gateStatus, g.grnId, grn.grnNo
                ${completedFrom} ${searchSql} ${dateSql}
                ORDER BY w.createdAt DESC, w.id DESC LIMIT ${pageSize} OFFSET ${offset}`
            : prisma.$queryRaw<Record<string, unknown>[]>`
                SELECT w.id, w.grossWeight, w.tareWeight, w.netWeight, w.operator, w.weighDate, w.createdAt, w.toleranceExceeded, w.approvalStatus,
                       g.id AS gateEntryId, g.gateEntryNo, v.vehicleNo, g.customerName, g.supplierName, g.status AS gateStatus, g.grnId, grn.grnNo
                ${completedFrom} ${searchSql} ${dateSql}
                ORDER BY w.createdAt DESC, w.id DESC LIMIT ${pageSize} OFFSET ${offset}`,
        ]);
        return { total: Number(t[0]?.c ?? 0), rows: rows.map((r) => ({
          id: Number(r.id), weighmentNo: r.weighmentNo ?? null,
          gateEntryId: Number(r.gateEntryId), gateEntryNo: r.gateEntryNo, vehicleNo: r.vehicleNo ?? "—",
          party: (type === "Purchase" ? r.supplierName : r.customerName) ?? null, gateStatus: r.gateStatus,
          grnId: num(r.grnId), grnNo: r.grnNo ?? null,
          tareWeight: num(r.tareWeight), grossWeight: num(r.grossWeight), netWeight: num(r.netWeight),
          operator: r.operator ?? null, weighDate: r.weighDate ?? null, weighTime: r.weighTime ?? null,
          createdAt: new Date(r.createdAt as string).toISOString(),
          toleranceExceeded: r.toleranceExceeded == null ? null : Boolean(Number(r.toleranceExceeded)), approvalStatus: r.approvalStatus ?? null,
        })) };
      })(),
    ]);

    return NextResponse.json({
      ok: true, stage, type, tab, page, pageSize,
      total: rowsAndTotal.total, rows: rowsAndTotal.rows,
      stats: {
        pending: Number(pendingCount[0]?.c ?? 0),
        completed: Number(completedStats[0]?.c ?? 0),
        todayCount: Number(completedStats[0]?.todayCount ?? 0),
        todayWeight: Number(completedStats[0]?.todayWeight ?? 0),
      },
    });
  } catch (err) {
    console.error("[transport/weighment-queue] error", err);
    return NextResponse.json({ ok: false, message: "Could not load the weighment list." }, { status: 500 });
  }
}

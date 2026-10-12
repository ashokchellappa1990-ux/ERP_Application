import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";

const PERM = "masters.transport";
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
function num(v: Prisma.Decimal | null | undefined): number { return v == null ? 0 : Number(v); }
function dstr(d: Date): string { return d.toISOString().slice(0, 10); }

interface Txn { id: number; refNo: string; qty: number; amount: number; note: string | null }

// GET /api/transport/fuel-storage-log?tankId=&from=&to= — a tank-wise stock
// ledger (Opening / Purchase / Transfer(Issue) / Closing per day), built from
// FuelEntry (usageType="storage") + the legacy FuelPurchase model (both
// increment FuelTank.currentQty) against FuelIssue (which decrements it).
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const tankIdParam = url.searchParams.get("tankId");
  const tankId = tankIdParam ? Number(tankIdParam) : null;
  const toStr = url.searchParams.get("to");
  const fromStr = url.searchParams.get("from");
  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr ? new Date(fromStr) : new Date(to.getFullYear(), to.getMonth(), 1);
  const toEnd = new Date(to); toEnd.setHours(23, 59, 59, 999);
  const fromKey = dstr(from);
  const toKey = dstr(to);

  const scope = await getActiveScope(user);
  const tankWhere: Prisma.FuelTankWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (tankId) tankWhere.id = tankId;
  const tanks = await prisma.fuelTank.findMany({ where: tankWhere, orderBy: { tankName: "asc" }, select: { id: true, tankName: true, tankCode: true } });
  if (!tanks.length) return NextResponse.json({ ok: true, tanks: [], rows: [], from: fromKey, to: toKey });
  const tankIds = tanks.map((t) => t.id);

  const [entries, purchases, issues] = await Promise.all([
    prisma.fuelEntry.findMany({ where: { tenantId: user.tenantId, usageType: "storage", tankId: { in: tankIds }, status: "Confirmed", entryDate: { lte: toEnd } }, select: { id: true, entryNo: true, tankId: true, entryDate: true, quantity: true, totalAmount: true, fuelStationName: true } }),
    prisma.fuelPurchase.findMany({ where: { tenantId: user.tenantId, tankId: { in: tankIds }, status: "Confirmed", purchaseDate: { lte: toEnd } }, select: { id: true, purchaseNo: true, tankId: true, purchaseDate: true, quantity: true, amount: true, supplierName: true } }),
    prisma.fuelIssue.findMany({ where: { tenantId: user.tenantId, tankId: { in: tankIds }, status: "Confirmed", issueDate: { lte: toEnd } }, select: { id: true, issueNo: true, tankId: true, issueDate: true, quantity: true, vehicleId: true } }),
  ]);

  const vehicleIds = Array.from(new Set(issues.map((i) => i.vehicleId).filter((x): x is number => x != null)));
  const vehicles = vehicleIds.length ? await prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [];
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));

  // Bucket every movement by tankId -> dateKey.
  const byTank = new Map<number, Map<string, { purchases: Txn[]; issues: Txn[] }>>();
  function bucket(tid: number, dateKey: string) {
    if (!byTank.has(tid)) byTank.set(tid, new Map());
    const m = byTank.get(tid)!;
    if (!m.has(dateKey)) m.set(dateKey, { purchases: [], issues: [] });
    return m.get(dateKey)!;
  }
  for (const e of entries) {
    if (e.tankId == null) continue;
    bucket(e.tankId, dstr(e.entryDate)).purchases.push({ id: e.id, refNo: e.entryNo, qty: num(e.quantity), amount: num(e.totalAmount), note: e.fuelStationName });
  }
  for (const p of purchases) {
    bucket(p.tankId, dstr(p.purchaseDate)).purchases.push({ id: p.id, refNo: p.purchaseNo, qty: num(p.quantity), amount: num(p.amount), note: p.supplierName });
  }
  for (const i of issues) {
    bucket(i.tankId, dstr(i.issueDate)).issues.push({ id: i.id, refNo: i.issueNo, qty: num(i.quantity), amount: 0, note: i.vehicleId != null ? vMap.get(i.vehicleId) ?? null : null });
  }

  const rows: Array<{
    tankId: number; tankName: string; date: string; opening: number; purchaseQty: number; issueQty: number; closing: number;
    purchases: Txn[]; issues: Txn[];
  }> = [];

  for (const t of tanks) {
    const dateMap: Map<string, { purchases: Txn[]; issues: Txn[] }> = byTank.get(t.id) ?? new Map();
    const allDates = Array.from(dateMap.keys()).sort();
    let opening = 0;
    for (const d of allDates) {
      if (d < fromKey) {
        const b = dateMap.get(d)!;
        opening += b.purchases.reduce((s, x) => s + x.qty, 0) - b.issues.reduce((s, x) => s + x.qty, 0);
      }
    }
    let running = opening;
    for (const d of allDates) {
      if (d < fromKey || d > toKey) continue;
      const b = dateMap.get(d)!;
      const purchaseQty = r2(b.purchases.reduce((s, x) => s + x.qty, 0));
      const issueQty = r2(b.issues.reduce((s, x) => s + x.qty, 0));
      const openingForDay = r2(running);
      running = running + purchaseQty - issueQty;
      rows.push({ tankId: t.id, tankName: t.tankName, date: d, opening: openingForDay, purchaseQty, issueQty, closing: r2(running), purchases: b.purchases, issues: b.issues });
    }
  }
  rows.sort((a, b) => (a.tankName === b.tankName ? a.date.localeCompare(b.date) : a.tankName.localeCompare(b.tankName)));

  return NextResponse.json({ ok: true, tanks: tanks.map((t) => ({ id: t.id, tankName: t.tankName, tankCode: t.tankCode })), rows, from: fromKey, to: toKey });
}

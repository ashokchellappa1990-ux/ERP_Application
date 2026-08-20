import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeWhere, resolveWriteScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { fuelEntryInput, type FuelEntryRow } from "@/lib/contracts/fuelManagement";
import { getLastKnownOdometer } from "@/lib/transport/fuelManagement";
import { isVehicleUnderMaintenance } from "@/lib/transport/vehicleMaintenance";
import { ACC } from "@/lib/accounting/accounts";
import { postJournal } from "@/lib/accounting/post";
import { recordBankMovement } from "@/lib/finance/bank";

const isNonCashMode = (m?: string | null) => !!m && !m.toLowerCase().includes("cash");
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const PERM = "masters.transport";
function num(v: Prisma.Decimal | null | undefined): number | null { return v == null ? null : Number(v); }
function dateStr(d: Date | null | undefined): string | null { return d ? d.toISOString().slice(0, 10) : null; }

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const url = new URL(req.url);
  const vehicleId = url.searchParams.get("vehicleId");
  const driverId = url.searchParams.get("driverId");
  const tripId = url.searchParams.get("tripId");
  const status = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();

  const scope = await getActiveScope(user);
  const where: Prisma.FuelEntryWhereInput = { ...scopeWhere(scope, { branch: true }) };
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (driverId) where.driverId = Number(driverId);
  if (tripId) where.tripId = Number(tripId);
  if (status && status !== "All") where.status = status;
  if (q) where.OR = [{ entryNo: { contains: q } }, { fuelStationName: { contains: q } }];

  const rows = await prisma.fuelEntry.findMany({ where, orderBy: { id: "desc" }, take: 1000 });
  const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
  const driverIds = Array.from(new Set(rows.map((r) => r.driverId).filter((x): x is number => x != null)));
  const tripIds = Array.from(new Set(rows.map((r) => r.tripId).filter((x): x is number => x != null)));
  const createdByIds = Array.from(new Set(rows.map((r) => r.createdBy).filter((x): x is number => x != null)));
  const [vehicles, drivers, trips, users] = await Promise.all([
    vehicleIds.length ? prisma.vehicleMaster.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, vehicleNo: true } }) : [],
    driverIds.length ? prisma.driverMaster.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } }) : [],
    tripIds.length ? prisma.vehicleTrip.findMany({ where: { id: { in: tripIds } }, select: { id: true, tripNo: true } }) : [],
    createdByIds.length ? prisma.user.findMany({ where: { id: { in: createdByIds } }, select: { id: true, fullName: true } }) : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [v.id, v.vehicleNo]));
  const dMap = new Map(drivers.map((d) => [d.id, d.name]));
  const tMap = new Map(trips.map((t) => [t.id, t.tripNo]));
  const uMap = new Map(users.map((u) => [u.id, u.fullName]));

  const list: FuelEntryRow[] = rows.map((r) => ({
    id: r.id, entryNo: r.entryNo, entryDate: dateStr(r.entryDate) ?? "", vehicleId: r.vehicleId, vehicleNo: vMap.get(r.vehicleId) ?? "—",
    driverId: r.driverId, driverName: r.driverId != null ? dMap.get(r.driverId) ?? null : null,
    tripId: r.tripId, tripNo: r.tripId != null ? tMap.get(r.tripId) ?? null : null,
    fuelType: r.fuelType, fuelStationName: r.fuelStationName, quantity: num(r.quantity) ?? 0, rate: num(r.rate) ?? 0, amount: num(r.amount) ?? 0,
    odometer: num(r.odometer), status: r.status, createdByName: r.createdBy != null ? uMap.get(r.createdBy) ?? null : null, createdAt: r.createdAt.toISOString(),
    totalAmount: num(r.totalAmount) ?? num(r.amount) ?? 0, postingType: r.postingType,
  }));

  // Dashboard summary — over the full scoped, non-cancelled set.
  const allEntries = await prisma.fuelEntry.findMany({ where: { ...scopeWhere(scope, { branch: true }), status: { not: "Cancelled" } }, select: { quantity: true, amount: true, rate: true, entryDate: true, vehicleId: true } });
  const allIssues = await prisma.fuelIssue.findMany({ where: { ...scopeWhere(scope, { branch: true }), status: { not: "Cancelled" } }, select: { quantity: true, amount: true, rate: true, issueDate: true, vehicleId: true } });
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const combined = [...allEntries.map((e) => ({ qty: Number(e.quantity), amt: Number(e.amount), rate: Number(e.rate), date: e.entryDate })), ...allIssues.map((e) => ({ qty: Number(e.quantity), amt: Number(e.amount), rate: Number(e.rate), date: e.issueDate }))];
  const thisMonth = combined.filter((c) => c.date >= startOfMonth);
  const stats = {
    totalQty: combined.reduce((s, c) => s + c.qty, 0), totalCost: combined.reduce((s, c) => s + c.amt, 0),
    avgRate: combined.length ? combined.reduce((s, c) => s + c.rate, 0) / combined.length : 0,
    qtyThisMonth: thisMonth.reduce((s, c) => s + c.qty, 0), costThisMonth: thisMonth.reduce((s, c) => s + c.amt, 0),
    transactionCount: combined.length,
  };

  return NextResponse.json({ ok: true, rows: list, stats });
}

// POST /api/transport/fuel-entry — external refuelling (no tank stock impact).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "FuelEntry" });
  if (denied) return denied;

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = fuelEntryInput.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  const b = parsed.data;

  const vehicle = await prisma.vehicleMaster.findFirst({ where: { id: b.vehicleId, tenantId: user.tenantId, deletedAt: null } });
  if (!vehicle) return NextResponse.json({ ok: false, message: "Vehicle not found." }, { status: 422 });
  if (vehicle.status !== "Active") return NextResponse.json({ ok: false, message: "This vehicle is not Active." }, { status: 422 });

  if (b.driverId) {
    const driver = await prisma.driverMaster.findFirst({ where: { id: b.driverId, tenantId: user.tenantId, deletedAt: null } });
    if (!driver) return NextResponse.json({ ok: false, message: "Driver not found." }, { status: 422 });
    if (driver.status !== "Active") return NextResponse.json({ ok: false, message: "This driver is not Active." }, { status: 422 });
  }

  // Odometer validation — warn (block unless explicitly overridden), never
  // silently accept an inconsistent reading. Vehicle-under-maintenance is a
  // warning too, not a hard block, per spec.
  const warnings: string[] = [];
  if (b.odometer != null) {
    const lastKnown = await getLastKnownOdometer(user.tenantId, b.vehicleId);
    if (lastKnown != null && b.odometer < lastKnown) {
      if (!b.overrideOdometerWarning) return NextResponse.json({ ok: false, message: `Entered odometer (${b.odometer} KM) is less than the last known reading (${lastKnown} KM) for this vehicle.`, requiresOverride: true }, { status: 422 });
      warnings.push(`Odometer override: entered ${b.odometer} KM is below last known ${lastKnown} KM.`);
    }
  }
  if (await isVehicleUnderMaintenance(user.tenantId, b.vehicleId)) warnings.push("This vehicle is currently under maintenance.");

  let fuelStationName = b.fuelStationName ?? null;
  if (b.fuelStationId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: b.fuelStationId, tenantId: user.tenantId }, select: { name: true } });
    if (supplier) fuelStationName = supplier.name;
  }

  if (b.postingType === "paynow") {
    if (!b.paymentMode) return NextResponse.json({ ok: false, message: "Payment mode is required." }, { status: 422 });
    if (isNonCashMode(b.paymentMode) && !b.bankId) return NextResponse.json({ ok: false, message: "Select a bank account for a non-cash payment mode." }, { status: 422 });
  }

  const amount = r2(b.quantity * b.rate);
  const taxAmount = b.gstApplicable ? r2(amount * ((b.gstPct ?? 0) / 100)) : 0;
  const otherCost = r2(b.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
  const totalAmount = r2(amount + taxAmount + otherCost);
  const seg = await resolveWriteScope(user);

  // GL account resolution — Expense Head -> LedgerAccount.code, same lookup
  // Petty Cash uses (src/app/api/finance/petty-cash/route.ts), so admins
  // configure the mapping in one place for both. Falls back to a dedicated
  // Fuel Expense account for the main line, Indirect Expenses for any
  // additional cost line (e.g. helper conveyance) left unmapped.
  const headIds = [...new Set([b.headId, ...b.lines.map((l) => l.headId)].filter((x): x is number => !!x))];
  const headAccts = headIds.length ? await prisma.expenseHead.findMany({ where: { id: { in: headIds }, tenantId: user.tenantId }, select: { id: true, accountId: true, name: true } }) : [];
  const acctIds = [...new Set(headAccts.map((h) => h.accountId).filter((x): x is number => !!x))];
  const acctCodeById = new Map(
    (acctIds.length ? await prisma.ledgerAccount.findMany({ where: { id: { in: acctIds }, tenantId: user.tenantId }, select: { id: true, code: true } }) : []).map((a) => [a.id, a.code]),
  );
  const headInfo = new Map(headAccts.map((h) => [h.id, { code: (h.accountId && acctCodeById.get(h.accountId)) || null, name: h.name }]));
  const primaryCode = (b.headId && headInfo.get(b.headId)?.code) || ACC.FUEL_EXPENSE;
  const expenseByCode: Record<string, number> = { [primaryCode]: amount };
  for (const l of b.lines) {
    const code = (l.headId && headInfo.get(l.headId)?.code) || ACC.INDIRECT_EXPENSE;
    expenseByCode[code] = r2((expenseByCode[code] ?? 0) + (Number(l.amount) || 0));
  }

  const { id: createdId, entryNo } = await prisma.$transaction(async (tx) => {
    const created = await tx.fuelEntry.create({
      data: {
        tenantId: user.tenantId, businessId: seg.businessId ?? undefined, branchId: seg.branchId ?? undefined,
        entryNo: "TMP", entryDate: new Date(b.entryDate), vehicleId: b.vehicleId, driverId: b.driverId ?? null, tripId: b.tripId ?? null,
        fuelType: b.fuelType, fuelStationId: b.fuelStationId ?? null, fuelStationName,
        quantity: b.quantity, uom: b.uom, rate: b.rate, amount, odometer: b.odometer ?? null,
        invoiceNo: b.invoiceNo ?? null, invoiceDate: b.invoiceDate ? new Date(b.invoiceDate) : null, paymentMode: b.paymentMode ?? null,
        headId: b.headId ?? null, gstApplicable: b.gstApplicable, gstPct: b.gstPct ?? null, taxAmount, otherCost, totalAmount,
        supplierGstin: b.supplierGstin ?? null, postingType: b.postingType,
        bankId: b.bankId ?? null, bankName: b.bankName ?? null, bankAccount: b.bankAccount ?? null,
        status: "Confirmed", remarks: b.remarks ?? null, createdBy: user.id,
      },
    });
    const entryNo = `FP-${String(created.id).padStart(6, "0")}`;
    await tx.fuelEntry.update({ where: { id: created.id }, data: { entryNo } });

    if (b.lines.length) {
      await tx.fuelEntryLine.createMany({
        data: b.lines.map((l) => ({ tenantId: user.tenantId, fuelEntryId: created.id, headId: l.headId ?? null, headName: l.headId ? headInfo.get(l.headId)?.name ?? null : null, description: l.description ?? null, amount: Number(l.amount) || 0 })),
      });
    }

    const jlines: { code: string; debit?: number; credit?: number; narration?: string }[] = Object.entries(expenseByCode).map(([code, amt]) => ({ code, debit: amt, narration: "Fuel expense" }));
    if (taxAmount > 0) jlines.push({ code: ACC.INPUT_GST, debit: taxAmount, narration: "Input GST (ITC)" });

    let entryIdJournal: number | null = null;
    if (b.postingType === "ap") {
      jlines.push({ code: ACC.PAYABLE, credit: totalAmount, narration: `Payable to ${fuelStationName || "fuel station"}` });
      entryIdJournal = await postJournal(tx, {
        tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, voucherType: "PAYMENT", prefix: "FP",
        date: b.entryDate, narration: `Fuel Purchase — ${entryNo} — ${vehicle.vehicleNo}`, sourceType: "FUEL_ENTRY", sourceId: created.id, refNo: entryNo, createdBy: user.id, lines: jlines,
      });
      await tx.payable.create({ data: { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, sourceType: "FUEL_ENTRY", sourceId: created.id, refNo: b.invoiceNo || entryNo, supplier: fuelStationName, docDate: b.entryDate, dueDate: null, totalAmount, paidAmount: 0, balanceAmount: totalAmount, status: "Open" } });
    } else {
      const nonCash = isNonCashMode(b.paymentMode);
      jlines.push(nonCash ? { code: ACC.BANK, credit: totalAmount, narration: "Paid by bank" } : { code: ACC.CASH, credit: totalAmount, narration: "Paid by cash" });
      entryIdJournal = await postJournal(tx, {
        tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, voucherType: "PAYMENT", prefix: "FP",
        date: b.entryDate, narration: `Fuel Purchase — ${entryNo} — ${vehicle.vehicleNo}`, sourceType: "FUEL_ENTRY", sourceId: created.id, refNo: entryNo, createdBy: user.id, lines: jlines,
      });
      if (nonCash && b.bankId) {
        await recordBankMovement(tx, { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName ?? null },
          { bankId: b.bankId, bankName: b.bankName ?? null, bankAccount: b.bankAccount ?? null, date: b.entryDate, direction: "out", amount: totalAmount, mode: b.paymentMode ?? null, reference: b.invoiceNo ?? null, sourceType: "FuelEntry", sourceId: created.id, sourceNo: entryNo, partyName: fuelStationName, journalId: entryIdJournal, narration: `Fuel Purchase ${entryNo}` });
      }
    }

    return { id: created.id, entryNo };
  }, { maxWait: 10_000, timeout: 30_000 });

  await writeAudit(prisma, user, { action: "fuel_entry.create", entity: "FuelEntry", entityId: createdId, summary: `Fuel Purchase ${entryNo} — ${b.quantity}${b.uom} for vehicle ${vehicle.vehicleNo}, ₹${totalAmount}`, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, id: createdId, entryNo, totalAmount, warnings, message: "Fuel purchase recorded." }, { status: 201 });
}

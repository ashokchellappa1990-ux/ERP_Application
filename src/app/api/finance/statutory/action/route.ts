import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { createPayment, transition, saveChallan } from "@/lib/finance/statutory/service";
import { financialYear } from "@/lib/finance/statutory/types";
import { StatutoryPaymentCreateSchema, ChallanSaveSchema, ReturnSaveSchema, StatutoryActionSchema } from "@/lib/contracts/statutory";

const PERM = "finance.statutory-compliance";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "StatutoryPayment" });
  if (denied) return denied;

  let raw: { action?: string } & Record<string, unknown>;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const action = raw.action;
  const scope = await getActiveScope(user);
  const ip = requestMeta(req).ip;

  try {
    // ---- create a Draft government payment
    if (action === "create") {
      const parsed = StatutoryPaymentCreateSchema.safeParse(raw);
      if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
      const res = await createPayment(user, scope, parsed.data);
      await writeAudit(prisma, user, { action: "statutory.payment.create", entity: "StatutoryPayment", entityId: res.id, summary: `${parsed.data.statutoryType} payment ${res.paymentNo} — ${parsed.data.taxPeriod}`, meta: { type: parsed.data.statutoryType, period: parsed.data.taxPeriod, paidAmount: parsed.data.paidAmount }, businessId: scope.businessId, branchId: scope.branchId, ip });
      return NextResponse.json({ ok: true, id: res.id, paymentNo: res.paymentNo, message: `Government payment ${res.paymentNo} created (Draft).` }, { status: 201 });
    }

    // ---- workflow transition
    if (action === "transition") {
      const parsed = StatutoryActionSchema.safeParse(raw);
      if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
      const result = await transition(user, scope, parsed.data.op, parsed.data.id, parsed.data.reason);
      await writeAudit(prisma, user, { action: `statutory.payment.${parsed.data.op}`, entity: "StatutoryPayment", entityId: parsed.data.id, summary: `Payment #${parsed.data.id} → ${Object.values(result)[0]}`, meta: { ...result, reason: parsed.data.reason ?? null }, businessId: scope.businessId, branchId: scope.branchId, ip });
      return NextResponse.json({ ok: true, ...result, message: `Payment ${Object.values(result)[0]}.` });
    }

    // ---- save / update challan info
    if (action === "saveChallan") {
      const parsed = ChallanSaveSchema.safeParse(raw);
      if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
      await saveChallan(user, parsed.data.paymentId, parsed.data);
      await writeAudit(prisma, user, { action: "statutory.challan.save", entity: "StatutoryPayment", entityId: parsed.data.paymentId, summary: `Challan saved for payment #${parsed.data.paymentId}`, meta: { challanNo: parsed.data.challanNo ?? null }, businessId: scope.businessId, branchId: scope.branchId, ip });
      return NextResponse.json({ ok: true, message: "Challan saved." });
    }

    // ---- create a return-filing tracker row
    if (action === "createReturn") {
      const parsed = ReturnSaveSchema.safeParse(raw);
      if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
      const d = parsed.data;
      const row = await prisma.statutoryReturn.create({ data: { tenantId: user.tenantId, businessId: scope.businessId, branchId: scope.branchId, statutoryType: d.statutoryType, returnType: d.returnType, financialYear: financialYear(d.taxPeriod + "-01"), taxPeriod: d.taxPeriod, liabilityAmount: d.liabilityAmount, status: "Prepared", remarks: d.remarks ?? null, createdBy: user.id } });
      await writeAudit(prisma, user, { action: "statutory.return.create", entity: "StatutoryReturn", entityId: row.id, summary: `${d.returnType} prepared — ${d.taxPeriod}`, meta: { type: d.statutoryType, returnType: d.returnType, period: d.taxPeriod }, businessId: scope.businessId, branchId: scope.branchId, ip });
      return NextResponse.json({ ok: true, id: row.id, message: `${d.returnType} return prepared.` }, { status: 201 });
    }

    // ---- mark a return as filed (with acknowledgement)
    if (action === "fileReturn") {
      const id = Number(raw.id);
      const cur = await prisma.statutoryReturn.findFirst({ where: { id, tenantId: user.tenantId } });
      if (!cur) return NextResponse.json({ ok: false, message: "Return not found." }, { status: 404 });
      await prisma.statutoryReturn.update({ where: { id }, data: { status: "Filed", ackNo: (raw.ackNo as string) || null, filedDate: (raw.filedDate as string) || new Date().toISOString().slice(0, 10), filedBy: user.id } });
      await writeAudit(prisma, user, { action: "statutory.return.file", entity: "StatutoryReturn", entityId: id, summary: `${cur.returnType} filed — ${cur.taxPeriod}`, meta: { ackNo: (raw.ackNo as string) ?? null }, businessId: scope.businessId, branchId: scope.branchId, ip });
      return NextResponse.json({ ok: true, message: `${cur.returnType} marked Filed.` });
    }

    return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("[statutory] action", action, err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Action failed." }, { status: 422 });
  }
}

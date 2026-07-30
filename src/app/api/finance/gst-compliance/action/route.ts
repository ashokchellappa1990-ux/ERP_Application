import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import {
  VerifyRunSchema, ValidationResolveSchema, GenerateReturnSchema, ReturnTransitionSchema,
  GenerateJsonSchema, Gstr2bImportSchema, ReconResolveSchema, PeriodClosingSchema,
} from "@/lib/contracts/gstCompliance";
import * as store from "@/lib/finance/gst/store";
import { parseGstr2b, importGstr2b, runReconciliation } from "@/lib/finance/gst/recon";

const PERM = "finance.gst-compliance";

async function isElevated(user: { role?: string | null; roleId?: number | null }): Promise<boolean> {
  const r = (user.role ?? "").toLowerCase();
  if (["owner", "admin", "super-admin", "business-owner"].includes(r)) return true;
  if (user.roleId) {
    const role = await prisma.role.findUnique({ where: { id: user.roleId }, select: { isAllAccess: true, slug: true } });
    if (role?.isAllAccess) return true;
    if (role && ["business-owner", "admin", "finance-manager"].includes(role.slug)) return true;
  }
  return false;
}

// POST /api/finance/gst-compliance/action  — body: { action, ...payload }
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "GstCompliance" });
  if (denied) return denied;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const scope = await getActiveScope(user);
  const action = String(body.action ?? "");
  const fail = (m: string) => NextResponse.json({ ok: false, message: m }, { status: 422 });

  try {
    switch (action) {
      case "verify": {
        const p = VerifyRunSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message);
        return NextResponse.json({ ok: true, message: "Verification complete.", data: await store.runVerification(scope, user, p.data.period) });
      }
      case "resolveValidation": {
        const p = ValidationResolveSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message);
        await store.resolveValidation(scope, user, Number(body.id), p.data.status, p.data.note);
        return NextResponse.json({ ok: true, message: "Updated." });
      }
      case "generateReturn": {
        const p = GenerateReturnSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message);
        const id = await store.generateReturn(scope, user, p.data.returnType, p.data.period);
        return NextResponse.json({ ok: true, message: `${p.data.returnType} generated.`, id });
      }
      case "transitionReturn": {
        const p = ReturnTransitionSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message);
        if (p.data.subAction === "reopen" && !(await isElevated(user))) return NextResponse.json({ ok: false, message: "Only authorised users can reopen a filed return." }, { status: 403 });
        await store.transitionReturn(scope, user, Number(body.id), p.data.subAction, { arn: p.data.arn, remarks: p.data.remarks });
        return NextResponse.json({ ok: true, message: "Return updated." });
      }
      case "generateJson": {
        const p = GenerateJsonSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message);
        const res = await store.generateJson(scope, user, p.data.returnId);
        return NextResponse.json({ ok: true, message: `JSON generated (${res.validationStatus}).`, id: res.id });
      }
      case "import2b": {
        const p = Gstr2bImportSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message);
        const lines = p.data.rows?.length ? parseGstr2b(p.data.rows) : parseGstr2b(p.data.rawJson ?? "");
        if (!lines.length) return fail("No GSTR-2B invoices found in the upload.");
        const count = await importGstr2b(scope, user, p.data.period, p.data.source, p.data.fileName, lines);
        const recon = await runReconciliation(scope, p.data.period);
        await writeAudit(prisma, user, { action: "gst.recon.import", entity: "GstGstr2bImport", entityId: p.data.period, summary: `Imported ${count} GSTR-2B invoices for ${p.data.period}`, meta: { count, ...recon } });
        return NextResponse.json({ ok: true, message: `Imported ${count} invoices and reconciled.`, data: recon });
      }
      case "runRecon": {
        const period = String(body.period ?? "").slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(period)) return fail("Invalid period.");
        const recon = await runReconciliation(scope, period);
        await writeAudit(prisma, user, { action: "gst.recon.run", entity: "GstReconciliation", entityId: period, summary: `Reconciled GSTR-2B for ${period}`, meta: recon });
        return NextResponse.json({ ok: true, message: "Reconciliation complete.", data: recon });
      }
      case "resolveRecon": {
        const p = ReconResolveSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message);
        const rec = await prisma.gstReconciliation.findFirst({ where: { id: Number(body.id), tenantId: scope.tenantId } });
        if (!rec) return fail("Reconciliation row not found.");
        await prisma.gstReconciliation.update({ where: { id: rec.id }, data: { action: p.data.decision, resolvedBy: user.id, resolvedByName: user.fullName ?? null, resolvedAt: new Date() } });
        return NextResponse.json({ ok: true, message: "Updated." });
      }
      case "closePeriod": {
        const p = PeriodClosingSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message);
        if (p.data.subAction === "reopen" && !(await isElevated(user))) return NextResponse.json({ ok: false, message: "Only authorised users can reopen a GST period." }, { status: 403 });
        await store.closePeriod(scope, user, p.data.period, p.data.subAction, p.data.reason);
        return NextResponse.json({ ok: true, message: `Period ${p.data.subAction === "lock" ? "locked" : p.data.subAction === "reopen" ? "reopened" : "verified"}.` });
      }
      default:
        return fail("Unknown action.");
    }
  } catch (err) {
    console.error(`[gst-compliance] action ${action} error`, err);
    const msg = err instanceof Error ? err.message : "Action failed.";
    return NextResponse.json({ ok: false, message: msg }, { status: 422 });
  }
}

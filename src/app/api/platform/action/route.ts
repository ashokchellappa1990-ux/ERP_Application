import { NextResponse } from "next/server";
import { platformAuth, isResponse } from "@/lib/platform/apiGuard";
import * as svc from "@/lib/platform/service";
import {
  PlanSchema, TrialConfigSchema, SubscribeSchema, RenewSchema, ChangePlanSchema, LifecycleSchema, WorkspaceSchema, WorkspaceActionSchema,
  ConversionSchema, LicenseSchema, TenantStatusSchema, InvoiceSchema, PaymentSchema, ExtendTrialSchema, NotificationSchema, SettingsSchema,
} from "@/lib/platform/contracts";

const ACTION_PERM: Record<string, string> = {
  savePlan: "plans", saveTrialConfig: "trial-plans", setTenantStatus: "tenants", subscribe: "subscriptions", renew: "subscriptions", changePlan: "subscriptions",
  lifecycle: "subscriptions", convert: "subscriptions", createWorkspace: "workspaces", archiveWorkspace: "workspaces", restoreWorkspace: "workspaces",
  saveLicense: "licenses", createInvoice: "billing", recordPayment: "payments", extendTrial: "support", resetPassword: "support", unlockUser: "support",
  createSandbox: "support", activateLicense: "support", sendNotification: "notifications", saveSettings: "settings",
};

// POST /api/platform/action — { action, ...payload }
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const action = String(body.action ?? "");
  const perm = ACTION_PERM[action];
  if (!perm) return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
  const auth = await platformAuth(perm);
  if (isResponse(auth)) return auth;
  const actor = { byUser: auth.user.id, byName: auth.user.name };
  const fail = (m: string) => NextResponse.json({ ok: false, message: m }, { status: 422 });

  try {
    switch (action) {
      case "savePlan": { const p = PlanSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Plan saved.", id: await svc.savePlan(actor, p.data) }); }
      case "saveTrialConfig": { const p = TrialConfigSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Trial plan saved.", id: await svc.saveTrialConfig(actor, p.data) }); }
      case "setTenantStatus": { const p = TenantStatusSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.setTenantStatus(actor, p.data.tenantId, p.data.status); return NextResponse.json({ ok: true, message: `Tenant ${p.data.status.toLowerCase()}.` }); }
      case "subscribe": { const p = SubscribeSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.subscribe(actor, p.data); return NextResponse.json({ ok: true, message: `Subscription activated · ${r.invoiceNo}.`, ...r }); }
      case "renew": { const p = RenewSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.renew(actor, p.data.subscriptionId, p.data.billingCycle); return NextResponse.json({ ok: true, message: `Renewed until ${r.endDate} · ${r.invoiceNo}.`, ...r }); }
      case "changePlan": { const p = ChangePlanSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.changePlan(actor, p.data.subscriptionId, p.data.planId, p.data.action); return NextResponse.json({ ok: true, message: `Plan ${p.data.action.toLowerCase()}d.` }); }
      case "lifecycle": { const p = LifecycleSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.lifecycle(actor, p.data.subscriptionId, String(body.lifecycleAction) as "Cancelled" | "Suspended" | "Reactivated", p.data.note); return NextResponse.json({ ok: true, message: "Subscription updated." }); }
      case "createWorkspace": { const p = WorkspaceSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.createWorkspace(actor, p.data.tenantId, p.data.name, p.data.type); return NextResponse.json({ ok: true, message: "Workspace created." }); }
      case "archiveWorkspace": { const p = WorkspaceActionSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.archiveWorkspace(actor, p.data.workspaceId, p.data.reason); return NextResponse.json({ ok: true, message: "Workspace archived (read-only)." }); }
      case "restoreWorkspace": { const p = WorkspaceActionSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.restoreWorkspace(actor, p.data.workspaceId); return NextResponse.json({ ok: true, message: "Workspace restored." }); }
      case "convert": { const p = ConversionSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.convert(actor, p.data); return NextResponse.json({ ok: true, message: `Converted (${r.type}).`, ...r }); }
      case "saveLicense": { const p = LicenseSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "License saved.", data: await svc.saveLicense(actor, p.data) }); }
      case "createInvoice": { const p = InvoiceSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.createInvoice(actor, p.data); return NextResponse.json({ ok: true, message: `Invoice ${r.invoiceNo} created.`, ...r }); }
      case "recordPayment": { const p = PaymentSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.recordPayment(actor, p.data); return NextResponse.json({ ok: true, message: "Payment recorded." }); }
      case "extendTrial": { const p = ExtendTrialSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await svc.extendTrial(actor, p.data.tenantId, p.data.days); return NextResponse.json({ ok: true, message: `Trial extended to ${r.trialEndsAt}.`, ...r }); }
      case "resetPassword": { const r = await svc.resetTenantUserPassword(actor, String(body.email || "")); return NextResponse.json({ ok: true, message: `Temp password: ${r.tempPassword}`, ...r }); }
      case "unlockUser": { await svc.unlockTenantUser(actor, String(body.email || "")); return NextResponse.json({ ok: true, message: "User unlocked." }); }
      case "createSandbox": { const r = await svc.createSandbox(actor, Number(body.tenantId)); return NextResponse.json({ ok: true, message: "Sandbox created.", ...r }); }
      case "activateLicense": { await svc.activateLicense(actor, Number(body.tenantId)); return NextResponse.json({ ok: true, message: "License activated." }); }
      case "sendNotification": { const p = NotificationSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await svc.sendNotification(actor, p.data.tenantId ?? null, p.data.event, p.data.channel, p.data.recipient); return NextResponse.json({ ok: true, message: "Notification sent." }); }
      case "saveSettings": { const p = SettingsSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); return NextResponse.json({ ok: true, message: "Settings saved.", config: await svc.saveSettings(actor, p.data.config) }); }
      default: return fail("Unknown action.");
    }
  } catch (err) {
    console.error(`[platform] action ${action} error`, err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Action failed." }, { status: 422 });
  }
}

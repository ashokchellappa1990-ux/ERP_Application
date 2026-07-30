import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import * as svc from "@/lib/platform/service";

const PERM = "settings.subscription";

/** GET /api/subscription — the LOGGED-IN tenant's own plan status, plans & invoices.
 *  Strictly tenant-scoped (a customer can only see/act on their own subscription). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const [tenant, sub, plans, invoices] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true, plan: true, platformStatus: true, trialEndsAt: true, expiresAt: true } }),
    prisma.tenantSubscription.findFirst({ where: { tenantId: user.tenantId, status: "Active" }, include: { plan: true } }),
    svc.listPlans(),
    svc.listInvoices({ tenantId: user.tenantId }),
  ]);
  return NextResponse.json({
    ok: true,
    tenant: tenant ? { name: tenant.name, plan: tenant.plan, status: tenant.platformStatus, trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.toISOString().slice(0, 10) : "", expiresAt: tenant.expiresAt ? tenant.expiresAt.toISOString().slice(0, 10) : "" } : null,
    subscription: sub ? { id: sub.id, plan: sub.plan.name, tier: sub.plan.tier, status: sub.status, billingCycle: sub.billingCycle, endDate: sub.endDate ?? "", amount: Number(sub.amount) } : null,
    plans: plans.filter((p) => p.active),
    invoices,
  });
}

/** POST /api/subscription — self-service subscribe / renew for the OWN tenant. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "Subscription" });
  if (denied) return denied;

  let body: { action?: string; planId?: number; billingCycle?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const actor = { byUser: user.id, byName: user.fullName ?? "Customer", via: "self-service" };
  try {
    if (body.action === "subscribe") {
      if (!body.planId || !body.billingCycle) return NextResponse.json({ ok: false, message: "Plan and billing cycle are required." }, { status: 422 });
      const r = await svc.subscribe(actor, { tenantId: user.tenantId, planId: Number(body.planId), billingCycle: body.billingCycle });
      return NextResponse.json({ ok: true, message: `Subscribed — invoice ${r.invoiceNo}.`, ...r }, { status: 201 });
    }
    if (body.action === "renew") {
      const sub = await prisma.tenantSubscription.findFirst({ where: { tenantId: user.tenantId, status: "Active" } });
      if (!sub) return NextResponse.json({ ok: false, message: "No active subscription to renew." }, { status: 422 });
      const r = await svc.renew(actor, sub.id, body.billingCycle);
      return NextResponse.json({ ok: true, message: `Renewed until ${r.endDate} — ${r.invoiceNo}.`, ...r });
    }
    return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("[subscription] error", err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Action failed." }, { status: 422 });
  }
}

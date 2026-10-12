import { NextResponse } from "next/server";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { RegisterSchema, ApproveSchema, ActivateSchema, CancelSchema } from "@/lib/contracts/membershipRegistration";
import * as reg from "@/lib/membership/registration";
import { membershipRegAllowed } from "@/lib/membership/registrationGuard";

// POST /api/crm/membership/action — body { action, ...payload }
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await membershipRegAllowed(user))) return NextResponse.json({ ok: false, message: "You don't have permission for membership registration." }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }

  const scope = await getActiveScope(user);
  const seg = scopeData(scope, { branch: true });
  const ctx = { tenantId: user.tenantId, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, userId: user.id, userName: user.fullName ?? null };
  const action = String(body.action ?? "");
  const fail = (m: string) => NextResponse.json({ ok: false, message: m }, { status: 422 });
  void requestMeta;

  try {
    switch (action) {
      case "register": { const p = RegisterSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await reg.register(ctx, p.data); return NextResponse.json({ ok: true, message: `Registration ${r.registrationNo} created (${r.status}).`, ...r }, { status: 201 }); }
      case "approve": { const p = ApproveSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await reg.approve(ctx, p.data.registrationId, p.data.approve, p.data.note); return NextResponse.json({ ok: true, message: p.data.approve ? "Registration approved." : "Registration rejected.", ...r }); }
      case "activate": { const p = ActivateSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); const r = await reg.activate(ctx, p.data.registrationId); return NextResponse.json({ ok: true, message: `Membership activated — ${r.membershipNumber}.`, ...r }); }
      case "cancel": { const p = CancelSchema.safeParse(body); if (!p.success) return fail(p.error.issues[0].message); await reg.cancel(ctx, p.data.registrationId, p.data.reason); return NextResponse.json({ ok: true, message: "Registration cancelled." }); }
      case "reprintCard": { await reg.reprintCard(ctx, Number(body.registrationId)); return NextResponse.json({ ok: true, message: "Card reprint recorded." }); }
      case "recordDocument": { await reg.recordDocument(ctx, Number(body.registrationId), String(body.docType || "Card")); return NextResponse.json({ ok: true, message: "Document recorded." }); }
      default: return fail("Unknown action.");
    }
  } catch (err) {
    console.error(`[membership-reg] action ${action} error`, err);
    return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Action failed." }, { status: 422 });
  }
}

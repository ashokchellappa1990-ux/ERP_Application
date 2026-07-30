import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { membershipRegAllowed } from "@/lib/membership/registrationGuard";
import * as reg from "@/lib/membership/registration";
import { REG_REPORT_TYPES, type RegReportType } from "@/lib/contracts/membershipRegistration";

// GET /api/crm/membership/[section]
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await membershipRegAllowed(user))) return NextResponse.json({ ok: false, message: "You don't have permission for membership registration." }, { status: 403 });

  const scope = await getActiveScope(user);
  const s = { tenantId: user.tenantId, businessId: scope.businessId ?? null };
  const url = new URL(req.url);

  try {
    switch (params.section) {
      case "plans": return NextResponse.json({ ok: true, rows: await reg.listPlans(s) });
      case "qualify": {
        const customerId = Number(url.searchParams.get("customerId")) || 0;
        const levelId = Number(url.searchParams.get("levelId")) || 0;
        if (!customerId || !levelId) return NextResponse.json({ ok: false, message: "customerId and levelId required." }, { status: 400 });
        return NextResponse.json({ ok: true, data: await reg.verifyQualification(s, customerId, levelId) });
      }
      case "list": return NextResponse.json({ ok: true, rows: await reg.listRegistrations(s, { status: url.searchParams.get("status") ?? "All", levelId: Number(url.searchParams.get("levelId")) || undefined, q: (url.searchParams.get("q") ?? "").trim() }) });
      case "detail": { const d = await reg.getRegistration(s, Number(url.searchParams.get("id")) || 0); return NextResponse.json({ ok: true, data: d }); }
      case "dashboard": return NextResponse.json({ ok: true, data: await reg.getDashboard(s) });
      case "report": { const rt = (url.searchParams.get("report") ?? "register") as RegReportType; if (!REG_REPORT_TYPES.includes(rt)) return NextResponse.json({ ok: false, message: "Unknown report." }, { status: 400 }); return NextResponse.json({ ok: true, data: await reg.getReport(s, rt) }); }
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (err) {
    console.error(`[membership-reg] ${params.section} error`, err);
    return NextResponse.json({ ok: false, message: "Could not load this section." }, { status: 500 });
  }
}

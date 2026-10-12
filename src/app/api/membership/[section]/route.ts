import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { membershipAllowed } from "@/lib/membership/guard";
import * as svc from "@/lib/membership/service";
import { REPORT_TYPES, type ReportType } from "@/lib/contracts/membership";

// GET /api/membership/[section]?levelId=&report=
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (!(await membershipAllowed(user))) return NextResponse.json({ ok: false, message: "You don't have permission for the membership module." }, { status: 403 });

  const scope = await getActiveScope(user);
  const s = { tenantId: user.tenantId, businessId: scope.businessId ?? null };
  const url = new URL(req.url);
  const levelId = Number(url.searchParams.get("levelId")) || 0;

  try {
    switch (params.section) {
      case "general": return NextResponse.json({ ok: true, config: await svc.getGeneral(s) });
      case "levels": return NextResponse.json({ ok: true, rows: await svc.listLevels(s) });
      case "accounts": return NextResponse.json({ ok: true, accounts: await svc.listAccounts(s) });
      case "renewal": return NextResponse.json({ ok: true, config: await svc.getRenewal(s) });
      case "customer": return NextResponse.json({ ok: true, config: await svc.getCustomerConfig(s) });
      case "finance": return NextResponse.json({ ok: true, config: await svc.getFinance(s), accounts: await svc.listAccounts(s) });
      case "notification": return NextResponse.json({ ok: true, config: await svc.getNotification(s) });
      case "card": return NextResponse.json({ ok: true, config: await svc.getCard(s) });
      case "approval": return NextResponse.json({ ok: true, config: await svc.getApproval(s) });
      case "audit": return NextResponse.json({ ok: true, rows: await svc.listAudit(s) });
      case "report": {
        const rt = (url.searchParams.get("report") ?? "configuration") as ReportType;
        if (!REPORT_TYPES.includes(rt)) return NextResponse.json({ ok: false, message: "Unknown report." }, { status: 400 });
        return NextResponse.json({ ok: true, data: await svc.getReport(s, rt) });
      }
      // per-level sections require levelId
      case "qualification": return NextResponse.json({ ok: true, rows: levelId ? await svc.listQualification(s, levelId) : [] });
      case "benefit": return NextResponse.json({ ok: true, config: levelId ? await svc.getBenefit(s, levelId) : null });
      case "fee": return NextResponse.json({ ok: true, config: levelId ? await svc.getFee(s, levelId) : null });
      case "validity": return NextResponse.json({ ok: true, config: levelId ? await svc.getValidity(s, levelId) : null });
      case "upgrade": return NextResponse.json({ ok: true, config: levelId ? await svc.getUpgrade(s, levelId) : null });
      case "downgrade": return NextResponse.json({ ok: true, config: levelId ? await svc.getDowngrade(s, levelId) : null });
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (err) {
    console.error(`[membership] ${params.section} error`, err);
    return NextResponse.json({ ok: false, message: "Could not load this section." }, { status: 500 });
  }
}

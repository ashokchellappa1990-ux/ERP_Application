import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { analyze, pulse, search, type AiOpts, type FeedbackMap } from "@/lib/finance/ai/engine";

const PERM = "finance";
const thisMonth = () => new Date().toISOString().slice(0, 7);

// GET /api/finance/ai/<section>?period=&from=&to=&costCenterId=&profitCenterId=&q=
export async function GET(req: Request, { params }: { params: { section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const scope = await getActiveScope(user);
  const url = new URL(req.url);

  try {
    if (params.section === "pulse") {
      return NextResponse.json({ ok: true, pulse: await pulse(scope) });
    }
    if (params.section === "search") {
      return NextResponse.json({ ok: true, ...(await search(scope, url.searchParams.get("q") || "")) });
    }
    if (params.section === "panel") {
      const opts: AiOpts = {
        period: url.searchParams.get("period") || thisMonth(),
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
        costCenterId: url.searchParams.get("costCenterId") ? Number(url.searchParams.get("costCenterId")) : null,
        profitCenterId: url.searchParams.get("profitCenterId") ? Number(url.searchParams.get("profitCenterId")) : null,
      };
      // Load the user's saved dispositions (dismiss/review/ignore/resolve/assign).
      const rows = await prisma.aiFinanceFeedback.findMany({
        where: { tenantId: user.tenantId, ...(scope.businessId != null ? { businessId: scope.businessId } : {}) },
        select: { itemKey: true, status: true, assignedTo: true },
      }).catch(() => []);
      const fb: FeedbackMap = new Map(rows.map((r) => [r.itemKey, { status: r.status, assignedTo: r.assignedTo }]));
      return NextResponse.json({ ok: true, data: await analyze(scope, opts, fb) });
    }
    return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
  } catch (err) {
    console.error("[finance-ai]", params.section, err);
    return NextResponse.json({ ok: false, message: "Could not run the analysis." }, { status: 500 });
  }
}

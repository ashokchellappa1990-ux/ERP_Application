import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { C360NoteCreateSchema } from "@/lib/contracts/customer360";
import * as repo from "@/lib/crm/customer360";

const PERM = "crm.customer-360";

// GET /api/crm/customer-360/[id]/[section] — lazy per-tab data for the dashboard.
export async function GET(req: Request, { params }: { params: { id: string; section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, message: "Invalid customer." }, { status: 400 });
  const t = user.tenantId;

  try {
    switch (params.section) {
      case "summary": {
        const data = await repo.getSummary(t, id);
        if (!data) return NextResponse.json({ ok: false, message: "Customer not found." }, { status: 404 });
        return NextResponse.json({ ok: true, ...data });
      }
      case "overview": return NextResponse.json({ ok: true, data: await repo.getOverview(t, id) });
      case "sales": {
        const url = new URL(req.url);
        const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
        const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get("pageSize")) || 20));
        return NextResponse.json({ ok: true, data: await repo.getSales(t, id, page, pageSize) });
      }
      case "analysis": return NextResponse.json({ ok: true, data: await repo.getAnalysis(t, id) });
      case "loyalty": return NextResponse.json({ ok: true, data: await repo.getLoyalty(t, id) });
      case "financial": return NextResponse.json({ ok: true, data: await repo.getFinancial(t, id) });
      case "returns": return NextResponse.json({ ok: true, data: await repo.getReturns(t, id) });
      case "exchanges": return NextResponse.json({ ok: true, data: await repo.getExchanges(t, id) });
      case "cancellations": return NextResponse.json({ ok: true, data: await repo.getCancellations(t, id) });
      case "analytics": return NextResponse.json({ ok: true, data: await repo.getAnalytics(t, id) });
      case "audit": return NextResponse.json({ ok: true, data: await repo.getAudit(t, id) });
      case "notes": return NextResponse.json({ ok: true, data: await repo.getNotes(t, id) });
      default: return NextResponse.json({ ok: false, message: "Unknown section." }, { status: 404 });
    }
  } catch (err) {
    console.error(`[customer-360] ${params.section} error`, err);
    return NextResponse.json({ ok: false, message: "Could not load this section." }, { status: 500 });
  }
}

// POST /api/crm/customer-360/[id]/notes — add a customer note / logged communication.
export async function POST(req: Request, { params }: { params: { id: string; section: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  if (params.section !== "notes") return NextResponse.json({ ok: false, message: "Unsupported." }, { status: 404 });
  const denied = await requirePermission(user, PERM, { req, entity: "CustomerNote" });
  if (denied) return denied;

  const id = Number(params.id);
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = C360NoteCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });

  const seg = scopeData(await getActiveScope(user), { branch: true });
  await repo.addNote(user.tenantId, id, { ...parsed.data, userId: user.id, userName: user.fullName, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null });
  return NextResponse.json({ ok: true, message: "Note added." }, { status: 201 });
}

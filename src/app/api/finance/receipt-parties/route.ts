import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ReceiptPartySchema } from "@/lib/contracts/receipt";
import { listParties, createParty } from "@/lib/finance/receipt";

const PERM = "finance.receipt";

// GET /api/finance/receipt-parties?type=Supplier|Employee|Owner|Bank|Other
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM);
  if (denied) return denied;
  const scope = await getActiveScope(user);
  const type = new URL(req.url).searchParams.get("type") || "Other";
  const parties = await listParties({ tenantId: user.tenantId, businessId: scope.businessId ?? null }, type);
  return NextResponse.json({ ok: true, parties });
}

// POST /api/finance/receipt-parties — add a new party (stored in the respective master).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ReceiptParty" });
  if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ReceiptPartySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const scope = await getActiveScope(user);
  try {
    const party = await createParty({ tenantId: user.tenantId, businessId: scope.businessId ?? null }, parsed.data);
    await writeAudit(prisma, user, { action: "receipt.party.create", entity: party.source === "supplier" ? "Supplier" : "ReceiptParty", entityId: party.id, summary: `Added ${parsed.data.type} party ${party.name}`, businessId: scope.businessId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Party added.", party }, { status: 201 });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Could not add party." }, { status: 422 }); }
}

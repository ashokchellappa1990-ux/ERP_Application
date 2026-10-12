import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ReceiptSubHeadSchema } from "@/lib/contracts/receipt";
import { createSubHead } from "@/lib/finance/receipt";

const PERM = "accounting.receipt-config";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ReceiptSubHead" });
  if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ReceiptSubHeadSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const scope = await getActiveScope(user);
  try {
    const id = await createSubHead({ tenantId: user.tenantId, businessId: scope.businessId ?? null }, parsed.data);
    await writeAudit(prisma, user, { action: "receipt.subhead.create", entity: "ReceiptSubHead", entityId: id, summary: `Added sub-head ${parsed.data.name}`, businessId: scope.businessId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Sub-head added.", id }, { status: 201 });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 422 }); }
}

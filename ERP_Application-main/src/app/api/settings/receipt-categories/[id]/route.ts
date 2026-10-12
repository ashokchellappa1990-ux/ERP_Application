import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { ReceiptCategorySchema } from "@/lib/contracts/receipt";
import { updateCategory, deleteCategory } from "@/lib/finance/receipt";

const PERM = "accounting.receipt-config";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ReceiptCategory" });
  if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const parsed = ReceiptCategorySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const scope = await getActiveScope(user);
  try {
    await updateCategory({ tenantId: user.tenantId, businessId: scope.businessId ?? null }, Number(params.id), parsed.data);
    await writeAudit(prisma, user, { action: "settings.receipt.category.update", entity: "ReceiptCategory", entityId: params.id, summary: `Updated receipt category ${parsed.data.name}`, businessId: scope.businessId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Category updated." });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 422 }); }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ReceiptCategory" });
  if (denied) return denied;
  const scope = await getActiveScope(user);
  try {
    await deleteCategory({ tenantId: user.tenantId, businessId: scope.businessId ?? null }, Number(params.id));
    await writeAudit(prisma, user, { action: "settings.receipt.category.delete", entity: "ReceiptCategory", entityId: params.id, summary: "Deleted receipt category", businessId: scope.businessId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Category deleted." });
  } catch (e) { return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Failed." }, { status: 422 }); }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import type { ExpenseHeadDto } from "@/lib/contracts/finance";

const PERM = "finance.petty-cash";

/** Resolve a mapped GL account (validated to the tenant) into id + code + name for the DTO. */
async function resolveAccount(tenantId: number, accountId: number | null | undefined) {
  if (!accountId) return { accountId: null, accountCode: null, accountName: null };
  const a = await prisma.ledgerAccount.findFirst({ where: { id: Number(accountId), tenantId }, select: { id: true, code: true, name: true } });
  return a ? { accountId: a.id, accountCode: a.code, accountName: a.name } : { accountId: null, accountCode: null, accountName: null };
}

// POST — add an expense category (parentId null) or head (under a category).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ExpenseHead" });
  if (denied) return denied;
  let b: { name?: string; parentId?: number | null; accountId?: number | null; linkedFeature?: string | null };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, message: "Name is required." }, { status: 422 });
  const parentId = b.parentId ? Number(b.parentId) : null;
  if (parentId) {
    const parent = await prisma.expenseHead.findFirst({ where: { id: parentId, tenantId: user.tenantId } });
    if (!parent) return NextResponse.json({ ok: false, message: "Parent category not found." }, { status: 422 });
  }
  const acc = await resolveAccount(user.tenantId, b.accountId);
  // Stamp the active business so the row matches the scoped read on reload
  // (otherwise a business-scoped GET would never return the freshly-added head).
  const seg = scopeData(await getActiveScope(user));
  const h = await prisma.expenseHead.create({ data: { tenantId: user.tenantId, ...seg, name: name.slice(0, 120), parentId, accountId: acc.accountId, linkedFeature: b.linkedFeature || null } });
  const trackBudget = h.trackBudget;
  await writeAudit(prisma, user, {
    action: "expense_head.create", entity: "ExpenseHead", entityId: h.id,
    summary: `${parentId ? "Expense head" : "Expense category"} "${h.name}" added`,
    meta: { name: h.name, parentId: h.parentId, accountId: acc.accountId, linkedFeature: h.linkedFeature },
    ip: requestMeta(req).ip,
  });
  const head: ExpenseHeadDto = { id: h.id, name: h.name, parentId: h.parentId, active: h.active, ...acc, trackBudget, linkedFeature: h.linkedFeature };
  return NextResponse.json({ ok: true, head }, { status: 201 });
}

// PATCH — rename / activate-deactivate a head.
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ExpenseHead" });
  if (denied) return denied;
  let b: { id?: number; name?: string; active?: boolean; accountId?: number | null; trackBudget?: boolean; linkedFeature?: string | null };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 }); }
  const id = Number(b.id);
  const cur = await prisma.expenseHead.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  // accountId: undefined = leave as-is; null/0 = clear the mapping; >0 = set (validated to tenant).
  const accountId = b.accountId === undefined ? undefined : (b.accountId ? (await resolveAccount(user.tenantId, b.accountId)).accountId : null);
  const h = await prisma.expenseHead.update({
    where: { id },
    data: {
      name: b.name != null && b.name.trim() ? b.name.trim().slice(0, 120) : undefined, active: b.active != null ? !!b.active : undefined, accountId, trackBudget: b.trackBudget != null ? !!b.trackBudget : undefined,
      linkedFeature: b.linkedFeature === undefined ? undefined : (b.linkedFeature || null),
    },
  });
  const acc = await resolveAccount(user.tenantId, h.accountId);
  await writeAudit(prisma, user, {
    action: "expense_head.update", entity: "ExpenseHead", entityId: h.id,
    summary: `Expense head "${h.name}" updated`,
    meta: { name: h.name, active: h.active, parentId: h.parentId, accountId: h.accountId, linkedFeature: h.linkedFeature },
    ip: requestMeta(req).ip,
  });
  const head: ExpenseHeadDto = { id: h.id, name: h.name, parentId: h.parentId, active: h.active, ...acc, trackBudget: h.trackBudget, linkedFeature: h.linkedFeature };
  return NextResponse.json({ ok: true, head });
}

// DELETE ?id= — remove a head/category (children cascade).
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, PERM, { req, entity: "ExpenseHead" });
  if (denied) return denied;
  const id = Number(new URL(req.url).searchParams.get("id"));
  const cur = await prisma.expenseHead.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!cur) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  await prisma.expenseHead.delete({ where: { id } });
  await writeAudit(prisma, user, {
    action: "expense_head.delete", entity: "ExpenseHead", entityId: id,
    summary: `Expense head "${cur.name}" deleted`,
    meta: { name: cur.name, parentId: cur.parentId },
    ip: requestMeta(req).ip,
  });
  return NextResponse.json({ ok: true, message: "Deleted." });
}

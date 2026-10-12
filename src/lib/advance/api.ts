import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser, requestMeta } from "@/lib/auth/session";
import { getActiveScope, scopeData, scopeWhere } from "@/lib/auth/scope";
import { requirePermission } from "@/lib/auth/guard";
import { writeAudit } from "@/lib/audit/log";
import { stampTerminal, getActiveTerminalContext } from "@/lib/pos/terminalContext";
import {
  AdvanceCreateSchema, SettlementCreateSchema, RefundCreateSchema, StatusActionSchema, AdvanceTypeCreateSchema,
  ADVANCE_NEXT, isPosted, OPEN_ADVANCE, DEFAULT_ADVANCE_CONFIG, needsAdvanceApproval, type AdvanceConfigData,
  type AdvanceRow, type AdvanceDetail, type SettlementRow, type RefundRow, type AdvanceTypeRow,
} from "@/lib/contracts/advance";
import {
  ensureAdvanceTypesSeeded, getAdvanceConfigRow, advanceConfig, nextAdvanceNumber,
  postAdvanceVoucher, postSettlement, postRefund, reverseAdvanceGl, recomputeAdvance,
} from "./engine";
import { syncAdvanceNotifications } from "./notify";

const PERM = "finance.advance";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const attList = (v: unknown) => (Array.isArray(v) ? (v as { fileName?: string; fileUrl?: string; fileType?: string | null; size?: number }[]).filter((a) => a.fileUrl && a.fileName).slice(0, 10).map((a) => ({ fileName: String(a.fileName).slice(0, 200), fileUrl: String(a.fileUrl), fileType: a.fileType ?? null, size: Number(a.size) || 0 })) : []);

async function auth() {
  const user = await getSessionUser();
  if (!user) return { user: null as never, denied: NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 }) };
  const denied = await requirePermission(user, PERM);
  return { user, denied };
}

/* ==================================================== ADVANCE: list */
export async function listAdvances(req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "All";
  const scope = await getActiveScope(user);
  const sw = scopeWhere(scope, { branch: true });
  // Refresh advance notifications (approval / settlement / expiry) — deduped per day.
  try { await syncAdvanceNotifications(scope, advanceConfig(await getAdvanceConfigRow(prisma as unknown as Prisma.TransactionClient, user.tenantId, scope.businessId ?? null))); } catch { /* never blocks the list */ }
  const base: Prisma.AdvanceWhereInput = { ...sw };
  const where: Prisma.AdvanceWhereInput = { ...base };
  if (q) where.OR = [{ advanceNo: { contains: q } }, { partyName: { contains: q } }, { refNo: { contains: q } }, { advanceTypeName: { contains: q } }];
  if (status !== "All") where.status = status;

  const [rows, total, openCount, openAgg, pending] = await Promise.all([
    prisma.advance.findMany({ where, orderBy: { id: "desc" }, take: 100 }),
    prisma.advance.count({ where: base }),
    prisma.advance.count({ where: { ...base, status: { in: OPEN_ADVANCE } } }),
    prisma.advance.aggregate({ where: { ...base, status: { in: OPEN_ADVANCE } }, _sum: { balanceAmount: true } }),
    prisma.advance.count({ where: { ...base, approvalStatus: "Pending" } }),
  ]);
  const shaped: AdvanceRow[] = rows.map(shapeRow);
  return NextResponse.json({ ok: true, rows: shaped, stats: { total, open: openCount, outstanding: num(openAgg._sum.balanceAmount), pendingApproval: pending } });
}

function shapeRow(a: Prisma.AdvanceGetPayload<Record<string, never>>): AdvanceRow {
  return {
    id: a.id, advanceNo: a.advanceNo, advanceDate: a.advanceDate, advanceTypeName: a.advanceTypeName ?? "", direction: a.direction as AdvanceRow["direction"],
    partyType: a.partyType, partyName: a.partyName ?? "", refNo: a.refNo ?? "", netAmount: num(a.netAmount), settledAmount: num(a.settledAmount),
    refundedAmount: num(a.refundedAmount), balanceAmount: num(a.balanceAmount), status: a.status, approvalStatus: a.approvalStatus,
  };
}

/* ==================================================== ADVANCE: create */
export async function createAdvance(req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = AdvanceCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;

  const type = await prisma.advanceType.findFirst({ where: { id: b.advanceTypeId, tenantId: user.tenantId } });
  if (!type) return NextResponse.json({ ok: false, message: "Advance type not found." }, { status: 422 });

  const advanceAmount = r2(num(b.advanceAmount));
  const taxAmount = r2(num(b.taxAmount));
  const netAmount = r2(advanceAmount + taxAmount);
  const seg = scopeData(await getActiveScope(user), { branch: true });
  const stamp = stampTerminal(await getActiveTerminalContext(user), "WEB_POS");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const cfg = advanceConfig(await getAdvanceConfigRow(tx, user.tenantId, seg.businessId ?? null));
      const advanceNo = await nextAdvanceNumber(tx, user.tenantId, seg.businessId ?? null, "advance");
      const submit = b.saveMode === "Submit";
      const needsApproval = submit && needsAdvanceApproval(cfg, type.name, netAmount);
      const autoApprove = submit && !needsApproval;
      const status = autoApprove ? (type.direction === "received" ? "Collected" : "Paid") : (needsApproval ? "Pending" : "Draft");

      let adv = await tx.advance.create({
        data: {
          tenantId: user.tenantId, ...seg, advanceNo, advanceDate: (b.advanceDate || new Date().toISOString().slice(0, 10)).slice(0, 10),
          department: b.department || null, costCenterId: b.costCenterId || null, profitCenterId: b.profitCenterId || null,
          advanceTypeId: type.id, advanceTypeName: type.name, direction: type.direction, accountCode: type.accountCode,
          partyType: b.partyType || type.partyType, partyId: b.partyId || null, partyName: b.partyName?.trim() || null,
          refDocType: b.refDocType || null, refDocId: b.refDocId || null, refNo: b.refNo?.trim() || null,
          currency: b.currency || "INR", exchangeRate: num(b.exchangeRate) || 1, advanceAmount, taxAmount, netAmount, balanceAmount: netAmount,
          paymentMode: b.paymentMode || null, paymentRef: b.paymentRef?.trim() || null, bankId: b.bankId ?? null, bankName: b.bankName || null, bankAccount: b.bankAccount || null, narration: b.narration?.trim() || null,
          attachments: attList(b.attachments) as unknown as Prisma.InputJsonValue,
          approvalStatus: autoApprove ? "Approved" : (needsApproval ? "Pending" : "Draft"), status,
          createdBy: user.id, createdByName: user.fullName ?? null, ...stamp,
        },
      });
      if (autoApprove) {
        const jid = await postAdvanceVoucher(tx, adv);
        adv = await tx.advance.update({ where: { id: adv.id }, data: { journalId: jid, approvedBy: user.id, approvedByName: user.fullName ?? null, approvedAt: new Date() } });
      }
      return { id: adv.id, advanceNo, status };
    });
    await writeAudit(prisma, user, { action: "advance.create", entity: "Advance", entityId: result.id, summary: `Advance ${result.advanceNo} — ${type.name} — ${netAmount.toFixed(2)} (${result.status})`, meta: { advanceNo: result.advanceNo, type: type.name, netAmount, status: result.status }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: `Advance ${result.status === "Draft" ? "saved as draft" : result.status === "Pending" ? "submitted for approval" : "recorded"}.`, ...result }, { status: 201 });
  } catch (err) { console.error("[advance] create", err); return NextResponse.json({ ok: false, message: "Could not create the advance." }, { status: 500 }); }
}

/* ==================================================== ADVANCE: detail */
export async function getAdvance(id: number) {
  const { user, denied } = await auth(); if (denied) return denied;
  const a = await prisma.advance.findFirst({ where: { id, tenantId: user.tenantId }, include: { settlements: { orderBy: { id: "desc" } }, refunds: { orderBy: { id: "desc" } } } });
  if (!a) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  const detail: AdvanceDetail = {
    ...shapeRow(a), businessId: a.businessId, department: a.department ?? "", costCenterId: a.costCenterId, profitCenterId: a.profitCenterId,
    advanceTypeId: a.advanceTypeId, partyId: a.partyId, refDocType: a.refDocType ?? "", refDocId: a.refDocId,
    currency: a.currency, exchangeRate: num(a.exchangeRate), advanceAmount: num(a.advanceAmount), taxAmount: num(a.taxAmount), accountCode: a.accountCode ?? "",
    paymentMode: a.paymentMode ?? "", paymentRef: a.paymentRef ?? "", narration: a.narration ?? "", approvalNote: a.approvalNote ?? "", cancelReason: a.cancelReason ?? "",
    journalId: a.journalId, createdByName: a.createdByName ?? "", createdAt: a.createdAt.toISOString(),
    attachments: Array.isArray(a.attachments) ? (a.attachments as AdvanceDetail["attachments"]) : [],
    settlements: a.settlements.map((s) => ({ id: s.id, settlementNo: s.settlementNo, settlementDate: s.settlementDate, advanceNo: a.advanceNo, partyName: a.partyName ?? "", refInvoice: s.refInvoice ?? "", settlementAmount: num(s.settlementAmount), method: s.method, status: s.status, approvalStatus: s.approvalStatus, refNo: s.refNo ?? "", remarks: s.remarks ?? "" })),
    refundList: a.refunds.map((rf) => ({ id: rf.id, refundNo: rf.refundNo, refundDate: rf.refundDate, advanceNo: a.advanceNo, partyName: a.partyName ?? "", refundAmount: num(rf.refundAmount), refundMode: rf.refundMode ?? "", status: rf.status, approvalStatus: rf.approvalStatus, reason: rf.reason ?? "" })),
  };
  return NextResponse.json({ ok: true, data: detail });
}

/* ==================================================== ADVANCE: edit / delete */
export async function patchAdvance(id: number, req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  const existing = await prisma.advance.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (existing.status !== "Draft") return NextResponse.json({ ok: false, message: "Only a Draft advance can be edited." }, { status: 422 });
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = AdvanceCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  const type = await prisma.advanceType.findFirst({ where: { id: b.advanceTypeId, tenantId: user.tenantId } });
  if (!type) return NextResponse.json({ ok: false, message: "Advance type not found." }, { status: 422 });
  const advanceAmount = r2(num(b.advanceAmount)), taxAmount = r2(num(b.taxAmount)), netAmount = r2(advanceAmount + taxAmount);

  await prisma.advance.update({
    where: { id }, data: {
      advanceDate: (b.advanceDate || existing.advanceDate).slice(0, 10), department: b.department || null, costCenterId: b.costCenterId || null, profitCenterId: b.profitCenterId || null,
      advanceTypeId: type.id, advanceTypeName: type.name, direction: type.direction, accountCode: type.accountCode,
      partyType: b.partyType || type.partyType, partyId: b.partyId || null, partyName: b.partyName?.trim() || null,
      refDocType: b.refDocType || null, refDocId: b.refDocId || null, refNo: b.refNo?.trim() || null,
      currency: b.currency || "INR", exchangeRate: num(b.exchangeRate) || 1, advanceAmount, taxAmount, netAmount, balanceAmount: netAmount,
      paymentMode: b.paymentMode || null, paymentRef: b.paymentRef?.trim() || null, narration: b.narration?.trim() || null,
      attachments: attList(b.attachments) as unknown as Prisma.InputJsonValue,
      status: b.saveMode === "Submit" ? "Pending" : "Draft", approvalStatus: b.saveMode === "Submit" ? "Pending" : "Draft",
    },
  });
  await writeAudit(prisma, user, { action: "advance.update", entity: "Advance", entityId: id, summary: `Updated advance ${existing.advanceNo}`, meta: { advanceNo: existing.advanceNo, netAmount }, businessId: existing.businessId ?? null, branchId: existing.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Advance updated.", id, advanceNo: existing.advanceNo });
}

export async function deleteAdvance(id: number, req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  const existing = await prisma.advance.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  if (existing.status !== "Draft") return NextResponse.json({ ok: false, message: "Only a Draft advance can be deleted. Cancel it instead." }, { status: 422 });
  await prisma.advance.delete({ where: { id } });
  await writeAudit(prisma, user, { action: "advance.delete", entity: "Advance", entityId: id, summary: `Deleted advance ${existing.advanceNo}`, meta: { advanceNo: existing.advanceNo }, businessId: existing.businessId ?? null, branchId: existing.branchId ?? null, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Advance deleted." });
}

/* ==================================================== ADVANCE: status */
export async function advanceStatus(id: number, req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = StatusActionSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 422 });
  const { action, note } = parsed.data;
  const a = await prisma.advance.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!a) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  const to = ADVANCE_NEXT[action]?.[a.status];
  if (!to) return NextResponse.json({ ok: false, message: `Cannot ${action} a ${a.status} advance.` }, { status: 422 });
  if (action === "cancel" && (num(a.settledAmount) > 0 || num(a.refundedAmount) > 0)) return NextResponse.json({ ok: false, message: "This advance has settlements/refunds — reverse them first." }, { status: 422 });

  try {
    await prisma.$transaction(async (tx) => {
      if (action === "approve") {
        const posted = a.direction === "received" ? "Collected" : "Paid";
        const jid = await postAdvanceVoucher(tx, a);
        await tx.advance.update({ where: { id }, data: { approvalStatus: "Approved", status: posted, balanceAmount: num(a.netAmount), journalId: jid, approvedBy: user.id, approvedByName: user.fullName ?? null, approvedAt: new Date(), approvalNote: note ?? null } });
      } else if (action === "reject") {
        await tx.advance.update({ where: { id }, data: { approvalStatus: "Rejected", status: "Rejected", approvalNote: note ?? null } });
      } else if (action === "cancel") {
        if (isPosted(a.status) && a.journalId) await reverseAdvanceGl(tx, user.tenantId, "ADVANCE", a.id, new Date().toISOString().slice(0, 10), user.id);
        await tx.advance.update({ where: { id }, data: { status: "Cancelled", cancelledAt: new Date(), cancelReason: note ?? null } });
      } else {
        await tx.advance.update({ where: { id }, data: { status: to, approvalStatus: action === "reopen" ? "Draft" : a.approvalStatus } });
      }
    });
    await writeAudit(prisma, user, { action: `advance.${action}`, entity: "Advance", entityId: id, summary: `Advance ${a.advanceNo}: ${a.status} → ${to}`, meta: { advanceNo: a.advanceNo, from: a.status, to, note }, businessId: a.businessId ?? null, branchId: a.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: `Advance ${to.toLowerCase()}.`, status: to });
  } catch (err) { console.error("[advance] status", err); return NextResponse.json({ ok: false, message: "Action failed." }, { status: 500 }); }
}

/* ==================================================== SETTLEMENT */
export async function listSettlements(req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  const url = new URL(req.url); const q = (url.searchParams.get("q") ?? "").trim(); const status = url.searchParams.get("status") ?? "All";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.AdvanceSettlementWhereInput = { ...sw };
  if (status !== "All") where.status = status;
  if (q) where.OR = [{ settlementNo: { contains: q } }, { refInvoice: { contains: q } }, { refNo: { contains: q } }];
  const rows = await prisma.advanceSettlement.findMany({ where, orderBy: { id: "desc" }, take: 100, include: { advance: { select: { advanceNo: true, partyName: true } } } });
  const shaped: SettlementRow[] = rows.map((s) => ({ id: s.id, settlementNo: s.settlementNo, settlementDate: s.settlementDate, advanceNo: s.advance.advanceNo, partyName: s.advance.partyName ?? "", refInvoice: s.refInvoice ?? "", settlementAmount: num(s.settlementAmount), method: s.method, status: s.status, approvalStatus: s.approvalStatus }));
  return NextResponse.json({ ok: true, rows: shaped });
}

export async function createSettlement(req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = SettlementCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  const adv = await prisma.advance.findFirst({ where: { id: b.advanceId, tenantId: user.tenantId } });
  if (!adv) return NextResponse.json({ ok: false, message: "Advance not found." }, { status: 404 });
  if (!isPosted(adv.status)) return NextResponse.json({ ok: false, message: "Only an approved/open advance can be settled." }, { status: 422 });
  const amount = r2(num(b.settlementAmount));
  const seg = scopeData(await getActiveScope(user), { branch: true });
  const cfgRow = await getAdvanceConfigRow(prisma as unknown as Prisma.TransactionClient, user.tenantId, seg.businessId ?? null).catch(() => null);
  const cfg = advanceConfig(cfgRow);
  if (!cfg.allowNegativeAdjustment && amount > num(adv.balanceAmount) + 0.01) return NextResponse.json({ ok: false, message: `Settlement exceeds the advance balance (${num(adv.balanceAmount).toFixed(2)}).` }, { status: 422 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const settlementNo = await nextAdvanceNumber(tx, user.tenantId, seg.businessId ?? null, "settlement");
      const approve = b.autoApprove !== false; // default: post immediately
      let s = await tx.advanceSettlement.create({
        data: {
          tenantId: user.tenantId, ...seg, settlementNo, settlementDate: (b.settlementDate || new Date().toISOString().slice(0, 10)).slice(0, 10), advanceId: adv.id,
          refDocType: b.refDocType || null, refDocId: b.refDocId || null, refNo: b.refNo?.trim() || null, refInvoice: b.refInvoice?.trim() || null,
          settlementAmount: amount, method: b.method || "Manual", expenseAccountCode: b.expenseAccountCode || null, remarks: b.remarks?.trim() || null,
          approvalStatus: approve ? "Approved" : "Draft", status: approve ? "Approved" : "Draft", createdBy: user.id, createdByName: user.fullName ?? null,
        },
      });
      if (approve) { const jid = await postSettlement(tx, s, adv); s = await tx.advanceSettlement.update({ where: { id: s.id }, data: { journalId: jid } }); await recomputeAdvance(tx, adv.id); }
      return { id: s.id, settlementNo, approve };
    });
    await writeAudit(prisma, user, { action: "advance.settle", entity: "AdvanceSettlement", entityId: result.id, summary: `Settlement ${result.settlementNo} vs ${adv.advanceNo} — ${amount.toFixed(2)}`, meta: { settlementNo: result.settlementNo, advanceNo: adv.advanceNo, amount }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Settlement recorded.", ...result }, { status: 201 });
  } catch (err) { console.error("[advance] settle", err); return NextResponse.json({ ok: false, message: "Could not record the settlement." }, { status: 500 }); }
}

export async function settlementStatus(id: number, req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const { action, note } = StatusActionSchema.parse(raw);
  const s = await prisma.advanceSettlement.findFirst({ where: { id, tenantId: user.tenantId }, include: { advance: true } });
  if (!s) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  try {
    await prisma.$transaction(async (tx) => {
      if (action === "approve" && s.status === "Draft") { const jid = await postSettlement(tx, s, s.advance); await tx.advanceSettlement.update({ where: { id }, data: { status: "Approved", approvalStatus: "Approved", journalId: jid } }); await recomputeAdvance(tx, s.advanceId); }
      else if (action === "reverse" && s.status === "Approved") { if (s.journalId) await reverseAdvanceGl(tx, user.tenantId, "ADVANCE_SETTLEMENT", s.id, new Date().toISOString().slice(0, 10), user.id); await tx.advanceSettlement.update({ where: { id }, data: { status: "Reversed", reversedAt: new Date(), reverseReason: note ?? null } }); await recomputeAdvance(tx, s.advanceId); }
      else throw new Error(`Cannot ${action} a ${s.status} settlement.`);
    });
    await writeAudit(prisma, user, { action: `advance.settlement.${action}`, entity: "AdvanceSettlement", entityId: id, summary: `Settlement ${s.settlementNo} ${action}`, meta: { settlementNo: s.settlementNo, note }, businessId: s.businessId ?? null, branchId: s.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: `Settlement ${action === "reverse" ? "reversed" : "approved"}.` });
  } catch (err) { return NextResponse.json({ ok: false, message: err instanceof Error ? err.message : "Action failed." }, { status: 422 }); }
}

/* ==================================================== REFUND */
export async function listRefunds(req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  const url = new URL(req.url); const status = url.searchParams.get("status") ?? "All"; const q = (url.searchParams.get("q") ?? "").trim();
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.AdvanceRefundWhereInput = { ...sw };
  if (status !== "All") where.status = status;
  if (q) where.OR = [{ refundNo: { contains: q } }];
  const rows = await prisma.advanceRefund.findMany({ where, orderBy: { id: "desc" }, take: 100, include: { advance: { select: { advanceNo: true, partyName: true } } } });
  const shaped: RefundRow[] = rows.map((rf) => ({ id: rf.id, refundNo: rf.refundNo, refundDate: rf.refundDate, advanceNo: rf.advance.advanceNo, partyName: rf.advance.partyName ?? "", refundAmount: num(rf.refundAmount), refundMode: rf.refundMode ?? "", status: rf.status, approvalStatus: rf.approvalStatus }));
  return NextResponse.json({ ok: true, rows: shaped });
}

export async function createRefund(req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = RefundCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  const adv = await prisma.advance.findFirst({ where: { id: b.advanceId, tenantId: user.tenantId } });
  if (!adv) return NextResponse.json({ ok: false, message: "Advance not found." }, { status: 404 });
  if (!isPosted(adv.status)) return NextResponse.json({ ok: false, message: "Only an approved/open advance can be refunded." }, { status: 422 });
  const amount = r2(num(b.refundAmount));
  if (amount > num(adv.balanceAmount) + 0.01) return NextResponse.json({ ok: false, message: `Refund exceeds the advance balance (${num(adv.balanceAmount).toFixed(2)}).` }, { status: 422 });
  const seg = scopeData(await getActiveScope(user), { branch: true });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const refundNo = await nextAdvanceNumber(tx, user.tenantId, seg.businessId ?? null, "refund");
      const approve = b.autoApprove !== false;
      let rf = await tx.advanceRefund.create({ data: { tenantId: user.tenantId, ...seg, refundNo, refundDate: (b.refundDate || new Date().toISOString().slice(0, 10)).slice(0, 10), advanceId: adv.id, refundAmount: amount, refundMode: b.refundMode || null, reason: b.reason?.trim() || null, narration: b.narration?.trim() || null, approvalStatus: approve ? "Approved" : "Draft", status: approve ? "Approved" : "Draft", createdBy: user.id, createdByName: user.fullName ?? null } });
      if (approve) { const jid = await postRefund(tx, rf, adv); rf = await tx.advanceRefund.update({ where: { id: rf.id }, data: { journalId: jid } }); await recomputeAdvance(tx, adv.id); }
      return { id: rf.id, refundNo };
    });
    await writeAudit(prisma, user, { action: "advance.refund", entity: "AdvanceRefund", entityId: result.id, summary: `Refund ${result.refundNo} vs ${adv.advanceNo} — ${amount.toFixed(2)}`, meta: { refundNo: result.refundNo, advanceNo: adv.advanceNo, amount }, businessId: seg.businessId ?? null, branchId: seg.branchId ?? null, ip: requestMeta(req).ip });
    return NextResponse.json({ ok: true, message: "Refund recorded.", ...result }, { status: 201 });
  } catch (err) { console.error("[advance] refund", err); return NextResponse.json({ ok: false, message: "Could not record the refund." }, { status: 500 }); }
}

/* ==================================================== REGISTER + APPROVAL QUEUE */
export async function advanceRegister(req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  const url = new URL(req.url); const partyType = url.searchParams.get("partyType") ?? ""; const direction = url.searchParams.get("direction") ?? "";
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const where: Prisma.AdvanceWhereInput = { ...sw, status: { in: [...OPEN_ADVANCE, "Fully Settled", "Refunded", "Closed"] } };
  if (partyType) where.partyType = partyType;
  if (direction) where.direction = direction;
  const rows = await prisma.advance.findMany({ where, orderBy: { id: "desc" }, take: 300 });
  const totals = rows.reduce((t, a) => { t.net += num(a.netAmount); t.settled += num(a.settledAmount); t.refunded += num(a.refundedAmount); t.balance += num(a.balanceAmount); return t; }, { net: 0, settled: 0, refunded: 0, balance: 0 });
  return NextResponse.json({ ok: true, rows: rows.map(shapeRow), totals: { net: r2(totals.net), settled: r2(totals.settled), refunded: r2(totals.refunded), balance: r2(totals.balance) } });
}

export async function approvalQueue() {
  const { user, denied } = await auth(); if (denied) return denied;
  const sw = scopeWhere(await getActiveScope(user), { branch: true });
  const advances = await prisma.advance.findMany({ where: { ...sw, approvalStatus: "Pending" }, orderBy: { id: "desc" }, take: 100 });
  return NextResponse.json({ ok: true, advances: advances.map(shapeRow) });
}

/* ==================================================== CONFIG + TYPES */
export async function getAdvanceConfig() {
  const { user, denied } = await auth(); if (denied) return denied;
  const scope = await getActiveScope(user);
  await prisma.$transaction((tx) => ensureAdvanceTypesSeeded(tx, user.tenantId));
  const row = await getAdvanceConfigRow(prisma as unknown as Prisma.TransactionClient, user.tenantId, scope.businessId ?? null);
  return NextResponse.json({ ok: true, config: advanceConfig(row) });
}

export async function putAdvanceConfig(req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const scope = await getActiveScope(user);
  const merged: AdvanceConfigData = { ...DEFAULT_ADVANCE_CONFIG, ...(raw as Partial<AdvanceConfigData>) };
  const row = await getAdvanceConfigRow(prisma as unknown as Prisma.TransactionClient, user.tenantId, scope.businessId ?? null);
  await prisma.advanceConfig.update({ where: { id: row.id }, data: { config: merged as unknown as Prisma.InputJsonValue } });
  await writeAudit(prisma, user, { action: "advance.config.update", entity: "AdvanceConfig", entityId: row.id, summary: "Updated Advance Management configuration", meta: {}, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Configuration saved.", config: merged });
}

export async function listAdvanceTypes() {
  const { user, denied } = await auth(); if (denied) return denied;
  await prisma.$transaction((tx) => ensureAdvanceTypesSeeded(tx, user.tenantId));
  const rows = await prisma.advanceType.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] });
  const usage = await prisma.advance.groupBy({ by: ["advanceTypeId"], where: { tenantId: user.tenantId, advanceTypeId: { not: null } }, _count: true });
  const used = new Map(usage.map((u) => [u.advanceTypeId, u._count as number]));
  const shaped: AdvanceTypeRow[] = rows.map((t) => ({ id: t.id, code: t.code, name: t.name, direction: t.direction as AdvanceTypeRow["direction"], accountCode: t.accountCode, partyType: t.partyType, allowRefund: t.allowRefund, allowPartial: t.allowPartial, displayOrder: t.displayOrder, status: t.status, usage: used.get(t.id) ?? 0 }));
  return NextResponse.json({ ok: true, rows: shaped });
}

export async function createAdvanceType(req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const parsed = AdvanceTypeCreateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 422 });
  const b = parsed.data;
  const code = (b.code || b.name).trim().toUpperCase().replace(/\s+/g, "_").slice(0, 40);
  const dupe = await prisma.advanceType.findFirst({ where: { tenantId: user.tenantId, code } });
  if (dupe) return NextResponse.json({ ok: false, message: `Code "${code}" already exists.` }, { status: 409 });
  const max = await prisma.advanceType.aggregate({ where: { tenantId: user.tenantId }, _max: { displayOrder: true } });
  const created = await prisma.advanceType.create({ data: { tenantId: user.tenantId, code, name: b.name.trim(), direction: b.direction, accountCode: b.accountCode.trim(), partyType: b.partyType || "Customer", description: b.description?.trim() || null, allowRefund: b.allowRefund ?? true, allowPartial: b.allowPartial ?? true, displayOrder: b.displayOrder ?? (max._max.displayOrder ?? 0) + 1, status: "active" } });
  await writeAudit(prisma, user, { action: "advance.type.create", entity: "AdvanceType", entityId: created.id, summary: `Added advance type ${created.name}`, meta: { code, direction: b.direction }, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Advance type added.", id: created.id }, { status: 201 });
}

export async function patchAdvanceType(id: number, req: Request) {
  const { user, denied } = await auth(); if (denied) return denied;
  let raw: unknown; try { raw = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Invalid body." }, { status: 400 }); }
  const b = raw as Partial<{ name: string; direction: string; accountCode: string; partyType: string; allowRefund: boolean; allowPartial: boolean; displayOrder: number; status: string }>;
  const t = await prisma.advanceType.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!t) return NextResponse.json({ ok: false, message: "Not found." }, { status: 404 });
  await prisma.advanceType.update({ where: { id }, data: {
    name: b.name?.trim() || undefined, direction: b.direction === "received" || b.direction === "paid" ? b.direction : undefined, accountCode: b.accountCode?.trim() || undefined,
    partyType: b.partyType || undefined, allowRefund: b.allowRefund !== undefined ? b.allowRefund : undefined, allowPartial: b.allowPartial !== undefined ? b.allowPartial : undefined,
    displayOrder: b.displayOrder !== undefined ? Number(b.displayOrder) || 1 : undefined, status: b.status === "active" || b.status === "inactive" ? b.status : undefined,
  } });
  await writeAudit(prisma, user, { action: "advance.type.update", entity: "AdvanceType", entityId: id, summary: `Updated advance type ${b.name ?? t.name}`, meta: {}, ip: requestMeta(req).ip });
  return NextResponse.json({ ok: true, message: "Advance type updated." });
}

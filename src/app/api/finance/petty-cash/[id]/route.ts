import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import type { PettyCashDetail } from "@/lib/contracts/finance";

const num = (v: unknown) => (v == null ? 0 : Number(v));

// GET /api/finance/petty-cash/[id] — a petty-cash voucher with lines + payments.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  const denied = await requirePermission(user, "finance.petty-cash");
  if (denied) return denied;

  const v = await prisma.pettyCashVoucher.findFirst({
    where: { id: Number(params.id), tenantId: user.tenantId },
    include: { lines: { orderBy: { id: "asc" } }, payments: { orderBy: { id: "asc" } } },
  });
  if (!v) return NextResponse.json({ ok: false, message: "Voucher not found." }, { status: 404 });

  const voucher: PettyCashDetail = {
    id: v.id, voucherNo: v.voucherNo, voucherDate: v.voucherDate, payeeType: v.payeeType, payeeName: v.payeeName ?? "",
    gstApplicable: v.gstApplicable, taxableTotal: num(v.taxableTotal), cgst: num(v.cgst), sgst: num(v.sgst), taxTotal: num(v.taxTotal),
    totalAmount: num(v.totalAmount), notes: v.notes ?? "", status: v.status, createdAt: v.createdAt,
    lines: v.lines.map((l) => ({ headId: l.headId, headName: l.headName ?? "", description: l.description ?? "", hsn: l.hsn ?? "", gstPct: l.gstPct != null ? num(l.gstPct) : null, taxable: l.taxable != null ? num(l.taxable) : null, taxAmount: l.taxAmount != null ? num(l.taxAmount) : null, amount: num(l.amount) })),
    payments: v.payments.map((p) => ({ mode: p.mode, amount: num(p.amount), reference: p.reference ?? "" })),
  };
  return NextResponse.json({ ok: true, voucher });
}

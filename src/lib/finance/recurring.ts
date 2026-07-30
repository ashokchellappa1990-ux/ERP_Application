import type { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { postJournal } from "@/lib/accounting/post";
import { ACC, ensureAccounts } from "@/lib/accounting/accounts";
import { buildVoucherNo } from "@/lib/finance/pettyCashVoucherNo";
import { checkBudget } from "@/lib/finance/budgetService";
import { nextDate, type Frequency, type ConfigLine, type Settlement } from "@/lib/contracts/recurring";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);
type Db = Prisma.TransactionClient | typeof defaultPrisma;
type Cfg = Awaited<ReturnType<typeof defaultPrisma.recurringConfig.findFirst>>;

/** Config's amount for the next occurrence (fixed → amount; variable → default amount, override allowed). */
export function occurrenceAmount(cfg: NonNullable<Cfg>, override?: number): number {
  if (cfg.amountType === "variable" && override != null && override > 0) {
    const min = num(cfg.minAmount), max = num(cfg.maxAmount);
    let a = override;
    if (min > 0) a = Math.max(min, a);
    if (max > 0) a = Math.min(max, a);
    return r2(a);
  }
  return r2(num(cfg.amount));
}

/** Advance a config after a successful generation (or skip): set last/next + auto-complete on end. */
export async function advanceSchedule(db: Db, cfg: NonNullable<Cfg>, dueDate: string) {
  const next = nextDate(dueDate, cfg.frequency as Frequency, cfg.customDays);
  const expired = cfg.endDate ? next > cfg.endDate : false;
  await db.recurringConfig.update({
    where: { id: cfg.id },
    data: { lastExecution: dueDate, nextExecution: expired ? null : next, status: expired ? "Completed" : cfg.status },
  });
}

async function nextExecNo(db: Db, tenantId: number): Promise<string> {
  const n = await db.recurringExecution.count({ where: { tenantId } });
  return `RXN-${String(n + 1).padStart(6, "0")}`;
}

export interface GenerateResult { ok: boolean; executionId?: number; voucherNo?: string; status: string; message?: string }

/**
 * Generate the voucher for a recurring config's due occurrence — posts a real
 * Expense (PettyCashVoucher + GL) or Income (Receipt/Journal + GL) voucher, records
 * a RecurringExecution, and advances the schedule. Honours Budget Validation for
 * expenses (a Stop/Approval budget block fails the occurrence, no posting).
 */
export async function generateVoucher(
  db: Db,
  cfg: NonNullable<Cfg>,
  opts: { userId: number; generatedBy: "user" | "scheduler"; amount?: number; dueDate?: string },
): Promise<GenerateResult> {
  const dueDate = (opts.dueDate || cfg.nextExecution || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const seg = { businessId: cfg.businessId ?? undefined, branchId: cfg.branchId ?? undefined };
  // Per-head lines (multi-line voucher). A single-amount override scales the total.
  let lines = parseLines(cfg);
  if (opts.amount != null && opts.amount > 0 && lines.length) {
    const cur = lines.reduce((s, l) => s + num(l.amount), 0);
    const factor = cur > 0 ? opts.amount / cur : 1;
    lines = lines.map((l) => ({ ...l, amount: r2(num(l.amount) * factor) }));
  }
  if (!lines.length) return { ok: false, status: "Failed", message: "No head lines configured." };
  const perLine = lines.map((l) => ({ ...l, base: r2(num(l.amount)), gst: cfg.gstApplicable ? r2(num(l.amount) * num(l.gstPct) / 100) : 0 }));
  const totalTaxable = r2(perLine.reduce((s, l) => s + l.base, 0));
  const totalGst = r2(perLine.reduce((s, l) => s + l.gst, 0));
  const totalGross = r2(totalTaxable + totalGst);
  const tds = r2(totalTaxable * num(cfg.tdsRate) / 100);
  const tcs = r2(totalGross * num(cfg.tcsRate) / 100);

  if (cfg.txnType === "expense") {
    // Budget validation (optional): any head over budget fails the whole occurrence.
    if (cfg.budgetValidation) {
      for (const l of perLine) {
        if (!l.headId) continue;
        const decision = await checkBudget(db, { tenantId: cfg.tenantId, businessId: cfg.businessId, branchId: cfg.branchId, headId: l.headId, dateStr: dueDate, amount: r2(l.base + l.gst) });
        if (!decision.ok) {
          const execNo = await nextExecNo(db, cfg.tenantId);
          const ex = await db.recurringExecution.create({ data: { tenantId: cfg.tenantId, configId: cfg.id, ...seg, executionNo: execNo, executionDate: dueDate, dueDate, amount: totalGross, status: "Failed", generatedBy: opts.generatedBy, generatedByUserId: opts.userId, remarks: `Budget block (${l.headName}): ${decision.message}` } });
          return { ok: false, executionId: ex.id, status: "Failed", message: decision.message };
        }
      }
    }
    // Resolve each head's GL account, then group expense debits by account code.
    const codes = new Map<number, string>();
    for (const l of perLine) if (l.headId && !codes.has(l.headId)) codes.set(l.headId, await expenseHeadCode(db, cfg.tenantId, l.headId));
    const byCode: Record<string, number> = {};
    for (const l of perLine) { const code = (l.headId && codes.get(l.headId)) || ACC.INDIRECT_EXPENSE; byCode[code] = r2((byCode[code] ?? 0) + l.base); }

    const method = cfg.postingMethod; // ap | pay_now | journal
    const netPayable = r2(totalGross + tcs - tds);
    const execNo = await nextExecNo(db, cfg.tenantId);
    const result = await runInTx(db, async (tx) => {
      await ensureAccounts(tx, cfg.tenantId);
      const pcCfg = (await tx.pettyCashConfig.findUnique({ where: { tenantId: cfg.tenantId } })) ?? (await tx.pettyCashConfig.create({ data: { tenantId: cfg.tenantId } }));
      const { voucherNo, seq, period } = buildVoucherNo(pcCfg, new Date(dueDate + "T00:00:00"));
      await tx.pettyCashConfig.update({ where: { id: pcCfg.id }, data: { voucherSeq: seq, voucherSeqPeriod: period } });
      const isBusiness = method === "ap" || tds > 0 || tcs > 0;
      const voucher = await tx.pettyCashVoucher.create({
        data: {
          tenantId: cfg.tenantId, ...seg, voucherNo, voucherDate: dueDate, payeeType: cfg.partyType === "Employee" ? "Employee" : "Supplier",
          payeeId: cfg.partyId, payeeName: cfg.partyName, gstApplicable: cfg.gstApplicable, taxableTotal: totalTaxable, cgst: r2(totalGst / 2), sgst: r2(totalGst - totalGst / 2), taxTotal: totalGst, totalAmount: totalGross,
          expenseType: isBusiness ? "business" : "petty", postingType: method === "pay_now" ? "paynow" : "ap",
          tdsRate: num(cfg.tdsRate), tdsAmount: tds, tcsRate: num(cfg.tcsRate), tcsAmount: tcs, netPayable,
          notes: `Recurring ${cfg.configNo} — ${cfg.name}`, createdBy: opts.userId,
          lines: { create: perLine.map((l) => ({ tenantId: cfg.tenantId, ...seg, headId: l.headId, headName: l.headName, description: l.description, taxable: l.base, gstPct: num(l.gstPct) || null, taxAmount: l.gst || null, amount: r2(l.base + l.gst) })) },
        },
      });
      const jlines: { code: string; debit?: number; credit?: number; narration?: string }[] = [
        ...Object.entries(byCode).map(([code, amt]) => ({ code, debit: amt, narration: "Expense" })),
        { code: ACC.INPUT_GST, debit: totalGst, narration: "Input GST" },
        { code: ACC.TCS_RECEIVABLE, debit: tcs, narration: "TCS receivable" },
        { code: ACC.TDS_PAYABLE, credit: tds, narration: "TDS payable" },
      ];
      if (method === "pay_now") jlines.push({ code: ACC.CASH, credit: netPayable, narration: "Paid" });
      else { jlines.push({ code: ACC.PAYABLE, credit: netPayable, narration: `Payable to ${cfg.partyName ?? "supplier"}` }); await tx.payable.create({ data: { tenantId: cfg.tenantId, ...seg, sourceType: "EXPENSE", sourceId: voucher.id, refNo: voucherNo, supplier: cfg.partyName ?? null, docDate: dueDate, totalAmount: netPayable, paidAmount: 0, balanceAmount: netPayable, status: "Open" } }); }
      await postJournal(tx, { tenantId: cfg.tenantId, ...seg, voucherType: "PAYMENT", prefix: "PC", date: dueDate, narration: `Recurring Expense — ${voucherNo} — ${cfg.name}`, sourceType: "PETTY_CASH", sourceId: voucher.id, refNo: voucherNo, createdBy: opts.userId, lines: jlines });
      const ex = await tx.recurringExecution.create({ data: { tenantId: cfg.tenantId, configId: cfg.id, ...seg, executionNo: execNo, executionDate: dueDate, dueDate, amount: totalGross, settledAmount: method === "pay_now" ? netPayable : 0, status: "Posted", voucherType: "PETTY_CASH", voucherId: voucher.id, voucherNo, generatedBy: opts.generatedBy, generatedByUserId: opts.userId } });
      return { voucherNo, executionId: ex.id };
    });
    await advanceSchedule(db, cfg, dueDate);
    return { ok: true, executionId: result.executionId, voucherNo: result.voucherNo, status: "Posted" };
  }

  // INCOME — Dr Cash/Receivable (gross), Cr each income head account + Output GST.
  const incCodes = new Map<number, string>();
  for (const l of perLine) if (l.headId && !incCodes.has(l.headId)) incCodes.set(l.headId, await incomeAccountCode(db, cfg.tenantId, l.headId));
  const incByCode: Record<string, number> = {};
  for (const l of perLine) { const code = (l.headId && incCodes.get(l.headId)) || ACC.MISC_INCOME; incByCode[code] = r2((incByCode[code] ?? 0) + l.base); }
  const method = cfg.postingMethod; // ar | receive_now | journal
  const execNo = await nextExecNo(db, cfg.tenantId);
  const jid = await runInTx(db, async (tx) => {
    await ensureAccounts(tx, cfg.tenantId);
    const drCode = method === "receive_now" ? ACC.CASH : ACC.RECEIVABLE;
    const entryId = await postJournal(tx, {
      tenantId: cfg.tenantId, ...seg, voucherType: "RECEIPT", prefix: "RC", date: dueDate,
      narration: `Recurring Income — ${cfg.name}${cfg.partyName ? ` — ${cfg.partyName}` : ""}`, sourceType: "RECURRING_INCOME", sourceId: cfg.id, refNo: cfg.configNo, createdBy: opts.userId,
      lines: [
        { code: drCode, debit: totalGross, narration: method === "receive_now" ? "Received" : `Receivable from ${cfg.partyName ?? "customer"}` },
        ...Object.entries(incByCode).map(([code, amt]) => ({ code, credit: amt, narration: "Income" })),
        { code: ACC.OUTPUT_GST, credit: totalGst, narration: "Output GST" },
      ],
    });
    const ex = await tx.recurringExecution.create({ data: { tenantId: cfg.tenantId, configId: cfg.id, ...seg, executionNo: execNo, executionDate: dueDate, dueDate, amount: totalGross, settledAmount: method === "receive_now" ? totalGross : 0, status: "Posted", voucherType: "RECEIPT", voucherId: entryId, voucherNo: entryId ? `RC-${String(entryId).padStart(6, "0")}` : null, generatedBy: opts.generatedBy, generatedByUserId: opts.userId } });
    return ex.id;
  });
  await advanceSchedule(db, cfg, dueDate);
  return { ok: true, executionId: jid, status: "Posted" };
}

/* ------------------------------------------------------------- helpers -- */

/** Payment/collection status of a generated voucher. Expense-AP reads the real
 *  Payable; pay-now/receive-now are settled immediately; income-AR is outstanding. */
export function settlementFrom(
  inp: { txnType: string; postingMethod: string; amount: number; status: string; settledAmount?: number },
  payable?: { totalAmount: unknown; paidAmount: unknown; balanceAmount: unknown } | null,
): Settlement | null {
  if (inp.status !== "Posted") return null;
  const amt = num(inp.amount);
  if (inp.txnType === "expense") {
    if (inp.postingMethod === "pay_now") return { kind: "payment", label: "Fully Paid", tone: "success", total: amt, settled: amt, balance: 0 };
    if (payable) {
      const tot = num(payable.totalAmount), paid = num(payable.paidAmount), bal = num(payable.balanceAmount);
      return { kind: "payment", label: bal <= 0.01 ? "Fully Paid" : paid > 0.01 ? "Partially Paid" : "Unpaid", tone: bal <= 0.01 ? "success" : paid > 0.01 ? "warning" : "danger", total: tot, settled: paid, balance: bal };
    }
    return { kind: "payment", label: "Unpaid", tone: "danger", total: amt, settled: 0, balance: amt };
  }
  // income — no receivable table; collection tracked on the execution (settledAmount).
  const settled = inp.postingMethod === "receive_now" ? amt : num(inp.settledAmount);
  const bal = +(amt - settled).toFixed(2);
  return { kind: "collection", label: bal <= 0.01 ? "Fully Collected" : settled > 0.01 ? "Partially Collected" : "Outstanding", tone: bal <= 0.01 ? "success" : settled > 0.01 ? "warning" : "danger", total: amt, settled, balance: bal };
}

interface RawLine { headId?: number | null; headName?: string | null; description?: string | null; amount?: number; gstPct?: number }
/** Normalise the payload's head lines: resolve names, sum totals, derive the header
 *  summary (single head → that head; many → "N heads"). Falls back to the single
 *  headId/amount when no lines array is sent (backward-compatible). */
export async function normalizeLines(
  tenantId: number, txnType: string,
  body: { lines?: RawLine[]; headId?: number | null; amount?: number; gstPct?: number },
): Promise<{ lines: ConfigLine[]; total: number; headId: number | null; headName: string | null; linesJson: string }> {
  const raw = body.lines?.length ? body.lines : (body.headId ? [{ headId: body.headId, amount: body.amount, gstPct: body.gstPct }] : []);
  const lines: ConfigLine[] = [];
  for (const l of raw) {
    if (!l.headId && !num(l.amount)) continue;
    const headName = l.headName || (await resolveHeadName(tenantId, txnType, l.headId ?? null));
    lines.push({ headId: l.headId ?? null, headName, description: l.description ?? null, amount: r2(num(l.amount)), gstPct: num(l.gstPct) });
  }
  const total = r2(lines.reduce((s, l) => s + l.amount, 0));
  const headId = lines.length === 1 ? lines[0].headId : null;
  const headName = lines.length === 1 ? lines[0].headName : lines.length > 1 ? `${lines.length} heads` : null;
  return { lines, total, headId, headName, linesJson: JSON.stringify(lines) };
}

/** Parse a config's stored lines (falls back to a single line from the header). */
export function parseLines(cfg: { linesJson: string | null; headId: number | null; headName: string | null; amount: unknown; gstPct: unknown }): ConfigLine[] {
  try { const a = cfg.linesJson ? JSON.parse(cfg.linesJson) as ConfigLine[] : []; if (a.length) return a; } catch { /* */ }
  return cfg.headId || num(cfg.amount) ? [{ headId: cfg.headId, headName: cfg.headName, description: null, amount: num(cfg.amount), gstPct: num(cfg.gstPct) }] : [];
}

/** Display name for a config's head (expense head, or income Receipt Category). */
export async function resolveHeadName(tenantId: number, txnType: string, headId: number | null): Promise<string | null> {
  if (!headId) return null;
  if (txnType === "expense") { const h = await defaultPrisma.expenseHead.findFirst({ where: { id: headId, tenantId }, select: { name: true } }); return h?.name ?? null; }
  const c = await defaultPrisma.receiptCategory.findFirst({ where: { id: headId, tenantId }, select: { name: true } }); return c?.name ?? null;
}

async function expenseHeadCode(db: Db, tenantId: number, headId: number | null): Promise<string> {
  if (!headId) return ACC.INDIRECT_EXPENSE;
  const head = await db.expenseHead.findFirst({ where: { id: headId, tenantId }, select: { accountId: true } });
  if (!head?.accountId) return ACC.INDIRECT_EXPENSE;
  const a = await db.ledgerAccount.findFirst({ where: { id: head.accountId, tenantId }, select: { code: true } });
  return a?.code ?? ACC.INDIRECT_EXPENSE;
}
/** Income head → GL credit account. The income head is a Receipt Category whose
 *  configured creditCode is the income ledger account (falls back to Misc Income). */
async function incomeAccountCode(db: Db, tenantId: number, categoryId: number | null): Promise<string> {
  if (!categoryId) return ACC.MISC_INCOME;
  const c = await db.receiptCategory.findFirst({ where: { id: categoryId, tenantId }, select: { creditCode: true } });
  return c?.creditCode || ACC.MISC_INCOME;
}

// Run in the given tx, or open one if a full client was passed.
async function runInTx<T>(db: Db, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if ("$transaction" in db && typeof (db as typeof defaultPrisma).$transaction === "function") {
    return (db as typeof defaultPrisma).$transaction(fn);
  }
  return fn(db as Prisma.TransactionClient);
}

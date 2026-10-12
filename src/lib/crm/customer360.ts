import { prisma } from "@/lib/db/prisma";
import type {
  C360Header, C360Kpis, C360Summary, C360Overview, C360SalesPage, C360Analysis, C360Loyalty,
  C360Financial, C360ReturnRow, C360ExchangeRow, C360CancellationRow, C360Analytics, C360AuditRow,
  C360Note, C360NameVal, C360Activity,
} from "@/lib/contracts/customer360";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (n: number) => +(Number(n) || 0).toFixed(2);
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => { const d = (Date.parse(b) - Date.parse(a)) / 86400000; return Number.isFinite(d) ? Math.round(d) : null; };
const top = (m: Map<string, number>, n = 5): C360NameVal[] => [...m.entries()].filter(([k]) => k && k !== "—").sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, value]) => ({ name, value: r2(value) }));

async function userNames(ids: (number | null | undefined)[]): Promise<Map<number, string>> {
  const list = Array.from(new Set(ids.filter((x): x is number => !!x)));
  if (!list.length) return new Map();
  const us = await prisma.user.findMany({ where: { id: { in: list } }, select: { id: true, fullName: true } });
  return new Map(us.map((u) => [u.id, u.fullName]));
}

/** Header + KPI cards (the initial dashboard load). */
export async function getSummary(tenantId: number, customerId: number): Promise<C360Summary | null> {
  const c = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!c) return null;
  const saleWhere = { tenantId, customerId, status: "Completed" } as const;
  const [agg, lastSale, todayAgg, monthAgg, returns, exchanges, cancellations, unpaid, bal] = await Promise.all([
    prisma.sale.aggregate({ where: saleWhere, _sum: { total: true }, _count: true, _max: { total: true } }),
    prisma.sale.findFirst({ where: saleWhere, orderBy: [{ saleDate: "desc" }, { id: "desc" }], select: { saleDate: true, total: true } }),
    prisma.sale.aggregate({ where: { ...saleWhere, saleDate: today() }, _sum: { total: true } }),
    prisma.sale.aggregate({ where: { ...saleWhere, saleDate: { startsWith: today().slice(0, 7) } }, _sum: { total: true } }),
    prisma.salesReturn.count({ where: { tenantId, customerId, status: { not: "Rejected" } } }),
    prisma.salesExchange.count({ where: { tenantId, customerId, status: { not: "Rejected" } } }),
    prisma.salesCancellation.count({ where: { tenantId, customerId } }),
    prisma.sale.findMany({ where: { tenantId, customerId, status: "Completed", paymentStatus: { not: "Paid" } }, select: { total: true, amountPaid: true } }),
    prisma.loyaltyCustomerBalance.findUnique({ where: { tenantId_customerId: { tenantId, customerId } } }),
  ]);
  const orders = agg._count;
  const lifetime = num(agg._sum.total);
  const creditOutstanding = unpaid.reduce((s, x) => s + Math.max(0, num(x.total) - num(x.amountPaid)), 0);
  const since = c.regDate || c.createdAt.toISOString().slice(0, 10);
  const lastDate = lastSale?.saleDate ?? "";

  const header: C360Header = {
    id: c.id, code: c.code ?? `CUST-${c.id}`, name: c.name, phone: c.phone ?? "", altMobile: c.altMobile ?? "", email: c.email ?? "",
    customerGroup: c.customerGroup ?? "", type: c.type ?? "", gstin: c.gstin ?? "", businessName: c.businessName ?? "",
    address: c.address ?? "", city: c.city ?? "", state: c.state ?? "", country: "India",
    regDate: since, lastPurchase: lastDate, lastVisit: lastDate, status: c.status ?? "Active", approvalStatus: c.approvalStatus ?? "draft",
  };
  const kpis: C360Kpis = {
    totalSales: lifetime, todayPurchase: num(todayAgg._sum.total), monthPurchase: num(monthAgg._sum.total), lifetimePurchase: lifetime,
    totalOrders: orders, avgBill: orders ? r2(lifetime / orders) : 0, highestBill: num(agg._max.total), lastPurchaseAmount: num(lastSale?.total),
    outstanding: r2(num(c.openingReceivable) + creditOutstanding), advance: num(c.openingAdvance),
    availablePoints: bal?.available ?? c.availableRewardPoints, earnedPoints: bal?.earned ?? c.totalRewardPointsEarned, redeemedPoints: bal?.redeemed ?? c.totalRewardPointsRedeemed,
    totalReturns: returns, totalExchanges: exchanges, totalCancelled: cancellations,
    customerSince: since, daysSinceLastPurchase: lastDate ? daysBetween(lastDate, today()) : null,
  };
  return { header, kpis };
}

/** Overview tab — favourites, preferences, top products, activity timeline. */
export async function getOverview(tenantId: number, customerId: number): Promise<C360Overview> {
  const [sales, lines] = await Promise.all([
    prisma.sale.findMany({ where: { tenantId, customerId, status: "Completed" }, orderBy: { saleDate: "asc" }, select: { id: true, saleDate: true, paymentMode: true, warehouse: true, cashierUserId: true, createdBy: true, total: true, invoiceNo: true } }),
    prisma.saleLine.findMany({ where: { sale: { tenantId, customerId, status: "Completed" } }, select: { productId: true, productName: true, qty: true, value: true } }),
  ]);
  const productIds = Array.from(new Set(lines.map((l) => l.productId)));
  const prods = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, category: true, brand: true } }) : [];
  const pMap = new Map(prods.map((p) => [p.id, p]));
  const cat = new Map<string, number>(), brand = new Map<string, number>(), prodVal = new Map<string, number>(), prodQty = new Map<string, number>();
  for (const l of lines) {
    const p = pMap.get(l.productId);
    cat.set(p?.category || "—", (cat.get(p?.category || "—") ?? 0) + num(l.value));
    brand.set(p?.brand || "—", (brand.get(p?.brand || "—") ?? 0) + num(l.value));
    prodVal.set(l.productName, (prodVal.get(l.productName) ?? 0) + num(l.value));
    prodQty.set(l.productName, (prodQty.get(l.productName) ?? 0) + num(l.qty));
  }
  const pay = new Map<string, number>(), br = new Map<string, number>(), sp = new Map<number, number>();
  for (const s of sales) { pay.set(s.paymentMode || "—", (pay.get(s.paymentMode || "—") ?? 0) + 1); br.set(s.warehouse || "—", (br.get(s.warehouse || "—") ?? 0) + 1); const u = s.cashierUserId ?? s.createdBy; if (u) sp.set(u, (sp.get(u) ?? 0) + 1); }
  const topPay = [...pay.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const topBr = [...br.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const topSpId = [...sp.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const uNames = await userNames([topSpId]);

  const first = sales[0]?.saleDate, last = sales[sales.length - 1]?.saleDate;
  const freq = sales.length > 1 && first && last ? Math.round((daysBetween(first, last) ?? 0) / (sales.length - 1)) : null;

  // Recent activity timeline (sales + returns + exchanges + cancellations).
  const [recentSales, recentRet, recentExc, recentCxl] = await Promise.all([
    prisma.sale.findMany({ where: { tenantId, customerId }, orderBy: { id: "desc" }, take: 6, select: { saleDate: true, total: true, invoiceNo: true, status: true } }),
    prisma.salesReturn.findMany({ where: { tenantId, customerId }, orderBy: { id: "desc" }, take: 4, select: { returnDate: true, refundAmount: true, returnNo: true } }),
    prisma.salesExchange.findMany({ where: { tenantId, customerId }, orderBy: { id: "desc" }, take: 4, select: { exchangeDate: true, priceDifference: true, exchangeNo: true } }),
    prisma.salesCancellation.findMany({ where: { tenantId, customerId }, orderBy: { id: "desc" }, take: 4, select: { cancellationDate: true, invoiceAmount: true, cancellationNo: true } }),
  ]);
  const acts: C360Activity[] = [
    ...recentSales.map((s) => ({ date: s.saleDate, type: "Sale", title: `Invoice ${s.invoiceNo}${s.status !== "Completed" ? ` (${s.status})` : ""}`, amount: num(s.total), ref: s.invoiceNo })),
    ...recentRet.map((r) => ({ date: r.returnDate, type: "Return", title: `Return ${r.returnNo}`, amount: num(r.refundAmount), ref: r.returnNo })),
    ...recentExc.map((e) => ({ date: e.exchangeDate, type: "Exchange", title: `Exchange ${e.exchangeNo}`, amount: num(e.priceDifference), ref: e.exchangeNo })),
    ...recentCxl.map((x) => ({ date: x.cancellationDate, type: "Cancellation", title: `Cancelled ${x.cancellationNo}`, amount: num(x.invoiceAmount), ref: x.cancellationNo })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);

  return {
    purchaseFrequencyDays: freq, visitFrequencyDays: freq,
    favouriteCategory: top(cat, 1)[0]?.name ?? "—", favouriteBrand: top(brand, 1)[0]?.name ?? "—",
    preferredPayment: topPay, preferredBranch: topBr, preferredSalesperson: topSpId ? (uNames.get(topSpId) ?? `#${topSpId}`) : "—",
    favouriteProducts: top(prodQty, 5), topProducts: top(prodVal, 5), recentActivities: acts,
  };
}

/** Sales History tab (server-side paginated). */
export async function getSales(tenantId: number, customerId: number, page: number, pageSize: number): Promise<C360SalesPage> {
  const where = { tenantId, customerId } as const;
  const [total, rows] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({ where, orderBy: { id: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const uNames = await userNames(rows.flatMap((s) => [s.cashierUserId, s.createdBy]));
  return {
    rows: rows.map((s) => ({
      id: s.id, invoiceNo: s.invoiceNo, date: s.saleDate, branch: s.warehouse ?? "—", terminal: s.terminalId ? `T-${s.terminalId}` : "—",
      salesperson: uNames.get(s.cashierUserId ?? s.createdBy ?? 0) ?? "—",
      amount: num(s.subtotal), discount: r2(num(s.itemDiscount) + num(s.billDiscount)), tax: num(s.taxTotal), net: num(s.total),
      paymentType: s.paymentMode ?? "—", status: s.status,
    })),
    total, page, pageSize,
  };
}

/** Purchase Analysis tab — aggregates for charts. */
export async function getAnalysis(tenantId: number, customerId: number): Promise<C360Analysis> {
  const [sales, lines] = await Promise.all([
    prisma.sale.findMany({ where: { tenantId, customerId, status: "Completed" }, select: { saleDate: true, total: true, warehouse: true, createdAt: true } }),
    prisma.saleLine.findMany({ where: { sale: { tenantId, customerId, status: "Completed" } }, select: { productId: true, productName: true, value: true } }),
  ]);
  const productIds = Array.from(new Set(lines.map((l) => l.productId)));
  const prods = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, category: true, brand: true } }) : [];
  const pMap = new Map(prods.map((p) => [p.id, p]));
  const monthly = new Map<string, number>(), yearly = new Map<string, number>(), byBranch = new Map<string, number>(), byWeekday = new Map<string, number>(), byHour = new Map<string, number>();
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const s of sales) {
    const t = num(s.total);
    monthly.set(s.saleDate.slice(0, 7), (monthly.get(s.saleDate.slice(0, 7)) ?? 0) + t);
    yearly.set(s.saleDate.slice(0, 4), (yearly.get(s.saleDate.slice(0, 4)) ?? 0) + t);
    byBranch.set(s.warehouse || "—", (byBranch.get(s.warehouse || "—") ?? 0) + t);
    const dt = new Date(s.saleDate + "T00:00:00"); if (!isNaN(dt.getTime())) byWeekday.set(WD[dt.getDay()], (byWeekday.get(WD[dt.getDay()]) ?? 0) + t);
    const h = s.createdAt.getHours(); const hk = `${String(h).padStart(2, "0")}:00`; byHour.set(hk, (byHour.get(hk) ?? 0) + t);
  }
  const cat = new Map<string, number>(), brand = new Map<string, number>(), prod = new Map<string, number>();
  for (const l of lines) { const p = pMap.get(l.productId); cat.set(p?.category || "—", (cat.get(p?.category || "—") ?? 0) + num(l.value)); brand.set(p?.brand || "—", (brand.get(p?.brand || "—") ?? 0) + num(l.value)); prod.set(l.productName, (prod.get(l.productName) ?? 0) + num(l.value)); }
  const sortKey = (m: Map<string, number>): C360NameVal[] => [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([name, value]) => ({ name, value: r2(value) }));
  return {
    monthly: sortKey(monthly).slice(-12), yearly: sortKey(yearly),
    byCategory: top(cat, 8), byBrand: top(brand, 8), byProduct: top(prod, 10), byBranch: top(byBranch, 8),
    byWeekday: WD.map((d) => ({ name: d, value: r2(byWeekday.get(d) ?? 0) })), byHour: sortKey(byHour),
  };
}

/** Loyalty tab. */
export async function getLoyalty(tenantId: number, customerId: number): Promise<C360Loyalty> {
  const [bal, c, led] = await Promise.all([
    prisma.loyaltyCustomerBalance.findUnique({ where: { tenantId_customerId: { tenantId, customerId } } }),
    prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { availableRewardPoints: true, totalRewardPointsEarned: true, totalRewardPointsRedeemed: true, totalRewardPointsExpired: true } }),
    prisma.loyaltyTransactionLedger.findMany({ where: { tenantId, customerId }, orderBy: { id: "desc" }, take: 50 }),
  ]);
  return {
    available: bal?.available ?? c?.availableRewardPoints ?? 0, earned: bal?.earned ?? c?.totalRewardPointsEarned ?? 0,
    redeemed: bal?.redeemed ?? c?.totalRewardPointsRedeemed ?? 0, expired: bal?.expired ?? c?.totalRewardPointsExpired ?? 0,
    ledger: led.map((l) => ({ id: l.id, date: l.txnDate, type: l.txnType, earned: l.points > 0 ? l.points : 0, redeemed: l.points < 0 ? -l.points : 0, balance: l.balanceAfter, ref: l.invoiceNo ?? "", remarks: l.remarks ?? "" })),
  };
}

/** Financial tab — outstanding/advance/credit + payments + ageing + ledger. */
export async function getFinancial(tenantId: number, customerId: number): Promise<C360Financial> {
  const c = await prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { openingReceivable: true, openingAdvance: true, creditLimit: true } });
  const sales = await prisma.sale.findMany({ where: { tenantId, customerId, status: "Completed" }, orderBy: { id: "asc" }, select: { id: true, saleDate: true, invoiceNo: true, total: true, amountPaid: true, paymentStatus: true } });
  const pays = await prisma.salePayment.findMany({ where: { sale: { tenantId, customerId, status: "Completed" } }, orderBy: { id: "desc" }, take: 50, select: { mode: true, amount: true, reference: true, createdAt: true, saleId: true } });
  const invMap = new Map(sales.map((s) => [s.id, s.invoiceNo]));

  const creditOutstanding = sales.reduce((s, x) => s + Math.max(0, num(x.total) - num(x.amountPaid)), 0);
  const outstanding = r2(num(c?.openingReceivable) + creditOutstanding);
  const creditLimit = num(c?.creditLimit);
  // Ageing of unpaid balances by invoice date.
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 } as Record<string, number>;
  for (const s of sales) { const due = Math.max(0, num(s.total) - num(s.amountPaid)); if (due <= 0) continue; const age = daysBetween(s.saleDate, today()) ?? 0; const k = age <= 30 ? "0-30" : age <= 60 ? "31-60" : age <= 90 ? "61-90" : "90+"; buckets[k] += due; }
  // Simple ledger: each sale debits, each payment credits, running balance.
  type L = { date: string; particular: string; debit: number; credit: number };
  const ev: L[] = [];
  for (const s of sales) { ev.push({ date: s.saleDate, particular: `Invoice ${s.invoiceNo}`, debit: num(s.total), credit: 0 }); if (num(s.amountPaid) > 0) ev.push({ date: s.saleDate, particular: `Payment — ${s.invoiceNo}`, debit: 0, credit: num(s.amountPaid) }); }
  ev.sort((a, b) => (a.date < b.date ? -1 : 1));
  let run = num(c?.openingReceivable);
  const ledger = ev.slice(-100).map((e) => { run += e.debit - e.credit; return { ...e, balance: r2(run) }; });

  return {
    outstanding, advance: num(c?.openingAdvance), creditLimit, creditAvailable: r2(Math.max(0, creditLimit - outstanding)),
    payments: pays.map((p) => ({ date: p.createdAt.toISOString().slice(0, 10), invoiceNo: invMap.get(p.saleId) ?? "", mode: p.mode, amount: num(p.amount), reference: p.reference ?? "" })),
    ageing: Object.entries(buckets).map(([bucket, amount]) => ({ bucket, amount: r2(amount) })),
    ledger,
  };
}

export async function getReturns(tenantId: number, customerId: number): Promise<C360ReturnRow[]> {
  const rows = await prisma.salesReturn.findMany({ where: { tenantId, customerId }, orderBy: { id: "desc" }, take: 200, select: { id: true, returnNo: true, returnDate: true, invoiceNo: true, notes: true, refundRemarks: true, refundAmount: true, status: true } });
  return rows.map((r) => ({ id: r.id, returnNo: r.returnNo, date: r.returnDate, invoiceNo: r.invoiceNo ?? "", reason: r.notes || r.refundRemarks || "", amount: num(r.refundAmount), status: r.status }));
}

export async function getExchanges(tenantId: number, customerId: number): Promise<C360ExchangeRow[]> {
  const rows = await prisma.salesExchange.findMany({ where: { tenantId, customerId }, orderBy: { id: "desc" }, take: 200, select: { id: true, exchangeNo: true, exchangeDate: true, priceDifference: true, status: true } });
  const items = rows.length ? await prisma.salesExchangeItem.findMany({ where: { exchangeId: { in: rows.map((r) => r.id) } }, select: { exchangeId: true, side: true, productName: true } }) : [];
  const oldP = new Map<number, string>(), newP = new Map<number, string>();
  for (const it of items) { const m = it.side === "NEW" ? newP : oldP; if (!m.has(it.exchangeId)) m.set(it.exchangeId, it.productName); }
  return rows.map((e) => ({ id: e.id, exchangeNo: e.exchangeNo, date: e.exchangeDate, oldProduct: oldP.get(e.id) ?? "—", newProduct: newP.get(e.id) ?? "—", difference: num(e.priceDifference), status: e.status }));
}

export async function getCancellations(tenantId: number, customerId: number): Promise<C360CancellationRow[]> {
  const rows = await prisma.salesCancellation.findMany({ where: { tenantId, customerId }, orderBy: { id: "desc" }, take: 200, select: { id: true, cancellationNo: true, cancellationDate: true, invoiceNo: true, reason: true, invoiceAmount: true, status: true, createdBy: true, approvedBy: true } });
  const uNames = await userNames(rows.flatMap((r) => [r.approvedBy, r.createdBy]));
  return rows.map((r) => ({ id: r.id, cancellationNo: r.cancellationNo, date: r.cancellationDate, invoiceNo: r.invoiceNo ?? "", reason: r.reason ?? "", cancelledBy: uNames.get(r.approvedBy ?? r.createdBy ?? 0) ?? "—", amount: num(r.invoiceAmount), status: r.status }));
}

/** Analytics tab — RFM, health, repeat %, ranking, risk (heuristic). */
export async function getAnalytics(tenantId: number, customerId: number): Promise<C360Analytics> {
  const agg = await prisma.sale.aggregate({ where: { tenantId, customerId, status: "Completed" }, _sum: { total: true, cost: true }, _count: true });
  const last = await prisma.sale.findFirst({ where: { tenantId, customerId, status: "Completed" }, orderBy: { saleDate: "desc" }, select: { saleDate: true } });
  const frequency = agg._count;
  const monetary = num(agg._sum.total);
  const recency = last?.saleDate ? (daysBetween(last.saleDate, today()) ?? null) : null;
  // Rank by lifetime spend among customers with any sales.
  const higher = await prisma.customer.count({ where: { tenantId, totalSpent: { gt: monetary } } });
  // RFM heuristic (1-5 each).
  const rScore = recency == null ? 1 : recency <= 15 ? 5 : recency <= 45 ? 4 : recency <= 90 ? 3 : recency <= 180 ? 2 : 1;
  const fScore = frequency >= 20 ? 5 : frequency >= 10 ? 4 : frequency >= 5 ? 3 : frequency >= 2 ? 2 : 1;
  const mScore = monetary >= 100000 ? 5 : monetary >= 50000 ? 4 : monetary >= 20000 ? 3 : monetary >= 5000 ? 2 : 1;
  const health = Math.round((rScore + fScore + mScore) / 15 * 100);
  const healthLabel = health >= 70 ? "Healthy" : health >= 40 ? "At Watch" : "At Risk";
  const risk = recency == null ? 60 : Math.min(100, Math.round((recency / 180) * 100));
  const profit = r2(monetary - num(agg._sum.cost));
  return {
    recencyDays: recency, frequency, monetary,
    rfmScore: `${rScore}-${fScore}-${mScore}`, healthScore: health, healthLabel,
    repeatPurchasePct: frequency > 1 ? r2(((frequency - 1) / frequency) * 100) : 0,
    profitContribution: profit, ranking: monetary > 0 ? higher + 1 : null, riskScore: risk, riskLabel: risk >= 66 ? "High" : risk >= 33 ? "Medium" : "Low",
  };
}

/** Audit History tab — customer + its sales/returns/exchanges/cancellations. */
export async function getAudit(tenantId: number, customerId: number): Promise<C360AuditRow[]> {
  const [saleIds, retIds, excIds, cxlIds] = await Promise.all([
    prisma.sale.findMany({ where: { tenantId, customerId }, select: { id: true } }),
    prisma.salesReturn.findMany({ where: { tenantId, customerId }, select: { id: true } }),
    prisma.salesExchange.findMany({ where: { tenantId, customerId }, select: { id: true } }),
    prisma.salesCancellation.findMany({ where: { tenantId, customerId }, select: { id: true } }),
  ]);
  const str = (a: { id: number }[]) => a.map((x) => String(x.id));
  const rows = await prisma.auditLog.findMany({
    where: {
      tenantId,
      OR: [
        { entity: "Customer", entityId: String(customerId) },
        { entity: { in: ["Sale"] }, entityId: { in: str(saleIds) } },
        { entity: { in: ["SalesReturn"] }, entityId: { in: str(retIds) } },
        { entity: { in: ["SalesExchange"] }, entityId: { in: str(excIds) } },
        { entity: { in: ["SalesCancellation"] }, entityId: { in: str(cxlIds) } },
        { entity: "LoyaltyTransactionLedger", entityId: String(customerId) },
      ],
    },
    orderBy: { id: "desc" }, take: 100,
  });
  return rows.map((a) => ({ id: a.id, date: a.createdAt.toISOString(), action: a.action, entity: a.entity, summary: a.summary ?? "", user: a.userName ?? "System" }));
}

export async function getNotes(tenantId: number, customerId: number): Promise<C360Note[]> {
  const rows = await prisma.customerNote.findMany({ where: { tenantId, customerId }, orderBy: { id: "desc" }, take: 100 });
  return rows.map((n) => ({ id: n.id, type: n.type, subject: n.subject ?? "", body: n.body, createdByName: n.createdByName ?? "", createdAt: n.createdAt.toISOString() }));
}

export async function addNote(tenantId: number, customerId: number, p: { type?: string; subject?: string; body: string; userId: number; userName: string; businessId?: number | null; branchId?: number | null }): Promise<void> {
  await prisma.customerNote.create({ data: { tenantId, customerId, businessId: p.businessId ?? null, branchId: p.branchId ?? null, type: p.type || "Note", subject: p.subject || null, body: p.body, createdBy: p.userId, createdByName: p.userName } });
}

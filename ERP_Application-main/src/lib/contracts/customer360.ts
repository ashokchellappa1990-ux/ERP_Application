import { z } from "zod";

/** Customer 360 Dashboard — DTOs for the summary + per-tab detail APIs. */

export interface C360SearchRow { id: number; code: string; name: string; phone: string; email: string; gstin: string; city: string; status: string }

export interface C360Header {
  id: number; code: string; name: string; phone: string; altMobile: string; email: string;
  customerGroup: string; type: string; gstin: string; businessName: string;
  address: string; city: string; state: string; country: string;
  regDate: string; lastPurchase: string; lastVisit: string; status: string; approvalStatus: string;
}
export interface C360Kpis {
  totalSales: number; todayPurchase: number; monthPurchase: number; lifetimePurchase: number;
  totalOrders: number; avgBill: number; highestBill: number; lastPurchaseAmount: number;
  outstanding: number; advance: number;
  availablePoints: number; earnedPoints: number; redeemedPoints: number;
  totalReturns: number; totalExchanges: number; totalCancelled: number;
  customerSince: string; daysSinceLastPurchase: number | null;
}
export interface C360Summary { header: C360Header; kpis: C360Kpis }

export interface C360NameVal { name: string; value: number; count?: number }
export interface C360Activity { date: string; type: string; title: string; amount: number; ref: string }
export interface C360Overview {
  purchaseFrequencyDays: number | null; visitFrequencyDays: number | null;
  favouriteCategory: string; favouriteBrand: string;
  preferredPayment: string; preferredBranch: string; preferredSalesperson: string;
  favouriteProducts: C360NameVal[]; topProducts: C360NameVal[];
  recentActivities: C360Activity[];
}

export interface C360SaleRow {
  id: number; invoiceNo: string; date: string; branch: string; terminal: string; salesperson: string;
  amount: number; discount: number; tax: number; net: number; paymentType: string; status: string;
}
export interface C360SalesPage { rows: C360SaleRow[]; total: number; page: number; pageSize: number }

export interface C360Analysis {
  monthly: C360NameVal[]; yearly: C360NameVal[];
  byCategory: C360NameVal[]; byBrand: C360NameVal[]; byBranch: C360NameVal[]; byProduct: C360NameVal[];
  byWeekday: C360NameVal[]; byHour: C360NameVal[];
}

export interface C360LedgerRow { id: number; date: string; type: string; earned: number; redeemed: number; balance: number; ref: string; remarks: string }
export interface C360Loyalty { available: number; earned: number; redeemed: number; expired: number; ledger: C360LedgerRow[] }

export interface C360PaymentRow { date: string; invoiceNo: string; mode: string; amount: number; reference: string }
export interface C360AgeingBucket { bucket: string; amount: number }
export interface C360FinLedgerRow { date: string; particular: string; debit: number; credit: number; balance: number }
export interface C360Financial {
  outstanding: number; advance: number; creditLimit: number; creditAvailable: number;
  payments: C360PaymentRow[]; ageing: C360AgeingBucket[]; ledger: C360FinLedgerRow[];
}

export interface C360ReturnRow { id: number; returnNo: string; date: string; invoiceNo: string; reason: string; amount: number; status: string }
export interface C360ExchangeRow { id: number; exchangeNo: string; date: string; oldProduct: string; newProduct: string; difference: number; status: string }
export interface C360CancellationRow { id: number; cancellationNo: string; date: string; invoiceNo: string; reason: string; cancelledBy: string; amount: number; status: string }

export interface C360Analytics {
  recencyDays: number | null; frequency: number; monetary: number;
  rfmScore: string; healthScore: number; healthLabel: string;
  repeatPurchasePct: number; profitContribution: number; ranking: number | null; riskScore: number; riskLabel: string;
}

export interface C360AuditRow { id: number; date: string; action: string; entity: string; summary: string; user: string }

export interface C360Note { id: number; type: string; subject: string; body: string; createdByName: string; createdAt: string }
export const C360NoteCreateSchema = z.object({
  type: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  body: z.string().trim().min(1, "Note text is required."),
});
export type C360NoteCreateInput = z.infer<typeof C360NoteCreateSchema>;

export type C360Section = "summary" | "overview" | "sales" | "analysis" | "loyalty" | "financial" | "returns" | "exchanges" | "cancellations" | "analytics" | "audit" | "notes";

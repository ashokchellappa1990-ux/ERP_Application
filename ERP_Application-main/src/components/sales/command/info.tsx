"use client";

import { DrillDot } from "@/components/dashboard/DrillModal";

/**
 * Per-widget "about" content for the Sales Dashboard. Each entry explains WHAT the widget shows
 * and HOW it is calculated (the underlying formula / data source). Rendered via <InfoButton id/>.
 */
export interface WidgetInfo { title: string; what: string; calc?: string; note?: string }

const SALE = "Sale = completed sales invoices (POS + B2B). All figures respect the active filters (month, channel, branch, executive, customer/product category, brand).";

export const WIDGET_INFO: Record<string, WidgetInfo> = {
  // ---- KPIs ----
  salesToday: { title: "Today's Sales", what: "Total invoiced sales dated today.", calc: "Σ Sale.total where saleDate = today and status = Completed." },
  salesMonth: { title: "Current Month Sales", what: "Total invoiced sales for the selected month, with growth vs the previous month.", calc: "Σ Sale.total in month. Growth % = (this − prev) ÷ |prev| × 100." },
  salesYear: { title: "Current Year Sales", what: "Total invoiced sales for the calendar year of the selected month.", calc: "Σ Sale.total where saleDate is in Jan–Dec of the year." },
  grossSales: { title: "Gross Sales", what: "Merchandise value before tax and bill-level discount.", calc: "Σ Sale.subtotal (line rate × qty, before bill discount & GST)." },
  netSales: { title: "Net Sales", what: "Invoiced sales after deducting sales returns.", calc: "Σ Sale.total − Σ SalesReturn.refundAmount for the month." },
  grossProfit: { title: "Gross Profit", what: "Profit after cost of goods sold (COGS).", calc: "Σ (Sale.total − Sale.cost). Cost is the FIFO COGS captured on each invoice line." },
  marginPct: { title: "Gross Margin %", what: "Gross profit as a percentage of sales.", calc: "Gross Profit ÷ Sales × 100." },
  invoices: { title: "Sales Invoices", what: "Number of completed invoices in the month.", calc: "count(Sale) where status = Completed." },
  orders: { title: "Sales Orders", what: "Number of sales orders raised in the month.", calc: "count(SalesDocument) where docType = order and docDate in month." },
  pendingOrders: { title: "Pending Orders", what: "Sales orders not yet converted, completed or cancelled.", calc: "count(SalesDocument order) where status ∈ {Draft, Sent, Accepted}." },
  cancelled: { title: "Cancelled Invoices", what: "Invoices voided in the month.", calc: "count(Sale) where status = Cancelled." },
  avgInvoice: { title: "Average Invoice Value", what: "Average value of an invoice.", calc: "avg(Sale.total) = Sales ÷ invoice count." },
  avgOrderValue: { title: "Average Order Value", what: "Average value of a sales order.", calc: "avg(SalesDocument.netAmount) for orders in the month." },
  avgDiscount: { title: "Average Discount %", what: "Share of gross value given away as discount.", calc: "(Σ item discount + Σ bill discount) ÷ Gross Sales × 100." },
  returnValue: { title: "Sales Return Value", what: "Value of goods returned by customers.", calc: "Σ SalesReturn.refundAmount for the month." },
  returnPct: { title: "Sales Return %", what: "Returns as a percentage of sales.", calc: "Return Value ÷ Sales × 100." },

  // ---- Overview panels ----
  scorecard: { title: "Sales Scorecard", what: "A single 0–100 health score for sales, plus its component scores.", calc: "Average of Sales Growth, Profitability (margin×3), Return Control (100 − return%×8), Order Conversion (converted ÷ orders), Customer Loyalty (repeat%×1.5). Each capped 0–100." },
  insights: { title: "AI Sales Insights", what: "Automatic, rule-based observations over the live numbers.", calc: "Deterministic rules on the KPIs (growth, top category/branch, returns, margin, new customers). No external AI needed." },
  topBranches: { title: "Top 10 Branches", what: "Best-performing branches by sales, with month-on-month growth.", calc: "Σ Sale.total grouped by branch; growth vs the same branch last month; ranked descending." },
  topExecutives: { title: "Top 10 Sales Executives", what: "Sales attributed to each executive.", calc: "Σ Sale.total grouped by cashier user (cashierUserId → name).", note: "The ERP stores no salesperson on invoices, so the billing cashier is used as a proxy for the sales executive." },
  recent: { title: "Recent Sales Activity", what: "The latest orders, invoices and returns.", calc: "Most recent 8 rows of SalesDocument (orders), Sale (invoices) and SalesReturn." },

  // ---- Trends / products ----
  trend: { title: "Sales Trend", what: "Sales over time at the chosen granularity, with momentum.", calc: "Σ Sale.total bucketed by day/week/month/quarter/year. Momentum = 2nd-half total vs 1st-half total." },
  prodRevenue: { title: "Top Revenue Products", what: "Products bringing the most revenue.", calc: "Σ SaleLine.value grouped by product; top 8." },
  prodQty: { title: "Top Quantity Sold", what: "Products with the highest units sold.", calc: "Σ SaleLine.qty grouped by product; top 8." },
  prodProfit: { title: "Top Profit Products", what: "Products contributing the most gross profit.", calc: "Σ (SaleLine.value − SaleLine.cost) grouped by product; top 8." },
  prodSlow: { title: "Slow Moving Products", what: "Products with the lowest (but non-zero) units sold.", calc: "Σ SaleLine.qty grouped by product, ascending; lowest 8. Non-moving = active SKUs with zero sales this period." },
  mixCategory: { title: "Category-wise Sales", what: "Revenue split across product categories.", calc: "Σ SaleLine.value grouped by Product.category." },
  mixBrand: { title: "Brand-wise Sales", what: "Revenue split across brands.", calc: "Σ SaleLine.value grouped by Product.brand." },
  returnTrend: { title: "Return Trend (6m)", what: "Sales returns over the last 6 months.", calc: "Σ SalesReturn.refundAmount grouped by month." },
  returnTop: { title: "Top Returned Products", what: "Products returned the most (by value).", calc: "Σ SalesReturnLine.returnValue grouped by product; top 8." },

  // ---- Customer ----
  custOverview: { title: "Customer Overview", what: "Base counts for the period.", calc: "Total/Active/Inactive from Customer.status; New = customers created this month; Repeat = customers with >1 completed invoice; Repeat rate = repeat ÷ buyers × 100." },
  custType: { title: "Sales by Customer Type", what: "Revenue split by customer type (Retail/Wholesale/…).", calc: "Σ Sale.total grouped by the invoice customer's type." },
  custCategory: { title: "Sales by Customer Category", what: "Revenue split by customer category (Regular/VIP/…).", calc: "Σ Sale.total grouped by the invoice customer's category." },
  custTop: { title: "Top Customers", what: "Highest-spending customers this month.", calc: "Σ Sale.total grouped by customer; top 10." },
  custAcq: { title: "Customer Acquisition (6m)", what: "New customers added each month.", calc: "count(Customer) grouped by createdAt month." },
  custCity: { title: "Sales by City", what: "Revenue by customer city.", calc: "Σ Sale.total grouped by the invoice customer's city." },
  custState: { title: "Sales by State", what: "Revenue by customer state.", calc: "Σ Sale.total grouped by the invoice customer's state." },

  // ---- Analytics ----
  anBranch: { title: "Branch-wise Sales", what: "Revenue by branch.", calc: "Σ Sale.total grouped by branchId." },
  anChannel: { title: "Channel-wise Sales", what: "Revenue by sales channel (POS vs B2B).", calc: "Σ Sale.total grouped by Sale.channel." },
  anCategory: { title: "Category Analysis", what: "Revenue by product category.", calc: "Σ SaleLine.value grouped by Product.category." },
  anBrand: { title: "Brand Analysis", what: "Revenue by brand.", calc: "Σ SaleLine.value grouped by Product.brand." },
  anState: { title: "State-wise Sales", what: "Revenue by branch state.", calc: "Σ Sale.total grouped by the branch's state." },
  anCity: { title: "City-wise Sales", what: "Revenue by branch city.", calc: "Σ Sale.total grouped by the branch's city." },
  anCustCat: { title: "By Customer Category", what: "Revenue by customer category.", calc: "Σ Sale.total grouped by customer category." },
  anCustType: { title: "By Customer Type", what: "Revenue by customer type.", calc: "Σ Sale.total grouped by customer type." },
  cmpMoM: { title: "This Month vs Last", what: "Month-on-month sales comparison.", calc: "Σ Sale.total this month vs previous month; growth % between them." },
  cmpYoY: { title: "This Year vs Last", what: "Year-on-year sales comparison.", calc: "Σ Sale.total this calendar year vs last year; growth % between them." },
  anDiscount: { title: "Discount Given", what: "Total discount and its share of gross.", calc: "Σ (item + bill discount); % = discount ÷ Σ subtotal × 100." },
  anCancel: { title: "Cancellations", what: "Value and count of cancelled invoices.", calc: "Σ Sale.total and count where status = Cancelled." },
  rankTopBranch: { title: "Top Branch", what: "Highest-revenue branch this month.", calc: "max of Σ Sale.total by branch." },
  rankLowBranch: { title: "Lowest Branch", what: "Lowest-revenue branch this month.", calc: "min of Σ Sale.total by branch (with sales)." },
  rankTopExec: { title: "Top Executive", what: "Highest-revenue executive (cashier proxy).", calc: "max of Σ Sale.total by cashier." },
  rankLowExec: { title: "Lowest Executive", what: "Lowest-revenue executive (cashier proxy).", calc: "min of Σ Sale.total by cashier (with sales)." },
  aiForecast: { title: "Sales Forecast", what: "Projected month-end sales with a confidence band.", calc: "Linear/seasonal projection over the last 12 months of Σ Sale.total; shaded band = confidence interval." },
  aiRisk: { title: "Risk Radar", what: "Deterministic risks that need attention.", calc: "Rules on decline %, return %, margin, low branch, cancellations and retention — each rated Critical→Low." },
  aiRec: { title: "Recommendations", what: "Suggested actions to improve sales/profit.", calc: "Derived from product profit, non/slow movers, margin, repeat rate and top category." },
};

/** Build the methodology description shown in the drill popup. */
export function infoText(id: string): string | undefined {
  const info = WIDGET_INFO[id];
  if (!info) return undefined;
  return [info.what, info.calc ? `How it's calculated: ${info.calc}` : "", info.note ? `Note: ${info.note}` : "", SALE].filter(Boolean).join("\n\n");
}

/** Hover-revealed "View details →" trigger (placed in a widget whose container has `group`). */
export function InfoButton({ id, light }: { id: string; className?: string; light?: boolean }) {
  const info = WIDGET_INFO[id];
  return <DrillDot id={id} title={info?.title ?? id} description={infoText(id)} light={light} />;
}

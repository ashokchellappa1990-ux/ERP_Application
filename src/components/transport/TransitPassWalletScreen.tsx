"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Wallet, ArrowDownCircle, ArrowUpCircle, ShoppingCart, Truck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { Pagination } from "@/components/ui/Pagination";

interface WalletRow {
  date: string;
  type: "Purchase" | "Sales";
  refId: number;
  refNo: string;
  transitPassNo: string | null;
  party: string | null;
  qty: number;
  rate: number;
  spent: number;
  received: number;
  qtyBalance: number;
  amountBalance: number;
  dayOpeningQty: number;
  dayOpeningAmount: number;
}
interface WalletData {
  enabled: boolean;
  from: string;
  to: string;
  openingQty: number;
  openingAmount: number;
  rows: WalletRow[];
  totals: { spent: number; received: number; closingQty: number; closingAmount: number };
}

const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Unit ("Ton") lives in the column header, not repeated in every cell.
const moneyQty = (amount: number, qty: number) => `${money(amount)} / ${qty.toFixed(3)}`;
const th = "px-4 py-3 text-center align-middle";
const td = "px-4 py-2.5 text-right align-middle whitespace-nowrap tabular-nums";

/** Two-line header — label on top, unit centered underneath (wraps if needed). */
function Th({ label, unit }: { label: string; unit: string }) {
  return (
    <span className="flex flex-col items-center justify-center gap-0.5">
      <span>{label}</span>
      <span className="text-xs font-normal normal-case tracking-normal text-subtle">{unit}</span>
    </span>
  );
}
const fInp = "h-9 rounded-lg border border-border-strong bg-surface px-2.5 text-sm focus:border-primary focus:outline-none";

/** Default filter window — current month to date; the cards/table always
 * reflect whatever [from, to] is active, so changing these updates both. */
function firstOfThisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${highlight ? "border-warning/40 bg-warning-subtle" : "border-border bg-card"}`}>
      <p className={`text-2xs font-semibold uppercase tracking-wide ${highlight ? "text-warning" : "text-muted"}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${highlight ? "text-warning" : "text-foreground"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-2xs text-subtle">{sub}</p>}
    </div>
  );
}

export function TransitPassWalletScreen() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ from: firstOfThisMonth(), to: todayStr() }); // applied — drives the fetch
  const [draft, setDraft] = useState({ from: firstOfThisMonth(), to: todayStr() }); // date inputs, applied on Search
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    return p.toString();
  }, [f]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const j = await fetch(`/api/transport/transit-pass-wallet?${qs}`, { cache: "no-store" }).then((r) => r.json());
        if (j.ok) setData(j.data);
      } catch { /* */ } finally { setLoading(false); }
    })();
  }, [qs]);

  useEffect(() => { setPage(1); }, [qs]);

  const setDraftField = (patch: Partial<typeof draft>) => setDraft((p) => ({ ...p, ...patch }));
  const search = () => setF(draft);
  const clear = () => { const def = { from: firstOfThisMonth(), to: todayStr() }; setDraft(def); setF(def); };
  const total = data?.rows.length ?? 0;
  const paged = (data?.rows ?? []).slice((page - 1) * pageSize, page * pageSize);
  // Rows arrive newest-first; insert a per-date "Opening Balance" marker
  // right after each date's last (oldest) transaction, before the next
  // (older) date's block begins — like a statement's carry-forward line.
  const renderItems = useMemo(() => {
    const items: ({ kind: "opening"; date: string; amount: number; qty: number } | { kind: "row"; row: WalletRow })[] = [];
    let prevDate: string | null = null;
    let prevOpening: { amount: number; qty: number } | null = null;
    for (const r of paged) {
      if (prevDate !== null && r.date !== prevDate) items.push({ kind: "opening", date: prevDate, amount: prevOpening!.amount, qty: prevOpening!.qty });
      items.push({ kind: "row", row: r });
      prevDate = r.date;
      prevOpening = { amount: r.dayOpeningAmount, qty: r.dayOpeningQty };
    }
    if (prevDate !== null) items.push({ kind: "opening", date: prevDate, amount: prevOpening!.amount, qty: prevOpening!.qty });
    return items;
  }, [paged]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white"><Wallet className="h-6 w-6" /></span>
        <div>
          <h1 className="text-lg font-bold text-foreground">Transit Pass Reconciliation</h1>
          <p className="mt-0.5 text-xs text-muted">Amount paid to suppliers on purchase (GRN) vs. amount recovered from customers on sale (Load &amp; Dispatch) — a running statement, read-only.</p>
        </div>
      </div>

      {loading && <div className="rounded-2xl border border-border bg-card p-10 shadow-sm"><AppLoader label="Loading wallet…" size="sm" /></div>}

      {!loading && data && !data.enabled && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">Transit Pass is not enabled.</p>
          <p className="mt-1 text-xs text-muted">Turn on Transit Pass under Purchase Configuration to start tracking this wallet.</p>
        </div>
      )}

      {!loading && data && data.enabled && (
        <>
          <p className="text-2xs text-muted">Showing {data.from} to {data.to} — change the dates below to update these figures.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Opening Balance" value={money(data.openingAmount)} sub={`${data.openingQty.toFixed(3)} Ton`} />
            <StatCard label="Total Spent (Purchase)" value={money(data.totals.spent)} sub="Paid to suppliers" />
            <StatCard label="Total Received (Sales)" value={money(data.totals.received)} sub="Recovered from customers" />
            <StatCard label="Closing Balance" value={money(data.totals.closingAmount)} sub={`${data.totals.closingQty.toFixed(3)} Ton outstanding`} highlight />
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <label className="flex flex-col gap-1"><span className="text-2xs font-semibold text-muted">From</span>
              <input type="date" value={draft.from} onChange={(e) => setDraftField({ from: e.target.value })} className={fInp} />
            </label>
            <label className="flex flex-col gap-1"><span className="text-2xs font-semibold text-muted">To</span>
              <input type="date" value={draft.to} onChange={(e) => setDraftField({ to: e.target.value })} className={fInp} />
            </label>
            <button onClick={search} className="h-9 rounded-lg bg-primary px-4 text-2xs font-semibold text-white hover:bg-primary/90">Search</button>
            <button onClick={clear} className="h-9 rounded-lg border border-border-strong bg-surface px-4 text-2xs font-semibold text-muted hover:bg-surface-2">Clear</button>
          </div>

          <p className="text-2xs font-medium text-subtle">Note: Qty values in the table below are in Ton.</p>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                    <th className="px-4 py-3 align-middle whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 align-middle whitespace-nowrap">Type</th>
                    <th className="px-4 py-3 align-middle whitespace-nowrap">Ref No</th>
                    <th className="px-4 py-3 align-middle whitespace-nowrap">Transit Pass No</th>
                    <th className="px-4 py-3 align-middle whitespace-nowrap">Party</th>
                    <th className={th}><Th label="Rate" unit="(₹/Qty)" /></th>
                    <th className={th}><Th label="Amount Spent" unit="(₹/Qty)" /></th>
                    <th className={th}><Th label="Amount Received" unit="(₹/Qty)" /></th>
                    <th className={th}><Th label="OB" unit="(₹/Qty)" /></th>
                    <th className={th}><Th label="CB" unit="(₹/Qty)" /></th>
                  </tr>
                </thead>
                <tbody>
                  {renderItems.map((item) => item.kind === "opening" ? (
                    <tr key={`opening-${item.date}`} className="border-b border-border bg-warning-subtle/60">
                      <td colSpan={5} className="px-4 py-2.5 align-middle text-xs font-semibold text-warning">Opening Balance — {item.date}</td>
                      <td colSpan={3} />
                      <td className={`${td} text-xs font-semibold text-warning`}>{moneyQty(item.amount, item.qty)}</td>
                      <td className={`${td} text-xs italic text-subtle`}>—</td>
                    </tr>
                  ) : (() => { const r = item.row; return (
                    <tr key={`${r.type}-${r.refId}`} className="border-b border-border last:border-0 hover:bg-surface-2/40">
                      <td className="px-4 py-2.5 align-middle whitespace-nowrap text-foreground">{r.date}</td>
                      <td className="px-4 py-2.5 align-middle whitespace-nowrap">
                        <Badge tone={r.type === "Purchase" ? "warning" : "success"}>
                          <span className="inline-flex items-center gap-1">
                            {r.type === "Purchase" ? <ArrowUpCircle className="h-3 w-3" /> : <ArrowDownCircle className="h-3 w-3" />}
                            {r.type}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 align-middle whitespace-nowrap font-mono text-xs text-muted">
                        {r.type === "Purchase" ? (
                          <Link href={`/purchase/grn/${r.refId}`} className="inline-flex items-center gap-1 text-primary hover:underline"><ShoppingCart className="h-3 w-3" />{r.refNo}</Link>
                        ) : (
                          <Link href={`/warehouse/transfer/load-dispatch/${r.refId}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Truck className="h-3 w-3" />{r.refNo}</Link>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-middle whitespace-nowrap text-muted">{r.transitPassNo || "—"}</td>
                      <td className="px-4 py-2.5 align-middle whitespace-nowrap text-muted">{r.party || "—"}</td>
                      <td className={`${td} text-muted`}>{r.rate > 0 ? money(r.rate) : "—"}</td>
                      <td className={`${td} font-medium ${r.type === "Purchase" ? "text-warning" : "text-foreground"}`}>
                        {r.type === "Purchase" ? moneyQty(r.spent, r.qty) : "—"}
                      </td>
                      <td className={`${td} font-medium ${r.type === "Sales" ? "text-success" : "text-foreground"}`}>
                        {r.type === "Sales" ? moneyQty(r.received, r.qty) : "—"}
                      </td>
                      <td className={`${td} text-subtle`}>—</td>
                      <td className={`${td} font-bold italic text-primary`}>{moneyQty(r.amountBalance, r.qtyBalance)}</td>
                    </tr>
                  ); })())}
                  {data.rows.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">No Transit Pass transactions found for the selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="transactions" />
          </div>
        </>
      )}
    </div>
  );
}

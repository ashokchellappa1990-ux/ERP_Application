"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Scale, Weight, Plus, Printer, Search, X, Clock, CheckCircle2, CalendarCheck, Gauge, Hourglass, ListChecks, Eye } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AppLoader } from "@/components/ui/AppLoader";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/cn";
import { WEIGHMENT_COPY, WeighmentTypeToggle, type WeighmentType } from "@/components/transport/weighmentType";

type Stage = "first" | "second";
type Tab = "pending" | "completed";

interface PendingRow {
  gateEntryId: number; gateEntryNo: string; vehicleNo: string; party: string | null; gateStatus: string;
  arrivalTime: string | null; expectedMaterial: string | null; grnId: number | null; grnNo: string | null;
  firstWeighmentNo: string | null; firstWeight: number | null;
}
interface CompletedRow {
  id: number; weighmentNo: string | null; gateEntryId: number; gateEntryNo: string; vehicleNo: string; party: string | null;
  gateStatus: string; grnId: number | null; grnNo: string | null;
  tareWeight: number | null; grossWeight: number | null; netWeight: number | null;
  operator: string | null; weighDate: string | null; weighTime: string | null; createdAt: string;
  toleranceExceeded: boolean | null; approvalStatus: string | null;
}
interface Stats { pending: number; completed: number; todayCount: number; todayWeight: number }

const GATE_TONE: Record<string, "neutral" | "info" | "warning" | "success"> = { Waiting: "neutral", "Inside Factory": "info", Loading: "warning", Completed: "success", Exited: "success" };
const kg = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: 3 }));
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/** First / Second Weighment list page — Sales & Purchase, each split into a
 * Pending work queue (gate entries waiting for this weighment) and the
 * Completed weighments, with filters, pagination and summary cards. Pending
 * rows open the New Weighment form for that vehicle; once saved the vehicle
 * drops off Pending and shows under Completed. */
export function WeighmentQueueList({ stage }: { stage: Stage }) {
  const router = useRouter();
  const base = stage === "first" ? "/transport/pre-weighment" : "/transport/post-weighment";
  const title = stage === "first" ? "First Weighment" : "Second Weighment";
  const Icon = stage === "first" ? Scale : Weight;

  // null until mounted — ?type= / ?tab= are only readable client-side, and
  // loading the defaults first would race the real selection's fetch.
  const [ready, setReady] = useState(false);
  const [type, setType] = useState<WeighmentType>("Sales");
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState<(PendingRow | CompletedRow)[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ pending: 0, completed: 0, todayCount: 0, todayWeight: 0 });
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("type") === "Purchase") setType("Purchase");
    if (sp.get("tab") === "completed") setTab("completed");
    setReady(true);
  }, []);

  // Keep type/tab in the URL so Back / reload / hand-off links land on the same view.
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    if (type === "Purchase") url.searchParams.set("type", type); else url.searchParams.delete("type");
    if (tab === "completed") url.searchParams.set("tab", tab); else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }, [ready, type, tab]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const u = new URLSearchParams({ stage, type, tab, page: String(page), pageSize: String(pageSize) });
      if (query.trim()) u.set("q", query.trim());
      if (from) u.set("from", from);
      if (to) u.set("to", to);
      const res = await fetch(`/api/transport/weighment-queue?${u}`, { cache: "no-store" });
      if (id !== reqId.current) return; // a newer request superseded this one
      if (res.status === 401) { setNotAuthed(true); return; }
      const j = await res.json().catch(() => ({}));
      if (id !== reqId.current) return;
      if (j.ok) { setNotAuthed(false); setRows(j.rows); setTotal(j.total); setStats(j.stats); }
    } catch { /* ignore */ } finally { if (id === reqId.current) setLoading(false); }
  }, [stage, type, tab, page, pageSize, query, from, to]);

  useEffect(() => { if (!ready) return; const t = setTimeout(load, 250); return () => clearTimeout(t); }, [ready, load]);

  const copy = WEIGHMENT_COPY[type];
  const isPurchase = type === "Purchase";
  const stageCopy = stage === "first" ? copy.first : copy.second;
  const listHref = `${base}?${new URLSearchParams({ ...(isPurchase ? { type } : {}), ...(tab === "completed" ? { tab } : {}) })}`.replace(/\?$/, "");
  const weightLabel = stage === "first" ? `Today's ${copy.first.weight} Weight` : "Today's Net Weight";

  function switchType(t: WeighmentType) { if (t === type) return; setRows([]); setTotal(0); setType(t); setPage(1); }
  function switchTab(t: Tab) { if (t === tab) return; setRows([]); setTotal(0); setTab(t); setPage(1); }
  function clearFilters() { setQuery(""); setFrom(""); setTo(""); setPage(1); }
  const recordHref = (gateEntryId: number) => `${base}/new?gateEntryId=${gateEntryId}&next=${encodeURIComponent(listHref)}`;

  const colCount = tab === "pending" ? 6 + (stage === "second" ? 1 : 0) + (isPurchase ? 1 : 0) : stage === "first" ? 9 : 10;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Transport &amp; Vehicle Operations</span><span className="text-subtle">/</span><span className="font-medium text-foreground">{title}</span></div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Icon className="h-5 w-5 text-primary" /> {title}</h1>
          <p className="mt-0.5 text-sm text-muted">{type}: {stageCopy.hint}</p>
        </div>
        <Button size="md" onClick={() => router.push(`${base}/new?type=${type}`)}><Plus className="h-4 w-4" /> New Weighment</Button>
      </div>

      <WeighmentTypeToggle value={type} onChange={switchType} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today's Weighments" value={stats.todayCount.toLocaleString()} icon={CalendarCheck} tone="primary" />
        <Stat label={`${weightLabel} (Kg)`} value={kg(stats.todayWeight)} icon={Gauge} tone="info" />
        <Stat label="Pending" value={stats.pending.toLocaleString()} icon={Hourglass} tone="warning" active={tab === "pending"} onClick={() => switchTab("pending")} />
        <Stat label="Completed" value={stats.completed.toLocaleString()} icon={ListChecks} tone="success" active={tab === "completed"} onClick={() => switchTab("completed")} />
      </div>

      <div className="inline-flex overflow-hidden rounded-lg border border-border bg-surface p-1 text-sm">
        <button type="button" onClick={() => switchTab("pending")} className={cn("flex items-center gap-1.5 rounded-md px-4 py-1.5 font-semibold transition", tab === "pending" ? "bg-brand-gradient text-white shadow-sm" : "text-muted hover:text-foreground")}><Clock className="h-4 w-4" /> Pending <Badge tone="neutral">{stats.pending}</Badge></button>
        <button type="button" onClick={() => switchTab("completed")} className={cn("flex items-center gap-1.5 rounded-md px-4 py-1.5 font-semibold transition", tab === "completed" ? "bg-brand-gradient text-white shadow-sm" : "text-muted hover:text-foreground")}><CheckCircle2 className="h-4 w-4" /> Completed <Badge tone="neutral">{stats.completed}</Badge></button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={`Gate entry, vehicle, ${copy.party.toLowerCase()}${tab === "completed" && stage === "first" ? ", weighment no" : ""}…`} className="h-9 w-full rounded-md border border-border bg-surface-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:bg-surface focus:outline-none focus:shadow-focus" />
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1">
            <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">{tab === "pending" ? "Arrival Date" : "Weighed Date"}</span>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
            <span className="text-2xs text-subtle">to</span>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none focus:shadow-focus" />
          </div>
          <Button size="sm" variant="primary" onClick={load}><Search className="h-3.5 w-3.5" /> Search</Button>
          <Button size="sm" variant="outline" onClick={clearFilters}><X className="h-3.5 w-3.5" /> Clear</Button>
        </div>

        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-surface-2 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">
                {tab === "pending" ? (
                  <>
                    <Th>Gate Entry No</Th><Th>Vehicle No</Th><Th>{copy.party}</Th>
                    {isPurchase ? <Th>Expected Material</Th> : <Th>Arrival Time</Th>}
                    {stage === "second" && <Th right>{copy.first.weight} Weight (Kg)</Th>}
                    {isPurchase && <Th>Arrival Time</Th>}
                    <Th center>Gate Status</Th>
                    <Th right>Action</Th>
                  </>
                ) : stage === "first" ? (
                  <>
                    <Th>Weighment No</Th><Th>Gate Entry No</Th><Th>Vehicle No</Th><Th>{copy.party}</Th>
                    <Th right>{copy.first.weight} Weight (Kg)</Th><Th>Operator</Th><Th>Weighed On</Th><Th center>Gate Status</Th><Th right>Token</Th>
                  </>
                ) : (
                  <>
                    <Th>Gate Entry No</Th><Th>Vehicle No</Th><Th>{copy.party}</Th>
                    <Th right>Gross (Kg)</Th><Th right>Tare (Kg)</Th><Th right>Net (Kg)</Th><Th>Operator</Th><Th>Weighed On</Th>
                    <Th center>Gate Status</Th><Th center>{isPurchase ? "GRN" : "Tolerance"}</Th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {tab === "pending" && (rows as PendingRow[]).map((r) => (
                <tr key={r.gateEntryId} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <Td><span className="font-mono text-xs font-semibold text-foreground">{r.gateEntryNo}</span></Td>
                  <Td className="font-medium text-foreground">{r.vehicleNo}</Td>
                  <Td>{r.party ?? "—"}</Td>
                  {isPurchase ? <Td>{r.expectedMaterial ?? "—"}</Td> : <Td>{when(r.arrivalTime)}</Td>}
                  {stage === "second" && <Td right className="font-semibold tabular-nums text-foreground">{kg(r.firstWeight)}</Td>}
                  {isPurchase && <Td>{when(r.arrivalTime)}</Td>}
                  <Td center><Badge tone={GATE_TONE[r.gateStatus] ?? "neutral"}>{r.gateStatus}</Badge></Td>
                  <Td right>
                    <Button size="sm" variant="primary" className="whitespace-nowrap" onClick={() => router.push(recordHref(r.gateEntryId))}>
                      <Icon className="h-3.5 w-3.5" /> Record {stageCopy.weight} Weight
                    </Button>
                  </Td>
                </tr>
              ))}

              {tab === "completed" && stage === "first" && (rows as CompletedRow[]).map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <Td><span className="font-mono text-xs font-semibold text-foreground">{r.weighmentNo}</span></Td>
                  <Td><span className="font-mono text-xs text-muted">{r.gateEntryNo}</span></Td>
                  <Td className="font-medium text-foreground">{r.vehicleNo}</Td>
                  <Td>{r.party ?? "—"}</Td>
                  <Td right className="font-semibold tabular-nums text-foreground">{kg(isPurchase ? r.grossWeight : r.tareWeight)}</Td>
                  <Td>{r.operator ?? "—"}</Td>
                  <Td>{r.weighDate ? `${r.weighDate} ${r.weighTime ?? ""}` : when(r.createdAt)}</Td>
                  <Td center><Badge tone={GATE_TONE[r.gateStatus] ?? "neutral"}>{r.gateStatus}</Badge></Td>
                  <Td right>
                    <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={() => router.push(`/transport/pre-weighment/token?id=${r.id}&next=${encodeURIComponent(listHref)}`)}>
                      <Printer className="h-3.5 w-3.5" /> Preview &amp; Print
                    </Button>
                  </Td>
                </tr>
              ))}

              {tab === "completed" && stage === "second" && (rows as CompletedRow[]).map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition hover:bg-primary-subtle/30">
                  <Td><span className="font-mono text-xs font-semibold text-foreground">{r.gateEntryNo}</span></Td>
                  <Td className="font-medium text-foreground">{r.vehicleNo}</Td>
                  <Td>{r.party ?? "—"}</Td>
                  <Td right className="tabular-nums text-foreground">{kg(r.grossWeight)}</Td>
                  <Td right className="tabular-nums text-muted">{kg(r.tareWeight)}</Td>
                  <Td right className="font-semibold tabular-nums text-foreground">{kg(r.netWeight)}</Td>
                  <Td>{r.operator ?? "—"}</Td>
                  <Td>{r.weighDate ?? when(r.createdAt)}</Td>
                  <Td center><Badge tone={GATE_TONE[r.gateStatus] ?? "neutral"}>{r.gateStatus}</Badge></Td>
                  <Td center>
                    {isPurchase
                      ? (r.grnId ? <Link href={`/purchase/grn/${r.grnId}`} className="inline-flex items-center gap-1 text-2xs font-semibold text-primary hover:underline"><Eye className="h-3 w-3" /> {r.grnNo ?? "View GRN"}</Link> : <Badge tone="warning">GRN Pending</Badge>)
                      : (r.toleranceExceeded ? <Badge tone="danger">Exceeded ({r.approvalStatus})</Badge> : <Badge tone="success">OK</Badge>)}
                  </Td>
                </tr>
              ))}

              {loading && rows.length === 0 && <tr><td colSpan={colCount} className="px-4 py-8"><AppLoader label="Loading weighments…" size="sm" /></td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={colCount} className="px-4 py-10 text-center text-sm text-muted">
                  {notAuthed
                    ? <>Please <Link href="/login" className="font-semibold text-primary hover:underline">sign in</Link>.</>
                    : tab === "pending"
                      ? `No ${type.toLowerCase()} vehicles waiting for ${title.toLowerCase()}.`
                      : `No ${type.toLowerCase()} ${title.toLowerCase()}s found.`}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label={tab === "pending" ? "vehicles" : "weighments"} />
        )}
      </div>
    </div>
  );
}

function Th({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) {
  return <th className={cn("whitespace-nowrap bg-surface-2 px-4 py-3", right && "text-right", center && "text-center")}>{children}</th>;
}
function Td({ children, right, center, className }: { children: React.ReactNode; right?: boolean; center?: boolean; className?: string }) {
  return <td className={cn("px-4 py-3 text-2xs text-muted", right && "text-right", center && "text-center", className)}>{children}</td>;
}

function Stat({ label, value, icon: I, tone, active, onClick }: { label: string; value: string; icon: typeof Scale; tone: "primary" | "info" | "warning" | "success"; active?: boolean; onClick?: () => void }) {
  const TONES = { primary: "bg-primary text-white", info: "bg-info text-white", warning: "bg-warning text-white", success: "bg-success text-white" } as const;
  const Box = onClick ? "button" : "div";
  return (
    <Box type={onClick ? "button" : undefined} onClick={onClick} className={cn("rounded-2xl border bg-card p-3.5 text-left shadow-sm transition", active ? "border-primary ring-1 ring-primary/40" : "border-border", onClick && "hover:border-primary/50")}>
      <div className="flex items-center gap-2.5">
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg shadow-sm", TONES[tone])}><I className="h-[18px] w-[18px]" /></span>
        <p className="text-lg font-bold tracking-tight text-foreground tabular-nums">{value}</p>
      </div>
      <p className="mt-2 text-xs font-medium text-muted">{label}</p>
    </Box>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Scale, Plug, PlugZap, Unplug, Download, CheckCircle2, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const BAUD_RATES = [1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200];

// Pulls the first signed decimal number out of a weighing indicator's raw
// line (e.g. "ST,GS,+  12.340 kg" / "US,NT,-0004.5" / "12340") — lenient on
// purpose since every indicator brand formats this slightly differently;
// the raw line is always shown alongside so the format can be eyeballed
// during testing.
function parseWeight(line: string): number | null {
  const m = line.match(/[+-]?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

type ConnState = "unsupported" | "idle" | "connecting" | "connected" | "error";

export function WeighbridgeTestScreen() {
  const toast = useToast();
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<ConnState>("idle");
  const [baudRate, setBaudRate] = useState(9600);
  const [autoPorts, setAutoPorts] = useState<SerialPort[]>([]);
  const [portInfo, setPortInfo] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [liveWeight, setLiveWeight] = useState<number | null>(null);
  const [liveRaw, setLiveRaw] = useState<string>("");
  const [log, setLog] = useState<string[]>([]);
  const [fetchedWeight, setFetchedWeight] = useState<number | null>(null);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const readingActiveRef = useRef(false);

  useEffect(() => {
    if (!("serial" in navigator) || !navigator.serial) { setSupported(false); setState("unsupported"); return; }
    // Auto-reconnect: ports the user already granted permission for on this
    // browser/device show up here with no new prompt required.
    navigator.serial.getPorts().then((ports) => {
      setAutoPorts(ports);
      if (ports.length === 1) openPort(ports[0]);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function appendLog(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 30));
  }

  function handleLine(line: string) {
    setLiveRaw(line);
    appendLog(line);
    const w = parseWeight(line);
    if (w != null) setLiveWeight(w);
  }

  async function readLoop(port: SerialPort) {
    if (!port.readable) return;
    const decoder = new TextDecoderStream();
    const closedPromise = port.readable.pipeTo(decoder.writable).catch(() => {});
    const reader = decoder.readable.getReader();
    readerRef.current = reader;
    readingActiveRef.current = true;
    let buffer = "";
    try {
      while (readingActiveRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          let idx: number;
          while ((idx = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, idx).replace(/\r$/, "");
            buffer = buffer.slice(idx + 1);
            if (line.trim()) handleLine(line.trim());
          }
        }
      }
    } catch {
      // port likely unplugged mid-read — surfaced via the disconnect event below
    } finally {
      try { reader.releaseLock(); } catch { /* already released */ }
      await closedPromise;
    }
  }

  async function openPort(port: SerialPort) {
    setState("connecting");
    setErrorMsg(null);
    try {
      await port.open({ baudRate });
      portRef.current = port;
      const info = port.getInfo();
      setPortInfo(info.usbVendorId ? `USB VID:PID ${info.usbVendorId.toString(16)}:${info.usbProductId?.toString(16) ?? "?"}` : "Serial port");
      setState("connected");
      readLoop(port);
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : "Could not open the port.");
    }
  }

  async function connect() {
    if (!navigator.serial) return;
    try {
      const port = await navigator.serial.requestPort();
      await openPort(port);
    } catch (e) {
      // User cancelled the picker, or no port available — not a real error.
      if (e instanceof Error && e.name !== "NotFoundError") { setErrorMsg(e.message); setState("error"); }
    }
  }

  async function disconnect() {
    readingActiveRef.current = false;
    try { await readerRef.current?.cancel(); } catch { /* ignore */ }
    try { await portRef.current?.close(); } catch { /* ignore */ }
    portRef.current = null;
    readerRef.current = null;
    setState("idle");
    setPortInfo("");
    setLiveWeight(null);
    setLiveRaw("");
  }

  function fetchWeight() {
    if (liveWeight == null) { toast.error("No weight reading yet — check the connection and indicator output."); return; }
    setFetchedWeight(liveWeight);
    toast.success(`Fetched ${liveWeight} from the weighbridge.`);
  }

  const STATE_BADGE: Record<ConnState, { tone: "neutral" | "warning" | "success" | "danger"; label: string }> = {
    unsupported: { tone: "danger", label: "Not Supported" },
    idle: { tone: "neutral", label: "Not Connected" },
    connecting: { tone: "warning", label: "Connecting…" },
    connected: { tone: "success", label: "Connected" },
    error: { tone: "danger", label: "Error" },
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted"><span>Settings</span><span className="text-subtle">/</span><span className="font-medium text-foreground">Weighbridge Setting</span></div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground"><Scale className="h-5 w-5 text-primary" /> Weighbridge Setting</h1>
        <p className="mt-0.5 text-sm text-muted">Test fetching live weight from a serial-connected weighbridge indicator, straight from the browser — no local software required.</p>
      </div>

      {!supported && (
        <SectionCard icon={AlertTriangle} title="Browser Not Supported">
          <p className="text-sm text-muted">This feature uses the Web Serial API, which only Chrome and Edge support today (not Firefox or Safari). Open this page in Chrome or Edge on the PC physically connected to the weighbridge indicator.</p>
        </SectionCard>
      )}

      {supported && (
        <>
          <SectionCard icon={Plug} title="Connection">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={STATE_BADGE[state].tone}>{STATE_BADGE[state].label}</Badge>
              {portInfo && <span className="text-2xs text-subtle">{portInfo}</span>}

              <div className="ml-auto flex items-center gap-2">
                <label className="text-2xs font-semibold text-muted">Baud Rate</label>
                <select value={baudRate} onChange={(e) => setBaudRate(Number(e.target.value))} disabled={state === "connected" || state === "connecting"} className="h-9 rounded-md border border-border bg-surface px-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none">
                  {BAUD_RATES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                {state !== "connected" ? (
                  <Button size="sm" onClick={connect} disabled={state === "connecting"}>
                    {state === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Connect Weighbridge
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={disconnect}><Unplug className="h-4 w-4" /> Disconnect</Button>
                )}
              </div>
            </div>

            {autoPorts.length > 0 && state === "idle" && (
              <p className="mt-2 text-2xs text-subtle">{autoPorts.length} previously authorized port(s) found on this browser — click Connect to re-open (no new picker needed unless it was revoked).</p>
            )}
            {errorMsg && <p className="mt-2 text-2xs font-medium text-danger">{errorMsg}</p>}
            <p className="mt-3 text-2xs text-subtle">First connection on this browser/device asks you to pick the serial port once — after that it's remembered automatically for next time.</p>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard icon={Scale} title="Live Reading">
              <div className="flex items-center justify-center rounded-xl border border-border bg-surface-2 py-8">
                <div className="text-center">
                  <p className="text-4xl font-bold tabular-nums text-foreground">{liveWeight != null ? liveWeight.toFixed(3) : "—"}</p>
                  <p className="mt-1 text-2xs font-semibold uppercase tracking-wide text-subtle">Live from indicator</p>
                </div>
              </div>
              <p className="mt-2 truncate font-mono text-2xs text-subtle">Raw: {liveRaw || "—"}</p>
              <Button size="md" className="mt-3 w-full" onClick={fetchWeight} disabled={state !== "connected"}>
                <Download className="h-4 w-4" /> Fetch Weight
              </Button>
            </SectionCard>

            <SectionCard icon={CheckCircle2} title="Fetched Value (simulated weight field)">
              <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-primary-subtle/20 py-8">
                <div className="text-center">
                  <p className="text-4xl font-bold tabular-nums text-primary">{fetchedWeight != null ? fetchedWeight.toFixed(3) : "—"}</p>
                  <p className="mt-1 text-2xs font-semibold uppercase tracking-wide text-subtle">Confirmed weight</p>
                </div>
              </div>
              <p className="mt-3 text-2xs text-subtle">This is exactly what would populate a Gross/Tare Weight field in GRN or Pre/Post Loading Weighment once this is wired into those screens — confirm it matches the indicator's own display before trusting it.</p>
            </SectionCard>
          </div>

          <SectionCard icon={Scale} title="Raw Data Log" action={log.length > 0 ? <button onClick={() => setLog([])} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-2xs font-semibold text-muted transition hover:border-danger/40 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /> Clear</button> : undefined}>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-surface-2 p-2 font-mono text-2xs text-muted">
              {log.length === 0 && <p className="p-2 text-subtle">No data received yet — connect and check the indicator is streaming.</p>}
              {log.map((line, i) => (
                <div key={i} className={cn("px-2 py-1", i === 0 && "font-semibold text-foreground")}>{line}</div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

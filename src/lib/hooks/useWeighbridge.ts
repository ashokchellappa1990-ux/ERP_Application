"use client";

import { useEffect, useRef, useState } from "react";

// Pulls the first signed decimal number out of a weighing indicator's raw
// line (e.g. "ST,GS,+  12.340 kg" / "US,NT,-0004.5" / "12340") — lenient on
// purpose since every indicator brand formats this slightly differently.
function parseWeight(line: string): number | null {
  const m = line.match(/[+-]?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export type WeighbridgeConnState = "unsupported" | "idle" | "connecting" | "connected" | "error";

/** Web Serial connection to a weighbridge indicator. Mounted ONCE, app-wide,
 * by WeighbridgeProvider (src/components/shared/WeighbridgeProvider.tsx) —
 * every screen reads the same live connection via useWeighbridgeContext()
 * instead of calling this hook directly, so navigating between screens never
 * drops the connection (a COM port can only be held open by one connection
 * at a time, and per-screen instances used to fight over it on mount/unmount).
 * On every fresh app load (fresh tab, browser reopened, post-login) it
 * silently reopens any already-authorized port via getPorts() — no picker,
 * no user gesture needed — so in practice it only ever needs connecting
 * once, ever, per browser/device. */
export function useWeighbridge(defaultBaudRate = 9600, enabled = true) {
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<WeighbridgeConnState>("idle");
  const [baudRate, setBaudRate] = useState(defaultBaudRate);
  const [autoPorts, setAutoPorts] = useState<SerialPort[]>([]);
  const [portInfo, setPortInfo] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [liveWeight, setLiveWeight] = useState<number | null>(null);
  const [liveRaw, setLiveRaw] = useState<string>("");
  const [log, setLog] = useState<string[]>([]);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const readingActiveRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!("serial" in navigator) || !navigator.serial) { setSupported(false); setState("unsupported"); return; }
    navigator.serial.getPorts().then((ports) => {
      setAutoPorts(ports);
      if (ports.length === 1) openPort(ports[0]);
    }).catch(() => {});
    // Deliberately no cleanup/disconnect here — this hook is meant to live
    // for the app's whole session (see WeighbridgeProvider), so unmounting
    // only really happens on a full page reload, which the OS/browser
    // already tears the port down for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // If the OS/driver drops the port (unplugged, driver reset, etc.), Web
  // Serial fires "disconnect" on navigator.serial — reflect that immediately
  // instead of silently sitting on a stale "connected" state.
  useEffect(() => {
    if (!("serial" in navigator) || !navigator.serial) return;
    const onDisconnect = (e: Event) => {
      if ((e.target as SerialPort | null) !== portRef.current) return;
      readingActiveRef.current = false;
      portRef.current = null;
      readerRef.current = null;
      setState("idle");
      setPortInfo("");
      setLiveWeight(null);
      setLiveRaw("");
    };
    navigator.serial.addEventListener("disconnect", onDisconnect);
    return () => navigator.serial?.removeEventListener("disconnect", onDisconnect);
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

  return { supported, state, baudRate, setBaudRate, autoPorts, portInfo, errorMsg, liveWeight, liveRaw, log, setLog, connect, disconnect };
}

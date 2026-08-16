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

/** Shared Web Serial connection to a weighbridge indicator — same logic the
 * Weighbridge Setting test screen validated, reused by any weight input that
 * wants a "Fetch Weight" button (Gate Entry weighment, GRN Tare Weight, …).
 * Each consumer gets its own serial connection/port picker; the browser
 * remembers granted ports per-origin so repeat connects on the same device
 * need no new picker. */
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
    // A COM port can only be held open by one connection at a time — release
    // it on unmount (navigating to another screen) so the port is free for
    // that screen's own auto-reconnect to pick straight back up, silently,
    // with no repeat picker.
    return () => {
      readingActiveRef.current = false;
      readerRef.current?.cancel().catch(() => {});
      portRef.current?.close().catch(() => {});
    };
    // Re-runs if `enabled` flips (e.g. once the page's config fetch resolves
    // and turns the feature on) — otherwise deliberately mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

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

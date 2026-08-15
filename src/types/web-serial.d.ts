// Minimal ambient types for the Web Serial API (navigator.serial) — not part
// of TypeScript's built-in DOM lib. Chromium-only browser API (Chrome/Edge);
// callers must feature-detect via `"serial" in navigator` before use.
// See src/components/settings/WeighbridgeTestScreen.tsx.

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: "none" | "even" | "odd";
  bufferSize?: number;
  flowControl?: "none" | "hardware";
}

interface SerialPort extends EventTarget {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
}

interface SerialPortRequestOptions {
  filters?: SerialPortInfo[];
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
  onconnect: ((this: Serial, ev: Event) => void) | null;
  ondisconnect: ((this: Serial, ev: Event) => void) | null;
}

interface Navigator {
  serial?: Serial;
}

/**
 * POS Terminal (Register / Till) setup. Defines each physical billing counter
 * and the global behaviour the POS billing screen obeys. Mutable in-session
 * store (no backend yet) — survives client navigation, resets on full reload.
 */
export interface PosTerminal {
  id: string;
  code: string;          // TILL-01
  name: string;          // Counter 1
  branch: string;        // Chennai Main
  status: "active" | "inactive";
  printerType: "thermal" | "a4" | "dotmatrix";
  printerName: string;   // mapped OS / network printer
  cashDrawer: boolean;   // drawer attached
  defaultPayment: string; // cash | card | upi
  ipAddress: string;
  allowOffline: boolean;
}

export interface PosTerminalGlobal {
  defaultBranch: string;
  defaultPrinterType: "thermal" | "a4";
  openingFloatRequired: boolean; // must declare opening cash before billing
  blindClose: boolean;           // count drawer without seeing the expected figure
  drawerKickOnSale: boolean;     // auto-open drawer on cash sale
  reprintAllowed: boolean;       // allow receipt re-print
  parkBills: boolean;            // hold / park multiple bills
  autoLockMinutes: string;       // lock terminal after idle minutes
}

export const POS_TERMINAL_GLOBAL: PosTerminalGlobal = {
  defaultBranch: "Chennai Main",
  defaultPrinterType: "thermal",
  openingFloatRequired: true,
  blindClose: false,
  drawerKickOnSale: true,
  reprintAllowed: true,
  parkBills: true,
  autoLockMinutes: "10",
};

let TERMINALS: PosTerminal[] = [
  { id: "t1", code: "TILL-01", name: "Counter 1", branch: "Chennai Main", status: "active", printerType: "thermal", printerName: "EPSON TM-T82", cashDrawer: true, defaultPayment: "cash", ipAddress: "192.168.1.21", allowOffline: true },
  { id: "t2", code: "TILL-02", name: "Counter 2", branch: "Chennai Main", status: "active", printerType: "thermal", printerName: "EPSON TM-T82", cashDrawer: true, defaultPayment: "upi", ipAddress: "192.168.1.22", allowOffline: false },
  { id: "t3", code: "TILL-03", name: "Express Counter", branch: "Chennai Main", status: "inactive", printerType: "thermal", printerName: "TVS RP3200", cashDrawer: false, defaultPayment: "card", ipAddress: "192.168.1.23", allowOffline: false },
];

export const PRINTER_TYPES = [
  { value: "thermal", label: "Thermal (80mm)" },
  { value: "a4", label: "A4 / Laser" },
  { value: "dotmatrix", label: "Dot Matrix" },
];
export const PAYMENT_DEFAULTS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
];
export const BRANCHES = ["Chennai Main", "Coimbatore", "Madurai", "Bengaluru"];

export const getTerminals = () => TERMINALS;
export const getTerminal = (id: string) => TERMINALS.find((t) => t.id === id);

let seq = TERMINALS.length;
export function saveTerminal(t: PosTerminal): PosTerminal {
  if (t.id && TERMINALS.some((x) => x.id === t.id)) {
    TERMINALS = TERMINALS.map((x) => (x.id === t.id ? t : x));
    return t;
  }
  const created = { ...t, id: t.id || `t${++seq}` };
  TERMINALS = [...TERMINALS, created];
  return created;
}
export function deleteTerminal(id: string) {
  TERMINALS = TERMINALS.filter((t) => t.id !== id);
}
export function setTerminalGlobal<K extends keyof PosTerminalGlobal>(k: K, v: PosTerminalGlobal[K]) {
  POS_TERMINAL_GLOBAL[k] = v;
}

export const emptyTerminal = (): PosTerminal => ({
  id: "", code: "", name: "", branch: POS_TERMINAL_GLOBAL.defaultBranch, status: "active",
  printerType: POS_TERMINAL_GLOBAL.defaultPrinterType, printerName: "", cashDrawer: true,
  defaultPayment: "cash", ipAddress: "", allowOffline: false,
});

"use client";

import { createContext, useContext } from "react";
import { useWeighbridge, type WeighbridgeConnState } from "@/lib/hooks/useWeighbridge";

interface WeighbridgeCtxValue {
  supported: boolean;
  state: WeighbridgeConnState;
  baudRate: number;
  setBaudRate: (n: number) => void;
  autoPorts: SerialPort[];
  portInfo: string;
  errorMsg: string | null;
  liveWeight: number | null;
  liveRaw: string;
  log: string[];
  setLog: React.Dispatch<React.SetStateAction<string[]>>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const WeighbridgeCtx = createContext<WeighbridgeCtxValue | null>(null);

/** Mounted once in the authenticated app layout — holds the single live
 * weighbridge connection for the whole session, so it survives navigating
 * between screens (Gate Entry, GRN, Pre/Post Loading Weighment, Direct
 * Dispatch, …). Every consumer reads the same state via
 * useWeighbridgeContext() instead of opening its own connection. */
export function WeighbridgeProvider({ children }: { children: React.ReactNode }) {
  const wb = useWeighbridge();
  return <WeighbridgeCtx.Provider value={wb}>{children}</WeighbridgeCtx.Provider>;
}

export function useWeighbridgeContext(): WeighbridgeCtxValue {
  const ctx = useContext(WeighbridgeCtx);
  if (!ctx) throw new Error("useWeighbridgeContext must be used within WeighbridgeProvider");
  return ctx;
}

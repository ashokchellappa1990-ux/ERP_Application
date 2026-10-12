"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface BizOpt { id: number; name: string; gstNumber?: string | null }
interface BranchOpt { id: number; name: string; businessId: number; code?: string; hierarchyLevel?: number; parentBranchId?: number | null }

interface ScopeCtx {
  ready: boolean;
  businesses: BizOpt[];
  branches: BranchOpt[];
  lockBusiness: boolean;
  lockBranch: boolean;
  businessId: number | null;
  branchIds: number[] | null; // null = All allowed branches
  /** Bumped after the user changes the scope (cookie persisted) so list pages
   *  re-mount and re-fetch with the new branch. */
  version: number;
  setBusiness: (id: number) => Promise<void>;
  setBranches: (ids: number[] | null) => Promise<void>;
}

const Ctx = createContext<ScopeCtx | undefined>(undefined);

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [businesses, setBusinesses] = useState<BizOpt[]>([]);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [lockBusiness, setLockBusiness] = useState(true);
  const [lockBranch, setLockBranch] = useState(true);
  const [businessId, setBusinessId] = useState<number | null>(null);
  const [branchIds, setBranchIds] = useState<number[] | null>(null);
  const [version, setVersion] = useState(0); // increments on a user scope change

  const load = useCallback(async () => {
    try {
      const j = await fetch("/api/system/scope", { cache: "no-store" }).then((r) => r.json());
      if (j.ok) {
        setBusinesses(j.businesses); setBranches(j.branches);
        setLockBusiness(j.lockBusiness); setLockBranch(j.lockBranch);
        setBusinessId(j.active.businessId ?? null); setBranchIds(j.active.branchIds ?? null);
      }
    } catch { /* keep defaults */ } finally { setReady(true); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const persist = useCallback(async (bid: number, brs: number[] | null) => {
    try {
      const j = await fetch("/api/system/scope", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: bid, branchIds: brs ?? "all" }),
      }).then((r) => r.json());
      // After the cookie is persisted, bump the version so pages re-fetch.
      if (j.ok) { setBusinessId(j.businessId); setBranchIds(j.branchIds ?? null); setVersion((v) => v + 1); }
    } catch { /* ignore */ }
  }, []);

  const setBusiness = useCallback(async (id: number) => {
    setBusinessId(id); setBranchIds(null); // switching business resets to All branches
    await persist(id, null);
  }, [persist]);

  const setBranchesSel = useCallback(async (ids: number[] | null) => {
    setBranchIds(ids);
    if (businessId) await persist(businessId, ids);
  }, [persist, businessId]);

  return (
    <Ctx.Provider value={{ ready, businesses, branches, lockBusiness, lockBranch, businessId, branchIds, version, setBusiness, setBranches: setBranchesSel }}>
      {children}
    </Ctx.Provider>
  );
}

export function useScope(): ScopeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScope must be used within <ScopeProvider>");
  return ctx;
}

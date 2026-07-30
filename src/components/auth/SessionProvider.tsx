"use client";

import {
  createContext, useContext, useEffect, useState, useCallback, type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/auth/user";
import { setCompanyProfile } from "@/lib/settings/companyProfileConfig";

// Pull company branding from the saved Business Setup into the header singleton.
async function hydrateCompanyBranding() {
  try {
    const res = await fetch("/api/company-setup", { cache: "no-store" });
    if (!res.ok) return;
    const j = await res.json();
    const c = j?.data?.company;
    if (!j?.exists || !c) return;
    setCompanyProfile({
      name: c.name ?? "",
      legalName: c.legalName ?? "",
      gstin: c.gst ?? "",
      logoDataUrl: c.logo ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      website: c.website ?? "",
      addressLine: c.address ?? "",
      city: c.city ?? "",
      state: c.state ?? "",
      pincode: c.pincode ?? "",
      stateCode: j?.data?.gst?.stateCode ?? "",
    });
  } catch {
    /* header keeps its current values */
  }
}

interface SessionCtx {
  user: PublicUser | null;
  role: string | null;
  /** RBAC permission keys granted to the user (drives feature/menu visibility). */
  permissions: Set<string>;
  /** False until the first /api/auth/me resolves — gate menu filtering on this. */
  permsReady: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [permsReady, setPermsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setUser(j.user ?? null);
        setRole(j.role ?? null);
        setPermissions(new Set<string>(Array.isArray(j.permissions) ? j.permissions : []));
        if (j.user) hydrateCompanyBranding(); // fire-and-forget header hydration
      } else {
        setUser(null); setRole(null); setPermissions(new Set());
      }
    } catch {
      setUser(null); setRole(null); setPermissions(new Set());
    } finally {
      setLoading(false);
      setPermsReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore network error on logout */
    }
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <Ctx.Provider value={{ user, role, permissions, permsReady, loading, refresh, signOut }}>{children}</Ctx.Provider>
  );
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}

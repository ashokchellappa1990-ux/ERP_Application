"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useScope } from "@/components/scope/ScopeProvider";
import {
  DEFAULT_GENERAL_CONFIG,
  applyGeneralConfig,
  subscribeGeneralConfig,
  getGeneralConfigSnapshot,
  formatMoneyWith,
  formatQtyWith,
  formatNumberWith,
  type GeneralConfigData,
} from "@/lib/settings/generalConfig";

/**
 * Loads the active business + branch general settings into the app-wide config
 * singleton and re-loads it whenever the scope (business/branch filter) changes,
 * so number / currency / quantity formatting everywhere reflects the setting that
 * applies to the signed-in user's current scope — for business AND branch users.
 *
 * Mounted once in the console layout (inside <ScopeProvider>). Renders nothing.
 */
export function GeneralConfigLoader() {
  const { version } = useScope(); // bumped on every business/branch change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await fetch("/api/settings/general", { cache: "no-store" }).then((r) => r.json());
        if (!cancelled && j?.ok) {
          applyGeneralConfig({
            fields: { ...DEFAULT_GENERAL_CONFIG.fields, ...j.config.fields },
            flags: { ...DEFAULT_GENERAL_CONFIG.flags, ...j.config.flags },
          });
        }
      } catch {
        /* keep the current config on failure */
      }
    })();
    return () => { cancelled = true; };
  }, [version]);
  return null;
}

/** Reactive access to the live, scope-aware general config. */
export function useGeneralConfig(): GeneralConfigData {
  return useSyncExternalStore(subscribeGeneralConfig, getGeneralConfigSnapshot, getGeneralConfigSnapshot);
}

/**
 * Formatters bound to the live general config — the single source of truth for
 * displaying money, quantities and plain numbers across the app. Re-renders the
 * caller when the active scope's settings change.
 *
 *   const fmt = useFmt();
 *   fmt.money(1234.5)   // "₹1,234.50"  (symbol/position/decimals/separator per settings)
 *   fmt.qty(3)          // "3"          (qty decimals per settings)
 *   fmt.num(1234.5, 2)  // "1,234.50"   (plain number, optional decimals override)
 */
export function useFmt() {
  const cfg = useGeneralConfig();
  return useMemo(
    () => ({
      cfg,
      money: (n: number) => formatMoneyWith(cfg, n),
      qty: (n: number) => formatQtyWith(cfg, n),
      num: (n: number, decimals?: number) => formatNumberWith(cfg, n, decimals),
    }),
    [cfg],
  );
}

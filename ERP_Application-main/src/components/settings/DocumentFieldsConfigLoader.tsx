"use client";

import { useEffect } from "react";
import { useScope } from "@/components/scope/ScopeProvider";
import { applyDocFieldsConfig } from "@/lib/settings/docFieldsConfig";
import { applyGrnConfig } from "@/lib/settings/grnPricingConfig";
import { applyCompanyConfig } from "@/lib/settings/companyConfig";

/** Hydrates the Document Field Settings singletons (screen fields, GRN pricing,
 * company GST flags) from the persisted `document_field_configs` row once per
 * scope, mirroring GeneralConfigLoader's pattern exactly — these settings used
 * to be in-memory-only (reset on every server restart / new session) since
 * nothing ever fetched them from the DB; the Settings screen itself now also
 * fetches on mount so it never shows stale defaults regardless of load order. */
export function DocumentFieldsConfigLoader() {
  const { version } = useScope();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await fetch("/api/settings/document-fields", { cache: "no-store" }).then((r) => r.json());
        if (!cancelled && j?.ok) {
          applyDocFieldsConfig(j.config.screens);
          applyGrnConfig(j.config.grn);
          applyCompanyConfig(j.config.company);
        }
      } catch { /* keep current defaults on failure */ }
    })();
    return () => { cancelled = true; };
  }, [version]);
  return null;
}

/**
 * Company identity entered in Business Setup — the single source of truth for
 * branding shown in the app header (logo + name + GSTIN) and on printed
 * documents. A tiny reactive store so the header updates live when the profile
 * is saved, without a page reload. In production this is the persisted
 * `company` row fetched once per session.
 */
export interface CompanyProfile {
  name: string;
  legalName: string;
  gstin: string;
  logoDataUrl: string; // empty = show initials fallback
  phone: string;
  email: string;
  website: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  stateCode: string; // GST state code, e.g. "33" for Tamil Nadu
}

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: "One ERP Retail Pvt Ltd",
  legalName: "One ERP Retail Private Limited",
  gstin: "33AABCO1234A1Z5",
  logoDataUrl: "",
  phone: "044-4000 1234",
  email: "billing@onepos.in",
  website: "www.onepos.in",
  addressLine: "12 MG Road",
  city: "Chennai",
  state: "Tamil Nadu",
  pincode: "600001",
  stateCode: "33",
};

let profile: CompanyProfile = { ...DEFAULT_COMPANY_PROFILE };
const listeners = new Set<() => void>();

/** Read the current profile (stable reference between changes for useSyncExternalStore). */
export function getCompanyProfile(): CompanyProfile {
  return profile;
}

/** Merge a patch and notify subscribers (header, document forms, …). */
export function setCompanyProfile(patch: Partial<CompanyProfile>) {
  profile = { ...profile, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeCompanyProfile(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Initials fallback for the logo tile (e.g. "One ERP Retail" → "OO"). */
export function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

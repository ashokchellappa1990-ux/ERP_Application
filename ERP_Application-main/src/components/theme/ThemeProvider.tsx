"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  isThemeId,
  type Density,
  type ThemeId,
} from "@/lib/themes";
import { DEFAULT_PRODUCT_NAME, DEFAULT_TAGLINE } from "@/lib/brand";

/**
 * Theme engine context.
 *
 * Responsibilities:
 *  - Persist the active theme + density to localStorage.
 *  - Reflect them onto <html data-theme data-density> so tokens.css applies.
 *  - Support live brand-color override (color customization) by injecting
 *    inline CSS variables on <html>, which win over the theme block.
 *  - Support font + logo customization for white-label / per-tenant branding.
 */

interface BrandConfig {
  /** Overrides --color-primary at runtime (admin brand color picker). */
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  /** Primary-button / brand-gradient surface style. */
  buttonStyle?: "gradient" | "solid";
  /** Gradient start / end overrides (default to primary / secondary). */
  gradientFrom?: string;
  gradientTo?: string;
  /** Gradient direction in degrees (default 135). */
  gradientAngle?: number;
  /** Overrides --font-sans (e.g. a tenant's licensed font). */
  fontFamily?: string;
  /** Logo shown in topbar / login. Falls back to the wordmark when unset. */
  logoUrl?: string;
  /** Product / tenant display name. */
  productName?: string;
  /** Short tagline shown under the wordmark. */
  tagline?: string;
}

interface ThemeContextValue {
  theme: ThemeId;
  density: Density;
  brand: BrandConfig;
  setTheme: (id: ThemeId) => void;
  setDensity: (d: Density) => void;
  setBrand: (patch: Partial<BrandConfig>) => void;
  resetBrand: () => void;
}

const STORAGE_KEY = "oneerp.theme";
const DENSITY_KEY = "oneerp.density";
const BRAND_KEY = "oneerp.brand";

const DEFAULT_BRAND: BrandConfig = { productName: DEFAULT_PRODUCT_NAME, tagline: DEFAULT_TAGLINE };

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyBrand(brand: BrandConfig) {
  const el = document.documentElement;
  const setOrClear = (name: string, value?: string) => {
    if (value) el.style.setProperty(name, value);
    else el.style.removeProperty(name);
  };
  setOrClear("--color-primary", brand.primaryColor);
  setOrClear("--color-secondary", brand.secondaryColor);
  setOrClear("--color-accent", brand.accentColor);
  setOrClear("--font-sans", brand.fontFamily);

  // Brand-gradient surface (primary buttons, active nav, logo, chips) — derived
  // live from the effective colours so a brand-colour change is visible, plus a
  // solid / gradient toggle and a custom direction + end colour.
  const customised =
    brand.buttonStyle === "solid" ||
    !!brand.gradientFrom || !!brand.gradientTo ||
    brand.gradientAngle != null ||
    !!brand.primaryColor || !!brand.secondaryColor;

  if (!customised) {
    el.style.removeProperty("--gradient-brand"); // fall back to the preset's designed gradient
    return;
  }
  // getComputedStyle reflects the inline overrides we just set above.
  const cs = getComputedStyle(el);
  const from = (brand.gradientFrom || cs.getPropertyValue("--color-primary")).trim();
  const to = (brand.gradientTo || cs.getPropertyValue("--color-secondary")).trim();
  const angle = brand.gradientAngle ?? 135;
  el.style.setProperty(
    "--gradient-brand",
    brand.buttonStyle === "solid"
      ? `linear-gradient(0deg, ${from} 0%, ${from} 100%)`
      : `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [density, setDensityState] = useState<Density>("comfortable");
  const [brand, setBrandState] = useState<BrandConfig>(DEFAULT_BRAND);

  // Hydrate from storage once on mount.
  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(storedTheme)) setThemeState(storedTheme);

    const storedDensity = localStorage.getItem(DENSITY_KEY);
    if (storedDensity === "touch" || storedDensity === "comfortable") {
      setDensityState(storedDensity);
    }

    const storedBrand = localStorage.getItem(BRAND_KEY);
    if (storedBrand) {
      try {
        const parsed = { ...DEFAULT_BRAND, ...JSON.parse(storedBrand) };
        setBrandState(parsed);
        applyBrand(parsed);
      } catch {
        /* ignore malformed brand config */
      }
    }
  }, []);

  // Sync from the tenant's saved theme in the DB (source of truth across devices).
  // A 401 on the login screen is expected and simply keeps the local values.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const j = await fetch("/api/settings/theme", { cache: "no-store" }).then((r) => r.json());
        if (!active || !j?.ok || !j.theme) return;
        const t = j.theme as { theme: string; density: string; primaryColor?: string; secondaryColor?: string; accentColor?: string; fontFamily?: string; buttonStyle?: string; gradientFrom?: string; gradientTo?: string; gradientAngle?: number };
        if (isThemeId(t.theme)) { setThemeState(t.theme); localStorage.setItem(STORAGE_KEY, t.theme); }
        if (t.density === "touch" || t.density === "comfortable") { setDensityState(t.density); localStorage.setItem(DENSITY_KEY, t.density); }
        setBrandState((prev) => {
          // Reset colour/font/gradient to the tenant theme, but preserve the brand
          // identity (name / logo / tagline) which comes from the system setting.
          const next: BrandConfig = { productName: prev.productName, logoUrl: prev.logoUrl, tagline: prev.tagline };
          if (t.primaryColor) next.primaryColor = t.primaryColor;
          if (t.secondaryColor) next.secondaryColor = t.secondaryColor;
          if (t.accentColor) next.accentColor = t.accentColor;
          if (t.fontFamily) next.fontFamily = t.fontFamily;
          if (t.buttonStyle === "solid" || t.buttonStyle === "gradient") next.buttonStyle = t.buttonStyle;
          if (t.gradientFrom) next.gradientFrom = t.gradientFrom;
          if (t.gradientTo) next.gradientTo = t.gradientTo;
          if (typeof t.gradientAngle === "number") next.gradientAngle = t.gradientAngle;
          localStorage.setItem(BRAND_KEY, JSON.stringify(next)); applyBrand(next);
          return next;
        });
      } catch { /* offline / unauth — keep local */ }
    })();
    return () => { active = false; };
  }, []);

  // Load the product brand (name + logo) from the portal system setting — the
  // Website CMS identity — so a rename / new logo there flows through the whole app.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const j = await fetch("/api/website/config", { cache: "no-store" }).then((r) => r.json());
        const id = j?.config?.identity as { productName?: string; logoText?: string; logoUrl?: string } | undefined;
        if (!active || !id) return;
        const name = (id.productName || id.logoText || "").trim();
        setBrandState((prev) => {
          const next: BrandConfig = { ...prev };
          if (name) next.productName = name;
          if (id.logoUrl) next.logoUrl = id.logoUrl;
          localStorage.setItem(BRAND_KEY, JSON.stringify(next));
          return next;
        });
      } catch { /* keep defaults */ }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // The new preset re-defines --color-primary/secondary + --gradient-brand, so
    // recompute the brand-gradient surface from the (now updated) effective colours.
    applyBrand(brand);
  }, [theme, brand]);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  const setTheme = useCallback((id: ThemeId) => {
    document.documentElement.classList.add("theme-transition");
    setThemeState(id);
    localStorage.setItem(STORAGE_KEY, id);
    window.setTimeout(
      () => document.documentElement.classList.remove("theme-transition"),
      300
    );
  }, []);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    localStorage.setItem(DENSITY_KEY, d);
  }, []);

  const setBrand = useCallback((patch: Partial<BrandConfig>) => {
    setBrandState((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(BRAND_KEY, JSON.stringify(next));
      applyBrand(next);
      return next;
    });
  }, []);

  const resetBrand = useCallback(() => {
    setBrandState(DEFAULT_BRAND);
    localStorage.removeItem(BRAND_KEY);
    applyBrand(DEFAULT_BRAND);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, density, brand, setTheme, setDensity, setBrand, resetBrand }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/**
 * Safe brand accessor for presentational components (Logo / AppLoader) that may
 * render outside a provider (e.g. a route-level loading fallback). Returns the
 * live brand when a provider is present, otherwise the factory defaults.
 */
export function useBrand(): BrandConfig {
  return useContext(ThemeContext)?.brand ?? DEFAULT_BRAND;
}

"use client";

import { type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { useBrand } from "@/components/theme/ThemeProvider";
import { splitBrandName } from "@/lib/brand";

/**
 * Modern application loader — a colourful gradient ring spinner with the brand
 * mark and a "Loading, please wait" message. Use inline (default) inside a
 * content area, or `fullScreen` as an overlay.
 */

const SIZES = {
  sm: { ring: "h-12 w-12", thick: 4, core: "h-5 w-5 text-[10px]", text: "text-2xs", brand: "text-xs" },
  md: { ring: "h-16 w-16", thick: 6, core: "h-7 w-7 text-xs", text: "text-sm", brand: "text-sm" },
  lg: { ring: "h-20 w-20", thick: 7, core: "h-9 w-9 text-sm", text: "text-base", brand: "text-base" },
} as const;

export interface AppLoaderProps {
  label?: string;
  size?: keyof typeof SIZES;
  fullScreen?: boolean;
  className?: string;
}

export function AppLoader({ label = "Loading, please wait", size = "md", fullScreen = false, className }: AppLoaderProps) {
  const s = SIZES[size];
  const brand = useBrand();
  const [word1, word2] = splitBrandName(brand.productName);
  const initial = (brand.productName || "O").trim().charAt(0).toUpperCase();

  const content = (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Gradient ring spinner with brand core */}
      <div className={cn("relative grid place-items-center", s.ring)}>
        <span
          className="app-spinner absolute inset-0"
          style={{ "--ring-thick": `${s.thick}px` } as CSSProperties}
          aria-hidden
        />
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt={brand.productName || "Logo"} className={cn("app-core rounded-lg object-contain", s.core)} />
        ) : (
          <span className={cn("app-core grid place-items-center rounded-lg bg-brand-gradient font-bold text-white shadow-sm", s.core)}>
            {initial}
          </span>
        )}
      </div>

      {/* Brand + message */}
      <div className="flex flex-col items-center gap-1">
        <span className={cn("font-bold tracking-tight text-foreground", s.brand)}>
          {word1}{word2 && <> <span className="text-primary">{word2}</span></>}
        </span>
        <span className={cn("flex items-center gap-1.5 font-medium text-muted", s.text)}>
          {label}
          <span className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="loader-dot" style={{ animationDelay: `${i * 0.16}s` }} />
            ))}
          </span>
        </span>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[120] grid place-items-center bg-surface/80 backdrop-blur-sm" role="status" aria-live="polite">
        {content}
      </div>
    );
  }
  return (
    <div className="grid w-full place-items-center py-20" role="status" aria-live="polite">
      {content}
    </div>
  );
}

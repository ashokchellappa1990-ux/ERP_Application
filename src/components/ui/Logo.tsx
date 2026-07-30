"use client";

import { cn } from "@/lib/cn";
import { useBrand } from "@/components/theme/ThemeProvider";
import { splitBrandName } from "@/lib/brand";
import { OasysMark } from "@/components/ui/OasysMark";

/**
 * Product wordmark. Name / logo / tagline come from the portal system setting
 * (Website CMS identity) via <ThemeProvider>, defaulting to "Oasys ERP".
 * When a logo image (brand.logoUrl) is set, that <img> is rendered instead of
 * the SVG mark.
 */
export function Logo({
  className,
  showText = true,
  invert = false,
}: {
  className?: string;
  showText?: boolean;
  invert?: boolean;
}) {
  const brand = useBrand();
  const [word1, word2] = splitBrandName(brand.productName);

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {brand.logoUrl ? (
        <img
          src={brand.logoUrl}
          alt={brand.productName || "Logo"}
          className="h-9 w-9 shrink-0 rounded-lg object-contain"
        />
      ) : (
        <OasysMark className="h-9 w-9" />
      )}
      {showText && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "text-[16px] font-bold tracking-tight",
              invert ? "text-white" : "text-foreground"
            )}
          >
            {word1}
            {word2 && <span className="text-secondary"> {word2}</span>}
          </span>
        </span>
      )}
    </span>
  );
}

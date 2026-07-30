import { cn } from "@/lib/cn";

/**
 * OASYS brand mark — the four-colour ring (orange / blue / purple / yellow) from the
 * official OASYS logo. Rendered as a self-contained SVG so it scales crisply and works
 * on any background. This is the factory default logo; a tenant can still override it
 * with an uploaded image via Website CMS → Theme & Identity (brand.logoUrl).
 */
export function OasysMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("shrink-0", className)} fill="none" strokeWidth={3.3} strokeLinecap="round" aria-hidden>
      {/* top-left */}
      <path d="M4.12 10.61 A 8 8 0 0 1 10.61 4.12" stroke="#EF7D22" />
      {/* top-right */}
      <path d="M13.39 4.12 A 8 8 0 0 1 19.88 10.61" stroke="#3F6EA5" />
      {/* bottom-right */}
      <path d="M19.88 13.39 A 8 8 0 0 1 13.39 19.88" stroke="#5A2D8A" />
      {/* bottom-left */}
      <path d="M10.61 19.88 A 8 8 0 0 1 4.12 13.39" stroke="#F6B21A" />
      {/* inner dot */}
      <circle cx="10.6" cy="15.3" r="1.15" fill="#5A2D8A" />
    </svg>
  );
}

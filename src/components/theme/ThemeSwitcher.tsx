"use client";

import { useState } from "react";
import { Check, Palette, Monitor, Hand } from "lucide-react";
import { THEMES } from "@/lib/themes";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/cn";

/**
 * Compact theme + density picker used in the topbar.
 * Demonstrates the configurable theme engine: theme swap, density toggle,
 * and a live brand-color override.
 */
export function ThemeSwitcher() {
  const { theme, setTheme, density, setDensity, brand, setBrand } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Customize theme"
        onClick={() => setOpen((o) => !o)}
        className="touch-target flex items-center justify-center rounded-md border border-border bg-surface px-2.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
      >
        <Palette className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-72 animate-fade-in rounded-lg border border-border bg-card p-3 shadow-lg">
            <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
              Theme
            </p>
            <div className="grid grid-cols-1 gap-1">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-surface-2",
                    theme === t.id && "bg-primary-subtle"
                  )}
                >
                  <span className="flex shrink-0 overflow-hidden rounded-md border border-border">
                    {t.swatch.map((c) => (
                      <span
                        key={c}
                        className="h-6 w-3"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {t.name}
                    </span>
                    <span className="block text-2xs text-muted">
                      {t.description}
                    </span>
                  </span>
                  {theme === t.id && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>

            <div className="my-3 h-px bg-border" />

            <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
              Density
            </p>
            <div className="grid grid-cols-2 gap-2">
              <DensityButton
                active={density === "comfortable"}
                onClick={() => setDensity("comfortable")}
                icon={<Monitor className="h-4 w-4" />}
                label="Comfortable"
              />
              <DensityButton
                active={density === "touch"}
                onClick={() => setDensity("touch")}
                icon={<Hand className="h-4 w-4" />}
                label="Touch / POS"
              />
            </div>

            <div className="my-3 h-px bg-border" />

            <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
              Brand color
            </p>
            <div className="flex items-center gap-2 px-1">
              <input
                type="color"
                aria-label="Primary brand color"
                value={brand.primaryColor ?? "#4338CA"}
                onChange={(e) => setBrand({ primaryColor: e.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
              />
              <span className="text-xs text-muted">
                Live override of the primary color
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DensityButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium transition",
        active
          ? "border-primary bg-primary-subtle text-primary"
          : "border-border bg-surface text-muted hover:bg-surface-2"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

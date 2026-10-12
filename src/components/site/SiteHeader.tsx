"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight, Orbit } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WebsiteConfig } from "@/lib/website/config";

export function SiteHeader({ config }: { config: WebsiteConfig }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ctaClass = (style?: string) => style === "primary"
    ? "bg-primary text-primary-foreground hover:brightness-105 shadow-sm"
    : style === "outline" ? "border border-border text-foreground hover:border-primary hover:text-primary" : "text-muted hover:text-foreground";

  return (
    <header className={cn("sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md transition-shadow", scrolled && "shadow-sm")}>
      <div className="mx-auto flex h-16 max-w-[1560px] items-center justify-between px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white"><Orbit className="h-5 w-5" /></span>
          <span className="text-lg tracking-tight">{config.identity.logoText}</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted lg:flex">
          {config.nav.map((n) => <Link key={n.label} href={n.href} className="transition hover:text-foreground">{n.label}</Link>)}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {config.headerCtas.map((c) => (
            <Link key={c.label} href={c.href} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition", ctaClass(c.style))}>
              {c.label}{c.style === "primary" && <ArrowRight className="h-4 w-4" />}
            </Link>
          ))}
        </div>

        <button onClick={() => setOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-lg text-foreground lg:hidden" aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <nav className="mx-auto flex max-w-[1560px] flex-col gap-1 px-6 lg:px-10 py-4">
            {config.nav.map((n) => <Link key={n.label} href={n.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-2">{n.label}</Link>)}
            <div className="mt-2 flex flex-col gap-2">
              {config.headerCtas.map((c) => (
                <Link key={c.label} href={c.href} onClick={() => setOpen(false)} className={cn("inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition", ctaClass(c.style))}>{c.label}</Link>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

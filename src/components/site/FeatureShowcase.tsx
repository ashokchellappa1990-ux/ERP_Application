"use client";

/**
 * Interactive module showcase — instead of a long grid the visitor scrolls past,
 * they pick a module from the side list and its detail appears on the right.
 * Big content sections become one compact, engaging viewport.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { SiteIcon } from "@/components/site/SiteIcon";
import { Reveal } from "@/components/site/Reveal";
import type { GroupSection } from "@/lib/website/config";

export function FeatureShowcase({ group, id, eyebrow, tint, flip }: { group: GroupSection; id?: string; eyebrow?: string; tint?: boolean; flip?: boolean }) {
  const [active, setActive] = useState(0);
  const items = group.items;
  if (!items.length) return null;
  const cur = items[active];

  const list = (
    <div className="lg:w-[340px] lg:shrink-0">
      {/* mobile: horizontal chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
        {items.map((it, i) => (
          <button key={it.title} onClick={() => setActive(i)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition", i === active ? "border-primary bg-primary text-white" : "border-border bg-card text-muted")}>{it.title}</button>
        ))}
      </div>
      {/* desktop: vertical list */}
      <div className="hidden max-h-[30rem] flex-col gap-1 overflow-y-auto pr-1 lg:flex">
        {items.map((it, i) => (
          <button key={it.title} onClick={() => setActive(i)} className={cn("group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition", i === active ? "border-primary/40 bg-gradient-to-r from-primary-subtle to-transparent" : "border-transparent hover:bg-surface-2")}>
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg transition", i === active ? "bg-gradient-to-br from-primary to-secondary text-white shadow-md shadow-primary/20" : "bg-surface-2 text-muted group-hover:text-primary")}><SiteIcon name={it.icon} className="h-5 w-5" /></span>
            <span className={cn("flex-1 text-sm font-semibold", i === active ? "text-foreground" : "text-muted")}>{it.title}</span>
            <ChevronRight className={cn("h-4 w-4 transition", i === active ? "text-primary" : "text-transparent")} />
          </button>
        ))}
      </div>
    </div>
  );

  const detail = (
    <div className="flex-1">
      <div key={active} className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-lg animate-[fade-in_0.35s_ease] md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-gradient-to-br from-primary/15 to-secondary/15 blur-2xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex-1">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/25"><SiteIcon name={cur.icon} className="h-7 w-7" /></span>
            <h3 className="mt-5 text-2xl font-bold tracking-tight text-foreground">{cur.title}</h3>
            <p className="mt-3 text-md leading-relaxed text-muted">{cur.text}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {items.filter((_, i) => i !== active).slice(0, 4).map((o) => (
                <button key={o.title} onClick={() => setActive(items.indexOf(o))} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-2xs font-medium text-muted transition hover:border-primary hover:text-primary"><SiteIcon name={o.icon} className="h-3.5 w-3.5" /> {o.title}</button>
              ))}
            </div>
            <Link href="/contact?type=demo" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">See it in a demo <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {/* decorative visual */}
          <div className="hidden w-52 shrink-0 md:block">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger/50" /><span className="h-2 w-2 rounded-full bg-warning/50" /><span className="h-2 w-2 rounded-full bg-success/50" /></div>
              <div className="space-y-2">
                {[0, 1, 2].map((k) => <div key={k} className="flex items-center gap-2 rounded-lg bg-card p-2"><span className="grid h-6 w-6 place-items-center rounded bg-primary-subtle text-primary"><Check className="h-3.5 w-3.5" /></span><span className="h-2 flex-1 rounded bg-border" /></div>)}
                <div className="h-16 rounded-lg bg-gradient-to-br from-primary/80 to-secondary/80" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section id={id} className={cn("scroll-mt-20", tint && "border-y border-border bg-surface")}>
      <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-16 md:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          {eyebrow && <div className="mb-4 flex justify-center"><span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-subtle px-3 py-1 text-2xs font-bold uppercase tracking-wider text-primary">{eyebrow}</span></div>}
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-[2.6rem] md:leading-[1.1]">{group.title}</h2>
          {group.subtitle && <p className="mt-4 text-md leading-relaxed text-muted">{group.subtitle}</p>}
        </Reveal>
        <div className={cn("mt-12 flex flex-col gap-6 lg:flex-row lg:gap-10", flip && "lg:flex-row-reverse")}>
          {list}
          {detail}
        </div>
      </div>
    </section>
  );
}

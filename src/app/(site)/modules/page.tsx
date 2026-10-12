import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { MODULE_CATEGORIES, ALL_MODULES } from "@/lib/website/modules";
import { getPublishedConfig } from "@/lib/website/service";
import { DEFAULT_PRODUCT_NAME } from "@/lib/brand";
import { SiteIcon } from "@/components/site/SiteIcon";
import { Reveal } from "@/components/site/Reveal";
import { Counter } from "@/components/site/Counter";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  let name = "";
  try { name = ((await getPublishedConfig()).identity?.productName ?? "").trim(); } catch { /* DB down — use default */ }
  const brand = name || DEFAULT_PRODUCT_NAME;
  return {
    title: "ERP Modules",
    description: `Explore every ${brand} module in detail — Sales, POS, Purchase, Inventory, Finance, GST, Manufacturing, HR, Payroll, CRM and Business Intelligence.`,
  };
}

export default function ModulesPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="site-blob pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="site-blob pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto max-w-[1560px] px-6 lg:px-10 py-16 text-center md:py-24">
          <Reveal>
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to home</Link>
            <div className="mt-5 flex justify-center"><span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-subtle px-3 py-1 text-2xs font-bold uppercase tracking-wider text-primary">The Complete ERP Platform</span></div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground md:text-6xl">Every module your <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">business</span> needs</h1>
            <p className="mx-auto mt-5 max-w-2xl text-md leading-relaxed text-muted md:text-lg">One unified platform, {ALL_MODULES.length}+ deeply-integrated modules. Explore each in detail — click any module to see its full capabilities.</p>
          </Reveal>
          <Reveal delay={120} className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-4">
            {[[String(ALL_MODULES.length), "+", "Modules"], ["7", "", "Suites"], ["1", "", "Platform"]].map(([v, s, l]) => (
              <div key={l} className="rounded-2xl border border-border bg-card p-4 text-center shadow-sm"><div className="text-3xl font-bold text-foreground"><Counter value={v} suffix={s} /></div><div className="mt-1 text-xs text-muted">{l}</div></div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Category nav */}
      <div className="sticky top-16 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1560px] gap-1.5 overflow-x-auto px-5 py-3">
          {MODULE_CATEGORIES.map((c) => (
            <a key={c.key} href={`#${c.key}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"><SiteIcon name={c.icon} className="h-3.5 w-3.5" /> {c.title}</a>
          ))}
        </div>
      </div>

      {/* Categories */}
      {MODULE_CATEGORIES.map((cat, ci) => (
        <section key={cat.key} id={cat.key} className={`scroll-mt-32 ${ci % 2 === 1 ? "bg-surface" : ""} border-b border-border`}>
          <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-14 md:py-16">
            <Reveal className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/25"><SiteIcon name={cat.icon} className="h-6 w-6" /></span>
              <div><h2 className="text-2xl font-bold tracking-tight text-foreground">{cat.title}</h2><p className="text-sm text-muted">{cat.blurb}</p></div>
            </Reveal>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cat.modules.map((m, i) => (
                <Reveal key={m.slug} delay={(i % 3) * 60}>
                  <Link href={`/modules/${m.slug}`} className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-subtle text-primary transition group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-secondary group-hover:text-white"><SiteIcon name={m.icon} className="h-5 w-5" /></span>
                    <h3 className="mt-4 text-base font-bold text-foreground">{m.name}</h3>
                    <p className="text-2xs font-semibold uppercase tracking-wider text-primary">{m.tagline}</p>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{m.description}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-all group-hover:gap-2.5">View details <ArrowRight className="h-4 w-4" /></span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="mx-auto max-w-[1560px] px-6 lg:px-10 py-16">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-secondary p-10 text-center text-white shadow-2xl md:p-14">
          <div className="site-blob pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">See the whole platform in action</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/90">Every module, unified on one real-time platform. Start free or book a guided demo.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/contact?type=trial" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 text-md font-bold text-primary shadow-lg transition hover:bg-white/90">Start Free Trial <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/contact?type=demo" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/40 px-7 text-md font-semibold text-white transition hover:bg-white/10">Book a Demo</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

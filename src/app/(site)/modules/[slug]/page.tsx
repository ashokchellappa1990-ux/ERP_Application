import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import { MODULE_CATEGORIES, findModule } from "@/lib/website/modules";
import { SiteIcon } from "@/components/site/SiteIcon";
import { Reveal } from "@/components/site/Reveal";

export function generateStaticParams() {
  return MODULE_CATEGORIES.flatMap((c) => c.modules.map((m) => ({ slug: m.slug })));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const found = findModule(params.slug);
  if (!found) return { title: "Module" };
  return { title: found.module.name, description: found.module.description };
}

export default function ModuleDetailPage({ params }: { params: { slug: string } }) {
  const found = findModule(params.slug);
  if (!found) notFound();
  const { module: m, category } = found;
  const related = category.modules.filter((x) => x.slug !== m.slug);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <div className="site-blob pointer-events-none absolute -right-32 -top-24 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
        <div className="site-blob pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto max-w-[1560px] px-6 lg:px-10 py-14 md:py-20">
          <Reveal>
            <div className="flex items-center gap-2 text-xs text-muted">
              <Link href="/modules" className="inline-flex items-center gap-1.5 transition hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> ERP Modules</Link>
              <span className="text-subtle">/</span><span className="font-medium text-foreground">{category.title}</span>
            </div>
            <div className="mt-6 grid items-center gap-8 lg:grid-cols-2">
              <div>
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-xl shadow-primary/25"><SiteIcon name={m.icon} className="h-8 w-8" /></span>
                <p className="mt-5 text-2xs font-bold uppercase tracking-wider text-primary">{m.tagline}</p>
                <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground md:text-5xl">{m.name}</h1>
                <p className="mt-4 max-w-xl text-md leading-relaxed text-muted md:text-lg">{m.description}</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link href="/contact?type=demo" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-6 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-105">Book a demo <ArrowRight className="h-4 w-4" /></Link>
                  <Link href="/contact?type=trial" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary">Start free trial</Link>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="site-float rounded-2xl border border-border bg-card p-5 shadow-2xl">
                  <div className="mb-3 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-danger/50" /><span className="h-2.5 w-2.5 rounded-full bg-warning/50" /><span className="h-2.5 w-2.5 rounded-full bg-success/50" /></div>
                  <div className="space-y-2.5">
                    {m.features.slice(0, 5).map((f) => <div key={f} className="flex items-center gap-2.5 rounded-lg border border-border bg-surface p-2.5"><span className="grid h-7 w-7 place-items-center rounded-md bg-success-subtle text-success"><Check className="h-4 w-4" /></span><span className="text-sm text-foreground">{f}</span></div>)}
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1560px] px-6 lg:px-10 py-16">
        <Reveal className="max-w-2xl"><h2 className="text-3xl font-bold tracking-tight text-foreground">Key capabilities</h2><p className="mt-3 text-muted">Everything {m.name} brings to your operation.</p></Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {m.features.map((f, i) => (
            <Reveal key={f} delay={(i % 3) * 60}>
              <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary"><Check className="h-5 w-5" /></span>
                <span className="text-sm font-medium text-foreground">{f}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Benefits band */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-[1560px] px-6 lg:px-10 py-16">
          <Reveal><div className="mb-3 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-primary"><Sparkles className="h-4 w-4" /> Business outcomes</div><h2 className="text-3xl font-bold tracking-tight text-foreground">Why it matters</h2></Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {m.benefits.map((b, i) => (
              <Reveal key={b} delay={i * 70}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <span className="text-3xl font-bold text-primary/30">{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-2 text-md font-semibold leading-relaxed text-foreground">{b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Related modules */}
      {related.length > 0 && (
        <section className="mx-auto max-w-[1560px] px-6 lg:px-10 py-16">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">More in {category.title}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <Link key={r.slug} href={`/modules/${r.slug}`} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary transition group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-secondary group-hover:text-white"><SiteIcon name={r.icon} className="h-5 w-5" /></span>
                <div className="min-w-0"><div className="truncate text-sm font-semibold text-foreground">{r.name}</div><div className="truncate text-2xs text-muted">{r.tagline}</div></div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-subtle transition group-hover:text-primary" />
              </Link>
            ))}
          </div>
          <div className="mt-8"><Link href="/modules" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">Explore all modules <ArrowRight className="h-4 w-4" /></Link></div>
        </section>
      )}
    </>
  );
}

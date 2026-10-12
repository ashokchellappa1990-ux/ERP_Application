import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPublishedConfig } from "@/lib/website/service";
import { DEFAULT_PRODUCT_NAME } from "@/lib/brand";
import { PricingSection } from "@/components/site/sections";
import { FaqAccordion } from "@/components/site/FaqAccordion";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  let name = "";
  try { name = ((await getPublishedConfig()).identity?.productName ?? "").trim(); } catch { /* DB down — use default */ }
  const brand = name || DEFAULT_PRODUCT_NAME;
  return { title: "Pricing", description: `Simple, transparent pricing for ${brand}. Start free and scale as you grow.` };
}

export default async function PricingPage() {
  const config = await getPublishedConfig();
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1560px] px-6 lg:px-10 pb-8 pt-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">Pricing that grows with you</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted">Start free. Upgrade when you're ready. No hidden fees, cancel anytime.</p>
        </div>
      </section>
      <PricingSection config={config} />
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight text-foreground">Pricing FAQ</h2>
          <FaqAccordion items={config.faq.items} />
          <div className="mt-10 text-center">
            <Link href="/contact?type=demo" className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:brightness-105">Talk to sales <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}

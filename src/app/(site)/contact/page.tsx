import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getPublishedConfig } from "@/lib/website/service";
import { DEFAULT_PRODUCT_NAME } from "@/lib/brand";
import { LeadForm } from "@/components/site/LeadForm";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  let name = "";
  try { name = ((await getPublishedConfig()).identity?.productName ?? "").trim(); } catch { /* DB down — use default */ }
  const brand = name || DEFAULT_PRODUCT_NAME;
  return { title: "Contact & Free Trial", description: `Start your free trial, book a live demo, or contact the ${brand} team.` };
}

export default async function ContactPage({ searchParams }: { searchParams: { type?: string; plan?: string } }) {
  const config = await getPublishedConfig();
  const type = searchParams.type ?? "trial";
  const heading = type === "demo" ? "Book a live demo" : type === "contact" ? "Get in touch" : "Start your free trial";

  return (
    <section className="mx-auto max-w-[1560px] px-6 lg:px-10 py-16 md:py-20">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">{heading}</h1>
          <p className="mt-4 max-w-md text-md leading-relaxed text-muted">Tell us a bit about your business and we'll get you up and running on {config.identity.productName} — the AI-powered unified business platform.</p>
          <ul className="mt-8 space-y-3">
            {["14-day free trial — no credit card", "Personalised onboarding & data import", "GST, e-invoice & e-way bill ready", "Cloud or on-premise deployment", "Dedicated support to go live fast"].map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-foreground"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> {b}</li>
            ))}
          </ul>
          <div className="mt-10 rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm text-muted">Prefer to talk?</p>
            <a href={`mailto:${config.footer.contactEmail}`} className="mt-1 block text-lg font-semibold text-primary">{config.footer.contactEmail}</a>
            <a href={`tel:${config.footer.contactPhone}`} className="text-sm text-muted">{config.footer.contactPhone}</a>
          </div>
        </div>
        <div><LeadForm defaultType={type} defaultPlan={searchParams.plan} /></div>
      </div>
    </section>
  );
}

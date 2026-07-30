"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PricingPlan } from "@/lib/website/config";

/** Pricing grid with a Monthly/Yearly toggle + an "All plans include" column. */
export function PricingPlans({ plans, includes }: { plans: PricingPlan[]; includes: string[] }) {
  const [yearly, setYearly] = useState(false);
  return (
    <>
      <div className="mt-8 flex items-center justify-center gap-3">
        <button onClick={() => setYearly(false)} className={cn("rounded-lg px-4 py-1.5 text-sm font-semibold transition", !yearly ? "bg-primary text-white shadow" : "text-muted hover:text-foreground")}>Monthly</button>
        <button onClick={() => setYearly(true)} className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition", yearly ? "bg-primary text-white shadow" : "text-muted hover:text-foreground")}>Yearly <span className="rounded-full bg-success/15 px-2 py-0.5 text-2xs font-bold text-success">Save 20%</span></button>
      </div>
      <div className="mt-10 grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map((p) => {
          const custom = /custom/i.test(p.price);
          const yearlyPrice = custom ? p.price : discount(p.price);
          return (
            <div key={p.name} className={cn("flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition hover:shadow-lg", p.featured ? "border-primary shadow-lg ring-2 ring-primary/25 lg:-translate-y-2" : "border-border")}>
              {p.featured && <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full bg-gradient-to-r from-primary to-secondary px-2.5 py-0.5 text-2xs font-bold text-white">★ Most Popular</span>}
              <h3 className="text-base font-bold text-foreground">{p.name}</h3>
              <p className="mt-0.5 text-2xs text-muted">{p.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                {custom ? <span className="text-2xl font-bold tracking-tight text-foreground">{p.price} {p.period}</span> : <><span className="text-3xl font-bold tracking-tight text-foreground">{yearly ? yearlyPrice : p.price}</span><span className="text-xs text-muted">{p.period}</span></>}
              </div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-muted"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}</li>)}
              </ul>
              <Link href={p.cta.href} className={cn("mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition", p.featured ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25 hover:brightness-105" : "border border-border text-foreground hover:border-primary hover:text-primary")}>{p.cta.label}</Link>
            </div>
          );
        })}
        {/* All plans include */}
        <div className="flex flex-col rounded-2xl border border-dashed border-border bg-surface p-6">
          <h3 className="text-base font-bold text-foreground">All plans include</h3>
          <ul className="mt-5 space-y-2.5">
            {includes.map((f) => <li key={f} className="flex items-start gap-2 text-sm text-muted"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}</li>)}
          </ul>
        </div>
      </div>
    </>
  );
}

/** Apply a ~20% yearly discount to a "₹1,234"-style monthly price string. */
function discount(price: string): string {
  const n = Number(price.replace(/[^\d.]/g, ""));
  if (!n) return price;
  const y = Math.round(n * 0.8);
  return price.replace(/[\d,]+/, y.toLocaleString("en-IN"));
}

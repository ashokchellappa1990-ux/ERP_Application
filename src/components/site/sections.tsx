import Link from "next/link";
import { ArrowRight, Check, Star, Quote, Play, Calendar, Clock, Orbit, ChevronLeft, ChevronRight, MoreHorizontal, Layers, Server, Database } from "lucide-react";
import { cn } from "@/lib/cn";
import { TECH_STACK, APP_VERSION } from "@/lib/techStack";
import { DEFAULT_PRODUCT_NAME } from "@/lib/brand";
import { SiteIcon } from "@/components/site/SiteIcon";
import { Reveal } from "@/components/site/Reveal";
import { Counter } from "@/components/site/Counter";
import { FeatureShowcase } from "@/components/site/FeatureShowcase";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { PricingPlans } from "@/components/site/PricingPlans";
import { MODULE_CATEGORIES, ALL_MODULES } from "@/lib/website/modules";
import type { WebsiteConfig, CtaButton, Spotlight, ClientLogo, SectionBackground } from "@/lib/website/config";

/* ------------------------------------------------------------- primitives -- */
/** Layered overlay over a background image, chosen per section for readability/effect. */
function overlayClass(o?: string): string {
  switch (o) {
    case "light": return "bg-background/85";
    case "light-strong": return "bg-background/94";
    case "dark": return "bg-slate-900/55";
    case "dark-strong": return "bg-slate-900/78";
    case "brand": return "bg-primary/15";
    case "brand-strong": return "bg-primary/45";
    case "gradient-brand-full": case "gradient": return "bg-gradient-to-br from-primary/85 to-secondary/80";
    case "gradient-dark-b": return "bg-gradient-to-t from-slate-900/92 via-slate-900/45 to-transparent";
    case "gradient-dark-t": return "bg-gradient-to-b from-slate-900/92 via-slate-900/45 to-transparent";
    case "gradient-dark-l": return "bg-gradient-to-r from-slate-900/92 via-slate-900/45 to-transparent";
    case "gradient-dark-r": return "bg-gradient-to-l from-slate-900/92 via-slate-900/45 to-transparent";
    case "gradient-brand-b": return "bg-gradient-to-t from-primary/92 via-primary/40 to-transparent";
    case "gradient-brand-l": return "bg-gradient-to-r from-primary/92 via-secondary/40 to-transparent";
    case "vignette": return "bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(15,23,42,0.78))]";
    default: return "";
  }
}
/** Does this overlay darken the section (so text should be light)? */
function darkensOverlay(o?: string): boolean {
  return !!o && (o.startsWith("dark") || o.startsWith("gradient-dark") || o.startsWith("gradient-brand") || o === "brand-strong" || o === "gradient" || o === "vignette");
}
/** Resolve the effective text colour: explicit choice, or "Auto" which follows the overlay.
 *  With no background image nothing is darkened, so text stays the theme default. */
function resolveText(bg?: SectionBackground): "light" | "dark" | undefined {
  if (!bg?.imageUrl) return undefined;
  const tc = bg?.textColor;
  if (tc === "light") return "light";
  if (tc === "dark") return "dark";
  // Auto: light text only when the overlay darkens the section.
  return darkensOverlay(bg?.overlay) ? "light" : undefined;
}
/** Text-colour override for a section sitting on a background (readability). */
function textVars(t?: string): React.CSSProperties | undefined {
  if (t === "light") return { "--color-foreground": "#ffffff", "--color-muted": "rgba(255,255,255,0.80)", "--color-subtle": "rgba(255,255,255,0.58)", "--color-border": "rgba(255,255,255,0.18)" } as React.CSSProperties;
  if (t === "dark") return { "--color-foreground": "#0f172a", "--color-muted": "#475569", "--color-subtle": "#94a3b8" } as React.CSSProperties;
  return undefined;
}
/** Full-bleed background image + optional dim + overlay layer for a section. */
function BgLayers({ bg }: { bg?: SectionBackground }) {
  if (!bg?.imageUrl) return null;
  const side = bg.imageSide ?? "full";
  const sideCls = side === "left" ? "inset-y-0 left-0 w-[58%]" : side === "right" ? "inset-y-0 right-0 w-[58%]" : side === "center" ? "inset-y-0 left-1/2 w-[60%] -translate-x-1/2" : "inset-0";
  const fade = side === "left" ? "linear-gradient(to right, #000 62%, transparent 100%)" : side === "right" ? "linear-gradient(to left, #000 62%, transparent 100%)" : side === "center" ? "linear-gradient(to right, transparent 0%, #000 18%, #000 82%, transparent 100%)" : undefined;
  return (
    <>
      <div className={cn("pointer-events-none absolute", sideCls)} style={fade ? { WebkitMaskImage: fade, maskImage: fade } : undefined}>
        <img src={bg.imageUrl} alt="" aria-hidden className={cn("absolute inset-0 h-full w-full object-cover", bg.blur && "scale-105 blur-sm", bg.fixed && "bg-fixed")} />
      </div>
      {!!bg.dim && bg.dim > 0 && <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: Math.min(100, bg.dim) / 100 }} />}
      <div className={cn("pointer-events-none absolute inset-0", overlayClass(bg.overlay))} />
    </>
  );
}
/** Frosted / solid panel that lifts hero content off the background image. */
function heroPanelClass(panel: string): string {
  switch (panel) {
    case "glass": return "rounded-3xl border border-white/25 bg-white/10 p-6 shadow-2xl backdrop-blur-xl md:p-8";
    case "dark": return "rounded-3xl border border-white/10 bg-slate-900/65 p-6 shadow-2xl backdrop-blur-md md:p-8";
    case "light": return "rounded-3xl border border-border bg-white/92 p-6 shadow-2xl backdrop-blur md:p-8";
    default: return "";
  }
}
const Wrap = ({ children, className, id, tint, bg, decor }: { children: React.ReactNode; className?: string; id?: string; tint?: boolean; bg?: SectionBackground; decor?: React.ReactNode }) => (
  <section id={id} className={cn("relative scroll-mt-20", tint && !bg?.imageUrl && "border-y border-border bg-surface", className)}>
    <BgLayers bg={bg} />
    {bg?.pattern && bg.pattern !== "none" && <PatternLayer pattern={bg.pattern} side={bg.patternSide ?? "full"} animate={bg.patternAnimate !== false} />}
    {decor}
    <div style={textVars(resolveText(bg))} className="relative mx-auto max-w-[1560px] px-6 py-16 md:py-20 lg:px-10">{children}</div>
  </section>
);
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-subtle px-3 py-1 text-2xs font-bold uppercase tracking-wider text-primary">{children}</span>
);
const Heading = ({ eyebrow, title, subtitle, center = true }: { eyebrow?: string; title: string; subtitle?: string; center?: boolean }) => (
  <Reveal className={cn("max-w-2xl", center && "mx-auto text-center")}>
    {eyebrow && <div className={cn("mb-4", center && "flex justify-center")}><Eyebrow>{eyebrow}</Eyebrow></div>}
    <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-[2.4rem] md:leading-[1.15]">{title}</h2>
    {subtitle && <p className="mt-4 text-md leading-relaxed text-muted">{subtitle}</p>}
  </Reveal>
);
const TONE: Record<string, string> = { violet: "bg-violet-100 text-violet-600", blue: "bg-blue-100 text-blue-600", emerald: "bg-emerald-100 text-emerald-600", orange: "bg-orange-100 text-orange-600", rose: "bg-rose-100 text-rose-600" };
const tone = (t?: string) => TONE[t ?? "violet"] ?? TONE.violet;
const TONE_TEXT: Record<string, string> = { violet: "text-violet-600", blue: "text-blue-600", emerald: "text-emerald-600", orange: "text-orange-500", rose: "text-rose-500" };
const toneText = (t?: string) => TONE_TEXT[t ?? "violet"] ?? TONE_TEXT.violet;

function CtaLink({ cta, big }: { cta: CtaButton; big?: boolean }) {
  const cls = cta.style === "outline"
    ? "border border-border bg-card text-foreground hover:border-primary hover:text-primary"
    : cta.style === "ghost" ? "text-muted hover:text-foreground" : "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25 hover:brightness-105";
  return <Link href={cta.href} className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition", big ? "h-12 px-7 text-md" : "h-11 px-6 text-sm", cls)}>{cta.label}{cta.style !== "ghost" && <ArrowRight className="h-4 w-4" />}</Link>;
}

/* ------------------------------------------------------------------- hero -- */
const ORBIT_NODES = [
  { icon: "ShoppingCart", label: "Sales", angle: -90 },
  { icon: "Truck", label: "Purchase", angle: -50 },
  { icon: "Users", label: "CRM", angle: -10 },
  { icon: "Brain", label: "AI & Analytics", angle: 30 },
  { icon: "Store", label: "E-Commerce", angle: 70 },
  { icon: "Smartphone", label: "Customer App", angle: 110 },
  { icon: "Boxes", label: "Inventory", angle: 150 },
  { icon: "UserCog", label: "HR & Payroll", angle: 190 },
  { icon: "ReceiptText", label: "Finance & GST", angle: 230 },
];
const HERO_CARDS = [
  { icon: "Megaphone", title: "Marketing Automation", sub: "Campaigns, Offers, Segments", tone: "violet", color: "#7c3aed" },
  { icon: "Gift", title: "Loyalty & Rewards", sub: "Points, Coupons, Vouchers", tone: "rose", color: "#ec4899" },
  { icon: "MessageSquare", title: "Multi-Channel Communication", sub: "Email, SMS, WhatsApp, Push", tone: "blue", color: "#3b82f6" },
  { icon: "Landmark", title: "Banking & Payments", sub: "Reconciliation, Settlements", tone: "violet", color: "#6366f1" },
  { icon: "Truck", title: "Delivery Integration", sub: "Partners, Tracking, Proof", tone: "emerald", color: "#10b981" },
];

function Hero({ config }: { config: WebsiteConfig }) {
  const h = config.hero;
  const heroBg = config.backgrounds?.hero;
  const hasImage = !!heroBg?.imageUrl;
  const panel = h.contentPanel ?? "none";
  const dim = Math.min(100, heroBg?.dim ?? 0);
  const onImage = panel === "light" ? false : panel === "glass" || panel === "dark" ? true : resolveText(heroBg) === "light";
  // Pattern still shows alongside an image (e.g. image on the right, pattern on the
  // left). It defaults to waves+dots only when nothing is set and there is no image.
  const heroPattern = heroBg?.pattern && heroBg.pattern !== "none" ? heroBg.pattern : (hasImage ? "none" : "waves-dots");
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary-subtle/30 via-background to-background">
      <BgLayers bg={heroBg ? { ...heroBg, dim: 0 } : undefined} />
      {!!heroBg?.imageUrl && dim > 0 && <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to left, rgba(37,13,71,${dim / 100}) 0%, rgba(76,29,149,${dim / 200}) 42%, transparent 70%)` }} />}
      {heroPattern !== "none" && <PatternLayer pattern={heroPattern} side={heroBg?.patternSide ?? "full"} animate={heroBg?.patternAnimate !== false} base={!hasImage} />}
      <div className="relative mx-auto max-w-[1560px] px-6 pb-6 pt-12 lg:px-10">
        {/* main hero row */}
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className={heroPanelClass(panel)}>
            <Reveal><span className={cn("inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-2xs font-bold uppercase tracking-wider", onImage ? "border-white/25 bg-white/15 text-white backdrop-blur" : "border-primary/20 bg-primary-subtle text-primary")}><SiteIcon name="Sparkles" className="h-3.5 w-3.5" /> {h.badge}</span></Reveal>
            <Reveal delay={80}><h1 className={cn("mt-6 whitespace-pre-line text-5xl font-extrabold leading-[1.02] tracking-tight md:text-6xl", onImage ? "text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.45)]" : "text-foreground")}>{h.titleLead + "\n"}<span className={cn("bg-clip-text text-transparent", onImage ? "bg-gradient-to-r from-fuchsia-300 to-violet-200" : "bg-gradient-to-r from-primary to-secondary")}>{h.titleHighlight}</span></h1></Reveal>
            <Reveal delay={160}><p className={cn("mt-6 max-w-xl text-md leading-relaxed", onImage ? "text-white/85" : "text-muted")}>{h.subtitle}</p></Reveal>
            <Reveal delay={240}><div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={h.primaryCta.href} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-7 text-md font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-105">{h.primaryCta.label}<ArrowRight className="h-4 w-4" /></Link>
              <Link href={h.secondaryCta.href} className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-xl border px-6 text-md font-semibold transition", onImage ? "border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20" : "border-border bg-card text-foreground hover:border-primary hover:text-primary")}><span className={cn("grid h-7 w-7 place-items-center rounded-full", onImage ? "bg-white/20 text-white" : "bg-primary-subtle text-primary")}><Play className="h-3.5 w-3.5 fill-current" /></span>{h.secondaryCta.label}</Link>
            </div></Reveal>
            <Reveal delay={320}><div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {h.trustPoints.map((t) => <span key={t} className={cn("inline-flex items-center gap-1.5 text-sm font-medium", onImage ? "text-white" : "text-foreground")}><Check className="h-4 w-4 text-success" /> {t}</span>)}
            </div></Reveal>
          </div>
          <Reveal delay={200}><HeroOrbit logoText={config.identity.logoText} onDark={!!heroBg?.imageUrl && dim >= 20} /></Reveal>
        </div>

        {/* trust-badge strip */}
        <Reveal className={cn("mt-10 rounded-3xl border p-5 shadow-xl backdrop-blur-xl md:mt-14", hasImage ? "border-white/15 bg-[#26104a]/70" : "border-border bg-card/80")}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 lg:grid-cols-7">
            {h.trustBadges.map((b) => (
              <div key={b.title} className="flex items-center gap-2.5">
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-sm", hasImage ? "bg-white/15 text-white" : tone(b.tone))}><SiteIcon name={b.icon} className="h-6 w-6" /></span>
                <div className="min-w-0"><div className={cn("text-sm font-bold", hasImage ? "text-white" : "text-foreground")}>{b.title}</div><div className={cn("text-[11px] font-medium", hasImage ? "text-white/85" : "text-foreground/70")}>{b.subtitle}</div></div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Dynamic, theme-tinted decorative background: halftone dot clusters + flowing
 * wave ribbons, all drawn with `var(--color-primary/secondary)` so they re-colour
 * automatically whenever the application theme colour changes. Animated, and
 * fully static under `prefers-reduced-motion`.
 *
 * `side` confines the pattern to one half of the section (the other half is left
 * clear for images); `base` adds the corner colour-wash used by the hero.
 */
/** `primaryVar`/`secondaryVar` let a caller outside the app's internal theme
 *  (e.g. the sign-in screen, which uses the published brand colours --brand-1/2,
 *  not the app-theme --color-primary/2) recolour the pattern without touching
 *  any existing caller — both default to the original CSS vars, so the two
 *  marketing-site call sites below are completely unaffected. */
export function PatternLayer({ pattern = "waves-dots", side = "full", base = false, animate = true, primaryVar = "--color-primary", secondaryVar = "--color-secondary" }: { pattern?: string; side?: "full" | "left" | "right"; base?: boolean; animate?: boolean; primaryVar?: string; secondaryVar?: string }) {
  const showWaves = pattern === "waves" || pattern === "waves-dots";
  const showDots = pattern === "dots" || pattern === "waves-dots" || pattern === "mesh";
  const showGrid = pattern === "grid" || pattern === "mesh";
  const showRings = pattern === "rings";
  const showDiag = pattern === "diagonal";
  const primary = `var(${primaryVar})`;
  const secondary = `var(${secondaryVar})`;
  // Anchor dot clusters to the corners of the covered side.
  const dotX = side === "right" ? [96, 97] : [4, 3];
  const dotLayer = (mask: string) => ({
    backgroundImage: `radial-gradient(${primary} 1.3px, transparent 1.7px)`,
    backgroundSize: "18px 18px",
    WebkitMaskImage: mask,
    maskImage: mask,
  });
  // Side container + inward fade so the pattern dissolves toward the free side.
  const sideCls = side === "left" ? "left-0 w-[66%]" : side === "right" ? "right-0 w-[66%]" : "inset-x-0 w-full";
  const fade = side === "left" ? "linear-gradient(to right, #000 52%, transparent 100%)" : side === "right" ? "linear-gradient(to left, #000 52%, transparent 100%)" : undefined;
  const waves = (cls: string, stroke: string, count: number, shift: number) => (
    <svg className={cn("absolute inset-y-0 bottom-0 h-full w-full", animate && cls)} viewBox="0 0 1440 700" preserveAspectRatio="none" fill="none" aria-hidden>
      <g stroke={stroke}>
        {Array.from({ length: count }).map((_, i) => {
          const o = i * 7 + shift;
          const op = 0.05 + (i / count) * 0.2;
          return <path key={i} strokeWidth={1} opacity={op} d={`M-140 ${540 - o} C 240 ${390 - o} 430 ${660 - o} 720 ${480 - o} S 1220 ${300 - o} 1580 ${440 - o}`} />;
        })}
      </g>
    </svg>
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {base && <div className="absolute inset-0 bg-gradient-to-br from-primary-subtle/55 via-background to-primary-subtle/45" />}
      {showDots && (
        <>
          <div className={cn("absolute inset-0", animate && "hero-dots")} style={dotLayer(`radial-gradient(ellipse 34% 32% at ${dotX[0]}% 6%, #000 0%, transparent 74%)`)} />
          <div className={cn("absolute inset-0", animate && "hero-dots")} style={{ ...dotLayer(`radial-gradient(ellipse 30% 30% at ${dotX[1]}% 97%, #000 0%, transparent 74%)`), animationDelay: "3s" }} />
        </>
      )}
      {/* side-confined vector patterns */}
      <div className={cn("absolute bottom-0 top-0", sideCls)} style={fade ? { WebkitMaskImage: fade, maskImage: fade } : undefined}>
        {showWaves && <>{waves("hero-wave-a", secondary, 24, 0)}{waves("hero-wave-b", primary, 24, 70)}</>}
        {showGrid && <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(${primary} 1px, transparent 1px), linear-gradient(90deg, ${primary} 1px, transparent 1px)`, backgroundSize: "40px 40px", opacity: 0.09, WebkitMaskImage: "radial-gradient(ellipse 92% 82% at 50% 46%, #000 22%, transparent 84%)", maskImage: "radial-gradient(ellipse 92% 82% at 50% 46%, #000 22%, transparent 84%)" }} />}
        {showDiag && <div className="absolute inset-0" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${primary} 0 1px, transparent 1px 17px)`, opacity: 0.08 }} />}
        {showRings && (
          <svg className={cn("absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2", animate && "orbit-ring")} viewBox="0 0 100 100" fill="none" aria-hidden>
            {[16, 26, 36, 46].map((r, i) => <circle key={r} cx="50" cy="50" r={r} stroke={i % 2 ? secondary : primary} strokeWidth="0.25" strokeDasharray="1.6 1.4" opacity={0.28 - i * 0.045} />)}
          </svg>
        )}
      </div>
      {/* soft aurora depth — anchored to the covered side */}
      <div className={cn("absolute top-6 h-96 w-96 rounded-full blur-3xl", animate && "site-aurora", side === "right" ? "-right-24" : "-left-24")} style={{ backgroundColor: `color-mix(in srgb, ${primary} 15%, transparent)` }} />
      <div className={cn("absolute bottom-0 h-[26rem] w-[26rem] rounded-full blur-3xl", animate && "site-aurora", side === "left" ? "-left-10" : "-right-16")} style={{ animationDelay: "6s", backgroundColor: `color-mix(in srgb, ${secondary} 15%, transparent)` }} />
    </div>
  );
}

function HeroOrbit({ logoText, onDark }: { logoText: string; onDark?: boolean }) {
  const R = 42; // node radius (% from centre)
  const pos = (deg: number) => ({ left: `${50 + R * Math.cos((deg * Math.PI) / 180)}%`, top: `${50 + R * Math.sin((deg * Math.PI) / 180)}%` });
  const labelCls = onDark ? "text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.75)]" : "text-foreground";
  return (
    <div className="flex items-center justify-center gap-3 xl:gap-5">
      {/* orbit */}
      <div className="relative aspect-square w-full max-w-[540px] shrink-0">
        {/* expanding sonar pulses from the centre */}
        <div className="orbit-sonar pointer-events-none absolute rounded-full border-2 border-primary/50" style={{ inset: "8%" }} />
        <div className="orbit-sonar pointer-events-none absolute rounded-full border-2 border-secondary/40" style={{ inset: "8%", animationDelay: "1.3s" }} />
        <div className="orbit-sonar pointer-events-none absolute rounded-full border-2 border-primary/40" style={{ inset: "8%", animationDelay: "2.6s" }} />
        {/* the circle — brighter, glowing rotating rings that pass through every module.
            This ring IS the connection between the centre hub and the modules (no spoke lines). */}
        <div className="pointer-events-none absolute rounded-full border-2 border-primary/30 [box-shadow:0_0_30px_-6px_var(--color-primary),inset_0_0_26px_-12px_var(--color-primary)]" style={{ inset: "8%" }} />
        <div className="orbit-ring pointer-events-none absolute rounded-full border-[3px] border-dashed border-primary/75" style={{ inset: "8%" }} />
        <div className="orbit-ring-rev pointer-events-none absolute rounded-full border-2 border-dashed border-secondary/55" style={{ inset: "15%" }} />
        {/* centre */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <div className="grid h-24 w-24 place-items-center rounded-full border border-primary/15 bg-card shadow-xl md:h-28 md:w-28"><span className="orbit-core grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-lg md:h-16 md:w-16"><Orbit className="h-8 w-8 md:h-9 md:w-9" /></span></div>
          <div className={cn("mt-2 text-center text-xs font-black leading-none tracking-tight", labelCls)}>{logoText.split(" ").map((w, i) => <div key={i}>{w.toUpperCase()}</div>)}</div>
        </div>
        {/* nodes — icon centre sits exactly on the ring point; the name zooms in
            and highlights in sync with its logo (same 9s cycle + per-node delay) */}
        {ORBIT_NODES.map((n, i) => (
          <div key={n.label} className="absolute -translate-x-1/2 -translate-y-1/2" style={pos(n.angle)}>
            <span className="orbit-zoom grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card text-primary md:h-16 md:w-16" style={{ animationDelay: `${i}s` }}><SiteIcon name={n.icon} className="h-6 w-6 md:h-7 md:w-7" /></span>
            <span className={cn("orbit-name absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold md:text-[11px]", labelCls)} style={{ animationDelay: `${i}s` }}>{n.label}</span>
          </div>
        ))}
      </div>
      {/* connector — glowing animated branches from the circle to each feature card */}
      <svg viewBox="0 0 40 100" preserveAspectRatio="none" className="hidden h-[440px] w-10 xl:block [filter:drop-shadow(0_0_1.5px_var(--color-primary))]" aria-hidden>
        <path className="orbit-spoke" d="M0 50 H20 M20 8 V92" fill="none" stroke="var(--color-primary)" strokeOpacity="0.6" strokeWidth="0.8" strokeDasharray="2.4 2" strokeLinecap="round" />
        {[10, 30, 50, 70, 90].map((y) => <path key={y} className="orbit-spoke" d={`M20 ${y} H40`} fill="none" stroke="var(--color-primary)" strokeOpacity="0.6" strokeWidth="0.8" strokeDasharray="2.4 2" strokeLinecap="round" />)}
        {/* pulsing junction where the branches leave the circle */}
        <circle cx="1.5" cy="50" r="2.2" fill="var(--color-primary)" className="orbit-core" />
        {/* dots where each branch meets a card */}
        {[10, 30, 50, 70, 90].map((y) => <circle key={y} cx="39" cy={y} r="1.6" fill="var(--color-secondary)" />)}
      </svg>
      {/* feature cards — each lights up in turn with its own colour */}
      <div className="hidden w-72 shrink-0 flex-col gap-3 xl:flex">
        {HERO_CARDS.map((c, i) => (
          <div key={c.title} className="card-focus flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 shadow-sm" style={{ "--fc": c.color, animationDelay: `${i}s` } as React.CSSProperties}>
            <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl", tone(c.tone))}><SiteIcon name={c.icon} className="h-6 w-6" /></span>
            <div className="min-w-0"><div className="text-sm font-bold leading-tight text-foreground">{c.title}</div><div className="text-[11px] font-medium text-foreground/70">{c.sub}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrustedLogos({ config }: { config: WebsiteConfig }) {
  const clients: ClientLogo[] = config.clients?.length ? config.clients : config.logos.map((n) => ({ name: n }));
  const parts = config.clientsTitle.split(/(\d+\+?)/);
  return (
    <section className="mx-auto max-w-[1560px] px-6 py-12 lg:px-10">
      <p className="text-center text-lg font-semibold text-foreground">{parts.map((p, i) => (/\d/.test(p) ? <span key={i} className="text-primary">{p}</span> : p))}</p>
      <div className="mt-6 flex items-center gap-3">
        <button aria-label="Previous" className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card text-muted transition hover:border-primary hover:text-primary sm:grid"><ChevronLeft className="h-5 w-5" /></button>
        <div className="site-marquee-group relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          <div className="site-marquee flex w-max items-center gap-3 py-1">
            {[...clients, ...clients].map((c, i) => (
              <span key={i} className="grid h-16 min-w-[150px] shrink-0 place-items-center rounded-xl border border-border bg-card px-6 shadow-sm">
                {c.logoUrl ? <img src={c.logoUrl} alt={c.name} className="h-8 w-auto" /> : <span className="whitespace-nowrap text-base font-extrabold tracking-tight text-muted">{c.name}</span>}
              </span>
            ))}
          </div>
        </div>
        <button aria-label="Next" className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card text-muted transition hover:border-primary hover:text-primary sm:grid"><ChevronRight className="h-5 w-5" /></button>
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
        <span className="flex items-center gap-1 text-2xs font-bold text-primary"><span className="grid h-4 w-4 place-items-center rounded bg-gradient-to-br from-primary to-secondary text-white text-[8px]">O</span>ORBIT</span>
        <div className="mx-2 h-5 flex-1 rounded bg-background" />
        <span className="h-5 w-5 rounded-full bg-gradient-to-br from-primary to-secondary" />
      </div>
      <div className="grid grid-cols-12">
        <div className="col-span-3 hidden flex-col gap-1 bg-surface p-2 sm:flex">
          {["Dashboard", "Sales", "Purchase", "Inventory", "Finance", "CRM", "HR", "Reports", "AI"].map((s, i) => <div key={s} className={cn("truncate rounded px-1.5 py-1 text-[8px] font-medium", i === 0 ? "bg-primary text-white" : "text-muted")}>{s}</div>)}
        </div>
        <div className="col-span-12 space-y-2 p-3 sm:col-span-9">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[["Total Revenue", "₹12,45,000", "violet"], ["Total Orders", "8,753", "blue"], ["Total Profit", "₹2,45,000", "emerald"], ["Active Customers", "24,753", "orange"]].map(([l, v, t]) => (
              <div key={l} className="rounded-lg border border-border bg-surface p-2"><div className="text-[8px] text-subtle">{l}</div><div className="mt-0.5 text-xs font-bold text-foreground">{v}</div><div className={cn("mt-0.5 inline-block rounded px-1 text-[7px] font-semibold", tone(t as string))}>▲ last month</div></div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 rounded-lg border border-border bg-surface p-2">
              <div className="mb-1 text-[8px] font-semibold text-foreground">Sales Overview</div>
              <svg viewBox="0 0 200 60" className="h-16 w-full"><polyline fill="none" stroke="var(--color-primary)" strokeWidth="2" points="0,50 25,40 50,45 75,25 100,32 125,15 150,22 175,8 200,14" /><polygon fill="var(--color-primary)" opacity="0.08" points="0,50 25,40 50,45 75,25 100,32 125,15 150,22 175,8 200,14 200,60 0,60" /></svg>
            </div>
            <div className="rounded-lg border border-border bg-surface p-2">
              <div className="mb-1 text-[8px] font-semibold text-foreground">Top Categories</div>
              <div className="mx-auto h-14 w-14 rounded-full" style={{ background: "conic-gradient(var(--color-primary) 0 40%, var(--color-secondary) 40% 65%, #22c55e 65% 85%, #f59e0b 85% 100%)" }}><div className="grid h-full w-full place-items-center"><div className="h-7 w-7 rounded-full bg-surface" /></div></div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-surface p-2"><div className="text-[8px] text-subtle">Inventory Summary</div><div className="mt-1 text-sm font-bold text-foreground">12,540</div><div className="text-[7px] text-muted">Total Items</div></div>
            <div className="rounded-lg border border-border bg-surface p-2 text-center"><div className="text-[8px] text-subtle">Health Score</div><div className="mt-0.5 text-lg font-bold text-success">89</div><div className="text-[7px] text-success">Excellent</div></div>
            <div className="rounded-lg border border-border bg-surface p-2"><div className="text-[8px] text-subtle">Recent Orders</div>{[1, 2].map((k) => <div key={k} className="mt-1 flex justify-between text-[7px] text-muted"><span>ORD-0012{k}</span><span className="font-semibold text-foreground">₹2,450</span></div>)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="overflow-hidden rounded-[1.6rem] border-4 border-slate-800 bg-card shadow-2xl">
      <div className="bg-gradient-to-br from-primary to-secondary p-3 text-white">
        <div className="text-[9px] font-semibold">Hello, John 👋</div>
        <div className="text-[7px] text-white/80">Welcome to {DEFAULT_PRODUCT_NAME}</div>
        <div className="mt-2 rounded-lg bg-white/15 p-2 backdrop-blur"><div className="text-[7px] text-white/80">Loyalty Points</div><div className="text-sm font-bold">2,450</div></div>
      </div>
      <div className="space-y-1.5 p-2.5">
        <div className="text-[8px] font-semibold text-foreground">Recent Orders</div>
        {[["ORD-00125", "₹2,450"], ["ORD-00124", "₹1,850"], ["ORD-00123", "₹3,240"]].map(([o, v]) => (
          <div key={o} className="flex items-center justify-between rounded-lg border border-border bg-surface px-2 py-1.5"><span className="text-[7px] text-muted">{o}</span><span className="text-[8px] font-bold text-foreground">{v}</span></div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------- retail showcase -- */
function RetailShowcase({ config }: { config: WebsiteConfig }) {
  const s = config.retailShowcase;
  return (
    <section id="retail-showcase" className="relative overflow-hidden border-y border-border bg-gradient-to-b from-primary-subtle/25 via-surface to-surface">
      <BgLayers bg={config.backgrounds?.retailShowcase} />
      {/* grid lines pattern (masked to the centre) */}
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(124,58,237,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.08) 1px, transparent 1px)", backgroundSize: "42px 42px", WebkitMaskImage: "radial-gradient(ellipse 90% 78% at 50% 42%, #000 28%, transparent 76%)", maskImage: "radial-gradient(ellipse 90% 78% at 50% 42%, #000 28%, transparent 76%)" }} />
      {/* central soft spotlight */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(168,85,247,0.10), transparent)" }} />
      {/* stronger animated aurora glows */}
      <div className="site-aurora pointer-events-none absolute -left-28 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="site-aurora pointer-events-none absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" style={{ animationDelay: "5s" }} />
      <div className="site-aurora pointer-events-none absolute left-1/3 -bottom-24 h-80 w-80 rounded-full bg-accent/15 blur-3xl" style={{ animationDelay: "9s" }} />
      {/* floating retail icons drifting behind the content — colourful */}
      {[
        { icon: "ShoppingCart", top: "13%", left: "5%", cls: "h-16 w-16", d: "0s", c: "rgba(124,58,237,0.16)" },
        { icon: "ReceiptText", top: "70%", left: "8%", cls: "h-14 w-14", d: "2s", c: "rgba(59,130,246,0.16)" },
        { icon: "Boxes", top: "20%", left: "90%", cls: "h-20 w-20", d: "1s", c: "rgba(16,185,129,0.15)" },
        { icon: "CreditCard", top: "80%", left: "84%", cls: "h-16 w-16", d: "3s", c: "rgba(245,158,11,0.17)" },
        { icon: "Store", top: "6%", left: "58%", cls: "h-12 w-12", d: "2.5s", c: "rgba(236,72,153,0.16)" },
        { icon: "BarChart3", top: "90%", left: "46%", cls: "h-14 w-14", d: "1.5s", c: "rgba(6,182,212,0.16)" },
        { icon: "Gift", top: "42%", left: "3%", cls: "h-12 w-12", d: "3.5s", c: "rgba(217,70,239,0.16)" },
        { icon: "Truck", top: "50%", left: "95%", cls: "h-14 w-14", d: "0.8s", c: "rgba(99,102,241,0.16)" },
        { icon: "Ticket", top: "30%", left: "28%", cls: "h-10 w-10", d: "2.2s", c: "rgba(239,68,68,0.15)" },
        { icon: "Percent", top: "62%", left: "70%", cls: "h-10 w-10", d: "1.2s", c: "rgba(34,197,94,0.16)" },
        { icon: "Smartphone", top: "9%", left: "38%", cls: "h-10 w-10", d: "4s", c: "rgba(139,92,246,0.15)" },
        { icon: "Landmark", top: "86%", left: "22%", cls: "h-12 w-12", d: "2.8s", c: "rgba(59,130,246,0.14)" },
      ].map((f, i) => (
        <span key={i} className="site-float pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ top: f.top, left: f.left, animationDelay: f.d, color: f.c }}><SiteIcon name={f.icon} className={f.cls} /></span>
      ))}
      {/* top + bottom waves */}
      <svg className="pointer-events-none absolute inset-x-0 top-0 h-14 w-full" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden><path d="M0,40 C240,84 480,0 720,30 C960,60 1200,8 1440,40 L1440,0 L0,0 Z" fill="var(--color-primary)" opacity="0.06" /></svg>
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full rotate-180" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden><path d="M0,40 C240,84 480,0 720,30 C960,60 1200,8 1440,40 L1440,0 L0,0 Z" fill="var(--color-secondary)" opacity="0.06" /></svg>

      <div className="relative mx-auto max-w-[1560px] px-6 py-20 lg:px-10 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          {/* LEFT — headline + features */}
          <Reveal className="self-start lg:sticky lg:top-24">
            <span className="inline-flex items-center rounded-lg bg-primary-subtle px-3.5 py-1.5 text-2xs font-bold uppercase tracking-wider text-primary">{s.badge}</span>
            <h2 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground md:text-[2.9rem]">{s.titleLead} <span className="block bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{s.titleHighlight}</span></h2>
            <p className="mt-4 max-w-md text-md leading-relaxed text-muted">{s.subtitle}</p>
            <div className="mt-8 space-y-2">
              {s.features.map((f, i) => (
                <Reveal key={f.title} delay={(i % 5) * 60}>
                  <div className="flex items-start gap-4 rounded-2xl border border-transparent p-3 transition hover:border-border hover:bg-card hover:shadow-md">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-md shadow-primary/20"><SiteIcon name={f.icon} className="h-6 w-6" /></span>
                    <div><div className="text-base font-bold text-foreground">{f.title}</div><div className="mt-0.5 text-sm leading-relaxed text-muted">{f.text}</div></div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          {/* RIGHT — KPI + live dashboard bento */}
          <Reveal delay={120} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {s.kpis.map((k) => (
                <div key={k.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center justify-between"><span className={cn("grid h-9 w-9 place-items-center rounded-xl", tone(k.tone))}><SiteIcon name={k.icon} className="h-5 w-5" /></span><span className="inline-flex items-center gap-0.5 text-2xs font-bold text-success"><SiteIcon name="TrendingUp" className="h-3 w-3" /> {k.delta}</span></div>
                  <div className="mt-3 text-xl font-bold tracking-tight text-foreground">{k.value}</div>
                  <div className="text-2xs text-muted">{k.label}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2"><ShowInventory /><ShowLowStock /></div>
            <ShowFinance />
            <div className="grid gap-4 sm:grid-cols-2"><ShowGst /><ShowNotification /></div>
          </Reveal>
        </div>

        {/* BOTTOM — trust badges + complete retail flow */}
        <div className="mt-14 grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,2.28fr)]">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-2">
              {s.badges.map((b) => (
                <div key={b.label} className="flex items-center gap-2.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary"><SiteIcon name={b.icon} className="h-5 w-5" /></span>
                  <span className="text-xs font-semibold leading-tight text-foreground">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground"><span className="h-4 w-1 rounded-full bg-gradient-to-b from-primary to-secondary" /> {s.flowTitle}</div>
            <div className="flex items-start justify-between gap-1 overflow-x-auto pb-1">
              {s.flow.map((f, i) => (
                <div key={f.title} className="flex items-start gap-1">
                  <div className="flex min-w-[100px] flex-col items-center gap-2 text-center">
                    <span className="flow-step grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-white shadow-md shadow-primary/25" style={{ animationDelay: `${i}s` }}><SiteIcon name={f.icon} className="h-6 w-6" /></span>
                    <div className="text-xs font-bold leading-tight text-foreground">{f.title}</div>
                    <div className="text-[10px] leading-tight text-muted">{f.sub}</div>
                  </div>
                  {i < s.flow.length - 1 && <ArrowRight className="flow-arrow mt-4 h-4 w-4 shrink-0" style={{ animationDelay: `${i + 0.4}s` }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
const ShowCard = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn("rounded-2xl border border-border bg-card p-3.5 shadow-sm", className)}>{children}</div>;
const ShowHead = ({ icon, title, action, tone: t }: { icon: string; title: string; action: string; tone?: string }) => (
  <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-xs font-bold text-foreground"><SiteIcon name={icon} className={cn("h-4 w-4", t ?? "text-primary")} /> {title}</span><span className="text-[10px] font-semibold text-primary">{action}</span></div>
);
function ShowInventory() {
  return (
    <ShowCard>
      <ShowHead icon="Boxes" title="Inventory Overview" action="View All" />
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 rounded-full" style={{ background: "conic-gradient(#22c55e 0 80.4%, #f59e0b 80.4% 90%, #ef4444 90% 93.6%, #3b82f6 93.6% 100%)" }}><div className="grid h-full w-full place-items-center"><div className="h-9 w-9 rounded-full bg-card" /></div></div>
        <div className="flex-1 space-y-0.5 text-[10px]">
          {[["In Stock", "1,005", "#22c55e"], ["Low Stock", "120", "#f59e0b"], ["Out of Stock", "45", "#ef4444"], ["Inactive", "80", "#3b82f6"]].map(([l, v, c]) => (
            <div key={l} className="flex items-center justify-between"><span className="flex items-center gap-1 text-muted"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />{l}</span><span className="font-bold text-foreground">{v}</span></div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2 text-[10px] text-muted">Total Products <span className="text-sm font-bold text-foreground">1,250</span></div>
    </ShowCard>
  );
}
function ShowLowStock() {
  return (
    <ShowCard>
      <ShowHead icon="AlertTriangle" title="Low Stock Alert" action="View All" tone="text-danger" />
      <div className="space-y-1.5">
        {[["Basmati Rice 5kg", "5"], ["Sunflower Oil 1L", "8"], ["Wheat Flour 10kg", "3"]].map(([n, st]) => (
          <div key={n} className="flex items-center justify-between rounded-lg border border-border bg-surface px-2 py-1.5">
            <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded bg-primary-subtle text-primary"><SiteIcon name="Boxes" className="h-3.5 w-3.5" /></span><div><div className="text-[11px] font-semibold text-foreground">{n}</div><div className="text-[9px] text-muted">Stock Left: {st}</div></div></div>
            <span className="rounded-md border border-danger/40 px-2 py-0.5 text-[9px] font-bold text-danger">Reorder</span>
          </div>
        ))}
      </div>
    </ShowCard>
  );
}
function ShowFinance() {
  return (
    <ShowCard>
      <ShowHead icon="Landmark" title="Finance Overview" action="View Reports" tone="text-emerald-600" />
      <div className="grid grid-cols-3 gap-x-2 gap-y-2 text-[10px]">
        {[["Total Sales", "₹45,680.00"], ["Total Expenses", "₹37,360.00"], ["Net Profit", "₹8,320.00"], ["Total Receipts", "₹48,100.00"], ["Total Payments", "₹40,210.00"], ["Pending Amount", "₹2,340.00"]].map(([l, v]) => (
          <div key={l}><div className="text-muted">{l}</div><div className="font-bold text-foreground">{v}</div></div>
        ))}
      </div>
    </ShowCard>
  );
}
function ShowGst() {
  return (
    <ShowCard>
      <ShowHead icon="ReceiptText" title="GST Summary (Today)" action="View Details" />
      <div className="grid grid-cols-4 gap-2 text-[10px]">
        {[["CGST", "₹2,143.73"], ["SGST", "₹2,143.73"], ["IGST", "₹0.00"], ["Total GST", "₹4,287.46"]].map(([l, v]) => (<div key={l}><div className="text-muted">{l}</div><div className="font-bold text-foreground">{v}</div></div>))}
      </div>
    </ShowCard>
  );
}
function ShowNotification() {
  return (
    <ShowCard>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground"><SiteIcon name="MessageSquare" className="h-4 w-4 text-emerald-600" /> Customer Notification</div>
      <div className="rounded-xl bg-surface p-2.5 text-[10px] leading-relaxed text-muted">
        <div className="font-semibold text-foreground">Hi Priya, 👋</div>
        Thank you for shopping with us! Your bill amount ₹441.00. You earned <b className="text-foreground">25 Loyalty Points</b>. Get 10% OFF on your next purchase — use code <b className="text-primary">THANKYOU10</b>.
        <div className="mt-1 text-right text-[8px] text-subtle">11:30 AM</div>
      </div>
    </ShowCard>
  );
}

/* ------------------------------------------------------ everything strip -- */
function EverythingStrip({ config }: { config: WebsiteConfig }) {
  return (
    <Wrap id="platform" bg={config.backgrounds?.everything}>
      <Heading title={config.everything.title} subtitle={config.everything.subtitle} />
      <div className="mt-12 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10">
        {config.everything.items.map((m, i) => (
          <Reveal key={m.label} delay={(i % 10) * 30}>
            <Link href="/modules" className="group relative flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card px-2 py-6 text-center shadow-sm transition hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-lg">
              {m.badge && <span className="absolute right-2 top-2 rounded-full bg-success px-1.5 py-0.5 text-[8px] font-bold text-white">{m.badge}</span>}
              {m.imageUrl
                ? <img src={m.imageUrl} alt={m.label} className="h-9 w-9 object-contain transition group-hover:scale-110" />
                : <SiteIcon name={m.icon} className={cn("h-9 w-9 transition group-hover:scale-110", toneText(m.tone))} />}
              <span className="text-2xs font-semibold leading-tight text-foreground">{m.label}</span>
            </Link>
          </Reveal>
        ))}
        <Reveal delay={300}>
          <Link href="/modules" className="group flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary-subtle/30 px-2 py-6 text-center transition hover:-translate-y-1.5 hover:bg-primary-subtle">
            <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-dashed border-primary/50 text-primary transition group-hover:scale-110"><MoreHorizontal className="h-5 w-5" /></span>
            <span className="inline-flex items-center gap-1 text-2xs font-bold text-primary">View All Modules <ArrowRight className="h-3 w-3" /></span>
          </Link>
        </Reveal>
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- real-time insights -- */
// Capability cards (icon + label) stacked directly ABOVE and BELOW the device image,
// aligned to the image column — 4 on top, 4 below.
const RT_TOP_CAPS: { icon: string; label: string; g: string }[] = [
  { icon: "Gauge", label: "Real-Time Monitoring", g: "from-violet-500 to-purple-600" },
  { icon: "BarChart3", label: "Business Intelligence", g: "from-amber-400 to-orange-500" },
  { icon: "TrendingUp", label: "Predictive Analytics", g: "from-sky-400 to-blue-600" },
  { icon: "LayoutDashboard", label: "Executive Dashboards", g: "from-fuchsia-500 to-purple-600" },
];
const RT_BOTTOM_CAPS: { icon: string; label: string; g: string }[] = [
  { icon: "Bot", label: "AI Recommendations", g: "from-emerald-400 to-green-600" },
  { icon: "Warehouse", label: "Data Warehouse", g: "from-indigo-500 to-violet-600" },
  { icon: "ScanLine", label: "Anomaly Detection", g: "from-rose-400 to-pink-600" },
  { icon: "Coins", label: "Profitability Analysis", g: "from-orange-400 to-amber-600" },
];

function RtCapabilityRow({ items, className }: { items: { icon: string; label: string; g: string }[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {items.map((c, i) => (
        <Reveal key={c.label} delay={i * 60}>
          <div className="group flex h-full items-center gap-2.5 rounded-2xl border border-border bg-card/80 px-3 py-2.5 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md transition group-hover:scale-110", c.g)}><SiteIcon name={c.icon} className="h-5 w-5" /></span>
            <span className="text-[11px] font-bold leading-tight text-foreground">{c.label}</span>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

function RealTimeSection({ config }: { config: WebsiteConfig }) {
  const r = config.realtime;
  // Split the two-sentence title: first sentence dark, remainder gradient.
  const segs = r.title.split(/\.\s+/).filter(Boolean);
  const lead = segs.length > 1 ? `${segs[0]}.` : r.title;
  const highlight = segs.length > 1 ? segs.slice(1).join(" ") : "";
  return (
    <Wrap id="insights" tint bg={config.backgrounds?.realtime} decor={<RtBackground />}>
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-12">
        {/* LEFT — message card */}
        <Reveal className="rounded-[1.75rem] border border-border bg-card/95 p-6 shadow-2xl backdrop-blur md:p-8">
          <span className="inline-flex items-center rounded-full bg-primary-subtle px-4 py-1.5 text-2xs font-bold uppercase tracking-[0.14em] text-primary">Smarter Retail. Stronger Business.</span>
          <h2 className="mt-4 text-3xl font-extrabold leading-[1.05] tracking-tight text-foreground md:text-[2.6rem]">
            {lead}
            {highlight && <><br /><span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{highlight}</span></>}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">{r.subtitle}</p>

          {/* QR flourish — echoes the "scan to explore" motif */}
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-md"><SiteIcon name="QrCode" className="h-9 w-9" /></span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Scan to explore dashboards</p>
              <p className="text-2xs leading-snug text-muted">AI-powered dashboards give you a 360° view of your business performance.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <CtaLink cta={r.cta} big />
            <Link href="/contact?type=demo" className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-card px-6 text-md font-semibold text-foreground transition hover:border-primary hover:text-primary"><SiteIcon name="CalendarDays" className="h-5 w-5" /> Book Demo</Link>
          </div>

          <div className="mt-6 grid gap-2.5">
            {r.points.slice(0, 4).map((p) => (
              <div key={p} className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-white"><Check className="h-3 w-3" /></span>{p}
              </div>
            ))}
          </div>
        </Reveal>

        {/* RIGHT — cards above + device image + cards below, all aligned to the image width */}
        <div className="min-w-0 space-y-4">
          <RtCapabilityRow items={RT_TOP_CAPS} />
          <Reveal delay={120}>
            <div className="relative">
              <div aria-hidden className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-primary/15 via-secondary/10 to-accent/15 blur-2xl" />
              {r.imageUrl
                ? <img src={r.imageUrl} alt="Dashboard preview" className="relative w-full rounded-2xl border border-border shadow-2xl ring-1 ring-black/5" />
                : <div className="relative"><RtDashboard /></div>}
            </div>
          </Reveal>
          <RtCapabilityRow items={RT_BOTTOM_CAPS} />
        </div>
      </div>
    </Wrap>
  );
}

/** Animated, self-contained background for the insights section (clips its own
 *  blur so the section's sticky column keeps working — overflow stays on this layer). */
function RtBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* soft base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary-subtle/40 via-surface to-primary-subtle/25" />
      {/* faint dotted grid, faded toward the centre so content stays clean */}
      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(124,58,237,0.14) 1px, transparent 1px)", backgroundSize: "26px 26px", WebkitMaskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 30%, #000 82%)", maskImage: "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 30%, #000 82%)" }} />
      {/* breathing aurora glows */}
      <div className="site-aurora absolute -left-24 -top-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="site-aurora absolute -right-16 top-1/3 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" style={{ animationDelay: "5s" }} />
      <div className="site-aurora absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-accent/15 blur-3xl" style={{ animationDelay: "9s" }} />
      {/* colourful analytics icons drifting behind the content */}
      {[
        { icon: "BarChart3", top: "12%", left: "4%", cls: "h-16 w-16", d: "0s", c: "rgba(124,58,237,0.16)" },
        { icon: "TrendingUp", top: "76%", left: "7%", cls: "h-14 w-14", d: "2s", c: "rgba(16,185,129,0.16)" },
        { icon: "FileBarChart", top: "18%", left: "93%", cls: "h-20 w-20", d: "1s", c: "rgba(59,130,246,0.14)" },
        { icon: "Gauge", top: "84%", left: "90%", cls: "h-16 w-16", d: "3s", c: "rgba(245,158,11,0.17)" },
        { icon: "Sparkles", top: "6%", left: "52%", cls: "h-12 w-12", d: "2.5s", c: "rgba(217,70,239,0.16)" },
        { icon: "HeartPulse", top: "92%", left: "40%", cls: "h-14 w-14", d: "1.5s", c: "rgba(6,182,212,0.16)" },
        { icon: "Brain", top: "44%", left: "2%", cls: "h-12 w-12", d: "3.5s", c: "rgba(139,92,246,0.15)" },
        { icon: "Wallet", top: "40%", left: "96%", cls: "h-12 w-12", d: "0.8s", c: "rgba(99,102,241,0.15)" },
      ].map((f, i) => (
        <span key={i} className="site-float absolute -translate-x-1/2 -translate-y-1/2" style={{ top: f.top, left: f.left, animationDelay: f.d, color: f.c }}><SiteIcon name={f.icon} className={f.cls} /></span>
      ))}
      {/* top + bottom waves */}
      <svg className="absolute inset-x-0 top-0 h-14 w-full" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,40 C240,84 480,0 720,30 C960,60 1200,8 1440,40 L1440,0 L0,0 Z" fill="var(--color-primary)" opacity="0.06" /></svg>
      <svg className="absolute inset-x-0 bottom-0 h-14 w-full rotate-180" viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0,40 C240,84 480,0 720,30 C960,60 1200,8 1440,40 L1440,0 L0,0 Z" fill="var(--color-secondary)" opacity="0.06" /></svg>
    </div>
  );
}

/** A clear, legible representation of the live business dashboard. */
function RtDashboard() {
  const legend = (rows: [string, string, string][]) => (
    <div className="flex-1 space-y-0.5 text-[9px]">
      {rows.map(([l, v, c]) => (
        <div key={l} className="flex items-center justify-between"><span className="flex items-center gap-1 text-muted"><span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />{l}</span><span className="font-bold text-foreground">{v}</span></div>
      ))}
    </div>
  );
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-2xl">
      {/* header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground"><span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white"><SiteIcon name="LayoutDashboard" className="h-4 w-4" /></span>Dashboard Overview</div>
        <span className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-medium text-muted">Today, 30 May 2025</span>
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[["Total Sales", "₹4,58,250", "18.6%", "BarChart3", "violet"], ["Total Orders", "642", "14.3%", "ShoppingCart", "blue"], ["Customers", "1,245", "11.2%", "Users", "emerald"], ["Net Profit", "₹86,250", "16.8%", "TrendingUp", "orange"]].map(([l, v, d, ic, tn]) => (
          <div key={l} className="rounded-xl border border-border bg-surface p-2.5">
            <div className="flex items-center justify-between"><span className="text-[10px] text-subtle">{l}</span><span className={cn("grid h-6 w-6 place-items-center rounded-md", tone(tn))}><SiteIcon name={ic} className="h-3 w-3" /></span></div>
            <div className="mt-1 text-base font-extrabold text-foreground">{v}</div>
            <div className="text-[9px] font-bold text-success">▲ {d}</div>
          </div>
        ))}
      </div>
      {/* sales trend + category */}
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold text-foreground">Sales Trend</span><span className="flex gap-0.5 text-[8px] font-semibold">{["Day", "Week", "Month", "Year"].map((t, i) => <span key={t} className={cn("rounded px-1.5 py-0.5", i === 2 ? "bg-primary text-white" : "text-muted")}>{t}</span>)}</span></div>
          <svg viewBox="0 0 220 70" className="h-20 w-full">
            <polygon fill="var(--color-primary)" opacity="0.08" points="0,55 24,45 49,50 73,30 98,38 122,22 147,30 171,14 196,22 220,10 220,70 0,70" />
            <polyline fill="none" stroke="var(--color-primary)" strokeWidth="2.2" points="0,55 24,45 49,50 73,30 98,38 122,22 147,30 171,14 196,22 220,10" />
            {[[24, 45], [73, 30], [122, 22], [171, 14], [220, 10]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill="#fff" stroke="var(--color-primary)" strokeWidth="1.5" />)}
          </svg>
          <div className="flex justify-between text-[8px] text-subtle"><span>01 May</span><span>15 May</span><span>29 May</span></div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="mb-1.5 text-[11px] font-bold text-foreground">Category Sales</div>
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 rounded-full" style={{ background: "conic-gradient(#7c3aed 0 45%, #3b82f6 45% 65%, #f59e0b 65% 80%, #22c55e 80% 90%, #a855f7 90% 100%)" }}><div className="absolute inset-[26%] grid place-items-center rounded-full bg-surface"><span className="text-[7px] font-bold leading-none text-foreground">₹4.5L</span></div></div>
            {legend([["Groceries", "45%", "#7c3aed"], ["Beverages", "20%", "#3b82f6"], ["Personal Care", "15%", "#f59e0b"], ["Home Care", "10%", "#22c55e"], ["Others", "10%", "#a855f7"]])}
          </div>
        </div>
      </div>
      {/* P&L + inventory */}
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold text-foreground">Profit &amp; Loss</span><span className="flex items-center gap-2 text-[8px] text-muted"><span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Profit</span><span className="flex items-center gap-0.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" />Expense</span></span></div>
          <div className="flex h-16 items-end justify-between gap-1">
            {[[14, 8], [10, 12], [16, 7], [9, 10], [18, 9], [12, 13], [15, 8], [20, 10]].map(([p, e], i) => (
              <div key={i} className="flex flex-1 items-end justify-center gap-0.5">
                <span className="w-1.5 rounded-t bg-emerald-500" style={{ height: `${p * 3}px` }} />
                <span className="w-1.5 rounded-t bg-rose-400" style={{ height: `${e * 3}px` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="mb-1.5 text-[11px] font-bold text-foreground">Inventory Health</div>
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 rounded-full" style={{ background: "conic-gradient(#22c55e 0 72%, #f59e0b 72% 90%, #ef4444 90% 97%, #a855f7 97% 100%)" }}><div className="absolute inset-[26%] grid place-items-center rounded-full bg-surface"><span className="text-[9px] font-extrabold text-success">72%</span></div></div>
            {legend([["In Stock", "1,250", "#22c55e"], ["Low Stock", "320", "#f59e0b"], ["Out of Stock", "120", "#ef4444"], ["Inactive", "50", "#a855f7"]])}
          </div>
        </div>
      </div>
      {/* AI insight + GST */}
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl bg-gradient-to-br from-primary to-secondary p-3 text-white shadow-lg shadow-primary/25">
          <div className="flex items-center gap-1.5 text-[11px] font-bold"><SiteIcon name="Sparkles" className="h-3.5 w-3.5" /> AI Insight</div>
          <div className="mt-1.5 text-[9px] text-white/75">Top Selling Category</div>
          <div className="text-base font-extrabold leading-tight">Groceries</div>
          <div className="mt-1 text-[9px] text-white/75">Recommendation</div>
          <div className="text-[11px] font-bold">Increase stock by 15%</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <div className="mb-1.5 text-[11px] font-bold text-foreground">GST Summary (Today)</div>
          <div className="grid grid-cols-2 gap-1.5 text-[9px]">
            {[["CGST", "₹12,450"], ["SGST", "₹12,450"], ["IGST", "₹24,780"], ["Total Tax", "₹49,680", "hl"]].map(([l, v, hl]) => (
              <div key={l} className={cn("rounded-lg border p-1.5", hl ? "border-primary/40 bg-primary-subtle" : "border-border")}><div className="text-muted">{l}</div><div className={cn("font-bold", hl ? "text-primary" : "text-foreground")}>{v}</div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ ERP + Industry two-column -- */
function ErpIndustries({ config }: { config: WebsiteConfig }) {
  const e = config.erpSolution;
  return (
    <Wrap id="industries" tint bg={config.backgrounds?.erpIndustries}>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Complete ERP */}
        <Reveal className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{e.title}</h2>
          <p className="mt-2 text-sm text-muted">{e.subtitle}</p>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {e.checklist.map((c) => <div key={c} className="flex items-center gap-2 text-sm text-foreground"><span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-success/15 text-success"><Check className="h-3 w-3" /></span>{c}</div>)}
          </div>
          <OrbitDiagram />
          <div className="mt-2"><CtaLink cta={e.cta} /></div>
        </Reveal>
        {/* Industry Solutions */}
        <Reveal delay={120} className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{config.industries.title}</h2>
          <p className="mt-2 text-sm text-muted">{config.industries.subtitle}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {config.industries.items.slice(0, 12).map((it) => (
              <div key={it.name} className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-center transition hover:-translate-y-1 hover:border-primary hover:shadow-md">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-subtle text-primary transition group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-secondary group-hover:text-white"><SiteIcon name={it.icon} className="h-5 w-5" /></span>
                <span className="text-[11px] font-semibold leading-tight text-foreground">{it.name}</span>
              </div>
            ))}
          </div>
          <div className="mt-6"><Link href="/#industries" className="inline-flex h-11 items-center gap-2 rounded-xl border border-primary px-5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">View All Industries <ArrowRight className="h-4 w-4" /></Link></div>
        </Reveal>
      </div>
    </Wrap>
  );
}

function OrbitDiagram() {
  const ring = [
    { icon: "Users", label: "CRM" }, { icon: "Landmark", label: "Finance" }, { icon: "UserCog", label: "HR & Payroll" },
    { icon: "Factory", label: "Manufacturing" }, { icon: "Monitor", label: "POS" }, { icon: "Boxes", label: "Inventory" },
  ];
  return (
    <div className="relative mx-auto my-6 hidden h-64 w-64 sm:block">
      <div className="absolute inset-4 rounded-full border-2 border-dashed border-primary/25" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/30"><SiteIcon name="Boxes" className="h-8 w-8" /></div>
        <div className="mt-1 text-[9px] font-bold text-primary">ONE ERP</div>
      </div>
      {ring.map((r, i) => {
        const a = (i / ring.length) * 2 * Math.PI - Math.PI / 2;
        const x = 50 + 42 * Math.cos(a), y = 50 + 42 * Math.sin(a);
        return (
          <div key={r.label} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${x}%`, top: `${y}%` }}>
            <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-primary shadow-md"><SiteIcon name={r.icon} className="h-5 w-5" /></span>
            <span className="mt-0.5 whitespace-nowrap text-[8px] font-semibold text-muted">{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------- customer app -- */
const CA_TILE_TONES = ["violet", "blue", "emerald", "orange", "rose"];
const CA_ITEM_GRAD = ["from-violet-500 to-purple-600", "from-blue-500 to-indigo-600", "from-emerald-500 to-green-600", "from-orange-500 to-amber-500", "from-rose-500 to-pink-600", "from-sky-500 to-blue-600", "from-fuchsia-500 to-purple-600", "from-cyan-500 to-teal-600"];
function CustomerAppSection({ config }: { config: WebsiteConfig }) {
  const c = config.customerApp;
  return (
    <Wrap id="customer-app" bg={config.backgrounds?.customerApp}>
      {/* left text + features | centre animated phone | right floating cards */}
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.72fr)_minmax(0,1fr)] lg:gap-6">
        {/* LEFT — dark, always-readable text on a soft light backing */}
        <Reveal className="relative isolate">
          <div aria-hidden className="pointer-events-none absolute -inset-x-6 -inset-y-8 z-0 rounded-[2.5rem] bg-gradient-to-r from-background via-background/80 to-transparent lg:from-background/95 lg:via-background/65" />
          <div className="relative z-10" style={textVars("dark")}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-subtle px-3 py-1 text-2xs font-bold uppercase tracking-wide text-primary shadow-sm"><SiteIcon name="Smartphone" className="h-3.5 w-3.5" /> Customer Mobile App</span>
            <h2 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground md:text-5xl">{c.title.includes("—") ? "Scan. Discover." : c.title}<br /><span className="ca-shimmer bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_auto] bg-clip-text text-transparent">{c.highlight}</span></h2>
            <p className="mt-4 max-w-sm text-md leading-relaxed text-muted">{c.subtitle.includes("Empower your customers") ? "Scan your bill QR code to get complete purchase details, earn loyalty points and unlock exciting rewards." : c.subtitle}</p>
            <div className="mt-7 space-y-3.5">
              {c.scanFeatures.map((f, i) => (
                <div key={f.title} className="group flex items-start gap-3">
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-sm transition duration-300 group-hover:scale-110 group-hover:shadow-md", tone(CA_TILE_TONES[i % CA_TILE_TONES.length]))}><SiteIcon name={f.icon} className="h-5 w-5" /></span>
                  <div><div className="text-sm font-bold text-foreground">{f.title}</div><div className="text-2xs text-muted">{f.text}</div></div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <CtaLink cta={c.cta} />
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card/90 p-2 shadow-sm backdrop-blur">
                <QrGraphic className="h-11 w-11" />
                <div className="pr-1 text-2xs font-bold leading-tight text-foreground">Scan to<br />download app</div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* CENTRE — animated phone mock (the "scan" hero of the section) */}
        <Reveal delay={100} className="flex justify-center"><CaPhone /></Reveal>

        {/* RIGHT — floating live cards on a soft brand glow (dark text kept for the white cards) */}
        <Reveal delay={180} className="relative lg:justify-self-end lg:max-w-sm">
          <div aria-hidden className="pointer-events-none absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/15 to-secondary/15 blur-2xl" />
          <div className="space-y-3" style={textVars("dark")}>
            <CaPurchaseSummary /><CaLoyalty /><CaOffers /><CaSpend />
          </div>
        </Reveal>
      </div>

      {/* BOTTOM — existing customer-app features as colourful, liftable tiles */}
      <div className="mt-10 rounded-3xl border border-border bg-card/95 p-5 shadow-lg backdrop-blur-sm" style={textVars("dark")}>
        <div className="mb-5 text-center text-sm font-bold text-foreground">Your complete shopping companion — all in one app</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-8">
          {c.items.map((it, i) => (
            <div key={it.title} className="group flex flex-col items-center gap-2 text-center">
              <span className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-xl", CA_ITEM_GRAD[i % CA_ITEM_GRAD.length])}><SiteIcon name={it.icon} className="h-5 w-5" /></span>
              <div className="text-2xs font-bold leading-tight text-foreground">{it.title}</div>
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}
/** Pseudo-QR block (deterministic pattern) reused by the phone + download chip. */
function QrGraphic({ className }: { className?: string }) {
  const cells = "111111100011010101110001011101011101011101010011010111110010110101010101011010001100011011101011010011101011000101110101011010101011";
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-white p-[6%]", className)}>
      <div className="grid h-full w-full grid-cols-[repeat(11,1fr)] gap-[6%]">
        {Array.from({ length: 121 }).map((_, i) => <span key={i} className={cn("rounded-[1px]", cells[i % cells.length] === "1" ? "bg-slate-900" : "bg-transparent")} />)}
      </div>
    </div>
  );
}
/** Animated phone showing a live bill-QR scan → summary → points earned. */
function CaPhone() {
  return (
    <div className="site-float relative mx-auto w-[240px]">
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-primary/30 to-secondary/30 blur-2xl" />
      <div className="overflow-hidden rounded-[2.3rem] border-[6px] border-slate-900 bg-card shadow-2xl">
        {/* scanner header */}
        <div className="relative bg-gradient-to-br from-primary to-secondary px-4 pb-6 pt-3 text-white">
          <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-white/40" />
          <div className="text-[11px] font-bold">Scan your bill QR</div>
          <div className="text-[9px] text-white/80">Point your camera at the receipt</div>
          <div className="relative mx-auto mt-3 h-32 w-32 rounded-2xl bg-white p-2.5 shadow-inner">
            <QrGraphic className="h-full w-full !p-0" />
            {/* moving scan line */}
            <div className="ca-scan absolute inset-x-2 h-7 rounded bg-gradient-to-b from-transparent via-primary/45 to-transparent" />
            {/* finder corners */}
            {[["left-1 top-1 border-l-2 border-t-2"], ["right-1 top-1 border-r-2 border-t-2"], ["left-1 bottom-1 border-b-2 border-l-2"], ["right-1 bottom-1 border-b-2 border-r-2"]].map(([p], k) => <span key={k} className={cn("absolute h-3.5 w-3.5 rounded-sm border-primary", p)} />)}
          </div>
        </div>
        {/* result */}
        <div className="space-y-2 p-3">
          <div className="rounded-xl border border-border bg-surface p-2">
            {[["Bill No", "OM1245078"], ["Total", "₹523.00"], ["Items", "5"]].map(([l, v]) => <div key={l} className="flex justify-between text-[9px]"><span className="text-muted">{l}</span><span className="font-bold text-foreground">{v}</span></div>)}
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 p-2 text-white shadow-sm">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/20"><SiteIcon name="Award" className="h-4 w-4" /></span>
            <div><div className="text-[8px] text-white/85">Loyalty points earned</div><div className="text-base font-extrabold leading-none">+125</div></div>
            <SiteIcon name="Sparkles" className="ml-auto h-4 w-4 text-white/80" />
          </div>
        </div>
      </div>
    </div>
  );
}
const CaCard = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-xl transition duration-300 hover:-translate-y-1 hover:shadow-2xl", className)}>{children}</div>;
function CaPurchaseSummary() {
  return (
    <CaCard>
      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold text-foreground">Purchase Summary</span><span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white"><SiteIcon name="ReceiptText" className="h-4 w-4" /></span></div>
      <div className="space-y-1.5 text-xs">
        {[["Bill No", "OM1245078"], ["Date", "25 May 2025, 04:35 PM"], ["Total Amount", "₹523.00"], ["Total Items", "5"]].map(([l, v]) => <div key={l} className="flex justify-between"><span className="text-muted">{l}</span><span className="font-semibold text-foreground">{v}</span></div>)}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs font-bold text-primary">View All Items <ArrowRight className="h-4 w-4" /></div>
    </CaCard>
  );
}
function CaLoyalty() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary p-4 text-white shadow-xl transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/30">
      {/* decorative coins / sheen */}
      <div aria-hidden className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
      <div aria-hidden className="absolute right-6 top-8 h-10 w-10 rounded-full bg-white/10" />
      <div className="relative mb-1 flex items-center justify-between"><span className="text-sm font-bold">Loyalty Points</span><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20"><SiteIcon name="Award" className="h-4 w-4" /></span></div>
      <div className="relative flex items-end gap-2"><span className="text-3xl font-extrabold">1,250</span><SiteIcon name="Sparkles" className="mb-1 h-4 w-4 text-yellow-200" /></div>
      <div className="relative text-2xs font-semibold text-emerald-200">+125 points earned</div>
      <div className="relative mt-3 grid grid-cols-2 gap-3 border-t border-white/20 pt-2 text-2xs">
        <div><div className="text-white/70">Total Points</div><div className="text-base font-bold">5,620</div></div>
        <div><div className="text-white/70">Points to Next Reward</div><div className="text-base font-bold">380</div></div>
      </div>
    </div>
  );
}
function CaOffers() {
  return (
    <CaCard>
      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold text-foreground">Exclusive Offers for You</span><span className="text-2xs font-bold text-primary">View All</span></div>
      <div className="grid grid-cols-3 gap-2">
        {[["Flat ₹50 OFF", "on purchase of ₹499 & above", "Valid till 31 May 2025", "ShoppingCart", "orange"], ["10% OFF", "on Home & Kitchen products", "Valid till 05 Jun 2025", "Gift", "violet"], ["Buy 2 Get 1", "Free on Snacks & Beverages", "Valid till 10 Jun 2025", "Ticket", "emerald"]].map(([t, s, v, ic, tn]) => (
          <div key={t} className="rounded-xl border border-border bg-surface p-2">
            <span className={cn("mb-1 grid h-7 w-7 place-items-center rounded-lg", tone(tn))}><SiteIcon name={ic} className="h-4 w-4" /></span>
            <div className="text-[10px] font-bold leading-tight text-foreground">{t}</div>
            <div className="text-[8px] leading-tight text-muted">{s}</div>
            <div className="mt-0.5 text-[8px] text-subtle">{v}</div>
          </div>
        ))}
      </div>
    </CaCard>
  );
}
function CaSpend() {
  return (
    <CaCard>
      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold text-foreground">Your Spend Insights</span><span className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted">This Month</span></div>
      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-1.5">
          <div><div className="text-[10px] text-muted">Total Spent</div><div className="text-lg font-bold text-foreground">₹2,450</div><div className="text-[9px] text-muted">vs Last Month <span className="font-bold text-success">+18%</span></div></div>
        </div>
        <div className="text-center">
          <div className="mx-auto h-14 w-14 rounded-full" style={{ background: "conic-gradient(var(--color-primary) 0 48%, #e5e7eb 48% 100%)" }}><div className="grid h-full w-full place-items-center"><div className="h-8 w-8 rounded-full bg-card" /></div></div>
          <div className="mt-1 text-[9px] font-bold text-foreground">Grocery</div>
          <div className="text-[8px] text-muted">48% of spend</div>
        </div>
      </div>
    </CaCard>
  );
}

function PhoneAssistant() {
  return (
    <div className="overflow-hidden rounded-[1.6rem] border-4 border-slate-800 bg-card shadow-2xl">
      <div className="flex items-center gap-1 bg-gradient-to-br from-primary to-secondary p-2 text-white"><SiteIcon name="Bot" className="h-3.5 w-3.5" /><span className="text-[8px] font-semibold">AI Shopping Assistant</span></div>
      <div className="space-y-1.5 p-2.5">
        <div className="text-[7px] text-muted">Based on your history, you may need:</div>
        {["Milk", "Bread", "Eggs", "Rice"].map((p) => <div key={p} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1"><span className="h-4 w-4 rounded bg-primary-subtle" /><span className="text-[8px] text-foreground">{p}</span></div>)}
        <div className="mt-1 rounded-lg bg-gradient-to-r from-primary to-secondary py-1 text-center text-[8px] font-bold text-white">Add to Cart</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ AI + Marketing -- */
const CHANNELS = [
  { icon: "MessageSquare", label: "WhatsApp", bg: "bg-emerald-500" },
  { icon: "Mail", label: "Email", bg: "bg-blue-500" },
  { icon: "Smartphone", label: "SMS", bg: "bg-rose-500" },
  { icon: "BellRing", label: "Push", bg: "bg-orange-500" },
  { icon: "Phone", label: "Voice", bg: "bg-violet-500" },
  { icon: "Megaphone", label: "Social", bg: "bg-fuchsia-500" },
];
function AiMarketing({ config }: { config: WebsiteConfig }) {
  const ai = config.aiCard, mk = config.marketingCard;
  return (
    <Wrap id="ai" bg={config.backgrounds?.aiMarketing}>
      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        {/* AI card */}
        <Reveal>
          <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-[#2b1268] to-[#4c1d95] p-7 text-white shadow-xl md:p-8">
            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-fuchsia-500/25 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0"><h3 className="text-2xl font-bold tracking-tight">{ai.title}</h3><p className="mt-2 text-sm text-white/75">{ai.subtitle}</p></div>
              {ai.imageUrl ? <img src={ai.imageUrl} alt="AI" className="h-20 w-24 shrink-0 rounded-2xl object-cover shadow-lg" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-2xl font-black tracking-tight shadow-inner backdrop-blur"><span className="bg-gradient-to-r from-fuchsia-300 to-violet-200 bg-clip-text text-transparent">AI</span></span>}
            </div>
            <ul className="relative mt-6 grid flex-1 gap-2.5 sm:grid-cols-2">
              {ai.points.map((p) => <li key={p} className="flex items-center gap-2.5 text-sm text-white/90"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15"><Check className="h-3.5 w-3.5" /></span>{p}</li>)}
            </ul>
          </div>
        </Reveal>
        {/* Marketing card */}
        <Reveal delay={120}>
          <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary-subtle/50 to-card p-7 shadow-xl md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0"><h3 className="text-2xl font-bold tracking-tight text-foreground">{mk.title}</h3><p className="mt-2 text-sm text-muted">{mk.subtitle}</p></div>
              {mk.imageUrl ? <img src={mk.imageUrl} alt="Marketing" className="h-20 w-24 shrink-0 rounded-2xl object-cover shadow-md" /> : (
                <div className="grid shrink-0 grid-cols-3 gap-1.5">
                  {CHANNELS.map((c) => <span key={c.label} title={c.label} className={cn("grid h-9 w-9 place-items-center rounded-xl text-white shadow-md", c.bg)}><SiteIcon name={c.icon} className="h-4 w-4" /></span>)}
                </div>
              )}
            </div>
            <ul className="mt-6 grid flex-1 gap-2.5 sm:grid-cols-2">
              {mk.points.map((p) => <li key={p} className="flex items-center gap-2.5 text-sm text-foreground"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/15 text-success"><Check className="h-3.5 w-3.5" /></span>{p}</li>)}
            </ul>
          </div>
        </Reveal>
      </div>
    </Wrap>
  );
}

/* ------------------------------------------------------------- stats band -- */
function StatsBand({ config }: { config: WebsiteConfig }) {
  if (!config.stats?.length) return null;
  return (
    <Wrap tint bg={config.backgrounds?.stats}>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
        {config.stats.map((s) => (
          <Reveal key={s.label} className="flex flex-col items-center text-center">
            <span className={cn("grid h-12 w-12 place-items-center rounded-full", tone(s.tone))}><SiteIcon name={s.icon ?? "Sparkles"} className="h-6 w-6" /></span>
            <div className="mt-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl"><Counter value={s.value} suffix={s.suffix} /></div>
            <div className="mt-0.5 text-2xs text-muted">{s.label}</div>
          </Reveal>
        ))}
      </div>
    </Wrap>
  );
}

/* ---------------------------------------------------------------- pricing -- */
export function PricingSection({ config }: { config: WebsiteConfig }) {
  return (
    <Wrap id="pricing" bg={config.backgrounds?.pricing}>
      <Heading eyebrow="Pricing" title={config.pricing.title} subtitle={config.pricing.subtitle} />
      <PricingPlans plans={config.pricing.plans} includes={config.pricingIncludes} />
    </Wrap>
  );
}

/* ------------------------------------------------------------------- blog -- */
const BLOG_TINT = ["from-violet-500 to-fuchsia-500", "from-blue-500 to-cyan-500", "from-emerald-500 to-teal-500", "from-orange-500 to-rose-500"];
function BlogSection({ config }: { config: WebsiteConfig }) {
  return (
    <Wrap id="resources" bg={config.backgrounds?.blog}>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div><h2 className="text-3xl font-bold tracking-tight text-foreground md:text-[2.2rem]">{config.blog.title}</h2><p className="mt-2 text-muted">{config.blog.subtitle}</p></div>
        <Link href="/contact" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary">View All Articles <ArrowRight className="h-4 w-4" /></Link>
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {config.blog.posts.map((p, i) => (
          <Reveal key={p.title} delay={(i % 4) * 60}>
            <Link href={p.href ?? "/contact"} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className={cn("relative flex h-36 items-center justify-center bg-gradient-to-br", BLOG_TINT[i % BLOG_TINT.length])}>
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" /> : <SiteIcon name="FileText" className="h-10 w-10 text-white/70" />}
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-primary">{p.category}</span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="flex-1 text-sm font-bold leading-snug text-foreground transition group-hover:text-primary">{p.title}</h3>
                <div className="mt-3 flex items-center gap-3 text-2xs text-subtle"><span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{p.date}</span><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{p.readTime}</span></div>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </Wrap>
  );
}

/* ------------------------------------------------------- integrations grid -- */
const INTEG_GRADIENT = ["from-violet-500 to-fuchsia-500", "from-blue-500 to-cyan-500", "from-emerald-500 to-teal-500", "from-orange-500 to-rose-500", "from-indigo-500 to-purple-500", "from-pink-500 to-rose-500", "from-sky-500 to-blue-600", "from-amber-500 to-orange-600"];
function IntegrationsStrip({ config }: { config: WebsiteConfig }) {
  const it = config.integrationLogos;
  return (
    <Wrap tint bg={config.backgrounds?.integrationLogos}>
      <Heading eyebrow="Integrations" title={it.title} subtitle={it.subtitle} />
      <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {it.logos.map((l, i) => (
          <Reveal key={l} delay={(i % 5) * 40}>
            <div className="group flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-lg font-black text-white shadow-md", INTEG_GRADIENT[i % INTEG_GRADIENT.length])}>{l.trim().charAt(0).toUpperCase()}</span>
              <div className="min-w-0"><div className="truncate text-sm font-semibold text-foreground">{l}</div><div className="flex items-center gap-1 text-2xs text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Connected</div></div>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-muted">…and many more via our open <span className="font-semibold text-primary">REST API</span> &amp; webhooks.</p>
    </Wrap>
  );
}

/* ------------------------------------------------------------------- CTA -- */
function CtaBand({ config }: { config: WebsiteConfig }) {
  const c = config.cta;
  const cbg = config.backgrounds?.cta;
  return (
    <section className={cn("relative overflow-hidden py-14 text-white", cbg?.imageUrl ? "bg-primary" : "bg-gradient-to-r from-primary to-secondary")}>
      {cbg?.imageUrl && <><img src={cbg.imageUrl} alt="" aria-hidden className={cn("pointer-events-none absolute inset-0 h-full w-full object-cover", cbg.blur && "blur-sm")} /><div className={cn("pointer-events-none absolute inset-0", overlayClass(cbg.overlay) || "bg-gradient-to-r from-primary/90 to-secondary/85")} /></>}
      <div className="site-blob pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="site-blob pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" style={{ animationDelay: "4s" }} />
      <div className="relative mx-auto flex max-w-[1560px] flex-col items-center justify-between gap-6 px-5 text-center lg:flex-row lg:text-left">
        <div><h2 className="text-2xl font-bold tracking-tight md:text-3xl">{c.title}</h2><p className="mt-2 text-white/85">{c.subtitle}</p></div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={c.primaryCta.href} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-md font-bold text-primary shadow-lg transition hover:bg-white/90">{c.primaryCta.label}<ArrowRight className="h-4 w-4" /></Link>
          <Link href={c.secondaryCta.href} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/50 px-6 text-md font-semibold text-white transition hover:bg-white/10">{c.secondaryCta.label}</Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- optional sections -- */
function Why({ config }: { config: WebsiteConfig }) {
  const [feature, ...rest] = config.why.pillars;
  return (
    <Wrap id="why">
      <Heading eyebrow={`Why ${config.identity.productName}`} title={config.why.title} subtitle={config.why.subtitle} />
      <div className="mt-14 grid gap-4 lg:grid-cols-4 lg:grid-rows-2">
        <Reveal className="lg:col-span-2 lg:row-span-2">
          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-secondary p-7 text-white shadow-xl">
            <div className="relative"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur"><SiteIcon name={feature?.icon ?? "Sparkles"} className="h-7 w-7" /></span><h3 className="mt-6 text-2xl font-bold tracking-tight">{feature?.title}</h3><p className="mt-3 max-w-sm text-md leading-relaxed text-white/85">{feature?.text}</p></div>
            <div className="relative mt-8 grid grid-cols-3 gap-3">{config.stats.slice(0, 3).map((s) => <div key={s.label} className="rounded-xl bg-white/10 p-3 backdrop-blur"><div className="text-xl font-bold">{s.value}{s.suffix}</div><div className="text-[10px] text-white/70">{s.label}</div></div>)}</div>
          </div>
        </Reveal>
        {rest.map((p, i) => (
          <Reveal key={p.title} delay={(i % 4) * 50}><div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-subtle text-primary"><SiteIcon name={p.icon} className="h-5 w-5" /></span><h3 className="mt-4 text-sm font-bold text-foreground">{p.title}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{p.text}</p></div></Reveal>
        ))}
      </div>
    </Wrap>
  );
}
function Industries({ config }: { config: WebsiteConfig }) {
  const s = config.industries;
  return (
    <Wrap id="industries" tint bg={config.backgrounds?.industries}>
      <Heading eyebrow="Industries" title={s.title} subtitle={s.subtitle} />
      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {s.items.map((it, i) => {
          const c = it.color || "#7c3aed";
          return (
            <Reveal key={it.name} delay={(i % 6) * 30}>
              <Link href="/#industries" className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-1.5 hover:shadow-xl">
                <div className="relative h-28 overflow-hidden">
                  {it.imageUrl
                    ? <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-110" />
                    : <div className="flex h-full items-center justify-center transition group-hover:scale-105" style={{ background: `linear-gradient(135deg, ${c}22, ${c}55)` }}><SiteIcon name={it.icon} className="h-12 w-12" style={{ color: c }} /></div>}
                  <span className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-white shadow-md" style={{ background: c }}><SiteIcon name={it.icon} className="h-4 w-4" /></span>
                </div>
                <div className="flex flex-1 items-center justify-center border-t-2 px-2 py-3 text-center" style={{ borderColor: c }}>
                  <span className="text-2xs font-bold leading-tight text-foreground">{it.name}</span>
                </div>
              </Link>
            </Reveal>
          );
        })}
        <Reveal delay={180}>
          <Link href="/#industries" className="group flex h-full min-h-[9rem] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary-subtle/30 p-4 text-center transition hover:-translate-y-1.5 hover:bg-primary-subtle">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-white transition group-hover:scale-110"><ArrowRight className="h-5 w-5" /></span>
            <span className="text-2xs font-bold text-primary">View All Industries</span>
          </Link>
        </Reveal>
      </div>
    </Wrap>
  );
}
function PlatformOverview({ config }: { config: WebsiteConfig }) {
  return (
    <Wrap id="platform" tint>
      <Heading eyebrow="The Complete ERP Platform" title={config.platform.title} subtitle={config.platform.subtitle} />
      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MODULE_CATEGORIES.map((cat, i) => (
          <Reveal key={cat.key} delay={(i % 3) * 60}>
            <Link href={`/modules#${cat.key}`} className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-md"><SiteIcon name={cat.icon} className="h-6 w-6" /></span>
              <h3 className="mt-4 text-lg font-bold text-foreground">{cat.title}</h3><p className="mt-1.5 flex-1 text-sm text-muted">{cat.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-all group-hover:gap-2.5">Explore suite <ArrowRight className="h-4 w-4" /></span>
            </Link>
          </Reveal>
        ))}
      </div>
      <div className="mt-10 text-center"><Link href="/modules" className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-7 text-md font-semibold text-white shadow-lg shadow-primary/25 transition hover:brightness-105">View all {ALL_MODULES.length}+ Modules <ArrowRight className="h-4 w-4" /></Link></div>
    </Wrap>
  );
}
function Spotlights({ config }: { config: WebsiteConfig }) {
  if (!config.spotlights?.length) return null;
  return <section id="spotlights" className="scroll-mt-20">{config.spotlights.map((s, i) => <SpotlightRow key={i} s={s} alt={i % 2 === 1} />)}</section>;
}
function SpotlightRow({ s, alt }: { s: Spotlight; alt: boolean }) {
  const media = <Reveal className="relative"><div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/15 to-secondary/15 blur-2xl" /><div className="site-float relative">{s.imageUrl ? <img src={s.imageUrl} alt={s.title} className="w-full rounded-2xl border border-border shadow-2xl" /> : <DashboardMock />}</div></Reveal>;
  const text = <Reveal>{s.badge && <Eyebrow>{s.badge}</Eyebrow>}<h3 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{s.title}</h3><p className="mt-4 text-md leading-relaxed text-muted">{s.subtitle}</p><ul className="mt-6 space-y-3">{s.points.map((p) => <li key={p} className="flex items-start gap-3 text-sm text-foreground"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success-subtle text-success"><Check className="h-3.5 w-3.5" /></span>{p}</li>)}</ul>{s.cta && <div className="mt-7"><CtaLink cta={s.cta} /></div>}</Reveal>;
  return <div className={cn("border-b border-border", alt && "bg-surface")}><div className="mx-auto grid max-w-[1560px] items-center gap-10 px-5 py-16 md:py-20 lg:grid-cols-2 lg:gap-16">{alt ? <>{media}{text}</> : <>{text}{media}</>}</div></div>;
}
function Testimonials({ config }: { config: WebsiteConfig }) {
  const s = config.testimonials;
  return (
    <Wrap id="testimonials" tint>
      <Heading eyebrow="Customer Success" title={s.title} subtitle={s.subtitle} />
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {s.items.map((t, i) => (
          <Reveal key={i} delay={i * 80}><figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"><Quote className="h-8 w-8 text-primary/30" /><blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground">"{t.quote}"</blockquote><div className="mt-4 flex items-center gap-1 text-warning">{Array.from({ length: 5 }).map((_, k) => <Star key={k} className="h-4 w-4 fill-current" />)}</div><figcaption className="mt-4 flex items-center gap-3 border-t border-border pt-4"><span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white">{t.author.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span><span className="text-sm"><span className="block font-semibold text-foreground">{t.author}</span><span className="text-2xs text-muted">{t.role}, {t.company}</span></span></figcaption></figure></Reveal>
        ))}
      </div>
    </Wrap>
  );
}
function Faq({ config }: { config: WebsiteConfig }) {
  return <Wrap id="faq"><Heading eyebrow="FAQ" title={config.faq.title} subtitle={config.faq.subtitle} /><div className="mt-12"><FaqAccordion items={config.faq.items} /></div></Wrap>;
}
function LogoMarquee({ config }: { config: WebsiteConfig }) {
  const clients: ClientLogo[] = config.clients?.length ? config.clients : config.logos.map((n) => ({ name: n }));
  if (!clients.length) return null;
  const row = [...clients, ...clients];
  return (
    <section className="border-y border-border bg-surface py-10">
      <p className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-subtle">{config.clientsTitle}</p>
      <div className="site-marquee-group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]"><div className="site-marquee flex w-max items-center gap-12 px-6">{row.map((c, i) => <span key={i} className="flex shrink-0 items-center">{c.logoUrl ? <img src={c.logoUrl} alt={c.name} className="h-8 w-auto opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0" /> : <span className="whitespace-nowrap text-xl font-bold text-muted/60 transition hover:text-foreground">{c.name}</span>}</span>)}</div></div>
    </section>
  );
}
const TECH_GROUP_ICON: Record<string, React.ElementType> = { Frontend: Layers, "Backend / API": Server, Database: Database };
function Tech({ config }: { config: WebsiteConfig }) {
  return (
    <Wrap id="tech" tint bg={config.backgrounds?.tech}>
      <Heading eyebrow="Technology" title={config.tech.title} subtitle={config.tech.subtitle} />
      {/* Detailed technology stack — grouped by layer with live versions. */}
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {TECH_STACK.map((g, gi) => {
          const Icon = TECH_GROUP_ICON[g.label] ?? Layers;
          return (
            <Reveal key={g.label} delay={gi * 80}>
              <div className="h-full rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-md"><Icon className="h-5 w-5" /></span>
                  <h3 className="text-base font-bold text-foreground">{g.label}</h3>
                </div>
                <ul className="space-y-2">
                  {g.items.map((it) => (
                    <li key={it.name} className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                      <span className="text-sm font-medium text-foreground">{it.name}</span>
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">v{it.version}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          );
        })}
      </div>
      {/* Supplementary technologies (editable from the Website CMS). */}
      {config.tech.items.length > 0 && (
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {config.tech.items.map((t) => <span key={t} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:text-primary">{t}</span>)}
        </div>
      )}
      <p className="mt-8 text-center text-sm text-muted">Application version <span className="font-mono font-semibold text-primary">v{APP_VERSION}</span></p>
    </Wrap>
  );
}

/* ------------------------------------------------- home section dispatcher -- */
export function HomeSections({ config }: { config: WebsiteConfig }) {
  const enabled = config.homeSections.filter((s) => s.enabled);
  return (
    <>
      {enabled.map(({ id }) => {
        switch (id) {
          case "hero": return <Hero key={id} config={config} />;
          case "retailShowcase": return <RetailShowcase key={id} config={config} />;
          case "everything": return <EverythingStrip key={id} config={config} />;
          case "realtime": return <RealTimeSection key={id} config={config} />;
          case "erpIndustries": return <ErpIndustries key={id} config={config} />;
          case "customerApp": return <CustomerAppSection key={id} config={config} />;
          case "aiMarketing": return <AiMarketing key={id} config={config} />;
          case "trustedLogos": return <TrustedLogos key={id} config={config} />;
          case "stats": return <StatsBand key={id} config={config} />;
          case "pricing": return <PricingSection key={id} config={config} />;
          case "blog": return <BlogSection key={id} config={config} />;
          case "integrationLogos": return <IntegrationsStrip key={id} config={config} />;
          case "cta": return <CtaBand key={id} config={config} />;
          // optional (Homepage Builder can enable):
          case "logos": return <LogoMarquee key={id} config={config} />;
          case "spotlights": return <Spotlights key={id} config={config} />;
          case "why": return <Why key={id} config={config} />;
          case "platform": return <PlatformOverview key={id} config={config} />;
          case "industries": return <Industries key={id} config={config} />;
          case "finance": return <FeatureShowcase key={id} id="finance" eyebrow="Finance & GST" group={config.finance} flip />;
          case "hr": return <FeatureShowcase key={id} id="hr" eyebrow="People" group={config.hr} tint />;
          case "cx": return <FeatureShowcase key={id} id="cx" eyebrow="Customer Experience" group={config.cx} />;
          case "aiAssistant": return <FeatureShowcase key={id} id="ai-assistant" eyebrow="AI Assistant" group={config.aiAssistant} tint />;
          case "marketing": return <FeatureShowcase key={id} id="marketing" eyebrow="Marketing" group={config.marketing} flip />;
          case "benefits": return <FeatureShowcase key={id} id="benefits" eyebrow="Rewards" group={config.benefits} tint />;
          case "ecommerce": return <FeatureShowcase key={id} id="ecommerce" eyebrow="E-Commerce" group={config.ecommerce} />;
          case "integrations": return <FeatureShowcase key={id} id="integrations" eyebrow="Integrations" group={config.integrations} tint />;
          case "ai": return <FeatureShowcase key={id} id="ai" eyebrow="AI Platform" group={config.ai} flip />;
          case "tech": return <Tech key={id} config={config} />;
          case "testimonials": return <Testimonials key={id} config={config} />;
          case "faq": return <Faq key={id} config={config} />;
          default: return null;
        }
      })}
    </>
  );
}

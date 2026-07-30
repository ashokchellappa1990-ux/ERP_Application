"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Globe,
  ChevronDown,
  Sun,
  AlertCircle,
} from "lucide-react";
import { APP_VERSION } from "@/lib/techStack";
import { useBrand } from "@/components/theme/ThemeProvider";
import { splitBrandName, DEFAULT_PRODUCT_NAME } from "@/lib/brand";
import { OneErpMark } from "@/components/ui/OneErpMark";
import { SiteIcon } from "@/components/site/SiteIcon";
import { PatternLayer } from "@/components/site/sections";
import { cn } from "@/lib/cn";
import type { WebsiteConfig } from "@/lib/website/config";

type LoginIdentity = WebsiteConfig["identity"];

/* ------------------------------------------------------------ palette ----
   The whole sign-in screen is driven by the platform **Website CMS theme config**
   (published identity primary/secondary/accent), injected by login/layout.tsx as
   --brand-1/2/3: the left-panel gradient + button (HERO and BTN gradients), plus the
   logo mark, headline highlight and right-side chips/rings. Change the website/portal
   theme → the login re-colours. The photo (`--login-hero-image`) is set there too. */

// Left panel + button use the platform Website-CMS theme colours (published
// identity primary → secondary), injected by login/layout.tsx as --brand-1/2/3.
// Changing the website/portal theme re-colours the sign-in screen. A diagonal 135°
// gradient (primary holds through the top, blending to secondary bottom-right); a
// login photo (if uploaded) layers over it.
const HERO_PRIMARY = "var(--brand-1)";
const HERO_SECONDARY = "var(--brand-2)";
const HERO_GRADIENT = `linear-gradient(135deg, ${HERO_PRIMARY} 0%, ${HERO_PRIMARY} 42%, ${HERO_SECONDARY} 100%)`;
const BTN_GRADIENT = `linear-gradient(135deg, ${HERO_PRIMARY} 0%, ${HERO_PRIMARY} 40%, ${HERO_SECONDARY} 100%)`;

/** Decorative code snippet — pure visual flourish, not editable content. */
const CODE_SNIPPETS = [
  ["// Optimize Business Operations", "const success = (data) => {", "  return analytics(data)", "    .process()", "    .insights();", "}"],
  ["SELECT performance, growth", "FROM business_metrics", "WHERE period = 'current'", "ORDER BY growth DESC"],
  ["function automate(workflow) {", "  return workflow", "    .trigger()", "    .execute()", "    .complete();", "}"],
];

/** Pixels the left panel "bleeds" into the right panel so a diagonal/notch/zigzag
 *  seam can be clipped out of that overlap (straight has no bleed — it's a plain edge). */
const DIVIDER_BLEED = 72;

/** clip-path for the left panel's right edge, in its own box (width = split% + bleed).
 *  "straight" returns undefined (no bleed, no clip — a plain vertical edge). */
function dividerClipPath(style: string, bleed: number): string | undefined {
  switch (style) {
    case "diagonal":
      return `polygon(0 0, 100% 0, calc(100% - ${bleed}px) 100%, 0 100%)`;
    case "notch": {
      const inset = Math.round(bleed * 0.55);
      const edge = `calc(100% - ${bleed - inset}px)`;
      return `polygon(0 0, ${edge} 0, ${edge} 44%, 100% 50%, ${edge} 56%, ${edge} 100%, 0 100%)`;
    }
    case "zigzag": {
      const a = bleed, b = Math.round(bleed * 0.4);
      const ys = [0, 16.6, 33.3, 50, 66.6, 83.3, 100];
      const pts = ys.map((y, i) => `calc(100% - ${i % 2 === 0 ? a : b}px) ${y}%`).join(", ");
      return `polygon(0 0, ${pts}, 0 100%)`;
    }
    default:
      return undefined;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const brand = useBrand();
  const brandName = brand.productName || DEFAULT_PRODUCT_NAME;
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Entire sign-in screen left-panel content is driven by Website CMS → Theme &
  // Identity → "Login Screen Content" (headline, subtitle, background image,
  // module cards, trust strip) — no code change needed to restyle the copy.
  const [id, setId] = useState<LoginIdentity | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/website/config", { cache: "no-store" }).then((r) => r.json())
      .then((j) => { if (active) setId((j?.config?.identity ?? null) as LoginIdentity | null); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const bgImage = (id?.loginImageUrl ?? "").trim();
  const modules = id?.loginModules ?? [];
  const trustItems = id?.loginTrustItems ?? [];
  const showModules = (id?.loginShowModules ?? true) && modules.length > 0;
  const showTrust = (id?.loginShowTrust ?? true) && trustItems.length > 0;
  const showCode = id?.loginShowCodeSnippet ?? true;
  const newsItems = id?.loginNewsItems ?? [];
  const showNews = (id?.loginShowNews ?? true) && newsItems.length > 0;
  const capabilityItems = id?.loginCapabilityItems ?? [];
  const showCapabilities = (id?.loginShowCapabilities ?? true) && capabilityItems.length > 0;
  // Layout — split %, left-panel content mode, and the panel-seam shape are all
  // config-driven (Website CMS → Theme & Identity → "Login Screen Layout").
  const splitPct = Math.max(30, Math.min(70, Number(id?.loginSplitPercent) || 58));
  const leftImageOnly = (id?.loginLeftMode ?? "content") === "image";
  const dividerStyle = id?.loginDividerStyle ?? "diagonal";
  const isStraightDivider = dividerStyle === "straight";
  const leftClipPath = isStraightDivider ? undefined : dividerClipPath(dividerStyle, DIVIDER_BLEED);
  const rightBgImage = (id?.loginRightBgImageUrl ?? "").trim();
  const rightBgOpacity = Math.max(0, Math.min(100, Number(id?.loginRightBgOpacity) || 0)) / 100;
  // The uploaded photo — scoped to the MIDDLE region only (not the whole aside),
  // so "contain"+"center" positions it relative to just the space actually left
  // between the header/news-ticker and the footer, never overlapping either.
  // A brand-tinted scrim (mixed with `transparent`, not `black` — see history)
  // keeps text readable in "content" mode; "image only" uses a much lighter one.
  const midBgStyle: React.CSSProperties = bgImage
    ? {
        backgroundImage: leftImageOnly
          ? `linear-gradient(180deg, color-mix(in srgb, ${HERO_PRIMARY} 12%, transparent) 0%, color-mix(in srgb, black 22%, transparent) 100%), url(${bgImage})`
          : `linear-gradient(180deg, color-mix(in srgb, ${HERO_PRIMARY} 45%, transparent) 0%, color-mix(in srgb, ${HERO_PRIMARY} 62%, transparent) 55%, color-mix(in srgb, black 55%, transparent) 100%), url(${bgImage})`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }
    : {};
  // "Login Screen Layout" pattern pickers — same engine as the marketing site's
  // section backgrounds (PatternLayer), recoloured to the sign-in screen's own
  // brand vars (--brand-1/2) instead of the app-theme vars, so no separate
  // colour field is needed here.
  const leftPattern = id?.loginLeftPattern ?? "waves-dots";
  const rightPattern = id?.loginRightPattern ?? "dots";
  // "Module & Trust Card Style" — shape/position/tint for each card type.
  const moduleIconShape = id?.loginModuleIconShape ?? "square";
  const moduleIconPosition = id?.loginModuleIconPosition ?? "top";
  const moduleTint = id?.loginModuleCardTint ?? "medium";
  const trustIconShape = id?.loginTrustIconShape ?? "circle";
  const trustIconPosition = id?.loginTrustIconPosition ?? "left";
  const trustTint = id?.loginTrustCardTint ?? "subtle";
  const TINT_ALPHA = { subtle: 6, medium: 12, bold: 24 } as const;
  const ICON_BG_ALPHA = { subtle: 18, medium: 28, bold: 100 } as const;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const identifier = String(fd.get("identifier") || "").trim();
    const password = String(fd.get("password") || "");
    const remember = fd.get("remember") != null;

    if (!identifier || !password) {
      setError("Enter your email/username and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, remember }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.message || "Sign in failed. Please try again.");
        setLoading(false);
        return;
      }
      router.push(json?.redirect || "/dashboard");
    } catch {
      setError("Network error — could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* ================ LEFT PANEL — width/mode/seam all config-driven ================ */}
      <aside
        className="relative hidden flex-col justify-between p-9 text-white lg:flex xl:p-11"
        style={{
          // A plain brand-gradient backdrop for the WHOLE panel (header, news
          // ticker, and footer all sit on this). The uploaded photo is NOT
          // painted here — see `midBgStyle` below — because "contain"+"center"
          // on the full aside centers the image against the ENTIRE panel
          // height, landing it behind the header/ticker instead of confined to
          // the middle area. Scoping the photo to just the middle div (which
          // flexbox naturally sizes to "whatever's left between header/ticker
          // and footer") is what actually keeps it clear of the header/footer.
          backgroundImage: HERO_GRADIENT,
          backgroundColor: HERO_PRIMARY,
          // "Login Screen Layout" → split % + divider style. Straight = a plain
          // edge at exactly split%. Diagonal/notch/zigzag bleed a fixed amount
          // into the right panel and clip-path carves the decorative seam out of
          // that overlap; a matching negative margin keeps the right panel's
          // effective start at split% either way. A drop-shadow (which follows
          // the clipped silhouette, unlike box-shadow) adds a soft brand glow
          // along the cut edge.
          width: isStraightDivider ? `${splitPct}%` : `calc(${splitPct}% + ${DIVIDER_BLEED}px)`,
          marginRight: isStraightDivider ? undefined : `-${DIVIDER_BLEED}px`,
          clipPath: leftClipPath,
          filter: leftClipPath ? "drop-shadow(6px 0 16px color-mix(in srgb, var(--brand-2) 40%, transparent))" : undefined,
        }}
      >
        {/* Decorative pattern — Website CMS → Theme & Identity → "Login Screen
            Layout" → "Left panel — decorative pattern". Always follows the
            brand Primary/Secondary colours (no separate colour field). */}
        {leftPattern !== "none" && <PatternLayer pattern={leftPattern} side="full" animate primaryVar="--brand-1" secondaryVar="--brand-2" />}

        {/* HEADER — logo + company name + tagline, from the platform config, in
            BOTH modes. The uploaded image/pattern sits in the CENTER, between
            this header and the footer cards below (never baked into the photo). */}
        <div className="relative shrink-0">
          <LoginPanelHeader tagline={id?.tagline} />
        </div>

        {/* NEWS & UPDATES — animated auto-rotating ticker, between the header and
            the image/content area. Website CMS → Theme & Identity → "Login — News
            & Updates". Always shown (both modes). */}
        {showNews && (
          <div className="relative mt-6 shrink-0">
            <NewsTicker items={newsItems} />
          </div>
        )}

        {/* MIDDLE — headline/subtitle/modules/code in "content" mode; an empty,
            growing spacer in "image only" mode so the background photo shows
            through, centered, between the header and footer. */}
        {leftImageOnly ? (
          <div className="relative flex-1" style={midBgStyle} />
        ) : (
          <div className="relative flex-1 overflow-y-auto py-8" style={midBgStyle}>
            {/* `justify-evenly` spreads these sections across whatever height the
                middle area actually has — no more dead space clustering at the
                bottom on tall screens/short content, and it still scrolls
                (parent's overflow-y-auto) if content ever outgrows the space. */}
            <div className="flex h-full min-h-full flex-col justify-evenly gap-7">
              <div>
                <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight xl:text-[2.55rem]">
                  {id?.loginHeadlineLine1 ?? "All Your Business."}
                  <br />
                  {id?.loginHeadlineLine2Before ?? "One "}
                  <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, var(--brand-2), color-mix(in srgb, var(--brand-2) 45%, white))" }}>{id?.loginHeadlineHighlight ?? "Intelligent"}</span>
                  {id?.loginHeadlineLine2After ?? " Platform."}
                </h1>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
                  {id?.loginSubtitle ?? "Unify operations, drive efficiency, and accelerate growth with a connected digital ecosystem."}
                </p>
              </div>

              {/* Module cards grid — Website CMS → Theme & Identity → "Login —
                  Module Cards" (content) + "Module & Trust Card Style" (icon
                  shape/position, card tint — everything but colour, which always
                  follows the brand Primary/Secondary above). */}
              {showModules && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {modules.map((m) => (
                    <div
                      key={m.label}
                      className={cn(
                        "rounded-xl border border-white/15 p-3 backdrop-blur-sm transition hover:bg-white/10",
                        moduleIconPosition === "left" ? "flex items-start gap-2.5" : "flex flex-col items-center text-center",
                      )}
                      style={{ backgroundColor: `rgba(255,255,255,${TINT_ALPHA[moduleTint] / 100})` }}
                    >
                      <span
                        className={cn("grid h-9 w-9 shrink-0 place-items-center", moduleIconShape === "circle" ? "rounded-full" : "rounded-lg", moduleIconPosition === "top" && "mb-2")}
                        style={{ backgroundColor: `color-mix(in srgb, var(--brand-2) ${ICON_BG_ALPHA[moduleTint]}%, transparent)` }}
                      >
                        <SiteIcon name={m.icon} className="h-[18px] w-[18px]" style={{ color: moduleTint === "bold" ? "white" : "var(--brand-2)" }} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-tight text-white">{m.label}</p>
                        {m.sub && <p className="mt-0.5 text-[11px] leading-snug text-white/55">{m.sub}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Capability strip — Website CMS → Theme & Identity → "Login —
                  Capability Strip". */}
              {showCapabilities && <CapabilityStrip items={capabilityItems} />}

              {/* Decorative code snippet — purely visual flourish */}
              {showCode && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {CODE_SNIPPETS.map((lines, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[10px] leading-relaxed text-emerald-300/80">
                      {lines.map((l, j) => <div key={j} className="whitespace-pre">{l}</div>)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* FOOTER — compact capability cards, from Website CMS → Theme & Identity
            → "Login — Trust Strip Items". Always shown (both modes), pinned to
            the bottom, matching an app-style footer band rather than baked-in image text. */}
        {showTrust && (
          <div className="relative shrink-0 border-t border-white/10 pt-4">
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {trustItems.map((t) => (
                <div
                  key={t.title}
                  className={cn(
                    "min-w-[150px] flex-1 rounded-lg p-1.5",
                    trustIconPosition === "left" ? "flex items-start gap-2.5" : "flex flex-col items-center text-center",
                  )}
                  style={trustTint !== "subtle" ? { backgroundColor: `rgba(255,255,255,${TINT_ALPHA[trustTint] / 100})` } : undefined}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center border border-white/15",
                      trustIconShape === "circle" ? "rounded-full" : "rounded-lg",
                      trustIconPosition === "top" && "mb-1.5",
                    )}
                    style={{ backgroundColor: `color-mix(in srgb, var(--brand-2) ${ICON_BG_ALPHA[trustTint]}%, transparent)` }}
                  >
                    <SiteIcon name={t.icon} className="h-4 w-4" style={{ color: trustTint === "bold" ? "white" : "var(--brand-2)" }} />
                  </span>
                  <div className="min-w-0 leading-tight">
                    <p className="text-[12px] font-semibold text-white">{t.title}</p>
                    {t.sub && <p className="mt-0.5 text-[10.5px] leading-snug text-white/55">{t.sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ================ RIGHT PANEL — fills the remainder (flex-1); optional bg image ================ */}
      <main
        className="relative flex w-full flex-1 flex-col overflow-hidden bg-[#F8FAFC]"
        style={rightBgImage ? {
          backgroundImage: `linear-gradient(rgba(248,250,252,${1 - rightBgOpacity}), rgba(248,250,252,${1 - rightBgOpacity})), url(${rightBgImage})`,
          // Same fix as the left panel — "contain" fits the whole image inside
          // the right panel's actual space (any remainder shows the page's
          // background colour) instead of "cover" cropping it to fill the box.
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        } : undefined}
      >
        {/* Decorative pattern — Website CMS → "Login Screen Layout" → "Right
            panel — decorative pattern". `relative` on the content wrapper below
            is what keeps the real form above this (same convention as the
            marketing-site sections that already use PatternLayer this way). */}
        {rightPattern !== "none" && <PatternLayer pattern={rightPattern} side="left" animate primaryVar="--brand-1" secondaryVar="--brand-2" />}

        <div className="relative flex flex-1 flex-col">
        {/* Top bar: system status + theme + language */}
        <div className="flex items-center justify-between gap-3 px-6 pt-6 sm:px-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]" />
            </span>
            <span className="leading-tight">
              <span className="block text-[10px] font-semibold text-[#64748B]">System Status</span>
              <span className="block text-[11px] font-bold text-[#0F172A]">All Systems Operational</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Toggle theme" className="grid h-10 w-10 place-items-center rounded-full border border-[#E2E8F0] bg-white text-[#64748B] transition hover:bg-[#F8FAFC]">
              <Sun className="h-4 w-4" />
            </button>
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-medium text-[#0F172A] transition hover:bg-[#F8FAFC]">
              <Globe className="h-4 w-4 text-[#64748B]" />
              English
              <ChevronDown className="h-3.5 w-3.5 text-[#64748B]" />
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
          <div className="w-full max-w-[420px]">
            {/* Mobile logo */}
            <div className="mb-8 flex justify-center lg:hidden">
              <BrandLogo />
            </div>

            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-7 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.18)] sm:p-9">
              <div className="mb-7 text-center">
                <div className="mb-4 flex justify-center">
                  <HexMark />
                </div>
                <h2 className="text-[1.6rem] font-bold tracking-tight text-[#0F172A]">
                  Welcome Back! <span className="align-middle">👋</span>
                </h2>
                <p className="mt-1.5 text-sm text-[#64748B]">Sign in to your {brandName} account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email / Username */}
                <Field
                  id="identifier"
                  label="Email or Username"
                  icon={<User className="h-[18px] w-[18px]" />}
                  type="text"
                  placeholder="Enter your email or username"
                  autoComplete="username"
                  defaultValue="admin@onepos.cloud"
                />

                {/* Password */}
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#0F172A]">Password</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                      <Lock className="h-[18px] w-[18px]" />
                    </span>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      defaultValue="Admin@123"
                      required
                      className="h-12 w-full rounded-lg border border-[#E2E8F0] bg-white pl-11 pr-11 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[color:var(--brand-1)] focus:outline-none focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--brand-1)_16%,transparent)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] transition hover:text-[#0F172A]"
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                {/* Remember / Forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#64748B]">
                    <input type="checkbox" name="remember" defaultChecked className="h-[18px] w-[18px] rounded border-[#CBD5E1] accent-[var(--brand-1)]" />
                    Remember me
                  </label>
                  <a href="#" className="text-sm font-semibold text-[color:var(--brand-1)] hover:underline">Forgot password?</a>
                </div>

                {/* Error */}
                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C]">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Sign In */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundImage: BTN_GRADIENT }}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg text-[15px] font-semibold text-white shadow-lg shadow-[color:color-mix(in_srgb,var(--brand-1)_35%,transparent)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-70"
                >
                  {loading ? "Signing in…" : "Sign In"}
                  {!loading && <ArrowRight className="h-[18px] w-[18px]" />}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 py-1 text-2xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  <span className="h-px flex-1 bg-[#E2E8F0]" />
                  or continue with
                  <span className="h-px flex-1 bg-[#E2E8F0]" />
                </div>

                {/* Social */}
                <div className="grid grid-cols-2 gap-3">
                  <SocialButton icon={<GoogleIcon />} label="Google" />
                  <SocialButton icon={<MicrosoftIcon />} label="Microsoft" />
                </div>
              </form>

              <p className="mt-7 text-center text-sm text-[#64748B]">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-semibold text-[color:var(--brand-1)] hover:underline">Create Free Account</Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex flex-col items-center justify-between gap-2 border-t border-[#E2E8F0] px-6 py-5 text-xs text-[#64748B] sm:flex-row sm:px-10">
          <span>© 2026 {brandName}. All rights reserved.</span>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="#" className="hover:text-[#0F172A]">Privacy Policy</a>
            <span className="text-[#CBD5E1]">|</span>
            <a href="#" className="hover:text-[#0F172A]">Terms &amp; Conditions</a>
            <span className="text-[#CBD5E1]">|</span>
            <a href="#" className="hover:text-[#0F172A]">Support</a>
            <span className="text-[#CBD5E1]">|</span>
            <a href="#" className="hover:text-[#0F172A]">Documentation</a>
            <span className="text-[#CBD5E1]">|</span>
            <span className="font-mono text-[#94A3B8]">v{APP_VERSION}</span>
          </div>
        </footer>
        </div>
      </main>
    </div>
  );
}

/* ===================================================== sub-components ==== */

function Field({
  id,
  label,
  icon,
  ...props
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#0F172A]">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]">{icon}</span>
        <input
          id={id}
          name={id}
          required
          className="h-12 w-full rounded-lg border border-[#E2E8F0] bg-white pl-11 pr-4 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] transition focus:border-[color:var(--brand-1)] focus:outline-none focus:ring-4 focus:ring-[color:color-mix(in_srgb,var(--brand-1)_16%,transparent)]"
          {...props}
        />
      </div>
    </div>
  );
}

function SocialButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button type="button" className="flex h-12 items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] bg-white text-[13px] font-semibold text-[#0F172A] transition hover:bg-[#F8FAFC]">
      {icon}
      <span className="truncate">Continue with {label}</span>
    </button>
  );
}

/** The hexagon brand mark (matches the sidebar logo) shown atop the sign-in card. */
function HexMark() {
  const brand = useBrand();
  if (brand.logoUrl) {
    return <img src={brand.logoUrl} alt={brand.productName || "Logo"} className="h-14 w-14 rounded-2xl object-contain shadow-md" />;
  }
  return (
    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-md">
      <OneErpMark className="h-10 w-10" />
    </span>
  );
}

function BrandLogo({ light = false, tagline }: { light?: boolean; tagline?: string }) {
  const brand = useBrand();
  const [word1, word2] = splitBrandName(brand.productName);
  return (
    <span className="inline-flex items-center gap-3">
      {brand.logoUrl ? (
        <img src={brand.logoUrl} alt={brand.productName || "Logo"} className="h-11 w-11 shrink-0 rounded-xl object-contain shadow-md" />
      ) : (
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white shadow-md"
          style={{ border: light ? "1px solid rgba(255,255,255,0.25)" : "1px solid rgba(0,0,0,0.06)" }}
        >
          <OneErpMark className="h-8 w-8" />
        </span>
      )}
      <span className="flex flex-col leading-none">
        <span className={light ? "text-xl font-bold tracking-tight text-white" : "text-xl font-bold tracking-tight text-[#0F172A]"}>
          {word1}
          {word2 && <> <span className={light ? "text-white/80" : "text-[color:var(--brand-1)]"}>{word2}</span></>}
        </span>
        <span className={light ? "mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65" : "mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748B]"}>
          {tagline || "Business ERP & POS"}
        </span>
      </span>
    </span>
  );
}

/** Sign-in left-panel header — logo, company name & tagline, ALL from the
 *  platform config (Website CMS → Theme & Identity): logo/name via useBrand(),
 *  tagline via the raw identity fetch (`id.tagline`) since useBrand() doesn't
 *  carry it. Shown in both left-panel modes, never baked into the uploaded photo. */
function LoginPanelHeader({ tagline }: { tagline?: string }) {
  return <BrandLogo light tagline={tagline} />;
}

type NewsItem = { tag?: string; title: string; text: string; date?: string; icon: string };

/** Animated "News & Updates" ticker — auto-rotates through `items` (Website CMS
 *  → Theme & Identity → "Login — News & Updates"), one every ~4.5s, with a
 *  crossfade/slide transition. Pauses on hover; dots below let you jump to any
 *  item directly. Sits between the header and the image/content area. */
function NewsTicker({ items }: { items: NewsItem[] }) {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const t = setInterval(() => {
      setVisible(false);
      window.setTimeout(() => { setI((p) => (p + 1) % items.length); setVisible(true); }, 260);
    }, 4500);
    return () => clearInterval(t);
  }, [paused, items.length]);

  const item = items[i];
  if (!item) return null;

  const jumpTo = (idx: number) => {
    if (idx === i) return;
    setVisible(false);
    window.setTimeout(() => { setI(idx); setVisible(true); }, 200);
  };

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="overflow-hidden rounded-xl border border-white/15 bg-white/[0.07] shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">News &amp; Updates</span>
      </div>
      <div className={cn("flex items-start gap-3 px-4 py-3 transition-all duration-300 ease-out", visible ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0")}>
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: "color-mix(in srgb, var(--brand-2) 30%, transparent)" }}>
          <SiteIcon name={item.icon} className="h-4 w-4" style={{ color: "var(--brand-2)" }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.tag && (
              <span className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white" style={{ backgroundColor: "var(--brand-2)" }}>
                {item.tag}
              </span>
            )}
            <span className="text-[13px] font-semibold leading-tight text-white">{item.title}</span>
            {item.date && <span className="text-[10px] text-white/45">{item.date}</span>}
          </div>
          {item.text && <p className="mt-1 text-[11.5px] leading-snug text-white/60">{item.text}</p>}
        </div>
      </div>
      {items.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-2.5">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Show update ${idx + 1}`}
              onClick={() => jumpTo(idx)}
              className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-4 bg-white/80" : "w-1.5 bg-white/25 hover:bg-white/40")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Capability strip — a solid pill-shaped bar of icon+label chips, sitting
 *  right below the module cards. Website CMS → Theme & Identity → "Login —
 *  Capability Strip". Colour is a solid darkened brand-1 fill (no separate
 *  colour field), icons are plain white outline circles matching the reference. */
function CapabilityStrip({ items }: { items: { icon: string; label: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-[2rem] px-6 py-5" style={{ backgroundColor: "color-mix(in srgb, var(--brand-1) 88%, black)" }}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-5">
        {items.map((it) => (
          <div key={it.label} className="flex min-w-[110px] flex-1 flex-col items-center text-center">
            <span className="mb-2 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/40">
              <SiteIcon name={it.icon} className="h-4 w-4 text-white" />
            </span>
            <p className="text-[11.5px] font-semibold leading-snug text-white">{it.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- brand icons ------ */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]">
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}

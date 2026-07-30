import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { NavigationLoader } from "@/components/ui/NavigationLoader";
import { ToastProvider } from "@/components/ui/Toast";
import { getPublishedConfig } from "@/lib/website/service";
import { DEFAULT_PRODUCT_NAME } from "@/lib/brand";

// This app is a multi-tenant, authenticated ERP/SaaS — nothing under it should
// be statically prerendered at BUILD time (content is per-tenant/per-user and
// the CMS-driven copy below must reflect live edits without a redeploy).
// Without this, Next's automatic static optimization tries to prerender every
// route, and generateMetadata() below (which reads the DB) runs once PER PAGE
// during the build — hundreds of DB round-trips against a build machine that,
// unlike the deployed runtime, may not even have DB access configured yet.
// This is a `layout.tsx` setting, so it cascades to every nested route.
export const dynamic = "force-dynamic";

/** Title/description follow the portal system setting (Website CMS identity). */
export async function generateMetadata(): Promise<Metadata> {
  let name = DEFAULT_PRODUCT_NAME;
  try {
    const cfg = await getPublishedConfig();
    const n = cfg.identity?.productName?.trim();
    if (n) name = n;
  } catch {
    /* DB unavailable — fall back to the default brand */
  }
  return {
    // `default` is used by pages that set no title of their own; `template`
    // appends the LIVE brand name (from Website CMS identity) to every page that
    // sets a page-specific title (e.g. "Dashboard" → "Dashboard · <brand>"). This
    // is why no page needs to hardcode the product name in its <title>.
    title: {
      default: `${name} — Enterprise Retail ERP & POS`,
      template: `%s · ${name}`,
    },
    description:
      "Premium, enterprise-grade Retail ERP + POS for SaaS and On-Premise. Built for grocery, pharmacy, textile, electronics and multi-store retail chains.",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#4338CA",
};

/**
 * Inline script runs before paint to set data-theme/data-density from storage,
 * preventing a flash of the wrong theme (FOUC). Mirrors ThemeProvider defaults.
 */
const themeInit = `
(function(){
  try {
    var t = localStorage.getItem('oneerp.theme') || 'corporate';
    var d = localStorage.getItem('oneerp.density') || 'comfortable';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-density', d);
    var b = localStorage.getItem('oneerp.brand');
    if (b) {
      var c = JSON.parse(b), s = document.documentElement.style;
      if (c.primaryColor) s.setProperty('--color-primary', c.primaryColor);
      if (c.secondaryColor) s.setProperty('--color-secondary', c.secondaryColor);
      if (c.accentColor) s.setProperty('--color-accent', c.accentColor);
      if (c.fontFamily) s.setProperty('--font-sans', c.fontFamily);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="corporate" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <NavigationLoader />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { getPublishedConfig } from "@/lib/website/service";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

/** SEO comes from the CMS-managed config (fully editable by the Product Owner). */
export async function generateMetadata(): Promise<Metadata> {
  const c = await getPublishedConfig();
  return {
    title: c.seo.title,
    description: c.seo.description,
    keywords: c.seo.keywords,
    openGraph: { title: c.seo.title, description: c.seo.description, type: "website", images: c.seo.ogImage ? [c.seo.ogImage] : undefined },
    twitter: { card: "summary_large_image", title: c.seo.title, description: c.seo.description },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const config = await getPublishedConfig();
  // Brand colours from the CMS override the theme tokens for the public site only.
  const brand = {
    "--color-primary": config.identity.primaryColor,
    "--color-secondary": config.identity.secondaryColor,
    "--color-accent": config.identity.accentColor,
  } as React.CSSProperties;
  return (
    <div style={brand} className="min-h-screen bg-background">
      <SiteHeader config={config} />
      <main>{children}</main>
      <SiteFooter config={config} />
      <a href={`https://wa.me/${config.footer.contactPhone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-xl shadow-black/20 transition hover:scale-110">
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
}

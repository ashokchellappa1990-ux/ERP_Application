import { getPublishedConfig } from "@/lib/website/service";

export const dynamic = "force-dynamic";

/**
 * The sign-in page colours come from the platform **Website CMS theme config**
 * (published identity primary/secondary/accent), injected here as --brand-1/2/3.
 * So changing the website/portal theme re-colours the login. (The left-panel
 * showcase image `identity.loginImageUrl` is fetched client-side by the page.)
 */
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const c = await getPublishedConfig();
  const vars = {
    "--brand-1": c.identity.primaryColor,
    "--brand-2": c.identity.secondaryColor,
    "--brand-3": c.identity.accentColor,
  } as React.CSSProperties;
  return <div style={vars}>{children}</div>;
}

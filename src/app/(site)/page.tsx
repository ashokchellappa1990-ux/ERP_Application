import { getPublishedConfig } from "@/lib/website/service";
import { HomeSections } from "@/components/site/sections";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const config = await getPublishedConfig();
  return <HomeSections config={config} />;
}

import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

/**
 * Catch-all for module routes that don't have a dedicated page yet
 * (Masters, Purchase, Inventory, POS, CRM, …). Renders a branded
 * placeholder inside the app shell so every sidebar feature is navigable
 * instead of 404-ing. The specific /dashboard route takes precedence.
 */
export default function ModuleCatchAll({
  params,
}: {
  params: { slug: string[] };
}) {
  const path = "/" + params.slug.join("/");
  return <ModulePlaceholder path={path} />;
}

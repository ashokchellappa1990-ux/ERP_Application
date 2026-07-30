import { DispatchTabs } from "@/components/warehouse/dispatch/DispatchTabs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Stock Transfer Dispatch · Oasys Orbit" };
export default function Page({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = (searchParams.tab === "history" ? "history" : "dispatches") as "dispatches" | "history";
  return <DispatchTabs initialTab={tab} />;
}

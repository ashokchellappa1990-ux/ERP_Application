import { TargetList } from "@/components/sales/target/TargetList";
import { TargetTabs } from "@/components/sales/target/TargetTabs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Target Planning · Sales" };
export default function Page() { return <div className="space-y-4"><TargetTabs active="planning" /><TargetList /></div>; }

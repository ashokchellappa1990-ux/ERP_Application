import { TargetPerformance } from "@/components/sales/target/TargetPerformance";
import { TargetTabs } from "@/components/sales/target/TargetTabs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Performance Analysis · Sales" };
export default function Page() { return <div className="space-y-4"><TargetTabs active="performance" /><TargetPerformance /></div>; }

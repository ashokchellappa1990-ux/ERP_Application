import { TargetAchievement } from "@/components/sales/target/TargetAchievement";
import { TargetTabs } from "@/components/sales/target/TargetTabs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Target Achievement · Sales" };
export default function Page() { return <div className="space-y-4"><TargetTabs active="achievement" /><TargetAchievement /></div>; }

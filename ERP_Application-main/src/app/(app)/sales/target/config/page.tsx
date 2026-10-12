import { TargetConfig } from "@/components/sales/target/TargetConfig";
import { TargetTabs } from "@/components/sales/target/TargetTabs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sales Target Configuration" };
export default function Page() { return <div className="space-y-4"><TargetTabs active="config" /><TargetConfig /></div>; }

import { TargetApproval } from "@/components/sales/target/TargetApproval";
import { TargetTabs } from "@/components/sales/target/TargetTabs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Target Approval · Sales · Oasys Orbit" };
export default function Page() { return <div className="space-y-4"><TargetTabs active="approval" /><TargetApproval /></div>; }

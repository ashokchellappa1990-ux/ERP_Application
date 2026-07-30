import { TargetRevision } from "@/components/sales/target/TargetRevision";
import { TargetTabs } from "@/components/sales/target/TargetTabs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Target Revision · Sales · Oasys Orbit" };
export default function Page() { return <div className="space-y-4"><TargetTabs active="revision" /><TargetRevision /></div>; }

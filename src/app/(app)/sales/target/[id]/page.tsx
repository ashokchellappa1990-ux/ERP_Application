import { TargetView } from "@/components/sales/target/TargetView";
export const dynamic = "force-dynamic";
export default function Page({ params }: { params: { id: string } }) { return <TargetView targetId={Number(params.id)} />; }

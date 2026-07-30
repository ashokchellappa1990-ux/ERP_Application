import { TargetEditor } from "@/components/sales/target/TargetEditor";
export const dynamic = "force-dynamic";
export default function Page({ params }: { params: { id: string } }) { return <TargetEditor targetId={Number(params.id)} />; }

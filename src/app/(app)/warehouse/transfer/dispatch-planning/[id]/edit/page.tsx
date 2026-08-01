import { DispatchPlanningEditor } from "@/components/transport/DispatchPlanningEditor";
export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Dispatch Plan" };
export default function Page({ params }: { params: { id: string } }) { return <DispatchPlanningEditor planId={Number(params.id)} />; }

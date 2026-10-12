import { DispatchPlanningView } from "@/components/transport/DispatchPlanningView";
export const dynamic = "force-dynamic";
export const metadata = { title: "Dispatch Plan" };
export default function Page({ params }: { params: { id: string } }) { return <DispatchPlanningView id={Number(params.id)} />; }

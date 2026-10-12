import { DispatchExecutionView } from "@/components/transport/DispatchExecutionView";
export const dynamic = "force-dynamic";
export const metadata = { title: "Dispatch Execution" };
export default function Page({ params }: { params: { id: string } }) { return <DispatchExecutionView id={Number(params.id)} />; }

import { AdvanceEditor } from "@/components/advance/AdvanceEditor";
export default function Page({ params }: { params: { id: string } }) { return <AdvanceEditor advanceId={Number(params.id)} />; }

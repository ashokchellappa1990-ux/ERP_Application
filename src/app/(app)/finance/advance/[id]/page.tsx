import { AdvanceView } from "@/components/advance/AdvanceView";
export default function Page({ params }: { params: { id: string } }) { return <AdvanceView id={Number(params.id)} />; }

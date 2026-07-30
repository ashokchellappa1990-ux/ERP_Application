import { RevisionForm } from "@/components/finance/RevisionForm";
export default function Page({ params }: { params: { id: string } }) { return <RevisionForm mode="view" id={Number(params.id)} />; }

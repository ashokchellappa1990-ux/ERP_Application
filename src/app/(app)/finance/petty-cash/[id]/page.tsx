import { PettyCashView } from "@/components/finance/PettyCashView";

export default function PettyCashViewPage({ params }: { params: { id: string } }) {
  return <PettyCashView id={Number(params.id)} />;
}

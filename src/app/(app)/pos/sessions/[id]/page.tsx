import { SessionView } from "@/components/pos/SessionView";

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  return <SessionView id={params.id} />;
}

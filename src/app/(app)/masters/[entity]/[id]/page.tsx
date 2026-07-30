import { MasterDetail } from "@/components/masters/MasterViews";

export default function MasterDetailPage({
  params,
}: {
  params: { entity: string; id: string };
}) {
  return <MasterDetail slug={params.entity} id={params.id} />;
}

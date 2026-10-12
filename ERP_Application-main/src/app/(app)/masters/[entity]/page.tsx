import { MasterList } from "@/components/masters/MasterViews";

export default function MasterListPage({ params }: { params: { entity: string } }) {
  return <MasterList slug={params.entity} />;
}

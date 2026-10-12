import { MasterForm } from "@/components/masters/MasterViews";

export default function MasterCreatePage({ params }: { params: { entity: string } }) {
  return <MasterForm slug={params.entity} />;
}

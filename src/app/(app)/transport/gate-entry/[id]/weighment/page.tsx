import { redirect } from "next/navigation";

// Raw Material weighing now goes through the common First Weighment menu
// (Purchase type); kept as a redirect so old links/bookmarks still land there.
export default function Page({ params }: { params: { id: string } }) {
  redirect(`/transport/pre-weighment/new?gateEntryId=${encodeURIComponent(params.id)}`);
}

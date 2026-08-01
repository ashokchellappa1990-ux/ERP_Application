import { LoadDispatchEditor } from "@/components/transport/LoadDispatchEditor";
export const dynamic = "force-dynamic";
export const metadata = { title: "Load & Dispatch" };
export default function Page({ params }: { params: { id: string } }) {
  return <LoadDispatchEditor id={Number(params.id)} />;
}

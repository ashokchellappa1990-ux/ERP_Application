import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getActiveScope } from "@/lib/auth/scope";
import { getRequest } from "@/lib/warehouse/transfer";
import { StockTransferEditor } from "@/components/warehouse/transfer/StockTransferEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Stock Transfer Request · Oasys Orbit" };

export default async function Page({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const id = Number(params.id);
  const data = await getRequest(await getActiveScope(user), id);
  if (!data) notFound();
  if (!data.editable) redirect(`/warehouse/transfer/request/${id}`);
  return <StockTransferEditor id={id} existing={{ header: data.header, lines: data.lines }} />;
}

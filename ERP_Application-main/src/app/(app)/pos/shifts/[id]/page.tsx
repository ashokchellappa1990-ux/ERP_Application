import { ShiftEditor } from "@/components/pos/ShiftEditor";

export default function EditShiftPage({ params }: { params: { id: string } }) {
  return <ShiftEditor id={Number(params.id)} />;
}

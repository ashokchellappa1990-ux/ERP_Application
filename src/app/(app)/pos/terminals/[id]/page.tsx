import { TerminalEditor } from "@/components/pos/TerminalEditor";

export default function EditTerminalPage({ params }: { params: { id: string } }) {
  return <TerminalEditor id={Number(params.id)} />;
}

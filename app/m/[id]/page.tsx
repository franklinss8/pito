import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMachine } from "@/lib/machines";
import { MachineConsole } from "@/components/MachineConsole";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const m = await getMachine(params.id).catch(() => null);
  return m ? { title: `$${m.symbol} machine · Pito`, description: m.mission } : { title: "Machine · Pito" };
}

export default async function MachinePage({ params }: { params: { id: string } }) {
  const m = await getMachine(params.id);
  if (!m) notFound();
  return <main><div className="wrap"><MachineConsole initial={m} /></div></main>;
}

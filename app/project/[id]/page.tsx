import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMachine } from "@/lib/machines";
import { ProjectPage } from "@/components/ProjectPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const m = await getMachine(params.id).catch(() => null);
  if (!m) return { title: "Machine · Pito" };
  return { title: `${m.name} $${m.symbol} · Pito`, description: m.description || m.mission, openGraph: m.image_url ? { images: [m.image_url] } : undefined };
}

export default async function Project({ params, searchParams }: { params: { id: string }; searchParams: { launch?: string } }) {
  const m = await getMachine(params.id);
  if (!m) notFound();
  return <main className="wrap"><ProjectPage initial={m} justCreated={searchParams.launch === "1"} /></main>;
}

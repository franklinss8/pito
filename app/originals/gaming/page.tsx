import type { Metadata } from "next";
import { listMachines } from "@/lib/machines";
import { MachineCard } from "@/components/MachineCard";

export const metadata: Metadata = { title: "Cloud Gaming · Pito" };
export const dynamic = "force-dynamic";

export default async function Gaming() {
  const games = (await listMachines({ limit: 100 }).catch(() => [])).filter((m) => m.app_updated_at && /game|play|arcade/i.test(`${m.mission} ${m.plan?.summary ?? ""}`));
  return (
    <main className="wrap" style={{ paddingBlock: 40 }}>
      <div className="label acc">originals · cloud gaming</div>
      <h1 style={{ fontSize: "clamp(38px,6vw,64px)", margin: "8px 0 12px" }}>Games on Pito computers.</h1>
      <p className="sub" style={{ fontSize: 15 }}>Every machine whose mission is a game shows up here once its app is live. Play directly in the browser; the GPU does the work.</p>
      {games.length === 0 ? (
        <div className="empty"><h3>No game machines live yet</h3><p>Launch a token with a game mission (there are templates for that) and it will appear here as soon as the AI ships a playable build.</p><div><a className="btn primary" href="/launch">Launch a game machine →</a></div></div>
      ) : <div className="grid">{games.map((m) => <MachineCard key={m.id} m={m} />)}</div>}
    </main>
  );
}

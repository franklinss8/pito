import type { Metadata } from "next";
import { env } from "@/lib/env";
import { listMachines } from "@/lib/machines";

export const metadata: Metadata = { title: "Originals · Pito", description: "Pito Originals: Cloud Gaming, Open Models, Rent and private Automation agents." };
export const dynamic = "force-dynamic";

export default async function Originals() {
  const machines = await listMachines({ limit: 100 }).catch(() => []);
  const free = Math.max(0, 10 - machines.filter((m) => m.status === "running").length);
  const models = env.houseModelUrl ? "live · free for holders" : "installing on our computers";
  const cards = [
    { t: "Cloud Gaming", badge: `preview · ${free}/10 computers free`, p: "Games ready to play on GPU computers, directly in the browser. Opens with the first gaming machines.", href: "/originals/gaming", btn: "Open" },
    { t: "Open Models", badge: models, p: "Selected Hugging Face models hosted on Pito GPUs. Holders of any Pito token chat for free; Pito covers the compute.", href: "/originals/models", btn: "Open", sub: "models from hugging face" },
    { t: "Rent", badge: "pay per hour · ETH", p: "Rent a Pito computer as your own workspace. Isolated, full access, Jupyter and a terminal in the browser.", href: "/rent", btn: "Rent" },
    { t: "Automation", badge: "private · wallet-owned", p: "Brainstorm with your own agent, fund its wallet, and review its orders. Built on the same machines.", href: "/originals/automation", btn: "Open" },
  ];
  return (
    <main className="wrap" style={{ paddingBlock: 40 }}>
      <div className="label acc">built by pito · for holders</div>
      <h1 style={{ fontSize: "clamp(40px,6vw,72px)", margin: "8px 0 12px" }}>originals</h1>
      <p className="sub" style={{ fontSize: 15 }}>Products built by Pito on its own machines: gaming, models, computers and personal automation agents.</p>
      <div className="grid" style={{ marginTop: 24 }}>
        {cards.map((c) => (
          <div key={c.t} className="machine">
            <div className="head"><div className="ticker" style={{ fontSize: 24 }}>{c.t}</div><span className="status on"><span className="dot on" />{c.badge}</span></div>
            <div className="mission">{c.p}</div>
            {c.sub && <div className="label">{c.sub}</div>}
            <a className="btn block primary" href={c.href}>{c.btn} →</a>
          </div>
        ))}
      </div>
    </main>
  );
}

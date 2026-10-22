import { MachineCard } from "@/components/MachineCard";
import { HeroArt } from "@/components/HeroArt";
import { Terminal } from "@/components/Terminal";
import { Steps } from "@/components/Steps";
import { listMachines } from "@/lib/machines";
import type { Machine } from "@/lib/db";

export const dynamic = "force-dynamic";

async function load(sort: "new" | "mcap"): Promise<{ machines: Machine[]; ok: boolean }> {
  try { return { machines: await listMachines({ sort, limit: 30 }), ok: true }; }
  catch (e) { console.error("load machines", e instanceof Error ? e.message : e); return { machines: [], ok: false }; }
}

export default async function Discover({ searchParams }: { searchParams: { sort?: string } }) {
  const sort = searchParams.sort === "mcap" ? "mcap" : "new";
  const { machines, ok } = await load(sort);
  const live = machines.filter((m) => m.status === "running").length;
  return (
    <main>
      <div className="hero">
        <HeroArt />
        <div className="wrap">
          <div className="copy">
            <div className="eyebrow">Ethereum mainnet / compute protocol</div>
            <h1>Give your token a&nbsp;computer.</h1>
            <p className="lede">Every token launched here gets its own GPU and an AI that works on it. <span>You decide what it builds: for your holders, for a use case, for anyone.</span></p>
            <div className="ctas">
              <a className="btn primary" href="/launch">Launch a machine →</a>
              <a className="btn ghost" href="#machines">Browse machines ↓</a>
            </div>
          </div>
          <div className="corner tr">Decentralized compute<br />AI agents per token<br />Ethereum mainnet</div>
          <div className="corner mr">A more<br />capable<br />internet</div>
          <div className="corner bl">GPU compute<br />AI agents<br />Open templates<br />Onchain ownership</div>
          <div className="corner br">Compute<br />Culture<br />Ownership<br />For every token</div>
        </div>
      </div>

      <Terminal />

      <section className="block" id="machines">
        <div className="wrap">
          <div className="sec-head">
            <h2>Machines, online.</h2>
            <p>{live} live machine{live === 1 ? "" : "s"}. Each token comes with a GPU computer and an AI agent. Explore live machines, launch your own, or start from a template.</p>
            <div className="chips">
              <a className={`chip ${sort === "new" ? "active" : ""}`} href="/?sort=new#machines">newest</a>
              <a className={`chip ${sort === "mcap" ? "active" : ""}`} href="/?sort=mcap#machines">market cap</a>
            </div>
          </div>
          {!ok && <div className="empty"><h3>Machines unavailable</h3><p>Pito could not reach its database. Refresh in a moment.</p></div>}
          {ok && machines.length === 0 && (
            <div className="empty">
              <h3>No machines yet</h3>
              <p>Registered tokens appear here with their agent, GPU and live screen. Launch yours: describe what to build, pick a GPU, launch the coin on Programmable.</p>
              <div><a className="btn primary" href="/launch">Launch the first machine →</a></div>
            </div>
          )}
          {machines.length > 0 && <div className="grid">{machines.map((m) => <MachineCard key={m.id} m={m} />)}</div>}
        </div>
      </section>

      <Steps />
    </main>
  );
}

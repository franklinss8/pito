import { db, PUBLIC_MACHINE_COLUMNS, type Machine } from "@/lib/db";
import { MachineCard } from "@/components/MachineCard";
import { LaunchSection } from "@/components/LaunchSection";
import { HeroArt } from "@/components/HeroArt";
import { Terminal } from "@/components/Terminal";
import { Steps } from "@/components/Steps";

export const dynamic = "force-dynamic";

async function loadMachines(): Promise<{ machines: Machine[]; ok: boolean }> {
  try {
    const { data, error } = await db().from("machines").select(PUBLIC_MACHINE_COLUMNS).order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    return { machines: (data ?? []) as Machine[], ok: true };
  } catch (e) {
    console.error("load machines", e instanceof Error ? e.message : e);
    return { machines: [], ok: false };
  }
}

export default async function Home() {
  const { machines, ok } = await loadMachines();
  return (
    <main>
      <div className="hero">
        <HeroArt />
        <div className="wrap">
          <div className="copy">
            <div className="eyebrow">Ethereum mainnet / compute protocol</div>
            <h1>Give your token a&nbsp;computer.</h1>
            <p className="lede">A token. A GPU. An agent. <span>Your machine starts here.</span></p>
            <div className="ctas">
              <a className="btn primary" href="#launch">Launch a machine →</a>
              <a className="btn ghost" href="#machines">Explore computers</a>
            </div>
          </div>
          <div className="corner tr">Decentralized compute<br />AI agents per token<br />Ethereum mainnet</div>
          <div className="corner ml">Tokens<br />power<br />intelligence</div>
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
            <p>Each token comes with a GPU computer and an AI agent. Explore live machines, launch your own, or start from a template.</p>
            <a className="more" href="#launch">Launch yours →</a>
          </div>
          {!ok && <div className="empty"><h3>Machines unavailable</h3><p>Pito could not reach its database. Refresh in a moment.</p></div>}
          {ok && machines.length === 0 && (
            <div className="empty">
              <h3>No machines online yet</h3>
              <p>Registered tokens appear here with their agent, GPU and live app. Launch a coin on Ethereum through Programmable, then register it below.</p>
              <div><a className="btn primary" href="#launch">Register the first machine →</a></div>
            </div>
          )}
          {machines.length > 0 && <div className="grid">{machines.map((m) => <MachineCard key={m.id} m={m} />)}</div>}
        </div>
      </section>

      <Steps />
      <LaunchSection />
    </main>
  );
}

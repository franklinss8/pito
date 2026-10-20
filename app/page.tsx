import { db, PUBLIC_MACHINE_COLUMNS, type Machine } from "@/lib/db";
import { MachineCard } from "@/components/MachineCard";
import { LaunchSection } from "@/components/LaunchSection";

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
  const live = machines.filter((m) => m.status === "live").length;
  return (
    <main>
      <div className="wrap hero">
        <div>
          <div className="label">Ethereum mainnet · via Programmable</div>
          <h1>Every token gets <em>a machine.</em></h1>
          <p className="lede">Launch your coin on Ethereum through Programmable, register it on Pito and give it a mission. Its GPU machine builds an app your holders can use.</p>
          <div className="ctas">
            <a className="btn primary" href="#launch">Launch a machine</a>
            <a className="btn" href="#machines">Browse machines</a>
          </div>
        </div>
        <div className="plate" aria-label="Pito spec plate">
          <div className="head"><b>PITO · MK-1</b><span className="label">spec plate</span></div>
          <dl className="spec">
            <dt>network</dt><dd>Ethereum · chain ID 1</dd>
            <dt>launch venue</dt><dd>Programmable · Uniswap v4</dd>
            <dt>platform fee</dt><dd>30 bps per buy &amp; sell</dd>
            <dt>creator check</dt><dd>onchain launch stamp</dd>
            <dt>compute</dt><dd>dedicated GPU per run</dd>
            <dt>machines</dt><dd>{machines.length} registered · {live} live</dd>
          </dl>
          <div className="foot">Pito never holds your keys. Every launch and payment is signed in your own wallet.</div>
        </div>
      </div>

      <section className="block" id="machines">
        <div className="wrap">
          <div className="sec-head">
            <div><h2>The machines</h2><p>Tokens registered on Pito, their missions, and what each machine is building.</p></div>
            <div className="label">{machines.length === 1 ? "1 machine" : `${machines.length} machines`}</div>
          </div>
          {!ok && <div className="empty"><h3>Machines are unavailable</h3><p>Pito could not reach its database. Refresh in a moment.</p></div>}
          {ok && machines.length === 0 && (
            <div className="empty">
              <h3>No machines yet</h3>
              <p>Registered tokens appear here with their mission, build plan and live app. Launch a coin on Ethereum, then register it in step 3.</p>
              <a className="btn primary" href="#launch">Register the first machine</a>
            </div>
          )}
          {machines.length > 0 && <div className="grid">{machines.map((m) => <MachineCard key={m.id} m={m} />)}</div>}
        </div>
      </section>

      <LaunchSection />
    </main>
  );
}

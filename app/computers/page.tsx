import type { Metadata } from "next";
import { listMachines } from "@/lib/machines";
import { fmtCap, machineState } from "@/components/MachineCard";
import { AI_MODELS } from "@/lib/templates";

export const metadata: Metadata = { title: "Computers · Pito", description: "Every live Pito token and the computer it runs." };
export const dynamic = "force-dynamic";

export default async function Computers({ searchParams }: { searchParams: { sort?: string } }) {
  const sort = searchParams.sort === "mcap" ? "mcap" : "new";
  const all = await listMachines({ sort, limit: 100 }).catch(() => []);
  const launched = all.filter((m) => m.token_address);
  const running = all.filter((m) => machineState(m).cls === "on").length;
  const apps = all.filter((m) => m.app_updated_at).length;
  const cap = launched.reduce((s, m) => s + (m.market_cap_usd ?? 0), 0);
  const modelName = (id: string) => AI_MODELS.find((x) => x.id === id)?.name ?? id;
  return (
    <main className="wrap" style={{ paddingBlock: 40 }}>
      <span className="status on"><span className="dot on" />live</span>
      <h1 style={{ fontSize: "clamp(40px,6vw,72px)", margin: "8px 0 24px" }}>computers</h1>
      <div className="stats">
        <div><span className="label">Tokens launched</span><b>{launched.length}</b></div>
        <div><span className="label">Computers running</span><b>{running}</b></div>
        <div><span className="label">Apps live</span><b>{apps}</b></div>
        <div><span className="label">Total market cap</span><b>{fmtCap(cap)}</b></div>
      </div>
      <div className="chips" style={{ margin: "22px 0 12px" }}>
        <a className={`chip ${sort === "new" ? "active" : ""}`} href="/computers?sort=new">newest</a>
        <a className={`chip ${sort === "mcap" ? "active" : ""}`} href="/computers?sort=mcap">market cap</a>
      </div>
      <div className="tbl">
        <table className="fee-table">
          <thead><tr><th>token</th><th>gpu</th><th>ai model</th><th>status</th><th className="n">market cap</th><th></th></tr></thead>
          <tbody>
            {all.length === 0 && <tr><td colSpan={6} className="fine">No computers yet. <a href="/launch">Launch the first one.</a></td></tr>}
            {all.map((m) => { const s = machineState(m); return (
              <tr key={m.id}>
                <td><a href={`/project/${m.id}`} style={{ textDecoration: "none", display: "flex", gap: 10, alignItems: "center" }}>
                  {m.image_url ? <img src={m.image_url} alt="" width={26} height={26} style={{ width: 26, height: 26, objectFit: "cover" }} /> : <span style={{ width: 26, height: 26, background: "var(--line)", display: "inline-block" }} />}
                  <span><b>{m.name}</b> <span className="fine">(${m.symbol})</span></span></a></td>
                <td>{m.gpu_name ? `${m.gpu_name} · ${m.vram_gb}GB` : "pending"}</td>
                <td>{modelName(m.ai_model)}</td>
                <td><span className={`status ${s.cls}`}><span className={`dot ${s.cls}`} />{s.text}</span></td>
                <td className="n">{fmtCap(m.market_cap_usd)}</td>
                <td>{m.token_address ? <a href={`https://programmable.market/token/${m.token_address}`} target="_blank" rel="noopener noreferrer" className="fine">programmable ↗</a> : <span className="fine">pre-launch</span>}</td>
              </tr>); })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

import type { Machine } from "@/lib/db";
import { MachineArt } from "./MachineArt";

export function machineState(m: Pick<Machine, "status" | "last_seen_at" | "app_updated_at">): { cls: string; text: string } {
  const stale = !m.last_seen_at || Date.now() - Date.parse(m.last_seen_at) > 120_000;
  if (m.status === "running" && !stale) return { cls: "on", text: m.app_updated_at ? "running · app live" : "running" };
  if (m.status === "running" || m.status === "starting") return { cls: "warn", text: "starting" };
  if (m.status === "prelaunch") return { cls: "", text: "pre-launch" };
  if (m.status === "bound") return { cls: "warn", text: "launched · waiting for compute" };
  if (m.status === "stopped") return { cls: "", text: "stopped" };
  if (m.status === "error") return { cls: "bad", text: "error" };
  return { cls: "", text: m.status };
}

export function StatusDot({ m }: { m: Pick<Machine, "status" | "last_seen_at" | "app_updated_at"> }) {
  const s = machineState(m);
  return <span className={`status ${s.cls}`}><span className={`dot ${s.cls}`} />{s.text}</span>;
}

export function fmtCap(v: number | null | undefined) {
  if (!v) return "—";
  return v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`;
}

export function MachineCard({ m }: { m: Machine }) {
  return (
    <a className="machine" href={`/project/${m.id}`}>
      <div className="head">
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          {m.image_url ? <img src={m.image_url} alt="" width={40} height={40} style={{ width: 40, height: 40, objectFit: "cover", border: "1px solid var(--line)" }} /> : null}
          <div style={{ minWidth: 0 }}><div className="ticker">{m.symbol || "?"}</div><div className="name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name || "Unnamed token"}</div></div>
        </div>
        <StatusDot m={m} />
      </div>
      <MachineArt seed={m.token_address || m.id} />
      <div className="mission">{m.plan?.summary || m.mission}</div>
      <div className="meta">
        <div><span className="label">GPU</span><span className="v">{m.gpu_name ? `${m.gpu_name}${m.vram_gb ? ` · ${m.vram_gb}GB` : ""}` : "pending"}</span></div>
        <div><span className="label">Mcap</span><span className="v">{fmtCap(m.market_cap_usd)}</span></div>
        <div><span className="label">Chain</span><span className="v">Ethereum</span></div>
      </div>
      <span className="btn block">Open machine →</span>
    </a>
  );
}

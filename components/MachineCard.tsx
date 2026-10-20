import type { Machine } from "@/lib/db";
import { MachineArt } from "./MachineArt";

export function StatusDot({ status }: { status: Machine["status"] }) {
  const map: Record<string, [string, string]> = {
    planning: ["warn", "planning"],
    ready: ["", "ready"],
    plan_failed: ["bad", "plan failed"],
    running: ["on", "building"],
    live: ["on", "running"],
  };
  const [cls, text] = map[status] ?? ["", status];
  return <span className={`status ${cls}`}><span className={`dot ${cls}`} />{text}</span>;
}

export function PlanBox({ plan }: { plan: Machine["plan"] }) {
  if (!plan || !plan.steps?.length) return plan?.summary ? <div className="plan">{plan.summary}</div> : null;
  return (
    <div className="plan">
      <span className="label acc">Build plan</span>
      {plan.summary && <div style={{ marginTop: 6 }}>{plan.summary}</div>}
      <ol>{plan.steps.map((s, i) => <li key={i}><b>{s.title}</b>{s.detail ? ` — ${s.detail}` : ""}</li>)}</ol>
      <div className="meta2">
        {plan.gpu && <span>GPU · {plan.gpu}</span>}
        {plan.deliverable && <span>Ships · {plan.deliverable}</span>}
      </div>
    </div>
  );
}

export function MachineCard({ m }: { m: Machine }) {
  return (
    <a className="machine" href={`/m/${m.id}`}>
      <div className="head">
        <div><div className="ticker">{m.symbol || "?"}</div><div className="name">{m.name || "Unnamed token"}</div></div>
        <StatusDot status={m.status} />
      </div>
      <MachineArt seed={m.token_address} />
      <div className="meta">
        <div><span className="label">GPU</span><span className="v">{m.plan?.gpu || "pending"}</span></div>
        <div><span className="label">Agent</span><span className="v">{m.name ? `${m.name} Agent` : "Agent"}</span></div>
        <div><span className="label">Chain</span><span className="v">Ethereum Mainnet</span></div>
      </div>
      <span className="btn block">Open machine →</span>
    </a>
  );
}

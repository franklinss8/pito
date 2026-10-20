import type { Machine } from "@/lib/db";

export function statusChip(status: Machine["status"]) {
  const map: Record<string, [string, string]> = {
    planning: ["wait", "drafting plan"],
    ready: ["idle", "ready to run"],
    plan_failed: ["bad", "plan failed"],
    running: ["wait", "building on GPU"],
    live: ["ok", "app live"],
  };
  const [cls, text] = map[status] ?? ["idle", status];
  return <span className={`chip ${cls}`}>{text}</span>;
}

export function PlanBox({ plan }: { plan: Machine["plan"] }) {
  if (!plan || !plan.steps?.length) return plan?.summary ? <div className="plan">{plan.summary}</div> : null;
  return (
    <div className="plan">
      <span className="label">Build plan</span>
      {plan.summary && <div style={{ marginTop: 6 }}>{plan.summary}</div>}
      <ol>{plan.steps.map((s, i) => <li key={i}><b>{s.title}</b>{s.detail ? ` — ${s.detail}` : ""}</li>)}</ol>
      <div className="meta">
        {plan.gpu && <span>GPU · {plan.gpu}</span>}
        {plan.deliverable && <span>Ships · {plan.deliverable}</span>}
      </div>
    </div>
  );
}

export function MachineCard({ m }: { m: Machine }) {
  return (
    <a className="machine" href={`/m/${m.id}`}>
      <div className="row"><span className="ticker">${m.symbol || "?"}</span>{statusChip(m.status)}</div>
      <div className="name">{m.name || "Unnamed token"}</div>
      <div className="mission">{m.mission}</div>
      <PlanBox plan={m.plan} />
      <div className="addr">{m.token_address}</div>
    </a>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Automation · Pito" };

export default function Automation() {
  return (
    <main className="wrap" style={{ paddingBlock: 40, maxWidth: 860 }}>
      <div className="label acc">originals · automation · private</div>
      <h1 style={{ fontSize: "clamp(38px,6vw,64px)", margin: "8px 0 12px" }}>Your own agent, on your own computer.</h1>
      <p className="sub" style={{ fontSize: 15 }}>A private Pito machine that answers only to your wallet: brainstorm with it, give it a budget, review what it wants to do before it does it. It runs on the same computers as token machines, without the public screen.</p>
      <div className="bench">
        <div className="step"><div className="num">01</div><div><h3>Rent a computer</h3><p className="sub" style={{ margin: 0 }}>Pick a GPU and the Desktop or Ollama template on the Rent page. It boots with Jupyter and a terminal.</p></div></div>
        <div className="step"><div className="num">02</div><div><h3>Install the agent</h3><p className="sub" style={{ margin: 0 }}>In the terminal, run the Pito agent in private mode: <code className="mono">curl -fsSL https://pito-three.vercel.app/agent/agent.py -o agent.py</code>. Point it at a local Ollama model so nothing leaves your machine.</p></div></div>
        <div className="step"><div className="num">03</div><div><h3>Review its orders</h3><p className="sub" style={{ margin: 0 }}>The agent proposes actions as JSON; you approve them from the notebook. Wallet-signed orders are on the roadmap.</p></div></div>
      </div>
      <div className="ctas" style={{ marginTop: 28 }}><a className="btn primary" href="/rent">Rent a computer →</a></div>
    </main>
  );
}

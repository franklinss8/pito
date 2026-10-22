import type { Metadata } from "next";

export const metadata: Metadata = { title: "Automation · Pito" };

export default function Automation() {
  return (
    <main className="wrap" style={{ paddingBlock: 40, maxWidth: 860 }}>
      <div className="label acc">originals · automation · coming</div>
      <h1 style={{ fontSize: "clamp(38px,6vw,64px)", margin: "8px 0 12px" }}>Your own agent, on your own computer.</h1>
      <p className="sub" style={{ fontSize: 15 }}>A private Pito machine that answers only to your wallet: brainstorm with it, give it a budget, review what it wants to do before it does it. It will run on the same computers as token machines, without the public screen. Today you can already rent the computer and drive it yourself.</p>
      <div className="bench">
        <div className="step"><div className="num">01</div><div><h3>Rent a computer</h3><p className="sub" style={{ margin: 0 }}>Pick a GPU and the Desktop or Ollama template on the Rent page. It boots with Jupyter and a terminal.</p></div></div>
        <div className="step"><div className="num">02</div><div><h3>Run your own model</h3><p className="sub" style={{ margin: 0 }}>The Ollama template ships with a local coding model; nothing leaves your computer. Drive it from Jupyter or the terminal with your own scripts.</p></div></div>
        <div className="step"><div className="num">03</div><div><h3>Private agent (next)</h3><p className="sub" style={{ margin: 0 }}>The Pito agent in private mode, proposing actions you approve with a wallet signature before they run, is the next Originals release.</p></div></div>
      </div>
      <div className="ctas" style={{ marginTop: 28 }}><a className="btn primary" href="/rent">Rent a computer →</a></div>
    </main>
  );
}

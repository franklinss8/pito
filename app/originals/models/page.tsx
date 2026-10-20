"use client";
import { useEffect, useState } from "react";
import { errMessage, useWallet } from "@/components/Wallet";

type Msg = { role: "user" | "assistant"; content: string };

export default function Models() {
  const { signAction } = useWallet();
  const [info, setInfo] = useState<{ available: boolean; model: string | null } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { fetch("/api/house-model").then((r) => r.json()).then(setInfo).catch(() => setInfo({ available: false, model: null })); }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim(); if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next); setInput(""); setBusy(true); setErr("");
    try {
      const { message, signature } = await signAction("request", "house-model");
      const r = await fetch("/api/house-model", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next, message, signature }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || "The model did not answer.");
      setMsgs([...next, { role: "assistant", content: j.text }]);
    } catch (e2) { setErr(errMessage(e2)); setMsgs(msgs); }
    finally { setBusy(false); }
  }

  return (
    <main className="wrap" style={{ paddingBlock: 40, maxWidth: 860 }}>
      <div className="label acc">originals · open models · models from hugging face</div>
      <h1 style={{ fontSize: "clamp(38px,6vw,64px)", margin: "8px 0 12px" }}>Open models, on our GPUs.</h1>
      <p className="sub" style={{ fontSize: 15 }}>Selected open models hosted on Pito computers. Hold any live Pito token and chat for free; Pito covers the compute. Each message is signed by your wallet, no gas.</p>
      {info && !info.available && <div className="empty"><h3>Installing on our computers</h3><p>The house model is not online yet. Check back soon, or launch a machine with an Ollama template to run your own.</p></div>}
      {info?.available && (
        <div className="panel">
          <div className="row"><span className="label">Model</span><span className="mono">{info.model}</span></div>
          <div style={{ display: "grid", gap: 10, maxHeight: 420, overflowY: "auto" }}>
            {msgs.length === 0 && <div className="fine">Say hello. The model has no memory between sessions.</div>}
            {msgs.map((m, i) => <div key={i} className={m.role === "user" ? "mission" : "plan"} style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>)}
            {busy && <div className="fine">thinking…</div>}
          </div>
          <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
            <input id="houseInput" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything" disabled={busy} />
            <button className="btn primary" type="submit" disabled={busy || !input.trim()}>Send</button>
          </form>
          {err && <div className="err">{err}</div>}
        </div>
      )}
    </main>
  );
}

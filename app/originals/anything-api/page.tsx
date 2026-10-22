"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { errMessage, useWallet } from "@/components/Wallet";
import { toast } from "@/components/Toaster";
import { StatusDot } from "@/components/MachineCard";
import { AI_MODELS } from "@/lib/templates";
import { ethToWei } from "@/lib/ethmath";
import type { Machine } from "@/lib/db";

type Gpu = { id: string; name: string; vram_gb: number; cents_per_hour: number };
const EXAMPLES = [
  "An API that takes a product URL and returns its title, price and main image as JSON. Cache results for 1 hour.",
  "Combine a weather API and a geocoding API: POST a city name, get tomorrow's forecast in Celsius plus the coordinates.",
  "An endpoint that receives a block of text and returns a 3-sentence summary and 5 tags, using a small local model on the GPU.",
  "A webhook that accepts Stripe-style events, stores them, and exposes GET /events with filters by type and date.",
];

export default function AnythingApi() {
  const { account, hasWallet, signAction, sendEth } = useWallet();
  const router = useRouter();
  const [name, setName] = useState(""); const [spec, setSpec] = useState("");
  const [gpus, setGpus] = useState<Gpu[]>([]); const [gpu, setGpu] = useState(""); const [ai, setAi] = useState(AI_MODELS[0].id);
  const [hours, setHours] = useState("3"); const [eth, setEth] = useState<number | null>(null);
  const [busy, setBusy] = useState(""); const [mine, setMine] = useState<Machine[]>([]); const [listing, setListing] = useState("");
  useEffect(() => {
    fetch("/api/gpus").then((r) => r.json()).then((j) => { const list: Gpu[] = j.gpus ?? []; setGpus(list); setGpu(list[0]?.id ?? ""); }).catch(() => {});
    fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot").then((r) => r.json()).then((j) => setEth(Number(j.data.amount))).catch(() => {});
  }, []);
  const g = gpus.find((x) => x.id === gpu); const h = Number(hours);
  const cents = g && h > 0 ? Math.ceil(g.cents_per_hour * h) : 0;
  const ethAmt = eth && cents ? (cents / 100 / eth).toFixed(5) : null;

  async function build() {
    if (!hasWallet) return toast("No Ethereum wallet found in this browser.", "err");
    if (spec.trim().length < 30) return toast("Describe the API in a few sentences first.", "err");
    if (!g) return toast("Pick a GPU.", "err");
    setBusy("build");
    try {
      toast("Sign in your wallet to create the API machine (no gas).");
      const { message, signature } = await signAction("create", "anything-api");
      const r = await fetch("/api/originals/anything-api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), spec: spec.trim(), gpuTypeId: g.id, aiModel: ai, message, signature }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || "Could not create the API machine.");
      if (j.free) { toast("Created. Free mode: the machine starts on its own."); router.push(`/project/${j.id}`); return; }
      if (!ethAmt) throw new Error("ETH price unavailable; try again in a moment.");
      toast(`Created. Now confirm the compute payment of ${ethAmt} ETH.`);
      const hash = await sendEth(j.treasury, ethToWei(ethAmt)!, "0x" + String(j.id).replace(/-/g, ""));
      toast(`Payment sent (${hash.slice(0, 10)}…). Waiting for 2 confirmations…`);
      for (let i = 0; i < 60; i++) {
        const d = await fetch(`/api/machines/${j.id}/deposit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: hash }) });
        const dj = await d.json();
        if (d.status === 202) { await new Promise((res) => setTimeout(res, 8000)); continue; }
        if (!d.ok) throw new Error(dj?.error?.message || "Payment could not be credited.");
        toast(`Funded $${(dj.cents / 100).toFixed(2)}. The machine is starting; your endpoint appears on its page.`);
        router.push(`/project/${j.id}`); return;
      }
      toast(`Still waiting for confirmations. Open your API's page and fund again with hash ${hash} later.`, "err");
      router.push(`/project/${j.id}`);
    } catch (e) { toast(errMessage(e), "err"); }
    finally { setBusy(""); }
  }

  async function loadMine() {
    if (!hasWallet) return toast("No Ethereum wallet found in this browser.", "err");
    setListing("signing");
    try {
      const { message, signature } = await signAction("request", "anything-api");
      setListing("loading");
      const r = await fetch("/api/originals/anything-api", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, signature }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || "Could not list your APIs.");
      setMine(j.apis); setListing("done"); toast(j.apis.length ? `${j.apis.length} API${j.apis.length === 1 ? "" : "s"} found.` : "No APIs yet.");
    } catch (e) { setListing(""); toast(errMessage(e), "err"); }
  }

  return (
    <main className="wrap" style={{ paddingBlock: 40 }}>
      <div className="label acc">originals · anything api</div>
      <h1 style={{ fontSize: "clamp(38px,6vw,64px)", margin: "8px 0 12px" }}>Describe an API. Get an endpoint.</h1>
      <p className="sub" style={{ fontSize: 15 }}>Describe what you need an API to do. A Pito machine figures out the flow, connects the services, tests everything, and gives you one working endpoint, with docs. Combine several APIs into one: API 1 + API 2 + custom logic → one Pito endpoint. Paid per hour of compute, in ETH.</p>
      <div className="console" style={{ paddingTop: 10 }}>
        <div className="panel">
          <div className="field"><label htmlFor="apiName">Name</label><input id="apiName" maxLength={48} value={name} onChange={(e) => setName(e.target.value)} placeholder="Price watcher API" /></div>
          <div className="field"><label htmlFor="apiSpec">What should the API do?</label>
            <textarea id="apiSpec" maxLength={4000} rows={6} value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="Inputs, outputs, services to connect, rules. The more precise, the better." />
            <div className="chips">{EXAMPLES.map((x) => <button key={x} type="button" className="chip" onClick={() => setSpec(x)}>{x.slice(0, 52)}…</button>)}</div></div>
          <div className="two">
            <div className="field"><label htmlFor="apiGpu">Computer</label>
              <select id="apiGpu" value={gpu} onChange={(e) => setGpu(e.target.value)}>{gpus.length === 0 && <option value="">No inventory</option>}{gpus.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.vram_gb} GB · ${(x.cents_per_hour / 100).toFixed(2)}/h</option>)}</select>
              <span className="hint">The cheapest GPU is enough for most APIs. Pick 24 GB+ if the API runs a local model.</span></div>
            <div className="field"><label htmlFor="apiAi">Builder AI</label>
              <select id="apiAi" value={ai} onChange={(e) => setAi(e.target.value)}>{AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          </div>
          <div className="two">
            <div className="field"><label htmlFor="apiHours">Hours of compute</label><input id="apiHours" className="mono" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /><span className="hint">Building takes 10 to 30 minutes. The rest keeps the endpoint online. Add hours any time from the machine page.</span></div>
            <div className="field"><label>Total</label><div className="plan mono">{cents ? `$${(cents / 100).toFixed(2)}${ethAmt ? ` ≈ ${ethAmt} ETH` : ""}` : "—"}</div></div>
          </div>
          <button className="btn primary" type="button" disabled={!!busy || !g} onClick={build}>{busy ? "Working…" : account ? "Sign, pay and build" : "Connect wallet to build"}</button>
          <span className="fine">The machine belongs to your wallet and the code it writes stays on it; stop it any time from its page. Its page is unlisted but public to anyone with the link, so keep secrets out of the spec and pass them as environment variables.</span>
        </div>
        <aside className="panel">
          <div className="row"><span className="label acc">My APIs</span><button className={`btn small ${listing === "signing" || listing === "loading" ? "busy" : ""}`} type="button" disabled={listing === "signing" || listing === "loading"} onClick={loadMine}>{listing === "signing" ? "Sign in wallet…" : listing === "loading" ? "Loading…" : account ? "Refresh (sign)" : "Connect & list"}</button></div>
          {mine.length === 0 && <div className="fine">{listing === "done" ? "No APIs yet. Build one on the left." : "Sign a message (no gas) to list the APIs owned by your wallet."}</div>}
          {mine.map((m) => (
            <div key={m.id} className="plan">
              <div className="row"><b>{m.name}</b><StatusDot m={m} /></div>
              <div className="fine">{m.gpu_name} · ${((m.budget_cents - m.spent_cents) / 100).toFixed(2)} left</div>
              {m.app_url && <div className="mono fine" style={{ overflowWrap: "anywhere", marginTop: 6 }}>{m.app_url}</div>}
              <div className="ctas" style={{ marginTop: 8 }}>
                <a className="btn small" href={`/project/${m.id}`}>Open machine</a>
                {m.app_updated_at && m.app_url && <a className="btn small primary" href={`${m.app_url}/docs`} target="_blank" rel="noopener noreferrer">Docs ↗</a>}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}

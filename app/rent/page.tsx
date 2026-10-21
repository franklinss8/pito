"use client";
import { useEffect, useState } from "react";
import { errMessage, useWallet } from "@/components/Wallet";
import { toast } from "@/components/Toaster";
import { TEMPLATES } from "@/lib/templates";
import { ethToWei, fmtEth } from "@/lib/ethmath";

type Gpu = { id: string; name: string; vram_gb: number; cents_per_hour: number };
type Rental = { id: string; gpu_name: string; template_id: string; status: string; connect_url: string | null; budget_cents: number; spent_cents: number; price_cents_per_hour: number; created_at: string };

export default function Rent() {
  const { account, hasWallet, signAction, sendEth } = useWallet();
  const [gpus, setGpus] = useState<Gpu[]>([]);
  const [gpu, setGpu] = useState("");
  const [tpl, setTpl] = useState("desktop");
  const [hours, setHours] = useState("2");
  const [eth, setEth] = useState<number | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/gpus").then((r) => r.json()).then((j) => { setGpus(j.gpus ?? []); if (j.recommended) setGpu(j.recommended); }).catch(() => {});
    fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot").then((r) => r.json()).then((j) => setEth(Number(j.data.amount))).catch(() => {});
  }, []);

  const g = gpus.find((x) => x.id === gpu);
  const h = Number(hours);
  const cents = g && Number.isFinite(h) && h > 0 ? Math.ceil(g.cents_per_hour * h) : 0;
  const ethAmt = eth && cents ? (cents / 100 / eth).toFixed(5) : null;

  const [listing, setListing] = useState<"idle" | "signing" | "loading" | "done">("idle");
  async function loadMine() {
    if (!hasWallet) { toast("No Ethereum wallet found in this browser. Install MetaMask or Rabby to rent.", "err"); return; }
    setListing("signing");
    try {
      if (!account) toast("Connect your wallet to list your computers.");
      const { message, signature } = await signAction("request", "rentals");
      setListing("loading");
      const r = await fetch("/api/rent", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, signature }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || "Could not list your computers.");
      setRentals(j.rentals); setListing("done");
      toast(j.rentals.length ? `${j.rentals.length} computer${j.rentals.length === 1 ? "" : "s"} found.` : "No computers rented by this wallet yet.");
    } catch (e) { setListing("idle"); toast(errMessage(e), "err"); }
  }

  async function rent() {
    if (!hasWallet) { toast("No Ethereum wallet found in this browser.", "err"); return; }
    if (!g || !ethAmt) { toast("Pick a GPU and a number of hours first.", "err"); return; }
    setBusy("rent"); setMsg(null);
    try {
      const { message, signature } = await signAction("rent", g.id);
      const r = await fetch("/api/rent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gpuTypeId: g.id, templateId: tpl, message, signature }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || "Could not reserve.");
      setMsg({ kind: "ok", text: "Reserved. Confirm the payment in your wallet…" });
      const wei = ethToWei(ethAmt)!;
      const hash = await sendEth(j.treasury, wei, "0x" + String(j.id).replace(/-/g, ""));
      setMsg({ kind: "ok", text: `Payment sent (${hash.slice(0, 10)}…). Waiting for confirmations, then the computer boots.` });
      for (let i = 0; i < 60; i++) {
        const d = await fetch(`/api/rent/${j.id}/deposit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: hash }) });
        const dj = await d.json();
        if (d.status === 202) { await new Promise((res) => setTimeout(res, 8000)); continue; }
        if (!d.ok) throw new Error(dj?.error?.message || "Payment could not be credited.");
        setMsg({ kind: "ok", text: "Credited. The computer is starting; its link appears below in a minute or two." });
        await loadMine(); return;
      }
      setMsg({ kind: "err", text: `Still waiting for confirmations. Keep the hash ${hash} and reload later.` });
    } catch (e) { setMsg({ kind: "err", text: errMessage(e) }); }
    finally { setBusy(""); }
  }

  return (
    <main className="wrap" style={{ paddingBlock: 40 }}>
      <div className="label acc">originals · rent</div>
      <h1 style={{ fontSize: "clamp(38px,6vw,64px)", margin: "8px 0 12px" }}>Rent a Pito computer.</h1>
      <p className="sub" style={{ fontSize: 15 }}>Your own workspace: an isolated GPU computer with full access, Jupyter and a terminal in the browser. Pay per hour in ETH; it stops when the budget is used up.</p>
      <div className="console" style={{ paddingTop: 10 }}>
        <div className="panel">
          <div className="field"><label htmlFor="rentGpu">GPU · live inventory</label>
            <select id="rentGpu" value={gpu} onChange={(e) => setGpu(e.target.value)}>
              {gpus.length === 0 && <option value="">No GPU inventory available</option>}
              {gpus.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.vram_gb} GB · ${(x.cents_per_hour / 100).toFixed(2)}/h</option>)}
            </select></div>
          <div className="field"><label htmlFor="rentTpl">Template</label>
            <select id="rentTpl" value={tpl} onChange={(e) => setTpl(e.target.value)}>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.category}</option>)}</select></div>
          <div className="field"><label htmlFor="rentHours">Hours</label><input id="rentHours" className="mono" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
          <div className="sheet">
            <div className="sheet-row"><span className="k">Price</span><span className="v mono">{g ? `$${(g.cents_per_hour / 100).toFixed(2)} / hour` : "—"}</span><span /></div>
            <div className="sheet-row"><span className="k">Total</span><span className="v mono">{cents ? `$${(cents / 100).toFixed(2)}${ethAmt ? ` ≈ ${ethAmt} ETH` : ""}` : "—"}</span><span /></div>
          </div>
          <button className="btn primary" type="button" disabled={!g || !ethAmt || !!busy} onClick={rent}>{busy === "rent" ? "Working…" : account ? `Pay ${ethAmt ? fmtEth(ethToWei(ethAmt)!) : "…"} ETH and rent` : "Connect wallet to rent"}</button>
          {msg && <div className={msg.kind === "err" ? "err" : "okmsg"}>{msg.text}</div>}
        </div>
        <aside className="panel">
          <div className="row"><span className="label acc">My computers</span><button className={`btn small ${listing === "signing" || listing === "loading" ? "busy" : ""}`} type="button" disabled={listing === "signing" || listing === "loading"} onClick={loadMine}>{listing === "signing" ? "Sign in wallet…" : listing === "loading" ? "Loading…" : account ? "Refresh (sign)" : "Connect & list"}</button></div>
          {rentals.length === 0 && <div className="fine">{listing === "done" ? "No computers rented by this wallet yet. Rent one on the left." : account ? "Sign a message (no gas) to list the computers rented by your wallet." : "Connect your wallet, then sign a message (no gas) to list your computers."}</div>}
          {rentals.map((r) => (
            <div key={r.id} className="plan">
              <div className="row"><b>{r.gpu_name}</b><span className={`status ${r.status === "running" ? "on" : r.status === "starting" ? "warn" : ""}`}><span className={`dot ${r.status === "running" ? "on" : r.status === "starting" ? "warn" : ""}`} />{r.status}</span></div>
              <div className="fine">{TEMPLATES.find((t) => t.id === r.template_id)?.name} · ${((r.budget_cents - r.spent_cents) / 100).toFixed(2)} left</div>
              {r.connect_url && (r.status === "running" || r.status === "starting") && <a className="btn small primary" style={{ marginTop: 8 }} href={r.connect_url} target="_blank" rel="noopener noreferrer">Open Jupyter ↗</a>}
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}

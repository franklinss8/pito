"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { errMessage, useWallet } from "./Wallet";
import { LaunchCoin } from "./LaunchCoin";
import { AI_MODELS, TEMPLATES, getTemplate } from "@/lib/templates";
import { fmtCap } from "./MachineCard";

type Gpu = { id: string; name: string; vram_gb: number; cents_per_hour: number };
type Info = { address: string; name: string; symbol: string; description: string; website: string; image: string; x: string; programmable: { verified: boolean; launchWallet?: string }; market_cap_usd: number | null; existing_machine: string | null };
const MISSIONS = [
  "Run a free chat assistant for every holder, 24/7, with the coin's lore as its personality.",
  "Build a small multiplayer web game playable at the machine's link, then improve it from player feedback.",
  "Generate a daily AI image series about the coin and publish a gallery where holders vote for the best.",
  "Build a live dashboard of the coin's onchain activity that holders can read at a glance.",
];
const PROGRAMMABLE = "https://programmable.market/launch/modules/foundation?chainId=1";

export function LaunchMachine() {
  const qs = useSearchParams();
  const [mode, setMode] = useState<"launched" | "prelaunch">(qs.get("mode") === "prelaunch" ? "prelaunch" : "launched");
  if (mode === "prelaunch") return (
    <div>
      <div className="pl" style={{ paddingBottom: 0 }}><div className="pl-top"><button type="button" className="pl-back" style={{ background: "none", border: 0, cursor: "pointer", font: "inherit" }} onClick={() => setMode("launched")}>← Already launched? Paste the token address</button><span className="pl-net">Pre-launch page</span></div></div>
      <LaunchCoin />
    </div>
  );
  return <Launched onPrelaunch={() => setMode("prelaunch")} />;
}

function Launched({ onPrelaunch }: { onPrelaunch: () => void }) {
  const { account, connect, signAction } = useWallet();
  const router = useRouter(); const qs = useSearchParams();
  const [addr, setAddr] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [lookup, setLookup] = useState<"idle" | "loading" | "error">("idle");
  const [lookupErr, setLookupErr] = useState("");
  const [mission, setMission] = useState(""); const [templateId, setTemplateId] = useState("none");
  const [gpuTypeId, setGpuTypeId] = useState(""); const [aiModel, setAiModel] = useState(AI_MODELS[0].id); const [cloudType, setCloudType] = useState<"COMMUNITY" | "SECURE">("COMMUNITY");
  const [gpus, setGpus] = useState<Gpu[]>([]); const [recommended, setRecommended] = useState(""); const [provider, setProvider] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  useEffect(() => {
    const t = qs.get("template"); if (t && getTemplate(t).id === t) setTemplateId(t);
    const a = qs.get("address"); if (a) setAddr(a);
    fetch("/api/gpus").then((r) => r.json()).then((j) => { setGpus(j.gpus ?? []); setProvider(j.provider); setRecommended(j.recommended ?? ""); if (j.recommended) setGpuTypeId((x) => x || j.recommended); }).catch(() => {});
  }, [qs]);

  useEffect(() => {
    const a = addr.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) { setInfo(null); setLookup("idle"); return; }
    let alive = true; setLookup("loading"); setLookupErr("");
    fetch(`/api/token-info?address=${a}`).then(async (r) => { const j = await r.json(); if (!alive) return; if (!r.ok) { setLookup("error"); setLookupErr(j?.error?.message || "Lookup failed."); setInfo(null); } else { setInfo(j); setLookup("idle"); } }).catch(() => { if (alive) { setLookup("error"); setLookupErr("Lookup failed."); } });
    return () => { alive = false; };
  }, [addr]);

  const gpu = gpus.find((g) => g.id === gpuTypeId); const model = AI_MODELS.find((m) => m.id === aiModel);
  const isLaunchWallet = !!info?.programmable.verified && !!account && info!.programmable.launchWallet!.toLowerCase() === account;
  const vramOk = !model?.local || !gpu || gpu.vram_gb >= (aiModel.includes("14b") ? 24 : 12);
  const ready = !!info && !info.existing_machine && mission.trim().length >= 20 && (!provider || !!gpu) && vramOk;

  async function start(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (!account) { try { await connect(); } catch (x) { setErr(errMessage(x)); } return; }
    if (!info || !ready) return;
    setBusy(true);
    try {
      const { message, signature } = await signAction("create", info.address);
      const r = await fetch("/api/machines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokenAddress: info.address, mission: mission.trim(), templateId, gpuTypeId, aiModel, cloudType, x: info.x, message, signature }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || "Could not create the machine.");
      router.push(`/project/${j.id}`);
    } catch (x) { setErr(errMessage(x)); }
    finally { setBusy(false); }
  }

  return (
    <div className="pl">
      <div className="pl-top"><a href="/" className="pl-back">← Home</a><span className="pl-net">Ethereum Mainnet</span></div>
      <h1 className="pl-h1">Launch a machine</h1>
      <p className="sub">Paste the address of a coin launched on Programmable. Pito reads the coin, checks the launch onchain, and gives it a computer. Not launched yet? <a href={PROGRAMMABLE} target="_blank" rel="noopener noreferrer">Launch on Programmable ↗</a> first, or <button type="button" className="pl-back" style={{ background: "none", border: 0, cursor: "pointer", font: "inherit", color: "var(--acc)", padding: 0 }} onClick={onPrelaunch}>prepare a pre-launch page</button>.</p>
      <div className="pl-layout">
        <form className="pl-form" noValidate onSubmit={start}>
          <fieldset className="pl-fieldset" disabled={busy}>
            <section>
              <div className="pl-field"><label htmlFor="tokenAddr">Token address · Ethereum</label><input id="tokenAddr" className="mono" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} />
                {lookup === "loading" && <p className="pl-hint">Reading the coin onchain…</p>}
                {lookup === "error" && <p className="pl-err">{lookupErr}</p>}
                {info?.existing_machine && <p className="pl-err">This coin already has a machine. <a href={`/project/${info.existing_machine}`}>Open it →</a></p>}
              </div>
              {info && (
                <div className="pl-tokencard">
                  {info.image ? <img src={info.image} alt="" /> : <div className="pl-tokenph">Ξ</div>}
                  <div style={{ minWidth: 0 }}>
                    <div className="pl-coinname"><h2>{info.name}</h2><span>${info.symbol}</span></div>
                    {info.description && <p className="pl-previewdesc" style={{ margin: "6px 0 8px" }}>{info.description}</p>}
                    <div className="chips">
                      <span className={`status ${info.programmable.verified ? "on" : "warn"}`}><span className={`dot ${info.programmable.verified ? "on" : "warn"}`} />{info.programmable.verified ? "Launched on Programmable · verified" : "No Programmable launch stamp yet"}</span>
                      {info.market_cap_usd ? <span className="status">mcap {fmtCap(info.market_cap_usd)}</span> : null}
                      {info.website && <span className="status">{info.website}</span>}
                    </div>
                    {info.programmable.verified && account && !isLaunchWallet && <p className="pl-err" style={{ marginTop: 8 }}>Connected wallet is not the launch wallet ({info.programmable.launchWallet!.slice(0, 8)}…). Only the launcher can give this coin a machine.</p>}
                    {info.programmable.verified === false && <p className="pl-hint" style={{ marginTop: 8 }}>If you launched minutes ago, the stamp appears after finality (about 15 min).</p>}
                  </div>
                </div>
              )}
            </section>

            <section>
              <div className="pl-sectionhead"><h2 className="pl-label">Computer</h2><span className="pl-muted">A GPU and an AI for this coin</span></div>
              <div className="pl-field"><label htmlFor="mMission">What should the machine build?</label>
                <textarea id="mMission" maxLength={2000} rows={4} value={mission} onChange={(e) => setMission(e.target.value)} placeholder="In plain words. For your holders, for a use case, for anyone." />
                <div className="chips" style={{ marginTop: 8 }}>{MISSIONS.map((m) => <button key={m} type="button" className="chip" onClick={() => setMission(m)}>{m.slice(0, 48)}…</button>)}</div></div>
              <div className="pl-two">
                <div className="pl-field"><label htmlFor="mGpu">GPU</label>
                  <select id="mGpu" value={gpuTypeId} onChange={(e) => setGpuTypeId(e.target.value)}>
                    {!provider && <option value="">GPU inventory offline</option>}
                    {gpus.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.vram_gb} GB · ${(g.cents_per_hour / 100).toFixed(2)}/h{g.id === recommended ? " · recommended" : ""}</option>)}
                  </select>
                  {gpu && <p className="pl-hint">${(gpu.cents_per_hour / 100).toFixed(2)} per hour · {gpu.vram_gb} GB VRAM</p>}</div>
                <div className="pl-field"><label htmlFor="mTpl">Template</label>
                  <select id="mTpl" value={templateId} onChange={(e) => setTemplateId(e.target.value)}><option value="none">No template · clean base</option>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.category}</option>)}</select>
                  <p className="pl-hint">{getTemplate(templateId).desc}</p></div>
              </div>
              <div className="pl-two">
                <div className="pl-field"><label htmlFor="mAi">AI model</label>
                  <select id="mAi" value={aiModel} onChange={(e) => setAiModel(e.target.value)}>{AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.local ? "runs on the GPU" : "via Pito"}</option>)}</select>
                  <p className={vramOk ? "pl-hint" : "pl-err"}>{vramOk ? model?.blurb : "This local model needs more VRAM than that GPU has."}</p></div>
                <div className="pl-field"><label htmlFor="mCloud">Cloud</label><select id="mCloud" value={cloudType} onChange={(e) => setCloudType(e.target.value as "COMMUNITY" | "SECURE")}><option value="COMMUNITY">Community · cheaper</option><option value="SECURE">Secure · datacenter</option></select></div>
              </div>
            </section>

            <button type="submit" className="pl-primary" disabled={busy || (!!account && !ready)}>{busy ? "Creating machine…" : account ? "Sign and start the machine" : "Connect wallet"}</button>
            {err && <p className="pl-err" role="alert">{err}</p>}
            <p className="pl-hint">One signature, no gas. Pito verifies onchain that your wallet launched the coin, then rents its GPU. Compute is funded with creator fees or ETH from the machine page.</p>
          </fieldset>
        </form>

        <aside className="pl-preview" aria-label="Machine preview">
          <div className="pl-previewhead"><span>Preview</span><span className="pl-badge">+ computer</span></div>
          <div className="pl-art">{info?.image ? <img src={info.image} alt="" /> : <div className="pl-artempty">Ξ</div>}</div>
          <div className="pl-previewbody">
            <div className="pl-coinname"><h2>{info?.name || "Your coin"}</h2><span>${info?.symbol || "COIN"}</span></div>
            <div className="pl-market" style={{ marginTop: 16 }}><span>Mission</span><strong style={{ fontWeight: 400 }}>{mission.trim() || "—"}</strong></div>
            <div className="pl-market"><span>Computer</span><strong>{gpu ? `${gpu.name} · ${gpu.vram_gb} GB` : "GPU pending"}</strong><span>{model?.name} · {getTemplate(templateId).name}</span></div>
            <div className="pl-previewfoot"><span>Ethereum Mainnet</span><span>Programmable · Uniswap v4</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

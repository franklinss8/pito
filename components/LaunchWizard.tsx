"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { errMessage, useWallet } from "./Wallet";
import { AI_MODELS, TEMPLATES, getTemplate } from "@/lib/templates";

type Gpu = { id: string; name: string; vram_gb: number; cents_per_hour: number; community: boolean; secure: boolean };
type Draft = { name: string; symbol: string; description: string; imageUrl: string; website: string; x: string; mission: string; templateId: string; gpuTypeId: string; aiModel: string; cloudType: "COMMUNITY" | "SECURE"; hours: string };
const EMPTY: Draft = { name: "", symbol: "", description: "", imageUrl: "", website: "", x: "", mission: "", templateId: "none", gpuTypeId: "", aiModel: AI_MODELS[0].id, cloudType: "COMMUNITY", hours: "4" };

const MISSIONS = [
  "Run a free chat assistant for every holder, 24/7, with the token's lore as its personality.",
  "Build a small multiplayer web game playable at the machine's link, then improve it from player feedback.",
  "Build a pixel-art mascot maker where holders assemble a character and export it as PNG.",
  "Generate a daily AI image series about the token and publish a gallery with a vote on the best.",
  "Build a dashboard of the token's onchain activity with charts holders can read at a glance.",
];

export function LaunchWizard() {
  const { account, connect, signAction } = useWallet();
  const router = useRouter();
  const qs = useSearchParams();
  const [d, setD] = useState<Draft>(EMPTY);
  const [stepIdx, setStepIdx] = useState(0);
  const [gpus, setGpus] = useState<Gpu[]>([]);
  const [recommended, setRecommended] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    try { const s = localStorage.getItem("pito-launch"); if (s) setD({ ...EMPTY, ...JSON.parse(s) }); } catch {}
    const t = qs.get("template"); if (t && getTemplate(t).id === t) setD((x) => ({ ...x, templateId: t }));
    fetch("/api/gpus").then((r) => r.json()).then((j) => { setGpus(j.gpus ?? []); setProvider(j.provider); setRecommended(j.recommended ?? ""); }).catch(() => {});
  }, [qs]);
  useEffect(() => { try { localStorage.setItem("pito-launch", JSON.stringify(d)); } catch {} }, [d]);
  useEffect(() => { if (!d.gpuTypeId && recommended) setD((x) => ({ ...x, gpuTypeId: recommended })); }, [recommended, d.gpuTypeId]);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });
  const symbol = d.symbol.trim().replace(/^\$/, "").toUpperCase();
  const gpu = gpus.find((g) => g.id === d.gpuTypeId);
  const model = AI_MODELS.find((m) => m.id === d.aiModel);
  const hours = Number(d.hours);
  const est = gpu && hours > 0 ? gpu.cents_per_hour * hours : 0;
  const tokenOk = d.name.trim().length > 0 && /^[A-Z0-9]{1,10}$/.test(symbol) && (!d.imageUrl || /^https:\/\/\S+$/i.test(d.imageUrl.trim()));
  const buildOk = d.mission.trim().length >= 20 && (!provider || !!gpu) && (!model?.local || (gpu?.vram_gb ?? 0) >= (d.aiModel.includes("14b") ? 24 : 12));
  const steps = useMemo(() => ["01 Token", "02 Build, compute & budget", "03 Fund & launch"], []);

  async function create() {
    setBusy(true); setErr("");
    try {
      const { message, signature } = await signAction("create", symbol);
      const r = await fetch("/api/machines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, symbol, message, signature }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || "Could not create the machine.");
      try { localStorage.removeItem("pito-launch"); } catch {}
      router.push(`/project/${j.id}?launch=1`);
    } catch (e) { setErr(errMessage(e)); }
    finally { setBusy(false); }
  }

  if (!account) {
    return (
      <div className="panel" style={{ maxWidth: 520 }}>
        <h3 style={{ fontSize: 22 }}>Connect your creator wallet</h3>
        <p className="fine" style={{ margin: 0 }}>Wallet identity only. The same wallet must launch the coin on Programmable; Pito never holds your keys.</p>
        <button className="btn primary" type="button" onClick={() => connect().then(() => setErr("")).catch((e: Error) => setErr(e.message))}>Connect wallet →</button>
        {err && <div className="err">{err}</div>}
      </div>
    );
  }

  return (
    <div>
      <div className="wiz">{steps.map((s, i) => <div key={s} className={i === stepIdx ? "on" : ""}>{s}</div>)}</div>

      {stepIdx === 0 && (
        <div className="step"><div className="num">01</div><div>
          <h3>Token</h3>
          <p className="sub">What Programmable will ask for. Pito keeps this draft in your browser.</p>
          <div className="form">
            <div className="field"><label htmlFor="lName">Name</label><input id="lName" maxLength={40} value={d.name} onChange={set("name")} placeholder="Forge" /></div>
            <div className="field"><label htmlFor="lSymbol">Ticker</label><input id="lSymbol" className="mono" maxLength={11} value={d.symbol} onChange={set("symbol")} placeholder="FORGE" /></div>
            <div className="field full"><label htmlFor="lDesc">Description</label><textarea id="lDesc" maxLength={500} value={d.description} onChange={set("description")} placeholder="One or two sentences holders will read everywhere." /></div>
            <div className="field full"><label htmlFor="lImg">Image URL</label><input id="lImg" value={d.imageUrl} onChange={set("imageUrl")} placeholder="https://…/logo.png" /><span className="hint">PNG, JPEG, WebP or GIF served directly over https.</span></div>
            <div className="field"><label htmlFor="lSite">Website</label><input id="lSite" value={d.website} onChange={set("website")} placeholder="Your Pito page works here" /></div>
            <div className="field"><label htmlFor="lX">X profile</label><input id="lX" value={d.x} onChange={set("x")} placeholder="@handle" /></div>
          </div>
          <div className="handoff"><button className="btn primary" type="button" disabled={!tokenOk} onClick={() => setStepIdx(1)}>Next: build, compute & budget →</button>{!tokenOk && <span className="fine">Name and a ticker (letters and digits, up to 10) are required.</span>}</div>
        </div></div>
      )}

      {stepIdx === 1 && (
        <div className="step"><div className="num">02</div><div>
          <h3>Build, compute & budget</h3>
          <p className="sub">Describe what the computer should build. Pick its GPU and the AI that runs it.</p>
          <div className="form">
            <div className="field full"><label htmlFor="lMission">What should the machine build?</label><textarea id="lMission" maxLength={2000} value={d.mission} onChange={set("mission")} style={{ minHeight: 120 }} placeholder="In plain words. For holders, for a use case, for anyone." />
              <div className="chips">{MISSIONS.map((m) => <button key={m} type="button" className="chip" onClick={() => setD({ ...d, mission: m })}>{m.slice(0, 44)}…</button>)}</div></div>
            <div className="field full"><label htmlFor="lTpl">GPU template (optional)</label>
              <select id="lTpl" value={d.templateId} onChange={set("templateId")}><option value="none">No template · clean PyTorch base</option>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.category} · {t.diskGb} GB</option>)}</select>
              <span className="hint">{getTemplate(d.templateId).desc} <a href="/templates" target="_blank" rel="noopener">Browse templates ↗</a></span></div>
            <div className="field"><label htmlFor="lGpu">GPU · live inventory</label>
              <select id="lGpu" value={d.gpuTypeId} onChange={set("gpuTypeId")}>
                {!provider && <option value="">GPU inventory not available on this Pito yet</option>}
                {gpus.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.vram_gb} GB · ${(g.cents_per_hour / 100).toFixed(2)}/h{g.id === recommended ? " · recommended" : ""}</option>)}
              </select></div>
            <div className="field"><label htmlFor="lCloud">Cloud</label>
              <select id="lCloud" value={d.cloudType} onChange={set("cloudType")}><option value="COMMUNITY">Community · cheaper</option><option value="SECURE">Secure · datacenter</option></select></div>
            <div className="field full"><label>AI model</label>
              <div className="radio">{AI_MODELS.map((m) => (
                <label key={m.id} className={d.aiModel === m.id ? "on" : ""}><input type="radio" name="ai" checked={d.aiModel === m.id} onChange={() => setD({ ...d, aiModel: m.id })} /><span><b>{m.name}</b><br /><span className="fine">{m.blurb}</span></span><span className="label">{m.local ? "on the GPU" : "via Pito"}</span></label>
              ))}</div></div>
            <div className="field"><label htmlFor="lHours">First budget (hours)</label><input id="lHours" className="mono" inputMode="decimal" value={d.hours} onChange={set("hours")} /><span className="hint">You fund it in step 3. Add more any time.</span></div>
            <div className="field"><label>Estimate</label><div className="plan mono">{gpu ? `$${(gpu.cents_per_hour / 100).toFixed(2)}/h × ${hours || 0} h = $${(est / 100).toFixed(2)}` : "pick a GPU"}</div></div>
          </div>
          <div className="handoff">
            <button className="btn" type="button" onClick={() => setStepIdx(0)}>← Back</button>
            <button className="btn primary" type="button" disabled={!buildOk} onClick={() => setStepIdx(2)}>Next: fund & launch →</button>
            {model?.local && gpu && gpu.vram_gb < (d.aiModel.includes("14b") ? 24 : 12) && <span className="err">This local model needs more VRAM than that GPU has.</span>}
          </div>
        </div></div>
      )}

      {stepIdx === 2 && (
        <div className="step"><div className="num">03</div><div>
          <h3>Fund & launch</h3>
          <p className="sub">Sign to create the machine. You get its public pre-launch page right away, then launch the coin on Programmable and bind it.</p>
          <div className="sheet">
            <div className="sheet-row"><span className="k">Token</span><span className="v">{d.name} <span className="mono">${symbol}</span></span><span /></div>
            <div className="sheet-row"><span className="k">Computer</span><span className="v">{gpu ? `${gpu.name} · ${gpu.vram_gb} GB · ${d.cloudType.toLowerCase()}` : "no GPU (inventory offline)"}</span><span /></div>
            <div className="sheet-row"><span className="k">Template</span><span className="v">{getTemplate(d.templateId).name}</span><span /></div>
            <div className="sheet-row"><span className="k">AI</span><span className="v">{model?.name}</span><span /></div>
            <div className="sheet-row"><span className="k">Mission</span><span className="v">{d.mission}</span><span /></div>
            <div className="sheet-row"><span className="k">First budget</span><span className="v mono">{gpu ? `${hours} h ≈ $${(est / 100).toFixed(2)}` : "—"}</span><span /></div>
            <div className="sheet-row"><span className="k">Creator</span><span className="v mono">{account}</span><span /></div>
          </div>
          <p className="fine" style={{ marginTop: 14 }}>What happens next: 1) sign (no gas) → your project page exists; 2) launch the coin on Programmable with the same wallet, using the project page as website; 3) back on the project page, paste the token address and sign; 4) fund compute in ETH (or free hours) and the machine boots.</p>
          <div className="handoff">
            <button className="btn" type="button" onClick={() => setStepIdx(1)}>← Back</button>
            <button className="btn primary" type="button" disabled={busy} onClick={create}>{busy ? "Creating…" : "Sign and create the machine →"}</button>
          </div>
          {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
        </div></div>
      )}
    </div>
  );
}

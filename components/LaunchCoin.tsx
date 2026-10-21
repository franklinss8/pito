"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { errMessage, useWallet } from "./Wallet";
import { AI_MODELS, TEMPLATES, getTemplate } from "@/lib/templates";

type Gpu = { id: string; name: string; vram_gb: number; cents_per_hour: number };
type Links = { website: string; twitter: string; telegram: string; discord: string; github: string; gitbook: string };
type Draft = { name: string; symbol: string; description: string; links: Links; feeBps: number; initialBuy: string; mission: string; templateId: string; gpuTypeId: string; aiModel: string; cloudType: "COMMUNITY" | "SECURE"; hours: string };
const EMPTY: Draft = { name: "", symbol: "", description: "", links: { website: "", twitter: "", telegram: "", discord: "", github: "", gitbook: "" }, feeBps: 100, initialBuy: "", mission: "", templateId: "none", gpuTypeId: "", aiModel: AI_MODELS[0].id, cloudType: "COMMUNITY", hours: "4" };
const LABELS: Record<keyof Links, string> = { website: "Website", twitter: "X (Twitter)", telegram: "Telegram", discord: "Discord", github: "GitHub", gitbook: "GitBook" };
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";
const PLATFORM_FEE_PCT = 0.3;

const MISSIONS = [
  "Run a free chat assistant for every holder, 24/7, with the coin's lore as its personality.",
  "Build a small multiplayer web game playable at the machine's link, then improve it from player feedback.",
  "Generate a daily AI image series about the coin and publish a gallery where holders vote for the best.",
  "Build a live dashboard of the coin's onchain activity that holders can read at a glance.",
];

async function resizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("The image could not load. Choose another image.")); i.src = url; });
    const size = 512, c = document.createElement("canvas"); c.width = size; c.height = size;
    const ctx = c.getContext("2d")!; const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    const png = file.type === "image/png" || file.type === "image/gif";
    return c.toDataURL(png ? "image/png" : "image/jpeg", 0.9);
  } finally { URL.revokeObjectURL(url); }
}

export function LaunchCoin() {
  const { account, connect, signAction } = useWallet();
  const router = useRouter(); const qs = useSearchParams();
  const [d, setD] = useState<Draft>(EMPTY);
  const [image, setImage] = useState<string>("");       // data URL preview
  const [imageUrl, setImageUrl] = useState<string>("");  // uploaded URL
  const [imageErr, setImageErr] = useState("");
  const [gpus, setGpus] = useState<Gpu[]>([]); const [recommended, setRecommended] = useState(""); const [provider, setProvider] = useState<string | null>(null);
  const [ethUsd, setEthUsd] = useState<number | null>(null);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { const s = localStorage.getItem("pito-launch-v2"); if (s) { const p = JSON.parse(s); setD({ ...EMPTY, ...p.d, links: { ...EMPTY.links, ...(p.d?.links ?? {}) } }); if (p.imageUrl) { setImageUrl(p.imageUrl); setImage(p.imageUrl); } } } catch {}
    const t = qs.get("template"); if (t && getTemplate(t).id === t) setD((x) => ({ ...x, templateId: t }));
    fetch("/api/gpus").then((r) => r.json()).then((j) => { setGpus(j.gpus ?? []); setProvider(j.provider); setRecommended(j.recommended ?? ""); }).catch(() => {});
    fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot").then((r) => r.json()).then((j) => setEthUsd(Number(j.data.amount))).catch(() => {});
  }, [qs]);
  useEffect(() => { try { localStorage.setItem("pito-launch-v2", JSON.stringify({ d, imageUrl })); } catch {} }, [d, imageUrl]);
  useEffect(() => { if (!d.gpuTypeId && recommended) setD((x) => ({ ...x, gpuTypeId: recommended })); }, [recommended, d.gpuTypeId]);

  const up = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const upLink = (k: keyof Links, v: string) => setD((x) => ({ ...x, links: { ...x.links, [k]: v } }));
  const gpu = gpus.find((g) => g.id === d.gpuTypeId); const model = AI_MODELS.find((m) => m.id === d.aiModel);
  const symbol = d.symbol.trim().toUpperCase();
  const minBuyEth = ethUsd ? 2 / ethUsd : 0;
  const hours = Number(d.hours); const est = gpu && hours > 0 ? gpu.cents_per_hour * hours : 0;

  async function chooseImage(file?: File) {
    if (!file) return;
    setImageErr(""); setBusy("image");
    try {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("Use a PNG, JPEG, WebP or GIF.");
      const dataUrl = await resizeImage(file); setImage(dataUrl);
      const r = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || "Upload failed.");
      setImageUrl(j.url);
    } catch (e) { setImage(""); setImageUrl(""); setImageErr(errMessage(e)); }
    finally { setBusy(""); }
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!d.name.trim()) e.name = "Enter a coin name.";
    if (!/^[A-Z0-9]{1,10}$/.test(symbol)) e.symbol = "Letters and digits only, up to 10.";
    if (d.description.trim().length > 280) e.description = "280 characters max.";
    const buy = Number(d.initialBuy);
    if (!(buy > 0)) e.initialBuy = "Enter the ETH amount of your first buy.";
    else if (minBuyEth && buy < minBuyEth) e.initialBuy = `Minimum $2 (about ${minBuyEth.toFixed(5)} ETH).`;
    if (d.mission.trim().length < 20) e.mission = "Describe what the computer should build, in at least a sentence.";
    if (provider && !gpu) e.gpu = "Pick a GPU.";
    if (model?.local && gpu && gpu.vram_gb < (d.aiModel.includes("14b") ? 24 : 12)) e.ai = "This local model needs more VRAM than that GPU has.";
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function launch(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (!account) { try { await connect(); } catch (x) { setErr(errMessage(x)); } return; }
    if (!validate()) return;
    setBusy("launch");
    try {
      const { message, signature } = await signAction("create", symbol);
      const r = await fetch("/api/machines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: d.name.trim(), symbol, description: d.description.trim(), imageUrl, website: d.links.website.trim(), x: d.links.twitter.trim(),
        mission: d.mission.trim(), templateId: d.templateId, gpuTypeId: d.gpuTypeId, aiModel: d.aiModel, cloudType: d.cloudType, message, signature }) });
      const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || "Could not create the machine.");
      try { localStorage.setItem(`pito-handoff-${j.id}`, JSON.stringify({ name: d.name.trim(), symbol, description: d.description.trim(), imageUrl, links: d.links, feeBps: d.feeBps, initialBuy: d.initialBuy })); localStorage.removeItem("pito-launch-v2"); } catch {}
      router.push(`/project/${j.id}?launch=1`);
    } catch (x) { setErr(errMessage(x)); }
    finally { setBusy(""); }
  }

  const locked = busy === "launch";
  return (
    <div className="pl">
      <div className="pl-top"><a href="/" className="pl-back">← Home</a><span className="pl-net">Ethereum Mainnet</span></div>
      <h1 className="pl-h1">Launch a Coin</h1>
      <div className="pl-layout">
        <form className="pl-form" noValidate onSubmit={launch}>
          <fieldset className="pl-fieldset" disabled={locked}>
            {/* ---- coin details ---- */}
            <section>
              <div className="pl-imagerow">
                <button type="button" className="pl-imagebtn" aria-label={image ? "Change coin image" : "Choose coin image"} onClick={() => fileInput.current?.click()} disabled={busy === "image"}>
                  {image ? <img src={image} alt="" /> : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-8 8" /></svg>}
                </button>
                <button type="button" className="pl-textbtn" onClick={() => fileInput.current?.click()} disabled={busy === "image"}>{busy === "image" ? "Preparing image…" : image ? "Change image" : "Add image"}</button>
                {image && <button type="button" className="pl-iconbtn" aria-label="Remove coin image" onClick={() => { setImage(""); setImageUrl(""); }}>×</button>}
                <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void chooseImage(f); }} />
              </div>
              {imageErr && <p className="pl-err">{imageErr}</p>}
              <div className="pl-two pl-namefields">
                <F label="Name" id="coinName" err={errors.name}><input id="coinName" maxLength={48} value={d.name} placeholder="Coin name" autoComplete="off" onChange={(e) => up("name", e.target.value)} /></F>
                <F label="Ticker" id="coinSymbol" err={errors.symbol}><input id="coinSymbol" maxLength={12} value={d.symbol} placeholder="COIN" autoComplete="off" spellCheck={false} onChange={(e) => up("symbol", e.target.value.toUpperCase())} /></F>
              </div>
              <F label="Description" id="coinDesc" err={errors.description}><textarea id="coinDesc" maxLength={280} rows={2} value={d.description} placeholder="A few words about your coin" onChange={(e) => up("description", e.target.value)} /></F>
              <div className="pl-two">
                <F label="Website" id="lkWebsite"><input id="lkWebsite" value={d.links.website} placeholder="example.com" autoCapitalize="none" spellCheck={false} onChange={(e) => upLink("website", e.target.value)} /></F>
                <F label="X (Twitter)" id="lkTwitter"><input id="lkTwitter" value={d.links.twitter} placeholder="@username" autoCapitalize="none" spellCheck={false} onChange={(e) => upLink("twitter", e.target.value)} /></F>
              </div>
              <details className="pl-details"><summary>Add More Links ▾</summary>
                <div className="pl-two">{(["telegram", "discord", "github", "gitbook"] as const).map((k) => <F key={k} label={LABELS[k]} id={`lk-${k}`}><input id={`lk-${k}`} type="url" value={d.links[k]} placeholder="https://…" autoCapitalize="none" spellCheck={false} onChange={(e) => upLink(k, e.target.value)} /></F>)}</div>
              </details>
            </section>

            {/* ---- modules ---- */}
            <section>
              <div className="pl-sectionhead"><h2 className="pl-label">Modules</h2><span className="pl-muted">Set on Programmable at launch</span></div>
              <div className="pl-classic"><span className="pl-ethmark">Ξ</span><span>Classic <span className="pl-muted">· Paired with ETH</span></span></div>
              <F label="Creator fees" id="coinFee" hint={`Buy & Sell (Platform Fee ${PLATFORM_FEE_PCT}%)`}>
                <div className="pl-fee">
                  <button type="button" aria-label="Decrease creator fee" disabled={d.feeBps <= 0} onClick={() => up("feeBps", Math.max(0, d.feeBps - 100))}>−</button>
                  <div><input id="coinFee" inputMode="decimal" value={(d.feeBps / 100).toFixed(d.feeBps % 100 ? 2 : 0)} onChange={(e) => { const v = Math.round(Number(e.target.value) * 100); if (Number.isFinite(v)) up("feeBps", Math.max(0, Math.min(1000, v))); }} /><span>%</span></div>
                  <button type="button" aria-label="Increase creator fee" disabled={d.feeBps >= 1000} onClick={() => up("feeBps", Math.min(1000, d.feeBps + 100))}>+</button>
                </div>
              </F>
              <F label="First buy · min. $2" id="coinBuy" err={errors.initialBuy}><div className="pl-amount"><input id="coinBuy" inputMode="decimal" autoComplete="off" value={d.initialBuy} placeholder="ETH amount" onChange={(e) => up("initialBuy", e.target.value)} /><span>ETH</span></div></F>
            </section>

            {/* ---- computer ---- */}
            <section>
              <div className="pl-sectionhead"><h2 className="pl-label">Computer</h2><span className="pl-muted">Every coin gets a GPU and an AI</span></div>
              <F label="What should the machine build?" id="coinMission" err={errors.mission}>
                <textarea id="coinMission" maxLength={2000} rows={4} value={d.mission} placeholder="In plain words. For your holders, for a use case, for anyone." onChange={(e) => up("mission", e.target.value)} />
                <div className="chips" style={{ marginTop: 8 }}>{MISSIONS.map((m) => <button key={m} type="button" className="chip" onClick={() => up("mission", m)}>{m.slice(0, 48)}…</button>)}</div>
              </F>
              <div className="pl-two">
                <F label="GPU" id="coinGpu" err={errors.gpu} hint={gpu ? `$${(gpu.cents_per_hour / 100).toFixed(2)} per hour · ${gpu.vram_gb} GB VRAM` : undefined}>
                  <select id="coinGpu" value={d.gpuTypeId} onChange={(e) => up("gpuTypeId", e.target.value)}>
                    {!provider && <option value="">GPU inventory offline</option>}
                    {gpus.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.vram_gb} GB · ${(g.cents_per_hour / 100).toFixed(2)}/h{g.id === recommended ? " · recommended" : ""}</option>)}
                  </select>
                </F>
                <F label="Template" id="coinTpl" hint={getTemplate(d.templateId).desc}>
                  <select id="coinTpl" value={d.templateId} onChange={(e) => up("templateId", e.target.value)}><option value="none">No template · clean base</option>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.category}</option>)}</select>
                </F>
              </div>
              <F label="AI model" id="coinAi" err={errors.ai}>
                <select id="coinAi" value={d.aiModel} onChange={(e) => up("aiModel", e.target.value)}>{AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.local ? "runs on the GPU" : "via Pito"}</option>)}</select>
                <p className="pl-hint">{model?.blurb}</p>
              </F>
              <div className="pl-two">
                <F label="Cloud" id="coinCloud"><select id="coinCloud" value={d.cloudType} onChange={(e) => up("cloudType", e.target.value as Draft["cloudType"])}><option value="COMMUNITY">Community · cheaper</option><option value="SECURE">Secure · datacenter</option></select></F>
                <F label="First compute budget" id="coinHours" hint={gpu ? `${hours || 0} h ≈ $${(est / 100).toFixed(2)}, funded after launch` : undefined}><div className="pl-amount"><input id="coinHours" inputMode="decimal" value={d.hours} onChange={(e) => up("hours", e.target.value)} /><span>hours</span></div></F>
              </div>
            </section>

            <button type="submit" className="pl-primary" disabled={!!busy}>{busy === "launch" ? "Creating machine…" : account ? "Launch coin" : "Connect wallet"}</button>
            {err && <p className="pl-err" role="alert">{err}</p>}
            <p className="pl-hint">Signing creates the machine and its public page, with no gas. The coin itself is created on Programmable in the next step, from your wallet.</p>
          </fieldset>
        </form>

        <aside className="pl-preview" aria-label="Coin preview">
          <div className="pl-previewhead"><span>Preview</span><span className="pl-badge">+ computer</span></div>
          <div className="pl-art">{image ? <img src={image} alt="" /> : <div className="pl-artempty">Ξ</div>}</div>
          <div className="pl-previewbody">
            <div className="pl-coinname"><h2>{d.name.trim() || "Your coin"}</h2><span>${symbol || "COIN"}</span></div>
            {d.description.trim() && <p className="pl-previewdesc">{d.description.trim()}</p>}
            <div className="pl-market"><span>Pair</span><strong>{symbol || "COIN"} / ETH</strong></div>
            <div className="pl-market"><span>Creator fees</span><strong>{(d.feeBps / 100).toFixed(d.feeBps % 100 ? 2 : 0)}% buy · {(d.feeBps / 100).toFixed(d.feeBps % 100 ? 2 : 0)}% sell</strong></div>
            <div className="pl-market"><span>Computer</span><strong>{gpu ? `${gpu.name} · ${gpu.vram_gb} GB` : "GPU pending"}</strong><span>{model?.name} · {getTemplate(d.templateId).name}</span></div>
            <div className="pl-previewfoot"><span>Ethereum Mainnet</span><span>Uniswap v4</span></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function F({ label, id, err, hint, children }: { label: string; id: string; err?: string; hint?: string; children: React.ReactNode }) {
  return <div className="pl-field"><label htmlFor={id}>{label}</label>{children}{hint && <p className="pl-hint">{hint}</p>}{err && <p className="pl-err">{err}</p>}</div>;
}

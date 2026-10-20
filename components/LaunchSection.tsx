"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { errMessage, useWallet } from "./Wallet";
import { ethToWei, fmtEth, PLATFORM_FEE_BPS } from "@/lib/ethmath";

const PROGRAMMABLE_ETH = "https://programmable.market/launch/modules/foundation?chainId=1";
type Draft = { name: string; ticker: string; desc: string; image: string; site: string; x: string; buy: string; sell: string; first: string };
const EMPTY: Draft = { name: "", ticker: "", desc: "", image: "", site: "", x: "", buy: "100", sell: "100", first: "0.05" };

function bps(v: string) { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 1000 ? n : null; }

export function LaunchSection() {
  const [d, setD] = useState<Draft>(EMPTY);
  const [toast, setToast] = useState("");
  useEffect(() => { try { const s = localStorage.getItem("pito-draft"); if (s) setD({ ...EMPTY, ...JSON.parse(s) }); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("pito-draft", JSON.stringify(d)); } catch {} }, [d]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2400); return () => clearTimeout(t); }, [toast]);

  const ticker = d.ticker.trim().replace(/^\$/, "").toUpperCase();
  const b = bps(d.buy), s = bps(d.sell), wei = ethToWei(d.first);
  const errors = [
    d.ticker && !/^[A-Z0-9]{1,10}$/.test(ticker) ? "Ticker: letters and digits only, up to 10." : "",
    b === null ? "Buy fee: a whole number from 0 to 1000 bps." : "",
    s === null ? "Sell fee: a whole number from 0 to 1000 bps." : "",
    wei === null ? "First buy: an ETH amount like 0.05." : "",
    d.image && !/^https:\/\/\S+$/i.test(d.image.trim()) ? "Image URL must start with https://." : "",
  ].filter(Boolean);

  const rows: [string, string][] = [
    ["Name", d.name.trim()],
    ["Ticker", ticker],
    ["Description", d.desc.trim()],
    ["Image URL", d.image.trim()],
    ["Website", d.site.trim()],
    ["X profile", d.x.trim()],
    ["Creator fees", b !== null && s !== null ? `Buy ${b} bps (${(b / 100).toFixed(2)}%) · Sell ${s} bps (${(s / 100).toFixed(2)}%)` : ""],
    ["First buy", wei !== null ? `${fmtEth(wei)} ETH` : ""],
  ];

  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setToast(`${label} copied`); }
    catch { setToast("Copy blocked. Select the text and copy it by hand."); }
  }
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });

  return (
    <>
      <section className="block" id="launch">
        <div className="wrap">
          <div className="sec-head">
            <h2>Launch a machine.</h2>
            <p>Prepare the coin here, launch and sign it on Programmable, then come back and register it with the same wallet.</p>
            <span className="label acc">Ethereum · chain ID 1</span>
          </div>
          <div className="bench">
            <div className="step">
              <div className="num">1</div>
              <div>
                <h3>Describe your coin</h3>
                <p className="sub">These are the fields Programmable asks for. Your draft stays in this browser.</p>
                <form className="form" onSubmit={(e) => e.preventDefault()} noValidate>
                  <div className="field"><label htmlFor="fName">Name</label><input id="fName" maxLength={40} placeholder="Pito Machine" value={d.name} onChange={set("name")} /></div>
                  <div className="field"><label htmlFor="fTicker">Ticker</label><input id="fTicker" className="mono" maxLength={11} placeholder="PITO" value={d.ticker} onChange={set("ticker")} /></div>
                  <div className="field full"><label htmlFor="fDesc">Description</label><textarea id="fDesc" maxLength={500} placeholder="What this coin is and what its machine will build." value={d.desc} onChange={set("desc")} /></div>
                  <div className="field full"><label htmlFor="fImage">Image URL</label><input id="fImage" placeholder="https://…/logo.png" value={d.image} onChange={set("image")} /><span className="hint">PNG, JPEG, WebP or GIF served directly. Leave blank to use Programmable&apos;s default logo.</span></div>
                  <div className="field"><label htmlFor="fSite">Website</label><input id="fSite" placeholder="pito.xyz" value={d.site} onChange={set("site")} /></div>
                  <div className="field"><label htmlFor="fX">X profile</label><input id="fX" placeholder="@pito" value={d.x} onChange={set("x")} /></div>
                  <div className="field"><label htmlFor="fBuy">Creator buy fee (bps)</label><input id="fBuy" className="mono" inputMode="numeric" value={d.buy} onChange={set("buy")} /><span className="hint">100 bps = 1%, paid to you on each buy.</span></div>
                  <div className="field"><label htmlFor="fSell">Creator sell fee (bps)</label><input id="fSell" className="mono" inputMode="numeric" value={d.sell} onChange={set("sell")} /><span className="hint">Zero fees mean no creator rewards.</span></div>
                  <div className="field full"><label htmlFor="fFirst">First buy (ETH)</label><input id="fFirst" className="mono" inputMode="decimal" value={d.first} onChange={set("first")} /><span className="hint">Bought in the same transaction that creates the coin and pool. Gas is extra.</span></div>
                  {errors.length > 0 && <div className="err full" role="alert">{errors.join(" ")}</div>}
                </form>
              </div>
            </div>

            <div className="step">
              <div className="num">2</div>
              <div>
                <h3>Launch it on Programmable</h3>
                <p className="sub">Open the Ethereum builder, paste each field, choose <b>Create Launch</b> and confirm in your wallet. Check the network shows Ethereum before signing.</p>
                <div className="sheet">
                  {rows.map(([k, v]) => (
                    <div className="sheet-row" key={k}>
                      <span className="k">{k}</span>
                      <span className={`v ${["Ticker", "First buy", "Image URL"].includes(k) ? "mono" : ""}`}>{v || <span className="fine">not set</span>}</span>
                      <button className="btn small" type="button" disabled={!v} onClick={() => copy(v, k)}>Copy</button>
                    </div>
                  ))}
                  {wei !== null && (
                    <div className="sheet-row"><span className="k">Platform fee on first buy</span><span className="v mono">{fmtEth((wei * BigInt(PLATFORM_FEE_BPS)) / 10000n)} ETH (30 bps)</span><span /></div>
                  )}
                </div>
                <div className="handoff">
                  <a className="btn primary" href={PROGRAMMABLE_ETH} target="_blank" rel="noopener noreferrer">Open Programmable · Ethereum →</a>
                  <span className="fine">Transactions are irreversible. Tokens can lose all value.</span>
                </div>
              </div>
            </div>

            <div className="step">
              <div className="num">3</div>
              <div>
                <h3>Register the machine</h3>
                <p className="sub">Paste the token address from your coin page and give the machine its mission. Sign with the wallet that launched the coin: Pito checks the launch on Ethereum.</p>
                <RegisterForm />
              </div>
            </div>
          </div>
        </div>
      </section>
      <FeeSection buy={b ?? 0} sell={s ?? 0} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

const TEMPLATES = [
  { n: "Holder arcade", m: "Build a retro arcade game themed on the token, with a local high-score table and three difficulty levels." },
  { n: "Lore generator", m: "Build a lore generator that writes origin stories, factions and a world map for the token community, with a copy button." },
  { n: "Pixel mascot maker", m: "Build a pixel-art mascot maker where holders assemble a character from parts and export it as PNG." },
  { n: "Meme studio", m: "Build a meme studio with templates, text overlays and the token logo as a sticker, exporting images locally." },
  { n: "Holder quiz", m: "Build a quiz about Ethereum and the token with 20 questions, instant feedback and a shareable score card." },
  { n: "Synth toy", m: "Build a browser synthesizer and step sequencer with a visualizer in the token colors." },
];

function RegisterForm() {
  const { signAction } = useWallet();
  const router = useRouter();
  const [addr, setAddr] = useState("");
  const [mission, setMission] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = addr.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return setMsg({ kind: "err", text: "Token address: 0x followed by 40 hex characters." });
    if (mission.trim().length < 12) return setMsg({ kind: "err", text: "Mission: describe what the machine should build in a sentence or two." });
    setBusy(true);
    try {
      setMsg({ kind: "ok", text: "Sign the message in your wallet. It costs no gas." });
      const { getAddress } = await import("viem");
      const token = getAddress(a);
      const { message, signature } = await signAction("register", token);
      setMsg({ kind: "ok", text: "Checking the launch on Ethereum and drafting the build plan…" });
      const r = await fetch("/api/machines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokenAddress: token, mission: mission.trim(), message, signature }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || "Registration failed.");
      router.push(`/m/${j.id}`);
    } catch (err) {
      setMsg({ kind: "err", text: errMessage(err) });
    } finally { setBusy(false); }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field full"><label htmlFor="rAddr">Token contract address</label><input id="rAddr" className="mono" placeholder="0x…" autoComplete="off" spellCheck={false} value={addr} onChange={(e) => setAddr(e.target.value)} /></div>
      <div className="field full" id="templates"><label>Templates</label>
        <div className="chips">{TEMPLATES.map((t) => <button key={t.n} type="button" className="chip" onClick={() => setMission(t.m)}>{t.n}</button>)}</div>
        <span className="hint">Start from a template, then edit the mission.</span></div>
      <div className="field full"><label htmlFor="rMission">Mission</label><textarea id="rMission" maxLength={400} placeholder="Build a pixel-art game where holders defend a castle." value={mission} onChange={(e) => setMission(e.target.value)} /><span className="hint">Plain words. The machine builds one interactive web app for holders.</span></div>
      <div className="full handoff" style={{ marginTop: 0 }}>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Working…" : "Sign and register machine"}</button>
      </div>
      {msg && <div className={`full ${msg.kind === "err" ? "err" : "okmsg"}`} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</div>}
    </form>
  );
}

function FeeSection({ buy, sell }: { buy: number; sell: number }) {
  const one = 10n ** 18n;
  const rows = useMemo(() => [
    ["Programmable platform", PLATFORM_FEE_BPS],
    ["Your creator fee · buy", buy],
    ["Your creator fee · sell", sell],
  ] as [string, number][], [buy, sell]);
  return (
    <section className="block" id="fees">
      <div className="wrap">
        <div className="sec-head"><div><h2>Fees on a 1 ETH trade</h2><p>Programmable charges 30 bps on every buy and sell through the pool, including the first buy. Your creator fees come on top.</p></div></div>
        <div className="fees">
          <div className="tbl">
            <table className="fee-table">
              <thead><tr><th>Line</th><th className="n">Rate</th><th className="n">On 1 ETH</th></tr></thead>
              <tbody>
                {rows.map(([n, r]) => <tr key={n}><td>{n}</td><td className="n">{r} bps</td><td className="n">{fmtEth((one * BigInt(r)) / 10000n)} ETH</td></tr>)}
                <tr><td><b>Total on a buy</b></td><td className="n"><b>{PLATFORM_FEE_BPS + buy} bps</b></td><td className="n"><b>{fmtEth((one * BigInt(PLATFORM_FEE_BPS + buy)) / 10000n)} ETH</b></td></tr>
                <tr><td><b>Total on a sell</b></td><td className="n"><b>{PLATFORM_FEE_BPS + sell} bps</b></td><td className="n"><b>{fmtEth((one * BigInt(PLATFORM_FEE_BPS + sell)) / 10000n)} ETH</b></td></tr>
              </tbody>
            </table>
          </div>
          <div className="faq">
            <div><h3>Does Pito touch my coin&apos;s funds?</h3><p>No. The coin, pool and first buy are created by Programmable and signed in your wallet. Pito only reads Ethereum to confirm the launch.</p></div>
            <div><h3>Who can register a token?</h3><p>Only the wallet recorded as the launch wallet in Programmable&apos;s onchain launch stamp. Pito checks it on every registration.</p></div>
            <div><h3>What does the GPU build?</h3><p>An open code model on a dedicated GPU writes one interactive web app from the mission and plan. It runs sandboxed on the machine&apos;s page, with no access to wallets or the network.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}

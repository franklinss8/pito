"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Machine, Message, Step } from "@/lib/db";
import { errMessage, useWallet } from "./Wallet";
import { toast } from "./Toaster";
import { StatusDot, fmtCap, machineState } from "./MachineCard";
import { MachineArt } from "./MachineArt";
import { AI_MODELS, getTemplate } from "@/lib/templates";
import { ethToWei } from "@/lib/ethmath";

type Data = {
  machine: Machine;
  stats: { ai_steps: number; holder_messages: number; remaining_cents: number; online: boolean };
  steps: Step[]; messages: Message[];
  funding: { mode: "paid"; treasury: string } | { mode: "free"; freeHours: number };
  frame_url: string | null;
};
const STAGES = ["setup", "plan", "build", "test", "ship"];
const PROGRAMMABLE = "https://programmable.market/launch/modules/foundation?chainId=1";

export function ProjectPage({ initial, justCreated }: { initial: Machine; justCreated: boolean }) {
  const { account, signAction, sendEth, sendTx, waitReceipt } = useWallet();
  const [d, setD] = useState<Data | null>(null);
  const m = d?.machine ?? initial;
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [addr, setAddr] = useState("");
  const [eth, setEth] = useState<number | null>(null);
  const [hours, setHours] = useState("4");
  const [chat, setChat] = useState(""); const [kind, setKind] = useState("message");
  const [frameTick, setFrameTick] = useState(0);
  const [tab, setTab] = useState<"chat" | "activity">("chat");
  const [origin, setOrigin] = useState("");
  const [handoff, setHandoff] = useState<Record<string, unknown> | null>(null);
  const [fees, setFees] = useState<{ available: boolean; ledger?: string; creator?: string; native?: boolean; claimable_wei?: string; treasury?: string | null; note?: string } | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/machines/${initial.id}`, { cache: "no-store" });
    if (r.ok) setD(await r.json());
    fetch(`/api/machines/${initial.id}/fees`, { cache: "no-store" }).then((x) => x.json()).then(setFees).catch(() => {});
  }, [initial.id]);
  useEffect(() => { setOrigin(location.origin); try { const h = localStorage.getItem(`pito-handoff-${initial.id}`); if (h) setHandoff(JSON.parse(h)); } catch {} load(); fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot").then((r) => r.json()).then((j) => setEth(Number(j.data.amount))).catch(() => {}); }, [load]);
  useEffect(() => { const t = setInterval(load, 10_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setFrameTick((x) => x + 1), 6000); return () => clearInterval(t); }, []);

  const isCreator = !!account && account === m.creator;
  const state = machineState(m);
  const online = d?.stats.online ?? false;
  const tpl = getTemplate(m.template_id);
  const model = AI_MODELS.find((x) => x.id === m.ai_model)?.name ?? m.ai_model;
  const remaining = d?.stats.remaining_cents ?? 0;
  const pricePerHour = m.price_cents_per_hour;
  const priceCents = pricePerHour * (Number(hours) || 0);
  const ethAmt = eth && priceCents > 0 ? (priceCents / 100 / eth).toFixed(5) : null;
  const copy = async (t: string, label: string) => { try { await navigator.clipboard.writeText(t); toast(`${label} copied.`); } catch { toast("Copy blocked by the browser; select the text instead.", "err"); } };

  async function signed(path: string, action: Parameters<typeof signAction>[0], target: string, body: Record<string, unknown>, label: string) {
    setBusy(label); setMsg(null);
    try {
      if (label === "power") toast(`Sign in your wallet to ${body.op === "stop" ? "stop" : "start"} the computer (no gas).`);
      const s = await signAction(action, target);
      if (label === "power") toast(body.op === "stop" ? "Stopping the computer…" : "Starting the computer…");
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...s }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || "Request failed.");
      await load(); return j;
    } catch (e) { setMsg({ kind: "err", text: errMessage(e) }); toast(errMessage(e), "err"); return null; }
    finally { setBusy(""); }
  }

  async function bind() {
    const a = addr.trim(); if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return setMsg({ kind: "err", text: "Paste the token address (0x + 40 hex)." });
    const { getAddress } = await import("viem");
    const j = await signed(`/api/machines/${m.id}/bind`, "bind", getAddress(a), { tokenAddress: getAddress(a) }, "bind");
    if (j) setMsg({ kind: "ok", text: j.started ? "Token bound and verified. The computer is starting." : `Token bound. ${j.note}` });
  }
  async function fund() {
    if (!d || d.funding.mode !== "paid" || !ethAmt) return;
    setBusy("fund"); setMsg(null);
    try {
      const hash = await sendEth(d.funding.treasury, ethToWei(ethAmt)!, "0x" + m.id.replace(/-/g, ""));
      setMsg({ kind: "ok", text: `Payment sent (${hash.slice(0, 10)}…). Waiting for 2 confirmations…` });
      for (let i = 0; i < 60; i++) {
        const r = await fetch(`/api/machines/${m.id}/deposit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: hash }) });
        const j = await r.json();
        if (r.status === 202) { await new Promise((res) => setTimeout(res, 8000)); continue; }
        if (!r.ok) throw new Error(j?.error?.message || "Payment could not be credited.");
        setMsg({ kind: "ok", text: `Credited $${(j.cents / 100).toFixed(2)}.${j.started ? " The computer is starting." : ""}` }); await load(); return;
      }
      setMsg({ kind: "err", text: `Still waiting for confirmations. Keep the hash ${hash}; fund again with the same hash later to credit it.` });
    } catch (e) { setMsg({ kind: "err", text: errMessage(e) }); }
    finally { setBusy(""); }
  }
  async function claimAndFund() {
    if (!fees?.available || !fees.ledger) return;
    setBusy("fees"); setMsg(null);
    try {
      const { encodeFunctionData, parseAbi, decodeEventLog } = await import("viem");
      const abi = parseAbi(["function claimCreator() returns (uint256 amount)", "event QuoteClaimed(address indexed beneficiary,uint8 indexed budget,uint256 amount)"]);
      setMsg({ kind: "ok", text: "Confirm the claim in your wallet. The fees are paid to the creator wallet first." });
      const hash = await sendTx({ to: fees.ledger, data: encodeFunctionData({ abi, functionName: "claimCreator" }) });
      setMsg({ kind: "ok", text: `Claim sent (${hash.slice(0, 10)}…). Waiting for confirmation…` });
      const receipt = await waitReceipt(hash);
      if (!receipt || receipt.status !== "0x1") throw new Error("The claim did not confirm. Check the transaction and try again.");
      let claimed = 0n;
      for (const log of receipt.logs) { try { const ev = decodeEventLog({ abi, data: log.data as `0x${string}`, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] }); if (ev.eventName === "QuoteClaimed") claimed = (ev.args as { amount: bigint }).amount; } catch {} }
      if (claimed === 0n) { setMsg({ kind: "ok", text: "Claim confirmed, but nothing was claimable yet." }); await load(); return; }
      const eth = Number(claimed) / 1e18;
      if (!d || d.funding.mode !== "paid") { setMsg({ kind: "ok", text: `Claimed ${eth.toFixed(5)} ETH to your wallet. This Pito runs in free mode, so compute needs no funding.` }); await load(); return; }
      if (!fees.native) { setMsg({ kind: "ok", text: `Claimed. These fees are not in ETH; fund the machine with ETH below.` }); await load(); return; }
      setMsg({ kind: "ok", text: `Claimed ${eth.toFixed(5)} ETH. Now confirm the compute payment of the same amount.` });
      const fundHash = await sendEth(d.funding.treasury, claimed, "0x" + m.id.replace(/-/g, ""));
      setMsg({ kind: "ok", text: `Payment sent (${fundHash.slice(0, 10)}…). Waiting for 2 confirmations…` });
      for (let i = 0; i < 60; i++) {
        const r = await fetch(`/api/machines/${m.id}/deposit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: fundHash }) });
        const j = await r.json();
        if (r.status === 202) { await new Promise((res) => setTimeout(res, 8000)); continue; }
        if (!r.ok) throw new Error(j?.error?.message || "Payment could not be credited.");
        setMsg({ kind: "ok", text: `Creator fees turned into compute: $${(j.cents / 100).toFixed(2)} credited.${j.started ? " The computer is starting." : ""}` }); await load(); return;
      }
      setMsg({ kind: "err", text: `Still waiting for confirmations. Keep the hash ${fundHash}; fund again with it later to credit.` });
    } catch (e) { setMsg({ kind: "err", text: errMessage(e) }); }
    finally { setBusy(""); }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault(); const body = chat.trim(); if (body.length < 2) return;
    toast("Sign the message in your wallet (no gas).");
    const j = await signed(`/api/machines/${m.id}/messages`, "message", m.id, { body, kind }, "chat");
    if (j) { setChat(""); toast("Sent. The AI replies on its next loop."); setTimeout(() => feedRef.current?.scrollTo({ top: 1e9 }), 100); }
  }
  async function vote(id: string) { toast("Sign the vote in your wallet (no gas)."); const j = await signed(`/api/machines/${m.id}/vote`, "vote", id, { messageId: id }, "vote"); if (j) toast(`${j.votes}/${j.needed} votes${j.status === "approved" ? " · approved, the AI will build it" : ""}.`); }

  const messages = d?.messages ?? [], steps = d?.steps ?? [];
  const plan = m.plan;

  return (
    <div style={{ paddingBlock: 28, display: "grid", gap: 28 }}>
      <a href="/" className="fine" style={{ textDecoration: "none" }}>← Back to the network</a>

      {/* ---- title ---- */}
      <div className="two" style={{ alignItems: "start" }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            {m.image_url ? <img src={m.image_url} alt="" width={56} height={56} style={{ width: 56, height: 56, objectFit: "cover", border: "1px solid var(--line)" }} /> : null}
            <div><div className="ticker" style={{ fontSize: 40 }}>{m.name} <span style={{ color: "var(--acc)" }}>${m.symbol}</span></div><div className="name">{m.description || m.mission}</div></div>
          </div>
          <div className="fine">Holders steer this project: chat with the AI, suggest ideas, vote on features. Fixes are built right away; features need 3 votes; major new mechanisms need 10.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <StatusDot m={m} />
            {m.token_address && <button className="btn small" type="button" onClick={() => copy(m.token_address!, "Contract address")}>Copy CA</button>}
            {m.app_updated_at && <a className="btn small primary" href={`/app/${m.id}`} target="_blank" rel="noopener">Open app ↗</a>}
            {m.token_address && <a className="btn small" href={`https://programmable.market/token/${m.token_address}`} target="_blank" rel="noopener noreferrer">programmable ↗</a>}
            {m.website && <a className="btn small" href={/^https?:/.test(m.website) ? m.website : `https://${m.website}`} target="_blank" rel="noopener noreferrer">website ↗</a>}
            {m.x_handle && <a className="btn small" href={`https://x.com/${m.x_handle}`} target="_blank" rel="noopener noreferrer">X ↗</a>}
          </div>
        </div>
        <div className="stats">
          <div><span className="label">Market cap</span><b>{fmtCap(m.market_cap_usd)}</b></div>
          <div><span className="label">AI steps</span><b>{d?.stats.ai_steps ?? "—"}</b></div>
          <div><span className="label">Holder messages</span><b>{d?.stats.holder_messages ?? "—"}</b></div>
          <div><span className="label">Build stage · app</span><b style={{ fontSize: 18 }}>{plan?.stage ?? "setup"} · {m.app_updated_at ? "live" : "not yet"}</b></div>
        </div>
      </div>

      {/* ---- creator: launch flow ---- */}
      {isCreator && !m.token_address && (
        <div className="step"><div className="num">→</div><div>
          <h3>{justCreated ? "Your pre-launch page is live." : "Finish the launch"}</h3>
          <p className="sub">This page is the token&apos;s website. Launch the coin on Programmable with this same wallet, then paste the token address here.</p>
          <div className="handoff" style={{ marginTop: 0 }}>
            <button className="btn" type="button" onClick={() => copy(location.href, "Page link")}>Copy page link</button>
            <a className="btn primary" href={PROGRAMMABLE} target="_blank" rel="noopener noreferrer">Open Programmable · Ethereum →</a>
          </div>
          <div className="sheet" style={{ marginTop: 16 }}>
            {([
              ["Name", m.name], ["Ticker", m.symbol], ["Description", m.description], ["Image URL", m.image_url],
              ["Website", origin ? `${origin}/project/${m.id}` : ""], ["X (Twitter)", m.x_handle ? `@${m.x_handle}` : ""],
              ...(handoff ? (["telegram", "discord", "github", "gitbook"] as const).map((k) => [k[0].toUpperCase() + k.slice(1), String((handoff.links as Record<string, string> | undefined)?.[k] ?? "")]) : []),
              ["Creator fees", handoff ? `${Number(handoff.feeBps) / 100}% buy & sell` : ""], ["First buy", handoff ? `${handoff.initialBuy} ETH` : ""],
            ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
              <div className="sheet-row" key={k}><span className="k">{k}</span><span className="v" style={{ overflowWrap: "anywhere" }}>{v}</span><button className="btn small" type="button" onClick={() => copy(String(v).replace(/^@/, ""), k)}>Copy</button></div>
            ))}
          </div>
          <div className="form" style={{ marginTop: 16 }}>
            <div className="field full"><label htmlFor="bindAddr">Token contract address (after the launch finalizes, ~15 min)</label><input id="bindAddr" className="mono" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x…" spellCheck={false} /></div>
            <div className="full"><button className="btn primary" type="button" disabled={busy === "bind"} onClick={bind}>{busy === "bind" ? "Checking onchain…" : "Bind token and start the machine →"}</button></div>
          </div>
        </div></div>
      )}

      {/* ---- 01 screen ---- */}
      <section>
        <div className="section-num">01 · Watch the machine</div>
        <div className="screen">
          {d?.frame_url ? <img key={frameTick} src={`${d.frame_url}&r=${frameTick}`} alt={`$${m.symbol} screen`} /> : (
            <div style={{ position: "absolute", inset: 0 }}><MachineArt seed={m.token_address || m.id} className="art" /></div>
          )}
          {!d?.frame_url && <div className="nosig" style={{ position: "relative" }}><b>NO SIGNAL</b>the computer is not broadcasting<br />a stream appears when it connects</div>}
        </div>
        <div className="fine" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
          <span>GPU {m.gpu_name ? m.gpu_name : "pending"}</span><span>· computer {m.pod_id ? (online ? "online" : m.pod_status?.toLowerCase() ?? "provisioned") : "not provisioned"}</span><span>· AI {m.last_seen_at ? (online ? "working" : "offline") : "pending"}</span>
          <span>· {m.last_frame_at ? `last frame ${new Date(m.last_frame_at).toLocaleTimeString()}` : "waiting for stream"}</span>
        </div>
      </section>

      {/* ---- 02 chat ---- */}
      <section className="two">
        <div>
          <div className="section-num">02 · Talk to the AI</div>
          <div className="panel">
            <div className="chips"><button className={`chip ${tab === "chat" ? "active" : ""}`} type="button" onClick={() => setTab("chat")}>chat</button><button className={`chip ${tab === "activity" ? "active" : ""}`} type="button" onClick={() => setTab("activity")}>activity feed</button></div>
            {tab === "chat" && (<>
              <div className="feed" ref={feedRef}>
                {messages.length === 0 && <div className="fine">{d ? "No messages yet. Holders of the token can talk to the AI." : "Loading conversation…"}</div>}
                {messages.map((x) => (
                  <div key={x.id} className={`msg ${x.is_ai ? "ai" : ""}`}>
                    <div className="who"><span>{x.is_ai ? `${m.symbol} AI` : `${x.wallet.slice(0, 6)}…${x.wallet.slice(-4)}`}</span>{x.kind !== "message" && !x.is_ai && <span className="req">{x.kind} · {x.status} · {x.votes} vote{x.votes === 1 ? "" : "s"}</span>}<span>{new Date(x.created_at).toLocaleString()}</span></div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{x.body}</div>
                    {!x.is_ai && x.kind !== "message" && x.status === "open" && account && <div><button className="btn small" type="button" disabled={busy === "vote"} onClick={() => vote(x.id)}>Vote ↑</button></div>}
                  </div>
                ))}
              </div>
              <form onSubmit={send} style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <select id="chatKind" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 140 }}><option value="message">message</option><option value="bug">bug</option><option value="feature">feature</option><option value="idea">big idea</option></select>
                  <input id="chatBody" value={chat} onChange={(e) => setChat(e.target.value)} placeholder={account ? "Message the AI (holders only, signed, no gas)" : "Connect a wallet holding the token"} disabled={!account || busy === "chat"} />
                </div>
                <div><button className="btn primary small" type="submit" disabled={!account || busy === "chat" || chat.trim().length < 2}>{busy === "chat" ? "Sending…" : "Send"}</button></div>
              </form>
            </>)}
            {tab === "activity" && (
              <div className="feed">
                {steps.filter((s) => ["built", "note", "audit", "plan", "reply", "system"].includes(s.kind)).slice(-30).reverse().map((s) => (
                  <div key={s.id} className="logline"><span className="k">{s.kind}</span><div>{s.note || s.command}</div><span className="fine">{new Date(s.created_at).toLocaleString()}</span></div>
                ))}
                {steps.length === 0 && <div className="fine">Nothing yet.</div>}
              </div>
            )}
          </div>
        </div>

        {/* ---- 03 what it's building ---- */}
        <div>
          <div className="section-num">03 · What it&apos;s building</div>
          <div className="panel">
            <div><span className="label">Mission</span><div className="mission" style={{ marginTop: 6 }}>{m.mission}</div></div>
            {plan?.current_task && <div><span className="label">Current task</span><div style={{ marginTop: 6 }}>{plan.current_task}</div></div>}
            <div>
              <div className="row"><span className="label">Progress</span><span className="mono">{plan?.progress ?? 0}%</span></div>
              <div className="progress" style={{ marginTop: 6 }}><i style={{ width: `${plan?.progress ?? 0}%` }} /></div>
              <div className="stages">{STAGES.map((s) => <span key={s} className={plan?.stage === s ? "on" : ""}>{s}</span>)}</div>
            </div>
            <div><span className="label">Milestones</span>
              {plan?.milestones?.length ? <ol className="plan" style={{ margin: "6px 0 0", paddingLeft: 32 }}>{plan.milestones.map((ms, i) => <li key={i} style={{ color: ms.done ? "var(--acc)" : undefined }}>{ms.done ? "✓ " : ""}{ms.title}</li>)}</ol> : <div className="fine" style={{ marginTop: 6 }}>The AI writes its plan once the computer boots.</div>}
            </div>
            <div><span className="label">AI log · {d?.stats.ai_steps ?? 0} steps</span>
              <div className="feed" style={{ marginTop: 6, maxHeight: 320 }}>
                {steps.filter((s) => s.kind === "shell" || s.kind === "file").slice(-25).reverse().map((s) => (
                  <div key={s.id} className="logline"><span className="k">{s.kind} · {new Date(s.created_at).toLocaleTimeString()}</span><div className="mono">$ {s.command}</div>{s.output && <pre>{s.output.slice(-600)}</pre>}</div>
                ))}
                {steps.length === 0 && <div className="fine">No steps yet.</div>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 04 computer / 05 app ---- */}
      <section className="two">
        <div>
          <div className="section-num">04 · The computer</div>
          <div className="panel">
            <dl className="kv">
              <dt>GPU</dt><dd>{m.gpu_name || "pending"}{m.vram_gb ? ` · ${m.vram_gb} GB VRAM` : ""}</dd>
              <dt>AI</dt><dd>{model}</dd>
              <dt>Template</dt><dd>{tpl.name}</dd>
              <dt>Host</dt><dd>Pito Cloud · {m.cloud_type.toLowerCase()}</dd>
              <dt>OS</dt><dd>Ubuntu + CUDA</dd>
              <dt>Cost</dt><dd className="mono">${(pricePerHour / 100).toFixed(2)} / hour</dd>
              <dt>Budget left</dt><dd className="mono">{d ? `$${(remaining / 100).toFixed(2)}` : "—"}{d?.funding.mode === "free" ? ` (free mode · ${d.funding.freeHours} h)` : ""}</dd>
              <dt>Status</dt><dd>{state.text}</dd>
              {m.token_address && <><dt>Contract</dt><dd className="mono"><a href={`https://etherscan.io/token/${m.token_address}`} target="_blank" rel="noopener noreferrer">{m.token_address.slice(0, 8)}…{m.token_address.slice(-6)} ↗</a></dd></>}
              {m.launch_id && <><dt>Launch stamp</dt><dd className="mono">verified · {m.launch_id.slice(0, 10)}…</dd></>}
              <dt>Creator</dt><dd className="mono">{m.creator.slice(0, 8)}…{m.creator.slice(-6)}</dd>
            </dl>
            <div className="feed" style={{ maxHeight: 160 }}>
              {steps.filter((s) => s.kind === "system").slice(-6).reverse().map((s) => <div key={s.id} className="logline"><div>{s.note}</div><span className="fine">{new Date(s.created_at).toLocaleString()}</span></div>)}
            </div>
            {fees?.available && (
              <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <span className="label acc">Creator fees → compute</span>
                <div className="row"><span className="fine">Claimable in the coin&apos;s ledger</span><span className="mono">{(Number(fees.claimable_wei ?? "0") / 1e18).toFixed(5)} ETH</span></div>
                {isCreator || (account && fees.creator?.toLowerCase() === account) ? (
                  <button className="btn primary small" type="button" disabled={!!busy || Number(fees.claimable_wei ?? "0") === 0} onClick={claimAndFund}>{busy === "fees" ? "Working…" : d?.funding.mode === "paid" ? "Claim fees & fund compute" : "Claim creator fees"}</button>
                ) : <span className="fine">Only the fee recipient wallet can claim.</span>}
                <span className="fine">{fees.note}</span>
              </div>
            )}
            {d?.funding.mode === "paid" && pricePerHour > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                <span className="label acc">Fund compute · anyone can</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input id="fundHours" className="mono" style={{ width: 90 }} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Hours" /><span className="fine">hours = ${(priceCents / 100).toFixed(2)}{ethAmt ? ` ≈ ${ethAmt} ETH` : ""}</span>
                  <button className="btn primary small" type="button" disabled={!account || !ethAmt || !!busy} onClick={fund}>{busy === "fund" ? "Funding…" : "Fund"}</button>
                </div>
              </div>
            )}
            {isCreator && m.token_address && (
              <div className="ctas">
                {(m.status === "running" || m.status === "starting") ? <button className="btn" type="button" disabled={!!busy} onClick={() => signed(`/api/machines/${m.id}/power`, "stop", m.id, { op: "stop" }, "power")}>Stop computer</button>
                  : <button className="btn primary" type="button" disabled={!!busy || remaining <= 0} onClick={() => signed(`/api/machines/${m.id}/power`, "resume", m.id, { op: "resume" }, "power")}>{m.pod_id ? "Resume computer" : "Start computer"}</button>}
                {remaining <= 0 && <span className="fine">No budget left.</span>}
              </div>
            )}
            {msg && <div className={msg.kind === "err" ? "err" : "okmsg"} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</div>}
          </div>
        </div>
        <div>
          <div className="section-num">05 · The app</div>
          <div className="panel">
            <div className="row"><span className="label">Status</span><StatusDot m={m} /></div>
            <div className="fine">{m.app_updated_at ? `Shipped ${new Date(m.app_updated_at).toLocaleString()}. The app runs on the machine's own computer.` : "The link works once the app ships."}</div>
            <div className="mono fine" style={{ overflowWrap: "anywhere" }}>{origin}/app/{m.id}</div>
            <a className={`btn block ${m.app_updated_at ? "primary" : ""}`} href={`/app/${m.id}`} target="_blank" rel="noopener" aria-disabled={!m.app_updated_at}>Open the app ↗</a>
            {m.app_updated_at && m.app_url && <iframe className="appframe" src={m.app_url} title={`$${m.symbol} app`} sandbox="allow-scripts allow-forms allow-same-origin allow-popups" style={{ height: 420, minHeight: 0 }} />}
          </div>
        </div>
      </section>
    </div>
  );
}

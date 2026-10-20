"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Machine } from "@/lib/db";
import { PlanBox, statusChip } from "./MachineCard";
import { errMessage, useWallet } from "./Wallet";
import { fmtEth } from "@/lib/ethmath";

type Job = { id: string; status: string; error: string | null; model: string | null; created_at: string; finished_at: string | null } | null;
type Funding =
  | { mode: "paid"; treasury: string; runPriceWei: string; credits: number }
  | { mode: "free"; freeRunsPerDay: number; usedToday: number };

const JOB_LABEL: Record<string, string> = {
  IN_QUEUE: "Waiting for a GPU",
  IN_PROGRESS: "Building on GPU",
  COMPLETED: "Finished",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  TIMED_OUT: "Timed out",
};

export function MachineConsole({ initial }: { initial: Machine }) {
  const { account, signAction, sendEth } = useWallet();
  const [m, setM] = useState<Machine>(initial);
  const [job, setJob] = useState<Job>(null);
  const [funding, setFunding] = useState<Funding | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [appVersion, setAppVersion] = useState(initial.app_updated_at ?? "");
  const [runs, setRuns] = useState("1");
  const pendingTx = useRef<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/machines/${initial.id}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();
    setM(j.machine); setJob(j.job); setFunding(j.funding);
    setAppVersion(j.machine.app_updated_at ?? "");
  }, [initial.id]);

  const running = m.status === "running" || (job && (job.status === "IN_QUEUE" || job.status === "IN_PROGRESS"));
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!running && m.status !== "planning") return;
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [running, m.status, load]);

  const isCreator = !!account && account === m.creator;

  async function call(path: string, action: "run" | "replan", label: string) {
    setBusy(label); setMsg(null);
    try {
      const { message, signature } = await signAction(action, m.id);
      const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, signature }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || "Request failed.");
      setMsg({ kind: "ok", text: action === "run" ? "Run started. The GPU worker is picking it up." : "New build plan drafted." });
      await load();
    } catch (e) { setMsg({ kind: "err", text: errMessage(e) }); }
    finally { setBusy(""); }
  }

  async function fund() {
    if (!funding || funding.mode !== "paid") return;
    const n = Number(runs);
    if (!Number.isInteger(n) || n < 1 || n > 50) return setMsg({ kind: "err", text: "Choose between 1 and 50 runs." });
    setBusy("fund"); setMsg(null);
    try {
      const value = BigInt(funding.runPriceWei) * BigInt(n);
      const tag = "0x" + m.id.replace(/-/g, "");
      const hash = await sendEth(funding.treasury, value, tag);
      pendingTx.current = hash;
      setMsg({ kind: "ok", text: `Payment sent (${hash.slice(0, 10)}…). Waiting for 2 confirmations…` });
      for (let i = 0; i < 60; i++) {
        const r = await fetch(`/api/machines/${m.id}/deposit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: hash }) });
        const j = await r.json();
        if (r.status === 202) { await new Promise((res) => setTimeout(res, 8000)); continue; }
        if (!r.ok) throw new Error(j?.error?.message || "The payment could not be credited.");
        setMsg({ kind: "ok", text: `Credited ${j.credits ?? n} run(s).` });
        pendingTx.current = null;
        await load();
        return;
      }
      setMsg({ kind: "err", text: `Still waiting for confirmations. Keep this transaction hash: ${hash}. Reload the page later and it will be counted when you fund again with the same hash.` });
    } catch (e) { setMsg({ kind: "err", text: errMessage(e) }); }
    finally { setBusy(""); }
  }

  const canRun = funding?.mode === "paid" ? funding.credits > 0 : funding ? funding.usedToday < funding.freeRunsPerDay : false;

  return (
    <div className="console">
      <div style={{ minWidth: 0, display: "grid", gap: 16 }}>
        <div className="row">
          <div>
            <div className="ticker" style={{ fontSize: 34 }}>${m.symbol || "?"}</div>
            <div className="name">{m.name}</div>
          </div>
          {statusChip(m.status)}
        </div>
        <div className="mission">{m.mission}</div>
        {m.app_updated_at ? (
          <iframe
            key={appVersion}
            className="appframe"
            src={`/apps/${m.id}?v=${encodeURIComponent(appVersion)}`}
            sandbox="allow-scripts allow-forms"
            title={`$${m.symbol} app`}
          />
        ) : (
          <div className="appempty">
            {running ? "The machine is building its first app. This page refreshes on its own." : "No app yet. The creator starts a GPU run from the panel."}
          </div>
        )}
        {m.app_updated_at && <div className="fine">App shipped {new Date(m.app_updated_at).toLocaleString()}. It runs sandboxed: no wallet access and no network requests. <a href={`/apps/${m.id}`} target="_blank" rel="noopener">Open full screen ↗</a></div>}
      </div>

      <aside style={{ display: "grid", gap: 16 }}>
        <div className="panel">
          <span className="label">Machine</span>
          <dl className="kv">
            <dt>Token</dt><dd className="mono"><a href={`https://etherscan.io/token/${m.token_address}`} target="_blank" rel="noopener noreferrer">{m.token_address.slice(0, 8)}…{m.token_address.slice(-6)}</a></dd>
            <dt>Creator</dt><dd className="mono">{m.creator.slice(0, 8)}…{m.creator.slice(-6)}</dd>
            <dt>Launch</dt><dd>{m.launch_id ? "Programmable stamp ✓" : "not stamped"}</dd>
            {job && <><dt>Last run</dt><dd>{JOB_LABEL[job.status] ?? job.status}</dd></>}
            {job?.model && <><dt>Model</dt><dd className="mono">{job.model.split("/").pop()}</dd></>}
            {funding?.mode === "paid" && <><dt>Credits</dt><dd className="mono">{funding.credits} run(s)</dd></>}
            {funding?.mode === "free" && <><dt>Free runs</dt><dd className="mono">{Math.max(0, funding.freeRunsPerDay - funding.usedToday)} left today</dd></>}
          </dl>
          {job?.status === "FAILED" && job.error && <div className="err">Last run failed: {job.error}</div>}
        </div>

        <PlanBox plan={m.plan} />
        {m.status === "plan_failed" && <div className="err">The build plan could not be drafted{m.plan?.summary ? `: ${m.plan.summary}` : "."}</div>}

        <div className="panel">
          <span className="label">Controls</span>
          {!account && <p className="fine" style={{ margin: 0 }}>Connect the creator wallet to run this machine.</p>}
          {account && !isCreator && <p className="fine" style={{ margin: 0 }}>Only the creator wallet can start runs.{funding?.mode === "paid" ? " Anyone can fund compute." : ""}</p>}
          {isCreator && (
            <div className="ctas">
              <button className="btn primary" type="button" disabled={!!busy || !!running || !canRun || !m.plan?.steps?.length} onClick={() => call(`/api/machines/${m.id}/run`, "run", "run")}>
                {busy === "run" ? "Starting…" : running ? "Building…" : m.app_updated_at ? "Rebuild on GPU" : "Run on GPU"}
              </button>
              <button className="btn" type="button" disabled={!!busy || !!running} onClick={() => call(`/api/machines/${m.id}/plan`, "replan", "replan")}>
                {busy === "replan" ? "Drafting…" : "Redraft plan"}
              </button>
            </div>
          )}
          {funding?.mode === "paid" && (
            <div style={{ display: "grid", gap: 8 }}>
              <div className="fine">One run costs {fmtEth(BigInt(funding.runPriceWei))} ETH, paid to the Pito treasury on Ethereum.</div>
              <div className="row" style={{ justifyContent: "flex-start" }}>
                <input id="runsToBuy" className="mono" style={{ width: 80 }} inputMode="numeric" value={runs} onChange={(e) => setRuns(e.target.value)} aria-label="Runs to buy" />
                <button className="btn" type="button" disabled={!!busy} onClick={fund}>{busy === "fund" ? "Funding…" : `Fund ${fmtEth(BigInt(funding.runPriceWei) * BigInt(Number(runs) > 0 && Number.isInteger(Number(runs)) ? Number(runs) : 0))} ETH`}</button>
              </div>
            </div>
          )}
          {msg && <div className={msg.kind === "err" ? "err" : "okmsg"} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</div>}
        </div>
      </aside>
    </div>
  );
}

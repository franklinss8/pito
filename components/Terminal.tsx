"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWallet } from "./Wallet";
import { toast } from "./Toaster";

const ADDR = /^0x[0-9a-fA-F]{40}$/;

/**
 * The command line under the hero is real: paste a token address (or a Programmable link) and press Enter,
 * and the launch page opens with that coin already loaded. A few words of help otherwise.
 */
export function Terminal() {
  const { account, chainId } = useWallet();
  const router = useRouter();
  const [v, setV] = useState("");
  const state = !account ? "wallet not connected" : chainId === "0x1" ? "connected to Ethereum mainnet" : "wrong network · switch to Ethereum";
  const cls = !account ? "" : chainId === "0x1" ? "on" : "warn";

  function run(raw: string) {
    const s = raw.trim();
    if (!s) { router.push("/launch"); return; }
    const addr = s.match(/0x[0-9a-fA-F]{40}/)?.[0];
    if (addr && ADDR.test(addr)) { toast(`Loading ${addr.slice(0, 6)}…${addr.slice(-4)}`, "ok"); router.push(`/launch?address=${addr}`); return; }
    const word = s.toLowerCase().split(/\s+/)[0];
    const go: Record<string, string> = { launch: "/launch", computers: "/computers", rent: "/rent", templates: "/templates", api: "/developers", help: "/how-it-works", originals: "/originals" };
    if (go[word]) { router.push(go[word]); return; }
    toast("Paste a token address (0x…) or type: launch, computers, rent, templates, api, help", "ok");
  }

  return (
    <div className="term">
      <div className="wrap">
        <form className="cmd" onSubmit={(e) => { e.preventDefault(); run(v); }}>
          <b>$</b>
          <span className="muted" aria-hidden="true">pito launch</span>
          <input
            className="cmdin"
            value={v}
            onChange={(e) => setV(e.target.value)}
            onPaste={(e) => { const t = e.clipboardData.getData("text"); if (/0x[0-9a-fA-F]{40}/.test(t)) { e.preventDefault(); setV(t.trim()); run(t); } }}
            placeholder="paste a token address, press Enter"
            spellCheck={false}
            autoComplete="off"
            aria-label="Token address or command"
          />
          <span className="cursor" aria-hidden="true" />
        </form>
        <div className="status"><span className={`dot ${cls}`} />{state}</div>
      </div>
    </div>
  );
}

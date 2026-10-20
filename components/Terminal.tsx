"use client";
import { useWallet } from "./Wallet";

export function Terminal() {
  const { account, chainId } = useWallet();
  const state = !account ? "wallet not connected" : chainId === "0x1" ? "connected to Ethereum mainnet" : "wrong network · switch to Ethereum";
  const cls = !account ? "" : chainId === "0x1" ? "on" : "warn";
  return (
    <div className="term">
      <div className="wrap">
        <div className="cmd"><b>$</b> pito launch --chain mainnet <span className="cursor" /></div>
        <div className="status"><span className={`dot ${cls}`} />{state}</div>
      </div>
    </div>
  );
}

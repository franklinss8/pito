"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { buildActionMessage, type ActionName } from "@/lib/message";

type Eip1193 = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, fn: (...a: never[]) => void): void;
  removeListener?(event: string, fn: (...a: never[]) => void): void;
};
declare global { interface Window { ethereum?: Eip1193 } }

type WalletCtx = {
  account: string | null;
  chainId: string | null;
  hasWallet: boolean;
  connect(): Promise<string>;
  signAction(action: ActionName, target: string): Promise<{ message: string; signature: string }>;
  sendEth(to: string, valueWei: bigint, data: string): Promise<string>;
};

const Ctx = createContext<WalletCtx | null>(null);

function toHexUtf8(s: string) {
  return "0x" + Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    const eth = window.ethereum;
    setHasWallet(!!eth);
    if (!eth) return;
    eth.request({ method: "eth_accounts" }).then((a) => setAccount(((a as string[])[0] ?? null)?.toLowerCase() ?? null)).catch(() => {});
    eth.request({ method: "eth_chainId" }).then((c) => setChainId(c as string)).catch(() => {});
    const onAcc = (a: string[]) => setAccount(a[0]?.toLowerCase() ?? null);
    const onChain = (c: string) => setChainId(c);
    eth.on?.("accountsChanged", onAcc as never);
    eth.on?.("chainChanged", onChain as never);
    return () => { eth.removeListener?.("accountsChanged", onAcc as never); eth.removeListener?.("chainChanged", onChain as never); };
  }, []);

  const ensureMainnet = useCallback(async () => {
    const eth = window.ethereum!;
    const c = (await eth.request({ method: "eth_chainId" })) as string;
    if (c !== "0x1") {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] });
      setChainId("0x1");
    }
  }, []);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) throw new Error("No Ethereum wallet found. Install MetaMask, Rabby or Coinbase Wallet.");
    const accs = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const a = accs[0]?.toLowerCase();
    if (!a) throw new Error("No account was shared by the wallet.");
    setAccount(a);
    await ensureMainnet().catch(() => { throw new Error("Switch your wallet to Ethereum mainnet."); });
    return a;
  }, [ensureMainnet]);

  const signAction = useCallback(async (action: ActionName, target: string) => {
    const a = account ?? (await connect());
    const message = buildActionMessage(action, target, a);
    const signature = (await window.ethereum!.request({ method: "personal_sign", params: [toHexUtf8(message), a] })) as string;
    return { message, signature };
  }, [account, connect]);

  const sendEth = useCallback(async (to: string, valueWei: bigint, data: string) => {
    const a = account ?? (await connect());
    await ensureMainnet();
    return (await window.ethereum!.request({
      method: "eth_sendTransaction",
      params: [{ from: a, to, value: "0x" + valueWei.toString(16), data }],
    })) as string;
  }, [account, connect, ensureMainnet]);

  return <Ctx.Provider value={{ account, chainId, hasWallet, connect, signAction, sendEth }}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}

export function WalletButton() {
  const { account, chainId, connect } = useWallet();
  const [err, setErr] = useState("");
  const label = account ? `${account.slice(0, 6)}…${account.slice(-4)}${chainId && chainId !== "0x1" ? " · wrong network" : ""}` : "Connect wallet";
  return (
    <button className="btn small" type="button" title={err || undefined}
      onClick={() => connect().then(() => setErr("")).catch((e: Error) => setErr(e.message))}>
      {err && !account ? "No wallet found" : label}
    </button>
  );
}

export function errMessage(e: unknown): string {
  const any = e as { code?: number; message?: string };
  if (any?.code === 4001) return "You rejected the request in your wallet.";
  return any?.message || "Something went wrong.";
}

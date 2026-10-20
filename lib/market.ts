import "server-only";
import { db } from "./db";

let ethCache: { at: number; usd: number } | null = null;

/** ETH/USD spot (Coinbase public API), cached 60 s. */
export async function ethUsd(): Promise<number> {
  if (ethCache && Date.now() - ethCache.at < 60_000) return ethCache.usd;
  const r = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", { signal: AbortSignal.timeout(8000), cache: "no-store" });
  const j = (await r.json()) as { data?: { amount?: string } };
  const usd = Number(j.data?.amount);
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("ETH price unavailable");
  ethCache = { at: Date.now(), usd };
  return usd;
}

export function weiToCents(wei: bigint, usdPerEth: number): number {
  // cents = wei / 1e18 * usd * 100, computed in integers
  return Number((wei * BigInt(Math.round(usdPerEth * 100))) / 10n ** 18n);
}

/** Market cap from DexScreener (public, no key). Null when the pair is not indexed yet. */
export async function marketCapUsd(token: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { pairs?: { chainId: string; marketCap?: number; fdv?: number; liquidity?: { usd?: number } }[] };
    const pairs = (j.pairs ?? []).filter((p) => p.chainId === "ethereum").sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const v = pairs[0]?.marketCap ?? pairs[0]?.fdv;
    return typeof v === "number" && v > 0 ? v : null;
  } catch { return null; }
}

/** Refresh a machine's market cap at most every 2 minutes. */
export async function refreshMarket(m: { id: string; token_address: string | null; market_updated_at: string | null }): Promise<number | null> {
  if (!m.token_address) return null;
  if (m.market_updated_at && Date.now() - Date.parse(m.market_updated_at) < 120_000) return null;
  const cap = await marketCapUsd(m.token_address);
  await db().from("machines").update({ market_cap_usd: cap, market_updated_at: new Date().toISOString() }).eq("id", m.id);
  return cap;
}

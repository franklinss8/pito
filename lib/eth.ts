import "server-only";
import { createPublicClient, erc20Abi, http, parseAbi, getAddress, type Address, type Hex, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { env } from "./env";

let client: PublicClient | null = null;
export function eth(): PublicClient {
  client ??= createPublicClient({ chain: mainnet, transport: http(env.rpcUrl, { timeout: 15_000 }) }) as PublicClient;
  return client;
}

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function readToken(token: Address) {
  const c = eth();
  const code = await c.getCode({ address: token });
  if (!code || code === "0x") throw new Error("NOT_A_CONTRACT");
  const [name, symbol, decimals] = await Promise.all([
    c.readContract({ address: token, abi: erc20Abi, functionName: "name" }).catch(() => ""),
    c.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }).catch(() => ""),
    c.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }).catch(() => null),
  ]);
  if (!symbol && !name) throw new Error("NOT_A_TOKEN");
  return { name: String(name).slice(0, 80), symbol: String(symbol).slice(0, 20), decimals };
}

/** True when the wallet holds any amount of the token. */
export async function isHolder(token: Address, wallet: Address): Promise<boolean> {
  try {
    const bal = await eth().readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [wallet] });
    return bal > 0n;
  } catch { return false; }
}

/* ---------- Programmable launch provenance (Ethereum Launch Stamp Router) ---------- */

const PRIMARY_ROUTER = "0x8622DD5bAb44185f2A458ac90384Ac99248f8d56";
const MANIFEST_URLS = ["https://developers.programmable.family/api/v2/manifests/1", "https://developers.programmable.family/api/v2/manifest"];

const routerAbi = parseAbi([
  "function launchIdByToken(address token) view returns (bytes32 launchId)",
  "function launchStamp(bytes32 launchId) view returns ((uint8 kind,address launchWallet,address token,address hook,address poolManager,bytes32 poolId,bytes32 poolKeyHash,bytes32 componentSetHash,bytes32 routePayloadHash,address routeLauncher,bytes32 routeLauncherRuntimeCodeHash,bytes32 expectedResultHash,bytes32 permitDigest,bytes32 stampHash) record)",
]);

let routerCache: { at: number; list: Address[] } | null = null;

function pickAddress(v: unknown): string | null {
  if (typeof v === "string" && ADDRESS_RE.test(v)) return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["address", "routerAddress", "router"]) if (typeof o[k] === "string" && ADDRESS_RE.test(o[k] as string)) return o[k] as string;
  }
  return null;
}

export async function getRouters(): Promise<Address[]> {
  if (routerCache && Date.now() - routerCache.at < 10 * 60_000) return routerCache.list;
  const found = new Set<string>([PRIMARY_ROUTER.toLowerCase()]);
  for (const url of MANIFEST_URLS) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" }, cache: "no-store" });
      if (!r.ok) continue;
      const m = (await r.json()) as Record<string, unknown>;
      const primary = pickAddress(m.launchStampRouter);
      if (primary) found.add(primary.toLowerCase());
      const ext = (m.extensions as Record<string, unknown> | undefined)?.["programmable/launch-stamp-router-generations-v1"] as { routers?: unknown[] } | undefined;
      for (const item of ext?.routers ?? []) {
        const chain = (item as Record<string, unknown>)?.chainId;
        if (chain !== undefined && Number(chain) !== 1) continue;
        const a = pickAddress(item);
        if (a) found.add(a.toLowerCase());
      }
      break;
    } catch { /* manifest optional */ }
  }
  const list = [...found].map((a) => getAddress(a));
  routerCache = { at: Date.now(), list };
  return list;
}

export type LaunchProof = { router: Address; launchId: Hex; launchWallet: Address; hook: Address; poolId: Hex };

export async function findProgrammableLaunch(token: Address): Promise<LaunchProof | null> {
  const c = eth();
  for (const router of await getRouters()) {
    try {
      const launchId = await c.readContract({ address: router, abi: routerAbi, functionName: "launchIdByToken", args: [token] });
      if (!launchId || /^0x0+$/.test(launchId)) continue;
      const rec = await c.readContract({ address: router, abi: routerAbi, functionName: "launchStamp", args: [launchId] });
      if (rec.token.toLowerCase() !== token.toLowerCase()) continue;
      return { router, launchId, launchWallet: rec.launchWallet, hook: rec.hook, poolId: rec.poolId };
    } catch { /* not this Router */ }
  }
  return null;
}

/* ---------- Foundation coin metadata and creator fees ---------- */

const foundationTokenAbi = parseAbi([
  "function metadata() view returns (string description,string website,string image,bytes extraData)",
]);
const hookAbi = parseAbi([
  "function ledger() view returns (address)",
  "function creator() view returns (address)",
  "function quote() view returns (address)",
]);
const ledgerAbi = parseAbi([
  "function creator() view returns (address)",
  "function quote() view returns (address)",
  "function creatorCredited() view returns (uint256)",
  "function creatorClaimed() view returns (uint256)",
]);

/** Description, website and image recorded onchain at launch (Foundation coins). Empty strings when not a Foundation token. */
export async function readFoundationMetadata(token: Address): Promise<{ description: string; website: string; image: string }> {
  try {
    const [description, website, image] = await eth().readContract({ address: token, abi: foundationTokenAbi, functionName: "metadata" });
    return { description: String(description).slice(0, 500), website: String(website).slice(0, 200), image: String(image).slice(0, 500) };
  } catch { return { description: "", website: "", image: "" }; }
}

export type CreatorFees = { ledger: Address; creator: Address; quote: Address; creditedWei: bigint; claimedWei: bigint; claimableWei: bigint };

/** Creator fees accrued in the coin's Foundation ledger. Null when the coin has no readable ledger. */
export async function readCreatorFees(hook: Address): Promise<CreatorFees | null> {
  const c = eth();
  try {
    const ledger = await c.readContract({ address: hook, abi: hookAbi, functionName: "ledger" });
    const [creator, quote, credited, claimed] = await Promise.all([
      c.readContract({ address: ledger, abi: ledgerAbi, functionName: "creator" }),
      c.readContract({ address: ledger, abi: ledgerAbi, functionName: "quote" }),
      c.readContract({ address: ledger, abi: ledgerAbi, functionName: "creatorCredited" }),
      c.readContract({ address: ledger, abi: ledgerAbi, functionName: "creatorClaimed" }),
    ]);
    const creditedWei = BigInt(credited as bigint), claimedWei = BigInt(claimed as bigint);
    return { ledger: ledger as Address, creator: creator as Address, quote: quote as Address, creditedWei, claimedWei, claimableWei: creditedWei > claimedWei ? creditedWei - claimedWei : 0n };
  } catch { return null; }
}

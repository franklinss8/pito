import "server-only";
import { createPublicClient, erc20Abi, http, parseAbi, getAddress, type Address, type Hex } from "viem";
import { mainnet } from "viem/chains";
import { env } from "./env";

let client: ReturnType<typeof createPublicClient> | null = null;
export function eth() {
  client ??= createPublicClient({ chain: mainnet, transport: http(env.rpcUrl, { timeout: 15_000 }) });
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

/* ---------- Programmable launch provenance (Ethereum Launch Stamp Router) ---------- */

// Primary Router from Programmable's Ethereum module release (contracts/deployments/ethereum-module-release-v2.json).
const PRIMARY_ROUTER = "0x8622DD5bAb44185f2A458ac90384Ac99248f8d56";
const MANIFEST_URLS = [
  "https://developers.programmable.family/api/v2/manifests/1",
  "https://developers.programmable.family/api/v2/manifest",
];

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

/** Every Router generation published in Programmable's manifest, plus the primary one. */
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
    } catch { /* manifest optional: primary Router still checked */ }
  }
  const list = [...found].map((a) => getAddress(a));
  routerCache = { at: Date.now(), list };
  return list;
}

export type LaunchProof = { router: Address; launchId: Hex; launchWallet: Address; hook: Address; poolId: Hex };

/** Finds the Programmable launch stamp for a token on Ethereum. Null when no Router recorded it. */
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

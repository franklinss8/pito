import { getAddress } from "viem";
import { db } from "@/lib/db";
import { ADDRESS_RE, findProgrammableLaunch, readFoundationMetadata, readToken } from "@/lib/eth";
import { fail, handleError, ok } from "@/lib/http";
import { marketCapUsd } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything Pito can learn about a token before creating its machine. */
export async function GET(req: Request) {
  try {
    const raw = new URL(req.url).searchParams.get("address") || "";
    if (!ADDRESS_RE.test(raw)) return fail(400, "bad_token", "Token address must be 0x followed by 40 hex characters.");
    const token = getAddress(raw);
    let meta; try { meta = await readToken(token); } catch { return fail(422, "not_a_token", "No ERC-20 token at this address on Ethereum mainnet."); }
    const [launch, onchain, existing, cap] = await Promise.all([
      findProgrammableLaunch(token), readFoundationMetadata(token),
      db().from("machines").select("id").eq("token_address", token.toLowerCase()).maybeSingle(),
      marketCapUsd(token),
    ]);
    let x = "";
    try { const r = await fetch(`https://developers.programmable.family/api/v2/launches/1/${token}`, { signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } }); if (r.ok) { const j = (await r.json()) as { token?: { metadata?: { x?: string; twitter?: string } } }; x = String(j.token?.metadata?.x ?? j.token?.metadata?.twitter ?? ""); } } catch {}
    return ok({
      address: token, name: meta.name, symbol: meta.symbol, decimals: meta.decimals,
      description: onchain.description, website: onchain.website, image: onchain.image, x: x.replace(/^https?:\/\/(x|twitter)\.com\//, "").replace(/^@/, ""),
      programmable: launch ? { verified: true, launchWallet: launch.launchWallet, router: launch.router, launchId: launch.launchId } : { verified: false },
      market_cap_usd: cap,
      existing_machine: existing.data?.id ?? null,
    });
  } catch (e) { return handleError(e); }
}

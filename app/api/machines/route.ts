import { getAddress } from "viem";
import { db, PUBLIC_MACHINE_COLUMNS } from "@/lib/db";
import { env } from "@/lib/env";
import { ADDRESS_RE, findProgrammableLaunch, readToken } from "@/lib/eth";
import { verifyAction } from "@/lib/auth";
import { fail, handleError, ok, readJson } from "@/lib/http";
import { planMachine } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const { data, error } = await db().from("machines").select(PUBLIC_MACHINE_COLUMNS).order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    return ok({ machines: data });
  } catch (e) { return handleError(e); }
}

/** Register a machine: the token's Programmable launch wallet signs, Pito checks Ethereum, Claude drafts the plan. */
export async function POST(req: Request) {
  try {
    let body;
    try { body = await readJson(req); } catch { return fail(400, "BAD_REQUEST", "Send a JSON body."); }
    const tokenRaw = String(body.tokenAddress ?? "").trim();
    const mission = String(body.mission ?? "").trim();
    if (!ADDRESS_RE.test(tokenRaw)) return fail(400, "BAD_TOKEN", "Token address must be 0x followed by 40 hex characters.");
    if (mission.length < 12 || mission.length > 400) return fail(400, "BAD_MISSION", "Mission must be 12 to 400 characters.");
    const token = getAddress(tokenRaw);

    const signer = await verifyAction({ message: body.message, signature: body.signature, action: "register", target: token });

    const { data: existing } = await db().from("machines").select("id").eq("token_address", token.toLowerCase()).maybeSingle();
    if (existing) return fail(409, "ALREADY_REGISTERED", "This token already has a machine.");

    let meta;
    try { meta = await readToken(token); }
    catch { return fail(422, "NOT_A_TOKEN", "No ERC-20 token at this address on Ethereum mainnet. Copy the token address, not the pool."); }

    const launch = await findProgrammableLaunch(token);
    if (env.requireProgrammable) {
      if (!launch) return fail(422, "NOT_PROGRAMMABLE", "No Programmable launch stamp found for this token on Ethereum. If you just launched, wait for the transaction to finalize (about 15 minutes) and try again.");
      if (launch.launchWallet.toLowerCase() !== signer) return fail(403, "NOT_CREATOR", `Only the wallet that launched this token can register it (${launch.launchWallet}).`);
    }

    const { data: inserted, error } = await db().from("machines").insert({
      token_address: token.toLowerCase(),
      name: meta.name,
      symbol: meta.symbol,
      mission,
      creator: signer,
      router: launch?.router.toLowerCase() ?? null,
      launch_id: launch?.launchId ?? null,
      status: "planning",
    }).select("id,name,symbol,token_address,mission").single();
    if (error) {
      if ((error as { code?: string }).code === "23505") return fail(409, "ALREADY_REGISTERED", "This token already has a machine.");
      throw error;
    }

    const result = await planMachine(inserted);
    return ok({ id: inserted.id, status: result.status }, 201);
  } catch (e) { return handleError(e); }
}

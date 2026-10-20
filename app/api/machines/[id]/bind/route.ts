import { getAddress } from "viem";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyAction } from "@/lib/auth";
import { ADDRESS_RE, findProgrammableLaunch, readToken } from "@/lib/eth";
import { fail, handleError, ok, readJson, str } from "@/lib/http";
import { addStep, getMachine, remainingCents, startComputer } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Step 3 of the launch: bind the token launched on Programmable, then start the computer. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await getMachine(params.id);
    if (!m) return fail(404, "not_found", "No machine with this id.");
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const raw = str(b.tokenAddress, 42);
    if (!ADDRESS_RE.test(raw)) return fail(400, "bad_token", "Token address must be 0x followed by 40 hex characters.");
    const token = getAddress(raw);
    const signer = await verifyAction({ message: b.message, signature: b.signature, action: "bind", target: token });
    if (signer !== m.creator) return fail(403, "not_creator", "Only the wallet that created this machine can bind its token.");
    if (m.token_address) return fail(409, "already_bound", "This machine already has its token.");

    const { data: dup } = await db().from("machines").select("id").eq("token_address", token.toLowerCase()).maybeSingle();
    if (dup) return fail(409, "token_taken", "This token already has a machine.");

    let meta; try { meta = await readToken(token); } catch { return fail(422, "not_a_token", "No ERC-20 token at this address on Ethereum mainnet."); }
    const launch = await findProgrammableLaunch(token);
    if (env.requireProgrammable) {
      if (!launch) return fail(422, "not_programmable", "No Programmable launch stamp found for this token yet. Wait for the launch to finalize (about 15 minutes) and try again.");
      if (launch.launchWallet.toLowerCase() !== signer) return fail(403, "not_launch_wallet", `Only the wallet that launched this token can bind it (${launch.launchWallet}).`);
    }
    const patch = { token_address: token.toLowerCase(), router: launch?.router.toLowerCase() ?? null, launch_id: launch?.launchId ?? null, bound_at: new Date().toISOString(), status: "bound", name: m.name || meta.name, symbol: m.symbol || meta.symbol };
    await db().from("machines").update(patch).eq("id", m.id);
    await addStep(m.id, { kind: "system", note: `Token bound: ${meta.name} ($${meta.symbol}) at ${token}. Launch stamp ${launch ? "verified" : "not required"}.` });

    const fresh = { ...m, ...patch } as typeof m;
    let started: { ok: boolean; error?: string } = { ok: false, error: "No compute budget yet." };
    if (remainingCents(fresh) > 0 && fresh.gpu_type_id) started = await startComputer(fresh);
    return ok({ bound: true, started: started.ok, note: started.ok ? "The computer is starting." : started.error });
  } catch (e) { return handleError(e); }
}

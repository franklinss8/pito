import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { eth } from "@/lib/eth";
import { fail, handleError, ok, readJson } from "@/lib/http";
import { addStep, getMachine, remainingCents, startComputer } from "@/lib/machines";
import { ethUsd, weiToCents } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CONFIRMATIONS = 2n;

/**
 * Fund a machine's compute with ETH. Anyone can fund. The transaction pays the Pito treasury on
 * Ethereum mainnet and carries the machine id as calldata; it is credited in USD cents at the ETH rate of the moment.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const treasury = env.treasury;
    if (!treasury) return fail(400, "free_mode", "This Pito runs in free mode: machines get free hours and do not need funding.");
    const m = await getMachine(params.id);
    if (!m) return fail(404, "not_found", "No machine with this id.");
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const txHash = String(b.txHash ?? "").toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) return fail(400, "bad_tx", "Transaction hash must be 0x followed by 64 hex characters.");

    const { data: seen } = await db().from("deposits").select("cents").eq("tx_hash", txHash).maybeSingle();
    if (seen) return ok({ status: "credited", cents: seen.cents, alreadyCounted: true });

    const c = eth();
    const receipt = await c.getTransactionReceipt({ hash: txHash as `0x${string}` }).catch(() => null);
    if (!receipt) return ok({ status: "pending" }, 202);
    if (receipt.status !== "success") return fail(422, "tx_failed", "That transaction failed onchain.");
    if ((await c.getBlockNumber()) - receipt.blockNumber + 1n < CONFIRMATIONS) return ok({ status: "pending" }, 202);
    const tx = await c.getTransaction({ hash: txHash as `0x${string}` });
    if (tx.chainId !== undefined && tx.chainId !== 1) return fail(422, "wrong_chain", "That transaction is not on Ethereum mainnet.");
    if ((tx.to ?? "").toLowerCase() !== treasury) return fail(422, "wrong_recipient", "That transaction did not pay the Pito treasury.");
    if (tx.input.toLowerCase() !== "0x" + m.id.replace(/-/g, "")) return fail(422, "wrong_machine", "That payment is not tagged for this machine. Use the Fund button on its page.");

    const cents = weiToCents(tx.value, await ethUsd());
    if (cents < 50) return fail(422, "too_small", "The payment is below the minimum of $0.50.");
    const { error } = await db().from("deposits").insert({ tx_hash: txHash, machine_id: m.id, from_address: tx.from.toLowerCase(), value_wei: tx.value.toString(), cents });
    if (error) { if ((error as { code?: string }).code === "23505") return ok({ status: "credited", alreadyCounted: true }); throw error; }
    const { error: e2 } = await db().rpc("add_budget", { p_machine: m.id, p_cents: cents });
    if (e2) throw e2;
    await addStep(m.id, { kind: "system", note: `Compute funded: $${(cents / 100).toFixed(2)} from ${tx.from.slice(0, 8)}…` });

    // Auto-start when the token is bound and the computer is not running.
    let started = false;
    const fresh = { ...m, budget_cents: m.budget_cents + cents };
    if (fresh.token_address && ["bound", "stopped", "error"].includes(fresh.status) && remainingCents(fresh) > 0 && fresh.gpu_type_id) started = (await startComputer(fresh)).ok;
    return ok({ status: "credited", cents, started });
  } catch (e) { return handleError(e); }
}

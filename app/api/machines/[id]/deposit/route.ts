import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { eth } from "@/lib/eth";
import { fail, handleError, ok, readJson } from "@/lib/http";
import { getMachine } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CONFIRMATIONS = 2n;

/**
 * Credit a machine for an ETH payment to the Pito treasury.
 * Anyone (creator or holders) can fund a machine. The transaction must send ETH
 * directly to the treasury on Ethereum mainnet and carry the machine id as calldata.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const treasury = env.treasury;
    if (!treasury) return fail(400, "FREE_MODE", "This Pito runs in free mode; machines do not need funding.");
    const machine = await getMachine(params.id);
    if (!machine) return fail(404, "NOT_FOUND", "No machine with this id.");
    let body;
    try { body = await readJson(req); } catch { return fail(400, "BAD_REQUEST", "Send a JSON body."); }
    const txHash = String(body.txHash ?? "").toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) return fail(400, "BAD_TX", "Transaction hash must be 0x followed by 64 hex characters.");

    const { data: seen } = await db().from("deposits").select("machine_id,credits").eq("tx_hash", txHash).maybeSingle();
    if (seen) return ok({ status: "credited", credits: seen.credits, alreadyCounted: true });

    const c = eth();
    const receipt = await c.getTransactionReceipt({ hash: txHash as `0x${string}` }).catch(() => null);
    if (!receipt) return ok({ status: "pending" }, 202);
    if (receipt.status !== "success") return fail(422, "TX_FAILED", "That transaction failed onchain. No credits were added.");
    const head = await c.getBlockNumber();
    if (head - receipt.blockNumber + 1n < CONFIRMATIONS) return ok({ status: "pending" }, 202);

    const tx = await c.getTransaction({ hash: txHash as `0x${string}` });
    if (tx.chainId !== undefined && tx.chainId !== 1) return fail(422, "WRONG_CHAIN", "That transaction is not on Ethereum mainnet.");
    if ((tx.to ?? "").toLowerCase() !== treasury) return fail(422, "WRONG_RECIPIENT", "That transaction did not pay the Pito treasury.");
    const tag = "0x" + machine.id.replace(/-/g, "");
    if (tx.input.toLowerCase() !== tag) return fail(422, "WRONG_MACHINE", "That payment is not tagged for this machine. Use the Fund button on this page.");

    const credits = Number(tx.value / env.runPriceWei);
    if (credits < 1) return fail(422, "TOO_SMALL", "The payment is below the price of one run.");

    const { error } = await db().from("deposits").insert({ tx_hash: txHash, machine_id: machine.id, from_address: tx.from.toLowerCase(), value_wei: tx.value.toString(), credits });
    if (error) {
      if ((error as { code?: string }).code === "23505") return ok({ status: "credited", alreadyCounted: true });
      throw error;
    }
    const { error: e2 } = await db().rpc("add_credits", { p_machine: machine.id, p_amount: credits });
    if (e2) throw e2;
    return ok({ status: "credited", credits });
  } catch (e) { return handleError(e); }
}

import { db, UUID_RE, type Rental } from "@/lib/db";
import { env } from "@/lib/env";
import { eth } from "@/lib/eth";
import { fail, handleError, ok, readJson } from "@/lib/http";
import { ethUsd, weiToCents } from "@/lib/market";
import { createPod, proxyUrl } from "@/lib/runpod";
import { getTemplate } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Credit a rental with a verified ETH payment, then boot the computer. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const treasury = env.treasury;
    if (!treasury || !UUID_RE.test(params.id)) return fail(400, "bad_request", "Bad request.");
    const { data: r } = await db().from("rentals").select("*").eq("id", params.id).maybeSingle();
    const rental = r as Rental | null;
    if (!rental) return fail(404, "not_found", "No rental with this id.");
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const txHash = String(b.txHash ?? "").toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) return fail(400, "bad_tx", "Bad transaction hash.");
    const { data: seen } = await db().from("deposits").select("cents").eq("tx_hash", txHash).maybeSingle();
    if (!seen) {
      const c = eth();
      const receipt = await c.getTransactionReceipt({ hash: txHash as `0x${string}` }).catch(() => null);
      if (!receipt) return ok({ status: "pending" }, 202);
      if (receipt.status !== "success") return fail(422, "tx_failed", "That transaction failed onchain.");
      if ((await c.getBlockNumber()) - receipt.blockNumber + 1n < 2n) return ok({ status: "pending" }, 202);
      const tx = await c.getTransaction({ hash: txHash as `0x${string}` });
      if ((tx.to ?? "").toLowerCase() !== treasury) return fail(422, "wrong_recipient", "That transaction did not pay the Pito treasury.");
      if (tx.input.toLowerCase() !== "0x" + rental.id.replace(/-/g, "")) return fail(422, "wrong_rental", "That payment is not tagged for this rental.");
      const cents = weiToCents(tx.value, await ethUsd());
      if (cents < 100) return fail(422, "too_small", "Minimum $1.");
      const { error } = await db().from("deposits").insert({ tx_hash: txHash, rental_id: rental.id, from_address: tx.from.toLowerCase(), value_wei: tx.value.toString(), cents });
      if (error && (error as { code?: string }).code !== "23505") throw error;
      if (!error) await db().rpc("add_rental_budget", { p_rental: rental.id, p_cents: cents });
    }
    const { data: fresh } = await db().from("rentals").select("*").eq("id", rental.id).single();
    const rr = fresh as Rental;
    if (rr.status === "pending" && rr.budget_cents > rr.spent_cents) {
      const tpl = getTemplate(rr.template_id);
      const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, "0")).join("");
      const boot = `export DEBIAN_FRONTEND=noninteractive; (${tpl.setup || "true"}) > /workspace/setup.log 2>&1; pip install -q jupyterlab >/dev/null 2>&1; jupyter lab --ip=0.0.0.0 --port=8888 --allow-root --no-browser --ServerApp.token=${token} --ServerApp.root_dir=/workspace`;
      try {
        const { id } = await createPod({ name: `pito-rent-${rr.id.slice(0, 8)}`, gpuTypeId: rr.gpu_type_id, cloudType: "COMMUNITY", image: tpl.image, startCommand: boot, env: { JUPYTER_TOKEN: token }, diskGb: Math.max(40, tpl.diskGb), volumeGb: Math.max(40, tpl.diskGb), ports: "8888/http,22/tcp" });
        await db().from("rentals").update({ pod_id: id, status: "starting", started_at: new Date().toISOString(), last_billed_at: new Date().toISOString(), connect_url: `${proxyUrl(id, 8888)}/lab?token=${token}` }).eq("id", rr.id);
      } catch (e) {
        await db().from("rentals").update({ status: "error" }).eq("id", rr.id);
        return fail(502, "start_failed", e instanceof Error ? e.message : "Could not rent a computer.");
      }
    }
    return ok({ status: "credited", budget_cents: rr.budget_cents });
  } catch (e) { return handleError(e); }
}

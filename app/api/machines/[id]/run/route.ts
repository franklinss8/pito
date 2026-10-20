import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyAction } from "@/lib/auth";
import { fail, handleError, ok, readJson } from "@/lib/http";
import { getMachine, latestJob, refreshJob } from "@/lib/machines";
import { DONE, submitJob } from "@/lib/runpod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Start a GPU run for a machine. Only the machine's creator wallet can start one. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const machine = await getMachine(params.id);
    if (!machine) return fail(404, "NOT_FOUND", "No machine with this id.");
    let body;
    try { body = await readJson(req); } catch { return fail(400, "BAD_REQUEST", "Send a JSON body."); }

    const signer = await verifyAction({ message: body.message, signature: body.signature, action: "run", target: machine.id });
    if (signer !== machine.creator) return fail(403, "NOT_CREATOR", "Only the wallet that launched this token can start its machine.");
    if (!machine.plan || !machine.plan.steps?.length) return fail(409, "NO_PLAN", "This machine has no build plan yet. Redraft the plan first.");

    const current = await refreshJob(machine, await latestJob(machine.id));
    if (current && !DONE.has(current.status)) return fail(409, "ALREADY_RUNNING", "A run is already in progress for this machine.");

    if (env.treasury) {
      const { data: okCredit, error } = await db().rpc("consume_credit", { p_machine: machine.id });
      if (error) throw error;
      if (!okCredit) return fail(402, "NO_CREDITS", "This machine has no compute credits. Fund it with ETH first.");
    } else {
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).eq("machine_id", machine.id).gte("created_at", since);
      if ((count ?? 0) >= env.freeRunsPerDay) return fail(429, "DAILY_LIMIT", `This machine used its ${env.freeRunsPerDay} free run(s) for the last 24 hours. Try again later.`);
    }

    let runpodId: string;
    try {
      runpodId = await submitJob({
        token: { address: machine.token_address, name: machine.name, symbol: machine.symbol, chainId: 1 },
        mission: machine.mission,
        plan: machine.plan,
      });
    } catch (e) {
      if (env.treasury) await db().rpc("add_credits", { p_machine: machine.id, p_amount: 1 });
      console.error("runpod submit failed", e instanceof Error ? e.message : e);
      return fail(502, "GPU_UNAVAILABLE", "The GPU service did not accept the job. Your credit was returned. Try again in a few minutes.");
    }

    const { data: job, error } = await db().from("jobs").insert({ machine_id: machine.id, runpod_id: runpodId, status: "IN_QUEUE" }).select("id,status,created_at").single();
    if (error) throw error;
    await db().from("machines").update({ status: "running" }).eq("id", machine.id);
    return ok({ job }, 202);
  } catch (e) { return handleError(e); }
}

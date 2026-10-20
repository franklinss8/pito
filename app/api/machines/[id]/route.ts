import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fail, handleError, ok } from "@/lib/http";
import { getMachine, latestJob, refreshJob } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    let machine = await getMachine(params.id);
    if (!machine) return fail(404, "NOT_FOUND", "No machine with this id.");
    const before = await latestJob(machine.id);
    const job = await refreshJob(machine, before);
    if (job?.status !== before?.status) machine = (await getMachine(params.id)) ?? machine;

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).eq("machine_id", machine.id).gte("created_at", since);

    return ok({
      machine,
      job: job && { id: job.id, status: job.status, error: job.error, model: job.model, created_at: job.created_at, finished_at: job.finished_at },
      funding: env.treasury
        ? { mode: "paid", treasury: env.treasury, runPriceWei: env.runPriceWei.toString(), credits: machine.credits }
        : { mode: "free", freeRunsPerDay: env.freeRunsPerDay, usedToday: count ?? 0 },
    });
  } catch (e) { return handleError(e); }
}

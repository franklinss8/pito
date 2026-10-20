import "server-only";
import { db, PUBLIC_MACHINE_COLUMNS, type Job, type Machine } from "./db";
import { DONE, jobStatus } from "./runpod";
import { draftPlan } from "./claude";

const MAX_HTML = 600_000;

export async function getMachine(id: string): Promise<Machine | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("machines").select(PUBLIC_MACHINE_COLUMNS).eq("id", id).maybeSingle();
  return (data as Machine | null) ?? null;
}

export async function latestJob(machineId: string): Promise<Job | null> {
  const { data } = await db().from("jobs").select("*").eq("machine_id", machineId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as Job | null) ?? null;
}

/** Polls RunPod for an unfinished job (at most every 5 s) and stores the result when it finishes. */
export async function refreshJob(machine: Machine, job: Job | null): Promise<Job | null> {
  if (!job || DONE.has(job.status)) return job;
  if (job.last_polled_at && Date.now() - Date.parse(job.last_polled_at) < 5000) return job;
  const now = new Date().toISOString();
  let s;
  try { s = await jobStatus(job.runpod_id); }
  catch { await db().from("jobs").update({ last_polled_at: now }).eq("id", job.id); return job; }

  if (!DONE.has(s.status)) {
    const { data } = await db().from("jobs").update({ status: s.status, last_polled_at: now }).eq("id", job.id).select("*").single();
    return data as Job;
  }

  const html = s.output?.html;
  if (s.status === "COMPLETED" && typeof html === "string" && html.length > 50 && html.length <= MAX_HTML && !s.output?.error) {
    await db().from("machines").update({ app_html: html, app_updated_at: now, status: "live" }).eq("id", machine.id);
    const { data } = await db().from("jobs").update({ status: "COMPLETED", model: s.output?.model ?? null, finished_at: now, last_polled_at: now }).eq("id", job.id).select("*").single();
    return data as Job;
  }

  const error = (s.output?.error || s.error || (s.status === "COMPLETED" ? "The worker returned no usable app." : s.status)).toString().slice(0, 300);
  await db().from("machines").update({ status: machine.app_updated_at ? "live" : "ready" }).eq("id", machine.id);
  const { data } = await db().from("jobs").update({ status: s.status === "COMPLETED" ? "FAILED" : s.status, error, finished_at: now, last_polled_at: now }).eq("id", job.id).select("*").single();
  return data as Job;
}

export async function planMachine(m: Pick<Machine, "id" | "name" | "symbol" | "token_address" | "mission">) {
  try {
    const plan = await draftPlan({ name: m.name, symbol: m.symbol, token: m.token_address, mission: m.mission });
    const status = plan.steps.length ? "ready" : "plan_failed";
    await db().from("machines").update({ plan, status }).eq("id", m.id);
    return { plan, status };
  } catch (e) {
    console.error("plan failed", e instanceof Error ? e.message : e);
    await db().from("machines").update({ status: "plan_failed" }).eq("id", m.id);
    return { plan: null, status: "plan_failed" as const };
  }
}

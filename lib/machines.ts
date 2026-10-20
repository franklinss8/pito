import "server-only";
import { db, PUBLIC_MACHINE_COLUMNS, UUID_RE, type Machine, type Step } from "./db";
import { env } from "./env";
import { createPod, getPod, proxyUrl, stopPod } from "./runpod";
import { getTemplate } from "./templates";

export async function getMachine(id: string): Promise<Machine | null> {
  if (!UUID_RE.test(id)) return null;
  const { data } = await db().from("machines").select(PUBLIC_MACHINE_COLUMNS).eq("id", id).maybeSingle();
  return (data as Machine | null) ?? null;
}

export async function listMachines(opts: { sort?: "new" | "mcap"; limit?: number; offset?: number; liveOnly?: boolean } = {}): Promise<Machine[]> {
  let q = db().from("machines").select(PUBLIC_MACHINE_COLUMNS);
  if (opts.liveOnly) q = q.not("token_address", "is", null);
  q = opts.sort === "mcap" ? q.order("market_cap_usd", { ascending: false, nullsFirst: false }) : q.order("created_at", { ascending: false });
  const limit = Math.min(100, Math.max(1, opts.limit ?? 25)), offset = Math.max(0, opts.offset ?? 0);
  const { data } = await q.range(offset, offset + limit - 1);
  return (data ?? []) as Machine[];
}

export async function addStep(machineId: string, s: Partial<Step> & { kind: string }) {
  await db().from("steps").insert({ machine_id: machineId, kind: s.kind, command: s.command ?? null, output: s.output?.slice(0, 20_000) ?? null, note: s.note?.slice(0, 4000) ?? null });
}

export async function counts(machineId: string) {
  const [s, m] = await Promise.all([
    db().from("steps").select("id", { count: "exact", head: true }).eq("machine_id", machineId),
    db().from("messages").select("id", { count: "exact", head: true }).eq("machine_id", machineId).eq("is_ai", false),
  ]);
  return { ai_steps: s.count ?? 0, holder_messages: m.count ?? 0 };
}

/** Remaining compute, in cents. Free mode gives every machine PITO_FREE_HOURS at its GPU price. */
export function remainingCents(m: Machine): number {
  const allowance = env.treasury ? m.budget_cents : m.budget_cents + Math.round(env.freeHours * m.price_cents_per_hour);
  return allowance - m.spent_cents;
}

/** Boots the machine's computer: a RunPod pod running the chosen template plus the Pito agent. */
export async function startComputer(m: Machine): Promise<{ ok: true; podId: string } | { ok: false; error: string }> {
  if (!env.hasRunpod) return { ok: false, error: "GPU provider is not configured on this Pito." };
  if (!m.gpu_type_id) return { ok: false, error: "No GPU selected." };
  if (remainingCents(m) <= 0) return { ok: false, error: "No compute budget. Fund the machine first." };
  const { data: secret } = await db().from("machines").select("agent_token").eq("id", m.id).single();
  const tpl = getTemplate(m.template_id);
  const boot = `export DEBIAN_FRONTEND=noninteractive; (${tpl.setup || "true"}) > /workspace/setup.log 2>&1; curl -fsSL "$PITO_API/agent/bootstrap.sh" | bash`;
  try {
    const { id } = await createPod({
      name: `pito-${m.symbol || "machine"}-${m.id.slice(0, 8)}`,
      gpuTypeId: m.gpu_type_id,
      cloudType: m.cloud_type === "SECURE" ? "SECURE" : "COMMUNITY",
      image: tpl.image,
      startCommand: boot,
      diskGb: Math.max(40, tpl.diskGb),
      volumeGb: Math.max(40, tpl.diskGb),
      env: { PITO_API: env.siteUrl, PITO_MACHINE_ID: m.id, PITO_AGENT_TOKEN: secret?.agent_token ?? "", PITO_AI_MODEL: m.ai_model, PITO_TEMPLATE: tpl.id },
    });
    await db().from("machines").update({ pod_id: id, pod_status: "CREATED", status: "starting", app_url: proxyUrl(id, 8080), agent_started_at: new Date().toISOString(), last_billed_at: new Date().toISOString() }).eq("id", m.id);
    await addStep(m.id, { kind: "system", note: `Computer rented (${m.gpu_name || m.gpu_type_id}). Installing ${tpl.name}, screen share and the AI.` });
    return { ok: true, podId: id };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Could not rent a computer.";
    await db().from("machines").update({ status: "error", pod_status: error.slice(0, 200) }).eq("id", m.id);
    await addStep(m.id, { kind: "system", note: `Could not start the computer: ${error}` });
    return { ok: false, error };
  }
}

/** Called by the cron: syncs pod status, bills time, stops exhausted machines. */
export async function tickMachine(m: Machine) {
  if (!m.pod_id || !env.hasRunpod) return;
  const pod = await getPod(m.pod_id).catch(() => null);
  const now = new Date();
  if (!pod) { await db().from("machines").update({ pod_status: "GONE", status: "stopped" }).eq("id", m.id); return; }
  const running = pod.desiredStatus === "RUNNING";
  const patch: Record<string, unknown> = { pod_status: pod.desiredStatus };
  if (pod.gpuDisplayName && pod.gpuDisplayName !== m.gpu_name) patch.gpu_name = pod.gpuDisplayName;
  if (running) {
    const since = m.last_billed_at ? Date.parse(m.last_billed_at) : now.getTime();
    const hours = Math.max(0, now.getTime() - since) / 3_600_000;
    patch.spent_cents = m.spent_cents + Math.round(hours * m.price_cents_per_hour);
    patch.last_billed_at = now.toISOString();
    if (m.status === "starting" && m.last_seen_at) patch.status = "running";
    const remaining = remainingCents({ ...m, spent_cents: patch.spent_cents as number });
    if (remaining <= 0) {
      await stopPod(m.pod_id).catch(() => {});
      patch.status = "stopped"; patch.pod_status = "EXITED";
      await addStep(m.id, { kind: "system", note: "Compute budget used up. The computer was stopped; fund the machine to resume." });
    }
  } else if (m.status === "running" || m.status === "starting") {
    if (pod.desiredStatus === "EXITED") patch.status = "stopped";
  }
  await db().from("machines").update(patch).eq("id", m.id);
}

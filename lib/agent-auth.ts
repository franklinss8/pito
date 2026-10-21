import "server-only";
import { db, PUBLIC_MACHINE_COLUMNS, UUID_RE, type Machine } from "./db";
import { tickMachine } from "./machines";

/** Authenticates the agent running on a machine's computer: Bearer <agent_token>. */
export async function agentMachine(req: Request, id: string): Promise<Machine | null> {
  if (!UUID_RE.test(id)) return null;
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const { data } = await db().from("machines").select(PUBLIC_MACHINE_COLUMNS).eq("id", id).eq("agent_token", token).maybeSingle();
  if (!data) return null;
  let m = data as Machine;
  await db().from("machines").update({ last_seen_at: new Date().toISOString(), ...(m.status === "starting" ? { status: "running" } : {}) }).eq("id", id);
  // Heartbeat billing: every 5 minutes of agent activity, bill the elapsed time and stop the pod when the budget is gone.
  if (m.pod_id && (!m.last_billed_at || Date.now() - Date.parse(m.last_billed_at) > 5 * 60_000)) {
    await tickMachine(m).catch(() => {});
    const { data: fresh } = await db().from("machines").select(PUBLIC_MACHINE_COLUMNS).eq("id", id).maybeSingle();
    if (fresh) m = fresh as Machine;
  }
  return m;
}

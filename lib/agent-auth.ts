import "server-only";
import { db, PUBLIC_MACHINE_COLUMNS, UUID_RE, type Machine } from "./db";

/** Authenticates the agent running on a machine's computer: Bearer <agent_token>. */
export async function agentMachine(req: Request, id: string): Promise<Machine | null> {
  if (!UUID_RE.test(id)) return null;
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const { data } = await db().from("machines").select(PUBLIC_MACHINE_COLUMNS).eq("id", id).eq("agent_token", token).maybeSingle();
  if (!data) return null;
  await db().from("machines").update({ last_seen_at: new Date().toISOString(), ...(data.status === "starting" ? { status: "running" } : {}) }).eq("id", id);
  return data as Machine;
}

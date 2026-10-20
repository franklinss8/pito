import { db, PUBLIC_MACHINE_COLUMNS, type Machine, type Rental } from "@/lib/db";
import { env } from "@/lib/env";
import { fail, handleError, ok } from "@/lib/http";
import { tickMachine } from "@/lib/machines";
import { getPod, stopPod } from "@/lib/runpod";
import { refreshMarket } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Every 10 minutes (vercel.json): bill running computers, stop the ones out of budget, refresh market caps. */
export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    if (env.cronSecret && auth !== `Bearer ${env.cronSecret}`) return fail(401, "unauthenticated", "Bad cron secret.");
    const { data } = await db().from("machines").select(PUBLIC_MACHINE_COLUMNS).in("status", ["starting", "running", "stopped"]).not("pod_id", "is", null).limit(100);
    const machines = (data ?? []) as Machine[];
    let billed = 0;
    for (const m of machines) { if (m.status !== "stopped") { await tickMachine(m).catch((e) => console.error("tick", m.id, e)); billed++; } }

    const { data: live } = await db().from("machines").select("id,token_address,market_updated_at").not("token_address", "is", null).limit(100);
    for (const m of live ?? []) await refreshMarket(m).catch(() => {});

    const { data: rentals } = await db().from("rentals").select("*").in("status", ["starting", "running"]).limit(100);
    for (const r of (rentals ?? []) as Rental[]) {
      if (!r.pod_id) continue;
      const pod = await getPod(r.pod_id).catch(() => null);
      const now = new Date();
      if (!pod) { await db().from("rentals").update({ status: "stopped" }).eq("id", r.id); continue; }
      if (pod.desiredStatus !== "RUNNING") continue;
      const hours = Math.max(0, now.getTime() - Date.parse(r.last_billed_at ?? r.started_at ?? now.toISOString())) / 3_600_000;
      const spent = r.spent_cents + Math.round(hours * r.price_cents_per_hour);
      const patch: Record<string, unknown> = { spent_cents: spent, last_billed_at: now.toISOString(), status: "running" };
      if (spent >= r.budget_cents) { await stopPod(r.pod_id).catch(() => {}); patch.status = "stopped"; }
      await db().from("rentals").update(patch).eq("id", r.id);
    }
    return ok({ machines: machines.length, billed, rentals: rentals?.length ?? 0 });
  } catch (e) { return handleError(e); }
}

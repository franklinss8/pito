import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fail, handleError, ok } from "@/lib/http";
import { counts, getMachine, remainingCents } from "@/lib/machines";
import { refreshMarket } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the project page needs, in one call. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await getMachine(params.id);
    if (!m) return fail(404, "not_found", "No machine with this id.");
    const cap = await refreshMarket(m).catch(() => null);
    if (cap !== null) m.market_cap_usd = cap;
    const [{ ai_steps, holder_messages }, steps, messages] = await Promise.all([
      counts(m.id),
      db().from("steps").select("*").eq("machine_id", m.id).order("created_at", { ascending: false }).limit(25),
      db().from("messages").select("*").eq("machine_id", m.id).order("created_at", { ascending: false }).limit(60),
    ]);
    const stale = !m.last_seen_at || Date.now() - Date.parse(m.last_seen_at) > 120_000;
    return ok({
      machine: m,
      stats: { ai_steps, holder_messages, remaining_cents: remainingCents(m), online: m.status === "running" && !stale },
      steps: (steps.data ?? []).reverse(),
      messages: (messages.data ?? []).reverse(),
      funding: env.treasury ? { mode: "paid", treasury: env.treasury } : { mode: "free", freeHours: env.freeHours },
      frame_url: m.last_frame_at ? `/api/public/v1/machine/frame?id=${m.id}&t=${Date.parse(m.last_frame_at)}` : null,
    });
  } catch (e) { return handleError(e); }
}

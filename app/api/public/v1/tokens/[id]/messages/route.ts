import { db } from "@/lib/db";
import { fail, handleError, ok } from "@/lib/http";
import { getMachine } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: the public conversation. POST: holders message the AI (signed; same contract as /api/machines/{id}/messages). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await getMachine(params.id);
    if (!m) return fail(404, "not_found", "No machine with this id.");
    const { data } = await db().from("messages").select("id,wallet,body,is_ai,reply_to,kind,status,votes,created_at").eq("machine_id", m.id).order("created_at", { ascending: false }).limit(100);
    return ok({ data: (data ?? []).reverse() }, 200, "public, max-age=5");
  } catch (e) { return handleError(e); }
}
export { POST, OPTIONS } from "@/app/api/machines/[id]/messages/route";

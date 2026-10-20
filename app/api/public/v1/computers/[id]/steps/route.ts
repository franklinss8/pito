import { db } from "@/lib/db";
import { fail, handleError, ok, options } from "@/lib/http";
import { getMachine } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() { return options(); }

/** GET /api/public/v1/computers/{id}/steps?limit=50 — what the AI did, newest first. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await getMachine(params.id);
    if (!m) return fail(404, "not_found", "No computer with this id.");
    const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 50));
    const { data } = await db().from("steps").select("id,kind,command,output,note,created_at").eq("machine_id", m.id).order("created_at", { ascending: false }).limit(limit);
    return ok({ data: data ?? [] }, 200, "public, max-age=5");
  } catch (e) { return handleError(e); }
}

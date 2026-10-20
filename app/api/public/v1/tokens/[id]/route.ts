import { fail, handleError, ok, options } from "@/lib/http";
import { counts, getMachine } from "@/lib/machines";
import { publicToken } from "@/lib/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() { return options(); }

/** GET /api/public/v1/tokens/{id} — one token, its computer, plan and activity counts. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await getMachine(params.id);
    if (!m || !m.token_address) return fail(404, "not_found", "No live token with this id.");
    const c = await counts(m.id);
    return ok({ data: publicToken(m, { plan: m.plan, ai_steps: c.ai_steps, holder_messages: c.holder_messages, website: m.website || null, x: m.x_handle ? `https://x.com/${m.x_handle}` : null }) }, 200, "public, max-age=15");
  } catch (e) { return handleError(e); }
}

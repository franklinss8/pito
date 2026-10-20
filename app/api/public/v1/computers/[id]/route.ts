import { fail, handleError, ok, options } from "@/lib/http";
import { counts, getMachine } from "@/lib/machines";
import { getTemplate } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() { return options(); }

/** GET /api/public/v1/computers/{id} — the computer behind a token. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await getMachine(params.id);
    if (!m) return fail(404, "not_found", "No computer with this id.");
    const c = await counts(m.id);
    const stale = !m.last_seen_at || Date.now() - Date.parse(m.last_seen_at) > 120_000;
    return ok({
      data: {
        id: m.id, token_id: m.id, gpu: m.gpu_name || null, vram_gb: m.vram_gb || null, gpu_count: m.gpu_count, cloud: m.cloud_type,
        template: getTemplate(m.template_id).name, ai_model: m.ai_model, host: "Pito Cloud (RunPod)", os: "Ubuntu + CUDA",
        status: m.status, online: m.status === "running" && !stale, cost_usd_per_hour: m.price_cents_per_hour / 100,
        started_at: m.agent_started_at, last_seen_at: m.last_seen_at, last_frame_at: m.last_frame_at,
        app_url: m.app_updated_at ? `/app/${m.id}` : null, ai_steps: c.ai_steps, plan: m.plan,
      },
    }, 200, "public, max-age=10");
  } catch (e) { return handleError(e); }
}

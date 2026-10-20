import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyAction } from "@/lib/auth";
import { fail, handleError, ok, readJson, str } from "@/lib/http";
import { listMachines } from "@/lib/machines";
import { listGpuTypes, priceCents } from "@/lib/runpod";
import { AI_MODELS, getTemplate } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try { return ok({ machines: await listMachines({ limit: 60 }) }); } catch (e) { return handleError(e); }
}

/**
 * Step 1+2 of the launch: create the machine (token draft + mission + computer choice).
 * The creator signs; the machine gets its public pre-launch page right away.
 */
export async function POST(req: Request) {
  try {
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const name = str(b.name, 40), symbol = str(b.symbol, 10).replace(/^\$/, "").toUpperCase(), description = str(b.description, 500);
    const image_url = str(b.imageUrl, 500), website = str(b.website, 200), x_handle = str(b.x, 60).replace(/^@/, "");
    const mission = str(b.mission, 2000), template_id = getTemplate(str(b.templateId, 40)).id, gpu_type_id = str(b.gpuTypeId, 80);
    const ai_model = AI_MODELS.some((m) => m.id === b.aiModel) ? String(b.aiModel) : AI_MODELS[0].id;
    const cloud_type = b.cloudType === "SECURE" ? "SECURE" : "COMMUNITY";
    if (!name) return fail(400, "bad_name", "Give the token a name.");
    if (!/^[A-Z0-9]{1,10}$/.test(symbol)) return fail(400, "bad_symbol", "Ticker: letters and digits only, up to 10.");
    if (mission.length < 20) return fail(400, "bad_mission", "Describe what the computer should build, in at least a sentence.");
    if (image_url && !/^https:\/\/\S+$/i.test(image_url)) return fail(400, "bad_image", "Image URL must start with https://.");

    const creator = await verifyAction({ message: b.message, signature: b.signature, action: "create", target: symbol });

    let gpu_name = "", vram_gb = 0, price = 0;
    if (gpu_type_id) {
      if (!env.hasRunpod) return fail(503, "no_gpu_provider", "GPU inventory is not available on this Pito yet.");
      const g = (await listGpuTypes()).find((x) => x.id === gpu_type_id);
      if (!g || !g.pricePerHourUsd) return fail(400, "bad_gpu", "That GPU is not available right now. Pick another.");
      gpu_name = g.displayName; vram_gb = g.memoryInGb; price = priceCents(g.pricePerHourUsd);
    }

    const { data, error } = await db().from("machines").insert({
      name, symbol, description, image_url, website, x_handle, creator, mission, template_id, gpu_type_id, gpu_name, vram_gb, ai_model, cloud_type,
      price_cents_per_hour: price, status: "prelaunch",
    }).select("id").single();
    if (error) throw error;
    await db().from("steps").insert({ machine_id: data.id, kind: "system", note: "Pre-launch page created. Waiting for the token launch on Programmable." });
    return ok({ id: data.id, url: `${env.siteUrl}/project/${data.id}` }, 201);
  } catch (e) { return handleError(e); }
}

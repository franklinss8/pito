import { db, PUBLIC_MACHINE_COLUMNS } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyAction } from "@/lib/auth";
import { fail, handleError, ok, readJson, str } from "@/lib/http";
import { addStep } from "@/lib/machines";
import { listGpuTypes, priceCents } from "@/lib/runpod";
import { AI_MODELS, ANYTHING_API } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anything API: a machine with no token that builds and hosts one HTTP API for the wallet that pays for it. */
export async function POST(req: Request) {
  try {
    if (!env.hasRunpod) return fail(503, "no_gpu_provider", "Anything API is not available on this Pito yet.");
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const name = str(b.name, 48) || "Anything API", spec = str(b.spec, 4000), gpuTypeId = str(b.gpuTypeId, 80);
    const ai_model = AI_MODELS.some((m) => m.id === b.aiModel) ? String(b.aiModel) : AI_MODELS[0].id;
    if (spec.length < 30) return fail(400, "bad_spec", "Describe the API in a few sentences: what it takes in, what it returns, which services it connects.");
    const g = (await listGpuTypes()).find((x) => x.id === gpuTypeId && x.available);
    if (!g || !g.pricePerHourUsd) return fail(400, "bad_gpu", "That GPU is not available right now.");
    const wallet = await verifyAction({ message: b.message, signature: b.signature, action: "create", target: "anything-api" });
    const mission = `Build and host this HTTP API:\n\n${spec}`;
    const { data, error } = await db().from("machines").insert({
      name, symbol: "API", description: spec.slice(0, 500), creator: wallet, mission, template_id: ANYTHING_API.id,
      gpu_type_id: g.id, gpu_name: g.displayName, vram_gb: g.memoryInGb, ai_model, cloud_type: "COMMUNITY", price_cents_per_hour: priceCents(g.pricePerHourUsd), status: "bound",
    }).select("id").single();
    if (error) throw error;
    await addStep(data.id, { kind: "system", note: "Anything API machine created. Waiting for compute funding." });
    return ok({ id: data.id, price_cents_per_hour: priceCents(g.pricePerHourUsd), treasury: env.treasury, free: !env.treasury }, 201);
  } catch (e) { return handleError(e); }
}

/** My APIs (signed read). */
export async function PUT(req: Request) {
  try {
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const wallet = await verifyAction({ message: b.message, signature: b.signature, action: "request", target: "anything-api" });
    const { data } = await db().from("machines").select(PUBLIC_MACHINE_COLUMNS).eq("creator", wallet).eq("template_id", ANYTHING_API.id).order("created_at", { ascending: false }).limit(20);
    return ok({ apis: data ?? [] });
  } catch (e) { return handleError(e); }
}

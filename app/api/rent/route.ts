import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyAction } from "@/lib/auth";
import { fail, handleError, ok, readJson, str } from "@/lib/http";
import { listGpuTypes, priceCents } from "@/lib/runpod";
import { getTemplate } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rent: reserve a Pito computer of your own. Pay with ETH (deposit route), then it boots with Jupyter + SSH. */
export async function POST(req: Request) {
  try {
    if (!env.hasRunpod) return fail(503, "no_gpu_provider", "Rent is not available on this Pito yet.");
    if (!env.treasury) return fail(503, "free_mode", "Rent needs a treasury wallet (PITO_TREASURY). This Pito runs in free mode.");
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const gpuTypeId = str(b.gpuTypeId, 80), templateId = getTemplate(str(b.templateId, 40)).id;
    const g = (await listGpuTypes()).find((x) => x.id === gpuTypeId && x.available);
    if (!g || !g.pricePerHourUsd) return fail(400, "bad_gpu", "That GPU is not available right now.");
    const wallet = await verifyAction({ message: b.message, signature: b.signature, action: "rent", target: gpuTypeId });
    const { data, error } = await db().from("rentals").insert({ wallet, gpu_type_id: g.id, gpu_name: g.displayName, template_id: templateId, price_cents_per_hour: priceCents(g.pricePerHourUsd), status: "pending" }).select("id,price_cents_per_hour").single();
    if (error) throw error;
    return ok({ id: data.id, price_cents_per_hour: data.price_cents_per_hour, treasury: env.treasury }, 201);
  } catch (e) { return handleError(e); }
}

/** My rentals (signed read). */
export async function PUT(req: Request) {
  try {
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const wallet = await verifyAction({ message: b.message, signature: b.signature, action: "request", target: "rentals" });
    const { data } = await db().from("rentals").select("*").eq("wallet", wallet).order("created_at", { ascending: false }).limit(20);
    return ok({ rentals: data ?? [] });
  } catch (e) { return handleError(e); }
}

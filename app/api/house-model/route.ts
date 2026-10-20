import { getAddress } from "viem";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyAction } from "@/lib/auth";
import { isHolder } from "@/lib/eth";
import { fail, handleError, ok, readJson, str } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Open Models: chat with the open model hosted on Pito's own GPU (PITO_HOUSE_MODEL_URL, an
 * OpenAI-compatible endpoint such as Ollama or vLLM). Free for holders of any live Pito token.
 */
export async function GET() { return ok({ available: !!env.houseModelUrl, model: env.houseModelUrl ? env.houseModelName : null }); }

export async function POST(req: Request) {
  try {
    if (!env.houseModelUrl) return fail(503, "installing", "Open Models are still installing on our computers.");
    let b; try { b = await readJson(req, 100_000); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const wallet = await verifyAction({ message: b.message, signature: b.signature, action: "request", target: "house-model" });
    const { data: tokens } = await db().from("machines").select("token_address").not("token_address", "is", null).limit(50);
    let holder = false;
    for (const t of tokens ?? []) { if (await isHolder(getAddress(t.token_address as string), getAddress(wallet))) { holder = true; break; } }
    if (!holder) return fail(403, "not_holder", "Hold any live Pito token to chat for free.");
    const messages = (Array.isArray(b.messages) ? b.messages : []).slice(-20).map((m: { role?: string; content?: string }) => ({ role: m.role === "assistant" ? "assistant" : "user", content: str(m.content, 4000) }));
    const r = await fetch(`${env.houseModelUrl.replace(/\/$/, "")}/v1/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: env.houseModelName, messages, max_tokens: 1200 }), signal: AbortSignal.timeout(110_000) });
    if (!r.ok) return fail(502, "model_error", "The model did not answer.");
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return ok({ text: j.choices?.[0]?.message?.content ?? "" });
  } catch (e) { return handleError(e); }
}

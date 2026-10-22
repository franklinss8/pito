import { env } from "@/lib/env";
import { agentMachine } from "@/lib/agent-auth";
import { fail, handleError, ok, readJson } from "@/lib/http";
import { chargeCents, remainingCents } from "@/lib/machines";

/** Model list prices, USD per million tokens (input, output). Billed to the machine with the Pito margin. */
const PRICES: Record<string, [number, number]> = { "claude-opus-5-5": [15, 75], "claude-sonnet-5-5": [3, 15], "claude-haiku-5-5": [1, 5] };
type Msg = { role: "user" | "assistant"; content: string };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * The agent thinks through Pito: the Anthropic key never leaves the server.
 * Body: { system, messages:[{role, content}], max_tokens? } -> { text }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await agentMachine(req, params.id);
    if (!m) return fail(401, "unauthenticated", "Bad agent token.");
    if (m.ai_model.startsWith("local:")) return fail(400, "local_model", "This machine runs a local model.");
    if (remainingCents(m) <= 0) return fail(402, "no_budget", "Compute budget used up.");
    let b; try { b = await readJson(req, 400_000); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const messages: Msg[] = (Array.isArray(b.messages) ? b.messages.slice(-40) : [])
      .filter((x: unknown): x is Msg => !!x && typeof x === "object" && ["user", "assistant"].includes((x as Msg).role) && typeof (x as Msg).content === "string")
      .map((x: Msg) => ({ role: x.role, content: x.content.slice(0, 60_000) }));
    if (!messages.length || messages[0].role !== "user") return fail(400, "bad_request", "messages must start with a user turn and contain text only.");
    const model = ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"].includes(m.ai_model) ? m.ai_model : env.anthropicModel;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: Math.min(6000, Number(b.max_tokens) || 4000), system: String(b.system ?? "").slice(0, 20_000), messages }),
      signal: AbortSignal.timeout(110_000),
    });
    if (!r.ok) return fail(502, "llm_error", `Model call failed (${r.status}).`);
    const j = (await r.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } };
    const text = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    // Meter the thinking like the GPU: list price plus margin, in cents, added to the machine's spend.
    const [pin, pout] = PRICES[model] ?? PRICES["claude-sonnet-5-5"];
    const usd = ((j.usage?.input_tokens ?? 0) * pin + (j.usage?.output_tokens ?? 0) * pout) / 1_000_000;
    await chargeCents(m.id, Math.ceil(usd * 100 * (1 + env.marginPct / 100))).catch(() => {});
    return ok({ text, stop_reason: j.stop_reason ?? null, model });
  } catch (e) { return handleError(e); }
}

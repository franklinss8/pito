import "server-only";
import { env } from "./env";
import type { Plan } from "./db";

/** Drafts a machine's build plan with the Claude API (Messages API). */
export async function draftPlan(input: { name: string; symbol: string; token: string; mission: string }): Promise<Plan> {
  const system =
    "You plan builds for Pito machines. Each Ethereum token gets one GPU worker running an open code model. " +
    "The worker produces ONE self-contained HTML file (inline CSS and JS, no network requests, no wallet transactions) " +
    "that holders open in a sandboxed frame. Plan something that fits that: an interactive tool, game, visualizer, " +
    "guide or generator. Never promise prices, returns, airdrops or anything financial. If the mission asks for something " +
    "unsafe, illegal, deceptive or market manipulation, set steps to [] and explain the refusal in summary. Reply with JSON only.";
  const user =
    `Token: ${input.name || "unknown"} ($${input.symbol || "?"}), contract ${input.token} on Ethereum.\n` +
    `Creator's mission: """${input.mission}"""\n\n` +
    `Return exactly: {"summary": string (max 30 words), "steps": [{"title": string (max 6 words), "detail": string (max 20 words)}] (3-5 items), ` +
    `"gpu": string (e.g. "1x 48 GB"), "deliverable": string (max 8 words)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: env.anthropicModel, max_tokens: 1200, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const p = JSON.parse(json) as Partial<Plan>;
  return {
    summary: String(p.summary ?? "").slice(0, 240),
    gpu: String(p.gpu ?? "").slice(0, 40),
    deliverable: String(p.deliverable ?? "").slice(0, 80),
    steps: (Array.isArray(p.steps) ? p.steps : []).slice(0, 6).map((s) => ({
      title: String(s?.title ?? "").slice(0, 60),
      detail: String(s?.detail ?? "").slice(0, 160),
    })),
  };
}

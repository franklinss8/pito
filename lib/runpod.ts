import "server-only";
import { env } from "./env";

const base = () => `https://api.runpod.ai/v2/${env.runpodEndpoint}`;
const headers = () => ({ Authorization: `Bearer ${env.runpodKey}`, "Content-Type": "application/json" });

export type RunpodStatus = {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
  output?: { html?: string; model?: string; error?: string };
  error?: string;
};

export async function submitJob(input: Record<string, unknown>): Promise<string> {
  const r = await fetch(`${base()}/run`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ input, policy: { executionTimeout: 15 * 60_000, ttl: 60 * 60_000 } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`RunPod ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = (await r.json()) as { id?: string };
  if (!j.id) throw new Error("RunPod returned no job id");
  return j.id;
}

export async function jobStatus(id: string): Promise<RunpodStatus> {
  const r = await fetch(`${base()}/status/${encodeURIComponent(id)}`, { headers: headers(), signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!r.ok) throw new Error(`RunPod ${r.status}`);
  return (await r.json()) as RunpodStatus;
}

export const DONE = new Set(["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"]);

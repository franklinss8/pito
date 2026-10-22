import "server-only";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  get rpcUrl() { return need("ETH_RPC_URL"); },
  get supabaseUrl() { return need("SUPABASE_URL"); },
  get supabaseKey() { return need("SUPABASE_SERVICE_ROLE_KEY"); },
  get anthropicKey() { return need("ANTHROPIC_API_KEY"); },
  get anthropicModel() { return process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5"; },
  get runpodKey() { return need("RUNPOD_API_KEY"); },
  get hasRunpod() { return !!process.env.RUNPOD_API_KEY; },
  /** Docker image that boots the Pito agent on every machine (built from agent/). */
  get agentImage() { return process.env.PITO_AGENT_IMAGE || "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04"; },
  get agentBootstrapUrl() { return `${this.siteUrl}/agent/bootstrap.sh`; },
  get siteUrl() {
    const s = process.env.PITO_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
    if (!s) throw new Error("Missing PITO_SITE_URL");
    return s.replace(/\/$/, "");
  },
  get cronSecret() { return process.env.CRON_SECRET || ""; },
  get treasury(): `0x${string}` | null {
    const t = (process.env.PITO_TREASURY || "").trim();
    return /^0x[0-9a-fA-F]{40}$/.test(t) ? (t.toLowerCase() as `0x${string}`) : null;
  },
  /** Free mode: hours of compute every machine gets on the house when no treasury is set. */
  get freeHours(): number { const n = Number(process.env.PITO_FREE_HOURS ?? "2"); return Number.isFinite(n) && n >= 0 ? n : 2; },
  get requireProgrammable(): boolean { return (process.env.PITO_REQUIRE_PROGRAMMABLE ?? "true") !== "false"; },
  /** Pito margin on GPU prices, in percent. */
  get marginPct(): number { const n = Number(process.env.PITO_MARGIN_PCT ?? "20"); return Number.isFinite(n) ? n : 20; },
  get houseModelUrl() { return process.env.PITO_HOUSE_MODEL_URL || ""; },
  get houseModelName() { return process.env.PITO_HOUSE_MODEL_NAME || "qwen2.5-coder:14b"; },
};

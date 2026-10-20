import "server-only";
import { parseEther } from "viem";

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
  get runpodEndpoint() { return need("RUNPOD_ENDPOINT_ID"); },
  get treasury(): `0x${string}` | null {
    const t = (process.env.PITO_TREASURY || "").trim();
    return /^0x[0-9a-fA-F]{40}$/.test(t) ? (t.toLowerCase() as `0x${string}`) : null;
  },
  get runPriceWei(): bigint {
    return parseEther(process.env.PITO_RUN_PRICE_ETH || "0.005");
  },
  get freeRunsPerDay(): number {
    const n = Number(process.env.PITO_FREE_RUNS_PER_DAY ?? "1");
    return Number.isInteger(n) && n >= 0 ? n : 1;
  },
  get requireProgrammable(): boolean {
    return (process.env.PITO_REQUIRE_PROGRAMMABLE ?? "true") !== "false";
  },
};

import "server-only";
import { env } from "./env";
import type { Machine } from "./db";

/** Public API shape of a machine (Web4-compatible field names). */
export function publicToken(m: Machine, extra: Record<string, unknown> = {}) {
  const stale = !m.last_seen_at || Date.now() - Date.parse(m.last_seen_at) > 120_000;
  const status = m.status === "running" && stale ? "starting" : m.status;
  return {
    id: m.id,
    symbol: m.symbol,
    name: m.name,
    description: m.description,
    image_url: m.image_url || null,
    chain: "ethereum",
    chain_id: 1,
    contract: m.token_address,
    mint: m.token_address,
    market_cap_usd: m.market_cap_usd,
    launched_at: m.bound_at,
    computer: {
      gpu: m.gpu_name || null,
      gpu_count: m.gpu_count,
      vram_gb: m.vram_gb || null,
      ai_model: m.ai_model,
      template: m.template_id,
      status,
      app_live: !!m.app_updated_at,
      last_frame_at: m.last_frame_at,
    },
    url: `${env.siteUrl}/project/${m.id}`,
    app_url: m.app_updated_at ? `${env.siteUrl}/app/${m.id}` : null,
    programmable_url: m.token_address ? `https://programmable.market/token/${m.token_address}` : null,
    ...extra,
  };
}

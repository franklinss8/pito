import { env } from "@/lib/env";
import { handleError, ok } from "@/lib/http";
import { listGpuTypes, priceCents } from "@/lib/runpod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live GPU inventory for the launch wizard and Rent. */
export async function GET() {
  try {
    if (!env.hasRunpod) return ok({ gpus: [], provider: null });
    const list = await listGpuTypes();
    return ok({
      provider: "runpod",
      gpus: list.filter((g) => g.available).map((g) => ({ id: g.id, name: g.displayName, vram_gb: g.memoryInGb, cents_per_hour: priceCents(g.pricePerHourUsd!), community: g.communityCloud, secure: g.secureCloud })),
      recommended: list.filter((g) => g.available && g.memoryInGb >= 24).sort((a, b) => a.pricePerHourUsd! - b.pricePerHourUsd!)[0]?.id ?? null,
    }, 200, "public, max-age=60");
  } catch (e) { return handleError(e); }
}

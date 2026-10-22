import { getAddress } from "viem";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifyAction } from "@/lib/auth";
import { ADDRESS_RE, findProgrammableLaunch, readFoundationMetadata, readToken } from "@/lib/eth";
import { fail, handleError, ok, readJson, str } from "@/lib/http";
import { addStep, listMachines, remainingCents, startComputer } from "@/lib/machines";
import { listGpuTypes, priceCents } from "@/lib/runpod";
import { AI_MODELS, getTemplate, isApiMachine } from "@/lib/templates";
import type { Machine } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try { return ok({ machines: await listMachines({ limit: 60 }) }); } catch (e) { return handleError(e); }
}

/**
 * Create a machine.
 * - With `tokenAddress` (the normal path): the coin already exists on Programmable. Pito reads its metadata,
 *   verifies the launch stamp and the signer, creates the machine bound to the token, and starts the computer.
 * - Without (pre-launch path): a draft with its public page, bound later through /bind.
 */
export async function POST(req: Request) {
  try {
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const mission = str(b.mission, 2000), template_id = getTemplate(str(b.templateId, 40)).id, gpu_type_id = str(b.gpuTypeId, 80);
    if (isApiMachine(template_id)) return fail(400, "bad_template", "Anything API machines are created from /originals/anything-api.");
    const ai_model = AI_MODELS.some((m) => m.id === b.aiModel) ? String(b.aiModel) : AI_MODELS[0].id;
    const cloud_type = b.cloudType === "SECURE" ? "SECURE" : "COMMUNITY";
    if (mission.length < 20) return fail(400, "bad_mission", "Describe what the computer should build, in at least a sentence.");

    let gpu_name = "", vram_gb = 0, price = 0;
    if (gpu_type_id) {
      if (!env.hasRunpod) return fail(503, "no_gpu_provider", "GPU inventory is not available on this Pito yet.");
      const g = (await listGpuTypes()).find((x) => x.id === gpu_type_id);
      if (!g || !g.pricePerHourUsd) return fail(400, "bad_gpu", "That GPU is not available right now. Pick another.");
      const usd = cloud_type === "SECURE" ? g.securePriceUsd : g.pricePerHourUsd;
      if (!usd) return fail(400, "bad_gpu", "That GPU is not offered on the secure cloud. Pick another or use community.");
      gpu_name = g.displayName; vram_gb = g.memoryInGb; price = priceCents(usd);
    }

    const tokenRaw = str(b.tokenAddress, 42);
    if (tokenRaw) {
      if (!ADDRESS_RE.test(tokenRaw)) return fail(400, "bad_token", "Token address must be 0x followed by 40 hex characters.");
      const token = getAddress(tokenRaw);
      const signer = await verifyAction({ message: b.message, signature: b.signature, action: "create", target: token });
      const { data: dup } = await db().from("machines").select("id").eq("token_address", token.toLowerCase()).maybeSingle();
      if (dup) return fail(409, "token_taken", "This token already has a machine.");
      let meta; try { meta = await readToken(token); } catch { return fail(422, "not_a_token", "No ERC-20 token at this address on Ethereum mainnet."); }
      const launch = await findProgrammableLaunch(token);
      if (env.requireProgrammable) {
        if (!launch) return fail(422, "not_programmable", "No Programmable launch stamp found for this token yet. If you just launched, wait for finality (about 15 minutes) and try again.");
        if (launch.launchWallet.toLowerCase() !== signer) return fail(403, "not_launch_wallet", `Only the wallet that launched this coin can give it a machine (${launch.launchWallet}).`);
      }
      const onchain = await readFoundationMetadata(token);
      const image_url = str(b.imageUrl, 500) || onchain.image, website = str(b.website, 200) || onchain.website, x_handle = str(b.x, 60).replace(/^@/, "");
      const { data, error } = await db().from("machines").insert({
        name: meta.name, symbol: meta.symbol, description: str(b.description, 500) || onchain.description, image_url, website, x_handle,
        token_address: token.toLowerCase(), creator: signer, router: launch?.router.toLowerCase() ?? null, launch_id: launch?.launchId ?? null, bound_at: new Date().toISOString(),
        mission, template_id, gpu_type_id, gpu_name, vram_gb, ai_model, cloud_type, price_cents_per_hour: price, status: "bound",
      }).select("*").single();
      if (error) throw error;
      const m = data as Machine;
      await addStep(m.id, { kind: "system", note: `Machine created for ${meta.name} ($${meta.symbol}). Launch stamp ${launch ? "verified" : "not required"}.` });
      let started: { ok: boolean; error?: string } = { ok: false, error: "No compute budget yet." };
      if (gpu_type_id && remainingCents(m) > 0) started = await startComputer(m);
      return ok({ id: m.id, url: `${env.siteUrl}/project/${m.id}`, started: started.ok, note: started.ok ? "The computer is starting." : started.error }, 201);
    }

    // ---- pre-launch path ----
    const name = str(b.name, 48), symbol = str(b.symbol, 12).replace(/^\$/, "").toUpperCase(), description = str(b.description, 500);
    const image_url = str(b.imageUrl, 500), website = str(b.website, 200), x_handle = str(b.x, 60).replace(/^@/, "");
    if (!name) return fail(400, "bad_name", "Give the coin a name.");
    if (!/^[A-Z0-9]{1,10}$/.test(symbol)) return fail(400, "bad_symbol", "Ticker: letters and digits only, up to 10.");
    if (image_url && !/^https:\/\/\S+$/i.test(image_url)) return fail(400, "bad_image", "Image URL must start with https://.");
    const creator = await verifyAction({ message: b.message, signature: b.signature, action: "create", target: symbol });
    const { count: drafts } = await db().from("machines").select("id", { count: "exact", head: true }).eq("creator", creator).is("token_address", null).neq("template_id", "anything-api");
    if ((drafts ?? 0) >= 3) return fail(429, "too_many_drafts", "You already have 3 unlaunched pages. Launch one on Programmable and bind it first.");
    const { data, error } = await db().from("machines").insert({
      name, symbol, description, image_url, website, x_handle, creator, mission, template_id, gpu_type_id, gpu_name, vram_gb, ai_model, cloud_type, price_cents_per_hour: price, status: "prelaunch",
    }).select("id").single();
    if (error) throw error;
    await addStep(data.id, { kind: "system", note: "Pre-launch page created. Waiting for the coin launch on Programmable." });
    return ok({ id: data.id, url: `${env.siteUrl}/project/${data.id}` }, 201);
  } catch (e) { return handleError(e); }
}

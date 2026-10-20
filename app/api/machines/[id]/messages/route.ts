import { getAddress } from "viem";
import { db } from "@/lib/db";
import { verifyAction } from "@/lib/auth";
import { isHolder } from "@/lib/eth";
import { fail, handleError, ok, options, readJson, str } from "@/lib/http";
import { getMachine } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";




export function OPTIONS() { return options(); }

/** Holders talk to the AI. The wallet signs; Pito checks it holds the token (the creator always can). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await getMachine(params.id);
    if (!m) return fail(404, "not_found", "No machine with this id.");
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const body = str(b.body, 1000);
    const kind = ["message", "idea", "feature", "bug"].includes(String(b.kind)) ? String(b.kind) : "message";
    if (body.length < 2) return fail(400, "bad_body", "Write a message.");
    const wallet = await verifyAction({ message: b.message, signature: b.signature, action: "message", target: m.id });
    if (wallet !== m.creator) {
      if (!m.token_address) return fail(403, "not_live", "Only the creator can message before the token is live.");
      if (!(await isHolder(getAddress(m.token_address), getAddress(wallet)))) return fail(403, "not_holder", "Only holders of this token can message its AI.");
    }
    const { count } = await db().from("messages").select("id", { count: "exact", head: true }).eq("machine_id", m.id).eq("wallet", wallet).gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
    if ((count ?? 0) >= 20) return fail(429, "slow_down", "20 messages per hour per wallet. Take a breath.");
    const { data, error } = await db().from("messages").insert({ machine_id: m.id, wallet, body, kind }).select("*").single();
    if (error) throw error;
    return ok({ message: data }, 201);
  } catch (e) { return handleError(e); }
}

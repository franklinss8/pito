import { getAddress } from "viem";
import { db, UUID_RE } from "@/lib/db";
import { verifyAction } from "@/lib/auth";
import { isHolder } from "@/lib/eth";
import { fail, handleError, ok, readJson, str } from "@/lib/http";
import { getMachine } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEATURE_VOTES = 3, MAJOR_VOTES = 10;

/** One vote per holder per request. 3 votes approve a feature, 10 a major new mechanism. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await getMachine(params.id);
    if (!m) return fail(404, "not_found", "No machine with this id.");
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const messageId = str(b.messageId, 40);
    if (!UUID_RE.test(messageId)) return fail(400, "bad_message", "Missing message id.");
    const wallet = await verifyAction({ message: b.message, signature: b.signature, action: "vote", target: messageId });
    if (wallet !== m.creator && (!m.token_address || !(await isHolder(getAddress(m.token_address), getAddress(wallet))))) return fail(403, "not_holder", "Only holders can vote.");
    const { data: msg } = await db().from("messages").select("id,kind,status,is_ai,machine_id").eq("id", messageId).maybeSingle();
    if (!msg || msg.machine_id !== m.id || msg.is_ai) return fail(404, "not_found", "No such request on this machine.");
    const { data: votes, error } = await db().rpc("cast_vote", { p_message: messageId, p_wallet: wallet });
    if (error) throw error;
    const needed = msg.kind === "idea" ? MAJOR_VOTES : FEATURE_VOTES;
    let status = msg.status;
    if (status === "open" && (msg.kind === "bug" || Number(votes) >= needed)) {
      status = "approved";
      await db().from("messages").update({ status }).eq("id", messageId);
    }
    return ok({ votes: Number(votes), status, needed });
  } catch (e) { return handleError(e); }
}

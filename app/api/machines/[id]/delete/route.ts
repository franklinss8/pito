import { db } from "@/lib/db";
import { verifyAction } from "@/lib/auth";
import { fail, handleError, ok, readJson } from "@/lib/http";
import { getMachine } from "@/lib/machines";
import { terminatePod } from "@/lib/runpod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The creator deletes a machine: its computer is released, its page, steps, messages and hosted app disappear.
 * Not allowed while the computer is running (stop it first) so nobody deletes a machine holders are using by accident.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await getMachine(params.id);
    if (!m) return fail(404, "not_found", "No machine with this id.");
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const signer = await verifyAction({ message: b.message, signature: b.signature, action: "delete", target: m.id });
    if (signer !== m.creator) return fail(403, "not_creator", "Only the creator wallet can delete this machine.");
    if (m.status === "running" || m.status === "starting") return fail(409, "running", "Stop the computer first, then delete.");
    if (m.pod_id) await terminatePod(m.pod_id).catch(() => {});
    const storage = db().storage.from("apps");
    const { data: files } = await storage.list(m.id, { limit: 1000 });
    if (files?.length) await storage.remove(files.map((f) => `${m.id}/${f.name}`)).catch(() => {});
    const { error } = await db().from("machines").delete().eq("id", m.id);
    if (error) throw error;
    return ok({ deleted: true });
  } catch (e) { return handleError(e); }
}

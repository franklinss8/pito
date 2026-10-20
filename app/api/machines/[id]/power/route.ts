import { db } from "@/lib/db";
import { verifyAction } from "@/lib/auth";
import { fail, handleError, ok, readJson } from "@/lib/http";
import { addStep, getMachine, remainingCents, startComputer } from "@/lib/machines";
import { getPod, resumePod, stopPod } from "@/lib/runpod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Creator controls: start / stop / resume the computer. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await getMachine(params.id);
    if (!m) return fail(404, "not_found", "No machine with this id.");
    let b; try { b = await readJson(req); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const op = b.op === "stop" ? "stop" : "resume";
    const signer = await verifyAction({ message: b.message, signature: b.signature, action: op, target: m.id });
    if (signer !== m.creator) return fail(403, "not_creator", "Only the creator wallet can control this computer.");

    if (op === "stop") {
      if (!m.pod_id) return fail(409, "no_computer", "This machine has no computer yet.");
      await stopPod(m.pod_id);
      await db().from("machines").update({ status: "stopped", pod_status: "EXITED" }).eq("id", m.id);
      await addStep(m.id, { kind: "system", note: "Computer stopped by the creator." });
      return ok({ status: "stopped" });
    }
    if (!m.token_address) return fail(409, "not_bound", "Bind the token first.");
    if (remainingCents(m) <= 0) return fail(402, "no_budget", "No compute budget. Fund the machine first.");
    if (m.pod_id) {
      const pod = await getPod(m.pod_id).catch(() => null);
      if (pod && pod.desiredStatus !== "RUNNING") {
        try {
          await resumePod(m.pod_id);
          await db().from("machines").update({ status: "starting", pod_status: "RESUMED", last_billed_at: new Date().toISOString() }).eq("id", m.id);
          await addStep(m.id, { kind: "system", note: "Computer resumed. Work files kept." });
          return ok({ status: "starting" });
        } catch { /* fall through: rent a fresh one */ }
      } else if (pod) return ok({ status: "running" });
    }
    const r = await startComputer(m);
    if (!r.ok) return fail(502, "start_failed", r.error);
    return ok({ status: "starting", podId: r.podId });
  } catch (e) { return handleError(e); }
}

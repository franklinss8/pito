import { verifyAction } from "@/lib/auth";
import { fail, handleError, ok, readJson } from "@/lib/http";
import { getMachine, planMachine } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Redraft the build plan. Creator only. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const machine = await getMachine(params.id);
    if (!machine) return fail(404, "NOT_FOUND", "No machine with this id.");
    if (machine.status === "running") return fail(409, "RUNNING", "Wait for the current run to finish before redrafting the plan.");
    let body;
    try { body = await readJson(req); } catch { return fail(400, "BAD_REQUEST", "Send a JSON body."); }
    const signer = await verifyAction({ message: body.message, signature: body.signature, action: "replan", target: machine.id });
    if (signer !== machine.creator) return fail(403, "NOT_CREATOR", "Only the wallet that launched this token can redraft its plan.");
    const result = await planMachine(machine);
    return ok(result);
  } catch (e) { return handleError(e); }
}

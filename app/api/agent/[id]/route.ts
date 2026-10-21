import { db } from "@/lib/db";
import { agentMachine } from "@/lib/agent-auth";
import { fail, handleError, ok, readJson, str } from "@/lib/http";
import { addStep, remainingCents } from "@/lib/machines";
import { getTemplate } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The agent's view of its own machine: mission, plan, open holder requests, budget. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await agentMachine(req, params.id);
    if (!m) return fail(401, "unauthenticated", "Bad agent token.");
    const [{ data: pending }, { data: approved }, { data: recent }] = await Promise.all([
      db().from("messages").select("id,wallet,body,kind,status,votes,created_at").eq("machine_id", m.id).eq("is_ai", false).eq("ai_replied", false).order("created_at", { ascending: true }).limit(10),
      db().from("messages").select("id,wallet,body,kind,status,votes,created_at").eq("machine_id", m.id).eq("is_ai", false).eq("status", "approved").order("created_at", { ascending: true }).limit(10),
      db().from("steps").select("kind,command,output,note,created_at").eq("machine_id", m.id).order("created_at", { ascending: false }).limit(12),
    ]);
    return ok({
      machine: { id: m.id, name: m.name, symbol: m.symbol, description: m.description, mission: m.mission, token_address: m.token_address, template: getTemplate(m.template_id), ai_model: m.ai_model, app_url: m.app_url, status: m.status, mode: m.template_id === "anything-api" ? "api" : "token" },
      plan: m.plan,
      pending_messages: pending ?? [],
      approved_requests: approved ?? [],
      recent_steps: (recent ?? []).reverse(),
      budget: { remaining_cents: remainingCents(m), price_cents_per_hour: m.price_cents_per_hour },
    });
  } catch (e) { return handleError(e); }
}

/** Agent reports: steps, plan updates, replies, request status changes. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await agentMachine(req, params.id);
    if (!m) return fail(401, "unauthenticated", "Bad agent token.");
    let b; try { b = await readJson(req, 300_000); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const type = str(b.type, 20);

    if (type === "step") {
      const kind = ["shell", "file", "note", "built", "audit", "plan", "reply", "system"].includes(String(b.kind)) ? String(b.kind) : "note";
      await addStep(m.id, { kind, command: str(b.command, 4000) || undefined, output: str(b.output, 20_000) || undefined, note: str(b.note, 4000) || undefined });
      return ok({ saved: true });
    }
    if (type === "plan") {
      const p = (b.plan ?? {}) as Record<string, unknown>;
      const stages = ["setup", "plan", "build", "test", "ship"];
      const plan = {
        summary: str(p.summary, 600), stage: stages.includes(String(p.stage)) ? String(p.stage) : (m.plan?.stage ?? "plan"),
        progress: Math.max(0, Math.min(100, Math.round(Number(p.progress) || m.plan?.progress || 0))),
        current_task: str(p.current_task, 300),
        milestones: (Array.isArray(p.milestones) ? p.milestones : m.plan?.milestones ?? []).slice(0, 8).map((x) => ({ title: str((x as Record<string, unknown>)?.title, 160), done: !!(x as Record<string, unknown>)?.done })),
      };
      await db().from("machines").update({ plan }).eq("id", m.id);
      return ok({ saved: true });
    }
    if (type === "reply") {
      const replyTo = str(b.reply_to, 40) || null, body = str(b.body, 2000);
      if (!body) return fail(400, "bad_body", "Empty reply.");
      await db().from("messages").insert({ machine_id: m.id, wallet: "ai", body, is_ai: true, reply_to: replyTo, ai_replied: true });
      if (replyTo) await db().from("messages").update({ ai_replied: true }).eq("id", replyTo).eq("machine_id", m.id);
      return ok({ saved: true });
    }
    if (type === "request_status") {
      const id = str(b.message_id, 40), status = ["built", "declined", "approved"].includes(String(b.status)) ? String(b.status) : "";
      if (!id || !status) return fail(400, "bad_request", "message_id and status required.");
      await db().from("messages").update({ status }).eq("id", id).eq("machine_id", m.id);
      return ok({ saved: true });
    }
    if (type === "app") {
      const live = !!b.live;
      await db().from("machines").update({ app_updated_at: live ? new Date().toISOString() : null }).eq("id", m.id);
      return ok({ saved: true });
    }
    return fail(400, "bad_type", "Unknown report type.");
  } catch (e) { return handleError(e); }
}

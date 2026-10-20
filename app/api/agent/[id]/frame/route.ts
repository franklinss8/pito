import { db } from "@/lib/db";
import { agentMachine } from "@/lib/agent-auth";
import { fail, handleError, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Screen share: the agent posts a JPEG of its screen every few seconds. Stored in the public "frames" bucket. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await agentMachine(req, params.id);
    if (!m) return fail(401, "unauthenticated", "Bad agent token.");
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length < 100 || buf.length > 600_000) return fail(400, "bad_frame", "Frame must be a JPEG under 600 KB.");
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return fail(400, "bad_frame", "Frame must be a JPEG.");
    const { error } = await db().storage.from("frames").upload(`${m.id}.jpg`, buf, { contentType: "image/jpeg", upsert: true, cacheControl: "5" });
    if (error) throw error;
    await db().from("machines").update({ last_frame_at: new Date().toISOString() }).eq("id", m.id);
    return ok({ saved: true });
  } catch (e) { return handleError(e); }
}

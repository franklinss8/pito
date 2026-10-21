import { db } from "@/lib/db";
import { agentMachine } from "@/lib/agent-auth";
import { fail, handleError, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE = 4_000_000;
const SAFE_PATH = /^(?!.*(^|\/)\.\.(\/|$))[A-Za-z0-9_\-./@+ ]{1,300}$/;
let bucketReady = false;

/**
 * App snapshot, one file per call: PUT raw bytes with ?path=relative/file.ext (content-type header kept).
 * Pito serves these files at /app/{id}/… whenever the machine's computer is offline.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await agentMachine(req, params.id);
    if (!m) return fail(401, "unauthenticated", "Bad agent token.");
    const path = (new URL(req.url).searchParams.get("path") || "").replace(/^\/+/, "");
    if (!SAFE_PATH.test(path) || path.includes("//")) return fail(400, "bad_path", "Relative path only.");
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length > MAX_FILE) return fail(413, "too_large", "Files over 4 MB are not snapshotted.");
    const storage = db().storage;
    if (!bucketReady) { await storage.createBucket("apps", { public: false, fileSizeLimit: MAX_FILE }).catch(() => {}); bucketReady = true; }
    const contentType = req.headers.get("content-type") || "application/octet-stream";
    const { error } = await storage.from("apps").upload(`${m.id}/${path}`, buf, { contentType, upsert: true, cacheControl: "60" });
    if (error) throw error;
    return ok({ saved: path, bytes: buf.length });
  } catch (e) { return handleError(e); }
}

/** Snapshot manifest: marks the snapshot complete so /app serves it. Body: { files: string[] } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const m = await agentMachine(req, params.id);
    if (!m) return fail(401, "unauthenticated", "Bad agent token.");
    const b = (await req.json().catch(() => ({}))) as { files?: unknown };
    const files = (Array.isArray(b.files) ? b.files : []).filter((f): f is string => typeof f === "string" && SAFE_PATH.test(f)).slice(0, 2000);
    const manifest = { files, at: new Date().toISOString() };
    const { error } = await db().storage.from("apps").upload(`${m.id}/.manifest.json`, Buffer.from(JSON.stringify(manifest)), { contentType: "application/json", upsert: true, cacheControl: "10" });
    if (error) throw error;
    await db().from("machines").update({ app_updated_at: m.app_updated_at ?? new Date().toISOString() }).eq("id", m.id);
    return ok({ saved: true, files: files.length });
  } catch (e) { return handleError(e); }
}

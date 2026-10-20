import { db, UUID_RE } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/public/v1/machine/frame?id={id} — the latest screen frame (JPEG). 404 when nothing was broadcast yet. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!UUID_RE.test(id)) return new Response("Bad id", { status: 400 });
  const { data } = await db().storage.from("frames").download(`${id}.jpg`);
  if (!data) return new Response("No signal", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(data, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3", "Access-Control-Allow-Origin": "*" } });
}

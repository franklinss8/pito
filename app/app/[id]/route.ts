import { getMachine } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** /app/{id} → the app the machine built (served from its own computer). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const m = await getMachine(params.id);
  if (!m || !m.app_url) return new Response("This machine has no app yet.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return Response.redirect(m.app_url, 302);
}

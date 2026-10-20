import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves a machine's generated app. The CSP `sandbox` directive gives the page an
 * opaque origin, so its scripts can never read Pito cookies or call Pito's API as the viewer,
 * and `connect-src 'none'` stops it from sending data anywhere.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Not found", { status: 404 });
  const { data } = await db().from("machines").select("app_html").eq("id", params.id).maybeSingle();
  if (!data?.app_html) return new Response("This machine has not shipped an app yet.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(data.app_html as string, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=30",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "sandbox allow-scripts allow-forms; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-ancestors 'self'",
    },
  });
}

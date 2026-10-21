import { db } from "@/lib/db";
import { getMachine } from "@/lib/machines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  json: "application/json", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", ico: "image/x-icon",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", txt: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8", wasm: "application/wasm", mp3: "audio/mpeg", mp4: "video/mp4", webm: "video/webm",
};

function sleepingPage(name: string, symbol: string) {
  return `<!doctype html><meta charset="utf-8"><title>${symbol} · sleeping</title>
<style>body{margin:0;background:#0B0B0A;color:#EDEBE3;font:15px ui-monospace,monospace;display:grid;place-items:center;height:100vh;text-align:center}b{color:#C6F24A}p{color:#9A9B91;max-width:40ch}</style>
<div><b>$</b> ${name} (${symbol}) has no app online yet.<p>The machine's computer is asleep and no snapshot was published. It wakes up when the creator or holders fund compute.</p></div>`;
}

/**
 * /app/{id}/…  The machine's product.
 * Computer online → redirect to it (dynamic apps work). Offline → serve the last snapshot hosted by Pito.
 */
export async function GET(req: Request, { params }: { params: { id: string; path?: string[] } }) {
  const m = await getMachine(params.id);
  if (!m) return new Response("Not found", { status: 404 });
  const rel = (params.path ?? []).join("/");
  const fresh = !!m.last_seen_at && Date.now() - Date.parse(m.last_seen_at) < 180_000;
  if (m.app_url && (m.status === "running" || m.status === "starting") && fresh) {
    const u = new URL(req.url);
    return Response.redirect(`${m.app_url}/${rel}${u.search}`, 302);
  }
  const key = `${m.id}/${rel || "index.html"}`;
  const storage = db().storage.from("apps");
  let { data } = await storage.download(key);
  if (!data && rel && !rel.includes(".")) ({ data } = await storage.download(`${m.id}/${rel.replace(/\/$/, "")}/index.html`));
  if (!data) {
    if (!rel || rel === "index.html") return new Response(sleepingPage(m.name, `$${m.symbol}`), { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    return new Response("Not found", { status: 404 });
  }
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return new Response(data, { headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=60", "X-Pito-Hosted": "snapshot" } });
}

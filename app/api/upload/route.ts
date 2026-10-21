import { db } from "@/lib/db";
import { fail, handleError, ok, readJson, str } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 1_500_000; // bytes after client-side resize
let bucketReady = false;

/** Coin image upload: the browser resizes to 512px and sends a data URL; stored in the public "images" bucket. */
export async function POST(req: Request) {
  try {
    let b; try { b = await readJson(req, 2_200_000); } catch { return fail(400, "bad_request", "Send a JSON body."); }
    const dataUrl = str(b.dataUrl, 2_100_000);
    const m = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) return fail(400, "bad_image", "Send a PNG, JPEG, WebP or GIF.");
    const buf = Buffer.from(m[3], "base64");
    if (buf.length < 100 || buf.length > MAX) return fail(400, "too_large", "Image must be under 1.5 MB after resize.");
    const ext = m[2] === "jpeg" ? "jpg" : m[2];
    const name = `${crypto.randomUUID()}.${ext}`;
    const storage = db().storage;
    if (!bucketReady) { await storage.createBucket("images", { public: true, fileSizeLimit: MAX }).catch(() => {}); bucketReady = true; }
    const { error } = await storage.from("images").upload(name, buf, { contentType: m[1], upsert: false, cacheControl: "31536000" });
    if (error) throw error;
    const { data } = storage.from("images").getPublicUrl(name);
    return ok({ url: data.publicUrl }, 201);
  } catch (e) { return handleError(e); }
}

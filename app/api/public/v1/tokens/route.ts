import { fail, handleError, ok, options } from "@/lib/http";
import { listMachines } from "@/lib/machines";
import { publicToken } from "@/lib/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() { return options(); }

/** GET /api/public/v1/tokens?sort=new|mcap&limit=25&offset=0 — every live token with its computer. */
export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const sort = u.searchParams.get("sort") === "mcap" ? "mcap" : "new";
    const limit = Math.min(100, Math.max(1, Number(u.searchParams.get("limit")) || 25));
    const offset = Math.max(0, Number(u.searchParams.get("offset")) || 0);
    if (!Number.isInteger(limit) || !Number.isInteger(offset)) return fail(400, "bad_request", "limit and offset must be integers.");
    const rows = await listMachines({ sort, limit, offset, liveOnly: true });
    return ok({ data: rows.map((m) => publicToken(m)), next_offset: rows.length === limit ? offset + limit : null }, 200, "public, max-age=15");
  } catch (e) { return handleError(e); }
}

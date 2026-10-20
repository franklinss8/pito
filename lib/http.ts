import "server-only";
import { NextResponse } from "next/server";
import { AuthError } from "./auth";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store", ...CORS } });
}

export function ok(data: unknown, status = 200, cache = "no-store") {
  return NextResponse.json(data, { status, headers: { "Cache-Control": cache, ...CORS } });
}

export function options() { return new NextResponse(null, { status: 204, headers: CORS }); }

export function handleError(e: unknown) {
  if (e instanceof AuthError) return fail(401, e.code, e.message);
  console.error("pito api error", e instanceof Error ? e.message : e);
  return fail(500, "server_error", "Something went wrong on the server. Try again in a moment.");
}

export async function readJson(req: Request, max = 200_000): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > max) throw new Error("Body too large");
  const v = JSON.parse(text || "{}");
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Body must be a JSON object");
  return v as Record<string, unknown>;
}

export const str = (v: unknown, max = 1000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

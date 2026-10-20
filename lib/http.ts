import "server-only";
import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function handleError(e: unknown) {
  if (e instanceof AuthError) return fail(401, e.code, e.message);
  console.error("pito api error", e instanceof Error ? e.message : e);
  return fail(500, "SERVER_ERROR", "Something went wrong on the server. Try again in a moment.");
}

export async function readJson(req: Request, max = 20_000): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > max) throw new Error("Body too large");
  const v = JSON.parse(text || "{}");
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Body must be a JSON object");
  return v as Record<string, unknown>;
}

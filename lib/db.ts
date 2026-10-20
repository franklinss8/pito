import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export type Plan = {
  summary: string;
  steps: { title: string; detail: string }[];
  gpu: string;
  deliverable: string;
};

export type Machine = {
  id: string;
  token_address: string;
  name: string;
  symbol: string;
  mission: string;
  creator: string;
  router: string | null;
  launch_id: string | null;
  plan: Plan | null;
  status: "planning" | "ready" | "plan_failed" | "running" | "live";
  credits: number;
  app_html: string | null;
  app_updated_at: string | null;
  created_at: string;
};

export type Job = {
  id: string;
  machine_id: string;
  runpod_id: string;
  status: string;
  error: string | null;
  model: string | null;
  created_at: string;
  finished_at: string | null;
  last_polled_at: string | null;
};

/** Columns safe to send to the browser (app_html is served separately, sandboxed). */
export const PUBLIC_MACHINE_COLUMNS =
  "id,token_address,name,symbol,mission,creator,router,launch_id,plan,status,credits,app_updated_at,created_at";

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  client ??= createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export type Milestone = { title: string; done: boolean };
export type Plan = {
  summary: string;
  stage: "setup" | "plan" | "build" | "test" | "ship";
  progress: number;
  current_task: string;
  milestones: Milestone[];
  // legacy v1 fields
  steps?: { title: string; detail: string }[];
  gpu?: string;
  deliverable?: string;
};

export type MachineStatus = "prelaunch" | "bound" | "starting" | "running" | "stopped" | "error" | "planning" | "ready" | "plan_failed" | "live";

export type Machine = {
  id: string;
  created_at: string;
  name: string; symbol: string; description: string; image_url: string; website: string; x_handle: string;
  token_address: string | null; creator: string; router: string | null; launch_id: string | null; bound_at: string | null;
  mission: string; template_id: string; gpu_type_id: string; gpu_name: string; vram_gb: number; gpu_count: number; ai_model: string; cloud_type: string;
  status: MachineStatus;
  pod_id: string | null; pod_status: string | null; app_url: string | null; last_frame_at: string | null;
  agent_started_at: string | null; last_seen_at: string | null;
  plan: Plan | null;
  budget_cents: number; spent_cents: number; price_cents_per_hour: number; last_billed_at: string | null;
  market_cap_usd: number | null; market_updated_at: string | null;
  app_updated_at: string | null;
};

export type Step = { id: string; machine_id: string; kind: string; command: string | null; output: string | null; note: string | null; created_at: string };
export type Message = { id: string; machine_id: string; wallet: string; body: string; is_ai: boolean; reply_to: string | null; kind: string; status: string; votes: number; ai_replied: boolean; created_at: string };
export type Rental = { id: string; wallet: string; gpu_type_id: string; gpu_name: string; template_id: string; status: string; pod_id: string | null; connect_url: string | null; budget_cents: number; spent_cents: number; price_cents_per_hour: number; started_at: string | null; last_billed_at: string | null; created_at: string };

/** Columns safe to send to browsers and the public API (never agent_token, never app_html). */
export const PUBLIC_MACHINE_COLUMNS =
  "id,created_at,name,symbol,description,image_url,website,x_handle,token_address,creator,router,launch_id,bound_at,mission,template_id,gpu_type_id,gpu_name,vram_gb,gpu_count,ai_model,cloud_type,status,pod_id,pod_status,app_url,last_frame_at,agent_started_at,last_seen_at,plan,budget_cents,spent_cents,price_cents_per_hour,last_billed_at,market_cap_usd,market_updated_at,app_updated_at";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

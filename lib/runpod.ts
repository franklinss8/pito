import "server-only";
import { env } from "./env";

/** RunPod GPU Pods (GraphQL). One pod = one machine. */
const GQL = "https://api.runpod.io/graphql";

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(`${GQL}?api_key=${encodeURIComponent(env.runpodKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
  if (!r.ok || j.errors?.length) throw new Error(`RunPod: ${j.errors?.[0]?.message || r.status}`);
  return j.data as T;
}

export type GpuType = { id: string; displayName: string; memoryInGb: number; secureCloud: boolean; communityCloud: boolean; pricePerHourUsd: number | null; securePriceUsd: number | null; available: boolean };

let gpuCache: { at: number; list: GpuType[] } | null = null;

/** Live GPU inventory with on-demand prices (cached 2 minutes). */
export async function listGpuTypes(): Promise<GpuType[]> {
  if (gpuCache && Date.now() - gpuCache.at < 120_000) return gpuCache.list;
  type R = { gpuTypes: { id: string; displayName: string; memoryInGb: number; secureCloud: boolean; communityCloud: boolean; lowestPrice: { uninterruptablePrice: number | null; stockStatus: string | null } | null; securePrice: { uninterruptablePrice: number | null } | null }[] };
  const d = await gql<R>(`query { gpuTypes { id displayName memoryInGb secureCloud communityCloud lowestPrice(input: { gpuCount: 1 }) { uninterruptablePrice stockStatus } securePrice: lowestPrice(input: { gpuCount: 1, secureCloud: true }) { uninterruptablePrice } } }`);
  const list = d.gpuTypes
    .filter((g) => g.memoryInGb >= 8)
    .map((g) => ({
      id: g.id, displayName: g.displayName, memoryInGb: g.memoryInGb, secureCloud: g.secureCloud, communityCloud: g.communityCloud,
      pricePerHourUsd: g.lowestPrice?.uninterruptablePrice ?? null,
      securePriceUsd: g.securePrice?.uninterruptablePrice ?? null,
      available: !!g.lowestPrice?.uninterruptablePrice && g.lowestPrice?.stockStatus !== "None",
    }))
    .sort((a, b) => (a.pricePerHourUsd ?? 1e9) - (b.pricePerHourUsd ?? 1e9));
  gpuCache = { at: Date.now(), list };
  return list;
}

/** Price shown to users: RunPod price + Pito margin, in cents per hour. */
export function priceCents(usdPerHour: number): number {
  return Math.ceil(usdPerHour * 100 * (1 + env.marginPct / 100));
}

export type PodSpec = {
  name: string;
  gpuTypeId: string;
  cloudType: "COMMUNITY" | "SECURE";
  image: string;
  /** Shell command the container runs at boot. */
  startCommand: string;
  env: Record<string, string>;
  ports?: string;
  volumeGb?: number;
  diskGb?: number;
};

export async function createPod(spec: PodSpec): Promise<{ id: string }> {
  type R = { podFindAndDeployOnDemand: { id: string } | null };
  const d = await gql<R>(
    `mutation ($input: PodFindAndDeployOnDemandInput!) { podFindAndDeployOnDemand(input: $input) { id } }`,
    {
      input: {
        name: spec.name.slice(0, 60),
        gpuTypeId: spec.gpuTypeId,
        cloudType: spec.cloudType,
        gpuCount: 1,
        volumeInGb: spec.volumeGb ?? 40,
        containerDiskInGb: spec.diskGb ?? 40,
        minVcpuCount: 2,
        minMemoryInGb: 8,
        imageName: spec.image,
        dockerArgs: `bash -c ${JSON.stringify(spec.startCommand)}`,
        ports: spec.ports ?? "8080/http,8888/http,22/tcp",
        volumeMountPath: "/workspace",
        env: Object.entries(spec.env).map(([key, value]) => ({ key, value })),
      },
    },
  );
  if (!d.podFindAndDeployOnDemand?.id) throw new Error("RunPod: no GPU of this type is available right now. Pick another one.");
  return { id: d.podFindAndDeployOnDemand.id };
}

export type PodInfo = { id: string; desiredStatus: string; uptimeSeconds: number; gpuDisplayName: string | null; costPerHr: number | null; ports: { privatePort: number; publicPort: number | null; ip: string | null; type: string }[] };

export async function getPod(podId: string): Promise<PodInfo | null> {
  type R = { pod: { id: string; desiredStatus: string; costPerHr: number | null; machine: { gpuDisplayName: string } | null; runtime: { uptimeInSeconds: number; ports: { privatePort: number; publicPort: number; ip: string; type: string }[] | null } | null } | null };
  const d = await gql<R>(`query ($id: String!) { pod(input: { podId: $id }) { id desiredStatus costPerHr machine { gpuDisplayName } runtime { uptimeInSeconds ports { privatePort publicPort ip type } } } }`, { id: podId });
  if (!d.pod) return null;
  return {
    id: d.pod.id, desiredStatus: d.pod.desiredStatus, uptimeSeconds: d.pod.runtime?.uptimeInSeconds ?? 0,
    gpuDisplayName: d.pod.machine?.gpuDisplayName ?? null, costPerHr: d.pod.costPerHr ?? null,
    ports: d.pod.runtime?.ports ?? [],
  };
}

export async function stopPod(podId: string) { await gql(`mutation ($id: String!) { podStop(input: { podId: $id }) { id } }`, { id: podId }); }
export async function resumePod(podId: string) { await gql(`mutation ($id: String!) { podResume(input: { podId: $id, gpuCount: 1 }) { id } }`, { id: podId }); }
export async function terminatePod(podId: string) { await gql(`mutation ($id: String!) { podTerminate(input: { podId: $id }) }`, { id: podId }); }

/** Public HTTPS URL of a port exposed by a pod. */
export function proxyUrl(podId: string, port: number) { return `https://${podId}-${port}.proxy.runpod.net`; }


import type { Metadata } from "next";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "API · Pito", description: "Build on Pito: read tokens, computers, live screens and AI activity, and message the AI behind any token." };

const BASE = "/api/public/v1";

function Code({ children }: { children: string }) {
  return <pre className="code">{children}</pre>;
}

export default function Developers() {
  return (
    <main className="wrap" style={{ paddingBlock: 40, maxWidth: 900 }}>
      <span className="status on"><span className="dot on" />live · read-only</span>
      <h1 style={{ fontSize: "clamp(38px,6vw,64px)", margin: "10px 0 14px" }}>API</h1>
      <p className="sub" style={{ fontSize: 15 }}>Read every token, its computer, its live screen and AI activity, and let holders talk to the AI, from your own apps, bots and dashboards. All GET endpoints are live and need no key. Only launched tokens are returned.</p>

      <div className="sheet" style={{ marginBottom: 28 }}>
        <div className="sheet-row"><span className="k">Base URL</span><span className="v mono">{env.siteUrl}{BASE}</span><span /></div>
        <div className="sheet-row"><span className="k">Auth</span><span className="v">None for reading. Writes are signed by the wallet (see Holders).</span><span /></div>
        <div className="sheet-row"><span className="k">Format</span><span className="v">JSON, CORS open</span><span /></div>
      </div>

      <h2 className="h2">Quick start</h2>
      <Code>{`curl "${env.siteUrl}${BASE}/tokens?sort=mcap"

const r = await fetch("${env.siteUrl}${BASE}/tokens/<token-id>");
const { data } = await r.json();`}</Code>

      <h2 className="h2">Tokens</h2>
      <h3 className="h3">GET {BASE}/tokens</h3>
      <p className="fine">Every launched token with its computer. <b>sort</b>: new | mcap · <b>limit</b>: 1–100 (25) · <b>offset</b>: from next_offset.</p>
      <Code>{`{
  "data": [{
    "id": "4f1c…", "symbol": "FORGE", "name": "Forge", "image_url": "https://…",
    "chain": "ethereum", "chain_id": 1, "contract": "0x…", "market_cap_usd": 48210,
    "computer": { "gpu": "NVIDIA RTX 4090", "gpu_count": 1, "vram_gb": 24, "ai_model": "claude-sonnet-5-5", "status": "running", "app_live": true, "last_frame_at": "…" },
    "url": "${env.siteUrl}/project/4f1c…", "app_url": "…/app/4f1c…", "programmable_url": "https://programmable.market/token/0x…",
    "launched_at": "2026-10-20T12:00:00Z"
  }],
  "next_offset": 25
}`}</Code>
      <h3 className="h3">GET {BASE}/tokens/{"{id}"}</h3>
      <p className="fine">One token, plus <b>plan</b> (summary, stage, progress, current_task, milestones), <b>ai_steps</b>, <b>holder_messages</b>, website and X.</p>

      <h2 className="h2">Computers</h2>
      <h3 className="h3">GET {BASE}/computers/{"{id}"}</h3>
      <p className="fine">GPU, VRAM, template, AI model, host, status, online flag, cost per hour, plan.</p>
      <h3 className="h3">GET {BASE}/machine/frame?id={"{id}"}</h3>
      <p className="fine">The latest frame of the computer&apos;s screen as a JPEG. 404 while nothing is broadcast.</p>
      <h3 className="h3">GET {BASE}/computers/{"{id}"}/steps?limit=50</h3>
      <p className="fine">What the AI did, newest first: <b>kind</b> (shell | file | note | built | audit | plan | reply | system), command, output, note.</p>

      <h2 className="h2">Holders</h2>
      <h3 className="h3">GET {BASE}/tokens/{"{id}"}/messages</h3>
      <p className="fine">The public conversation between holders and the AI, with votes and request status.</p>
      <h3 className="h3">POST {BASE}/tokens/{"{id}"}/messages</h3>
      <p className="fine">Message the AI as a holder. The wallet signs a Pito action message (personal_sign); Pito checks the signature and the token balance onchain.</p>
      <Code>{`// message text (exact lines, one nonce per request)
Pito wants you to sign this action.
Action: message
Target: <token-id>
Wallet: 0x…
Chain ID: 1
Nonce: <16-64 alphanumerics>
Issued At: <ISO date>
This signature costs no gas and moves no funds.

// body
{ "body": "Add a dark mode", "kind": "feature", "message": "<text above>", "signature": "0x…" }
// kinds: message | idea (10 votes) | feature (3 votes) | bug (built right away)`}</Code>

      <h2 className="h2">Errors</h2>
      <Code>{`{ "error": { "code": "not_found", "message": "No live token with this id." } }   // 400, 401, 403, 404, 429, 503`}</Code>
    </main>
  );
}

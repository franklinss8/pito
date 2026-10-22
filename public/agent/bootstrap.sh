#!/usr/bin/env bash
# Pito agent bootstrap. Runs at boot on every machine (RunPod pod). Needs PITO_API, PITO_MACHINE_ID, PITO_AGENT_TOKEN.
set -u
export DEBIAN_FRONTEND=noninteractive
mkdir -p /workspace/app /workspace/pito
cd /workspace/pito

log() { echo "[pito] $*"; }
report() { curl -fsS -m 20 -X POST "$PITO_API/api/agent/$PITO_MACHINE_ID" -H "Authorization: Bearer $PITO_AGENT_TOKEN" -H "Content-Type: application/json" -d "$1" >/dev/null 2>&1 || true; }

report '{"type":"step","kind":"system","note":"Computer is up. Installing desktop, screen share and the AI."}'

# Base tools
(apt-get update -q && apt-get install -yq --no-install-recommends curl git python3 python3-pip nodejs npm xvfb x11-utils x11-apps ca-certificates fonts-dejavu) >/workspace/pito/apt.log 2>&1 || log "apt partially failed (continuing)"
python3 -m pip install -q --upgrade pip requests playwright >/workspace/pito/pip.log 2>&1 || true
python3 -m playwright install --with-deps chromium >/workspace/pito/pw.log 2>&1 || log "playwright install failed (screen share may be off)"

# Local model, when selected
case "${PITO_AI_MODEL:-}" in
  local:*)
    MODEL="${PITO_AI_MODEL#local:}"
    command -v ollama >/dev/null 2>&1 || (curl -fsSL https://ollama.com/install.sh | sh >/workspace/pito/ollama.log 2>&1)
    (OLLAMA_HOST=127.0.0.1:11434 nohup ollama serve >/workspace/pito/ollama-serve.log 2>&1 &)
    sleep 5; ollama pull "$MODEL" >/workspace/pito/ollama-pull.log 2>&1 || log "model pull failed"
    ;;
esac

# The app the AI builds is served from /workspace/app on port 8080 (static by default; the AI may replace it with its own server).
[ -f /workspace/app/index.html ] || cat > /workspace/app/index.html <<'EOF'
<!doctype html><meta charset="utf-8"><title>Pito machine</title>
<style>body{margin:0;background:#0B0B0A;color:#EDEBE3;font:15px ui-monospace,monospace;display:grid;place-items:center;height:100vh}b{color:#C6F24A}</style>
<div><b>$</b> machine online — the AI is setting up. This page becomes the app.</div>
EOF
(cd /workspace/app && nohup python3 -m http.server 8080 >/workspace/pito/http.log 2>&1 &)

# Fetch and run the agent (restarts on crash, keeps work files; backs off when it keeps dying)
backoff=10
while true; do
  curl -fsSL "$PITO_API/agent/agent.py" -o /workspace/pito/agent.py || { log "cannot download agent"; sleep 30; continue; }
  started=$(date +%s)
  python3 /workspace/pito/agent.py >>/workspace/pito/agent.log 2>&1
  if [ $(( $(date +%s) - started )) -gt 300 ]; then backoff=10; else backoff=$(( backoff * 2 > 600 ? 600 : backoff * 2 )); fi
  report "{\"type\":\"step\",\"kind\":\"system\",\"note\":\"AI worker restarted. Work files kept. Next try in ${backoff}s.\"}"
  sleep $backoff
done

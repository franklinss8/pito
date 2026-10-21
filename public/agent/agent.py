"""
Pito agent: the AI that runs a token's computer.

Loop: read the machine (mission, plan, holder requests) -> think with the model -> act (shell, files,
plan updates, replies to holders) -> report every step -> broadcast a screenshot of the app.
Everything it does is public on the token's Pito page and through the read-only API.
"""
import json, os, re, subprocess, sys, time, traceback
from pathlib import Path

import requests

API = os.environ["PITO_API"].rstrip("/")
MID = os.environ["PITO_MACHINE_ID"]
TOKEN = os.environ["PITO_AGENT_TOKEN"]
MODEL = os.environ.get("PITO_AI_MODEL", "claude-sonnet-5-5")
APP = Path("/workspace/app")
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
LOOP_SLEEP = 20
FRAME_EVERY = 12

def api_get():
    r = requests.get(f"{API}/api/agent/{MID}", headers=H, timeout=30); r.raise_for_status(); return r.json()

def report(**body):
    try: requests.post(f"{API}/api/agent/{MID}", headers=H, json=body, timeout=30)
    except Exception as e: print("report failed", e)

def step(kind, **kw): report(type="step", kind=kind, **kw)

# ---------- thinking ----------
def think(system, messages):
    if MODEL.startswith("local:"):
        r = requests.post("http://127.0.0.1:11434/v1/chat/completions", json={"model": MODEL[6:], "messages": [{"role": "system", "content": system}] + messages, "max_tokens": 3000, "temperature": 0.3}, timeout=600)
        r.raise_for_status(); return r.json()["choices"][0]["message"]["content"]
    r = requests.post(f"{API}/api/agent/{MID}/llm", headers=H, json={"system": system, "messages": messages, "max_tokens": 4000}, timeout=150)
    if r.status_code == 402: raise SystemExit("budget exhausted")
    r.raise_for_status(); return r.json()["text"]

SYSTEM = """You are the AI running a Pito machine: a GPU computer that belongs to one crypto token on Ethereum.
Holders watch your screen, read every step, and talk to you. Build what the mission asks, in public, step by step.

Your workspace is /workspace. The app you build lives in /workspace/app and is served on port 8080
(a static server runs there by default; you may replace it with your own server on port 8080, e.g. node or python).
Prefer simple, reliable stacks: static HTML/JS, Python http.server, Node/Express. Keep the app working at all times.

Rules: never ask for or handle private keys; never promise prices, returns or airdrops; no market manipulation;
no illegal content. Holder requests: bugs are fixed right away; features need 3 votes (status 'approved');
major new mechanisms need 10. Only work on requests with status 'approved' (or bugs). Reply briefly and honestly.

Reply with ONE JSON object, no prose, of the form below. For write_file, do NOT put the file content inside the JSON:
put the JSON first, then the whole file content in a fenced block that starts with a line ```file and ends with a line ```.

Example:
{"thought": "create the page", "action": {"type": "write_file", "path": "/workspace/app/index.html"}}
```file
<!doctype html>
<html>...</html>
```

The JSON object:
{"thought": "short reasoning",
 "action": {"type": "shell", "command": "..."}                               // run a shell command (timeout 180 s)
        | {"type": "write_file", "path": "/workspace/app/index.html"}   // then the content in a ```file block
        | {"type": "plan", "summary": "...", "stage": "setup|plan|build|test|ship", "progress": 0-100, "current_task": "...", "milestones": [{"title": "...", "done": false}]}
        | {"type": "reply", "message_id": "...", "body": "..."}              // answer a holder
        | {"type": "request_status", "message_id": "...", "status": "built|declined"}
        | {"type": "note", "body": "..."}                                    // tell holders what you are doing
        | {"type": "app_live", "live": true}                                 // declare the app usable (or false)
        | {"type": "idle", "seconds": 60}                                    // nothing useful to do right now
}"""

API_MODE = """MODE: Anything API. This machine is not a token machine: it belongs to one person who described an HTTP API.
Build exactly that API and host it on port 8080 (replace the static server with your own: FastAPI/uvicorn or Node/Express).
Requirements: JSON responses; CORS open; a GET / that returns a short JSON description with the routes;
interactive docs at /docs (FastAPI gives it for free) or a /openapi.json; handle errors with proper status codes;
test every route with curl before declaring app_live. Keep the server running (nohup) and restart it if it dies.
There are no holders here: 'approved_requests' and 'pending_messages' come from the owner; treat them as instructions."""

def context(state):
    m = state["machine"]; plan = state.get("plan")
    parts = [f"Token: {m['name']} (${m['symbol']}) — {m.get('description') or ''}",
             f"Mission: {m['mission']}",
             f"Template installed: {m['template']['name']} — {m['template']['desc']}",
             f"Public app URL: {m.get('app_url')}",
             f"Budget remaining: ${state['budget']['remaining_cents']/100:.2f} at ${state['budget']['price_cents_per_hour']/100:.2f}/h",
             f"Current plan: {json.dumps(plan) if plan else 'none yet — make one first'}"]
    if state["pending_messages"]: parts.append("Unanswered holder messages: " + json.dumps(state["pending_messages"]))
    if state["approved_requests"]: parts.append("Approved requests to build: " + json.dumps(state["approved_requests"]))
    if state["recent_steps"]: parts.append("Your recent steps: " + json.dumps(state["recent_steps"])[-6000:])
    try: parts.append("App files: " + ", ".join(sorted(str(p.relative_to(APP)) for p in APP.rglob("*") if p.is_file())[:60]))
    except Exception: pass
    return "\n\n".join(parts)

def parse(text):
    """JSON first (control characters inside strings tolerated), optional ```file block after it."""
    fence = re.search(r"```file[^\n]*\n(.*?)\n```", text, re.S)
    head = text[:fence.start()] if fence else text
    head = re.sub(r"```(?:json)?", "", head)
    start = head.find("{")
    if start == -1: raise ValueError("no json")
    dec = json.JSONDecoder(strict=False)
    obj = None
    for end in range(len(head), start, -1):
        try: obj = dec.decode(head[start:end]); break
        except ValueError: continue
    if obj is None: raise ValueError("bad json")
    a = obj.get("action") or {}
    if a.get("type") == "write_file" and "content" not in a:
        if not fence: raise ValueError("write_file without content")
        a["content"] = fence.group(1)
    return obj

# ---------- acting ----------
def run(cmd):
    try:
        p = subprocess.run(cmd, shell=True, cwd="/workspace", capture_output=True, text=True, timeout=180)
        out = (p.stdout + p.stderr)[-6000:]
        return f"{out}\n[exit {p.returncode}]"
    except subprocess.TimeoutExpired:
        return "[timed out after 180 s]"

def act(a):
    t = a.get("type")
    if t == "shell":
        out = run(a["command"]); step("shell", command=a["command"], output=out); return out
    if t == "write_file":
        p = Path(a["path"]);
        if not str(p).startswith("/workspace"): return "refused: write only under /workspace"
        p.parent.mkdir(parents=True, exist_ok=True); p.write_text(a.get("content", "")); step("file", command=f"write {p}", output=f"{len(a.get('content',''))} bytes"); return "ok"
    if t == "plan":
        report(type="plan", plan=a); step("plan", note=a.get("current_task") or a.get("summary", "")); return "ok"
    if t == "reply":
        report(type="reply", reply_to=a.get("message_id"), body=a.get("body", "")); step("reply", note=a.get("body", "")[:300]); return "ok"
    if t == "request_status":
        report(type="request_status", message_id=a.get("message_id"), status=a.get("status")); return "ok"
    if t == "note":
        step("note", note=a.get("body", "")); return "ok"
    if t == "app_live":
        report(type="app", live=bool(a.get("live"))); step("built", note="App is live." if a.get("live") else "App taken offline."); return "ok"
    if t == "idle":
        time.sleep(min(600, int(a.get("seconds", 60)))); return "ok"
    return "unknown action"

# ---------- screen share ----------
_pw = None
def frame():
    global _pw
    try:
        from playwright.sync_api import sync_playwright
        if _pw is None:
            _pw = sync_playwright().start()
            _pw.browser = _pw.chromium.launch(args=["--no-sandbox"]); _pw.page = _pw.browser.new_page(viewport={"width": 1280, "height": 720})
        _pw.page.goto("http://127.0.0.1:8080/", timeout=15000, wait_until="load")
        jpg = _pw.page.screenshot(type="jpeg", quality=55)
        requests.post(f"{API}/api/agent/{MID}/frame", headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "image/jpeg"}, data=jpg, timeout=30)
    except Exception as e:
        print("frame failed", e); _pw = None

def health():
    try: return requests.get("http://127.0.0.1:8080/", timeout=5).status_code < 500
    except Exception: return False

# ---------- self-update: exit when Pito publishes a newer agent (bootstrap re-downloads it) ----------
_last_update_check = 0
def maybe_update():
    global _last_update_check
    if time.time() - _last_update_check < 300: return
    _last_update_check = time.time()
    try:
        latest = requests.get(f"{API}/agent/agent.py", timeout=30).text
        if latest.strip() and latest != Path(__file__).read_text():
            step("system", note="Agent update available. Restarting with the new version; work files kept.")
            raise SystemExit(0)
    except SystemExit: raise
    except Exception: pass

# ---------- main loop ----------
def main():
    step("system", note=f"AI online ({MODEL}). Reading the mission.")
    last_frame = 0; history = []
    while True:
        try:
            if not health():
                subprocess.Popen("cd /workspace/app && nohup python3 -m http.server 8080 >/workspace/pito/http.log 2>&1 &", shell=True)
                step("system", note="App was not responding; static server restarted.")
            state = api_get()
            if state["machine"]["status"] in ("stopped", "error"): time.sleep(60); continue
            history = history[-8:]
            msgs = history + [{"role": "user", "content": context(state) + "\n\nDecide the next single action."}]
            system = SYSTEM + ("\n\n" + API_MODE if state["machine"].get("mode") == "api" else "")
            raw = think(system, msgs)
            a = parse(raw)
            result = act(a.get("action", {"type": "idle", "seconds": 60}))
            history += [{"role": "assistant", "content": json.dumps(a)[:3000]}, {"role": "user", "content": f"Result: {str(result)[:3000]}"}]
            if time.time() - last_frame > FRAME_EVERY: frame(); last_frame = time.time()
            time.sleep(3 if a.get("action", {}).get("type") in ("shell", "write_file") else LOOP_SLEEP)
            maybe_update()
        except SystemExit: raise
        except Exception as e:
            print(traceback.format_exc()); step("system", note=f"Worker hiccup ({type(e).__name__}: {str(e)[:100]}); retrying."); time.sleep(15)
        maybe_update()

if __name__ == "__main__":
    main()

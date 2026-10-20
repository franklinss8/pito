"""
Pito GPU worker for RunPod Serverless.

Input  (job["input"]): {"token": {"address", "name", "symbol", "chainId"}, "mission": str, "plan": {...}}
Output: {"html": str, "model": str}  or  {"error": str}

The model runs locally on the GPU with vLLM. It writes ONE self-contained HTML app.
Pito serves that file sandboxed (no network, no access to the viewer's wallet or cookies).
"""
import json
import os
import re

import runpod
from vllm import LLM, SamplingParams

MODEL = os.environ.get("MODEL_NAME", "Qwen/Qwen2.5-Coder-14B-Instruct")
MAX_LEN = int(os.environ.get("MAX_MODEL_LEN", "16384"))
MAX_HTML = 600_000

llm = LLM(
    model=MODEL,
    max_model_len=MAX_LEN,
    gpu_memory_utilization=float(os.environ.get("GPU_MEMORY_UTILIZATION", "0.92")),
    download_dir=os.environ.get("HF_HOME", "/runpod-volume/hf"),
)

SYSTEM = """You are the build engine of a Pito machine: an AI with its own GPU that builds one web app for a crypto token's holders.
Write ONE complete, self-contained HTML document.
Rules:
- Start with <!doctype html>. Inline all CSS and JavaScript. No external scripts, fonts, images or fetch/XHR/WebSocket calls: the page runs offline in a sandbox.
- Draw images with CSS, SVG or <canvas>. Use only data: URIs if you need an image.
- No wallet connections, no transactions, no forms that collect personal data, no price predictions or financial promises.
- Make it genuinely useful or fun, polished, responsive (works at 380px wide), with a clear title and short instructions.
- Show the token symbol in the design.
Reply with the HTML document only, no explanation."""


def extract_html(text: str) -> str:
    m = re.search(r"```(?:html)?\s*(.*?)```", text, re.S | re.I)
    if m:
        text = m.group(1)
    start = text.lower().find("<!doctype html")
    if start == -1:
        start = text.lower().find("<html")
    if start == -1:
        return ""
    end = text.lower().rfind("</html>")
    return text[start : end + 7] if end != -1 else text[start:] + "\n</html>"


def handler(job):
    inp = job.get("input") or {}
    token = inp.get("token") or {}
    mission = str(inp.get("mission") or "")[:400]
    plan = inp.get("plan") or {}
    if not mission:
        return {"error": "Missing mission"}

    user = (
        f"Token: {token.get('name', '')} (${token.get('symbol', '')}) on Ethereum, contract {token.get('address', '')}.\n"
        f"Mission from the creator: {mission}\n"
        f"Build plan:\n{json.dumps(plan, ensure_ascii=False)[:3000]}\n\n"
        "Build the app now."
    )
    params = SamplingParams(temperature=0.4, top_p=0.95, max_tokens=min(12000, MAX_LEN - 2500))
    out = llm.chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}], params, use_tqdm=False)
    html = extract_html(out[0].outputs[0].text)
    if len(html) < 200:
        return {"error": "The model did not produce an HTML app. Try another run."}
    if len(html) > MAX_HTML:
        return {"error": "The generated app was too large."}
    return {"html": html, "model": MODEL}


runpod.serverless.start({"handler": handler})

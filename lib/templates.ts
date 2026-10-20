/**
 * GPU templates: the software a machine boots with. Each one is a base Docker image plus a setup
 * script the Pito agent runs once at first boot. Shared by the browser (catalogue) and the server (pods).
 */
export type Category = "Dev base" | "Training" | "AI models & chat" | "Image AI" | "Voice & audio" | "Desktop" | "Video AI";

export type Template = { id: string; name: string; category: Category; diskGb: number; desc: string; image: string; setup: string };

const PT = "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04";
const CUDA = "nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04";
const TF = "tensorflow/tensorflow:2.17.0-gpu";
const NGC = "nvcr.io/nvidia/pytorch:24.09-py3";

const pipi = (p: string) => `pip install -q ${p}`;
const clone = (repo: string, dir: string, extra = "") => `git clone --depth 1 ${repo} /workspace/${dir} && cd /workspace/${dir} && ${extra || "pip install -q -r requirements.txt"}`;

export const CATEGORIES: { name: Category; blurb: string }[] = [
  { name: "Dev base", blurb: "A clean GPU toolkit for building anything custom from scratch." },
  { name: "Training", blurb: "Train or fine-tune your own AI model on custom data." },
  { name: "AI models & chat", blurb: "Run your own AI model: a chatbot, assistant or API for apps and bots." },
  { name: "Image AI", blurb: "Generate images and art from text: galleries, avatars, NFT-style collections." },
  { name: "Voice & audio", blurb: "Speech-to-text, AI voices or AI music." },
  { name: "Desktop", blurb: "A full Linux desktop with one-click AI app installers." },
  { name: "Video AI", blurb: "Create AI videos and clips from text or images." },
];

export const TEMPLATES: Template[] = [
  { id: "rapids", name: "NVIDIA RAPIDS", category: "Dev base", diskGb: 40, desc: "GPU data science toolkit (cuDF, cuML).", image: "rapidsai/base:24.10-cuda12.5-py3.11", setup: "" },
  { id: "pytorch", name: "PyTorch", category: "Dev base", diskGb: 40, desc: "PyTorch for NVIDIA CUDA.", image: PT, setup: "" },
  { id: "cuda", name: "NVIDIA CUDA", category: "Dev base", diskGb: 40, desc: "CUDA and cuDNN development base image.", image: CUDA, setup: "apt-get update -q && apt-get install -yq python3 python3-pip git" },
  { id: "unsloth", name: "Unsloth Studio", category: "Training", diskGb: 64, desc: "Fast LLM fine-tuning and inference.", image: PT, setup: pipi("unsloth") },
  { id: "llamacpp", name: "Llama.cpp", category: "AI models & chat", diskGb: 40, desc: "Run your own model as a chatbot, assistant or API.", image: PT, setup: clone("https://github.com/ggerganov/llama.cpp", "llama.cpp", "cmake -B build -DGGML_CUDA=ON && cmake --build build -j") },
  { id: "comfyui", name: "ComfyUI", category: "Image AI", diskGb: 40, desc: "Node-based image and video generation.", image: PT, setup: clone("https://github.com/comfyanonymous/ComfyUI", "ComfyUI") },
  { id: "vllm", name: "vLLM", category: "AI models & chat", diskGb: 40, desc: "High-throughput inference engine with an OpenAI-compatible API.", image: PT, setup: pipi("vllm") },
  { id: "vllm-omni", name: "vLLM Omni", category: "AI models & chat", diskGb: 64, desc: "vLLM with multimodal models.", image: PT, setup: pipi("vllm transformers accelerate") },
  { id: "acestep", name: "ACE Step 1.5 UI & API", category: "Voice & audio", diskGb: 40, desc: "Music generation interface and API.", image: PT, setup: clone("https://github.com/ace-step/ACE-Step", "ACE-Step") },
  { id: "tensorflow", name: "TensorFlow CUDA", category: "Dev base", diskGb: 40, desc: "Official TensorFlow GPU image.", image: TF, setup: "apt-get update -q && apt-get install -yq git" },
  { id: "ngc", name: "PyTorch NGC", category: "Dev base", diskGb: 40, desc: "NVIDIA-optimized container for ETL, training and inference.", image: NGC, setup: "" },
  { id: "ai-toolkit", name: "Ostris AI Toolkit", category: "Training", diskGb: 48, desc: "Training diffusion models and LoRAs.", image: PT, setup: clone("https://github.com/ostris/ai-toolkit", "ai-toolkit") },
  { id: "kohya", name: "Kohya's GUI", category: "Training", diskGb: 40, desc: "GUI for Stable Diffusion and FLUX training.", image: PT, setup: clone("https://github.com/bmaltais/kohya_ss", "kohya_ss", "pip install -q -r requirements.txt || true") },
  { id: "fluxgym", name: "Flux Gym", category: "Training", diskGb: 64, desc: "Train FLUX.1 LoRAs with a simple UI.", image: PT, setup: clone("https://github.com/cocktailpeanut/fluxgym", "fluxgym") },
  { id: "voicebox", name: "Voicebox TTS", category: "Voice & audio", diskGb: 40, desc: "Text-to-speech.", image: PT, setup: pipi("TTS") },
  { id: "whisper", name: "Whisper WebUI & API", category: "Voice & audio", diskGb: 40, desc: "Speech-to-text web interface and API.", image: PT, setup: pipi("faster-whisper gradio") },
  { id: "axolotl", name: "Axolotl – LLM fine tuning", category: "Training", diskGb: 200, desc: "Datasets, configs and GPU access for fine-tuning, streamlined.", image: PT, setup: pipi("axolotl") },
  { id: "pinokio", name: "Pinokio (Desktop)", category: "Desktop", diskGb: 64, desc: "Ubuntu desktop with the Pinokio AI app installer.", image: PT, setup: "apt-get update -q && apt-get install -yq xfce4 xvfb x11vnc novnc" },
  { id: "oobabooga", name: "Oobabooga Text Gen UI & API", category: "AI models & chat", diskGb: 40, desc: "Text generation UI and API.", image: PT, setup: clone("https://github.com/oobabooga/text-generation-webui", "text-generation-webui", "pip install -q -r requirements.txt || true") },
  { id: "app-studio", name: "All-in-One App Studio", category: "Video AI", diskGb: 150, desc: "ComfyUI, SD Forge, ACE Step, Whisper, AI Toolkit and Unsloth together.", image: PT, setup: `${clone("https://github.com/comfyanonymous/ComfyUI", "ComfyUI")}; ${pipi("faster-whisper unsloth")}` },
  { id: "desktop", name: "Linux Desktop Container", category: "Desktop", diskGb: 40, desc: "Ubuntu desktop reachable from the browser.", image: PT, setup: "apt-get update -q && apt-get install -yq xfce4 xvfb x11vnc novnc" },
  { id: "sglang", name: "SGLang", category: "AI models & chat", diskGb: 40, desc: "Fast structured inference.", image: PT, setup: pipi("sglang[all]") },
  { id: "ollama", name: "Ollama", category: "AI models & chat", diskGb: 40, desc: "Pull and run open models with one command.", image: PT, setup: "curl -fsSL https://ollama.com/install.sh | sh" },
  { id: "open-webui", name: "Open WebUI (Ollama)", category: "AI models & chat", diskGb: 40, desc: "ChatGPT-style UI on top of Ollama.", image: PT, setup: "curl -fsSL https://ollama.com/install.sh | sh && pip install -q open-webui" },
  { id: "tgi", name: "HuggingFace TGI API", category: "AI models & chat", diskGb: 40, desc: "Text Generation Inference server.", image: PT, setup: pipi("text-generation") },
  { id: "langflow", name: "Langflow (Ollama)", category: "AI models & chat", diskGb: 48, desc: "Visual agent builder with Ollama models.", image: PT, setup: "curl -fsSL https://ollama.com/install.sh | sh && pip install -q langflow" },
  { id: "invokeai", name: "InvokeAI", category: "Image AI", diskGb: 96, desc: "Image generation studio.", image: PT, setup: pipi("invokeai") },
  { id: "forge", name: "SD WebUI Forge", category: "Image AI", diskGb: 40, desc: "Stable Diffusion and FLUX image generation.", image: PT, setup: clone("https://github.com/lllyasviel/stable-diffusion-webui-forge", "forge", "true") },
  { id: "wan2gp", name: "Wan2GP", category: "Video AI", diskGb: 128, desc: "Video generation for consumer GPUs.", image: PT, setup: clone("https://github.com/deepbeepmeep/Wan2GP", "Wan2GP") },
  { id: "open-sora", name: "Open-Sora", category: "Video AI", diskGb: 80, desc: "Text- and image-to-video model.", image: PT, setup: clone("https://github.com/hpcaitech/Open-Sora", "Open-Sora", "pip install -q -e .") },
  { id: "a1111", name: "SD WebUI A1111", category: "Image AI", diskGb: 40, desc: "Stable Diffusion image generation.", image: PT, setup: clone("https://github.com/AUTOMATIC1111/stable-diffusion-webui", "sd-webui", "true") },
  { id: "fooocus", name: "Fooocus", category: "Image AI", diskGb: 40, desc: "Simple, high-quality image generation.", image: PT, setup: clone("https://github.com/lllyasviel/Fooocus", "Fooocus") },
  { id: "swarmui", name: "SwarmUI", category: "Image AI", diskGb: 40, desc: "Modular image generation interface.", image: PT, setup: clone("https://github.com/mcmonkeyprojects/SwarmUI", "SwarmUI", "true") },
];

export const NO_TEMPLATE: Template = { id: "none", name: "No template", category: "Dev base", diskGb: 40, desc: "Clean PyTorch base. The AI installs what it needs.", image: PT, setup: "" };

export function getTemplate(id: string): Template { return TEMPLATES.find((t) => t.id === id) ?? NO_TEMPLATE; }

/** AI models the agent can run with. */
export const AI_MODELS = [
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", blurb: "Strongest all-round agent. Runs through Pito.", local: false },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", blurb: "Fast and cheap for simple missions.", local: false },
  { id: "local:qwen2.5-coder:14b", name: "Qwen2.5 Coder 14B (local)", blurb: "Open model running on the machine's own GPU. Needs 24 GB VRAM.", local: true },
  { id: "local:qwen2.5-coder:7b", name: "Qwen2.5 Coder 7B (local)", blurb: "Open model on the GPU. Works from 12 GB VRAM.", local: true },
];

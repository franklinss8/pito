# Pito GPU worker: vLLM + RunPod Serverless handler.
# Build and push:  docker build -t VOTRE_COMPTE/pito-worker:1 . && docker push VOTRE_COMPTE/pito-worker:1
FROM vllm/vllm-openai:v0.8.5

RUN pip install --no-cache-dir runpod==1.7.9

COPY handler.py /handler.py

ENV MODEL_NAME=Qwen/Qwen2.5-Coder-14B-Instruct \
    MAX_MODEL_LEN=16384 \
    HF_HOME=/runpod-volume/hf \
    PYTHONUNBUFFERED=1

ENTRYPOINT []
CMD ["python3", "-u", "/handler.py"]

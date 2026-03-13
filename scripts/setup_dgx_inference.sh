#!/usr/bin/env bash
# setup_dgx_inference.sh — Set up llama.cpp inference server on NVIDIA DGX Spark
#
# Usage (run on the DGX):
#   bash setup_dgx_inference.sh
#
# Prerequisites:
#   - NVIDIA GPU drivers installed (nvidia-smi works)
#   - Internet access for downloading model weights
#   - HuggingFace token (set HF_TOKEN env var for gated models)
#
# This script:
#   1. Installs build dependencies + CUDA toolkit
#   2. Builds llama.cpp with CUDA support
#   3. Downloads the Qwen3.5-122B-A10B GGUF model
#   4. Creates a systemd service for the inference server
#   5. Starts the server on port 8080

set -euo pipefail

MODEL_REPO="unsloth/Qwen3.5-122B-A10B-UD-Q5_K_XL-00001-of-00003.gguf"
MODEL_DIR="$HOME/models/qwen3.5-122b"
LLAMA_DIR="$HOME/llama.cpp"
SERVER_PORT=8080
CTX_SIZE=8192
N_PARALLEL=4  # concurrent request slots

echo "=== DGX Inference Server Setup ==="
echo "Model: Qwen3.5-122B-A10B (GGUF Q5_K_XL)"
echo "Port:  $SERVER_PORT"
echo ""

# ── Step 1: Install build dependencies ──
echo "── Step 1: Installing build dependencies ──"
sudo apt-get update -qq
sudo apt-get install -y -qq build-essential cmake git curl python3-pip

# Install CUDA toolkit if not present
if ! command -v nvcc &>/dev/null; then
    echo "  Installing CUDA toolkit..."
    sudo apt-get install -y -qq nvidia-cuda-toolkit
fi

# ── Step 2: Build llama.cpp ──
echo "── Step 2: Building llama.cpp with CUDA support ──"
if [ -d "$LLAMA_DIR" ]; then
    echo "  Updating existing llama.cpp..."
    cd "$LLAMA_DIR"
    git pull --ff-only
else
    git clone https://github.com/ggerganov/llama.cpp.git "$LLAMA_DIR"
    cd "$LLAMA_DIR"
fi

cmake -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j "$(nproc)"

echo "  llama.cpp built successfully"
ls -la build/bin/llama-server

# ── Step 3: Download model ──
echo "── Step 3: Downloading GGUF model ──"
mkdir -p "$MODEL_DIR"

pip3 install --quiet huggingface_hub

python3 -c "
from huggingface_hub import snapshot_download
import os

snapshot_download(
    repo_id='unsloth/Qwen3.5-122B-A10B-UD-Q5_K_XL-00001-of-00003.gguf',
    local_dir=os.environ['MODEL_DIR'],
    repo_type='model',
    token=os.environ.get('HF_TOKEN'),
)
print('Download complete')
"

# Find the main GGUF file
MODEL_FILE=$(find "$MODEL_DIR" -name "*.gguf" -type f | head -1)
if [ -z "$MODEL_FILE" ]; then
    echo "ERROR: No GGUF file found in $MODEL_DIR"
    exit 1
fi
echo "  Model file: $MODEL_FILE"

# ── Step 4: Test the server ──
echo "── Step 4: Testing inference server ──"
"$LLAMA_DIR/build/bin/llama-server" \
    --model "$MODEL_FILE" \
    --n-gpu-layers -1 \
    --ctx-size "$CTX_SIZE" \
    --parallel "$N_PARALLEL" \
    --host 0.0.0.0 \
    --port "$SERVER_PORT" &

SERVER_PID=$!
sleep 10

if curl -s "http://localhost:$SERVER_PORT/v1/models" | grep -q "model"; then
    echo "  Server is running!"
    kill "$SERVER_PID" 2>/dev/null || true
else
    echo "  WARNING: Server health check failed (may still be loading model)"
    kill "$SERVER_PID" 2>/dev/null || true
fi

# ── Step 5: Create systemd service ──
echo "── Step 5: Creating systemd service ──"
SERVICE_FILE="/etc/systemd/system/llama-inference.service"
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=llama.cpp Inference Server (Qwen3.5-122B)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$LLAMA_DIR
ExecStart=$LLAMA_DIR/build/bin/llama-server \\
    --model $MODEL_FILE \\
    --n-gpu-layers -1 \\
    --ctx-size $CTX_SIZE \\
    --parallel $N_PARALLEL \\
    --host 0.0.0.0 \\
    --port $SERVER_PORT
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable llama-inference
sudo systemctl start llama-inference

echo ""
echo "=== Setup complete ==="
echo ""
echo "Server running at: http://0.0.0.0:$SERVER_PORT"
echo "OpenAI-compatible endpoint: http://0.0.0.0:$SERVER_PORT/v1/chat/completions"
echo ""
echo "Test with:"
echo "  curl http://localhost:$SERVER_PORT/v1/models"
echo ""
echo "Service management:"
echo "  sudo systemctl status llama-inference"
echo "  sudo systemctl restart llama-inference"
echo "  journalctl -u llama-inference -f"
echo ""
echo "GitHub Actions secrets to set:"
echo "  LLM_API_URL  = http://<tailscale-ip>:$SERVER_PORT/v1/chat/completions"
echo "  LLM_API_KEY  = not-needed"
echo "  LLM_MODEL    = qwen3.5-122b-a10b"
echo ""
echo "To keep using MiniMax instead, just set MINIMAX_API_KEY — no other changes needed."

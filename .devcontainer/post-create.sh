# Git LFS is required by the repository's pre-push hook.
if ! command -v git-lfs >/dev/null 2>&1; then
    echo "Installing Git LFS..."
    sudo apt-get update && sudo apt-get install -y git-lfs || exit 1
fi

git lfs install --local --skip-repo || exit 1

echo
echo "Installing/updating OpenAI Codex CLI..."

npm install -g @openai/codex@latest

echo
echo "Codex CLI:"
codex --version || true

# Install uv if missing
if ! command -v uv >/dev/null 2>&1; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

export PATH="$HOME/.local/bin:$PATH"

echo "uv:"
uv --version

if ! command -v graphify >/dev/null 2>&1; then
    echo "Installing Graphify..."
    uv tool install graphifyy
fi

echo "Graphify:"
graphify --version
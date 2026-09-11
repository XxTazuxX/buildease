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
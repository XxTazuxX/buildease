echo
echo "Installing/updating OpenAI Codex CLI..."

npm install -g @openai/codex@latest

echo
echo "Codex CLI:"
codex --version || true
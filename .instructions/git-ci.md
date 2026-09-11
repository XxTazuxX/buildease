# Git, CI, and development environment

Load for Git operations, GitHub Actions, Codespaces/devcontainer, or packaging.

## Git and scope
Root Git safety rules apply to force pushes, hard resets, history rewrites, branch deletion, and discarding user changes. Keep changes reviewable and inspect status before substantial work.

## Codespaces
Primary development environment is GitHub Codespaces with Ubuntu, Java 21, Maven, Node/npm, Docker, Git, GitHub CLI, Codex, uv, Graphify where configured, and approved VS Code extensions. Verify availability rather than assuming host tools exist.

Repository-owned configuration lives in `.devcontainer/`: `devcontainer.json`, `post-create.sh`, and `post-start.sh` when needed. Keep approved extensions/settings there and avoid inheriting arbitrary editor/profile extensions where possible.

`post-create.sh` may verify tools, make `mvnw` executable, download Maven dependencies, install frontend dependencies, install/check uv and Graphify, check environment-variable presence, and prepare harmless directories. It must not start long-running servers, run destructive migrations, mutate production databases, embed secrets, or perform destructive Git actions.

## Development and production
Development flow: browser → React/Vite `:5173` → `/api` Vite proxy → Spring Boot `:8080` → Neon PostgreSQL.

Production may build React static assets into Spring Boot resources for a single JAR, serving React at `/` and APIs at `/api/**`. This is an option, not a mandate. Do not bundle frontend into backend on every development edit.

## CI
GitHub Actions should enforce the same applicable checks as local/Codespaces verification. Keep backend/frontend checks separable where possible. Target commands and tooling belong to [code-quality.md](code-quality.md); credentials belong to [security.md](security.md). Repository workflow locations belong to [folder-structure.md](folder-structure.md).

# Graphify and narrow exploration

Load for codebase questions, relationships, change impact, or graph maintenance. When the user invokes `/graphify`, use the installed [graphify skill](../.codex/skills/graphify/SKILL.md) before other work.

## Retrieval
When `graphify-out/graph.json` exists, first run `graphify query "<question>"`. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. Query → inspect symbol → inspect neighbors → read relevant source. Useful targets include callers/callees, package relationships, controllers/services/repositories, tests, and blast radius.

Use `--budget` with approximately 800–1500 tokens for a simple issue, 1500–3000 for a normal feature, and 3000–5000 for architecture/impact analysis. Do not request huge contexts by default.

Use `graphify-out/wiki/index.md` for broad navigation if present. Read `GRAPH_REPORT.md` only for broad architecture review or when query/path/explain do not provide enough context. Avoid recursive repository dumps and irrelevant node_modules, target, dist, coverage, binaries, logs, generated artifacts, migrations, and lockfiles.

For frontend data/API issues, start at Model; for rendering/interactions, start at View. Trace View → ViewModel → Model → Shared as needed.

## Freshness and fallback
Graphify is a snapshot, not implementation authority. If graph facts conflict with source, trust source and refresh. Dirty graph output is expected after hooks/updates and is not a reason to skip retrieval. Skip graph-first retrieval when explicitly instructed or when investigating stale/incorrect graph output. If no graph or runnable tool is available, use scoped source searches and state the limitation.

After code/structural changes, run `graphify update .` (AST-only, no API cost). Do not claim semantic documentation is refreshed by an AST-only update; use the skill's semantic extraction workflow when document graph refresh is required.

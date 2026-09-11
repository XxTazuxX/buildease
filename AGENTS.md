# BuildEase

Java-based building management platform for domain workflows and auditable operations.

## Global rules
- Current source and tests are authoritative for implementation; these instructions define intended direction. Preserve coherent existing conventions and move incrementally.
- Before substantial changes, check Git status/branch and relevant code, tests, and configuration. Make the smallest coherent change; preserve user work. Destructive Git actions require explicit instruction.
- Never commit or print secrets. Backend validation and authorization are authoritative. Never run destructive tests against shared databases.
- Verify before claiming success; report unrun checks and limitations honestly. Do not silently perform major dependency upgrades or guess dependency versions.

## Load instructions on demand
1. Always read this root file first, then determine the task category using the table below.
2. Load only matching instruction files. Do not preload all files at session start or repeatedly reload instructions already known in this task.
3. Use Graphify first for codebase exploration; load its guide when exploring. Inspect only relevant source and tests afterward.
4. Expand context only when dependencies or architecture require it. A link is a route, not a command to load every linked file. Keep context narrow and token-efficient.
5. Keep rules modular, with one owning file per topic; reference other rules instead of duplicating them. Applicable nested instructions must not contradict root rules.

| Task | Load from `.instructions/` |
| --- | --- |
| Product/domain design, initial audit | [architecture.md](.instructions/architecture.md) |
| Backend behavior/API | [backend.md](.instructions/backend.md), [testing-tdd.md](.instructions/testing-tdd.md) |
| React feature | [frontend-mvvm.md](.instructions/frontend-mvvm.md), [testing-tdd.md](.instructions/testing-tdd.md) |
| Database migration/persistence | [database-neon.md](.instructions/database-neon.md), [backend.md](.instructions/backend.md), [testing-tdd.md](.instructions/testing-tdd.md) |
| Java dependency/plugin change | [java-dependencies.md](.instructions/java-dependencies.md), [backend.md](.instructions/backend.md), [code-quality.md](.instructions/code-quality.md) |
| Architecture refactor | [architecture.md](.instructions/architecture.md), [folder-structure.md](.instructions/folder-structure.md), [graphify-context.md](.instructions/graphify-context.md) |
| Tests/TDD | [testing-tdd.md](.instructions/testing-tdd.md) |
| Quality checks/verification | [code-quality.md](.instructions/code-quality.md) |
| Authentication, authorization, secrets | [security.md](.instructions/security.md) |
| CI, Git, Codespaces, build packaging | [git-ci.md](.instructions/git-ci.md), [code-quality.md](.instructions/code-quality.md) |
| Codebase exploration/Graphify | [graphify-context.md](.instructions/graphify-context.md) |
| File/package placement | [folder-structure.md](.instructions/folder-structure.md) |

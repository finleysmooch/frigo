# Frigo Documentation

Entry point for the Frigo project documentation. Read top-down — the docs are ordered by priority for a fresh Claude.ai or Claude Code session.

## Living docs (active reference)

| Doc | Purpose |
|-----|---------|
| `PROJECT_CONTEXT.md` | What Frigo is, what works, what's next. Always read first. |
| `FF_LAUNCH_MASTER_PLAN.md` | F&F launch strategy, phase sequence, scope decisions, risk register |
| `FRIGO_ARCHITECTURE.md` | Codebase map, services, components, patterns. Claude Code reads this every session. |
| `DEFERRED_WORK.md` | Master backlog of bugs, tech debt, and deferred items |
| `DOC_MAINTENANCE_PROCESS.md` | The planning/execution workflow loop, session log format, sync conventions |
| Active phase doc | Current phase: goals, decisions, progress, deferred items. File name varies (e.g., `PHASE_8_PANTRY_INTELLIGENCE.md`). |
| `_SESSION_LOG.md` | Active session log — Claude Code writes entries here every execution session |
| `playbooks/` | Per-feature design rationale and iteration history |

## Archive

`archive/` holds completed phase docs, archived session logs, past CC prompts, design decision docs from shipped phases, wireframe artifacts, and historical handoff notes. See `archive/README.md` for the structure.

## Workflow folders (outside `docs/`)

| Folder | Purpose |
|--------|---------|
| `_pk_sync/` (repo root, gitignored) | Where Claude Code stages updated docs intended for upload to Claude.ai project knowledge. After Tom uploads, the folder is cleared. |
| `external_documents/` (repo root, gitignored) | Incoming CC prompt files from Claude.ai planning sessions |

## Other repo-level docs

| File | Purpose |
|------|---------|
| `../CLAUDE.md` (repo root) | Claude Code instructions — read first by every CC session |
| `doc-ecosystem.html` | Visual reference showing how all docs (repo + project knowledge + external) relate |

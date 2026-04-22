# Archive

This folder holds documentation that's no longer actively read in current planning sessions but is preserved for reference. Most files here describe completed work — phases that have shipped, design decisions that have been superseded or implemented, CC prompts that have already executed, session logs from finished phases.

**Active docs live in the parent `docs/` folder.** Archive is reference-only.

## Folder structure

| Folder | Contents |
|--------|----------|
| `phases/` | Completed phase docs (PHASE_1 through PHASE_N), and the master plan / scoping docs that fed them |
| `session_logs/` | Archived per-phase session logs (`_SESSION_LOG_PHASE{N}.md`) |
| `design_decisions/` | Phase-specific design decision docs and scoping notes (e.g., `PHASE_7F_DESIGN_DECISIONS.md`, `_SCOPING_NOTES_7D.md`) |
| `wireframes/` | Wireframe HTML artifacts from past phases |
| `prompts/` | CC prompt files that have already been executed |
| `handoffs/` | Handoff docs, doc-maintenance worksheets, ad-hoc session notes from past work |

## Lifecycle conventions

**When a phase completes:**
1. Its session log is renamed `_SESSION_LOG_PHASE{N}.md` and stays in top-level `docs/` for one phase
2. The phase doc itself stays in top-level `docs/` for one phase (so the next phase's planning can reference it easily)

**When the next phase completes:** Both the previous-previous phase doc and its session log move into `docs/archive/phases/` and `docs/archive/session_logs/` respectively. Any phase-specific design decision docs, wireframes, and CC prompts also move to their respective archive subfolders at this point.

**Mental rule:** A doc belongs in top-level `docs/` only if a fresh Claude.ai instance would need to read it in the first 5 minutes of a new planning session. Otherwise, archive it.

## Files in this folder are read-only

Do not edit archived docs. If you need to update something here, you're either:
- Discovering that a "completed" phase isn't actually complete (in which case move the doc back to `docs/` and reopen the phase), or
- Noticing a content mistake worth correcting (in which case fix it in place with a commit message that explains the archival correction).

Otherwise, treat this folder like a museum.

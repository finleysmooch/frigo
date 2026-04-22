# Frigo — Documentation Maintenance Process
**Last Updated:** April 22, 2026
**Version:** 5.1
**Status:** Active — reflects the repo-as-canonical workflow established 2026-04-20/21, with code snapshots in PK codified in v5.1.

---

## 1. The System in One Paragraph

Claude.ai owns planning and the living docs; Claude Code (CC) executes mechanical work and reports back via `SESSION_LOG.md`. The repo's `docs/` folder is canonical — git history is the preservation mechanism. Project knowledge (PK) is a working-set cache of ~10–12 files Claude.ai needs to search during active planning sessions, not a source of truth. Living doc updates propagate **repo → `_pk_sync/` → PK**, with Tom as the human in the loop who reviews commits and manually uploads to PK. Completed work — shipped phases, consumed CC prompts, absorbed handoffs, old session logs — moves to `docs/archive/` under topic subfolders.

---

## 2. The Planning → Execution → Reconciliation Loop

The day-to-day rhythm has four steps:

1. **Planning session (Claude.ai + Tom).** Claude.ai searches PK for context, proposes decisions, and writes them into the active phase doc immediately as they're made — not after the session. **When a decision implies updates to other living docs — a new deferred item → `DEFERRED_WORK.md`, a schema or architectural change → `FRIGO_ARCHITECTURE.md`, a phase-level status change → `PROJECT_CONTEXT.md`, a scope adjustment → `FF_LAUNCH_MASTER_PLAN.md` — Claude.ai flags these downstream updates explicitly in chat so Tom can queue the follow-up edits.** Small living-doc edits can be applied by Tom directly in chat; larger changes or any edit that needs an authoritative file operation go through a CC prompt.

2. **CC prompt generation.** When execution is needed, Claude.ai drafts a structured prompt with six sections: **Context** (why this prompt exists), **Inputs to read** (exact file paths), **Task** (numbered steps), **Constraints** (what not to do), **Verification** (how to prove it worked), and the **SESSION_LOG entry format** for CC to fill in. Prompts are named `CC_PROMPT_YYYY-MM-DD_short-description.md` and shared via the outputs folder.

3. **CC execution.** CC reads the prompt, executes the numbered steps in order, writes a `SESSION_LOG.md` entry under the dated header, and reports results in chat. **CC never authors strategic content** — only mechanical file operations, text insertions, git moves, and similar. Judgment calls about what something should say originate in Claude.ai planning and arrive at CC as explicit instructions.

4. **Reconciliation (Claude.ai).** Claude.ai reads the SESSION_LOG entry, reconciles the results into the relevant living docs (either directly in chat or via a follow-up CC prompt), and hands a clear commit message to Tom. Tom commits and, if the edit touched a PK-resident doc, uploads the staged copy from `_pk_sync/` to PK.

Flow diagram:

```
[Tom + Claude.ai planning]
    ↓ writes decisions
[Active phase doc]
    ↓ when execution needed
[CC prompt drafted by Claude.ai]
    ↓ fires at
[Claude Code]
    ↓ executes, writes to
[SESSION_LOG + _pk_sync/ + repo files]
    ↓ reported back to
[Claude.ai reconciles into living docs]
    ↓ Tom commits, uploads to PK
```

---

## 3. Claude.ai Session Types

Claude.ai sessions that produce structured output fall into three shapes. Tom declares the type in the opening message and it scopes the work for that chat. The types enforce coherence when a session is producing new content, decisions, or structural changes — ad-hoc questions, exploration, and debugging don't require the discipline.

### Phase planning session
Deep on one phase. Proposes decisions, writes them into the active phase doc, generates CC prompts, reconciles SESSION_LOG entries. Multiple contiguous phase planning steps can share one Claude.ai instance — fresh instance spin-up is costly, and phase context benefits from continuity.

### Cross-cutting session
Doc maintenance, workflow changes, archive operations, PK pruning, living-doc rewrites — any work that produces new content or structural changes outside a single phase. Usually a fresh instance, because cross-cutting work benefits from perspective over recent phase context.

### Oversight session
Bounded review of existing work. Reads a specific deliverable (a completed phase, a rewritten living doc, a workflow change) and produces a structured report — not new edits. Used when active verification is needed that something landed correctly. Always a fresh instance. **Read-only by discipline:** oversight observes and reports; recommended edits flow back to Tom for approval and to a follow-up phase planning or cross-cutting session for execution.

### Session opening pattern

Tom opens each new chat with a one-line declaration:

> Frigo project. **Session type:** [phase planning / cross-cutting / oversight]. **Scope:** [specific goal].

Examples:
- *Frigo project. Session type: phase planning. Scope: Phase 8A pantry UX overhaul — scope it, propose sub-checkpoints, draft first CC prompt.*
- *Frigo project. Session type: cross-cutting. Scope: refresh `FRIGO_ARCHITECTURE.md` to reflect Phase 7 shipped state.*
- *Frigo project. Session type: oversight. Scope: audit `DOC_MAINTENANCE_PROCESS` v5.0 for internal consistency and cross-reference accuracy. Structured report only; do not re-author.*

The instance adopts that scope for the duration. If the session drifts into non-scope territory, either re-scope explicitly or spin up a new instance.

### Chat title convention

Each chat's title should be prefixed with the session type in square brackets:

- `[phase planning] Phase 8A pantry UX scoping`
- `[cross-cutting] FRIGO_ARCHITECTURE refresh`
- `[oversight] DOC_MAINTENANCE v5.0 audit`

Keeps the chat list scannable by type when multiple threads are in flight. When the instance confirms the session type, it suggests a title in this format for Tom to apply. Ad-hoc chats without a declared type don't need the bracketed prefix — a regular descriptive title is fine.

### When the session type isn't declared

If Tom opens with freehand text that doesn't explicitly declare a session type, Claude.ai proposes the framing that best fits the opening. For structured work, that's one of the three types:

> Quick check: this reads as a **[proposed type]** session — [one-line reason from the opening]. Confirm, or should I treat it as a different type?

For ad-hoc work (quick questions, exploration, debugging, ideation), Claude.ai flags that no type fits and proceeds:

> Quick note: this reads as an ad-hoc / exploratory chat rather than a structured session, so I'll proceed without a formal type. Say if you want me to treat it more formally.

Committing to a reading — typed or not — rather than asking open-ended forces the instance to frame the request; Tom confirms, overrides, or accepts the no-type framing with one word. If the scope is also unclear, include a scope clarification in the same message so Tom only has to respond once.

### Recommended oversight cadences

- **Phase-boundary oversight.** At the end of each phase, review the completed phase doc, updated living docs, and the last ~10 SESSION_LOG entries. Report alignment between decisions and execution, cross-cutting concerns that were missed, and recommended focus for the next phase.
- **Major doc rewrite audit.** After any full rewrite of a living doc, audit for internal consistency and cross-reference accuracy before the doc is considered settled.
- **Mid-phase drift check (on demand).** If a phase planning session is re-deriving settled decisions or hitting context limits, an oversight pass can diagnose whether the phase doc needs consolidation.

### What makes an oversight session work

- **Explicit scope AND explicit non-scope.** "Audit X for internal consistency" paired with "do not re-author, do not start new work."
- **Structured deliverable.** The output is a report: "Alignment: [findings] / Drift: [findings] / Missing: [findings] / Recommendations: [findings]." Not rambling prose.
- **Read-only orientation.** Any change needed flows back to Tom for approval, then to a follow-up phase planning or cross-cutting session for execution.

---

## 4. Where Everything Lives — PK vs Repo vs Drive

This is the single most important rule in v5.0: **the repo is canonical, PK is a cache, Drive is optional.** Internalize this before anything else.

### Layer 1 — Repo (`docs/`): CANONICAL

Every living doc, every committed wireframe, every archived phase doc. Git history is the preservation mechanism. The repo is the source of truth.

**What lives here:**
- Living docs: `PROJECT_CONTEXT.md`, `FRIGO_ARCHITECTURE.md`, `FF_LAUNCH_MASTER_PLAN.md`, `DEFERRED_WORK.md`, `DOC_MAINTENANCE_PROCESS.md`, `PROCESS_WATCHPOINTS.md`, and the active phase doc (all in `docs/`); `CLAUDE.md` at repo root
- Archived phase docs: `docs/archive/phases/`
- Archived CC prompts: `docs/archive/prompts/`
- Archived handoffs: `docs/archive/handoffs/`
- Archived session logs: `docs/archive/session_logs/`
- Archived design decisions: `docs/archive/design_decisions/`
- Archived wireframes: `docs/archive/wireframes/`
- The `_pk_sync/` workflow folder at repo root (staging only, most contents gitignored)

### Layer 2 — Project Knowledge (PK): WORKING SET

A cache of ~12–14 living-doc files plus a dated code-snapshot set (typically 40–70 files, see "Code Snapshots in PK" below) that Claude.ai searches during active planning sessions. **PK is not canonical** — it's a search index over the subset of docs that benefit from being searchable in-session.

**Current essentials in PK (9):**
- `PROJECT_CONTEXT.md`
- `FRIGO_ARCHITECTURE.md`
- `FF_LAUNCH_MASTER_PLAN.md`
- `DEFERRED_WORK.md`
- `DOC_MAINTENANCE_PROCESS.md`
- `PROCESS_WATCHPOINTS.md` — retrospective working doc. In PK so Claude.ai can review open watchpoints during oversight passes and when introducing new process mechanics.
- The active phase doc
- The warm previous phase doc (per the warm-one-phase rule in Section 6)
- `CLAUDE.md` — the CC-facing entry point. Lives in PK so Claude.ai can audit it for drift against `DOC_MAINTENANCE_PROCESS.md` without needing a CC read cycle.

**Strongly recommended in PK (5):**
- Schema CSV (`Supabase_Snippet_Supabase_Frigo_DB_Structure_Query_22.csv`)
- Product Feature Roadmap CSV
- `CONCEPT_FLEXIBLE_MEAL_PLANNING.md` (or whichever phase-adjacent feature spec is currently in play)
- `SHARED_PANTRIES_FEATURE_SPEC.md` (or current equivalent)
- `Frigo_Wireframes_Companion.pdf`

**What does NOT belong in PK:**
- Code files **outside the Tier 1–3 snapshot set** (see the new "Code Snapshots in PK" subsection below). Arbitrary ad-hoc code uploads don't belong in PK — use `/mnt/user-data/uploads/` for one-off session-specific files instead. The curated snapshot set is the exception, not a license to mirror the entire repo.
- Icon components
- Completed CC prompts
- Old handoff docs
- Archived phase docs (Phases 1–6 and similar — they're in the repo archive)
- Wireframe HTMLs
- Recipe extraction reference JSONLs unless that work is imminent

**The rule: if Claude.ai doesn't need to search a file during a current-phase planning session, it doesn't belong in PK.** When in doubt, cut from PK — it's cheap to re-add.

### Layer 3 — Google Drive: OPTIONAL

Drive's role is interactive-viewing convenience for artifacts the repo can't render well. Today that's essentially nothing — HTML wireframes render fine from local files, and PDFs render from repo downloads.

**What belongs in Drive:** TBD. No active use case currently. Leave as an option for future — e.g., sharing a wireframe HTML via URL with a non-technical collaborator.

**What doesn't belong in Drive:** living docs (canonical in repo), PK content (cached in PK), code (in repo).

### Code Snapshots in PK

A curated subset of `lib/services/`, `lib/utils/`, `constants/`, and `screens/` is cached in PK as **dated snapshots**. Purpose: let Claude.ai search code directly during planning, debugging, and design sessions without round-tripping through Tom or a CC recon prompt.

**The snapshot is never canonical.** The working tree in the repo is canonical. PK snapshots exist for pattern-finding, assumption-grounding, and troubleshooting reference — not source of truth.

**Tracking:** `docs/PK_CODE_SNAPSHOTS.md` lists every file currently in the snapshot set with its snapshot date and staleness-risk column. Claude.ai can check this doc at session open to assess which files are most likely stale for the current work.

**Tiers:**

- **Tier 1** — services, utilities, constants, type contracts. Business logic and stable structural references. Highest value for debugging and pattern-finding.
- **Tier 2** — screens and key interaction components. Surface area for design work and wireframe grounding.
- **Tier 3** — supporting components and navigation. Lower individual value but matters cumulatively for broader pattern-finding.

See `docs/PK_CODE_SNAPSHOTS.md` for the exact file list per tier.

**Staleness discipline.** Every code file in PK carries a snapshot header at the top of the file:

```typescript
/**
 * PK SNAPSHOT — YYYY-MM-DD
 * Canonical source: repo working tree at finleysmooch/frigo
 * This file may be stale if CC has edited it since the snapshot date.
 * During active phase work, the working tree is authoritative — not this snapshot.
 */
```

Claude.ai sees this header on every read and anchors the correct epistemic stance.

**Dual staleness signaling** (new in v5.1):

1. **SESSION_LOG flag (real-time).** When CC edits any file listed in `PK_CODE_SNAPSHOTS.md`, the SESSION_LOG entry's "Files modified" section includes `⚠️ PK snapshot now stale (was YYYY-MM-DD)` alongside the file path. Tom sees this flag on copy-paste into Claude.ai, so the staleness signal lands in the reconciliation turn — before Claude.ai makes any claim that depends on that file.
2. **Tracking-doc update (persistent).** In the same execution, CC bumps the file's Staleness Risk column in `PK_CODE_SNAPSHOTS.md` to HIGH. This is the persistent record that survives across sessions.

The mechanism is triggered by Rule E in `CLAUDE.md` Standing Rules — CC opens the tracking doc fresh each session and checks modified files against it before writing the SESSION_LOG entry. This is intentionally not memory-dependent: the rule is anchored to reading the tracking doc, not to remembering the file list.

**Signal precedence.** The two signals answer different questions. SESSION_LOG flags answer "did this drift recently?" — per-session drift events, relevant only to the session that contains them and its immediate reconciliation. Tracking-doc flags answer "is this currently known stale?" — accumulated state that persists until the next refresh resets it. A tracking-doc HIGH outlives its originating SESSION_LOG entry; a SESSION_LOG flag older than the last refresh is historical. Both consulted together give the full picture.

**When snapshots are current vs. stale:**

- **Current as of the last sub-phase boundary.** Snapshots get refreshed at every sub-phase boundary via the standing CC prompt at `docs/CC_PROMPTS/refresh_pk_code_snapshots.md`.
- **Stale during an active sub-phase.** If CC has edited a file during the current sub-phase, the PK snapshot is behind by however much CC has changed — and the dual-signal mechanism makes that visible.

**Rule of thumb for Claude.ai:** during an active sub-phase, treat PK code as *indicative* rather than *authoritative*. For debugging a specific CC build, writing a prompt that depends on exact current state, or making design decisions that hinge on current structure, ask Tom to upload the current file directly into the chat via `/mnt/user-data/uploads/`, or propose a targeted CC read-and-report prompt. Never assume PK code is current during active phase execution — and especially not when the tracking doc or a recent SESSION_LOG entry flags HIGH staleness on the file.

**Refresh cadence:**

- **Sub-phase boundary refresh (standard).** Between sub-phases, CC runs the standing refresh prompt. Tom batch-uploads the `_pk_sync/code/` contents to PK. One CC turn; Tom's upload side is bulk-friendly.
- **Mid-phase refresh (optional).** If a specific file has clearly diverged from its snapshot and Claude.ai is leaning on it for active work, Tom can fire the same refresh prompt scoped to individual files. Judgment call per session; no formal policy.
- **Phase-completion refresh (mandatory).** Step 1a of the Phase Completion Checklist is a full Tier 1–3 refresh.

### The Propagation Pattern

When a living doc is updated:

1. CC edits the file in its canonical repo location (usually `docs/`; CLAUDE.md lives at repo root) and updates its `Last Updated` header to today's date
2. CC drops an identical copy in `_pk_sync/FILE_YYYY-MM-DD.md` using that same date
3. Tom reviews and commits the repo change
4. Tom manually uploads `_pk_sync/FILE_YYYY-MM-DD.md` to PK and deletes the previously dated copy from PK
5. Tom deletes the file from `_pk_sync/` (keeping `.gitkeep`)

This keeps PK in lockstep with the repo without requiring Claude.ai or CC to have write access to PK. The date stamp on the PK filename makes staleness visible at a glance — if PK shows `PROJECT_CONTEXT_2026-04-21.md` but the repo header reads `April 25, 2026`, PK is behind.

---

## 5. The `_pk_sync/` Workflow Folder

**Location:** repo root (`_pk_sync/`), gitignored except for `.gitkeep`.

**Purpose:** CC drops updated living docs here. Tom uploads them to PK. Tom empties the folder after upload.

**Rules:**
- **Only living docs go here.** Not phase docs that are staying in the repo, not archived content, not reference CSVs — just the files in active PK that have been updated in the repo and need their PK copies replaced.
- **Exception: `_pk_sync/code/` subfolder for code snapshots.** The standing refresh prompt at `docs/CC_PROMPTS/refresh_pk_code_snapshots.md` stages Tier 1–3 code snapshots here in a mirrored directory structure (`_pk_sync/code/lib/services/postService.ts`, etc.). Tom batch-uploads the whole subfolder to PK, replacing stale copies. Same gitignore rules apply.
- **Filenames include a date stamp.** `_pk_sync/PROJECT_CONTEXT_2026-04-21.md` — the date matches the `Last Updated` header in the file. Repo filenames stay canonical (`docs/PROJECT_CONTEXT.md`); only the `_pk_sync/` copy and the PK copy carry the suffix. Surfaces PK staleness at a glance: if PK shows a date that doesn't match the repo header, PK is behind.
- **If a file sits in `_pk_sync/` for more than a day,** that's a signal to Tom to either complete the upload or flag that the upload isn't happening.
- **Tom clears `_pk_sync/` after each successful PK upload.** Empty + `.gitkeep` is the idle state.

**Not in scope for this folder:**
- Staging for Drive (no Drive use case yet)
- Staging for repo commits — CC commits the repo copy directly to `docs/`, not via `_pk_sync/`

---

## 6. Archive Structure and Lifecycle

The archive went live on 2026-04-21. Its job is active preservation of consumed artifacts, not historical completeness.

### Subfolders under `docs/archive/`

- **`phases/`** — completed phase docs (Phases 1–6, `PHASE_7I_MASTER_PLAN` after absorption, `PHASE_RECIPE_DISCOVERY`; `PHASE_7` moves here when Phase 8 ships)
- **`handoffs/`** — completed handoff docs and consolidated change lists
- **`prompts/`** — consumed CC prompts (going forward; not backfilled)
- **`session_logs/`** — archived session logs at phase boundaries (going forward)
- **`design_decisions/`** — design-decision docs (e.g., `PHASE_7F_DESIGN_DECISIONS.md` if recovered)
- **`wireframes/`** — wireframe HTMLs (currently holds the 7F canonical plus an earlier iteration)

### Lifecycle Rules

**Warm-one-phase rule:** the most recently completed phase doc stays at top-level `docs/` until the next phase ships (and remains in PK per Section 4's working set). Recent phase decisions are usually still active references during the early work on the next phase. When Phase N+1 ships, Phase N is removed from both layers in one transition — archived to `docs/archive/phases/` in the repo and deleted from PK.

**Clean-break rule (new in v5.0):** the archive is populated from 2026-04-21 forward. **Historical artifacts consumed before that date — old CC prompts, old handoffs, early session logs — were not backfilled from PK.** The clean break keeps the archive focused on active preservation rather than becoming a digital attic of everything that ever existed.

**When to archive:**
- A phase ships → the phase doc moves to `phases/` at the next phase boundary (per warm-one rule)
- A CC prompt is consumed and its outcomes are absorbed into the relevant phase doc → prompt moves to `prompts/` in a separate commit from the absorption
- A handoff doc is absorbed into living docs → moves to `handoffs/`
- A session log rolls over at a phase boundary → the old log is archived, a fresh one starts

**When NOT to archive:**
- Don't archive something that's still actively referenced in a current phase doc. Wait until the references are cleaned up or the containing phase ships.
- Don't archive a CC prompt before its SESSION_LOG entry has been reconciled into the relevant phase doc.

**Deleting from PK after archiving:** once the archive move is committed in the repo, the PK copy of that file is safe to delete. The archive is the preservation; PK just stops needing it.

### Naming Conventions Inside the Archive

- Phase docs: preserve the original filename (`PHASE_N_DOMAIN.md`)
- Handoffs: preserve original filename with date (`DOC_UPDATES_CONSOLIDATED_YYYY-MM-DD.md`)
- CC prompts: preserve original filename (`CC_PROMPT_YYYY-MM-DD_short-description.md`)
- Wireframes: when there are multiple versions, use a suffix — `_canonical`, `_earlier_iteration`, `_passN`, or a descriptive label

---

## 7. Living Docs Ownership

| Doc | Owner | Edited by |
|---|---|---|
| `PROJECT_CONTEXT.md` | Claude.ai | Claude.ai directly, or via targeted CC prompts |
| `FRIGO_ARCHITECTURE.md` | Claude.ai | Claude.ai via CC prompts (requires reading current code) |
| `FF_LAUNCH_MASTER_PLAN.md` | Claude.ai | Claude.ai directly, or via targeted CC prompts |
| `DEFERRED_WORK.md` | Claude.ai | Claude.ai at phase-completion reconciliations |
| `DOC_MAINTENANCE_PROCESS.md` | Claude.ai | Claude.ai directly |
| `PROCESS_WATCHPOINTS.md` | Claude.ai | Claude.ai directly, typically at oversight passes or when introducing new process mechanics |
| `CLAUDE.md` (repo root) | Claude.ai | Claude.ai via CC prompts; CC-facing mirror (Claude.ai uses `DOC_MAINTENANCE_PROCESS.md` directly as the canonical source) |
| Active phase doc | Claude.ai | Claude.ai every planning session |
| `SESSION_LOG.md` | Claude Code | CC writes; no one else writes |

**CC never authors strategic content.** CC can apply specific edits — add this row to this table, insert this section before that one, update this header's metadata — but it does not decide *what* the edits should say. Strategic content originates in Claude.ai planning and flows to CC as explicit instructions.

Reference specs (e.g., `CONCEPT_FLEXIBLE_MEAL_PLANNING.md`, `SHARED_PANTRIES_FEATURE_SPEC.md`) are Claude.ai-owned but updated only when their relevant phase becomes active. They're not in the table above because they don't get touched during normal operation — they sit as frozen design references until we're building them.

**CC-facing files promoted to PK** (currently `CLAUDE.md`) must include audience framing so Claude.ai instances reading them from PK don't mistake CC-directed rules for their own. Required elements:

- A top-of-file italic block identifying the intended reader and directing non-CC readers to the canonical source
- An audience-scope reminder at the top of any mirrored rules section, restating that the rules apply to CC only

`CLAUDE.md` is the current exemplar — see its top-of-file block and the opener to its Standing Rules section. Apply the same pattern to any future CC-facing file promoted to PK.

---

## 8. SESSION_LOG Conventions

**Location:** `docs/SESSION_LOG.md`
**Owner:** Claude Code. Claude.ai reads; Claude.ai does not write.
**Archival:** at phase completion, the current log is renamed to `docs/archive/session_logs/_SESSION_LOG_PHASE{N}.md` and a fresh `SESSION_LOG.md` starts.

**Entry format:**

```markdown
## YYYY-MM-DD — [Phase/area] [Short description]
**Phase:** [phase identifier, or "cross-cutting"]
**Prompt from:** [CC_PROMPT filename, or "Claude.ai direct"]

[Body: what was done, files touched, verification results, surprises/notes]

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md`: [specific update needed, or "none"]
- `DEFERRED_WORK.md`: [specific update needed, or "none"]
- `PROJECT_CONTEXT.md`: [specific update needed, or "none"]
- `FF_LAUNCH_MASTER_PLAN.md`: [specific update needed, or "none"]

**Recommended next steps for Tom:**
[...]

**Surprises / Notes for Claude.ai:**
[...]
```

**Key rules:**
- **One entry per prompt execution, not per commit.** A prompt that produces three commits gets one SESSION_LOG entry that lists all three.
- **Include the `git status` snapshot for any non-trivial file operation.** Especially renames, moves into archive, and `_pk_sync/` staging.
- **Include verification results explicitly.** "Done" is not verification. "`git ls-files docs/archive/phases/PHASE_6_COOKING_MODE.md` returns the path" is verification.
- **Flag discrepancies between prompt assumptions and actual state.** If the prompt says "the file is at X" and it's actually at Y, stop and note it rather than improvising.
- **Always include the "Recommended doc updates" block.** List each living doc explicitly, even if "none." Forces active consideration rather than implicit skipping; makes doc-cascade misses visible to Claude.ai during reconciliation.
- **Flag PK snapshot staleness.** Before writing the SESSION_LOG entry, open `docs/PK_CODE_SNAPSHOTS.md` and check each file you edited this session against its Tier 1–3 tables. For each matching file: (a) append `⚠️ PK snapshot now stale (was YYYY-MM-DD)` to the file's line in the SESSION_LOG entry's "Files modified" section, using the Snapshot Date column from the tracking doc as `YYYY-MM-DD`; (b) update that file's row in `PK_CODE_SNAPSHOTS.md`, setting the Staleness Risk column to HIGH. If no edited files match, no action needed. Read the tracking doc fresh each session — do not work from memory of its contents. This rule is mirrored in `CLAUDE.md` Rule E so it triggers automatically regardless of whether the prompt reminds CC.

---

## 9. Patterns for CC Prompts

The following patterns have accumulated in recent work. New patterns get added here as they're established.

### Console.warn instrumentation (established 2026-04-15)

When CC ships editing or mutation affordances (overflow menu items, inline edits, modal-driven writes), the prompt should instruct CC to add temporary `console.warn` instrumentation that logs:

- Operation name
- Key inputs
- Success or failure result

Prefix each log with a `[ScreenName]` tag. Example: `console.warn('[CookDetailScreen] updatePost', { postId, patch, result })`.

This enables Tom to see what happened during on-device testing without needing to reproduce bugs from code-reading alone.

**Lifecycle:** instrumentation is temporary. It gets removed during the cleanup pass at the end of a sub-phase, or when a later sub-phase replaces the editing scaffolding. CC should not leave console.warn calls behind after the feature ships to F&F.

### `_pk_sync/` staging for living-doc edits (established 2026-04-21)

When a CC prompt edits a living doc, the prompt should also instruct CC to drop a copy in `_pk_sync/FILENAME.md` so Tom can upload to PK after reviewing the repo commit. Skipping the `_pk_sync/` step means PK drifts from the repo until someone notices.

### File-state verification before git operations (established 2026-04-21)

When a prompt is about to `git mv` a file, it should first check the file's tracking state:

```bash
git ls-files --error-unmatch path/to/file
```

If tracked → `git mv`. If untracked or in a deleted state → plain `mv` + `git add`. **Never assume tracking state from filename heuristics.** CC has been burned by this: a file that "looks tracked" may have been untracked since an earlier rename, and `git mv` on an untracked file fails silently in some shells.

### STOP-if-not-findable constraints (established 2026-04-21)

When a prompt depends on external source content — a file Tom dropped in, a PK upload, a specific artifact in `_pk_sync/` — the prompt should explicitly say:

> If the source is missing, STOP and report. Do not improvise.

This prevents silent data loss when an assumption doesn't hold. CC's default tendency is to keep going and produce *something*; the explicit STOP instruction overrides that.

### Do-not-decide constraints on mechanical prompts (established 2026-04-21)

When the prompt is mechanical — move these files, rename these columns, splice this block — explicitly forbid CC from making judgment calls about content. Example language:

> Do not attempt to decide which version is better or rename them based on content. Use the filenames specified in this prompt.

Tom or Claude.ai makes content judgments separately. CC's job on a mechanical prompt is to execute exactly as specified.

---

## 10. Phase Completion Checklist

When a phase ships, run this checklist in order. Steps 1–6 update living docs; 7–9 archive; 10–13 commit, upload, and prepare the next phase; 14 is a recommended oversight closeout.

1. Mark the phase status **✅ Complete** in the phase doc header.
1a. **Refresh PK code snapshots.** Run `docs/CC_PROMPTS/refresh_pk_code_snapshots.md`. Upload the regenerated `_pk_sync/code/` contents to PK, replacing stale copies. Update `PK_CODE_SNAPSHOTS.md` with new snapshot dates — the refresh resets all Staleness Risk columns to Low. This catches the full-phase case; sub-phase boundary refreshes happen outside this checklist but follow the same process.
2. Reconcile deferred items: resolved items dropped, remaining items moved to `DEFERRED_WORK.md` under a new "From: Phase N" section.
3. Update `DEFERRED_WORK.md` changelog with the version bump.
4. Update `PROJECT_CONTEXT.md`: flip phase status to ✅ Complete in the Project Vision table, add a "What Works" subsection describing the shipped capability, add a Changelog row.
5. Update `FF_LAUNCH_MASTER_PLAN.md`: mark the phase complete in the phase table, add a Changelog row.
6. Update `FRIGO_ARCHITECTURE.md`: add a Recent Breaking Changes entry if any architectural changes landed, update file references, add a Changelog row.
7. **Archive the previous warm phase doc** — the one that was sitting at top-level `docs/` before this one shipped — by moving it to `docs/archive/phases/`.
8. **Archive `SESSION_LOG.md`** — rename the current log to `docs/archive/session_logs/_SESSION_LOG_PHASE{N}.md` and start a fresh `SESSION_LOG.md`.
9. Archive any consumed CC prompts that were specific to this phase (`docs/archive/prompts/`).
10. Commit all of the above — split across multiple commits for clarity if the changes are large.
11. Upload updated living docs via `_pk_sync/` to PK, replacing the stale copies.
12. Update the project custom instructions if the active phase pointer needs to change (e.g., "Phase 8" → "Phase 9").
13. Create the next phase doc scaffold, or confirm it already exists, before the next planning session.
14. **Recommended: schedule a phase-boundary oversight pass.** A fresh Claude.ai instance, declared as an oversight session, reviews the completed phase doc, updated living docs, and the last ~10 SESSION_LOG entries. Reports alignment between decisions and execution, cross-cutting concerns that were missed, and recommended focus for the next phase. Review the report before Phase N+1 kickoff when scope warrants — not a hard gate.

---

## 11. Weekly Sync

Light-touch weekly review. Check that the active phase doc's progress matches the actually-shipped work, scan `DEFERRED_WORK.md` for items that have become irrelevant, and confirm `SESSION_LOG.md` is being written cleanly. No changes from v4.1.

---

## 12. Feature Playbook Convention

When a feature accumulates **≥2 design iterations** or significant testing feedback, create or update a playbook in `docs/playbooks/`. Playbooks capture distilled design decisions for a single feature in one place — useful when the feature's design history is scattered across multiple phase docs or session logs. No changes from v4.1.

---

## 13. Naming Conventions

Consolidated here in v5.0. Individual sections above repeat the relevant subset; this section is the authoritative reference.

- **CC prompts:** `CC_PROMPT_YYYY-MM-DD_short-description.md`
- **Phase docs:** `PHASE_N_DOMAIN.md` where N is the phase number and DOMAIN is 2–4 words in `SNAKE_UPPER` (e.g., `PHASE_8_PANTRY_INTELLIGENCE.md`)
- **Sub-phase letters:** when a phase splits into sub-phases, use lowercase letters — `7A`, `7B`, ..., `7M`, `7N`
- **Archive files:** preserve original names; do not re-stamp with the archive date
- **Session logs:** live as `docs/SESSION_LOG.md`; archived as `docs/archive/session_logs/_SESSION_LOG_PHASE{N}.md`
- **Design decision docs:** `PHASE_{phase-id}_DESIGN_DECISIONS.md` (e.g., `PHASE_7F_DESIGN_DECISIONS.md`)
- **Wireframe HTMLs:** `frigo_phase_{phase-id}_wireframes[_optional-suffix].html`
- **Living docs in repo:** canonical name, no suffix (`docs/PROJECT_CONTEXT.md`)
- **Living docs in `_pk_sync/` and PK:** canonical name + ISO date stamp matching the file's `Last Updated` header (`PROJECT_CONTEXT_2026-04-21.md`)

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-22 | 5.1 | **Code snapshots in PK codified.** Partially reverses the v5.0 "no code in PK" rule by introducing a curated, dated, tiered snapshot set (Tier 1–3: services/utils/constants, screens/key components, supporting components/navigation). PK snapshots are explicitly non-canonical — every file carries a snapshot header surfacing its date. **Dual staleness signaling** introduced: SESSION_LOG entries flag PK snapshot drift in real time when CC edits a tier-listed file (so Tom sees the signal at copy-paste-to-Claude.ai), and CC bumps the file's Staleness Risk column in `PK_CODE_SNAPSHOTS.md` to HIGH in the same execution (persistent record). The flagging behavior is triggered via `CLAUDE.md` Rule E (added same day) so it survives across CC sessions without prompt-level reminders. Refresh cadence: sub-phase boundaries (standard, via standing CC prompt at `docs/CC_PROMPTS/refresh_pk_code_snapshots.md`), mid-phase on-demand, and phase completion (mandatory — new checklist step 1a; a successful refresh resets all Staleness Risk columns to Low). Mid-session, when current file state is needed, Tom uploads directly via `/mnt/user-data/uploads/` or fires a targeted CC recon prompt. Tracking doc at `docs/PK_CODE_SNAPSHOTS.md`. `_pk_sync/code/` subfolder introduced for batch staging. |
| 2026-04-21 | 5.0 | **Full rewrite for repo-as-canonical workflow.** New sections: Claude.ai Session Types (phase planning / cross-cutting / oversight, with session-opening declaration, chat title convention, instance-proposed clarification when type isn't declared, and explicit allowance for untyped ad-hoc chats), Where Everything Lives (PK vs Repo vs Drive), `_pk_sync/` Workflow Folder (dated filenames in `_pk_sync/` and PK matching each file's `Last Updated` header so stale PK copies are visible at a glance), Archive Structure + Lifecycle, Naming Conventions, expanded Patterns for CC Prompts. Updated sections: Planning → Execution → Reconciliation Loop (adds downstream doc-update flagging), SESSION_LOG Conventions (adds "Recommended doc updates" block to entry format), Phase Completion Checklist (adds archive steps, `_pk_sync/` uploads, custom instructions update, recommended phase-boundary oversight pass). `CLAUDE.md` promoted to living-doc status and PK-resident so Claude.ai can audit it against this doc for drift; CC-facing audience framing pattern codified in Section 7. `PROCESS_WATCHPOINTS.md` introduced as a retrospective working doc for monitoring whether the v5.0 process is doing what we hoped. Retired guidance assuming PK is canonical. |
| 2026-04-21 | 4.1 | Absorbed console.warn instrumentation pattern note from `DOC_UPDATES_CONSOLIDATED_2026-04-15.md` Section 7 into a new Patterns for CC Prompts section. Pending full rewrite. |
| 2026-03-05 | 4.0 | **Session log archival protocol.** At phase completion, session log is renamed to `_SESSION_LOG_PHASE{N}.md` and a fresh log is created. Phase doc template gains "Features Delivered (Roadmap Mapping)" and "Session Log Archive" sections. Phase Completion checklist updated with archival step (was step 5 "Archive phase doc", now step 3 "Archive session log" — phase doc stays in project knowledge with archive reference). Naming conventions updated. |
| 2026-03-02 | 3.2 | Initial version in project knowledge. Established planning/execution/reconciliation loop, doc ownership table, SESSION_LOG format, phase doc template, weekly sync checklist. |

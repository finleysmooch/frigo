# Frigo — Documentation Maintenance Process
**Last Updated:** April 21, 2026  
**Version:** 4.1

---

## The System in One Paragraph

Claude.ai is the planning brain — it makes decisions, maintains the **active phase doc** in project knowledge, and generates prompts for Claude Code. Claude Code is the execution hands — it builds things and reports back via **SESSION_LOG** in the repo, including recommendations for doc updates. Claude.ai reads the session log, reconciles execution results into the phase doc, and updates other living docs. At **weekly sync**, everything gets brought current. When a phase completes, deferred items get **reconciled** into the master backlog and the session log gets **archived** into the phase doc.

---

## The Planning → Execution → Reconciliation Loop

```
┌─────────────────────────────────────────────────────────┐
│  CLAUDE.AI (planning brain — owns all living docs)      │
│                                                         │
│  1. DECIDE — Design and architecture decisions          │
│     → Write into active phase doc                       │
│                                                         │
│  2. DELEGATE — Generate Claude Code prompts             │
│     → Include full context, constraints, decisions      │
│                                                         │
│  3. RECONCILE — Read SESSION_LOG after execution        │
│     → Update phase doc with progress + new decisions    │
│     → Act on doc update recommendations                 │
│     → Update ARCHITECTURE, PROJECT_CONTEXT as needed    │
│                                                         │
└──────────────┬──────────────────────────▲───────────────┘
               │ prompts                  │ SESSION_LOG
               ▼                          │
┌─────────────────────────────────────────────────────────┐
│  CLAUDE CODE (execution hands — writes only SESSION_LOG)│
│                                                         │
│  4. EXECUTE — Build what was asked                      │
│     → Read ARCHITECTURE for context                     │
│     → Read DEFERRED_WORK only if prompt references it   │
│     → Write SESSION_LOG: what happened, decisions,      │
│       deferred items, recommended doc updates           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Doc Ownership

| Doc | Owner | Claude Code | Updated When |
|-----|-------|-------------|--------------|
| **Active phase doc** | Claude.ai | — (receives goals via prompts) | During planning + reconciliation |
| **SESSION_LOG** | Claude Code | ✍️ Writes entries | After every execution session |
| **FRIGO_ARCHITECTURE** | Claude.ai | 📖 Reads for context | Weekly sync (based on SESSION_LOG recommendations) |
| **PROJECT_CONTEXT** | Claude.ai | 📖 Reads for context | Weekly sync or at phase completion |
| **DEFERRED_WORK** | Claude.ai | 📖 Only if referenced in prompt | At phase completion (reconciliation from phase doc) |

**Key principle:** Claude Code reads ARCHITECTURE for context every session but never edits living docs. It reads DEFERRED_WORK only when the Claude.ai prompt references specific items. It flags what needs updating via SESSION_LOG recommendations. Claude.ai makes all doc edits with full context of why changes matter.

---

## Where Everything Lives

### Claude.ai Project Knowledge — Planning home (Claude.ai reads and writes)
| File | Purpose | Updated |
|------|---------|---------|
| **Active phase doc** | Current phase: goals, decisions, progress, deferred items | During planning + after reconciliation |
| `PROJECT_CONTEXT.md` | Onboarding: what Frigo is, what works, what's next | Weekly sync or at phase completion |
| `FRIGO_ARCHITECTURE.md` | Codebase map, data model, patterns (copy from repo) | Weekly sync |
| `DEFERRED_WORK.md` | Master backlog (copy from repo) | At phase completion |
| `DOC_MAINTENANCE_PROCESS.md` | This document | When process changes |
| Feature specs | MEALS_*, SHARED_PANTRIES_*, etc. | Rarely |
| Active plan docs | NUTRITION_UI_PROJECT_PLAN, etc. | Per phase |
| Code files (.tsx, .ts) | Latest source copies | After significant changes |
| DB schema CSVs | Supabase snapshots | After migrations |
| Archived session logs | `_SESSION_LOG_PHASE{N}.md` — historical reference | At phase completion |

### Repo (`docs/`) — Execution home (Claude Code reads; writes only SESSION_LOG)
| File | Purpose | Updated |
|------|---------|---------|
| `_SESSION_LOG.md` | Current phase execution reports | After every Claude Code session |
| `_SESSION_LOG_PHASE{N}.md` | Archived session logs from completed phases | At phase completion (renamed from active log) |
| `FRIGO_ARCHITECTURE.md` | Codebase map (canonical copy) | By Tom after Claude.ai produces updates |
| `DEFERRED_WORK.md` | Master backlog (canonical copy) | By Tom after phase completion reconciliation |
| `README.md` | Index of docs/ | When files added |
| `doc-ecosystem.html` | Visual doc map (for Tom) | Occasionally |
| `CLAUDE.md` (repo root) | Claude Code instructions | When conventions change |

**Repo → Project Knowledge sync:** Tom pushes Claude.ai's updates to the repo copies of ARCHITECTURE and DEFERRED_WORK. These are the canonical copies; project knowledge has duplicates for Claude.ai access.

### External (Google / Notion)
| Tool | Purpose | Updated |
|------|---------|---------|
| **Notion** | Product roadmap, feature priorities | When starting/completing phases |
| **FRIGO_TRACKER** (Sheets) | Shipped code log | After commits / weekly sync |
| **Claude Shared Reference** (Docs) | Annotated DB schema | After migrations |

### Should NOT be in project knowledge
- Multiple versions of the same doc (only keep current)
- Old code file versions (only keep latest)
- Superseded handoff docs (already distilled)

---

## During Sessions

### Claude.ai Planning Sessions
1. **Read** the active phase doc and relevant context (ARCHITECTURE, specs, code files)
2. **Make decisions** → write them into the phase doc immediately
3. **Generate Claude Code prompts** when execution is needed (see Prompt Format below)
4. **After Claude Code runs**, read SESSION_LOG and reconcile:
   - Update phase doc with execution results
   - Act on recommended doc updates (ARCHITECTURE, etc.)
   - Capture new deferred items in phase doc
   - Update goal status

### Claude Code Execution Sessions
1. **Read** `CLAUDE.md`, `docs/FRIGO_ARCHITECTURE.md`, and the prompt from Claude.ai
2. **Read** `docs/DEFERRED_WORK.md` only if the prompt references specific items from it
3. **Execute** the work
4. **Write a detailed SESSION_LOG entry** (see format below — this is the critical handoff)
5. **Do not edit** ARCHITECTURE, DEFERRED_WORK, or other living docs

---

## SESSION_LOG Entry Format

The session log is the contract between Claude Code and Claude.ai. Entries must be detailed enough for Claude.ai to update all living docs without guessing.

```markdown
### YYYY-MM-DD — [Brief Title]
**Phase:** [which phase, or "cross-cutting"]
**Prompt from:** [brief description of what Claude.ai asked for]

**Files created:**
- [file] — [purpose and key design choices]

**Files modified:**
- [file] — [what changed and why]

**DB changes:** [migrations, schema changes, or "none"]

**Decisions made during execution:**
- [Decision]: [Why — especially anything not specified in the prompt]

**Deferred during execution:**
- [Item]: [Why deferred, what would be needed]

**Recommended doc updates:**
- ARCHITECTURE: [what to add/change and why it matters]
- DEFERRED_WORK: [any items that should be tracked]
- PROJECT_CONTEXT: [any changes to "what works" or known issues]

**Status:** [What's working, what needs testing, blockers]

**Surprises / Notes for Claude.ai:**
- [Anything unexpected that affects planning]
```

The **"Recommended doc updates"** section is where Claude Code flags what it knows from the implementation that Claude.ai should incorporate. Claude Code has the implementation detail; Claude.ai has the big-picture context to write the update well.

---

## Active Phase Doc Template

Lives in Claude.ai project knowledge. One active at a time.

```markdown
# Phase N: [Name]
**Notion features:** #XX, #YY
**Started:** [date]
**Status:** 🔨 Active

---

## Goals
[What this phase is trying to accomplish — success criteria]

## Features Delivered (Roadmap Mapping)
Map completed work to Product Feature Roadmap entries at phase completion.
| Roadmap # | Feature | Status Before | Status After | Notes |

## Plan
[Approach, components needed, dependencies. Updated as decisions are made.]

## Decisions Log
| Decision | Rationale | Date | Origin |
|----------|-----------|------|--------|
| [decision] | [why] | [date] | Planning / Execution |

Origin tracks whether the decision was made during planning (Claude.ai) or
surfaced during execution (Claude Code via SESSION_LOG).

## Progress
Updated after each Claude Code session via reconciliation.

### [Date] — [Brief title]
**What was done:** [summary from SESSION_LOG]
**SESSION_LOG ref:** [date and title of entry]
**Deviations from plan:** [anything that went differently]
**Status:** [what works, what needs testing]

## Deferred Items
Items punted during this phase. Reviewed and reconciled into
DEFERRED_WORK.md at phase completion.

| Item | Type | Origin | Notes |
|------|------|--------|-------|
| [description] | 🐛/💡/🔧/🚀 | [session date] | [context] |

## Files Changed (cumulative)
**New:** [file — purpose]
**Modified:** [file — what changed]
**DB/Supabase:** [migrations, schema changes]

## Session Log Archive
[Added at phase completion]
All session log entries archived in `docs/_SESSION_LOG_PHASE{N}.md`.

## Claude Code Prompts Issued
Optional — summarize key prompts for traceability.
```

---

## How Claude.ai Generates Claude Code Prompts

When Claude.ai needs execution, produce a prompt with:

1. **Context:** What phase, what's been decided, relevant constraints
2. **Task:** Specific build instructions
3. **Constraints:** Decisions already made — don't re-decide these
4. **Watch for:** Known risks or edge cases to flag in SESSION_LOG
5. **SESSION_LOG reminder:** "Write a detailed SESSION_LOG entry including decisions made, anything deferred, and recommended doc updates."

Example:
```
## Context
Phase 4 (Cooking Stats Dashboard). We've decided on weekly aggregation
for streak calculation using ISO week numbers.

## Task
Create statsService.ts with:
- getCookingFrequency(userId, dateRange) → weekly counts
- getCookingStreak(userId) → current and longest streak

## Constraints
- Use ISO weeks (Monday start), not calendar weeks
- Query posts table directly, no new aggregation table
- Follow existing service patterns (see pantryService.ts)

## Watch for
- Month boundary edge cases — note specifics in SESSION_LOG
- Performance with 1,740 test posts — flag if queries > 500ms

## After completion
Write a detailed SESSION_LOG entry. Include decisions you made,
anything deferred, and recommended updates to ARCHITECTURE or
other docs.
```

---

## Weekly Sync (30 min)

Start a Claude.ai session with:

```
Weekly sync time. Please:
1. Here are SESSION_LOG entries since last sync: [paste]
2. Read the active phase doc and PROJECT_CONTEXT
3. Reconcile any unprocessed SESSION_LOG entries into the phase doc
4. Act on any recommended doc updates (ARCHITECTURE, etc.)
5. Update PROJECT_CONTEXT if what works / known issues / metrics changed
6. Flag anything in project knowledge to remove
```

### Checklist

**1. Gather inputs** (5 min)
- Copy unprocessed SESSION_LOG entries from repo
- Note any Claude.ai sessions since last sync

**2. Reconcile into phase doc** (10 min)
- Incorporate SESSION_LOG entries not yet reflected
- Update progress, decisions, deferred items

**3. Update living docs** (10 min)
- **ARCHITECTURE** — act on Claude Code's recommended updates
- **PROJECT_CONTEXT** — "What Works", "Known Issues", "What's Next", metrics

**4. Sync** (5 min)
- Upload updated docs to project knowledge
- Upload new/modified code files
- Push ARCHITECTURE updates to repo
- Remove outdated files from project knowledge

**5. Tracking + git** (5 min)
- Update FRIGO_TRACKER
- Clear processed SESSION_LOG entries

---

## Phase Completion

### 1. Finalize the phase doc
- Add final progress entry, mark ✅ Complete with date
- Add "Features Delivered (Roadmap Mapping)" section — map completed work to Product Feature Roadmap entries

### 2. Reconcile deferred items
Review the phase doc's "Deferred Items":
- **Resolved?** → Remove
- **Still relevant?** → Move to `docs/DEFERRED_WORK.md` under "From: Phase N"
- **Not worth tracking?** → Drop

Push updated DEFERRED_WORK.md to repo. Upload copy to project knowledge.

### 3. Archive session log
- Rename `docs/_SESSION_LOG.md` → `docs/_SESSION_LOG_PHASE{N}.md`
- If the log spans multiple phases, note this in the archive file header
- Create fresh `docs/_SESSION_LOG.md` with just the header template
- Add archive reference in the completed phase doc ("Session log archived in `docs/_SESSION_LOG_PHASE{N}.md`")
- Upload archived log to Claude.ai project knowledge alongside the phase doc

### 4. Update FRIGO_ARCHITECTURE
- Add new services, screens, components, patterns from this phase
- Push to repo

### 5. Update PROJECT_CONTEXT
- Phase → ✅ Complete in Project Vision table
- Update "What Works", "Known Issues", "What's Next", metrics

### 6. External tools
- **Notion:** Mark features shipped, add new ideas
- **FRIGO_TRACKER:** Ensure all code logged

### 7. Start next phase
- Create new active phase doc from template
- Seed with goals from plan docs + Notion
- Upload to project knowledge

---

## Naming Conventions

- **Living docs (no date):** `FRIGO_ARCHITECTURE.md` — overwrite in place
- **Active phase doc:** `PHASE_4_COOKING_STATS.md` — descriptive name
- **Dated snapshots:** `PROJECT_CONTEXT_02MAR26.md` — date when replacing in project knowledge
- **Session log (active):** `_SESSION_LOG.md` — single rolling file, newest entries at top
- **Session log (archived):** `_SESSION_LOG_PHASE4.md` — archived at phase completion, may span multiple phases if logged together
- **Code files in project knowledge:** Repo filename, latest version only

---

## Information Flow Summary

```
PLANNING (Claude.ai):
  Decisions → active phase doc
  Execution needs → Claude Code prompts (with full context)

EXECUTION (Claude Code):
  Reads: ARCHITECTURE, CLAUDE.md, prompt (+ DEFERRED_WORK only if prompt references it)
  Writes: SESSION_LOG only (with doc update recommendations)

RECONCILIATION (Claude.ai, after execution):
  SESSION_LOG → phase doc (progress, decisions, deferred)
  SESSION_LOG recommendations → ARCHITECTURE, CONTEXT, etc.

WEEKLY SYNC (Claude.ai):
  Unprocessed SESSION_LOG + phase doc → all living docs current
  Updated docs → project knowledge + repo

PHASE COMPLETION (Claude.ai):
  Phase doc finalized (features delivered, deferred reconciled)
  Session log archived → _SESSION_LOG_PHASE{N}.md
  Phase doc deferred items → DEFERRED_WORK (reconciled)
  Phase summary → PROJECT_CONTEXT
  New patterns → ARCHITECTURE
  Shipped features → Notion
```

---

## Patterns for CC Prompts

### Console.warn instrumentation (added 2026-04-15)

When CC ships editing or mutation affordances (overflow menu items, inline edits, modal-driven writes), the prompt should instruct CC to add temporary `console.warn` instrumentation that logs:

- Operation name
- Key inputs
- Success or failure result

Prefix each log with a `[ScreenName]` tag. Example: `console.warn('[CookDetailScreen] updatePost', { postId, patch, result })`.

This enables Tom to see what happened during on-device testing without needing to reproduce bugs from code-reading alone.

**Lifecycle:** instrumentation is temporary. It gets removed during the cleanup pass at the end of a sub-phase, or when a later sub-phase replaces the editing scaffolding. CC should not leave console.warn calls behind after the feature ships to F&F.

*(Absorbed 2026-04-21 from `DOC_UPDATES_CONSOLIDATED_2026-04-15.md` Section 7. Preserved here pending the full DOC_MAINTENANCE_PROCESS rewrite.)*

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-21 | 4.1 | Absorbed console.warn instrumentation pattern note from DOC_UPDATES_CONSOLIDATED_2026-04-15.md Section 7 into a new Patterns for CC Prompts section. Pending full rewrite. |
| 2026-03-05 | 4.0 | **Session log archival protocol.** At phase completion, session log is renamed to `_SESSION_LOG_PHASE{N}.md` and a fresh log is created. Phase doc template gains "Features Delivered (Roadmap Mapping)" and "Session Log Archive" sections. Phase Completion checklist updated with archival step (was step 5 "Archive phase doc", now step 3 "Archive session log" — phase doc stays in project knowledge with archive reference). Naming conventions updated. |
| 2026-03-02 | 3.2 | Initial version in project knowledge. Established planning/execution/reconciliation loop, doc ownership table, SESSION_LOG format, phase doc template, weekly sync checklist. |
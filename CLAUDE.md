# Frigo - Project Context for Claude Code
**Last Updated:** April 22, 2026

*Entry point for Claude Code sessions. Read by CC at the start of every session. If you are a Claude.ai instance reading this from PK, you're reading it to audit for drift against `DOC_MAINTENANCE_PROCESS.md` — the rules inside are for CC, not for you. Claude.ai follows `DOC_MAINTENANCE_PROCESS.md` directly as the canonical source.*

## What is Frigo?
Frigo is a "Strava for cooking" mobile app - users track their cooking, manage pantries, discover recipes, and share with friends.

## Tech Stack
- **Frontend:** React Native + Expo + TypeScript
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **AI:** Claude API for recipe extraction from photos/URLs
- **State:** React Context (SpaceContext, etc.)

---

## Documentation System

### What to read every session
1. **This file** (CLAUDE.md) — conventions, instructions, Standing Rules, tracker format
2. **docs/FRIGO_ARCHITECTURE.md** — codebase map, services, patterns, domain boundaries

### What to read only when referenced in the prompt
3. **docs/DEFERRED_WORK.md** — master backlog (only if the prompt references specific items)

### What to write
4. **docs/SESSION_LOG.md** — Write a detailed entry after every session (format below)

### Editing living docs
- **Default: don't edit living docs.** Flag recommended changes in your SESSION_LOG entry under "Recommended doc updates" — Claude.ai will reconcile.
- **Exception: when a prompt explicitly instructs you to edit a living doc** (e.g., "apply this PROJECT_CONTEXT update spec"), follow the propagation pattern in `docs/DOC_MAINTENANCE_PROCESS.md` Section 4:
  1. Edit the file in `docs/` and update its `**Last Updated:**` header to today's date
  2. Stage a dated copy at `_pk_sync/FILENAME_YYYY-MM-DD.md` so Tom can upload to PK after reviewing
- **Living docs for this purpose:** `PROJECT_CONTEXT.md`, `FRIGO_ARCHITECTURE.md`, `FF_LAUNCH_MASTER_PLAN.md`, `DEFERRED_WORK.md`, `DOC_MAINTENANCE_PROCESS.md`, the active phase doc, and **this file (`CLAUDE.md`)** — CLAUDE.md lives at repo root (not `docs/`) but follows the same propagation rules so Claude.ai can audit it for drift against `DOC_MAINTENANCE_PROCESS.md`.
- **Never edit a living doc on CC's own initiative** — only when the prompt explicitly authorizes it.

### SESSION_LOG Entry Format

See `docs/DOC_MAINTENANCE_PROCESS.md` Section 8 for the canonical entry format — header level (H2 `## YYYY-MM-DD`), mandatory "Recommended doc updates" block (list all four living docs explicitly, using "none" when nothing applies rather than omitting a doc), "Recommended next steps for Tom" block, and key rules (one entry per prompt execution, include `git status` for non-trivial file operations, verify rather than assert). Add new entries at the TOP of `docs/SESSION_LOG.md`.

### Key principles
- **Follow decisions/constraints from Claude.ai prompts** — don't re-decide things that have already been decided
- **Be detailed in SESSION_LOG** — Claude.ai depends on these entries to maintain all project documentation
- **When in doubt, flag it** — use "Recommended doc updates" and "Surprises" to surface anything Claude.ai should know

---

## Standing Rules

**These five rules apply to CC only.** Claude.ai instances reading this from PK should consult `docs/DOC_MAINTENANCE_PROCESS.md` directly rather than inferring behavior from this mirror. The Standing Rules below mirror DOC_MAINTENANCE_PROCESS Sections 4, 5, 7, 8, and 9 — update both places together when a rule changes; don't let them drift.

- **Rule A — Living doc propagation with dating.** When a prompt authorizes editing a living doc, update the `**Last Updated:**` header and stage a dated copy at `_pk_sync/FILENAME_YYYY-MM-DD.md`. Never edit living docs on your own initiative. Detail: DOC_MAINTENANCE_PROCESS Section 4 ("The Propagation Pattern") and Section 5.
- **Rule B — SESSION_LOG with Recommended doc updates.** Every session ends with a SESSION_LOG entry per the format in DOC_MAINTENANCE_PROCESS Section 8, including the "Recommended doc updates" block listing all four living docs (`FRIGO_ARCHITECTURE.md`, `DEFERRED_WORK.md`, `PROJECT_CONTEXT.md`, `FF_LAUNCH_MASTER_PLAN.md`) explicitly — write "none" when nothing applies rather than omitting the doc. Detail: Section 8.
- **Rule C — Verify tracking state before `git mv`.** Run `git ls-files --error-unmatch <path>` before any `git mv`. If tracked, proceed with `git mv`; if untracked or deleted, use plain `mv` + `git add`. Never infer tracking state from filename heuristics. Detail: Section 9 ("File-state verification before git operations").
- **Rule D — No strategic content authorship.** CC applies the edits specified in the prompt; CC does not decide what content should say. When a prompt requires a judgment call about content (filenames, structure, wording, what to preserve vs drop), STOP and report rather than improvising. Detail: Section 7 ("Living Docs Ownership") and Section 9 (STOP-if-not-findable + do-not-decide patterns).
- **Rule E — PK code-snapshot staleness flagging.** If this session edited any code files, before writing the SESSION_LOG entry: open `docs/PK_CODE_SNAPSHOTS.md` and check each edited file against its Tier 1–3 tables. For each match: (a) append `⚠️ PK snapshot now stale (was YYYY-MM-DD)` to that file's line in the SESSION_LOG entry's "Files modified" section, using the Snapshot Date column from the tracking doc; (b) update that file's row in `PK_CODE_SNAPSHOTS.md`, setting the Staleness Risk column to HIGH. If no edited files match, no action needed. Read the tracking doc fresh — do not work from memory of its contents. Exception: the standing refresh prompt at `docs/CC_PROMPTS/refresh_pk_code_snapshots.md` reads tier-listed files but does not edit them, so it does not trigger Rule E. Detail: DOC_MAINTENANCE_PROCESS Section 4 ("Code Snapshots in PK") and Section 8 (staleness-flag bullet in Key rules).

---

## Project Structure
```
frigo/
├── App.tsx                 # Main entry, navigation setup
├── screens/                # Screen components
├── components/             # Reusable components
│   └── modals/            # Modal components
├── contexts/              # React Context providers
│   └── SpaceContext.tsx   # Shared pantry spaces
├── lib/
│   ├── services/          # Business logic + Supabase calls
│   ├── types/             # TypeScript type definitions
│   └── theme.ts           # Theme constants
└── assets/                # Images, icons, fonts
```

## 8 Domains
All code maps to one of these domains:

| Domain | Scope |
|--------|-------|
| Recipe | Recipe CRUD, cookbooks, extraction, annotations |
| Cooking | Active cooking mode, timers, voice control |
| Planning | Meals, cook soon, calendar |
| Social | Feed, posts, comments, partners |
| Pantry | Inventory, spaces, expiration |
| Grocery | Lists, stores, regular items |
| Discovery | Search, filters, suggestions |
| Platform | Auth, navigation, settings, theme |

## Code Conventions
- Services handle ALL Supabase/database calls
- Components should NOT call Supabase directly
- Use TypeScript strictly - define types for everything
- Prefer simple solutions over clever ones
- Don't remove existing functionality unless asked
- Owner is learning React Native - explain non-obvious code

## Key Features (Built)
- ✅ Recipe management (add via photo, URL, manual)
- ✅ Pantry tracking with inline editing
- ✅ Grocery lists
- ✅ Cooking mode
- ✅ Social feed with posts
- ✅ Meal planning
- ✅ Shared Pantries (Spaces)
- ✅ Nutrition data + dietary badges
- ✅ Smart recipe browse (3 modes, expandable cards, 60 SVG icons)
- ✅ Test data seeded (1,740 posts, 17 users, full year)
- ✅ Stats dashboard with WeeklyChart (5 modes: meals, calories, protein, veg%, new/repeat)
- ✅ Stats Recipes page: Kitchen/Frontier sections, podium, bubble map, family ingredient chips
- ✅ Frontier Cards (worth exploring suggestions) + Gateway Card insights with period comparisons
- ✅ Nutrition page: Frigo color palette, macro summary cards, macro/secondary divider
- ✅ Insights page: Cooking Personality Card, Growth Timeline, diversity growth context, compact complexity

## Commands
```bash
npx expo start          # Start development
npx expo start --ios    # iOS simulator
npx expo start --android # Android emulator
```

---

## Tracker Row Generation

When asked to "generate tracker rows" after a commit, follow the spec in `docs/TRACKER_SPEC.md`.

**Quick reference:** 13 tab-separated columns → `docs/tracker_update.tsv`
```
EntryDate | File | Status | ReplacedBy | Domain | Type | Lines | CodeDate | Imports | Exports | Purpose | Changes | Notes
```

Read `docs/TRACKER_SPEC.md` for column definitions, path rules, examples, and the generation workflow.

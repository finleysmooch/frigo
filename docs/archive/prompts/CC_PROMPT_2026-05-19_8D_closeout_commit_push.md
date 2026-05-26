# CC Prompt — Phase 8D Close-out + 8E→Phase 11 Merge + Commit + Push

**Date:** 2026-05-19 (end of long session)
**Estimated:** ~45-60 minutes
**Authored by:** Claude.ai planning, 2026-05-19
**Purpose:** Close Phase 8D, merge the F&F subset of Phase 8E into Phase 11, update all status docs, create the new UX iterations log file, stage everything to `_pk_sync/`, then batch-commit and push the full day's work in 5 logical commits.

---

## Context

Today (2026-05-19) shipped four checkpoints: CP2 (4-level matcher), CP2-patch (substitution whitelist + null-form wildcard), CP3 (recipe tap-sheet + match% banner; CP5 bundled), CP4 (What-can-I-cook screen + RecipeList match wiring). Phase 8D is essentially complete pending a small cleanup pass (tomorrow).

Tom has made three product calls for this close-out:

1. **Merge 8E F&F items into Phase 11.** 8E-CP1 (Browse recipes rebuild), 8E-CP3 (Locked filter chips pattern), and 8E-CP4 (Low stock indicators #31) move from their own sub-phase into Phase 11's "Recipe Polish" scope. 8E-CP2 (Natural-language search) was already explicitly post-launch and stays there. Phase 11 estimate revises upward.

2. **F&F launch readiness criterion = Phases 8 through 12 complete.** The master plan already lists this sequence — this close-out makes the "8E merged" reality reflected in the readiness criterion explicitly.

3. **Begin pantry/grocery UX iteration work directly with CC, logged separately.** Tom will work with CC without going through Claude.ai planning for these iterations. Constraint: no architectural changes (no new services, no type extensions, no schema, no new components — only style, copy, spacing, and interaction tuning on existing surfaces). Logged to a new file `docs/UX_ITERATIONS_LOG.md`, NOT the main `SESSION_LOG.md`.

This prompt handles the close-out doc updates plus the commit + push of the full day's batch.

---

## Inputs to read

1. `docs/PHASE_8_PANTRY_AND_GROCERY.md` — find the 8E section; that's where the merge disposition lands
2. `docs/PROJECT_CONTEXT.md` — current phase status table
3. `docs/FF_LAUNCH_MASTER_PLAN.md` — phase sequence row, scope-cut lever, estimates
4. `docs/DEFERRED_WORK.md` — current state of 8E-related backlog items
5. `docs/SESSION_LOG.md` — today's entries; close-out goes at the end of today's `## 2026-05-19` section
6. Working tree state — run `git status` first to confirm what's modified before any commit work

---

## Task

Execute Part 0 → Part G in order. Stop and report if any commit step fails.

### Part 0 — Pre-flight check

Run `git status` and confirm the working tree contains all expected modifications from the day:

**Source files (modified):**
- `lib/services/pantryMatchingService.ts` (CP2, CP2-patch, CP3 changes)
- `lib/services/_pantryMatchingSmokeTest.ts` (CP2, CP2-patch, CP3, CP4 scenarios)
- `components/recipe/IngredientsSection.tsx` (CP2 4-state render, CP3 tap behavior)
- `screens/RecipeDetailScreen.tsx` (CP2 ingredientMatches, CP3 banner + modal lifts)
- `screens/RecipeListScreen.tsx` (CP4 matcher wiring)
- `screens/PantryScreen.tsx` (CP4 CTA)
- `App.tsx` (CP4 route)

**Source files (new):**
- `components/recipe/IngredientTapSheet.tsx` (CP3)
- `components/recipe/RecipeCard.tsx` (CP4)
- `lib/services/readyToCookService.ts` (CP4)
- `lib/hooks/useReadyToCookRecipes.ts` (CP4)
- `screens/WhatCanICookScreen.tsx` (CP4)

**Docs (modified — covers Part 0/CP2-patch/CP3/CP4 changes):**
- `docs/PHASE_8_PANTRY_AND_GROCERY.md`
- `docs/DEFERRED_WORK.md`
- `docs/FRIGO_ARCHITECTURE.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/FF_LAUNCH_MASTER_PLAN.md`
- `docs/SESSION_LOG.md`

**Docs (new):**
- `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` (CP2-patch)

**Staged in `_pk_sync/`:**
- All `_2026-05-19.md` copies of the above docs (7 files)

If `git status` shows anything unexpected (unrelated changes, missing files, etc.), **STOP and report**. Do NOT commit unrelated changes; if the working tree has cruft, Tom resolves before continuing.

### Part 1 — Doc updates for 8E→Phase 11 merge + Phase 8D close-out

#### 1A — `docs/FF_LAUNCH_MASTER_PLAN.md`

Find the **Phase 8E section** (titled something like "Phase 8E: Discovery polish" or "Phase 8E — Recipe discovery polish" — likely near the end of the Phase 8 section).

**Replace the 8E section heading and body** with a short transition note:

```markdown
### Phase 8E: Discovery polish — MERGED INTO PHASE 11

Per 2026-05-19 decision, the F&F-relevant 8E checkpoints (8E-CP1 Browse rebuild, 8E-CP3 Locked filter chips pattern, 8E-CP4 Low stock indicators #31) are absorbed into Phase 11's "Recipe Polish" scope. Phase 8E as a standalone sub-phase is retired.

8E-CP2 (Natural-language search) remains explicitly post-launch as previously documented — first post-launch feature shipped if the scope-cut lever is ever exercised.

Phase 11 estimate revises from 7-12 sessions to 9-15 sessions to absorb the merged work.
```

**Find the Phase 11 section** and update:

- The "Must have" list — append the three merged items:
  ```markdown
  - [must] **Browse recipes rebuild** (merged from 8E-CP1, 2026-05-19) — search + tiles + collapsed filter row. Replaces the current Recipes tab with the wireframe v5 design.
  - [must] **Locked filter chips pattern** (merged from 8E-CP3, 2026-05-19) — formalize the one-off locked chip currently in WhatCanICookScreen. Reusable component pattern applied to all filtered-subset surfaces (What-can-I-cook, Ingredient Detail Recipes tab post-F&F, Stats DrillDownScreen, etc.).
  - [must] **Low stock indicators (#31)** (merged from 8E-CP4, 2026-05-19) — ingredient-level low/critical chips on recipe tiles and detail rows. Uses the CP1 matching primitive's low/critical bucketing.
  ```

- The estimate line — change to: `**Estimated:** 9-15 sessions (was 7-12; +3 sessions for the merged 8E-CP1/CP3/CP4 work, 2026-05-19).`

**Find the phase-sequence row** at the top (or wherever the master plan summarizes phase status). Update Phase 8 status to `🟢 Complete pending cleanup pass`. Update Phase 8E status to `MERGED → Phase 11`. Update Phase 11 estimate per above.

**Find the time-to-F&F arithmetic** if present in this doc — update the 8E line to 0 sessions (merged) and Phase 11 line to 9-15 (was 7-12). Recompute build total. Calendar week estimate stays approximately the same (the work didn't disappear — it just moved phases).

**Changelog bump:** increment version (current is v6.6 per CP4); add a v6.7 entry: "2026-05-19 — 8E merged into Phase 11 (8E-CP1/CP3/CP4 → Phase 11 must-haves; 8E-CP2 stays post-launch). 8D marked essentially complete pending cleanup pass."

#### 1B — `docs/PHASE_8_PANTRY_AND_GROCERY.md`

Find the **Sub-phase overview table** near the top. Update:
- 8D row → status `✅ Complete pending cleanup pass`
- 8E row → status `MERGED → Phase 11` (or strikethrough the row entirely and add a note; whichever reads cleaner in the doc's existing style)

Find the **Phase 8E section** (if a substantive section exists in this doc). Replace its body with a short merge note matching the FF_LAUNCH_MASTER_PLAN treatment.

Update the doc header / last-updated line.

**Note:** the 8D-CP4 results subsection (added during CP4) already marks 8D as "essentially complete." Leave that wording but ensure it cross-references the cleanup-pass items: console.warn removal in IngredientTapSheet, T29 smoke realignment, PHASE_8D_PLANNING refresh, PK_CODE_SNAPSHOTS revert+refresh.

#### 1C — `docs/PROJECT_CONTEXT.md`

Find the phase table / status section. Update:
- 8D status flip from in-progress to ✅ Complete
- 8E entry → "MERGED → Phase 11"
- Update the "What works now" section if it references the recipe-pantry matching surfaces — should mention: 4-level matcher with whitelist (CP2 + patch), recipe tap-sheet + match banner (CP3), What-can-I-cook screen (CP4)

Changelog bump: increment from v10.6 to v10.7. Entry: "2026-05-19 — Phase 8D essentially complete (CP1→CP4 shipped). 8E merged into Phase 11."

#### 1D — `docs/DEFERRED_WORK.md`

The 8E items moving to Phase 11 may or may not have backlog rows already. Search for any items tagged as "8E" or "Phase 8E" and reclassify them as "Phase 11" with a note: "Merged from Phase 8E per 2026-05-19 decision."

If no existing 8E backlog items, add a note to the table or a section header indicating that 8E-CP1/CP3/CP4 work is now tracked in PHASE_8_PANTRY_AND_GROCERY.md and FF_LAUNCH_MASTER_PLAN.md Phase 11 sections.

Changelog bump: from v5.27 (per CP4) to v5.28. Entry: "2026-05-19 — 8E F&F items merged into Phase 11 (close-out reconciliation)."

#### 1E — `docs/SESSION_LOG.md`

Append a **Phase 8D close-out entry** at the end of today's `## 2026-05-19` section (after the CP4 entry):

```markdown
### Phase 8D close-out + 8E→Phase 11 merge

**Status:** Phase 8D essentially complete. CP1, CP1.5, CP2, CP2-patch, CP3, CP4 all shipped today (2026-05-19). Cleanup pass deferred to tomorrow (console.warn removal in IngredientTapSheet, T29 smoke harness realignment, PHASE_8D_PLANNING.md pre-8R framing refresh, PK_CODE_SNAPSHOTS.md revert+refresh — ~30-60 min total).

**8E disposition:** Sub-phase retired. F&F-relevant checkpoints (8E-CP1 Browse rebuild, 8E-CP3 Locked filter chips formalization, 8E-CP4 Low stock indicators) merged into Phase 11 "Recipe Polish" as must-haves. Phase 11 estimate revised 7-12 → 9-15 sessions. 8E-CP2 (Natural-language search) remains post-launch.

**F&F readiness criterion:** Phases 8, 9, 10, 11, 12 all complete (per FF_LAUNCH_MASTER_PLAN). Phase 8 done pending cleanup; Phases 9, 10, 11, 12 remain.

**Working tree state at close-out:** 4 day's worth of CP work staged for commit in 5 chronological commits — see commit plan in this prompt.

**Pantry/grocery UX iteration workflow:** Tom will work directly with CC on small UX iterations (style, copy, spacing, interaction tuning on existing pantry + grocery surfaces). Constraint: no architectural changes. Logged separately to `docs/UX_ITERATIONS_LOG.md`. This SESSION_LOG continues to capture phase-checkpoint-level work only.

**Next planning session:** 8D cleanup pass (tomorrow), then Phase 11 planning when ready.
```

### Part 2 — Create `docs/UX_ITERATIONS_LOG.md`

**Create** the new log file with this scaffolding:

```markdown
# UX Iterations Log

Captures small UX iterations on existing pantry and grocery surfaces, done directly between Tom and Claude Code (no Claude.ai planning intermediary).

**Constraint:** UX iterations logged here are **strictly non-architectural**:
- Style, copy, spacing, color, typography tuning
- Interaction tuning (tap targets, transitions, animation timing)
- Layout adjustments within existing components
- Empty state copy, loading state visuals
- Existing-component prop additions for visual tuning only

UX iterations are NOT:
- New components or screens (those go through phase planning + Claude.ai)
- New services, hooks, or types
- Schema changes
- New matcher logic or business rules
- Type extensions on shared interfaces
- Modal lifts or other state-management restructuring

If a proposed iteration crosses the architectural line, CC should stop and surface the question for Claude.ai planning rather than executing inline.

---

## Format

Each entry follows this shape:

```
### YYYY-MM-DD — [surface] short description

**Files modified:** [list]
**Change summary:** [1-3 sentences]
**Visual diff verified:** yes/no (with screenshot baseline if relevant)
**Notes:** [anything unexpected]
```

---

## Entries

(none yet — first entry added when Tom and CC start the first iteration)
```

### Part 3 — Stage all docs to `_pk_sync/`

Copy all six modified docs + the new UX_ITERATIONS_LOG to `_pk_sync/` with today's date (overwrite if today-dated copies exist):

```bash
cp docs/PHASE_8_PANTRY_AND_GROCERY.md _pk_sync/PHASE_8_PANTRY_AND_GROCERY_2026-05-19.md
cp docs/DEFERRED_WORK.md _pk_sync/DEFERRED_WORK_2026-05-19.md
cp docs/FRIGO_ARCHITECTURE.md _pk_sync/FRIGO_ARCHITECTURE_2026-05-19.md
cp docs/PROJECT_CONTEXT.md _pk_sync/PROJECT_CONTEXT_2026-05-19.md
cp docs/FF_LAUNCH_MASTER_PLAN.md _pk_sync/FF_LAUNCH_MASTER_PLAN_2026-05-19.md
cp docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md _pk_sync/SUBSTITUTION_INTELLIGENCE_ROADMAP_2026-05-19.md
cp docs/SESSION_LOG.md _pk_sync/SESSION_LOG_2026-05-19.md
cp docs/UX_ITERATIONS_LOG.md _pk_sync/UX_ITERATIONS_LOG_2026-05-19.md
```

Final `_pk_sync/` should contain 8 today-dated docs.

### Part 4 — Commit batch (5 chronological commits)

The full day's work commits in five logical chunks. Several files touched by multiple CPs need patch-level staging — use `git add -p` (interactive hunk selection) for these.

**Approach:**
- Walk commits in chronological order: CP2 → CP2-patch → CP3 → CP4 → docs close-out.
- For files touched by only one CP, `git add <file>` works.
- For shared files (matcher service, smoke test, IngredientsSection, RecipeDetailScreen), use `git add -p <file>` and select hunks belonging to the current commit's CP.
- Verify each commit's `git diff --cached` before running `git commit` to catch hunk-selection mistakes.

**Fallback if patch staging gets messy:** collapse to 3 commits — "feat(8D): matcher work (CP1.5/CP2/CP2-patch/CP3 matcher field)", "feat(8D): UI work (CP3 tap-sheet + banner, CP4 screens + RecipeList wiring)", "docs(8D): close-out + 8E merge". Note the simplification in the SESSION_LOG. Don't sweat the bisectability if patch staging is too error-prone.

#### Commit 1 — CP2 4-level matcher

**Files in this commit:**
- `lib/services/pantryMatchingService.ts` (CP2 hunks only — the L1/L2/L3/L4 + always_available refactor, MatchLevel enum addition, MatchedIngredient gains level + reason fields, formMismatch widened to nullable each side; NOT yet supplyStatus, NOT yet SUBSTITUTABLE_SUBTYPES)
- `lib/services/_pantryMatchingSmokeTest.ts` (CP2 hunks only — the SMOKE-CP2-L1a..d / L2a..c / L3a..c / L4 / L4b / AAa / AAb scenarios, plus the cp2() helper if new)
- `components/recipe/IngredientsSection.tsx` (CP2 hunks only — the 4-state rendering: ✓ green / ⚠ amber with sub-line / ≈ amber with sub-line / red missing; the ingredientMatches Map prop replacing availableIngredientIds)
- `screens/RecipeDetailScreen.tsx` (CP2 hunks only — the ingredientMatches Map derivation from matchResult.matched)

**Commit message:**
```
feat(8D-CP2): 4-level matcher + 4-state ingredient row render

Refactor pantryMatchingService from binary (matched/missing) to a 4-level
match: L1 exact / L2 form_variant / L3 substitute / L4 missing, plus an
always_available skip rule (water/ice). MatchedIngredient gains level +
reason fields; formMismatch widened to nullable on each side; supplyId
widened to string | null.

3-query bulk structure preserved. Supply query's ingredient_id IN-filter
dropped (Task 2.5 per planning).

IngredientsSection consumes a new ingredientMatches: Map prop and
renders ✓ green (L1 / always_available), ⚠ amber with form sub-line
(L2), ≈ amber with substitute sub-line (L3), red missing (L4).
RecipeDetailScreen derives the Map from matchResult.matched.

+16 SMOKE-CP2-* scenarios.

Resolves T20 (4-level matcher), T22 (always_available skip).
```

#### Commit 2 — CP2 substitution whitelist patch

**Files in this commit:**
- `lib/services/pantryMatchingService.ts` (CP2-patch hunks only — SUBSTITUTABLE_SUBTYPES const at top of file, the whitelist gate added to the per-ingredient assembly loop, the null-form wildcard rule)
- `lib/services/_pantryMatchingSmokeTest.ts` (CP2-patch hunks only — SMOKE-CP2-WL1..8 and SMOKE-CP2-NF1..3 scenarios)
- `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` (the full new file — created in CP2-patch and extended in CP3 Part 0 with G7 + Additivity Principle; commit the whole current state of the file here)

**Commit message:**
```
feat(8D-CP2 patch): substitution whitelist + null-form wildcard

Patches the CP2 4-level matcher with two gating rules:

1. SUBSTITUTABLE_SUBTYPES whitelist (~75 subtypes) gates L2/L3 emission.
   Same-subtype matches in non-whitelisted subtypes (cheese, fish,
   leafy_green, tropical_fruit, etc.) demote to L4 missing. Closes the
   "banana ≈ mango" class of false positives.

2. Null-form wildcard within whitelisted subtypes: when either side has
   form=NULL, treat as L1 exact (silent ✓). Handles generic-base rows
   (sugar, vinegar, citrus whole fruits).

Whitelist composition curated 2026-05-19 against full catalog
(113 multi-member subtypes). See docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md
for assumptions, gaps (G1-G7), additivity principle, and post-F&F audit
plan (T30 in DEFERRED_WORK).

Matcher 3-query bulk structure preserved. No schema changes. No UI
changes — matcher's demotion of non-whitelisted L3 → missing[] flows
through automatically. Type signatures unchanged.

+11 SMOKE-CP2-WL/NF scenarios.
```

#### Commit 3 — CP3 tap-sheet + banner

**Files in this commit:**
- `components/recipe/IngredientTapSheet.tsx` (NEW file — full)
- `components/recipe/IngredientsSection.tsx` (CP3 hunks only — TouchableOpacity row wrappers, expandedIngredientId state, inline IngredientTapSheet render below tapped row)
- `screens/RecipeDetailScreen.tsx` (CP3 hunks only — match% banner, SupplyCreateSheet lift, step-scroll handler, cross-stack nav handler, "+ Need now" toast, suppliesById memo)
- `lib/services/pantryMatchingService.ts` (CP3 hunks only — supplyStatus: SupplyStatus | null added to MatchedIngredient + populated in all 5 push branches)
- `lib/services/_pantryMatchingSmokeTest.ts` (CP3 hunks only — SMOKE-CP3-S1 and SMOKE-CP3-S2)

**Commit message:**
```
feat(8D-CP3): recipe ingredient tap-sheet + match % banner

Implements P6-10 (deferred from Phase 6G — "Ingredient tap-to-see-steps").

- IngredientsSection rows are now tappable (activeOpacity={0.7}, no other
  visual treatment). Tap → inline tap-sheet appears below the row with
  state-appropriate actions.
- All matched levels (L1/L2/L3) share identical tap-sheet behavior; the
  inline indicators carry the L2/L3 distinction.
- always_available rows (water, ice) are non-tappable.
- Match % banner at the top of RecipeDetailScreen when match < 100%
  → opens AddRecipeToNeedsModal in mode='missing'. CP5 bundled.
- MatchedIngredient extended with supplyStatus (Option A — additive).
  Powers the matched_in_stock vs matched_low/critical state distinction.
- SupplyCreateSheet lifted to RecipeDetailScreen so banner + existing
  button + tap-sheet all share one instance.

Strictly additive at the visual layer: existing row visual, sub-line
copy, "+ Add N missing →" / "+ Add all N" buttons, section header, and
spacing are byte-identical to pre-CP3 render.

+2 SMOKE-CP3-S* scenarios.

Resolves P6-10.
```

#### Commit 4 — CP4 What-can-I-cook + RecipeList match wiring

**Files in this commit:**
- `lib/services/readyToCookService.ts` (NEW file — full)
- `lib/hooks/useReadyToCookRecipes.ts` (NEW file — full)
- `components/recipe/RecipeCard.tsx` (NEW file — full)
- `screens/WhatCanICookScreen.tsx` (NEW file — full)
- `screens/RecipeListScreen.tsx` (full file — only touched in CP4)
- `screens/PantryScreen.tsx` (full file — only touched in CP4)
- `App.tsx` (full file — only touched in CP4)
- `lib/services/_pantryMatchingSmokeTest.ts` (CP4 hunks only — SMOKE-CP4-RTC1..5 scenarios)

**Commit message:**
```
feat(8D-CP4): What-can-I-cook screen + RecipeList match wiring

Implements D8D-Q3 "Ready to cook" criterion: matchPercentage >= 0.90
AND every hero_ingredient resolves to a matched ingredient_id.

Architecture (hybrid per Tom 2026-05-19):
- lib/services/readyToCookService.ts — single source of truth for the
  ready-to-cook predicate; runtime name-resolution for hero_ingredients
  (text[]) against the recipe's own ingredients[] list. Includes
  getRecipeIngredientNames helper (recipe_ingredients fetch).
- lib/hooks/useReadyToCookRecipes.ts — loader + gate + sort.
  First standalone hook in the project.
- components/recipe/RecipeCard.tsx — extracted from RecipeListScreen;
  byte-identical visual output. Own makeStyles(colors) memoized.
- screens/WhatCanICookScreen.tsx — dedicated screen; gated subset; one-off
  locked filter chip (8E→Phase 11 will formalize). Architectural comment
  reservation for future free-form recipe ideas section.
- RecipeListScreen wired: derived recipesWithMatch useMemo over
  [recipes, matchMap] (no second bulk call); canMakeCount real;
  "X you can make now" badge renders and pushes to WhatCanICookScreen.

Hero ingredients runtime-resolved via case-insensitive name match
against recipe.ingredients[]. Unresolvable heroes are soft-passes
(console.warn for data-quality measurement). T31 captures the
post-F&F schema decision.

+5 SMOKE-CP4-RTC* scenarios (deterministic pure-predicate tests).

Resolves D8D-Q3.
```

#### Commit 5 — Doc close-out + 8E→Phase 11 merge

**Files in this commit:**
- `docs/PHASE_8_PANTRY_AND_GROCERY.md`
- `docs/DEFERRED_WORK.md`
- `docs/FRIGO_ARCHITECTURE.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/FF_LAUNCH_MASTER_PLAN.md`
- `docs/SESSION_LOG.md`
- `docs/UX_ITERATIONS_LOG.md` (NEW)
- All `_pk_sync/*_2026-05-19.md` staged copies (8 files)

**Commit message:**
```
docs(8D-closeout): Phase 8D complete, 8E merged to Phase 11, F&F scope updated

- Phase 8D essentially complete: CP1, CP1.5, CP2, CP2-patch, CP3, CP4
  shipped 2026-05-19. Cleanup pass (console.warn removal, T29 smoke
  realignment, PHASE_8D_PLANNING refresh, PK_CODE_SNAPSHOTS revert)
  deferred to tomorrow.

- Phase 8E retired as a standalone sub-phase. F&F-relevant checkpoints
  (8E-CP1 Browse rebuild, 8E-CP3 Locked filter chips, 8E-CP4 Low stock
  indicators) merged into Phase 11 must-haves. Phase 11 estimate
  9-15 sessions (was 7-12). 8E-CP2 Natural-language search remains
  post-launch.

- F&F launch readiness: Phases 8 through 12 complete. Phase 8 done
  pending cleanup; 9, 10, 11, 12 remain.

- New UX_ITERATIONS_LOG.md for pantry/grocery UX iteration work done
  directly between Tom and CC (non-architectural changes only;
  logged separately from main SESSION_LOG).

- Status doc bumps: FF_LAUNCH_MASTER_PLAN v6.6→v6.7, PROJECT_CONTEXT
  v10.6→v10.7, DEFERRED_WORK v5.27→v5.28.
```

### Part 5 — Push to origin

Push to the default remote (likely `origin`):

```bash
git push origin <current-branch-name>
```

Confirm the branch with `git branch --show-current` first. If on `main`, push to `main`. If on a feature branch (e.g. `phase-8D` or similar), push there.

Report back:
- All 5 commit hashes
- The branch pushed to
- Any push warnings or errors

If push fails (e.g. remote rejects, network issue, conflicts), **STOP and report** — Tom resolves before continuing.

### Part 6 — Final report

Report back with:
- ✅ Working tree clean (no uncommitted changes) — confirm via `git status`
- All 5 commit hashes
- The branch pushed
- Reminder to Tom: upload the 8 staged `_pk_sync/_2026-05-19.md` docs to PK in Claude.ai settings

---

## Constraints

- **DO NOT touch source code.** This prompt is doc-only changes + commit + push of pre-existing working tree state.
- **DO NOT change commit messages** from the drafted ones unless the SESSION_LOG content materially diverges (e.g. CC discovers an additional finding during this run worth flagging). If divergence: amend the commit message accordingly and note in the final report.
- **DO NOT edit `PK_CODE_SNAPSHOTS.md`** — it's still in the half-rewritten state. Tomorrow's cleanup handles it.
- **DO NOT commit anything unrelated.** If `git status` shows unexpected files, STOP and ask Tom.
- **Use `git add -p` (interactive patch staging) for shared files.** If patch staging gets confusing, fall back to the 3-commit collapse described in Part 4.
- **DO NOT force push.** If push is rejected, STOP and report — never use `git push --force` or `--force-with-lease` without Tom's explicit instruction.

---

## Verification

```bash
# 1. Working tree clean
git status
# Expect: clean / nothing to commit

# 2. 5 commits today
git log --since="2026-05-19 00:00" --oneline | wc -l
# Expect: at least 5

# 3. Today's commits readable
git log --since="2026-05-19 00:00" --oneline
# Expect: 5 commit lines with the messages drafted above

# 4. Working tree state restored
ls _pk_sync/ | grep "2026-05-19" | wc -l
# Expect: 8 files (all today-dated)

# 5. UX_ITERATIONS_LOG.md present
ls -la docs/UX_ITERATIONS_LOG.md
# Expect: file exists with the scaffolding from Part 2

# 6. SESSION_LOG has the close-out entry
grep "Phase 8D close-out" docs/SESSION_LOG.md
# Expect: 1 hit

# 7. FF_LAUNCH_MASTER_PLAN reflects merge
grep -A 1 "MERGED INTO PHASE 11\|merged from 8E" docs/FF_LAUNCH_MASTER_PLAN.md | head -5
# Expect: at least 1 hit
```

---

## After this completes

Tom's TODO for tonight:
1. Visual regression diffs (CP3 + CP4) — Sweet Winter Slaw recipe detail + RecipeListScreen + PantryScreen
2. Upload `_pk_sync/*_2026-05-19.md` docs to PK (8 files)
3. Sleep

Tom's TODO for tomorrow:
1. 8D cleanup pass (small CC prompt) — `console.warn` removal in IngredientTapSheet, T29 smoke realignment, PHASE_8D_PLANNING.md refresh, PK_CODE_SNAPSHOTS.md revert+refresh (~30-60 min CC work)
2. Start pantry/grocery UX iterations directly with CC — first entry to UX_ITERATIONS_LOG.md
3. (Eventually) Phase 11 planning kickoff in a fresh Claude.ai session

---

## SESSION_LOG entry for THIS run

Add as a new entry at the end of today's `## 2026-05-19` section (BELOW the Phase 8D close-out entry from Part 1E):

```markdown
### CC: 8D close-out doc updates + 8E→Phase 11 merge + commit + push — DONE

**Prompt:** `CC_PROMPT_2026-05-19_8D_closeout_commit_push.md`

Doc-only changes plus the day's batch-commit and push.

**Files modified:**
- docs/FF_LAUNCH_MASTER_PLAN.md (8E retired, Phase 11 absorbs 3 must-haves, v6.7)
- docs/PHASE_8_PANTRY_AND_GROCERY.md (8D essentially complete; 8E merge note)
- docs/PROJECT_CONTEXT.md (8D ✅, 8E merged, v10.7)
- docs/DEFERRED_WORK.md (8E reclassified, v5.28)
- docs/SESSION_LOG.md (Phase 8D close-out entry + this entry)
- docs/UX_ITERATIONS_LOG.md (NEW)
- _pk_sync/ — 8 today-dated docs staged

**Commits pushed:**
- [hash1] feat(8D-CP2): 4-level matcher + 4-state ingredient row render
- [hash2] feat(8D-CP2 patch): substitution whitelist + null-form wildcard
- [hash3] feat(8D-CP3): recipe ingredient tap-sheet + match % banner
- [hash4] feat(8D-CP4): What-can-I-cook screen + RecipeList match wiring
- [hash5] docs(8D-closeout): Phase 8D complete, 8E merged to Phase 11, F&F scope updated

**Branch pushed:** [branch name]

**Notes:**
- Patch staging used `git add -p` on lib/services/pantryMatchingService.ts, _pantryMatchingSmokeTest.ts, components/recipe/IngredientsSection.tsx, screens/RecipeDetailScreen.tsx [or: fell back to 3-commit collapse — note which].
- PK_CODE_SNAPSHOTS.md not touched (still half-rewritten; tomorrow's cleanup handles).
- 4 files have stale PK snapshot annotations carried forward from CP3 + CP4 SESSION_LOG entries.
```

# CP3 Parts A-G — continuation prompt

Read `CC_PROMPT_2026-05-19_8D_CP3_recipe_tapsheet_v2.md` in full. That's your authoritative spec.

## Context — important state from prior session

Part 0 of CP3 was completed in a prior CC session (2026-05-19). Do NOT re-run Part 0. Specifically, these items are already landed in the working tree:

- T27, T28, T29 added to `docs/DEFERRED_WORK.md` (in the 5-column table format; changelog at v5.25)
- G7 (multi-candidate substitution surfacing) section added to `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` after G6
- Additivity principle section added to `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` after "Realistic ambition"
- `_pk_sync/` already staged: `DEFERRED_WORK_2026-05-19.md`, `SUBSTITUTION_INTELLIGENCE_ROADMAP_2026-05-19.md`, `SESSION_LOG_2026-05-19.md`

**Before proceeding, verify Part 0 state:**

```bash
grep -c "^| T27 \|^| T28 \|^| T29 " docs/DEFERRED_WORK.md   # expect: 3
grep "G7 — Multi-candidate substitution" docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md   # expect: 1 hit
grep "Additivity principle" docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md   # expect: 1 hit
```

If any check fails, STOP and report — Part 0 didn't land as expected and we need to triage before proceeding.

If all checks pass, **proceed with Parts A through G of the CP3 v2 prompt**. Stage the additional doc updates (Part F) to `_pk_sync/` alongside the Part 0 docs already there — overwrite the existing 2026-05-19 copies with the newer combined state.

## Working tree state — do not be surprised

The working tree has uncommitted changes from earlier today:
- CP2 4-level matcher refactor (`pantryMatchingService.ts`, `_pantryMatchingSmokeTest.ts`, `IngredientsSection.tsx`, `RecipeDetailScreen.tsx`)
- CP2 substitution whitelist patch (same files + new `SUBSTITUTION_INTELLIGENCE_ROADMAP.md`)
- Part 0 of CP3 (the doc changes listed above)

Do not commit. Tom batches at the end.

## The Preservation Contract is real

The CP3 v2 prompt's "Preservation Contract" section is the hardest constraint. Before you start, Tom is taking a screenshot of Sweet Winter Slaw's recipe detail screen as a visual-regression baseline. After Parts A-G land, Tom takes a second screenshot and eyeball-diffs.

If you find yourself making any change that would alter row visual, button visual, spacing, or copy of pre-existing elements, STOP and report — do not adjust to make the new tap-sheet or banner "fit." The new elements adapt to the existing surface, not the other way around.

## STOP conditions to expect

The v2 prompt has 4+ STOP-and-report checkpoints. Take them seriously — do the reading passes before writing code:

- `PreparationSection.tsx` scroll-to-step mechanism (Part B / Part C step-scroll handler)
- `SupplyDetailScreen.handleFindRecipes` cross-stack navigation pattern (Part C)
- `cookingService.mapIngredientsToSteps` (or whatever the actual function name is)
- Toast surface for "+ Need now" success (likely `useSpawnOnOutToast` context or similar)
- `MatchedIngredient.supplyStatus` extension causing any downstream issue

If any of these come up unexpectedly different from the prompt's assumptions, STOP and let Tom + Claude.ai reconcile. Better to pause than fabricate.

## Carryover note (not blocking)

`docs/PK_CODE_SNAPSHOTS.md` is still in a half-rewritten state from an earlier interrupted refresh (116/181 rows redated). Pending Tom's revert/keep decision. CP3 will touch files tracked by this doc (`RecipeDetailScreen`, `IngredientsSection`, `pantryMatchingService`) — note the snapshot staleness in your SESSION_LOG entry but do NOT edit `PK_CODE_SNAPSHOTS.md` (editing it now would compound the inconsistency).

## When done

Report back with the standard format:
- Files modified (with `~lines` count where applicable)
- `_pk_sync/` contents (final state after Parts A-G doc updates)
- Smoke results (run SMOKE-CP3-S1, S2 plus any existing SMOKE-CP2-* that might be affected)
- Verification output (the bash checks in the v2 prompt's Verification section)
- Any STOP-condition findings or deviations from the prompt

Don't commit. Tom batches everything at the end.

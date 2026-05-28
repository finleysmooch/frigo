# CC Prompt — Phase 10 Wrap-Up: Docs Sync

## Context

Phase 10 (Nutrition Depth) shipped end-to-end on 2026-05-27 — all six sub-phases (10A raw/cooked fix, 10B micronutrient data layer, 10C recipe UI, 10D stats UI, 10E meal UI, 10F dietary preferences) plus a hot fix for URL-length-induced batch query failures. Smoke-tested green in Expo Go.

This is the documentation reconciliation pass. NO code changes. Updates living docs to reflect shipped state, captures all deferred items surfaced during the phase, and archives the Phase 10 handoff. All strategic content is authored below — your job is to apply it mechanically to the repo docs, matching each file's existing format conventions, then stage updated files in `_pk_sync/` for Tom's manual PK upload.

## Inputs to read first

1. `docs/DEFERRED_WORK.md` (or the dated canonical `DEFERRED_WORK_2026-05-26.md` — find the current canonical one; it's ahead of PK) — to match the existing entry format (priority labels, category sections, ID scheme)
2. `docs/FF_LAUNCH_MASTER_PLAN.md` (or current dated version) — to find the Phase 10 section and mark sub-phases shipped
3. `docs/PROJECT_CONTEXT.md` (or current dated version) — to update the current-phase status line
4. `docs/SESSION_LOG.md` — already has per-sub-phase entries from today; you'll add a day-summary header
5. The Phase 10 handoff doc (likely `PHASE_10_HANDOFF_2026-05-27.md` or in an uploads/working location) — to archive

## Task

### Edit 1 — `DEFERRED_WORK.md`: append new items

Match the existing entry format exactly (whatever priority/category/ID convention the file uses). Add these entries. If `P10A-1` already exists from an earlier CC prompt this session, leave it — do NOT duplicate; just verify it's present and note in your report.

**Phase 10 deferred items:**

---

**P10B-1 — `estimated_from_similar` ingredients lack `base_ingredient_id`**
22 ingredients with `source = 'estimated_from_similar'` have no `base_ingredient_id`, so their macros are untraceable to a USDA source. The source label implies a derivation that the schema doesn't actually record. Data integrity issue. Post-F&F catalog audit. Not blocking — these 22 are a small fraction of the 733-ingredient catalog and micros were correctly skipped for them in 10B.

**P10B-2 — Lentils stored as cooked-state per_100g while other legumes are dry-state**
During 10A, lentils were found to store cooked-state nutrition (~106 cal/100g) while other legumes (black beans, chickpeas) store dry-state. Inconsistent. Affects any "1 cup dried lentils" recipe — will under-count if treated as raw. Sweep all `usda_sr_legacy` rows for similar dry-vs-cooked state mismatches. Post-F&F catalog audit.

**P10B-3 — Matview CONCURRENTLY refresh was silently broken pre-10A (record only)**
Before 10A added the unique index `recipe_nutrition_computed_recipe_id_idx`, `refresh_recipe_nutrition()` used `REFRESH MATERIALIZED VIEW CONCURRENTLY` which silently requires a unique index. Anyone reading recipe nutrition before 2026-05-27 saw stale data. Resolved by 10A. Recorded for historical context only — no action needed.

**P10B-4 — Catalog FDC ID mis-mappings**
During 10B micronutrient backfill, found `usda_fdc_id` 170106 maps to both fresno chile AND habanero; 168936 (pasta) also appears on a "bread flour" row. Likely other rows share mis-mapped FDC IDs. Causes incorrect nutrition for the mis-mapped rows. Post-F&F catalog audit — cross-check fdc_id uniqueness against ingredient identity.

**P10B-5 — Bundle GRANT after every matview DROP+CREATE (best-practice note)**
`DROP MATERIALIZED VIEW` drops all grants on it. PostgREST's `authenticated`/`anon` roles then lose SELECT until re-granted. During Phase 10 debugging we ran a manual `GRANT SELECT ON recipe_nutrition_computed TO authenticated, anon;` as a precaution (the actual production bug turned out to be URL length — see hot fix — but the grant gap is a real footgun). **Going forward: every matview migration that does DROP+CREATE must bundle `GRANT SELECT ON <view> TO authenticated, anon;` immediately after CREATE, inside the same transaction.** Process note, not a code change.

**P10C-1 — Per-user Daily Value personalization via demographics**
Settings UI for age, sex, life stage (pregnant/lactating), weight. Compute per-nutrient DV from DRI tables instead of the fixed FDA RDI constants in `lib/constants/dailyValues.ts`. Replace the constant lookup with a `getUserDailyValues(userId)` resolver that falls back to FDA RDI defaults. Backward-compatible: `getDvPercent` gains an optional override-map parameter. Schema: extend `user_nutrition_goals` or new `user_dietary_profile` table. Co-locates naturally with 10F dietary prefs and Phase 12 onboarding — consider grouping as a "personal nutrition profile" feature. Surfaced 2026-05-27 during 10C planning.

**P10C-2 — Manual per-nutrient DV override**
Power-user escape hatch independent of demographics — let users set their own DV for any of the 10 micros (athletes wanting higher iron, low-sodium diets). `user_nutrition_goals` already keys by nutrient so it can hold these. Manual override resolves above any demographic-derived DV. Surfaced with P10C-1.

**P10D-1 — Micro goal-setting in NutritionGoalsModal**
10D shipped read-only micro tracking on the Stats screen. Extend NutritionGoalsModal to expose sliders for the 10 micros so users can set personal targets. Plumbing is ready — `NUTRIENT_AVERAGES_MAP`, `NutritionAverages`, and `getNutritionAverages` already cover all 10 micros, and `user_nutrition_goals` is nutrient-keyed. Non-breaking. Post-F&F based on tester feedback.

**P10E-1 — Narrower `DietaryFlagSource` type for `getActiveDietaryFlags`**
`getActiveDietaryFlags` requires a full `RecipeNutrition`, but only reads the 8 boolean dietary flag fields. `MealNutritionPanel` (10E) casts via `as RecipeNutrition` to satisfy this. Clean fix: extract a `DietaryFlagSource` interface (just the 8 booleans), have both `RecipeNutrition` and `MealNutrition` satisfy it structurally, and widen `getActiveDietaryFlags` to accept the narrower type. Removes the cast. Low priority — cast is safe today.

**P10F-1 — Expand allergen flags to FDA Big 9**
Current dietary schema covers 8 flags but not the full FDA Big 9 allergen set. Gaps: peanuts (currently folded into `is_nut_free` alongside tree nuts), fish (not tracked separately from shellfish), sesame (added to FDA Big 9 in 2021, not tracked at all). Add `is_peanut_free`, `is_fish_free`, `is_sesame_free` to: ingredients catalog, `recipe_nutrition_computed` matview (bool_and rollup), and `user_dietary_preferences`. Requires catalog backfill across ~733 ingredients. Substantial — post-F&F catalog-quality push. The 10F UI deliberately labels "Nuts" as "Tree nuts and peanuts" and "Shellfish" as "Crustaceans and mollusks" as a broad-interpretation safety measure until this lands.

**P10F-2 — Onboarding integration for dietary preferences**
10F ships Settings-only because Frigo has no first-launch onboarding flow yet. When Phase 12 (admin/auth/onboarding) builds onboarding, add a dietary-preferences capture step. The `dietaryPreferencesService` upsert path is ready to receive it.

**P10F-3 — Stats compliance summary card**
Cut from 10F scope. A card on the Stats screen's "How You Eat" section showing "X% of your cooks match your dietary preferences" with a supporting line ("23 of 28 cooks were vegetarian and gluten-free"). Only renders when the user has ≥1 dietary preference set. Wireframe Surface 4 from the 10F design session is the reference. Post-F&F.

**P10-Followup-1 — RPC for batch services (eliminate URL-length risk)**
The hot fix chunked `getRecipeNutritionBatch`, `getRecipeIngredientNames`, and `calculateRecipeSupplyMatchBulk` to work around PostgREST's URL length limit with large recipe ID arrays. Cleaner long-term fix: a Supabase RPC function (`get_recipe_nutrition_batch(recipe_ids uuid[])` etc.) that accepts the array as a POST body parameter, avoiding URL encoding entirely — fewer round-trips, no chunk-size tuning, no URL math. Refactor all three services to call RPCs. Post-F&F.

---

**Tech debt items** (add to whatever tech-debt section the file uses):

**TD — Pre-existing TS1382 errors in CookSoonSection / DayMealsModal**
`components/CookSoonSection.tsx:264` and `components/DayMealsModal.tsx:296` have TS1382 errors, untouched since January 2026 (commit b932087). Surfaced repeatedly during Phase 10 `tsc --noEmit` runs as pre-existing noise. Not in any Phase 10 scope. Clean up when those files are next touched.

**TD — `lib/constants/` vs `constants/` directory convention drift**
10C created `lib/constants/dailyValues.ts`, but the established convention is top-level `constants/` (e.g. `constants/vibeIcons.ts`). One-import-line move to reconcile. Low priority cosmetic consistency.

**TD — Orphan placeholder styles in StatsNutrition.tsx**
10D replaced the 🔬 placeholder card with the real Micronutrients card but left 4 now-unreferenced styles (`comingSoonContainer` etc.) in the StyleSheet to minimize touch. Delete on next StatsNutrition edit.

---

**Phase 11 input** (add to a Phase 11 inputs section if one exists, else to the general backlog with a clear "Phase 11" tag):

**P11-input — Active dietary filter visibility on RecipeListScreen**
When dietary prefs auto-apply (or any dietary flag is set via FilterDrawer), the active flags are invisible in the filter UI — the quick-filter pills don't reflect them and the only cue is the "From your dietary preferences" text indicator. Surface active dietary flags as visible, dismissible pills in the filter row. Part of the broader RecipeListScreen browse/navigation redesign Tom wants in Phase 11. Wireframe Surface 3 from the 10F design session (chips with × to dismiss individually) is a starting reference. The current screen has accumulated significant UI density (segmented control, quick filters, More drawer, sort dropdown, dietary indicator, search bar, pantry-match badges) — the redesign should tighten the information hierarchy.

---

Bump the doc's date/version stamp to 2026-05-27 and rename the file if it follows a dated convention (`DEFERRED_WORK_2026-05-27.md`).

### Edit 2 — `FF_LAUNCH_MASTER_PLAN.md`: mark Phase 10 shipped

Find the Phase 10 section. Mark all six sub-phases (10A, 10B, 10C, 10D, 10E, 10F) as shipped/complete with date 2026-05-27, matching whatever status convention the doc uses (✅, "SHIPPED", "[x]", etc.). If the doc has a phase-level status, mark Phase 10 complete. Note the hot fix under 10F or as a phase-closing line. Bump date/version stamp.

### Edit 3 — `PROJECT_CONTEXT.md`: update current status

Update the current-phase status line(s) to reflect Phase 10 complete as of 2026-05-27 and Phase 11 (RecipeListScreen redesign + browse/navigation rework) as the next planned phase. Match the doc's existing "current phase" / "what works" framing. Add micronutrient tracking, dietary preferences, and meal-level nutrition to the "what works" list if such a list exists. Bump date/version stamp.

### Edit 4 — `SESSION_LOG.md`: add day-summary header

The per-sub-phase entries from today are already appended. Add a day-summary header at the top of the 2026-05-27 section (above the individual entries) that captures the arc:

```
## 2026-05-27 — Phase 10 (Nutrition Depth) shipped end-to-end

Six sub-phases + hot fix in one session. 10A raw/cooked architecture fix (ingredient_state column, matview rewrite, fixed silently-broken CONCURRENTLY refresh). 10B micronutrient data layer (10 new columns, ~3,431 USDA values backfilled across 458 ingredients, matview micro rollups). 10C recipe-level micro UI. 10D stats-level micro UI + hoisted Per Day/Per Meal toggle. 10E meal-level nutrition aggregation. 10F dietary preferences (Settings + browse filter). Hot fix: chunked three batch services that were silently failing on URL length with 737 recipes — pre-existing bug exposed by 10F's auto-filter.

Smoke-tested green in Expo Go. Phase 10 complete. Deferred items captured in DEFERRED_WORK (P10B-1..5, P10C-1..2, P10D-1, P10E-1, P10F-1..3, P10-Followup-1). Next: Phase 11 RecipeListScreen redesign.

(Individual sub-phase entries below.)
```

### Edit 5 — Archive the Phase 10 handoff doc

Move the Phase 10 handoff doc to `docs/archive/handoffs/`. If it's not already in the repo (e.g. it lives in an uploads location), note that in your report rather than fabricating a move. Preserve the filename.

### Staging for PK sync

After editing, copy every updated living doc into `_pk_sync/` so Tom can manually upload to Project Knowledge. This includes: the updated DEFERRED_WORK, FF_LAUNCH_MASTER_PLAN, PROJECT_CONTEXT, and SESSION_LOG. Do NOT stage the archived handoff (it's leaving the active set).

## Constraints

- NO code changes. Docs only.
- Do NOT author new strategic content beyond what's specified above — match existing formats, apply the provided text. If something is ambiguous (e.g. unclear where a section goes), make a reasonable choice and flag it in your report rather than inventing.
- Do NOT duplicate `P10A-1` if it already exists from an earlier prompt this session.
- Preserve all existing DEFERRED_WORK entries — append only.
- Match each doc's existing date/version-stamp convention when bumping.

## Verification

1. `grep -c "P10B-1\|P10B-5\|P10C-1\|P10E-1\|P10F-1\|P10-Followup-1" docs/DEFERRED_WORK*.md` — should return ≥6
2. `grep "P11-input" docs/DEFERRED_WORK*.md` — should be present
3. Confirm the 4 living docs are present in `_pk_sync/`
4. Confirm the handoff doc is in `docs/archive/handoffs/` (or your report explains why not)
5. `grep "2026-05-27" docs/FF_LAUNCH_MASTER_PLAN*.md docs/PROJECT_CONTEXT*.md` — date stamps bumped

## Reporting back

When done, paste:
1. List of files edited + their new paths
2. The grep verification results
3. Confirmation of `_pk_sync/` staging (list staged files)
4. Whether P10A-1 already existed (duplicate check result)
5. Any ambiguities you resolved and how
6. Anything that couldn't be done as specified (e.g. handoff doc not in repo)

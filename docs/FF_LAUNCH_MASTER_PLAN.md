# Frigo — Friends & Family Launch Master Plan
**Created:** March 17, 2026
**Last Reconciled:** May 27, 2026
**Last Updated:** May 28, 2026 (Phase 11 doc pointer added)
**Remaining work:** 14-18 weeks to F&F (per dashboard v2 time-to-F&F arithmetic)
**Status:** Active — **Phase 8 complete pending cleanup pass; Phase 10 (Nutrition Depth) shipped 2026-05-27** (sub-phases 10A → 10F + hot fix). 8R closeout (CP1 → CP6e shipped; smoke clean 2026-05-15) + 8D (CP1 → CP4) shipped 2026-05-19 (CP5 bundled into CP3). **8E retired** — F&F-relevant CPs merged into Phase 11. Next: 8D cleanup pass (small), Phase 9, then Phase 11–12. F&F readiness criterion = Phases 8, 9, 10, 11, 12 all complete; **3 of 5 now done**.

---

## Purpose

This document is the strategic plan for getting Frigo from Phase 4 completion to real users. It sits above the individual phase docs and provides the full picture: what we're building, in what order, and why.

**Read this first** to understand the F&F journey. Then read the specific phase doc for whatever is currently being built.

---

## Strategic Context

### Where We Are (April 22, 2026)

Phases 5, 6, and 7 complete. Phase 7 shipped 2026-04-17 with all 13 sub-phases (7A, 7B, 7B-Rev, 7C, 7D, 7E, 7F, 7I, 7G, 7H, 7N, 7M, 7J, 7K, 7L) and ~30 actual sessions vs the original 12-18 estimate. 78 items delivered, 42 deferred to post-F&F. See `PHASE_7_SOCIAL_FEED.md` and `PHASE_7_STATUS_REPORT.md` for the audit trail.

Phase 7P (feed polish — pagination + pull-to-refresh hang investigation) is next, bundled as a 1-2 session pre-Phase-8 polish pass. Phase 8 (Pantry Intelligence + UX Overhaul) follows immediately after. The app has breadth: recipe extraction, cook-post-centric social feed with multi-cook meal events, meal planning, shared pantries, grocery lists, recipe browse with rich filtering, per-recipe nutrition, comprehensive cooking stats, full step-by-step cooking mode with timers, unified post-cook logging, and full post editing (Strava Edit Activity pattern). Built on seeded test data (1,740 posts + Phase 7 activity, 19 users — 2 real + 17 test). No real usage yet. Runs on Expo Go only.

**May 15 — 8R closeout + 8D verification finding.** Phase 8R passed smoke validation clean 2026-05-15. The 8R refactor (unified household needs replacing lists-as-containers, supplies replacing pantry_staples, lots model) is functionally complete; remaining work is doc reconciliation, CC repo cleanup, and FRIGO_ARCHITECTURE refresh. **Critical finding:** the 8D recipe-pantry matching upgrade is verified NOT SHIPPED — code-level grep showed zero matching-function references anywhere in the codebase. The old `pantryService.calculatePantryMatchPercentage` family was deleted with the 8R purge and never re-implemented against `supplies`. Catalog substrate work (base_ingredient_id linkage, form column, vinegar promotion, cheese variant additions) is investment with no current consumer. Recipe surfaces have no pantry indicators. This makes 8D-CP1+CP2 a real un-started piece of work, not the "upgrade" the master plan implied. Estimated 3-5 sessions to ship CP1-CP5; cheese duplicate cleanup migration bundles as CP1 Part 0. F&F-blocker.

5 stale `pantry_items` query sites were also discovered in `spaceService.ts` (3 sites) and `statsService.ts` (2 sites) — reading from a dropped table, returning empty silently. Tracked as T8 cross-cutting tech debt. F&F-prereq.

### What Needs to Happen

The app needs to go from "works on the developer's phone with test data" to "works reliably on friends' phones with real data." That means:
- Finish the social loop so it feels complete
- Overhaul pantry and grocery UX (single biggest weak spot today)
- Fix meal creation, calendar, and invitation flows
- Add nutrition depth (micronutrients, meal-level aggregation, source labeling)
- Polish the recipe system (extractors, cookbook view, cook soon, edit mode)
- Add concept cooking and ingredient substitutions as first-stab features
- Handle distribution mechanics (TestFlight, onboarding, privacy, invite codes)
- Add content (more cookbooks in the database)

### Key Decisions on Scope

**March 17 — Original expanded scope.** The original roadmap doc proposed a tight ~22-32 session plan targeting end of April. Tom expanded scope to include pantry intelligence, a first attempt at flexible meal planning, social depth improvements, and NYT Cooking exploration. Pushed timeline to mid-to-late May.

**April 6 — Post-Phase-7B reconciliation.** Tom reviewed pre-F&F scope notes against the master plan and surfaced gaps. Decisions made:
- Micronutrients (curated subset of 12) moved **into pre-launch scope** (was deferred)
- Meal-level nutrition moved **into pre-launch scope** (was deferred)
- Cookbook/book view UX update added to pre-launch scope
- Cook Soon queue UX update added to pre-launch scope
- Meal creation, calendar, and invitation UX added to pre-launch scope
- Concept cooking first-stab added to pre-launch scope (Phase 11)
- Ingredient substitutions v0 added to pre-launch scope (Phase 11, 1 session, same-type list)
- Edit Mode redesign added to pre-launch scope (Phase 11)
- Nutrition data source labeling added to pre-launch scope
- AI pantry photo recognition, grocery account integration, full micronutrient import → post-launch
- Linecook competitor diligence → action item, not a build phase

Net effect: ~10-18 additional sessions, ~3 weeks of slip. Tom accepted the slip in exchange for completeness.

### Session Budget

The original 33-53 estimate assumed Phase 8 at 7-12. With Phase 8 at 18-28, remaining estimate becomes **44-69 build sessions**.

At 14-16 sessions/week:
- Base: ~5-6 weeks total (3-4 weeks build + 2 weeks testing)
- +50% growth buffer: ~6.5-7.5 weeks
- Phase-7-style 2× growth: ~7.5-9 weeks

Testing window stays calendar-fixed. Phase 11 remains the primary scope-cut lever; Phase 8's natural search is the secondary lever.

---

## Phase Sequence

| Phase | Focus | Est. Sessions | Status |
|-------|-------|---------------|--------|
| **5** | Ingredient Architecture + Critical Fixes | — | ✅ Complete |
| **6** | Cooking Mode v2 | — | ✅ Complete |
| **7** | Social & Feed Polish | ~30 actual (12-18 orig est) | ✅ Complete (shipped 2026-04-17) |
| **7P** | Feed polish — pagination + pull-to-refresh hang | 1-2 | 🔲 Next |
| **8** | Pantry Intelligence + Pantry/Grocery UX Overhaul | 18-28 (8A+8B shipped; 8C partial; 8C-Shared SUPERSEDED; 8R + 8D shipped 2026-05-19; **8E retired — F&F-relevant CPs merged to Phase 11**) | 🟢 Complete pending cleanup pass |
| **8R** | **Unified household needs refactor** | **~6 weeks actual** | 🟢 Mid-closeout — CP1 → CP6e shipped (2026-04-29 → 2026-05-13). SmokeFix-SF1/SF2/SF3 + catalog SF-5 shipped 2026-05-14. Smoke validation passed clean 2026-05-15. Doc reconciliation + CC cleanup pass remaining. See PHASE_8R_UNIFIED_NEEDS.md v0.7. |
| **8D** | Recipe-pantry matching | 3-5 | 🟢 Essentially complete. **CP1** (matching primitive) + **CP1.5** (catalog variant linkage backfill) + **CP2** (4-level matcher + substitution whitelist patch) + **CP3** (recipe tap-sheet + match % banner — **CP5 missing-to-grocery bundled into CP3**) + **CP4** (What-can-I-cook screen + RecipeList match wiring) shipped 2026-05-19. End-of-phase cleanup pass pending (console.warn removal, T29 smoke realignment, PHASE_8D_PLANNING refresh, PK_CODE_SNAPSHOTS). See PHASE_8D_PLANNING.md + PHASE_8_PANTRY_AND_GROCERY.md CP results subsections. |
| **9** | Meal & Planning UX (incl. flex planning v1, cross-meal dedup) | 7-10 | 🔲 Pre-launch |
| **10** | Nutrition Depth | 1 (actual; single session 2026-05-27) | ✅ Complete (shipped 2026-05-27) — 10A raw/cooked architecture fix, 10B USDA micronutrient backfill (~3,431 values / 458 ingredients / 10 columns), 10C recipe-level micro UI, 10D stats-level micro UI + hoisted Per Day/Per Meal toggle, 10E meal-level nutrition aggregation, 10F dietary preferences (Settings + browse filter). Hot fix same day: chunked three batch services for PostgREST URL-length resilience. |
| **11** | Recipe Polish (expanded: search/filter, folders stretch; **+ 8E-CP1/CP3/CP4 merged 2026-05-19**) | 9-15 (was 7-12; +3 for merged 8E work) | 🔲 Pre-launch |
| **12** | Distribution, Polish & Testing | 7-11 + 2wk testing | 🔲 Pre-launch |
| **Parallel** | LLC formation + Apple Developer org enrollment track | — | 🔲 Kicks off immediately |
| **Parallel** | Tom photographs cookbooks for batch extraction | — | 🔲 Ongoing |

**Total remaining build sessions (8D cleanup + Phases 9-12):** ~28-44 (per dashboard v2 arithmetic; 8D shipped 2026-05-19, 8E retired and absorbed into Phase 11)
**Total remaining calendar time:** ~14-18 weeks. F&F target: **late August or early September 2026.** F&F readiness criterion: Phases 8, 9, 10, 11, 12 all complete (Phase 8 done pending cleanup).

### Why This Order

**Phase 7P (feed polish) kicks off first** as a 1-2 session bundle pulling two high-priority items out of the Phase 7 backlog — feed infinite scroll pagination (P7-44) and pull-to-refresh hang investigation (P7-45, may already be fixed by 7M's 5s stale-refetch threshold and need only verification). Ships before Phase 8 proper so the feed performs correctly when testers start hitting it.

**Phase 8 (Pantry) next** because it's the most complex remaining domain and depends on Phase 5's ingredient architecture. The pantry/grocery UX is the single most-flagged weak spot in Tom's pre-F&F notes. Recipe-pantry matching ("what can I cook?") is a high-value F&F feature.

**Phase 9 (Meal & Planning UX) third** because meal flows are functional but rough — meal creation, calendar/week picker, and invitations all need UX passes. Flexible meal planning v1 (locked + shortlisted commitment levels) lands here because it depends on the meal creation flow being clean.

**Phase 10 (Nutrition Depth) fourth** because micronutrients and meal-level nutrition build directly on the per-recipe nutrition system from Phase 5. Dietary preferences capture also lands here since it feeds the nutrition + browse experiences.

**Phase 11 (Recipe Polish) fifth** because by this point all the dependent systems (ingredients, pantry, meals, nutrition) are stable and we can do the recipe system polish without rework. Edit mode redesign, concept cooking, ingredient substitutions, cookbook UX, cook soon UX, and extractor updates all consolidate here.

**Phase 12 (Distribution) last** because it's gated by content and feature stability. Onboarding flow includes historical cook entry as the immediate-value moment for new users. TestFlight build only happens once we're confident in the rest of the app.

---

## Phase Scope Definitions

### Phase 7: Social & Feed Polish ✅

Complete. Shipped 2026-04-17 across 13 sub-phases (7A, 7B, 7B-Rev, 7C, 7D, 7E, 7F, 7I, 7G, 7H, 7N, 7M, 7J, 7K, 7L). 78 items delivered, 42 deferred. Key outputs: cook-post-centric feed architecture (7I), multi-cook meal experience (7D-7F), MealEventDetailScreen (7I CP6), historical cook logging (7G), full post editing via Strava Edit Activity pattern (7M), detail screen + feed carousel polish (7N). See `PHASE_7_SOCIAL_FEED.md` for the full phase doc (including the absorbed Phase 7I Detailed Reference appendix) and `PHASE_7_STATUS_REPORT.md` for the shipped-vs-deferred audit.

### Phase 7P: Feed Polish 🔲

Small pre-Phase-8 polish bundle pulling high-priority items out of the Phase 7 backlog. Ships before Phase 8 proper so the feed performs correctly under tester load.

**Must have:**
- [must] Feed infinite scroll / pagination (P7-44) — hard-capped at 200 dishes after 7F Fix Pass 7; needs `onEndReached` pagination
- [must] Pull-to-refresh hang investigation (P7-45) — ~15s hang reported; may already be resolved by 7M's 5s stale-refetch threshold — verify first, fix only if still reproducible

**Estimated:** 1-2 sessions.

### Phase 8: Pantry Intelligence + Pantry/Grocery UX Overhaul 🔲

**Must have:**
- [must] Pantry schema foundation — space-scoped `pantry_staples` table, Path B foundation columns on `pantry_items`, grocery tier reasons on `grocery_list_items`, expiration fall-off config (8A-CP1)
- [must] Pantry UX foundation — view toggle (Category/Storage/Expiry), fraction display utility wired across surfaces, auto-expiry fall-off job (8A-CP2 through 8A-CP4)
- [must] Staples & depletion — `pantryStaplesService` with state cycling, staples grid UI with soft colors, cook-post banner-after depletion (8B)
- [must] Grocery UX overhaul — 3-tier structure (Now/Could wait/In cart) using existing `priority` field, recipe chips, cross-list awareness, staple-to-grocery auto-routing, aisle grouping via existing `typical_store_section` (8C-CP1 through 8C-CP4)
- [must] Ingredient Detail screen — hero + Recipes/Info/Brands/History tabs, reachable from every ingredient tap (8C-CP5)
- [must] Freezer cleanout — forgotten-item detector, thaw tray, async planning pattern, multi-select cross-ingredient search (8C-CP6 through 8C-CP8)
- [must] Recipe-pantry matching upgrade — base-ingredient normalization, staple exclusion, tap-sheet on RecipeDetailScreen ingredient rows (8D-CP1 through 8D-CP3)
- [must] What-can-I-cook screen with sectioned results, missing-to-grocery one-tap (8D-CP4 through 8D-CP5)
- [moved-to-11] **8E retired as a Phase 8 sub-phase 2026-05-19.** F&F-relevant 8E-CP1 (Browse rebuild), 8E-CP3 (Locked filter chips pattern), and 8E-CP4 (Low stock indicators #31) merged into Phase 11 must-haves. 8E-CP2 (Natural-language search) remains post-launch (first post-launch ship if the scope-cut lever is exercised).

**Pre-launch foundation (schema only, UI deferred):**
- [prep] Path B staleness foundation (`last_confirmed_at` on pantry_items, `staleness_threshold_days` per category) — unknown state UI for staples only at F&F; tracked-item staleness 1 session post-launch

**Moved to post-launch:**
- [post-launch] Brand discovery full UI — data already captures via existing `grocery_list_items.brand_preference` + `size_preference`; full community-scale discovery UI is 3-5 sessions post-launch
- [post-launch] Smart (silent-automatic) cook-post depletion — opt-in banner v1, smart post-launch once matching proven
- [post-launch] Full accessibility audit across Phase 8 surfaces — per-prompt tap target + label verification only for v1
- [post-launch] Flex meal planning v1 → Phase 9
- [post-launch] NYT Cooking integration → top-of-queue
- [post-launch] Receipt scanning → post-launch
- [post-launch] Per-store grocery aisle layouts → v1 uses global `typical_store_section`; per-store "where found last time" memory post-launch
- [post-launch] Category-level pantry matching ("any cheese", "any pasta") → user-configurable setting
- [post-launch] Quantity-aware matching ("recipe needs 4 eggs, I have 2") → smart subtraction v2
- [post-launch] Staples onboarding survey → likely Phase 12
- [post-launch] Smart thaw-time calculation → v1 is manual
- [post-launch] Auto-schedule thawed items onto meal calendar → Phase 9
- [post-launch] App-level voice recording → v1 uses OS dictation only
- [post-launch] Conversational search refinement → v1 is single-turn

**Estimated: 18-28 sessions** (was 7-12 at v6.0). Revised after 2026-04-23 wireframe session added 5 new scope items (Ingredient Detail, Freezer cleanout, natural search, locked chips pattern, view toggle pattern) and 2026-04-23 audit surfaced per-checkpoint estimates that warranted sub-phase bump (8B: 3-4 → 4-5; 8C: 4-6 → 6-8).

**Sub-phase structure (4 sub-phases post 2026-05-19):** 8A schema foundation + pantry polish (3-4) · 8B staples & depletion (4-5) · 8C grocery + Ingredient Detail + freezer (6-8) · 8D recipe matching + tap-sheet + What-can-I-cook (3-5, shipped). **8E retired** — F&F-relevant CPs merged into Phase 11. (Plus 8R unified-needs refactor, ~6 weeks actual; planning-side reorganization, not a numbered sub-phase.)

**Primary scope-cut lever:** Natural-language search (formerly 8E-CP2) is post-launch already — no in-Phase-8 scope-cut lever remains. Phase 11 is now the primary scope-cut lever.

### Phase 9: Meal & Planning UX 🔲

**Must have:**
- [must] CreateMealModal refresh — review against the new cook-post-centric architecture; what still fits, what needs rebuilding. Note: 7E already shipped in-sheet meal creation (InSheetMealCreate.tsx per D36) for the cook-logging path; this scope is the full heavyweight CreateMealModal for the Meals-tab entry point.
- [must] Meal calendar + week picker UX — untouched in Phase 7; still needs review and rebuild.
- [must] Meal invitations QA + UX update — untouched in Phase 7; needs both.
- [must] Flexible meal planning v1 (per `CONCEPT_FLEXIBLE_MEAL_PLANNING.md`) — locked + shortlisted commitment levels. Depends on meal creation flow being clean.
- [must] Multi-user handoff clarity — promoted from nice-to-have 2026-04-22. "Pick up meal planning from another household member" flow.
- [must] Cross-meal deduplication (D38) — promoted from nice-to-have 2026-04-22. Non-trivial backend feature (per D38 framing): when a tagged user already has an overlapping meal event, prompt to merge vs create separate. Budget ~2-3 of the phase's sessions for dedup alone.

**Estimated:** 7-10 sessions (was 5-8 before multi-user handoff + cross-meal dedup promotion).

### Phase 10: Nutrition Depth ✅

**Status:** Shipped 2026-05-27 (single session, six sub-phases + hot fix). See SESSION_LOG 2026-05-27 day-summary header for the arc; per-sub-phase deferred items captured in DEFERRED_WORK §"Phase 10B–F + Cross-Phase Follow-ups".

**Must have (shipped):**
- [must] ✅ **10B — Micronutrients** (10 curated: Vitamin A, C, D, B12, Folate, Iron, Calcium, Potassium, Magnesium, Zinc) imported from USDA FDC SR Legacy. ~3,431 values backfilled across 458 ingredients via one-shot generator script + atomic UPDATE migration. Matview `recipe_nutrition_computed` rolls them up to recipe-level totals. (Sodium + Fiber were already in the schema; the 10 added here are the new micros.) — shipped 2026-05-27.
- [must] ✅ **10C — Recipe-level micro UI** on `RecipeNutritionPanel`: Vitamins/Minerals sub-toggle with per-row DV% from FDA RDI constants. — shipped 2026-05-27.
- [must] ✅ **10D — Stats-level micro UI** on `StatsNutrition`: replaced 🔬 placeholder with real Micronutrients card; hoisted Per Day/Per Meal toggle out of GoalsSection to a shared position. — shipped 2026-05-27.
- [must] ✅ **10E — Meal-level nutrition aggregation**: new `MealNutritionPanel` on both `MealEventDetailScreen` and `MealDetailScreen`. Aggregates "one serving of each dish" across all linked recipes. — shipped 2026-05-27.
- [must] ✅ **Nutrition data source labeling**: "Estimates based on USDA data and ingredient matching. Directional, not for medical use." disclaimer on every micronutrient surface (recipe panel, stats card, meal panel). — shipped 2026-05-27.
- [must] ✅ **10F — Dietary preferences capture**: new `DietaryPreferencesScreen` under Settings → Preferences with DIETARY STYLE / AVOID / BEHAVIOR sections + `auto_apply_to_browse` that pre-populates `RecipeListScreen.advancedFilters.dietaryFlags`. Onboarding integration deferred to Phase 12 (no onboarding flow exists yet); captured as P10F-2. — shipped 2026-05-27.

**Also shipped (not on original list):**
- **10A — Raw/cooked architecture fix** (prerequisite for 10B). Added `ingredient_state` column + matview rewrite to apply `cooked_ratio` only when state='cooked'. Also fixed silently-broken `REFRESH MATERIALIZED VIEW CONCURRENTLY` (added missing unique index). 81 existing rows backfilled.
- **Hot fix** — three batch services (`getRecipeNutritionBatch`, `getRecipeIngredientNames`, `calculateRecipeSupplyMatchBulk`) chunked to 100 IDs/request. Pre-existing latent bug (URLs of 27KB+ vs PostgREST 4-8KB limit) exposed by 10F's auto-filter when nutrition-batch failures stopped dietary flags reaching the client.

**Actual:** 1 session (six sub-phases + hot fix). Originally estimated 4-6 sessions; substantially faster because (a) schema substrate from Phase 5 was solid, (b) RecipeNutritionPanel pattern from 10C was reusable for 10D + 10E.

### Phase 11: Recipe Polish 🔲

Primary scope-cut lever if Phase 8 or 9 overruns. The stretch item goes first; further overflow takes items from must-have list back to post-launch in reverse-priority order (starting with ingredient substitutions v0).

**Must have:**
- [must] Recipe-from-photo extractor update — match latest recipe format
- [must] Recipe-from-URL extractor update — same
- [must] Cookbook / book view UX update — promoted from nice-to-have 2026-04-22
- [must] Cook Soon queue UX update — promoted from nice-to-have 2026-04-22
- [must] Concept cooking first-stab (#95) — promoted from nice-to-have 2026-04-22. Cook without a specific recipe; optional AI guidance for the concept (e.g. "I'm making a stir fry, walk me through it").
- [must] Ingredient substitutions v0 — promoted from nice-to-have 2026-04-22. Click ingredient → see list of similar ingredients from same `ingredient_type`. 1 session, no smart matching yet.
- [must] Recipe list hub search / filter improvements — added 2026-04-22. Scope specifics defined during Phase 11 planning; aim is improving discovery within the current Recipes list view without redesigning it.
- [must] **Browse recipes rebuild** (merged from 8E-CP1, 2026-05-19) — search + tiles + collapsed filter row. Replaces the current Recipes tab with the wireframe v5 design.
- [must] **Locked filter chips pattern** (merged from 8E-CP3, 2026-05-19) — formalize the one-off locked chip currently in WhatCanICookScreen. Reusable component pattern applied to all filtered-subset surfaces (What-can-I-cook, Ingredient Detail Recipes tab post-F&F, Stats DrillDownScreen, etc.).
- [must] **Low stock indicators (#31)** (merged from 8E-CP4, 2026-05-19) — ingredient-level low/critical chips on recipe tiles and detail rows. Uses the CP1 matching primitive's low/critical bucketing.

**Stretch (scope-cut first if calendar tightens):**
- [stretch] Recipe folders — basic attempt, added 2026-04-22. Strict scope: single-user collections only, no sharing, no smart rules. ~2-3 sessions. If Phase 11 is tight, this goes to post-launch without ceremony.

**Moved to post-launch:**
- [post-launch] Edit Mode full redesign (notebook aesthetic, structural ingredient editing, drag handles, "or" substitution syntax) — MVP banner + Exit button shipped in 7B-Rev stands as sufficient pre-F&F.
- [post-launch] Recipe comments knowledge base system (#30) — deferred after 4/22 review. F&F is the right moment to learn what people actually want before building moderation/threading UX for this.

**Estimated:** 9-15 sessions (was 7-12; +3 sessions for the merged 8E-CP1/CP3/CP4 work, 2026-05-19).

See `docs/PHASE_11_RECIPE_POLISH.md` for the full phase doc (sub-phase spine, 11A status, carried deferred).

### Phase 12: Distribution, Polish & Testing 🔲

**Must have:**
- [must] Onboarding flow — welcome → invite code → signup → profile → permissions, with historical cook entry as the immediate-value moment (let users log recipes they already know they love before they post their first cook)
- [must] Privacy policy + account deletion — for App Store compliance
- [must] Invite codes / referral tracking — open signup + admin approval model, per-user shareable codes for organic spread (target 100-200 testers)
- [must] EAS / TestFlight build setup — uses the organization Apple Developer account (LLC-backed; see Working Agreements)
- [must] Personal daily-use testing → inner circle → broader F&F (2 weeks of testing)
- [must] Bug fix buffer for issues found during testing

**Open decisions:**
- TestFlight vs direct App Store — pending, leaning TestFlight for the F&F window

**Estimated:** 7-11 sessions build + 2 weeks testing window.

---

## Scope Decisions

### In Scope for F&F (Pre-Launch)

**Feed Polish (Phase 7P)**
- [must] Feed infinite scroll / pagination
- [must] Pull-to-refresh hang investigation + fix

**Recipe System (Phase 11)**
- [must] Recipe-from-photo extractor update
- [must] Recipe-from-URL extractor update
- [must] Cookbook / book view UX update
- [must] Cook Soon queue UX update
- [must] Concept cooking first-stab
- [must] Ingredient substitutions v0
- [must] Recipe list hub search / filter improvements
- [stretch] Recipe folders basic attempt
- Cookbook content — 5-10 more books via batch extraction (parallel, no session cost in the build budget)

**Social & Feed (Phase 7, shipped)**
- Multi-dish posts, historical cook logging, linked posts, cook-post-centric feed, MealEventDetailScreen, full post editing — all shipped 2026-04-17

**Meals & Planning (Phase 9)**
- [must] CreateMealModal refresh
- [must] Meal calendar + week picker UX
- [must] Meal invitations QA + UX
- [must] Flexible meal planning v1
- [must] Multi-user handoff clarity
- [must] Cross-meal deduplication (D38)

**Pantry & Grocery (Phase 8)**
- [must] Pantry UX overhaul
- [must] Grocery UX overhaul
- [must] Recipe-pantry matching
- [must] Missing-to-grocery flow
- [must] Low stock indicators
- [must] Pantry fraction display

**Nutrition & Stats (Phase 10)**
- [must] Micronutrients curated subset
- [must] Meal-level nutrition
- [must] Nutrition data source labeling
- [must] Dietary preferences capture

**Distribution (Phase 12 + parallel admin track)**
- [must] Onboarding (with historical cook entry)
- [must] Privacy policy, account deletion
- [must] Invite codes + referral tracking
- [must] EAS/TestFlight build
- [must] LLC formation → D-U-N-S → Frigo domain → Apple Developer org enrollment (admin track, starts immediately)

### Deferred to Post-F&F

**Immediate post-launch priority (top of queue):**
- NYT Cooking integration — Tom's annotation: "would be awesome if we could get that shipped at or soon after F&F launch." Scope-first approach retained (1 session to investigate before committing build sessions).

**Pre-launch scope cuts (deferred 2026-04-22):**
- Edit Mode full redesign (notebook aesthetic, structural ingredient editing, drag handles, "or" substitution syntax) — MVP banner from 7B-Rev stands
- Recipe comments knowledge base system (#30) — wait for F&F feedback before building moderation/threading UX
- Receipt scanning — real effort 3-5 sessions; revisit post-launch

**Long-standing post-launch backlog:**
- AI pantry photo recognition (onboarding moonshot)
- Grocery account integration to populate pantry
- Full micronutrient import (beyond curated 12)
- Public website (donation page, app description)
- Offline cooking mode
- Voice-to-text / talk-to-text
- Algorithmic feed
- Web version
- Social login (Google/Apple)
- Flavor profiles
- Technique tagging
- Wearable integration
- Monetization / payment infrastructure (ship free for F&F)
- Full GDPR compliance
- Block/report users
- Data export
- Smart ingredient substitutions (beyond v0 same-type list)
- Concept cooking depth (beyond first-stab)
- Recipe annotations beyond current state

**Phase 7 backlog (42 items tracked in `DEFERRED_WORK.md`):**
- High priority: see P7-44 and P7-45 (both resolved by Phase 7P above)
- Medium priority: eater ratings full implementation, @-mention parsing, notification batching, voice memo/photo upload on LogCookSheet, schema cleanup, `supabase/migrations/` tracking setup
- Low priority: viewer taste profile, vibe pill personalization, collage hero photos, planned-dish entry, host recap post type, duplicate meal event detection, various UX polish

**Strategic action items (not build phases):**
- Linecook competitor diligence (schedule separately — action item)

---

## Design Decisions Still Needed

| Decision | Phase | Notes |
|----------|-------|-------|
| Pantry UX specifics | 8 | Define during phase planning |
| Grocery UX specifics | 8 | Define during phase planning |
| Recipe-pantry matching design | 8 | UI location, matching strictness, staple handling |
| Phase 9 CreateMealModal refresh scope | 9 | Define during Phase 9 planning: what of existing modal survives vs rebuilds |
| Flex meal planning surfacing | 9 | Locked + shortlisted confirmed; where the "3 options for tonight" UX lives |
| Micronutrient daily value display | 10 | Bar chart vs pill list; daily progress vs weekly average |
| Concept cooking guidance flow | 11 | AI prompt design; how it integrates with cooking mode |
| Edit Mode notebook aesthetic | 11 | Spiral binding vs lined paper; inline structural editing approach |
| Recipe list hub search/filter design | 11 | Define during Phase 11 planning; scope specifics TBD |
| Recipe folders basic scope boundaries | 11 | Strict definition (single-user, no sharing, no smart rules) confirmed 4/22; UX specifics TBD |
| Onboarding flow steps | 12 | Minimum: welcome → invite code → signup → profile → permissions → historical cooks |
| Invite system design | 12 | Open signup + admin approval; per-user referral codes |
| TestFlight vs direct App Store | 12 | Currently leaning TestFlight |
| LLC name + entity state | admin track | Delaware/Wyoming vs home state; impacts formation speed |
| Frigo domain availability | admin track | Required for organization Apple Developer enrollment |

---

## Tom's Annotations (Pre-F&F Notes Reconciliation, April 6)

Key inputs from Tom's pre-launch readiness notes that shaped the April 6 reconciliation:

- **Post creation:** "actively working on" — confirmed Phase 7 current scope.
- **NYT integration:** "would be awesome if we could get that shipped at or soon after F&F launch."
- **Concept cooking:** "lots of f&f value this highly" — pulled into Phase 11.
- **Ingredient substitutions:** "would be good to have pre f&f or soon after — even if it's first stab" — v0 added to Phase 11 with 1-session scope.
- **Pantry & grocery:** "feel like all the stuff in pantry and grocery should be addressed pre-launch" — confirmed Phase 8 priority.
- **Nutrition source labeling:** "should all be tagged saying where the stats are coming from and that they should be currently viewed as guidelines and directionally correct" — added to Phase 10.
- **Micronutrients:** "would be good to add pre-launch" — added to Phase 10 (curated subset of 12).
- **Meal-level nutrition:** "feels like it should be easy if we have recipe level" — added to Phase 10.
- **Dietary preferences in onboarding:** "would also be good to incorporate pre-launch" — folded into Phase 10.
- **F&F scale:** "send this F&F round out to lots of my contacts — maybe 100-200 and then allow them to share it with friends and allow / promote it to spread organically" — drives Phase 12 invite/referral design.
- **Onboarding signup model:** "I think i like open signup + admin approval — would be good to also know / document how user heard about app (could we provide users with their own unique codes to share with people so that spread of app use could be traced?)" — confirmed Phase 12 approach.
- **Onboarding historical cook entry:** "Add historical cooking to give users immediate value of identifying recipes they like to cook" — Phase 12 onboarding includes this. Dependency satisfied: Phase 7G (historical cook logging, renumbered from 7E) shipped 2026-04-15.
- **Linecook competitor:** "first authentic competitor on market or close to" — added as action item, not a build task.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sustained 14-16 sessions/week required to hit 4-6 week window | Any break compresses buffer sharply | Build 50% growth buffer into schedule; accept that illness/travel/life pushes launch by the gap |
| Scope grew ~30% this session (26-42 → 33-53 sessions) | Further growth pushes past 2× buffer | Phase 11's Recipe folders stretch is first cut if needed; then must-have items in Phase 11 reverse-priority (starting with ingredient substitutions v0) |
| Pantry/grocery UX overhaul scope creep | Phase 8 doubles in size | Define UX changes during Phase 8 planning, not during build. Scope discipline: bar for adding is "required for F&F to feel coherent" — not "nice to have" |
| Phase 9 meal flows are bigger than estimated (includes flex planning v1 + cross-meal dedup) | Eats Phase 10/11 buffer | Cross-meal dedup budgeted at 2-3 sessions of the 7-10 phase total; scope each workstream separately |
| Micronutrient data source quality | Stats look wrong, undermines trust | Source label disclaimer (Phase 10) addresses partially. Use USDA FDC primary, fall back gracefully |
| LLC formation delays (state approval speed, D-U-N-S processing, domain availability) | Blocks Apple Developer org enrollment, blocks EAS build in Phase 12 | Admin track starts immediately in parallel with Phase 7P (not end of Phase 8) to absorb 2-3 week calendar wall; Stripe Atlas or LegalZoom preferred for speed |
| Frigo domain unavailable for org Apple enrollment | Blocks organization verification path | Identify domain options during admin-track kickoff; fall back to `frigo.app`, `frigo.cooking`, `getfrigo.com`, etc. if primary is taken |
| EAS/TestFlight snags on first attempt | Delays distribution by days-weeks | Buffer in Phase 12. Admin track completes well before Phase 12 starts |
| Testing reveals significant issues | Consumes Phase 12 buffer | 2-week testing window. Prioritize ruthlessly — fix blockers, defer polish |
| Phase 8 scope growth during wireframing (already occurred) | Medium | Session estimate revised 7-12 → 18-28 to reflect actual scope after wireframe iteration + per-checkpoint sizing audit. Natural-language search explicitly flagged as primary scope-cut lever (saves 2 sessions). Brand discovery UI pushed post-F&F (no schema additions needed — captures via existing `grocery_list_items.brand_preference`). Full accessibility audit deferred to post-F&F with per-prompt tap target + label verification sufficient for v1. |
| Phase-7-style 2× scope growth repeats on Phase 8, 9, or 11 | Pushes launch to ~8 weeks | Accept as documented worst-case scenario; the timeline already shows this as the realistic outer bound. Phase 8 already grew ~150% during wireframing before any execution — this is scope *discovery* (happening in planning, the right place for it), not scope *creep*; Phase 11 remains primary scope-cut lever, Phase 8's natural-language search is secondary. |
| Linecook competitor reshapes positioning | Strategic pivot risk | Schedule diligence task separately from build phases; revisit positioning if needed |
| CP6e is the largest single CP of the 8R sequence (4 sub-checkpoints + parallel catalog audit) | Mid-CP slip risk material; could push F&F another 1-2 weeks beyond September | Escape hatch: ship CP6e-Schema + CP6e-Services without UI rewrite (revert to today's UI on the new schema) if execution slips significantly past late-August target. PantryUI and FlowsUI can ship incrementally post-F&F. |
| 8D matching system is un-started, not an "upgrade" as implied by master plan v6.x | High — recipe surfaces lack pantry indicators; "what can I cook" promise undelivered | Schedule 8D immediately after 8R closeout. CP1 + CP2 likely 1-2 sessions of focused build (rebuild rather than retrofit). Bundle cheese duplicate cleanup migration as CP1 Part 0. Scope-cut lever: CP4 (What-can-I-cook screen) could shift to early-post-F&F if CP1+CP2+CP3 are tight. |
| Silent dead reads from dropped `pantry_items` table in service code | Medium — features may render empty when they should show data; tester confusion | 5 specific sites in spaceService + statsService. Audit pass (CC) determines for each: dead-code (delete) or live (re-point to `supplies`). 30-60 min. |

---

## Working Agreements

- **This plan is adaptive, not fixed.** Phase scope, ordering, and session estimates will evolve as we learn. When scope changes, update the affected phase doc, this master plan, and PROJECT_CONTEXT immediately.
- **Track feature roadmap numbers.** Each phase doc lists the Product Feature Roadmap item numbers it touches. When features ship, move, or get deferred, update both the phase doc and DEFERRED_WORK.md.
- **Deferred items live in the active phase doc until phase completion.** At phase completion, items are reconciled into DEFERRED_WORK.md.
- **Phase docs are self-contained.** A new Claude instance reads PROJECT_CONTEXT → this doc → the active phase doc.
- **Services handle ALL Supabase calls.** Components never call the database directly.
- **Never remove existing functionality** unless explicitly instructed.
- **Cookbook loading happens in parallel.** Tom photographs books; extraction runs alongside other work.
- **Design decisions happen in phase planning sessions,** not during Claude Code execution.
- **Admin track starts immediately** in parallel with Phase 7P: LLC formation (Stripe Atlas or LegalZoom for speed), D-U-N-S Number application (free, few days), Frigo domain purchase + minimal website (Apple requires publicly accessible, functional site with matching-domain email). Sequence completes in ~2-3 weeks of calendar wall time.
- **Apple Developer Program enrollment as organization** (not individual) — kicks off once LLC + D-U-N-S + domain are ready, typically end of Phase 8. 24-48h review. "Frigo LLC" (or chosen entity name) will appear as the App Store seller name.
- **Individual Apple enrollment NOT the path** — decision made 2026-04-22 to go org route for brand attribution and future liability/monetization flexibility.
- **Feature playbooks** (per `docs/playbooks/`) are created or updated whenever a feature accumulates ≥2 design iterations or significant testing feedback. See `DOC_MAINTENANCE_PROCESS.md`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-27 | **v6.8 — Phase 10 (Nutrition Depth) shipped end-to-end.** Single-session ship of six sub-phases plus a hot fix: 10A raw/cooked architecture fix (`ingredient_state` column + matview rewrite + fixed silently-broken CONCURRENTLY refresh), 10B USDA micronutrient backfill (~3,431 values across 458 ingredients, 10 new columns), 10C recipe-level micro UI, 10D stats-level micro UI + hoisted Per Day/Per Meal toggle, 10E meal-level nutrition aggregation panel, 10F dietary preferences capture (Settings + browse filter integration). Hot fix: chunked three batch services for PostgREST URL-length resilience (pre-existing latent bug, exposed by 10F's auto-filter). Phase Sequence row + Phase 10 section both moved 🔲 → ✅. Header status line updated: "3 of 5 pre-F&F phases done" (8, 10 complete; 9, 11, 12 remaining). Deferred items captured in DEFERRED_WORK v5.31. Smoke-tested green in Expo Go same day. F&F readiness criterion now needs only Phases 9, 11, 12 to close. |
| 2026-05-19 | **v6.7 — 8E retired, merged to Phase 11; Phase 8 complete pending cleanup.** Per Tom's 2026-05-19 close-out call: 8E-CP1 (Browse rebuild), 8E-CP3 (Locked filter chips pattern), 8E-CP4 (Low stock indicators #31) merged into Phase 11 must-haves. 8E-CP2 (Natural-language search) stays post-launch. Phase 11 estimate revised 7-12 → 9-15. Phase 8 phase-sequence row moved to "🟢 Complete pending cleanup pass" (8R + 8D all shipped). F&F readiness criterion explicitly = Phases 8, 9, 10, 11, 12 all complete. Total remaining build sessions recomputed (32-51 → ~28-44 after 8D ship + 8E→Phase 11 reshuffle). |
| 2026-05-19 | **v6.6 — 8D-CP4 shipped; Phase 8D essentially complete.** CP4 (What-can-I-cook screen + RecipeList match wiring) shipped — new `readyToCookService`, `useReadyToCookRecipes` hook, extracted `RecipeCard`, `WhatCanICookScreen`. Phase Sequence 8D row + header moved to "essentially complete" (CP1→CP4 done; end-of-phase cleanup pass remains). 8E F&F subset (CP1 browse rebuild, CP3 locked filter chips, CP4 low-stock) is next. |
| 2026-05-19 | **v6.5 — 8D-CP1 → CP3 shipped; phase table caught up.** Phase 8D progressed from "NOT SHIPPED" to in-progress: CP1 (matcher primitive), CP1.5 (catalog backfill), CP2 (4-level matcher + substitution whitelist patch), and CP3 (recipe ingredient tap-sheet + match % banner — CP5 missing-to-grocery bundled into CP3) all shipped 2026-05-19. Phase Sequence 8D row + header status updated. NOTE: the 8D row had been stale since v6.4 (still read "Verified NOT SHIPPED 2026-05-15" through the CP1/CP1.5/CP2 ships); this is a catch-up — a fuller 8D reconciliation by Claude.ai is recommended. |
| 2026-05-15 | **v6.4 — 8R closeout + 8D verification finding.** Phase 8R sub-phase table updated to reflect CP6e completion + smoke clean 2026-05-15. Header status caught up to 2026-05-15 reality (was stuck at "Phase 8 execution 8A-CP1 shipped 2026-04-23"). New explicit 8D row added to phase sequence table: NOT SHIPPED, ~3-5 sessions, F&F-blocker. New "May 15 — 8R closeout + 8D verification finding" sub-section in Strategic Context. Two new Risk Register rows: 8D un-started, silent dead reads from `pantry_items`. Time estimates aligned to dashboard v2 arithmetic (32-51 build sessions, 14-18 weeks to F&F). F&F target wording aligned to "late August or early September 2026" across header + scope-decisions + risk register. |
| 2026-05-06 | **v6.3 — CP6e-Lots added to Phase 8R.** Schema + catalog plural audit migrations shipped 2026-05-06. 18 new decisions (D8R-Q43-Q60) capturing lot-tracking model + multi-dimension server-side search. F&F target slips ~3 weeks (late July/August → late August/early September). New Risk Register entry on CP6e size. See PHASE_8R_UNIFIED_NEEDS.md v0.6 for full scope. |
| 2026-04-29 | **v6.2 — Phase 8R inserted; F&F target slips to late July / August; wireframes ✅ shipped same day with audit cycle.** Mid-flight architectural refactor decision: replace lists-as-containers grocery model with unified filter-views over supplies + needs. Pantry + grocery surfaces merge into one schema layer. 8C-Shared sub-phase work (CP1, CP2, CP2b, CP2b.1) shipped 2026-04-28 becomes architectural background but the schema + RLS + service code is throwaway. New 8R phase doc captures 37 architectural decisions (D8R-Q1 through Q37) + 6-CP build plan. Same-day wireframe iteration + audit pass + audit follow-up produced 12 surfaces in single consolidated file at `docs/wireframes/phase_8r/`. F&F target adjusted from early-to-mid June to **late July or August** to accommodate ~4-6 weeks 8R + remaining ~3-5 weeks 8D/8E rewriting against new substrate. Tom committed to the slip with eyes open after sleeping on the decision. |
| 2026-04-23 | **v6.1 — Phase 8 scope expansion delta.** Post-wireframe session + first audit. Phase 8 restructured 4 sub-phases → 5 (8A-8E), then further restructured within 8A/8B/8C per audit to ensure executable-in-order dependency graph. Session estimate 7-12 → 18-28. Net total 33-53 → 44-69. New scope items: Ingredient Detail screen (hero + 4 tabs), Freezer cleanout surface, Natural-language search, Recipe tap-sheet pattern preserving Phase 6G layout, Locked filter chip pattern, View toggle cross-cutting pattern, fraction display utility (restored from v1.0 scope after audit caught the drop). Data model foundation for Path B staleness (UI deferred post-F&F). Brand schema changes dropped (existing `grocery_list_items.brand_preference` captures data). Full detail in `PHASE_8_PANTRY_INTELLIGENCE.md` v2.1 + `docs/wireframes/phase_8/` preserved HTML prototypes (v3, v4, v5). |
| 2026-04-22 | **v6.0 — Phase 7 complete + velocity rebaseline + scope expansion + org route.** Phase 7 marked ✅ Complete (~30 actual sessions vs 12-18 estimate). Forward velocity recalibrated to 14-16 sessions/week (W4 pace as expected, not sprint anomaly). Header switched from target date to duration estimate (~4-6 weeks base, up to ~8 weeks with 2× growth buffer). Session Budget rewritten with three growth scenarios. Phase 7 scope bullets collapsed to phase-doc pointer. **New Phase 7P introduced** (1-2 sessions feed polish: P7-44 pagination + P7-45 pull-to-refresh hang investigation). **Phase 8 must-have list expanded:** Low stock indicators (#31) and Pantry fraction display promoted from nice-to-have. **Phase 9 must-have list expanded:** Multi-user handoff clarity and Cross-meal deduplication (D38) promoted from nice-to-have. **Phase 11 major expansion:** all four nice-to-haves promoted to must-have (Cookbook UX, Cook Soon UX, Concept cooking first-stab, Ingredient subs v0); Recipe list hub search/filter added as must-have; Recipe folders added as stretch (strict scope: single-user, no sharing, no smart rules). **Flex meal planning v1** confirmed in Phase 9 (not Phase 8 — PHASE_8 doc 8D row reconciled in follow-up). **Edit Mode full redesign** deferred to post-launch. **NYT Cooking** positioned as top-of-queue post-launch priority. **Receipt scanning** and **Recipe comments KB** explicitly deferred to post-launch (both flagged as heavier than "if easy" framing suggested). **Org route chosen for App Store distribution** — LLC formation + D-U-N-S + Frigo domain kicks off immediately as parallel admin track. Apple Developer enrollment as organization ends Phase 8. Apple Developer Account signup rule replaced with three-bullet admin track. **Tier tags** ([must]/[stretch]/[post-launch]) introduced inline on all phase scope bullets for clarity. Risk register refreshed: added scope-growth risk, LLC formation risk, domain availability risk; dropped Phase 7 and 7D risks; added 2×-growth-repeat risk. Design Decisions table pruned (multi-dish, historical date picker shipped); new rows added for Phase 9/11 decisions + admin track decisions (LLC state, Frigo domain). Total scope: 33-53 build sessions across Phases 7P-12. |
| 2026-04-07 | **Phase 7D scoping reframing.** 7C marked done. 7D split into three sub-phases (7D data + service / 7E cook→meal handoff / 7F feed rendering) after April 7 scoping session discovered the existing meal model already implements multi-dish multi-cook meals. D12 retired as D21 in PHASE_7_SOCIAL_FEED.md. Old 7E–7J renumbered to 7G–7L. Phase 7 estimate grew from 13-19 to 14-21 sessions. Risk register updated with scope-discipline note (D30 commitment to push meal-rebuild work to Phase 9). New companion doc `_SCOPING_NOTES_7D.md` captures the raw conversation findings and reasoning chain. New stub `PHASE_RECIPE_DISCOVERY.md` for the dish-tap recipe discovery feature surfaced during scoping. |
| 2026-03-17 | Created. Established phase sequence (5-8), scope decisions, timeline, risk register. Based on Roadmap Decision Document + Tom's annotations + planning session. |
| 2026-04-06 | **Major reconciliation.** Phases 5 and 6 marked complete. Phase 7 marked in progress with 11 sub-phases (7A through 7J). Added Phases 9 (Meal & Planning UX), 10 (Nutrition Depth), 11 (Recipe Polish) based on Tom's pre-F&F notes. Renamed Phase 8 from "Pantry Intelligence" to "Pantry Intelligence + Pantry/Grocery UX Overhaul" to reflect scope. Renamed final phase to Phase 12 (Distribution). Added Tom's annotations from April 6 reconciliation. Pulled into pre-launch scope: micronutrients (curated subset of 12), meal-level nutrition, nutrition data source labeling, dietary preferences capture, cookbook UX, cook soon UX, meal flows, concept cooking first-stab, ingredient substitutions v0, Edit Mode redesign. Target launch revised from late May to early-to-mid June. |
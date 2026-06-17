# Frigo — Deferred Work, Review Cut (Pre/Post F&F × Workflow)

**Created:** June 17, 2026 · **Source:** `DEFERRED_WORK.md` v5.39 (canonical) · **For:** Tom's review

This is a **review lens** over the backlog, re-cut from the canonical `DEFERRED_WORK.md` (which is organized by phase-of-origin) into two questions you actually triage on: **does it need to happen before Friends & Family, and which workflow does it touch.** Nothing here is canonical — move items freely; once you've decided, the calls get folded back into `DEFERRED_WORK.md` on a planning pass.

### How items were classified
- **Pre-F&F § A (Flagged)** — the item's own text in DEFERRED_WORK says pre-F&F / F&F-blocker / F&F-prereq / "before launch."
- **Pre-F&F § B (Recommended — your call)** — *I* judged it launch-relevant (security exposure, auth bugs that strand testers, onboarding completeness) even though the backlog didn't explicitly flag it. **These are the ones to rule on.**
- **Post-F&F** — the default bucket: items the backlog calls post-launch/stretch/deferred, **plus** everything whose timing was genuinely unmarked (a backlog item with no urgency signal defaults to post-launch). If any of these feel pre-F&F to you, promote them.
- F&F context assumed: ~100-200 trusted testers on Expo Go — so "polish," "scale," and "nice-to-have feature" items skew post-launch; data-integrity and first-run/onboarding items skew pre.

### Counts (≈)
- **~300 total IDs.** Pre-F&F: **~12 flagged + ~10 recommended-for-your-call.** Resolved this era: **~25** (Appendix). Everything else (~250) sits Post-F&F across the workflows below.

### The umbrella gate (not a DEFERRED_WORK item, but the real blocker)
**Apple Developer org enrollment + EAS/TestFlight** gate all of Phase 12. Site + domain + the edge-fn redeploy (NYT-1) are cleared; enrollment is the remaining long pole. Also pre-launch but tracked in the master plan, not here: privacy policy + account deletion, Phase 9 (Meal & Planning UX), the Phase 11 tail (11A-CP5 etc.).

---

# PART I — PRE-F&F

## § A. Already flagged pre-F&F (in the backlog's own text)

### 🚪 Onboarding & Distribution
- **OB-17** 🔴🧪 — End-to-end test the admin ownership-verification → copy-on-verify **approve→deliver** flow. Machinery shipped (CP6a-2/CP6b) + T8c feeds it; never exercised. Add Tom to `app_admins`, generate a pending row, approve, confirm delivery.
- **OB-15** 🟡 — Rework the T11 staples page ("What do you keep on hand?") design/content before launch.
- **OB-21** 🟡 — Verification-status badges ("pending"/"verified") on the books/library page; pairs with T8c.

### 🥫 Pantry & Grocery
- **OB-14** 🟡🐛 — Pending-invitee can't read the space row → join card shows "Unknown Space." First-run shared-pantry blemish.
- **P8R-D20** 🔴📊 — Pantry **catalog data audit** (pluralization + ~30-50 missing common items). F&F-prereq for supplies/matching to feel complete. *(Distinct from the cookbook catalog, which is seeded.)*

### ⚙️ Platform & Infra
- **T8** 🟡🔧 — 5 stale `pantry_items` query sites in `spaceService`/`statsService` read a dropped table and silently return empty. Fix before testers hit them.
- **T7** 🟡🔧 — Resolve the `@ts-nocheck` pragma on `QuickAddSection.tsx`.
- **OB-3** 🟡🔧 — Bare-"@" renders for NULL-username users; show `display_name` instead. Visible to every tester without a username.

### 🍳 Recipe
- **T10** 🟡🔧 — `missingCount` divergence on `RecipeDetailScreen` (match banner vs tap-sheet count).

### 🧰 Process & Docs
- **P8D-CP4-3** 🟡 — Add an audit step for Claude.ai-extracted recipes — *pre-F&F only if you do more cookbook imports before launch.*

## § B. Recommended for pre-F&F — **your call**

### 🔐 Security / Platform (F&F is trusted, but these are real exposures)
- **NYT-2** 🔴🔧 — Client-side `ANTHROPIC_API_KEY` is bundled into the shipped app (extractable). Move extraction server-side like the book pipeline. *Real key-leak risk even with a trusted cohort.*
- **NYT-3** 🔴🔧 — `recipes` / `recipe_ingredients` / `instruction_sections` / `recipe_source_notes` are anon-readable (no RLS). Project-wide review.
- **OB-2** 🟡🔧 — No admin-auth primitive; `AdminScreen` is effectively unguarded. Worth gating before more people have the build.
- **OB-18** 🟡🐛 — Orphaned-session sign-out: a signed-in user whose account no longer exists gets stranded (this stranded you when a spouse account was deleted). Tester-facing.

### 🚪 Onboarding & Distribution (completeness/decisions)
- **OB-16** 🟢 — *Decision, not build:* keep T9b "Signature recipe" hidden or re-enable it? Resolve before launch.
- **OB-22** 🟡 — `get_invite_cohort` RPC to light up the T5 "Suggested" friends section (today it's empty). Makes Find Friends feel finished.
- **P10F-2** 🟡 — Wire dietary-preferences capture into onboarding (was always parked for "when the onboarding flow exists" — it now exists).
- **NYT-9** 🟡🧪 — One photo-import smoke test of the Sonnet-4.6 vision path (migrated, never end-to-end tested). Cheap confidence check on core extraction.

---

# PART II — POST-F&F (default bucket, by workflow)

## 🍳 Recipe
- **DEF-4/22-2** 🔴 — NYT Cooking integration (the broad roadmap item; provenance/notes/SourceView already shipped — remaining depth is post-launch top-of-queue).
- **OB-19** 🟡💡 — Unified "books & sources" browse grouping (Phase 11 design call).
- **NYT-5** 🟡 — Multi-chef per-co-author pages via a `recipe_chefs` join (today single `chef_id` + display-only co-authors).
- **NYT-4** 🟢 / **NYT-6** 🟢 / **NYT-7** 🟡 / **NYT-8** 🟢 / **NYT-10** 🟢 — all-notes pagination · source-staleness monitor · edge-fn model consistency (`extract-recipe-three-pass` on 4.5) · upstream image-URL normalization · SourceView parity polish.
- **P8D-CP4-1** 🟡 / **P8D-CP4-2** 🟡 — recipe-extraction quality CP (Vision misreads, scored matching) · RecipeReviewScreen review-and-fix UI.
- **P11-FS-5** 🟡🐛 — dead `recipes_with_books` view references in `bookViewService`; rewrite or drop.
- **OB-6** 🟢 / **OB-7** 🟢 / **OB-12** 🟢 — consolidate duplicate `getUserBooks` · extract neutral link-create primitive · `get_books_with_counts` orphan RPC (create or delete).
- **P5-3** 🟡 / **P5-6** 🟢 — recipe markup/editing review (still clunky) · per-step technique tagging (~2,400 steps).
- **DEF-4/22-1** 🟡 — Edit Mode full redesign (notebook aesthetic, structural editing). **DEF-4/22-4** 🟢 — recipe comments knowledge base (#30).
- **E1** 🟡 / **E2** 🟢 — extraction pipeline upgrade to v10+ · gold-standard expansion beyond Ottolenghi.
- **B13** 🟡 — recipe rating UX (smart sections sit empty without ratings). **D3** 🟡 — cooking method/occasion/technique architecture.
- **R2** 🟢 / **R5** 🟢 — ingredient source tracking ("from garden") · recipe cost per serving (229 ingredients have cost data).
- **P6-30** 🟢 — RecipeDetail INGREDIENTS/PREPARATION tab toggle. **P6-T2** 🟢 — 8 table-only recipes missing step text. **P6-T5** 🟢 — `instruction_sections` table vs JSONB redundancy. **P7-53** 🟢 — cookbook page-number deep-linking. **N5** 🟡 — extraction outputs `ingredient_role`.

## 🍳 Cooking (Cooking Mode)
- **P6-2** 🟡 / **P6-3** 🟡 — CookingScreen simplification (ClassicView default) · multi-recipe simultaneous cooking.
- **P6-6 / P6-7 / P6-8 / P6-11 / P6-12 / P6-13 / P6-14** (mostly 🟡/🟢) — pantry-fraction display rethink · "add missing to grocery" treatment · timers in step-focus · NYT-style "Add a Note" modal · Read-More fade · ingredient-name bolding · native ActionSheet overflow.
- **P6-T1** 🟡 — PanResponder → gesture-handler upgrade (swipe conflict).
- **Cooking moonshots / lower-priority (all 🟢, post-launch):** P6-9, P6-15 (WatchOS), P6-16 (AI timeline), P6-17 (serving adjuster), P6-18 (voice commands), P6-19 (offline), P6-20/P6-31 (ingredient alternatives), P6-21 (voice transcription), P6-22 (timeline view), P6-23/P6-24 (post-cook photo/voice), P6-25 (partner tagging), P6-26 (mark-cooked+rate), P6-27 (page refs), P6-28 (yield display), P6-29 (step qty scaling).
- **P7-3 / P7-4 / T5** 🟢🔧 — delete deprecated `PostCookFlow.tsx` · extract LogCookSheet inline SVGs. **P7-7** 🟡 / **P7-8** 🟡 — voice memo · photo upload on LogCookSheet.

## 🥫 Pantry & Grocery
*(The single largest post-launch bucket — the Phase 8/8R backlog. All deferred at phase completion; none flagged pre-F&F except OB-14/P8R-D20 above.)*
- **Matching & catalog intelligence (mostly 🟢 unless noted):** P8-6 (category-level "any cheese"), P8-7 (quantity-aware), P8-13 🟡 (cross-unit reconciliation), P8-14 🟡 (soft-delete on zero), P8R-D29 🟡 (per-supply shelf-life), P8R-D33 🟡 (expiry in Attention), T11/T26 (bulk-match scale contingency).
- **Grocery/views UX:** P8-2 🟡 (brand discovery UI), P8-3 🟡 (tracked-item staleness UI), P8-4/P8-17/P8-18 (aisle overrides, plant-protein subclass, cross-list auto-dismiss), P8R-D1/D2/D3/D5/D8/D10/D11/D12/D13/D14/D16/D17/D25/D27/D30/D34/D35/D36 (auto-spawn thresholds, OR-filter views, add-time combine, tag hierarchy, regulars defaults, cold-start polish, pickers, idempotency, helpers, unit-picker null-mode…).
- **Lots / depletion:** P8-5 🟡 (silent auto-depletion), P8-8 (thaw-time), P8-21 (undo cleanup), P8R-D22 🟡 (receipt-scan → lots), P8R-D23 (per-lot fill level), P8R-D31 (per-supply auto-demote toggle), P8R-D32 (variant migration tooling), P8R-UX6-1.
- **Hero/last-confirmed tuning (post-data):** P8R-UX5-1/2/3, P8R-UX4-1/2/3, P8R-D15/D18 (search/count RPCs at scale), P8R-D19 🟡🐛 (PantryScreen blank — monitor), P8-22 🟡 (state cycling on ManageStaples — "F&F-candidate," your call).
- **Likely superseded (verify then drop):** P8-25, P8-26 (create-list modal — 8R replaced lists with views).
- **Misc:** P8-12 (staples section headers), B20 🟢 (counter-storage SVG icon), OB-10 🟢 (members-invite-members product Q), P8-1 🟡 (full a11y audit across Phase 8), DEF-4/22-3 🟢 (receipt scanning).

## 🗓️ Meal Planning
- **P7-47** 🟡 — duplicate meal-event detection + merge. **P7-48** 🟡 / **P7-50** 🟡 — planned-dish entry · RSVP redesign under the event model.
- **P8-9** 🟢 / **P8R-D9** 🟢 — auto-schedule thawed items / recipe-add urgency from the meal calendar.
- **R6** 🟡 — personal daily eating log / leftovers.
*(Note: the bulk of Phase 9 Meal & Planning UX is master-plan scope, not backlog — it's pre-F&F there.)*

## 👥 Social & Feed
- **Perf:** P7-44 🔴 (feed pagination — scheduled Phase 7P), P7-74 🟡 (hydrateEngagement N+1), P7-75 🟢 (batched meal-events), PL-H1 🟡 (highlights RPC).
- **Cleanup/tech-debt:** P7-2, P7-24, P7-25 🟡, P7-100/P7-102 (legacy meal-detail routes), P7G-1 🟡/P7G-2, P7H-1 🟡/P7H-2, P7M-1/P7M-2 🟡 (StarRating gesture conflict), DQ-1 (orphaned `parent_meal_id`).
- **Detail-screen polish (all 🟢/🟡, post):** P7-80/81/82/83/84/86/89/91/93/94/95/96b/99.
- **Future feature sub-phases (post-launch):** eater ratings stack (P7-32/33/34/35, P7-93/94/96b), @-mentions + notifications (P7-36/37/38), tag-accept auto-draft (P7-46), retroactive participant claim (P7-17, R8), privacy rules (P7-21), host-recap (P7-49), related-cooks (P7-51), collage hero (P7-54), comments unification (P7-55), shared-media notifications (P7-56), feed overflow menu (P7-63), per-photo dish tags (P7-39), flip-card concept (P7-42), photo aspect-ratio at upload (P7-57), leave-event cascade (P7-61).
- **OB-13** 🟢 — UserSearchScreen fire-and-forget follower-count increments. **B8** 🟢 — click-to-see-friends-by-recipe modal.

## 🔍 Discovery & Search
- **P11-FS-1** 🟡 — port the new recipe-search surface to BookView for parity. **P11A-CP5-deferred-1** 🟢 — search-lens label in RefineSheet header.
- **B1** 🟡 / **B10** 🟡 — flavor-profile system + radar display. **B2** 🟡 — personalized/learned tags. **B3** 🟢 — visual grid browse. **(chevron)** 🟢🐛 — tap-target fix.
- **D4-14/15/16/17** 🟢 — stats drill-down filters (chef/book/ingredient/method params declared, not consumed). **D4-26** 🟡 — Frontier suggestions v2.
- **P8-10** 🟢 / **P8-11** 🟢 — conversational multi-turn search · app-level voice recording. **P7-40/41** 🟢 — viewer taste profile + vibe personalization. **P7-52** 🟢 — personalized chef-page lens. **R7** 🟡 — recipe-discovery feature. **R9** 🟢 — concept-cooking inline suggestions.

## 🍎 Nutrition & Stats
- **P10C-1** 🟡 / **P10C-2** 🟢 / **P10D-1** 🟢 — per-user DV personalization · manual DV override · micro goal sliders.
- **P10F-1** 🟡 — FDA Big-9 allergen flags (peanut/fish/sesame) + backfill. **P10F-3** 🟢 — stats compliance summary card. **P10E-1** 🟢 — narrower DietaryFlagSource type.
- **P10-Followup-1** 🟡 — RPC for batch nutrition services (URL-length risk). **R1** 🟡 — dietary-prefs table + settings (largely shipped 10F; verify/close).
- **D4 data gaps:** D4-1 🟡 (micro levels — superseded by 10B, verify), D4-2 🟡, D4-3 🟡, D4-4 🟢. **D4 features:** D4-12/13/39, DI-2/3/6. **D4 tech-debt:** D4-10 🟡 (a11y), D4-11, D4-21, D4-37, DI-1, DI-7. **D4 polish (all 🟢):** D4-25/27/28/29/30/33/35/36/38.
- **Nutrition foundation:** N2 🟡 (vitamins/minerals — superseded by 10B, verify+close), N4 🟢, N7 🟢; gaps NG1/NG2🔴/NG4/NG5 + ideas I1/I2/I3/I4/I7🟡/I9🟡. *(NG2/I6 raw-vs-cooked largely addressed by Phase 10A — confirm and close.)*
- **T33 / T34** 🟢 — `lib/constants/` vs `constants/` drift · orphan placeholder styles in StatsNutrition.

## ⚙️ Platform & Infra
- **OB-1** 🟡 (validate_invite_code anon SECURITY DEFINER — accepted), **OB-11** 🟡 (definer-helper p_user_id exposure), **OB-4** 🟡🧪 / **OB-5** 🟢 (OAuth smoke when S2 ships · DROP username column), **OB-20** 🟢 (📷→CameraIcon), **OB-23** 🟢 (1000-row-cap watch list).
- **P7-24** 🟢 (silent error-swallowing audit), **P7-59** ⚪ (migration rollback — forward-only by design), **P8R-D21** 🟢 (migration file move), **T3** 🟡 (schema-change propagation), **T4** 🟢 (relocate stray services), **T6** 🟢 (oldTheme deletion), **T9** 🟢 (schema CSVs into repo), **T16/T19** 🟢 (base_ingredient_id constraint/trigger), **T32** 🟢 (TS1382 in CookSoonSection/DayMealsModal), **B21** 🟢 (emoji-constant cleanup), **P6-T3** 🟢 (Android notif channel), **P6-T6** 🟢 (pending-count toast), **DI-7** 🟢 (avatar fallback), **R4** 🟢 (wearable research).

## 📊 Data Quality
- **Recipe/media:** P7-72 🟡 (~347 image filenames), P7-73 🟡 (`posts.photos` shape), P7-79 🟡 (~173 broken URLs), B16/B17/B18 🟢 (cuisine/cooking-method normalization), P6-T4 🟢, P5-1 🟡/P5-2/P5-5 🟢 (base_ingredient_id wiring, gardening data, difficulty backfill), P8-T2 🟡, P6-1 🔴 (cook-time backfill, 60/475 — large but not blocking).
- **Catalog covers (cookbook):** CAT-1 🟡 (rehost 298 hotlinked covers — ~253/311 already hosted), CAT-2 🟢 (11 blank-ISBN), CAT-3 🟢 (Milk Street editions).
- **Pantry catalog substitution intelligence (all 🟢 unless noted):** P8D-CP3.1-1 🟡, P8D-CP3-1/2/3/4, P8D-CP4-4/5/6/7/8, T12/T13/T14/T15/T17/T18/T21/T23/T24/T25/T28/T30/T31🟡 (hero_ingredients refactor), P11-FS-2 🟡 (chef attribution backfill), P11-FS-3 🟡 (cooking_methods), P11-FS-4 🟡, P11-FS-6.
- **Nutrition catalog:** N3 🟢 (10 unmapped USDA), I5 🟢, P10A-1 🟡 (ingredient_state auto-populate), P10B-1/2/4/5 🟡 (traceability, legume states, FDC mis-maps, GRANT process).

## 🧰 Process & Docs
- **P8R-D37** 🟢 (Q54-OVERRIDE wireframe divergence), **P8R-D38** ⚪ (CP6e PK artifacts stale), **P7-43** 🟢 (doc backfill), **P8-T1** 🟢 (CLAUDE.md theme path), **T27** 🟢 (smoke harness isolation), **PH-1** 🟢 (PROCESS_WATCHPOINTS review).

---

# Appendix — Resolved this era (reference only; prune from canonical on next reconcile)
NYT-1 (edge-fn redeploy, 2026-06-17) · P7-23 (migrations under VC, 2026-06-09) · stale extraction child-savers (2026-06-11) · P11-input-1 (active dietary filter visibility) · P6-10 (ingredient tap-to-steps) · T20/T22 (4-level soft match / always-available skip) · T29 (smoke harness expectation cleanup) · P10B-3 (matview CONCURRENTLY) · N1 (subproject service integration) · P8-15/16/19/20/23/24 · P8R-D4/D6/D7/D24/D26/D28.

---

*Re-cut by CC 2026-06-17 from DEFERRED_WORK.md v5.39 per Tom's request. Classification (esp. Part I § B and the Post-F&F default) is a recommendation for Tom's review, not a canonical decision — fold ratified calls back into DEFERRED_WORK.md on a Claude.ai planning pass.*

# PK Code Snapshots — Tracking Doc
**Last Full Refresh:** 2026-04-22
**Version:** 1.1

---

## Purpose

Tracks every code file currently mirrored into project knowledge as a dated snapshot. See `DOC_MAINTENANCE_PROCESS.md` Section 4 "Code Snapshots in PK" for the governing rules.

**Staleness risk column:**
- **Low** — file hasn't been touched since the last refresh; drift unlikely
- **Medium** — file was touched in recent phases but not actively being edited
- **HIGH** — CC has edited the file since the last refresh (auto-bumped per `CLAUDE.md` Rule E / `DOC_MAINTENANCE_PROCESS` Section 8 rule); read with skepticism and consider direct upload

**Current active phase:** _(update this at every sub-phase transition)_

---

## Tier assignment

Tier assignments can be revised via a deliberate edit to this doc. Do not move files between tiers ad-hoc during refreshes or Rule E staleness-flagging — both are mechanical operations that should not re-interpret tier membership. If a file's value-in-PK has changed enough to justify retiering (e.g., a Tier 3 component has become frequently consulted for debugging and warrants Tier 1 treatment, or vice versa), change the tier assignment in a standalone commit with a changelog note, not as a side effect of some other operation.

**File deletion:** when a file is deleted from the repo, remove its row from the tier tables below in the same commit that deletes the file. Leaving stale rows pointing at deleted files breaks refresh atomicity (the refresh prompt's "STOP if file not in repo" rule would fire on every run).

---

## Tier 1 — Services, utilities, constants, type contracts

| File | Snapshot Date | Last Touched By | Staleness Risk | Notes |
|------|--------------|-----------------|----------------|-------|
| `lib/services/annotationService.ts` | 2026-04-22 | | Low | |
| `lib/services/bookViewService.ts` | 2026-04-22 | | Low | |
| `lib/services/commentsService.ts` | 2026-04-22 | | Low | |
| `lib/services/cookCardDataService.ts` | 2026-04-22 | Phase 7I CP5 / CP6 | Low | SELECT-column SSoT per v4.0 arch doc |
| `lib/services/cookingService.ts` | 2026-04-22 | Phase 7B-Rev | Low | recipe_step_notes CRUD |
| `lib/services/eaterRatingsService.ts` | 2026-04-22 | Phase 7I CP6 | Low | D43 private per-eater ratings |
| `lib/services/feedGroupingService.ts` | 2026-04-22 | Phase 7I CP4 / 7G | Low | `buildFeedGroups`; sort key switched to cooked_at in 7G |
| `lib/services/highlightsService.ts` | 2026-04-22 | Phase 7I | Low | |
| `lib/services/imageStorageService.ts` | 2026-04-22 | | Low | |
| `lib/services/ingredientService.ts` | 2026-04-22 | | Low | |
| `lib/services/ingredientSuggestionService.ts` | 2026-04-22 | | Low | |
| `lib/services/instructionSectionsService.ts` | 2026-04-22 | | Low | |
| `lib/services/mealPlanService.ts` | 2026-04-22 | | Low | |
| `lib/services/mealService.ts` | 2026-04-22 | Phase 7I CP2 / CP6 | Low | `getMealEventForCook`, `getMealEventDetail` |
| `lib/services/nutritionGoalsService.ts` | 2026-04-22 | Phase 4 | Low | |
| `lib/services/nutritionService.ts` | 2026-04-22 | | Low | |
| `lib/services/postParticipantsService.ts` | 2026-04-22 | Phase 7I CP7 | Low | PostType union cleaned |
| `lib/services/postService.ts` | 2026-04-22 | Phase 7M / 7L / 7G | Low | UpdatePostPatch extended; computeDefaultVisibility |
| `lib/services/recipeAnnotationsService.ts` | 2026-04-22 | | Low | |
| `lib/services/recipeHistoryService.ts` | 2026-04-22 | Phase 7I CP5 | Low | `getCookHistoryForUserRecipe` |
| `lib/services/recipeService.ts` | 2026-04-22 | Phase 7B-Rev | Low | Top-level (distinct from extraction one); 20 lines, currently only `deleteRecipe` |
| `lib/services/shareService.ts` | 2026-04-22 | Phase 7J | Low | `shareRecipe`, `sharePost` |
| `lib/services/spaceService.ts` | 2026-04-22 | | Low | |
| `lib/services/statsService.ts` | 2026-04-22 | Phase 4 | Low | 38 exports |
| `lib/services/subscriptionService.ts` | 2026-04-22 | | Low | |
| `lib/services/unitConverter.ts` | 2026-04-22 | | Low | |
| `lib/services/userRecipeTagsService.ts` | 2026-04-22 | | Low | |
| `lib/services/vibeService.ts` | 2026-04-22 | Phase 7F | Low | `getRecipeVibe`, `computeMealVibe` |
| `lib/services/recipeExtraction/bookService.ts` | 2026-04-22 | | Low | 10 exports; Phase 7K backfill callers |
| `lib/services/recipeExtraction/chefService.ts` | 2026-04-22 | Phase 7K | Low | `backfillChefIds` added 2026-04-17 |
| `lib/services/recipeExtraction/claudeVisionAPI.ts` | 2026-04-22 | | Low | |
| `lib/services/recipeExtraction/imageProcessor.ts` | 2026-04-22 | | Low | |
| `lib/services/recipeExtraction/index.ts` | 2026-04-22 | | Low | Barrel export |
| `lib/services/recipeExtraction/ingredientMatcher.ts` | 2026-04-22 | | Low | Instruction text highlighting |
| `lib/services/recipeExtraction/recipeService.ts` | 2026-04-22 | Phase 3A | Low | saveRecipe (distinct from top-level) |
| `lib/services/recipeExtraction/unifiedParser.ts` | 2026-04-22 | | Low | |
| `lib/services/recipeExtraction/webExtractor.ts` | 2026-04-22 | | Low | |
| `lib/utils/mealTypeHelpers.ts` | 2026-04-22 | Phase 7E Fix Pass 1 | Low | Extracted from postService |
| `lib/utils/timerDetection.ts` | 2026-04-22 | Phase 6 | Low | detectTimersInText + formatTime |
| `constants/cookingMethods.ts` | 2026-04-22 | Phase 7M | Low | 16-value DB CHECK match |
| `constants/pantry.ts` | 2026-04-22 | | Low | |
| `constants/vibeIcons.ts` | 2026-04-22 | | Low | |
| `lib/types/cooking.ts` | 2026-04-22 | Phase 6 | Low | StepNote, CookingSession, TimerHistoryEntry, NormalizedStep |
| `lib/types/feed.ts` | 2026-04-22 | Phase 7I | Low | CookCardData, FeedGroup, LinkContext, MealEventContext |
| `lib/types/grocery.ts` | 2026-04-22 | | Low | Grocery list/item/template types |
| `lib/types/pantry.ts` | 2026-04-22 | | Low | PantryItem, StorageLocation, IngredientWithPantryData |
| `lib/types/recipeExtraction.ts` | 2026-04-22 | | Low | ExtractedRecipeData, ProcessedRecipe, Book, Chef |
| `lib/types/recipeFeatures.ts` | 2026-04-22 | | Low | DB-corrected Book + author types |
| `lib/types/search.ts` | 2026-04-22 | | Low | SearchOptions, SearchResult, SearchError class |
| `lib/types/space.ts` | 2026-04-22 | | Low | SpaceRole, SpaceAction, permissions, invitations |
| `lib/types/store.ts` | 2026-04-22 | | Low | Store, UserIngredientPreference, view modes |
| `lib/groceryListsService.ts` | 2026-04-22 | | Low | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/groceryService.ts` | 2026-04-22 | | Low | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/pantryService.ts` | 2026-04-22 | | Low | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/searchService.ts` | 2026-04-22 | | Low | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/storeService.ts` | 2026-04-22 | | Low | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/ingredientsParser.ts` | 2026-04-22 | | Low | Core ingredient matching pipeline (755 lines). Currently at lib/ root; review location during the lib/services/ relocation pass (T4). |

---

## Tier 2 — Screens and key interaction components

| File | Snapshot Date | Last Touched By | Staleness Risk | Notes |
|------|--------------|-----------------|----------------|-------|
| `screens/AddRecipeFromPhotoScreen.tsx` | 2026-04-22 | | Low | |
| `screens/AddRecipeFromUrlScreen.tsx` | 2026-04-22 | | Low | |
| `screens/AdminScreen.tsx` | 2026-04-22 | | Low | |
| `screens/AuthorViewScreen.tsx` | 2026-04-22 | | Low | |
| `screens/BookDetailScreen.tsx` | 2026-04-22 | Phase 4 | Low | |
| `screens/BookViewScreen.tsx` | 2026-04-22 | | Low | |
| `screens/ChefDetailScreen.tsx` | 2026-04-22 | Phase 4 | Low | |
| `screens/CommentsScreen.tsx` | 2026-04-22 | Phase 7N | Low | P7-85 keyboard avoidance |
| `screens/CookDetailScreen.tsx` | 2026-04-22 | Phase 7M / 7N | Low | Overflow collapsed 6→2; 7N polish |
| `screens/CookingScreen.tsx` | 2026-04-22 | Phase 6 / 7B-Rev | Low | |
| `screens/CookSoonScreen.tsx` | 2026-04-22 | | Low | |
| `screens/DrillDownScreen.tsx` | 2026-04-22 | Phase 4 | Low | |
| `screens/EditMediaScreen.tsx` | 2026-04-22 | | Low | |
| `screens/EditPostScreen.tsx` | 2026-04-22 | Phase 7M | Low | NEW ~1,178 lines |
| `screens/EditProfileScreen.tsx` | 2026-04-22 | | Low | |
| `screens/FeedScreen.tsx` | 2026-04-22 | Phase 7I CP4 / 7G / 7M FP1 | Low | cook-post-centric rewrite |
| `screens/GroceryListDetailScreen.tsx` | 2026-04-22 | | Low | |
| `screens/GroceryListsScreen.tsx` | 2026-04-22 | | Low | |
| `screens/LoginScreen.tsx` | 2026-04-22 | | Low | |
| `screens/MealDetailScreen.tsx` | 2026-04-22 | | Low | Deprecated-but-extant; P7-100 |
| `screens/MealEventDetailScreen.tsx` | 2026-04-22 | Phase 7I CP6 | Low | L7 detail screen |
| `screens/MissingIngredientsScreen.tsx` | 2026-04-22 | | Low | |
| `screens/MyMealsScreen.tsx` | 2026-04-22 | Phase 7I CP7 | Low | post_type='meal_event' fix |
| `screens/MyPostDetailsScreen.tsx` | 2026-04-22 | | Low | Deprecated-but-extant; P7-102 |
| `screens/MyPostsScreen.tsx` | 2026-04-22 | | Low | Deprecated-but-extant; P7-102 |
| `screens/PantryScreen.tsx` | 2026-04-22 | | Low | |
| `screens/PendingApprovalsScreen.tsx` | 2026-04-22 | | Low | |
| `screens/ProfileScreen.tsx` | 2026-04-22 | | Low | |
| `screens/RecipeDetailScreen.tsx` | 2026-04-22 | Phase 7B-Rev / 7J | Low | |
| `screens/RecipeExtractionLoadingScreen.tsx` | 2026-04-22 | | Low | |
| `screens/RecipeListScreen.tsx` | 2026-04-22 | Phase 3A | Low | |
| `screens/RecipeReviewScreen.tsx` | 2026-04-22 | | Low | |
| `screens/RegularItemsScreen.tsx` | 2026-04-22 | | Low | |
| `screens/SettingsScreen.tsx` | 2026-04-22 | Phase 7L / 7K | Low | visibility picker + chef backfill trigger |
| `screens/SignupScreen.tsx` | 2026-04-22 | | Low | |
| `screens/SpaceSettingsScreen.tsx` | 2026-04-22 | | Low | |
| `screens/StatsScreen.tsx` | 2026-04-22 | Phase 4 / 7H | Low | My Posts → CookDetail |
| `screens/StoresScreen.tsx` | 2026-04-22 | | Low | |
| `screens/UserPostsScreen.tsx` | 2026-04-22 | Phase 4 | Low | |
| `screens/UserSearchScreen.tsx` | 2026-04-22 | | Low | |
| `screens/YasChefScreen.tsx` | 2026-04-22 | | Low | |
| `components/feedCard/CookCard.tsx` | 2026-04-22 | Phase 7I CP3 / 7N CP2 | Low | Three-zone gesture pattern |
| `components/feedCard/groupingPrimitives.tsx` | 2026-04-22 | Phase 7I CP3 / CP3.5 | Low | Preheads, group headers, linked stacks |
| `components/feedCard/sharedCardElements.tsx` | 2026-04-22 | Phase 7I / 7N CP2 | Low | `onPhotoPress` added in 7N |
| `components/stats/StatsOverview.tsx` | 2026-04-22 | Phase 4 | Low | Overview sub-page coordinator |
| `components/stats/StatsRecipes.tsx` | 2026-04-22 | Phase 4 | Low | Recipes sub-page coordinator |
| `components/stats/StatsNutrition.tsx` | 2026-04-22 | Phase 4 | Low | Nutrition sub-page coordinator |
| `components/stats/StatsInsights.tsx` | 2026-04-22 | Phase 4 | Low | Insights sub-page coordinator |
| `components/stats/WeeklyChart.tsx` | 2026-04-22 | Phase 4 | Low | 5-mode SVG chart with tappable dots |
| `components/stats/CalendarWeekCard.tsx` | 2026-04-22 | Phase 4 | Low | 7-day emoji grid + streak |
| `components/stats/MostCookedPodium.tsx` | 2026-04-22 | Phase 4 | Low | 3-pedestal podium, 5-way toggle |
| `components/stats/ConceptBubbleMap.tsx` | 2026-04-22 | Phase 4 | Low | Size-scaled circles, 3 tiers |
| `components/stats/GrowthTimeline.tsx` | 2026-04-22 | Phase 4 | Low | Monthly milestones |
| `components/stats/CookingPersonalityCard.tsx` | 2026-04-22 | Phase 4 | Low | Dark teal template narrative |
| `components/stats/FrontierCards.tsx` | 2026-04-22 | Phase 4 | Low | Horizontal scroll suggestions |
| `components/stats/GatewayCard.tsx` | 2026-04-22 | Phase 4 | Low | Tappable overview card |
| `components/stats/SectionHeader.tsx` | 2026-04-22 | Phase 4 | Low | Kitchen/Frontier dividers |
| `components/stats/MealTypeDropdown.tsx` | 2026-04-22 | Phase 4 | Low | Anchored popup via measureInWindow |
| `components/stats/PeriodToggle.tsx` | 2026-04-22 | Phase 4 | Low | Period pill toggle with compact variant |
| `components/cooking/ClassicView.tsx` | 2026-04-22 | Phase 6 | Low | Full scrollable cookbook view |
| `components/cooking/SectionCard.tsx` | 2026-04-22 | Phase 6 | Low | Step cards with current/done/future states |
| `components/cooking/IngredientSheet.tsx` | 2026-04-22 | Phase 6 | Low | Pull-up ingredient bottom sheet |
| `components/cooking/TimerDetail.tsx` | 2026-04-22 | Phase 6 | Low | Expanded timer with controls |
| `components/LogCookSheet.tsx` | 2026-04-22 | Phase 7B-Rev / 7G / 7M / 7L | Low | StarRating delegation; cookedAt; default_visibility |

---

## Tier 3 — Supporting components and navigation

| File | Snapshot Date | Last Touched By | Staleness Risk | Notes |
|------|--------------|-----------------|----------------|-------|
| `App.tsx` | 2026-04-22 | Phase 7M / 7H / 7I CP5/CP6 | Low | FeedStack + StatsStack route registrations |
| `contexts/CookingTimerContext.tsx` | 2026-04-22 | Phase 6 | Low | |
| `contexts/LogoConfigContext.tsx` | 2026-04-22 | | Low | |
| `contexts/SpaceContext.tsx` | 2026-04-22 | | Low | |
| `components/cooking/StepIngredients.tsx` | 2026-04-22 | Phase 6 | Low | Two-column ingredient list per step |
| `components/cooking/StepNoteInput.tsx` | 2026-04-22 | Phase 7B-Rev | Low | Inline note input |
| `components/cooking/StepNoteDisplay.tsx` | 2026-04-22 | Phase 7B-Rev | Low | Saved step-note card |
| `components/cooking/IngredientDetailPopup.tsx` | 2026-04-22 | Phase 6 | Low | Ingredient tap popup |
| `components/cooking/CompactTimerBar.tsx` | 2026-04-22 | Phase 6 | Low | Single-line timer pills |
| `components/cooking/ViewModeMenu.tsx` | 2026-04-22 | Phase 6 | Low | Step-by-step vs classic dropdown |
| `components/cooking/SectionDots.tsx` | 2026-04-22 | Phase 6 | Low | Progress dots per section |
| `components/UserAvatar.tsx` | 2026-04-22 | | Low | Emoji/URL/null handling |
| `components/RecipeNutritionPanel.tsx` | 2026-04-22 | Phase 3A | Low | Collapsible macros + quality tier |
| `components/DietaryBadgeRow.tsx` | 2026-04-22 | Phase 3A | Low | 8 dietary flags |
| `components/MarkupText.tsx` | 2026-04-22 | | Low | Strikethrough + edit markup for annotations |
| `components/StarRating.tsx` | 2026-04-22 | Phase 7M | Low | Extracted from LogCookSheet |
| `components/TimesMadeModal.tsx` | 2026-04-22 | Phase 7B-Rev | Low | Historical cook counts stepper |
| `components/NutritionGoalsModal.tsx` | 2026-04-22 | Phase 4 | Low | 6-nutrient stepper + daily/per-meal toggle |
| `components/FilterDrawer.tsx` | 2026-04-22 | Phase 3A | Low | Recipe filter drawer |
| `components/SpaceSwitcher.tsx` | 2026-04-22 | | Low | Dropdown for switching shared spaces |
| `components/MealInvitationsCard.tsx` | 2026-04-22 | | Low | Pending meal invites with accept/decline |
| `components/PendingSpaceInvitations.tsx` | 2026-04-22 | | Low | Pending space invitation responder |
| `components/InSheetMealCreate.tsx` | 2026-04-22 | Phase 7E | Low | In-sheet meal creation + inline tagging |
| `components/MadeOtherDishesSheet.tsx` | 2026-04-22 | Phase 7E | Low | Post-publish planned-meal suggestions |
| `components/MealPicker.tsx` | 2026-04-22 | | Low | Attach to existing meal sub-view |
| `components/CreateMealModal.tsx` | 2026-04-22 | | Low | Create-meal modal with Quick Add Recipe |
| `components/MealPlanSection.tsx` | 2026-04-22 | | Low | Meal plan items with state + claim actions |
| `components/MealCalendarView.tsx` | 2026-04-22 | | Low | Month/week calendar for meals |
| `components/QuickMealPlanModal.tsx` | 2026-04-22 | | Low | Quick add recipe to meal plan |
| `components/CategoryHeader.tsx` | 2026-04-22 | | Low | Collapsible pantry family header |
| `components/TypeHeader.tsx` | 2026-04-22 | | Low | Collapsible ingredient type header |
| `components/PantryItemRow.tsx` | 2026-04-22 | | Low | Single-line pantry row with stock badges |
| `components/PostActionMenu.tsx` | 2026-04-22 | | Low | Legacy; P7-102 |
| `components/GroceryListItem.tsx` | 2026-04-22 | | Low | Single-line grocery item with cart toggle |
| `components/ParticipantsListModal.tsx` | 2026-04-22 | | Low | All cooking participants listing (Strava-style) |

**Tier 3 calibration (v1.1, 2026-04-22):** the 35-file Tier 3 set was calibrated against the full 221-file codebase inventory (`_claudeai_context/tier_inventory_2026-04-22.md`, ephemeral). Files included are those Claude.ai reaches for during planning/design/cross-cutting sessions: shared display primitives (UserAvatar, RecipeNutritionPanel, DietaryBadgeRow, MarkupText, StarRating), complex modal UX references (NutritionGoalsModal, CreateMealModal, FilterDrawer), meal/social surfaces (MealInvitationsCard, MealPlanSection, MealCalendarView, MealPicker, InSheetMealCreate, MadeOtherDishesSheet), pantry UI primitives (CategoryHeader, TypeHeader, PantryItemRow), and framework files (App.tsx, contexts/). Modals and pickers focused on implementation (all `Add*Modal`, `Edit*Modal`, picker files, inline editors) are Tier 4 — CC reads on demand. Revisit the Tier 3 list at the Phase 9 boundary: drop any files Claude.ai hasn't consulted in 4–6 weeks, add any Tier 4 files that have become frequently consulted. Changes via deliberate edit per the "Tier assignment" section.

---

## Excluded from snapshots (intentional)

These categories are explicitly not mirrored into PK, per `DOC_MAINTENANCE_PROCESS.md` Section 4:

- `components/icons/` — 70+ individual icon files, near-zero pattern-finding value
- `supabase/functions/` — edge functions, specialized, rarely referenced by Claude.ai
- `scripts/*.py` — one-off classification/backfill scripts
- `package.json`, `package-lock.json`, build configs
- `assets/`, `svg-source/`
- Test files (`*.test.*`, `__tests__/`)

### Files explicitly excluded despite superficially matching tier rules

- `lib/types/env.d.ts` — TypeScript ambient module declaration for `@env`; 2-line infra file, no planning value
- `lib/oldTheme.ts` — legacy theme constants; see `DEFERRED_WORK.md` T6 for review-and-delete tracking
- `lib/testParser.ts` — ad-hoc test script; 28 lines, not production code
- `lib/supabase.ts` — 14-line Supabase client initialization; stable infra, no planning reference value
- `screens/LogoPlaygroundScreen.tsx` — dev-only playground for logo configuration; 971 lines but zero user-facing surface
- `components/cooking/PostCookFlow.tsx` — DEPRECATED (merged into `LogCookSheet` 'full' mode April 2026); see T5 to delete
- Stats primitive components (`CompactBarRow`, `ComparisonBars`, `CookbookProgressRow`, `DiversityBadge`, `DrillDownPanel`, `GoalRow`, `IngredientFilterPills`, `MiniBarRow`, `NutrientRow`, `RankedList`, `SignatureIngredientGroup`, `StockUpCard`, `StreakDots`, `TappableConceptList`) — 14 files that implement sub-page coordinators; Claude.ai references the coordinators (StatsOverview/StatsRecipes/etc.), not the primitives
- `components/branding/*` — Logo + 6 branding icons; visual brand assets, not planning material

If a specific file from an excluded category becomes useful mid-session, Tom uploads it directly via `/mnt/user-data/uploads/` rather than adding to the snapshot set. If a pattern of "I keep needing this file" emerges, promote it to the appropriate tier via a deliberate edit to this doc — not ad-hoc.

---

## Refresh history

| Date | Trigger | Tier 1 count | Tier 2 count | Tier 3 count | Notes |
|------|---------|--------------|--------------|--------------|-------|
| 2026-04-22 | Initial seed | 42 | 46 | 72 | First population at v5.1 landing. Actual upload executed by `CC_PROMPTS/refresh_pk_code_snapshots.md`. |
| 2026-04-22 | Tier rule refinement (v1.1) | 57 | 64 | 35 | Evidence-based tier assignments from full 221-file inventory. Tier 1 expanded (+`lib/types/`, +5 stray `lib/` root services, +`ingredientsParser`). Tier 2 widened (+15 stats coordinators, +4 cooking surfaces, +LogCookSheet). Tier 3 narrowed (from 72 to 35 named files). 4 DEFERRED_WORK entries added for cleanup. No `_pk_sync/code/` upload — seed population only. |
| 2026-04-22 | Initial population (full refresh, all tiers) | 57 | 64 | 35 | First real batch upload. All 156 files stamped with `/** PK SNAPSHOT — 2026-04-22 */` header and staged to `_pk_sync/code/`. Snapshot Date column populated across all tier tables; Staleness Risk reset to Low. Discovery pass found 0 newly-discovered files and 0 stale rows (tracking doc came from fresh same-day inventory). Last Touched By column left unchanged — Tom's opening line did not specify current phase. |

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-22 | 1.1 | **Evidence-based tier rule refinement** before first PK code upload. Previous v1.0 populate used categorical rules ("all `lib/services/**/*.ts`", "all non-Tier-2 `components/*.tsx`") that produced 42/46/72 counts and three flagged issues: Tier 3 over-broad, `lib/types/` directory missed, `lib/` root service files unverified. v1.1 replaces categorical rules with explicit named file lists derived from Claude.ai review of the full 221-file inventory (`_claudeai_context/tier_inventory_2026-04-22.md`, ephemeral). New counts: Tier 1 = 57, Tier 2 = 64, Tier 3 = 35 (total 156). Tier 1 gains `lib/types/*.ts` (9 files; excludes `env.d.ts` TS infra), 5 stray services at `lib/` root (Flag 3 confirmed drift from FRIGO_ARCHITECTURE v4.0), and `lib/ingredientsParser.ts`. Tier 2 adds 15 stats sub-page coordinators and 4 cooking main surfaces (v4 didn't consider these subdirectories). Tier 3 narrowed from "all other `components/*.tsx`" to 35 explicitly named files. 4 DEFERRED_WORK entries seeded: T4 relocate stray services, T5 delete deprecated PostCookFlow, T6 review oldTheme for deletion, T7 resolve QuickAddSection `@ts-nocheck` pragma. Calibration revisit target: Phase 9 boundary. |
| 2026-04-22 | 1.0 | Initial creation alongside `DOC_MAINTENANCE_PROCESS.md` v5.1 and `CLAUDE.md` Rule E. Skeleton populated by CC; file lists seeded from repo scan. |

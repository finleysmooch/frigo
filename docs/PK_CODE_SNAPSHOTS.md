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
| `lib/services/annotationService.ts` | | | — | |
| `lib/services/bookViewService.ts` | | | — | |
| `lib/services/commentsService.ts` | | | — | |
| `lib/services/cookCardDataService.ts` | | Phase 7I CP5 / CP6 | — | SELECT-column SSoT per v4.0 arch doc |
| `lib/services/cookingService.ts` | | Phase 7B-Rev | — | recipe_step_notes CRUD |
| `lib/services/eaterRatingsService.ts` | | Phase 7I CP6 | — | D43 private per-eater ratings |
| `lib/services/feedGroupingService.ts` | | Phase 7I CP4 / 7G | — | `buildFeedGroups`; sort key switched to cooked_at in 7G |
| `lib/services/highlightsService.ts` | | Phase 7I | — | |
| `lib/services/imageStorageService.ts` | | | — | |
| `lib/services/ingredientService.ts` | | | — | |
| `lib/services/ingredientSuggestionService.ts` | | | — | |
| `lib/services/instructionSectionsService.ts` | | | — | |
| `lib/services/mealPlanService.ts` | | | — | |
| `lib/services/mealService.ts` | | Phase 7I CP2 / CP6 | — | `getMealEventForCook`, `getMealEventDetail` |
| `lib/services/nutritionGoalsService.ts` | | Phase 4 | — | |
| `lib/services/nutritionService.ts` | | | — | |
| `lib/services/postParticipantsService.ts` | | Phase 7I CP7 | — | PostType union cleaned |
| `lib/services/postService.ts` | | Phase 7M / 7L / 7G | — | UpdatePostPatch extended; computeDefaultVisibility |
| `lib/services/recipeAnnotationsService.ts` | | | — | |
| `lib/services/recipeHistoryService.ts` | | Phase 7I CP5 | — | `getCookHistoryForUserRecipe` |
| `lib/services/recipeService.ts` | | Phase 7B-Rev | — | Top-level (distinct from extraction one); 20 lines, currently only `deleteRecipe` |
| `lib/services/shareService.ts` | | Phase 7J | — | `shareRecipe`, `sharePost` |
| `lib/services/spaceService.ts` | | | — | |
| `lib/services/statsService.ts` | | Phase 4 | — | 38 exports |
| `lib/services/subscriptionService.ts` | | | — | |
| `lib/services/unitConverter.ts` | | | — | |
| `lib/services/userRecipeTagsService.ts` | | | — | |
| `lib/services/vibeService.ts` | | Phase 7F | — | `getRecipeVibe`, `computeMealVibe` |
| `lib/services/recipeExtraction/bookService.ts` | | | — | 10 exports; Phase 7K backfill callers |
| `lib/services/recipeExtraction/chefService.ts` | | Phase 7K | — | `backfillChefIds` added 2026-04-17 |
| `lib/services/recipeExtraction/claudeVisionAPI.ts` | | | — | |
| `lib/services/recipeExtraction/imageProcessor.ts` | | | — | |
| `lib/services/recipeExtraction/index.ts` | | | — | Barrel export |
| `lib/services/recipeExtraction/ingredientMatcher.ts` | | | — | Instruction text highlighting |
| `lib/services/recipeExtraction/recipeService.ts` | | Phase 3A | — | saveRecipe (distinct from top-level) |
| `lib/services/recipeExtraction/unifiedParser.ts` | | | — | |
| `lib/services/recipeExtraction/webExtractor.ts` | | | — | |
| `lib/utils/mealTypeHelpers.ts` | | Phase 7E Fix Pass 1 | — | Extracted from postService |
| `lib/utils/timerDetection.ts` | | Phase 6 | — | detectTimersInText + formatTime |
| `constants/cookingMethods.ts` | | Phase 7M | — | 16-value DB CHECK match |
| `constants/pantry.ts` | | | — | |
| `constants/vibeIcons.ts` | | | — | |
| `lib/types/cooking.ts` | | Phase 6 | — | StepNote, CookingSession, TimerHistoryEntry, NormalizedStep |
| `lib/types/feed.ts` | | Phase 7I | — | CookCardData, FeedGroup, LinkContext, MealEventContext |
| `lib/types/grocery.ts` | | | — | Grocery list/item/template types |
| `lib/types/pantry.ts` | | | — | PantryItem, StorageLocation, IngredientWithPantryData |
| `lib/types/recipeExtraction.ts` | | | — | ExtractedRecipeData, ProcessedRecipe, Book, Chef |
| `lib/types/recipeFeatures.ts` | | | — | DB-corrected Book + author types |
| `lib/types/search.ts` | | | — | SearchOptions, SearchResult, SearchError class |
| `lib/types/space.ts` | | | — | SpaceRole, SpaceAction, permissions, invitations |
| `lib/types/store.ts` | | | — | Store, UserIngredientPreference, view modes |
| `lib/groceryListsService.ts` | | | — | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/groceryService.ts` | | | — | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/pantryService.ts` | | | — | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/searchService.ts` | | | — | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/storeService.ts` | | | — | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/ingredientsParser.ts` | | | — | Core ingredient matching pipeline (755 lines). Currently at lib/ root; review location during the lib/services/ relocation pass (T4). |

---

## Tier 2 — Screens and key interaction components

| File | Snapshot Date | Last Touched By | Staleness Risk | Notes |
|------|--------------|-----------------|----------------|-------|
| `screens/AddRecipeFromPhotoScreen.tsx` | | | — | |
| `screens/AddRecipeFromUrlScreen.tsx` | | | — | |
| `screens/AdminScreen.tsx` | | | — | |
| `screens/AuthorViewScreen.tsx` | | | — | |
| `screens/BookDetailScreen.tsx` | | Phase 4 | — | |
| `screens/BookViewScreen.tsx` | | | — | |
| `screens/ChefDetailScreen.tsx` | | Phase 4 | — | |
| `screens/CommentsScreen.tsx` | | Phase 7N | — | P7-85 keyboard avoidance |
| `screens/CookDetailScreen.tsx` | | Phase 7M / 7N | — | Overflow collapsed 6→2; 7N polish |
| `screens/CookingScreen.tsx` | | Phase 6 / 7B-Rev | — | |
| `screens/CookSoonScreen.tsx` | | | — | |
| `screens/DrillDownScreen.tsx` | | Phase 4 | — | |
| `screens/EditMediaScreen.tsx` | | | — | |
| `screens/EditPostScreen.tsx` | | Phase 7M | — | NEW ~1,178 lines |
| `screens/EditProfileScreen.tsx` | | | — | |
| `screens/FeedScreen.tsx` | | Phase 7I CP4 / 7G / 7M FP1 | — | cook-post-centric rewrite |
| `screens/GroceryListDetailScreen.tsx` | | | — | |
| `screens/GroceryListsScreen.tsx` | | | — | |
| `screens/LoginScreen.tsx` | | | — | |
| `screens/MealDetailScreen.tsx` | | | — | Deprecated-but-extant; P7-100 |
| `screens/MealEventDetailScreen.tsx` | | Phase 7I CP6 | — | L7 detail screen |
| `screens/MissingIngredientsScreen.tsx` | | | — | |
| `screens/MyMealsScreen.tsx` | | Phase 7I CP7 | — | post_type='meal_event' fix |
| `screens/MyPostDetailsScreen.tsx` | | | — | Deprecated-but-extant; P7-102 |
| `screens/MyPostsScreen.tsx` | | | — | Deprecated-but-extant; P7-102 |
| `screens/PantryScreen.tsx` | | | — | |
| `screens/PendingApprovalsScreen.tsx` | | | — | |
| `screens/ProfileScreen.tsx` | | | — | |
| `screens/RecipeDetailScreen.tsx` | | Phase 7B-Rev / 7J | — | |
| `screens/RecipeExtractionLoadingScreen.tsx` | | | — | |
| `screens/RecipeListScreen.tsx` | | Phase 3A | — | |
| `screens/RecipeReviewScreen.tsx` | | | — | |
| `screens/RegularItemsScreen.tsx` | | | — | |
| `screens/SettingsScreen.tsx` | | Phase 7L / 7K | — | visibility picker + chef backfill trigger |
| `screens/SignupScreen.tsx` | | | — | |
| `screens/SpaceSettingsScreen.tsx` | | | — | |
| `screens/StatsScreen.tsx` | | Phase 4 / 7H | — | My Posts → CookDetail |
| `screens/StoresScreen.tsx` | | | — | |
| `screens/UserPostsScreen.tsx` | | Phase 4 | — | |
| `screens/UserSearchScreen.tsx` | | | — | |
| `screens/YasChefScreen.tsx` | | | — | |
| `components/feedCard/CookCard.tsx` | | Phase 7I CP3 / 7N CP2 | — | Three-zone gesture pattern |
| `components/feedCard/groupingPrimitives.tsx` | | Phase 7I CP3 / CP3.5 | — | Preheads, group headers, linked stacks |
| `components/feedCard/sharedCardElements.tsx` | | Phase 7I / 7N CP2 | — | `onPhotoPress` added in 7N |
| `components/stats/StatsOverview.tsx` | | Phase 4 | — | Overview sub-page coordinator |
| `components/stats/StatsRecipes.tsx` | | Phase 4 | — | Recipes sub-page coordinator |
| `components/stats/StatsNutrition.tsx` | | Phase 4 | — | Nutrition sub-page coordinator |
| `components/stats/StatsInsights.tsx` | | Phase 4 | — | Insights sub-page coordinator |
| `components/stats/WeeklyChart.tsx` | | Phase 4 | — | 5-mode SVG chart with tappable dots |
| `components/stats/CalendarWeekCard.tsx` | | Phase 4 | — | 7-day emoji grid + streak |
| `components/stats/MostCookedPodium.tsx` | | Phase 4 | — | 3-pedestal podium, 5-way toggle |
| `components/stats/ConceptBubbleMap.tsx` | | Phase 4 | — | Size-scaled circles, 3 tiers |
| `components/stats/GrowthTimeline.tsx` | | Phase 4 | — | Monthly milestones |
| `components/stats/CookingPersonalityCard.tsx` | | Phase 4 | — | Dark teal template narrative |
| `components/stats/FrontierCards.tsx` | | Phase 4 | — | Horizontal scroll suggestions |
| `components/stats/GatewayCard.tsx` | | Phase 4 | — | Tappable overview card |
| `components/stats/SectionHeader.tsx` | | Phase 4 | — | Kitchen/Frontier dividers |
| `components/stats/MealTypeDropdown.tsx` | | Phase 4 | — | Anchored popup via measureInWindow |
| `components/stats/PeriodToggle.tsx` | | Phase 4 | — | Period pill toggle with compact variant |
| `components/cooking/ClassicView.tsx` | | Phase 6 | — | Full scrollable cookbook view |
| `components/cooking/SectionCard.tsx` | | Phase 6 | — | Step cards with current/done/future states |
| `components/cooking/IngredientSheet.tsx` | | Phase 6 | — | Pull-up ingredient bottom sheet |
| `components/cooking/TimerDetail.tsx` | | Phase 6 | — | Expanded timer with controls |
| `components/LogCookSheet.tsx` | | Phase 7B-Rev / 7G / 7M / 7L | — | StarRating delegation; cookedAt; default_visibility |

---

## Tier 3 — Supporting components and navigation

| File | Snapshot Date | Last Touched By | Staleness Risk | Notes |
|------|--------------|-----------------|----------------|-------|
| `App.tsx` | | Phase 7M / 7H / 7I CP5/CP6 | — | FeedStack + StatsStack route registrations |
| `contexts/CookingTimerContext.tsx` | | Phase 6 | — | |
| `contexts/LogoConfigContext.tsx` | | | — | |
| `contexts/SpaceContext.tsx` | | | — | |
| `components/cooking/StepIngredients.tsx` | | Phase 6 | — | Two-column ingredient list per step |
| `components/cooking/StepNoteInput.tsx` | | Phase 7B-Rev | — | Inline note input |
| `components/cooking/StepNoteDisplay.tsx` | | Phase 7B-Rev | — | Saved step-note card |
| `components/cooking/IngredientDetailPopup.tsx` | | Phase 6 | — | Ingredient tap popup |
| `components/cooking/CompactTimerBar.tsx` | | Phase 6 | — | Single-line timer pills |
| `components/cooking/ViewModeMenu.tsx` | | Phase 6 | — | Step-by-step vs classic dropdown |
| `components/cooking/SectionDots.tsx` | | Phase 6 | — | Progress dots per section |
| `components/UserAvatar.tsx` | | | — | Emoji/URL/null handling |
| `components/RecipeNutritionPanel.tsx` | | Phase 3A | — | Collapsible macros + quality tier |
| `components/DietaryBadgeRow.tsx` | | Phase 3A | — | 8 dietary flags |
| `components/MarkupText.tsx` | | | — | Strikethrough + edit markup for annotations |
| `components/StarRating.tsx` | | Phase 7M | — | Extracted from LogCookSheet |
| `components/TimesMadeModal.tsx` | | Phase 7B-Rev | — | Historical cook counts stepper |
| `components/NutritionGoalsModal.tsx` | | Phase 4 | — | 6-nutrient stepper + daily/per-meal toggle |
| `components/FilterDrawer.tsx` | | Phase 3A | — | Recipe filter drawer |
| `components/SpaceSwitcher.tsx` | | | — | Dropdown for switching shared spaces |
| `components/MealInvitationsCard.tsx` | | | — | Pending meal invites with accept/decline |
| `components/PendingSpaceInvitations.tsx` | | | — | Pending space invitation responder |
| `components/InSheetMealCreate.tsx` | | Phase 7E | — | In-sheet meal creation + inline tagging |
| `components/MadeOtherDishesSheet.tsx` | | Phase 7E | — | Post-publish planned-meal suggestions |
| `components/MealPicker.tsx` | | | — | Attach to existing meal sub-view |
| `components/CreateMealModal.tsx` | | | — | Create-meal modal with Quick Add Recipe |
| `components/MealPlanSection.tsx` | | | — | Meal plan items with state + claim actions |
| `components/MealCalendarView.tsx` | | | — | Month/week calendar for meals |
| `components/QuickMealPlanModal.tsx` | | | — | Quick add recipe to meal plan |
| `components/CategoryHeader.tsx` | | | — | Collapsible pantry family header |
| `components/TypeHeader.tsx` | | | — | Collapsible ingredient type header |
| `components/PantryItemRow.tsx` | | | — | Single-line pantry row with stock badges |
| `components/PostActionMenu.tsx` | | | — | Legacy; P7-102 |
| `components/GroceryListItem.tsx` | | | — | Single-line grocery item with cart toggle |
| `components/ParticipantsListModal.tsx` | | | — | All cooking participants listing (Strava-style) |

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

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-22 | 1.1 | **Evidence-based tier rule refinement** before first PK code upload. Previous v1.0 populate used categorical rules ("all `lib/services/**/*.ts`", "all non-Tier-2 `components/*.tsx`") that produced 42/46/72 counts and three flagged issues: Tier 3 over-broad, `lib/types/` directory missed, `lib/` root service files unverified. v1.1 replaces categorical rules with explicit named file lists derived from Claude.ai review of the full 221-file inventory (`_claudeai_context/tier_inventory_2026-04-22.md`, ephemeral). New counts: Tier 1 = 57, Tier 2 = 64, Tier 3 = 35 (total 156). Tier 1 gains `lib/types/*.ts` (9 files; excludes `env.d.ts` TS infra), 5 stray services at `lib/` root (Flag 3 confirmed drift from FRIGO_ARCHITECTURE v4.0), and `lib/ingredientsParser.ts`. Tier 2 adds 15 stats sub-page coordinators and 4 cooking main surfaces (v4 didn't consider these subdirectories). Tier 3 narrowed from "all other `components/*.tsx`" to 35 explicitly named files. 4 DEFERRED_WORK entries seeded: T4 relocate stray services, T5 delete deprecated PostCookFlow, T6 review oldTheme for deletion, T7 resolve QuickAddSection `@ts-nocheck` pragma. Calibration revisit target: Phase 9 boundary. |
| 2026-04-22 | 1.0 | Initial creation alongside `DOC_MAINTENANCE_PROCESS.md` v5.1 and `CLAUDE.md` Rule E. Skeleton populated by CC; file lists seeded from repo scan. |

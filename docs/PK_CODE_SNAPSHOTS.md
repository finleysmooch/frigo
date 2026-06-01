# PK Code Snapshots — Tracking Doc
**Last Full Refresh:** 2026-05-19
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
| `lib/services/bookViewService.ts` | 2026-04-22 | | HIGH | 2026-06-01: getRecipesByBook rewritten off the missing recipes_with_books view. |
| `lib/services/commentsService.ts` | 2026-04-22 | | Low | |
| `lib/services/cookCardDataService.ts` | 2026-05-19 | Phase 7I CP5 / CP6 | Low | SELECT-column SSoT per v4.0 arch doc |
| `lib/services/cookingService.ts` | 2026-05-19 | Phase 7B-Rev | Low | recipe_step_notes CRUD |
| `lib/services/eaterRatingsService.ts` | 2026-05-19 | Phase 7I CP6 | Low | D43 private per-eater ratings |
| `lib/services/feedGroupingService.ts` | 2026-05-19 | Phase 7I CP4 / 7G | Low | `buildFeedGroups`; sort key switched to cooked_at in 7G |
| `lib/services/highlightsService.ts` | 2026-05-19 | Phase 7I | Low | |
| `lib/services/imageStorageService.ts` | 2026-04-22 | | Low | |
| `lib/services/ingredientService.ts` | 2026-04-22 | | Low | |
| `lib/services/ingredientSuggestionService.ts` | 2026-04-22 | | Low | |
| `lib/services/instructionSectionsService.ts` | 2026-04-22 | | Low | |
| `lib/services/mealPlanService.ts` | 2026-04-22 | | Low | |
| `lib/services/mealService.ts` | 2026-05-19 | Phase 7I CP2 / CP6 | Low | `getMealEventForCook`, `getMealEventDetail` |
| `lib/services/nutritionGoalsService.ts` | 2026-05-19 | Phase 4 | Low | |
| `lib/services/nutritionService.ts` | 2026-04-22 | | Low | |
| `lib/services/postParticipantsService.ts` | 2026-05-19 | Phase 7I CP7 | Low | PostType union cleaned |
| `lib/services/postService.ts` | 2026-05-19 | Phase 7M / 7L / 7G | Low | UpdatePostPatch extended; computeDefaultVisibility |
| `lib/services/recipeAnnotationsService.ts` | 2026-04-22 | | Low | |
| `lib/services/recipeHistoryService.ts` | 2026-05-19 | Phase 7I CP5 | Low | `getCookHistoryForUserRecipe` |
| `lib/services/recipeService.ts` | 2026-05-19 | Phase 7B-Rev | Low | Top-level (distinct from extraction one); 20 lines, currently only `deleteRecipe` |
| `lib/services/shareService.ts` | 2026-05-19 | Phase 7J | Low | `shareRecipe`, `sharePost` |
| `lib/services/spaceService.ts` | 2026-04-22 | | Low | |
| `lib/services/statsService.ts` | 2026-05-19 | Phase 4 | Low | 38 exports |
| `lib/services/subscriptionService.ts` | 2026-04-22 | | Low | |
| `lib/services/unitConverter.ts` | 2026-05-19 | Phase 8R-CP6e-Services-a | Low | CP6e-Services-a (2026-05-06): added `convertBetween(amount, fromUnit, toUnit)` — converts between specific units (vs convertUnit which targets metric/imperial systems). Used by lotsService for cross-lot deduction unit-compatibility checks. |
| `lib/services/userRecipeTagsService.ts` | 2026-04-22 | | Low | |
| `lib/services/vibeService.ts` | 2026-05-19 | Phase 7F | Low | `getRecipeVibe`, `computeMealVibe` |
| `lib/services/recipeExtraction/bookService.ts` | 2026-04-22 | | Low | 10 exports; Phase 7K backfill callers |
| `lib/services/recipeExtraction/chefService.ts` | 2026-05-19 | Phase 7K | Low | `backfillChefIds` added 2026-04-17 |
| `lib/services/recipeExtraction/claudeVisionAPI.ts` | 2026-04-22 | | Low | |
| `lib/services/recipeExtraction/imageProcessor.ts` | 2026-04-22 | | Low | |
| `lib/services/recipeExtraction/index.ts` | 2026-04-22 | | Low | Barrel export |
| `lib/services/recipeExtraction/ingredientMatcher.ts` | 2026-04-22 | | Low | Instruction text highlighting |
| `lib/services/recipeExtraction/recipeService.ts` | 2026-05-19 | Phase 3A | Low | saveRecipe (distinct from top-level) |
| `lib/services/recipeExtraction/unifiedParser.ts` | 2026-04-22 | | Low | |
| `lib/services/recipeExtraction/webExtractor.ts` | 2026-04-22 | | Low | |
| `lib/utils/mealTypeHelpers.ts` | 2026-05-19 | Phase 7E Fix Pass 1 | Low | Extracted from postService |
| `lib/utils/timerDetection.ts` | 2026-05-19 | Phase 6 | Low | detectTimersInText + formatTime |
| `constants/cookingMethods.ts` | 2026-05-19 | Phase 7M | Low | 16-value DB CHECK match |
| `constants/pantry.ts` | 2026-04-22 | | HIGH | 2026-06-01: icons added for Pasta/Noodles/Rice/Fish/Shellfish + 4 orphan types. |
| `constants/vibeIcons.ts` | 2026-04-22 | | Low | |
| `lib/types/cooking.ts` | 2026-05-19 | Phase 6 | Low | StepNote, CookingSession, TimerHistoryEntry, NormalizedStep |
| `lib/types/feed.ts` | 2026-05-19 | Phase 7I | Low | CookCardData, FeedGroup, LinkContext, MealEventContext |
| `lib/types/needs.ts` | 2026-05-19 | Phase 8R-CP2a / CP5b / CP6b | Low | NEW (8R-CP2a): Need, NeedWithTags, NeedWithDetails, NeedRecipe, NeedStatus, NeedAddedFrom, MergedNeedGroup, CreateNeedParams, AddNeedFromRecipeParams, UpdateNeedParams. CP5b extended UpdateNeedParams with tagIds. CP6b extended UpdateNeedParams with customName + nullable widening on existing fields. |
| `lib/types/supplies.ts` | 2026-05-19 | Phase 8R-CP2a / CP6d-Schema / CP6e-Services-a / Services-b / FlowsUI-b2 | HIGH | NEW (8R-CP2a): Supply, SupplyWithTags, SupplyIngredient, SupplyStatus, SupplyInitialStatus, SupplyStatusResult, CreateSupplyParams, UpdateSupplyParams. CP6d-Schema added tracking_mode/storage_location/archived_at/is_priority/usage_level + StorageLocation/TrackingMode types. CP6e-Services-a added tracks_lots + lots/lot_aggregate + lot types. CP6e-Services-b added LotDeductionPlanItem + lots_affected.quantity_unit. CP6e-FlowsUI-b2 (2026-05-13): added `SearchMatchDimension` union ('name'|'family'|'type'|'tag'|'variant'|'brand'|'notes'|'storage') and `SupplySearchMatch` interface (supplyId + rank + matchedDimensions Set + matchedLotIds Set) for the server-search + post-hoc dimension matcher. |
| `lib/types/tags.ts` | 2026-05-19 | Phase 8R-CP2a | Low | NEW (8R-CP2a): Tag, TagDimension ('store' \| 'urgency' \| 'recipe' \| 'event' \| 'storage' per Q1), SupplyTagRow, NeedTagRow (split tables per Q39). |
| `lib/types/views.ts` | 2026-05-19 | Phase 8R-CP2a | Low | NEW (8R-CP2a): View, ViewWithFilters, ViewFilter, ViewFilterDimension, RenderMode (tier/aisle/flat per Q25), CreateViewParams, UpdateViewParams, ViewFilterInput. |
| `lib/types/recipeExtraction.ts` | 2026-04-22 | | Low | ExtractedRecipeData, ProcessedRecipe, Book, Chef |
| `lib/types/recipeFeatures.ts` | 2026-04-22 | | Low | DB-corrected Book + author types |
| `lib/types/search.ts` | 2026-04-22 | | HIGH | SearchOptions, SearchResult, SearchError class. 2026-06-01: added searchMetadata option. |
| `lib/types/space.ts` | 2026-04-22 | | Low | SpaceRole, SpaceAction, permissions, invitations |
| `lib/types/store.ts` | 2026-04-22 | | Low | Store, UserIngredientPreference, view modes |
| `lib/cookDepletionService.ts` | 2026-05-19 | Phase 8B-CP4 / 8R-CP3 / CP6e-Services-b / CP6e-FlowsUI-a | Low | 8B-CP4 → 8R-CP3 → CP6e-Services-b → CP6e-FlowsUI-a. CP6e-Services-b rewrote internals to lot-aware model (D8R-Q53) with `lot_depletions` JSONB persistence + `rollbackFromPersistedRecord`. CP6e-FlowsUI-a (2026-05-13, +175 lines): added `replaceSupplyDeduction(plan, supplyId, newDraw)` + `SupplyEntryNotInPlanError`. Orchestrator: reverses ONE supply's existing draw (per-lot quantity_before restore + un-archive + status restore + spawned-need delete — mirrors rollbackDepletion's per-entry loop), calls `deductFromSpecificLots` with override, mutates the entry in place, re-fetches spawned_need_id on Q44 cascade, re-persists the full plan to posts.lot_depletions. Used by CookDepletionReviewModal's LotPickerModal confirm path. Existing exports untouched (compute/apply/rollback/runPostCookDepletion/rollbackFromPersistedRecord). ⚠️ Still at lib/ root (T4 relocation pending). |
| `lib/services/needsService.ts` | 2026-05-19 | Phase 8R-CP2a / CP2b / CP5b / CP6a / CP6b / CP6c / CP6e-Services-c / CP6e-FlowsUI-b1 | HIGH | NEW (8R-CP2a/CP2b): Needs CRUD + status cycle + view-filter query + display merge. CP6e-Services-c added private `_handleAcquiredSideEffects` helper + side-effect-on-acquire wiring in setNeedStatus. CP6e-FlowsUI-b1 (2026-05-13): renamed `_handleAcquiredSideEffects` → `handleAcquiredSideEffects` (public), extended return shape with `statusBefore` via new exported `AcquireSideEffectResult` interface. Added optional `suppressSideEffects` flag to `setNeedStatus` (back-compat — all 5 pre-existing acquire call sites continue working). Added `acquireNeedWithDetails(needId)` wrapper: calls setNeedStatus with suppress=true THEN invokes handleAcquiredSideEffects manually (helper fires exactly once). Added `cycleNeedStatusWithDetails(needId)` wrapper: returns `{ need, acquireSideEffect: AcquireSideEffectResult | null }` — non-null only when the transition landed on 'acquired'. Existing `cycleNeedStatus` untouched (still the right entry point for callers that don't need toast metadata). |
| `lib/services/suppliesService.ts` | 2026-05-19 | Phase 8R-CP2a / CP6d / CP6e-Services-a / FlowsUI-b2 / SmokeFix-SF2 | HIGH | NEW (8R-CP2a) → CP6d → CP6e-Services-a (tracks_lots + includeLots) → FlowsUI-b2 (searchSuppliesServerSide). CP6e-SmokeFix-SF2 (2026-05-14): `hydrateSupplyLots` refactored to short-circuit when no batch supply has tracks_lots=true (skips the supply_lots IN-query entirely — makes `getSupplyById(id, { includeLots: true })` zero-extra-cost for non-lots supplies); also degraded gracefully on lot-fetch error (was: throw → blocked pantry load; now: log + return un-hydrated). `setSupplyStatus` final supplyAfter re-fetch now uses `includeLots: true`. `setSupplyUsageLevel` same-status-branch re-fetch likewise. Net effect: post-mutation supply returned to callers carries `lots` + `lot_aggregate` for tracks_lots supplies — closes the "perceived data loss" smoke bug where onSupplyChanged saw a stripped supply and the UI fell back to StatusIcon dots. |
| `lib/services/viewsService.ts` | 2026-05-19 | Phase 8R-CP2b | HIGH | NEW (8R-CP2b): Views CRUD + filter replace + toggleHidden + setRenderMode + seed-defaults RPC wrapper. Default-view delete blocked via DefaultViewDeleteError. |
| `lib/services/lotsService.ts` | 2026-05-19 | Phase 8R-CP6e-Services-a / Services-b | HIGH | NEW (CP6e-Services-a): supply_lots CRUD (createLot/updateLot/archiveLot/deleteLot), reads (getLotsForSupply/getLotById), pure-ish aggregator (getLotAggregate — async for unit-bridging), cookDepletion entry-point (deductFromOldest with oldest-first cross-lot draw + S3 unit/insufficient-stock semantics), storage move with expiration recompute (moveLotStorage per Q47). Internal helpers: _maybeAutoOutOfStock (Q44), _maybeAutoRestock (Q45), _getShelfLifeDays. CP6e-Services-b (2026-05-06): added `deductFromSpecificLots(supplyId, plan)` for manual-override path (validates lot ownership, soft-fails on unit incompat, partial-deducts on insufficient stock, fires Q44 cascade). Updated `LotDeductionResult.lots_affected[]` to include `quantity_unit` (consumed by cookDepletionService for the persisted JSONB record). Mutually imports setSupplyStatus from suppliesService. |
| `lib/services/tagsService.ts` | 2026-05-19 | Phase 8R-CP2a | Low | NEW (8R-CP2a): Tag CRUD + supply-tag junction + need-tag junction (Q39 split tables). |
| `lib/searchService.ts` | 2026-04-22 | | HIGH | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/storeService.ts` | 2026-04-22 | | Low | ⚠️ Currently at lib/ root; should relocate to lib/services/ per FRIGO_ARCHITECTURE — tracked as T4 in DEFERRED_WORK. |
| `lib/ingredientsParser.ts` | 2026-04-22 | | Low | Core ingredient matching pipeline (755 lines). Currently at lib/ root; review location during the lib/services/ relocation pass (T4). |

---

## Tier 2 — Screens and key interaction components

| File | Snapshot Date | Last Touched By | Staleness Risk | Notes |
|------|--------------|-----------------|----------------|-------|
| `screens/AddRecipeFromPhotoScreen.tsx` | 2026-04-22 | | Low | |
| `screens/AddRecipeFromUrlScreen.tsx` | 2026-04-22 | | Low | |
| `screens/AdminScreen.tsx` | 2026-05-19 | 8D-CP1 | Low | 8D-CP1 (2026-05-18): added "Run pantry matching smoke tests" button wiring `runPantryMatchingSmokeTests`. |
| `screens/AuthorViewScreen.tsx` | 2026-04-22 | | Low | |
| `screens/BookDetailScreen.tsx` | 2026-05-19 | Phase 4 | HIGH | 2026-06-01: cross-stack goToBookView nav fix. |
| `screens/BookViewScreen.tsx` | 2026-04-22 | | HIGH | 2026-06-01: search unified onto server engine + collapsing filter bar. |
| `screens/ChefDetailScreen.tsx` | 2026-05-19 | Phase 4 | Low | |
| `screens/CommentsScreen.tsx` | 2026-05-19 | Phase 7N | Low | P7-85 keyboard avoidance |
| `screens/CookDetailScreen.tsx` | 2026-05-19 | Phase 7M / 7N | Low | Overflow collapsed 6→2; 7N polish |
| `screens/CookingScreen.tsx` | 2026-05-19 | Phase 6 / 7B-Rev / 8B-CP4 | Low | 8B-CP4 wired runPostCookDepletion + showBanner into handleLogCookSubmit success path |
| `screens/CookSoonScreen.tsx` | 2026-04-22 | | Low | |
| `screens/DrillDownScreen.tsx` | 2026-05-19 | Phase 4 | Low | |
| `screens/EditMediaScreen.tsx` | 2026-04-22 | | Low | |
| `screens/EditPostScreen.tsx` | 2026-05-19 | Phase 7M | Low | NEW ~1,178 lines |
| `screens/EditProfileScreen.tsx` | 2026-04-22 | | Low | |
| `screens/FeedScreen.tsx` | 2026-05-19 | Phase 7I CP4 / 7G / 7M FP1 | Low | cook-post-centric rewrite |
| `screens/ViewDetailScreen.tsx` | 2026-05-19 | Phase 8R-CP5a / CP5b / CP6b / CP6c / CP6e-FlowsUI-b1 | HIGH | RENAMED from GroceryListDetailScreen.tsx in 8R-CP6c Part 5. Full rewrite in CP5a against view-filter / render-mode model. CP5b removed recipe-shim synthesis; wired AddNeedSheet + ExpandedRegularsSheet. CP6b: NeedRow long-press → EditNeedSheet. CP6c: cart progress bar + bulk-acquire footer + collapsible cart footer. CP6e-FlowsUI-b1 (2026-05-13): swapped the single-tap row handler from `cycleNeedStatus` → `cycleNeedStatusWithDetails`. When the transition lands on 'acquired' AND a lot was created (`acquireSideEffect.lotCreated !== null`), fires `showAcquireLotToast` with supply (from local supplies array) + lot + statusBefore. Merged-group handler (~line 340) + bulk-acquire loop (~line 498) stay using `cycleNeedStatus` / `setNeedStatus` (no toast for bulk paths per scope lean). |
| `screens/ViewsScreen.tsx` | 2026-05-19 | Phase 8R-CP5a / CP5b / CP6c | HIGH | RENAMED from screens/GroceryListsScreen.tsx in 8R-CP6c Part 5. Full rewrite in CP5a as Lists home: 4 default views (Tonight, This week, All needs, In cart) + custom views with sort_order; long-press → Hide (defaults) or Edit/Delete (custom); + New view via ViewCreatorModal; counts via parallel getNeedsForView per view. CP5b dropped the count-call recipe shim (defaults to includeRecipes=false). |
| `screens/LoginScreen.tsx` | 2026-04-22 | | Low | |
| `screens/MealDetailScreen.tsx` | 2026-04-22 | | Low | Deprecated-but-extant; P7-100 |
| `screens/MealEventDetailScreen.tsx` | 2026-05-19 | Phase 7I CP6 | Low | L7 detail screen |
| `screens/MissingIngredientsScreen.tsx` | 2026-04-22 | | Low | |
| `screens/MyMealsScreen.tsx` | 2026-05-19 | Phase 7I CP7 | Low | post_type='meal_event' fix |
| `screens/MyPostDetailsScreen.tsx` | 2026-04-22 | | Low | Deprecated-but-extant; P7-102 |
| `screens/MyPostsScreen.tsx` | 2026-04-22 | | Low | Deprecated-but-extant; P7-102 |
| `screens/PantryScreen.tsx` | 2026-05-19 | Phase 8B-CP2 / 8B-CP3 / 8B-CP3a / 8R-CP4 / 8R-CP6b | HIGH | 8R-CP4 rewrote from a 1245-line pantry-items+staples screen to a 173-line supplies-only shell wrapping SuppliesSection. Storage groupings (fridge/freezer/pantry/counter) gone per Q15. 8R-CP6b: handleAddNewTap rewired from navigation.navigate('ManageSupplies') to setSupplyCreateSheetOpen(true); SupplyCreateSheet mounted alongside CreateSpaceModal; currentUserId hydrated via supabase.auth.getUser. |
| `screens/ManageSuppliesScreen.tsx` | 2026-04-30 | Phase 8R-CP4 | HIGH | RENAMED from ManageStaplesScreen.tsx in 8R-CP4. Search via search_ingredients RPC + createSupply + cycleSupplyStatus on every row + edit-custom-name + delete. Resolves P8-22 (status cycling on every row in the management surface). |
| `screens/PendingApprovalsScreen.tsx` | 2026-04-22 | | Low | |
| `screens/ProfileScreen.tsx` | 2026-04-22 | | Low | |
| `screens/RecipeDetailScreen.tsx` | 2026-05-19 | Phase 7B-Rev / 7J / 8B-CP4 / 8D-CP1 | Low | 8B-CP4 wired runPostCookDepletion + showBanner into handleLogCookSubmit success path. 8D-CP1 (2026-05-18): wired `calculateRecipeSupplyMatch` → `matchResult` state feeding IngredientsSection ✓ marks + missing count. |
| `screens/RecipeExtractionLoadingScreen.tsx` | 2026-04-22 | | Low | |
| `screens/RecipeListScreen.tsx` | 2026-05-19 | Phase 3A / 8D-CP1 | HIGH | 8D-CP1 (2026-05-18): added 'pantry_match' sort option + bulk `pantryMatchingService` wiring + `matchMap` state. |
| `screens/RecipeReviewScreen.tsx` | 2026-04-22 | | Low | |
| `screens/RegularItemsScreen.tsx` | 2026-04-22 | | Low | |
| `screens/SettingsScreen.tsx` | 2026-05-19 | Phase 7L / 7K / admin-nav | Low | visibility picker + chef backfill trigger. admin-nav (2026-05-18): added "🛠️ Admin Tools" row in the Developer section → `navigation.navigate('Admin')`. |
| `screens/SignupScreen.tsx` | 2026-04-22 | | Low | |
| `screens/SpaceSettingsScreen.tsx` | 2026-04-22 | | Low | |
| `screens/StatsScreen.tsx` | 2026-05-19 | Phase 4 / 7H | Low | My Posts → CookDetail |
| `screens/StoresScreen.tsx` | 2026-04-22 | | Low | |
| `screens/UserPostsScreen.tsx` | 2026-05-19 | Phase 4 | Low | |
| `screens/UserSearchScreen.tsx` | 2026-04-22 | | Low | |
| `screens/YasChefScreen.tsx` | 2026-04-22 | | Low | |
| `components/feedCard/CookCard.tsx` | 2026-05-19 | Phase 7I CP3 / 7N CP2 | Low | Three-zone gesture pattern |
| `components/feedCard/groupingPrimitives.tsx` | 2026-05-19 | Phase 7I CP3 / CP3.5 | Low | Preheads, group headers, linked stacks |
| `components/feedCard/sharedCardElements.tsx` | 2026-05-19 | Phase 7I / 7N CP2 | Low | `onPhotoPress` added in 7N |
| `components/stats/StatsOverview.tsx` | 2026-05-19 | Phase 4 | Low | Overview sub-page coordinator |
| `components/stats/StatsRecipes.tsx` | 2026-05-19 | Phase 4 | Low | Recipes sub-page coordinator |
| `components/stats/StatsNutrition.tsx` | 2026-05-19 | Phase 4 | Low | Nutrition sub-page coordinator |
| `components/stats/StatsInsights.tsx` | 2026-05-19 | Phase 4 | Low | Insights sub-page coordinator |
| `components/stats/WeeklyChart.tsx` | 2026-05-19 | Phase 4 | Low | 5-mode SVG chart with tappable dots |
| `components/stats/CalendarWeekCard.tsx` | 2026-05-19 | Phase 4 | Low | 7-day emoji grid + streak |
| `components/stats/MostCookedPodium.tsx` | 2026-05-19 | Phase 4 | Low | 3-pedestal podium, 5-way toggle |
| `components/stats/ConceptBubbleMap.tsx` | 2026-05-19 | Phase 4 | Low | Size-scaled circles, 3 tiers |
| `components/stats/GrowthTimeline.tsx` | 2026-05-19 | Phase 4 | Low | Monthly milestones |
| `components/stats/CookingPersonalityCard.tsx` | 2026-05-19 | Phase 4 | Low | Dark teal template narrative |
| `components/stats/FrontierCards.tsx` | 2026-05-19 | Phase 4 | Low | Horizontal scroll suggestions |
| `components/stats/GatewayCard.tsx` | 2026-05-19 | Phase 4 | Low | Tappable overview card |
| `components/stats/SectionHeader.tsx` | 2026-05-19 | Phase 4 | Low | Kitchen/Frontier dividers |
| `components/stats/MealTypeDropdown.tsx` | 2026-05-19 | Phase 4 | Low | Anchored popup via measureInWindow |
| `components/stats/PeriodToggle.tsx` | 2026-05-19 | Phase 4 | Low | Period pill toggle with compact variant |
| `components/cooking/ClassicView.tsx` | 2026-05-19 | Phase 6 | Low | Full scrollable cookbook view |
| `components/cooking/SectionCard.tsx` | 2026-05-19 | Phase 6 | Low | Step cards with current/done/future states |
| `components/cooking/IngredientSheet.tsx` | 2026-05-19 | Phase 6 | Low | Pull-up ingredient bottom sheet |
| `components/cooking/TimerDetail.tsx` | 2026-05-19 | Phase 6 | Low | Expanded timer with controls |
| `components/LogCookSheet.tsx` | 2026-05-19 | Phase 7B-Rev / 7G / 7M / 7L | Low | StarRating delegation; cookedAt; default_visibility |

---

## Tier 3 — Supporting components and navigation

| File | Snapshot Date | Last Touched By | Staleness Risk | Notes |
|------|--------------|-----------------|----------------|-------|
| `App.tsx` | 2026-05-19 | Phase 7M / 7H / 7I CP5/CP6 / 8B-CP3 / 8B-CP4 / CP6e-FlowsUI-b1 | HIGH | FeedStack + StatsStack route registrations; 8B-CP3 added ManageStaples route + PantryStackParamList entry; 8B-CP4 added CookDepletionBannerProvider + global CookDepletionBanner render. CP6e-FlowsUI-b1 (2026-05-13): added `AcquireLotToastProvider` nested INSIDE `SpawnOnOutToastProvider` (innermost — its scope is narrower; mirrors existing nesting) + `<AcquireLotToast />` rendered alongside `<CookDepletionBanner />` + `<SpawnOnOutToast />`. admin-nav (2026-05-18): registered `AdminScreen` in `FeedStackNavigator` + `StatsStackNavigator` (the live stacks that render SettingsScreen) + their param lists; deleted orphan `RootTabParamList.Admin`. 8D-CP1-cleanup (2026-05-18): deleted the dead `ProfileStackNavigator` entirely (type + declaration + function); re-homed `LogoPlayground` in the Feed + Stats stacks. |
| `contexts/CookingTimerContext.tsx` | 2026-05-19 | Phase 6 | Low | |
| `contexts/LogoConfigContext.tsx` | 2026-04-22 | | Low | |
| `contexts/CookDepletionBannerContext.tsx` | 2026-05-19 | Phase 8B-CP4 / CP6e-FlowsUI-a | Low | New — singleton provider for the post-cook banner state (plan + show/dismiss). CP6e-FlowsUI-a (2026-05-13): added `updateSupplyEntry(supplyId, updatedEntry)` so the LotPickerModal confirm path can sync a revised entry back into the shared plan. Rebuilds BannerState with a fresh plan reference + fresh supplies array to trigger React re-renders downstream. No-op when no banner showing or supply_id not in plan. |
| `contexts/SpaceContext.tsx` | 2026-04-22 | | Low | |
| `components/cooking/StepIngredients.tsx` | 2026-05-19 | Phase 6 | Low | Two-column ingredient list per step |
| `components/cooking/StepNoteInput.tsx` | 2026-05-19 | Phase 7B-Rev | Low | Inline note input |
| `components/cooking/StepNoteDisplay.tsx` | 2026-05-19 | Phase 7B-Rev | Low | Saved step-note card |
| `components/cooking/IngredientDetailPopup.tsx` | 2026-05-19 | Phase 6 | Low | Ingredient tap popup |
| `components/cooking/CompactTimerBar.tsx` | 2026-05-19 | Phase 6 | Low | Single-line timer pills |
| `components/cooking/ViewModeMenu.tsx` | 2026-05-19 | Phase 6 | Low | Step-by-step vs classic dropdown |
| `components/cooking/SectionDots.tsx` | 2026-05-19 | Phase 6 | Low | Progress dots per section |
| `components/UserAvatar.tsx` | 2026-04-22 | | Low | Emoji/URL/null handling |
| `components/RecipeNutritionPanel.tsx` | 2026-05-19 | Phase 3A | Low | Collapsible macros + quality tier |
| `components/DietaryBadgeRow.tsx` | 2026-05-19 | Phase 3A | Low | 8 dietary flags |
| `components/MarkupText.tsx` | 2026-04-22 | | Low | Strikethrough + edit markup for annotations |
| `components/StarRating.tsx` | 2026-05-19 | Phase 7M | Low | Extracted from LogCookSheet |
| `components/TimesMadeModal.tsx` | 2026-05-19 | Phase 7B-Rev | Low | Historical cook counts stepper |
| `components/NutritionGoalsModal.tsx` | 2026-05-19 | Phase 4 | Low | 6-nutrient stepper + daily/per-meal toggle |
| `components/FilterDrawer.tsx` | 2026-05-19 | Phase 3A | Low | Recipe filter drawer |
| `components/SpaceSwitcher.tsx` | 2026-04-22 | | Low | Dropdown for switching shared spaces |
| `components/MealInvitationsCard.tsx` | 2026-04-22 | | Low | Pending meal invites with accept/decline |
| `components/PendingSpaceInvitations.tsx` | 2026-04-22 | | Low | Pending space invitation responder |
| `components/InSheetMealCreate.tsx` | 2026-05-19 | Phase 7E | Low | In-sheet meal creation + inline tagging |
| `components/MadeOtherDishesSheet.tsx` | 2026-05-19 | Phase 7E | Low | Post-publish planned-meal suggestions |
| `components/MealPicker.tsx` | 2026-04-22 | | Low | Attach to existing meal sub-view |
| `components/CreateMealModal.tsx` | 2026-04-22 | | Low | Create-meal modal with Quick Add Recipe |
| `components/MealPlanSection.tsx` | 2026-04-22 | | Low | Meal plan items with state + claim actions |
| `components/MealCalendarView.tsx` | 2026-04-22 | | Low | Month/week calendar for meals |
| `components/QuickMealPlanModal.tsx` | 2026-04-22 | | Low | Quick add recipe to meal plan |
| `components/CategoryHeader.tsx` | 2026-04-22 | | Low | Collapsible pantry family header |
| `components/TypeHeader.tsx` | 2026-04-22 | | Low | Collapsible ingredient type header |
| `components/PantryItemRow.tsx` | 2026-04-22 | | Low | Single-line pantry row with stock badges |
| `components/PostActionMenu.tsx` | 2026-04-22 | | Low | Legacy; P7-102 |
| `components/AddNeedSheet.tsx` | 2026-05-19 | Phase 8R-CP5b / CP6a | Low | NEW (8R-CP5b, ~835 lines): Configure-once-and-done sheet with 3-tier autocomplete (🏠 existing supply / 🆕 catalog ingredient / ✏️ custom name) + view-context tag inheritance + Save-as-regular toggle. Replaces the deleted AddGroceryItemModal. CP6a: T3 row repositioned to TOP of merged results when 2+ chars typed and no exact match (smoke-test feedback). |
| `components/SupplyCreateSheet.tsx` | 2026-05-19 | Phase 8R-CP6b / CP6e-PantryUI-c / SmokeFix-SF1 | HIGH | NEW (8R-CP6b): Tab 12 supply create. CP6e-PantryUI-c added tracks_lots toggle + inline `LotInputRowView` list + multi-lot save path with partial-success. CP6e-SmokeFix-SF1 (2026-05-14): added `defaultLotUnit(ingredient)` helper that seeds `quantity_unit` from `ingredient.typical_unit` (T2 path) or falls back to `'pieces'` (T3 custom-name path, per Tom's SQL pre-check confirming `measurement_units` has `unit_type='count'` row with `display_plural='pieces'`). `emptyLotInputRow` accepts an optional ingredient param. `handleToggleTracksLots(true)` re-seeds the first row with the current `selected.ingredient` so falafel-style custom names land with 'pieces' pre-populated. `<LotInputRowView ingredientId={selected?.ingredient?.id ?? null} />` threads ingredient id to the new UnitPicker. |
| `components/pantry/LotInputRowView.tsx` | 2026-05-19 | Phase 8R-CP6e-PantryUI-c / SmokeFix-SF1 | Low | NEW (CP6e-PantryUI-c): compact inline lot form used inside SupplyCreateSheet. CP6e-SmokeFix-SF1 (2026-05-14): replaced free-text `quantity_unit` TextInput with `<UnitPicker>` (single-select with common-units + Other-units affordance). Added `ingredientId: string \| null` prop threaded to UnitPicker. Replaced `unitInput` style with `unitPickerWrapper` (flex: 1 — picker provides its own visual styling). |
| `components/UnitPicker.tsx` | 2026-05-19 | Phase 6/5 + CP6e-SmokeFix-SF1 | Low | Dropdown unit picker, originally built for recipe/need entry. CP6e-SmokeFix-SF1 (2026-05-14): `Props.ingredientId` widened from `string` to `string \| null`. When null, the picker skips common-units loading (no `ingredient_common_units` query), pre-loads the full all-units list, routes directly to all-units mode, and suppresses both the "← Common" back-button + "Other units…" footer (no common-units view to navigate back to / forward from). Consumers that previously fell back to a plain TextInput for the no-ingredient case (AddNeedSheet / EditNeedSheet for T3 custom-name needs) can now adopt this component directly per P8R-D27. |
| `components/EditNeedSheet.tsx` | 2026-05-19 | Phase 8R-CP6b | Low | NEW (8R-CP6b, ~674 lines): Long-press on need row opens this. Hydrates need + supply (when supply_id set); configure form with conditional "Update default routing" toggle (Q34) appearing only when form's tagIds set differs from supply's tagIds. Save calls updateNeed; toggle ON also calls setSupplyTags. Delete button (red destructive). |
| `components/ExpandedRegularsSheet.tsx` | 2026-05-19 | Phase 8R-CP5b / CP6b | Low | NEW (8R-CP5b, ~590 lines): Out (pre-selected per Q20)/Low/In stock multi-select with inline supply_id-based dedup (createNeed lacks dedup pre-CP6a; CP6a hoisted to service). CP6b: footer "+ Add new supply" rewired from Alert stub to SupplyCreateSheet open with inline refetch. |
| `components/ViewCreatorModal.tsx` | 2026-05-19 | Phase 8R-CP5a | HIGH | NEW (8R-CP5a, ~608 lines): Bottom-sheet modal for create + edit views. Filter accordion (status + urgency + store + recipe dimensions), inline tag creator, render-mode segmented (Tier/Aisle/Flat per Q25). Filter editing locked on default views per Q19 strict read (P8R-D12 captures relaxation candidate). |
| `components/SpawnOnOutToast.tsx` | 2026-05-19 | Phase 8R-CP6b / CP6c | HIGH | NEW (8R-CP6b, ~190 lines → trimmed in CP6c): Bottom-pinned toast on supply→out spawn. Undo + × actions; auto-dismiss 5s via context timer. CP6c removed Edit button (no consumer at App-level mount). |
| `contexts/SpawnOnOutToastContext.tsx` | 2026-05-19 | Phase 8R-CP6b | Low | NEW (8R-CP6b, ~106 lines): Provider + useSpawnOnOutToast hook. Sibling pattern to CookDepletionBannerContext; auto-dismiss timer internal. Conflict-suppression-when-banner implemented at call-site (SuppliesSection checks currentBanner before showToast). |
| `contexts/AcquireLotToastContext.tsx` | 2026-05-19 | Phase 8R-CP6e-FlowsUI-b1 | Low | NEW (CP6e-FlowsUI-b1, 83 lines): singleton provider for the acquire-lot toast (`AcquireLotToastPayload` = needId + supply + lot + statusBefore). Unlike SpawnOnOutToastContext, auto-dismiss timer lives in the toast COMPONENT — not the provider — so the toast can pause-on-edit-sheet-open and resume on close with a fresh 5s. Mirrors CookDepletionBanner's pause pattern. |
| `components/pantry/AcquireLotToast.tsx` | 2026-05-19 | Phase 8R-CP6e-FlowsUI-b1 | Low | NEW (CP6e-FlowsUI-b1, 287 lines): top-floating toast (SafeAreaView edges=['top'], marginTop:64, zIndex:1000) shown when single-need user-action acquire creates a lot. Message: "Acquired: {name} · {qty} {unit} · added to {storage} · expires {date}". Buttons: Edit (mounts LotEditSheet for fresh lot, pauses dismiss timer), Undo (deleteLot + setSupplyStatus(statusBefore) + setNeedStatus(in_cart, suppressSideEffects=true)), ✕. 5s auto-dismiss with pause-on-edit + fresh-restart-on-close. successLight tint, success-color left-border accent. |
| `components/AddRecipeToNeedsModal.tsx` | 2026-05-19 | Phase 8R-CP3 | Low | NEW (8R-CP3, ~320 lines): Replaces deleted AddRecipeToListModal. Loops through recipe ingredients, calls needsService.addNeedFromRecipe per matched ingredient. spaceId-scoped. |
| `components/pantry/SuppliesSection.tsx` | 2026-05-19 | Phase 8R-CP4 / CP6b / CP6e-PantryUI-a / FlowsUI-b2 / SmokeFix-SF2-followup | HIGH | NEW (8R-CP4). CP6e-PantryUI-a: includeLots hydration. FlowsUI-b2: debounced server-side search at query len ≥ 2 with post-hoc dimension matcher + rank-sort + pill rendering. CP6e-SmokeFix-SF2-followup (2026-05-14): during active search, force-expand Attention + every CategorySubsection so all matching items are visible without nested folder taps. `isAttentionOpen` ORs with `searchActive`. New `forceOpen` prop on CategorizedSubsections + CategorySubsection threads through `searchActive`. User's manual expansion state (`expandedSection` + `openSubKey`) preserved underneath — clearing the query restores prior collapse state. Chevron + body render gate switch to the effective-open flag. |
| `components/pantry/SupplyRow.tsx` | 2026-05-19 | Phase 8R-CP4 / CP6a / CP6b / CP6d-SmokeFix-1 / CP6e-PantryUI-a / FlowsUI-b2 / SmokeFix-SF2 | HIGH | NEW (8R-CP4). CP6e-PantryUI-a added tracks_lots branch (LotBadge + LotsCollapser). FlowsUI-b2 added searchMatch prop + MatchPillRow render. CP6e-SmokeFix-SF2 (2026-05-14): OVERRIDES D8R-Q54. `handleLotBadgeTap` now calls `onToggleExpanded()` instead of `cycleSupplyStatus` — tap surfaces lot details rather than mutating status. iconTouchable accessibility label updated to "Expand/Collapse {name} details, N lots…" when isLotSupply. Pruned now-unused imports (cycleSupplyStatus, setSupplyStatus). Manual status override on tracks_lots supplies remains available via SupplyControls (expanded panel), SupplyDetailScreen status buttons, and the long-press SupplyQuickEditModal. |
| `components/pantry/LotBadge.tsx` | 2026-05-19 | Phase 8R-CP6e-PantryUI-a | Low | NEW (CP6e-PantryUI-a): status-colored pill with numeric `total_quantity` text + small UnitIcon. canonicalUnit=null renders "—" (mixed). Display-only — tap handling lives in SupplyRow's wrapping TouchableOpacity. |
| `components/pantry/LotsList.tsx` | 2026-05-19 | Phase 8R-CP6e-PantryUI-a / -b / FlowsUI-b2 | Low | NEW (CP6e-PantryUI-a): variant grouping (D8R-Q50). CP6e-PantryUI-b: internal search input at ≥4 lots (D8R-Q51). CP6e-FlowsUI-b2 (2026-05-13): added optional `matchedLotIds?: Set<string>` prop forwarded as `highlighted={...has(lot.id)}` to each rendered LotRow. Undefined → no highlighting (non-search path unchanged). |
| `components/pantry/LotRow.tsx` | 2026-05-19 | Phase 8R-CP6e-PantryUI-a / -b / FlowsUI-b2 | Low | NEW (CP6e-PantryUI-a): single-lot row with urgency border + storage badge + qty/unit. -b: tap wiring (no code change). CP6e-FlowsUI-b2 (2026-05-13): added optional `highlighted?: boolean` prop. When true, the row's `backgroundColor` switches to `colors.background.surface` (soft tint), layered inside the existing urgency border so the two don't fight. Default (undefined/false) → transparent → zero visual change vs pre-b2. |
| `components/pantry/MatchPillRow.tsx` | 2026-05-19 | Phase 8R-CP6e-FlowsUI-b2 | Low | NEW (CP6e-FlowsUI-b2, 105 lines): decorative horizontal pill row rendered below a SupplyRow when a server-search match exists. Priority order: name → variant → brand → family → type → tag → notes → storage. Max 3 visible pills + "+N" overflow. Pills are `accessibilityElementsHidden` (decorative); the parent row's accessibility label communicates meaning. Empty matchedDimensions → renders nothing. |
| `lib/utils/unitIcons.tsx` | 2026-05-19 | Phase 8R-CP6e-PantryUI-a | Low | NEW (CP6e-PantryUI-a): pure utility + component. `UnitIconKind` enum (count/bag/bottle/jar/pack/bunch/container/weight); `getUnitIconKind(unit, typicalUnit?)` resolves a unit string via case-insensitive DIRECT_MAP, falls back to `count` for unknown; `UnitIcon` component renders inline react-native-svg paths translated from the CP6e-Lots wireframe v2 SVG `<defs>`. |
| `components/pantry/LotEditSheet.tsx` | 2026-05-19 | Phase 8R-CP6e-PantryUI-b | Low | NEW (CP6e-PantryUI-b): modal sheet for create + edit a lot, discriminated by presence of `lot` prop. Fields: quantity + unit, storage segmented (fridge/freezer/pantry/counter), variant_label (disclosure-toggled), brand, acquired_at (project's DateTimePicker mode="date"), expires_at (with "(auto)" / "(set manually)" hints), notes. Computed default expires_at from acquired_at + ingredient.shelf_life_days_<storage>; recomputes on storage change in edit mode when `expires_at_overridden=false`. Save routes: create → `createLot`; edit → `moveLotStorage` when storage changed + not overridden, then `updateLot` for remaining fields; otherwise plain `updateLot`. "Mark consumed" (edit only) → `archiveLot` (D8R-Q48). Side-effect errors stay inside the modal — caller's `onSaved` / `onArchived` callbacks fire on success only. |
| `lib/utils/lotSearch.ts` | 2026-05-19 | Phase 8R-CP6e-PantryUI-b / FlowsUI-b2 | Low | NEW (CP6e-PantryUI-b): `filterLotsBySearch` + `STORAGE_SYNONYMS` (mirrors server-side `expand_storage_synonyms`). CP6e-FlowsUI-b2 (2026-05-13): added `computeSupplySearchMatch(supply, query)` — client-side post-hoc dimension matcher mirroring `search_supplies` RPC across all 8 dimensions (name / family / type / tag / variant / brand / notes / storage). Dimension match rule: every query token has a synonym-expanded substring hit somewhere in that dimension's texts. matchedLotIds rule: per-lot OR (any token has any hit in any of the lot's 4 dimensions). Used by SuppliesSection to derive MatchPillRow labels + per-lot highlighting after the RPC returns IDs+rank only. |
| `components/ParticipantsListModal.tsx` | 2026-04-22 | | Low | All cooking participants listing (Strava-style) |
| `components/pantry/CookDepletionBanner.tsx` | 2026-05-19 | Phase 8B-CP4 | Low | New — absolute-positioned banner with Review/Undo/✕ + 5s auto-dismiss. |
| `components/pantry/CookDepletionReviewModal.tsx` | 2026-05-19 | Phase 8B-CP4 / CP6e-FlowsUI-a | Low | Review modal with per-row checkboxes for selective rollback. CP6e-FlowsUI-a (2026-05-13, +180 lines): per-row "Drew X from Y lot(s)" summary line (async-resolved via `convertBetween` for mixed-unit aggregation, "…" placeholder while pending) with shortfall + "couldn't draw" variants; per-row "Change ▾" affordance opens `LotPickerModal`. Picker confirm calls `replaceSupplyDeduction` then `updateSupplyEntry` on the banner context (fresh BannerState propagates back). Existing checkbox + Done rollback flow preserved. New tap target on "Change" doesn't toggle the row's checkbox (sibling TouchableOpacity). |
| `components/pantry/LotPickerModal.tsx` | 2026-05-19 | Phase 8R-CP6e-FlowsUI-a | Low | NEW (CP6e-FlowsUI-a, 597 lines): page-sheet modal for revising which lots a cook drew from. Multi-select with per-lot qty inputs; pre-selects from current `lots_affected`. Lots are display-only via reused `<LotRow>` (no inline edit). Unit-incompat lots (no `convertBetween` bridge to recipe unit) render at 0.5 opacity, unselectable, with sub-line hint. Running total in recipe unit at footer; subtle "?" marker + "X short" hint when selected total < recipe qty (no blocking; shortfall acknowledgment UX is DEFERRED). Confirm builds `LotDeductionPlanItem[]` in lots' native units and hands to parent's `onConfirm` (which calls `replaceSupplyDeduction`). |

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
| 2026-05-19 | Full refresh (all tiers) | 32 | 42 | 42 | Standing refresh prompt, all tiers. 116 files stamped + staged to `_pk_sync/code/`. Staleness Risk reset to Low across the refreshed set. Triggered post-8D-CP1.5 close. |

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-30 | 1.2 | **8R completion sweep — Phase 8R-CP1 through CP6c reconciled in one pass.** Tier 1 row removals: lib/types/grocery.ts, lib/types/pantry.ts, lib/groceryListsService.ts, lib/groceryService.ts, lib/pantryService.ts, lib/pantryStaplesService.ts (all deleted in CP2b/CP4). Tier 1 row additions: lib/types/{needs,supplies,tags,views}.ts + lib/services/{needsService,suppliesService,viewsService,tagsService}.ts. Tier 2 row renames: GroceryListsScreen.tsx → ViewsScreen.tsx; GroceryListDetailScreen.tsx → ViewDetailScreen.tsx; ManageStaplesScreen.tsx → ManageSuppliesScreen.tsx. Tier 2 + 3 dates bumped to 2026-04-30 on PantryScreen + RecipeDetailScreen + ViewsScreen + ViewDetailScreen. Tier 3 row additions: AddNeedSheet, SupplyCreateSheet, EditNeedSheet, ExpandedRegularsSheet, ViewCreatorModal, SpawnOnOutToast, AddRecipeToNeedsModal, components/pantry/{SuppliesSection,SupplyRow}.tsx, contexts/SpawnOnOutToastContext.tsx. Per Standing Rule A relaxation, this is the first CP authorized to edit PK_CODE_SNAPSHOTS directly. **Note:** several deleted-component rows (PantryItemRow, StoragePicker, ExpirationPicker, etc. from the CP4/CP4.5 dead-code purges) were NOT row-pruned in this sweep — they may have been off-tier already. Future audit if drift surfaces. |
| 2026-04-22 | 1.1 | **Evidence-based tier rule refinement** before first PK code upload. Previous v1.0 populate used categorical rules ("all `lib/services/**/*.ts`", "all non-Tier-2 `components/*.tsx`") that produced 42/46/72 counts and three flagged issues: Tier 3 over-broad, `lib/types/` directory missed, `lib/` root service files unverified. v1.1 replaces categorical rules with explicit named file lists derived from Claude.ai review of the full 221-file inventory (`_claudeai_context/tier_inventory_2026-04-22.md`, ephemeral). New counts: Tier 1 = 57, Tier 2 = 64, Tier 3 = 35 (total 156). Tier 1 gains `lib/types/*.ts` (9 files; excludes `env.d.ts` TS infra), 5 stray services at `lib/` root (Flag 3 confirmed drift from FRIGO_ARCHITECTURE v4.0), and `lib/ingredientsParser.ts`. Tier 2 adds 15 stats sub-page coordinators and 4 cooking main surfaces (v4 didn't consider these subdirectories). Tier 3 narrowed from "all other `components/*.tsx`" to 35 explicitly named files. 4 DEFERRED_WORK entries seeded: T4 relocate stray services, T5 delete deprecated PostCookFlow, T6 review oldTheme for deletion, T7 resolve QuickAddSection `@ts-nocheck` pragma. Calibration revisit target: Phase 9 boundary. |
| 2026-04-22 | 1.0 | Initial creation alongside `DOC_MAINTENANCE_PROCESS.md` v5.1 and `CLAUDE.md` Rule E. Skeleton populated by CC; file lists seeded from repo scan. |

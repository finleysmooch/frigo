# Frigo Session Log

Append new entries at the top. Weekly sync reads these and distributes into living docs.

### 2026-03-02 — Phase 3A Batch Commit: SVG Icons, Nutrition UI, Recipe Browse, Social Feed, Extraction Pipeline
**Phase:** Phase 3 (Nutrition + Browse)
**Prompt from:** Multiple Claude Code sessions (Feb 24–26), committed together as 6 commits

**Files created:**

*SVG Icon Components (78 files):*
- components/icons/filter/ (14 files) — dietary filter icons, cooking method icons, temperature/diet icons
- components/icons/pantry/ (37 files) — food category icons, dairy subcategories, storage icons, status indicators
- components/icons/recipe/ (18 files) — recipe metadata, badges, cooking mode, list actions
- components/icons/vibe/ (9 files) — 8 recipe mood icons (comfort, fresh & light, impressive, etc.)
- constants/vibeIcons.ts — maps vibe tag strings to SVG icon components

*Services:*
- lib/services/nutritionService.ts (390 lines) — queries recipe_nutrition_computed + recipe_ingredient_nutrition views. getRecipeNutrition, getIngredientNutrition, getCompactNutrition, getRecipeNutritionBatch, aggregateMealNutrition
- lib/services/recipeHistoryService.ts (155 lines) — getCookingHistory (groups posts by recipe, returns Map for O(1) lookups), getFriendsCookingInfo

*Components:*
- components/DietaryBadgeRow.tsx (106 lines) — horizontal row of color-coded dietary flag badges, compact + default sizes, overflow +N more
- components/RecipeNutritionPanel.tsx (486 lines) — collapsible panel: collapsed shows calories + P/C/F, expanded shows macro bar chart, nutrient breakdown, quality indicator, per-ingredient calories

*Supabase Edge Functions:*
- extract-book-toc/ (310 lines) — Claude Sonnet vision extracts TOC from cookbook image
- scan-book-pages/ (438 lines) — scans page spreads, identifies recipes/ingredients/steps/photos
- assemble-book-recipes/ (535 lines) — assembles complete recipes from page data, cross-refs TOC
- process-recipe-queue/ (722 lines) — v12 queue processor, TOC-guided extraction, fuzzy title matching
- extract-recipe-three-pass/ (921 lines) — production 3-pass pipeline (Haiku default, Sonnet option), gold standard comparison, test mode

*Scripts:*
- scripts/recipe_classification_test.py (503 lines) — Haiku vs Sonnet comparison on 10 recipes
- scripts/recipe_classification_backfill.py (412 lines) — batch classify all recipes via Haiku (roles, tags, hero ingredients, vibe, course type, make-ahead). Supports --dry-run, --resume, --limit
- scripts/backfill_cooking_concept.py (220 lines) — cooking_concept backfill via Haiku in batches of 40

**Files modified:**

*Emoji-to-SVG migrations:*
- components/icons/index.ts — barrel re-exports for all 4 icon groups
- constants/pantry.ts — ~30 SVG imports, INGREDIENT_TYPE_ALIASES, component-based icon maps + accessors (getFamilyIconComponent, getTypeIconComponent, getStorageIconComponent)
- components/CategoryHeader.tsx — family icons + type breakdown now SVG with emoji fallback
- components/TypeHeader.tsx — type header renders SVG components
- components/PantryItemRow.tsx — stock badges (Out/Critical/Low) now SVG icons
- screens/PantryScreen.tsx — empty state, expiring header, section headers → SVG with emoji fallback
- screens/GroceryListDetailScreen.tsx — cart emoji → GroceryFilled SVG

*Recipe browse redesign:*
- components/FilterDrawer.tsx — near-complete rewrite. New FilterState: dietaryFlags (8 booleans), heroIngredients, vibeTags, nutrition sliders, servingTemp. Removed: maxCost, minPantryMatch, onePostOnly, dietaryTags. SVG icons on all filter chips.
- screens/RecipeListScreen.tsx — major enhancement. 3 browse modes (All/Cook Again/Try New), Cook Again smart sections (Recent Favorites, Forgotten Gems, Regulars), quick filters with SVG icons, 8 sort options, Phase 3A fields on recipe interface

*Social feed redesign:*
- components/PostCard.tsx — Strava-style stat row (Time/Method/Cuisine), dietary badge row, recipe image fallback, clickable recipe title + chef name, removed star ratings, fixed commentCount nullish coalescing
- components/MealPostCard.tsx — batch nutrition fetch + aggregation, nutrition stats row, clickable dish names, stacked UserAvatar on likes
- components/LinkedPostsGroup.tsx — fixed truthy empty string bug on likesText
- screens/FeedScreen.tsx — recipe query includes cook_time/cuisine, added onDishPress/onRecipePress/onChefPress handlers
- screens/MyPostDetailsScreen.tsx — replaced renderStars() with RecipeNutritionPanel, removed star rating styles
- App.tsx — added RecipeDetail + AuthorView to FeedStackNavigator

*Theming refactors:*
- screens/RecipeDetailScreen.tsx — removed useTheme + useMemo dynamic styles, moved to static StyleSheet.create with hardcoded colors. Added RecipeNutritionPanel. Replaced QuickMealPlanModal with SelectMealForRecipeModal.
- screens/BookViewScreen.tsx — removed dynamic theming + added user auth check (filters recipes by user_id)

*Services + types:*
- lib/types/recipeExtraction.ts — added Phase 3A fields (hero_ingredients, vibe_tags, serving_temp, course_type, make_ahead_score, cooking_concept, ingredient_classification, flavor_tags, page_number)
- lib/services/recipeExtraction/recipeService.ts — save logic for 6 new recipe fields + 2 ingredient fields
- lib/services/mealService.ts — added subscription_tier to MealParticipant
- components/UserAvatar.tsx — fixed emoji regex (added \uFE0F), increased emoji fontSize

*Platform:*
- .gitignore — fixed UTF-16 corruption, added exclusions for External documents/, svg-source/, test scripts, classification JSON, superseded edge functions (v2–v10.2)
- CLAUDE.md — added 8 Domains table, Tracker Row Generation section, removed old theme docs

**DB changes:**
- recipes table: added hero_ingredients (text[]), vibe_tags (text[]), serving_temp, course_type, make_ahead_score (int), cooking_concept
- recipe_ingredients table: added ingredient_classification, flavor_tags (text[])
- posts.cooking_method constraint expanded (added roast, grill, sauté, braise, fry, steam)
- Vegetarian materialized view regex quick fix
- Cuisine types consolidation SQL
- Haiku backfill: 475 recipes classified ($1.66)
- cooking_concept backfill: 475 recipes, 78 unique concepts ($0.036)

**Decisions made during execution:**
- Haiku over Sonnet for recipe classification: Haiku picks heroes by physical presence (what you see), Sonnet by conceptual distinctiveness. For browsing, physical presence wins.
- Client-side filtering with service abstraction: fetch all, filter in memory. Service layer allows migration to server-side at ~1000 recipes.
- Dual icon system: SVG component mappings alongside emoji fallbacks for gradual migration
- cooking_concept as free text: 78 unique concepts — too many for enum, group dynamically
- Static theming on RecipeDetailScreen/BookViewScreen: removed dynamic theming, hardcoded colors for now
- Star ratings removed from PostCard: replaced with nutrition display and dietary badges

**Deferred during execution:**
- B19: Phase 3A save path untested end-to-end (hero_ingredients, vibe_tags etc.)
- B14: Vegetarian defaults proper fix (quick regex applied, root cause remains)
- B20: Counter storage (🪴) still uses emoji, no SVG sourced
- B21: Old emoji icon constants cleanup in constants/pantry.ts
- Dynamic theming re-integration for RecipeDetailScreen and BookViewScreen

**Recommended doc updates:**
- ARCHITECTURE: all new services, icon system, extraction pipeline, directory structure (done in v2.1)
- DEFERRED_WORK: B14-B21, D1-D3 items (done)
- PROJECT_CONTEXT: Phase 3 complete, What Works updated (done in v6.0)

**Status:** All features working. Phase 3 complete. 1,740 posts of test data seeded. Ready for Phase 4 (Cooking Stats Dashboard).

**Surprises / Notes for Claude.ai:**
- BookViewScreen had no user auth check — was showing all users' recipes. Fixed during refactor.
- LinkedPostsGroup had a truthy empty string bug causing phantom likes text.
- UserAvatar emoji regex missed variation selectors (\uFE0F) causing some emoji avatars to not render.

---


### 2026-03-02 — Documentation reorganization and cleanup
**Files modified:** CLAUDE.md, docs/FRIGO_ARCHITECTURE.md (created v2.0)
**Files created:** docs/FRIGO_ARCHITECTURE.md, docs/SESSION_LOG.md, docs/README.md, docs/doc-ecosystem.html
**DB changes:** None
**Key decisions:**
- docs/ folder in repo for Claude Code reference (flat structure, no subfolders yet)
- FRIGO_ARCHITECTURE.md lives in both repo and project knowledge (only truly duplicated doc)
- PROJECT_CONTEXT stays in project knowledge only (Claude Code gets trimmed version later if needed)
- DOC_MAINTENANCE_PROCESS stays in project knowledge only (process for weekly sync sessions)
- doc-ecosystem.html moved from project knowledge to repo (visual reference for Tom, not for Claude)
**Deferred:** Trimmed PROJECT_CONTEXT for repo docs/, doc-ecosystem.html needs updating to reflect cleanup
**Status:** Architecture doc updated to v2.0 (March 2 changelog incorporated, ingredient matching section added with validation warnings). Project knowledge cleaned up (~18 stale files removed). PROJECT_CONTEXT updated to 02MAR26. Weekly sync workflow established.


### 2026-03-02 — Documentation System Overhaul
**Phase:** Cross-cutting
**Prompt from:** Tom initiated full doc system redesign

**Files created:**
- docs/DEFERRED_WORK.md — master backlog, reconciled from old versions. Restored Idea Shelf (I1-I9), B1 flavor spec, R3-R5. Removed resolved T3/T4.
- docs/README.md — index of docs/ contents, reading order, what doesn't live here

**Files modified:**
- CLAUDE.md — added Documentation System section with SESSION_LOG format, reading list, key principles. Updated Key Features list.
- docs/FRIGO_ARCHITECTURE.md — replaced with v2.1 (added domain scope boundaries from Product Architecture, cross-domain integration map)
- docs/SESSION_LOG.md — added entry format template header
- docs/doc-ecosystem.html — updated to reflect planning/execution/reconciliation loop, retired PROJECT_STATUS and Product Architecture Google Doc, added Active Phase Doc and Historical Phase Docs sections

**DB changes:** none

**Decisions made during execution:**
- Per-phase docs replace single PROJECT_STATUS: each completed phase gets its own doc in the standard template format
- Claude Code writes only SESSION_LOG: all other living doc edits are Claude.ai's responsibility
- DEFERRED_WORK updated only at phase completion: during active work, deferred items live in the phase doc
- Product Architecture Google Doc retired: domain scope boundaries folded into FRIGO_ARCHITECTURE v2.1

**Deferred during execution:**
- Historical phase docs (Phases 1-3): prompts drafted, to be run separately in Claude.ai sessions
- Project knowledge cleanup (~18 stale files to remove): pending phase doc creation

**Recommended doc updates:**
- PROJECT_CONTEXT: already updated to v6.0 with new doc system references
- ARCHITECTURE: already updated to v2.1

**Status:** Repo docs updated. Claude.ai project knowledge cleanup (removing ~18 stale files, uploading 3 historical phase docs) is in progress separately.

**Surprises / Notes for Claude.ai:**
- None — planned overhaul


---
EOF
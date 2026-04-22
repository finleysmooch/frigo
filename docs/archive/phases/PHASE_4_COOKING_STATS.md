# Phase 4: Cooking Stats Dashboard
**Started:** March 3, 2026
**Status:** 🔨 In Progress — Core build (A–E) + Global Period Refactor (G1–G3) + UI Polish (H) complete. F1 (nutrition goals) remaining.
**Wireframe:** frigo-stats-wireframe-v8.html (in Claude.ai outputs) — v8 is the converged design for Phase H

---

## Goals

Build the "Strava for cooking" centerpiece — a stats dashboard that makes users feel rewarded for cooking at home. Every stat is a doorway: **Stat → Detail View → Action**.

**Design principles:**
- **Every stat is a doorway, not a dead end.** Understand your cooking, then go do something about it. Actions: browse filtered recipes, add to grocery list, explore cookbooks, discover new foods, set/adjust goals.
- **Tone:** Rewarding and empowering. "You cooked 5 times this week!" not "You only hit your protein target 2 days." Nutrition is curiosity-driven: "Explore your iron" not "Your iron is low."

**Success criteria:**
- "You" tab replaces My Posts in bottom tab bar (chef hat icon stays)
- 4 sub-pages: Overview, Recipes, Nutrition, Insights
- Global period toggle (12W / 6M / 1Y) with rolling windows + time navigation
- Global meal type filter across all sub-pages
- Sticky control bar (sub-tabs + period + meal type) stays pinned while header scrolls away
- Drill-down screens for cuisines, concepts, methods, ingredients
- Chef and Book detail screens with comparison stats
- Nutrition goals with progress tracking
- All navigation CTAs work (stats → filtered recipe lists, stock up → grocery)
- Feels rewarding, not judgmental

**Design reference:** Strava's "You" page — weekly summary cards, progress charts, streak indicators.

---

## Prerequisites (all met ✅)

- 1,740 posts + 285 meals of seeded test data (17 test users, full year of history)
- `recipe_nutrition_computed` materialized view with per-recipe macros
- `recipe_ingredient_nutrition` view for per-ingredient breakdown
- 78 SVG icon components across 4 groups (pantry/filter/recipe/vibe)
- Existing services: `nutritionService.ts`, `recipeHistoryService.ts`, `mealService.ts`
- Recipe classification complete: cooking_concept (78 unique), hero_ingredients, vibe_tags, ingredient_classification

---

## Architecture

Key points:

**Navigation:** Replace My Posts tab → "You" tab (StatsStack). Header: [Avatar] You. Top toggle: Progress / My Posts (My Posts deferred). Sub-tabs: Overview | Recipes | Nutrition | Insights. Global controls: MealTypeDropdown + PeriodToggle (12W/6M/1Y) + time nav arrows (← →).

**Layout:** Single parent `<ScrollView stickyHeaderIndices={[1]}>`. Child 0 = header + toggle (scrolls away). Child 1 = sticky bar (sub-tabs + controls, stays pinned). Child 2 = content. Sub-pages are flat `<View>` components (no internal ScrollView).

**Period model:** Rolling windows via `computeDateRange(period, offset)`. 12W = 84 days back, 6M = 182 days, 1Y = 365 days. All queries use `DateRange { start, end }` with both `.gte` and `.lte` bounds. `timeOffset` shifts the window backward. `getWeeklyFrequency` fetches all data; caller slices to window.

**Data layer:** `lib/services/statsService.ts` — 38 exported functions (33 original + 5 from Phase H), services-only pattern. All queries filter by `StatsParams { userId, dateRange, mealType }`. Phase H additions: enriched `WeeklyFrequency` (nutrition per week), enriched `WeekDot` (emoji), `getWeekStats`, `getGatewayInsights`, `getFrontierSuggestions`, `getGrowthMilestones`, `getCookingPersonality`. Exports `CONCEPT_EMOJI_MAP` (22 concept→emoji mappings).

**Charts:** react-native-svg (already installed for icons). SVG `<Path>` for lines, `<Circle>` for donut, plain Views for heatmap/bars. Chart width responsive via `useWindowDimensions`.

**Icons:** SVG components throughout, emoji only as fallback. Components accept `iconComponent?: React.ComponentType<{size, color}>` prop.

**New DB table (pending):** `user_nutrition_goals` (Phase F1).

---

## Build Phases

| Phase | Scope | Sessions | Status |
|-------|-------|----------|--------|
| **A1** | statsService.ts — types, helpers, Overview functions (7) | 1 | ✅ Complete |
| **A2** | statsService.ts — Recipes (9), Nutrition (6), Insights (5), Drill-Down (4), Chef/Book (2) | 1 | ✅ Complete |
| **B1** | Shared UI components (16 components) | 1 | ✅ Complete |
| **C1** | StatsScreen shell + Overview page + "You" tab integration | 1 | ✅ Complete |
| **C2** | Recipes sub-page | 1 | ✅ Complete |
| **C3** | Nutrition sub-page | 1 | ✅ Complete |
| **C4** | Insights sub-page | 1 | ✅ Complete |
| **D1** | RecipeListScreen filter params + DrillDownScreen | 2 (D1a + D1b) | ✅ Complete |
| **E1** | ChefDetailScreen | 1 | ✅ Complete |
| **E2** | BookDetailScreen | 1 | ✅ Complete |
| **G1** | statsService period system refactor (rolling windows) | 1 | ✅ Complete |
| **G2** | StatsScreen layout + sticky header + global controls | 1 | ✅ Complete |
| **G3** | Sub-page adaptations (dateRange props, remove ScrollViews, remove local toggles) | 1 | ✅ Complete |
| **F1** | Nutrition goals table + modal + polish pass | 1 | ⏳ Next |
| **H0** | statsService enrichment (5 new functions, 2 enriched, 6 new types, CONCEPT_EMOJI_MAP) | 1 | ✅ Complete |
| **H1** | CalendarWeekCard + StatsOverview restructure (compact sections, chart dot selection) | 1 | ✅ Complete |
| **H2** | WeeklyChart extraction + 5 mode toggles + bidirectional chart↔calendar sync | 1 | ✅ Complete |
| **H3** | Recipes page overhaul (Kitchen/Frontier, Podium, BubbleMap, ingredient family chips) | 1 | ✅ Complete |
| **H4** | FrontierCards + GatewayCard insight/period polish | 1 | ✅ Complete |
| **H5** | Nutrition color refresh (NUTRITION_COLORS palette, macro cards, drill-down consistency) | 1 | ✅ Complete |
| **H6** | Insights overhaul (CookingPersonalityCard, GrowthTimeline, diversity growth context) | 1 | ✅ Complete |

**Total sessions so far:** 21

---

## Decisions Log

| Decision | Rationale | Date | Origin |
|----------|-----------|------|--------|
| Replace My Posts tab with "You" | Profile accessible via avatar. My Posts content moves to "My Posts" toggle within StatsScreen (deferred). | Mar 3 | Claude.ai review |
| Keep chef hat icon for You tab | Continuity with existing UI | Mar 3 | Tom |
| react-native-svg for charts | recharts is web-only, react-native-svg already installed for 78 icon components | Mar 3 | Claude.ai review |
| SVG icons, not emojis | Consistent with Phase 3A icon system. Components accept iconComponent prop with emoji fallback | Mar 3 | Claude.ai review |
| ingredient_classification for stock-up | Column is hero/primary/secondary (from Phase 3A). ingredient_role is different (core/garnish) | Mar 3 | Claude.ai review |
| ChefDetailScreen is NEW screen | Separate from AuthorViewScreen (which uses chefName param). ChefDetailScreen uses chefId | Mar 3 | Claude.ai review |
| Diminishing returns diversity formula | Old formula saturated at 15 cuisines + 8 methods. New: needs ~12 cuisines + ~8 methods + ~15 concepts to approach 100 | Mar 3 | Claude.ai review → Tom approved |
| "My Posts" as second toggle (not "Activity") | Former My Posts tab content will live under this toggle | Mar 3 | Tom |
| Nutrition averages weighted by cook count | Recipe cooked 5x counts 5x in average — matches actual eating patterns | Mar 3 | Claude Code A2 |
| Fiber/sugar/sodium computed from totals | recipe_nutrition_computed only has per-serving for cal/protein/fat/carbs. Others: total ÷ servings | Mar 3 | Claude.ai review, confirmed A2 |
| getCookbookProgress filtered to user_books | Only show books user has claimed ownership of | Mar 3 | Claude.ai review |
| createStyles(colors) factory pattern | Matches CategoryHeader.tsx pattern — styles defined outside component, memoized via useMemo | Mar 3 | Claude Code B1 |
| Independent section loading in sub-pages | Each section has own useEffect/loading state. Sections appear progressively, one failure doesn't block others. | Mar 3 | Claude Code C2 |
| SVG Circle donut with strokeDasharray/strokeDashoffset | Three P/C/F segments as separate Circle elements, 2px gaps, butt linecap. No chart library. | Mar 3 | Claude Code C3 |
| Inline drill-downs one at a time | Expanding new nutrient closes previous. Keeps scrollview manageable, reduces concurrent API calls. | Mar 3 | Claude Code C3 |
| DrillDown queries use period:'all', mealType:'all' | Drill-downs show all-time data since they're accessed from recipe sub-page with its own period context. | Mar 3 | Claude Code D1a |
| Default browse mode try_new when filter present | User navigating from drill-down Browse is exploring uncooked recipes. | Mar 3 | Claude Code D1b |
| **Rolling windows replace calendar periods** | Old StatsPeriod (`week/month/season/year/all`) was calendar-based — "month" meant "since March 1" which returned zero results for Feb-ending seed data. New: 12W=84d, 6M=182d, 1Y=365d rolling backward from today. | Mar 4 | Claude.ai design |
| **Both gte AND lte bounds on all queries** | Old `applyDateRange` only set a lower bound. New `applyDateRangeFilter` sets both, essential for time-offset navigation to show correct data. | Mar 4 | Claude Code G1 |
| **getWeeklyFrequency fetches all data** | Signature changed from `(userId, period)` to `(userId, mealType)`. No date filter — caller slices to window. Enables time-offset navigation without refetching. | Mar 4 | Claude Code G1 |
| **Single parent ScrollView, sub-pages as flat Views** | All sub-pages had their own ScrollViews which nested badly. Now StatsScreen owns the single ScrollView; sub-pages render as `<View>` children. | Mar 4 | Claude.ai design |
| **stickyHeaderIndices={[1]} for pinned control bar** | Child 0 = header + toggle (scrolls away), Child 1 = sub-tabs + filters (sticks), Child 2 = content. | Mar 4 | Claude.ai design |
| **All local period toggles removed** | StatsRecipes had its own PeriodToggle on Most Cooked; StatsNutrition had its own Week/Month/Year toggle. Both removed — global toggle applies everywhere. | Mar 4 | Claude.ai design |
| **Chart responsive width via useWindowDimensions** | Replaced hardcoded 320px. Formula: `screenWidth - (spacing.lg * 4)` for outer+inner padding. | Mar 4 | Claude Code G3 |
| **PeriodDropdown component deleted** | Replaced by PeriodToggle in sticky bar. Dead code removed. | Mar 4 | Claude Code G3 |
| **Session 0 service-first approach for Phase H** | Separating data layer from UI reduces risk per session — all 7 UI sessions had data ready on arrival. | Mar 4 | Claude.ai design |
| **Keep How You Cook, Partners, New vs Repeat** | User value — How You Cook and New vs Repeat redesigned compact. Cooking Partners kept full-size (personal, worth the space). | Mar 4 | Tom direction |
| **Keep Chefs/Books, Discovery, Complexity, Pantry** | Reorganized into Kitchen/Frontier framing (Recipes) and reordered (Insights). Not removed. | Mar 4 | Tom direction |
| **Static concept→emoji map (22 entries)** | Simple, performant, good enough for v1. Recipe images replace emojis later. | Mar 4 | Claude.ai review |
| **Frontier suggestions v1: 3 simple rules** | High-rated-rare cuisines, low-count concepts, untouched cookbooks. Partner-popular and seasonal deferred. | Mar 4 | Tom + Claude.ai |
| **Solid color fallback for personality card** | expo-linear-gradient not installed. Used #0b6b60 solid. Gradient deferred. | Mar 4 | Claude Code H6 |
| **weekFetchRef counter for stale-fetch cancellation** | Supabase JS doesn't support AbortController. Simple ref counter ignores stale results. | Mar 4 | Claude Code H1 |
| **StackedBar internal component removed** | Both consumers (How You Cook, New vs Repeat) redesigned to compact layouts. No other consumers. | Mar 4 | Claude Code H1 |
| **CONCEPT_EMOJI_MAP + DEFAULT_COOK_EMOJI exported** | Needed by MostCookedPodium and CalendarWeekCard across multiple files. | Mar 4 | Claude Code H3 |
| **Ingredient family chips built inline in StatsRecipes** | New colored-chip design too different from existing SignatureIngredientGroup. Built fresh. | Mar 4 | Claude Code H3 |
| **veg_pct chart mode uses fixed 0-100 Y-axis** | Values are always percentages — auto-scaling would mislead. | Mar 4 | Claude Code H2 |
| **NUTRITION_COLORS defined in StatsNutrition only** | Single consumer file. Not worth a shared constants file. | Mar 4 | Claude Code H5 |
| **Skip gateway card sparklines for v1** | Insight text + period label already make cards much richer. Sparklines deferred. | Mar 4 | Claude.ai review |

---

## Schema Findings (from A1 + A2)

Verified against live DB during implementation:

- **meal_type values:** `dinner` (998), `null` (1), `party` (1). No lunch/breakfast/dessert/meal_prep yet. Filter works but won't demonstrate with seed data.
- **post_participants column:** Confirmed `participant_user_id` (not `participant_id`)
- **recipe_nutrition_computed columns:** `cal_per_serving`, `protein_per_serving_g`, `fat_per_serving_g`, `carbs_per_serving_g` (direct). `total_fiber_g`, `total_sugar_g`, `total_sodium_mg` (totals only). Dietary flags: `is_vegan`, `is_vegetarian`, `is_gluten_free`, `is_dairy_free`, `is_nut_free`, `is_shellfish_free`, `is_soy_free`, `is_egg_free`.
- **recipe_ingredient_nutrition view:** Only `calories`, `protein_g`, `fat_g`, `carbs_g`. No fiber/sugar/sodium per ingredient.
- **ingredients table:** Has macro columns (per 100g) but NO vitamin/mineral columns (no iron, calcium, vitamin A, etc.).
- **modifications column:** Can be null, empty string, or text. Both null and empty checked.
- **Tom's test user ID:** `47feb56f-530f-4ab3-8fef-33664c3885b7`

---

## Test Data Profile (Tom — 175 posts)

| Metric | Value | Notes |
|--------|-------|-------|
| Total dish posts | 175 | Spanning 48 weeks (Feb 2025 – Feb 2026) |
| Unique recipes | 141 | 81% new, 19% repeat — seed data skews toward unique |
| Avg rating | 4.7 | |
| Top cuisine | Italian (41) | Then American (39), Middle Eastern (39), Mediterranean (38) |
| Top concept | Salad (28) | Then composed_plate (19), roast (18), soup (11) |
| Top ingredient | Garlic (28) | Then kosher salt (25), salt (22), lemon (19) |
| Diversity score | 100 | 38 cuisines, 55 methods, 36 concepts — seed data is maximally diverse |
| Dietary breakdown | Veg 51%, GF 66%, DF 40%, Vegan 18% | |
| Nutrition avg | 367 cal, 14.1g protein | All 175 posts have nutrition data |
| Cooking partners | 11 participants found | |
| How you cook | 172 from recipe, 3 modified, 0 freeform | Seed data heavily recipe-based |
| ai_difficulty_score | 11 recipes scored (range 25-65) | Sparse — complexity trend will be thin |
| Cookbooks | 4 books in user_books | |

---

## Progress

### Phase A: Data Layer ✅

**A1 (Mar 3):** Created `lib/services/statsService.ts` with types, helpers, 7 Overview functions. All tested with Tom's data.

**A2 (Mar 3):** Added 26 functions + 6 internal helpers + 22 types. Total: 33 exported functions (~1,200 lines). Two functions stubbed (getMicronutrientLevels, getTopNutrientSources for fiber/sugar/sodium). All others tested.

### Phase B: Shared Components ✅

**B1 (Mar 3):** Created 16 components in `components/stats/` with barrel export via `index.ts`. All pure presentational, zero TS errors. SVG icons used throughout. Theme: dual-import pattern (useTheme for scheme colors + static imports for spacing/typography). Uses `gap` style property (requires RN 0.71+ / Expo SDK 50+).

### Phase C: Stats Screen + Sub-Pages ✅

**C1 (Mar 3):** StatsScreen.tsx (nav shell) + StatsOverview.tsx (streak, SVG line chart, gateway cards, stacked bars). Replaced MyPostsStack → StatsStack in App.tsx.

**C2 (Mar 3):** StatsRecipes.tsx — 8 sections with independent loading. Navigation wired to RecipeDetail, DrillDown, ChefDetail, BookDetail.

**C3 (Mar 3):** StatsNutrition.tsx — SVG donut, inline nutrient drill-downs, goals empty state, dietary tiles, micronutrients placeholder.

**C4 (Mar 3):** StatsInsights.tsx — Diversity, complexity, seasonal patterns, heatmap (TZ-corrected), pantry utilization.

### Phase D: Drill-Down Screens ✅

**D1a (Mar 3):** DrillDownScreen.tsx — reusable for cuisine/concept/method/ingredient. 6 sections: Hero Stats, Most Cooked, Top Ingredients, Top Chefs, Related Concepts, Explore CTA.

**D1b (Mar 3):** RecipeListScreen extended with 6 initial filter params. Cross-stack navigation wired. Cuisine and concept Browse works end-to-end.

### Phase E: Chef + Book Detail Screens ✅

**E1 (Mar 3):** ChefDetailScreen.tsx — 7 sections. Chef name fetched separately (service gap).

**E2 (Mar 3):** BookDetailScreen.tsx — 8 sections. Progress bar unique to book view. Book title fetched separately (same gap).

### Phase G: Global Period Refactor ✅

Replaced the calendar-based period model + fragmented controls with a unified system.

**G1 (Mar 4):** statsService refactor — `StatsPeriod` changed to `'12w' | '6m' | '1y'`, `StatsParams.period` replaced by `StatsParams.dateRange`, `computeDateRange(period, offset)` exported, old calendar helpers deleted. `getWeeklyFrequency` now fetches all data (caller slices). Both `.gte` and `.lte` bounds on all queries.

**G2 (Mar 4):** StatsScreen layout — Single `<ScrollView stickyHeaderIndices={[1]}>`. Global control bar with MealTypeDropdown + PeriodToggle + time nav arrows. Date range label shows when offset > 0. Scroll-to-top on sub-tab change.

**G3 (Mar 4):** Sub-page adaptations — All 4 sub-pages receive `dateRange: DateRange` instead of `period: StatsPeriod`. All internal ScrollViews replaced with flat Views. All local PeriodToggles removed (StatsRecipes' Most Cooked toggle, StatsNutrition's Week/Month/Year toggle). PeriodDropdown component deleted. Verified via grep: zero remaining references to old period model.

### Phase F: Nutrition Goals ⏳

Next up: F1 (user_nutrition_goals table, NutritionGoalsModal).

**DB table needed (from spec):**
```sql
CREATE TABLE user_nutrition_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  nutrient TEXT NOT NULL,        -- 'calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium'
  goal_value NUMERIC NOT NULL,   -- target per meal
  goal_unit TEXT NOT NULL,       -- 'g', 'mg', 'cal'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, nutrient)
);
-- RLS: Users can manage own goals
```

StatsNutrition already has a Goals empty state with "Edit goals" button (logs tap). F1 wires this to a real modal + table.

### Phase H: UI Polish ✅

Visual overhaul of the Stats dashboard based on wireframe v8. Service-first approach: Session 0 built all data functions, Sessions 1-6 built UI.

**H0 (Mar 4):** statsService enrichment — Enriched `WeeklyFrequency` (caloriesAvg, proteinAvg, vegPct, newCount, repeatCount) and `WeekDot` (emoji, recipeName). Added 5 new functions: `getWeekStats`, `getGatewayInsights`, `getFrontierSuggestions`, `getGrowthMilestones`, `getCookingPersonality`. Added `CONCEPT_EMOJI_MAP` (22 concept→emoji mappings). 6 new types exported.

**H1 (Mar 4):** CalendarWeekCard.tsx — 7-day emoji grid with week navigation, streak badge, stats row with deltas vs prior week. Replaced streak+StreakDots in StatsOverview. Added `selectedWeekOffset` state with independent week-specific data loading (weekFetchRef for stale-fetch cancellation). Chart dots tappable with 44px hit areas. How You Cook and New vs Repeat compressed to compact single-row cards. Cooking Partners kept full-size.

**H2 (Mar 4):** WeeklyChart.tsx — Extracted inline chart (~170 lines) into standalone component (~370 lines). 5 chart modes (meals, calories, protein, veg%, new/repeat). Mode toggle pills, tappable dots, selected week highlight (16px rect, 6% opacity), bidirectional chart↔calendar sync. Dual-line rendering for new/repeat mode. Graceful fallback for missing data.

**H3 (Mar 4):** Recipes page overhaul — SectionHeader (kitchen/frontier variants), MostCookedPodium (3-pedestal with medals + emoji thumbnails), ConceptBubbleMap (size-scaled circles, 3 visual tiers: staple/regular/frontier with dashed borders), ingredient family-grouped colored chips (produce/pantry/dairy/proteins). StatsRecipes restructured into Kitchen → Frontier sections. "See all" links on cuisines/methods. Worth Exploring placeholder for Session 4.

**H4 (Mar 4):** FrontierCards.tsx — Horizontal scrollable suggestion cards (140px, dashed border, amber labels). Loading skeleton with pulsing animation. Integrated into StatsRecipes Frontier section. GatewayCard extended with insight/period props (backward compatible). StatsOverview computes priorDateRange and calls `getGatewayInsights` for all 4 cards.

**H5 (Mar 4):** Nutrition color refresh — NUTRITION_COLORS palette (protein=teal-cyan, carbs=warm-amber, fat=muted-rose, plus fiber/sodium/sugar). Updated donut, NutrientRow dots, drill-down trend lines. Added 3 macro summary cards between donut and nutrient rows. Divider between macro and secondary nutrients. All driven by NUTRIENTS config array — single source of truth.

**H6 (Mar 4):** Insights overhaul — CookingPersonalityCard.tsx (dark teal card, template-based narrative, tag pills). GrowthTimeline.tsx (monthly milestone entries). Diversity section gains "Since last period" growth context (+N new methods/cuisines). Complexity trend compacted (80px height, sparse data hint). Page reordered: Personality → Diversity → Growth → Complexity → Seasonal → Heatmap → Pantry.

---

## Deferred Items

| ID | Item | Type | Priority | Origin | Notes |
|----|------|------|----------|--------|-------|
| D4-1 | getMicronutrientLevels stubbed | Data gap | 🟡 | A2 | Needs USDA vitamin/mineral data import on ingredients table |
| D4-2 | getTopNutrientSources for fiber/sugar/sodium stubbed | Data gap | 🟡 | A2 | recipe_ingredient_nutrition view lacks these columns |
| D4-3 | totalTimeHours in getOverviewStats stubbed | Data gap | 🟡 | A1 | posts table has no cook_time; needs join to recipes.total_time |
| D4-4 | Cookbook recipe_count mismatch | Data quality | 🟢 | A2 | "Plenty" has recipe_count=16 in user_books but 35 matching recipes. getCookbookProgress can show >100% completion. Fix: use MAX(recipe_count, actual_count) |
| D4-5 | ~~Heatmap shows UTC times~~ | — | — | — | ✅ Resolved in C4 |
| D4-6 | My Posts toggle integration | Feature | 🟡 | Spec | "My Posts" toggle visible but greyed out. Eventually absorbs MyPostsScreen content. |
| D4-7 | ~~RecipeListScreen filter params~~ | — | — | — | ✅ Resolved in D1b |
| D4-8 | Sparse ai_difficulty_score data | Data gap | 🟢 | A2 | Only 11 recipes scored. Complexity trend will be thin until more recipes are classified |
| D4-9 | Component animation/transitions | Polish | 🟡 | B1 | No animations on period toggle, bar fill, dot activation. Address in Phase H. |
| D4-10 | Accessibility labels on stats components | Polish | 🟡 | B1 | Should be added during polish pass |
| D4-11 | Legacy MyPostsStackParamList cleanup | Tech debt | 🟢 | C1 | Type export kept for 4 screens. Clean up when those screens are updated. |
| D4-12 | Seasonal pattern tile taps | Navigation | 🟢 | C4 | Tap season tile → RecipeListScreen filtered by season. |
| D4-13 | Diversity breakdown taps | Navigation | 🟢 | C4 | Tap cuisine/method/concept count → navigate to relevant sub-section. |
| D4-14 | initialChefId filtering in RecipeListScreen | Feature gap | 🟢 | D1b | Param declared but not consumed — needs chef's recipe IDs fetch |
| D4-15 | initialBookId filtering in RecipeListScreen | Feature gap | 🟢 | D1b | Param declared but not consumed |
| D4-16 | Ingredient drill-down Browse filter | Feature gap | 🟢 | D1b | No initialIngredientId param — ingredient filtering needs recipe_ingredients join |
| D4-17 | initialCookingMethod param | Mapping gap | 🟢 | D1b | Method drill-down maps to initialCookingConcept (imprecise) |
| D4-18 | StockUpCard grocery integration | Feature gap | 🟢 | E1 | "Add to grocery list" logs tap — needs groceryService wiring |
| D4-20 | Chef books as CookbookProgressRow | Data shape | 🟢 | E1 | TopBookItem has count only, not cooked/total progress shape |
| D4-21 | Entity name missing from detail services | Service gap | 🟢 | E1+E2 | getChefStats and getBookStats both don't return entity name. Both screens query separately. |
| D4-22 | Animated header collapse | Polish | 🟢 | G2 | stickyHeaderIndices makes header disappear abruptly. Smooth animated collapse would be nicer but complex. |
| D4-23 | Gateway cards don't shift with time offset | Feature gap | 🟢 | G2 | Cards use StatsParams which takes DateRange, but time offset navigation only affects the chart slice. Cards re-fetch with the new dateRange — this actually works correctly now after the refactor. **May be resolved — needs testing.** |
| D4-24 | My Posts nested ScrollView | Layout bug | 🟡 | G2 | MyPostsScreen has its own ScrollView which nests badly in the parent. Needs flat View conversion when built. |
| D4-25 | Gateway card sparklines | Polish | 🟢 | H review | Faint trendlines in card bottom-right. Data available from enriched WeeklyFrequency. |
| D4-26 | Frontier suggestions v2 | Feature | 🟡 | H review | Add: partner-popular items, seasonal relevance, ingredient overlap. Current v1 uses 3 simple rules. |
| D4-27 | MostCookedPodium recipe images | Polish | 🟢 | H review | Replace emoji thumbnails with actual recipe photos when photo system is ready. |
| D4-28 | ConceptBubbleMap manual layout | Polish | 🟢 | H review | If flexWrap layout has gaps on device, implement manual row-based circle packing. |
| D4-29 | CookingPersonalityCard gradient | Polish | 🟢 | H6 | Replace solid #0b6b60 with LinearGradient when expo-linear-gradient is installed. |
| D4-30 | Animated chart↔calendar transitions | Polish | 🟢 | H review | Smooth animation when selecting weeks, switching chart modes. |
| D4-31 | Export getMondayOfWeek from statsService | Tech debt | 🟢 | H1 | Currently private helper, duplicated in StatsOverview. Export to avoid duplication. |
| D4-32 | MealDetail navigation from CalendarWeekCard | Feature | 🟡 | H1 | Day press handler is no-op placeholder. Needs MealDetail screen. |
| D4-33 | Chart↔calendar scroll-into-view | Polish | 🟢 | H1 | When calendar navigates to a week off-screen in the chart, chart doesn't scroll. |
| D4-34 | RecipeListScreen sortBy param | Feature | 🟢 | H3 | Podium "See all" navigates with sortBy:'cook_count' but RecipeListScreen may not support it. |
| D4-35 | Podium cooking_concept emoji lookup | Polish | 🟢 | H3 | Currently uses static emojis per rank. Could look up recipe's cooking_concept for accurate emoji. |
| D4-36 | Expand CONCEPT_EMOJI_MAP coverage | Polish | 🟢 | H0 | Only covers 22 of 78 concepts. Expand as new concepts appear. |
| D4-37 | colors.text.quaternary theme fallback | Tech debt | 🟢 | H4 | GatewayCard period text falls back to tertiary. Add quaternary to theme. |
| D4-38 | Personality card loading skeleton | Polish | 🟢 | H6 | Uses generic CardShell. Could get dark-bg-specific skeleton. |
| D4-39 | Friends' stats comparison | Feature | 🟢 | Spec | Privacy + social design needed. Compare cooking stats with friends. Future. |

---

## Files Changed

### Created
| File | Phase | Notes |
|------|-------|-------|
| lib/services/statsService.ts | A1+A2+G1 | 33 exported functions, 22 types. Rolling window period model. |
| components/stats/index.ts | B1+G3 | Barrel export. PeriodDropdown removed in G3. |
| components/stats/PeriodToggle.tsx | B1 | Horizontal pill toggle for period selection |
| components/stats/MealTypeDropdown.tsx | B1 | Modal dropdown for meal type filter |
| components/stats/GatewayCard.tsx | B1 | Tappable overview card with iconComponent/iconEmoji |
| components/stats/StreakDots.tsx | B1 | 7-dot week display |
| components/stats/MiniBarRow.tsx | B1 | Universal ranked item row |
| components/stats/RankedList.tsx | B1 | Wraps MiniBarRow list |
| components/stats/TappableConceptList.tsx | B1 | Horizontal-wrap chip list |
| components/stats/ComparisonBars.tsx | B1 | Side-by-side comparison bars |
| components/stats/DrillDownPanel.tsx | B1 | Expandable inline panel |
| components/stats/NutrientRow.tsx | B1 | Colored dot + name + value |
| components/stats/IngredientFilterPills.tsx | B1 | Horizontal scrollable pills with SVG |
| components/stats/DiversityBadge.tsx | B1 | Score ring with tier-colored border |
| components/stats/GoalRow.tsx | B1 | Nutrition goal progress bar |
| components/stats/SignatureIngredientGroup.tsx | B1 | Grouped ingredient list |
| components/stats/StockUpCard.tsx | B1 | Green CTA card with ingredient list |
| components/stats/CookbookProgressRow.tsx | B1 | Book + progress bar |
| components/stats/CompactBarRow.tsx | B1 | Compact bar variant |
| screens/StatsScreen.tsx | C1+G2 | Main container: sticky header, global controls, sub-page rendering |
| components/stats/StatsOverview.tsx | C1+G3 | Overview sub-page: streak, chart, gateway cards, bars |
| components/stats/StatsRecipes.tsx | C2+G3 | Recipes sub-page: 8 sections, independent loading |
| components/stats/StatsNutrition.tsx | C3+G3 | Nutrition sub-page: SVG donut, inline drill-downs |
| components/stats/StatsInsights.tsx | C4+G3 | Insights sub-page: diversity, complexity, heatmap, pantry |
| screens/DrillDownScreen.tsx | D1a+D1b | Reusable drill-down, cross-stack nav |
| screens/ChefDetailScreen.tsx | E1 | Chef stats: 7 sections |
| screens/BookDetailScreen.tsx | E2 | Book stats: 8 sections |
| components/stats/CalendarWeekCard.tsx | H1 | 7-day emoji grid, week nav, streak badge, stats row with deltas |
| components/stats/WeeklyChart.tsx | H2 | Extracted chart: 5 modes, tappable dots, selected highlight, dual-line |
| components/stats/SectionHeader.tsx | H3 | Kitchen/Frontier section dividers with colored tag pills |
| components/stats/MostCookedPodium.tsx | H3 | 3-pedestal podium with medals, emoji thumbnails, cook counts |
| components/stats/ConceptBubbleMap.tsx | H3 | Size-scaled bubbles, 3 tiers (staple/regular/frontier), legend |
| components/stats/FrontierCards.tsx | H4 | Horizontal scroll cards, dashed border, loading skeleton, empty state |
| components/stats/CookingPersonalityCard.tsx | H6 | Dark teal card, template narrative, tag pills |
| components/stats/GrowthTimeline.tsx | H6 | Monthly milestone timeline entries |

### Deleted
| File | Phase | Notes |
|------|-------|-------|
| components/stats/PeriodDropdown.tsx | G3 | Replaced by PeriodToggle in sticky bar |

### Modified
| File | Phase | Notes |
|------|-------|-------|
| App.tsx | C1, D1a, D1b, E1, E2 | MyPostsStack → StatsStack, all StatsStack placeholders replaced |
| screens/ProfileScreen.tsx | C1 | Activities row → StatsStack |
| screens/RecipeListScreen.tsx | D1b | Initial filter params on mount |
| lib/services/statsService.ts | H0 | +5 new functions, 2 enriched, 6 new types, CONCEPT_EMOJI_MAP exported |
| components/stats/StatsOverview.tsx | H1+H2+H4 | CalendarWeekCard, WeeklyChart, compact sections, gateway insights, chart extracted |
| components/stats/StatsRecipes.tsx | H3+H4 | Kitchen/Frontier structure, podium, bubble map, family chips, frontier cards |
| components/stats/StatsNutrition.tsx | H5 | NUTRITION_COLORS palette, macro cards, divider, drill-down chart consistency |
| components/stats/StatsInsights.tsx | H6 | Personality card, growth timeline, diversity context, complexity compact, page reorder |
| components/stats/GatewayCard.tsx | H4 | Added insight/period optional props (backward compatible) |
| components/stats/index.ts | H1-H6 | +8 barrel exports (CalendarWeekCard, WeeklyChart, SectionHeader, MostCookedPodium, ConceptBubbleMap, FrontierCards, CookingPersonalityCard, GrowthTimeline) |

### To Be Created (upcoming)
| File | Phase | Notes |
|------|-------|-------|
| components/NutritionGoalsModal.tsx | F1 | Goal editing bottom sheet |

---

## Claude Code Prompts Issued

| Prompt | Date | Session | Result |
|--------|------|---------|--------|
| A1: Core Stats Service — Overview | Mar 3 | 1 | ✅ |
| A2: Recipes + Nutrition + Insights | Mar 3 | 2 | ✅ |
| B1: Shared Stat Components | Mar 3 | 3 | ✅ |
| C1: StatsScreen + Overview + Nav | Mar 3 | 4 | ✅ |
| C2: Recipes Sub-Page | Mar 3 | 5 | ✅ |
| C3: Nutrition Sub-Page | Mar 3 | 6 | ✅ |
| C4: Insights Sub-Page | Mar 3 | 7 | ✅ |
| D1a: DrillDownScreen | Mar 3 | 8 | ✅ |
| D1b: RecipeListScreen Filter Params | Mar 3 | 9 | ✅ |
| E1: ChefDetailScreen | Mar 3 | 10 | ✅ |
| E2: BookDetailScreen | Mar 3 | 11 | ✅ |
| G1: statsService Period System Refactor | Mar 4 | 12 | ✅ |
| G2: StatsScreen Layout + Global Controls | Mar 4 | 13 | ✅ |
| G3: Sub-Page Adaptations | Mar 4 | 14 | ✅ |
| H0: Service Layer Enrichment | Mar 4 | 15 | ✅ |
| H1: CalendarWeekCard + StatsOverview Restructure | Mar 4 | 16 | ✅ |
| H2: WeeklyChart Extraction + Mode Toggles | Mar 4 | 17 | ✅ |
| H3: Recipes Page Overhaul (Kitchen/Frontier) | Mar 4 | 18 | ✅ |
| H4: Frontier Cards + Gateway Card Polish | Mar 4 | 19 | ✅ |
| H5: Nutrition Color Refresh + Macro Cards | Mar 4 | 20 | ✅ |
| H6: Insights Page Overhaul | Mar 4 | 21 | ✅ |

---

## Superseded Documents

These docs were consumed into Phase 4 work and are no longer active:
- `PHASE_4_OVERVIEW_RESTRUCTURE.md` — Superseded by Global Period Refactor (G1-G3). The overview restructure (chart card controls) was the first attempt; the global refactor replaced it entirely.
- `_PHASE_4_GLOBAL_PERIOD_REFACTOR.md` — All 3 sessions complete. Content reconciled into this doc.
- `STATS_DASHBOARD_PROMPTS.md` — All prompts issued and completed.
- `PHASE_H_UI_POLISH_PLAN.md` — Design plan consumed into Phase H prompts. All 12 tasks (H1-H12) executed across 7 sessions (H0-H6).
- `PHASE_H_PROMPTS.md` — All 7 session prompts issued and completed (repo copy at `docs/PHASE_H_PROMPTS.md`).
- `STATS_DASHBOARD_SPEC.md` — Original build spec. Design principles absorbed into Goals section above. `user_nutrition_goals` schema preserved in Phase F section. Navigation architecture, service signatures, component specs, and SQL queries all implemented in code — code is now the source of truth. Remaining deferred items (friends' stats, taste profile, meal cost) tracked in Deferred Items and DEFERRED_WORK.md.
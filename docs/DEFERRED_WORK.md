# FRIGO — Deferred Work & Action Items

**Last Updated:** March 2, 2026  
**Canonical location:** Repo `docs/DEFERRED_WORK.md` (copy in Claude.ai project knowledge)

---

## How This Document Works

Items land here at **phase completion** after a reconciliation review. During active phase work, deferred items live in the active phase doc. When a phase completes, Claude.ai reviews those items: resolved items are dropped, items still relevant move here under a "From: Phase N" section, items not worth tracking are discarded.

This is the master backlog — the accumulated deferred work from all completed phases plus cross-cutting tech debt and roadmap ideas.

**Priority levels:** 🔴 High (affects accuracy/UX significantly), 🟡 Medium (would improve quality), 🟢 Low (nice to have), ⚪ By design (accepted tradeoff)

**Types:** 🐛 Bug/Gap, 💡 Idea, 🔧 Technical debt, 📊 Data quality, 🚀 Feature, 🧪 Testing

---

## From: Nutrition Data Foundation Subproject (Feb 2026)

### Open Action Items

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| N1 | Integrate subproject services into codebase | 🔧 | 🟡 | quantityNormalizer, unitNormalizer, ingredientNameCleaner, ingredientMatcher, gramEstimator — all built & tested but not in repo. Needed when extraction pipeline handles new recipes. Not blocking UI. |
| N2 | Import vitamins & minerals from USDA | 📊 | 🟡 | Only 7 macros imported so far. Vitamin A/C/D/E/K, B vitamins, calcium, iron, magnesium, potassium, zinc, selenium all available in same SR Legacy file. Needed for Phase 6 recommendations ("High in vitamin C"). |
| N3 | Fill 10 unmapped USDA ingredients | 📊 | 🟢 | Gochujang, harissa, mirin, pomegranate molasses, za'atar, sumac, urfa pepper, aleppo pepper, silan (date syrup), barberries. Try Foundation Foods dataset or fill manually. |
| N4 | Tag ~70 "for serving/garnish" ingredient rows | 📊 | 🟢 | ingredient_role = 'garnish' with nutrition_multiplier = 0. Low caloric impact. Schema and frying oil fixes already done. |
| N5 | Update extraction pipeline to output ingredient_role | 🔧 | 🟡 | New recipes should have role tagging (core/frying_medium/garnish/marinade/brine) from extraction. See idea_I9_unconsumed_ingredients.md in subproject. |
| N6 | Delete 9 duplicate recipe shells | 📊 | 🟢 | Ingredient rows already deleted in Session 4. The recipe UUIDs still exist in recipes table with no ingredients. Can safely delete. |
| N7 | Fix `form` column data quality | 📊 | 🟢 | "Black pepper" marked as "fresh", defaults are unreliable. Don't use for matching logic until cleaned. |
| N8 | Clean casing inconsistencies in ingredients | 📊 | 🟢 | `pantry` vs `Pantry`, `produce` vs `Produce` in family column. `egg` in Dairy vs `eggs` in Proteins. |
| N9 | Validate remaining 489 unmatched ingredient rows | 📊 | 🟡 | 9.2% unmatched. Many are niche items or edge-case parsing. Diminishing returns but could push to 95%+. |

### Known Gaps (Accepted)

| # | Gap | Impact | Priority | Notes |
|---|-----|--------|----------|-------|
| NG1 | Canned goods use gross weight, not drained | ~20 rows overstated by ~60% | 🟡 | Need `drained_weight_ratio` on ingredients. See Idea I1. |
| NG2 | Raw vs cooked nutrition | Grains/legumes/pasta ~2.5× overstatement | 🔴 | Interim fix: `cooked_ratio` column applied. Real fix: extraction captures raw/cooked intent. See Idea I6. |
| NG3 | "Plus more for dusting" quantities | Negligible calories missed | ⚪ | By design — uncapturable, nutritionally negligible. |
| NG4 | Size-range primary selection arbitrary | "5 small or 2 large" picks first option | 🟢 | Could use weight-equivalent midpoint instead. |
| NG5 | Thick/thin cut weight variance | Same g_per_whole for thick-cut vs regular bacon | 🟢 | Prep text has "thick"/"thin" but not used in gram estimation. |
| NG6 | Materialized view requires manual refresh | Data not reflected until `SELECT refresh_recipe_nutrition()` | ⚪ | By design (D17). Tradeoff for query performance. Data changes are infrequent batch ops. |

### Idea Shelf

| # | Idea | Priority | Context |
|---|------|----------|---------|
| I1 | **Canned goods drained weight** — add `drained_weight_ratio` to ingredients. Typical: ~0.60 for beans/legumes. Use "drained" USDA entry for nutrition-per-100g. | 🟡 | Affects ~20 rows. Not blocking. |
| I2 | **Nutrition ranges for users** — show "350–420 cal/serving" instead of single number. Variance data already captured in quantity_parse_metadata jsonb. | 🟢 | Would need downstream variance propagation. Nice for honesty. |
| I3 | **Cooking-method nutrition adjustments** — frying adds fat, boiling leaches nutrients. Multipliers in calc layer. | 🟢 | Significant research needed for accurate factors. ingredient_role/nutrition_multiplier infrastructure already exists. |
| I4 | **Competing nutrition estimates** — "USDA says X, Nutritionix says Y" side by side. Architecture supports this (store raw, compute derived). | 🟢 | Needs second data source. |
| I5 | **Dual-source embedded metric merge** — embedded grams from quantity normalizer vs unit normalizer. Use COALESCE(quantity, unit). | 🟢 | Resolves itself when pipeline is built. |
| I6 | **Raw vs cooked intent from extraction** — add `ingredient_state` field (raw/cooked/canned/dried/fresh) to extraction schema. Infer from ingredient text + instructions. | 🔴 | Single largest systematic calorie error source. Affects ~30% of recipes. See NG2. |
| I7 | **Salt variant normalization** — "kosher salt", "Maldon sea salt", "flaked sea salt" → all nutritionally identical. Match to single parent or ensure base_ingredient_id links them. | 🟡 | Affects 200+ rows. |
| I8 | **Null ingredient names** — 81 rows have null ingredient name in jsonb. Extraction failures. Could recover from original_text. | 🟢 | 1.5% of data. |
| I9 | **USDA match validation layer** — sanity checks after USDA matching: produce with >150 cal/100g? Same fdc_id for 3+ ingredients? Flag for review. | 🟡 | Would have caught all 17 bad matches from Session 4. Add before any future re-matching runs. |

---

## From: Recipe Extraction Subproject (Jan 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| E1 | Extraction pipeline upgrade to v10+ | 🔧 | 🟡 | v10-2 deployed with Phase 3A fields. Services from nutrition subproject need integration for new recipe extraction. |
| E2 | Gold standard expansion beyond Plenty | 📊 | 🟢 | All 16 verified recipes are Ottolenghi/Plenty. Verify against other books. |

---

## From: Phase 3A Smart Recipe Browse (Feb 2026)

### Tier 1: Should Do Next

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B19 | Verify save flow for Phase 3A fields | 🧪 | 🟡 | Extract a recipe in app → save → query DB for new fields. recipeService.ts was updated but not tested through the app. |
| B14 | Fix vegetarian defaults (proper fix) | 🐛 | 🔴 | Quick regex fix applied, root cause remains. ~489 unmatched ingredients default to vegetarian. Full root cause: `recipe_nutrition_computed` materialized view uses `COALESCE(i.is_vegetarian, true)` — unmatched ingredients default to TRUE. Quick keyword-based regex fallback covers ~95% of cases. Proper fix: (a) match ~489 unmatched ingredient rows to USDA entries, (b) OR change default logic to `false` for unmatched (conservative), (c) ensure `ingredients` table has correct flags for all entries. Affects is_vegan, is_vegetarian, is_dairy_free, is_shellfish_free, is_egg_free. |
| B1 | Flavor profile system (recipe-level aggregation) | 🚀 | 🟡 | Ingredient-level flavor_tags exist, need recipe-level weighted aggregation. Enables B10. See B1 Detail section below. |
| B13 | Recipe rating UX | 🚀 | 🟡 | Without ratings from real usage, smart sections and "highest rated" sort are empty. Need prominent rating input in post creation flow. Seed data provides test ratings. |

### Tier 2: Polish & Enhancement

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B10 | Flavor profile display | 🚀 | 🟡 | Depends on B1. Radar chart on expanded cards. |
| B5 | "Unknown Chef" cleanup | 🔧 | 🟢 | May already be handled. |
| B8 | Click-to-see-friends modal | 🚀 | 🟢 | FriendsIcon now SVG. Needs query: given recipe_id, get posts from followed users with profile info. |
| — | Chevron tap target fix | 🐛 | 🟢 | UX issue flagged by Tom. |

### Tier 3: Larger Features

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B15 | Instruction-level technique tagging | 🚀 | 🟡 | Tag each instruction step with technique(s): roast, sauté, blanch, reduce, emulsify, etc. ~2,400 steps across 475 recipes. Haiku backfill ~$1-2. Enables "show me all the ways people make a roux." Schema: add `techniques` text[] to `instruction_sections`. Need technique vocabulary (~50 techniques) first. |
| B3 | Visual grid browse mode | 🚀 | 🟢 | Photo-first recipe browsing (Instagram/Pinterest style). Requires recipe images to be populated. |
| B4 | Chef dedup & auto-association | 🔧 | 🟡 | Auto-associate chef_id on new recipes. Match source_author to existing chefs. Prevent duplicates. |
| B2 | Personalized/learned recipe tags | 🚀 | 🟡 | Tags that adapt to user over time. "Tom cooks comfort food on Sundays." Foundation: objective tags (hero ingredients, vibes). Layer on top: learned preferences from cooking history. Natural fit for Cooking Assistant V2/V3. Relates to R1 (user dietary preferences). |

### Low Priority Data Quality

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B16 | Cuisine types quality improvement | 📊 | 🟢 | 35 recipes still have empty cuisine_types. "European" vague, "American" overrepresented at 91. |
| B17 | Normalize cooking_methods values | 📊 | 🟢 | Some non-technique entries like "mixing" (26), "tossing" (10), "whisking" (9). "frying" vs "pan-frying" inconsistency. |
| B18 | Cuisine authenticity / fusion tagging | 🚀 | 🟢 | Structured cuisine tags with authenticity field. Current array lost "-inspired"/"-fusion" nuance when cleaned Feb 25. Low priority — current array works. |

### B1 Detail: Flavor Profile System

**Reference:** Molly Baz's "Cook This Book" (pp. 46-47) — "Need Some Inspo?" flavor reference chart.

#### 7 Flavor Categories

**SWEET**
Granulated Sugar, Brown Sugar, Molasses, Honey, Maple Syrup, Apples, Pears, Dried Fruits, Cooked Onions, Stone Fruit, Berries, Bananas, Sweet Potatoes, Tropical Fruits, Carrots, Oranges, Ketchup, Hoisin Sauce, Jam or Jelly, Cooked Tomatoes, Winter Squash

**SALTY**
Salt, Anchovies, Olives, Capers, Fish Sauce, Soy Sauce, Miso Paste, Bacon, Parmesan Cheese, Pecorino Cheese, Feta Cheese, Cured Meats, Smoked Salmon, Clam

**BITTER**
Citrus Zest, Chocolate, Coffee, Amaro, Beer, Mustard Greens, Radicchio, Broccoli Rabe, Dandelion Greens

**UMAMI**
Parmesan Cheese, Piave Cheese, Cheddar Cheese, Walnuts, Fish Sauce, Mushrooms, Anchovies, MSG, Kimchi, Sardines, Oysters, Miso Paste, Cured Meats, Soy Sauce, Chicken Broth

**FATTY**
Heavy Cream, Crème Fraîche, Sour Cream, Cream Cheese, Butter, Nuts, Seeds, Avocado, Mortadella, Sausage, Cheese, Tahini, Olive Oil, Neutral Oil (vegetable, canola, grapeseed, safflower), Sesame Oil, Coconut Oil, Coconut Milk, Mayonnaise, Bacon, Lard, Yogurt, Schmaltz

**SPICY**
Fresh Chile Peppers, Ground Dried Chiles, Black Peppercorns, Szechuan Peppercorns, Fresh Ginger, Mustard, Mustard Seeds, Harissa Paste, Gochujang, Sambal Oelek, Chile Oil, Chile Crisp, Sriracha, Horseradish, Hot Sauce, Wasabi

**SOUR**
Vinegar, Lime, Lemon, Grapefruit, Buttermilk, Cottage Cheese, Yogurt, Wine, Pickles, Cornichons, Pickled Onions, Tomato, Sauerkraut, Kimchi

#### Key Design Notes

- **Ingredients can have multiple flavor tags.** Parmesan = salty + umami. Kimchi = umami + sour. Yogurt = fatty + sour. Bacon = salty + fatty. This is essential — flavors overlap.
- **Recipe flavor profile = aggregation of ingredient flavors**, weighted by role:
  - Hero ingredients contribute most to the profile
  - Supporting ingredients contribute moderately
  - Garnishes/staples contribute minimally
- **Profile could be expressed as a simple radar chart** or as dominant flavors: "This recipe is primarily umami + sour with spicy notes"
- **Use cases:**
  - Browse: "Show me recipes with a sour/bright profile"
  - Pairing: "This rich, fatty dish pairs well with something acidic — here are options"
  - Balance: "This recipe is heavy on umami — consider adding something acidic" (Cooking Assistant V2)
  - Substitution: "Instead of anchovies (salty + umami), try miso paste (also salty + umami)"

#### Implementation Path

1. **Add `flavor_tags` column to `ingredients` table** — text array (e.g., `['salty', 'umami']` for Parmesan)
2. **AI-tag ~480 ingredients** with 1-3 flavor categories from the 7-category set. Use the Molly Baz list as seed data, extend for ingredients not on her list.
3. **Compute recipe flavor profile** — Aggregate ingredient flavors, weight by hero/supporting/garnish role. Could be a materialized view column or computed at query time.
4. **Add `flavor_profile` to recipe display** — Radar chart on RecipeDetailScreen, filter dimension on RecipeListScreen.
5. **Extend Cooking Assistant** — "I want something bright" → filter by sour profile. "What pairs well with this?" → suggest complementary flavor profiles.

**Estimated effort:** 2 sessions (ingredient tagging + recipe computation + UI)

---

## From: SVG Icon Integration (Feb 26, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B20 | Counter storage location needs SVG icon | 🔧 | 🟢 | Still uses 🪴 emoji fallback. |
| B21 | Clean up old emoji icon constants | 🔧 | 🟢 | Dual system in constants/pantry.ts. Old emoji functions can be removed once all consumers verified. |

---

## From: Data Seeding Session (Feb 26, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D1 | auth.users trigger overwrites user_profiles on insert | 🐛 | 🟡 | A trigger syncs email prefix into display_name and username. Workaround: run UPDATE after INSERT for test users. Should investigate and fix the trigger for production. |
| D2 | Drop stray `emoji` column from user_profiles | 🔧 | 🟢 | Added accidentally during seeding. App uses `avatar_url` for emoji avatars. Run: `ALTER TABLE user_profiles DROP COLUMN IF EXISTS emoji;` |
| D3 | Add new cooking methods to PostCreationModal | 🚀 | 🟢 | DB constraint now allows roast, grill, sauté, braise, fry, steam — but the UI picker may not show them yet. Check PostCreationModal.tsx. |

---

## From: Social / Meals Features (Nov-Dec 2025)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| S1 | Visual linking (Strava-style) for linked posts | 🚀 | 🟡 | Groups linked posts on feed. LinkedPostsGroup.tsx exists. |
| S2 | Feed grouping for meals | 🚀 | 🟡 | feedGroupingService.ts exists. May need updating. |

---

## From: Broader Roadmap

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| R1 | User dietary preferences table + settings UI | 🚀 | 🟡 | `user_dietary_preferences` table. Needed for stats dashboard compliance % and recipe recommendations. Can be built independently. |
| R2 | Ingredient source tracking | 🚀 | 🟢 | "From garden" / "farmers market" / "organic" on posts. Feeds "% from garden" stat. Roadmap #5. |
| R3 | Non-nutrition activity stats service | 🚀 | 🟡 | Cooking frequency, streaks, favorites, time-of-day. All from existing posts data. Roadmap #24, #58. Note: Phase 4 (Cooking Stats Dashboard) will likely address this directly. |
| R4 | Wearable integration research | 💡 | 🟢 | Apple Health / Fitbit APIs. Correlate meals with health data. Future. |
| R5 | Recipe cost per serving | 🚀 | 🟢 | 229 ingredients already have cost data. Need cost computation in nutrition view. |

---

## From: Phase 7B Revision (April 2026)

### Feature Playbook System (proposed by Tom, March 2026)
A per-feature living document system for tracking: current state, UX rationale,
known issues, user feedback, and iteration history. One playbook per major
feature (LogCookSheet, Overflow Menu, Edit Mode, etc.). Roughly 1 page each,
kept current as features evolve. Goal: institutional memory for design
decisions so we don't lose context as the app grows.

Scope: 5-10 initial playbooks + template. Priority: medium. Best done after
F&F launch when user feedback starts flowing.

### Edit Mode Redesign (Phase 8 candidate)
Current edit mode works but feels unnatural. Tom's vision includes:
- Lined-paper / notebook aesthetic (spiral binding? playful but clean?)
- Natural strike-and-write-above editing pattern (not line-level strikethrough)
- Structured data editing: quantity and ingredient separately editable
- Drag handles for section reordering (current up/down arrows don't function)
- "or" substitution support (e.g., "feta or gruyere")
- Better visual indicator that you're in edit mode (banner added in 7B revision,
  but the mode itself needs more work)

Substantial workstream — 3-5 sessions. Not blocking F&F launch.

### Historical Cook Logging with Dates (Phase 7D)
"I've Made This Before" currently updates times_cooked only. Users may want to:
- Specify dates for individual historical cooks
- Create actual backdated posts for specific meals (e.g., a Thanksgiving dinner
  they forgot to log at the time)
- Retroactively link historical cooks to meals they cooked with others

Requires use of posts.cooked_at column (already exists) plus a date picker UX.
Intersects with Phase 7C multi-dish posts.

### posts.make_again column cleanup
The make_again column on posts is no longer used after the 7B revision (star
rating replaced it). Column can be dropped in a future cleanup pass. All new
posts will have make_again = null.

### PostCookFlow component cleanup
components/cooking/PostCookFlow.tsx is deprecated after the 7B revision —
functionality merged into LogCookSheet full mode. The file is marked deprecated
but not deleted. Remove in a future cleanup pass once no regressions are found.

### Meal Plan modal: "Create new meal" flow broken
`onCreateNewMeal` prop on `SelectMealForRecipeModal` is passed as an empty function
from RecipeDetailScreen. Needs to be wired to open `CreateMealModal` with
`initialRecipeId`/`initialRecipeTitle` props. The CreateMealModal component exists
and already supports these props. Fix is straightforward but requires adding
CreateMealModal state management to RecipeDetailScreen.

---

## Cross-Cutting Technical Debt

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| T1 | Old ingredientsParser.ts (756 lines) to be replaced | 🔧 | 🟡 | Subproject built replacement services. |
| T2 | ingredientMatcher.ts naming confusion | 🔧 | 🟢 | 14NOV25 version is for instruction text highlighting, not DB matching. |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-06 | Phase 7B Revision items added: Feature Playbook System, Edit Mode Redesign, Historical Cook Logging, make_again cleanup, PostCookFlow cleanup, Meal Plan modal fix. |
| 2026-03-02 | **Doc overhaul.** Moved to repo as canonical location. Removed resolved T3/T4. Updated header to describe reconciliation process. Restored Idea Shelf (I1-I9), B1 Detail flavor spec, R3-R5 that were dropped during prior condensation. Restored full detail on B14, B15, B2, B8, B16-B18. Renamed from FRIGO_DEFERRED_WORK_UPDATED_26FEB26_v2. |
| 2026-02-26 | Data seeding session. Added D1-D3. |
| 2026-02-26 | SVG icon integration. Marked B9, B11, B12 as ✅ COMPLETED. Added B20, B21. |
| 2026-02-25 | Phase 3A extraction pipeline. Marked B6, B7 as ✅ COMPLETED. Added B14-B19. |
| 2026-02-24 | Added Phase 3A items B1-B13. |
| 2026-02-19 | Created. Consolidated from Nutrition Tracker idea shelf and broader roadmap. |

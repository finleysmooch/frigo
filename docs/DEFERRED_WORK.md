# FRIGO — Deferred Work & Action Items

**Last Updated:** April 9, 2026  
**Version:** 4.3  
**Canonical location:** Repo `docs/DEFERRED_WORK.md` (copy in Claude.ai project knowledge)

---

## How This Document Works

Items land here at **phase completion** after a reconciliation review. During active phase work, deferred items live in the active phase doc. When a phase completes, Claude.ai reviews those items: resolved items are dropped, items still relevant move here under a "From: Phase N" section, items not worth tracking are discarded.

This is the master backlog — the accumulated deferred work from all completed phases plus cross-cutting tech debt and roadmap ideas.

**Priority levels:** 🔴 High (affects accuracy/UX significantly), 🟡 Medium (would improve quality), 🟢 Low (nice to have), ⚪ By design (accepted tradeoff)

**Types:** 🐛 Bug/Gap, 💡 Idea, 🔧 Technical debt, 📊 Data quality, 🚀 Feature, 🧪 Testing

---

## From: Phase 6 — Cooking Mode v2 (Mar 19-24, 2026)

### High Priority (F&F blockers or near-term)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-1 | **Cooking time data backfill** | 📊 | 🔴 | Only 60/475 recipes have `prep_time_min`/`cook_time_min` data. RecipeDetailScreen correctly shows data when available but most recipes show nothing. Need AI-assisted backfill or extraction pipeline update to populate. |
| P6-2 | **CookingScreen simplification** | 🚀 | 🟡 | On-device testing showed section-card layout is too busy (NOW badges, section dots, header bars, per-step ingredients, timer buttons all at once). Consider: strip to essentials, ClassicView as default, tabs (INGREDIENTS/PREPARATION) like NYT's "Start Cooking". Fix double header (nav header + custom header). May want to hide "Start Cooking" button until simplified. |
| P6-3 | **Multi-recipe cooking** | 🚀 | 🟡 | Cook dinner = protein + side + salad simultaneously. Shared timers across recipes, interleaved steps. CookingTimerContext architecture is extensible. High-impact for real cooking. Relates to P6-9 (multi-recipe meal dashboard). |
| P6-4 | **PostCookFlow makeAgain/thoughts data gap** | 🐛 | 🟡 | PostCookFlow collects `makeAgain` (Yes/Maybe/No) and `thoughts` but PostCreationModal's PostData interface has no fields for them. Data gathered then dropped. Wire up before F&F — extend PostData or save via cookingService. |
| P6-5 | **notes/modifications duplication bug** | 🐛 | 🟡 | `createDishPost` in postService.ts sets `notes: postData.modifications` (preserved from original code). Duplicates modifications into notes field. Should be `notes: postData.notes` or handled separately. |

### Medium Priority (polish + UX improvements)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-6 | Rethink pantry fraction next to INGREDIENTS title | 💡 | 🟡 | "4/14 in pantry" may confuse users. Consider: move to bottom near grocery links, plain text "4 items in pantry", or remove entirely. |
| P6-7 | Rethink "Add missing to Grocery List" button | 💡 | 🟡 | Current bordered box with 🛒 may not be the right treatment. Consider integrating with grocery flow more naturally. |
| P6-8 | Add timer options to step focus mode | 💡 | 🟡 | When a step is focused on RecipeDetailScreen, show timer auto-detection buttons (like CookingScreen has). Let users start timers without entering cooking mode. |
| P6-10 | Ingredient tap-to-see-steps in IngredientsSection | 💡 | 🟡 | D6-18. Tapping ingredient in ingredients list shows: which steps use it, pantry status, notes. Would need mapIngredientsToSteps imported into IngredientsSection + onPress handlers. |
| P6-11 | Dedicated "Add a Note" modal for RecipeDetailScreen | 💡 | 🟡 | Notes section shows existing notes and empty state but has no dedicated "Add a Note" button/modal. Currently annotation edit mode is the only way. A simple text area modal (like NYT's) would be cleaner. |
| P6-12 | Read More inline fade effect | 💡 | 🟢 | NYT has "Read More" inline at end of truncated text with left-side fade. Current implementation puts "Read More" on its own line. Works fine, just not as polished. |
| P6-13 | Bold variance on ingredient names | 🔧 | 🟢 | Text-structural approach bolds everything between quantity+unit and first comma. "good-quality risotto rice" all bold vs just "onion" bold. Hard to fix perfectly without AI-level parsing. Low visual impact. |
| P6-14 | ⋮ overflow menu feel | 💡 | 🟢 | Anchored popover implemented but may need more polish. Consider native ActionSheet on iOS for more native feel. |

### Lower Priority (v2 features)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-9 | Multi-recipe meal dashboard | 🚀 | 🟢 | Wireframed (screen 12). Timers unified across recipes. Related to P6-3. v2. |
| P6-15 | Wearable companion (WatchOS) | 🚀 | 🟢 | Wireframed (screens 10-11). Needs react-native-watch-connectivity. v2. |
| P6-16 | Interleaved AI timeline | 💡 | 🟢 | AI merges steps across recipes. v3 moonshot. |
| P6-17 | Serving size adjuster | 🚀 | 🟢 | Proportional ingredient recalc. Non-linear baking edge cases. Strong v2 candidate. |
| P6-18 | Voice commands | 💡 | 🟢 | "Next step" / "Start timer". Post-F&F. |
| P6-19 | Offline cooking | 💡 | 🟢 | Cache recipe locally. Significant scope. |
| P6-20 | Ingredient alternatives | 💡 | 🟢 | "Try X instead of Y" in ingredient detail popup. Needs data source. v2. |
| P6-21 | Voice note transcription | 💡 | 🟢 | Voice recording button placeholder exists in notes UI. Actual transcription is v2. |
| P6-22 | Timeline overview view mode | 🚀 | 🟢 | CookingScreen ViewModeMenu only has step-by-step and classic. Timeline (3rd option — vertical railroad with section groupings) deferred. |
| P6-23 | Post-cook photo upload | 🚀 | 🟢 | PostCookFlow has placeholder button. Needs image picker integration. |
| P6-24 | Post-cook voice memo | 💡 | 🟢 | Placeholder button in PostCookFlow. Needs recording + transcription. |
| P6-25 | Post-cook partner tagging | 🚀 | 🟢 | Placeholder in PostCookFlow. Should connect to existing AddCookingPartnersModal. |
| P6-26 | "Mark as Cooked" + Rate row on RecipeDetailScreen | 💡 | 🟢 | NYT has this between description and ingredients. Log a cook without entering cooking mode. |
| P6-27 | Clickable page references in step text | 💡 | 🟢 | Some recipes reference other pages (e.g., "see page 116"). Could detect via regex and link to book view. Technically complex for minor UX gain. |
| P6-28 | Yield/servings display enhancement | 💡 | 🟢 | Currently shows servings when data exists. Could add yield text from recipe description. |
| P6-29 | Step quantities scale in instruction text | 🔧 | 🟢 | Quantities mentioned in step prose don't update at 2x/3x. Deep — would need in-text number detection and replacement. |
| P6-30 | RecipeDetailScreen tab toggle (INGREDIENTS/PREPARATION) | 💡 | 🟢 | Initially planned for main page, but NYT only uses tabs in cooking mode. Defer to CookingScreen simplification (P6-2). |
| P6-31 | Ingredient alternatives popup | 💡 | 🟢 | Show alternative ingredients when tapping on Ingredients section. Needs data source. v2. |

### Phase 6 Tech Debt

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-T1 | PanResponder → gesture handler upgrade | 🔧 | 🟡 | CookingScreen swipe nav uses PanResponder (no gesture handler installed). May feel janky or conflict with vertical scroll within long section cards. Upgrade to react-native-gesture-handler if issues on-device. |
| P6-T2 | Table-only recipes missing step text | 🔧 | 🟡 | 8 recipes have `instructions=[]` with text only in `instruction_steps` table. `normalizeInstructions` (sync) returns empty for these. Section headers render but step text may be blank. Fix: pre-fetch step text for these 8 at screen load. |
| P6-T3 | Android notification channel config | 🔧 | 🟢 | expo-notifications installed but Android notification channel not configured in app.json. Required for Android production builds. Not blocking iOS F&F. |
| P6-T4 | Blueberry Cornflake Crisp "Main" section name | 📊 | 🟢 | Extraction pipeline stored section as "Main" instead of descriptive name. Data quality issue from Step 3 batch job. |
| P6-T5 | instruction_sections table redundancy | 🔧 | 🟢 | DB tables (`instruction_sections` + `instruction_steps`) still exist but redundant for cooking mode since `recipes.instruction_sections` JSONB is now canonical. Decide whether to keep for extraction pipeline or migrate fully to JSONB. |
| P6-T6 | "Error getting pending count" toast | 🐛 | 🟢 | Error toast visible on RecipeDetailScreen. Not from Phase 6 — likely a notification or badge count query failing elsewhere. Investigate separately. |

---

## From: Phase 5 — Ingredient Architecture (Mar 17-19, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P5-1 | `base_ingredient_id` wiring | 🔧 | 🟡 | Protein cuts (chicken thigh → chicken), cheese dupes (pecorino romano → pecorino), salt variants (kosher salt → salt). Haiku batch surfaced many variants. Better to do all linking in one systematic pass. Deferred to post-Phase 5 or separate session. Relates to I7, N3. |
| P5-2 | Gardening data (planting/growing months) | 📊 | 🟢 | `ingredient_seasons` table has columns for planting/growing months but they're not populated. 1,169 entries across 7 regions have harvest months. Post-F&F — columns exist, populate later. |
| P5-3 | Recipe markup/editing review | 🔧 | 🟡 | Tom flagged RecipeDetailScreen editing as "clunky". Was deferred from Phase 5 → Phase 6. Phase 6 modularized the annotation system into sub-components but didn't redesign the UX. Still clunky. |
| P5-4 | Chef name backfill + auto-association (B4) | 📊 | 🟡 | Most recipes lack chef_id. Auto-associate on new recipes by matching source_author to existing chefs. Deferred to Phase 7 (Social). |
| P5-5 | Difficulty score backfill | 📊 | 🟢 | Only 11 recipes have ai_difficulty_score. Could batch-classify via Haiku. Nice-to-have. |
| P5-6 | Technique tagging (B15) | 🚀 | 🟢 | Tag each instruction step with technique(s): roast, sauté, blanch, reduce, emulsify. ~2,400 steps. Haiku backfill ~$1-2. Schema: add `techniques` text[] to instruction_sections. Need technique vocabulary first. Post-F&F. |

---

## From: Phase 4 / Phase I — Cooking Stats Dashboard (Mar 2026)

### Operations (Do First)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| DI-5 | ~~Run nutrition_goals DB migration~~ | 🔧 | ✅ | **RESOLVED Phase 5A-1.** |
| DI-4 | ~~Remove debug console.logs~~ | 🔧 | ✅ | **RESOLVED Phase 5A-3.** |

### Data Gaps

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-1 | getMicronutrientLevels stubbed | 📊 | 🟡 | Needs USDA vitamin/mineral data import on ingredients table. Relates to N2. |
| D4-2 | getTopNutrientSources for fiber/sugar/sodium | 📊 | 🟡 | recipe_ingredient_nutrition view lacks these columns |
| D4-3 | totalTimeHours in getOverviewStats | 📊 | 🟡 | posts table has no cook_time; needs join to recipes.total_time. **Relates to P6-1** — cooking time data largely missing. |
| D4-8 | Sparse ai_difficulty_score data | 📊 | 🟢 | Only 11 recipes scored. Relates to P5-5. |
| D4-4 | Cookbook recipe_count mismatch | 📊 | 🟢 | "Plenty" shows >100% completion. Fix: use MAX(recipe_count, actual_count). |

### Feature Gaps

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-26 | Frontier suggestions v2 | 🚀 | 🟡 | Add: partner-popular items, seasonal relevance, ingredient overlap. Current v1 uses 3 simple rules. |
| D4-12 | Seasonal pattern tile taps | 🚀 | 🟢 | Tap → RecipeListScreen filtered by season |
| D4-13 | Diversity breakdown taps | 🚀 | 🟢 | Tap count → navigate to relevant sub-section |
| D4-14 | initialChefId filtering in RecipeListScreen | 🚀 | 🟢 | Param declared but not consumed — needs chef's recipe IDs fetch |
| D4-15 | initialBookId filtering | 🚀 | 🟢 | Param declared but not consumed |
| D4-16 | Ingredient drill-down Browse filter | 🚀 | 🟢 | Needs recipe_ingredients join |
| D4-17 | initialCookingMethod param | 🚀 | 🟢 | Maps to concept (imprecise) |
| D4-18 | StockUpCard grocery integration | 🚀 | 🟢 | Logs tap, needs groceryService wiring |
| D4-39 | Friends' stats comparison | 🚀 | 🟢 | Privacy + social design needed. Compare cooking stats with friends. |
| DI-2 | My Posts pagination | 🚀 | 🟢 | Currently limited to 30 posts. Infinite scroll deferred. |
| DI-3 | ActivityCard menu button wiring | 🚀 | 🟢 | ··· dots have no onPress handler |
| DI-6 | Chart swipe for time navigation | 🚀 | 🟢 | More intuitive than arrow buttons for time offset |

### Tech Debt

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-10 | Accessibility labels on stats components | 🔧 | 🟡 | Should be added across all ~30 stats components |
| D4-11 | Legacy MyPostsStackParamList cleanup | 🔧 | 🟢 | Type export kept for 4 screens (YasChef, Comments, EditMedia, MyPostDetails) |
| D4-21 | Entity name in ChefStats/BookStats | 🔧 | 🟢 | Both detail screens query name separately. Add to return type. |
| D4-31 | ~~Export getMondayOfWeek from statsService~~ | 🔧 | ✅ | **RESOLVED Phase 5A-3.** |
| D4-37 | colors.text.quaternary theme fallback | 🔧 | 🟢 | GatewayCard uses tertiary as fallback |
| DI-1 | Extract ActivityCard to shared component | 🔧 | 🟢 | Duplicated in StatsScreen + UserPostsScreen |
| DI-7 | Avatar URL onError fallback | 🔧 | 🟢 | If avatarUrl is truthy but URL fails to load, Image renders transparent |

### Polish

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-25 | Gateway card sparklines | 💡 | 🟢 | Faint trendlines in card bottom-right. Data available from enriched WeeklyFrequency. |
| D4-27 | Podium recipe images | 💡 | 🟢 | Replace emoji thumbnails with actual recipe photos when photo system is ready |
| D4-28 | ConceptBubbleMap manual layout | 💡 | 🟢 | If flexWrap layout has gaps on device, implement row-based circle packing |
| D4-29 | CookingPersonalityCard gradient | 💡 | 🟢 | Replace solid #0b6b60 with LinearGradient when expo-linear-gradient installed |
| D4-30 | Animated chart↔calendar transitions | 💡 | 🟢 | Smooth animation when selecting weeks, switching chart modes |
| D4-33 | Chart↔calendar scroll-into-view | 💡 | 🟢 | When calendar navigates to off-screen chart week |
| D4-35 | Podium cooking_concept emoji lookup | 💡 | 🟢 | Currently uses static emojis per rank. Could use recipe's actual concept. |
| D4-36 | Expand CONCEPT_EMOJI_MAP coverage | 💡 | 🟢 | Only covers 22 of 78 concepts. Expand as new concepts appear. |
| D4-38 | Personality card loading skeleton | 💡 | 🟢 | Uses generic CardShell. Could get dark-bg-specific skeleton. |

---

## From: Nutrition Data Foundation Subproject (Feb 2026)

### Open Action Items

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| N1 | ~~Integrate subproject services into codebase~~ | 🔧 | ⚪ | **Phase 5A-3 audit resolved.** Existing `ingredientsParser.ts` is the active pipeline. Subproject services not needed. |
| N2 | Import vitamins & minerals from USDA | 📊 | 🟡 | Only 7 macros imported so far. Vitamin A/C/D/E/K, B vitamins, calcium, iron, magnesium, potassium, zinc, selenium all available in same SR Legacy file. Needed for recommendations ("High in vitamin C"). Relates to D4-1. |
| N3 | Fill 10 unmapped USDA ingredients | 📊 | 🟢 | Gochujang, harissa, mirin, pomegranate molasses, za'atar, sumac, urfa pepper, aleppo pepper, silan (date syrup), barberries. Try Foundation Foods dataset or fill manually. |
| N4 | Tag ~70 "for serving/garnish" ingredient rows | 📊 | 🟢 | ingredient_role = 'garnish' with nutrition_multiplier = 0. Low caloric impact. Schema and frying oil fixes already done. |
| N5 | Update extraction pipeline to output ingredient_role | 🔧 | 🟡 | New recipes should have role tagging (core/frying_medium/garnish/marinade/brine) from extraction. See idea_I9_unconsumed_ingredients.md in subproject. |
| N6 | ~~Delete 9 duplicate recipe shells~~ | 📊 | ✅ | **RESOLVED Phase 5A-1.** |
| N7 | Fix `form` column data quality | 📊 | 🟢 | "Black pepper" marked as "fresh", defaults are unreliable. Don't use for matching logic until cleaned. |
| N8 | ~~Clean casing inconsistencies in ingredients~~ | 📊 | ✅ | **RESOLVED Phase 5B.** All family/type values normalized to canonical taxonomy. |
| N9 | ~~Validate remaining 489 unmatched ingredient rows~~ | 📊 | ✅ | **RESOLVED Phase 5D.** Haiku batch resolved 482/485 unmatched. Match rate: 90.8% → 99.9%. Only 3 remaining (too vague to classify). |

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
| I7 | **Salt variant normalization** — "kosher salt", "Maldon sea salt", "flaked sea salt" → all nutritionally identical. Match to single parent or ensure base_ingredient_id links them. | 🟡 | Affects 200+ rows. Relates to P5-1 (base_ingredient_id). |
| I8 | ~~**Null ingredient names**~~ | ✅ | **RESOLVED Phase 5D.** Haiku batch handled null names during classification. |
| I9 | **USDA match validation layer** — sanity checks after USDA matching: produce with >150 cal/100g? Same fdc_id for 3+ ingredients? Flag for review. | 🟡 | Would have caught all 17 bad matches from Session 4. Add before any future re-matching runs. |

---

## From: Recipe Extraction Subproject (Jan 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| E1 | Extraction pipeline upgrade to v10+ | 🔧 | 🟡 | v10-2 deployed with Phase 3A fields. Existing `ingredientsParser.ts` handles matching. Future upgrades should improve existing pipeline. |
| E2 | Gold standard expansion beyond Plenty | 📊 | 🟢 | All 16 verified recipes are Ottolenghi/Plenty. Verify against other books. |

---

## From: Phase 3A Smart Recipe Browse (Feb 2026)

### Tier 1: Should Do Next

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B19 | ~~Verify save flow for Phase 3A fields~~ | 🧪 | ✅ | **RESOLVED Phase 5A-3.** |
| B14 | ~~Fix vegetarian defaults (proper fix)~~ | 🐛 | ✅ | **RESOLVED Phase 5C.** Inherited dietary properties system with 10 category rules. Counts recovered: 338 vegetarian, 109 vegan, 306 GF. |
| B1 | Flavor profile system (recipe-level aggregation) | 🚀 | 🟡 | Ingredient-level flavor_tags exist, need recipe-level weighted aggregation. Enables B10. See B1 Detail section below. **Deferred to post-F&F (Tom confirmed).** |
| B13 | Recipe rating UX | 🚀 | 🟡 | Without ratings from real usage, smart sections and "highest rated" sort are empty. Need prominent rating input in post creation flow. |

### Tier 2: Polish & Enhancement

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B10 | Flavor profile display | 🚀 | 🟡 | Depends on B1. Radar chart on expanded cards. **Deferred to post-F&F with B1.** |
| B5 | "Unknown Chef" cleanup | 🔧 | 🟢 | May already be handled. Relates to P5-4 (chef backfill). |
| B8 | Click-to-see-friends modal | 🚀 | 🟢 | FriendsIcon now SVG. Needs query: given recipe_id, get posts from followed users with profile info. |
| — | Chevron tap target fix | 🐛 | 🟢 | UX issue flagged by Tom. |

### Tier 3: Larger Features

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B15 | ~~Instruction-level technique tagging~~ | — | — | Moved to P5-6 (same item, renumbered). |
| B3 | Visual grid browse mode | 🚀 | 🟢 | Photo-first recipe browsing (Instagram/Pinterest style). Requires recipe images to be populated. |
| B4 | ~~Chef dedup & auto-association~~ | — | — | Moved to P5-4 (same item, renumbered). |
| B2 | Personalized/learned recipe tags | 🚀 | 🟡 | Tags that adapt to user over time. "Tom cooks comfort food on Sundays." Foundation: objective tags. Layer: learned preferences. Natural fit for Cooking Assistant V2/V3. |

### Low Priority Data Quality

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B16 | Cuisine types quality improvement | 📊 | 🟢 | 35 recipes still have empty cuisine_types. "European" vague, "American" overrepresented at 91. |
| B17 | Normalize cooking_methods values | 📊 | 🟢 | Some non-technique entries like "mixing" (26), "tossing" (10). "frying" vs "pan-frying" inconsistency. |
| B18 | Cuisine authenticity / fusion tagging | 🚀 | 🟢 | Structured cuisine tags with authenticity field. Low priority — current array works. |

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
| D1 | ~~auth.users trigger overwrites user_profiles on insert~~ | 🐛 | ✅ | **RESOLVED Phase 5A-2.** |
| D2 | ~~Drop stray `emoji` column from user_profiles~~ | 🔧 | ✅ | **RESOLVED Phase 5A-1.** |
| D3 | Cooking method/occasion/technique architecture | 🚀 | 🟡 | **Phase 5A-3 audit revealed fundamental misalignment.** Three distinct concepts tangled in one field: (1) meal occasion/activity (breakfast, snack, eating out), (2) primary cooking method (bake, roast, grill), (3) per-step techniques (sauté, blanch, deglaze). Only `bake` and `slow_cook` overlap between UI and DB constraint. Need product decision: separate fields or unified taxonomy. Tom decision: support all three. **Not addressed in Phase 6.** Target: Phase 7 (Social/Post Creation) or standalone session. |

---

## From: Social / Meals Features (Nov-Dec 2025)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| S1 | Visual linking (Strava-style) for linked posts | 🚀 | 🟡 | Groups linked posts on feed. `LinkedPostsGroup.tsx` exists but unwired. **Now scheduled as Phase 7I** (renumbered from old 7G). Note: this is for the "same recipe cooked by different friends" case, NOT multi-dish meals — multi-dish meals are handled by Phase 7D-7F via the existing meal model. |
| S2 | Feed grouping for meals | 🚀 | 🟡 | `feedGroupingService.ts` exists but unwired. Same status as S1 — Phase 7I. |

---

## From: Broader Roadmap

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| R1 | User dietary preferences table + settings UI | 🚀 | 🟡 | `user_dietary_preferences` table. Needed for stats dashboard compliance % and recipe recommendations. Can be built independently. |
| R2 | Ingredient source tracking | 🚀 | 🟢 | "From garden" / "farmers market" / "organic" on posts. Feeds "% from garden" stat. Roadmap #5. |
| ~~R3~~ | ~~Non-nutrition activity stats service~~ | — | — | ✅ **Delivered in Phase 4.** |
| R4 | Wearable integration research | 💡 | 🟢 | Apple Health / Fitbit APIs. Correlate meals with health data. Future. |
| R5 | Recipe cost per serving | 🚀 | 🟢 | 229 ingredients already have cost data. Need cost computation in nutrition view. |
| R6 | **Personal daily eating log / leftovers tracking** | 🚀 | 🟡 | Surfaced during Phase 7D scoping (April 7). Tom's framing: "having some personal feed thing that helps identify everything they ate in a day would be valuable — and easily adding things like leftovers of things they normally eat each day would be great." Distinct from the social feed: a private, personal log of what you ate (not what you cooked) that feeds nutrition stats but isn't socially posted by default. Use case: cook dinner Monday → log socially as a meal post; eat the leftovers Tuesday lunch → log privately to your personal feed for nutrition tracking, no social post. Sketch: `personal_eating_events` table or repurpose `posts` with a new `post_type='private_log'`. **Post-F&F.** Relates to Phase 10 (Nutrition Depth) and the broader "what is Frigo for" question — Tom is firm that Frigo is *not* about making people post every meal. **Updated 2026-04-09 — see `PHASE_7F_DESIGN_DECISIONS.md` D43.** The eater rating model partially overlaps with this item: D43's "Things I've eaten" history page in profile (P7-35) is a related but distinct surface (it tracks ratings of things you ate at social meals, while R6 is the broader private nutrition log). Worth revisiting whether the two should converge when R6 is scheduled. |
| R7 | **Recipe discovery feature** (see `PHASE_RECIPE_DISCOVERY.md` stub) | 🚀 | 🟡 | Surfaced during Phase 7D scoping (April 7) from Tom's Q21 answer about dish-tap behavior. Discovery preview: tap a dish in MealPostCard → opens a recipe-discovery preview showing high-level info (dietary flags, hero ingredients, nutrition headlines, "Tom and Mary have cooked it 12 times") without exposing the full recipe to non-owners. Hides recipe steps for users who don't own the cookbook; surfaces enough metadata to make the recipe feel discoverable. Could become its own phase. Stub doc created at `PHASE_RECIPE_DISCOVERY.md`. **Unscheduled — likely post-F&F or its own dedicated phase.** **Updated 2026-04-09 — see `PHASE_7F_DESIGN_DECISIONS.md`.** 7F ships basic tappable dish navigation only (per the 7F build prompt); the discovery preview surface is still the deferred R7 work. The 7F wireframes confirm the tap target exists on K-family cards. |
| R8 | **External participant retroactive claim path** | 🚀 | 🟢 | Surfaced during Phase 7D scoping (D27). When an externally-tagged participant later joins Frigo, they should be able to claim past attribution rows (set `participant_user_id` to their user, null out `external_name`). Schema added in 7D supports it; UI is post-launch. Onboarding-time prompt: "We found 3 dishes you were tagged in. Claim them?" **Updated 2026-04-09 — see `PHASE_7F_DESIGN_DECISIONS.md` D45.** D45's cooked-vs-ate byline split applies post-claim: if a claimed external participant had `role='ate_with'`, they appear in the sub-line text on existing cards, not the avatar stack. The retroactive claim flow doesn't need to backfill any new rendering — it just nulls out `external_name` and sets `participant_user_id`, and the existing 7F render rules pick up the change automatically. |
| R9 | **Concept cooking inline suggestions for freeform dishes** | 💡 | 🟢 | Surfaced during Phase 7D scoping (D23, P7-19). When a user types a freeform dish name like "rice", surface concept matches inline as suggestions. Depends on Phase 11 concept cooking landing first. |

---

## Cross-Cutting Technical Debt

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| T1 | ~~Old ingredientsParser.ts to be replaced~~ | 🔧 | ⚪ | **Phase 5A-3 audit:** `ingredientsParser.ts` IS the active pipeline. Not stale. |
| T2 | ~~ingredientMatcher.ts naming confusion~~ | 🔧 | ✅ | **RESOLVED by audit.** Both files documented — different purposes. |
| T3 | **Schema change propagation discipline** | 🔧 | 🟡 | **Surfaced during Phase 7 Checkpoint 4.** Three separate drift bugs traced back to Phase 7B-Rev's `ALTER TABLE posts ALTER COLUMN rating TYPE numeric(3,1)` migration: (a) `detectPlannedMealForCook` in `mealService.ts` had duplicate inline time-band logic that wasn't updated when `computeMealType` was tightened to 4 bands, causing smart-detect to miss planned dinners during afternoon hours for 3 checkpoints before being caught; (b) `get_meal_dishes` and `get_meal_plan_items` RPCs had `dish_rating integer` hardcoded in their `RETURNS TABLE` signatures and threw runtime errors after the type change; (c) `createDishPost` writes `parent_meal_id` directly without writing the corresponding `dish_courses` + `post_relationships` rows that `addDishesToMeal` writes together, leaving dishes invisible to `getMealDishes` and future feed-grouping logic. All three fixed during Checkpoint 4 fix passes. **Rule going forward:** any `ALTER TABLE` on `posts`, `recipes`, or other frequently-joined tables must be followed by a grep sweep for (1) RPCs with `RETURNS TABLE(...)` signatures that select from the changed column, (2) duplicate inline type logic in service layer code, (3) TypeScript interfaces that mirror DB schema, (4) other service functions that write to the same joined-relationship (meal↔dish) that should be writing the same set of rows atomically. Schema changes that don't propagate are the most expensive bugs — they fail silently for weeks. |

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-09 | 4.3 | **Phase 7F wireframe session cross-references added.** R6 (personal eating log), R7 (recipe discovery), and R8 (external participant retroactive claim) updated with forward references to `PHASE_7F_DESIGN_DECISIONS.md` decisions D43 and D45. Existing item content unchanged; cross-reference notes appended. The 14 new Phase 7F deferred items (P7-28 through P7-42) live in `PHASE_7_SOCIAL_FEED.md` as Phase-7-internal items per project convention until Phase 7 closes — they will be reconciled into DEFERRED_WORK.md at that point. R9 (concept cooking inline suggestions) was not updated this round despite being touched by the design session because the relationship is already documented in its existing notes via P7-19. |
| 2026-04-07 | 4.2 | **Cross-cutting T3 added** — schema change propagation discipline. Surfaced during Phase 7 Checkpoint 4 from three separate drift bugs (time band logic in `detectPlannedMealForCook`, RPC return types on `get_meal_dishes`/`get_meal_plan_items`, and `createDishPost` not writing `dish_courses`) that all traced back to Phase 7B-Rev's rating column migration not fully propagating. Captures the rule for future schema changes. |
| 2026-04-07 | 4.1 | **Phase 7D scoping additions.** Added R6 (personal daily eating log / leftovers — surfaced from Tom's Q14 answer about nutrition tracking distinct from social posting), R7 (recipe discovery feature — surfaced from dish-tap behavior in Q21, see new `PHASE_RECIPE_DISCOVERY.md` stub), R8 (external participant retroactive claim path — surfaced from D27), R9 (concept cooking inline suggestions for freeform dishes — surfaced from D23). Updated S1/S2 to note they're now scheduled as Phase 7I (renumbered from old 7G) and clarified they're for the "same-recipe-different-cooks" case, NOT multi-dish meals. Note: 7D-internal items (P7-14 through P7-20) live in PHASE_7_SOCIAL_FEED.md until Phase 7 completes. |
| 2026-03-24 | 4.0 | **Phase 5 + Phase 6 reconciliation.** Added "From: Phase 5" section (6 items: base_ingredient_id, gardening data, recipe markup, chef backfill, difficulty scores, technique tagging). Added "From: Phase 6" section (31 items + 6 tech debt across high/medium/lower/tech tiers). Key Phase 6 items: cooking time backfill (🔴, only 60/475 recipes), CookingScreen simplification, multi-recipe cooking, PostCookFlow data gap, pantry fraction rethink, grocery list rethink, timer in step focus. Resolved: N8 (casing cleanup, Phase 5B), N9 (unmatched rows 9.2%→0.06%, Phase 5D), I8 (null names, Phase 5D), B14 (dietary flags, Phase 5C). Updated D3 (cooking method architecture — not addressed in Phase 6, retarget Phase 7). Cross-referenced D4-3 with P6-1 (both about missing cooking time data). Moved B15→P5-6, B4→P5-4 to avoid duplication. |
| 2026-03-17 | 3.0 | **Phase 5A updates.** Resolved: B19, D1, D2, DI-5, DI-4, D4-31, N6. Updated: B14, D3, T1, T2, N1, E1, N8, N9, B1/B10. |
| 2026-03-05 | 2.0 | **Phase 4/I reconciliation.** Added "From: Phase 4 / Phase I" section with 38 items. Marked R3 as delivered. |
| 2026-03-02 | 1.0 | **Doc overhaul.** Moved to repo as canonical location. Restored Idea Shelf, B1 Detail, R3-R5. |
| 2026-02-26 | — | Data seeding session. Added D1-D3. |
| 2026-02-26 | — | SVG icon integration. Marked B9, B11, B12 as completed. Added B20, B21. |
| 2026-02-25 | — | Phase 3A extraction pipeline. Marked B6, B7 as completed. Added B14-B19. |
| 2026-02-24 | — | Added Phase 3A items B1-B13. |
| 2026-02-19 | — | Created. Consolidated from Nutrition Tracker idea shelf and broader roadmap. |

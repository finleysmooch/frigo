<span class="mark">\# Phase 5: Ingredient Architecture & Critical Fixes</span>

<span class="mark">\*\*Started:\*\* March 17, 2026</span>

<span class="mark">\*\*Completed:\*\* March 19, 2026</span>

<span class="mark">\*\*Status:\*\* ✅ Complete — All sub-phases (5A, 5B, 5C, 5D, 5E) done</span>

<span class="mark">\*\*Master Plan:\*\* See FF_LAUNCH_MASTER_PLAN.md for full F&F context</span>

<span class="mark">---</span>

<span class="mark">\## Goals</span>

<span class="mark">Establish a solid ingredient data foundation that all downstream features depend on — dietary badge accuracy, pantry organization, recipe-pantry matching, and nutrition data quality. Simultaneously fix the critical bugs that will break the app for real users.</span>

<span class="mark">\*\*Why this is Phase 5:\*\* Ingredient categorization flows through dietary badges (Phase 3), pantry display (Phase 8), recipe-pantry matching (Phase 8), and nutrition accuracy. Getting this right now means subsequent phases build on solid ground instead of fighting data quality issues.</span>

<span class="mark">\*\*Success criteria — all met:\*\*</span>

<span class="mark">- ✅ Inherited dietary property system: 10 category rules drive defaults, ingredient-level overrides for fringe cases</span>

<span class="mark">- ✅ Dietary flags accurate — meat dishes correctly non-vegetarian, conservative fallback for unknowns. Counts: 338 vegetarian, 109 vegan, 306 GF (up from 104/47/100 pre-inheritance)</span>

<span class="mark">- ✅ Unmatched ingredient rows reduced from 489 (9.2%) to 3 (0.06%) — far exceeding ≤5% target</span>

<span class="mark">- ✅ Seasonal ingredient architecture built — 7 regions, 1,169 entries, regions table with lat/lng/USDA zones</span>

<span class="mark">- ✅ Casing and data quality issues cleaned up (N8, I8)</span>

<span class="mark">- ✅ All critical bugs fixed (nutrition goals migration, auth trigger, extraction save flow)</span>

<span class="mark">- ✅ Categorization flows cleanly: category rules → dietary badges → pantry organization → browse filters</span>

<span class="mark">---</span>

<span class="mark">\## Prerequisites</span>

<span class="mark">- Phase 4 complete ✅</span>

<span class="mark">- Access to Supabase dashboard for migrations ✅</span>

<span class="mark">- Apple Developer Account signup ✅ (initiated March 17, processing)</span>

<span class="mark">---</span>

<span class="mark">\## Scope</span>

<span class="mark">\### Product Feature Roadmap Items Touched</span>

<span class="mark">\| \# \| Feature \| Action \|</span>

<span class="mark">\|---\|---------\|--------\|</span>

<span class="mark">\| 21 \| Dietary badges on posts \| Fix accuracy (B14 COALESCE → inherited properties system) \|</span>

<span class="mark">\| 1 \| Critical/seasonal ingredients \| New location-aware architecture + 7-region data \|</span>

<span class="mark">\| 8 \| Effort/difficulty labels \| Infrastructure touched (not backfill) \|</span>

<span class="mark">\### Ingredient Architecture Rework</span>

<span class="mark">- ✅ \*\*Inherited dietary properties system:\*\* \`ingredient_category_rules\` table with 10 rules (4 family-level + 6 type-level). Materialized view uses inheritance chain: ingredient override → type rule → family rule → false. All regex fallbacks removed.</span>

<span class="mark">- ✅ \*\*Ingredient matching improvement:\*\* Haiku batch classification resolved 482/485 unmatched rows. 267 matched to existing, 137 new ingredients created, 3 skipped (too vague). Match rate: 90.8% → 99.9%.</span>

<span class="mark">- ✅ \*\*Data quality cleanup:\*\* Fixed N8 casing inconsistencies, normalized all family/type values to canonical taxonomy. Remaining:</span>

<span class="mark">- \*\*I7:\*\* Salt variant normalization — deferred to \`base_ingredient_id\` pass</span>

<span class="mark">- \*\*base_ingredient_id wiring:\*\* Protein cuts, cheese dupes, salt variants — all in one systematic pass</span>

<span class="mark">- \*\*I9:\*\* USDA match validation layer — deferred</span>

<span class="mark">- ✅ \*\*Location-aware seasonal ingredients:\*\* \`ingredient_seasons\` table redesigned with \`seasonal_status\`, \`confidence\`, \`needs_review\`, gardening columns. \`regions\` table created. 1,169 entries across 7 US regions from published agricultural sources.</span>

<span class="mark">\### Critical Fixes</span>

<span class="mark">- ✅ \*\*Nutrition goals SQL migration (DI-5):\*\* \`user_nutrition_goals\` table created.</span>

<span class="mark">- ✅ \*\*Auth trigger fix (D1):\*\* ON CONFLICT DO UPDATE preserving existing display_name/username.</span>

<span class="mark">- ✅ \*\*COALESCE dietary flag fix (B14):\*\* Flipped to \`false\` defaults. Replaced by inheritance system in 5C.</span>

<span class="mark">- ✅ \*\*Verify extraction save flow (B19):\*\* All 8 Phase 3A fields present.</span>

<span class="mark">- ✅ \*\*Matching code audit:\*\* ingredientsParser.ts is the active pipeline.</span>

<span class="mark">- ✅ \*\*Cooking methods picker (D3):\*\* UI/DB misalignment documented. Deferred to Phase 6/7.</span>

<span class="mark">- ✅ \*\*Quick data cleanup:\*\* N6 (already gone), D2 (emoji dropped), D4-31 (getMondayOfWeek exported).</span>

<span class="mark">- ✅ \*\*Debug console.logs (DI-4):\*\* Already removed.</span>

<span class="mark">\### Deferred from Phase 5</span>

<span class="mark">- Recipe markup/editing review → \*\*Phase 6 (Cooking Mode)\*\* — Tom: "clunky but fits better with cooking work"</span>

<span class="mark">- Chef name backfill + auto-association (B4) → Phase 7 (Social)</span>

<span class="mark">- Flavor profile system (B1) → \*\*post-F&F\*\* (Tom confirmed)</span>

<span class="mark">- Difficulty score backfill → nice-to-have, not blocking</span>

<span class="mark">- Technique tagging (B15) → post-F&F</span>

<span class="mark">- Full USDA micronutrients import (N2) → post-F&F</span>

<span class="mark">- \`base_ingredient_id\` wiring (protein cuts, cheese dupes, salt variants) → post-Phase 5 or separate session</span>

<span class="mark">- Gardening data (planting/growing months) → post-F&F (columns exist, not populated)</span>

<span class="mark">---</span>

<span class="mark">\## Architecture Decisions</span>

<span class="mark">\### AD-1: Inherited Dietary Properties via Category Rules Table</span>

<span class="mark">\*\*Decision:\*\* Create \`ingredient_category_rules\` table that defines default dietary flags at family and type levels. Individual ingredients inherit from their category unless explicitly overridden.</span>

<span class="mark">\*\*Schema:\*\*</span>

<span class="mark">\`\`\`sql</span>

<span class="mark">CREATE TABLE ingredient_category_rules (</span>

<span class="mark">id uuid DEFAULT gen_random_uuid() PRIMARY KEY,</span>

<span class="mark">family text NOT NULL,</span>

<span class="mark">ingredient_type text, -- NULL = family-level rule</span>

<span class="mark">is_vegan boolean,</span>

<span class="mark">is_vegetarian boolean,</span>

<span class="mark">is_gluten_free boolean,</span>

<span class="mark">is_dairy_free boolean,</span>

<span class="mark">is_nut_free boolean,</span>

<span class="mark">is_shellfish_free boolean,</span>

<span class="mark">is_soy_free boolean,</span>

<span class="mark">is_egg_free boolean,</span>

<span class="mark">notes text,</span>

<span class="mark">UNIQUE(family, ingredient_type)</span>

<span class="mark">);</span>

<span class="mark">\`\`\`</span>

<span class="mark">\*\*Resolution order in materialized view:\*\*</span>

<span class="mark">\`\`\`sql</span>

<span class="mark">COALESCE(</span>

<span class="mark">i.is_vegetarian, -- ingredient-level override (NULL = inherit)</span>

<span class="mark">type_rule.is_vegetarian, -- type-level rule</span>

<span class="mark">family_rule.is_vegetarian, -- family-level rule</span>

<span class="mark">false -- conservative fallback</span>

<span class="mark">)</span>

<span class="mark">\`\`\`</span>

<span class="mark">\*\*Final rules (10 rows — lean set, type rules only where they differ from family):\*\*</span>

<span class="mark">\| Family \| Type \| Vegan \| Vegetarian \| GF \| Dairy-Free \| Nut-Free \| Shellfish-Free \| Soy-Free \| Egg-Free \|</span>

<span class="mark">\|--------\|------\|-------\|------------\|-----\|------------\|----------\|---------------\|----------\|----------\|</span>

<span class="mark">\| Produce \| NULL \| T \| T \| T \| T \| T \| T \| T \| T \|</span>

<span class="mark">\| Proteins \| NULL \| F \| F \| T \| T \| T \| T \| T \| T \|</span>

<span class="mark">\| Proteins \| Seafood \| F \| F \| T \| T \| T \| T \| T \| T \|</span>

<span class="mark">\| Proteins \| Plant-Based Proteins \| T \| T \| T \| T \| T \| T \| F \| T \|</span>

<span class="mark">\| Dairy \| NULL \| F \| T \| T \| F \| T \| T \| T \| T \|</span>

<span class="mark">\| Dairy \| Eggs \| F \| T \| T \| T \| T \| T \| T \| F \|</span>

<span class="mark">\| Pantry \| NULL \| T \| T \| T \| T \| T \| T \| T \| T \|</span>

<span class="mark">\| Pantry \| Grains \| T \| T \| F \| T \| T \| T \| T \| T \|</span>

<span class="mark">\| Pantry \| Nuts & Seeds \| T \| T \| T \| T \| F \| T \| T \| T \|</span>

<span class="mark">\| Pantry \| Stocks & Broths \| F \| F \| T \| T \| T \| T \| T \| T \|</span>

<span class="mark">\*\*Key design decisions during 5C implementation:\*\*</span>

<span class="mark">- \*\*10 rules, not 25-30:\*\* Types that match their family default simply inherit — no rule needed. Reduces maintenance burden.</span>

<span class="mark">- \*\*Seafood shellfish-free=T\*\* (changed from AD-1 draft which had F): Majority of seafood items are fish. Shellfish items (shrimp, crab, lobster, mussels, etc.) override to false at ingredient level. Tom's decision.</span>

<span class="mark">- \*\*Dairy egg-free=T\*\* (changed from AD-1 draft which had F): Milk, cream, cheese, butter don't contain eggs. Only Eggs type needs egg-free=F override. Fewer overrides needed.</span>

<span class="mark">\*\*Impact:\*\* Dietary counts recovered dramatically: 104→338 vegetarian, 47→109 vegan, 100→306 GF. Meat recipes correctly non-vegetarian. All regex fallbacks in materialized view removed.</span>

<span class="mark">\### AD-2: Location-Aware Seasonal Ingredients (Redesigned in 5E)</span>

<span class="mark">\*\*Decision:\*\* Multi-region seasonal data with \`regions\` lookup table, \`seasonal_status\` enum, data quality tracking, and gardening columns for future use.</span>

<span class="mark">\*\*Regions table:\*\*</span>

<span class="mark">\`\`\`sql</span>

<span class="mark">CREATE TABLE regions (</span>

<span class="mark">slug text PRIMARY KEY, -- 'portland_or' (FK target)</span>

<span class="mark">display_name text NOT NULL, -- 'Portland, OR'</span>

<span class="mark">state text, -- 'OR'</span>

<span class="mark">latitude numeric, -- 45.5152</span>

<span class="mark">longitude numeric, -- -122.6784</span>

<span class="mark">usda_zone text, -- '8b'</span>

<span class="mark">timezone text, -- 'America/Los_Angeles'</span>

<span class="mark">notes text,</span>

<span class="mark">created_at timestamptz DEFAULT now()</span>

<span class="mark">);</span>

<span class="mark">\`\`\`</span>

<span class="mark">\*\*Seasons table (redesigned from 5A original):\*\*</span>

<span class="mark">\`\`\`sql</span>

<span class="mark">CREATE TABLE ingredient_seasons (</span>

<span class="mark">id uuid DEFAULT gen_random_uuid() PRIMARY KEY,</span>

<span class="mark">ingredient_id uuid REFERENCES ingredients(id) NOT NULL,</span>

<span class="mark">region text NOT NULL DEFAULT 'portland_or'</span>

<span class="mark">REFERENCES regions(slug),</span>

<span class="mark">seasonal_status text NOT NULL DEFAULT 'local_seasonal'</span>

<span class="mark">CHECK (seasonal_status IN ('local_seasonal', 'local_year_round', 'imported', 'not_available')),</span>

<span class="mark">peak_start_month smallint CHECK (peak_start_month BETWEEN 1 AND 12),</span>

<span class="mark">peak_end_month smallint CHECK (peak_end_month BETWEEN 1 AND 12),</span>

<span class="mark">available_start_month smallint CHECK (available_start_month BETWEEN 1 AND 12),</span>

<span class="mark">available_end_month smallint CHECK (available_end_month BETWEEN 1 AND 12),</span>

<span class="mark">planting_start_month smallint CHECK (...), -- future gardening</span>

<span class="mark">planting_end_month smallint CHECK (...),</span>

<span class="mark">growing_start_month smallint CHECK (...),</span>

<span class="mark">growing_end_month smallint CHECK (...),</span>

<span class="mark">source text NOT NULL DEFAULT 'manual',</span>

<span class="mark">confidence text NOT NULL DEFAULT 'high'</span>

<span class="mark">CHECK (confidence IN ('high', 'medium', 'low')),</span>

<span class="mark">needs_review boolean NOT NULL DEFAULT false,</span>

<span class="mark">notes text,</span>

<span class="mark">created_at timestamptz DEFAULT now(),</span>

<span class="mark">UNIQUE(ingredient_id, region)</span>

<span class="mark">);</span>

<span class="mark">\`\`\`</span>

<span class="mark">\*\*Key design decisions during 5E:\*\*</span>

<span class="mark">- \*\*\`seasonal_status\`\*\* solves "did we skip or intentionally categorize": every produce item gets a row per region, even imported/tropical items with null months.</span>

<span class="mark">- \*\*\`regions\` table\*\* with lat/lng enables "find nearest region" for user location. USDA zones enable climate-similarity fallback.</span>

<span class="mark">- \*\*\`confidence\` + \`needs_review\`\*\* track data quality per-entry. High = directly from published source. Medium = adapted from nearby zone data. Low = needs human review.</span>

<span class="mark">- \*\*Gardening columns\*\* (planting/growing start/end) — nullable, not populated. Structure exists for future home gardening feature.</span>

<span class="mark">- \*\*Smallint months over dates:\*\* Published sources are month-level precision. Specific dates would be fabricated precision. Clean query logic (\`WHERE 3 BETWEEN peak_start_month AND peak_end_month\`).</span>

<span class="mark">\*\*7 regions populated:\*\*</span>

<span class="mark">\| Region \| USDA Zone \| Source \| Confidence \| Seasonal \| Year-round \| Imported \|</span>

<span class="mark">\|--------\|-----------\|--------\|------------\|----------\|------------\|---------\|</span>

<span class="mark">\| Portland, OR \| 8b \| NW Vegetarian Cookbook \| high \| 103 \| 43 \| 21 \|</span>

<span class="mark">\| Minneapolis, MN \| 4b \| Minnesota Grown (MDA) \| high \| 124 \| 11 \| 32 \|</span>

<span class="mark">\| Los Angeles, CA \| 10b \| CA Grown (BCMA) \| high \| 83 \| 78 \| 6 \|</span>

<span class="mark">\| Boulder/Denver, CO \| 5b \| CO Dept of Ag + CSU Extension \| medium \| 128 \| 11 \| 28 \|</span>

<span class="mark">\| Northeast Metro \| 7a \| Cornell Extension (adapted) \| medium \| 130 \| 11 \| 26 \|</span>

<span class="mark">\| Chicago, IL \| 5b \| U of I Extension (adapted) \| medium \| 124 \| 11 \| 32 \|</span>

<span class="mark">\| Omaha, NE \| 5b \| UNL Extension (adapted) \| medium \| 125 \| 11 \| 31 \|</span>

<span class="mark">\*\*Total: 1,169 rows (167 per region × 7 regions). Zero gaps — every produce ingredient accounted for in every region.\*\*</span>

<span class="mark">\### AD-3: Recipe Markup/Editing → Phase 6</span>

<span class="mark">\*\*Decision:\*\* Move recipe markup/editing review out of Phase 5 into Phase 6 (Cooking Mode).</span>

<span class="mark">\### AD-4: Diagnose Before Matching</span>

<span class="mark">\*\*Decision:\*\* Run a diagnostic analysis on unmatched rows before attempting to fix them. ✅ Done — see 5B results.</span>

<span class="mark">\### AD-5: Canonical Taxonomy</span>

<span class="mark">\*\*Decision (5B):\*\* Established canonical family/type taxonomy. All ingredients normalized to these values.</span>

<span class="mark">\*\*Families:\*\* Produce, Proteins, Dairy, Pantry</span>

<span class="mark">\*\*Produce types:\*\* Vegetables, Leafy Greens, Root Vegetables, Alliums, Citrus, Fruits, Gourds, Fresh Herbs, Mushrooms</span>

<span class="mark">\*\*Protein types:\*\* Red Meat, Poultry, Seafood, Plant-Based Proteins</span>

<span class="mark">\*\*Dairy types:\*\* Fresh Dairy, Cultured Dairy, Cheese, Butter, Eggs</span>

<span class="mark">\*\*Pantry types:\*\* Grains, Baking, Oils & Fats, Vinegars, Condiments & Sauces, Spices & Dried Herbs, Nuts & Seeds, Dried Fruit, Canned/Jarred Goods, Legumes, Stocks & Broths, Wines & Spirits</span>

<span class="mark">New types added during 5B cleanup: Stocks & Broths, Wines & Spirits (both Pantry).</span>

<span class="mark">\### AD-6: Eggs Under Dairy</span>

<span class="mark">\*\*Decision (5B):\*\* Eggs categorized as Dairy \> Eggs (standard grocery grouping, matches pantry icon system). Tom acknowledged "Dairy" is a weird family for eggs but it's the convention.</span>

<span class="mark">\### AD-7: \`base_ingredient_id\` Wiring Deferred</span>

<span class="mark">\*\*Decision (5B):\*\* Tom wants hierarchical ingredient relationships (chicken leg → chicken → Poultry). The \`base_ingredient_id\` column supports this. Decided to assign types now but defer all \`base_ingredient_id\` linking to a single systematic pass after Haiku batch surfaces all variant names. Candidates: protein cuts, salt variants, cheese dupes (feta/feta cheese, parmesan/parmesan cheese).</span>

<span class="mark">\### AD-8: \`match_method\` Constraint Extended</span>

<span class="mark">\*\*Decision (5D):\*\* Added \`haiku_classify\` to \`recipe_ingredients_match_method_check\` constraint. Convention: \`{model}\_classify\` for AI-assisted matching passes.</span>

<span class="mark">\### AD-9: Regions Table for Multi-Region Scalability</span>

<span class="mark">\*\*Decision (5E):\*\* Separate \`regions\` lookup table with geographic metadata (lat/lng, USDA zone, timezone). \`ingredient_seasons.region\` is FK to \`regions.slug\`. Adding a new region = insert one row in \`regions\` + ~167 rows in \`ingredient_seasons\`. No schema changes needed for arbitrary number of regions.</span>

<span class="mark">---</span>

<span class="mark">\## Build Phases</span>

<span class="mark">\| Sub-phase \| Scope \| Sessions \| Status \|</span>

<span class="mark">\|-----------\|-------\|----------\|--------\|</span>

<span class="mark">\| \*\*5A\*\* \| Critical fixes: DB migrations, auth trigger, COALESCE flip, code cleanup, save flow audit, matching code audit \| 1-2 \| ✅ Complete \|</span>

<span class="mark">\| \*\*5B\*\* \| Taxonomy cleanup: normalize family/type casing, redistribute misplaced items, assign null types. Added Stocks & Broths and Wines & Spirits types. \| 1 \| ✅ Complete \|</span>

<span class="mark">\| \*\*5D\*\* \| Haiku batch classification: 422 unique unmatched names classified, 137 new ingredients created, 482/485 rows linked. Match rate 90.8% → 99.9%. \| 1 \| ✅ Complete \|</span>

<span class="mark">\| \*\*5C\*\* \| Category rules populated (10 rules), ingredient flags NULL-ified with overrides preserved, materialized view rebuilt with inheritance chain. Dietary counts: 104→338 veg, 47→109 vegan, 100→306 GF. \| 1 \| ✅ Complete \|</span>

<span class="mark">\| \*\*5E\*\* \| Seasonal data: \`ingredient_seasons\` table redesigned, \`regions\` table created, 1,169 entries across 7 US regions from published sources. \| 1 \| ✅ Complete \|</span>

<span class="mark">\*\*Total: ~6 sessions (5A: 2, 5B+5D: 2, 5C+5E: 2). Within original 6-8 estimate.\*\*</span>

<span class="mark">---</span>

<span class="mark">\## Work Completed (5C)</span>

<span class="mark">\### 5C Step 1: Category Rules Population</span>

<span class="mark">- 10 rules inserted into \`ingredient_category_rules\`: 4 family-level + 6 type-level</span>

<span class="mark">- Key decisions: Seafood shellfish-free=T (majority fish), Dairy egg-free=T (milk/cream/cheese don't contain eggs)</span>

<span class="mark">\### 5C Step 2: Ingredient Flag NULL-ification</span>

<span class="mark">- Bulk UPDATE set ingredient flags to NULL where current value matches the resolved category rule</span>

<span class="mark">- Known overrides applied via targeted UPDATEs: GF grains (rice, quinoa, oats, etc.), shellfish items, soy sauces, non-vegan pantry items (honey, fish sauce), vegetable stock, seitan, seeds as nut-free, flour/breadcrumbs as not GF</span>

<span class="mark">- 3 post-run fixes: tamarind paste (false soy match from \`%tamari%\` pattern), chickpea flour (false GF match from \`%flour%\` pattern), eggs (bad pre-existing \`is_vegetarian=false\` value)</span>

<span class="mark">\### 5C Step 3: Materialized View Rebuild</span>

<span class="mark">- \`recipe_nutrition_computed\` dropped and recreated with inheritance chain</span>

<span class="mark">- Two new LEFT JOINs to \`ingredient_category_rules\` (type-level + family-level)</span>

<span class="mark">- All 8 dietary flags use \`COALESCE(i.X, type_rule.X, family_rule.X, false)\`</span>

<span class="mark">- All regex fallback patterns removed (no longer needed at 99.9% match rate)</span>

<span class="mark">- Nutrition math and quality metrics unchanged</span>

<span class="mark">\*\*Verified results:\*\*</span>

<span class="mark">- 475 recipes total (unchanged)</span>

<span class="mark">- Dietary counts: 338 vegetarian, 109 vegan, 306 GF, 211 dairy-free, 372 nut-free, 456 shellfish-free, 444 soy-free, 363 egg-free</span>

<span class="mark">- Meat spot-check: all chicken/beef/pork recipes correctly non-vegetarian/non-vegan</span>

<span class="mark">- Veggie spot-check: salads, pastas, vegetable dishes correctly flagged</span>

<span class="mark">---</span>

<span class="mark">\## Work Completed (5E)</span>

<span class="mark">\### 5E: Seasonal Data Architecture + Multi-Region Population</span>

<span class="mark">\*\*Schema redesign:\*\*</span>

<span class="mark">- Original \`ingredient_seasons\` table (created in 5A, empty) dropped and recreated with expanded schema</span>

<span class="mark">- Added: \`seasonal_status\` (local_seasonal / local_year_round / imported / not_available), \`confidence\` (high/medium/low), \`needs_review\` (boolean), gardening columns (planting/growing start/end, all nullable for future)</span>

<span class="mark">- Created \`regions\` table with lat/lng, USDA zone, timezone</span>

<span class="mark">- FK wired: \`ingredient_seasons.region\` → \`regions.slug\`</span>

<span class="mark">- Index on \`region\` column for common query path</span>

<span class="mark">\*\*Data sourcing:\*\*</span>

<span class="mark">- Portland OR: NW Vegetarian Cookbook (2010, Timber Press) via Food Connections blog + Double Up Oregon seasonal chart (2022)</span>

<span class="mark">- Minneapolis MN: Minnesota Grown (MDA) "A Seasonal Look at Fresh Produce" PDF</span>

<span class="mark">- Los Angeles CA: CA Grown (BCMA) "Eat the Season" chart</span>

<span class="mark">- Boulder/Denver CO: CO Dept of Agriculture produce calendar + CSU Extension</span>

<span class="mark">- Northeast Metro: Cornell Cooperative Extension patterns (adapted for zone 7a)</span>

<span class="mark">- Chicago IL: U of I Extension (adapted from zone 5b data)</span>

<span class="mark">- Omaha NE: UNL Extension (adapted from zone 5b data)</span>

<span class="mark">\*\*Results:\*\*</span>

<span class="mark">- 167 produce ingredients × 7 regions = 1,169 rows</span>

<span class="mark">- Zero gaps: every produce ingredient accounted for in every region</span>

<span class="mark">- Imported items explicitly tracked (not skipped) with null months and \`seasonal_status = 'imported'\`</span>

<span class="mark">---</span>

<span class="mark">\## Work Completed (5B + 5D)</span>

<span class="mark">\### 5B: Taxonomy Cleanup (run in Supabase SQL Editor)</span>

<span class="mark">\*\*Part A — Bulk updates (96+ rows):\*\*</span>

<span class="mark">- Family casing: \`pantry\` → \`Pantry\`, \`produce\` → \`Produce\`</span>

<span class="mark">- Type consolidation: \`baking\`→\`Baking\`, \`condiment\`→\`Condiments & Sauces\`, \`grain\`→\`Grains\`, \`spice\`→\`Spices & Dried Herbs\`, \`dried_fruit\`→\`Dried Fruit\`, \`fruit\`→\`Fruits\`, \`vegetable\`→\`Vegetables\`</span>

<span class="mark">- Merges: \`Peppers\`→\`Vegetables\`, \`Canned & Jarred\`→\`Canned/Jarred Goods\`</span>

<span class="mark">- Structural moves: \`Produce \> dried_fruit\`→\`Pantry \> Dried Fruit\`, \`Produce \> Legumes\`→\`Pantry \> Legumes\`</span>

<span class="mark">\*\*Part C — Per-item fixes (55 items):\*\*</span>

<span class="mark">- \`Other\` family eliminated: stocks→Pantry/Stocks & Broths, peanut→Pantry/Nuts & Seeds, water→Pantry/null</span>

<span class="mark">- Dairy anomalies fixed: half and half→Fresh Dairy, ghee→Butter</span>

<span class="mark">- Generic \`protein\` type resolved: anchovies→Seafood, brisket/short ribs/ribeye/sirloin→Red Meat, eggs→Dairy/Eggs</span>

<span class="mark">- Pantry vegetable→Canned/Jarred Goods (crushed/diced/sun-dried tomatoes)</span>

<span class="mark">- Cooking wines→Wines & Spirits, nut butters→Nuts & Seeds</span>

<span class="mark">- All null types assigned across all families</span>

<span class="mark">\*\*Post-cleanup distribution:\*\* 4 families, 0 \`Other\`, 0 generic types, 1 null type (water, intentional).</span>

<span class="mark">\### 5D: Haiku Batch Classification</span>

<span class="mark">\*\*Process:\*\*</span>

<span class="mark">1. Python script (\`scripts/classify_unmatched_ingredients.py\`) sent 422 unique unmatched names to Haiku 4.5 in batches of 20</span>

<span class="mark">2. Haiku classified each as match_existing (with UUID) or create_new (with family/type/prep)</span>

<span class="mark">3. Programmatic audit caught 8 errors (~2% error rate): broken UUIDs, wrong matches (vinegar→olive oil, blood orange→lemon, pecorino→feta), empty IDs</span>

<span class="mark">4. 12 duplicate new_name groups deduplicated (chervil x4, pancetta x2, etc.)</span>

<span class="mark">5. Taxonomy corrections applied (dried chiles→Spices, coconut cream→Canned/Jarred, fenugreek→Spices)</span>

<span class="mark">6. SQL generator produced INSERT + UPDATE files with all corrections applied</span>

<span class="mark">\*\*Results:\*\*</span>

<span class="mark">- 267 matched to existing ingredients</span>

<span class="mark">- 137 new ingredients created (21 Produce, 11 Proteins, 9 Dairy, 96 Pantry)</span>

<span class="mark">- 3 skipped (too vague)</span>

<span class="mark">- Ingredients: 497 → 634</span>

<span class="mark">- Unmatched: 485 → 3 (99.4% resolved)</span>

<span class="mark">- Match rate: ~90.8% → ~99.9%</span>

<span class="mark">- \`match_method_check\` constraint updated to include \`haiku_classify\`</span>

<span class="mark">\*\*Audit findings (for future reference):\*\*</span>

<span class="mark">- Haiku error rate ~2% on ingredient matching — good enough for batch work, but every match_existing needs programmatic validation (UUID exists, name matches)</span>

<span class="mark">- Common Haiku mistakes: wrong citrus family (blood orange→lemon), Italian/English name confusion (pecorino→feta when pecorino not in DB), putting new_name in matched_name field</span>

<span class="mark">- Dedup candidates discovered: feta/feta cheese, parmesan/parmesan cheese, fig/figs — handle in \`base_ingredient_id\` pass</span>

<span class="mark">---</span>

<span class="mark">\## Claude Code Prompts Issued</span>

<span class="mark">\### Prompt 5A-1: Database Migrations & Cleanup</span>

<span class="mark">\*\*Status:\*\* ✅ Complete</span>

<span class="mark">\*\*Scope:\*\* Nutrition goals table, duplicate recipe shells (already gone), emoji column, seasonal ingredients table, category rules table</span>

<span class="mark">\*\*Results:\*\* All tables created. N6 already resolved. Emoji column dropped. Seasonal table updated to use date columns per Tom's preference.</span>

<span class="mark">\### Prompt 5A-2: Auth Trigger Fix + COALESCE Fix</span>

<span class="mark">\*\*Status:\*\* ✅ Complete (run manually in Supabase SQL Editor)</span>

<span class="mark">\*\*Scope:\*\* Auth trigger conditional logic, materialized view COALESCE flip</span>

<span class="mark">\*\*Results:\*\* \`handle_new_user()\` updated with ON CONFLICT DO UPDATE preserving existing display_name/username. Materialized view rebuilt with all \`ELSE true\` → \`ELSE false\` and \`COALESCE(..., true)\` → \`COALESCE(..., false)\`. Verified: chicken recipes show is_vegetarian=false, 475 total rows. Current dietary counts: 104 vegetarian, 47 vegan, 100 GF (some false negatives expected until 5C inheritance).</span>

<span class="mark">\### Prompt 5A-3: Code Cleanup + Audits</span>

<span class="mark">\*\*Status:\*\* ✅ Complete</span>

<span class="mark">\*\*Scope:\*\* Console.log removal, getMondayOfWeek export, cooking methods verify, save flow audit, matching code audit</span>

<span class="mark">\*\*Results:\*\* Logs already clean (removed in fc1e331). getMondayOfWeek exported. Cooking methods: significant UI/DB misalignment discovered (D3 expanded). B19: all 8 Phase 3A fields present in save path. Matching code audit: ingredientsParser.ts (755 lines) is the active pipeline, subproject services not needed.</span>

<span class="mark">\### 5B + 5D: Taxonomy Cleanup + Haiku Matching</span>

<span class="mark">\*\*Status:\*\* ✅ Complete (run manually in Supabase SQL Editor)</span>

<span class="mark">\*\*Scope:\*\* Normalize family/type values, redistribute misplaced items, Haiku batch classify 422 unmatched names, create 137 new ingredients, link 482 recipe_ingredient rows</span>

<span class="mark">\*\*Results:\*\* See "Work Completed (5B + 5D)" section above.</span>

<span class="mark">\### 5C: Category Rules + Materialized View</span>

<span class="mark">\*\*Status:\*\* ✅ Complete (run manually in Supabase SQL Editor)</span>

<span class="mark">\*\*Scope:\*\* Populate \`ingredient_category_rules\` (10 rules), NULL-ify ingredient flags where they match rules, rebuild materialized view with inheritance chain</span>

<span class="mark">\*\*Results:\*\* See "Work Completed (5C)" section above.</span>

<span class="mark">\### 5E: Seasonal Data</span>

<span class="mark">\*\*Status:\*\* ✅ Complete (run manually in Supabase SQL Editor)</span>

<span class="mark">\*\*Scope:\*\* Redesign \`ingredient_seasons\` table, create \`regions\` table, populate 7 US regions with sourced data</span>

<span class="mark">\*\*Results:\*\* See "Work Completed (5E)" section above.</span>

<span class="mark">---</span>

<span class="mark">\## Completed Prompt Texts (5A)</span>

<span class="mark">5A prompt texts archived — see \`docs/PROMPT_5A1_DB_MIGRATIONS.md\`, \`PHASE_5A2_AUTH_COALESCE.sql\`, and \`docs/PROMPT_5A3_CODE_CLEANUP.md\` in repo for originals.</span>

<span class="mark">---</span>

<span class="mark">\## Deferred Items</span>

<span class="mark">\*Populated during and after phase execution.\*</span>

<span class="mark">\| \# \| Item \| Deferred To \| Notes \|</span>

<span class="mark">\|---\|------\|-------------\|-------\|</span>

<span class="mark">\| — \| Recipe markup/editing review \| Phase 6 (Cooking Mode) \| Tom: "clunky but not broken, fits with cooking work" \|</span>

<span class="mark">\| B1 \| Flavor profile system \| Post-F&F \| Tom confirmed comfortable deferring \|</span>

<span class="mark">\| B4 \| Chef name backfill \| Phase 7 (Social) \| Better with attribution work \|</span>

<span class="mark">\| B15 \| Technique tagging \| Post-F&F \| \|</span>

<span class="mark">\| N2 \| USDA micronutrients import \| Post-F&F \| \|</span>

<span class="mark">\| — \| Difficulty score backfill \| Post-F&F \| Nice-to-have, not blocking \|</span>

<span class="mark">\| I7 \| Salt variant normalization \| \`base_ingredient_id\` pass \| Part of systematic variant linking \|</span>

<span class="mark">\| — \| \`base_ingredient_id\` wiring \| Post-Phase 5 or separate session \| Protein cuts, cheese dupes, salt variants, herb variants \|</span>

<span class="mark">\| — \| Dedup feta/feta cheese, parmesan/parmesan cheese, fig/figs \| \`base_ingredient_id\` pass \| Discovered during 5D audit \|</span>

<span class="mark">\| I9 \| USDA match validation layer \| Post-F&F \| Nice-to-have for future extraction runs \|</span>

<span class="mark">\| N4 \| Garnish tagging \| Post-F&F \| Opportunistic, not blocking \|</span>

<span class="mark">\| N7 \| Form column cleanup \| Post-F&F \| Opportunistic, not blocking \|</span>

<span class="mark">\| — \| Gardening data (planting/growing months) \| Post-F&F \| Columns exist in \`ingredient_seasons\`, not populated \|</span>

<span class="mark">\| — \| Additional seasonal regions \| As needed \| Schema supports any number of regions; just add rows \|</span>

<span class="mark">---</span>

<span class="mark">\## Decisions Log</span>

<span class="mark">\| Decision \| Rationale \| Date \| Origin \|</span>

<span class="mark">\|----------\|-----------\|------\|--------\|</span>

<span class="mark">\| Phase 5 = ingredient architecture (not cooking mode) \| Foundational — dietary badges, pantry matching, nutrition all depend on ingredient data quality \| Mar 17 \| Tom + Claude planning \|</span>

<span class="mark">\| Inherited dietary properties via category rules table (AD-1) \| Scales better than per-ingredient flagging; makes dietary logic auditable; eliminates COALESCE bug systematically \| Mar 17 \| Tom proposed hierarchy concept, Claude designed schema \|</span>

<span class="mark">\| Location-aware seasonal ingredients table (AD-2) \| Seasonality depends on location; schema must support future regions, user reports, market data \| Mar 17 \| Tom: needs to be location-specific, start Portland OR \|</span>

<span class="mark">\| Recipe markup/editing → Phase 6 (AD-3) \| Clunky but not broken; natural fit with cooking mode work \| Mar 17 \| Tom decision \|</span>

<span class="mark">\| Diagnose unmatched rows before fixing (AD-4) \| Need to understand failure distribution to pick right strategy \| Mar 17 \| Tom + Claude planning \|</span>

<span class="mark">\| Flavor profile system deferred to post-F&F \| Not foundational; Tom confirmed comfortable deferring \| Mar 17 \| Tom decision \|</span>

<span class="mark">\| Chef name backfill deferred to Phase 7 (Social) \| Better to address attribution when building social features \| Mar 17 \| Tom + Claude planning \|</span>

<span class="mark">\| Apple Developer Account initiated \| On critical path for distribution; 24-48h processing time \| Mar 17 \| FF_LAUNCH_MASTER_PLAN recommendation \|</span>

<span class="mark">\| COALESCE flip to false as immediate safety fix \| Conservative default (unmatched = not vegetarian) prevents false positives; replaced by inheritance system in 5C \| Mar 17 \| Claude recommendation, Tom agreed \|</span>

<span class="mark">\| Fold N3, I7, I9 into 5D; N4, N7 opportunistic in 5B \| Natural extensions of matching/cleanup work already planned; no session increase \| Mar 17 \| Claude recommended after backlog review, Tom agreed \|</span>

<span class="mark">\| Canonical taxonomy with Stocks & Broths + Wines & Spirits (AD-5) \| Needed for stocks (3 items) and cooking wines (5 items) that had no proper type \| Mar 19 \| Tom + Claude, during 5B cleanup \|</span>

<span class="mark">\| Eggs under Dairy family (AD-6) \| Standard grocery grouping, matches pantry icon system \| Mar 19 \| Tom decision \|</span>

<span class="mark">\| Olives → Pantry \> Canned/Jarred Goods \| Most people buy them jarred/canned \| Mar 19 \| Tom decision \|</span>

<span class="mark">\| Passata as separate ingredient (not tomato paste) \| Different product — thinner, uncooked. Pantry \> Canned/Jarred Goods \| Mar 19 \| Tom decision \|</span>

<span class="mark">\| Create generic "vinegar" entry \| Needed for recipes that say "vinegar" without specifying type \| Mar 19 \| Tom + Claude \|</span>

<span class="mark">\| \`base_ingredient_id\` wiring deferred to single pass (AD-7) \| Haiku batch surfaced many variants; better to do all linking at once \| Mar 19 \| Claude recommendation, Tom agreed \|</span>

<span class="mark">\| Dried chiles → Pantry \> Spices & Dried Herbs \| Dried chiles are used as spices, not produce \| Mar 19 \| Tom decision \|</span>

<span class="mark">\| Skip vague ingredients (raw nuts, soft herbs, red leaves) \| Recipe-speak for "use what you have," not real ingredients \| Mar 19 \| Tom + Claude \|</span>

<span class="mark">\| \`haiku_classify\` match method (AD-8) \| Model-specific naming convention for AI matching passes \| Mar 19 \| Tom + Claude \|</span>

<span class="mark">\| Aquafaba as separate ingredient \| Not in DB, distinct from chickpeas. Pantry \> Baking \| Mar 19 \| Tom + Claude \|</span>

<span class="mark">\| Pecorino as new ingredient \| Not in DB despite being referenced. Dairy \> Cheese \| Mar 19 \| Discovered during audit \|</span>

<span class="mark">\| 10 category rules (lean set) over 25-30 (redundant) \| Types matching family default just inherit; no rule needed. Less maintenance. \| Mar 19 \| Claude recommendation, Tom agreed \|</span>

<span class="mark">\| Seafood shellfish-free=T (majority are fish) \| Fish items are majority of Seafood type; shellfish override at ingredient level \| Mar 19 \| Tom decision (flipped from AD-1 draft) \|</span>

<span class="mark">\| Dairy egg-free=T (milk/cheese don't contain eggs) \| Fewer overrides needed; only Eggs type needs egg-free=F \| Mar 19 \| Claude recommendation, Tom agreed \|</span>

<span class="mark">\| \`seasonal_status\` enum for explicit categorization \| Differentiates "not yet categorized" (no row) from "imported" (row with null months) \| Mar 19 \| Tom requested; Claude designed \|</span>

<span class="mark">\| \`regions\` table with lat/lng + USDA zones (AD-9) \| Enables "find nearest region" for user location; USDA zones for climate-similarity fallback \| Mar 19 \| Tom asked about scalability; Claude proposed \|</span>

<span class="mark">\| Smallint months over dates for seasonality \| Published sources are month-level; dates would be fabricated precision. Clean query logic. \| Mar 19 \| Claude pushed back on dates; Tom agreed after discussion \|</span>

<span class="mark">\| Multi-region population from extension services \| State dept of agriculture and university extension data is most reliable regional source \| Mar 19 \| Tom wanted accurate sourced data; Claude researched and compiled \|</span>

<span class="mark">---</span>

<span class="mark">\## Changelog</span>

<span class="mark">\| Date \| Change \|</span>

<span class="mark">\|------\|--------\|</span>

<span class="mark">\| 2026-03-17 \| Created scaffold during F&F planning session. \|</span>

<span class="mark">\| 2026-03-17 \| \*\*Planning session complete.\*\* Finalized architecture decisions: inherited dietary properties (AD-1), location-aware seasonal ingredients (AD-2), recipe markup → Phase 6 (AD-3), diagnose before matching (AD-4). Defined 5 sub-phases (5A-5E, 6-8 sessions). Generated 3 Claude Code prompts for 5A. Removed recipe markup from scope. Added flavor profile to post-F&F deferrals. Apple Developer Account initiated. \|</span>

<span class="mark">\| 2026-03-17 \| \*\*5A complete.\*\* All 3 prompts executed. DB: nutrition goals table, ingredient_seasons table (date-based per Tom), ingredient_category_rules table created. Auth trigger fixed. COALESCE defaults flipped to false (104 veg / 47 vegan / 100 GF). Code: logs already clean, getMondayOfWeek exported, B19 verified (all fields present), cooking method misalignment found (D3 expanded), matching code audited (ingredientsParser.ts is active pipeline). Folded N3/I7/I9 into 5D scope, N4/N7 opportunistic in 5B. \|</span>

<span class="mark">\| 2026-03-19 \| \*\*5B complete.\*\* Taxonomy cleanup: all family/type values normalized to canonical taxonomy. \`Other\` family eliminated. New types: Stocks & Broths, Wines & Spirits. All null types assigned. 55 per-item fixes applied. Decisions: eggs under Dairy, olives in Pantry, dried chiles in Spices. \|</span>

<span class="mark">\| 2026-03-19 \| \*\*5D (matching) complete.\*\* Haiku batch classified 422 unique names. 137 new ingredients created, 482/485 rows linked. Match rate 90.8% → 99.9%. Audit caught 8 Haiku errors (~2%), all corrected. \`haiku_classify\` added to match_method constraint. Ingredients: 497 → 634. Deferred: \`base_ingredient_id\` wiring, I7 salt variants, I9 validation layer, N4 garnish tags, N7 form cleanup. \|</span>

<span class="mark">\| 2026-03-19 \| \*\*5C complete.\*\* 10 category rules populated. Ingredient flags NULL-ified with overrides preserved (3 post-run fixes: tamarind paste, chickpea flour, eggs). Materialized view rebuilt with inheritance chain — all regex fallbacks removed. Dietary counts: 104→338 vegetarian, 47→109 vegan, 100→306 GF. All meat recipes verified non-vegetarian. \|</span>

<span class="mark">\| 2026-03-19 \| \*\*5E complete.\*\* \`ingredient_seasons\` table redesigned with \`seasonal_status\`, \`confidence\`, \`needs_review\`, gardening columns. \`regions\` table created (7 US regions with lat/lng, USDA zones). 1,169 seasonal entries from published sources (NW Veg Cookbook, MN Grown, CA Grown, CO Dept of Ag, extension services). AD-9 added. \|</span>

<span class="mark">\| 2026-03-19 \| \*\*Phase 5 complete.\*\* All sub-phases done. 634 ingredients, 99.9% match rate, 10 category rules, inheritance-based materialized view, 7-region seasonal data. Ready for Phase 6 (Cooking Mode). \|</span>

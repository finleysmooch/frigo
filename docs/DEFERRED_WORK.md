# FRIGO — Deferred Work & Action Items

**Last Updated:** April 22, 2026  
**Version:** 5.1  
**Canonical location:** Repo `docs/DEFERRED_WORK.md` (copy in Claude.ai project knowledge)

---

## How This Document Works

Items land here at **phase completion** after a reconciliation review. During active phase work, deferred items live in the active phase doc. When a phase completes, Claude.ai reviews those items: resolved items are dropped, items still relevant move here under a "From: Phase N" section, items not worth tracking are discarded.

This is the master backlog — the accumulated deferred work from all completed phases plus cross-cutting tech debt and roadmap ideas.

**Priority levels:** 🔴 High (affects accuracy/UX significantly), 🟡 Medium (would improve quality), 🟢 Low (nice to have), ⚪ By design (accepted tradeoff)

**Types:** 🐛 Bug/Gap, 💡 Idea, 🔧 Technical debt, 📊 Data quality, 🚀 Feature, 🧪 Testing

---

## From: Phase 7 — Social & Feed Polish (Mar 24 – Apr 17, 2026)

**Context:** Phase 7 shipped 78 items across 13 sub-phases, transforming Frigo into a social cooking app. 42 items deferred during execution. Items reconciled below from `PHASE_7_SOCIAL_FEED.md` deferred items sections. Resolved items dropped, still-relevant items preserved with updated context.

### Infrastructure / cleanup

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-2 | `posts.make_again` column cleanup | 🔧 | 🟢 | Column exists but unused after 7B-Rev. Drop when convenient. |
| P7-3 | `PostCookFlow.tsx` file deletion | 🔧 | 🟢 | Deprecated in 7B-Rev, no longer rendered. Delete in cleanup. |
| P7-4 | `LogCookSheet` inline SVG extraction | 🔧 | 🟢 | 7 SVG icons inline. Extract to `components/icons/` if reused. |
| P7-23 | Set up `supabase/migrations/` tracking | 🔧 | 🟡 | At least 8+ direct-in-Supabase migrations run without tracking. DB state non-reproducible for new environments. |
| P7-24 | Silent error swallowing audit | 🔧 | 🟢 | Audit `lib/services/*.ts` for `try/catch { continue }` patterns. Replace with collect-and-report. |
| P7-25 | `addDishesToMeal` 3-representation audit | 🔧 | 🟡 | Three parallel meal↔dish representations (`parent_meal_id`, `dish_courses`, `post_relationships`). Assess whether `post_relationships` can be dropped. |
| P7-72 | Recipe image filename normalization | 🔧 | 🟡 | ~347 storage files with uppercase/double-extension filenames. Rename + update `recipes.image_url`. |
| P7-73 | `posts.photos` jsonb shape normalization | 🔧 | 🟡 | Mix of string-array and object-array forms. CookCardInner handles defensively but data should be normalized. |
| P7-79 | Storage/DB reference integrity audit | 🔧 | 🟡 | 173 recipes with potentially broken URL patterns. Need HEAD-check script. |
| P7-100 | Migrate Meals-tab callers to MealEventDetailScreen | 🔧 | 🟡 | 4 screens still route to legacy `MealDetail`. Once migrated, `MealDetailScreen.tsx` can be deleted. |
| P7-102 | `PostActionMenu.tsx` cleanup | 🔧 | 🟢 | Still referenced by legacy MyPostDetailsScreen + MyPostsScreen. Delete after P7-100. |
| P7G-1 | Cook partner temporal window → cooked_at | 🔧 | 🟡 | `getLinkedCookPartnersForPosts` uses `created_at` — backdated cooks won't match. |
| P7G-2 | Legacy `groupPostsForFeed` dead code | 🔧 | 🟢 | Still has `created_at` sorting. Delete. |
| P7H-1 | CookDetailScreen cross-stack nav audit | 🔧 | 🟡 | StatsStack vs FeedStack internal navigation edge cases. |
| P7H-2 | Legacy MyPostDetailsScreen/MyPostsScreen route cleanup | 🔧 | 🟡 | Orphaned from Stats tab. Cleanup with P7-100/P7-102. |
| P7M-1 | Extract cook partner diff to `postParticipantsService` | 🔧 | 🟢 | Currently inline in EditPostScreen. Was also in CookDetailScreen (removed in 7M CP3). |
| P7M-2 | StarRating PanResponder / ScrollView gesture conflict | 🐛 | 🟡 | On EditPostScreen, touching star rating can accidentally scroll the page. Needs `onMoveShouldSetPanResponder` threshold or `scrollEnabled` toggling. |
| P7-43 | 2026-04-08 doc maintenance backfill | 📝 | 🟢 | Phase 7D/7E Checkpoint 5 closeout was drafted but never fully applied. Phase 7 complete now — lower priority. |

### Detail screen polish

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-80 | Cook/prep time split on stats grid | 🚀 | 🟢 | CookDetailScreen Block 8. Requires extending CookCardData. |
| P7-81 | Highlights descriptive paragraph | 🚀 | 🟢 | Extend Highlight data model with longText. |
| P7-82 | Author location line on Block 3 | 🚀 | 🟡 | Needs geo info on posts. |
| P7-83 | CommentsScreen extraction for inline rendering | 🔧 | 🟢 | Extract ~400 lines to reusable `<CommentList>`. |
| P7-84 | Pending cook partner visibility | 🚀 | 🟡 | Author can't see pending sous_chef invitations on their post. |
| P7-86 | EditMedia Strava-style redesign | 🚀 | 🟡 | Drag-to-reorder with hamburger handles, per-photo menu. Current grid layout. |
| P7-89 | CookDetailScreen inline photos layout | 🚀 | 🟢 | Remove separate Block 12, render thumbnails inline after highlights. |
| P7-91 | "Create event" in CookDetail meal picker | 🚀 | 🟢 | Now available on EditPostScreen (7M), but not on CookDetail's now-removed inline picker. Low priority. |
| P7-93 | Half-star eater ratings | 🚀 | 🟢 | DDL alter on eater_ratings.rating. Currently integer only. |
| P7-94 | Eater rating privacy label | 🚀 | 🟢 | "Your rating" with eye-slash icon explaining D43 private-per-eater rule. |
| P7-95 | Shared media thumbnail tap-through | 🚀 | 🟢 | Full-screen viewer for Block 7 shared media thumbnails. |
| P7-96b | Eater rating affordance on CookDetail | 🚀 | 🟡 | For viewers tagged as ate_with. P7-96a (label fix) shipped in 7N. |
| P7-99 | Highlight picker section headers | 🚀 | 🟢 | Split dual-pool grid into "From shared media" / "From dishes" groups. |

### Feed performance

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-44 | Feed infinite scroll (pagination) | 🚀 | 🔴 | Hard-capped at 200 dishes. Needs onEndReached pagination. |
| P7-45 | Pull-to-refresh investigation | 🐛 | 🔴 | 15s hang. May have been fixed by 7I FeedScreen rewrite + 7M 5s stale threshold — needs verification. |
| P7-74 | hydrateEngagement perf | 🔧 | 🟡 | ~1.0s steady-state. Likely N+1 pattern. |
| P7-75 | Batched getMealEventsByIds | 🔧 | 🟢 | N×4 round trips → 2-3 batched. |

### Future sub-phases (post-launch)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-7 | Voice memo on LogCookSheet | 🚀 | 🟡 | Placeholder chip exists. Needs recording + transcription. |
| P7-8 | Photo upload on LogCookSheet | 🚀 | 🟡 | Placeholder buttons exist. Needs image picker wiring. |
| P7-17 | Retroactive external participant claim | 🚀 | 🟢 | Schema supports it. UI is post-launch. |
| P7-21 | User-configurable contextual privacy rules | 🚀 | 🟢 | Hardcoded in v1. Making configurable needs rules-engine UI. |
| P7-32 | `post_participants` schema migration for eater ratings | 🔧 | 🟡 | Add `rating numeric(3,1)` and `notes text` columns. Per D43. |
| P7-33 | Eater rating service + privacy enforcement | 🚀 | 🟡 | Ratings must never surface to the cook. Per D43 ζ. |
| P7-34 | Eater rating UI in meal detail | 🚀 | 🟡 | Per-dish rating with educational banner. Per D43. |
| P7-35 | "Things I've eaten" history in profile | 🚀 | 🟢 | Personal-only. Linked from meal detail eater rating. |
| P7-36 | @-mention parsing in comments | 🚀 | 🟡 | Tokenize, validate, render styled span. Per D42. |
| P7-37 | Comment thread subscriptions | 🔧 | 🟡 | Implicit subscribe on first comment. Mute option. Per D42. |
| P7-38 | Notification batching for meal comments | 🚀 | 🟡 | Aggregate within time window. Per D42. |
| P7-39 | Per-photo dish tag toggle in LogCookSheet | 🚀 | 🟢 | Required for full D46 implementation. |
| P7-40 | Viewer-taste-profile model | 🚀 | 🟢 | Phase 11 territory. Computed from cook history + ratings. |
| P7-41 | Vibe pill personalized selection | 🚀 | 🟢 | Depends on P7-40. Currently static. |
| P7-42 | Flip-card recipe affordance | 💡 | 🟢 | Parked concept from wireframes. |
| P7-46 | Strava-style tag-accept auto-draft flow | 🚀 | 🟡 | Tag cook partner → notification → draft post for them. |
| P7-47 | Duplicate meal event detection | 🐛 | 🟡 | Trust users for F&F. Later: detect + merge. |
| P7-48 | Planned-dish entry flow on MealEventDetail | 💡 | 🟡 | "Add planned dish" for host before attendee posts. |
| P7-49 | "Host recap" post type | 💡 | 🟡 | Host posts about an evening without specific dishes. |
| P7-50 | RSVP flow redesign under meal event model | 🚀 | 🟡 | Move from old MealDetailScreen to MealEventDetailScreen. |
| P7-51 | "Related cooks from friends" on CookDetail | 🚀 | 🟢 | "Mary also cooked this recipe" social hook. |
| P7-52 | Personalized chef page lens | 🚀 | 🟢 | Chef page filtered through user's cook history. |
| P7-53 | Cookbook page number deep-linking | 🚀 | 🟢 | Tap page number → cookbook detail scrolled to section. |
| P7-54 | Collage hero photo for meal event | 🚀 | 🟢 | One photo from each contributor. |
| P7-55 | Per-cook + per-event comments unification | 💡 | 🟢 | May feel artificial — wait for F&F feedback. |
| P7-56 | Shared media notifications | 🚀 | 🟢 | Who gets notified when attendee adds photo. |
| P7-57 | Photo dimensions at upload time | 🔧 | 🟢 | Eliminate aspect ratio flash on first load. |
| P7-63 | Feed card overflow menu (edit/delete from feed) | 🚀 | 🟢 | Deferred from 7M. Only entry point is CookDetail → Edit post. |

### Resolved during Phase 7 (dropped from backlog)

- **P5-4** (Chef name backfill) — Done in 7K. 147 recipes updated.
- **P6-4** (PostCookFlow makeAgain/thoughts data gap) — Fixed in 7A.
- **P6-5** (notes/modifications duplication) — Fixed in 7A.
- **S1** (Visual linking for linked posts) — Superseded by 7I cook-post-centric feed.
- **S2** (Feed grouping for meals) — Superseded by 7I feedGroupingService rewrite.
- **P7-9** (Partner tagging on LogCookSheet) — Done in 7E Checkpoint 3.
- **P7-15** (CreateMealModal entry point audit) — Done in 7D Checkpoint 1.
- **P7-16** (Verify meal post visibility filter) — Done in 7D Checkpoint 2a.
- **P7-29** (GroupedMealCard) — Retired. Replaced by CookCard + CookLinkedGroup.
- **P7-58** (Remove 'meal' from PostType) — Done in 7I Checkpoint 7.
- **P7-60** (AddCookingPartnersModal interface extension) — Done in 7I Checkpoint 5.
- **P7-62** (Derived-stat recalculation on recipe_id change) — Deferred by design. Recipe link is non-editable on EditPostScreen (7M decision).
- **P7-64** (Unsaved-changes pattern) — Done in 7M Checkpoint 2. isDirty + confirmation dialog.
- **P7-65** (Book/friends icon fallback) — Emoji fallback accepted.
- **P7-66** (eater_ratings schema) — Partially addressed. eater_ratings via post_participants exists. Full schema is P7-32.
- **P7-67** (Phase 7I test harness) — Deleted in 7I Checkpoint 7 cleanup.
- **D3** (Cooking method architecture) — Partially addressed. `constants/cookingMethods.ts` created in 7M with canonical list matching DB CHECK constraint. Per-step technique tagging remains as P5-6.
- **P7-88** (Multi-photo select) — Done in 7N Checkpoint 2.
- **P7-85** (CommentsScreen keyboard) — Done in 7N Checkpoint 1.
- **P7-87** (Photo carousel peek) — Done in 7N Checkpoint 1.
- **P7-90** (CookDetail header title) — Done in 7N Checkpoint 1.
- **P7-97** (Star picker stay-open) — Done in 7N Checkpoint 2.
- **P7-98** (Inline engagement bar) — Done in 7N Checkpoint 2.
- **Feed card swipe reliability** — Done in 7N Checkpoint 2 (3-zone Pressable restructure).

---

## From: Phase 7F Fix Passes 7-9 + Phase 7I Planning Session (Apr 13, 2026)

**Note:** Most items from this section have been reconciled into the "From: Phase 7" section above. Remaining items that weren't covered by Phase 7 execution:

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-59 | Migration rollback path | 🔧 | ⚪ | Forward-only by design. Accepted tradeoff. |
| P7-61 | Leave event cascade behavior | 💡 | 🟡 | When user leaves meal event, should linked cook posts keep parent_meal_id? Currently yes. Revisit with F&F feedback. |

---

## From: Phase 6 — Cooking Mode v2 (Mar 19-24, 2026)

### High Priority (F&F blockers or near-term)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-1 | **Cooking time data backfill** | 📊 | 🔴 | Only 60/475 recipes have `prep_time_min`/`cook_time_min` data. Need AI-assisted backfill. |
| P6-2 | **CookingScreen simplification** | 🚀 | 🟡 | Too busy. Consider stripping to essentials, ClassicView as default. |
| P6-3 | **Multi-recipe cooking** | 🚀 | 🟡 | Cook dinner = protein + side + salad simultaneously. High-impact. |

### Medium Priority (polish + UX)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-6 | Rethink pantry fraction next to INGREDIENTS | 💡 | 🟡 | "4/14 in pantry" may confuse users. |
| P6-7 | Rethink "Add missing to Grocery List" button | 💡 | 🟡 | Current treatment may not be right. |
| P6-8 | Add timer options to step focus mode | 💡 | 🟡 | Start timers without entering cooking mode. |
| P6-10 | Ingredient tap-to-see-steps | 💡 | 🟡 | Show which steps use an ingredient. |
| P6-11 | Dedicated "Add a Note" modal | 💡 | 🟡 | Simple text area, NYT-style. |
| P6-12 | Read More inline fade effect | 💡 | 🟢 | NYT left-side fade. Current works fine. |
| P6-13 | Bold variance on ingredient names | 🔧 | 🟢 | Hard to fix perfectly. Low impact. |
| P6-14 | ⋮ overflow menu feel | 💡 | 🟢 | Consider native ActionSheet on iOS. |

### Lower Priority (v2 features)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-9 | Multi-recipe meal dashboard | 🚀 | 🟢 | Timers unified across recipes. |
| P6-15 | Wearable companion (WatchOS) | 🚀 | 🟢 | react-native-watch-connectivity. |
| P6-16 | Interleaved AI timeline | 💡 | 🟢 | AI merges steps across recipes. Moonshot. |
| P6-17 | Serving size adjuster | 🚀 | 🟢 | Non-linear baking edge cases. |
| P6-18 | Voice commands | 💡 | 🟢 | "Next step" / "Start timer". |
| P6-19 | Offline cooking | 💡 | 🟢 | Cache recipe locally. Significant scope. |
| P6-20 | Ingredient alternatives | 💡 | 🟢 | "Try X instead of Y". Needs data source. |
| P6-21 | Voice note transcription | 💡 | 🟢 | Placeholder exists. Actual transcription v2. |
| P6-22 | Timeline overview view mode | 🚀 | 🟢 | 3rd CookingScreen view option. |
| P6-23 | Post-cook photo upload | 🚀 | 🟢 | Placeholder button. Needs image picker. |
| P6-24 | Post-cook voice memo | 💡 | 🟢 | Placeholder button. Needs recording. |
| P6-25 | Post-cook partner tagging | 🚀 | 🟢 | Should connect to AddCookingPartnersModal. |
| P6-26 | "Mark as Cooked" + Rate on RecipeDetail | 💡 | 🟢 | NYT pattern. Log without cooking mode. |
| P6-27 | Clickable page references in step text | 💡 | 🟢 | Detect "see page 116" via regex. |
| P6-28 | Yield/servings display enhancement | 💡 | 🟢 | Add yield text from description. |
| P6-29 | Step quantities scale in instruction text | 🔧 | 🟢 | Quantities in prose don't update at 2x/3x. |
| P6-30 | RecipeDetail tab toggle | 💡 | 🟢 | INGREDIENTS/PREPARATION tabs. |
| P6-31 | Ingredient alternatives popup | 💡 | 🟢 | Needs data source. |

### Phase 6 Tech Debt

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-T1 | PanResponder → gesture handler upgrade | 🔧 | 🟡 | CookingScreen swipe. May conflict with scroll. |
| P6-T2 | Table-only recipes missing step text | 🔧 | 🟡 | 8 recipes with instructions=[] but text in instruction_steps. |
| P6-T3 | Android notification channel config | 🔧 | 🟢 | Not blocking iOS F&F. |
| P6-T4 | Blueberry Cornflake Crisp section name | 📊 | 🟢 | "Main" instead of descriptive. |
| P6-T5 | instruction_sections table redundancy | 🔧 | 🟢 | DB tables vs JSONB canonical. |
| P6-T6 | "Error getting pending count" toast | 🐛 | 🟢 | Not from Phase 6. Investigate separately. |

---

## From: Phase 5 — Ingredient Architecture (Mar 17-19, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P5-1 | `base_ingredient_id` wiring | 🔧 | 🟡 | Protein cuts, cheese dupes, salt variants. Systematic pass needed. |
| P5-2 | Gardening data (planting/growing months) | 📊 | 🟢 | Columns exist, populate later. |
| P5-3 | Recipe markup/editing review | 🔧 | 🟡 | Still clunky after Phase 6 modularization. |
| P5-5 | Difficulty score backfill | 📊 | 🟢 | Only 11 recipes scored. Haiku batch. |
| P5-6 | Technique tagging (B15) | 🚀 | 🟢 | Per-step technique tags. ~2,400 steps. |

---

## From: Phase 4 / Phase I — Cooking Stats Dashboard (Mar 2026)

### Data Gaps

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-1 | getMicronutrientLevels stubbed | 📊 | 🟡 | Needs USDA data import. |
| D4-2 | getTopNutrientSources for fiber/sugar/sodium | 📊 | 🟡 | Missing view columns. |
| D4-3 | totalTimeHours in getOverviewStats | 📊 | 🟡 | Needs recipe time join. Relates to P6-1. |
| D4-8 | Sparse ai_difficulty_score | 📊 | 🟢 | Only 11 scored. Relates to P5-5. |
| D4-4 | Cookbook recipe_count mismatch | 📊 | 🟢 | "Plenty" shows >100%. |

### Feature Gaps

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-26 | Frontier suggestions v2 | 🚀 | 🟡 | Partner-popular, seasonal, ingredient overlap. |
| D4-12 | Seasonal pattern tile taps | 🚀 | 🟢 | Tap → filtered RecipeList. |
| D4-13 | Diversity breakdown taps | 🚀 | 🟢 | Tap count → sub-section. |
| D4-14 | initialChefId filtering | 🚀 | 🟢 | Param declared, not consumed. |
| D4-15 | initialBookId filtering | 🚀 | 🟢 | Param declared, not consumed. |
| D4-16 | Ingredient drill-down filter | 🚀 | 🟢 | Needs recipe_ingredients join. |
| D4-17 | initialCookingMethod param | 🚀 | 🟢 | Maps to concept (imprecise). |
| D4-18 | StockUpCard grocery integration | 🚀 | 🟢 | Needs groceryService wiring. |
| D4-39 | Friends' stats comparison | 🚀 | 🟢 | Privacy + social design needed. |
| DI-2 | My Posts pagination | 🚀 | 🟢 | Limited to 30. Infinite scroll. |
| DI-3 | ActivityCard menu button wiring | 🚀 | 🟢 | No onPress handler. |
| DI-6 | Chart swipe for time navigation | 🚀 | 🟢 | More intuitive than arrow buttons. |

### Tech Debt

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-10 | Accessibility labels on stats | 🔧 | 🟡 | ~30 components. |
| D4-11 | Legacy MyPostsStackParamList cleanup | 🔧 | 🟢 | Type kept for 4 screens. |
| D4-21 | Entity name in ChefStats/BookStats | 🔧 | 🟢 | Both query name separately. |
| D4-37 | colors.text.quaternary fallback | 🔧 | 🟢 | GatewayCard uses tertiary. |
| DI-1 | Extract ActivityCard to shared component | 🔧 | 🟢 | Duplicated in 2 screens. |
| DI-7 | Avatar URL onError fallback | 🔧 | 🟢 | Transparent on fail. |

### Polish

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-25 | Gateway card sparklines | 💡 | 🟢 | |
| D4-27 | Podium recipe images | 💡 | 🟢 | |
| D4-28 | ConceptBubbleMap manual layout | 💡 | 🟢 | |
| D4-29 | CookingPersonalityCard gradient | 💡 | 🟢 | |
| D4-30 | Animated chart transitions | 💡 | 🟢 | |
| D4-33 | Chart↔calendar scroll-into-view | 💡 | 🟢 | |
| D4-35 | Podium cooking_concept emoji | 💡 | 🟢 | |
| D4-36 | Expand CONCEPT_EMOJI_MAP | 💡 | 🟢 | |
| D4-38 | Personality card loading skeleton | 💡 | 🟢 | |

---

## From: Nutrition Data Foundation Subproject (Feb 2026)

### Open Action Items

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| N1 | ~~Integrate subproject services into codebase~~ | 🔧 | ⚪ | **Phase 5A-3 audit resolved.** Existing `ingredientsParser.ts` is the active pipeline. |
| N2 | Import vitamins & minerals from USDA | 📊 | 🟡 | Only 7 macros imported. Full vitamin/mineral data available. Relates to D4-1. |
| N3 | Fill 10 unmapped USDA ingredients | 📊 | 🟢 | Gochujang, harissa, mirin, pomegranate molasses, za'atar, sumac, urfa pepper, aleppo pepper, silan, barberries. |
| N4 | Tag ~70 "for serving/garnish" ingredient rows | 📊 | 🟢 | ingredient_role = 'garnish' with nutrition_multiplier = 0. |
| N5 | Update extraction pipeline to output ingredient_role | 🔧 | 🟡 | New recipes should have role tagging from extraction. |
| N7 | Fix `form` column data quality | 📊 | 🟢 | "Black pepper" marked as "fresh", defaults unreliable. |

### Known Gaps (Accepted)

| # | Gap | Impact | Priority | Notes |
|---|-----|--------|----------|-------|
| NG1 | Canned goods use gross weight, not drained | ~20 rows overstated by ~60% | 🟡 | Need `drained_weight_ratio`. See Idea I1. |
| NG2 | Raw vs cooked nutrition | Grains/legumes/pasta ~2.5× overstatement | 🔴 | Interim fix: `cooked_ratio` applied. Real fix: extraction captures raw/cooked intent. See I6. |
| NG3 | "Plus more for dusting" quantities | Negligible calories missed | ⚪ | By design — uncapturable, nutritionally negligible. |
| NG4 | Size-range primary selection arbitrary | "5 small or 2 large" picks first option | 🟢 | Could use weight-equivalent midpoint. |
| NG5 | Thick/thin cut weight variance | Same g_per_whole for thick vs regular bacon | 🟢 | Prep text has "thick"/"thin" but not used in estimation. |
| NG6 | Materialized view requires manual refresh | Data not reflected until `SELECT refresh_recipe_nutrition()` | ⚪ | By design (D17). Tradeoff for query performance. |

### Idea Shelf

| # | Idea | Priority | Context |
|---|------|----------|---------|
| I1 | **Canned goods drained weight** — add `drained_weight_ratio` to ingredients. Typical: ~0.60 for beans/legumes. | 🟡 | Affects ~20 rows. Not blocking. |
| I2 | **Nutrition ranges for users** — show "350–420 cal/serving" instead of single number. Variance data already captured. | 🟢 | Would need downstream variance propagation. |
| I3 | **Cooking-method nutrition adjustments** — frying adds fat, boiling leaches nutrients. | 🟢 | Significant research needed for accurate factors. |
| I4 | **Competing nutrition estimates** — "USDA says X, Nutritionix says Y" side by side. | 🟢 | Needs second data source. |
| I5 | **Dual-source embedded metric merge** — embedded grams from quantity normalizer vs unit normalizer. | 🟢 | Resolves itself when pipeline is built. |
| I6 | **Raw vs cooked intent from extraction** — add `ingredient_state` field. | 🔴 | Single largest systematic calorie error source. ~30% of recipes. See NG2. |
| I7 | **Salt variant normalization** — "kosher salt" etc. → all nutritionally identical. | 🟡 | Affects 200+ rows. Relates to P5-1. |
| I9 | **USDA match validation layer** — sanity checks after matching. | 🟡 | Would have caught all 17 bad matches from Session 4. |

---

## From: Recipe Extraction Subproject (Jan 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| E1 | Extraction pipeline upgrade to v10+ | 🔧 | 🟡 | v10-2 deployed. Future upgrades should improve existing pipeline. |
| E2 | Gold standard expansion beyond Plenty | 📊 | 🟢 | All 16 verified recipes are Ottolenghi. Verify against other books. |

---

## From: Phase 3A Smart Recipe Browse (Feb 2026)

### Tier 1: Should Do Next

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B1 | Flavor profile system (recipe-level aggregation) | 🚀 | 🟡 | Ingredient-level flavor_tags exist, need recipe-level weighted aggregation. Deferred post-F&F. |
| B13 | Recipe rating UX | 🚀 | 🟡 | Without ratings, smart sections empty. Need prominent rating input. |

### Tier 2: Polish & Enhancement

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B10 | Flavor profile display | 🚀 | 🟡 | Depends on B1. Radar chart. Deferred post-F&F. |
| B5 | "Unknown Chef" cleanup | 🔧 | 🟢 | May be resolved by 7K backfill. Verify. |
| B8 | Click-to-see-friends modal | 🚀 | 🟢 | Needs query: given recipe_id, get posts from followed users. |
| — | Chevron tap target fix | 🐛 | 🟢 | UX issue flagged by Tom. |

### Tier 3: Larger Features

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B3 | Visual grid browse mode | 🚀 | 🟢 | Photo-first recipe browsing. Requires recipe images. |
| B2 | Personalized/learned recipe tags | 🚀 | 🟡 | Tags that adapt to user over time. Phase 11 territory. |

### Low Priority Data Quality

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B16 | Cuisine types quality improvement | 📊 | 🟢 | 35 recipes with empty cuisine_types. |
| B17 | Normalize cooking_methods values | 📊 | 🟢 | "mixing", "tossing" non-technique entries. |
| B18 | Cuisine authenticity / fusion tagging | 🚀 | 🟢 | Structured tags. Low priority. |

### B1 Detail: Flavor Profile System

**Reference:** Molly Baz's "Cook This Book" (pp. 46-47) — "Need Some Inspo?" flavor reference chart.

#### 7 Flavor Categories

**SWEET** — Granulated Sugar, Brown Sugar, Molasses, Honey, Maple Syrup, Apples, Pears, Dried Fruits, Cooked Onions, Stone Fruit, Berries, Bananas, Sweet Potatoes, Tropical Fruits, Carrots, Oranges, Ketchup, Hoisin Sauce, Jam or Jelly, Cooked Tomatoes, Winter Squash

**SALTY** — Salt, Anchovies, Olives, Capers, Fish Sauce, Soy Sauce, Miso Paste, Bacon, Parmesan Cheese, Pecorino Cheese, Feta Cheese, Cured Meats, Smoked Salmon, Clam

**BITTER** — Citrus Zest, Chocolate, Coffee, Amaro, Beer, Mustard Greens, Radicchio, Broccoli Rabe, Dandelion Greens

**UMAMI** — Parmesan Cheese, Piave Cheese, Cheddar Cheese, Walnuts, Fish Sauce, Mushrooms, Anchovies, MSG, Kimchi, Sardines, Oysters, Miso Paste, Cured Meats, Soy Sauce, Chicken Broth

**FATTY** — Heavy Cream, Crème Fraîche, Sour Cream, Cream Cheese, Butter, Nuts, Seeds, Avocado, Mortadella, Sausage, Cheese, Tahini, Olive Oil, Neutral Oil, Sesame Oil, Coconut Oil, Coconut Milk, Mayonnaise, Bacon, Lard, Yogurt, Schmaltz

**SPICY** — Fresh Chile Peppers, Ground Dried Chiles, Black Peppercorns, Szechuan Peppercorns, Fresh Ginger, Mustard, Mustard Seeds, Harissa Paste, Gochujang, Sambal Oelek, Chile Oil, Chile Crisp, Sriracha, Horseradish, Hot Sauce, Wasabi

**SOUR** — Vinegar, Lime, Lemon, Grapefruit, Buttermilk, Cottage Cheese, Yogurt, Wine, Pickles, Cornichons, Pickled Onions, Tomato, Sauerkraut, Kimchi

#### Key Design Notes
- Ingredients can have multiple flavor tags. Parmesan = salty + umami. Kimchi = umami + sour.
- Recipe flavor profile = aggregation of ingredient flavors, weighted by role (hero/supporting/garnish).
- Use cases: Browse by flavor, pairing suggestions, balance analysis, substitution guidance.

#### Implementation Path
1. Add `flavor_tags` column to `ingredients` table
2. AI-tag ~480 ingredients with 1-3 flavor categories
3. Compute recipe flavor profile (materialized view or query-time)
4. Add to recipe display (radar chart + filter dimension)
5. Extend Cooking Assistant

**Estimated effort:** 2 sessions

---

## From: SVG Icon Integration (Feb 26, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B20 | Counter storage location needs SVG icon | 🔧 | 🟢 | Still uses 🪴 emoji fallback. |
| B21 | Clean up old emoji icon constants | 🔧 | 🟢 | Dual system in constants/pantry.ts. |

---

## From: Data Seeding Session (Feb 26, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D3 | Cooking method/occasion/technique architecture | 🚀 | 🟡 | **Partially addressed in Phase 7M.** `constants/cookingMethods.ts` created with canonical list matching DB CHECK constraint. Per-post cooking method editing works. Per-step technique tagging (P5-6) and meal occasion vs method distinction still open. |

---

## From: Social / Meals Features (Nov-Dec 2025)

*(S1 and S2 resolved — see Phase 7 resolved items above)*

---

## From: Broader Roadmap

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| R1 | User dietary preferences table + settings UI | 🚀 | 🟡 | Needed for stats compliance % and recommendations. |
| R2 | Ingredient source tracking | 🚀 | 🟢 | "From garden" / "farmers market". Feeds stats. |
| R4 | Wearable integration research | 💡 | 🟢 | Apple Health / Fitbit. Future. |
| R5 | Recipe cost per serving | 🚀 | 🟢 | 229 ingredients have cost data. |
| R6 | Personal daily eating log / leftovers | 🚀 | 🟡 | Distinct from social feed. Post-F&F. |
| R7 | Recipe discovery feature | 🚀 | 🟡 | See `PHASE_RECIPE_DISCOVERY.md`. Post-F&F. |
| R8 | External participant retroactive claim | 🚀 | 🟢 | Schema supports it. Onboarding flow. |
| R9 | Concept cooking inline suggestions | 💡 | 🟢 | Phase 11 dependency. |

---

## Cross-Cutting Technical Debt

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| T3 | Schema change propagation discipline | 🔧 | 🟡 | Rule: ALTER TABLE on joined tables → grep sweep for RPCs, inline type logic, TS interfaces, related write paths. |
| T4 | **Relocate stray service files from `lib/` root into `lib/services/`.** FRIGO_ARCHITECTURE v4.0 documents all services under `lib/services/`, but 5 service files currently live at `lib/` root: `groceryListsService.ts` (461 lines), `groceryService.ts` (155), `pantryService.ts` (1,246), `searchService.ts` (455), `storeService.ts` (480). Move them to `lib/services/`, update all imports, confirm no other references. Also review `lib/ingredientsParser.ts` (755 lines) during the same pass — it may warrant a `lib/parsers/` or `lib/matching/` home rather than staying at `lib/` root. ~45 min. Surfaced during PK_CODE_SNAPSHOTS v1.1 tier inventory 2026-04-22. | 🔧 | 🟢 | Low urgency. Affects consistency and FRIGO_ARCHITECTURE accuracy; no runtime impact. Also: update `FRIGO_ARCHITECTURE.md` Directory Structure when files move. |
| T5 | **Delete deprecated `components/cooking/PostCookFlow.tsx`.** 221-line file explicitly marked DEPRECATED (merged into `LogCookSheet` 'full' mode April 2026). Still in repo. Confirm no remaining imports, delete file, commit. ~10 min. Surfaced during PK_CODE_SNAPSHOTS v1.1 tier inventory 2026-04-22. | 🔧 | 🟢 | Low urgency. Housekeeping only. |
| T6 | **Review `lib/oldTheme.ts` for deletion.** 151-line legacy theme constants file, "largely superseded by `lib/theme/`" per its own description but still referenced per the inventory note. Audit import graph; if fully dead, delete. If still referenced, migrate references to `lib/theme/` and then delete. ~20–30 min depending on reference count. Surfaced during PK_CODE_SNAPSHOTS v1.1 tier inventory 2026-04-22. | 🔧 | 🟢 | Low urgency. Code hygiene. |
| T7 | **Resolve `@ts-nocheck` pragma on `components/QuickAddSection.tsx`.** 546-line component carries `@ts-nocheck` at top, suppressing TypeScript errors. Disable the pragma, fix the surfaced type errors, re-enable strict checking. Unknown error count without running the check. Surfaced during PK_CODE_SNAPSHOTS v1.1 tier inventory 2026-04-22. | 🔧 | 🟡 | Type-safety gap. Medium priority — pragma masks real bugs; worth fixing before F&F. |

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-22 | 5.1 | Added T4 through T7: 4 cross-cutting cleanup items surfaced during PK_CODE_SNAPSHOTS v1.1 tier inventory (service relocation, deprecated-file deletion, legacy-theme audit, ts-nocheck resolution). |
| 2026-04-17 | 5.0 | **Phase 7 completion reconciliation.** Reconciled 42 deferred items from `PHASE_7_SOCIAL_FEED.md` into this doc. Resolved 20+ items (P5-4, P6-4, P6-5, S1, S2, P7-9, P7-15, P7-16, P7-29, P7-58, P7-60, P7-62, P7-64, P7-65, P7-66, P7-67, P7-85, P7-87, P7-88, P7-90, P7-97, P7-98, D3 partial, feed swipe). Added 17 infrastructure items, 13 detail polish items, 4 feed perf items, 30+ future sub-phase items from Phase 7. |
| 2026-04-09 | 4.3 | Phase 7F wireframe cross-references. |
| 2026-04-07 | 4.2 | Cross-cutting T3 added. |
| 2026-04-07 | 4.1 | Phase 7D scoping additions (R6-R9, S1/S2 update). |
| 2026-03-24 | 4.0 | Phase 5 + Phase 6 reconciliation. |
| 2026-03-17 | 3.0 | Phase 5A updates. |
| 2026-03-05 | 2.0 | Phase 4/I reconciliation. |
| 2026-03-02 | 1.0 | Doc overhaul. |
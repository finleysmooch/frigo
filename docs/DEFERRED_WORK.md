# FRIGO — Deferred Work & Action Items

**Last Updated:** April 22, 2026  
**Version:** 5.7  
**Canonical location:** Repo `docs/DEFERRED_WORK.md` (copy in Claude.ai project knowledge)

---

## How This Document Works

Items land here at **phase completion** after a reconciliation review. During active phase work, deferred items live in the active phase doc. When a phase completes, Claude.ai reviews those items: resolved items are dropped, items still relevant move here under a "From: Phase N" section, items not worth tracking are discarded.

This is the master backlog — the accumulated deferred work from all completed phases plus cross-cutting tech debt and roadmap ideas.

**Priority levels:** 🔴 High (affects accuracy/UX significantly), 🟡 Medium (would improve quality), 🟢 Low (nice to have), ⚪ By design (accepted tradeoff)

**Types:** 🐛 Bug/Gap, 💡 Idea, 🔧 Technical debt, 📊 Data quality, 🚀 Feature, 🧪 Testing

---

## From: Phase 8 — Pantry Intelligence Planning (April 23, 2026)

**Context:** Phase 8 planning wireframe session + first audit surfaced 11 post-F&F items and 2 tech debt items. Phase 8 execution in-scope items live in `PHASE_8_PANTRY_INTELLIGENCE.md`; items below are explicitly out-of-scope for v1 and parked here so they don't get lost.

### Open Action Items (post-F&F)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8-1 | Full accessibility audit across Phase 8 surfaces | 🔧 | 🟡 | Per-prompt verification covers tap target size (≥44×44pt) and accessibilityLabel presence during Phase 8 build. Full pass needs: VoiceOver focus order across StaplesGrid + Ingredient Detail + Freezer cleanout + recipe tap-sheet; screen reader announcements for state changes; color contrast audit for soft-tint state backgrounds; reduced motion support for re-sort animations; keyboard navigation where applicable. ~1-2 sessions post-launch. Surfaced 2026-04-23 first audit. |
| P8-2 | Brand discovery full UI (Ingredient Detail Brands tab v2) | 🚀 | 🟡 | F&F ships read-only Brands tab pulling from existing `grocery_list_items.brand_preference` + `size_preference` (user's own history + space members' history). Full community-scale discovery UI post-F&F: seek-out vs settle markers, how-long-preferred metrics, brand ratings, friends-first visibility, cross-space aggregation. 3-5 sessions. |
| P8-3 | Path B tracked-item staleness UI | 🚀 | 🟡 | Data foundation in 8A-CP1 (`last_confirmed_at` on pantry_items, `staleness_threshold_days` JSONB). UI post-F&F: stale-item surfacing pattern for tracked items (parallel to staples unknown-state), per-category threshold tuning UI. ~1 session. |
| P8-4 | Per-store grocery aisle overrides | 🚀 | 🟢 | v1 uses global `ingredients.typical_store_section` for aisle grouping. Post-F&F: per-store aisle layouts + "where you found it last time" memory. Depends on per-store data model (which grocery list = which store). |
| P8-5 | Smart (silent-automatic) cook-post depletion | 🚀 | 🟡 | Opt-in banner-after pattern in v1 (8B-CP4). Silent-automatic depletion post-F&F once matching confidence proven (probably 6-8 weeks of F&F data). |
| P8-6 | Category-level pantry matching | 🚀 | 🟢 | "Any cheese" / "any dried pasta" matching deferred to post-F&F user-configurable setting. |
| P8-7 | Quantity-aware pantry matching | 🚀 | 🟢 | "Recipe needs 4 eggs, I have 2" smart subtraction. v2 work. |
| P8-8 | Smart thaw-time calculation | 💡 | 🟢 | "4 lb chicken = 24h thaw time" helper on Thaw & plan flow (8C-CP7). v1 is manual. |
| P8-9 | Auto-schedule thawed items onto meal calendar | 🚀 | 🟢 | Phase 9 work — depends on meal calendar from Phase 9. |
| P8-10 | Conversational search refinement | 🚀 | 🟢 | Natural-language search (8E-CP2) is single-turn v1. Multi-turn ("actually make it under 30 min" as follow-up) post-F&F. |
| P8-11 | App-level voice recording for search | 💡 | 🟢 | v1 uses OS dictation (iOS/Android). In-app recording for custom processing post-F&F. |
| P8-12 | ManageStaples section headers | 🟢 | post-F&F | Current-staples list on ManageStaplesScreen is flat — at 20+ staples it'll get hard to scan. Add section dividers — grouping by first-letter OR state (good/low/out/unknown) OR ingredient.category TBD. Post-F&F polish; not blocking pantry loop. Surfaced by Tom during 8B-CP3a smoke test. |

### Tech Debt surfaced by Phase 8 planning

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8-T1 | CLAUDE.md references `lib/theme.ts` as single file, but theme is a folder `lib/theme/` | 🔧 | 🟢 | Discovered during first audit of Phase 8 prompts. Low urgency — doesn't affect runtime, just doc accuracy. ~5 min fix. |
| P8-T2 | `P5-1 base_ingredient_id` audit pass (scheduled for 8D-CP1) may surface a larger data backfill need | 📊 | 🟡 | 8D-CP1 runs query-and-report; if gap is large (protein cuts, cheese dupes, salt variants per P5-1 deferred item), spawns separate data-backfill CC prompt. Track here so the potential scope doesn't vanish. |

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
| P7-44 | Feed infinite scroll (pagination) | 🚀 | 🔴 | Hard-capped at 200 dishes. Needs onEndReached pagination. **Scheduled: Phase 7P** (per FF_LAUNCH_MASTER_PLAN v6.0). |
| P7-74 | hydrateEngagement perf | 🔧 | 🟡 | ~1.0s steady-state. Likely N+1 pattern. |
| P7-75 | Batched getMealEventsByIds | 🔧 | 🟢 | N×4 round trips → 2-3 batched. |
| PL-H1 | `highlightsService` batched RPC / materialized view (cold-path bottleneck) | 🔧 | 🟡 | Cold-path `hydrate:highlights` measured at ~2.6s on 200-post batch in 7P-1 testing. Per-post `computeSoloAuthorSignal` fires one `posts`-table query per card. 7P-2 pagination mitigates to ~390ms on 30-post page (D7P-8), but real fix is a single SQL rollup — either a batched RPC or materialized view. Service source already flags this. Deferred to post-launch per D7P-8. |
| DQ-1 | Orphaned `parent_meal_id` on posts | 🐛 | 🟢 | _(Cross-cutting: data-integrity issue surfaced via feed rendering; not strictly a feed-perf item, but filed here since no Phase 7 data-quality subsection exists.)_ Posts reference deleted `meal_events` via `parent_meal_id`. `feedGroupingService.buildFeedGroups` logs `linked_meal_event group without mealEventContext` warnings at render time when an orphaned post is encountered. 3 confirmed orphans hit on page 4 of the 7P-2 pagination device test; count may grow over time. Needs (a) cleanup script nulling `parent_meal_id` where the referenced `meal_events` row no longer exists, (b) optional FK constraint or trigger preventing recurrence. Not F&F-blocking — warnings are log-only; feed rendering degrades gracefully. |

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
- **P7-45** (Pull-to-refresh investigation) — **RESOLVED 2026-04-22 in Phase 7P-2** via P7-44 pagination. 7P-1 instrumentation measured cold load at 5.3s on the 200-post batch (2.6s in `computeHighlightsForFeedBatch` cold path). 7P-2 pagination cut the per-load batch to 30 posts, bringing cold page-1 load to 2888ms and paginated page loads to 1913-2967ms — all under D7P-2's 3s threshold. Original 15s hang report partially unexplained; likely combination of dev-mode StrictMode double-invoke, network variance, and per-device cold-start overhead. Post-launch follow-up tracked as PL-H1 (highlightsService SQL rollup).

---

## Pre-launch deferrals (2026-04-22 — master plan v6.0 scope cuts)

The following items were in or adjacent to pre-launch scope and were explicitly moved to post-launch during the 2026-04-22 FF_LAUNCH_MASTER_PLAN v6.0 refresh. They live here rather than in phase-specific deferred sections because they were cut at the master-plan level, not by any individual phase.

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| DEF-4/22-1 | Edit Mode full redesign | 🚀 | 🟡 | Notebook aesthetic, structural ingredient editing (separate quantity vs ingredient), drag handles for sections, "or" substitution syntax. MVP banner + Exit button from 7B-Rev stands as sufficient pre-F&F. |
| DEF-4/22-2 | NYT Cooking integration | 🚀 | 🔴 | **Top-of-queue post-launch priority.** Tom's annotation: "would be awesome if we could get that shipped at or soon after F&F launch." Scope-first approach retained (1 session to investigate before committing build sessions). |
| DEF-4/22-3 | Receipt scanning | 🚀 | 🟢 | Flagged as "if easy" during 4/22 review; real effort 3-5 sessions (OCR + item parse + pantry matching UX). Revisit post-launch. |
| DEF-4/22-4 | Recipe comments knowledge base system (#30) | 🚀 | 🟢 | Community-shared notes, tips, substitutions per recipe. Needs moderation thinking, display UX, threading. F&F is the right moment to learn what users actually want before building. |

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

## Process hygiene

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| PH-1 | PROCESS_WATCHPOINTS W1-W8 review pass | 🔧 | 🟢 | All eight watchpoints W1 through W8 are currently Observing; most predate the Phase 7P retrospective and have accumulated limited observations. A ~30-minute walk-through should decide each one's outcome per the new review-trigger outcome discipline rule (PROCESS_WATCHPOINTS §Review cadence, v1.4 2026-04-22): **graduate** (promote the mitigation to a DOC_MAINTENANCE_PROCESS rule), **close** (retire if the concern didn't materialize), or **explicitly extend** the observation window with a new review trigger. Not F&F-blocking; candidate for Phase 8 kickoff housekeeping or a cross-cutting session once Phase 8A is actively in progress. W9 + W10 (added same session) are too new for this pass — they have their own review triggers tied to Phase 8 completion / next diagnostic sub-phase. |

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-23 | 5.7 | Added P8-12 (ManageStaples section headers, post-F&F polish). |
| 2026-04-23 | 5.6 | Phase 8 planning reconciliation. Added 11 post-F&F items surfaced during Phase 8 wireframe session + first audit (P8-1 through P8-11) and 2 tech debt items (P8-T1, P8-T2). Full accessibility audit deferred as P8-1; brand discovery UI scope consolidated as P8-2. New section `## From: Phase 8 — Pantry Intelligence Planning (April 23, 2026)` inserted above the Phase 7 section per reverse-chronological phase order. |
| 2026-04-22 | 5.5 | New row PH-1 tracking PROCESS_WATCHPOINTS W1-W8 review pass (per the new outcome-discipline rule added to PROCESS_WATCHPOINTS v1.4). Placed under new `## Process hygiene` subsection (no prior home for process-hygiene items existed). |
| 2026-04-22 | 5.4 | P7-45 marked resolved (D7P-2 threshold met via Phase 7P-2 pagination). PL-H1 priority 🟢 → 🟡. DQ-1 added tracking orphaned `parent_meal_id` (3 confirmed during 7P-2 Test A). |
| 2026-04-22 | 5.3 | PL-H1 added — highlightsService batched RPC / materialized view (post-launch, per D7P-8 from Phase 7P planning). |
| 2026-04-22 | 5.2 | **Post-v6 master plan reconciliation.** Tagged P7-44 and P7-45 as Phase 7P scheduled targets. Added new "Pre-launch deferrals (2026-04-22)" section with 4 items: Edit Mode full redesign, NYT Cooking (top-of-queue), Receipt scanning, Recipe comments KB. No priority re-tagging; no removals. |
| 2026-04-22 | 5.1 | Added T4 through T7: 4 cross-cutting cleanup items surfaced during PK_CODE_SNAPSHOTS v1.1 tier inventory (service relocation, deprecated-file deletion, legacy-theme audit, ts-nocheck resolution). |
| 2026-04-17 | 5.0 | **Phase 7 completion reconciliation.** Reconciled 42 deferred items from `PHASE_7_SOCIAL_FEED.md` into this doc. Resolved 20+ items (P5-4, P6-4, P6-5, S1, S2, P7-9, P7-15, P7-16, P7-29, P7-58, P7-60, P7-62, P7-64, P7-65, P7-66, P7-67, P7-85, P7-87, P7-88, P7-90, P7-97, P7-98, D3 partial, feed swipe). Added 17 infrastructure items, 13 detail polish items, 4 feed perf items, 30+ future sub-phase items from Phase 7. |
| 2026-04-09 | 4.3 | Phase 7F wireframe cross-references. |
| 2026-04-07 | 4.2 | Cross-cutting T3 added. |
| 2026-04-07 | 4.1 | Phase 7D scoping additions (R6-R9, S1/S2 update). |
| 2026-03-24 | 4.0 | Phase 5 + Phase 6 reconciliation. |
| 2026-03-17 | 3.0 | Phase 5A updates. |
| 2026-03-05 | 2.0 | Phase 4/I reconciliation. |
| 2026-03-02 | 1.0 | Doc overhaul. |
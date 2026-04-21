# Phase 7 Doc Updates — Post Phase 7I Closeout

**Purpose:** This file contains all pending updates to `docs/PHASE_7_SOCIAL_FEED.md` that accumulated during the Phase 7I Checkpoint 4-7 execution sessions (2026-04-14 through 2026-04-15). These updates were tracked in Claude.ai working docs but never pasted to the repo. Apply them in one batch.

**Instructions for the next Claude.ai instance or for Tom:**
Copy each section below into the corresponding section of `PHASE_7_SOCIAL_FEED.md`. The line numbers reference the current file structure. Alternatively, hand this file to a Claude Code instance with the instruction "apply all updates from this file to docs/PHASE_7_SOCIAL_FEED.md."

---

## 1. Decisions Log additions (add after D47 row, before the `---` separator)

These three decisions were made during Phase 7I Checkpoints 5-6 execution.

| # | Decision | Rationale | Date | Source |
|---|----------|-----------|------|--------|
| D49 | **Same-author multi-dish collapse within meal events.** When an author contributed multiple dishes to one meal event, same-author dishes can collapse into a compressed renderer within a linked meal event group. Collapse is per-author, not all-or-nothing: Mary+Mary+Andrew → D49(Mary collapsed) + solo(Andrew). Engagement attaches at the meal-event level. **Implementation timing:** the D49 renderer was NOT built in Checkpoints 5-6. It was deferred to its own focused checkpoint because (a) it adds significant scope (new grouping primitive + card renderer + feed-level rendering), and (b) D51 resolved the schema coupling that previously motivated bundling it with Checkpoint 6. D49 can now ship independently whenever. | Per-author collapse is more natural than all-or-nothing; engagement at meal-event level avoids splitting likes across duplicate cards. | 2026-04-14 | Tom — Phase 7I Checkpoint 5 planning |
| D50 | **No-image state rendering across photo surfaces.** Context-specific: feed cards collapse the photo slot entirely when all photos fail or are absent; detail screens (CookDetailScreen, MealEventDetailScreen, RecipeDetailScreen) render `NoPhotoPlaceholder` (light grey bg, centered BookIcon at 48px, "No photo yet" label). Retroactive across all surfaces. `NoPhotoPlaceholder` is a shared primitive in `sharedCardElements.tsx`. `PhotoCarousel` extended with `failedIndices` state + `onError` callback; `visibleCount === 0` early-return composes with the feed card's empty-photos branch. | Avoids broken image icons; gives users a clear signal that no photo exists rather than rendering a blank space. | 2026-04-14 | Tom — Phase 7I Checkpoint 4.5 verification |
| D51 | **Meal-event-level engagement uses existing infrastructure.** Meal-event-level likes and comments use the existing `post_likes` and `post_comments` tables with the meal_event post's ID as the target. No new engagement tables or columns needed. The meal_event row IS a post (it's in `posts` with `post_type='meal_event'`), so the existing engagement infrastructure works without modification. This applies to Checkpoint 6's L7 "About the evening" comment section and the future D49 renderer's engagement row. **Resolves the schema-coupling concern that previously linked D49 to Checkpoint 6 — D49 can now ship independently.** | Simplest viable approach; avoids new tables; leverages existing comment/like services without modification. | 2026-04-15 | Tom — Phase 7I Checkpoint 6 planning |

---

## 2. Build Phases table — update 7I status

Find the 7I row in the Build Phases table (currently says `🔲 Planning complete, build ready`). Replace the status with:

```
✅ Complete (Checkpoints 1-7 shipped 2026-04-13 through 2026-04-15, plus 3 fix passes)
```

---

## 3. Deferred Items — new section after "Doc maintenance debt surfaced 2026-04-09"

Add this entire section before the "Resolved during Phase 7" section.

### From Phase 7I Checkpoints 4-7 (2026-04-14 / 2026-04-15)

> **Numbering note:** CC wrote P7-80 through P7-84 to the repo during Checkpoint 5 Pass 2 closeout, and D49/D50/D51 during Checkpoint 5/6 closeouts. However, the project knowledge copy used by Claude.ai planning sessions didn't reflect those writes. P7-72 through P7-79 were captured in Claude.ai working docs during Checkpoint 4/4.5 but never pasted. P7-85 through P7-102 accumulated during Checkpoints 5-7 verification feedback. All items are now consolidated here with reconciled numbering. Items P7-93 through P7-95 were allocated during Checkpoint 6 planning; CC independently used the same numbers for different items in the SESSION_LOG — this table uses the Claude.ai allocations as canonical and CC's items are renumbered to P7-100 through P7-102.

#### Infrastructure / data cleanup

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-72 | Recipe image filename normalization | 🔧 | 🟡 | ~347 storage files have uppercase or double-extension filenames (e.g., `.JPG`, `.jpeg.jpg`). Rename to canonical lowercase single extension + update `recipes.image_url`. Also fix upstream cookbook extraction pipeline. |
| P7-73 | posts.photos jsonb shape normalization | 🔧 | 🟡 | Column contains mix of string-array (`["url1", "url2"]`) and object-array (`[{url, caption, order, is_highlight}]`) forms. CookCardInner handles both defensively (CP 4.5 Approach B) but data should be normalized and write paths audited. |
| P7-76 | console.time Metro issue | 🔧 | 🟢 | `console.time`/`console.timeEnd` doesn't surface to Metro stdout (LogBox filters them). Manual `Date.now()` workaround confirmed working. |
| P7-79 | Storage/DB reference integrity audit | 🔧 | 🟡 | 173 recipes have potentially broken URL patterns. At least 1 confirmed stale (Purple Sprouting Broccoli returns 404 on Supabase Storage). Need HEAD-check script to identify all broken refs. |
| P7-92 | getPendingApprovalsCount network errors | 🐛 | 🟡 | Pre-existing `TypeError: Network request failed` in `postParticipantsService.ts`. Surfaces during testing but not caused by any Phase 7I checkpoint. |
| P7-100 | Migrate Meals-tab callers from MealDetailScreen to MealEventDetailScreen | 🔧 | 🟡 | Four screens still route to legacy `MealDetail`: MyMealsScreen, MyPostDetailsScreen, MyPostsScreen, RecipeDetailScreen. Once migrated, `MealDetailScreen.tsx` and its route registration can be deleted. Surfaced in CP7. |
| P7-101 | MyMealsScreen + EditMealModal stale post_type='meal' queries | 🐛 | 🟡 | Fixed in CP7 (changed to 'meal_event'). These were silently returning empty since CP1 migration on 2026-04-13. Meals tab was broken for ~2 days. Flag in F&F release notes. |
| P7-102 | PostActionMenu.tsx cleanup | 🔧 | 🟢 | Still referenced by legacy MyPostDetailsScreen + MyPostsScreen. Delete after those screens migrate to CookDetailScreen. |

#### Feed performance

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-74 | hydrateEngagement perf investigation | 🔧 | 🟡 | ~1.0s steady-state across 4 parallel queries. Leading hypothesis: `computeHighlightsForFeedBatch` per-post lookups or `loadParticipantsForPosts` N+1 pattern. |
| P7-75 | Batched getMealEventsByIds | 🔧 | 🟢 | Currently ~1.15s from N×4 round trips in `prefetchPreheadContext`. Batched variant reduces to 2-3 round trips. Expected loadFeed ~3.3s → ~2.5s. |

#### CookDetailScreen polish (→ Phase 7N)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-80 | Cook/prep time split on Block 8 stats grid | 🚀 | 🟢 | Currently shows aggregate `recipe_cook_time_min` (sum of cook + prep per Invariant 1). Splitting requires extending `CookCardData` with separate fields. |
| P7-81 | Highlights descriptive paragraph | 🚀 | 🟢 | Extend `Highlight` data model with `longText` field for richer Block 9 content. Currently pill-only after fix pass stripped redundant echo. |
| P7-82 | Author location line on Block 3 | 🚀 | 🟡 | Post-row data doesn't carry geo info. Location line omitted on Block 3 author block. Feed card hardcodes "Portland, OR" as placeholder. |
| P7-83 | CommentsScreen extraction for inline rendering | 🔧 | 🟢 | Extract ~400 lines of comment rendering from CommentsScreen into a reusable `<CommentList>` component for inline display on detail screens. |
| P7-84 | Pending cook partner visibility for post author | 🚀 | 🟡 | Author currently has no way to see pending sous_chef invitations on their own post. Need muted row showing "Pending: [name]" with cancel action. `status='pending'` is correct approval-gated behavior. |
| P7-85 | CommentsScreen keyboard avoidance | 🐛 | 🟡 | Text input hidden behind keyboard when opened from CookDetail/MealEventDetail tap-through. Pre-existing issue. Fix: `KeyboardAvoidingView` wrapper with `behavior='padding'` on iOS. |
| P7-87 | Photo carousel peek | 🚀 | 🟢 | Show edges of adjacent slides so users know there are more to swipe. Both feed cards and CookDetailScreen. Adjust width to ~85-90% of screen width with horizontal padding. |
| P7-88 | Multi-photo select from library | 🚀 | 🟢 | `expo-image-picker` `allowsMultipleSelection: true`. Currently single-select only. |
| P7-89 | CookDetailScreen inline photos layout | 🚀 | 🟢 | Remove separate "Photos" block (Block 12), render thumbnails inline after highlights. Reduces redundancy with hero carousel. |
| P7-90 | CookDetailScreen title in header bar | 🚀 | 🟢 | Move title from Block 4 into the nav header, replacing generic "Cook" text. Matches Strava's activity detail pattern. |
| P7-91 | "Create event" option in meal event picker | 🚀 | 🟢 | Add "Create new meal event" row to the Change meal event inline picker on CookDetailScreen. |
| P7-96 | CookDetailScreen "Your rating" label fix + eater rating on CookDetail | 🚀 | 🟡 | Block 8 "Your rating" → "[Author]'s rating" when viewing someone else's post. Add eater rating affordance on CookDetailScreen for viewers tagged as `ate_with` for the linked meal event. Two parts: label fix + new affordance. |
| P7-98 | Inline engagement bar (not sticky) on both detail screens | 🚀 | 🟡 | Move engagement bar from `position: absolute` bottom to inline within scroll content. MealEventDetailScreen: after "What everyone brought." CookDetailScreen: after comments. |

#### MealEventDetailScreen polish (→ Phase 7N)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-93 | Half-star eater ratings | 🚀 | 🟢 | Change eater_ratings from integer 1-5 to half-star resolution (0.5 increments). Build scrollable star component matching personal rating UX. Requires DDL alter on `eater_ratings.rating` column. |
| P7-94 | Eater rating privacy label | 🚀 | 🟢 | "Your rating" label with eye-slash icon or "?" info tooltip explaining D43 private-per-eater visibility rule. |
| P7-95 | Shared media thumbnail tap-through | 🚀 | 🟢 | Full-screen viewer modal or scroll-hero pattern for Block 7 shared media thumbnails. Currently render-only. |
| P7-97 | Star picker stay-open behavior | 🚀 | 🟢 | Eater rating star picker should stay open until dismissed (tap elsewhere or close button), not auto-close on star selection. Current auto-close is disorienting. |
| P7-99 | Highlight picker section headers | 🚀 | 🟢 | Split dual-pool grid into "From shared media" and "From dishes" section headers for clearer affordance. |

#### Feed polish (→ Phase 7N)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| Feed card photo swipe reliability | 🐛 | 🟡 | Gesture handler tuning — distinguish tap (navigate to CookDetail) from horizontal swipe (carousel scroll) inside CookCard's outer Pressable. Pre-existing finicky behavior, not a CP5 regression. |

#### EditMedia redesign (→ Phase 7M)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-86 | EditMedia Strava-style redesign | 🚀 | 🟡 | Drag-to-reorder with hamburger handles, triple-dot per-photo menu for highlight/delete, + button at top. Current grid layout wastes space. |

---

## 4. CC Prompts Issued — new rows (add after the existing 7E rows)

| Date | Sub-phase | Prompt | Outcome |
|------|-----------|--------|---------|
| 2026-04-13 | 7I Checkpoint 1 | SQL migration `post_type='meal'` → `'meal_event'`. See `CC_PROMPT_7I_CHECKPOINT_1_MIGRATION.md`. | ✅ Complete |
| 2026-04-13 | 7I Checkpoint 2 | Services layer: cook partner links, meal event queries, feed grouping. See `CC_PROMPT_7I_CHECKPOINT_2_SERVICES.md`. | ✅ Complete |
| 2026-04-14 | 7I Checkpoint 3 | CookCard + grouping primitives + test harness. See `CC_PROMPT_7I_CHECKPOINT_3_COOKCARD.md`. | ✅ Complete |
| 2026-04-14 | 7I Checkpoint 3.5 | Shared-recipe merged groups (D48). Inserted between CP3 and CP4. | ✅ Complete |
| 2026-04-14 | 7I Checkpoint 4 | FeedScreen rewrite. See `CC_PROMPT_7I_CHECKPOINT_4_FEEDSCREEN.md`. | ✅ Complete |
| 2026-04-14 | 7I Checkpoint 4.5 | Photo rendering fix pass (3 fixes). | ✅ Complete |
| 2026-04-14/15 | 7I Checkpoint 5 | CookDetailScreen (L6) + narrow-scope editing. Two-pass. See `CC_PROMPT_7I_CHECKPOINT_5_COOKDETAIL.md`. | ✅ Complete (Pass 1 + Fix Pass #1 + Pass 2 + Fix Pass #2) |
| 2026-04-15 | 7I Checkpoint 6 | MealEventDetailScreen (L7) + eater_ratings + host/attendee editing. Two-pass. See `CC_PROMPT_7I_CHECKPOINT_6_MEALEVENTDETAIL.md`. | ✅ Complete (Pass 1 + Pass 2) |
| 2026-04-15 | 7I Checkpoint 7 | Cleanup + deletion. Single-pass. See `CC_PROMPT_7I_CHECKPOINT_7_CLEANUP.md`. | ✅ Complete |

---

## 5. Changelog — new entries (add at the end of the Changelog table)

| Date | Change |
|------|--------|
| 2026-04-13 | **Phase 7I planning session + D47 supersession.** Cook-post-centric feed model replaces D44's M3/G4rr-b framing. 7 checkpoint structure defined across 2 waves. Wireframes L1-L7 locked in `frigo_phase_7i_wireframes.html`. Master plan created as `PHASE_7I_MASTER_PLAN.md`. D47 supersedes D44 and partially supersedes D41/D45/D46. Scope expanded later same day to include narrow-scope editing in Wave 2 CPs 5-6. Phase 7M added as new sub-phase for full Strava-style Edit Activity screen. |
| 2026-04-13/14 | **7I Wave 1 complete (Checkpoints 1-4 + 4.5).** CP1: SQL migration. CP2: services layer (cookCardDataService, feedGroupingService rewrite, mealService extensions). CP3: CookCard component + grouping primitives + test harness. CP3.5: shared-recipe merged groups (D48). CP4: FeedScreen rewrite (~980 lines, CookCardData model, 4-type group dispatch). CP4.5: photo rendering fix pass (posts.photos normalization, optimizeStorageUrl guard). Feed is live with the new cook-post-centric model. |
| 2026-04-14/15 | **7I Wave 2 complete (Checkpoints 5-7).** CP5: CookDetailScreen (L6) with 14 content blocks + 6 narrow-scope editing items (add photos, edit title/desc, manage partners, change meal, delete). D49 (same-author collapse nav contract), D50 (no-image state). CP6: MealEventDetailScreen (L7) with 8 content blocks + eater_ratings schema + host editing (6 items) + attendee editing (3 items). D51 (meal-event engagement via existing infrastructure). CP7: delete PostCard/MealPostCard/LinkedPostsGroup, remove test harness, PostType union cleanup (fixed latent Meals tab bug from CP1 migration), AuthorView audit (functional), FRIGO_ARCHITECTURE.md v3.2 update. |
| 2026-04-15 | **Phase 7I formally closed.** All 7 checkpoints + 3 fix passes shipped. Cook-post-centric feed model fully implemented. Next: 7G → 7H → 7N (detail screen polish, formerly CP 5.5) → 7M (full Edit Cook screen). |

---

## 6. Current Work section — update

Replace the content of the "Current Work" section with:

### Phase 7I — COMPLETE (2026-04-15)

Phase 7I closed after Checkpoint 7. All deprecated components deleted, test harness removed, architecture doc updated. See Phase 7I Closeout Statement in SESSION_LOG.

### Next up

Execution order for remaining Phase 7 work:
1. **7G** — Historical cook logging (backdated posts). 1-2 sessions.
2. **7H** — My Posts in You tab. 1 session.
3. **7N** — Detail screen polish + feed carousel UX (formerly "Checkpoint 5.5"). 1-2 sessions. Scope: P7-85, P7-87-91, P7-93-99, feed card swipe reliability.
4. **7M** — Full Edit Cook screen (Strava Edit Activity pattern). 3-5 sessions. Replaces narrow-scope editing scaffolding from CP5/CP6.
5. **7J** — Recipe sharing. 2-3 sessions.
6. **7K** — Chef attribution backfill. 1-2 sessions.
7. **7L** — Settings + visibility. 2-3 sessions.

### Key legacy items from Checkpoint 7

- `MealDetailScreen.tsx` kept but deprecated — still referenced by 4 Meals-tab screens (see P7-100)
- `PostActionMenu.tsx` kept — still referenced by MyPostDetailsScreen + MyPostsScreen (see P7-102)
- `console.warn` instrumentation on CookDetailScreen + MealEventDetailScreen left in place for dogfooding; removes with 7M
- Stale `post_type='meal'` queries in MyMealsScreen + EditMealModal fixed (P7-101)

---

## 7. Doc maintenance process update

Add this note to `DOC_MAINTENANCE_PROCESS.md` (or include in the next CC prompt):

> **Console.warn instrumentation pattern (added 2026-04-15):** When CC ships editing/mutation affordances (overflow menu items, inline edits, modal-driven writes), it should add temporary `console.warn` instrumentation that logs operation name, key inputs, and success/failure result with a `[ScreenName]` prefix. This enables Tom to see what happened during on-device testing without needing to reproduce bugs from code-reading alone. Instrumentation is removed during cleanup passes (e.g., Checkpoint 7) or when 7M replaces the editing scaffolding.
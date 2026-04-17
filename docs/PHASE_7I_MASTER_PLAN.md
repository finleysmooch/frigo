# PHASE 7I — Cook-Post-Centric Feed Rebuild

**Status:** Planning complete, build ready to start at Checkpoint 1.
**Supersedes:** D44 (M3 architecture + G4rr-b grouped meal pattern), partially supersedes D41/D45/D46 — see "Supersession Notes" below.
**Scope:** Architectural rebuild of the feed rendering model. Every feed unit becomes a solo "cook" post; meal events become detail-screen-only connective-tissue records. Linked groups render as indented stacks with a left gutter connector line, Strava-style.

---

## ⚠️ Important supersession context

This plan is the result of a planning session on **April 13, 2026** that re-opened decisions made during the **April 9 Phase 7F wireframe session** (D41, D44, D45, D46). Per Tom's explicit instruction during the 4/13 session: **where 4/13 decisions conflict with 4/9 decisions, 4/13 wins.**

**What changed between 4/9 and 4/13:** On 4/9, D44 locked the G4rr-b grouped meal pattern (meal-summary header with its own engagement row + indented contributor sub-cards) as the visual target for 7I. On 4/13, Tom hit a mental block trying to reconcile individual cook voice vs. meal event context in the feed. The resolution was not a refinement of G4rr-b — it was a different architectural direction: **retire the meal-summary feed card entirely**, make every feed unit a solo cook post, and relocate meal event content to a detail-only screen.

D44's framing assumed meal events would continue to have a "summary surface" in the feed. 4/13 eliminates that summary surface. The visual primitives (Strava indent + gutter connector) carry over; the data model and card structure do not.

## Supersession notes (decisions partially or fully superseded)

Read these alongside the corresponding entries in `PHASE_7F_DESIGN_DECISIONS.md`. Each decision stays in the record for traceability; this section states what's been overwritten.

### D44 — Fully superseded
- **Was:** M3 architecture with each meal participant owning their own post FOR the meal; grouped meals render as meal-summary header + contributor sub-cards (G4rr-b).
- **Is:** Every cook post is a first-class standalone unit authored by one person. Posts are linked via cook partner relationships OR meal event references, but the linked group has NO meal-summary card — only a thin tappable group header. Meal events live only on the MealEventDetailScreen (L7 wireframe).
- **What survives:** the Strava-style indent + gutter connector visual (L3b and L5 wireframes). The *algorithm* for grouping connected posts (union-find) is still applicable.
- **What's retired:** the GroupedMealCard component (P7-29 superseded), the meal-summary header with its own engagement row, the "Started by" footnote, and the two-level photo model's role of "meal-summary shows meal photos" (D46 partial).

### D41 — Partially superseded
- **Was:** Comments dual-attached (meal-level OR dish-level), both rendered on the meal detail card with attribution chips.
- **Is:** The two-section separation of meal-level vs. dish-level comments still exists, but the two sections now live on *different screens*: dish-level comments live on the CookDetailScreen (L6), meal-level comments live on the MealEventDetailScreen (L7) in the "About the evening" section. The attribution-chip UI is gone because the two surfaces are now independent.
- **What survives:** The data model is unchanged (comments can still attach to any `posts.id`, now including `posts.id` where `post_type='meal_event'`). The notification tiering from D42 (meal-level rolled up, dish-level individual) still applies.

### D45 — Effectively superseded
- **Was:** Multi-cook meal cards show a cooked-vs-ate byline split — "Cooked by Tom, Nick & Mary" with avatar stack of cooks only, eaters in sub-line.
- **Is:** Every cook card has exactly one author with a single avatar. Eater attribution moves entirely to the meal event detail screen's "At the table" section. There's no longer a multi-cook meal card to show a split byline on.
- **What survives:** The `post_participants` role distinction (`host`/`sous_chef`/`ate_with`) is still meaningful, but its UI interpretation shifts. `sous_chef` now means "cook partner on this specific cook post" (L3b pattern). `ate_with` now means "meal event attendee, not a cook" (surfaces on L7 only).

### D46 — Partially superseded
- **Was:** Two-level photo model — meal photos (shared bucket, multi-uploader) for meal-summary cards, dish photos for individual dish posts. Meal-summary header shows meal photos.
- **Is:** No meal-summary card exists, so meal photos never render in the feed. The `meal_photos` table survives as the **shared media pool on the MealEventDetailScreen** (L7). Cook cards show their own `posts.photos` only.
- **What survives:** The `meal_photos` table. The "LogCookSheet uploads default to meal_photos when meal context is present" flow still makes sense as a pre-population of the shared media pool. The `is_highlight` flag on `posts.photos` still serves as "host's chosen highlight photo" for the L7 hero.

### D43 — Unchanged
- Eater ratings schema (α) and privacy model (ζ) carry over cleanly. Each L7 dish row shows the viewer's private rating or "Tap to rate." Private-per-eater enforcement rule is unchanged.

### D42 — Unchanged
- Notification tiering is unchanged. Already deferred to its own sub-phase; not in 7I scope.

---

## The One-Paragraph Summary

Phase 7F rebuilt the feed cards to match the K-series wireframes with meal cards as first-class feed units. Phase 7I **retires meal cards from the feed entirely**. Under the new model, every feed unit is a "cook" — a solo post authored by one person with 1 or more dishes. Posts can link to other cook posts via cook-partner relationships (co-cooking) or to meal event records (shared dinners). Linked cook posts render as indented stacks with a thin gray connector line in a left gutter, Strava-style. Meal events become first-class entities with their own detail screen but never appear as feed cards. The L6 CookDetailScreen and L7 MealEventDetailScreen replace the current RecipeDetail-or-CommentsList photo-tap navigation and the current MealDetailScreen, respectively.

## Wireframe Reference

All wireframes are in `frigo_phase_7i_wireframes.html`. Seven states cover the full surface:

- **L1** — Solo cook, 1 dish (Tom's carbonara)
- **L2** — Solo cook, multi-dish ("Me, myself, and the kitchen" — 3 dishes with source-aware icons)
- **L3a** — Co-cook where partner hasn't posted (prehead only, no group)
- **L3b** — Co-cook linked pair (indented stack with gutter connector, descriptive group header)
- **L4** — Meal event solo contribution (tappable prehead above a single card)
- **L5** — Meal event linked group (indented stack, tappable group header)
- **L6** — Cook detail screen
- **L7** — Meal event detail screen (rewrite of MealDetailScreen)

## Key Design Decisions (all locked on 2026-04-13)

- **Every post has exactly one author.** No shared posts, no co-authorship, no avatar stacks in card headers.
- **Two types of link relationships:**
  - **Cook partner** — people who cooked together. Post-to-post link. No separate entity. Reuses `post_participants` with role `sous_chef` (semantic reinterpretation, no schema change).
  - **Meal event** — a shared dinner. First-class entity with creator-as-owner, name, date, location, attendees, shared media pool, event-level comments. Lives in `posts` with `post_type='meal_event'` after Checkpoint 1 migration.
- **Unified "context above the card" pattern.** Both co-cook and meal event context surface as a prehead (N=1) or group header (N≥2). Card itself stays clean.
- **Rule C visibility** — linked group renders only when ≥2 linked posts are visible to the viewer. Below that threshold, each visible card appears solo with optional context prehead.
- **Indent + gutter connector** for linked groups. Cards pushed right ~20px, thin gray connector in the left gutter (outside cards, not cutting through them). Matches Strava's hike/run grouping exactly.
- **Oldest-first ordering within a linked group** (reads as narrative). The group itself sorts in the feed by its most-recent-member activity.
- **Creator-as-owner for meal events** with edit permissions for title/date/location/highlight photo/attendees. Other attendees can add to shared media pool and contribute event-level comments.
- **Eater ratings stay private** to the rater (D43 carries over unchanged).
- **"Me, myself, and the kitchen" = L2** — single cook, multi-dish, no event. New "dishes block" pattern when 2+ dishes, source-aware icons per dish (📕 cookbook, 🌐 web URL, ✏️ user-created, 🤷 freeform).

See the wireframe notes panels for full decision rationale on each state.

---

## Grounding in Actual Code (post-Fix-Pass-9 state)

**Before I wrote the checkpoints below, I read the current state of these files:**
- `components/LinkedPostsGroup.tsx` (the Nov 2025 linked-posts component, unwired until now)
- `lib/services/feedGroupingService.ts` (the Nov 2025 grouping service)
- `screens/FeedScreen.tsx` (post-Fix-Pass-9)
- `components/feedCard/sharedCardElements.tsx` (post-Fix-Pass-8/9)
- `components/PostCard.tsx` and `components/MealPostCard.tsx` (current feed card renderers)

**Key findings that shaped the checkpoints:**

1. **`LinkedPostsGroup.tsx` exists and has the right visual primitive** (Strava-style group with vertical connector), but its data model uses the old `post_relationships` table which 7I replaces. It also renders a shared recipe photo as the group's visual anchor and uses stacked avatars in the header, both of which conflict with the new "single avatar per card, gutter connector ties the group" model. **Decision: retire `LinkedPostsGroup` in favor of a new `CookLinkedGroup` component.** Keep the old file in the repo for reference during the build but mark it for deletion in Checkpoint 7.

2. **`feedGroupingService.ts` uses a union-find algorithm** on `post_relationships`. The algorithm itself (DFS over a graph of post IDs) is the right structure for 7I's grouping — cook partners and meal event memberships form the same kind of graph. **Decision: rewrite the service** (new signature, new data sources: `post_participants` for cook partners, `parent_meal_id` for meal event membership) but preserve the union-find structure as a known-good pattern.

3. **FeedScreen currently filters dish posts with `.is('parent_meal_id', null)`** (line in `loadDishPosts`, added as Fix Pass 4 / Fix 1). This means meal-attached dishes are hidden from the feed and only surface via `MealPostCard`'s dish peek. **Critical: this filter must be REMOVED in Checkpoint 4.** Under the new model, meal-attached dishes ARE standalone feed items — they just render with a meal event prehead. Failing to remove this filter means every dish attached to a meal event vanishes from the feed entirely. Will be called out prominently in the Checkpoint 4 prompt.

4. **`post_participants` already supports the new model's semantic reinterpretation** — `sous_chef` becomes "cook partner," `ate_with` becomes "meal event attendee." No schema change required for these role values; the change is in how services query them and how the UI renders them.

5. **`post_type` is a `text` column, not an enum** (per prior diagnostic work). Adding `'meal_event'` as a new value requires no `ALTER TYPE` — just an `UPDATE posts SET post_type = 'meal_event' WHERE post_type = 'meal'`.

6. **`posts.photos` JSONB field already has an `is_highlight` flag** on individual photo entries (visible in PostCard's photo sorting logic: `if (a.is_highlight) return -1;`). **This is the mechanism for the host's highlight photo on L7's hero** — no new field needed. The host picks which of their photos is the highlight; the MealEventDetailScreen surfaces it as the hero.

7. **`optimizeStorageUrl` in `sharedCardElements.tsx` already includes the Fix Pass 9 `resize=contain` fix**. CookCard inherits this automatically via the shared PhotoCarousel.

8. **`sharedCardElements.tsx` already exports the primitives we need:** `CardWrapper`, `CardHeader`, `TappableTitleBlock`, `PhotoCarousel`, `StatsRow`, `VibePillRow`, `EngagementRow`, `ActionRow`, `HighlightsPill`, `DescriptionLine`, `RecipeLine`, `StartedByFootnote`. CookCard reuses all of these. We add new primitives for `MealEventPrehead`, `LinkedGroupHeader`, `LinkedGroupContainer`, and `CookDishesBlock` (L2's multi-dish block).

9. **The `📖` emoji in `RecipeLine`** (currently hardcoded at line ~650 of sharedCardElements.tsx) gets replaced with the `noun-book-8333826` SVG from the assets folder. Bundled as a polish item into Checkpoint 3.

---

## The Seven Checkpoints

7I is too large to ship as a single CC prompt. It's structured as seven sequential checkpoints, each with its own focused CC prompt generated only after the previous checkpoint's SESSION_LOG is reviewed. **Prompts are NOT generated ahead of time** — downstream checkpoints may need adjustment based on what happens upstream.

### Checkpoint 1 — Data model migration [HIGH RISK]

**Goal:** Migrate existing `post_type='meal'` rows to `'meal_event'`. Preserve all data. Verify integrity.

**Scope:**
- Pre-migration SQL snapshot (mandatory — no rollback path without it)
- Diagnostic queries BEFORE migration: count rows by post_type, count dishes with parent_meal_id, count participant roles, data integrity check for orphaned parent_meal_id references
- Atomic transaction: `UPDATE posts SET post_type = 'meal_event' WHERE post_type = 'meal'`
- Diagnostic queries AFTER migration: verify all meal rows became meal_event rows, verify parent_meal_id still points at valid rows (now meal_event type), verify post_participants for meal_event posts still attached correctly
- Update `lib/types/` `PostType` union to include `'meal_event'` (keep `'meal'` in the union for backward compat during the transition)
- Add a comment in the type file explaining the model shift

**Risks:**
- The existing feed code queries `post_type='meal'` and won't find any rows after migration, so MealPostCard stops rendering anything. **This is expected during the transition between Checkpoint 1 and Checkpoint 4** — the feed will look "empty-ish" (dish posts only, no meal cards). This is correct behavior for the gap. The app should not crash.
- If the migration runs without snapshot, there's no rollback path.

**HARD STOP after this checkpoint.** Tom reviews migration output, row counts, and verifies the app still loads the feed without crashing before Checkpoint 2 begins.

### Checkpoint 2 — Services layer

**Goal:** Build the service-layer plumbing for the new model without changing any UI.

**Scope:**

New services in `lib/services/`:
- `getLinkedCookPartners(postId)` — returns the list of cook partner post IDs for a given cook post. Queries `post_participants` where `post_id = $postId AND role = 'sous_chef' AND status = 'approved'`. Per-participant, if the participant has their own cook post for the same meal_event (or same date window), return those post IDs too. This is the "Tom and Anthony each posted about kombucha" case — the link is discovered via participant identity.
- `getMealEventForCook(postId)` — returns the meal event row (if any) that this cook post is linked to, via `posts.parent_meal_id`.
- `getMealEventDetail(mealEventId, viewerId)` — fat query for L7: event metadata, all linked cook posts with their authors, attendees from `post_participants` (role IN `host`, `ate_with`) + `meal_participants`, shared media from `meal_photos`, event-level comments. Applies viewer visibility filter.
- `getCookHistoryForUserRecipe(userId, recipeId)` — for L6's "Your history with this recipe" section. Returns `posts` where `user_id = $userId AND recipe_id = $recipeId` sorted by `cooked_at DESC` (or `created_at` if no `cooked_at`).

New grouping service (**replaces** `feedGroupingService.ts`):
- `buildFeedGroups(cookPosts, viewerId, followingIds)` — takes a list of cook posts and produces `FeedGroup[]`. Each group is either `{ kind: 'solo', cookPost, prehead? }` or `{ kind: 'linked', header, cookPosts[] }`. Uses union-find over cook-partner links and meal-event links. Applies Rule C visibility (group forms only when ≥2 linked posts are visible to viewer). Within each group, cook posts are sorted oldest-first. Groups themselves are sorted newest-first by most-recent-member activity.
- The old `groupPostsForFeed` function and `GroupedPost`/`SinglePost`/`FeedItem` types are marked deprecated but not deleted yet. Checkpoint 7 deletes them.

**No UI changes.** Feed still renders via the old PostCard/MealPostCard/LinkedPostsGroup path during Checkpoint 2.

### Checkpoint 3 — CookCard + new shared primitives

**Goal:** Build the new unified feed card component and its supporting primitives.

**Scope:**

New components in `components/feedCard/`:
- `CookCard.tsx` — unified feed card for all cook posts. Handles L1 (solo, 1 dish) and L2 (solo, multi-dish) cases. Reuses existing sharedCardElements primitives (`CardWrapper`, `CardHeader`, `TappableTitleBlock`, `PhotoCarousel`, `StatsRow`, `VibePillRow`, `EngagementRow`, `ActionRow`, `HighlightsPill`, `DescriptionLine`).
- `CookDishesBlock.tsx` — new primitive for L2's multi-dish block. When a cook post has 2+ dishes, renders a lightly-framed box listing each dish with its source icon, recipe name (tappable), and chef/source byline. Handles mixed source types in one block.
- `MealEventPrehead.tsx` — the "context above the card" primitive for L3a (co-cook solo) and L4 (meal event solo). Renders a small icon + title + optional meta above a card. Tappable for meal events, descriptive-only for co-cook.
- `LinkedGroupHeader.tsx` — similar to MealEventPrehead but sits above a stack of cards instead of a single card. Used for L3b and L5.
- `LinkedGroupContainer.tsx` — the indent + gutter connector wrapper. Handles the 20px left indent and absolutely-positioned 1px gutter connector line.

Edits to existing `sharedCardElements.tsx`:
- `RecipeLine` — replace the hardcoded `📖` emoji with the `noun-book-8333826` SVG from the assets folder (bundled polish item from 7F review)
- `RecipeLine` — accept a `sourceType` prop (`'cookbook' | 'url' | 'user_created' | 'freeform'`) and render the corresponding icon. For F&F: cookbook uses the SVG, URL/user-created/freeform use emoji fallbacks (🌐/✏️/🤷).
- `CookDishesBlock` uses `noun-friends-4314800` SVG instead of the current friends emoji (per 7F review polish item)

**Polish items bundled into Checkpoint 3:**
- Book emoji → SVG icon
- Friends emoji → SVG icon (for L2 dishes block)
- Description above recipe line (new CookCard enforces this layout; PostCard still has the old order)
- Chef name tappable (verify `onChefPress` wires through to CookCard the same way it does in PostCard)

**No FeedScreen changes yet.** CookCard is built and renderable but not wired. PostCard/MealPostCard/LinkedPostsGroup still drive the feed.

### Checkpoint 4 — FeedScreen rewrite

**Goal:** Wire FeedScreen to use CookCard + buildFeedGroups. Retire PostCard/MealPostCard/LinkedPostsGroup from the feed render path (don't delete yet).

**Scope:**

Changes to `screens/FeedScreen.tsx`:

1. **⚠️ CRITICAL: Remove `.is('parent_meal_id', null)` filter** from `loadDishPosts`. Under the new model, meal-attached dishes render as standalone feed items (with a meal event prehead) and must not be filtered out. Failing to remove this filter means every dish attached to a meal event vanishes from the feed.

2. **Stop querying `getMealsForFeed`.** Meal events are no longer feed items — they only surface via the detail screen (L7) reached from cook cards that link to them. Remove the call and the meal stream from the combined query.

3. **Replace `CombinedFeedItem` type union with `FeedGroup[]`.** The feed is now a list of FeedGroup objects (from `buildFeedGroups`), each either solo or linked.

4. **Replace `groupPostsForFeed` call with `buildFeedGroups`.** New service signature takes `(cookPosts, viewerId, followingIds)`.

5. **Rewrite `renderFeedItem`** to dispatch on `FeedGroup.kind`:
   - `'solo'` → render `<CookCard>` with optional `<MealEventPrehead>` above
   - `'linked'` → render `<LinkedGroupContainer>` with `<LinkedGroupHeader>` and N `<CookCard>` children

6. **Keep all likes/comments/highlights loading** but pass to CookCard via the new group shape. `loadLikesForPosts` and `loadCommentsForPosts` continue to hydrate by post ID — no change to hydration logic, just the render path changes.

7. **Retire PostCard/MealPostCard/LinkedPostsGroup from the feed render path.** They stay in the repo as reference/fallback but FeedScreen no longer imports or calls them. Delete in Checkpoint 7.

**Polish items bundled into Checkpoint 4:**
- Frigo logo tap → scroll feed to top (add FlatList ref, wire `onPress` on the Logo TouchableOpacity in the header to call `scrollToOffset({ offset: 0, animated: true })`)
- Investigate pull-to-refresh ~15s hang (add timeout logging to `loadFeed()` to identify where it's stuck; if the fix is obvious, apply it; otherwise report back in SESSION_LOG with the hang location)

**Verify thoroughly:** scroll through the feed looking for ordering issues, missing posts (especially meal-attached dishes that were previously hidden), visual breakage in indented groups, connector line rendering, and the degraded cases (Rule C drop-to-solo when only one linked post is visible).

### Checkpoint 5 — CookDetailScreen + narrow-scope editing

**Goal:** Build the new screen reached by tapping any cook card, title, or photo. Matches wireframe L6. Bundles a minimal set of edit affordances that prevent regression from today's MyPostDetailsScreen and unblock Tom's own testing workflow during Checkpoints 5-7 (seeding test data, fixing typos, attaching cook partners after the fact, etc.).

**Scope — detail screen:**
- New `screens/CookDetailScreen.tsx`
- Full L6 structure: back nav, hero photo carousel (with tapped photo centered via route param), author block, full title, full description, recipe line with cookbook page number, stats grid (Cook time / Rating / Times cooked), Highlights card, Modifications & notes block, "Your history with this recipe" section, Photos gallery, Comments, sticky engagement bar
- Navigation wiring: CookCard's `onPress` and photo `onPress` both navigate here, with photo index passed as a param
- Chef name in recipe line taps to existing `AuthorView` (audit whether it works as expected)
- "Your history with this recipe" calls `getCookHistoryForUserRecipe` from Checkpoint 2
- Modifications block maps to `posts.modifications`. Notes block maps to `posts.notes`. Show only sections with content.
- Respects the D4 distinction: `posts.description` is cook-time description (rendered in the main description), `posts.notes` is cook-time thoughts (rendered in the notes block).

**Scope — narrow editing (viewable only to post author):**
- Three-dot overflow menu in the CookDetailScreen header (same pattern as MyPostDetailsScreen). Menu visible only when the viewer is the post's author.
- Menu items:
  - **Add photos** — routes to existing `EditMediaScreen` with the post ID. Zero new code for the screen itself; this is just a navigation wire-up.
  - **Edit title** — inline text input replaces the title Text component, save on blur or return key. Writes to `posts.title` via `postService.updatePost` (verify the service function exists; if not, add a minimal one that takes `(postId, { title })`).
  - **Edit description** — inline multi-line text input, save on blur. Writes to `posts.description`.
  - **Manage cook partners** — opens an extended version of the existing `AddCookingPartnersModal`. See "Interface extension" below. Returns the complete new set of cook partner user IDs; CookDetailScreen diffs against the current set and calls `postParticipantsService.addParticipants()` / `removeParticipants()` accordingly.
  - **Change meal event** — opens a simple picker that reuses `SelectMealModal` or `SelectMealForRecipeModal` (whichever is simpler; audit both). Includes a "Not attached to a meal event" option at the top of the list. Writes to `posts.parent_meal_id`. When cleared, the post transitions from L4 (prehead above card) to L1 (solo cook) on next feed load.
  - **Delete post** — confirmation Alert dialog. Calls existing `postService.deletePost` which handles cascade cleanup of `post_likes`, `post_comments`, `post_participants`, `dish_courses`. After delete, navigate back to the feed.

**Interface extension — `AddCookingPartnersModal`:**
- Current interface: `onConfirm(selectedUsers: string[], role: ParticipantRole)` — only handles adding new partners.
- Extended interface: accept a new `existingParticipantIds?: string[]` prop. When present, the modal pre-selects those users in the list. Users can deselect existing participants to remove them. `onConfirm` returns the complete new set of selected user IDs (not a diff). The parent component computes add/remove operations.
- **NEEDS REVIEW during execution:** the existing modal is used in several places. CC must audit other call sites (`AddMealParticipantsModal`, `QuickAddModal`, `LogCookSheet`, anywhere in `screens__`) and either:
  - Update all call sites to use the new optional prop (preferred — backward compatible since the prop is optional), or
  - If any call site has a conflict, create a separate `ManageCookPartnersModal` component instead and leave `AddCookingPartnersModal` alone.
- The goal is the smallest footprint change that supports the "manage existing partners" use case.

**What narrow scope does NOT include (deferred to 7M):**
- Recipe link editing (swap or clear `posts.recipe_id`) — requires deciding what happens to `times_cooked` on old vs new recipe
- Rating changes (`posts.rating`)
- Modifications and notes editing (`posts.modifications`, `posts.notes`)
- Visibility changes (`posts.visibility`)
- Cooking method changes (`posts.cooking_method`)
- Dietary badge edits
- Any UX polish around unsaved-changes handling, dirty state, save confirmations

The narrow scope is explicitly scaffolding. When 7M ships, the CookDetailScreen overflow menu collapses to a single "Edit post" item that opens the full `EditPostScreen`, and the inline edits become part of that unified screen (matching Strava's Edit Activity pattern). The narrow-scope work in Checkpoint 5 is throwaway — the goal is to unblock testing and prevent regression, not to build permanent UX.

**Deferred for later phases:**
- "Related cooks from friends" section at the bottom
- Personalized chef-page lens
- Cookbook page number deep-linking into cookbook detail
- Full post editing UX (→ 7M)

### Checkpoint 6 — MealEventDetailScreen + host editing

**Goal:** Replace MealDetailScreen with the new shared-event-detail model. Matches wireframe L7. Bundles narrow-scope host editing so hosts can fix typos and manage attendees on meal events during testing.

**Scope — detail screen:**
- Rewrite `screens/MealDetailScreen.tsx` in place (or create `MealEventDetailScreen.tsx` and deprecate the old one — CC decides which is cleaner given the existing code)
- Full L7 structure: back nav with context-sensitive right action, host's highlight photo hero, event metadata block, stats grid, "What everyone brought" dish rows using F1e+ pattern with private eater ratings, "At the table" attendees list, "Shared media" photo gallery with Add Photo action, "About the evening" event-level comments
- Navigation: dish rows tap through to CookDetailScreen (L6). Meal event detail reached from L4 prehead or L5 group header.
- Eater rating affordances carry over from F1e+ (D43) without redesign

**Scope — host editing (viewable only to meal event creator):**
- Three-dot overflow menu in the MealEventDetailScreen header. Visible only when the viewer's `user_id` matches the meal_event post's `user_id` (the creator/host).
- Host menu items:
  - **Edit title** — inline text input, writes to `posts.title` on the meal_event row.
  - **Edit date/time** — opens existing `DateTimePicker` component, writes to `posts.meal_time`.
  - **Edit location** — inline text input, writes to `posts.meal_location`.
  - **Edit highlight photo** — opens a photo picker sourced from `meal_photos` (the shared media pool) plus any photos attached to dish posts linked to this meal event. Selected photo gets its `is_highlight` flag set to true; previously-highlighted photo (if any) gets its flag cleared. The highlight photo is what renders as the L7 hero on the detail screen.
  - **Manage attendees** — same extended `AddCookingPartnersModal` from Checkpoint 5, but operating on `role='ate_with'` participants instead of `role='sous_chef'`. Preloads existing attendees, allows add/remove, writes to `post_participants` with the meal_event's post ID.
  - **Delete event** — confirmation Alert dialog. **Cascade behavior (option b):** does NOT delete linked cook posts; instead, `UPDATE posts SET parent_meal_id = NULL WHERE parent_meal_id = $meal_event_id` before deleting the meal_event row. This is non-destructive — other cooks' posts remain intact as solo cook posts (L1 shape) and stop rendering as part of the linked group. The deletion confirmation dialog should make this explicit: "Deleting this event will remove it, but the X cook posts from attendees will remain as solo posts. [Cancel] [Delete event]". If there are linked cook posts from other users, show the count in the dialog. If the only linked cook posts are the host's own, the dialog can use simpler language.

**Scope — attendee editing (viewable to confirmed attendees who are not the host):**
- Non-host attendee overflow menu is simpler:
  - **Add photo to shared media** — opens photo picker, uploads to `meal_photos` with `user_id` set to current user. Writes the new row and refreshes the shared media section.
  - **Add event comment** — focuses the "About the evening" comment composer. No new code needed beyond making the composer focusable from the menu.
  - **Leave event** — removes the current user's `post_participants` row for this meal_event. Confirmation dialog: "Leave [event title]? You'll still keep any cook posts you made for this event, but they'll no longer appear as linked to this event." Option to keep or remove the `parent_meal_id` on the user's linked cook posts — default to keeping it (the user stays linked to the event via their cook post's parent_meal_id even if they're removed from the attendees list). **NEEDS REVIEW** during execution — this is a subtle UX decision and may want a simpler "remove me + don't touch my posts" default.

**What host editing does NOT include (deferred to 7M or future meal event polish):**
- Changing the meal event's description (add to 7M)
- Full visibility model changes for meal events
- Transferring host ownership to another attendee
- Editing individual dish rows from the meal event detail (those are edited on their own CookDetailScreen)

**Planned-dish hybrid (DEFERRED_DECISION):** the L7 wireframe shows italic greyed-out rows for dishes planned but not yet posted. Scope to CC: build if trivial, flag if complex. Revisit after Checkpoint 6 execution.

**Deferred:**
- RSVP flow redesign (separate work)
- Notifications for shared media / planned-dish posts / event comments
- Sound notifications when attendees add media
- Full post-editing screen (→ 7M)

### Checkpoint 7 — Final polish + cleanup

**Goal:** Catch remaining items and delete deprecated code.

**Scope:**
- Delete `components/LinkedPostsGroup.tsx` (no longer referenced)
- Delete `components/PostCard.tsx` and `components/MealPostCard.tsx` (no longer referenced from FeedScreen)
- Delete old `feedGroupingService.ts` exports (`groupPostsForFeed`, `GroupedPost`, `SinglePost`, `FeedItem`) — keep the file if other code imports the union-find helper, otherwise delete entirely
- Chef name tappability audit — does `AuthorView` exist and work? Build a minimal chef page if it's broken
- Any visual regressions or small fit-and-finish items that emerged during Checkpoints 1-6 testing
- Remove `'meal'` from the `PostType` union (all rows have been migrated to `'meal_event'`; backward-compat is no longer needed)
- Update `FRIGO_ARCHITECTURE.md` to reflect the new component structure

---

## Ordering: Where 7I fits in Phase 7

Per the 2026-04-13 planning session (updated later that day to add 7M and narrow-scope editing), the recommended ordering is:

1. **7I Wave 1** — Checkpoints 1-4 (migration + services + CookCard + FeedScreen rewrite). The new feed is live. Detail screens still use the old MealDetailScreen temporarily.
2. **7G** — Historical cook logging with backdated posts. Small sub-phase (1-2 sessions). Safe to ship here because backdated cook posts render via the new CookCard immediately.
3. **7H** — My Posts in You tab. Very small IA change (1 session). Orthogonal to everything else.
4. **7I Wave 2** — Checkpoints 5-7 (CookDetailScreen with narrow-scope editing + MealEventDetailScreen with host editing + cleanup). Wave 2 is larger than originally scoped because it bundles the narrow editing affordances that unblock testing and prevent regression from today's MyPostDetailsScreen capabilities.
5. **7J** — Recipe sharing.
6. **7K** — Chef attribution backfill.
7. **7L** — Settings UI for visibility defaults + `meal_tagged` visibility + polish.
8. **7M** — Full post editing pass. Builds a single unified `EditPostScreen` modeled on Strava's Edit Activity pattern that handles all editable fields (title, description, recipe link, rating, modifications, notes, visibility, cooking method, photos, cook partners, meal event attachment). Replaces the narrow-scope overflow menu on CookDetailScreen with a single "Edit post" entry point. 3-5 sessions. Covers the real editing UX that 7I deliberately left as scaffolding.

**Why this ordering:** Wave 1 gets the riskiest architectural change out of the way first. 7G/7H slip in between the two 7I waves because they're small, safe, and don't depend on the detail screens. 7I Wave 2 then finishes the detail screens (including narrow editing that prevents regression). 7J/7K/7L continue Phase 7 proper. 7M is last because full post editing benefits from having the new detail screens stable and from the feed infrastructure being settled — it's polish that works best on solid foundations.

**Four shippable milestones inside Phase 7I/7M:**
- **Milestone A** (after 7I Wave 1): new feed model live, old meal cards retired from feed. Detail screens temporarily use old code.
- **Milestone B** (after 7G + 7H): historical logging works, My Posts lives in You tab.
- **Milestone C** (after 7I Wave 2): new detail screens live with narrow-scope editing, old components deleted.
- **Milestone D** (after 7M): full post editing shipped, narrow-scope scaffolding replaced by unified EditPostScreen.

**Session estimate update:** 7I grew from 7-10 sessions to **9-13 sessions** due to Checkpoint 5/6 scope expansion (narrow-scope editing). 7M is new at **3-5 sessions**. Total new work: 12-18 sessions across 7I + 7M compared to the original 7-10 session estimate for just 7I.

---

## 7M Scope Reference (brief)

Phase 7M is not part of 7I's checkpoint structure, but the narrow-scope work in Checkpoints 5 and 6 is explicitly designed to be replaced by 7M. Capturing the intended 7M shape here so the throwaway nature of the narrow scope is clear.

**7M goal:** Ship a single unified `EditPostScreen` modeled on Strava's Edit Activity pattern. One screen handles all editable fields on a cook post.

**7M scope:**
- New `screens/EditPostScreen.tsx` — single screen with form fields for every editable property of a cook post
- Fields covered:
  - Title (text input)
  - Description (multi-line text)
  - Recipe link (picker — select from user's recipes, or clear to make freeform). Handles derived-stat implications: if recipe_id changes, `times_cooked` decrements on the old recipe and increments on the new one. If cleared, old recipe decrements and new value is null.
  - Rating (star selector, 1-5)
  - Modifications (multi-line text)
  - Notes (multi-line text, private-to-author per D4)
  - Visibility (dropdown: Everyone / Followers / Just me / Meal tagged — D34/D35)
  - Cooking method (dropdown)
  - Photos (embedded photo grid with add/remove/reorder, reuses existing `EditMediaScreen` capabilities but inline)
  - Cook partners (embedded list with add/remove, reuses the extended `AddCookingPartnersModal` from 7I Checkpoint 5)
  - Meal event attachment (embedded picker, reuses the Checkpoint 5 pattern)
  - Delete post (footer button, same cascade behavior as Checkpoint 5)
- Unsaved-changes handling: dirty state indicator, confirmation on back nav, save vs. discard flow
- Save action: writes all changed fields in a single transactional service call
- Entry points:
  - CookDetailScreen overflow menu → "Edit post" (replaces the narrow-scope inline edits from 7I Checkpoint 5)
  - Feed card overflow menu → "Edit post" (new — feed cards don't currently have overflow menus, but `PostActionMenu` component exists and can be wired in)
  - My Posts list → tap post → CookDetailScreen → Edit post (via overflow menu)
- Derived-stat recalculation: when recipe_id or rating changes, trigger appropriate downstream updates (`recipes.times_cooked`, aggregate dish ratings on any linked meal event, Highlights pill signals that depend on these values)
- Wireframe the edit mode UX before building — could be modeled on Phase 11's recipe editing pattern if that ships first, or on Strava's Edit Activity layout directly

**7M explicitly does NOT include:**
- Editing someone else's post (author-only)
- Editing meal events (that's Checkpoint 6 host editing in 7I; 7M might extend it, TBD during 7M scoping)
- Bulk edit operations (edit multiple posts at once)
- History/versioning of edits (no undo, no "edit history" audit trail)

**Target phase position:** After 7L, before Phase 8 begins. Roughly 3-5 sessions.

---

## Deferred Items (added 2026-04-13)

These items are flagged during the 4/13 planning session and tracked in `DEFERRED_WORK.md`. Items marked **NEEDS REVIEW** should be revisited before their target phase starts; they're placeholder-level decisions that may benefit from refinement as the build exposes reality.

- **P7-44** Feed infinite scroll / pagination (still hard-capped at 200 dishes after 7F Fix Pass 7)
- **P7-45** Pull-to-refresh ~15s hang investigation (bundled into Checkpoint 4; if Checkpoint 4 doesn't fix it, this becomes a standalone item) — NEEDS REVIEW
- **P7-46** Strava-style tag-accept auto-draft flow (Checkpoint 2 builds plumbing; UI flow deferred) — NEEDS REVIEW
- **P7-47** Duplicate meal event detection (Mary creates one, Andrew creates another for same dinner) — NEEDS REVIEW
- **P7-48** Planned-dish entry flow on MealEventDetailScreen (how host adds Cam's Greek salad slot before Cam posts) — NEEDS REVIEW
- **P7-49** "Host recap" post type (Option 3 from the 4/13 conceptual discussion — host post about an evening rather than a specific dish)
- **P7-50** RSVP flow redesign under new meal event model
- **P7-51** "Related cooks from friends" on CookDetailScreen
- **P7-52** Personalized chef page lens
- **P7-53** Cookbook page number deep-linking
- **P7-54** Collage hero photos for meal event detail
- **P7-55** Per-cook + per-event comments as unified thread — NEEDS REVIEW (wait for F&F feedback)
- **P7-56** Shared media notifications (who gets notified when attendees add photos)
- **P7-57** Photo dimensions at upload time (eliminates `Image.onLoad` first-load layout shuffle)
- **P7-58** Removing deprecated `'meal'` value from `PostType` union (after Checkpoint 4 bakes)
- **P7-59** Migration rollback path (accepted tradeoff — rely on pre-migration snapshot)

**Reframed from D44-era items:**
- **P7-28** — M3 schema audit. Originally scoped as "verify every dish in a multi-cook meal is owned by the actual cook." Reframed: the Checkpoint 1 migration and Checkpoint 4 feed rewrite cover the practical part (cook posts retain their original authors). Audit scope shrinks to "post-Checkpoint 4 verification that no cook posts got orphaned during migration." — NEEDS REVIEW
- **P7-29** — GroupedMealCard component. **Retired.** No such component in the new model. Superseded by `CookLinkedGroup` + `LinkedGroupContainer` from Checkpoint 3.
- **P7-30** — `feedGroupingService` rewrite. **Still needed** with different scope (grouping by cook partner + meal event, not `post_relationships`). Bundled into Checkpoint 2.
- **P7-31** — Two-level photo render rules in grouped meals. **Partially retired.** The "meal-summary header shows meal photos" half goes away (no meal-summary header). The "LogCookSheet photo upload defaults to meal_photos when meal context is present" half survives. — NEEDS REVIEW

---

## Checkpoint Prompt Strategy

Each checkpoint gets its own focused CC prompt of ~4-6 pages with strict scope lock. Prompts are generated **one at a time** as the previous checkpoint's SESSION_LOG is reviewed.

After each checkpoint:
1. CC writes a SESSION_LOG entry describing what was built and any issues
2. Tom reviews and confirms
3. Claude.ai reconciles any surprises back into this master plan doc
4. Claude.ai generates the next checkpoint's CC prompt based on the current state of the code

This prevents the failure mode where downstream checkpoints bake in assumptions that turn out to be wrong.

## Next Action

**Fire the Checkpoint 1 CC prompt** (`CC_PROMPT_7I_CHECKPOINT_1_MIGRATION.md`). After it runs cleanly and Tom reviews the SESSION_LOG, generate Checkpoint 2's prompt and continue.

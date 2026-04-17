# Phase 7I Checkpoint 6 — MealEventDetailScreen + Eater Ratings + Host/Attendee Editing

**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 6 of 7

**Prior work:**
- **Checkpoints 1 through 5 (+ fix passes):** complete and verified. Feed rewrite, CookCard, CookDetailScreen with 14 content blocks + 6 narrow-scope editing items all shipped.
- **This is the second Wave 2 checkpoint.** Checkpoint 5 built CookDetailScreen (L6). Checkpoint 6 builds MealEventDetailScreen (L7) — the shared-event-detail screen reached from L4 meal event preheads and L5 meal event group headers.

**This checkpoint ships in two passes with a hard pause in the middle** (same Option Z pattern as Checkpoint 5).
- **Pass 1:** DDL migration (Tom runs in Supabase SQL Editor), screen build with eater_ratings wiring, navigation rewiring. Hard pause for on-device verification.
- **Pass 2:** Host editing overflow menu (6 items) + attendee editing overflow menu (3 items). Hard stop.

**Required reading before starting:**

1. This prompt in full
2. `docs/PHASE_7I_MASTER_PLAN.md` — the Checkpoint 6 section
3. `docs/frigo_phase_7i_wireframes.html` — the L7 wireframe and its companion text
4. `docs/PHASE_7_SOCIAL_FEED.md` — Decisions Log (D43 eater ratings privacy, D47 cook-post-centric model, D49 same-author collapse nav contract, D50 no-image state, D51 new — see below)
5. `lib/services/mealService.ts` — specifically `getMealEventDetail()` which already returns the data shape for this screen, with `private_rating: null` stubs that Pass 1 replaces with real eater_ratings queries
6. `lib/services/cookCardDataService.ts` — `fetchCookCardDataBatch(postIds)` for hydrating dish rows
7. `screens/CookDetailScreen.tsx` — reference for the overflow menu pattern, `console.warn` instrumentation, sticky engagement bar, `NoPhotoPlaceholder`, inline edit UX
8. `components/AddCookingPartnersModal.tsx` — reused for Manage attendees (Pass 2)
9. `screens/FeedScreen.tsx` — `navigateToMealEvent` callback that currently routes to `MealDetail`; Checkpoint 6 rewires it to `MealEventDetail`
10. `docs/SESSION_LOG.md` — Checkpoint 5 entries for reference

## New decision captured in this prompt

**D51 — Meal-event-level engagement uses existing infrastructure.** Meal-event-level likes and comments use the existing `post_likes` and `post_comments` tables with the meal_event post's ID as the target. No new engagement tables or columns needed. The meal_event row IS a post (it's in `posts` with `post_type='meal_event'`), so the existing engagement infrastructure works without modification. This applies to Checkpoint 6's L7 "About the evening" comment section and the future D49 renderer's engagement row.

This resolves the schema-coupling concern that previously linked D49 to Checkpoint 6. D49 can now ship independently whenever, as its own focused checkpoint.

**Update D49's "Implementation timing" section** when writing D51 to the Decisions Log: note that D51 resolves the schema concern, so D49 no longer needs to bundle with Checkpoint 6 for schema reasons.

---

## Goal

Build `screens/MealEventDetailScreen.tsx` as the new L7 detail target reached from meal event preheads (L4) and group headers (L5). Create the `eater_ratings` table via DDL migration so dish rows can show private rating pills. Wire FeedScreen's `navigateToMealEvent` to route to the new screen instead of the legacy `MealDetail`. Ship host editing (6 items) and attendee editing (3 items) as narrow-scope overflow menu scaffolding (same throwaway pattern as Checkpoint 5, replaced by 7M). Do NOT build the D49 renderer. Do NOT delete the legacy `MealDetailScreen` (Checkpoint 7). Do NOT touch `CookCard.tsx`, `groupingPrimitives.tsx`, or `CookDetailScreen.tsx`.

---

## Execution flow

**Pass 1 — Sub-sections 6.0 (DDL, Tom runs manually) → 6.1 (screen build) → 6.2 (eater_ratings service) → 6.3 (navigation rewiring) → 6.4 (D51 commitment) → HARD PAUSE at 6.4.5**

1. **6.0** — CC generates the DDL SQL for the `eater_ratings` table + RLS policies. CC writes it to `docs/DDL_CHECKPOINT_6_EATER_RATINGS.sql`. Tom runs it in the Supabase SQL Editor before CC starts the screen build. CC verifies the table exists via a test query before proceeding.
2. **6.1** — Build `screens/MealEventDetailScreen.tsx` with 8 content blocks. Hero, metadata, stats, dish rows with rating pills, attendees, shared media, event comments, sticky engagement bar.
3. **6.2** — Build `lib/services/eaterRatingsService.ts` with `getEaterRatingsForMeal(mealEventId, viewerUserId)` and `upsertEaterRating(postId, raterUserId, rating)`. Wire into MealEventDetailScreen's dish rows.
4. **6.3** — Rewire FeedScreen's `navigateToMealEvent` to route to `MealEventDetail`. Register the route in `FeedStackParamList`.
5. **6.4** — Document D51 nav contract.
6. **6.4.5 — HARD PAUSE.** CC writes a partial SESSION_LOG entry ending with `PAUSED — awaiting GO for Sub-section 6.5 (host/attendee editing overflow menus).`

**Pass 2 — Sub-section 6.5 (host editing + attendee editing), triggered by Tom's GO**

7. **6.5** — Wire the host overflow menu (6 items) and attendee overflow menu (3 items).
8. **6.6** — SESSION_LOG finalization, write D51 to Decisions Log, add deferred items, GO/NO-GO for Checkpoint 7.

---

## Sub-section 6.0 — DDL migration: `eater_ratings` table

CC generates a SQL file that Tom runs in Supabase SQL Editor. This is a prerequisite — the screen build in 6.1 depends on the table existing.

### Table definition

```sql
-- Checkpoint 6: eater_ratings table for D43 private per-eater dish ratings
-- Run this in Supabase SQL Editor before CC starts the screen build.

CREATE TABLE IF NOT EXISTS eater_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  rater_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (post_id, rater_user_id)
);

-- Index for the primary query pattern: "get all ratings for dishes in a meal event"
CREATE INDEX idx_eater_ratings_post_id ON eater_ratings (post_id);

-- Index for "get all ratings by a specific user" (useful for profile/stats)
CREATE INDEX idx_eater_ratings_rater ON eater_ratings (rater_user_id);

-- RLS policies for D43 visibility: rating visible only to the rater themselves
-- and to the cook (post author). Other users cannot see eater ratings.
ALTER TABLE eater_ratings ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own ratings
CREATE POLICY "Users can read own ratings"
  ON eater_ratings FOR SELECT
  USING (rater_user_id = auth.uid());

-- Policy: users can read ratings on their own posts (the cook sees who rated their dish)
CREATE POLICY "Post authors can read ratings on their posts"
  ON eater_ratings FOR SELECT
  USING (
    post_id IN (
      SELECT id FROM posts WHERE user_id = auth.uid()
    )
  );

-- Policy: users can insert their own ratings
CREATE POLICY "Users can insert own ratings"
  ON eater_ratings FOR INSERT
  WITH CHECK (rater_user_id = auth.uid());

-- Policy: users can update their own ratings
CREATE POLICY "Users can update own ratings"
  ON eater_ratings FOR UPDATE
  USING (rater_user_id = auth.uid())
  WITH CHECK (rater_user_id = auth.uid());

-- Policy: users can delete their own ratings
CREATE POLICY "Users can delete own ratings"
  ON eater_ratings FOR DELETE
  USING (rater_user_id = auth.uid());
```

**CC's job:** write this SQL to `docs/DDL_CHECKPOINT_6_EATER_RATINGS.sql` and include a note at the top: "Tom: run this in Supabase SQL Editor before CC starts the screen build. Verify by running: `SELECT count(*) FROM eater_ratings;` — should return 0."

**After Tom confirms the table exists,** CC verifies connectivity by running a test query in a throwaway script: `supabase.from('eater_ratings').select('id').limit(1)`. If it returns an empty array (not an error), the table is live and CC proceeds. If it returns an error, CC flags it in SESSION_LOG and stops.

**If the RLS policies cause issues** (e.g., the "post authors can read ratings on their posts" subquery is slow or fails), CC should flag in SESSION_LOG and Tom will decide whether to simplify. The simplification path is: drop the author-visibility policy and make ratings visible only to the rater for now. The cook-sees-ratings feature is a nice-to-have for F&F, not a blocker.

---

## Sub-section 6.1 — `MealEventDetailScreen.tsx` (new file)

### 6.1.0 — Route registration

Add `MealEventDetail` to `FeedStackParamList`:

```typescript
MealEventDetail: { mealEventId: string };
```

Register `<FeedStack.Screen name="MealEventDetail" component={MealEventDetailScreen} options={{ headerShown: false }}/>`. The screen owns its own header (same pattern as CookDetailScreen).

### 6.1.1 — Screen structure (8 content blocks, top to bottom)

The content ordering is committed. Do not reorder.

**Block 1 — Header bar.** Back button (left), title "Meal Event" or the event title (truncated), Share action (right, placeholder `Alert.alert('Share coming soon', ...)`). Overflow menu button for host/attendee editing — visible to host (6 items) OR confirmed attendee (3 items), absent for non-participants. The menu items are wired in Pass 2; for Pass 1, the button exists with a stub `console.warn('[MealEventDetailScreen] Menu pressed — Pass 2 will wire this up')`.

**Visibility logic for the menu button:**
- `isHost = mealEvent.host?.user_id === currentUserId`
- `isAttendee = attendees.some(a => a.user_id === currentUserId)`
- Menu button visible when `isHost || isAttendee`, absent otherwise.

**Block 2 — Hero photo.** The host's chosen highlight photo. Source: `mealEvent.highlight_photo?.url` from `getMealEventDetail`. If no highlight photo exists, render `NoPhotoPlaceholder` (D50 detail-screen rule). The hero is NOT a carousel — it's a single image. If the highlight is from `posts.photos` (the meal_event post's own photos jsonb), render it at full width. If from `meal_photos` (the shared media pool), same treatment.

**Block 3 — Event metadata block.** Large title (22px bold, same size as CookDetailScreen Block 4). Below the title: date + time formatted as "Saturday, April 8, 2026 · 8:00 PM" (full weekday + date + time, more detailed than feed preheads). Below that: location if present (`mealEvent.meal_location`). Below that: "Hosted by [host display_name]" with the host's avatar chip, tappable → AuthorView.

**Block 4 — Stats grid.** Same cream-background pattern as CookDetailScreen Block 8. Three cells: **Cooks** (unique cook count from `stats.unique_cooks`), **Dishes** (total dish count from `stats.total_dishes`), **At table** (attendee count from `stats.total_attendees`). If `stats.avg_rating` is defined, add a fourth cell: **Avg rating** showing the average across all dish ratings.

**Block 5 — What everyone brought.** The dish rows. Each row renders:
- Thumbnail (first photo from the cook's `photos` array, or `NoPhotoPlaceholder` at small size if no photo)
- Dish name (cook's post title, recipe title fallback)
- Cook attribution: avatar chip + display name. If the cook is the host, append "(host)" in muted text.
- **Eater rating pill** (D43): shows the viewer's private rating for this dish if one exists ("★ 4"), or "Tap to rate" if the viewer is an attendee who hasn't rated yet, or absent if the viewer is not an attendee. Rating pill is tappable → opens a star-rating inline affordance (5-star row, tap to set, tap same to clear). On rating change, calls `upsertEaterRating(dishPostId, currentUserId, rating)` from the new service (6.2). Optimistic local update.
- Each row is tappable (the full row, excluding the rating pill) → `navigation.navigate('CookDetail', { postId: cook.post_id })`. This is the L6 link.

**Data source:** `getMealEventDetail(mealEventId)` returns `cooks` array. Each cook has `post_id`, `post_title`, `user_id`, `display_name`, `avatar_url`, `recipe_title`, `photos`, `post_rating`. The eater rating for the viewer comes from the new `getEaterRatingsForMeal` service (6.2) keyed by `post_id`.

**Block 6 — At the table.** Attendees list. Each row shows avatar + display name + role descriptor:
- Host: "Host · cooked [dish name]" (if the host has a linked cook post) or just "Host"
- Cook attendee: "Cooked [dish name]"
- Non-cook attendee: "Guest"

Data source: combine `cooks` (who are implicitly at the table) with `attendees` (ate_with participants). Deduplicate by `user_id` — a person who both cooked and is in the `ate_with` list should appear once with the "Cooked [dish]" descriptor taking precedence over "Guest."

Each row tappable → AuthorView.

**Block 7 — Shared media.** Photo gallery from `shared_media` array returned by `getMealEventDetail`. Renders as a 3-column grid (same layout as CookDetailScreen Block 12). Each thumbnail tappable → full-screen image view (or scroll hero to that photo if we reuse the hero-scroll pattern; CC's choice, document in SESSION_LOG). "+ Add photo" tile at the end of the grid (or at the top if the grid is empty). Add photo opens the image picker, uploads to `meal_photos` table via existing service patterns, refreshes the grid.

The hint line above the grid: "Photos shared by attendees — visible only to people at this event." (This copy is from the wireframe companion.)

Absent when `shared_media` is empty AND the viewer is not an attendee (non-participants can't add photos, so showing an empty grid with an add button to someone who can't add is confusing).

**Block 8 — About the evening.** Event-level comments. Per D51, these are `post_comments` rows where `post_id` is the meal_event post's ID. Same rendering pattern as CookDetailScreen Block 13 (truncated preview + "View all N comments · add a comment" tap-through to CommentsScreen). The hint line: "Comments about the evening — not about any specific dish."

**Sticky engagement bar** (same pattern as CookDetailScreen Block 14). Pinned bottom, shows yas-chef count + comment count for the meal_event post. Like button toggles a `post_likes` row for the meal_event post's ID. Comment button scrolls to or navigates to the comments section.

### 6.1.2 — Data loading

MealEventDetailScreen fetches on mount via `loadMealEventDetail(mealEventId)`:

- **Event data:** `getMealEventDetail(mealEventId)` from `lib/services/mealService.ts` — returns event metadata, host, cooks, attendees, shared_media, stats, highlight_photo. This is the existing Checkpoint 2 service; no modifications needed to its return shape.
- **Eater ratings for viewer:** `getEaterRatingsForMeal(mealEventId, currentUserId)` from the new `eaterRatingsService.ts` (6.2). Returns a `Map<string, number>` keyed by `post_id` (dish post ID) → rating value.
- **Likes:** same pattern as CookDetailScreen — fetch `post_likes` for the meal_event post's ID.
- **Comments:** `getCommentsForPost(mealEventPostId)` — same service CookDetailScreen uses.

All fetches in parallel via `Promise.all`. Show a loading spinner until the event data resolves; eater ratings and comments can hydrate asynchronously.

---

## Sub-section 6.2 — `lib/services/eaterRatingsService.ts` (new file)

Two exports:

```typescript
/**
 * Get all of the viewer's eater ratings for dishes linked to a meal event.
 * Returns a Map<postId, rating> for dishes the viewer has rated.
 * RLS ensures only the viewer's own ratings are returned.
 */
export async function getEaterRatingsForMeal(
  mealEventId: string,
  viewerUserId: string
): Promise<Map<string, number>> {
  // 1. Get all dish post IDs linked to this meal event
  const { data: dishPosts } = await supabase
    .from('posts')
    .select('id')
    .eq('parent_meal_id', mealEventId)
    .eq('post_type', 'dish');

  if (!dishPosts || dishPosts.length === 0) return new Map();

  const dishPostIds = dishPosts.map(p => p.id);

  // 2. Get the viewer's ratings for those dishes
  const { data: ratings } = await supabase
    .from('eater_ratings')
    .select('post_id, rating')
    .eq('rater_user_id', viewerUserId)
    .in('post_id', dishPostIds);

  const map = new Map<string, number>();
  (ratings || []).forEach(r => map.set(r.post_id, r.rating));
  return map;
}

/**
 * Upsert an eater rating for a specific dish post.
 * If rating is null, deletes the existing rating.
 */
export async function upsertEaterRating(
  postId: string,
  raterUserId: string,
  rating: number | null
): Promise<void> {
  if (rating === null) {
    const { error } = await supabase
      .from('eater_ratings')
      .delete()
      .eq('post_id', postId)
      .eq('rater_user_id', raterUserId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('eater_ratings')
    .upsert(
      { post_id: postId, rater_user_id: raterUserId, rating, updated_at: new Date().toISOString() },
      { onConflict: 'post_id,rater_user_id' }
    );
  if (error) throw error;
}
```

The service is intentionally thin — two functions, no caching, no complex queries. The `getEaterRatingsForMeal` query is 2 round trips (dish post IDs → ratings). The `upsertEaterRating` is a single upsert. Both trust RLS for visibility enforcement.

---

## Sub-section 6.3 — Navigation rewiring

Replace FeedScreen's `navigateToMealEvent` implementation:

```typescript
const navigateToMealEvent = useCallback(
  (mealEventId: string) => {
    navigation.navigate('MealEventDetail', { mealEventId });
  },
  [navigation]
);
```

This replaces the current `navigation.navigate('MealDetail', { mealId: mealEventId, currentUserId })` temporary target.

**Also update:** any `NestedMealEventGroup` or `MealEventPrehead` `onPress` handler that currently routes to `MealDetail`. Grep `screens/FeedScreen.tsx` for `MealDetail` and replace all instances that route to the legacy screen with `MealEventDetail`. Keep the legacy `MealDetail` route registered in `App.tsx` for now — other screens (MyMeals, etc.) may still reference it. Checkpoint 7 removes it.

---

## Sub-section 6.4 — D51 commitment (documentation only)

No code. Record D51 in the SESSION_LOG: "Meal-event-level engagement uses existing `post_likes`/`post_comments` with the meal_event post's ID. No new engagement tables needed."

Also note that D49's "Implementation timing" section should be updated in the Decisions Log to reflect that D51 resolves the schema coupling — D49 can ship independently.

---

## Sub-section 6.4.5 — HARD PAUSE

After Sub-sections 6.0-6.4 complete and TypeScript compiles cleanly, STOP.

Write a partial SESSION_LOG entry. The entry must include:

- Files modified, DDL migration outcome, eater_ratings service implementation details
- Screen structure: which of the 8 blocks rendered cleanly, which needed iteration
- Eater rating pill wiring: does the "Tap to rate" → star-rating inline → upsert flow work from CC's code-reading perspective?
- Navigation rewiring: grep verification that `MealDetail` is no longer referenced from FeedScreen for meal-event navigation
- RLS policy verification: did the test query succeed? Any concerns about the author-visibility subquery?
- Visual verification PENDING on Tom's device (Pass 1 checklist — see below)

End with:
```
PAUSED — awaiting GO for Sub-section 6.5 (host/attendee editing overflow menus).
```

**Pass 1 verification checklist (on Tom's device):**

1. Tap a meal event prehead (L4) or group header (L5) on the feed → lands on MealEventDetailScreen, correct event loads
2. Hero photo renders (or NoPhotoPlaceholder if no highlight)
3. Event metadata block: title, date/time, location, "Hosted by [name]" all render correctly
4. Stats grid shows correct counts (Cooks / Dishes / At table)
5. "What everyone brought" dish rows render with thumbnails, dish names, cook attribution
6. Tap a dish row → navigates to CookDetailScreen (L6) for that specific dish
7. Eater rating pill: if the viewer is an attendee, "Tap to rate" appears on unrated dishes; tap shows 5-star inline picker; select a rating → pill updates to show "★ N"; pull-to-refresh or back+re-enter → rating persists
8. Eater rating pill: if the viewer is NOT an attendee, no rating pill appears
9. "At the table" attendees list renders with correct role descriptors
10. "Shared media" renders the photo grid (or is absent if no shared media and viewer is not an attendee)
11. "About the evening" comments render (or "No comments yet" prompt)
12. Sticky engagement bar shows yas-chef count + comment count for the meal event
13. Like button toggles correctly (optimistic update + persists)
14. Overflow menu button visible for host, visible for attendee, absent for non-participants
15. Tapping the menu button logs the Pass 2 placeholder
16. Back button returns to feed
17. Feed loads without regression (no crashes, timing baseline unchanged)
18. Test harness still works (flask button, all 7 states)
19. CookDetailScreen still works (no regression from Checkpoint 5)

---

## Sub-section 6.5 — Host/Attendee editing overflow menus — PASS 2

Execute only after Tom's explicit GO.

### Host overflow menu (6 items, visible when `isHost`)

Display order:

1. **Edit title** — same inline text input pattern as CookDetailScreen. Writes to `posts.title` on the meal_event row via `updatePost(mealEventPostId, { title })`. The existing `updatePost` from Checkpoint 5 works here — it takes a `postId` and a patch.

2. **Edit date/time** — opens the existing `DateTimePicker` component. On confirm, writes to `posts.meal_time` via a new `updatePost` patch field. **Extend `UpdatePostPatch`** in `postService.ts` to include `meal_time?: string | null`. CC should verify the `DateTimePicker` component's interface and wire it. If the DateTimePicker requires props that don't cleanly fit (e.g., it expects a modal wrapper that MealEventDetailScreen doesn't have), CC should build a minimal inline date/time picker and flag the integration gap in SESSION_LOG.

3. **Edit location** — same inline text input pattern. Writes to `posts.meal_location` via a new `updatePost` patch field. **Extend `UpdatePostPatch`** to include `meal_location?: string | null`.

4. **Edit highlight photo** — opens a photo picker sourced from two pools: (a) `meal_photos` (shared media) and (b) photos from dish posts linked to this meal event (`posts.photos` where `parent_meal_id = mealEventId`). The picker shows thumbnails from both pools. Selected photo gets `is_highlight: true` on the meal_event post's `photos` jsonb; previously-highlighted photo (if any) gets `is_highlight` cleared. CC should determine the simplest implementation: either a custom picker modal or reuse of an existing photo-selection component. The persistence mechanism is also CC's choice — extending `UpdatePostPatch` to support a `photos` jsonb patch, or writing directly to Supabase on the meal_event post's `photos` column. Document the choice in SESSION_LOG. **TIME-BOX FALLBACK:** if building the highlight photo picker takes more than ~1 hour of implementation effort (the dual-pool sourcing + is_highlight toggle + persistence is the most complex of the 6 host menu items), defer it entirely. Ship the other 5 host menu items, capture "Edit highlight photo on MealEventDetailScreen" as a new deferred item, and move on. Do not let this one item delay the rest of Pass 2.

5. **Manage attendees** — opens `AddCookingPartnersModal` with `existingParticipantIds` set to current attendee user IDs, `defaultRole='ate_with'`. Same Checkpoint 5 manage-mode pattern. On confirm, diff and add/remove `post_participants` rows with `role='ate_with'` and `status='approved'` on the meal_event post. Same inline bypass pattern as Checkpoint 5 (direct Supabase calls for add/remove rather than extending `postParticipantsService`).

6. **Delete event** — confirmation Alert with dynamic copy:
   ```
   "Delete [event title]?"
   "This will remove the event. The N cook posts from attendees will remain as solo posts."
   [Cancel] [Delete event (destructive)]
   ```
   On confirm:
   1. `UPDATE posts SET parent_meal_id = NULL WHERE parent_meal_id = mealEventId` — detach all linked cook posts
   2. `DELETE FROM posts WHERE id = mealEventId` — delete the meal_event row (FK cascade handles `post_likes`, `post_comments`, `post_participants`, `meal_photos`)
   3. `Alert.alert('Event deleted')` then `navigation.goBack()`

   The detach step is critical — it must run BEFORE the delete, otherwise FK cascade might try to cascade to the linked posts (check whether `parent_meal_id` is a FK with CASCADE or just a nullable column — if it's not a FK, the detach step is still correct but the ordering is less critical).

### Attendee overflow menu (3 items, visible when `isAttendee && !isHost`)

1. **Add photo to shared media** — opens image picker, uploads to `meal_photos` table with `meal_id = mealEventId`, `user_id = currentUserId`. On success, refetch shared media and refresh Block 7. Use the existing `imageStorageService` upload pattern if available, or write a direct insert.

2. **Add event comment** — scrolls to Block 8 (About the evening) and focuses the comment composer. If using the tap-through fallback (same as CookDetailScreen Block 13), this navigates to CommentsScreen with the meal_event post ID.

3. **Leave event** — confirmation Alert:
   ```
   "Leave [event title]?"
   "You'll still keep any cook posts you made for this event."
   [Cancel] [Leave (destructive)]
   ```
   On confirm: delete the current user's `post_participants` row for this meal_event where `role='ate_with'`. Do NOT touch `parent_meal_id` on the user's linked cook posts — posts stay linked, user loses attendee status only. After deletion, `navigation.goBack()`.

### `console.warn` instrumentation

Same pattern as Checkpoint 5 Fix Pass #2. ALL host and attendee menu handlers get `console.warn` at entry + success + failure. Use the `[MealEventDetailScreen]` prefix.

### `UpdatePostPatch` extension

Extend the existing `UpdatePostPatch` interface in `lib/services/postService.ts`:

```typescript
export interface UpdatePostPatch {
  title?: string;
  description?: string | null;
  parent_meal_id?: string | null;
  meal_time?: string | null;      // NEW for Checkpoint 6
  meal_location?: string | null;  // NEW for Checkpoint 6
}
```

No other changes to `postService.ts`.

---

## Sub-section 6.6 — SESSION_LOG finalization

After Pass 2 completes, append to the existing SESSION_LOG entry:

- Sub-section 6.5 findings (per-menu-item, same detail level as Checkpoint 5's Pass 2)
- `UpdatePostPatch` extension confirmation
- Highlight photo picker implementation choice
- DateTimePicker integration outcome
- Visual verification PENDING — Pass 2 checklist:
  20. Host overflow menu shows all 6 items
  21. Edit title — inline, save on blur, empty rejected
  22. Edit date/time — picker opens, selection persists
  23. Edit location — inline, save on blur
  24. Edit highlight photo — picker shows photos from both pools, selection renders as new hero
  25. Manage attendees — modal opens with existing attendees pre-selected, add/remove works, Block 6 refreshes
  26. Delete event — confirmation with dynamic copy, linked posts detached (verify by checking a former linked post now renders as L1 solo on the feed), event deleted, navigation back to feed
  27. Attendee overflow menu shows 3 items (test from a non-host attendee account if possible, or verify via code-reading if only one test account)
  28. Add photo to shared media — picker opens, photo appears in Block 7 grid
  29. Leave event — confirmation, participant removed, navigation back
  30. No regression on CookDetailScreen or feed

- **Decisions to write to `docs/PHASE_7_SOCIAL_FEED.md`:**
  - **D51** — full text from this prompt
  - Update D49's "Implementation timing" to note D51 resolves schema coupling

- **Deferred items** — starting at the next available P-number after P7-92. Capture any new items surfaced during execution.

- **GO / NO-GO recommendation for Checkpoint 7** (cleanup pass)

---

## What this checkpoint does NOT include

- **D49 renderer.** Deferred. D51 resolves the schema coupling; D49 ships independently.
- **Legacy `MealDetailScreen` deletion.** Checkpoint 7.
- **Planned-dish hybrid rows.** P7-48 data model doesn't exist. Skipped.
- **Full post editing (7M).**
- **RSVP flow redesign.**
- **Notification tiering for meal events.**
- **Photo carousel peek, multi-select, swipe reliability.** Checkpoint 5.5.
- **CookDetailScreen layout changes.** Checkpoint 5.5.
- **Changes to `CookCard.tsx`, `groupingPrimitives.tsx`, `CookDetailScreen.tsx`.**
- **Removing the flask debug button.** Stays through Checkpoint 7.

---

## Files you are expected to touch

**Pass 1:**
- `docs/DDL_CHECKPOINT_6_EATER_RATINGS.sql` — **new file**, DDL for Tom to run
- `screens/MealEventDetailScreen.tsx` — **new file**, bulk of the work
- `lib/services/eaterRatingsService.ts` — **new file**, 2 exports
- `screens/FeedScreen.tsx` — rewire `navigateToMealEvent` to `MealEventDetail`
- `App.tsx` — register `MealEventDetail` route
- `docs/SESSION_LOG.md` — partial entry with PAUSED marker

**Pass 2:**
- `screens/MealEventDetailScreen.tsx` — wire host + attendee menus
- `lib/services/postService.ts` — extend `UpdatePostPatch` with `meal_time` + `meal_location`
- `docs/SESSION_LOG.md` — replace PAUSED with full closeout
- `docs/PHASE_7_SOCIAL_FEED.md` — write D51, update D49, add deferred items

**Files you should NOT touch:**
- `components/feedCard/CookCard.tsx`
- `components/feedCard/groupingPrimitives.tsx`
- `components/feedCard/sharedCardElements.tsx`
- `screens/CookDetailScreen.tsx`
- `screens/MealDetailScreen.tsx` (legacy, Checkpoint 7 deletes)
- `screens/_Phase7ITestHarness.tsx`
- `lib/services/mealService.ts` (the existing `getMealEventDetail` is consumed as-is)
- The flask debug button

---

## Verification

### Pass 1 self-check

1. TypeScript compiles cleanly
2. `eater_ratings` table exists and test query succeeds
3. Route registration works — tapping an L4 prehead or L5 header navigates to MealEventDetailScreen
4. All 8 content blocks render when data is present
5. Eater rating pills show "Tap to rate" for attendees, absent for non-attendees
6. D51 engagement works — likes and comments on the meal_event post via existing infrastructure
7. `grep -n "MealDetail" screens/FeedScreen.tsx` — only references are in the legacy `navigateToMealEvent` replacement; no stray routes to the old screen
8. No regression on CookDetailScreen or feed

### Pass 2 self-check

9. TypeScript compiles
10. All 6 host menu items wired with `console.warn` instrumentation
11. All 3 attendee menu items wired with `console.warn` instrumentation
12. `UpdatePostPatch` extended with `meal_time` and `meal_location`
13. Delete event detaches linked posts before deleting the event row
14. Test harness still works
15. Checkpoint 4.5 target posts still render (Anthony kombucha, Chickpea soup, Watermelon feta)

---

## Hard stop requirements

**Pass 1:** After 6.4, write partial SESSION_LOG with PAUSED marker. Do NOT start 6.5.

**Pass 2:** After 6.5 + 6.6, HARD STOP. Do NOT start Checkpoint 7. Do NOT delete `MealDetailScreen`. Do NOT build D49 renderer. Wait for Tom's review.

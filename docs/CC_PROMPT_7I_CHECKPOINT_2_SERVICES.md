# Phase 7I Checkpoint 2 — Services Layer

**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 2 of 7
**Prior work:** Checkpoint 1 complete. `posts.post_type='meal'` has been migrated to `'meal_event'`. `PostType` union updated in `lib/services/postParticipantsService.ts` with `'meal_event'` added (`'meal'` retained for backward compat until Checkpoint 7). DB CHECK constraint `posts_post_type_check` now allows `('dish', 'meal', 'meal_event')`. Snapshot table `posts_backup_pre_7i` exists with 2,102 rows. 363 meal_event rows, 1,739 dish rows, 659 dishes with parent_meal_id set.

**Required reading before starting:**
1. `docs/PHASE_7I_MASTER_PLAN.md` — full Phase 7I scope, wireframes L1-L7, D47 supersession notes, all seven checkpoints
2. `docs/frigo_phase_7i_wireframes.html` — visual reference for L1-L7 feed states
3. `docs/SESSION_LOG.md` — Checkpoint 1 entry (`2026-04-13 — Phase 7I Checkpoint 1 — Data migration meal → meal_event`) for post-migration DB state

**Hard stop at end of checkpoint.** Do not proceed to Checkpoint 3. Write a SESSION_LOG entry and wait for Tom's review.

---

## Goal

Build the services and types layer that Checkpoints 3-6 will consume. Four discrete sub-sections: (2.1) in-place `mealService.ts` fixup so the app keeps working through Checkpoints 2-5, (2.2) new services for cook partner links, meal event context, and cook history, (2.3) new `buildFeedGroups` function in `feedGroupingService.ts` (reusing the existing union-find DFS), (2.4) new types file `lib/types/feed.ts`.

**Scope lock:** No component changes. No screen changes. No new screens. No changes to `FeedScreen.tsx` — that is Checkpoint 4's work. No changes to `createDishPost` or other write paths — those stay untouched. No deletion of `groupPostsForFeed` (the old function) — it stays in place until Checkpoint 7 deletes it. We are writing new code alongside old code, not replacing.

---

## Context: what you'll find in the codebase

### Existing services Tom has reviewed during planning

**`lib/services/feedGroupingService.ts`** — contains the union-find DFS algorithm that builds connected components from a relationship map. The algorithm is 30 lines (`groupConnectedPosts` function) and is correct. The inputs (`getPostRelationships` querying `post_relationships` table) and outputs (`FeedItem` union of `GroupedPost`/`SinglePost`) are what Checkpoint 2 replaces. **Reuse the DFS pattern; replace the input gathering and the output shape.** The old `groupPostsForFeed` function stays in place.

**`lib/services/postParticipantsService.ts`** — contains `getPostParticipants`, `getPostParticipantsByRole` (returns `{ cooks, eaters, external }`), `getPendingApprovals`, and the `ParticipantRole` type (`'sous_chef' | 'ate_with' | 'host'`). Also contains the updated `PostType` union from Checkpoint 1. This file grows in Checkpoint 2 — add new exports for `getLinkedCookPartners`.

**`lib/services/mealService.ts`** — ~1200 lines. Contains `createMeal`, `getMealsForFeed`, `getMealDishes`, `detectPlannedMealForCook`, and many other meal operations. **Every function in this file currently hardcodes `post_type: 'meal'` on queries and inserts.** Post-migration, these all return empty or fail against the CHECK constraint. Sub-section 2.1 updates this file in place.

**`lib/services/recipeHistoryService.ts`** — contains `getCookingHistory(userId)` which returns per-recipe aggregate history (Map keyed by recipe_id with `times_cooked`, `last_cooked`, `first_cooked`, `avg_rating`, `latest_rating`), and `getFriendsCookingInfo(userId)`. Both are intact and working. Checkpoint 2 adds a new function alongside these.

**`lib/services/postService.ts`** — contains `createDishPost`. Currently writes to `posts` and calls `addDishesToMeal` when `parentMealId` is set. Does NOT currently write to `post_participants` (verify this during execution — if my read is wrong, flag it and adjust `getLinkedCookPartners` logic accordingly).

### Existing data you should know about

- **421 sous_chef participant rows are on dish posts** (post_type='dish'). This is the primary input for `getLinkedCookPartners`.
- **935 ate_with participant rows are on meal_event posts.** This is the primary input for `getMealEventDetail`'s attendees list.
- **362 host participant rows are on meal_event posts.** This is the primary input for identifying the event host.
- **252 host participant rows are on dish posts.** These are historical noise — `createDishPost` does NOT currently write them, but they exist in the data. `getLinkedCookPartners` must either filter them out or CC must verify during execution whether any code path still writes them. **NEEDS REVIEW during execution** — grep the codebase for any write to `post_participants` with `role: 'host'` and confirm whether the dish-post host rows are historical-only or actively being written.

---

## Sub-section 2.1 — In-place `mealService.ts` fixup

**Why this is first:** The app is currently half-broken in a subtle way — `getMealsForFeed` returns empty (correct for Checkpoint 4's goal), but `createMeal` attempts to `INSERT post_type: 'meal'` which the updated CHECK constraint now rejects. Any code path that creates a new meal will throw. This blocks testing of other flows through Checkpoints 2-6. Fix it first so the rest of Checkpoint 2 executes against a working app.

**What to change:**

1. **`Meal` interface** (near top of file): change `post_type: 'meal'` → `post_type: 'meal_event'`.

2. **Every `.eq('post_type', 'meal')` in queries:** update to `'meal_event'`. Search for the exact string. You should find roughly 10-15 call sites across:
   - `detectPlannedMealForCook` (the `.eq('post_type', 'meal')` filter plus the query comment)
   - `getMeal` (single meal fetch)
   - `updateMeal`, `completeMeal`, `deleteMeal` (meal CRUD paths)
   - `addDishesToMeal` (the `existingMealPost` check)
   - `getMealsForFeed` (the main feed query — even though Checkpoint 4 will stop calling this function, it still needs to work for anyone else who imports it during the transition)
   - `wrapDishIntoNewMeal` (the `post_type='dish'` check for the dish, which stays dish — but if you see any meal-side check, update it)
   - Any other `.eq('post_type', 'meal')` site revealed by grep

3. **Every `post_type: 'meal'` in inserts:** update to `'meal_event'`. Primary site is `createMeal`'s INSERT. Also check `approveParticipantInvitation` in `postParticipantsService.ts` which inserts a new post mirroring `originalPost.post_type` — if the original is a dish, this stays `'dish'`, but if the caller is passing through a meal context, verify the flow doesn't accidentally create orphan `'meal'` rows.

4. **`post_type: 'meal'` as a string literal in object literals or conditionals:** search for bare `'meal'` string. Be careful not to change the `PostType` union in `postParticipantsService.ts` which still needs `'meal'` in it for backward compat.

5. **Comments and docstrings:** update any comment that describes these functions as operating on "meal posts" to clarify they operate on "meal_event posts". Don't rewrite narrative comments, just fix the ones that would mislead a future reader.

**What NOT to change:**
- Function names (`getMealsForFeed`, `createMeal`, etc.) — these stay even though they're slightly misleading now. Renaming them would cascade into all callers and that's Checkpoint 7's scope.
- The `post_relationships` write in `addDishesToMeal` — leave it alone. It's dead weight but harmless.
- The `meal_participants` table references (this table is separate from `post_participants` and isn't part of the migration).
- `LogCookSheet` or any other screen/component that imports from this service.

**Verification for 2.1:**
- TypeScript compiles cleanly on the touched file: `npx tsc --noEmit`
- Grep the file for remaining `'meal'` string literals (excluding `'meal_event'`, `'meal_type'`, `'meal_status'`, `'meal_location'`, `'meal_time'`, `'meal_photos'`, `'meal_participants'`, `'meal_plan'`). The remaining hits should all be about column names or variable names, not `post_type` values.
- Smoke test mentally: `createMeal({ title: 'Test' })` now inserts `post_type='meal_event'`, which the CHECK constraint accepts.

---

## Sub-section 2.2 — New services for cook partner links, meal event context, and cook history

Add these functions. They are consumed by Checkpoints 3 (CookCard uses `getLinkedCookPartners`), 4 (FeedScreen uses `getMealEventForCook` and `buildFeedGroups`), 5 (CookDetailScreen uses `getCookHistoryForUserRecipe`), 6 (MealEventDetailScreen uses `getMealEventDetail`). Write them in `postParticipantsService.ts`, `mealService.ts`, and `recipeHistoryService.ts` respectively — extend existing files rather than creating new ones.

### 2.2.1 — `getLinkedCookPartners` (in `postParticipantsService.ts`)

**Purpose:** For a given dish post, return the list of other cook posts linked to it via a shared cook partner — i.e., posts where the dish post's author appears as a `sous_chef` on another user's cook post, OR where another user is a `sous_chef` on the dish post's cook, AND that other user has their own reciprocal cook post. Under the new model, these form L3b linked pairs.

**Signature:**
```typescript
export interface LinkedCookPartner {
  post_id: string;           // the partner's own cook post ID
  user_id: string;           // the partner's user ID
  username: string;
  display_name?: string;
  avatar_url?: string | null;
  role: ParticipantRole;     // usually 'sous_chef', but capture for clarity
}

export async function getLinkedCookPartners(
  postId: string,
  postAuthorId: string,
  followingIds: string[]
): Promise<LinkedCookPartner[]>
```

**Algorithm:**

1. Fetch all `post_participants` rows where `post_id = $postId` AND `role = 'sous_chef'` AND `status = 'approved'`. These are the users tagged as cook partners ON this post.
2. For each tagged user, find whether they have their own dish post at roughly the same time window (within ±60 minutes of the original post's `created_at`) where the original post's author is tagged as their `sous_chef`. This is the reciprocal-tagging pattern — real L3b pairs look like "Tom posts with Anthony tagged, Anthony posts with Tom tagged, both at 19:30."
3. Apply visibility filter: only return partners whose user_id is in `followingIds` (the viewer follows them) OR who is the viewer themselves. If a partner is not followed, drop the result from the array.
4. Return the array of matches with the partner's own post ID (not the original post's ID).

**Edge cases to handle:**
- **No tagged partners:** return empty array. Not an error.
- **Tagged partner but no reciprocal post:** this is the L3a state (cook partner tagged but hasn't posted their own version). Return an empty array — L3a is rendered by Checkpoint 3's prehead, not by linked-pair grouping. `getLinkedCookPartners` is specifically for the linked-pair case.
- **Historical `host` role rows on dish posts:** filter these out explicitly. `role = 'sous_chef'` only, not `'host'`.
- **Self-referential tags (user tags themselves):** shouldn't exist in data but filter defensively. `participant_user_id !== postAuthorId`.

**NEEDS REVIEW during execution:** the 60-minute time window is a heuristic. During execution, log the number of matches found on the first few real queries and check whether 60 minutes is too tight or too loose. If reciprocal cooks at the same meal cluster at different timestamps (e.g., one logged right after eating, the other logged an hour later when remembering), we may need a wider window like ±180 minutes. If you see frequent near-misses, flag it in the SESSION_LOG and propose a wider window as a Checkpoint 4 follow-up.

### 2.2.2 — `getMealEventForCook` (in `mealService.ts`)

**Purpose:** For a given dish post, return the minimal meal event context needed to render the L4 prehead ("Tom's dish at Friday night crew") above a cook card in the feed.

**Signature:**
```typescript
export interface MealEventContext {
  id: string;                // meal_event post ID
  title: string;
  meal_time?: string;
  meal_location?: string;
  host_id: string;
  host_username?: string;
  host_display_name?: string;
  host_avatar_url?: string | null;
  total_contributor_count: number;  // how many unique cook post authors linked to this event
}

export async function getMealEventForCook(
  postId: string
): Promise<MealEventContext | null>
```

**Algorithm:**

1. Fetch the cook post's `parent_meal_id`. If null, return null.
2. Fetch the meal_event post row (`posts.id = parent_meal_id` AND `post_type = 'meal_event'`).
3. Fetch the host's profile via `post_participants` WHERE `post_id = meal_event_id` AND `role = 'host'` (or fall back to `meal_event.user_id` if no explicit host row exists, then join on `user_profiles`).
4. Count distinct `user_id` values across dish posts where `parent_meal_id = meal_event_id` to get `total_contributor_count`.
5. Return the assembled `MealEventContext` or null if the meal_event row doesn't exist (orphan ref — shouldn't happen after Checkpoint 1's 0 broken refs verification, but handle defensively).

**Note on host lookup:** per Checkpoint 1 findings, `post_participants` has 362 host rows on meal_event posts, which is close to the total 363 meal_event count. There's likely one orphan meal_event without an explicit host participant row. Use the fallback to `meal_event.user_id` for that edge case.

### 2.2.3 — `getMealEventDetail` (in `mealService.ts`)

**Purpose:** Full meal event detail for L7 `MealEventDetailScreen` consumption in Checkpoint 6. Returns everything needed to render the detail screen: event metadata, host, all linked cook posts, attendees, shared media.

**Signature:**
```typescript
export interface MealEventDetail {
  event: {
    id: string;
    title: string;
    description?: string;
    meal_time?: string;
    meal_location?: string;
    highlight_photo?: any;      // the photo flagged as is_highlight, or first photo as fallback
    created_at: string;
  };
  host: {
    user_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string | null;
  };
  cooks: Array<{
    post_id: string;
    post_title: string;
    post_rating?: number | null;
    user_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string | null;
    recipe_id?: string | null;
    recipe_title?: string | null;
    photos?: any[];
    created_at: string;
  }>;
  attendees: Array<{
    user_id: string;
    username: string;
    display_name?: string;
    avatar_url?: string | null;
    private_rating?: number | null;  // only populated if the viewer has permission to see it (D43)
  }>;
  shared_media: Array<{
    id: string;
    photo_url: string;
    caption?: string;
    uploaded_by_user_id: string;
    uploaded_by_username: string;
    created_at: string;
  }>;
  stats: {
    total_dishes: number;
    unique_cooks: number;
    total_attendees: number;
    avg_rating?: number;             // average of cook posts' ratings
  };
}

export async function getMealEventDetail(
  eventId: string,
  currentUserId: string
): Promise<MealEventDetail | null>
```

**Implementation notes:**
- Reuse existing queries where possible: `getMealDishes` returns dish data but via RPC `get_meal_dishes` which includes recipe fields. Verify what the RPC returns and extract the fields we need.
- The `attendees` list comes from `post_participants` WHERE `post_id = eventId` AND `role = 'ate_with'` AND `status = 'approved'`.
- The `private_rating` field on attendees is D43's eater-rating privacy model — only visible if the viewer is the post author OR the attendee themselves OR (optionally) an admin. Leave the filter logic in place and default to null for attendees the viewer can't see ratings for.
- `shared_media` comes from `meal_photos` table.
- `highlight_photo` — look for a photo in `posts.photos` JSONB on the meal_event row where `is_highlight = true`, fall back to first photo if none flagged.

### 2.2.4 — `getCookHistoryForUserRecipe` (in `recipeHistoryService.ts`)

**Purpose:** For L6 CookDetailScreen's "Your history with this recipe" section. Given a (user, recipe) pair, return the list of individual prior cook posts with the minimum data needed to render each as a row (date, rating, optional photo thumbnail, optional notes preview).

**Signature:**
```typescript
export interface CookHistoryEntry {
  post_id: string;
  cooked_at: string;
  rating: number | null;
  title?: string;
  notes?: string;
  photo_thumbnail?: any;  // first photo, if any
}

export async function getCookHistoryForUserRecipe(
  userId: string,
  recipeId: string
): Promise<CookHistoryEntry[]>
```

**Algorithm:**

1. Query `posts` WHERE `user_id = $userId` AND `recipe_id = $recipeId` AND `post_type = 'dish'` ORDER BY `cooked_at` DESC (or `created_at` DESC if `cooked_at` is null).
2. Map each row to `CookHistoryEntry`. Extract `photo_thumbnail` as `photos[0]` if photos exist, else null.
3. Return the full list. No pagination — L6 shows all history for the recipe.

**Edge case:** if the cook post's `cooked_at` is null (legacy data), fall back to `created_at`. This matches Phase 7G's planned pattern for backdated posts.

### 2.2.5 — Re-export considerations

All new functions are added to the existing service files (no new service files). Update the exports section at the bottom of each file if the project uses a barrel pattern. Otherwise just leave them as named exports that consumers import directly.

---

## Sub-section 2.3 — New `buildFeedGroups` in `feedGroupingService.ts`

**Purpose:** The new feed grouping logic that Checkpoint 4's FeedScreen will call. Takes a list of cook posts plus the viewer's follow graph, produces `FeedGroup[]` where each group has 1+ posts linked by either cook-partner relationship or meal-event relationship. Rule C visibility: a group only forms if at least 2 posts in the group are visible to the viewer; otherwise the posts render as solo cards.

**Why a new function, not a rewrite of `groupPostsForFeed`:** the old function stays in place until Checkpoint 7 deletes it. Checkpoint 4 switches FeedScreen to call the new function; the old function becomes dead code. This is cleaner than modifying a function in place because it means Checkpoints 2 and 4 can be reviewed/tested independently.

**Signature:**
```typescript
export interface FeedGroup {
  id: string;                    // stable group ID (earliest post ID in the group, for key stability)
  type: 'solo' | 'linked';       // 'solo' = single cook card, 'linked' = 2+ posts in a Strava-style indent stack
  posts: CookCardData[];         // the cook posts in this group, sorted chronologically
  linkContext?: {
    kind: 'cook_partner' | 'meal_event';
    // For cook_partner: no extra fields; the linkage is implicit in the posts array
    // For meal_event: the meal event ID so Checkpoint 3's group header can fetch full meal context
    mealEventId?: string;
  };
}

// CookCardData is the new per-cook-post data shape that Checkpoint 3's CookCard consumes.
// Define it in lib/types/feed.ts (see sub-section 2.4). It includes everything needed to
// render a single cook card: post fields, recipe fields, author profile, likes, comments,
// participants, highlights.
export interface CookCardData {
  // Post fields
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  rating: number | null;
  cooking_method: string | null;
  modifications?: string | null;
  notes?: string | null;
  photos: any[];
  created_at: string;
  cooked_at?: string | null;
  parent_meal_id?: string | null;

  // Recipe fields (denormalized)
  recipe_id?: string | null;
  recipe_title?: string | null;
  recipe_image_url?: string | null;
  recipe_cook_time_min?: number | null;
  recipe_cuisine_types?: string[] | null;
  recipe_vibe_tags?: string[] | null;
  recipe_times_cooked?: number | null;
  chef_name?: string | null;  // for chef attribution line

  // Author profile
  author: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string | null;
    subscription_tier?: string;
  };
}

export async function buildFeedGroups(
  posts: CookCardData[],
  currentUserId: string,
  followingIds: string[]
): Promise<FeedGroup[]>
```

**Algorithm:**

1. **Gather edges.** For each post in the input array, collect two kinds of relationships:
   - **Cook-partner edges:** call `getLinkedCookPartners(post.id, post.user_id, followingIds)` for each post. The returned partner post IDs are the other end of an edge. Batch this — don't call it 200 times individually; either write a bulk variant or accept the N+1 for now and optimize if Checkpoint 4 verification shows it's slow.
   - **Meal-event edges:** two posts with the same non-null `parent_meal_id` are connected via the meal event. This is cheaper — you already have `parent_meal_id` in the post data, just group by it.

2. **Build relationship map.** Same structure as the old `groupConnectedPosts` DFS input: `Map<string, Set<string>>` where keys are post IDs and values are sets of connected post IDs. Combine both edge types into a single map.

3. **Run DFS union-find.** Reuse the algorithm from the old `groupConnectedPosts` function — DFS each unvisited post, collect connected component, record as a group.

4. **Apply Rule C visibility filter.** For each connected component:
   - Count how many posts in the component are visible to the viewer. A post is visible if its `user_id` is in `followingIds` OR is the current user OR the post has `visibility = 'everyone'`.
   - If 2+ posts in the component are visible → form a `linked` group with those posts.
   - If only 1 post is visible → the group degrades to a `solo` group containing just that post. The invisible posts are dropped.
   - If 0 posts are visible → the entire component is dropped (shouldn't happen in practice because the input array is already pre-filtered by visibility in FeedScreen, but handle defensively).

5. **Classify group's `linkContext`:** if all edges in the group were cook-partner edges, `linkContext.kind = 'cook_partner'`. If any edge was a meal-event edge, `linkContext.kind = 'meal_event'` and `linkContext.mealEventId = <the shared parent_meal_id>`. If both kinds coexist in one component (edge case: Tom and Anthony cook together at a Friday night crew event — they're linked BOTH by sous_chef AND by meal event), prefer `'meal_event'` because the event context is more visually informative.

6. **Sort posts within each group** chronologically by `created_at` ascending (earliest first). This affects how Checkpoint 3 renders the indent stack.

7. **Sort groups in the output array** by the `max(created_at)` of posts in each group, descending (newest first). This affects feed order.

8. **Return `FeedGroup[]`.**

**Batching consideration:** `getLinkedCookPartners` runs once per post. For a 200-post feed, that's 200 queries minimum just for the cook-partner lookup. For Checkpoint 2 you can accept the N+1 and measure during Checkpoint 4 runtime; if it's slow, write a bulk variant `getLinkedCookPartnersForPosts(postIds[])` later. **NEEDS REVIEW during Checkpoint 4** — flag the perf characteristic in the SESSION_LOG entry for this checkpoint so Checkpoint 4's verification knows to watch feed load times.

**Alternative batching approach (optional — consider if straightforward):** since the cook-partner edges are queried from `post_participants` with `role='sous_chef'`, you can do a single `IN` query against all post IDs in the input array to fetch all sous_chef rows at once, then build the adjacency map client-side. This is probably the right move for the batch — write `getLinkedCookPartnersForPosts` from the start if it's not much more complex than the individual version.

---

## Sub-section 2.4 — New types in `lib/types/feed.ts`

**Why a new file:** `lib/types/` exists and is organized by domain (cooking, grocery, pantry, recipe features, search, space, store). Feed types don't belong in any existing file. `PostType` lives in `postParticipantsService.ts` per historical convention, which is inconsistent with the `lib/types/` pattern but Checkpoint 2 is not the place to fix it. Create `lib/types/feed.ts` to establish the pattern for future Phase 7 feed types; relocation of `PostType` is Checkpoint 7's concern.

**File contents:**

```typescript
// lib/types/feed.ts
// Phase 7I Checkpoint 2 — types for the cook-post-centric feed model
// See docs/PHASE_7I_MASTER_PLAN.md for full context

/**
 * CookCardData — the per-cook-post data shape that CookCard consumes.
 * Denormalizes recipe and author fields onto the post so the card can
 * render without follow-up queries.
 */
export interface CookCardData {
  // ... (move the interface body from feedGroupingService.ts into here)
}

/**
 * FeedGroup — a unit in the feed. Either a solo cook card or a linked
 * stack of 2+ cook cards. The linkContext tells Checkpoint 3's rendering
 * layer whether to show a meal event group header (L5) or a cook-partner
 * indent (L3b).
 */
export interface FeedGroup {
  // ... (move the interface body from feedGroupingService.ts into here)
}

/**
 * LinkContext — describes why posts in a FeedGroup are linked together.
 * 'cook_partner' → L3b Strava-style indent pair
 * 'meal_event' → L5 meal event group header with contributor stack
 */
export type LinkContextKind = 'cook_partner' | 'meal_event';

export interface LinkContext {
  kind: LinkContextKind;
  mealEventId?: string;  // populated only when kind === 'meal_event'
}

/**
 * MealEventContext — minimal meal event data for L4 prehead rendering
 * (solo cook card with a "Tom's dish at Friday night crew" prehead above).
 * See getMealEventForCook in mealService.ts.
 */
export interface MealEventContext {
  // ... (move the interface body from mealService.ts into here)
}
```

**Import sites to update after moving types:**
- `feedGroupingService.ts` — imports `CookCardData`, `FeedGroup`, `LinkContext` from `lib/types/feed`
- `mealService.ts` — imports `MealEventContext` from `lib/types/feed` (the type interface lives in types, the function implementation stays in mealService)
- No consumers touch these yet (they're for Checkpoint 3/4), so the import fanout is localized.

---

## Verification for the full checkpoint

After all four sub-sections land:

1. **TypeScript compiles cleanly on all touched files:** `npx tsc --noEmit`. Zero errors.

2. **Grep verification:**
   - `grep -rn "post_type.*'meal'" lib/services/` should return only `PostType` union definition (which retains `'meal'` for backward compat) and any test-data strings. No query or insert should use `'meal'` as a `post_type` value.
   - `grep -rn "getLinkedCookPartners\|getMealEventForCook\|getMealEventDetail\|getCookHistoryForUserRecipe\|buildFeedGroups" lib/` should show the new functions defined in their respective files and no callers yet (callers come in Checkpoints 3-6).

3. **Runtime smoke test:** Start the app, open the Feed tab, confirm it still loads without errors. Expected behavior is unchanged from Checkpoint 1's post-migration state — the new services are defined but not yet consumed by FeedScreen, so behavior is identical. Any new error in the console means a Sub-section 2.1 edit broke a caller that still expects `'meal'`.

4. **Write-path smoke test (non-destructive):** Do NOT actually create a new meal event in the UI (that's a write that would pollute test data). Instead, mentally trace: if you called `createMeal({ title: 'Smoke test' })` via the updated service, would it insert `post_type='meal_event'` and succeed against the CHECK constraint? Verify by reading the updated INSERT statement.

5. **Dry-run `buildFeedGroups` against real data:** write a small test harness (a throwaway `.ts` file in `scratch/` or similar, don't commit) that fetches 20 dish posts via supabase, fetches the current user's follow list, calls `buildFeedGroups(posts, currentUserId, followingIds)`, and logs the output shape. Confirm:
   - At least one `'linked'` group forms (probably via real Tom↔Anthony reciprocal cook pairs from March — see Checkpoint 1 SESSION_LOG findings)
   - At least one `'meal_event'` linkContext appears if the fetched sample includes dishes from a multi-contributor meal event
   - Solo groups correctly contain exactly one post
   - Rule C degradation works: post a hypothetical scenario where the viewer follows only one of two cook partners — the group should degrade to solo
   - Delete the test harness before committing.

6. **Performance baseline:** in the dry-run, log the total time for `buildFeedGroups` on 20 posts. Include this number in the SESSION_LOG so Checkpoint 4 can compare against a full 200-post run.

---

## Files you are expected to touch

- `lib/services/mealService.ts` — sub-sections 2.1 and 2.2.2, 2.2.3 (in-place fixup + two new functions)
- `lib/services/postParticipantsService.ts` — sub-section 2.2.1 (add `getLinkedCookPartners` and the bulk variant if you went with the batch approach)
- `lib/services/recipeHistoryService.ts` — sub-section 2.2.4 (add `getCookHistoryForUserRecipe`)
- `lib/services/feedGroupingService.ts` — sub-section 2.3 (add `buildFeedGroups` as a new export; do NOT delete `groupPostsForFeed` or any of the old types)
- `lib/types/feed.ts` — sub-section 2.4 (new file)

**Files you should NOT touch:**
- Any screen file (`screens/*.tsx`)
- Any component file (`components/*.tsx`)
- `lib/services/postService.ts` (createDishPost stays untouched)
- `App.tsx` or navigation config
- Package files (`package.json`, `tsconfig.json`, `app.json`)
- `lib/supabase.ts` or any DB connection code
- Database migrations (no new SQL in this checkpoint)

---

## Hard stop requirements

After all verification steps pass, write a SESSION_LOG entry titled `2026-04-13 — Phase 7I Checkpoint 2 — Services layer` including:

- **Files modified:** full list with line counts or function names added
- **Sub-section 2.1 findings:** how many `'meal'` → `'meal_event'` sites were updated, any surprises (e.g., `post_type='meal'` references in unexpected files, any write path that looked like it might conflict with the CHECK constraint but didn't need updating)
- **Sub-section 2.2 findings for each new function:**
  - Schema gotchas (e.g., does `meal_photos` have the columns the detail function expects?)
  - Any NEEDS REVIEW items that surfaced during implementation
  - Confirmation that the 60-minute time window for `getLinkedCookPartners` worked on the dry-run (or flag if it needs adjustment)
  - Confirmation that `createDishPost` does NOT currently write `host` role rows (answers the historical-noise question from context above)
- **Sub-section 2.3 findings:**
  - How many queries `buildFeedGroups` runs per invocation (the batching decision)
  - Dry-run output: how many groups formed, what types, whether Rule C degradation appears to work correctly
  - Performance baseline from the 20-post dry run
- **Sub-section 2.4 findings:**
  - Whether any consumer file imports broke when types moved
  - Any decision to keep a type definition in the service file rather than moving to `lib/types/feed.ts` (and why)
- **NEEDS REVIEW items flagged for Checkpoint 4 or later:**
  - Time window adjustment for `getLinkedCookPartners`
  - Batching strategy performance on full 200-post feed
  - Historical `host` rows on dish posts (confirmed as noise, or flag if found actively written)
  - Any other surprise
- **GO / NO-GO recommendation for Checkpoint 3:** based on verification results, should Checkpoint 3 (CookCard component build) proceed?

**Do NOT proceed to Checkpoint 3.** Do not start any component work. Do not touch CookCard or any other new component. Hard stop. Wait for Tom.

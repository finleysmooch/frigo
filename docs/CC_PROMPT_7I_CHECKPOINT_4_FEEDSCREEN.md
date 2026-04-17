# Phase 7I Checkpoint 4 — FeedScreen Rewrite

**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 4 of 7
**Prior work:**
- **Checkpoint 1 (complete):** Data migration `post_type='meal'` → `'meal_event'`. 363 rows migrated. Snapshot in `posts_backup_pre_7i`.
- **Checkpoint 2 (complete):** Services layer — `getLinkedCookPartners` / `getLinkedCookPartnersForPosts` / `getMealEventForCook` / `getMealEventDetail` / `getCookHistoryForUserRecipe` / `buildFeedGroups`. New types in `lib/types/feed.ts`. In-place `meal`→`meal_event` sweep across 4 service files.
- **Checkpoint 3 (complete):** New components — `CookCard` (with `CookCardInner` extraction after 3.5), grouping primitives (`MealEventPrehead`, `CookPartnerPrehead`, `MealEventGroupHeader`, `LinkedCookStack`), book/friends icon polish, dev-only `screens/_Phase7ITestHarness.tsx`.
- **Checkpoint 3.5 (complete):** Shared-recipe merged groups — `SharedRecipeLinkedGroup` and `NestedMealEventGroup` components, `FeedGroupSubUnit` type, `buildFeedGroups` nested classification with three types (`solo` / `linked_meal_event` / `linked_shared_recipe`). Flat no-gap rendering inside linked groups via single outer `CardWrapper`. SESSION_LOG entry confirms all 7 harness states verified visually by Tom.

**This is the biggest checkpoint in Phase 7I.** Everything built in Checkpoints 1-3.5 converges here — the services, the components, the types — and gets wired into the real feed for the first time. Expect this to take 1-2 sessions. If it spills, that's fine; the scope is large by design.

**Required reading before starting:**
1. `docs/PHASE_7I_MASTER_PLAN.md` — full Phase 7I scope, wireframes L1-L7, D47 + D48 supersession notes
2. `docs/frigo_phase_7i_wireframes.html` — visual reference
3. `docs/SESSION_LOG.md` — Checkpoint 1, 2, 3, 3.5 entries (read all four — each has findings that affect this checkpoint)
4. `docs/CC_PROMPT_7I_CHECKPOINT_3_5_SHARED_RECIPE.md` — the Checkpoint 3.5 prompt, for context on what the rendering layer expects from `buildFeedGroups` output
5. `screens/FeedScreen.tsx` — the file you're rewriting
6. `components/feedCard/CookCard.tsx` — the component you're wiring into the render path
7. `components/feedCard/groupingPrimitives.tsx` — contains `LinkedCookStack`, `SharedRecipeLinkedGroup`, `NestedMealEventGroup`, and the prehead primitives
8. `lib/services/feedGroupingService.ts` — `buildFeedGroups` is what you're calling
9. `lib/types/feed.ts` — `CookCardData`, `FeedGroup`, `FeedGroupSubUnit`, `MealEventContext`
10. `lib/services/mealService.ts` — `getMealEventForCook` is what you call for L4 prehead context

**Hard stop at end of checkpoint.** Do not proceed to Checkpoint 5 (CookDetailScreen). Write a SESSION_LOG entry and wait for Tom's review.

---

## Goal

Replace FeedScreen's current render path with the new cook-post-centric model. Remove the `.is('parent_meal_id', null)` filter so meal-attached dishes return to the feed as first-class items. Stop calling `getMealsForFeed`. Transform `Post[]` to `CookCardData[]` with proper denormalization. Call `buildFeedGroups`. Dispatch on `FeedGroup.type` to the correct renderer. Bundle polish: logo tap-to-top, pull-to-refresh hang investigation, feed cap telemetry. Retire (but do not delete) `PostCard`, `MealPostCard`, `LinkedPostsGroup` from the render path — they stay in the repo until Checkpoint 7.

**Scope lock:** No changes to `PostCard.tsx`, `MealPostCard.tsx`, `LinkedPostsGroup.tsx` — those stay in place, just unreferenced by FeedScreen. No changes to services beyond minor shape fixes if a denormalization invariant requires them. No changes to detail screens (CookDetailScreen stub is fine for navigation). No new components. No DB schema changes.

---

## Sub-section 4.1 — `loadDishPosts` rewrite: query shape + denormalization

**What changes:**

1. **Remove `.is('parent_meal_id', null)`** from the Supabase query. Meal-attached dishes now return to the feed. Expect the result set to grow ~38% (659 formerly-hidden dishes become visible).

2. **Expand the SELECT fields** to include everything `CookCardData` needs. The current query selects `id, user_id, title, rating, cooking_method, created_at, photos, recipe_id, modifications, description, post_type, parent_meal_id`. Add: `cooked_at` (for CookCardData.cooked_at and for the future sort-by-cooked behavior), `notes` (for completeness even though notes isn't rendered on the card — the detail screen needs it and denormalizing once is cheaper than re-fetching).

3. **Enrich the recipes lookup** to include all the fields `CookCardData` denormalizes. The current query fetches `id, title, image_url, cook_time_min, prep_time_min, cuisine_types, vibe_tags, times_cooked, chefs(name)`. This is already most of what we need; verify it includes everything and extend if not.

4. **Transform `Post[]` to `CookCardData[]`.** This is the critical part. The transform must honor these denormalization invariants:

**INVARIANT 1 — `recipe_cook_time_min` is aggregate (cook + prep).** CookCardInner expects a single `recipe_cook_time_min` field that represents total time. The recipes table stores `cook_time_min` and `prep_time_min` as separate columns. When building `CookCardData`, set:

```typescript
recipe_cook_time_min: ((recipe?.cook_time_min ?? 0) + (recipe?.prep_time_min ?? 0)) || null
```

The `|| null` ensures that if both values are 0/null, the field is null (so CookCardInner's stats row correctly omits the cook time entry, matching PostCard's current behavior). This was flagged in Checkpoint 3's SESSION_LOG — PostCard computes the sum at render time from separate fields; CookCardData denormalizes the sum at fetch time. Don't ship the bug.

**INVARIANT 2 — `recipe_image_url` must be consistent across all posts that share the same `recipe_id`.** `SharedRecipeLinkedGroup` assumes that any post in a shared-recipe group has the same `recipe_image_url` value because they share a recipe. The source of truth is `recipes.image_url` for that `recipe_id`. Always derive from the recipes lookup, never from some cached or per-post override. This was flagged in Checkpoint 3.5's SESSION_LOG.

**INVARIANT 3 — `author` is the `user_profiles` row for the post's author.** CookCardData expects `author: { id, username, display_name?, avatar_url?, subscription_tier? }`. Build it from the existing profiles lookup.

**INVARIANT 4 — `chef_name` is flattened from the nested `recipes.chefs.name`.** PostCard reaches through `post.recipes.chefs[0].name`. CookCardData expects a flat top-level `chef_name?: string | null`. Flatten during the transform:

```typescript
const chef = recipe?.chefs
  ? (Array.isArray(recipe.chefs) ? recipe.chefs[0] : recipe.chefs)
  : null;
chef_name: chef?.name ?? null
```

**INVARIANT 5 — `photos` is the raw posts.photos JSONB array.** No transformation. `CookCardData.photos` is typed as `any[]`; pass through the field verbatim.

**INVARIANT 6 — Recipe-backed fields are all prefixed `recipe_` at the top level.** No nested `recipes` object on `CookCardData`. The flattening should produce:
- `recipe_id` (from `post.recipe_id`)
- `recipe_title` (from `recipe?.title`)
- `recipe_image_url` (from `recipe?.image_url`)
- `recipe_cook_time_min` (aggregate per INVARIANT 1)
- `recipe_cuisine_types` (from `recipe?.cuisine_types`)
- `recipe_vibe_tags` (from `recipe?.vibe_tags`)
- `recipe_times_cooked` (from `recipe?.times_cooked`)

**Structure the transform as a dedicated helper function** — something like `transformToCookCardData(rawPosts, profilesMap, recipesMap): CookCardData[]`. Don't inline it in `loadDishPosts`. This is the function Checkpoint 5 (CookDetailScreen) may want to reuse for single-post fetching.

**Title cascade.** The existing FeedScreen already has a cascade: `post.title || recipe?.title || post.dish_name || 'Untitled Post'`. Preserve this cascade in the transform — write the result to `CookCardData.title`. This is the one place where post.title can be null and we synthesize a fallback. `CookCardInner` will not apply its own fallback beyond this.

**Feed cap stays at 200** for Checkpoint 4. No pagination work. P7-44 tracks that separately.

---

## Sub-section 4.2 — Remove `getMealsForFeed`, simplify `loadFeed`

The current `loadFeed` fetches posts and meals in parallel via `Promise.all([loadDishPosts, getMealsForFeed])`, combines them into a tagged union array, groups dishes via `groupPostsForFeed` (the OLD function — do not touch it), and sorts the combined array chronologically.

**The new flow:**

1. Resolve follows and user ID (unchanged).
2. Fetch dish posts via `loadDishPosts` (which now returns `CookCardData[]`).
3. Call `buildFeedGroups(cookCardData, currentUserId, followingIds)` to produce `FeedGroup[]`.
4. Load engagement state (likes, comments, highlights, participants) for all posts in all groups. This is where it gets subtle — see sub-section 4.3.
5. Pre-fetch meal event contexts and cook-partner prehead state for all posts (see sub-section 4.4).
6. `setFeedGroups(feedGroups)` — rename the state variable from `feedItems` to `feedGroups` for clarity.

**Remove entirely:**
- The `getMealsForFeed` call
- The `meals` Promise.all slot
- Any reference to `MealWithDetails` in imports or state
- The `CombinedFeedItem` union type
- The old `groupPostsForFeed` call (it's still exported from `feedGroupingService` but Checkpoint 7 will delete it; Checkpoint 4 just stops calling it)
- The `mealHighlights` state map (meal-specific highlights are no longer needed on the feed — meal events aren't feed units)

**Keep in place:**
- The profile/search/messages/bell header (no change to the outer layout)
- The `loadCurrentUser` flow
- The `followingIds` state (now used for Rule C visibility in `buildFeedGroups` instead of MealPostCard's internal filter)
- The `postLikes`, `postComments`, `postHighlights`, `postParticipants` state maps (still needed; see 4.3)
- The pull-to-refresh `onRefresh` handler (may need investigation — see 4.6.2)
- The empty state rendering (no posts → show "No posts yet" card)
- The loading state rendering

---

## Sub-section 4.3 — Engagement hydration for `FeedGroup[]`

This is the subtlest part of the rewrite. The old flow hydrated engagement state keyed by `post.id` (from the flat posts list) plus separately by `meal.id` (from the flat meals list). The new flow has nested structure: each `FeedGroup` contains 1+ posts, and some groups contain `subUnits` which contain their own posts.

**The hydration strategy:**

1. **Flatten every post ID across all groups.** Walk the `FeedGroup[]`, collect every post ID from `group.posts` (for the flat list). For `linked_meal_event` groups with `subUnits`, the posts are already in `group.posts` — `subUnits` is a presentation-layer restructuring, not a different post set. So `group.posts` always contains the complete flat list of posts in the group. Collect all IDs into a flat `postIds: string[]` array.

2. **Hydrate likes and comments by flat post ID.** Call `loadLikesForPosts(allPostIds)` and `loadCommentsForPosts(allPostIds)` exactly like the old code does, keyed by post_id. These service functions already exist and work — don't modify them. The resulting `postLikes` and `postComments` maps work the same way as before. Each `CookCardInner` reads its own engagement via lookup.

3. **Hydrate highlights for the flat post ID list.** Call `computeHighlightsForFeedBatch` with the post list (and an empty meal list, since there are no meal highlights anymore). The existing service takes arrays of posts and meals; pass `mealsResult = []`. This keeps the existing service untouched — it's called with one argument changed to empty.

4. **Participants are dish-only and keyed by post ID.** The existing `loadParticipantsForPosts(postIds)` flow works as-is — pass the flat list of post IDs.

5. **No meal-level engagement anywhere.** The old code was hydrating engagement for meal IDs so MealPostCard's yas chef / comment buttons worked. Meal cards are gone from the feed, so meal-level engagement on the feed is gone too. If Tom likes a meal event from its detail screen (Checkpoint 6), that's L7's concern, not the feed's.

**State maps continue to exist and be keyed by post ID** — `postLikes[post.id]`, `postComments[post.id]`, etc. The render layer in 4.4 passes getter closures into `LinkedCookStack` / `SharedRecipeLinkedGroup` / `NestedMealEventGroup` that read from these maps.

---

## Sub-section 4.4 — Prehead context pre-fetch + `renderFeedItem` dispatch

The new render function takes a `FeedGroup` and dispatches on `group.type`. Four cases. The tricky part is that `solo` groups need prehead context that requires async lookups, but `renderFeedItem` must run synchronously. Solution: pre-fetch all prehead context during `loadFeed`, cache it on component state, and look up synchronously at render time.

### Prehead pre-fetch phase (runs inside `loadFeed` after `buildFeedGroups`)

**Build two lookup maps before calling `setFeedGroups`:**

**Map 1 — Meal event contexts by meal event ID.** Collect all `parent_meal_id` values from posts across all groups. De-duplicate. For each unique meal event ID, call `getMealEventForCook(firstPostIdInThatMealEvent)` to fetch the context. Store in `mealEventContextMap: Map<string, MealEventContext>`.

If the naive loop is too slow (say >500ms for a 50-meal-event feed), write a batched variant `getMealEventsByIds(mealEventIds): Map<string, MealEventContext>` in `mealService.ts`. Profile first. Ship the naive loop if it's fast enough and add a perf deferred item if not. **NEEDS REVIEW during execution** — report the timing in SESSION_LOG.

**Map 2 — Cook-partner prehead state by post ID.** For L3a detection: a post qualifies for a cook-partner prehead when it has approved sous_chef participants whose user_ids are NOT in the same feed batch's post authors (the partner was tagged but didn't post their own version in this batch).

Efficient query: one batch call to `post_participants` filtered by `in('post_id', allPostIds)` + `role='sous_chef'` + `status='approved'`. Join on `user_profiles` to get partner names. In-memory: for each post, check if any of its sous_chef partners has a user_id that's in the set of feed batch authors. If YES → the partner is probably in the feed somewhere, no prehead (the linkage forms elsewhere or degrades per P7-68). If NO → the partner isn't in the feed, render `CookPartnerPrehead` with the first missing partner's name.

Store in `cookPartnerPreheadMap: Map<string, { partnerName: string }>`.

**Cache both maps on React state** so `renderFeedItem` reads them synchronously via `mealEventContextMap.get(post.parent_meal_id)` and `cookPartnerPreheadMap.get(post.id)`.

### Render dispatch

```typescript
const renderFeedItem = ({ item: group }: { item: FeedGroup }) => {
  if (group.type === 'solo') {
    const post = group.posts[0];

    // Determine prehead: meal event prehead takes precedence over cook partner prehead
    const mealEventCtx = post.parent_meal_id
      ? mealEventContextMap.get(post.parent_meal_id)
      : undefined;
    const cookPartnerCtx = cookPartnerPreheadMap.get(post.id);

    return (
      <View>
        {mealEventCtx && (
          <MealEventPrehead
            mealEvent={mealEventCtx}
            onPress={() => navigation.navigate('MealDetail', { mealId: mealEventCtx.id, currentUserId })}
          />
        )}
        {!mealEventCtx && cookPartnerCtx && (
          <CookPartnerPrehead partnerName={cookPartnerCtx.partnerName} />
        )}
        <CookCard
          post={post}
          currentUserId={currentUserId}
          highlight={postHighlights[post.id] || null}
          vibe={resolveVibe(post)}
          likeData={buildLikeData(post.id)}
          onPress={() => navigateToCookDetail(post.id)}
          onLike={() => toggleLike(post.id)}
          onComment={() => navigation.navigate('CommentsList', { postId: post.id })}
          onMenu={() => handleCardMenu(post.id)}
          onRecipePress={(recipeId) => navigation.navigate('RecipeDetail', { recipe: { id: recipeId }})}
          onChefPress={(chefName) => navigation.navigate('AuthorView', { chefName })}
          onViewLikes={() => navigation.navigate('YasChefsList', { postId: post.id, postTitle: post.title })}
        />
      </View>
    );
  }

  if (group.type === 'linked_shared_recipe') {
    return (
      <SharedRecipeLinkedGroup
        posts={group.posts}
        currentUserId={currentUserId}
        showLinkingHeader={true}
        getLikeDataForPost={(postId) => buildLikeData(postId)}
        getHighlightForPost={(postId) => postHighlights[postId] || null}
        getVibeForPost={(postId) => resolveVibeForPost(postId)}
        onCardPress={(postId) => navigateToCookDetail(postId)}
        onRecipePress={(recipeId) => navigation.navigate('RecipeDetail', { recipe: { id: recipeId }})}
        onChefPress={(chefName) => navigation.navigate('AuthorView', { chefName })}
        onCardMenu={(postId) => handleCardMenu(postId)}
        onCardLike={(postId) => toggleLike(postId)}
        onCardComment={(postId) => navigation.navigate('CommentsList', { postId })}
        onCardViewLikes={(postId) => navigation.navigate('YasChefsList', { postId, postTitle: /* lookup */ })}
      />
    );
  }

  if (group.type === 'linked_meal_event') {
    const firstPost = group.posts[0];
    const mealEventCtx = firstPost.parent_meal_id
      ? mealEventContextMap.get(firstPost.parent_meal_id)
      : undefined;

    if (!mealEventCtx) {
      // Defensive: should not happen. Fall back to LinkedCookStack with no header.
      return <LinkedCookStack posts={group.posts} {...commonProps} />;
    }

    return (
      <NestedMealEventGroup
        mealEventContext={mealEventCtx}
        subUnits={group.subUnits ?? [{ kind: 'solo', posts: group.posts }]}
        currentUserId={currentUserId}
        getLikeDataForPost={(postId) => buildLikeData(postId)}
        getHighlightForPost={(postId) => postHighlights[postId] || null}
        getVibeForPost={(postId) => resolveVibeForPost(postId)}
        onCardPress={(postId) => navigateToCookDetail(postId)}
        onRecipePress={(recipeId) => navigation.navigate('RecipeDetail', { recipe: { id: recipeId }})}
        onChefPress={(chefName) => navigation.navigate('AuthorView', { chefName })}
        onCardMenu={(postId) => handleCardMenu(postId)}
        onCardLike={(postId) => toggleLike(postId)}
        onCardComment={(postId) => navigation.navigate('CommentsList', { postId })}
        onCardViewLikes={(postId) => navigation.navigate('YasChefsList', { postId, postTitle: /* lookup */ })}
        onGroupHeaderPress={() => navigation.navigate('MealDetail', { mealId: mealEventCtx.id, currentUserId })}
      />
    );
  }

  // Should not happen
  console.warn('[FeedScreen] Unknown FeedGroup type:', (group as any).type);
  return null;
};
```

**The helper functions referenced above:**

- `buildLikeData(postId)`: returns the `LikeData` shape `{ hasLike, likesText, commentCount, likes }` for the given post. Pulls from `postLikes`, `postComments`, calls `formatLikesText` (existing helper).
- `resolveVibeForPost(postId)`: looks up the vibe from the post's recipe data. Current FeedScreen has this inline in the solo-branch of `renderFeedItem`; factor it out.
- `navigateToCookDetail(postId)`: temporary target. See sub-section 4.5.
- `handleCardMenu(postId)`: placeholder. See sub-section 4.5.

---

## Sub-section 4.5 — Navigation wiring and temporary targets

**CookCard tap target (`onPress` / `onCardPress`):** The eventual destination is `CookDetailScreen` (L6) which doesn't exist yet — Checkpoint 5 builds it. For Checkpoint 4, route the press to the existing `CommentsList` screen temporarily:

```typescript
const navigateToCookDetail = (postId: string) => {
  // CHECKPOINT 5 will replace this with CookDetailScreen navigation.
  // Temporary: route to CommentsList so the tap goes somewhere useful.
  navigation.navigate('CommentsList', { postId });
};
```

The alternative would be to route to `RecipeDetail` if the post has a recipe, matching the current PostCard behavior. But that's only correct for recipe-backed posts and makes freeform posts feel broken. `CommentsList` is a defensible temporary target because it's a real destination with real content for every post. Tom can live with it for a few checkpoints.

**Recipe tap (`onRecipePress`):** Route to `RecipeDetail`. The recipe ID comes from the post's `recipe_id`. Construct the minimal nav param: `{ recipe: { id: recipeId }}`. RecipeDetail handles its own data fetching.

**Chef tap (`onChefPress`):** Route to `AuthorView` with the chef name. The existing PostCard does this.

**Meal event prehead tap / group header tap:** Route to `MealDetail` with the meal event ID. Temporary until Checkpoint 6 rewrites MealDetailScreen.

**Cook partner prehead:** NOT tappable. The partner hasn't posted their own version, so there's nowhere to navigate. `CookPartnerPrehead` doesn't take an `onPress` prop.

**Three-dot overflow menu on own cards:** Route to a placeholder handler for now. The menu items themselves are Checkpoint 5's scope (CookDetailScreen edit flow). For Checkpoint 4:

```typescript
const handleCardMenu = (postId: string) => {
  // Checkpoint 5 will wire this to the real overflow menu.
  console.log('[FeedScreen] Card menu tapped for post:', postId);
};
```

Just log. Do NOT wire to the existing `PostActionMenu` / `handleEditPost` flow — that routes to `EditMedia` which is MyPostDetailsScreen's concern, not FeedScreen's. The overflow menu will still visually appear on own cards (because `CookCardInner` conditionally renders it when `onMenu` is defined), but tapping it is a no-op except for the log. **NEEDS REVIEW during execution** — if the silent tap feels broken during testing, change the log to a brief Alert ("Edit menu coming soon") or hide the menu entirely by passing `onMenu={undefined}` and flag P7-71 for the eventual wiring.

---

## Sub-section 4.6 — Bundled polish

Three small items bundled into this checkpoint because FeedScreen is already open:

### 4.6.1 — Logo tap-to-top

The existing header has a Logo component in the center (absolutely positioned). Wrap it in a `TouchableOpacity` that scrolls the FlatList to the top when tapped.

**Implementation:** Add a `flatListRef = useRef<FlatList>(null)` to the component. Pass `ref={flatListRef}` to the FlatList. On logo tap, call `flatListRef.current?.scrollToOffset({ offset: 0, animated: true })`.

Minor detail: the existing Logo is inside a View with `pointerEvents: 'none'` because it's absolutely positioned and shouldn't intercept taps on the siblings. Adding tap handling requires either:
- Removing `pointerEvents: 'none'` and making sure the Logo's hit area doesn't overlap the profile/search buttons on the left or the messages/bell buttons on the right
- Or wrapping ONLY the logo in a TouchableOpacity while keeping the outer `pointerEvents: 'none'` and setting `pointerEvents: 'box-only'` on the inner wrapper

The second approach is cleaner. Try it first.

### 4.6.2 — Pull-to-refresh hang investigation

There's an unresolved finding from Fix Pass 9: pull-to-refresh sometimes hangs for ~15 seconds before refreshing. Root cause unknown. Since you're rewriting `loadFeed`, instrument it to help surface the cause:

1. Add `console.time('loadFeed')` at the start of `loadFeed` and `console.timeEnd('loadFeed')` at the end (both in the finally block).
2. Add `console.time`/`console.timeEnd` around each major phase: `loadFollows`, `loadDishPosts`, `buildFeedGroups`, `hydrateEngagement`, `prefetchPreheadContext`.
3. On pull-to-refresh, the logs will show which phase is taking the 15s. Report the findings in SESSION_LOG.

If the investigation identifies a quick fix (e.g., a Promise that's not resolving because of a conditional, or a re-render loop), apply the fix. If the root cause is non-obvious or requires more than a few lines of changes, leave the instrumentation in place, report findings in SESSION_LOG, and flag as P7-69 (new deferred item — investigation continuation).

### 4.6.3 — Feed cap telemetry

The Fix Pass 9 SESSION_LOG entry noted that feed cap telemetry was pending on-device measurement: "Total feed item count" and "Date of oldest post rendered." These weren't measurable from Claude Code then because CC couldn't scroll the feed.

With Checkpoint 4's FeedScreen rewrite, the telemetry becomes trivial to add:

```typescript
useEffect(() => {
  if (feedGroups.length > 0) {
    const allPosts = feedGroups.flatMap(g => g.posts);
    const oldestPost = allPosts.reduce((oldest, p) =>
      new Date(p.created_at) < new Date(oldest.created_at) ? p : oldest
    , allPosts[0]);
    console.log('[FEED_CAP_TELEMETRY]',
                'groups:', feedGroups.length,
                'total posts:', allPosts.length,
                'oldest post date:', oldestPost.created_at);
  }
}, [feedGroups]);
```

One-shot log on feed load. Tom reads Metro log after the first load. These numbers tell us how much runway the 200-post cap buys before P7-44 (infinite scroll) becomes urgent. Report the logged numbers in SESSION_LOG under a "Feed cap telemetry" section.

---

## Sub-section 4.7 — Retire old components from imports (but do not delete)

After the rewrite is functional, audit FeedScreen.tsx's imports. Remove the imports for any of the following that are no longer referenced:
- `PostCard` and `PostCardData`
- `LinkedPostsGroup`
- `MealPostCard`
- `getMealsForFeed`, `MealWithDetails`
- `FeedItem`, `groupPostsForFeed` (from `feedGroupingService`)
- Any type import for `CombinedFeedItem` if it was exported

**Do NOT delete any component files themselves.** They stay in the repo until Checkpoint 7. Only remove imports from FeedScreen.

TypeScript will complain about unused imports if you leave them in. Removing them cleanly is part of 4.7.

---

## Verification

After all sub-sections land:

1. **TypeScript compiles cleanly** on all touched files: `npx tsc --noEmit`. Zero errors. Non-negotiable.

2. **Real-data feed renders without crashing.** Open the app, tap the Feed tab, scroll. Expected visual:
   - Feed density is ~38% higher than post-Checkpoint 2 state (because formerly-hidden meal-attached dishes are back)
   - No meal cards visible (meal events don't render as feed units)
   - CookCards render with the new structure: avatar + author name (no "You" for own posts) + title + description + recipe line + photo carousel + stats + engagement row + action row
   - No crashes on any card type
   - Pull-to-refresh works (may still hang — see 4.6.2)
   - Tap on a card → CommentsList screen (temporary target)
   - Tap on recipe name → RecipeDetail
   - Tap on chef name → AuthorView

3. **Cook-partner linkage verification — the critical one.** Checkpoint 2's dry-run never exercised cook-partner group formation because the 20-post sample didn't contain reciprocal pairs. Checkpoint 4's real feed has 1,739 dish posts with 421 sous_chef-on-dish tags. At least a few L3b linked pairs should form.
   - Scroll the feed looking for ANY `SharedRecipeLinkedGroup` rendering (visible as a single card with a linking header like "Tom cooked with Anthony", a shared recipe hero image, and 2+ cook sub-sections below)
   - If you find one: great, cook-partner linkage works. Take a screenshot or describe the visual in SESSION_LOG.
   - If you don't find any: this is concerning. Three possible causes:
     - **(a)** The 60-minute reciprocal time window in `getLinkedCookPartners` is too tight for real data (flagged as NEEDS REVIEW in Checkpoint 2). The fix is changing `LINKED_COOK_WINDOW_MS` in `postParticipantsService.ts` — try widening to 180 minutes.
     - **(b)** The batched variant restricts reciprocal candidates to the in-batch post set (flagged in Checkpoint 2). A viewer whose 200-post window doesn't contain both halves of a reciprocal pair won't see the linkage form. This is defensible behavior — if both halves aren't in the feed, there's nothing to group.
     - **(c)** Something in the real data makes reciprocal pairs genuinely rare. The Checkpoint 1 diagnostic showed several real Tom↔Anthony pairs in March, so they should exist in the 200-post window as long as those posts are recent enough.
   - Report findings in SESSION_LOG. If 0 linked pairs form, try widening the time window first, then reload and re-check. If still 0, accept the batched-scope limitation as Checkpoint 4's reality and flag for P7-70 (wider reciprocal scope — full posts table query within time window).

4. **Meal event prehead / group header verification.** Scroll the feed looking for:
   - L4 preheads (solo card with meal event prehead above) — should appear on any dish that has a `parent_meal_id` and is the only contributor in the feed batch from that meal event
   - L5 linked meal event groups (meal event header + stacked sub-sections) — should appear when 2+ cooks from the same meal event are both visible in the feed batch
   - L5.5 nested shared-recipe sub-merges — will only appear if 2+ cooks from the same meal event happened to use the same recipe_id. Probably rare in real data. If you find one, screenshot it.

5. **`recipe_cook_time_min` denormalization check.** Pick a post in the feed where you know the recipe has both `cook_time_min` and `prep_time_min` set. Verify the stats row on the card shows the SUM of both, not just `cook_time_min`. This is INVARIANT 1 from sub-section 4.1 — if it's broken, the displayed cook time will be short by the prep time.

6. **Grep verification of retired imports:**
   - `grep -n "PostCard\|MealPostCard\|LinkedPostsGroup\|getMealsForFeed\|groupPostsForFeed\|CombinedFeedItem" screens/FeedScreen.tsx` should return nothing (or only comments, if you left any).
   - `grep -n "buildFeedGroups\|CookCard\|SharedRecipeLinkedGroup\|NestedMealEventGroup" screens/FeedScreen.tsx` should show the new imports and calls.

7. **Feed cap telemetry report.** Note the total group count, total post count, and oldest post date from the console log. Include in SESSION_LOG.

8. **Pull-to-refresh timing report.** Note the phase timings from `console.time`/`console.timeEnd` across at least 3 pull-to-refresh cycles. Include in SESSION_LOG. If the hang is reproducible and isolated to a specific phase, try to fix it. Otherwise, report the data and flag P7-69.

9. **Test harness still works.** The Phase7ITestHarness route still exists. Verify the harness still renders all 7 states correctly (no regression from the FeedScreen rewrite). The harness uses `CookCard` / `LinkedCookStack` / `SharedRecipeLinkedGroup` / `NestedMealEventGroup` directly against synthetic data, so it should be completely independent of the FeedScreen rewrite — but verify anyway, because it's cheap insurance. If no nav entry exists to reach it, re-add the temporary flask button to FeedScreen's header for verification, then remove it before writing SESSION_LOG.

---

## What this checkpoint does NOT include

**Explicitly deferred to Checkpoint 5:**
- Building CookDetailScreen (L6) — the tap target from CookCard routes to CommentsList temporarily
- Wiring the overflow menu items (edit photos, edit title, manage cook partners, etc.)
- The narrow-scope editing affordances from D47

**Explicitly deferred to Checkpoint 6:**
- Building MealEventDetailScreen (L7) — meal event prehead and group header route to the existing MealDetail temporarily
- Host editing of meal events
- The non-destructive delete cascade

**Explicitly deferred to Checkpoint 7:**
- Deleting `PostCard.tsx`, `MealPostCard.tsx`, `LinkedPostsGroup.tsx`
- Deleting `groupPostsForFeed` and `FeedItem` exports from `feedGroupingService.ts`
- Removing `'meal'` from `PostType` union
- Deleting the test harness
- Chef page audit
- `FRIGO_ARCHITECTURE.md` update

**Explicitly deferred to 7M:**
- Full post editing screen
- Feed card overflow menu wiring for author viewers beyond the no-op placeholder

---

## Files you are expected to touch

- `screens/FeedScreen.tsx` — the main rewrite. Most of the work.
- `lib/services/mealService.ts` — possibly add `getMealEventsByIds` batched variant if profiling shows the naive loop is too slow. Optional.
- `lib/services/feedGroupingService.ts` OR a new `lib/services/feedRenderHelpers.ts` — optionally house a `resolvePreheadContext` helper if you decide to factor it out of FeedScreen. Inline in FeedScreen is also fine; your call.

**Files you should NOT touch:**
- `components/feedCard/CookCard.tsx`, `components/feedCard/groupingPrimitives.tsx`, `components/feedCard/sharedCardElements.tsx` — the component layer is stable from Checkpoint 3.5
- `components/PostCard.tsx`, `components/MealPostCard.tsx`, `components/LinkedPostsGroup.tsx` — untouched until Checkpoint 7
- `lib/types/feed.ts` — the types are stable from Checkpoint 3.5
- `lib/services/postService.ts`, `lib/services/postParticipantsService.ts`, `lib/services/recipeHistoryService.ts`, `lib/services/highlightsService.ts`, `lib/services/mealPlanService.ts` — consumed, not modified
- `screens/_Phase7ITestHarness.tsx` — the harness is stable
- `App.tsx` — no new routes
- Database migrations — no SQL in this checkpoint

---

## Hard stop requirements

After all verification steps pass, write a SESSION_LOG entry titled `2026-04-14 — Phase 7I Checkpoint 4 — FeedScreen Rewrite` including:

- **Files modified:** full list with line counts or function signatures
- **Sub-section 4.1 findings:** any surprises in the transform, denormalization bugs caught, whether the title cascade and INVARIANT 1 both work
- **Sub-section 4.2 findings:** any imports that were harder to remove than expected, any state that couldn't cleanly retire
- **Sub-section 4.3 findings:** engagement hydration approach, whether the flat-list pattern worked, any rendering-time lookup misses
- **Sub-section 4.4 findings:**
  - The prehead pre-fetch approach (naive loop or batched variant, timing)
  - Where you put the prehead lookup maps (state, ref, module-level)
  - Any rendering-time surprises
- **Sub-section 4.5 findings:** navigation target decisions, any places where the temporary route felt wrong
- **Sub-section 4.6 findings:**
  - Logo tap-to-top — worked on first try or needed the pointerEvents wrestling
  - Pull-to-refresh timing report — phase-by-phase timings across at least 3 cycles, root cause if found
  - Feed cap telemetry — raw numbers (groups, posts, oldest date)
- **Sub-section 4.7 findings:** any orphaned imports TypeScript flagged that you had to hunt down
- **Cook-partner linkage verification results:** did real L3b groups form? Screenshots or visual description. If 0 formed, what you tried and the outcome.
- **Meal event linkage verification results:** did L4/L5 preheads and group headers render? Did any L5.5 nested sub-merges appear?
- **NEEDS REVIEW items flagged for Checkpoint 5+:**
  - Pull-to-refresh root cause if not fixed (P7-69)
  - Wider reciprocal scope if needed (P7-70)
  - Overflow menu wiring if the no-op feels broken (P7-71)
  - Any performance issues surfaced by the batching decisions
  - Any prop interface mismatches between CookCard and FeedScreen that feel off
- **GO / NO-GO recommendation for Checkpoint 5:** based on verification results, should Checkpoint 5 (CookDetailScreen + narrow-scope editing) proceed?

**Do NOT proceed to Checkpoint 5.** Do not start CookDetailScreen work. Do not modify any components in `components/feedCard/`. Hard stop. Wait for Tom.

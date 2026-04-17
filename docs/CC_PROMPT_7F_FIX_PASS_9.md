# CC PROMPT — Phase 7F Fix Pass 9

Two small, surgical fixes based on on-device testing of Fix Pass 8 and a
verified root cause for each. Plus one leftover verification from Fix
Pass 8 that couldn't be completed without a live app.

## SCOPE LOCK

You may only edit these files:
- `components/feedCard/sharedCardElements.tsx`
- `screens/FeedScreen.tsx`

No other files. No refactoring. No adjacent improvements. If a fix
requires changes outside this scope, STOP and report back.

---

## FIX 1 — Photos cropped because Supabase transform URL lacks `resize=contain` (🔴 FUNCTIONAL)

### Problem

In `components/feedCard/sharedCardElements.tsx`, `optimizeStorageUrl`
rewrites photo URLs to hit Supabase's image transformation endpoint:

```js
return `${prefix}/storage/v1/render/image/public/${rest}?width=${width}&quality=${quality}`;
```

It passes `width=1600` but no `resize` parameter. **Supabase defaults
to `resize=cover`**, which (per Supabase's docs) resizes while filling
the target dimensions and **crops projecting parts**. Even when only
`width` is specified — without `height` — the endpoint still applies
a cover crop, delivering a pre-cropped image to the client.

The result: every photo in the feed arrives at React Native already
cropped. `Image.onLoad` then reports the *cropped* dimensions, so the
PhotoCarousel sizes the slide to match the cropped image's aspect
ratio. Everything downstream renders the cropped image faithfully,
which is why there are no warnings and `onLoad` appears to work —
but the source photo in Supabase is a different shape than what
renders in the feed.

Confirmed by the user: source photos in Supabase are wider than what
renders in the feed for both single-photo and multi-photo cards.

From Supabase docs:
> "You can use width and height parameters to resize an image to a
> specific dimension. If only one parameter is specified, the image
> will be resized and cropped, maintaining the aspect ratio."
>
> "cover: resizes the image while keeping the aspect ratio to fill a
> given size and crops projecting parts. (default)"
> "contain: resizes the image while keeping the aspect ratio to fit a
> given size."

### Fix

Append `&resize=contain` to the transform URL in `optimizeStorageUrl`.
`contain` scales proportionally to fit within the width bound without
cropping — which is exactly what PhotoCarousel's natural-aspect-ratio
rendering needs.

Change the return line at the bottom of `optimizeStorageUrl` from:

```js
return `${prefix}/storage/v1/render/image/public/${rest}?width=${width}&quality=${quality}`;
```

to:

```js
return `${prefix}/storage/v1/render/image/public/${rest}?width=${width}&quality=${quality}&resize=contain`;
```

That's the entire fix for this item. One token appended to the query
string. No component changes needed — PhotoCarousel's `onLoad`-driven
aspect ratio discovery already handles whatever shape arrives, it just
needs the uncropped source.

### Verification

1. Pull to refresh. Confirm photos load at their full natural aspect
   ratios — portrait photos appear taller/narrower than before,
   landscape photos appear shorter/wider, nothing is center-cropped.
2. On multi-photo cards (e.g., the Kombucha meal), scroll horizontally
   and confirm each photo shows its full width with neighbors peeking
   in from the sides.
3. On single-photo cards (e.g., "Friends over for dinner"), confirm
   the photo renders at its natural proportions centered on the card
   with card-background bars filling any leftover horizontal space.
4. Spot-check the recipe photo fallback on a Tier 3 meal card — the
   "📖 Recipe photo" badge should still render in the top-left of
   the photo.
5. No perf regression — photos should still load at similar speed
   since `width=1600&quality=50` is unchanged, only the resize mode
   differs.

---

## FIX 2 — MealPostCard never receives likeData, so yas chef state never updates (🔴 FUNCTIONAL)

### Problem

In `screens/FeedScreen.tsx`, the `renderFeedItem` meal branch:

```jsx
<MealPostCard
  meal={item.meal}
  currentUserId={currentUserId}
  followingIds={followingIds}
  highlight={mealHighlights[item.meal.id] || null}
  onPress={() => handleMealPress(item.meal.id)}
  onDishPress={...}
  onLike={() => toggleLike(item.meal.id)}
  onComment={() => navigation.navigate('CommentsList', { postId: item.meal.id })}
  onShare={...}
/>
```

**`likeData` is not passed to MealPostCard**, unlike the PostCard
render branch below which explicitly passes:

```jsx
likeData={{
  hasLike: likeData?.hasLike || false,
  likesText,
  commentCount,
  likes: likeData?.likes || [],
}}
```

Consequence: tapping yas chef on a meal card does fire the handler,
does write to `post_likes` successfully (verified via Supabase — rows
are landing with `post_id = meal.id` and this user), but since
`likeData` is undefined in MealPostCard, `likeData?.hasLike` is
`undefined`, `EngagementRow` returns null, and the `ActionRow` icon
renders permanently unfilled. Every subsequent tap toggles the DB row
but the UI never reflects state.

Meanwhile comment *works* because it's a pure navigation — no state
round-trip required.

### Fix

In `screens/FeedScreen.tsx`, in the `renderFeedItem` meal branch, add
a `likeData` prop to the `<MealPostCard>` call mirroring the PostCard
branch. The source data is the `postLikes` / `postComments` state maps
which after Fix Pass 8 Fix 3 now include meal IDs.

At the top of the meal branch (right after the `if (item.type === 'meal')`
check), compute the same data shape PostCard uses:

```jsx
if (item.type === 'meal') {
  const mealLikeData = postLikes[item.meal.id];
  const mealCommentCount = postComments[item.meal.id] || 0;
  const mealLikesText = formatLikesText(item.meal.id);

  return (
    <MealPostCard
      meal={item.meal}
      currentUserId={currentUserId}
      followingIds={followingIds}
      highlight={mealHighlights[item.meal.id] || null}
      likeData={{
        hasLike: mealLikeData?.hasLike || false,
        likesText: mealLikesText,
        commentCount: mealCommentCount,
        likes: mealLikeData?.likes || [],
      }}
      onPress={() => handleMealPress(item.meal.id)}
      onDishPress={(dish) => {
        if (dish.recipe_id) {
          navigation.navigate('RecipeDetail', { recipe: { id: dish.recipe_id } });
        }
      }}
      onLike={() => toggleLike(item.meal.id)}
      onComment={() => navigation.navigate('CommentsList', { postId: item.meal.id })}
      onShare={() => {
        console.log('Share meal:', item.meal.id);
      }}
    />
  );
}
```

`formatLikesText` already takes any post ID (dish or meal) and works
correctly with either — no changes needed to that function.

Do NOT change anything in `components/MealPostCard.tsx`. The component
already accepts and uses `likeData` correctly (it passes it through to
`EngagementRow` and uses `likeData?.hasLike` for `ActionRow`). The bug
is only in how FeedScreen fails to pass it.

### Verification

1. Tap yas chef on a meal card. Confirm the icon immediately fills
   to the liked state (teal tint) without refresh.
2. Pull to refresh. Confirm the meal card still shows as liked after
   the round-trip (Fix Pass 8 Fix 3 already handled the hydration
   side; this fix handles the render side).
3. Tap yas chef a second time on the same meal card. Confirm it
   unfills and the DB row is deleted.
4. Rapidly tap yas chef 5 times on a meal card. Confirm it ends in
   the correct state (either filled or unfilled depending on starting
   state + parity) and no duplicate rows pile up in `post_likes`.
5. Regression check: tap yas chef on a dish card. Still works as
   before.
6. Regression check: comment icon on meal card still navigates to
   CommentsList.

---

## FIX 3 — Feed item count telemetry (🟢 VERIFICATION ONLY)

### Problem

Fix Pass 7 raised dish limit to 200 and meal limit to 100. Fix Pass 8
deferred verification because it couldn't run the app. Still needs to
be confirmed.

### Fix

No code change.

### Verification

1. Pull to refresh. Scroll to the absolute bottom of the feed.
2. Approximately count cards visible end-to-end.
3. Note the date of the oldest post shown.
4. Report both numbers in SESSION_LOG:
   - Total feed item count
   - Date of oldest post rendered

This tells us how much runway the 200/100 cap buys us before infinite
scroll becomes urgent.

---

## HARD STOP

After all three items are handled:

1. Do not proceed to any other work.
2. Write a SESSION_LOG entry titled
   `Phase 7F Fix Pass 9 — Supabase transform resize=contain, MealPostCard likeData wiring, feed cap telemetry`
   with:
   - What was changed for Fix 1 and Fix 2 (file + line summary)
   - Verification results for all three items
   - Feed item count + oldest post date from Fix 3
   - Any follow-ups or visual oddities observed
3. Stop and wait for review.

## IMPORTANT NOTES

- Fix 1 is a one-line change. Do not rewrite `optimizeStorageUrl`
  beyond appending `&resize=contain` to the return string.
- Fix 2 touches only FeedScreen's meal render branch. Do not touch
  MealPostCard — the component is correct, the wiring upstream is
  what's broken.
- Do not re-introduce `Pressable` on CardWrapper, `removeClippedSubviews`
  on the FlatList, or any of the other things previous fix passes
  removed.

# Phase 7I Checkpoint 4.5 — Fix Pass (Photo Rendering + Revert Diagnostics)

**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 4.5 (fix pass between Checkpoint 4 and Checkpoint 5)

**Prior work:**
- **Checkpoints 1-3.5:** complete, verified
- **Checkpoint 4:** FeedScreen rewrite landed. Structural work clean, TypeScript compiles, scope lock held. On-device diagnostic round surfaced two photo-rendering bugs and captured performance telemetry.
- **Between Checkpoint 4 and now:** multi-round on-device diagnostic captured the `loadFeed` phase timings and the root cause of the blank-photo-region bug. Full diagnostic arc documented in the existing SESSION_LOG entry "Phase 7I Checkpoint 4 on-device diagnostic (in progress)".

**Required reading before starting:**
1. This prompt in full
2. `docs/SESSION_LOG.md` — the diagnostic-in-progress entry (what's currently patched as temporary diagnostic edits) and the Checkpoint 4 entry (what was built)
3. `components/feedCard/CookCard.tsx` — specifically `CookCardInner`'s photo derivation block around the `carouselPhotos` assignment
4. `components/feedCard/sharedCardElements.tsx` — specifically `optimizeStorageUrl` at the top of the file
5. `screens/FeedScreen.tsx` — to locate the diagnostic edits for revert

---

## Goal

Three items, in order:

1. Fix the string-vs-object photo shape bug in `CookCardInner` that causes blank photo slots on posts with `photos: [<url string>]` shapes
2. Fix `optimizeStorageUrl` to route uppercase-extension URLs through the raw object endpoint instead of the render endpoint, preventing broken images on ~347 recipes that currently only render via recipe-image fallback paths
3. Revert all diagnostic edits added during the Checkpoint 4 on-device diagnostic arc

Do NOT expand scope. Do NOT start Checkpoint 5 work. Do NOT touch `prefetchPreheadContext`, `hydrateEngagement`, or any other performance-related code path. Those are tracked as deferred items P7-74 and P7-75 respectively and explicitly excluded from this fix pass.

---

## Context on the photo shape bug

The on-device diagnostic confirmed that `posts.photos` jsonb column contains two different shapes in the database:

- **String array form** (the bug trigger): `["https://...url1", "https://...url2"]` — bare URL strings
- **Object array form** (the current derivation assumes this): `[{url: "...", caption: "...", order: 0, is_highlight: false}, {...}]` — photo objects with metadata

The current `CookCardInner` derivation at line ~135 only handles the object form:

```typescript
carouselPhotos = [...post.photos]
  .sort((a: any, b: any) => {
    if (a.is_highlight) return -1;
    if (b.is_highlight) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  })
  .map((p: any) => ({ url: p.url, caption: p.caption }));
```

When `p` is a string (e.g. `"https://...jpg"`), `p.url` is `undefined`, `p.caption` is `undefined`, the sort comparator's `.is_highlight` access returns `undefined` (falsy, sort orders arbitrarily), and `.map` produces `[{url: undefined, caption: undefined}]`. PhotoCarousel receives a one-element array with an undefined URL and hands `<Image source={{uri: ""}}/>` to React Native, which renders the reserved layout slot as blank while emitting `source.uri should not be an empty string` warnings.

The diagnostic showed this reproduces on three confirmed posts:
- Anthony's "Untitled Post" with `photos: ["https://siaawxcgyghuphwgufkn.supabase.co/storage/v1/object/public/seed-photos/IMG_4540.JPG"]`
- Mary's "Chickpea, tomato and bread soup" with `photos: ["https://siaawxcgyghuphwgufkn.supabase.co/storage/v1/object/public/seed-photos/IMG_8508.JPEG"]`
- Mary's "Watermelon and feta" with `photos: ["https://siaawxcgyghuphwgufkn.supabase.co/storage/v1/object/public/seed-photos/IMG_4715.JPG"]`

There are likely more posts with the same shape; three is just what the scoped diagnostic filter captured.

---

## Context on the `optimizeStorageUrl` bug

347 recipes in the `recipes` table have `image_url` values ending in uppercase extensions (`.JPG`, `.JPEG`, `.PNG`) or double extensions (`.jpg.JPG`). Example URLs:

- `/storage/v1/object/public/recipe-images/plenty-ottolenghi/p282_watermelon_feta_photo.JPG`
- `/storage/v1/object/public/recipe-images/simple-ottolenghi/p029_beefsteak_tomato_carpaccio_green_onion_ginger_photo.jpg.JPG`

Supabase's `/storage/v1/render/image/public/...` transformation endpoint is case-sensitive on file extensions — uppercase extensions fail the endpoint's content-type detection and the request fails silently. The raw `/storage/v1/object/public/...` endpoint serves bytes verbatim and doesn't care about extension casing.

The current `optimizeStorageUrl` blindly rewrites every URL to the render endpoint. That breaks all 347 affected recipes the moment their `recipe_image_url` reaches the feed card. They don't reach it yet for the three posts we tested (those posts have their own seed photos attached), but they will reach it as soon as any post without personal photos gets rendered with a recipe_image_url fallback. This bug is latent but imminent, and Checkpoint 5's testing surface will expose it.

The fix: detect uppercase extensions and return the raw URL unchanged, skipping the render endpoint rewrite.

---

## Scope

### 4.5.1 — Fix CookCardInner's photo derivation to handle both string and object shapes

**File:** `components/feedCard/CookCard.tsx`

**Location:** Inside `CookCardInner`, the `carouselPhotos` assignment block (currently ~line 115-140, starts with `let carouselPhotos: CarouselPhoto[];`).

**Change:** The derivation must handle both string and object entries in `post.photos`. Two implementation approaches are acceptable — choose whichever reads cleaner:

**Approach A — Surgical fix in the existing `else` branch:**

```typescript
} else {
  // post.photos is jsonb and historically contains two shapes:
  //   - Object form: [{url, caption, order, is_highlight}, ...] (PostCard-era)
  //   - String form: [<url string>, ...] (earlier seed data + some write paths)
  // Normalize to CarouselPhoto[] defensively.
  carouselPhotos = [...post.photos]
    .map((p: any): CarouselPhoto | null => {
      if (typeof p === 'string') {
        return p.trim() !== '' ? { url: p } : null;
      }
      if (p && typeof p === 'object' && typeof p.url === 'string' && p.url.trim() !== '') {
        return { url: p.url, caption: p.caption };
      }
      return null;
    })
    .filter((p): p is CarouselPhoto => p !== null)
    .sort((a: any, b: any) => {
      // Sort only has meaningful keys on the object form. String-form photos
      // all sort equal (stable sort preserves insertion order).
      const aPhoto = post.photos.find((x: any) => (typeof x === 'object' ? x.url : x) === a.url);
      const bPhoto = post.photos.find((x: any) => (typeof x === 'object' ? x.url : x) === b.url);
      if (aPhoto && typeof aPhoto === 'object' && aPhoto.is_highlight) return -1;
      if (bPhoto && typeof bPhoto === 'object' && bPhoto.is_highlight) return 1;
      const aOrder = aPhoto && typeof aPhoto === 'object' ? (aPhoto.order ?? 0) : 0;
      const bOrder = bPhoto && typeof bPhoto === 'object' ? (bPhoto.order ?? 0) : 0;
      return aOrder - bOrder;
    });
}
```

**Approach B — Normalize at the top of the function, keep existing derivation simple:**

Reshape `post.photos` into a canonical object array at the top of the derivation, then run the existing sort/map logic unchanged:

```typescript
// Normalize post.photos to a canonical {url, caption, order, is_highlight}[] form
// regardless of whether the jsonb entries are strings or objects. This keeps the
// downstream derivation simple.
const normalizedPhotos: Array<{
  url: string;
  caption?: string;
  order?: number;
  is_highlight?: boolean;
}> = (post.photos || [])
  .map((p: any) => {
    if (typeof p === 'string') {
      return p.trim() !== '' ? { url: p } : null;
    }
    if (p && typeof p === 'object' && typeof p.url === 'string' && p.url.trim() !== '') {
      return { url: p.url, caption: p.caption, order: p.order, is_highlight: p.is_highlight };
    }
    return null;
  })
  .filter((p: any): p is { url: string; caption?: string; order?: number; is_highlight?: boolean } => p !== null);

const hasPhotos = normalizedPhotos.length > 0;  // replace the old check
```

Then the `else` branch becomes the existing sort-and-map run against `normalizedPhotos` instead of `post.photos`. This requires updating the `hasPhotos` computation earlier in the function.

**Choose one approach.** Approach A is a more surgical change; Approach B is a more thorough normalization. Document your choice and reasoning in the SESSION_LOG entry.

**Important notes:**

- **Handle three input shapes defensively**: bare string, object with valid url, anything else (null, missing url, empty url, number, boolean). Anything not matching the first two shapes becomes `null` and gets filtered out. This is defensive against future schema drift.
- **Empty-string URLs are filtered**, not passed through. The original bug was `p.url` being `undefined` which `<Image>` treats as empty string. Filter before PhotoCarousel receives the array so empty-URL entries don't produce blank slots.
- **If all entries are filtered out**, `carouselPhotos` becomes `[]` and PhotoCarousel returns `null`, which correctly collapses the slot.
- **Do NOT modify the other branches** of the `carouselPhotos` assignment (`photosOverride === null`, `photosOverride !== undefined`, the `!hasPhotos && hasRecipeImage` branch). Those are correct.

**Verification:** after the fix, the three confirmed broken posts (Anthony kombucha, Chickpea soup, Watermelon feta) should render their seed photos correctly. Photoless posts should still collapse the slot. Object-form photo posts should render unchanged.

---

### 4.5.2 — Fix `optimizeStorageUrl` to skip the render endpoint for uppercase extensions

**File:** `components/feedCard/sharedCardElements.tsx`

**Location:** The `optimizeStorageUrl` function at the top of the file (currently ~lines 30-45).

**Change:** Add an uppercase-extension detection step. If the file extension is not a recognized lowercase image extension, return the raw object URL unchanged instead of rewriting to the render endpoint.

```typescript
export function optimizeStorageUrl(
  url: string | null | undefined,
  width: number = 1600,
  quality: number = 50
): string {
  if (!url || typeof url !== 'string') return url || '';
  if (url.includes('/storage/v1/render/image/')) return url; // already rewritten
  const marker = '/storage/v1/object/public/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  // Supabase's /render/image/ endpoint requires lowercase file extensions.
  // Files with uppercase extensions (.JPG, .JPEG, .PNG) or double extensions
  // (.jpg.JPG from some extraction pipelines) fail silently on the render
  // endpoint. For those URLs, fall back to the raw /object/public/ endpoint
  // which serves bytes verbatim and doesn't care about extension casing.
  // Cost: no per-image size optimization on ~347 affected recipes. Acceptable
  // tradeoff until a storage filename normalization migration runs (P7-72).
  const lowercaseExtSafe = /\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(url);
  if (!lowercaseExtSafe) return url;

  const prefix = url.slice(0, idx);
  const rest = url.slice(idx + marker.length);
  return `${prefix}/storage/v1/render/image/public/${rest}?width=${width}&quality=${quality}&resize=contain`;
}
```

**Important notes:**

- **The regex is case-sensitive on purpose.** It only matches lowercase extensions. Uppercase or mixed-case extensions fail the test and return the raw URL unchanged.
- **The `(\?|$)` anchor** ensures we match the extension at the end of the path or immediately before a query string (URLs like `photo.jpg?v=2` still match and route to the render endpoint correctly).
- **Double-extension files** like `photo.jpg.JPG` correctly fail the test because the trailing `.JPG` doesn't match the lowercase-only regex. They return the raw URL.
- **Do NOT attempt to rename the underlying storage files** or modify the URLs in any other way. The bytes on disk are named with their actual (uppercase) extensions and the raw endpoint serves them fine. The filename normalization migration is deferred as P7-72.
- **No other function in this file needs changes.**

---

### 4.5.3 — Revert diagnostic edits

**Files:**
- `screens/FeedScreen.tsx` — revert the manual `Date.now()` timing instrumentation back to the original `console.time`/`console.timeEnd` pairs that existed post-Checkpoint 4. The original lines are preserved as comments above each manual-timing block — uncomment them and delete the corresponding manual-timing lines.
- `components/feedCard/CookCard.tsx` — delete the `[DIAG 1a]` console.log block added after the `isPhotoless` computation in `CookCardInner`. It's the three-line `if (post.title === ...) { console.log(...); }` block.

**Important:**
- **Do NOT remove the flask debug button** (`🧪`) from FeedScreen's header. It stays through Checkpoint 5 for visual verification of the test harness.
- **Keep the Checkpoint 4 timing instrumentation mechanism in FeedScreen.** The revert is from manual `Date.now()` back to `console.time`/`console.timeEnd` — the instrumentation is NOT being deleted, just changed back to the original form. Yes, `console.time` output doesn't surface to Metro. That's a tracked issue (P7-76 below). The original form ships because Checkpoint 4 shipped that way and we're not expanding fix-pass scope to argue about which form of instrumentation should be canonical. P7-76 captures the decision for future planning.

---

### What this fix pass does NOT include

Explicitly out of scope — do not touch any of these, even if you notice something worth fixing:

- `prefetchPreheadContext` — slow-ish at ~1.15s steady-state but working. Batching deferred as P7-75.
- `hydrateEngagement` — slow-ish at ~1.0s steady-state. No current hypothesis for why. Deferred as P7-74.
- The legacy `MealDetailScreen` — works against meal_event posts (verified on device). Will be replaced in Checkpoint 6 as `MealEventDetailScreen`.
- The CookPartnerPrehead vs MealEventPrehead distinction in solo card rendering — working correctly per the real-data verification.
- The storage filename normalization migration — deferred as P7-72. Not a code change.
- `groupPostsForFeed` and other retired feed-grouping code — stays untouched until Checkpoint 7 cleanup.
- Any component in `components/feedCard/groupingPrimitives.tsx` — stable from Checkpoint 3.5.
- Any file outside `screens/FeedScreen.tsx`, `components/feedCard/CookCard.tsx`, and `components/feedCard/sharedCardElements.tsx`.

---

## Verification

After all three sub-sections land:

1. **TypeScript compiles cleanly** across all touched files. `npx tsc --noEmit` on `FeedScreen.tsx`, `CookCard.tsx`, and `sharedCardElements.tsx` returns zero errors.

2. **Anthony's kombucha post renders its seed photo.** If this post is still in the scrollable feed, Tom will open the Feed tab, scroll to the post with the L4 "at Kombucha batch #2 with Anthony 🫖 · Tom Morley" prehead, and confirm the photo carousel renders a photo where the blank region used to be. If the post isn't findable, Tom picks any post that has a seed photo attached and confirms it renders.

3. **Chickpea, tomato and bread soup renders its photo.** Same check. If findable.

4. **Watermelon and feta renders its photo.** Same check. If findable.

5. **Photoless freeform posts (truly empty photos array) still collapse cleanly.** The three "Untitled Post" rows that appeared in the diagnostic with `photos: []` should render as compact cards with no blank photo region.

6. **Non-broken posts still render correctly.** Pick any post that rendered fine before the fix (e.g. Mary's Pasta Salad or "Farro & Charred Corn Salad"). Confirm no regression — photo still renders, stats still render, engagement row still renders.

7. **Grep verification:**
   - `grep -n "console.time\|console.timeEnd" screens/FeedScreen.tsx` should show the six original pairs uncommented, matching the pre-diagnostic state.
   - `grep -n "DIAG 1a\|t_loadFeed\|t_loadFollows\|t_loadDishPosts\|t_buildFeedGroups\|t_hydrateEngagement\|t_prefetchPreheadContext" components/feedCard/CookCard.tsx screens/FeedScreen.tsx` should return zero matches. No diagnostic lines left behind.
   - `grep -n "🧪" screens/FeedScreen.tsx` should still show the flask button definition (1 match expected).

8. **`optimizeStorageUrl` mental/REPL check.** Verify:
   - `optimizeStorageUrl('https://x/storage/v1/object/public/b/photo.jpg')` → routes to render endpoint ✓
   - `optimizeStorageUrl('https://x/storage/v1/object/public/b/photo.JPG')` → returns raw URL unchanged ✓
   - `optimizeStorageUrl('https://x/storage/v1/object/public/b/photo.jpg.JPG')` → returns raw URL unchanged ✓
   - `optimizeStorageUrl('https://x/storage/v1/object/public/b/photo.jpg?v=2')` → routes to render endpoint ✓
   - `optimizeStorageUrl(null)` → returns '' ✓

---

## Hard stop requirements

After all verification steps pass, write a SESSION_LOG entry titled `2026-04-14 — Phase 7I Checkpoint 4.5 — Photo Rendering Fix Pass` including:

- **Files modified:** the three source files, plus the revert of the earlier "in-progress diagnostic" session log entry (see below)
- **Sub-section 4.5.1 findings:** which implementation approach you chose (A surgical fix or B normalization-at-top), reasoning, what string-vs-object edge cases you encountered if any, whether the three confirmed-broken posts render correctly post-fix
- **Sub-section 4.5.2 findings:** confirm the regex passes the four test URLs correctly, note any URL shape you encountered that didn't fit the expected pattern
- **Sub-section 4.5.3 findings:** confirm the manual-timing revert is clean and `console.time`/`console.timeEnd` are back in place. Confirm the `[DIAG 1a]` block is deleted. Confirm the flask button is still present.
- **Visual verification results:** describe what Tom sees on-device for the three target posts + one photoless post + one non-broken regression check. (You cannot perform this check yourself — leave placeholders and wait for Tom's on-device report.)
- **Resolve the in-progress diagnostic SESSION_LOG entry:** the earlier "Phase 7I Checkpoint 4 on-device diagnostic (in progress)" entry should be updated to mark status "complete" with a one-line reference to this 4.5 entry. Do NOT delete the earlier entry; append a closing note to it.
- **Recommended deferred items to add to `PHASE_7_SOCIAL_FEED.md`:**
  - **P7-72** — Recipe image filename normalization (storage migration). Rename ~347 recipe images from uppercase/double extensions to canonical lowercase single extensions + update `recipes.image_url`. Requires storage object copy + delete + SQL update. Low urgency (Checkpoint 4.5's `optimizeStorageUrl` fallback handles the render-endpoint issue). Also requires fixing the upstream cookbook extraction pipeline so renormalized files don't drift. Flag as 🟡.
  - **P7-73** — `posts.photos` jsonb shape normalization. Column contains a mix of string-array and object-array forms depending on which write path created the post. CookCardInner now handles both defensively (Checkpoint 4.5), but the underlying data should be normalized to a single canonical shape and write paths audited to ensure they all produce the same form. Investigation task: `SELECT id, jsonb_typeof(photos->0) FROM posts WHERE photos IS NOT NULL AND jsonb_array_length(photos) > 0 GROUP BY jsonb_typeof(photos->0)` to measure how split the data is. Flag as 🟡.
  - **P7-74** — `hydrateEngagement` steady-state performance investigation. Averages ~1.0s across four parallel Supabase queries (highlights, likes, comments, participants) for a 200-post feed. No current hypothesis for which query is the bottleneck. Investigation task: add per-query timing inside `hydrateEngagement` to isolate the slow call, then decide fix. Flag as 🟡.
  - **P7-75** — Batched `getMealEventsByIds` variant for `prefetchPreheadContext`. Currently ~1.15s steady-state from naive `Promise.all` over unique meal event IDs. Fix: write batched service function that fetches all meal_event rows + host profiles + contributor counts in 2-3 round trips instead of N. Expected speedup: loadFeed total from ~3.3s to ~2.5s. Defer unless Checkpoint 5's iteration loop feels painful. Flag as 🟢.
  - **P7-76** — `console.time` / `console.timeEnd` output doesn't surface to Metro stdout. Likely LogBox filter on performance markers, unconfirmed. Manual `Date.now()` instrumentation pattern works. Consider whether the canonical instrumentation form in FeedScreen should switch from `console.time` to manual. Non-urgent; only matters when instrumentation is re-enabled for diagnostic work. Flag as 🟢.
- **Resolved-incidental: Fix Pass 9 pull-to-refresh 15s hang finding.** Four refresh cycles in the Checkpoint 4.5 diagnostic measured loadFeed at 3187-3334ms steady-state with no hang. Mark the original Fix Pass 9 finding as resolved-incidental by the Checkpoint 4 FeedScreen rewrite. Do NOT remove the phase timing instrumentation — it may be needed again for future investigations.
- **Checkpoint 4.5 diagnostic telemetry snapshot** (for future reference):
  - Cold launch loadFeed: 7172ms (loadFollows 437, loadDishPosts 1200, buildFeedGroups 563, hydrateEngagement 3743, prefetchPreheadContext 1225)
  - Steady-state loadFeed avg (sets 2-5): 3270ms (loadFollows ~171, loadDishPosts ~453, buildFeedGroups ~453, hydrateEngagement ~1022, prefetchPreheadContext ~1155)
  - Feed cap telemetry: 159 groups from 200 posts, oldest post 2026-01-24 (~11 weeks runway before P7-44 pagination becomes urgent)
  - Zero errors/exceptions across 5 full loadFeed cycles
- **GO / NO-GO recommendation for Checkpoint 5:** based on fix-pass results, should Checkpoint 5 (CookDetailScreen + narrow-scope editing) proceed?

**Do NOT proceed to Checkpoint 5.** Do NOT start CookDetailScreen work. Do NOT modify any components in `components/feedCard/` beyond the two files scoped to 4.5.1 and 4.5.3. Hard stop. Wait for Tom's review.

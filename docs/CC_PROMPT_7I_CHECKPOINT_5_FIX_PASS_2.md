# Phase 7I Checkpoint 5 — Fix Pass #2

**Phase:** 7I Checkpoint 5 — second fix pass, runs before Checkpoint 5 is formally closed

**Prior work:**
- Checkpoint 5 Pass 1, Pass 1 Fix Pass, and Pass 2 all complete per `docs/SESSION_LOG.md`.
- Tom did on-device unified verification and surfaced three issues worth fixing before closing Checkpoint 5.

**Goal:** Ship three targeted fixes. Do NOT start Checkpoint 6. Do NOT touch `MealDetailScreen`. After the three fixes land, append findings to the existing Checkpoint 5 SESSION_LOG entry under a new `## Fix Pass #2 — 2026-04-15` section, and HARD STOP.

---

## Fix 1 — PhotoCarousel "Rendered more hooks than during the previous render"

### Problem

Red screen crash: `Render Error: Rendered more hooks than during the previous render`. Call stack points to `PhotoCarousel` in `components/feedCard/sharedCardElements.tsx`, specifically a `useEffect` hook. The crash occurs after returning from EditMediaScreen to CookDetailScreen — the `useFocusEffect` refetch loads updated post data with a different photo count, which triggers a re-render of PhotoCarousel with a different number of hook calls.

### Root cause hypothesis

The Checkpoint 5 Pass 1 added `scrollToIndex` / `onScrollToIndexComplete` props to `PhotoCarousel`, along with a `useEffect` that watches `[scrollToIndex, photoRatios, photos.length]`. If this `useEffect` is placed AFTER the early-return `if (visibleCount === 0) return null;` guard (added in the same pass for D50 onError handling), then:

- On initial render: photos array has N items, `visibleCount > 0`, the useEffect runs → hook count = K
- After EditMedia return: refetch fires, photos array temporarily has 0 items during loading state, `visibleCount === 0`, early return fires BEFORE the useEffect → hook count = K-1
- React detects the hook count changed → red screen

**This is a classic "hooks below an early return" violation.** ALL hooks must be called unconditionally before any early returns.

### Fix

Move the `if (visibleCount === 0) return null;` guard to AFTER all `useState` and `useEffect` calls in `PhotoCarousel`. The guard should be the last thing before the JSX return, not interspersed between hooks.

Specifically, audit the entire `PhotoCarousel` function body and ensure:
1. ALL `useState` calls are at the top, before any conditional returns
2. ALL `useEffect` calls are after the `useState` calls, before any conditional returns
3. The `if (visibleCount === 0) return null;` guard comes AFTER all hooks
4. Any other conditional returns (e.g., `if (!photos || photos.length === 0) return null;`) also come AFTER all hooks

The pattern should be:
```typescript
function PhotoCarousel({ photos, colors, scrollToIndex, onScrollToIndexComplete, ...rest }) {
  // 1. ALL useState calls (unconditional)
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set());
  const [photoRatios, setPhotoRatios] = useState<...>(...);
  // ... any other useState ...

  // 2. ALL useEffect calls (unconditional)
  useEffect(() => { /* scrollToIndex logic */ }, [scrollToIndex, photoRatios, photos.length]);
  useEffect(() => { /* any other effects */ }, [...]);

  // 3. Derived values
  const visibleCount = photos.length - failedIndices.size;

  // 4. THEN early returns (after all hooks)
  if (visibleCount === 0) return null;
  if (!photos || photos.length === 0) return null;

  // 5. JSX return
  return (...);
}
```

### Verify

- `npx tsc --noEmit` returns zero errors for `sharedCardElements.tsx`
- Reproduce the crash: navigate to CookDetailScreen → ••• → Add photos → add a photo in EditMedia → Save → return to CookDetailScreen. **The red screen should NOT appear.** The hero carousel should re-render with the updated photo set.
- Verify that the D50 empty-collapse still works: if ALL photos fail to load (e.g., the Purple Sprouting Broccoli case), PhotoCarousel still returns null correctly — the early return is just moved below the hooks, not removed.

---

## Fix 2 — Delete post missing confirmation Alert + diagnosis

### Problem

Tom tapped "Delete post" in the overflow menu. No confirmation Alert dialog appeared. The screen navigated back to the feed. The post was still present in the feed after reopening the app — suggesting the delete either silently failed or never executed.

The Checkpoint 5 prompt specified: `Alert.alert('Delete this post? This can\'t be undone.', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => handleDelete() }])`.

### Diagnosis steps

1. Read `screens/CookDetailScreen.tsx` and find the delete menu item handler. Verify whether `Alert.alert` is present or whether the handler calls `deletePost` directly without the Alert guard.

2. If the Alert IS present but not firing, check whether the handler is `async` with an `await` before the Alert — `Alert.alert` is not awaitable and an `async` function that calls `Alert.alert` without awaiting (which is correct — Alert.alert is callback-based) should still show the dialog. Check for any try/catch that might be swallowing the Alert.

3. If the Alert is NOT present (most likely based on Tom's report), add it per the prompt spec.

4. Regardless of the Alert issue, verify that `deletePost(postId)` actually deletes the post. Add a temporary `console.warn` AFTER the delete call:
   ```typescript
   console.warn(`[CookDetailScreen] deletePost(${post.id}) completed without error`);
   ```
   And in the catch block:
   ```typescript
   console.warn(`[CookDetailScreen] deletePost(${post.id}) FAILED:`, error);
   ```

5. Verify `deletePost` in `lib/services/postService.ts` — confirm it calls `supabase.from('posts').delete().eq('id', postId)` and throws on error. Check whether the Supabase response includes an error object that's being silently ignored.

### Fix

- Add the `Alert.alert` confirmation dialog if missing
- Ensure the delete handler follows this exact flow:
  ```typescript
  const handleDeletePost = () => {
    Alert.alert(
      'Delete this post?',
      "This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(post.id);
              console.warn(`[CookDetailScreen] deletePost(${post.id}) succeeded`);
              navigation.goBack();
            } catch (error) {
              console.warn(`[CookDetailScreen] deletePost(${post.id}) FAILED:`, error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  };
  ```
- If `deletePost` in `postService.ts` is not properly throwing on error (e.g., it swallows the Supabase error), fix the service function to throw.

### Verify

- Tap ••• → Delete post → **confirmation Alert appears** with Cancel and Delete buttons
- Tap Cancel → Alert dismisses, post is unchanged
- Tap Delete → post is deleted, screen navigates back to feed, post is absent from the feed
- Metro log shows `[CookDetailScreen] deletePost(...) succeeded`
- Relaunch the app → post is still absent from feed (not cached)

---

## Fix 3 — Console.warn instrumentation on all overflow menu handlers

### Problem

During on-device testing, Tom had no visibility into what the overflow menu handlers were doing — no Metro log output to confirm whether operations succeeded, failed, or were even attempted. This made debugging the delete issue harder than necessary.

### Fix

Add `console.warn` instrumentation to ALL SIX overflow menu item handlers in `screens/CookDetailScreen.tsx`. Each handler should log at entry and at completion/failure. Use `console.warn` (not `console.log`) so the output surfaces in Metro/LogBox reliably (React Native's LogBox sometimes filters `console.log` but consistently shows `console.warn`).

**Pattern for each handler:**

```typescript
// Entry
console.warn(`[CookDetailScreen] ${handlerName} started — postId: ${post.id}`);

// Success
console.warn(`[CookDetailScreen] ${handlerName} succeeded`);

// Failure (in catch block)
console.warn(`[CookDetailScreen] ${handlerName} FAILED:`, error);
```

**Specific handlers to instrument:**

1. **Add photos** — log when navigating to EditMedia: `handleMenuAddPhotos started`
2. **Edit title** — log on save: `handleSaveTitle succeeded — new title: "${trimmed}"` / on reject: `handleSaveTitle rejected — empty string`
3. **Edit description** — log on save: `handleSaveDescription succeeded — cleared: ${!trimmed}` 
4. **Manage cook partners** — log the diff: `handleManagePartnersConfirm — adding: [${toAdd}], removing: [${toRemove}]` / on success: `handleManagePartnersConfirm succeeded`
5. **Change meal event** — log the selection: `handleChangeMealEvent — newMealId: ${id || 'null (detaching)'}` / on success: `handleChangeMealEvent succeeded`
6. **Delete post** — already instrumented in Fix 2 above

Also add instrumentation to the `useFocusEffect` refetch so Tom can see when data reloads after returning from EditMedia:
```typescript
console.warn(`[CookDetailScreen] useFocusEffect refetch triggered`);
```

### What this instrumentation is NOT

- NOT permanent. It's dogfooding instrumentation for the testing period. It will be removed in Checkpoint 7's cleanup pass or when 7M replaces the overflow menu.
- NOT a replacement for proper error handling. Each handler should still show user-facing error feedback (Alert on failure) — the console.warn is in addition to that, not instead of it.

### Verify

- After each overflow menu operation, Metro/LogBox shows the corresponding `[CookDetailScreen]` warn entry
- Verify at least: Add photos → navigate log, Edit title → save log, Delete → confirm + succeed/fail log

---

## What this fix pass does NOT include

- **No PhotoCarousel layout changes** (peek, inline photos, swipe reliability). Deferred to Checkpoint 5.5.
- **No CookDetailScreen layout changes** (title in header, remove photos block). Deferred to Checkpoint 5.5.
- **No EditMedia redesign**. Deferred to Phase 7M.
- **No "Edit Cook" unified screen**. Deferred to Phase 7M.
- **No CommentsScreen keyboard avoidance**. Deferred (P7-85).
- **No MealEventDetailScreen work**. Checkpoint 6.
- **No changes to `groupingPrimitives.tsx`, `CookCard.tsx`, `FeedScreen.tsx`**.
- **No changes to `AddCookingPartnersModal.tsx` or any service file other than potentially `postService.ts`** (only if Fix 2 reveals a bug in `deletePost`).

---

## Files you are expected to touch

- `components/feedCard/sharedCardElements.tsx` — Fix 1: move early returns below all hooks in PhotoCarousel
- `screens/CookDetailScreen.tsx` — Fix 2: add Alert confirmation to delete handler. Fix 3: add console.warn instrumentation to all six menu handlers + useFocusEffect
- `lib/services/postService.ts` — Fix 2: only if diagnosis reveals `deletePost` is silently swallowing errors
- `docs/SESSION_LOG.md` — append Fix Pass #2 section to the existing Checkpoint 5 entry

**Files you should NOT touch:**
- Everything else. Especially `CookCard.tsx`, `groupingPrimitives.tsx`, `FeedScreen.tsx`, `App.tsx`, `AddCookingPartnersModal.tsx`.

---

## SESSION_LOG update

Append a new section to the existing Checkpoint 5 entry:

```
## Fix Pass #2 — 2026-04-15
```

Include:
- **Files modified** — list with roles
- **Fix 1 findings:** Was the early-return-above-hooks the actual cause? Which hooks were below the guard? How many were moved? Confirm the D50 empty-collapse still works after the reorder.
- **Fix 2 findings:** Was the Alert missing entirely, or present but not firing? Was `deletePost` silently failing or not being called? What was the actual root cause? Confirm the full flow now works: Alert → confirm → delete → goBack → post absent.
- **Fix 3 findings:** Confirm all six handlers instrumented. List any handlers that were missing try/catch blocks (and whether you added them).
- **Grep verification** — TypeScript clean, grep for any remaining un-instrumented handlers
- **Visual verification PENDING** — list the specific on-device checks Tom should run

Then HARD STOP. No Checkpoint 6 work.

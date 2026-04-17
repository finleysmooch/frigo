# Phase 7I Checkpoint 5 — Pass 1 Fix Pass

**Phase:** 7I Checkpoint 5 — Pass 1 fix pass (small scope), runs before Pass 2 begins

**Prior work:**
- Checkpoint 5 Pass 1 landed per `docs/CC_PROMPT_7I_CHECKPOINT_5_COOKDETAIL.md`. Partial SESSION_LOG entry exists at `docs/SESSION_LOG.md` titled `2026-04-14 — Phase 7I Checkpoint 5 — CookDetailScreen + Narrow Editing`, ending in the literal `PAUSED — awaiting GO for Sub-section 5.3` marker.
- Tom did on-device Pass 1 verification and surfaced two findings worth fixing before Pass 2 starts. A third finding (cook partner rendering) was diagnosed as correct approval-gated behavior — not a bug — and is handled via a test-data SQL unstick Tom runs directly against the DB. Not in scope for this fix pass.

**Goal:** Ship two small, targeted fixes that close out Pass 1's visual verification before Sub-section 5.3 begins. Do NOT start 5.3. Do NOT touch `AddCookingPartnersModal`, `postService`, or any overflow menu wiring. After the two fixes land, append findings to the existing SESSION_LOG entry (don't create a new one), REPLACE the `PAUSED — awaiting GO for Sub-section 5.3` marker with an updated `PAUSED — fix pass complete, awaiting GO for Sub-section 5.3` marker, and HARD STOP.

---

## Fix 1 — CookCard tap target expansion

### Problem

Tapping a CookCard on the feed currently only navigates to CookDetailScreen when the tap lands inside the title+description+recipe-line cluster (wrapped in `TappableTitleBlock`). Taps on the photo carousel, stats row, header, engagement row, or empty card body do not navigate. Expected behavior: tapping anywhere on the card body routes to CookDetailScreen, EXCEPT regions that have their own tap handlers (recipe line → RecipeDetail, menu button → overflow menu, like/comment buttons → their own handlers).

### Root cause

`CookCardInner` returns a React Fragment (`<>...</>`) of sibling elements, with `TappableTitleBlock` wrapping only the title / description / recipe-line cluster as the single tap region. Every other element in the fragment is untappable by default.

### Fix

Replace the Fragment return of `CookCardInner` with an outer `Pressable` wrapper whose `onPress` is the `onPress` prop (i.e., navigate-to-CookDetail). Replace the inner `TappableTitleBlock` with a plain `View` (its tap-wrapping duty is now handled by the outer Pressable). Inner interactive elements — `RecipeLine`'s internal TouchableOpacity, the menu button inside `CardHeader`, the like and comment buttons inside `EngagementRow` and `ActionRow` — already use their own `TouchableOpacity` / `Pressable` wrappers and will correctly intercept taps via React Native's gesture responder system before the outer Pressable sees them.

### Specific edits to `components/feedCard/CookCard.tsx`

1. Import `Pressable` from `react-native` at the top of the file (add to the existing `import { View, Text } from 'react-native'` line → `import { View, Text, Pressable } from 'react-native'`).

2. In the `CookCardInner` function, replace the outer `<>...</>` Fragment with a `<Pressable onPress={onPress}>...</Pressable>` wrapper. The children stay in the same order.

3. Replace the `<TappableTitleBlock onPress={onPress}>...</TappableTitleBlock>` wrapper (around title + DescriptionLine + RecipeLine) with a plain `<View>...</View>` wrapper. The inner `onPress={onPress}` is no longer needed at this level — the outer Pressable handles it. Keep the same children in the same order.

4. If `TappableTitleBlock` is now unused anywhere in the codebase, leave its export in `sharedCardElements.tsx` alone (do not delete) — it may be needed by future surfaces, and removing it is outside fix-pass scope. Just stop importing it from `CookCard.tsx`. Update the import line in `CookCard.tsx` to remove `TappableTitleBlock` from the imports list.

### Verify

- **TypeScript compiles cleanly.** `npx tsc --noEmit` returns zero errors for the touched file.
- **Grep check.** `grep -n "TappableTitleBlock" components/feedCard/CookCard.tsx` returns zero matches.
- **React Native gesture responder verification — mental test before running on device:**
  - Tap on the photo carousel region → should propagate up to the outer Pressable → navigate to CookDetail. (Correct, since `PhotoCarousel` does not currently have tap handlers on its slides.)
  - Tap on the title → outer Pressable → navigate to CookDetail. (Correct.)
  - Tap on the recipe line text inside `RecipeLine` → `RecipeLine`'s internal `TouchableOpacity` (when `onRecipePress` is provided) intercepts → `onRecipePress` fires → navigate to RecipeDetail. Does NOT propagate up. (Correct per React Native gesture responder rules: innermost touchable wins.)
  - Tap on the menu button (••• in header) on own posts → `CardHeader`'s internal menu button `TouchableOpacity` intercepts → `onMenu` fires. Does NOT propagate. (Correct.)
  - Tap on the like button in the action row → `ActionRow`'s like `TouchableOpacity` intercepts → `onLike` fires. (Correct.)
  - Tap on the comment button → `onComment` fires. (Correct.)
  - Tap on empty card body (e.g., below stats row, gap between elements) → outer Pressable → navigate to CookDetail. (Correct.)

If any of the inner handlers does NOT propagate correctly (e.g., a child element is a plain `View` instead of a `TouchableOpacity` / `Pressable`), the outer tap will wrongly fire BOTH the child handler AND the outer navigate. Audit the child elements that should have their own tap handling. If you find a child that should be interactive but is rendered as a plain `View`, wrap it in `TouchableOpacity` / `Pressable` with the appropriate `onPress`. Document any such finding in the SESSION_LOG appendix.

### Scope considerations

- **This fix extends to linked groups automatically.** `CookCardInner` is also consumed by `LinkedCookStack` and `SharedRecipeLinkedGroup` in `groupingPrimitives.tsx`. After this fix, each sub-section of a linked group becomes independently tappable — tapping Tom's sub-section in a Tom+Anthony carbonara card routes to Tom's CookDetail; tapping Anthony's routes to Anthony's. This is the intended behavior per D48's design and requires no additional changes to `groupingPrimitives.tsx`. Verify this on device during post-Pass-2 verification (Tom's unified verification pass, not this fix pass).
- **Do NOT modify `groupingPrimitives.tsx`**. The linked group components consume `CookCardInner` and will pick up the new outer Pressable automatically. Any modification to `groupingPrimitives.tsx` is scope creep.
- **Do NOT modify `TappableTitleBlock`'s definition** in `sharedCardElements.tsx`. Leave it exported in case future surfaces need it. We are merely removing the import from `CookCard.tsx`.
- **Do NOT remove `TappableTitleBlock` from `sharedCardElements.tsx`**. Its export stays.

---

## Fix 2 — CookDetailScreen Block 9 Highlights paragraph slot strip

### Problem

The current Block 9 implementation in `screens/CookDetailScreen.tsx` renders the `HighlightsPill` followed by a paragraph `Text` component that echoes the same `highlight.text` string as the pill. This is visually redundant — the pill and the paragraph say the same thing. The Checkpoint 5 prompt described the paragraph as a richer descriptive sentence (e.g., "You're on a carbonara streak — this is your third time this month"), but the `Highlight` data model only carries one `text` field, so the paragraph has nothing additional to render. The redundant echo is worse than no paragraph at all — it occupies vertical space and implies additional content that doesn't exist.

### Fix

Strip the paragraph `Text` component entirely from Block 9. Leave the `HighlightsPill` in place. Block 9 becomes pill-only, matching the feed card's Highlights rendering.

### Specific edits to `screens/CookDetailScreen.tsx`

1. Locate Block 9 (the Highlights rendering block) in the screen.
2. Delete the paragraph `Text` component that renders the highlight descriptive text (the one following the `HighlightsPill` element). Also delete any associated styles that are now unused — remove them from the StyleSheet at the bottom of the file.
3. Ensure Block 9 still renders correctly when the highlight is present (pill alone) and is still absent when no highlight fires for the post.

### Verify

- **TypeScript compiles cleanly.** `npx tsc --noEmit` returns zero errors.
- **Grep verification that no stale references to the paragraph style remain.** If the paragraph had a named style (e.g., `highlightsDescription` or similar), grep for it to confirm no remaining references.
- Block 9 renders pill-only when a highlight is present. Confirmed visually on device during post-Pass-2 unified verification.

### What this fix does NOT do

- Does NOT touch the `Highlight` interface or `highlightsService`. The proper fix — extending `Highlight` with a `longText?: string` field and updating the service to populate it — is captured as **P7-81** and remains deferred.
- Does NOT touch the feed card's Highlights rendering. Feed cards already render pill-only; they are unaffected.
- Does NOT touch Block 9's rendering logic for the "no highlight for this post" absent case. That logic already works per Pass 1 findings; we're only removing the paragraph slot.

---

## What this fix pass does NOT include

- **No changes to `AddCookingPartnersModal`, `postService`, or any overflow menu wiring.** Pass 2 territory — do not touch.
- **No changes to `screens/MealDetailScreen.tsx`**. Checkpoint 6.
- **No changes to `components/feedCard/groupingPrimitives.tsx`**. The fix propagates through CookCardInner automatically.
- **No changes to `sharedCardElements.tsx`** except removing `TappableTitleBlock` from `CookCard.tsx`'s import list. `TappableTitleBlock`'s definition and export stay.
- **No changes to the post-creation participant approval flow.** Tom diagnosed the cook-partner visibility issue as correct approval-gated behavior, handled via a SQL unstick he runs himself. Not in scope here.
- **No changes to the cook time / prep time split display on CookDetailScreen Block 8 (P7-80).** Deferred per Tom's decision.
- **No changes to the `Highlight` data model or `highlightsService` (P7-81).** Deferred per above.
- **No changes to the author location line on Block 3 (P7-82).** Deferred.
- **No changes to the CommentsScreen extraction (P7-83).** Deferred.
- **No changes to the pending cook partner visibility (P7-84 — new, see below).** Deferred.
- **No changes to the flask debug button** in FeedScreen's header. Stays through Checkpoint 6.

---

## Files you are expected to touch

- `components/feedCard/CookCard.tsx` — Fix 1: outer Pressable wrapper, replace TappableTitleBlock with View, update imports
- `screens/CookDetailScreen.tsx` — Fix 2: strip Highlights paragraph slot, remove associated styles
- `docs/SESSION_LOG.md` — Append fix pass findings to the existing Checkpoint 5 entry (do not create a new entry), replace the PAUSED marker

**Files you should NOT touch:**

- `components/feedCard/sharedCardElements.tsx` — `TappableTitleBlock` definition stays
- `components/feedCard/groupingPrimitives.tsx` — propagation handled automatically
- `components/feedCard/CardHeader.tsx` — inner menu button already uses TouchableOpacity
- `components/AddCookingPartnersModal.tsx` — Pass 2
- `lib/services/postService.ts` — Pass 2
- `lib/services/postParticipantsService.ts` — no changes needed
- Any `post_participants`, `post_likes`, `post_comments` schema changes
- Any file outside the three listed above

---

## SESSION_LOG update

Append a new section to the existing `2026-04-14 — Phase 7I Checkpoint 5 — CookDetailScreen + Narrow Editing` entry. Do NOT create a new entry. Title the new section:

```
## Pass 1 Fix Pass — 2026-04-14
```

Include:

- **Files modified in this fix pass** — two files + SESSION_LOG itself
- **Fix 1 findings:** outer Pressable wrapper landed cleanly, TappableTitleBlock import removed, inner tap-handler propagation verified via mental walk-through (or any concerns raised). If you found any child element that needed wrapping in TouchableOpacity because it was a plain View that should have been interactive, document it.
- **Fix 2 findings:** Highlights paragraph slot removed, associated styles cleaned up, Block 9 now pill-only
- **New deferred items surfaced during this fix pass** — if any. Probably none, but capture if found.
- **Grep verification output** — TappableTitleBlock reference count, TypeScript compile status

Then REPLACE the old PAUSED marker:

```
PAUSED — awaiting GO for Sub-section 5.3 (narrow-scope editing overflow menu + AddCookingPartnersModal audit).
```

with:

```
PAUSED — fix pass complete, awaiting GO for Sub-section 5.3 (narrow-scope editing overflow menu + AddCookingPartnersModal audit).
```

Then HARD STOP. Do NOT start Sub-section 5.3. Do NOT touch `AddCookingPartnersModal`. Do NOT touch `postService`. Wait for Tom's GO.

---

## Deferred items to add (Tom will add these during checkpoint closeout, not now)

Captured here for the working doc; CC does NOT write these to `PHASE_7_SOCIAL_FEED.md` during this fix pass. They land during Pass 2's formal closeout.

- **P7-80** 🟢 Separated cook time / prep time display on CookDetailScreen Block 8. Flagged by CC during Pass 1, accepted deferral by Tom. Aggregate display is functional; splitting is polish.
- **P7-81** 🟡 CookDetailScreen Highlights descriptive paragraph. Proper fix requires extending `Highlight` data model with `longText?: string` and updating `highlightsService` to populate it. Current fix pass strips the redundant echo entirely; this deferred item captures the proper work.
- **P7-82** 🟡 CookDetailScreen Block 3 author location line. Post-row data doesn't carry geo; deferred until geo is wired up.
- **P7-83** 🟢 CommentsScreen extraction for inline rendering on CookDetailScreen. Current fallback (truncated preview + tap-through) ships in Pass 1.
- **P7-84** 🟡 Pending cook partner invitations visible to post author. Currently invisible — the post author has no way to see on their own post that a tag is pending the other user's approval. Needs a small affordance (muted row, badge, or similar) that shows pending invitations to the author only. Cross-cutting design question affecting feed card, CookDetailScreen Block 7, and MealEventDetailScreen's "What everyone brought" list.

---

## Hard stop requirements

After Fix 1 and Fix 2 land cleanly, TypeScript compiles, and the SESSION_LOG update is appended with the updated PAUSED marker, STOP. Do NOT:

- Start Sub-section 5.3
- Touch `AddCookingPartnersModal`
- Touch `postService`
- Wire any overflow menu items
- Create any new service files beyond what's already in `cookCardDataService.ts`
- Modify any file outside the two listed under "Files you are expected to touch"

Wait for Tom's explicit GO.

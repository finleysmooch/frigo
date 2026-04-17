# Phase 7I Checkpoint 5 — CookDetailScreen + Narrow-Scope Editing

**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 5 of 7

**Prior work:**
- **Checkpoints 1 through 4.5:** complete and verified. Feed rewrite landed, photo-rendering bugs fixed, telemetry captured.
- **This is the first Wave 2 checkpoint.** Wave 1 (Checkpoints 1-4 + 4.5) retired meal cards from the feed and delivered the new cook-post-centric feed card. Wave 2 (Checkpoints 5-7) delivers the detail screens that cook cards tap into, plus the cleanup pass at the end.

**This checkpoint ships in two passes with a hard pause in the middle.** Sub-sections 5.1, 5.2, 5.4, and 5.5 execute first. Sub-section 5.2.5 is a HARD PAUSE where CC writes a partial SESSION_LOG entry and stops, waiting for Tom to verify the screen + photo handling + navigation on device. When Tom gives GO, CC resumes with Sub-section 5.3 (the narrow-scope editing overflow menu with its interface-extension audit) and appends findings to the same SESSION_LOG entry. See "Execution flow" below for specifics.

**Required reading before starting:**

1. This prompt in full
2. `docs/PHASE_7I_MASTER_PLAN.md` — the Checkpoint 5 section in particular (CookDetailScreen + narrow editing scope + interface extension notes)
3. `docs/frigo_phase_7i_wireframes.html` — specifically the L6 wireframe and its companion text, which is the authoritative source for CookDetailScreen's structure (with the modifications noted in this prompt: cook-partners row added as block 7, notes block included per D4)
4. `docs/PHASE_7_SOCIAL_FEED.md` — skim the Decisions Log, read D4 (description vs notes distinction), D47 (cook-post-centric model), D48 (shared-recipe merge), D49 and D50 (new, see "Decisions captured in this prompt" below)
5. `screens/FeedScreen.tsx` — specifically the `navigateToCookDetail` callback which currently routes to `CommentsList` as a temporary target. Checkpoint 5 replaces that target. Also the `transformToCookCardData` helper which gets migrated to a new shared module in 5.1.
6. `components/feedCard/CookCard.tsx` — the existing CookCardInner structure is the reference for many of CookDetailScreen's content blocks (author block, recipe line, stats row, description)
7. `components/feedCard/sharedCardElements.tsx` — `PhotoCarousel` is extended in 5.2, and `NoPhotoPlaceholder` is a new primitive that lives here
8. `components/AddCookingPartnersModal.tsx` — extended in 5.3 with a new optional prop
9. `lib/services/postParticipantsService.ts` — the `addParticipants` / `removeParticipants` / `getPostParticipants` functions used by the Manage cook partners flow
10. `lib/services/postService.ts` — may need a minimal `updatePost(postId, patch)` helper if one doesn't exist; check first
11. `lib/services/recipeHistoryService.ts` — `getCookHistoryForUserRecipe` was built in Checkpoint 2 but has NOT been exercised with real data yet. Checkpoint 5 is its first real use.
12. `screens/RecipeDetailScreen.tsx` — the hero photo block is touched in 5.2 as an intentional cross-phase change
13. `docs/SESSION_LOG.md` — the Checkpoint 4 and 4.5 entries for context on the foundation this builds on

## Decisions captured in this prompt

Two new decisions are formalized as part of this checkpoint. CC writes them into `docs/PHASE_7_SOCIAL_FEED.md`'s Decisions Log as part of the SESSION_LOG closeout. Full decision text lives below in "Decisions to write into the Decisions Log."

**D49 — Same-author multi-dish collapse within meal events.** When a `linked_meal_event` feed group contains any sub-set of 2+ sub-units whose `posts[0].user_id` match, those matching sub-units collapse into a single unified card rendered under the meal event header. Sub-units that don't match any collapse-group render normally. Per-author, not all-or-nothing. **The D49 renderer is NOT built in Checkpoint 5** — Checkpoint 5 only commits to the nav contract `{ postId, photoIndex? }` that the future renderer will use to route dish-row taps to CookDetailScreen.

**D50 — No-image state rendering across photo surfaces.** Context-specific rule: feed cards collapse the photo slot entirely; detail screens render a lightweight `NoPhotoPlaceholder` (light grey background, centered `BookIcon`, muted "No photo yet" text). Retroactive application across CookDetailScreen (new), RecipeDetailScreen (grey rectangle replaced), and MealEventDetailScreen when it ships in Checkpoint 6. Composes with `PhotoCarousel`'s new `onError` handling: failed loads collapse per the same rule.

---

## Goal

Build `screens/CookDetailScreen.tsx` as the new L6 detail target that every cook card taps through to. Wire FeedScreen's existing `navigateToCookDetail` to route there instead of to `CommentsList`. Ship the six narrow-scope editing affordances from D47. Implement D50's no-image handling across the hero carousel and the `PhotoCarousel` primitive, and apply it retroactively to RecipeDetailScreen's hero. Migrate the `transformToCookCardData` helper from FeedScreen to a new shared module that CookDetailScreen (and Checkpoint 6's MealEventDetailScreen) will consume. Do not build the D49 renderer; do not build MealEventDetailScreen; do not touch any deferred 7M editing capability.

---

## Execution flow

This is a two-pass checkpoint. The execution order is fixed:

**Pass 1 — Sub-sections 5.1 → 5.2 → 5.4 → 5.5, then HARD PAUSE at 5.2.5.**

1. **5.1** — Migrate `transformToCookCardData` to `lib/services/cookCardDataService.ts`. Update FeedScreen's imports. Add `fetchSingleCookCardData(postId)` and `fetchCookCardDataBatch(postIds)` exports. Then build `screens/CookDetailScreen.tsx` with the 14 content blocks.
2. **5.2** — Extend `PhotoCarousel` with onError handling. Create `NoPhotoPlaceholder`. Swap RecipeDetailScreen's hero grey rectangle for `NoPhotoPlaceholder`. CookCardInner picks up the onError-collapse behavior automatically.
3. **5.4** — Update FeedScreen's `navigateToCookDetail` to route to the real `CookDetail` target. Register `CookDetail` in `FeedStackParamList`.
4. **5.5** — No code. Document the D49 nav contract commitment in the SESSION_LOG entry.
5. **5.2.5 — HARD PAUSE.** CC writes a partial SESSION_LOG entry with all Pass 1 findings, ends it with the literal line `PAUSED — awaiting GO for Sub-section 5.3 (narrow-scope editing overflow menu + AddCookingPartnersModal audit).`, then STOPS. Does not start 5.3. Does not touch `AddCookingPartnersModal`. Waits for Tom.

**Pass 2 — Sub-section 5.3, triggered by Tom's explicit GO.**

Tom verifies the screen, photo handling, and navigation on device. When he gives the GO (likely in the form of "GO for 5.3" in the CC terminal), CC resumes. No separate resume prompt is issued — this prompt file is the single source of truth for both passes, and CC picks up at the Sub-section 5.3 section below.

6. **5.3** — Extend `AddCookingPartnersModal` with `existingParticipantIds`. Audit all call sites. Add minimal `postService.updatePost` if needed. Wire the six overflow menu items into CookDetailScreen. Per the audit outcome: if the preferred (backward-compatible) approach holds, proceed. If any call site conflicts, **STOP a second time** and tell Tom before falling back to a separate `ManageCookPartnersModal` component.
7. **5.6** — Append Sub-section 5.3 findings to the existing SESSION_LOG entry. Replace `PAUSED — awaiting GO for Sub-section 5.3` with the full closeout: final findings, decisions written to the phase doc, deferred items added, GO/NO-GO recommendation for Checkpoint 6. Then HARD STOP. No Checkpoint 6 work.

---

## Sub-section 5.1 — `CookDetailScreen.tsx` + data-loading migration

### 5.1.0 — Migrate `transformToCookCardData` to a shared module (prerequisite)

Before building CookDetailScreen, move the `transformToCookCardData` helper out of `screens/FeedScreen.tsx` and into a new file `lib/services/cookCardDataService.ts`. This is a prerequisite step because both FeedScreen and CookDetailScreen will consume the same helper — building CookDetailScreen first and then deduplicating later would mean writing the transform twice.

**Steps:**

1. Create `lib/services/cookCardDataService.ts`. Export `transformToCookCardData` (the existing function, moved verbatim — do not refactor, do not rename, just move). Add two new exports:

   ```typescript
   export async function fetchSingleCookCardData(
     postId: string
   ): Promise<CookCardData | null> {
     // Fetch the post row, author profile, and recipe (if any).
     // Return null if the post doesn't exist or fails visibility filters.
     // Use the same SELECT columns that FeedScreen.loadDishPosts uses so
     // the downstream transform gets the same input shape.
   }

   export async function fetchCookCardDataBatch(
     postIds: string[]
   ): Promise<CookCardData[]> {
     // Fetch N posts, hydrate profiles and recipes in one pass each,
     // transform as a batch. Used by surfaces that need to hydrate
     // specific posts (not the whole feed). Checkpoint 6's
     // MealEventDetailScreen will use this to hydrate its dish list.
   }
   ```

   `fetchSingleCookCardData` powers CookDetailScreen's initial load. `fetchCookCardDataBatch` is for future callers — add it now so the module API is consistent.

2. Update `screens/FeedScreen.tsx` to import `transformToCookCardData` from `lib/services/cookCardDataService`. Delete the inlined helper definition from FeedScreen. Verify TypeScript still compiles and the feed still loads cleanly.

3. Verify FeedScreen's behavior is unchanged after the migration. Cold-launch the feed; confirm the telemetry (`[FEED_CAP_TELEMETRY]` + phase timings) matches the Checkpoint 4.5 baseline (~3.3s steady-state).

Document the migration outcome in the partial SESSION_LOG entry written at the HARD PAUSE.

### 5.1.1 — Route registration

Add `CookDetail` to `FeedStackParamList` in `App.tsx` (or wherever the type is defined). Nav param shape is authoritative and public:

```typescript
CookDetail: { postId: string; photoIndex?: number };
```

`postId` is required. `photoIndex` is optional — when present, the hero carousel centers on that index at mount; when absent, starts at index 0. **This shape must be stable** because future callers (the D49 renderer's dish-row taps, the D49 renderer's card-background tap, CommentsList return navigation) all target it. Do not change the shape during implementation without raising it with Tom first.

Register the new screen in the stack navigator alongside the existing screens.

### 5.1.2 — Screen structure (14 content blocks, top to bottom)

**The content ordering is committed. Do not reorder.** This differs slightly from the wireframe companion in `frigo_phase_7i_wireframes.html`: (a) the "Cooked with" row at position 7 is new — the wireframe is incomplete on this point; (b) the notes block at position 9 is included per the master plan's D4 distinction even though the wireframe shows only modifications.

**Block 1 — Back nav header.** Back button (left), title "Cook" or similar, Share action (right). The three-dot overflow menu for author editing goes in the header's right side, to the left of the Share button. **Visible only when `post.user_id === currentUserId`.** Non-author viewers see no menu button. The menu items themselves are built in Sub-section 5.3 — for Pass 1, the menu button exists with a stub `onPress` that logs `console.log('[CookDetailScreen] Menu pressed — Pass 2 will wire this up')`. The button's conditional visibility ships in Pass 1.

**Share button implementation:** NOT a `console.log`. Use:
```typescript
Alert.alert('Share coming soon', 'Sharing will be available in a later update.')
```
Real share sheet integration is Phase 7J. The Alert is cleaner than a console log for on-device dogfooding.

**Block 2 — Hero photo carousel.** Reuses the existing `PhotoCarousel` primitive from `sharedCardElements.tsx`. Full screen width, same `CAROUSEL_HEIGHT = SCREEN_WIDTH * 0.75` as the feed card. If `route.params.photoIndex` is provided, the carousel starts at that index (scroll-to-initial-offset on mount). If the post has no photos and no valid recipe image, render `NoPhotoPlaceholder` (see 5.2) in the same dimensions as the carousel would occupy.

**Block 3 — Author block.** Avatar, display name (large, bold), full timestamp with time-of-day (e.g., "Apr 12, 2026 · 7:30 PM"), device location if present. Tappable to `navigation.navigate('AuthorView', { chefName })`. Per D47, no "You" branching: own posts still show the display name.

**Block 4 — Post title.** Full title, large (22px per wireframe companion), not clipped. Uses `post.title` with the same cascade as CookCardInner (`post.title || recipe?.title || post.dish_name || 'Untitled Post'`). No truncation.

**Block 5 — Description.** Renders `post.description` full-text, no line-clamp. If the description is empty or null, the block is absent (no empty label, no reserved space). Per D4: this is the cook-time *description*, distinct from cook-time *notes* which renders in block 10.

**Block 6 — Recipe line.** Uses the existing `RecipeLine` primitive from `sharedCardElements.tsx`. Renders "📖 Recipe Title · Chef Name" with the tappable recipe link. Add cookbook page number support: if `recipe.page_number` is populated (verify column name in the recipes table — might be `page_number`, `page`, or inside a jsonb field), render it as "· p. 98" appended to the line. Tappable → `navigation.navigate('RecipeDetail', { recipe: { id: recipeId } })`. **Do not make the page number itself a tap target for cookbook deep linking** — that's P7-53, deferred.

**Block 7 — Cooked with row.** **New — not in the wireframe companion.** Renders a horizontal row of avatar chips with display names for every approved `sous_chef` participant. Format: "Cooked with [avatar chip] Tom [avatar chip] Andrew". Each chip is tappable → that person's profile via `navigation.navigate('AuthorView', { chefName })`. Data source: `getPostParticipants(postId)` filtered to `role='sous_chef' AND status='approved'`.

**Render only when the resulting list is non-empty.** If no approved sous_chef participants exist, the entire row is absent (no empty label, no reserved space). Applies D50's collapse-on-empty principle.

**Do NOT render `ate_with` participants** in this block or anywhere else on L6. The ate-with surface is blocked on P7-66 (eater_ratings schema) and is deferred to Checkpoint 6 or later. If you find yourself tempted to add an "Ate with" row, stop — that's scope creep.

**Block 8 — Stats grid.** Bigger, differently-styled version of the feed card's `StatsRow`. Three stats by default — **Cook time**, **Your rating**, **Times cooked**. Cream background to visually set the block apart. Unlike the feed card, do NOT sum cook time and prep time — show them separately if both exist: "Cook time 30min · Prep 15min". If only cook time exists, show just cook time. If neither exists, omit the cook time cell. Rating uses the existing star format. Times cooked uses the existing "Nx" format. Aim for ~1.3x the feed card's font sizes. Inline in CookDetailScreen for now — don't extract to shared elements unless Checkpoint 6 needs it.

**Block 9 — Highlights.** Reuses `HighlightsPill` from `sharedCardElements.tsx` but with expanded presentation — the pill is followed by a short descriptive paragraph below it (e.g., "You're on a carbonara streak — this is your third time this month").

**Data source — with fallback.** The highlight object should be fetchable via the same `computeHighlightsForFeedBatch` service used by FeedScreen. Call the batch version with a one-element input (`computeHighlightsForFeedBatch([singlePost], [], currentUserId)`) and extract the one result.

**FALLBACK:** If calling the batch version with a one-element input is expensive, produces wrong results, or requires viewer context that doesn't cleanly work for a single post — **skip the Highlights block entirely on CookDetailScreen for this checkpoint.** Ship CookDetailScreen without Block 9 and capture the full integration as a new deferred item (next available P-number). Do not delay the checkpoint to make Highlights work. The fallback path is: Block 9 is absent, and a deferred item captures "add Highlights to CookDetailScreen once a clean single-post variant exists." **Document the decision in the partial SESSION_LOG entry.**

If the block renders successfully, the descriptive text comes from the same `Highlight` object that powers the pill; if no highlight fires for this post, the entire block is absent.

**Block 10 — Modifications & notes.** Two separate blocks when both `post.modifications` and `post.notes` exist, one block when only one exists, both blocks absent when neither exists. Use cream-toned backgrounds to visually cluster them (similar to block 8). Headers: "What I changed" for `modifications`, "Cook notes" for `notes`. Per D4: `modifications` is the recipe delta; `notes` is cook-time thoughts (general observations, future reminders, "next time try..." content). The two blocks serve different narrative purposes — don't merge them.

**Block 11 — Your history with this recipe.** Renders a preview-with-see-all pattern. Data source: `getCookHistoryForUserRecipe(userId, recipeId)` from `lib/services/recipeHistoryService.ts`.

**CRITICAL — First real-data exercise of `getCookHistoryForUserRecipe`.** This service was built in Checkpoint 2 but has never been hit with real data — only dry-run verified against synthetic posts. Checkpoint 5 is the first real usage, analogous to Checkpoint 4's cook-partner linkage being the first real exercise of `getLinkedCookPartnersForPosts`.

**CC must explicitly report in the partial SESSION_LOG entry whether the service works against real data or needs a fix.** Test against a recipe you've cooked multiple times (e.g., any recipe with `times_cooked >= 2` in the recipes table). If the service returns wrong results, returns empty when it shouldn't, or throws, document the failure mode and propose a fix — but do NOT attempt the fix during Pass 1. Flag it in the partial SESSION_LOG and let Tom decide whether to fold the fix into Pass 2 or defer it.

**Rendering:** Preview the 2-3 most recent previous cooks as compressed rows showing date + rating + any key stat. The current cook is highlighted (accent background or left border) but still rendered. Below the preview rows, a "See all N cooks" tap row if N > 3; tapping opens a **sheet** (not a screen). The sheet renders the full list at the same compressed format. If the viewer has only cooked this recipe once (the current cook), skip the entire block. If the post is a freeform post with no `recipe_id`, skip the entire block.

**Block 12 — Photos gallery.** A 3-column grid rendering photos from `post.photos`. Each thumbnail is tappable and opens the **hero carousel at that photo's index** via a scroll-to-index mechanism.

**Implementation (committed, do not deviate):** When a thumbnail is tapped, set a state variable on CookDetailScreen (e.g., `heroTargetIndex: number | null`). Pass it to the hero carousel as a prop. The hero carousel scrolls to that index when the prop changes. **Simultaneously, scroll the outer ScrollView back to the top** (scroll offset 0) so the hero carousel is visible in the viewport. After the scroll completes, reset `heroTargetIndex` to null so subsequent taps re-trigger.

Do NOT build a separate full-screen photo viewer. The hero carousel IS the photo viewer. Thumbnails are a quick-jump affordance.

If the post has ≤3 photos, render all of them without an overflow action. If the post has >3 photos, the grid shows the first 3-6 as thumbnails with a "View all N photos" tap row below that sets the hero target to index 0 and scrolls up. Render only when `post.photos` has at least one element.

**Block 13 — Comments.** Inline comment thread rendered directly on CookDetailScreen, OR — if extracting CommentsList's body as a reusable component is not cheap — a **truncated preview with "View all comments" tap-through to the existing `CommentsList` screen.**

**How to decide:** Audit the existing comments UI (grep for `CommentsList` or `CommentsScreen` to find it). If its comment-list rendering can be extracted into a reusable component without rewriting significant portions of the file, do the extraction and inline-render it in CookDetailScreen. If extraction requires touching significant other code (e.g., comments rendering tightly coupled to screen state, nav handlers, or other concerns), use the fallback: render a truncated preview (most recent 2-3 comments + comment count) with a "View N comments" tap target that routes to the existing CommentsList screen.

**Document the decision and rationale in the partial SESSION_LOG entry.** Which approach did you take, and why.

Either way, include an "Add comment" action at the top or bottom of the block. Loading states matter — comments shouldn't block the initial render of the rest of the screen; render a placeholder or spinner while comments fetch resolves. If there are zero comments, render a subtle "No comments yet · be the first" prompt with the add-comment affordance.

**Block 14 — Sticky engagement bar.** Pinned to the bottom of the screen (not inside the scrollable content). Shows: yas chef count (left), comment count (center or right), like button and comment button as action tap targets. Same visual pattern as Strava's activity detail bottom bar. Stays visible while the main content scrolls. Use `position: 'absolute'` with `bottom: 0` inside a SafeAreaView-compatible container. The bar's height must be subtracted from the scrollable content's bottom padding so the last block isn't hidden behind it.

### 5.1.3 — Data loading

CookDetailScreen fetches everything it needs on mount via a `loadPostDetail(postId)` helper. The helper composes these service calls:

- **Single post + author + recipe:** `fetchSingleCookCardData(postId)` from the new `lib/services/cookCardDataService.ts` module (see 5.1.0)
- **Post participants:** `getPostParticipants(postId)` filtered to `role='sous_chef' AND status='approved'`
- **Highlight:** `computeHighlightsForFeedBatch([singlePost], [], currentUserId)` (or skip per the Block 9 fallback)
- **Cook history:** `getCookHistoryForUserRecipe(userId, recipeId)` if the post has a recipe_id
- **Comments:** whatever service currently powers CommentsList (grep to find it)
- **Likes:** same pattern FeedScreen uses

All fetches run in parallel via `Promise.all` where possible. Show a loading state (spinner or skeleton) until the post-row fetch resolves; the comments and history blocks can hydrate asynchronously with their own placeholders.

---

## Sub-section 5.2 — `NoPhotoPlaceholder` primitive + `PhotoCarousel` onError handling

**New component: `NoPhotoPlaceholder`** in `components/feedCard/sharedCardElements.tsx`.

Signature:
```typescript
export function NoPhotoPlaceholder({
  width,
  height,
  colors,
}: {
  width?: number;
  height?: number;
  colors: any;
}): JSX.Element
```

Default dimensions: `width = SCREEN_WIDTH`, `height = SCREEN_WIDTH * 0.75` (matches `PhotoCarousel`'s default). Accepts overrides for screens that need custom hero sizes.

**Visual specification:**
- Background: `colors.background.secondary` or a light grey (`#f4f4f2` or similar — match existing muted backgrounds)
- Content: centered vertically and horizontally. A `BookIcon` from `components/icons/recipe/BookIcon.tsx` at size ~48, tinted `colors.text.tertiary`. Below the icon, "No photo yet" text in `colors.text.tertiary`, font size 12, slight letter-spacing. Gap between icon and text ~8px.
- No border, no shadow, no tap target.

The component is stateless, renders synchronously, imports nothing new beyond `BookIcon` and the theme colors already available to `sharedCardElements.tsx`.

**`PhotoCarousel` extension — onError handling:**

Add per-slide load-failure tracking via a new `failedIndices: Set<number>` state. On each `<Image>`'s `onError` callback, add the slide's index to the set. Filter at the render layer rather than via a filtered array, to keep indices stable:

```typescript
const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set());

const markFailed = (index: number) => {
  setFailedIndices(prev => {
    if (prev.has(index)) return prev;
    const next = new Set(prev);
    next.add(index);
    return next;
  });
};

// Early-return null if all slides have failed:
const visibleCount = photos.length - failedIndices.size;
if (visibleCount === 0) return null;

// When iterating for render, skip indices in the set:
{photos.map((photo, originalIndex) => {
  if (failedIndices.has(originalIndex)) return null;
  return renderSlide(photo, originalIndex);  // onError inside uses originalIndex
})}
```

**The index passed to `markFailed` must be the original index in the `photos` array, not a filtered index.** Otherwise failure tracking goes out of sync on re-renders. Filter at the render layer; keep `photos` untouched as the source of truth.

**CookCardInner extension:** No change needed. CookCardInner passes `carouselPhotos` to `PhotoCarousel`, and the new onError-collapse behavior flows through automatically. If `recipe_image_url` is populated-but-broken, PhotoCarousel's onError fires, the slide is filtered, `visibleCount === 0`, PhotoCarousel returns null, CookCardInner's layout collapses per the existing empty-carousel handling.

**RecipeDetailScreen retroactive application — INTENTIONAL CROSS-PHASE CHANGE.** RecipeDetailScreen currently renders a large grey rectangle when `recipe.image_url` is null or the image fails to load. Replace that grey rectangle with a `NoPhotoPlaceholder` call using the same dimensions the hero image would have occupied.

**This is a deliberate cross-phase touch outside Phase 7I's normal surface.** Explicitly scoped here because (a) D50 is the canonical no-image rule and it applies everywhere, (b) the fix is a one-block swap, (c) leaving RecipeDetailScreen with the grey rectangle while CookDetailScreen ships with the new placeholder creates exactly the kind of visual inconsistency D50 is meant to eliminate. Do not interpret this as permission to touch any other RecipeDetailScreen code path — the swap is strictly limited to the hero photo block. If the grey rectangle is produced by a wrapper component rather than inline JSX, touch only the wrapper's image-rendering branch.

---

## Sub-section 5.4 — Navigation wiring

Replace FeedScreen's temporary `navigateToCookDetail` with a real navigation call:

```typescript
const navigateToCookDetail = useCallback(
  (postId: string, photoIndex?: number) => {
    navigation.navigate('CookDetail', { postId, photoIndex });
  },
  [navigation]
);
```

CookCard's existing `onPress` passes no second argument, `photoIndex` is `undefined`, and CookDetailScreen starts at index 0 per the default. Future wiring (tapping a specific photo in the hero carousel to jump to that photo in the detail screen) is NOT Checkpoint 5's scope.

**FeedScreen.tsx edits in this sub-section:**
- Update `navigateToCookDetail` to the new implementation above
- Remove the "Temporary: CommentsList is a real destination for every post" comment
- Verify no other code paths in FeedScreen reference the old CommentsList routing for cook cards (grep for `CommentsList` — the only legitimate remaining uses are for `navigateToComments` which handles tap-on-comment-icon specifically)

---

## Sub-section 5.5 — D49 nav contract (documentation only)

No code changes. Pure documentation commitment.

CookDetailScreen's nav param shape `{ postId: string; photoIndex?: number }` is stable and public. The future D49 renderer (not built in Checkpoint 5, expected to land in a Checkpoint 4.6 or Checkpoint 6 bundled with MealEventDetailScreen) will use this shape to route dish-row taps from a collapsed multi-dish card to the detail view for the specific dish that was tapped. The D49 renderer's card-background / meal-event-header tap will route to `MealEventDetailScreen` (Checkpoint 6) with its own nav params.

**The commitment is: do not change CookDetailScreen's nav param shape in response to implementation pressure during Checkpoint 5.** If during implementation you discover that a different shape would be more convenient, pause and raise it with Tom rather than unilaterally changing it — every future D49 / D50 / navigation caller depends on this shape being stable.

Record the commitment in the SESSION_LOG entry's 5.5 section as a one-paragraph note.

---

## Sub-section 5.2.5 — HARD PAUSE

After Sub-sections 5.1, 5.2, 5.4, and 5.5 have been executed and TypeScript compiles cleanly, STOP.

Write a partial SESSION_LOG entry at `docs/SESSION_LOG.md` titled `2026-04-14 — Phase 7I Checkpoint 5 — CookDetailScreen + Narrow Editing`. The partial entry must include:

- **Phase / Prompt header** — standard format matching prior entries
- **Files modified so far** — listed with roles (new / modified / cross-phase-touch)
- **Sub-section 5.1 findings:**
  - Data-loading helper migration outcome. Did `transformToCookCardData` move cleanly to `cookCardDataService.ts`? Does FeedScreen still behave correctly (cold-launch telemetry matches Checkpoint 4.5 baseline)?
  - 14-block content structure: which blocks rendered cleanly, which needed layout iteration, whether the sticky engagement bar's position math worked on first try
  - **First-real-data verification of `getCookHistoryForUserRecipe`** — does the service return correct results against real data, or does it need a fix? If broken, describe the failure mode and propose a fix but DO NOT attempt it. Tom decides whether to fold into Pass 2 or defer.
  - Highlights block decision: shipped with the batch-single-post call, or shipped without via fallback? Rationale.
  - Block 13 comments decision: inline reusable component extraction, or truncated preview with tap-through fallback? Rationale.
  - Any surprises in the transform migration, route registration, or data loading
- **Sub-section 5.2 findings:**
  - `NoPhotoPlaceholder` implementation details
  - `PhotoCarousel` onError wiring — any index-stability issues, any re-render surprises
  - RecipeDetailScreen swap confirmation — one-block change, no other RecipeDetailScreen code touched
- **Sub-section 5.4 findings:**
  - Navigation wiring confirmation
  - Any regressions caught when replacing the CommentsList temporary target
  - Grep verification that no stray CommentsList references remain for cook-card taps
- **Sub-section 5.5 — commitment note** (D49 nav contract stable and public)
- **Visual verification PENDING on Tom's device** — the Pass 1 portion of the checklist:
  1. Tap a cook card on the feed → lands on CookDetailScreen, correct post loads
  2. Scroll through all 14 content blocks, verify each renders per spec
  3. Verify "Cooked with" row (block 7) appears when post has `sous_chef` participants, absent otherwise
  4. Verify `NoPhotoPlaceholder` renders on a post with no photos and no valid recipe image
  5. Verify a recipe-backed post with a broken recipe_image_url (e.g., Purple Sprouting Broccoli — recipe `fc134850-0926-4084-b983-df3a7121e665`) now collapses the feed card photo slot cleanly instead of showing a blank "Recipe photo" badge region
  6. Verify RecipeDetailScreen now renders `NoPhotoPlaceholder` instead of the grey rectangle on recipes with no image
  7. Verify photos gallery thumbnails tap-to-hero-index works correctly (thumbnail tap scrolls to that photo in hero carousel AND scrolls outer ScrollView to top)
  8. Verify sticky engagement bar stays pinned during scroll and doesn't obscure the last block
  9. Verify Block 11 "Your history" preview renders for a recipe cooked multiple times, absent for a freeform post
  10. Verify Block 11 handles the "first cook" case (no preview, no see-all)
  11. Verify the overflow menu button appears in the header only on own posts (test by viewing someone else's)
  12. Verify tapping the Share button shows the "Share coming soon" Alert
  13. Verify tapping the overflow menu button logs the Pass 2 placeholder message
  14. Test harness still works (flask button still in FeedScreen header, all 7 states still render)
- **Deferred items surfaced so far** — if any
- **End with the literal line:**

  ```
  PAUSED — awaiting GO for Sub-section 5.3 (narrow-scope editing overflow menu + AddCookingPartnersModal audit).
  ```

Then STOP. Do not start 5.3. Do not touch `AddCookingPartnersModal`, `postService`, or any overflow menu wiring. Wait for Tom's explicit GO.

---

## Sub-section 5.3 — Narrow-scope editing overflow menu (author-only) — PASS 2

**Execute this sub-section ONLY after Tom has given explicit GO.** The trigger is Tom saying something like "GO for 5.3" in the terminal. Do not auto-resume.

**Overflow menu placement:** Three-dot button in CookDetailScreen's header, to the left of the Share button, rendered only when `post.user_id === currentUserId`. The conditional visibility shipped in Pass 1; Pass 2 wires the menu items behind it.

**Six menu items**, in this display order:

1. **Add photos** — routes to the existing `screens/EditMediaScreen.tsx` with the current postId. `navigation.navigate('EditMedia', { postId })`. Zero new code for the destination screen — pure wire-up. After returning from EditMedia, CookDetailScreen must refetch the post data to pick up newly-added photos — wire up a `useFocusEffect` to re-trigger `loadPostDetail` on screen focus.

2. **Edit title** — opens an inline text input that replaces the title Text component. Save on blur OR on return key. Writes to `posts.title` via `postService.updatePost(postId, { title: newTitle })`. **Verify `updatePost` exists** in `postService.ts` — if it doesn't, add a minimal variant:
   ```typescript
   export async function updatePost(
     postId: string,
     patch: Partial<Pick<Post, 'title' | 'description' | 'parent_meal_id'>>
   ): Promise<void> {
     const { error } = await supabase.from('posts').update(patch).eq('id', postId);
     if (error) throw error;
   }
   ```
   The patch type must accommodate `title`, `description`, and `parent_meal_id` because items 2, 3, and 5 all use it. After save, the screen re-fetches or optimistically updates the title in local state. Cancel behavior: tapping outside the input OR hitting back/escape reverts. Empty-string save is rejected with a quiet visual cue ("Title can't be empty") — not a modal.

3. **Edit description** — same pattern as Edit title but multi-line text input, saving to `posts.description`. Empty-string save is allowed.

4. **Manage cook partners** — opens the extended `AddCookingPartnersModal` (see "Interface extension" below) with the post's current cook partners pre-selected. On confirm, compute the diff against the current set and call:
   ```typescript
   for (const addId of toAdd) await addParticipants(postId, [addId], 'sous_chef', ...);
   for (const removeId of toRemove) await removeParticipants(postId, [removeId], 'sous_chef', ...);
   ```
   Verify the exact signatures of `addParticipants` and `removeParticipants` in `postParticipantsService.ts`. After the diff settles, refetch the post participants to refresh the "Cooked with" row (block 7). Verify whether `addParticipants` sets `status='approved'` automatically — for manual additions by the author, new participants should be `status='approved'` immediately (the author implicitly approves by adding them). If the approval flow doesn't support this, either bypass it for author-added participants or flag the gap in SESSION_LOG.

5. **Change meal event** — opens a picker that reuses `SelectMealModal` or `SelectMealForRecipeModal` (audit both, pick the simpler one). The picker **must include a "Not attached to a meal event" option at the very top** of the list, which clears the current `parent_meal_id` when selected. On confirm, calls `postService.updatePost(postId, { parent_meal_id: newMealId })`. When `parent_meal_id` is cleared, the post transitions from L4 (prehead above card) to L1 (solo cook) on the next feed load — no explicit feed refresh needed from CookDetailScreen.

6. **Delete post** — confirmation Alert dialog (`"Delete this post? This can't be undone."`) with Cancel and Delete buttons. On confirm, calls `postService.deletePost(postId)` which handles cascade cleanup of `post_likes`, `post_comments`, `post_participants`, `dish_courses`. Verify the existing `deletePost` handles all cascades (or DB FK rules do). After delete, `navigation.goBack()` to return to the feed.

### Interface extension: `AddCookingPartnersModal`

Current signature: `onConfirm(selectedUsers: string[], role: ParticipantRole)` — only handles adding new partners. Extend with a new optional prop:

```typescript
interface AddCookingPartnersModalProps {
  // ... existing props ...
  existingParticipantIds?: string[];
}
```

When `existingParticipantIds` is provided, the modal pre-selects those users in its list UI. Users can deselect existing participants to remove them. On confirm, `onConfirm` returns the **complete new set** of selected user IDs (not a diff). CookDetailScreen computes add/remove operations by diffing against the original `existingParticipantIds`.

### NEEDS REVIEW — Cross-call-site audit

**The existing modal is used in several places.** Audit every call site and either:

- **Preferred (backward compatible):** update all call sites to pass the new optional prop. Existing call sites that don't pass it get the current behavior unchanged. Modal's internal logic checks `if (existingParticipantIds !== undefined)` to decide whether to pre-select.

- **Fallback (if the preferred approach conflicts):** create a separate `ManageCookPartnersModal` component, leave `AddCookingPartnersModal` alone.

**Known call sites to audit** (from P7-60):
- `components/QuickAddModal.tsx`
- `components/LogCookSheet.tsx`
- `components/AddMealParticipantsModal.tsx` (likely unaffected — different modal, different purpose, but verify)
- Any `screens/` file that imports `AddCookingPartnersModal`

**Grep:** `grep -rn "AddCookingPartnersModal" screens/ components/`. Audit each hit.

### IF THE AUDIT SURFACES A CONFLICT — SECOND HARD PAUSE

If any call site has a semantic conflict that breaks with the preferred approach — e.g., a modal treats "add partners" and "manage partners" as meaningfully distinct flows with different UX copy, validation, or state behavior — **STOP.** Do not unilaterally create `ManageCookPartnersModal`.

Write a note in the in-progress SESSION_LOG entry describing:
- Which call site has the conflict
- What specifically conflicts
- Why the preferred approach can't be made to work cleanly
- Estimated effort for the fallback (new component ~30-60 min extra work)

Then pause and wait for Tom's explicit approval. Tom may say:
- **"GO for fallback"** — proceed with `ManageCookPartnersModal`
- **"Defer Manage cook partners"** — skip item 4, document the gap, continue with the other 5 menu items. Add a deferred item capturing "CookDetailScreen Manage cook partners — deferred due to modal audit conflict, fallback to separate component or modal refactor required."

Tom's call. Do not guess.

If the audit does NOT surface a conflict, proceed with the preferred approach and document the audit results in the final SESSION_LOG section.

---

## Sub-section 5.6 — SESSION_LOG finalization (Pass 2 closeout)

After Sub-section 5.3 completes (with whichever audit outcome), append to the same SESSION_LOG entry. Replace `PAUSED — awaiting GO for Sub-section 5.3 (...)` with:

- **Sub-section 5.3 findings:**
  - **Critical: the `AddCookingPartnersModal` audit results.** Which call sites were updated, whether the preferred approach held, whether a fallback was needed. If the fallback was needed, whether Tom was consulted before proceeding.
  - Whether `postService.updatePost` already existed or needed to be added. Its final signature.
  - Inline edit flows for title and description — any issues, any UX decisions made on the fly
  - Manage cook partners diff logic — any edge cases
  - Change meal event picker — which modal was reused and why
  - Delete post — cascade verification, whether `postService.deletePost` handles everything or FK rules do
- **Visual verification — PASS 2 portion, PENDING on Tom's device.** Add to the Pass 1 checklist:
  15. Tap the overflow menu on an own-post, verify all 6 items are present
  16. Test Add photos → EditMedia → back → refetch confirms new photos appear in hero carousel and Block 12 gallery
  17. Test Edit title inline flow — save on blur, save on return, cancel via outside-tap, empty-string rejection
  18. Test Edit description inline flow — save, cancel, empty-string allowed
  19. Test Manage cook partners — add one, remove one, verify diff applied, verify Block 7 "Cooked with" row refreshes after modal closes
  20. Test Change meal event — including "Not attached to a meal event" option
  21. Test Delete post — confirmation dialog, cascade cleanup, return to feed, deleted post absent from feed
  22. Verify overflow menu does NOT render on non-author posts
- **Decisions to record in `docs/PHASE_7_SOCIAL_FEED.md`'s Decisions Log:**
  - **D49** — full text below
  - **D50** — full text below
  - **D47 numbering-gap note** at the top of the Decisions Log section
- **Deferred items to add** to `docs/PHASE_7_SOCIAL_FEED.md`'s Deferred Items section. Grep for the highest allocated P-number and start one above. As of Checkpoint 5 start, P7-72 through P7-79 are already allocated from the Checkpoint 4/4.5 arc — start at P7-80 or higher.
  - Plausible new items: "CookDetailScreen Highlights block fallback" if Block 9 shipped without Highlights; "ate_with block on L6 pending P7-66" as an explicit reminder; any findings from the `getCookHistoryForUserRecipe` first-real-data verification; any surprises from the `AddCookingPartnersModal` audit; any scope drift flagged
- **GO / NO-GO recommendation for Checkpoint 6:** based on execution, should Checkpoint 6 (MealEventDetailScreen + host editing) proceed?

### Decisions to write into the Decisions Log

Write these into `docs/PHASE_7_SOCIAL_FEED.md`'s Decisions Log as new rows. Add the D47 numbering-gap note at the top of the section first.

**D47 numbering-gap note (add at top of Decisions Log section):**

> Note on numbering: D47 lives only in the Claude.ai project knowledge copy of this phase doc. The repo copy's Decisions Log jumps from D46 directly to D48 because D47 was never backfilled during the 2026-04-13 scope expansion. D49 and D50 (added 2026-04-14 during Checkpoint 5) follow this numbering. A future doc-maintenance pass will reconcile the drift by backfilling D47 from the project knowledge copy. For now, readers should treat D47 as existing conceptually even though its row is missing from this table.

**D49 — Same-author multi-dish collapse within meal events:**

> When a `linked_meal_event` feed group contains any sub-set of 2+ sub-units whose `posts[0].user_id` match, those matching sub-units collapse into a single unified card — "D49 card" — rendered under the meal event header. Sub-units that don't match any collapse-group render normally as solo or shared-recipe sub-units under the same header. The collapse is **per-author, not all-or-nothing**: a Mary+Mary+Andrew meal event produces one D49(Mary) card plus one solo(Andrew) sub-unit, and a Mary+Mary+Andrew+Andrew meal event produces D49(Mary) plus D49(Andrew) both stacked under the same meal event header.
>
> This is distinct from D48's same-recipe merge (which handles 2+ cooks cooking the same recipe). D49 handles 1 cook cooking 2+ recipes at the same meal event.
>
> **Card structure:** meal event header at top; single author header row (rendered once, not per dish); shared photo carousel aggregating hero images from all of this author's dishes in the meal event, with each slide tagged with its dish name; "Dishes cooked" list with one row per dish (tappable → CookDetailScreen for that dish); aggregate stats row (rating averaged, cook time summed, times-cooked omitted); single engagement row attached to the meal event itself (not any individual dish).
>
> **Tap target contract:** card background / meal event header / author header → MealEventDetailScreen (L7, Checkpoint 6); specific dish row in "Dishes cooked" list → CookDetailScreen (L6) for that specific dish; like button → meal-event-level like; comment icon → meal-event-level comment thread.
>
> **Engagement semantics:** D49 introduces new meal-event-level engagement (one like, one comment thread attached to the meal event as a whole). Schema decision deferred to D49's implementation checkpoint — either a new `meal_event_likes` table or a `target_type` column extension on `post_likes`. Decision is joint with Checkpoint 6's MealEventDetailScreen engagement needs.
>
> **Scope limitation:** D49 fires only when the shared context is an explicit `parent_meal_id`. The app does not collapse posts based on "same author + close in time + no meal event." This preserves D47's principle of explicit linkage over inference. Without a meal event tying posts together, author+time similarity is an inference, and the right nudge is "create a meal event if these are related."
>
> **Implementation timing:** The D49 renderer (`SameAuthorCollapsedMealEventGroup` or similar) is NOT built in Checkpoint 5. Checkpoint 5 captures D49 only as a nav contract commitment — its `CookDetailScreen` nav param shape `{ postId, photoIndex? }` is stable and public. The D49 renderer lands in a future checkpoint (loose preference: Checkpoint 6 bundled with MealEventDetailScreen because both share meal-event engagement schema concerns) but not committed until Wave 2 budget is clearer.

**D50 — No-image state rendering across photo surfaces:**

> When a photo surface has no image to display — because `post.photos` is empty AND `recipe_image_url` is null/empty, OR because an `<Image>` component's URL returns 404 or fails to load — the rendering rule is context-specific:
>
> **On feed cards** (CookCard, SharedRecipeLinkedGroup, LinkedCookStack, NestedMealEventGroup, and the future D49 renderer): collapse the photo slot entirely. No carousel, no placeholder, no reserved space. The card compacts and adjusts its layout. This matches the existing Checkpoint 4.5.1 behavior for freeform photoless posts, extended to all no-image cases.
>
> **On detail screens** (CookDetailScreen, MealEventDetailScreen, RecipeDetailScreen, and any future detail screen that renders a hero photo): render a lightweight `NoPhotoPlaceholder`. Specification: light grey background at the same dimensions the hero carousel would occupy, centered `BookIcon` at size ~48, muted "No photo yet" text below the icon. Rationale: detail screens rely on the hero photo for visual anchoring after navigation; collapsing the hero leaves the screen disorientingly top-heavy.
>
> **New shared component:** `NoPhotoPlaceholder` in `components/feedCard/sharedCardElements.tsx`. Used by all detail screens. Takes optional `width` / `height` props; defaults match CookDetailScreen's hero carousel proportions.
>
> **Image load-failure handling:** React Native's `<Image>` does not collapse its layout on 404 or network failure. `PhotoCarousel` is extended to track per-slide `failedIndices` via `onError`, filter failed slides at the render layer (keeping indices stable), and return null when all slides have failed. The empty-carousel state then composes with this rule.
>
> **Retroactive application:** D50 applies everywhere immediately. Checkpoint 5 rewrites the relevant code paths: `CookCardInner` inherits the onError-collapse behavior automatically through `PhotoCarousel`; `PhotoCarousel` gets the `onError` handling; `NoPhotoPlaceholder` is built from scratch; `CookDetailScreen` uses it from day one; `RecipeDetailScreen` has its hero grey rectangle replaced with it; `MealEventDetailScreen` will follow the same pattern when built in Checkpoint 6.

---

## What this checkpoint does NOT include

Explicitly out of scope. Do NOT touch any of these even if you notice something worth fixing:

- **D49 renderer.** The collapsed multi-dish card for same-author-at-meal-event. Deferred to a future checkpoint.
- **MealEventDetailScreen / L7.** Checkpoint 6.
- **Full post editing capabilities from 7M.** Recipe link editing, rating changes, modifications/notes editing, visibility changes, cooking method changes, dietary badge edits, unsaved-changes handling. Deferred to 7M.
- **`prefetchPreheadContext` performance fix.** P7-75.
- **`hydrateEngagement` performance fix.** P7-74.
- **Storage integrity audit.** P7-79.
- **`posts.photos` jsonb shape normalization.** P7-73 — CookCardInner already handles both shapes defensively from Checkpoint 4.5.1.
- **Recipe image filename normalization.** P7-72.
- **Non-author overflow menu.** Report, hide, block — no moderation affordances.
- **"Ate with" block on L6.** Blocked on P7-66 (eater_ratings schema).
- **"Related cooks from friends" section.** P7-51.
- **Personalized chef page lens.** P7-52.
- **Cookbook page number deep-linking.** P7-53 — render the page number in the recipe line but don't make it a tap target.
- **Share sheet integration.** Placeholder Alert only. Real integration is Phase 7J.
- **Changes to `components/feedCard/groupingPrimitives.tsx`.** Stable from Checkpoint 3.5.
- **Removing the flask debug button** `🧪` from FeedScreen's header. Stays through Checkpoint 6.
- **Changes to any file outside the "Files you are expected to touch" list below.**

---

## Files you are expected to touch

**Pass 1:**
- `screens/CookDetailScreen.tsx` — **new file**, bulk of the work
- `screens/FeedScreen.tsx` — remove inlined `transformToCookCardData`, import from new module, update `navigateToCookDetail` to route to the real target
- `screens/RecipeDetailScreen.tsx` — swap hero grey rectangle for `NoPhotoPlaceholder` (intentional cross-phase)
- `components/feedCard/sharedCardElements.tsx` — add `NoPhotoPlaceholder`, extend `PhotoCarousel` with onError handling
- `lib/services/cookCardDataService.ts` — **new file**, houses migrated `transformToCookCardData` + `fetchSingleCookCardData` + `fetchCookCardDataBatch`
- `App.tsx` — register `CookDetail` route in `FeedStackParamList`
- `docs/SESSION_LOG.md` — write partial entry ending with PAUSED marker

**Pass 2:**
- `components/AddCookingPartnersModal.tsx` — add `existingParticipantIds` prop, update internal state to pre-select
- `lib/services/postService.ts` — add minimal `updatePost` helper if it doesn't exist
- `screens/CookDetailScreen.tsx` — wire the six overflow menu items
- Any call sites that need updating per the `AddCookingPartnersModal` audit (likely `components/QuickAddModal.tsx`, `components/LogCookSheet.tsx`)
- `docs/SESSION_LOG.md` — replace PAUSED marker with Pass 2 findings and full closeout
- `docs/PHASE_7_SOCIAL_FEED.md` — write D49, D50, D47 numbering-gap note, new deferred items

**Files you should NOT touch:**
- `components/feedCard/CookCard.tsx` — stable; the D50 onError-collapse flows through automatically
- `components/feedCard/groupingPrimitives.tsx` — stable from Checkpoint 3.5
- `screens/_Phase7ITestHarness.tsx` — stable
- `screens/MealDetailScreen.tsx` — Checkpoint 6
- Any `post_likes`, `post_comments`, `post_participants`, `meal_event_likes`, or `eater_ratings` schema changes
- Any performance optimization in `prefetchPreheadContext`, `hydrateEngagement`, or related
- Any component in `components/feedCard/` beyond `sharedCardElements.tsx`
- The flask debug button `🧪` in FeedScreen's header — stays through Checkpoint 6

---

## Verification

### Pass 1 self-check (before writing the PAUSED SESSION_LOG)

1. **TypeScript compiles cleanly.** `npx tsc --noEmit` returns zero errors.
2. **Feed still works.** Cold-launch the feed. Confirm `[FEED_CAP_TELEMETRY]` logs, phase timings in the ~3.3s steady-state range from Checkpoint 4.5, no crashes.
3. **Route registration works.** Tapping a cook card from the feed navigates to CookDetailScreen without a navigation error. Back button returns to feed.
4. **All 14 content blocks render** per spec when data is present. Absent blocks don't reserve empty space.
5. **`NoPhotoPlaceholder` renders** on photoless posts, RecipeDetailScreen, and after `PhotoCarousel` onError collapse.
6. **FeedScreen's `CommentsList` temporary target is gone.** `grep -n "CommentsList" screens/FeedScreen.tsx` shows only the comment-icon tap target, not the cook-card body target.
7. **Data-loading migration is clean.** `transformToCookCardData` is no longer defined in `FeedScreen.tsx`; it's imported from `lib/services/cookCardDataService.ts`.
8. **`getCookHistoryForUserRecipe` exercised with real data** and the result documented in SESSION_LOG.
9. **Highlights block decision documented** — shipped with the service call or shipped with fallback.
10. **Comments block decision documented** — inline extraction or tap-through fallback.

### Pass 2 self-check (before writing the final SESSION_LOG section)

11. **TypeScript still compiles.** `npx tsc --noEmit` returns zero errors.
12. **All 6 overflow menu items wired end-to-end.** Each triggers the expected write and refetch.
13. **The `AddCookingPartnersModal` audit is complete.** Every call site updated or left correctly. Audit outcome documented.
14. **`postService.updatePost` exists or was added.** Signature supports `title`, `description`, and `parent_meal_id`.
15. **Test harness still works.** Flask button still present. All 7 harness states still render (no regression).
16. **The three Checkpoint 4.5 target posts still render.** Anthony's kombucha, Chickpea soup, Watermelon feta — seed photos correctly displayed. No regression.

---

## Hard stop requirements

**Pass 1 hard stop:** After Sub-section 5.5 completes and all Pass 1 self-checks pass, write the partial SESSION_LOG entry ending in `PAUSED — awaiting GO for Sub-section 5.3 ...` and STOP. Do not touch any Pass 2 files. Wait for Tom's explicit GO.

**Pass 2 hard stop:** After Sub-section 5.3 completes (including whichever audit outcome applies), append the final SESSION_LOG section, write D49 / D50 / the numbering-gap note into the Decisions Log, add the new deferred items, and STOP. Do NOT proceed to Checkpoint 6. Do NOT start MealEventDetailScreen. Do NOT touch meal-event-level engagement schema. Do NOT start the D49 renderer. Wait for Tom's review.

**Second-hard-stop clause:** If at any point during Pass 2 the `AddCookingPartnersModal` audit surfaces a conflict requiring the fallback (new `ManageCookPartnersModal` component), pause immediately, document the conflict in the in-progress SESSION_LOG, and wait for Tom's explicit GO for the fallback. Do not unilaterally create the new component.

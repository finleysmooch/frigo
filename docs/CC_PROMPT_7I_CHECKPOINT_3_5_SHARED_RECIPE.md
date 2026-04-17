# Phase 7I Checkpoint 3.5 — Shared-Recipe Merged Groups

**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 3.5 of 7 (inserted between 3 and 4)
**Prior work:**
- **Checkpoint 1 (complete):** Data migration `post_type='meal'` → `'meal_event'`
- **Checkpoint 2 (complete):** Services layer — `buildFeedGroups`, `getLinkedCookPartners`, `getMealEventForCook`, `getMealEventDetail`, `getCookHistoryForUserRecipe`, types in `lib/types/feed.ts`
- **Checkpoint 3 (complete):** CookCard component, grouping primitives (`MealEventPrehead`, `CookPartnerPrehead`, `MealEventGroupHeader`, `LinkedCookStack`), `RecipeLine` icon polish, `screens/_Phase7ITestHarness.tsx` dev-only verification screen. SESSION_LOG entry at `2026-04-14 — Phase 7I Checkpoint 3 — CookCard + Grouping Primitives + Polish`.

**Why this checkpoint exists:** Tom reviewed the Checkpoint 3 test harness visuals and noticed two design refinements worth making before Checkpoint 4 starts. Both surfaced by comparing to Strava's "ran with" pattern:

1. **Linked posts should not have gray gaps between them vertically.** Today, `LinkedCookStack` stacks full `CookCard`s with each card having its own `CardWrapper` (top/bottom borders + marginBottom). This creates visible gray strips between linked posts. Linked groups should read as one continuous card, not discrete cards with breathing room.
2. **Same-recipe cook pairs should collapse to a single shared-hero layout.** When Tom and Anthony both cook Pasta alla Carbonara together (same `recipe_id`, reciprocally tagged as cook partners), the feed should show ONE shared recipe image at the top of the group plus a linking header, with each person's individual post content (header, description, stats, engagement) rendered as a sub-section below. Each sub-section keeps its own photo carousel only if that cook added personal photos beyond the recipe image fallback.

These are captured as **D48** in `docs/PHASE_7_SOCIAL_FEED.md` (to be added as part of this checkpoint's deferred work — see Sub-section 3.5.6).

**Required reading before starting:**
1. `docs/PHASE_7I_MASTER_PLAN.md` — full Phase 7I scope, wireframes L1-L7, D47 supersession notes
2. `docs/frigo_phase_7i_wireframes.html` — visual reference
3. `docs/SESSION_LOG.md` — Checkpoint 2 and 3 entries for current services + component state
4. `docs/CC_PROMPT_7I_CHECKPOINT_3_COOKCARD.md` — the Checkpoint 3 prompt, for context on what the existing components look like and why
5. `components/feedCard/CookCard.tsx` — the file you will refactor
6. `components/feedCard/groupingPrimitives.tsx` — the file you will extend
7. `components/feedCard/sharedCardElements.tsx` — the primitives layer (untouched except for any minor helper extraction)
8. `lib/services/feedGroupingService.ts` — the `buildFeedGroups` function you will refine
9. `lib/types/feed.ts` — the types you will extend
10. `screens/_Phase7ITestHarness.tsx` — update with new state to verify

**Hard stop at end of checkpoint.** Do not proceed to Checkpoint 4 (FeedScreen rewrite). Write a SESSION_LOG entry and wait for Tom's review.

---

## Goal

Refactor the existing CookCard + LinkedCookStack to support the shared-recipe merged group pattern, add a new `SharedRecipeLinkedGroup` component that renders same-recipe cook pairs/triples as one unified card with shared hero + per-cook sub-sections, update `buildFeedGroups` to detect merge candidates, and refine the test harness to verify the new rendering. All four existing wireframe states (L1, L2, L3a, L3b, L4, L5) must continue to render. New state (L5 with a shared-recipe sub-merge inside) gets added.

**Scope lock:** No changes to `FeedScreen.tsx` — that is still Checkpoint 4's work. No changes to detail screens. No DB schema changes. No changes to write paths (`createDishPost`, etc.). No deletion of old components (`PostCard`, `MealPostCard`, `LinkedPostsGroup`) — those stay until Checkpoint 7. The scope is card-rendering refinement only.

---

## Context: the architectural shift

**Before this checkpoint:** A linked group is a list of full `CookCard`s stacked vertically under a shared frame (gutter line for L3b, header + gutter for L5). Each card has its own `CardWrapper` with top/bottom borders, which creates visible gaps between stacked cards. Every stacked card shows its own photo carousel, even if multiple cards show the same recipe image.

**After this checkpoint:** Linked groups come in two flavors:

- **Flat stack (no merge):** Cards stack without gap between them. Used for L5 where each cook brought a different dish (different `recipe_id` values) and for standalone L3b where two cooks made different recipes but are reciprocally tagged as cook partners. Implemented via `LinkedCookStack`, refactored to use `CookCardInner` (no wrapper) with a single outer `CardWrapper` around the whole stack.
- **Shared-recipe merged group:** A single unified card with a shared hero photo carousel at the top (the recipe's canonical image or the first cook's uploaded photos), an optional linking header ("Tom cooked with Anthony · Apr 14"), and a list of cook sub-sections below. Each sub-section renders the cook's individual header + description + stats + engagement, and includes its OWN photo carousel only if that cook added personal photos beyond the recipe image. Implemented as a new `SharedRecipeLinkedGroup` component.

**Merging rules (implemented in `buildFeedGroups`):**

- **Inside a meal event group:** Sub-groups of cooks who share the same `recipe_id` within the meal event auto-merge into a `SharedRecipeLinkedGroup` sub-unit, **regardless of whether they explicitly tagged each other as cook partners**. Rationale: the meal event establishes the "these people were together" context, and shared recipe_id establishes "they made the same thing." Explicit sous_chef tagging is nice-to-have signal but not required.
- **Outside a meal event (standalone L3b):** Merge only when cooks are in the same linked component via cook-partner edges (reciprocal sous_chef tagging) AND share a `recipe_id`. Different-recipe L3b cases degrade to two separate solo cards — deferred as P7-68 for a later polish pass, not handled in this checkpoint.
- **Linking header visibility:** Shown at the top of standalone shared-recipe groups (outside meal events). Omitted when the shared-recipe group is nested inside a meal event — the meal event header provides context and a second header is redundant.

**Example of the nested case:** Friendsgiving at the Grosses has 5 cooks. Mary brings turkey, Dad brings stuffing, Cam brings pie, Tom and Mary Jr. both make carbonara together. The feed renders:

```
┌─ Meal Event Group Header: "Friendsgiving at the Grosses" · Mary · Nov 22
│
├─ Solo CookCard: Turkey (Mary)
│
├─ Solo CookCard: Stuffing (Dad)
│
├─ Solo CookCard: Pie (Cam)
│
├─ SharedRecipeLinkedGroup: Carbonara
│   (no secondary linking header — context from meal event above)
│   [shared hero: carbonara recipe image]
│   [Tom sub-section: header, description, stats, engagement]
│   [Mary Jr. sub-section: header, description, stats, engagement]
│
└─ (one outer CardWrapper around everything; no gray gaps between any of the above)
```

---

## Sub-section 3.5.1 — Extract `CookCardInner` from `CookCard`

**Purpose:** Separate the card's inner content from its outer wrapper. This lets linked groups reuse the inner content without the wrapper, giving them flat no-gap rendering automatically.

**What to do:**

1. In `components/feedCard/CookCard.tsx`, take the JSX inside the existing `<CardWrapper>` and extract it into a new component called `CookCardInner`. The extracted component takes all the same props as the outer `CookCard` minus anything wrapper-specific.
2. Export `CookCardInner` as a named export from `CookCard.tsx` (both components live in the same file for now — don't split into separate files).
3. `CookCard` becomes a thin wrapper: `export default function CookCard(props) { return <CardWrapper colors={useTheme().colors}><CookCardInner {...props} /></CardWrapper>; }`.
4. Add an optional prop `photosOverride?: CarouselPhoto[] | null` to `CookCardInner`. When `photosOverride` is `null` (explicit null, not undefined), the inner component suppresses the photo carousel entirely (no photos rendered at all). When `photosOverride` is an array, it replaces the default photo derivation with the passed array. When `photosOverride` is `undefined` (default), the inner component uses its existing photo derivation logic (post.photos or recipe_image_url fallback). This prop exists so `SharedRecipeLinkedGroup` can suppress per-cook photos when a cook has no personal media beyond the recipe image.

**Verification:** the solo L1 case in the test harness renders identically before and after this refactor. No visual change. TypeScript compiles clean.

---

## Sub-section 3.5.2 — Refactor `LinkedCookStack` to use `CookCardInner` with a single outer wrapper

**Purpose:** Remove the gaps between stacked cards in the flat-stack case (L5 with different-recipe contributors, standalone L3b with different-recipe partners).

**What to do:**

1. In `components/feedCard/groupingPrimitives.tsx`, modify `LinkedCookStack` so that its inner rendering calls `CookCardInner` instead of the default `CookCard` export. This means stacked cards no longer each wrap in their own `CardWrapper`.
2. Add a single outer `<CardWrapper>` around the entire stack content (header + indented sub-sections). The whole group reads as one visual unit.
3. The left gutter connector (`borderLeftWidth: 1`) stays, but now it runs the full height of the inner content inside the single wrapper, not across multiple wrapper boundaries.
4. Between consecutive `CookCardInner` renders inside the stack, add a thin divider — `borderTopWidth: 0.5, borderTopColor: colors.border.light` on the second and subsequent sub-sections. This maintains visual separation between cooks without reintroducing the gray gap. The divider is a hairline inside the shared card frame, not a gap between distinct cards.
5. `MealEventGroupHeader` stays as a separate component but now renders inside the single outer `CardWrapper`, visually attached to the first cook sub-section below it.

**Verification:** the L5 wireframe state in the test harness renders as one continuous card with the header at top, then four stacked cook sections, with hairline dividers between them and no gray gaps. The left gutter connector spans the full content height from header to last section.

---

## Sub-section 3.5.3 — Add `SharedRecipeLinkedGroup` component

**Purpose:** The new merged-group rendering path for same-recipe linked cooks.

**File:** `components/feedCard/groupingPrimitives.tsx` (add to existing file; do not create new file)

**Signature:**

```typescript
import { CookCardData } from '../../lib/types/feed';
import { HighlightSpec, CarouselPhoto } from './sharedCardElements';
import { VibeTag } from '../../lib/services/vibeService';

interface SharedRecipeLinkedGroupProps {
  posts: CookCardData[];  // 2+ posts, all sharing the same recipe_id
  currentUserId: string;
  /** Whether to show the "Tom cooked with Anthony" linking header at the top.
   *  True for standalone groups, false when nested inside a meal event group. */
  showLinkingHeader: boolean;
  /** Per-post engagement state getters (same pattern as LinkedCookStack) */
  getLikeDataForPost: (postId: string) => any;  // use the same likeData shape from CookCardProps
  getHighlightForPost: (postId: string) => HighlightSpec | null;
  getVibeForPost: (postId: string) => VibeTag | null;
  /** Navigation callbacks — applied per sub-section */
  onCardPress: (postId: string) => void;
  onRecipePress: (recipeId: string) => void;
  onChefPress: (chefName: string) => void;
  onCardMenu: (postId: string) => void;
  onCardLike: (postId: string) => void;
  onCardComment: (postId: string) => void;
  onCardViewLikes: (postId: string) => void;
}

export function SharedRecipeLinkedGroup(props: SharedRecipeLinkedGroupProps): JSX.Element;
```

**Render structure:**

```tsx
<CardWrapper colors={colors}>
  {/* 1. Optional linking header — only when showLinkingHeader is true */}
  {showLinkingHeader && (
    <LinkingHeader
      primaryAuthorName={posts[0].author.display_name || posts[0].author.username}
      otherAuthorNames={posts.slice(1).map(p => p.author.display_name || p.author.username)}
      timestamp={posts[0].created_at}
      colors={colors}
    />
  )}

  {/* 2. Shared hero photo carousel — the recipe's canonical image */}
  <PhotoCarousel photos={sharedHeroPhotos} colors={colors} />

  {/* 3. Per-cook sub-sections */}
  {posts.map((post, index) => (
    <View key={post.id}>
      {index > 0 && <SubSectionDivider colors={colors} />}
      <CookCardInner
        post={post}
        currentUserId={currentUserId}
        highlight={getHighlightForPost(post.id)}
        vibe={getVibeForPost(post.id)}
        likeData={getLikeDataForPost(post.id)}
        onPress={() => onCardPress(post.id)}
        onRecipePress={onRecipePress}
        onChefPress={onChefPress}
        onLike={() => onCardLike(post.id)}
        onComment={() => onCardComment(post.id)}
        onMenu={() => onCardMenu(post.id)}
        onViewLikes={() => onCardViewLikes(post.id)}
        photosOverride={hasPersonalPhotos(post) ? undefined : null}
      />
    </View>
  ))}
</CardWrapper>
```

**Helper logic to implement:**

- **`sharedHeroPhotos`:** Take the `recipe_image_url` from `posts[0]` (all posts share the same recipe, so any of them has the same value). If that's present, return `[{ url: posts[0].recipe_image_url, isRecipePhoto: true }]`. If not present, fall back to the photos from the first post that has photos (`posts.find(p => p.photos && p.photos.length > 0)`). If no post has any photos, the hero is empty and `PhotoCarousel` returns null — that's acceptable degradation.
- **`hasPersonalPhotos(post)`:** Returns true if `post.photos && post.photos.length > 0`. The photo suppression logic is: a cook sub-section shows its own carousel only if the cook uploaded actual photos. If the cook has no uploaded photos (would have fallen back to the recipe image), the sub-section's carousel is suppressed (via `photosOverride={null}`) because the shared hero at the top is already serving that role.

**New inline helpers (live inside `groupingPrimitives.tsx`, not exported):**

- **`LinkingHeader`:** A small row at the top of the group that reads "Tom cooked with Anthony" (for 2 cooks) or "Tom cooked with Anthony and Mary" (for 3) or "Tom cooked with Anthony, Mary, and Cam" (for 4+). Uses 15px bold title + 11px gray meta line below with timestamp ("Apr 14 · 6:15 PM"). Same visual weight as `MealEventGroupHeader` minus the avatar. Padding: 14px horizontal, 12px top, 8px bottom.
- **`SubSectionDivider`:** A thin hairline (`borderTopWidth: 0.5, borderTopColor: colors.border.light`) between consecutive cook sub-sections. Same as the one in refactored `LinkedCookStack`.

**Edge cases:**

- **`posts.length < 2`:** Return null. `SharedRecipeLinkedGroup` should never be called with fewer than 2 posts; if it is, degrade gracefully.
- **`posts.length >= 2` but all posts have no photos and no recipe_image_url:** The shared hero carousel is empty. Render the linking header (if enabled) and the cook sub-sections without a hero. Uncommon case but structurally sound.
- **Any cook in the group has personal photos that differ from the recipe image:** Their sub-section shows their own carousel (the second one vertically in the group). This is the "personal variation" case — Tom's carbonara photo is different from Anthony's carbonara photo. Both should show.

---

## Sub-section 3.5.4 — Update `buildFeedGroups` with nested classification

**Purpose:** Teach `buildFeedGroups` to detect shared-recipe sub-groups and flag them in the output for the rendering layer to use `SharedRecipeLinkedGroup` instead of stacking full cards.

**File:** `lib/services/feedGroupingService.ts`

**Type changes in `lib/types/feed.ts`:**

```typescript
// Add a new sub-unit type
export interface FeedGroupSubUnit {
  kind: 'solo' | 'shared_recipe';
  posts: CookCardData[];  // 1 for solo, 2+ for shared_recipe
}

// Extend the existing FeedGroup type
export interface FeedGroup {
  id: string;
  type: 'solo' | 'linked_meal_event' | 'linked_shared_recipe';  // expanded from 'solo' | 'linked'
  posts: CookCardData[];  // flat list of all posts in the group (for compatibility)
  // New optional field — only populated for linked_meal_event groups that contain merged sub-groups.
  // When present, the rendering layer uses this list of sub-units instead of `posts` directly.
  subUnits?: FeedGroupSubUnit[];
  linkContext?: LinkContext;
}
```

**Algorithm changes in `buildFeedGroups`:**

1. **Keep the existing union-find DFS** that builds connected components from cook-partner edges and meal-event edges.

2. **Classify each connected component:**
   - If the component has 1 post → `type: 'solo'`, `subUnits: undefined`.
   - If the component has 2+ posts and was formed via cook-partner edges only (no meal_event edge) AND all posts share the same `recipe_id` → `type: 'linked_shared_recipe'`, `subUnits: undefined` (the whole group IS the shared-recipe unit). This is standalone L3b same-recipe.
   - If the component has 2+ posts and was formed via cook-partner edges only (no meal_event edge) AND posts have mixed `recipe_id` values → `type: 'linked_shared_recipe'` doesn't fit. Degrade to two `type: 'solo'` groups, one per post. This is the "different-recipe L3b degrades to solo cards" rule. Mark these degraded posts somehow so the dry-run output can confirm the degradation is happening (e.g., log count of degraded posts).
   - If the component has 2+ posts and was formed via meal_event edge (possibly plus cook-partner edges) → `type: 'linked_meal_event'`, and compute `subUnits`:
     - Group posts by `recipe_id`. Posts with the same `recipe_id` within the meal event form a `shared_recipe` sub-unit. Posts with unique `recipe_id` (only one post with that recipe_id in the meal event) form a `solo` sub-unit each.
     - Posts with `recipe_id === null` each form their own `solo` sub-unit (can't merge null recipes — that's nonsensical).
     - The `subUnits` array is ordered: sort by the earliest `created_at` of the posts within each sub-unit, ascending.

3. **Apply Rule C visibility** as before — the component-level visibility check stays the same (at least 2 posts visible for a linked group to form). For `linked_meal_event` groups, if visibility degradation drops the component below 2 visible posts, degrade to solo as before.

4. **Output structure:** Return `FeedGroup[]` with the new `type` values and optional `subUnits`. The old `type: 'linked'` is replaced by `type: 'linked_meal_event'` or `type: 'linked_shared_recipe'` — no backward compatibility needed because `buildFeedGroups` has no real callers yet (Checkpoint 4 is still untouched).

**Update the single-post `getLinkedCookPartners` function:** No changes. It still returns partner post IDs — the merge decision happens in `buildFeedGroups`, not in the partner-finding step.

**Performance consideration:** The nested classification adds one additional client-side pass over the component's posts (grouping by recipe_id). Negligible cost for realistic group sizes (2-8 posts).

**Test this with a new dry-run:** Write a small throwaway harness (same pattern as Checkpoint 2's `buildFeedGroups` dry run, same path `scripts/_phase_7i_checkpoint_3_5_dryrun.mjs`, delete before committing) that constructs synthetic posts for three cases:

- 2 cooks, same recipe, reciprocally tagged, no meal event → expect `type: 'linked_shared_recipe'`, no subUnits
- 4 cooks at a meal event, all different recipes → expect `type: 'linked_meal_event'`, subUnits is 4 solo units
- 5 cooks at a meal event, 2 share a recipe, 3 brought different dishes → expect `type: 'linked_meal_event'`, subUnits is 3 solo units + 1 shared_recipe unit with 2 posts

Log the output structure for each case and confirm classification is correct. Same caveats as Checkpoint 2's dry run — the harness may need to reimplement the classification inline if the `lib/supabase.ts` import chain still blocks running from Node, in which case validate the data shape and algorithm but accept that the real TS code gets validated at Checkpoint 4 runtime.

---

## Sub-section 3.5.5 — Update the test harness

**Purpose:** Verify the new rendering visually.

**File:** `screens/_Phase7ITestHarness.tsx`

**Changes:**

1. **L3b section:** update the synthetic data so Tom and Anthony both have `recipe_id` set to the same recipe, and `recipe_title` set to "Pasta alla Carbonara" (or similar), and `recipe_image_url` set to a realistic Unsplash URL. Render the L3b case via `SharedRecipeLinkedGroup` with `showLinkingHeader={true}`. Visual expectation: single card with linking header at top ("Tom cooked with Anthony · Apr 14"), shared carbonara hero photo, Tom's sub-section with his description and stats, hairline divider, Anthony's sub-section below.
2. **L5 section:** update the synthetic data so four cooks all bring different dishes (different `recipe_id` values). Render via `LinkedCookStack` (existing component, now refactored to use `CookCardInner`). Visual expectation: single card with meal event group header at top, four cook sub-sections stacked with hairline dividers between them, no gray gaps anywhere, left gutter connector spanning full content.
3. **New L5.5 section:** "Meal event with shared-recipe sub-merge." Add a new synthetic scenario — 5 cooks at "Friendsgiving": Mary (turkey), Dad (stuffing), Cam (pie), Tom and Anthony (both carbonara, sharing the same recipe_id). Render the full group. Visual expectation:
   - Meal event group header at top
   - Turkey solo sub-section
   - Stuffing solo sub-section
   - Pie solo sub-section
   - Shared-recipe sub-unit rendered inline as a mini `SharedRecipeLinkedGroup` WITHOUT its own linking header (because it's inside the meal event context), with shared carbonara hero image and Tom + Anthony sub-sections below
   - All inside one outer CardWrapper, no gray gaps, hairlines between the top-level sub-units and between cooks within the shared-recipe sub-unit
4. **L3a, L4:** unchanged. Still render as before.

**New section labels:** update the `<Section>` labels so each rendered area is clearly marked. "L3b — Co-cook linked pair (same recipe, shared hero)", "L5 — Meal event linked group (flat stack, different recipes)", "L5.5 — Meal event with shared-recipe sub-merge", etc.

---

## Sub-section 3.5.6 — Capture D48 in the decisions log

**Purpose:** Preserve the design reasoning so future Claude.ai sessions have context.

**File:** `docs/PHASE_7_SOCIAL_FEED.md` (if present in the repo as a reference copy — otherwise skip this step and flag in SESSION_LOG that the decision should be captured in Tom's project knowledge docs)

**What to add:**

New row in the Decisions Log table, after the existing D47 row:

```
| D48 | **Same-recipe cook pairs collapse to shared-hero layout with per-cook sub-sections.** When two or more cooks log posts sharing the same recipe_id within a linked group (either standalone L3b same-recipe or nested inside an L5 meal event), the rendering collapses to a single unified card: optional linking header ("Tom cooked with Anthony · timestamp") at top, shared recipe image hero carousel, per-cook sub-sections below with hairline dividers between. Each sub-section renders the cook's individual header/description/stats/engagement, and includes its own photo carousel ONLY if that cook added personal photos beyond the recipe image fallback. **Merging rules:** inside a meal event, merge on shared recipe_id regardless of explicit sous_chef tagging (the meal event establishes the "together" context). Outside a meal event, merge only when cooks are in the same cook-partner linked component AND share a recipe_id. **Linking header visibility:** shown at the top of standalone shared-recipe groups; omitted when nested inside a meal event group (the meal event header provides context). **Different-recipe linked pairs degrade to two separate solo cards** for now — handling them as linked-but-unmerged is deferred (P7-68). Captured after Checkpoint 3 visual review surfaced the "don't show the same recipe image twice in the feed" observation. | 2026-04-14 | Tom — Checkpoint 3 visual review |
```

If the repo doesn't carry a copy of `PHASE_7_SOCIAL_FEED.md`, skip this and mention in SESSION_LOG that the decision should be captured in the Claude.ai project knowledge version of the phase doc.

---

## Sub-section 3.5.7 — Add a deferred item for different-recipe L3b

**Purpose:** Track the degraded case for later.

**File:** `docs/DEFERRED_WORK.md` if maintained in repo, otherwise flag in SESSION_LOG

**What to add:**

```
| P7-68 | **Different-recipe L3b rendering (deferred degradation)** | 💡 | 🟡 | Checkpoint 3.5 implements shared-recipe L3b merging but degrades different-recipe cook pairs (Tom makes carbonara, Anthony makes caesar salad, both tag each other as sous_chef) to two separate solo cards. This loses the "they cooked together" visual signal in the feed. A proper rendering for this case could be flat-stacked CookCardInners (similar to L5's different-recipe contributors) with a linking header at top, but no shared hero image. Deferred because: (a) it's an edge case that probably happens <20% of cook-partner pairs, (b) implementing it now adds a third rendering path to buildFeedGroups which complicates the architecture unnecessarily, (c) F&F testing will tell us how often this actually happens before we invest in it. **NEEDS REVIEW** — resolve after F&F feedback if the case surfaces as a real complaint. |
```

---

## What this checkpoint does NOT include

**Still deferred to Checkpoint 4:**
- Any change to `FeedScreen.tsx`
- Wiring `buildFeedGroups` into the real feed data flow
- Removing `.is('parent_meal_id', null)` from `loadDishPosts`
- Stopping the `getMealsForFeed` call
- `recipe_cook_time_min` denormalization (cook time + prep time fix from Checkpoint 3's SESSION_LOG)
- Pull-to-refresh hang investigation
- Logo tap-to-top
- Feed cap telemetry reporting

**Still deferred to Checkpoint 5/6/7:**
- CookDetailScreen (L6) — Checkpoint 5
- MealEventDetailScreen (L7) — Checkpoint 6
- Deleting old components — Checkpoint 7
- Relocating `PostType` to a types file — Checkpoint 7

**Still deferred to 7M:**
- Full post editing UX
- Different-recipe L3b rendering (P7-68)

---

## Files you are expected to touch

- `components/feedCard/CookCard.tsx` — refactor to extract `CookCardInner`, add `photosOverride` prop (sub-section 3.5.1)
- `components/feedCard/groupingPrimitives.tsx` — refactor `LinkedCookStack` to use `CookCardInner` (sub-section 3.5.2), add `SharedRecipeLinkedGroup` + `LinkingHeader` + `SubSectionDivider` helpers (sub-section 3.5.3)
- `lib/services/feedGroupingService.ts` — update `buildFeedGroups` with nested classification (sub-section 3.5.4)
- `lib/types/feed.ts` — add `FeedGroupSubUnit` type, extend `FeedGroup` with `subUnits` field and new `type` values (sub-section 3.5.4)
- `screens/_Phase7ITestHarness.tsx` — update synthetic data and add L5.5 section (sub-section 3.5.5)
- `docs/PHASE_7_SOCIAL_FEED.md` if present — add D48 row (sub-section 3.5.6)
- `docs/DEFERRED_WORK.md` if present — add P7-68 row (sub-section 3.5.7)
- `scripts/_phase_7i_checkpoint_3_5_dryrun.mjs` — throwaway dry-run harness, deleted before committing

**Files you should NOT touch:**
- `screens/FeedScreen.tsx` — that's Checkpoint 4
- `components/PostCard.tsx`, `components/MealPostCard.tsx`, `components/LinkedPostsGroup.tsx` — those stay until Checkpoint 7
- `components/feedCard/sharedCardElements.tsx` — no changes needed (the primitives layer is stable)
- Any other service file in `lib/services/`
- `lib/supabase.ts` or DB connection code
- Database migrations (no SQL in this checkpoint)
- `App.tsx` (the test harness route is already registered)

---

## Verification

After all sub-sections land:

1. **TypeScript compiles cleanly** on all touched files: `npx tsc --noEmit`. Zero errors. Non-negotiable.

2. **Grep verification:**
   - `grep -n "CardWrapper" components/feedCard/CookCard.tsx` — should show CardWrapper used only in the thin `CookCard` wrapper component, not in `CookCardInner`
   - `grep -n "CardWrapper" components/feedCard/groupingPrimitives.tsx` — should show CardWrapper used at the TOP of `LinkedCookStack` and `SharedRecipeLinkedGroup` (once each), wrapping the whole group content
   - `grep -n "type:" lib/services/feedGroupingService.ts` — should show the three new type values (`'solo'`, `'linked_meal_event'`, `'linked_shared_recipe'`) being assigned to FeedGroup instances

3. **Dry-run for `buildFeedGroups` classification:** write the throwaway harness described in 3.5.4, run it, log the output for all three synthetic cases, confirm the classification is correct. Delete the harness before committing. Same caveats as Checkpoint 2's dry run about Node compatibility — if the real TS code can't run under Node, inline the algorithm and validate the data shape.

4. **Runtime smoke test via the test harness:**
   - Reload the app. Navigate to `Phase7ITestHarness` (the route is registered from Checkpoint 3; entry point is whatever temporary button Tom added or removed during Checkpoint 3 review — if the button was removed, add a temporary flask emoji button to FeedScreen's header, verify, then remove).
   - Verify each section renders without crashing:
     - L1 — unchanged from Checkpoint 3
     - L2 — unchanged from Checkpoint 3
     - L3a — unchanged from Checkpoint 3
     - L3b — now renders as `SharedRecipeLinkedGroup` with linking header, shared carbonara hero, Tom + Anthony sub-sections
     - L4 — unchanged from Checkpoint 3
     - L5 — still flat stack of 4 different-recipe cook sub-sections, but now with no gray gaps and a single outer CardWrapper
     - L5.5 — new, meal event header + 3 solo sub-sections + 1 shared-recipe sub-unit, all in one continuous card with no gray gaps
   - **Visual checks for each state:**
     - No visible gray gaps between stacked content inside a linked group
     - Hairline dividers between sub-sections read as intentional separators, not accidental gaps
     - Shared hero carousel renders correctly on L3b and L5.5's inner merged sub-unit
     - Linking header shows on standalone L3b but NOT on L5.5's inner merged sub-unit (the meal event header serves that role)
     - Per-cook photo carousel is suppressed when a cook has no personal photos (check by verifying the shared-recipe groups don't show duplicate recipe images)
     - Left gutter connector still renders on LinkedCookStack (L5)

5. **Feed tab smoke test:**
   - Open the real Feed tab. Verify it renders exactly as it did after Checkpoint 3 — dish-only, no meal cards, no crashes. No visual change expected; nothing Checkpoint 4-related has shipped yet.

---

## Hard stop requirements

After all verification steps pass, write a SESSION_LOG entry titled `2026-04-14 — Phase 7I Checkpoint 3.5 — Shared-Recipe Merged Groups` including:

- **Files modified:** full list
- **Sub-section 3.5.1 findings:** the CookCardInner extraction — any complications, whether the `photosOverride` prop needed adjustments
- **Sub-section 3.5.2 findings:** LinkedCookStack refactor — whether the single outer CardWrapper worked cleanly, any surprises with the existing prehead primitives (do MealEventPrehead / CookPartnerPrehead still sit outside the CardWrapper the way they should?)
- **Sub-section 3.5.3 findings:** SharedRecipeLinkedGroup build — any decisions about the LinkingHeader wording, photo suppression logic corner cases, how you handled the `hasPersonalPhotos` heuristic
- **Sub-section 3.5.4 findings:**
  - How you classified components (flat iteration vs recursive traversal)
  - How the `subUnits` ordering logic handles ties (two sub-units with identical earliest created_at)
  - Dry-run output: did the three synthetic cases classify correctly?
  - Any surprises about the different-recipe degradation path
- **Sub-section 3.5.5 findings:** test harness updates — any visual rendering issues you could verify, any states that looked off, screenshot descriptions if you could take them
- **NEEDS REVIEW items flagged for Checkpoint 4:**
  - Visual verification of the new states (Tom eyeballs the harness on-device)
  - Any small styling tweaks deferred for later polish
  - Any prop interface decisions that affect Checkpoint 4's FeedScreen wiring
- **GO / NO-GO recommendation for Checkpoint 4:** based on verification results, should Checkpoint 4 (FeedScreen rewrite) proceed?

**Do NOT proceed to Checkpoint 4.** Do not modify FeedScreen. Do not call `buildFeedGroups` from real code. Hard stop. Wait for Tom.

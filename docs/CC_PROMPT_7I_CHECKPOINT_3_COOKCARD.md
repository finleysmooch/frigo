# Phase 7I Checkpoint 3 — CookCard + Grouping Primitives + Polish

**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 3 of 7
**Prior work:**
- **Checkpoint 1 (complete):** Data migration `post_type='meal'` → `'meal_event'`. 363 rows migrated. `PostType` union extended. DB CHECK constraint updated. Pre-migration snapshot in `posts_backup_pre_7i` table.
- **Checkpoint 2 (complete):** Services layer built. `getLinkedCookPartners` / `getLinkedCookPartnersForPosts` in `postParticipantsService.ts`. `getMealEventForCook` / `getMealEventDetail` in `mealService.ts`. `getCookHistoryForUserRecipe` in `recipeHistoryService.ts`. `buildFeedGroups` in `feedGroupingService.ts`. New types file `lib/types/feed.ts` with `CookCardData`, `FeedGroup`, `LinkContext`, `MealEventContext`. In-place `meal`→`meal_event` sweep across `mealService.ts`, `postParticipantsService.ts`, `highlightsService.ts`, `mealPlanService.ts`. Full SESSION_LOG entry at `2026-04-13 — Phase 7I Checkpoint 2 — Services layer`.

**Required reading before starting:**
1. `docs/PHASE_7I_MASTER_PLAN.md` — full Phase 7I scope, wireframes L1-L7, D47 supersession notes, all seven checkpoints
2. `docs/frigo_phase_7i_wireframes.html` — visual reference. **Especially L1 (solo single-dish), L2 (solo multi-dish "Me, myself, and the kitchen"), L3a (co-cook prehead only), L3b (co-cook linked pair), L4 (meal event solo), L5 (meal event linked group).** L6 and L7 are for Checkpoints 5 and 6, not this one.
3. `docs/SESSION_LOG.md` — Checkpoint 2 entry for the exact shape of the services layer CookCard will consume

**Hard stop at end of checkpoint.** Do not proceed to Checkpoint 4 (FeedScreen rewrite). Write a SESSION_LOG entry and wait for Tom's review.

---

## Goal

Build the new `CookCard` component and the grouping primitives (prehead, group header, linked stack) that Checkpoint 4 will assemble into feed groups. Also bundle polish work: book icon + friends icon integration, description-above-recipe ordering verification. At the end of Checkpoint 3, you have a complete rendering toolkit for the new feed model — Checkpoint 4's work is then primarily to call `buildFeedGroups` and wire the toolkit into FeedScreen.

**Scope lock:** No changes to `FeedScreen.tsx` — that is explicitly Checkpoint 4's work. No changes to existing PostCard or MealPostCard — those stay in place until Checkpoint 7 deletes them. No changes to services — Checkpoint 2's services are consumed as-is. No new types beyond the ones already defined in `lib/types/feed.ts`. No detail screen work (CookDetailScreen, MealEventDetailScreen) — those are Checkpoints 5 and 6.

---

## Context: what you'll find in the codebase

### Existing components the new work builds on

**`components/feedCard/sharedCardElements.tsx`** — contains all the visual primitives the current `PostCard` uses. They are:
- `CardWrapper` — full-width edge-to-edge card frame
- `TappableTitleBlock` — tap target wrapper for title/description
- `PhotoCarousel` — natural-aspect-ratio photo carousel (Fix Pass 8/9)
- `CardHeader` — avatar + title + meta row
- `DescriptionLine` — 3-line description paragraph
- `StatsRow` — stats row with optional Highlights pill in 4th slot
- `HighlightsPill` — author-side (teal) / viewer-side (cream) pill
- `VibePillRow` — single vibe pill below stats
- `EngagementRow` — liker avatars + "X gave yas chef" + comment count
- `ActionRow` — like/comment buttons (share button intentionally removed)
- `RecipeLine` — "📖 [Recipe Name] · [Chef]" or "📖 Freeform · no recipe"
- `StartedByFootnote` — "started by X · N invited" (for current meal cards, unused by CookCard)

**All 12 primitives are reusable as-is.** CookCard composes the same primitives in the same order that PostCard does. No primitive needs modification for the happy path. You may need to add *new* primitives (prehead, group header, linked stack wrapper) but the existing ones stay untouched.

**`components/PostCard.tsx`** — the current dish post card. Structurally similar to what CookCard becomes. **Do not modify.** Use it as reference for how the primitives compose.

**`components/icons/recipe/BookIcon.tsx` and `components/icons/recipe/FriendsIcon.tsx`** — per the earlier file listing, these component files exist. The Phase 7I wireframes call for a book icon (replacing the `📖` emoji in RecipeLine) and a friends icon (for cook-partner preheads). Before using them, verify:
- The components exist and compile
- Their prop interfaces accept `size`, `color`, and any other standard icon props
- They render in a style visually compatible with the wireframe (minimal, monochrome, similar weight to other card icons)

If the icons exist and match the style, use them to replace the emoji in `RecipeLine` and in new prehead primitives. If they don't exist or don't match, flag it in SESSION_LOG and keep the emoji for now (fallback), and add a new deferred item P7-65 in `docs/DEFERRED_WORK.md` for icon polish. **NEEDS REVIEW during execution.**

### Existing types from Checkpoint 2

The full data shape you consume:

```typescript
// From lib/types/feed.ts (created in Checkpoint 2)
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
  chef_name?: string | null;

  // Author profile
  author: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string | null;
    subscription_tier?: string;
  };
}

export interface FeedGroup {
  id: string;
  type: 'solo' | 'linked';
  posts: CookCardData[];
  linkContext?: {
    kind: 'cook_partner' | 'meal_event';
    mealEventId?: string;
  };
}

export interface MealEventContext {
  id: string;
  title: string;
  meal_time?: string;
  meal_location?: string;
  host_id: string;
  host_username?: string;
  host_display_name?: string;
  host_avatar_url?: string | null;
  total_contributor_count: number;
}
```

CookCard takes a single `CookCardData` plus the same supporting props that PostCard takes today (likeData, highlight, vibe, navigation callbacks). The grouping primitives take `FeedGroup` plus optional `MealEventContext`.

---

## Sub-section 3.1 — CookCard component

**Purpose:** The new per-cook-post card. Replaces PostCard's role in the feed render path. Renders a single cook post matching the L1 wireframe baseline.

**File:** `components/feedCard/CookCard.tsx` (new file in the same directory as `sharedCardElements.tsx`)

**Signature:**

```typescript
import { CookCardData } from '../../lib/types/feed';
import { HighlightSpec } from './sharedCardElements';
import { VibeTag } from '../../lib/services/vibeService';

interface CookCardProps {
  post: CookCardData;
  currentUserId: string;
  /** Pre-computed highlight from highlightsService */
  highlight?: HighlightSpec | null;
  /** Pre-computed vibe tag */
  vibe?: VibeTag | null;
  /** Like state (same shape PostCard takes) */
  likeData?: {
    hasLike: boolean;
    likesText?: string;
    commentCount?: number;
    likes?: Array<{
      user_id: string;
      created_at: string;
      avatar_url?: string | null;
      subscription_tier?: string;
    }>;
  };
  /** Navigation: tap on card body → CookDetailScreen (L6). In Checkpoint 3 this is a no-op callback;
   *  Checkpoint 4 wires it to the navigator; Checkpoint 5 builds the destination screen. */
  onPress?: () => void;
  /** Navigation: tap on recipe line → RecipeDetail */
  onRecipePress?: (recipeId: string) => void;
  /** Navigation: tap on chef name → AuthorView */
  onChefPress?: (chefName: string) => void;
  /** Like/comment callbacks */
  onLike?: () => void;
  onComment?: () => void;
  /** Overflow menu (visible only when the viewer is the post author — see Checkpoint 5 for items) */
  onMenu?: () => void;
  /** View likers list */
  onViewLikes?: () => void;
}

export default function CookCard(props: CookCardProps): JSX.Element;
```

**Render structure (match L1 wireframe exactly):**

```tsx
<CardWrapper colors={colors}>
  {/* 1. Header — single avatar + "Display Name" + "Apr 13 · Location" + optional menu */}
  <CardHeader
    avatars={[{
      avatar_url: post.author.avatar_url,
      subscription_tier: post.author.subscription_tier,
    }]}
    title={displayName}
    meta={`${formatDate(post.created_at)} · Portland, OR`}
    onMenu={isOwnPost ? onMenu : undefined}
    colors={colors}
  />

  {/* 2-4. Title + Description + Recipe — one tap target
     Wireframe order for Phase 7I per D47: title → description → recipe line.
     This differs from PostCard which renders title → recipe → description.
     Description-above-recipe is Phase 7I polish and a deliberate reordering. */}
  <TappableTitleBlock onPress={onPress}>
    <Text style={titleStyle}>{postTitle}</Text>
    <DescriptionLine description={post.description} colors={colors} />
    <RecipeLine
      recipeName={post.recipe_title || undefined}
      authorName={post.chef_name || undefined}
      isRecipeBacked={!!post.recipe_id}
      onRecipePress={post.recipe_id ? () => onRecipePress?.(post.recipe_id!) : undefined}
      colors={colors}
    />
  </TappableTitleBlock>

  {/* 5. Photo carousel — omitted for photoless cards */}
  <PhotoCarousel photos={carouselPhotos} colors={colors} />

  {/* 6. Stats row with optional Highlights pill (4th slot) */}
  <StatsRow
    stats={stats}
    highlight={highlight}
    colors={colors}
  />

  {/* 7. Vibe pill row (conditional: no vibe on photoless or freeform) */}
  <VibePillRow vibe={resolvedVibe} colors={colors} />

  {/* 8. Engagement row */}
  <EngagementRow
    likeData={likeData}
    onComment={onComment}
    onViewLikes={onViewLikes}
    colors={colors}
  />

  {/* 9. Action row (like/comment) */}
  <ActionRow
    onLike={onLike}
    onComment={onComment}
    hasLiked={likeData?.hasLike}
    colors={colors}
    functionalColors={functionalColors}
  />
</CardWrapper>
```

**Key differences from PostCard:**

1. **Description-above-recipe ordering (new for 7I).** PostCard renders title → recipe line → description. CookCard renders title → description → recipe line. This is deliberate — per the L1 wireframe, the cook-time description is more personal/contextual and should appear closer to the title, with the recipe attribution as a quieter line below it. Bundled polish in Checkpoint 3.

2. **No `isOwnPost` display name branching.** PostCard displays "You" for own posts and "Display Name" for others. CookCard always shows the actual display_name. Rationale: in the new model, "You" was a UI concession that breaks the Strava pattern. Under 7I, even your own posts show your name in the header. This matches Strava exactly.

3. **`onMenu` only shown when viewer is author.** The menu button on the header is rendered conditionally — `onMenu={isOwnPost ? onMenu : undefined}`. Compute `isOwnPost` inside CookCard as `post.user_id === currentUserId`. The menu items themselves are NOT part of Checkpoint 3 — the prop just needs to exist so Checkpoint 5 can wire it.

4. **`notes` field is NOT rendered on the card.** Per D4, `posts.notes` is cook-time thoughts that live on the detail screen only (L6), not on the feed card. PostCard doesn't render notes either, but I'm calling it out explicitly so CookCard doesn't accidentally pick it up.

5. **No `ParticipantsListModal`.** PostCard has an embedded participants modal. CookCard does not — participants are rendered in two contexts: (a) via the linked stack visualization in Checkpoint 4 (which is the grouping layer's job, not CookCard's), and (b) on the L6 detail screen in Checkpoint 5. CookCard itself doesn't show "cooked with X" text or a participants modal.

**Data derivation inside CookCard:**

- `displayName` = `post.author.display_name || post.author.username || 'Someone'`. No "You" branching.
- `isOwnPost` = `post.user_id === currentUserId`
- `postTitle` = `post.title || post.recipe_title || 'Cooking Session'` (same fallback cascade as PostCard, but using CookCardData's denormalized field)
- `isRecipeBacked` = `!!post.recipe_id`
- `hasPhotos` = `post.photos && post.photos.length > 0`
- `hasRecipeImage` = `!!post.recipe_image_url`
- `isPhotoless` = `!hasPhotos && !hasRecipeImage`
- `resolvedVibe` = `isPhotoless || !isRecipeBacked ? null : (vibe ?? null)` (same rule as PostCard)
- `stats` = assembled from `post.recipe_cook_time_min`, `post.rating`, `post.recipe_times_cooked` using PostCard's exact cascade (omit cook time if 0/null, omit rating if 0/null, format times_cooked as "1×" or "{N}×")
- `carouselPhotos` = assembled from `post.photos` or `post.recipe_image_url` using PostCard's exact pattern (highlight photos first, recipe image fallback)

**Reuse PostCard's helper functions directly** for `formatDate`, `formatTime`, and the stats assembly logic. Copy them inline or extract them to `sharedCardElements.tsx` as exports — your choice. If you extract, keep it minimal (don't factor out anything unless two components would benefit). Tom's preference is to avoid premature abstraction.

**Photoless card:** Same handling as PostCard. `<PhotoCarousel photos={[]} />` returns null early. Vibe pill is null. Everything else renders.

---

## Sub-section 3.2 — Grouping primitives (prehead, group header, linked stack)

These are **new primitives** that wrap `CookCard` to render the L3a, L3b, L4, and L5 wireframe states. They live in a new file `components/feedCard/groupingPrimitives.tsx`.

**File:** `components/feedCard/groupingPrimitives.tsx` (new)

**What to build:**

### 3.2.1 — `MealEventPrehead` (used by L4)

A small prehead row that appears *above* a single solo CookCard when the cook is attached to a meal event but the viewer is the only contributor they follow (Rule C degraded). Renders:

```
[friends icon] at [Meal event title] · [host name]
```

Tappable — taps navigate to `MealEventDetailScreen` (L7), but in Checkpoint 3 that's a no-op `onPress` callback (Checkpoint 4 wires navigation, Checkpoint 6 builds the screen). Quiet styling: small font (11px), gray tertiary color, 14px horizontal padding, 6px vertical padding. Think of it as a breadcrumb.

```typescript
interface MealEventPreheadProps {
  mealEvent: MealEventContext;
  onPress?: () => void;
}
```

### 3.2.2 — `CookPartnerPrehead` (used by L3a)

A small prehead row when a solo cook has at least one tagged `sous_chef` cook partner but the partner hasn't posted their own version yet (L3a transitional state). Renders:

```
[friends icon] cooking with [partner display name]
```

Non-tappable (there's nowhere to go — the partner hasn't posted). Same visual treatment as `MealEventPrehead`.

```typescript
interface CookPartnerPreheadProps {
  partnerName: string;
}
```

### 3.2.3 — `LinkedCookStack` (used by L3b and L5)

The container component that wraps 2+ CookCards in an indented Strava-style stack with a left gutter connector line. Renders:

```
┌─────────────────────────────────┐
│ [optional group header]          │ ← MealEventGroupHeader for L5, nothing for L3b
├──┬──────────────────────────────┤
│  │ [CookCard 1]                 │
│  │                              │
│  │ [CookCard 2]                 │
│  │                              │
│  │ [CookCard 3]                 │
└──┴──────────────────────────────┘
    ↑
   left gutter
   connector line
```

The left gutter is a thin gray vertical line (1px, gray.light color) that spans from the top of the first card to the bottom of the last card. 12px indent from the left edge. All cards inside the stack render with a small left margin (so they visually sit to the right of the connector).

**Implementation hint:** use absolute positioning for the connector line, or a `<View>` with `borderLeftWidth: 1, borderLeftColor: gray, paddingLeft: 12`. The second approach is simpler but makes the connector the same height as the child content — that's what you want.

```typescript
interface LinkedCookStackProps {
  posts: CookCardData[];  // 2+ posts
  currentUserId: string;
  // Optional group header for L5 (meal event linked group)
  mealEventContext?: MealEventContext;
  // Per-post engagement data — same shape as CookCardProps
  getLikeDataForPost: (postId: string) => CookCardProps['likeData'];
  getHighlightForPost: (postId: string) => HighlightSpec | null;
  getVibeForPost: (postId: string) => VibeTag | null;
  // Navigation callbacks — applied to each CookCard inside
  onCardPress: (postId: string) => void;
  onRecipePress: (recipeId: string) => void;
  onChefPress: (chefName: string) => void;
  onCardMenu: (postId: string) => void;
  onCardLike: (postId: string) => void;
  onCardComment: (postId: string) => void;
  onCardViewLikes: (postId: string) => void;
  // Group header tap (only relevant when mealEventContext is set)
  onGroupHeaderPress?: () => void;
}
```

The getter-style per-post props (`getLikeDataForPost`, etc.) let Checkpoint 4's FeedScreen pass the whole state map into the stack without CookCard caring about how state is organized.

### 3.2.4 — `MealEventGroupHeader` (used by L5)

The header row that appears at the top of a `LinkedCookStack` when the link context is `meal_event`. Renders:

```
[meal event title]
[host avatar] [host name] · [meal time] · [N cooks]
```

Tappable — taps navigate to MealEventDetailScreen. Larger than the preheads (closer to a mini-header). Think of it as a chapter marker for the linked group.

```typescript
interface MealEventGroupHeaderProps {
  mealEvent: MealEventContext;
  onPress?: () => void;
}
```

**Styling guidance:** Match the visual weight of `CardHeader` but without the avatar stack — single line of bold title + meta row below. 14px horizontal padding, 12px top padding, 8px bottom padding. Background should be the same card background color as CookCard below.

---

## Sub-section 3.3 — Polish items bundled into this checkpoint

### 3.3.1 — Book icon replacement in RecipeLine

**File:** `components/feedCard/sharedCardElements.tsx` (the existing RecipeLine function)

Check whether `components/icons/recipe/BookIcon.tsx` exists and matches the wireframe style:

- Exists + matches: import it and replace the `📖` emoji in both the recipe-backed and freeform branches of `RecipeLine`. Use size=12, color=colors.primary for recipe-backed, color=colors.text.secondary for freeform. This ensures the visual weight matches the surrounding text.
- Exists but wrong style: keep the emoji, note in SESSION_LOG.
- Doesn't exist: keep the emoji, add deferred item P7-65 "book icon component for RecipeLine polish" to `docs/DEFERRED_WORK.md`, note in SESSION_LOG.

This is an in-place edit of the existing `RecipeLine` function. Don't create a new version.

### 3.3.2 — Friends icon for preheads

Same check as 3.3.1 for `components/icons/recipe/FriendsIcon.tsx`. Used in `MealEventPrehead` and `CookPartnerPrehead`. Fallback is the `👥` emoji.

### 3.3.3 — Description-above-recipe ordering

This is already handled in Sub-section 3.1's CookCard structure — CookCard natively puts description above recipe line. The "polish item" here is just to **verify during execution** that CookCard's order is correct and doesn't accidentally fall back to PostCard's title → recipe → description order. If you copy PostCard's JSX structure and forget to reorder, you'll ship the wrong layout.

**Grep verification:** after writing CookCard, grep for the order of `<DescriptionLine` and `<RecipeLine` in the new file. Description should come first.

---

## Sub-section 3.4 — Write a visual test harness screen

**Why:** Checkpoint 3's components are not yet wired into FeedScreen (that's Checkpoint 4's work). Without a test harness, there's no way to see the components render in-app, verify visuals match wireframes, or catch layout bugs before Checkpoint 4 runs. This is the Checkpoint 3 analog of Checkpoint 2's dry-run.

**File:** `screens/_Phase7ITestHarness.tsx` (new, prefix with `_` to mark as dev-only)

**What to build:**

A simple screen with a ScrollView that renders each wireframe state once, using synthetic data you hand-construct inline. No DB queries. No service calls. Pure rendering test.

**States to render:**

1. **L1 — Solo single-dish.** Hand-constructed `CookCardData` for a typical solo cook. Use realistic fields (title, description, rating, photos array with 1-2 URLs, recipe attribution). Render `<CookCard post={l1Data} ... />`.

2. **L2 — Solo multi-dish.** Three `CookCardData` items with the same author, same timestamp, different titles ("Carbonara", "Caesar salad", "Garlic bread"). Render them as three independent CookCards — this is the point of L2, that "me, myself, and the kitchen" is three independent feed units, not a special group. Wrap with a `<Text>` label above the group that says "L2 — Solo multi-dish".

3. **L3a — Co-cook prehead only.** One `CookCardData` plus a `CookPartnerPrehead` above it. Use a hardcoded partner name like "Anthony".

4. **L3b — Co-cook linked pair.** Two `CookCardData` items (Tom's post and Anthony's post), rendered via `LinkedCookStack` with no `mealEventContext`. Verify the left gutter connector line shows correctly.

5. **L4 — Meal event solo.** One `CookCardData` with `parent_meal_id` set, plus a `MealEventPrehead` above it with a synthetic `MealEventContext` ("Friday night crew", hosted by "Mary").

6. **L5 — Meal event linked group.** Four `CookCardData` items from four different authors, rendered via `LinkedCookStack` with `mealEventContext` set. Group header should appear. Gutter should span all four cards.

**Wiring:** Add the test harness route to your navigator temporarily (in `App.tsx` or wherever feed stack routes are defined). Name the route `Phase7ITestHarness`. Add a visible entry point — easiest is a button in FeedScreen's header, or a direct navigation path from a debug menu. **NEEDS REVIEW during execution** — the simplest entry point is fine, but don't ship a public-facing button.

**After visual verification, do NOT delete the test harness.** It stays in the repo as `screens/_Phase7ITestHarness.tsx` for Checkpoint 4 to also use (when we're comparing the real feed output against the expected wireframe states). Checkpoint 7 cleanup will delete it permanently. The `_` prefix is the signal that it's dev-only.

---

## What this checkpoint does NOT include

**Explicitly deferred to Checkpoint 4:**
- Any change to `FeedScreen.tsx`
- Calling `buildFeedGroups` from any real feed data flow
- Wiring CookCard's `onPress` to navigate to CookDetailScreen (the destination doesn't exist yet)
- Removing `.is('parent_meal_id', null)` from `loadDishPosts`
- Stopping the `getMealsForFeed` call
- Any infinite scroll or pagination work
- Pull-to-refresh hang investigation (bundled there per the master plan)

**Explicitly deferred to Checkpoint 5:**
- Building CookDetailScreen itself
- Wiring CookCard's overflow menu items (Add photos, Edit title, etc.)
- `getCookHistoryForUserRecipe` consumption

**Explicitly deferred to Checkpoint 6:**
- Building MealEventDetailScreen
- Wiring MealEventPrehead / MealEventGroupHeader navigation targets

**Explicitly deferred to Checkpoint 7:**
- Deleting `PostCard.tsx`, `MealPostCard.tsx`, `LinkedPostsGroup.tsx`
- Removing `'meal'` from PostType union
- Relocating PostType to a types file
- Deleting the test harness

---

## Files you are expected to touch

- `components/feedCard/CookCard.tsx` — new file (sub-section 3.1)
- `components/feedCard/groupingPrimitives.tsx` — new file (sub-section 3.2)
- `components/feedCard/sharedCardElements.tsx` — minimal edit to `RecipeLine` for book icon replacement (sub-section 3.3.1), only if the icon component exists and matches. Otherwise untouched.
- `screens/_Phase7ITestHarness.tsx` — new file (sub-section 3.4)
- `App.tsx` or wherever feed stack routes live — add the test harness route

**Files you should NOT touch:**

- `screens/FeedScreen.tsx` — that's Checkpoint 4
- `components/PostCard.tsx`, `components/MealPostCard.tsx`, `components/LinkedPostsGroup.tsx` — those stay in place until Checkpoint 7
- Any service file in `lib/services/` — services are consumed, not modified
- `lib/types/feed.ts` — the types are already set by Checkpoint 2
- `lib/supabase.ts` or any DB connection code
- Database migrations (no new SQL in this checkpoint)

---

## Verification

After all four sub-sections land:

1. **TypeScript compiles cleanly** on all touched files: `npx tsc --noEmit`. Zero errors. This is non-negotiable.

2. **Grep verification:**
   - `grep -n "DescriptionLine\|RecipeLine" components/feedCard/CookCard.tsx` should show DescriptionLine *above* RecipeLine in line order.
   - `grep -rn "import.*from.*sharedCardElements" components/feedCard/` should show CookCard and groupingPrimitives both importing from sharedCardElements, and no import cycles.

3. **Runtime smoke test via the test harness:**
   - Reload the app. Navigate to the test harness screen. Verify each of the six wireframe states (L1, L2, L3a, L3b, L4, L5) renders without crashing.
   - **L1 check:** Single card renders with title, description, photo carousel, stats, engagement row. Description appears above recipe line.
   - **L2 check:** Three independent cards. No grouping, no connector line between them.
   - **L3a check:** Single card with prehead row above showing the partner name. Prehead is small and gray.
   - **L3b check:** Two cards stacked with visible left gutter connector line.
   - **L4 check:** Single card with meal event prehead above. Prehead shows meal event title and host.
   - **L5 check:** Four cards stacked with group header at the top (meal event title) and gutter connector spanning all four.
   - Take a screenshot of each state if possible. Save to `scratch/` (dev-only, not committed) or describe the visual in SESSION_LOG.

4. **Emoji vs icon outcome recorded:**
   - Whether BookIcon and FriendsIcon were used, or fallback emoji kept
   - If fallback was used, P7-65 added to DEFERRED_WORK.md with a clear description of what the polish is and why it was deferred

5. **Feed tab smoke test (NOT the test harness):**
   - Open the actual Feed tab on the device. Verify it renders exactly as it did after Checkpoint 2 — dish-only, no meal cards, no crashes. No visual change in the real feed is expected; CookCard exists but isn't used there yet.

---

## Hard stop requirements

After all verification steps pass, write a SESSION_LOG entry titled `2026-04-13 — Phase 7I Checkpoint 3 — CookCard + Grouping Primitives + Polish` including:

- **Files modified:** full list with line counts or function signatures added
- **Sub-section 3.1 findings:**
  - Any deviations from PostCard's structure and why
  - Helper function handling (inlined or extracted — and which if extracted)
  - Any surprise data shape issues from `CookCardData`
- **Sub-section 3.2 findings:**
  - How the left gutter connector line was implemented (borderLeft vs absolute positioning)
  - Whether the stack handles edge cases (1 post = degrade to solo? 10 posts = still works?)
  - Any prop interface decisions worth flagging for Checkpoint 4
- **Sub-section 3.3 findings:**
  - Book icon: exists/matches/fallback
  - Friends icon: exists/matches/fallback
  - Description-above-recipe ordering confirmed via grep
  - Any P7-65 items added to DEFERRED_WORK.md
- **Sub-section 3.4 findings:**
  - Test harness route wiring (where you added it, how to reach it)
  - Visual verification results for each of the 6 states
  - Any wireframe mismatches that need Checkpoint 4 follow-up
- **NEEDS REVIEW items flagged for Checkpoint 4 or later:**
  - Test harness entry point (shouldn't ship to users)
  - Icon fallback status
  - Any visual polish deferred because it's too fiddly for Checkpoint 3
- **GO / NO-GO recommendation for Checkpoint 4:** based on verification results, should Checkpoint 4 (FeedScreen rewrite) proceed?

**Do NOT proceed to Checkpoint 4.** Do not modify FeedScreen. Do not call `buildFeedGroups` from any real code path. Hard stop. Wait for Tom.

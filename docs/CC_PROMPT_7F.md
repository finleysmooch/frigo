# Claude Code Build Prompt — Phase 7F

**Issued:** 2026-04-09
**Author:** Claude.ai (planning brain) at Tom's direction
**Sub-phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Structure:** Five hard-stop checkpoints
**Estimated CC sessions across all checkpoints:** 4–6
**Wireframe reference:** `frigo_phase_7f_wireframes.html` (interactive HTML artifact, in this project — six iteration passes, ~60 states)
**Design decisions reference:** `PHASE_7F_DESIGN_DECISIONS.md` (in this project) — read this BEFORE the wireframes

---

## How this prompt works — read this first

This prompt covers the feed-rendering and detail-card work for Phase 7F. It is structured around five hard-stop checkpoints. At each checkpoint, you stop, write a SESSION_LOG entry, and wait for explicit go-ahead from Tom before proceeding.

**Why hard stops:** 7F rebuilds two of the most-visible components in the app (`MealPostCard` and `PostCard`) plus the meal detail card. Regression risk is real because these components are the primary user-facing surface for the social feed. The wireframe session resolved 44 design questions across six iteration passes — this prompt assumes those decisions are locked. If something in this prompt seems to conflict with a locked decision, flag it in the SESSION_LOG and stop.

**At each checkpoint, do not proceed past it on your own.** Write the SESSION_LOG entry. Stop. Wait. The next instruction from Tom (via Claude.ai) will either approve and tell you to continue, or redirect you with corrections.

**SESSION_LOG format at each checkpoint:** Use the existing SESSION_LOG.md format in the repo root. Header should be "Phase 7F Checkpoint N — {short title}". Include: what you did, what files you touched, what you tested, what's working, what's broken or uncertain, and any questions or assumptions you made that Tom should verify.

**Critical rules that apply across the entire prompt:**

1. **Services handle ALL Supabase calls.** Components never call the database directly. If you need new DB queries, add them to the appropriate service file (`mealService.ts`, `postService.ts`, etc.).
2. **Never remove existing functionality** unless this prompt explicitly says to. The 7D/7E work is recent and load-bearing — `LogCookSheet`, `MealDetailScreen`, the visibility filter, the cooked-vs-meal handoff flows. None of these should change as a side effect of 7F.
3. **Verify, don't assume.** If something looks broken or you're unsure how a piece of existing code is being used, search the codebase before changing it.
4. **Don't touch the data model.** 7F is a rendering pass. No schema migrations. No new tables. No new columns. Everything 7F renders is already in the database (per the design doc, the gap analysis was done in 7D Checkpoint 1 and the data model is sufficient for the K-family card patterns). If you find yourself wanting to add a column, stop and flag it.
5. **Reference wireframes by state ID.** When the prompt says "see K3rrr" or "match F1++++," open `frigo_phase_7f_wireframes.html` and look at that specific state. The wireframes are the source of truth for visual layout. Functional requirements are in this prompt.
6. **The locked baseline is pass 6 (Krrr family + F1++++).** Earlier passes (K1-K5, K1r-K5r, K1rr-K5rr, F1+, F1+++) are visible in the wireframe artifact but marked superseded. Do not implement them. The pass 6 states are the build target.
7. **Decisions D41-D46 are locked.** They live in `PHASE_7F_DESIGN_DECISIONS.md`. Read them before you write any code. If you have a question about why something is the way it is, the answer is probably in the rationale section of one of those decisions.
8. **Wireframe-only states are NOT in scope.** Several states in the artifact are marked `◇ wireframe only · deferred` — these are documented design targets for future phases (7I, eater rating sub-phase, etc.) but are explicitly NOT in 7F build. Specifically: G4rr-b grouped meal pattern, F1e+ eater rating UI, H2 standalone-dish-with-meal-context byline, and the flip-card concept. Do not implement these.

---

## Context — what already exists

7F builds on the data and service layer that 7D shipped. Before you write any new code, you need to understand what's already in place.

**The meal model is built and stable.** Per Model 1 in `PHASE_7_SOCIAL_FEED.md`: meals are `posts` rows with `post_type='meal'`. Multi-dish meals use `parent_meal_id` on dish posts plus the `dish_courses` junction table. Multi-cook attribution uses `post_participants` (post-level, with role: host/sous_chef/ate_with) and `meal_participants` (meal-level RSVP). Per-meal photos use `meal_photos`. The `mealService.ts` file exports `getMealDishes` which returns `DishInMeal[]` with contributor info (username, display name, avatar URL) per dish.

**What 7F adds at the rendering layer:**

- `MealPostCard.tsx` rebuild — new visual baseline (K3rrr from the wireframes)
- `PostCard.tsx` refresh — same visual language as MealPostCard, applied to solo dish posts (K1rrr)
- A new "Highlights" computation that picks one signal per card per viewer
- Static vibe pill rendering from existing recipe `vibe_tags` data
- Description line rendering from the existing `posts.description` field (already in the schema, not currently rendered)
- Recipe-vs-freeform color distinction in dish peek
- Cooked-vs-ate byline rendering using existing `post_participants.role` data
- Detail card rebuild — `MealDetailScreen` modified to render the new F1++++ section structure
- Comment attribution refinement (D41) — meal-level vs dish-level comments rendered as two distinct sections in the detail card
- Per-comment "on [dish name]" chip rendering for dish-level comments

**What 7F does NOT touch:**
- LogCookSheet (the cook logging flow from 7E — already shipped, working)
- The meal handoff flow (Made-Other-Dishes sheet, wrap pattern from 7E)
- Schema (no new columns, no migrations)
- Notifications (D42-refined documents the model but the implementation is deferred)
- The eater rating UI (D43 is wireframed but the implementation is deferred)
- The grouped meal pattern (G4rr-b, locked target, deferred to Phase 7I)

**Required reading before you start.** Read these files end-to-end before touching any code. Do not skim:

- `PHASE_7F_DESIGN_DECISIONS.md` — the design summary doc, especially the decisions D41-D46 and the "Locked design specifications for 7F build" section. Read this FIRST.
- `PHASE_7_SOCIAL_FEED.md` — the active phase doc, especially the Architecture section (Model 1) and the Decisions Log (D21-D40)
- `frigo_phase_7f_wireframes.html` — the wireframe artifact. Open it in a browser. Click through the **Krrr** group (K1rrr through K5rrr) and the **F+** group (F1++++). These are the build targets. Also click through the superseded earlier passes for context, but DO NOT implement them.
- `lib/services/mealService.ts` — the existing meal API, especially `getMealDishes` and `getMealsForFeed`
- `lib/services/postService.ts` — `createDishPost` and `computeMealType`
- `lib/services/postParticipantsService.ts` — the existing participant API and `formatParticipantsText`
- `components/MealPostCard.tsx` — the current implementation you're rebuilding (765 lines)
- `components/PostCard.tsx` — the current solo dish card you're refreshing (822 lines)
- `screens/FeedScreen.tsx` — the feed entry point that renders both cards
- `screens/MealDetailScreen.tsx` — the detail surface you'll modify (1115 lines, scoped for Phase 9 rebuild — your changes here are additive, not a rewrite)
- `lib/services/nutritionService.ts` — for the `getRecipeNutritionBatch` and `aggregateMealNutrition` functions used in detail card nutrition rendering (still used in F1++++)

Read time: probably 90 minutes. Do not shortcut this. The wireframe session went six passes because the design questions were entangled — the Highlights slot, the dish peek color distinction, the cooked-vs-ate byline, the description line, the recipe-vs-freeform handling, and the F1++++ section reorder all depend on each other. Understanding the locked decisions before you start is essential.

---

# CHECKPOINT 1 — Shared visual language + PostCard refresh

**Goal:** Refresh `PostCard.tsx` to the new pass 6 visual language. This establishes the shared chrome that `MealPostCard` will reuse in Checkpoint 2. Keeping it scoped to PostCard first means we can validate the visual baseline against the simpler card before tackling the more complex meal card.

**Wireframe references:** K1rrr (the locked solo dish baseline), K4rrr (photoless variant, look at the photoless rendering pattern). Also reference K2rrr/K3rrr for the dish peek pattern that PostCard does NOT use (single-dish posts have a recipe line instead of a dish peek).

## What to do

### 1.1 — Extract shared layout primitives

Before modifying PostCard, create a small set of shared layout primitives that both PostCard and MealPostCard will use. These can live as helpers in a new file `components/feedCard/sharedCardElements.tsx` or as inline components within PostCard that MealPostCard imports later — your call, but keep them DRY.

The shared primitives:

- **`<CardHeader>`** — avatar (single or stacked), title text, meta line, three-dot menu button. Takes `avatars: AvatarSpec[]`, `title: string`, `meta: string`, `onMenu: () => void`
- **`<DescriptionLine>`** — renders `posts.description` as a paragraph below the title. Returns null when description is empty.
- **`<StatsRow>`** — flexbox row of stat items with labels and values. Takes `stats: StatItem[]` and an optional `highlight: HighlightSpec`. The highlight slot is the 4th position when present.
- **`<HighlightsPill>`** — the Highlights slot content. Takes `text: string` and `viewerSide: boolean` (cream tone when viewer-side, teal when author-side). Width sized to content (not stretched).
- **`<VibePillRow>`** — single vibe pill in its own row below the stats. Takes `vibe: VibeSpec | null`. Returns null when vibe is null.
- **`<EngagementRow>`** — likers stack + likes text + comment count. Takes the existing likeData shape from PostCard/MealPostCard.
- **`<ActionRow>`** — like / comment / share buttons. Takes `onLike`, `onComment`, `onShare` callbacks.

The card chrome (full-width edge-to-edge background, top/bottom borders, no horizontal margin) should be a simple `<View>` wrapper that PostCard and MealPostCard both use.

### 1.2 — Refresh PostCard to use the new chrome

Modify `PostCard.tsx` to use the shared primitives. The new render structure should be:

1. Card wrapper (full-width, white background, top/bottom borders)
2. CardHeader with single avatar
3. Title text (post title or recipe name)
4. Recipe line: "📖 [Recipe Name] · [Author]" (teal link for recipe-backed posts) OR "📖 Freeform · no recipe" (gray text for freeform posts where `recipe_id IS NULL`)
5. DescriptionLine — render `posts.description` as a paragraph (max 3 lines, ellipsis on overflow). Render only if description is set.
6. Hero photo carousel (existing logic from PostCard, adapt to the new card chrome)
7. StatsRow with: Cook time, Rating, Times cooked, and a Highlights slot
8. VibePillRow (conditional — see Highlights/Vibe rules below)
9. EngagementRow
10. ActionRow

**Photoless variant:** When the post has no photos at all, omit the hero photo carousel section entirely. The card is meaningfully shorter.

### 1.3 — Description line truncation rule

`posts.description` could be arbitrarily long. Truncate to ~120 characters with an ellipsis on the feed card. If the user wants to see the full description, they tap into the detail card. Implementation: `numberOfLines={3}` and `ellipsizeMode="tail"` on the Text component, with a reasonable line height that produces ~120 characters across 3 lines on iPhone.

### 1.4 — Recipe vs freeform color distinction

For PostCard (solo posts), the recipe-vs-freeform distinction is in the recipe line, not the dish peek. The recipe line conditional renders as:
- **Recipe-backed** (`post.recipe_id IS NOT NULL`): "📖 [Recipe Name] · [Author Name]" — recipe name in teal (`color: var(--teal-700)`), tappable to navigate to RecipeDetailScreen, author name in gray
- **Freeform** (`post.recipe_id IS NULL` AND `post.dish_name IS NOT NULL`): "📖 Freeform · no recipe" — entire line in gray, not tappable

### 1.5 — Highlights slot rules for solo cards

The Highlights slot in PostCard's stats row picks ONE signal per card per viewer. Logic:

**Author-side signals (compute from existing data):**
- "Cooked N× this month" — when `posts.times_cooked` reflects N cooks of this recipe in the last 30 days for this user, where N >= 3
- "First time cooking this" — when this is the user's first post for this recipe
- "Cooked N× this year" — when N >= 5 in the last year (fallback if monthly threshold not met)

**Viewer-side signals (compute per viewer):**
- "73% in your pantry" — pantry match percentage for the post's recipe (use existing `pantryService` matching). Only render when >= 60%.
- "Matches your cuisine" — when the post's recipe cuisine (if tagged) matches the viewer's most-cooked cuisine. Requires existing cuisine tag data.

**Pick logic:** Viewer signals win when both apply. When no signals apply, the Highlights slot is omitted (3-stat row instead of 4-stat row). Maximum ONE signal per card.

**Implementation note:** The Highlights computation should be a service-layer function (e.g. `postService.computeHighlightForCard(post, viewer)`) that returns `{text: string, viewerSide: boolean} | null`. Components call this and render the result. Don't put the logic inside the component.

**For the first build pass, implement just the author-side signals.** Viewer-side signals require querying the viewer's pantry and cuisine history per card, which is expensive. For Checkpoint 1, render only author-side signals and leave the viewer-side computation as a TODO with a comment pointing at this prompt section. Checkpoint 5 will handle the viewer-side wiring once the basic card is working.

### 1.6 — Vibe pill rules

Render the vibe pill conditionally:
- When the post's recipe has at least one entry in `recipe_vibe_tags` (the existing taxonomy), pick the first tag and render it as a pill below the stats row
- When the post is freeform (no recipe), no vibe pill
- When the post is photoless, no vibe pill (kept tight)
- The pill content is the vibe tag's emoji + label (e.g. "🌿 fresh & light", "🍲 comfort")

**Implementation:** Add a service function `recipeService.getRecipeVibe(recipeId)` that returns the first vibe tag or null. Call it from the post card render. Cache aggressively.

**Personalization is deferred** (per D34/Q36 hybrid b). The pill is static for all viewers. Document this in the code with a comment pointing at P7-40/P7-41 in the deferred work for the eventual personalization layer.

### 1.7 — Test the photoless variant

Create or use an existing test post with no photos. Verify PostCard renders correctly without the hero photo section. Card should be ~250pt tall vs ~440pt for the photo variant.

### 1.8 — DO NOT touch in this checkpoint

- `MealPostCard.tsx` — leave it alone for now. Checkpoint 2 handles it.
- `MealDetailScreen.tsx` — Checkpoint 4.
- `LogCookSheet.tsx` — out of scope for 7F entirely.
- `FeedScreen.tsx` — Checkpoint 5 handles the integration.
- Any service file that handles cook logging or meal handoff.

## Stop, write the SESSION_LOG, wait

Header: "Phase 7F Checkpoint 1 — PostCard refresh + shared visual language"

Include:
- Files touched (list each one)
- The shared primitives you extracted and where they live
- What renders correctly when you test PostCard in the feed
- What's broken or uncertain
- The state of the Highlights computation (author-side only for now, viewer-side TODOs in place)
- Any deviations from the wireframe you had to make and why

---

# CHECKPOINT 2 — MealPostCard rebuild

**Goal:** Rebuild `MealPostCard.tsx` using the shared primitives from Checkpoint 1, plus meal-specific rendering: cooked-vs-ate byline (D45), dish peek with recipe-vs-freeform color distinction, the Highlights slot, vibe pill, "started by X" footnote.

**Wireframe references:** K2rrr (simple meal — the quiet baseline), K3rrr (potluck — most expressive, multi-cook byline), K4rrr (photoless meal). Also reference the K5rrr feed scroll for how the cards look stacked.

## What to do

### 2.1 — Cooked-vs-ate byline rendering (D45)

The meal card header needs to distinguish cooks from eaters:

- **Avatar stack**: query `post_participants` for the meal post, filter to cooks only (`role IN ('host', 'sous_chef')`), apply the visibility filter from D34 (only show participants the viewer follows, with the host always visible on Everyone-visible posts). Render up to 3 avatars in the stack. External cooks (`participant_user_id IS NULL AND external_name IS NOT NULL`) render as initials circles with dashed borders.

- **Header title**: "Cooked by [Name1, Name2 & Name3]" where names are cook names. When more than 3 cooks: "Cooked by [Name1, Name2, Name3 & N others]". Single cook: "[Name]'s meal" or just "[Name]" depending on context.

- **Header sub-line**: "with [Name1 & Name2] · [date] · [meal name]" where the names are EATERS (`role='ate_with'`). When no eaters present, omit the "with X" portion: just "[date] · [meal name]". Eaters get the same visibility filter applied.

- **Single-cook meals**: when there's only one cook and no eaters (the simple K2rrr case), the header reads more naturally as "[Cook Name]'s meal" with the date in the sub-line. Branch the rendering on cook count.

**Implementation note:** The cook-vs-eat split should be done in a service helper, not inline in the component. Add `mealService.getMealParticipantsByRole(mealId)` that returns `{cooks: [...], eaters: [...]}`. Apply visibility filtering inside the helper.

### 2.2 — Dish peek with recipe-vs-freeform color distinction

The dish peek replaces the current per-course grid in MealPostCard. New treatment:

- Single horizontal line of dish names, comma-separated with `·` separators
- Recipe-backed dishes (those with `recipe_id IS NOT NULL`): teal color, faint underline, tappable
- Freeform dishes (`recipe_id IS NULL`, `dish_name IS NOT NULL`): gray text, no underline, not tappable
- When the meal has more than 3 dishes, show the first 3 and append "+N more" in teal as an affordance to expand
- Tapping a recipe-backed dish navigates to that dish's detail (`MealDetailScreen` for now, or the dish post detail route if it exists)

**CSS for the peek:**
```jsx
<Text style={styles.dishPeek}>
  {visibleDishes.map((dish, i) => (
    <React.Fragment key={dish.id}>
      {i > 0 && <Text style={styles.dishSep}> · </Text>}
      <Text 
        style={dish.recipe_id ? styles.dishLink : styles.dishFreeform}
        onPress={dish.recipe_id ? () => onDishPress(dish) : undefined}
      >
        {dish.recipe_title || dish.dish_title}
      </Text>
    </React.Fragment>
  ))}
  {moreCount > 0 && (
    <>
      <Text style={styles.dishSep}> · </Text>
      <Text style={styles.dishMore}>+{moreCount} more</Text>
    </>
  )}
</Text>
```

The styles use the colors from the wireframe artifact's CSS. Reference K3rrr in the artifact for the exact rendering.

### 2.3 — Stats row for meal cards

Meal card stats are different from solo card stats:
- **Dishes** — count of dishes in the meal
- **Cooks** — count of cooks (host + sous_chef roles)
- **Time** — total cook time aggregated from recipe times (when available) or computed from individual dish posts
- **Highlights** — 4th slot, see Highlights rules below

Use the same `<StatsRow>` primitive from Checkpoint 1.

### 2.4 — Highlights slot rules for meal cards

Author-side signals to compute:
- "First potluck" — first meal with 3+ cooks for this user
- "Cooking with [Name] (new)" — first time cooking with this specific person (per `post_participants` history)
- "Biggest meal yet" — most dishes in any meal for this host
- "First [Cuisine] meal" — first meal of a specific cuisine (when cuisine tags are aggregated across the meal's dishes)

Viewer-side signals (deferred to Checkpoint 5 wiring):
- "73% of ingredients in your pantry" — aggregate pantry match across the meal's dishes
- "Matches your usual cuisine" — when the meal's primary cuisine matches the viewer's most-cooked cuisine

Same pick logic as solo cards: viewer signals win when both apply, omit slot when no signals apply.

**For Checkpoint 2, implement only the author-side signals.** Viewer-side wiring is in Checkpoint 5.

### 2.5 — Vibe pill for meal cards

Compute the meal's vibe by aggregating across its dishes:
- Get all `recipe_vibe_tags` for the meal's recipe-backed dishes
- Pick the most common tag across all dishes
- When tied, pick alphabetically (deterministic)
- When no recipe-backed dishes have vibe tags, omit the vibe pill
- Photoless meals: no vibe pill

Add `mealService.computeMealVibe(mealId)` that returns the chosen vibe or null.

### 2.6 — "Started by X" footnote

Below the engagement row but above the action row, render a small italic line: "started by [Host Display Name] · [N people invited]" where N is the count of `meal_participants` rows.

This is intentionally quiet — it acknowledges the meal originator without making them the headline. Per D45 and Q33-c.

Style: `font-size: 10px`, `color: var(--text-tertiary)`, `font-style: italic`, no border, just a small line of text.

### 2.7 — Photoless meal variant

When the meal post has no `meal_photos` AND none of its dishes have photos, omit the hero photo section entirely. Card is meaningfully shorter (~250pt vs ~440-520pt). All other elements (header, title, description, dish peek, stats, engagement, actions) still render.

### 2.8 — Meal photo source

For 7F's K-family rendering (single-meal-card mode), the hero photo carousel should source photos in this priority:
1. Photos from `meal_photos` table (the multi-uploader bucket) — these are the meal-level photos, the right "highlight" content for the meal-summary surface
2. If no `meal_photos`, fall back to dish photos from the meal's dish posts (existing behavior)
3. If neither, photoless variant

This is a partial implementation of D46 (two-level photo model). The full split (meal photos in header, dish photos in sub-cards) lands with G4rr-b in Phase 7I. For 7F, we just need the meal-summary card to prefer meal_photos when they exist.

### 2.9 — DO NOT touch

- `LogCookSheet.tsx` photo upload UI — the per-photo "tag as dish photo" toggle is deferred (P7-39).
- `MealDetailScreen.tsx` — Checkpoint 4.

## Stop, write the SESSION_LOG, wait

Header: "Phase 7F Checkpoint 2 — MealPostCard rebuild"

Include:
- Cooked-vs-ate byline rendering, including how single-cook vs multi-cook branches
- Dish peek implementation, including how the recipe-vs-freeform color works in real card rendering
- Highlights slot logic (author-side only for now)
- Vibe pill computation
- Photoless variant
- Meal photo source priority (meal_photos first, fall back to dish photos)
- Anything you had to deviate from in the wireframes and why

---

# CHECKPOINT 3 — Highlights computation service + comment attribution model

**Goal:** Build the service-layer functions for the Highlights pill content (extending the placeholders from Checkpoints 1 and 2) and implement the comment attribution model from D41 (the data shape, not yet the detail card render — that's Checkpoint 4).

## What to do

### 3.1 — Implement the full Highlights computation service

Promote the placeholder functions from Checkpoints 1 and 2 into a real service: `lib/services/highlightsService.ts`.

**Required exports:**

```typescript
export interface Highlight {
  text: string;
  viewerSide: boolean; // true for viewer-side, false for author-side
  signal: string;     // internal identifier for which signal won (for analytics/debugging)
}

export async function computeHighlightForSoloPost(
  post: Post, 
  viewerId: string
): Promise<Highlight | null>;

export async function computeHighlightForMealPost(
  meal: MealWithDetails,
  viewerId: string
): Promise<Highlight | null>;

export async function computeHighlightsListForDetailCard(
  postOrMealId: string,
  viewerId: string
): Promise<{ author: Highlight[]; viewer: Highlight[] }>;
```

The detail card needs the FULL list of highlights (not just the top one), split into author and viewer arrays per D43/ζ. The feed card just needs the single top highlight.

### 3.2 — Author-side signal computation

For solo posts:
- **"Cooked N× this month"**: query `posts WHERE recipe_id = X AND user_id = Y AND created_at > (now() - 30 days)`. Count. If >= 3, signal is `cooked_n_this_month` with text formatted from N.
- **"First time cooking this"**: query `posts WHERE recipe_id = X AND user_id = Y AND created_at < this_post.created_at`. If zero, signal is `first_cook` with text "First time cooking this".
- **"Cooked N× this year"**: similar to monthly but 365 days. Fallback if monthly doesn't fire.

For meal posts:
- **"First potluck"**: query `posts JOIN post_participants WHERE post_type='meal' AND host=Y AND distinct_cook_count >= 3 AND created_at < this_meal.created_at`. If zero, signal is `first_potluck`.
- **"Cooking with [Name] (new)"**: for each cook in the meal who isn't the host, check whether host has cooked with this cook before. The first co-cook the host has never cooked with becomes the signal text "Cooking with [Name] (new)".
- **"Biggest meal yet"**: query for the host's previous meal with the max dish count. If this meal has more dishes, signal is `biggest_meal_yet`.
- **"First [Cuisine] meal"**: aggregate cuisine tags across the meal's recipe-backed dishes. If the dominant cuisine has never appeared in any of the host's previous meals, signal is `first_cuisine` with text "First [Cuisine] meal".

**Picking ONE signal**: when multiple author signals apply, pick by specificity. Order of preference:
1. `cooking_with_new` (most specific to this meal)
2. `first_potluck` (specific milestone)
3. `biggest_meal_yet` (specific milestone)
4. `first_cuisine` (specific milestone)
5. `first_cook` (general first)
6. `cooked_n_this_month` (general repetition)

### 3.3 — Viewer-side signal computation

For BOTH solo and meal posts:

- **"X% in your pantry"**: use the existing `pantryService` to compute ingredient match between the post's recipe(s) and the viewer's active pantry. Render only when >= 60%. Text is "[N]% in your pantry".
- **"Matches your cuisine"**: query the viewer's most-cooked cuisine (`recipes.cuisine_tag` aggregated across viewer's `posts`). When the post's recipe cuisine (or meal's primary cuisine) matches, signal is `cuisine_match` with text "Matches your usual cuisine".

**Picking ONE viewer signal**: pantry match wins when both apply (more specific, more actionable).

### 3.4 — Cross-cutting pick rule

When BOTH author and viewer signals apply for a single card:
- **Viewer signal wins.** It's more relevant to the reader.
- The detail card still shows BOTH (author signals in the Highlights section, viewer signals in the For You section, per D43/ζ).

### 3.5 — Wire the service into PostCard and MealPostCard

Replace the Checkpoint 1/2 placeholders with real calls. The card components call `computeHighlightForSoloPost` or `computeHighlightForMealPost` during their data load and pass the result to the `<HighlightsPill>` primitive.

**Performance concern:** computing highlights per card per viewer is expensive when done at scroll time. For 7F:
- Compute highlights inside the existing `loadDishPosts` and `getMealsForFeed` queries — batch the computation across the page of posts being loaded
- Cache results per `post_id × viewer_id` for the session (in-memory map in the service, cleared on viewer change)
- Don't compute for posts that are off-screen — if FeedScreen uses a virtualized list, only compute for visible items

If the implementation gets complicated, it's OK to do a simpler version in 7F and document the optimization as a follow-up. But the cards MUST render the Highlights pill correctly even if the computation is naive.

### 3.6 — Comment attribution model (D41)

The data shape: comments can attach to either a meal post (`post_type='meal'`) or a dish post (`post_type='dish'`). Both kinds use the same comments table — attribution is by `post_id`.

This is already supported by the schema. No migration needed. The work in 7F is the SERVICE-LAYER queries that surface comments correctly, plus the detail card rendering in Checkpoint 4.

Add to `commentsService.ts` (or wherever comments live, possibly `postService.ts`):

```typescript
export interface CommentsForMeal {
  mealLevel: Comment[];        // comments where post_id = meal_id
  dishLevel: DishLevelComment[]; // comments grouped by dish_id with dish metadata
}

export interface DishLevelComment extends Comment {
  dish_id: string;
  dish_title: string;
}

export async function getCommentsForMeal(mealId: string): Promise<CommentsForMeal>;
```

The `getCommentsForMeal` function:
1. Query comments where `post_id = mealId` → these are meal-level
2. Query the meal's dish posts via `dish_courses`
3. For each dish, query comments where `post_id = dish_post_id`
4. Return both arrays

For solo dish posts (no parent meal), comments are simply queried by `post_id = dish_post_id`. No grouping needed.

### 3.7 — Visibility filter audit

The cooked-vs-ate byline split (D45) interacts with the visibility filter (D34). Audit both `loadDishPosts` and `getMealsForFeed` in `mealService.ts` to ensure the visibility filter still applies correctly after the byline split.

Specifically: when the viewer doesn't follow ANY participant in a meal (cook OR eater), the meal post should not appear in their feed for `visibility='followers'` posts. This matches the existing rule. Confirm the cooked-vs-ate byline doesn't accidentally bypass the check.

### 3.8 — DO NOT touch

- `MealDetailScreen.tsx` — Checkpoint 4 implements the comment attribution rendering.
- `LogCookSheet.tsx` — out of scope.

## Stop, write the SESSION_LOG, wait

Header: "Phase 7F Checkpoint 3 — Highlights service + comment attribution model"

Include:
- The full Highlights service implementation
- Performance notes on the per-card computation
- Comment attribution service additions
- Visibility filter audit results
- Any signals that didn't compute correctly and why

---

# CHECKPOINT 4 — MealDetailScreen rebuild (F1++++ section structure)

**Goal:** Modify `MealDetailScreen.tsx` to render the new F1++++ section structure: title section first, then dishes, then Highlights, then For You, then comment sections. Per the locked design doc and the F1plus4 wireframe state.

**Important context:** `MealDetailScreen.tsx` is 1115 lines and is scoped for a full rebuild in Phase 9. Your changes here are ADDITIVE — you're updating the section order and adding new sections, not rewriting the screen. Preserve all existing functionality (RSVP, host controls, photo gallery, dish editing).

**Wireframe references:** F1plus4 (the locked detail card baseline). Compare against the earlier F1plus3 and F1plusr to see what changed in pass 6.

## What to do

### 4.1 — Section order change

Current `MealDetailScreen` section order (approximate):
1. Hero photo
2. Meal title + sub
3. Stats
4. Dishes
5. Photos
6. Participants
7. Comments
8. Actions

New section order per F1++++:
1. Hero photo (unchanged)
2. Title section: meal title + sub + description + 4-stat row + vibe pill + "started by X" footnote
3. **Dishes section** (moved up — content first)
4. **Highlights section** (NEW — author signals from `computeHighlightsListForDetailCard`)
5. **For You section** (NEW — viewer signals, cream-toned, with privacy framing)
6. **Comments on this meal** (NEW — meal-level comments per D41)
7. **Comments on individual dishes** (NEW — dish-level comments with per-comment "on [dish name]" chips per D41)
8. Photos (existing — unchanged in this checkpoint)
9. Participants (existing — unchanged)

The Photos and Participants sections stay where they are at the bottom for now. They'll be reorganized in Phase 9.

### 4.2 — Title section changes

Add to the existing title section:
- **Description** (`posts.description`) rendered as a paragraph below the meal sub-line
- **4-stat row**: Dishes / Cooks / Time / Rating (rating is the new addition — average across rated dishes)
- **Vibe pill** (single, below the stats row)
- **"Started by [Host Name] · [N people invited]" footnote** (italic, gray, small)

### 4.3 — Dishes section (move existing, no logic changes)

Move the existing dishes rendering up to position 3. No changes to the dish row rendering itself in this checkpoint. The course grouping (Mains, Sides, etc.) stays. The per-dish ratings, photos, and contributor avatars stay.

### 4.4 — Highlights section (NEW)

Render the author-side highlights from `computeHighlightsListForDetailCard`. Layout per F1plus4:

- Section title: "Highlights · [N]"
- For each highlight: a sentence pill (using the existing `<HighlightsPill>` primitive) followed by an em-dash and a gray description text on the same line
- Compact: pill + em-dash + description on one line per item
- When no author highlights apply, omit the section entirely

Example renders:
- "🔥 First potluck — first meal with 3+ cooks"
- "👥 Cooking with Mary — first time cooking with this person"

The description text comes from the highlight signal — each signal maps to a description string. Add a `getHighlightDescription(signal: string): string` helper.

### 4.5 — For You section (NEW)

Render the viewer-side highlights from `computeHighlightsListForDetailCard`. Layout per F1plus4:

- Section background: cream tone (`#faf7ee`)
- Section title: "For you" in cream/brown tone (`color: #7a6a3e`)
- Sub-line: "Personal to you · the cook does not see this · color provisional" (italic, smaller, cream tone)
- Each viewer highlight: pill + em-dash + description on one line, same compact treatment as Highlights
- When no viewer highlights apply, omit the section entirely

The "color provisional" note in the sub-line is intentional — the cream tone is flagged for revisit. Leave the note in until the design system pass picks a final color.

**Privacy enforcement:** The For You section content is computed from `computeHighlightsListForDetailCard` which already filters viewer-side signals to the viewer only. Double-check that the meal host viewing their own meal does NOT see a For You section (since the signals are about THEM as the cook, not them as a viewer of someone else's content). The logic should be: if `viewerId === host_id`, the viewer-side computation returns an empty array.

### 4.6 — Comments on this meal section (NEW)

Render meal-level comments from `getCommentsForMeal(mealId).mealLevel`. Layout:

- Section title: "Comments on this meal · [N]"
- Each comment: avatar + name + relative time + comment text
- Compose input at the bottom: "Add a comment on this meal..." text input that, when submitted, creates a comment with `post_id = mealId`

When there are zero meal-level comments, still show the section with the compose input and "No comments yet" placeholder text. The compose surface should be available even when empty.

### 4.7 — Comments on individual dishes section (NEW)

Render dish-level comments from `getCommentsForMeal(mealId).dishLevel`. Layout:

- Section title: "Comments on individual dishes · [N total across all dishes]"
- Each comment: avatar + name + relative time + a small teal chip "on [dish name]" + comment text
- The chip styling: `font-size: 10px`, teal background, teal text, rounded
- No compose input here — to comment on a specific dish, the user taps the dish row in the Dishes section above (which navigates to the dish detail or opens an inline composer scoped to that dish — pick the simpler one and document)

When there are zero dish-level comments, omit the section entirely.

### 4.8 — @-mention rendering (display only, not parsing)

For 7F, @-mentions in comments render as styled text (teal color, slight emphasis) but the parser is deferred. The render rule:
- If a comment text contains `@username`, render it as a teal Text span
- Don't try to validate the username against real users in 7F
- Don't try to ping the user — the notification system isn't built yet

This is purely visual. Document with a comment pointing at P7-36 in the deferred work.

### 4.9 — Preserve existing functionality

DO NOT remove or break:
- RSVP UI (existing meal_participants render)
- Host controls (transfer host, remove participant)
- Photo gallery (existing meal_photos render, separate from the hero)
- Dish editing (the existing dish-row tap → edit affordances)
- Add Dish button
- Meal editing (title, time, location)

Add the new sections, move the dishes section up, but leave everything else intact.

## Stop, write the SESSION_LOG, wait

Header: "Phase 7F Checkpoint 4 — MealDetailScreen F1++++ rebuild"

Include:
- New section order, with screenshots or descriptions of each section's render
- Highlights and For You sections rendering correctly with real data
- Comment attribution sections (meal-level + dish-level) rendering correctly
- Privacy enforcement for the For You section (host doesn't see it on their own meal)
- @-mention display rendering
- Confirmation that all existing functionality (RSVP, host controls, photo gallery, dish editing) still works

---

# CHECKPOINT 5 — Integration, viewer-side wiring, visibility audit, manual test pass

**Goal:** Wire everything together. Implement the deferred viewer-side Highlights computation. Audit FeedScreen for the visibility filter interaction with the cooked-vs-ate byline. Run a comprehensive manual test pass.

## What to do

### 5.1 — Wire viewer-side Highlights into PostCard and MealPostCard

In Checkpoints 1 and 2, the Highlights computation only handled author-side signals. Now wire in the viewer-side signals:
- Pantry % match (from `pantryService`)
- Cuisine match (from cooking history)

Use the cross-cutting pick rule: viewer signals win when both author and viewer apply.

Make sure the PostCard and MealPostCard components correctly render viewer-side signals with the cream tone (vs author-side teal tone).

### 5.2 — Performance pass on Highlights computation

The Highlights service computes per-card per-viewer signals. This is the most expensive new work in 7F. Profile the feed scroll:
- How long does it take to load 20 cards with full Highlights computation?
- Are queries batched?
- Are results cached for the session?

If the load takes more than ~500ms for 20 cards, optimize. Caching is the cheapest win — store `{post_id × viewer_id → highlight}` in an in-memory map for the session, cleared when viewer changes.

If the load is too slow even with caching, fall back to a simpler computation: only compute for the visible (in-viewport) cards, and add a placeholder for off-screen cards that fills in as they scroll into view.

### 5.3 — Visibility filter audit (D34 + D45 interaction)

Run an end-to-end test: log in as a viewer who doesn't follow any participants in a private/followers-only meal. Confirm the meal does NOT appear in the feed.

Then test a meal where the viewer follows ONE cook (but not eaters or other cooks). Confirm:
- The meal DOES appear in the feed (because the viewer follows a participant)
- The byline correctly shows only the cook the viewer follows + collapses others
- The "Cooked by" / "with X" structure handles the partial visibility correctly

This is the most likely place for D34/D45 interaction bugs. Test thoroughly.

### 5.4 — FeedScreen integration

In `FeedScreen.tsx`, ensure both `loadDishPosts` and `getMealsForFeed`:
- Apply the visibility filter consistently
- Trigger Highlights computation for the loaded posts
- Pass the computed Highlights through to PostCard and MealPostCard via props
- Handle the empty-Highlights case (no slot rendered)

Update the `renderFeedItem` function to pass the new props correctly.

### 5.5 — Manual test pass — required scenarios

Run through each of these scenarios manually and confirm correct rendering:

1. **Solo dish post, recipe-backed, with photos** — should render as K1rrr. Highlights pill if applicable. Vibe pill if recipe has tags. Description if set.
2. **Solo dish post, freeform** — should render with "📖 Freeform · no recipe" recipe line. No vibe pill (no recipe to source from).
3. **Solo dish post, photoless** — should render as K1rrr without the photo section. ~250pt tall.
4. **Single-cook meal with 2 recipe-backed dishes** — should render as K2rrr. Dish peek shows both dishes in teal underlined.
5. **Single-cook meal with 1 recipe + 1 freeform dish** — dish peek shows recipe in teal, freeform in gray.
6. **Multi-cook meal (potluck) with 3 cooks + 2 eaters** — should render as K3rrr. Header shows "Cooked by X, Y & Z" with subline "with A & B · ...". Avatar stack = cooks only.
7. **Multi-cook meal with external guest** — external guest renders with dashed-border avatar in the stack.
8. **Photoless meal** — should render as K4rrr without the hero photo.
9. **Big meal (6 cooks, 8 dishes)** — header collapses to "Cooked by X, Y, Z & 3 others." Dish peek shows first 3 + "+5 more."
10. **Tap into a meal card → meal detail card** — should render F1++++ section structure. Dishes immediately after stats. Highlights and For You below dishes. Two comment sections at bottom.
11. **Tap into a solo dish from the dish peek** — should navigate to the dish post detail (or RecipeDetailScreen if that's the current route).
12. **Comment on a meal from the meal card** — comment should attach to the meal post itself, not to a specific dish.
13. **Comment on a dish from the meal detail card → dish row** — comment should attach to the dish post, with the "on [dish name]" chip rendering correctly.
14. **Viewer-side Highlights** — verify pantry % renders for posts where the viewer's pantry matches >= 60%. Verify it does NOT render for posts where the viewer is the cook (no recommending your own cooking to yourself).
15. **Privacy: host viewing own meal detail** — confirm the For You section is empty/hidden when the viewer is the meal host.

### 5.6 — Visual regression check

Compare against the wireframe states:
- K1rrr / K2rrr / K3rrr / K4rrr / K5rrr — feed cards
- F1plus4 — detail card
- Use side-by-side screenshots if helpful

Note any visual deviations from the wireframes and document why.

### 5.7 — DO NOT touch

- LogCookSheet
- Cook handoff flows
- Schema
- Any deferred work item from the design doc (eater rating, G4rr-b, etc.)

## Stop, write the SESSION_LOG, wait for sign-off

Header: "Phase 7F Checkpoint 5 — Integration + viewer-side + manual test"

Include:
- Viewer-side Highlights implementation
- Performance numbers from the feed scroll profile
- Visibility filter test results (especially the D34/D45 interaction)
- Manual test pass results for all 15 scenarios — pass/fail with notes
- Visual regression observations
- Open questions, bugs found, anything Tom should review before declaring 7F shipped

---

## Decisions referenced in this prompt

This prompt references the following decisions. They are locked. Do not try to relitigate them — if something seems wrong, flag it in the SESSION_LOG and stop.

- **D24** — Highlight photo model (per-post, one designated highlight)
- **D28** — Engagement attaches to dishes by default (refined by D41)
- **D34** — Global Followers default + contextual visibility rules + two-layer host visibility
- **D41** — Comment attribution: dual-attached, context-determined
- **D43** — Eater ratings: schema α, privacy ζ, orthogonal to yas chefs (deferred build)
- **D44** — M3 architecture deferred, G4rr-b locked target for 7I
- **D45** — Cooked-vs-ate byline split
- **D46** — Two-level photo model (meal photos + dish photos)

Plus the philosophy (c) framing and the locked Pass 6 wireframe states (Krrr family + F1++++).

---

## Wireframe-only states · DO NOT IMPLEMENT

The following states from the wireframe artifact are locked TARGETS for future phases but are explicitly NOT in 7F build scope:

- **G4rr-b** (grouped meal pattern) — Phase 7I (scope expanded)
- **F1e+** and **F1ec** (eater rating UI) — Future eater-ratings sub-phase
- **H2** (standalone-dish-with-meal-context byline) — Phase 7I (depends on G4rr-b)
- **A1r2** flip-card concept — Parked, no specific phase

If you find yourself implementing any of these, stop. They are deferred per the design doc. Build only the K-family cards and F1++++ detail.

---

## Final notes

The wireframe session ran six passes because the questions were entangled. The locked baseline is the result of working through those entanglements explicitly. If you read this prompt and feel like a decision is wrong, the right move is to flag it in the SESSION_LOG, not to "fix" it in code. Tom can then decide whether to relitigate.

The biggest risk in 7F is **regression in the existing feed**. PostCard and MealPostCard are load-bearing — they're what users see first when they open the app. Test thoroughly at each checkpoint. If anything in the current feed breaks while you're refactoring, stop and flag it.

Read the design doc. Read the wireframes. Then build.

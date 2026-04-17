# Phase 7I Checkpoint 7 — Cleanup + Deletion

**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 7 of 7 (final)

**Prior work:**
- **Checkpoints 1 through 6 (+ fix passes):** all complete and verified. The full cook-post-centric feed is live: CookCard, FeedScreen rewrite, CookDetailScreen (L6) with 14 content blocks + 6 editing items, MealEventDetailScreen (L7) with 8 content blocks + eater_ratings + 9 editing items, D49/D50/D51 decisions captured, navigation rewired.
- **This is the final Phase 7I checkpoint.** After this, Phase 7I is formally closed and the next work is 7G (historical cook logging) or 7H (My Posts in You tab).

**This is a single-pass checkpoint.** No Option Z pause needed — the work is entirely deletion and documentation. No new screens, no new services, no schema changes, no editing affordances. Estimated: 1 session.

**Required reading before starting:**

1. This prompt in full
2. `docs/PHASE_7I_MASTER_PLAN.md` — the Checkpoint 7 section
3. `docs/FRIGO_ARCHITECTURE.md` — the file you'll update
4. `docs/SESSION_LOG.md` — skim the Checkpoint 4-6 entries to understand which components replaced which

---

## Goal

Delete deprecated components and files that were orphaned by Checkpoints 3-6. Remove the dev-only test harness. Clean up the `PostType` union. Audit the chef page (AuthorView). Update `FRIGO_ARCHITECTURE.md` to reflect the new component structure. Remove the temporary `console.warn` instrumentation from Checkpoint 5 Fix Pass #2 and Checkpoint 6 if it's noisy (CC's judgment — see Sub-section 7.6). Leave the codebase clean for Phase 7G/7H/7N/7M.

---

## Sub-section 7.1 — Delete deprecated feed card components

These files were orphaned when Checkpoint 4 rewrote FeedScreen to use CookCard + groupingPrimitives. They are no longer imported by any screen or component in the active render path.

**Before deleting each file, verify it's truly orphaned:**

```bash
grep -rn "from.*PostCard\|import.*PostCard" screens/ components/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v _Phase7ITestHarness
```

Run the equivalent grep for each file below. If any active (non-test-harness, non-deprecated) file still imports the component, do NOT delete — document the reference in SESSION_LOG and skip that file.

**Files to delete (if orphaned):**

1. `components/PostCard.tsx` — replaced by `components/feedCard/CookCard.tsx` in Checkpoint 3
2. `components/MealPostCard.tsx` — replaced by `components/feedCard/groupingPrimitives.tsx` (NestedMealEventGroup) in Checkpoint 3.5
3. `components/LinkedPostsGroup.tsx` — replaced by `components/feedCard/groupingPrimitives.tsx` (LinkedCookStack, SharedRecipeLinkedGroup) in Checkpoint 3.5

**Also check and potentially delete:**

4. `components/PostActionMenu.tsx` — if it's only referenced by PostCard or MealPostCard and not by any active screen. If CookDetailScreen or MealEventDetailScreen import it, leave it.
5. Any other file that ONLY existed to support the deprecated components and has zero active references. Use your judgment — grep first, delete if safe, skip if uncertain.

**Do NOT delete:**
- `components/feedCard/sharedCardElements.tsx` — still active
- `components/feedCard/CookCard.tsx` — still active
- `components/feedCard/groupingPrimitives.tsx` — still active
- Any file in `lib/services/` — services are consumed by multiple surfaces
- `screens/MealDetailScreen.tsx` — see Sub-section 7.2

---

## Sub-section 7.2 — Handle legacy MealDetailScreen

`screens/MealDetailScreen.tsx` was NOT replaced by MealEventDetailScreen in the FeedStack — Checkpoint 6 created a new file and rewired FeedScreen's navigation. But MealDetailScreen may still be referenced by other screens outside the feed (e.g., `MyMealsScreen`, `MealCalendarView`, or meal-related flows in the Meals tab).

**Audit:**

```bash
grep -rn "MealDetail[^S]" screens/ components/ App.tsx --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v SESSION_LOG | grep -v PROMPT
```

(The `[^S]` excludes `MealDetailScreen` from matching `MealEventDetailScreen`.)

**Three possible outcomes:**

**(a) No active references outside FeedScreen** (which was already rewired in Checkpoint 6). Safe to delete the file and remove its route from `App.tsx`. Do this.

**(b) References exist in Meals tab or other screens.** Do NOT delete. Instead:
- Add a comment at the top of `MealDetailScreen.tsx`: `// DEPRECATED: Checkpoint 6 replaced this with MealEventDetailScreen for feed navigation. This file is still referenced by [list the referencing files]. Remove after those screens are migrated.`
- Document the references in SESSION_LOG so Tom knows what still needs migration.

**(c) References exist but they're in files that are themselves deprecated.** Delete both.

---

## Sub-section 7.3 — Remove test harness + flask debug button

**Delete:**
- `screens/_Phase7ITestHarness.tsx` — the dev-only visual verification screen created in Checkpoint 3. Its purpose (verifying L1-L5 wireframe states against synthetic data) is fulfilled.

**Remove from App.tsx:**
- The `Phase7ITestHarness` import
- The `Phase7ITestHarness: undefined` entry from `FeedStackParamList`
- The `<FeedStack.Screen name="Phase7ITestHarness" .../>` registration

**Remove from FeedScreen.tsx:**
- The flask debug button (`🧪`) in the header that navigates to Phase7ITestHarness. Grep for `Phase7ITestHarness` or `🧪` in FeedScreen to find it. Remove the `TouchableOpacity` and its navigation handler. Leave the surrounding header layout intact.

**Verify after removal:** the feed header renders correctly without the flask button. The remaining header elements (profile icon, search icon, pencil icon, logo, DMs icon, notifications icon) should redistribute into the available space without layout shift.

---

## Sub-section 7.4 — PostType union cleanup

The `PostType` union (or equivalent type/enum) currently includes `'meal'` as a value. All `posts` rows that previously had `post_type='meal'` were migrated to `'meal_event'` in Checkpoint 1. The `'meal'` value is no longer written by any code path and should not exist in the database.

**Find the PostType definition:**

```bash
grep -rn "PostType\|post_type.*meal\|'meal'" lib/types/ lib/services/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v 'meal_event' | grep -v 'meal_type' | grep -v 'meal_time' | grep -v 'meal_location' | grep -v 'parent_meal'
```

**Remove `'meal'` from the union** (or enum, or wherever it's defined). If the type is used in a discriminated union or switch statement, ensure removing the `'meal'` branch doesn't create a TypeScript error — the `'meal_event'` branch should handle all current cases.

**Check for any runtime code** that still references `post_type === 'meal'` (as opposed to `'meal_event'`). Any remaining references are stale and should be updated to `'meal_event'` or removed:

```bash
grep -rn "'meal'" lib/ screens/ components/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v 'meal_event' | grep -v 'meal_type' | grep -v 'meal_time' | grep -v 'meal_location' | grep -v 'parent_meal' | grep -v 'meal_photos' | grep -v 'meal_plan' | grep -v 'meal_status' | grep -v 'meal_id' | grep -v 'meal_dish'
```

This grep is intentionally aggressive with exclusions to focus on bare `'meal'` string literals that aren't part of compound column/table names. Review each hit and update or remove as appropriate.

---

## Sub-section 7.5 — Chef page audit (AuthorView)

CookCard's `onChefPress` and CookDetailScreen's recipe-line chef tap both navigate to `AuthorView`. MealEventDetailScreen's "Hosted by" chip and attendee rows navigate to `AuthorView`. The `AuthorView` screen should exist and work.

**Audit:**

1. Verify `AuthorView` is registered in a navigator (grep `App.tsx` for `AuthorView`).
2. Verify the screen file exists and renders something meaningful (not a placeholder).
3. If `AuthorView` is broken, missing, or renders an empty screen, build a minimal version:
   - Takes `{ chefName: string }` as a route param
   - Shows the chef's name as a header
   - Lists their recipes (query `recipes` table by `chef_name = chefName`)
   - Each recipe row is tappable → RecipeDetail
   - No styling polish needed — functional is sufficient
4. If `AuthorView` exists and works, just confirm in SESSION_LOG and move on.

**Time-box:** if building a minimal AuthorView takes more than 30 minutes, skip it. Add a deferred item capturing "AuthorView screen is broken/missing, needs build" and move on. The taps will still navigate (they just land on a broken/empty screen until it's fixed).

---

## Sub-section 7.6 — Console.warn instrumentation cleanup (CC's judgment)

Checkpoint 5 Fix Pass #2 added `console.warn` instrumentation to all 6 CookDetailScreen overflow menu handlers + useFocusEffect. Checkpoint 6 added the same to all 9 MealEventDetailScreen handlers.

**Decision:** these warns were added for dogfooding visibility during the testing period. Now that both screens are verified and shipping, the instrumentation may be noisy in Metro during normal use.

**CC's choice:**
- **(a) Remove all `console.warn` instrumentation** from both screens. Clean Metro output. The downside is losing visibility if future bugs surface in the editing flows.
- **(b) Downgrade `console.warn` to `console.log`** so they don't trigger LogBox but are still visible in Metro's raw output. Middle ground.
- **(c) Leave as-is.** They're harmless and useful for debugging. The noise is acceptable during pre-F&F testing.

**My lean is (c) — leave as-is.** Tom is still actively testing and dogfooding. The warns are prefixed with `[CookDetailScreen]` and `[MealEventDetailScreen]` so they're filterable. Remove them when 7M replaces the overflow menus with the unified EditPostScreen.

CC should pick whichever option feels right and document the choice in SESSION_LOG. No wrong answer.

---

## Sub-section 7.7 — Update FRIGO_ARCHITECTURE.md

Update the architecture doc to reflect the current state of the codebase after Phase 7I. This is documentation work, not code.

**Sections to update or add:**

1. **Feed card components** — document the new structure:
   - `components/feedCard/CookCard.tsx` — CookCard (outer) + CookCardInner (wrapper-less, reused by linked groups)
   - `components/feedCard/groupingPrimitives.tsx` — MealEventPrehead, CookPartnerPrehead, MealEventGroupHeader, LinkedCookStack, SharedRecipeLinkedGroup, NestedMealEventGroup
   - `components/feedCard/sharedCardElements.tsx` — CardWrapper, CardHeader, PhotoCarousel (with onError + scrollToIndex), NoPhotoPlaceholder, RecipeLine, DescriptionLine, StatsRow, VibePillRow, EngagementRow, ActionRow, HighlightsPill
   - Note that PostCard, MealPostCard, LinkedPostsGroup are deleted (if they were in Sub-section 7.1)

2. **Screens** — add the two new screens:
   - `screens/CookDetailScreen.tsx` — L6, reached from CookCard tap, 14 content blocks, narrow-scope editing (6 overflow menu items, scaffolding for 7M)
   - `screens/MealEventDetailScreen.tsx` — L7, reached from meal event prehead/group header tap, 8 content blocks, host editing (6 items) + attendee editing (3 items), eater_ratings wiring

3. **Services** — add new services:
   - `lib/services/cookCardDataService.ts` — transformToCookCardData, fetchSingleCookCardData, fetchCookCardDataBatch
   - `lib/services/eaterRatingsService.ts` — getEaterRatingsForMeal, upsertEaterRating

4. **Schema** — note the `eater_ratings` table under the Social domain

5. **Data flow** — update the feed data flow to reflect the new pipeline: loadDishPosts → transformToCookCardData → buildFeedGroups → renderFeedItem dispatch (4 group types) → CookCard / LinkedCookStack / SharedRecipeLinkedGroup / NestedMealEventGroup

6. **Navigation** — document the key nav routes:
   - Feed → CookDetail (via CookCard tap, `{ postId, photoIndex? }`)
   - Feed → MealEventDetail (via prehead/group header tap, `{ mealEventId }`)
   - CookDetail → RecipeDetail (via recipe line tap)
   - CookDetail → EditMedia (via overflow menu)
   - CookDetail → CommentsList (via comment tap-through)
   - MealEventDetail → CookDetail (via dish row tap)
   - MealEventDetail → CommentsList (via event comment tap-through)

7. **Decisions** — reference D47 (cook-post-centric model), D48 (shared-recipe merge), D49 (same-author collapse, not yet built), D50 (no-image state), D51 (meal-event engagement via existing infrastructure)

**Keep the update focused.** Don't rewrite the entire architecture doc — just add/modify the sections relevant to Phase 7I's changes. If a section doesn't exist for something you need to document, add it. If a section exists but is stale, update it.

---

## Sub-section 7.8 — Remove temporary console.warn instrumentation from FeedScreen

FeedScreen has leftover `console.time`/`console.timeEnd` pairs from the Checkpoint 4 feed timing instrumentation. These were kept through Checkpoints 5 and 6 for diagnostic purposes. With Phase 7I closing, they can be removed.

**However:** if you chose option (c) in Sub-section 7.6 (leave CookDetailScreen/MealEventDetailScreen warns as-is), then also leave FeedScreen's timing instrumentation as-is for consistency. Only remove FeedScreen's instrumentation if you removed the detail screen instrumentation in 7.6.

The `[FEED_CAP_TELEMETRY]` log can stay regardless — it's a one-liner that fires once per feed load and is useful for monitoring feed size growth over time.

---

## Sub-section 7.9 — SESSION_LOG + closeout

Write a SESSION_LOG entry titled `2026-04-15 — Phase 7I Checkpoint 7 — Cleanup + Deletion`. Include:

- **Files deleted** — list each with the reason (orphaned by which checkpoint)
- **Files NOT deleted** (and why) — especially MealDetailScreen if it has active references
- **PostType union cleanup** — which file, what changed, any stale references found
- **Test harness removal** — confirm flask button gone, header layout intact
- **AuthorView audit** — exists and works, or built a minimal version, or deferred
- **Console.warn decision** — which option chosen and why
- **FRIGO_ARCHITECTURE.md update** — summary of sections added/modified
- **Grep verification** — TypeScript compiles, no stale imports of deleted files remain
- **Phase 7I closeout statement:**

```
Phase 7I is formally complete. All 7 checkpoints (1, 2, 3, 3.5, 4, 4.5, 5, 6, 7) plus 3 fix passes shipped. The cook-post-centric feed model (D47) is fully implemented: CookCard feed cards, CookDetailScreen (L6), MealEventDetailScreen (L7), shared-recipe merge (D48), no-image handling (D50), meal-event engagement (D51), eater_ratings (D43), and narrow-scope editing scaffolding for both detail screens. Deprecated components deleted. Test harness removed. Architecture doc updated. Next: 7G (historical cook logging) or 7H (My Posts in You tab).
```

Then HARD STOP. Do NOT start 7G, 7H, 7N, or 7M. Wait for Tom's review.

---

## What this checkpoint does NOT include

- **D49 renderer** — deferred to its own focused checkpoint
- **Phase 7N polish** (carousel peek, inline photos, title in header, keyboard fix, etc.)
- **Phase 7M full editing** (EditPostScreen)
- **Any new screens, services, or schema changes**
- **Any changes to CookCard, groupingPrimitives, sharedCardElements, CookDetailScreen, MealEventDetailScreen** — these are all stable and should not be touched in a cleanup pass

---

## Files you are expected to touch

- `components/PostCard.tsx` — **delete** (if orphaned)
- `components/MealPostCard.tsx` — **delete** (if orphaned)
- `components/LinkedPostsGroup.tsx` — **delete** (if orphaned)
- `components/PostActionMenu.tsx` — **delete** (if orphaned, see 7.1)
- `screens/_Phase7ITestHarness.tsx` — **delete**
- `screens/MealDetailScreen.tsx` — **delete or annotate** (see 7.2)
- `screens/FeedScreen.tsx` — remove flask button + optionally remove timing instrumentation
- `App.tsx` — remove test harness route, potentially remove MealDetail route
- `lib/types/feed.ts` or wherever `PostType` is defined — remove `'meal'` value
- `docs/FRIGO_ARCHITECTURE.md` — update
- `docs/SESSION_LOG.md` — write Checkpoint 7 entry

**Files you should NOT touch:**
- `components/feedCard/CookCard.tsx`
- `components/feedCard/groupingPrimitives.tsx`
- `components/feedCard/sharedCardElements.tsx`
- `screens/CookDetailScreen.tsx`
- `screens/MealEventDetailScreen.tsx`
- `lib/services/cookCardDataService.ts`
- `lib/services/eaterRatingsService.ts`
- `lib/services/mealService.ts`
- `lib/services/postService.ts`
- `lib/services/postParticipantsService.ts`
- Any DDL or schema changes

---

## Verification

1. **TypeScript compiles cleanly.** `npx tsc --noEmit` — zero new errors from Checkpoint 7's deletions.
2. **No stale imports of deleted files.** Grep for each deleted filename across the entire `screens/` and `components/` directories. Zero matches (excluding SESSION_LOG, prompts, and comments).
3. **Feed still loads.** Cold-launch the app, go to the feed tab. No crashes, no missing component errors.
4. **CookDetailScreen still works.** Tap a cook card, verify the detail screen loads.
5. **MealEventDetailScreen still works.** Tap a meal event prehead, verify the detail screen loads.
6. **Flask button is gone.** The feed header no longer shows the 🧪 icon.
7. **AuthorView works.** Tap a chef name in a recipe line or a host chip — verify it navigates somewhere sensible.
8. **`FRIGO_ARCHITECTURE.md` is updated.** New components, screens, services, and data flow documented.

---

## Hard stop

After all verification passes and the SESSION_LOG entry is written with the Phase 7I closeout statement, STOP. Do NOT start any post-7I work. Wait for Tom's review.

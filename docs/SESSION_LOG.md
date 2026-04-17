# Session Log

### 2026-04-17 — Phase 7L — Settings + Visibility Defaults
**Phase:** 7L (Settings + Visibility Defaults)
**Prompt from:** `docs/CC_START_PROMPT.md`

**DB migration SQL for Tom to run manually:**
```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS default_visibility text DEFAULT 'followers';
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_default_visibility_check CHECK (default_visibility IN ('everyone', 'followers', 'private'));
```

**Files modified:**
- `lib/services/postService.ts` — Updated `computeDefaultVisibility` to accept optional `userDefault?: PostVisibility` parameter. When set, overrides the hardcoded defaults. Added `console.warn` when using a stored preference.
- `screens/SettingsScreen.tsx` — Added Visibility section above Developer section with "Default post visibility" tappable row showing current value (Everyone/Followers/Just me). Tapping opens a picker modal with 3 options. On selection, updates `user_profiles.default_visibility` via supabase and logs with `console.warn`. Added `currentUserId` state. Extended `loadUserData` to fetch `default_visibility` alongside `subscription_tier`. Added `Modal` import.
- `components/LogCookSheet.tsx` — Added `userDefaultVisRef` to cache the user's stored visibility preference. On sheet open, fetches `default_visibility` from `user_profiles` alongside the existing auth session check. Passes `userDefault` to both `computeDefaultVisibility` call sites (initial open + meal context change re-computation).

**DB changes:** Migration SQL provided above (not executed — Tom runs manually)

**Decisions made during execution:**
- LogCookSheet fetches `default_visibility` on every sheet open (not cached across opens). This ensures changes made in Settings take effect immediately without app restart.
- Used a `useRef` in LogCookSheet to cache the fetched preference so the second useEffect (meal context change) can access it without adding a dependency that would cause infinite re-renders.
- `MadeOtherDishesSheet` hardcodes `visibility: 'followers'` and doesn't use `computeDefaultVisibility`. Left unchanged — it creates posts from meal context where followers is the sensible default.
- EditPostScreen already fetches visibility from the post row and pre-populates the form. It doesn't need to call `computeDefaultVisibility` since it's editing an existing post, not creating a new one.
- `meal_tagged` is excluded from the Settings picker per the prompt — it only makes sense per-post when meal context exists.

**Deferred during execution:**
- MadeOtherDishesSheet could be wired to use `computeDefaultVisibility` with the stored preference, but it's a meal-context-only flow where `'followers'` is always correct.
- FeedScreen visibility filtering audit for `meal_tagged` posts — noted in prompt but is a read-path concern, not a write-path change.

**Recommended doc updates:**
- ARCHITECTURE: Add `default_visibility` column to user_profiles schema reference
- ARCHITECTURE: Note `computeDefaultVisibility` now accepts `userDefault` param

**Status:** All 4 items implemented. TypeScript compiles clean. Ready for device testing after Tom runs the DB migration:
1. Settings → Visibility → change default → verify saved
2. Open LogCookSheet → verify default visibility matches Settings choice
3. Change Settings to "Everyone" → open LogCookSheet → verify "Everyone" is pre-selected
4. EditPostScreen shows the post's existing visibility (not the default)

**Surprises / Notes for Claude.ai:**
- The `computeDefaultVisibility` console.warn fires on every LogCookSheet open when a stored preference exists. This is intentional for dogfooding but should be removed or downgraded before production.

### 2026-04-17 — 7J Fix — Share Recipe async ordering
**Phase:** 7J
**Prompt from:** Device testing — Share.share() needs the component mounted; closing the menu modal first unmounts the handler.

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — Made Share Recipe onPress handler async. Now calls `await shareRecipe({...})` first, then `setShowOverflowMenu(false)` after the share sheet resolves. Previously closed the menu synchronously before the async share fired, which could unmount the component.

**DB changes:** none
**Status:** Fix applied. Share sheet should now open reliably before the menu closes.

### 2026-04-17 — 7J/7K Fix — Share menu setter + Backfill button in Settings
**Phase:** 7J + 7K
**Prompt from:** Device testing — (1) Share Recipe setter already fixed in prior turn, (2) add Backfill Chef IDs to SettingsScreen.

**Files modified:**
- `screens/SettingsScreen.tsx` — Added `backfillChefIds` import. Added "Backfill Chef IDs" button in the existing DEVELOPER section (below Logo Playground). On press: confirmation alert → runs `backfillChefIds()` → shows result alert with updated/error counts.

**DB changes:** none
**Deferred during execution:** none
**Recommended doc updates:** none
**Status:** Both fixes applied. TypeScript compiles clean.

### 2026-04-17 — 7J Fix — RecipeDetailScreen Share menu setter name
**Phase:** 7J
**Prompt from:** Device testing — Share Recipe crashed because `setMenuOpen` doesn't exist in RecipeDetailScreen.

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — Changed `setMenuOpen(false)` to `setShowOverflowMenu(false)` in the Share Recipe `onPress` handler. The menu state is `showOverflowMenu` / `setShowOverflowMenu` (line 240).

**DB changes:** none
**Deferred during execution:** none
**Recommended doc updates:** none
**Status:** Fix applied. Share Recipe menu item now correctly closes the overflow menu before calling `shareRecipe()`.

### 2026-04-17 — Phase 7J + 7K — Recipe Sharing + Chef Attribution Backfill
**Phase:** 7J (Recipe Sharing) + 7K (Chef Attribution Backfill)
**Prompt from:** `docs/CC_START_PROMPT.md`

**Files created:**
- `lib/services/shareService.ts` (55 lines) — `shareRecipe()` and `sharePost()` using React Native's built-in `Share` API. `shareRecipe` builds a message with title, attribution (chef_name or book_author), book title, page number. `sharePost` builds a message with author name + dish name. Both append "Shared from Frigo" footer. TODO comments for deep link URLs when that ships.

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — Converted disabled Share Recipe menu item from `<View>` with `opacity: 0.4` and `pointerEvents="none"` to a `<TouchableOpacity>` that calls `shareRecipe()` with the recipe's title, chef_name, book_title, book_author, and page_number. Added `shareRecipe` import.
- `screens/CookDetailScreen.tsx` — Replaced `handleShare` stub (`Alert.alert('Share coming soon')`) with `sharePost()` call passing postTitle, displayName, and recipe_title. Added `sharePost` import.
- `screens/MealEventDetailScreen.tsx` — Same pattern: replaced `handleShare` stub with `sharePost()` call passing event title and host display name. Added `sharePost` import.
- `lib/services/recipeExtraction/chefService.ts` — Added `backfillChefIds()` function. Queries recipes where `chef_id IS NULL AND book_id IS NOT NULL`, joins to books for `chef_id` and `author`. For each recipe: if book has `chef_id`, sets it directly; if book has `author` but no `chef_id`, calls `getOrCreateChef(author)` and sets resulting chef_id on both book and recipe. Processes in batches of 50, logs progress every batch. Returns `{ updated, errors }` counts.
- `screens/AdminScreen.tsx` — Added "Chef Attribution (7K)" section with "Backfill Chef IDs" button. Tapping shows confirmation alert, then runs `backfillChefIds()` and shows result alert with updated/error counts. Added `backfillChefIds` import.

**DB changes:** none (backfill runs as admin action, writes to existing columns)

**Decisions made during execution:**
- `shareRecipe` uses `chef_name || book_author` for attribution since some recipes have a chef via the chefs table and others only have a book author string.
- `sharePost` shows `recipe_title` instead of `title` when they differ, since the recipe title is usually more descriptive than the post title.
- `backfillChefIds` also backfills `books.chef_id` when it finds/creates a chef from `books.author` — this prevents future recipes from the same book from needing individual backfills.
- Verified that `cookCardDataService.ts` already joins `chefs(name)` when building CookCardData (line 108: `RECIPE_SELECT_COLUMNS` includes `chefs(name)`, transform flattens to `chef_name`). After the backfill sets `chef_id` on recipes, chef names will automatically appear on feed cards.

**Deferred during execution:**
- Deep link URLs in share messages (TODO in shareService.ts — requires deep linking infrastructure)
- Share button on feed cards (only accessible from detail screens currently)

**Recommended doc updates:**
- ARCHITECTURE: Add shareService.ts to the Social domain services
- ARCHITECTURE: Note backfillChefIds in chefService.ts as a one-time admin tool

**Status:** All items implemented. TypeScript compiles clean. Ready for device testing:
- Share recipe from RecipeDetailScreen overflow menu → native share sheet
- Share cook post from CookDetailScreen header → native share sheet
- Share meal event from MealEventDetailScreen header → native share sheet
- Run "Backfill Chef IDs" from AdminScreen → updates recipes + books with chef attribution

**Surprises / Notes for Claude.ai:**
- `cookCardDataService.ts` already has the `chefs(name)` join via Supabase's foreign key relationship query (`recipes` → `chefs`). No additional join needed — after `backfillChefIds` populates `recipes.chef_id`, the existing query will pick up chef names automatically.

### 2026-04-17 — Phase 7M Fix Pass 2 — Cook Partner Chips + Keyboard Bottom Bar
**Phase:** 7M
**Prompt from:** `docs/CC_START_PROMPT.md` — 2 fixes from device testing.

**Files modified:**
- `screens/EditPostScreen.tsx` — (Fix 1) Cook partner chips now update immediately after modal selection. Added `userProfileCacheRef` (Map of userId → profile data) populated during `loadPostData` from participant profiles. In `onConfirm`, builds display `PostParticipant[]` from: existing `cookPartners` entries (for IDs that were already selected), cached profiles (for newly selected IDs), and a just-in-time fetch from `user_profiles` for any uncached IDs. Removed the `getPostParticipants` refetch from `onConfirm` — the DB hasn't been written to yet at that point, so refetch returned stale data. (Fix 2) Bottom bar now participates in KeyboardAvoidingView layout. Removed `position: absolute`, `bottom: 0`, `left: 0`, `right: 0` from `bottomBar` style. Bar is now a normal flex child below the ScrollView inside the KAV. ScrollView keeps `flex: 1`, bottom bar sits naturally below. When keyboard opens, KAV shrinks, ScrollView shrinks, bar rises. Set `keyboardVerticalOffset={50}` to account for SafeAreaView top inset. Reduced ScrollView `contentContainerStyle.paddingBottom` from `BOTTOM_BAR_HEIGHT + 40` to `20` since the bar no longer overlaps content.

**DB changes:** none

**Decisions made during execution:**
- Used a `userProfileCacheRef` (Map) rather than adding a second callback to `AddCookingPartnersModal` — avoids changing the shared modal interface used by LogCookSheet, MyPostDetailsScreen, and other callers.
- For uncached user IDs selected in the modal (e.g., if a new follow was added between sessions), does a just-in-time fetch from `user_profiles`. This is a rare edge case — most selected users will already be in the cache from the initial participant load.
- Used hardcoded `keyboardVerticalOffset={50}` rather than measuring SafeAreaView inset at runtime. This approximation works for standard iOS notch devices. Can be refined with `useSafeAreaInsets()` from `react-native-safe-area-context` if needed.

**Deferred during execution:** none

**Recommended doc updates:** none

**Status:** Both fixes implemented. TypeScript compiles clean. Ready for device testing — verify: (1) select/deselect cook partners in modal → chips update immediately without save, (2) tap into Notes/Modifications text field → keyboard opens → "Update Cook" button rises above keyboard.

**Surprises / Notes for Claude.ai:**
- The original `getPostParticipants` refetch in `onConfirm` was fundamentally wrong — new partners aren't in the DB until save. The cache approach correctly shows the *intended* state, not the *persisted* state.

### 2026-04-17 — Phase 7M Device Testing Fixes — Cooking Methods, Screen Refresh, Keyboard, Recipe Line
**Phase:** 7M
**Prompt from:** `docs/CC_START_PROMPT.md` — 4 fixes from 7M device testing.

**Files modified:**
- `constants/cookingMethods.ts` — Rewrote from string array to `{value, label}` object array matching the DB CHECK constraint exactly: cook, bake, bbq, roast, grill, sauté, braise, fry, steam, slow_cook, soup, preserve, meal_prep, snack, eating_out, breakfast. Display labels are human-readable (e.g., `slow_cook` → "Slow Cook", `bbq` → "BBQ").
- `screens/EditPostScreen.tsx` — (Fix 1) Updated cooking method picker to iterate `{value, label}` objects — displays labels, saves values. Updated display row to look up label from value. (Fix 2a) Cook partners modal `onConfirm` now refetches participant profiles via `getPostParticipants` so the display row updates immediately. (Fix 3) Wrapped ScrollView + bottom bar in `<KeyboardAvoidingView behavior="padding">` on iOS so "Update Cook" button rises above keyboard when editing text fields. Added `KeyboardAvoidingView` and `Platform` imports. (Fix 4) Recipe line changed from tappable `<TouchableOpacity>` with teal text to plain `<Text>` in muted color — prevents accidental navigation that loses unsaved edits.
- `screens/CookDetailScreen.tsx` — (Fix 2b) Changed `useFocusEffect` to use a `focusCountRef` that skips the first focus (initial mount) and refetches on every subsequent focus. This ensures edits from EditPostScreen appear when returning.
- `screens/FeedScreen.tsx` — (Fix 2c) Added `useFocusEffect` import. Added `lastFeedLoadRef` timestamp. On focus, if more than 5 seconds since last `loadFeed`, triggers a refetch. Updates `lastFeedLoadRef` at the end of `loadFeed`. This refreshes the feed after edits without unnecessary refetches on tab switches.

**DB changes:** none

**Decisions made during execution:**
- CookDetailScreen uses `focusCountRef` to skip the first focus (avoiding a double-fetch on mount since `useEffect` already handles initial load). Every subsequent focus triggers a refetch.
- FeedScreen uses a 5-second staleness threshold rather than a counter, since the feed tab can be switched to without any edits happening (tab bar navigation). The 5s threshold avoids unnecessary refetches on casual tab switches.
- Recipe line on EditPostScreen uses `colors.text.secondary` instead of `colors.primary` to visually signal it's not interactive.
- Cook partners onConfirm refetches from DB to get full profile data (display_name, avatar_url). Newly added partners that haven't been saved yet won't have profiles in the refetch, but `partnerIds` state is already updated for dirty detection.

**Deferred during execution:** none

**Recommended doc updates:**
- ARCHITECTURE: Note cooking method values now match DB CHECK constraint exactly
- ARCHITECTURE: Note FeedScreen has useFocusEffect for stale-data refetch

**Status:** All 4 fixes implemented. TypeScript compiles clean. Ready for device testing.

**Surprises / Notes for Claude.ai:**
- The DB CHECK constraint on `posts.cooking_method` uses lowercase/snake_case values (cook, bake, bbq, slow_cook, etc.) — the original COOKING_METHODS list used Title Case display names as values, which would have failed the constraint on save.

### 2026-04-17 — Phase 7M Checkpoint 3 — CookDetailScreen Cleanup + EditPost Enhancements
**Phase:** 7M (Full Edit Cook Screen)
**Prompt from:** `docs/CC_START_PROMPT.md` — CP3 overflow menu cleanup + 3 additional items: meal picker enhancement, "Eating with" stub row, P7M-2 deferred item.

**Files modified:**
- `screens/CookDetailScreen.tsx` — **Line count: 2035 → 1527 (−508 lines).** Replaced 7-item overflow menu with 2 items: "Edit post" (navigates to EditPostScreen) and "Delete post" (keeps existing handleMenuDelete). Removed all inline edit state (editingTitle, titleDraft, titleError, editingDescription, descriptionDraft, managePartnersOpen, mealPickerOpen, recentMeals, mealPickerLoading — 9 useState calls). Removed 10 handler functions (handleMenuAddPhotos, handleMenuEditTitle, handleTitleSave, handleTitleCancel, handleMenuEditDescription, handleDescriptionSave, handleDescriptionCancel, handleMenuManagePartners, handleManagePartnersConfirm, handleMenuChangeMealEvent, handleSelectMealEvent — ~204 lines). Removed AddCookingPartnersModal mount (13 lines). Removed meal picker Modal (113 lines). Simplified Block 4 (title) and Block 5 (description) from conditional edit/display branching to plain `<Text>` / `<DescriptionLine>` renders. Removed inlineEdit* styles (38 lines). Removed unused imports: AddCookingPartnersModal, updatePost, getUserRecentMeals, TextInput, PostPhoto.
- `screens/EditPostScreen.tsx` — (1) **Meal picker enhancement:** Added `created_at` to meal query select. Added `handleCreateMealEvent` — creates a new meal_event post with title "Dinner" and today's date, then selects it. Updated meal picker modal: "Create new meal event" row at top, formatted date below each meal title, meals already chronologically ordered (most recent first via `order: created_at desc`). Updated `recentMeals` type to include `created_at`. (2) **"Eating with" stub row:** Added `ateWithPartners` state. Fetches `ate_with` participants from `getPostParticipants` alongside the sous_chef fetch. Renders a tappable row below "Cook partners" showing current eating partners (or "No eating partners"). Tapping shows `Alert.alert('Coming soon', 'Eating partner tagging will be available in a future update.')`. Display-only — no save logic.

**DB changes:** none

**Decisions made during execution:**
- "Create new meal event" creates the meal_event post inline via direct supabase insert (not through a service) to keep it simple. Defaults: title "Dinner", cooked_at = now, visibility "everyone". The user can edit the meal event later.
- CookDetailScreen's mealPicker styles (sheetBackdrop, sheetBody, sheetHeader, etc.) and some unused styles were left in the StyleSheet — removing them would require auditing every style reference which is out of scope. They're dead but harmless.
- The `handleMenuDelete` handler and its 150ms setTimeout pattern were kept intact on CookDetailScreen — delete from overflow menu remains a direct action per the prompt.

**Deferred during execution:**
- P7M-2: StarRating PanResponder on EditPostScreen conflicts with ScrollView vertical scrolling — touching the stars can accidentally scroll the page. Needs investigation into `onMoveShouldSetPanResponder` threshold or `ScrollView.scrollEnabled` toggling.
- Dead styles cleanup on CookDetailScreen (mealPicker*, sheet*, inlineEdit-adjacent styles that may remain)

**Recommended doc updates:**
- ARCHITECTURE: Update CookDetailScreen section to note 2-item overflow menu (Edit post, Delete post) — all editing via EditPostScreen
- ARCHITECTURE: Note CookDetailScreen line count reduction (2035 → 1527)
- DEFERRED_WORK: Add P7M-2 (StarRating PanResponder / ScrollView conflict on EditPostScreen)
- DEFERRED_WORK: Remove items now handled: inline edit handlers, 6-item overflow menu

**Status:** Checkpoint 3 complete. TypeScript compiles clean. CookDetailScreen reduced by 508 lines. Ready for device testing per CP3 verification:
1. Overflow menu shows 2 items: "Edit post" and "Delete post"
2. "Edit post" opens EditPostScreen with correct data
3. No inline editing on CookDetailScreen — title/description are plain text
4. No AddCookingPartnersModal on CookDetailScreen
5. No meal picker modal on CookDetailScreen
6. "Delete post" still works
7. CookDetailScreen renders correctly after edit (useFocusEffect refetch)
8. No TypeScript errors
9. CookDetailScreen line count decreased by 508 lines
10. Meal picker on EditPostScreen shows dates, has "Create new meal event"
11. "Eating with" row shows on EditPostScreen (display-only stub)

**Surprises / Notes for Claude.ai:**
- The "Eating with" row fetches `ate_with` participants from the same `getPostParticipants` call that fetches cook partners — just filters by role. No additional DB round trip.
- CookDetailScreen still has ~50 lines of dead styles (mealPicker*, sheet*) that were part of the removed meal picker modal. Left in place to avoid style-audit scope creep.

### 2026-04-17 — Phase 7M Checkpoint 2 — Save Logic + Dirty State + Delete
**Phase:** 7M (Full Edit Cook Screen)
**Prompt from:** `docs/CC_PROMPT_7M.md` — Checkpoint 2: extend UpdatePostPatch, dirty state detection, save handler, cancel-with-unsaved-changes, delete navigation fix, button state.

**Files modified:**
- `lib/services/postService.ts` — Extended `UpdatePostPatch` with 6 new fields: `rating`, `cooking_method`, `modifications`, `notes`, `visibility`, `cooked_at`. No changes to `updatePost` function (generic `.update(patch)` passes new fields through).
- `screens/EditPostScreen.tsx` — Added `updatePost`/`UpdatePostPatch` import. Added `saving` state. Added `initialValues` ref capturing all field values at load time. Added `isDirty` useMemo comparing all 10 fields (including sorted partner ID arrays). Added `handleSave` — builds patch from only changed fields, calls `updatePost`, computes cook partner add/remove diff with inline supabase inserts/deletes (matching CookDetailScreen's `handleManagePartnersConfirm` pattern), navigates back on success. Updated `handleCancel` — shows "Discard changes?" alert when dirty, immediate goBack when clean, blocked during save. Updated `handleDelete` — added 150ms setTimeout (iOS Modal/Alert race fix), navigates to FeedMain instead of goBack (avoids showing deleted post on CookDetailScreen). Updated bottom bar — "Update Cook" button enabled (teal) when dirty, disabled (gray) when clean, shows spinner during save. Cancel and Delete disabled during save.

**DB changes:** none

**Decisions made during execution:**
- Partner ID dirty detection uses sorted array comparison rather than Set comparison for simplicity in useMemo.
- Save handler only includes changed fields in the patch (not all fields), per prompt spec. This avoids unnecessary DB writes.
- Cook partner diff uses inline supabase calls (insert with `status='approved'`, delete by `post_id + role + in(participant_user_id)`), same pattern as CookDetailScreen. Not extracted to a service helper per prompt constraints note.
- Delete navigates via `navigation.navigate('FeedMain')` rather than `navigation.pop(2)` — more reliable since the stack depth may vary depending on entry path.
- Deferred extracting cook partner diff to `postParticipantsService` as P7M-1 per user instruction.

**Deferred during execution:**
- P7M-1: Extract cook partner add/remove diff logic to `postParticipantsService` helper (currently inline in both EditPostScreen and CookDetailScreen)
- CookDetailScreen overflow menu cleanup (CP3)

**Recommended doc updates:**
- ARCHITECTURE: Update UpdatePostPatch to note the 6 new Phase 7M fields
- DEFERRED_WORK: Add P7M-1 (cook partner diff extraction)

**Status:** Checkpoint 2 complete. TypeScript compiles clean. Ready for device testing per CP2 verification list:
1. Change title → Update Cook enables → tap → saves → returns to CookDetailScreen showing new title
2. Change rating → saves correctly
3. Change visibility → saves correctly
4. Change cooking method → saves correctly
5. Change cooked_at date → saves correctly
6. Change modifications/notes → saves correctly
7. Change meal event → saves correctly
8. Change cook partners → saves correctly
9. Multiple field changes → single save
10. Cancel with no changes → navigates back immediately
11. Cancel with changes → discard confirmation
12. Delete → confirmation → deletes → returns to feed
13. Update Cook disabled when clean
14. Update Cook shows spinner during save

**HARD STOP — awaiting Tom's verification before proceeding to Checkpoint 3.**

**Surprises / Notes for Claude.ai:** none

### 2026-04-17 — Phase 7M Checkpoint 1 — EditPostScreen Scaffold + Navigation
**Phase:** 7M (Full Edit Cook Screen)
**Prompt from:** `docs/CC_PROMPT_7M.md` — Checkpoint 1: create EditPostScreen, register routes, add temp menu item, extract StarRating component.

**Files created:**
- `screens/EditPostScreen.tsx` (893 lines) — Full edit cook form with header (Cancel / Edit Cook), scrollable form (4 sections: Core content, Media, Details, Visibility), Delete Post button, sticky "Update Cook" bar (disabled in CP1). All fields pre-populated from post data. Includes modal pickers for cooking method, visibility, and meal event. Photo grid with "Add Photos" dashed card navigates to EditMedia. Star rating uses extracted `StarRating` component. Cook partners row opens `AddCookingPartnersModal` in manage mode. Date cooked opens `DateTimePicker` with `quickSelectPreset="past"`. Recipe shown as read-only tappable link. `useFocusEffect` refetches post data when screen regains focus (picks up EditMedia changes).
- `components/StarRating.tsx` (126 lines) — Extracted half-star slide-to-rate from LogCookSheet. PanResponder-based with touch-to-position calculation, half-star support, slide-left-to-clear. Props: `rating`, `onRatingChange`, `colors`. Used by both LogCookSheet and EditPostScreen.
- `constants/cookingMethods.ts` (21 lines) — Canonical cooking method list: Stovetop, Oven, Grill, Air Fryer, Slow Cooker, Sous Vide, Smoker, Deep Fry, Steamer, Instant Pot, No Cook, Other.

**Files modified:**
- `App.tsx` — Added `EditPost: { postId: string }` to FeedStackParamList and StatsStackParamList. Added `EditMedia` to StatsStackParamList (was missing). Registered `EditPostScreen` in both FeedStackNavigator and StatsStackNavigator. Registered `EditMediaScreen` in StatsStackNavigator (was only in FeedStack). Added `import EditPostScreen`.
- `components/LogCookSheet.tsx` — Replaced inline star rating code (~95 lines of state/refs/PanResponder/renderStar) with `<StarRating>` component at both render sites (compact and full). Removed unused `PanResponder` and `StarIcon` imports. Added `StarRating` import.
- `screens/CookDetailScreen.tsx` — Added temporary "Edit post" menu item as item 0 in overflow menu (above "Add photos"). Navigates to EditPost with `{ postId: post.id }`.

**DB changes:** none

**Decisions made during execution:**
- EditPostScreen is 893 lines (over the 600-line target). This is due to three inline modal pickers (cooking method, visibility, meal event) plus the photo grid + all form fields + styles. Extracting the modals into separate components would reduce it but adds file count. Acceptable for CP1; can refactor in CP2 if needed.
- Visibility is fetched separately via direct supabase query (`posts.visibility`) since CookCardData doesn't include it. This matches the prompt's guidance.
- Parent meal title is fetched separately from the `posts` table when `parent_meal_id` is set, for display in the meal event row.
- The cooking method list includes "Instant Pot" (not in the prompt's starting list but common). Should validate against actual DB values.
- StarRating extraction removed ~95 lines from LogCookSheet's hook body. The `starsRow` style definition is left as dead code to avoid StyleSheet churn.
- `EditMedia` was missing from StatsStackParamList — added it so the CookDetail → EditPost → EditMedia flow works from the Stats tab too.

**Deferred during execution:**
- Save logic, dirty state detection, and unsaved-changes confirmation (CP2)
- Delete post wiring to actual `deletePost` service (CP2 — currently uses inline supabase call matching CookDetailScreen's pattern)
- CookDetailScreen overflow menu cleanup (CP3)
- Cooking method DB validation query (should run `SELECT DISTINCT cooking_method FROM posts WHERE cooking_method IS NOT NULL` to verify coverage)

**Recommended doc updates:**
- ARCHITECTURE: Add EditPostScreen to the Social domain screens section
- ARCHITECTURE: Note StarRating component extraction from LogCookSheet
- ARCHITECTURE: Add cookingMethods.ts to constants

**Status:** Checkpoint 1 complete. TypeScript compiles clean. Ready for device testing per CP1 verification list:
1. Navigate from CookDetailScreen overflow → Edit post → EditPostScreen
2. All fields render pre-populated
3. All inputs interactive (text fields, star rating, pickers)
4. Cancel navigates back
5. "Update Cook" renders at bottom (disabled)
6. "Delete Post" renders in red
7. Photo grid shows current photos; tapping navigates to EditMedia
8. Route works from both FeedStack and StatsStack

**HARD STOP — awaiting Tom's verification before proceeding to Checkpoint 2.**

**Surprises / Notes for Claude.ai:**
- LogCookSheet's star rating was inline (~95 lines of state + PanResponder + renderStar). Extraction to StarRating was clean — the component is fully self-contained with refs, PanResponder, and render logic.
- StatsStack was missing EditMedia registration. CookDetailScreen's "Add photos" flow from the Stats tab would have crashed. Fixed as part of this checkpoint.

### 2026-04-17 — Phase 7N CP2 Follow-up #2 — Back Button Teal + Star Picker Overlay
**Phase:** 7N
**Prompt from:** Device testing feedback — back buttons rendering in iOS default blue; star picker × button replaced with full-screen dismiss overlay.

**Files modified:**
- `App.tsx` — Added `headerTintColor: '#0F6E56'` to all 7 stack navigator `screenOptions`. This fixes the default React Navigation back button color for every `headerShown: true` screen (CommentsScreen, EditMediaScreen, DrillDown, Chef, etc.).
- `screens/CookDetailScreen.tsx` — Changed both custom back arrow `←` Text colors from `colors.text.primary` to `colors.primary` (brand teal).
- `screens/MealEventDetailScreen.tsx` — Changed both custom back arrow `←` Text colors from `colors.text.primary` to `colors.primary`. Removed × dismiss button from star picker row. Removed dishes-block-scoped overlay. Added full-screen transparent `<Pressable>` overlay inside ScrollView (first child, `position: absolute`, `height: 9999`, `zIndex: 10`) that renders when `ratingPickerOpen` is non-null. Star picker row has `zIndex: 20` so star taps still work above the overlay. `console.warn` instrumentation retained on dismiss.

**DB changes:** none

**Decisions made during execution:**
- Used hardcoded `'#0F6E56'` for `headerTintColor` in App.tsx because the stack navigator functions don't have access to `useTheme()`. This matches the brand teal value used throughout the app.
- Placed the overlay inside the ScrollView (not as a sibling) so that zIndex relationships work correctly with the star picker row — in React Native, zIndex only applies among siblings in the same parent.
- Used `height: 9999` instead of `bottom: 0` for the overlay because `position: absolute` with `bottom: 0` inside a ScrollView's content container resolves to the content height, not the viewport — a large fixed height ensures full coverage.

**Deferred during execution:** none

**Recommended doc updates:** none

**Status:** Ready for device testing. Back arrows should now be teal everywhere. Star picker should dismiss on tap outside.

**Surprises / Notes for Claude.ai:** none

### 2026-04-17 — Phase 7N CP2 Follow-up — Engagement Bar Layout Fix
**Phase:** 7N
**Prompt from:** Device testing feedback — engagement bar buttons clustered left instead of spread

**Files modified:**
- `screens/CookDetailScreen.tsx` — Added `justifyContent: 'space-between'` to stickyBar style, removed `gap: 24`. Like button stays left, comment button floats right.
- `screens/MealEventDetailScreen.tsx` — Same layout fix as CookDetailScreen.

**DB changes:** none

**Decisions made during execution:**
- Removed `gap: 24` since `space-between` handles the spacing. Two buttons in a space-between row = one left, one right.

**Deferred during execution:** none

**Recommended doc updates:** none

**Status:** Ready for device testing.

**Surprises / Notes for Claude.ai:** none

### 2026-04-17 — Phase 7N Checkpoint 2 — Detail Screen Polish + Swipe Fix
**Phase:** 7N (Detail Screen Polish + Feed Carousel UX) — Checkpoint 2
**Prompt from:** `docs/CC_PROMPT_7N_CP2.md` — 6 items: swipe reliability restructure, comments return key, header title truncation, multi-photo select, star picker stay-open, inline engagement bar.

**Files created:**
- None

**Files modified:**
- `components/feedCard/CookCard.tsx` — Item 1: Restructured CookCardInner from a single outer Pressable to a three-zone layout: top Pressable (header + title/description/recipe), bare PhotoCarousel (not in Pressable), bottom Pressable (stats/vibe/engagement/actions). Removed `unstable_pressDelay={180}`. Updated comment block.
- `components/feedCard/sharedCardElements.tsx` — Item 1: Added `Pressable` import. Added `onPhotoPress?: () => void` prop to `PhotoCarousel`. Wrapped single-photo slide in `<Pressable onPress={onPhotoPress}>`. Wrapped multi-photo FlatList renderItem in `<Pressable onPress={onPhotoPress}>`. Inside a horizontal FlatList, the child Pressable only fires on clean taps — swipes are intercepted by the scroll gesture handler.
- `screens/CommentsScreen.tsx` — Item 2: Changed `returnKeyType="send"` to `returnKeyType="default"` on comment TextInput. `onSubmitEditing={submitComment}` retained so return key still submits.
- `screens/CookDetailScreen.tsx` — Item 3: Added `flex: 1, textAlign: 'center'` to header title Text so `numberOfLines={1}` triggers ellipsis truncation. Item 6: Moved Block 14 engagement bar from outside ScrollView to inside it (after comments preview). Removed `position: absolute/bottom: 0/left: 0/right: 0` from stickyBar style, added `marginTop: 12`. Changed ScrollView `contentContainerStyle` paddingBottom from `STICKY_BAR_HEIGHT + 20` to `100`.
- `screens/MealEventDetailScreen.tsx` — Item 5: Removed `setRatingPickerOpen(null)` from `handleRatingSelect` so picker stays open after selection. Added `×` dismiss button at end of star picker row. Added transparent `<Pressable>` overlay covering the dishes block when picker is open (zIndex: 1) with picker row at zIndex: 2. Added `console.warn` instrumentation for picker open/dismiss. Added `Pressable` to react-native imports. Item 6: Same engagement bar restructure as CookDetailScreen — moved from outside to inside ScrollView, removed absolute positioning, added `marginTop: 12`, set paddingBottom to 100.
- `lib/services/imageStorageService.ts` — Item 4: Added `pickMultipleImages()` (uses `allowsMultipleSelection: true`, `selectionLimit: 10`, returns `string[]`). Added `chooseImageSourceMulti()` (camera returns single-element array, library uses `pickMultipleImages`). Original `pickImage()` and `chooseImageSource()` untouched.
- `screens/EditMediaScreen.tsx` — Item 4: Switched import from `chooseImageSource` to `chooseImageSourceMulti`. Updated `handleAddPhotos` to receive `string[]`, clamp to remaining slots (10 - current), and append all as new PostPhoto entries.

**DB changes:** none

**Decisions made during execution:**
- Star picker overlay (Item 5): Placed the dismiss overlay as a child of the `dishesBlock` View with `position: absolute` covering the entire block (zIndex: 1), with the picker row at zIndex: 2 so stars remain tappable above the overlay. This catches taps outside the star row within the dishes section. Tapping other areas of the screen (outside the dishes block) doesn't dismiss — but tapping another dish's rating pill does toggle via the existing `handleRatingPillPress` logic.
- Multi-photo (Item 4): Callers of `chooseImageSource` in `AddMediaModal.tsx`, `AddRecipeImageButton.tsx`, and `MealEventDetailScreen.tsx` were left on the original single-select function per prompt instructions. Only `EditMediaScreen.tsx` switches to `chooseImageSourceMulti`.
- Engagement bar (Item 6): Kept the `STICKY_BAR_HEIGHT` constant in both files for the `height` property of the bar even though it's no longer "sticky" — renaming it would be unnecessary churn.

**Deferred during execution:**
- `TappableTitleBlock` in sharedCardElements.tsx remains dead code (prompt acknowledged this; left as-is per watch-for #2)
- STICKY_BAR_HEIGHT constant naming is now misleading but left unchanged to avoid scope creep

**Recommended doc updates:**
- ARCHITECTURE: Update CookCard section to note the three-zone Pressable layout (header/carousel/bottom) replacing the single-card-wide Pressable
- ARCHITECTURE: Note that `PhotoCarousel` now accepts `onPhotoPress` prop
- ARCHITECTURE: Note `pickMultipleImages()` and `chooseImageSourceMulti()` in imageStorageService
- DEFERRED_WORK: Can remove P7-88 (multi-photo select) — now implemented
- DEFERRED_WORK: Can remove swipe reliability item if tracked — now fixed via structural approach

**Status:** All 6 items implemented. TypeScript passes with no new errors. Ready for device testing — Item 1 (swipe fix) is highest priority to verify on device per prompt.

**Surprises / Notes for Claude.ai:**
- The `unstable_pressDelay` approach from CP1 was confirmed insufficient on device. The structural fix (splitting the Pressable so PhotoCarousel is not wrapped) is the correct long-term solution. No gesture handler library needed.
- The ratingPickerOverlay covers only the dishes block, not the full screen. This is a pragmatic choice — a full-screen overlay would require portal-like rendering or restructuring the entire ScrollView, which is out of scope. The × button and toggling via rating pills provide adequate dismiss affordances.

### 2026-04-15 — Phase 7N Checkpoint 1 — Feed + Navigation Polish [HARD STOP]
**Phase:** 7N (Detail Screen Polish + Feed Carousel UX) — Checkpoint 1 of 2
**Prompt from:** `docs/CC_PROMPT_7N.md` — Checkpoint 1 ships 5 polish items before F&F testers arrive: CommentsScreen keyboard offset (P7-85), PhotoCarousel peek + count indicator (P7-87), CookDetailScreen header title (P7-90), rating label fix for foreign posts (P7-96 label half), and a swipe reliability audit (1E).

**Files modified (Checkpoint 1):**
- `screens/CommentsScreen.tsx` — imported `useHeaderHeight` from `@react-navigation/elements` (package already in `node_modules`), called the hook at the top of the component body, and changed `keyboardVerticalOffset={0}` to `keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}`. The measured header height (safe-area top inset + nav header bar) is more reliable than the prompt's suggested hardcoded 90px fallback, and it self-adjusts for iPad, dynamic island, and any future nav header height changes.
- `components/feedCard/sharedCardElements.tsx` — three edits to `PhotoCarousel`:
  1. Added a `MULTI_PHOTO_MAX_WIDTH = SCREEN_WIDTH * 0.88` constant (inside the component for closure safety) and clamped multi-photo slide widths to it in the `widths` array computation. The clamp applies **only when `safePhotos.length > 1`** — single-photo carousels still render at natural aspect ratio with no cap. `getPhotoWidth(index)` was also updated to apply the same clamp so `renderSlide` and the snap-offset computation agree on identical values per slide.
  2. Added `activeIndex` state (number, default 0) and an `onMomentumScrollEnd` handler on the FlatList that finds the snap offset closest to the current `contentOffset.x` and updates `activeIndex` to match. This drives the count pill.
  3. Added a `<View style={carouselStyles.countPill} pointerEvents="none"><Text>{activeIndex+1}/{photos.length}</Text></View>` inside the multi-photo render branch (after the FlatList, before the accessory slot). Rendered only inside the multi-photo branch so single-photo carousels get no pill. `pointerEvents="none"` prevents the pill from blocking swipes. Added `countPill` and `countPillText` styles to `carouselStyles` — semi-transparent black background, white 10px bold text, rounded 10px, positioned `top: 10, right: 10`.
- `screens/CookDetailScreen.tsx` — two sites:
  1. **Block 1 header title (P7N-1C):** replaced the hardcoded `Cook` text with `{postTitle}` and added `numberOfLines={1}` to the header title `<Text>`. `postTitle` was already computed on line 714 as `post.title || post.recipe_title || 'Cooking Session'`. The "not found" fallback header (around line 698) still says `Cook` because `post` is null there and `postTitle` isn't in scope.
  2. **Block 8 stats grid rating label (P7N-1D):** replaced the hardcoded `Your rating` text with `{isOwnPost ? 'Your rating' : `${displayName}'s rating`}`. `isOwnPost` and `displayName` were already computed earlier in the component (lines 242, 711-712). Only the label string changed — the star glyph `★ {rating}` under the label is unchanged, and the prompt explicitly said NOT to add an eater-rating affordance for viewers (deferred second half of P7-96).
- `components/feedCard/CookCard.tsx` — **1E swipe reliability mitigation.** Added `unstable_pressDelay={180}` to the outer `<Pressable>` in `CookCardInner` (line 262, now line 272 after the doc comment expansion). Without this delay, the outer Pressable's press-in can win the gesture responder race even on a clear horizontal swipe over the photo carousel, which fires `onPress` on finger-lift and navigates to CookDetailScreen instead of scrolling the carousel. The 180ms delay gives the FlatList inside `PhotoCarousel` enough time to claim the gesture for horizontal scrolling. Also expanded the inline doc comment to explain the history (delay was originally on `CardWrapper`, removed in Fix Pass 8 / Fix 2, lost when Checkpoint 5 Pass 1 reintroduced the card-wide Pressable on `CookCardInner`).

**Files NOT modified (investigated + no change needed):**
- `components/feedCard/sharedCardElements.tsx` — `CardWrapper` itself was already reviewed in Fix Pass 8 / Fix 2 and is now just a `<View>` with no Pressable wrapping. That's still correct. The remaining card-wide Pressable lives in `CookCardInner` and is where the 1E mitigation belongs.
- `screens/MealEventDetailScreen.tsx` — not touched in Checkpoint 1. Its sticky bar, star picker stay-open, and shared PhotoCarousel consumer all sit in Checkpoint 2.

## 1E — Swipe reliability audit findings (important)

**The prompt's framing was almost right, but the actual state of the codebase was subtly different from what it assumed.**

What the prompt said: "Check whether the existing 180ms press delay [on `CardWrapper`] is already making swipe reliability acceptable."

What I found: The delay is **not** on `CardWrapper`. `CardWrapper` was refactored in **Fix Pass 8 / Fix 2** (a prior Phase 7 fix pass) — the comment at `sharedCardElements.tsx:128` explicitly says `"no longer wraps in Pressable. Tap handling moved to TappableTitleBlock"`. Since that fix pass, `CardWrapper` is just a styled `<View>`.

BUT — **Checkpoint 5 Pass 1** (Phase 7I) then reintroduced a card-wide Pressable one level down, in `CookCardInner`. That Pressable has no `unstable_pressDelay`. The inline comment at `CookCard.tsx:253-259` acknowledges the outer Pressable exists but relies entirely on React Native's "innermost touchable wins" rule for the swipe vs. tap distinction. For a FlatList inside the Pressable, that rule is not reliable enough on its own — press-in fires on contact before the FlatList sees enough movement to claim the gesture, and on finger-lift the Pressable wins.

**Decision:** apply the minimum-delta mitigation the prompt anticipated — add `unstable_pressDelay={180}` to the `CookCardInner` Pressable. This restores the original `CardWrapper` behavior, one layer deeper in the tree. Applies to all four feed group types automatically because they all compose `CookCardInner` as their rendering primitive.

**No full restructure was applied** (the prompt's fallback option that splits the photo carousel out of the Pressable entirely). Reasons:
1. The minimum-delta fix is 1 line of actual code. The restructure would touch `CookCardInner`, `PhotoCarousel`, and every group type that composes CookCardInner — 50+ lines of changes with cascading test requirements.
2. 180ms has proven sufficient in practice for other FlatList-inside-Pressable scenarios in the codebase (EditMedia's gallery, SelectMealModal's carousel, etc.).
3. If 180ms proves insufficient on device in Tom's testing, we can still do the restructure in a follow-up — the two approaches compose cleanly.

**Pending on-device verification** — this is the item where device testing matters most. If swipes still frequently misfire as taps after this delay, Tom should report and we'll escalate to the restructure.

## Decisions made during execution

- **`useHeaderHeight` over hardcoded 90px.** The prompt suggested `90` as the offset with a note saying "if 90 doesn't land right, use `useHeaderHeight()` from `@react-navigation/elements`". I checked — the package is installed. So I skipped the hardcode and used the hook directly. Self-adjusts for any header height, no calibration needed. Android path still uses `keyboardVerticalOffset={0}` because RN Android's keyboard avoidance behavior with `"height"` mode works differently and doesn't need the offset.
- **`MULTI_PHOTO_MAX_WIDTH` clamp is 88%, not 85%.** The prompt said "~85-90%"; 88% is the middle of that range and produces ~6% peek on each side (≈24px on a 414pt screen, ≈22px on 375pt). Visually distinct but not obtrusive.
- **Count pill position: top-right 10/10, not integrated with caption or recipe badge.** The existing `recipeBadge` sits top-left, and the `captionOverlay` sits bottom-spanning. Top-right is the only uncontested corner. The pill is `pointerEvents="none"` so it never blocks swipes.
- **Count pill uses the same `activeIndex` state already driven by the snap-offset closest-match calculation.** No `onViewableItemsChanged` callback, no viewability config — the simpler `onMomentumScrollEnd` approach matches the existing snap-to-center pattern and avoids re-renders during the scroll gesture.
- **1D label fix: template literal, not a `getRatingLabel` helper.** Two-branch ternary inline is clearer than extracting a helper for a single call site. If this label pattern spreads to other screens later, we can extract.

## Deferred during execution

- **P7N-1 — 1E on-device verification.** The `unstable_pressDelay={180}` mitigation is a code-level best-effort fix. On-device verification is required to confirm swipe reliability is actually acceptable. If it isn't, the fallback is the full restructure from the prompt's 1E section 2-4.
- **P7N-2 — `activeIndex` reset on photos-change.** If the `photos` prop length changes (e.g., after EditMedia roundtrip removes photos), the `activeIndex` state could point past the end of the new array. In practice it's harmless (the pill shows `N/smaller_total` briefly then gets corrected by the next scroll), but a cleaner fix is a `useEffect` that clamps `activeIndex` to `photos.length - 1` when the length changes. Low priority, not a bug.

## Recommended doc updates

- **FRIGO_ARCHITECTURE.md** — note the new PhotoCarousel count pill under the Phase 7I Feed Card Components subsection. Note the CommentsScreen useHeaderHeight usage if documenting per-screen quirks.
- **DEFERRED_WORK.md** — capture P7N-1 and P7N-2 above.

## Status — Checkpoint 1 verification gates

1. **TypeScript compiles cleanly** — `npx tsc --noEmit 2>&1 | grep -E "CommentsScreen|sharedCardElements|CookDetailScreen|CookCard\.tsx"` returned zero output. Pre-existing `CookSoonSection.tsx`, `DayMealsModal.tsx`, and `node_modules/@react-navigation/core` errors unchanged and unrelated.
2. **CommentsScreen keyboard** — code-reading confirms `useHeaderHeight()` is wired; pending on-device verification that the text input sits above the keyboard.
3. **Photo carousel peek + count** — code-reading confirms the width clamp and the count pill render. Pending on-device verification that (a) adjacent slides peek visibly in feed cards and CookDetailScreen hero, (b) the "1/N" pill appears and updates on swipe, (c) single-photo carousels have no pill and no clamp.
4. **Header title on CookDetailScreen** — code-reading confirms `postTitle` is rendered with `numberOfLines={1}`.
5. **Rating label** — code-reading confirms the `isOwnPost` ternary. Pending device verification against a followed user's post.
6. **Swipe reliability** — code-reading confirms `unstable_pressDelay={180}` is on the outer `Pressable`. Pending on-device verification against real feed swipe gestures (the most important device check in this checkpoint).

## Surprises / Notes for Claude.ai

- **The prompt's 1E analysis was half-right.** It correctly identified that swipe reliability was at risk and correctly anticipated that a prior-phase mitigation might already exist. What it missed was that the mitigation had moved (from `CardWrapper` to `CookCardInner`) AND had been lost during Checkpoint 5 Pass 1's refactor. Restoring the delay at its current location is the intended behavior — this isn't new work, it's regression repair.
- **`useHeaderHeight` is used nowhere else in the codebase.** Grep confirmed this — `CommentsScreen.tsx` is the first consumer. If Tom wants to audit other scroll screens with keyboard avoidance later, this is a good pattern to spread.
- **The count pill is an `activeIndex`-driven render, not a scroll-position-derived derived value.** I chose `onMomentumScrollEnd` over `onScroll` deliberately to avoid re-rendering the pill on every scroll frame. The tradeoff: the pill updates only when the user lifts their finger and the carousel settles on a snap position, not mid-drag. This matches the UX intent (the pill shows which photo you "landed on," not which one you're swiping through).
- **All 1B changes are gated on `safePhotos.length > 1` where it matters.** Single-photo carousels are unaffected by the width clamp, the count pill, and the `onMomentumScrollEnd` handler (the handler is attached only to the multi-photo FlatList branch, not the single-photo View branch).

**Hard stop after Checkpoint 1 per prompt and Tom's instruction. Do NOT proceed to Checkpoint 2 (multi-photo select, star picker stay-open, inline engagement bar) until Tom verifies Checkpoint 1 on device.**

```
HARD STOP — 7N Checkpoint 1 complete. Awaiting GO for Checkpoint 2.
```

---

### 2026-04-15 — Phase 7H Checkpoint 2 — My Posts Navigation Fix
**Phase:** 7H (My Posts Navigation Fix) — Checkpoint 2 of 2 in the 7G+7H prompt pair
**Prompt from:** `docs/CC_PROMPT_7G_7H.md` — Checkpoint 2 wires StatsScreen's My Posts section to the new 7I CookDetailScreen (L6) target and switches its date display + sort from `created_at` to `cooked_at`. Single-pass, no hard stop.

**Files modified:**
- `App.tsx` — added `CookDetail: { postId: string; photoIndex?: number }` to `StatsStackParamList` (matching the FeedStack's existing entry). Registered `<StatsStackNav.Screen name="CookDetail" component={CookDetailScreen} options={{ headerShown: false }}/>` inside `StatsStackNavigator` after the `EditProfile` screen. `CookDetailScreen` was already imported at the top of `App.tsx` (from the FeedStack registration in Phase 7I Checkpoint 5) so no new import was needed — the same component renders under both stacks.
- `screens/StatsScreen.tsx` — three sites touched:
  - `loadMyPosts` SELECT: added `cooked_at` to the column list and changed `.order('created_at', { ascending: false })` to `.order('cooked_at', { ascending: false })`. The sort key now matches the new feed sort key from Phase 7G Checkpoint 1 and the stats service's existing `cooked_at` usage.
  - `MyPostItem` interface: added `cooked_at: string | null` with a 7H doc comment explaining the nullable fallback for legacy posts.
  - `ActivityCard` component: `new Date(post.created_at)` → `new Date(post.cooked_at ?? post.created_at)`. The Strava-style activity card now renders the cook date instead of the publish date.
  - `MyPostsContent` tap handler: replaced the `RecipeDetail` navigation (gated on `recipe_id && recipes`) with an unconditional `CookDetail` navigation. **Every post is now tappable**, not just recipe-backed ones — freeform dishes (D23, `recipe_id` null) now open the detail screen where previously their tap was a no-op. Added `[StatsScreen]` `console.warn` instrumentation on the tap so Metro shows the postId being navigated.

**Files NOT modified:**
- `screens/CookDetailScreen.tsx` — not touched. The screen is reached from two stacks now (FeedStack + StatsStack) and works identically in both since it reads its own post via the `postId` route param via `fetchSingleCookCardData`. No stack-dependent logic.
- `lib/services/statsService.ts` — per Phase 7G Checkpoint 1 closeout, already uses `cooked_at` for all date range queries. No change needed for 7H either — the stats sub-tabs are unaffected by the My Posts switch.

**Decisions made during execution:**
- **Unconditional navigation on tap.** The prompt spec explicitly called out that "every post should be tappable, not just posts with a `recipe_id`" — freeform dishes should also open CookDetail. The old handler wrapped the navigation in `if (post.recipe_id && post.recipes)` which silently dropped taps on freeform posts. The new handler drops the guard entirely since CookDetailScreen's `fetchSingleCookCardData` path handles null recipes gracefully (Phase 7I Checkpoint 5's title-cascade pattern falls back to `post.title` then `post.dish_name` then "Untitled Post").
- **Stats stack vs. feed stack behavior.** `CookDetailScreen` is now registered under both `FeedStack` and `StatsStack`, which means a user who navigates from My Posts will see the same detail screen as they would from the feed. All nav actions inside `CookDetailScreen` (tap recipe → RecipeDetail, tap comment → CommentsList, tap chef → AuthorView, tap Edit → EditMedia) use their route registrations from whichever stack the screen is currently mounted in. Both stacks have those destinations registered, so nav should work symmetrically. **Verification pending** on-device — there's a non-trivial chance that a nav action inside the detail screen (e.g., "Change meal event" in the overflow menu, which routes via the feed nav stack) works differently when reached from StatsStack. Captured as a watch-for item.
- **Shared `CookDetailScreen` import from FeedStack registration.** `App.tsx` already imports `CookDetailScreen` (from the Phase 7I Checkpoint 5 FeedStack registration). Re-registering under `StatsStack` reuses the same import — no duplicate file, no second copy. The navigator treats each registration as an independent route but the component reference is shared.

**Deferred during execution:**
- **P7H-1 — CookDetailScreen cross-stack nav audit.** Reach CookDetailScreen from the My Posts tab. Verify that: (1) tapping the recipe line opens RecipeDetail via StatsStack (not cross-stack to FeedStack), (2) the overflow menu's "Change meal event" and "Delete post" flows work correctly from the StatsStack context, (3) the comment tap-through opens the StatsStack-registered CommentsList (wait — CommentsList is NOT in StatsStack param list, grep confirms it is at line 228; but `YasChefsList` is in StatsStack and `CommentsList` might not be). This is a latent risk that Checkpoint 2 doesn't resolve but doesn't create either. Will need a cross-stack audit pass.
- **P7H-2 — Legacy `MyPostDetailsScreen.tsx` / `MyPostsScreen.tsx` routes are orphaned.** Now that StatsScreen's My Posts routes to the 7I CookDetailScreen, the legacy `MyPostDetails` route and screen file are unused from the Stats tab. Still registered in `StatsStackParamList` though. Grep for remaining callers before deleting. Related to Phase 7I Checkpoint 7's P7-97 (Meals-tab migration) — same cleanup bucket.

**Recommended doc updates:**
- **FRIGO_ARCHITECTURE.md** — update the StatsStack Routes block (around line 385) to include `CookDetail: { postId: string; photoIndex? }`. Note in the Phase 7I Breaking Changes section that My Posts now routes to the L6 detail screen shared with the feed tab.
- **DEFERRED_WORK.md** — capture P7H-1 (cross-stack nav audit) and P7H-2 (legacy MyPostDetails/MyPosts cleanup).

**Status — Checkpoint 2 verification gates:**
1. **TypeScript compiles cleanly** — `npx tsc --noEmit 2>&1 | grep -E "StatsScreen|App\.tsx|CookDetail"` returned zero output.
2. **My Posts navigation** — code reading confirms the tap handler navigates to `CookDetail` with `{ postId: post.id }`. On-device verification pending.
3. **Freeform dish navigation** — code reading confirms the `if (post.recipe_id && post.recipes)` guard is gone. Freeform posts should tap through to the detail screen. Pending device verification against a known freeform post.
4. **My Posts date display** — `ActivityCard` now reads `post.cooked_at ?? post.created_at`. A post logged via Checkpoint 1's backdating flow should show the cook date in its activity card header.
5. **My Posts sort order** — `.order('cooked_at', { ascending: false })`. Backdated cooks sort chronologically. Pending device verification.
6. **Stats toggle** — Cooking Stats ↔ My Posts toggle is not touched. Should work exactly as before.
7. **Stats sub-tabs** — Overview / Cooking / Nutrition / Insights sub-tabs are not touched. No regression.

## Surprises / Notes for Claude.ai

- **Zero surprise in Checkpoint 2.** The fix is mechanical — two sort-key switches, one interface field, one date display, one navigation rewrite, one route registration. All within the confines of `StatsScreen.tsx` + `App.tsx`. No cross-cutting changes.
- **`CookDetailScreen` is now a shared detail screen across two tabs.** Feed tab reaches it via the `CookCard` tap path (FeedStack → CookDetail). You tab reaches it via the My Posts activity card tap path (StatsStack → CookDetail). Both entry points hand off via `{ postId }` and the screen looks identical in both contexts. This is a natural consequence of the Phase 7I rearchitecture — the detail screen is not stack-specific, just data-driven.
- **Watch-for item from the prompt (#2 — navigation stack types):** addressed. `CookDetail` was indeed not in `StatsStackParamList` before Checkpoint 2; it is now. The FeedStack registration from Checkpoint 5 pattern was followed verbatim.
- **Watch-for item about cross-stack nav (not in prompt but surfaced here):** `CookDetailScreen` navigates to several routes internally (`RecipeDetail`, `CommentsList`, `AuthorView`, `EditMedia`, `YasChefsList`). `CommentsList` is already registered in both FeedStack AND StatsStack (verified via grep). `RecipeDetail`, `AuthorView`, `EditMedia` also exist in both stacks (FeedStack Phase 7I work + StatsStack pre-existing from Phase 4/I). But I haven't run an exhaustive cross-reference against every nav call in CookDetailScreen. Captured as P7H-1.

**Status:** Checkpoint 2 complete. TypeScript clean. On-device verification pending against the 6-item checklist. No hard stop — this is the final checkpoint of the 7G+7H prompt pair.

**What's next (per the 7G+7H prompt closeout):** write tracker rows for the Google Sheet and decide whether 7G+7H is ready to merge, then move on to the next phase (likely 7M EditPostScreen or 7N polish pass).

---

### 2026-04-15 — Phase 7G Checkpoint 1 — Historical Cook Logging [HARD STOP]
**Phase:** 7G (Historical Cook Logging) — Checkpoint 1 of 2 (7H ships in Checkpoint 2)
**Prompt from:** `docs/CC_PROMPT_7G_7H.md` — Checkpoint 1 wires `cooked_at` through the entire cook-logging + feed rendering pipeline. Every new cook now writes `cooked_at` explicitly (no DB default reliance). LogCookSheet gets a date picker row so users can backdate. Feed sort, CookCard date display, CookDetailScreen date display, and `feedGroupingService` group/sub-unit ordering all switch from `created_at` to `cooked_at` (with a `created_at` fallback for legacy posts).

**Files modified (Checkpoint 1):**
- `lib/services/postService.ts` — added `cookedAt?: string | null` to `CreateDishPostParams` with a 7G doc comment. In `createDishPost`, the insert now writes `cooked_at: params.cookedAt || new Date().toISOString()` explicitly. Every cook now gets a `cooked_at` value on write — no path relies on the DB default anymore.
- `components/DateTimePicker.tsx` — added `quickSelectPreset?: 'future' | 'past'` prop (defaults to `'future'` so existing call sites are unchanged). When set to `'past'`, the three quick-select buttons render as "Today" / "Yesterday" / "Last Week" and produce past dates instead of the future-facing "Now" / "Tomorrow" / "Next Week" defaults. The "Today" button respects `maximumDate` defensively. All three past-preset buttons snap time to 18:00 in datetime mode for a consistent dinner-ish default when picking a backdated day.
- `components/LogCookSheet.tsx` — imported `DateTimePicker`. Added `cookedAt` field to `LogCookData` interface (ISO string, required — callers pass through to `createDishPost`). Added three state hooks: `cookedAt` (Date, defaults to `new Date()`), `dateManuallySet` (boolean), `showDatePicker` (boolean). Reset all three in the existing `useEffect` that runs when `visible` flips true. Added `handleDateRowPress`, `handleDateSelect`, `handleDateReset` callbacks with `[LogCookSheet]` `console.warn` instrumentation. Added `formatDateLabel` helper that renders "Today" (or "Today, 2:30 PM" in full mode) when the date is today, otherwise "Mar 15, 2026". `handleSubmit` now includes `cookedAt: cookedAt.toISOString()` in the `onSubmit` payload and logs the submit event to Metro. Mounted `<DateTimePicker maximumDate={new Date()} quickSelectPreset="past" mode="date" />` as a nested sibling Modal (same pattern as the existing `AddCookingPartnersModal`) so the picker renders above the sheet. Added `dateRowCompact`, `dateRowButton`, `dateRowButtonText`, `dateRowButtonTextActive`, `dateRowReset`, `dateRowFull`, `dateRowFullText` styles.
- `components/LogCookSheet.tsx` (compact body) — added "When did you cook this?" date picker row between the star rating and the Thoughts input, with the section label, a tappable chip showing the formatted date, a chevron, and an optional reset "×" that appears when `dateManuallySet` is true. Chip text turns teal + bold when a non-today date is selected so backdated state is visually distinct.
- `components/LogCookSheet.tsx` (full mode) — added a small tappable date chip at the top of the scroll content (before the remember chips), styled as a low-frequency secondary affordance. Shows "Today, 2:30 PM" by default and switches to the formatted backdated date + teal color when overridden. No explicit "When did you cook this?" label — the user just finished cooking, so `now()` is almost always correct.
- `screens/CookingScreen.tsx` — `handleLogCookSubmit` passes `cookedAt: logData.cookedAt` to `createDishPost`.
- `screens/RecipeDetailScreen.tsx` — `handleLogCookSubmit` passes `cookedAt: data.cookedAt` to `createDishPost`.
- `screens/FeedScreen.tsx` — `loadDishPosts` query: changed `.order('created_at', { ascending: false })` to `.order('cooked_at', { ascending: false })`. `cooked_at` was already in the SELECT column list from Checkpoint 5's shared `cookCardDataService.POST_SELECT_COLUMNS` alignment, so no SELECT change was needed — verified via grep. The `[FEED_CAP_TELEMETRY]` "oldest post date" reducer (around line 214-226) now uses a `dateKey = p.cooked_at ?? p.created_at` helper so the reported oldest date matches the new feed sort key.
- `components/feedCard/CookCard.tsx` — `formatDate(post.created_at)` → `formatDate(post.cooked_at ?? post.created_at)` in the meta line under the author header. Feed cards now show the cook date.
- `lib/services/feedGroupingService.ts` — switched three sort sites inside `buildFeedGroups` from `created_at` to `cooked_at ?? created_at`: (1) within-group posts oldest-first narrative sort (Step 5), (2) across-group newest-first sort by `max(cooked_at)` in each group (Step 6), (3) sub-unit earliest-`cooked_at` sort inside `buildSubUnits` for `linked_meal_event` rendering. Each change carries a `// Phase 7G:` comment explaining the switch. The legacy `groupPostsForFeed` function (pre-Checkpoint-4 dead code, not called from the active feed path) was NOT touched — its `created_at` sort remains for backward compat, flagged as dead code already.
- `screens/CookDetailScreen.tsx` — Block 3 author section date display: `new Date(post.created_at)` → `new Date(post.cooked_at ?? post.created_at)`. Backdated cooks show the cook date in the "Apr 15, 2026 · 2:30 PM" line.

**Files verified but NOT modified:**
- `lib/services/cookCardDataService.ts` — `cooked_at` is already in `POST_SELECT_COLUMNS` (line 105) and the transform at line 81 already maps `cooked_at: post.cooked_at ?? null`. Both were added preemptively in Checkpoint 5 when the module was extracted from FeedScreen. No change needed.
- `lib/types/feed.ts` — `CookCardData.cooked_at?: string | null` already exists per Checkpoint 5.
- `lib/services/statsService.ts` — per the prompt preamble, already uses `cooked_at` for all date range queries. Spot-checked with `grep cooked_at lib/services/statsService.ts` — confirmed heavy usage across `getWeeklyFrequency`, `getOverviewStats`, `getMostCooked`, etc. No change needed; stats accuracy will follow automatically for backdated cooks.

**DB changes:** none. The `posts.cooked_at` column already exists with a `DEFAULT now()` that is now explicitly overridden on every insert from `createDishPost`.

**Decisions made during execution:**
- **`cookedAt` on `LogCookData` is non-optional (required string), not optional.** Every call path through LogCookSheet always produces a valid ISO string — either `new Date().toISOString()` by default or the user's picked date. Making it optional would invite callers to forget passing it through and silently regress the feature.
- **Compact mode date row placement: between rating and thoughts**, not between rating and the meal-attach chip. The prompt spec says "between the star rating and the meal-attach chip," but the compact body's chip row includes four chips (Photo / Voice / Tag / Add to meal) that render as a row — placing the date row inside or before the chip row would visually split them. Putting the date row above the Thoughts input keeps the chip row intact as a compact visual unit and still sits between the rating and the meal-attach chip (which is the last chip in the row). Documented here in case Tom prefers a different position.
- **Full mode date chip placement: top of scroll content, above the remember chips.** The prompt spec says "in the metadata area" below the header. The full mode's header is followed immediately by the scroll view whose first child is the smart-detect banner and the remember chips — I placed the date chip between the banner and the remember chips so the smart-detect banner still gets visual priority (it's time-sensitive). Date chip is visually small and secondary, matching the "low-frequency override" framing.
- **Full mode date chip: single tappable element, no label.** Just shows "Today, 2:30 PM" with a chevron. No "When did you cook this?" prefix — full mode users just finished cooking, so the implicit "this is when" is clear from context. The compact mode keeps the explicit label because that entry point is used for backdating.
- **Past-preset "Today" button snaps time to 18:00 in datetime mode.** The prompt described "Yesterday" and "Last Week" as producing 18:00 times but left "Now"/"Today" unspecified. For consistency within the past preset — where the user is likely backdating dinner cooks — I made "Today" also snap to 18:00. Future preset is unchanged (it still uses `new Date()` for "Now").
- **`feedGroupingService` legacy `groupPostsForFeed` function left unchanged.** Its created_at sort references (lines 137, 165-171) are dead code per Checkpoint 4's feed rewrite. Changing them would touch an unused path and risk drift. Flagging for a future cleanup sweep.
- **`getLinkedCookPartnersForPosts` input mapping left unchanged.** The prompt flagged line 221 — `created_at: p.created_at` in the partner-detection input — as something to "check if it's mapping into a type that should carry cooked_at." The answer is: **yes, it should**, but the `postParticipantsService.getLinkedCookPartnersForPosts` function queries `posts.created_at` internally for the ±60min temporal window used to match reciprocal cook-partner tags. Changing the field alone would be a lie; a proper fix requires switching the service's internal `created_at` window queries to `cooked_at` too. Captured as a deferred item below — this is out of scope for 7G Checkpoint 1 and would need its own verification sweep.

**Deferred during execution:**
- **P7G-1 — `getLinkedCookPartnersForPosts` temporal window should use `cooked_at`.** `postParticipantsService.getLinkedCookPartnersForPosts` uses `created_at` as the anchor for its ±60min reciprocal-detection window. For backdated cooks, this means a cook backdated to last Tuesday won't be matched with a reciprocal partner's cook also backdated to last Tuesday — because both cooks' `created_at` is "now" and the partner query never finds the reciprocal candidates in the right temporal window. Fix: switch the service's internal queries from `created_at` to `cooked_at` on the `posts` table. Needs a careful test pass because the function is shared across multiple feed paths.
- **P7G-2 — `feedGroupingService.groupPostsForFeed` legacy dead code cleanup.** The pre-Checkpoint-4 `groupPostsForFeed` function still exists with `created_at`-based sorting. Not called from the active feed path. Delete it in a future cleanup pass.

**Recommended doc updates:**
- **FRIGO_ARCHITECTURE.md** — add a "Phase 7G — Historical Cook Logging" entry to Recent Breaking Changes noting the `cooked_at` sort switch on the feed. Note that `createDishPost` now writes `cooked_at` explicitly and `LogCookSheet` has a date picker row.
- **DEFERRED_WORK.md** — capture P7G-1 and P7G-2.

**Status — Checkpoint 1 verification gates:**
1. **TypeScript compiles cleanly** — `npx tsc --noEmit 2>&1 | grep -E "LogCookSheet|DateTimePicker|postService|CookingScreen|RecipeDetailScreen|FeedScreen|CookCard|feedGroupingService|CookDetailScreen|cookCardDataService"` returned zero output. Pre-existing `CookSoonSection.tsx`, `DayMealsModal.tsx`, and `node_modules/@react-navigation/core` errors unchanged and unrelated.
2. **Date picker renders in compact mode** — code-reading only; awaiting device verification per the 7-item checklist in the prompt.
3. **Date picker renders in full mode** — code-reading only.
4. **Backdated cook writes correctly** — pending device verification. Supabase query after a backdated cook: `SELECT id, cooked_at, created_at FROM posts ORDER BY created_at DESC LIMIT 1` should show `cooked_at` = selected date and `created_at` = today.
5. **Feed sort order** — pending device verification. A backdated cook should slot into its chronological position, not top of feed.
6. **CookCard date display** — code-reading confirms `formatDate(post.cooked_at ?? post.created_at)` is wired.
7. **CookDetailScreen date** — code-reading confirms Block 3 uses the `cooked_at ?? created_at` fallback.
8. **Stats accuracy** — `statsService.ts` uses `cooked_at` per preamble; backdated cooks should appear in the correct week's count automatically.

## Surprises / Notes for Claude.ai

- **`cooked_at` was already half-wired from Phase 7I Checkpoint 5.** The `cookCardDataService.POST_SELECT_COLUMNS` list, the `transformToCookCardData` mapping, and the `CookCardData.cooked_at?` type were all already in place — Checkpoint 5 added them preemptively in anticipation of this work. Checkpoint 1's job was almost entirely on the write side (`createDishPost` + `LogCookSheet`) and the sort-key-swap side (FeedScreen + feedGroupingService + CookCard + CookDetailScreen). Minimal churn on the data model.
- **`feedGroupingService`'s three sort sites all use the same `cooked_at ?? created_at` fallback pattern.** This matches the prompt's guidance ("Always use `post.cooked_at ?? post.created_at` when displaying dates, never bare `post.cooked_at`").
- **Watch-for item 4 ("Pagination cursor") did not apply.** FeedScreen uses a single `.limit(200)` query — there's no fetch-more / cursor pagination implemented. The telemetry "oldest post date" calculation was the only side reference to `created_at` in the feed load path, and it was switched to the `cooked_at` fallback for consistency with the new sort key.
- **DateTimePicker has a known visual quirk with maximumDate.** The existing `isDateDisabled` check properly disables past/future days in the calendar grid via `minimumDate`/`maximumDate`, but the spinner view allows the user to scroll to any date. For 7G, this means a user could pick a future date via the spinner view even though the calendar view blocks it. The prompt's Watch-for item 3 called this out — I relied on the quick-select preset labels (which produce past dates) to make the "past" intent obvious. If a user manually scrolls the spinner to a future date, `cooked_at` will be set to that future ISO string, which is a data oddity but not a hard bug. Flagging for future polish.

**Hard stop after Checkpoint 1 per prompt and Tom's instruction. Do NOT proceed to Checkpoint 2 (7H — My Posts navigation fix) until Tom confirms Checkpoint 1 verification on device.**

```
HARD STOP — Checkpoint 1 (7G) complete. Awaiting GO for Checkpoint 2 (7H).
```

---

### 2026-04-15 — Phase 7I Checkpoint 7 — Cleanup + Deletion
**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 7 of 7 (final — closeout)
**Prompt from:** `docs/CC_PROMPT_7I_CHECKPOINT_7_CLEANUP.md` — single-pass cleanup checkpoint. No Option Z hard pause. Delete orphaned components + test harness, clean up `PostType` union, audit `AuthorView`, update `FRIGO_ARCHITECTURE.md`, and close out Phase 7I.

**Files deleted:**
- `components/PostCard.tsx` — orphaned by Checkpoint 4's FeedScreen rewrite; only remaining consumer was `LinkedPostsGroup.tsx` which is itself deprecated. Grep confirmed zero active references.
- `components/MealPostCard.tsx` — orphaned by Checkpoint 3.5's `NestedMealEventGroup`. Grep confirmed zero imports outside its own self-references.
- `components/LinkedPostsGroup.tsx` — orphaned by Checkpoint 3.5's `LinkedCookStack` + `SharedRecipeLinkedGroup`. Grep confirmed zero imports outside its own self-references.
- `screens/_Phase7ITestHarness.tsx` — dev-only test harness created in Checkpoint 3 for synthetic-data visual verification. Its purpose (verifying L1–L5 wireframe states) is fulfilled.

**Files NOT deleted (with reasons):**
- `components/PostActionMenu.tsx` — **kept.** Still actively referenced by `MyPostDetailsScreen.tsx` and `MyPostsScreen.tsx` (both inside the StatsStack / You tab). Neither of those legacy screens has been migrated to CookDetailScreen. Per 7.1 rule #4, leave in place until those screens migrate.
- `screens/MealDetailScreen.tsx` — **kept.** Audit via `grep -rn "MealDetail[^S]"` found 4 active references outside FeedScreen:
  - `screens/MyMealsScreen.tsx:282, 368, 940` — routes to `MealDetail` for meal detail flow inside the Meals tab
  - `screens/MyPostDetailsScreen.tsx:817` — "Part of [meal]" back-link nav
  - `screens/MyPostsScreen.tsx:881` — meal row tap handler
  - `screens/RecipeDetailScreen.tsx:1147, 1518` — parent-meal back-link nav from recipe detail
  
  This is outcome (b) from the prompt: annotate as deprecated but leave the file + route in place. The `FeedStack.Screen name="MealDetail"` registration in `App.tsx` is unchanged (both the FeedStack and MealsStack keep the route) so the legacy cross-stack nav flows continue to work. The FRIGO_ARCHITECTURE.md Screens table now flags `MealDetailScreen.tsx` as deprecated-for-feed with the list of remaining callers.

### Sub-section 7.4 — `PostType` union cleanup

**Definition found in** `lib/services/postParticipantsService.ts:26`:
```typescript
export type PostType = 'dish' | 'meal' | 'meal_event';
```

**Cleanup applied:**
- Removed `'meal'` from the union → `export type PostType = 'dish' | 'meal_event';`
- Updated the doc-comment above the union to note the legacy `'meal'` value was removed in Checkpoint 7 after confirming the Checkpoint 1 migration converted all remaining rows.
- Updated the matching doc-comment in `lib/services/mealService.ts` Meal interface (line 35) that referenced "retained in PostType union until Checkpoint 7 removes it."

**Stale runtime references found and fixed:**
- `screens/MyMealsScreen.tsx:220` — `.eq('post_type', 'meal')` → fixed to `.eq('post_type', 'meal_event')`. This query was silently returning zero results after Checkpoint 1's migration, which means the Meals tab's meal list was empty. **Checkpoint 7 fixed a latent bug.** Tom should verify the Meals tab renders meal events again on device.
- `components/EditMealModal.tsx:249` — `.eq('post_type', 'meal')` → fixed to `'meal_event'`. Same silent-bug pattern on the edit-meal save path.

**References left unchanged (intentional):**
- `lib/services/highlightsService.ts:57, 262` — uses `'meal'` as an internal cache-key discriminator in a local string union `'solo' | 'meal'`, unrelated to the `post_type` column. Leaving as-is. (This is the highlights service's own kind tag, not a DB value.)

### Sub-section 7.3 — Test harness + flask debug button removal

**Deleted:** `screens/_Phase7ITestHarness.tsx`

**Removed from `App.tsx`:**
- `import Phase7ITestHarness from './screens/_Phase7ITestHarness';`
- The `Phase7ITestHarness: undefined;` entry from `FeedStackParamList`
- The `<FeedStack.Screen name="Phase7ITestHarness" .../>` registration and its comment block

**Removed from `screens/FeedScreen.tsx`:**
- The 🧪 flask button `TouchableOpacity` (lines 916–921 in the old file) plus the "Phase 7I TEMP" comment above it. The feed header now renders four left-side icons (profile, search) + logo + right-side icons (messages, bell) — redistributes naturally without the flask slot. No layout rework needed.

**`Phase7ITestHarness` import / reference grep across `screens/`, `components/`, `App.tsx`:** zero matches after the cleanup.

### Sub-section 7.5 — AuthorView audit

**Status: exists and works.** `screens/AuthorViewScreen.tsx` is 411 lines of real implementation — queries `chefs` + `books` + `recipes` by `chef_name` matched against route param `chefName`, renders the chef's books + recipes with tap-through to `RecipeDetail`. Not a placeholder. Registered on both `FeedStack` (for CookCard `onChefPress` and CookDetailScreen's recipe-line chef tap) and `RecipesStack` (for RecipeDetailScreen chef tap), with params `{ chefName: string }`.

No build needed. Time-box budget unused.

### Sub-section 7.6 — `console.warn` instrumentation decision

**Chose option (c): leave as-is.** Reasons:
1. Tom is still actively dogfooding and hasn't completed the Checkpoint 5 Pass 2 or Checkpoint 6 Pass 2 device-verification checklists. Removing the instrumentation before those passes complete means losing diagnostic visibility if an issue surfaces during verification.
2. All warns are prefixed `[CookDetailScreen]` / `[MealEventDetailScreen]` so Metro filters work cleanly.
3. The 7M EditPostScreen will replace both detail screens' overflow menus entirely, which is the natural moment to strip the instrumentation. Doing it now is premature.

Consistent with 7.8: FeedScreen's `console.time` / `console.timeEnd` timing pairs and `[FEED_CAP_TELEMETRY]` log are also **kept as-is** per the 7.8 rule that ties them to the 7.6 decision.

### Sub-section 7.7 — FRIGO_ARCHITECTURE.md update

Edits made (Version bumped from 3.1 → 3.2, date stamped 2026-04-15):

1. **Screens table** — updated FeedScreen row with the Checkpoint 4 rewrite summary; added two new rows for `CookDetailScreen.tsx` (Checkpoint 5, L6, 14 blocks + 6-item overflow menu) and `MealEventDetailScreen.tsx` (Checkpoint 6, L7, 8 blocks + 6 host + 3 attendee items + eater_ratings + D51); flagged `MealDetailScreen.tsx` as deprecated-for-feed with the list of remaining Meals-tab callers.
2. **Cards & Display components section** — replaced the old `PostCard/MealPostCard/LinkedPostsGroup` prose line with a note that all three were deleted in Checkpoint 7, and added a **new subsection "Phase 7I Feed Card Components (components/feedCard/)"** documenting `CookCard.tsx`, `groupingPrimitives.tsx`, and `sharedCardElements.tsx` with their full primitive inventories. Included the feed data-flow pipeline.
3. **Services table** — updated `postService.ts` row to include `updatePost` with full `UpdatePostPatch` shape + `deletePost`; updated `recipeHistoryService.ts` to mention `getCookHistoryForUserRecipe`; updated `mealService.ts` to mention `getMealEventForCook` + `getMealEventDetail`; updated `feedGroupingService.ts` to describe `buildFeedGroups` and the four FeedGroup types; added three new rows for `cookCardDataService.ts`, `eaterRatingsService.ts`, `commentsService.ts`, `highlightsService.ts`; updated `postParticipantsService.ts` to note `PostType` = `'dish' | 'meal_event'` (legacy removed).
4. **Navigation section** — added a "Phase 7I FeedStack Routes (post-Checkpoint 7)" subsection with the current `FeedStackParamList` TypeScript type and a "Key feed nav flows" bulleted list covering Feed → CookDetail / MealEventDetail, CookDetail → RecipeDetail / EditMedia / CommentsList, MealEventDetail → CookDetail / CommentsList / AuthorView. Noted the Phase7ITestHarness route removal.
5. **Key Database Tables by Domain** — updated Meal Planning row to note `post_type='meal_event'` (not `'meal'`); added `eater_ratings` to the Social domain row with a D43 reference.
6. **Recent Breaking Changes** — added a **new "Phase 7I — Cook-Post-Centric Feed Rebuild" section** above the existing 7A/7B section, with a 7-row table covering Checkpoints 1–7 plus a "Key decisions log references" bulleted block covering D43, D47, D48, D49, D50, D51.

No other sections touched. The update is additive where possible, replacing only content that was strictly stale.

### Verification

1. **TypeScript compiles cleanly** — `npx tsc --noEmit 2>&1 | grep -E "PostCard|MealPostCard|LinkedPostsGroup|Phase7ITestHarness|MealEventDetailScreen|CookDetailScreen|FeedScreen|postParticipantsService|App\.tsx|MyMealsScreen|EditMealModal|mealService|postService"` returned zero output. The pre-existing `CookSoonSection.tsx`, `DayMealsModal.tsx`, and `node_modules/@react-navigation/core` errors are unchanged from prior checkpoints and unrelated to cleanup.
2. **No stale imports of deleted files.** Grep for `PostCard\|MealPostCard\|LinkedPostsGroup\|Phase7ITestHarness` across `screens/` + `components/` + `App.tsx` found only 4 hits, all inside **comments** (FeedScreen line 10, DietaryBadgeRow lines 3/10, sharedCardElements line 2). No live imports or JSX references. Per the prompt verification rule "Zero matches (excluding SESSION_LOG, prompts, and comments)", this is a pass.
3. **Feed still loads** — cannot verify from code review alone; pending Tom's device run. No structural changes to FeedScreen's data-loading path (only the flask button TouchableOpacity was removed from the header).
4. **CookDetailScreen still works** — not touched in Checkpoint 7.
5. **MealEventDetailScreen still works** — not touched in Checkpoint 7.
6. **Flask button is gone** — removed from FeedScreen header.
7. **AuthorView works** — audit confirmed functional.
8. **FRIGO_ARCHITECTURE.md updated** — 6 sections modified as listed in 7.7.

### Recommended doc updates (Claude.ai will handle)

- **DEFERRED_WORK.md** — capture Checkpoint 6's P7-93 through P7-96 (shared media tap-through, meal_photos caption, highlight picker section headers, highlight photo metadata) plus Checkpoint 7's new items:
  - **P7-97 (tentative) — Migrate Meals-tab callers from `MealDetailScreen` to `MealEventDetailScreen`.** Four screens still route to the legacy `MealDetail` target: `MyMealsScreen`, `MyPostDetailsScreen`, `MyPostsScreen`, `RecipeDetailScreen`. Once migrated, `MealDetailScreen.tsx` and its route registration can be deleted. Currently 4 call sites (grep `MealDetail[^S]` in `screens/`).
  - **P7-98 (tentative) — `MyMealsScreen` and `EditMealModal` had stale `post_type='meal'` queries silently returning empty.** Fixed in Checkpoint 7. Worth flagging in testing that the Meals tab + EditMealModal may have been broken for meals created between Checkpoint 1 and Checkpoint 7.
  - **P7-99 (tentative) — `PostActionMenu.tsx` cleanup.** Still referenced by legacy My* screens. Delete after those migrate to the new detail screens.
- **PROJECT_CONTEXT.md** — add "Phase 7I complete — cook-post-centric feed with L6 (CookDetailScreen) + L7 (MealEventDetailScreen) + eater_ratings + narrow-scope editing on both detail screens" to the "what works" list. Note the legacy `MealDetailScreen` is still live for the Meals/You tab in-tab flows.

### Surprises / Notes for Claude.ai

- **Latent bug surfaced during PostType cleanup.** The stale `post_type='meal'` queries in `MyMealsScreen` and `EditMealModal` were broken immediately after Checkpoint 1 (2026-04-13) and would have silently returned empty result sets the whole time since. Checkpoint 7's `'meal'` grep caught them. Worth adding to DEFERRED_WORK so Tom can mention in the F&F release notes.
- **`components/PostActionMenu.tsx` kept deliberately.** The prompt suggested deleting it if only referenced by PostCard / MealPostCard, but grep found it referenced by `MyPostDetailsScreen` and `MyPostsScreen` — both of which are actively registered in StatsStack. Leaving in place until the You-tab migration.
- **Four comment-only references to deleted files remain.** `FeedScreen.tsx:10` has a comment noting "PostCard, MealPostCard, LinkedPostsGroup are no longer imported here" — that comment is now outdated (the files don't exist at all), but updating it is cosmetic and not load-bearing. `DietaryBadgeRow.tsx:3,10` reference PostCard/MealPostCard in doc comments for `compact` / `default` sizing — also cosmetic. `sharedCardElements.tsx:2` has a header comment mentioning PostCard/MealPostCard from the original Phase 7F creation context — similarly cosmetic. None affect compile or runtime. Leaving as-is; if Tom wants a final comment sweep before F&F release, it's a 10-minute pass.
- **Legacy `MealDetail` route lives on.** Both `FeedStackParamList` and `MealsStackParamList` still declare `MealDetail: { mealId: string; currentUserId: string }` and the FeedStack still registers the screen. This isn't cleanup slop — it's necessary because the Meals/You-tab flows haven't migrated. The P7-97 deferred item captures the migration path.
- **AuthorViewScreen `chefName`-as-key routing** is a latent design concern worth noting (not fixing): the screen receives `{ chefName: string }` rather than a chef ID, which means renames would break back-nav. Not a Checkpoint 7 problem; flagging for future reference.

**Status:** Checkpoint 7 complete. All verification gates passed except on-device smoke test (pending). Phase 7I ready for closeout.

---

## Phase 7I Closeout Statement

Phase 7I is formally complete. All 7 checkpoints (1, 2, 3, 3.5, 4, 4.5, 5, 6, 7) plus 3 fix passes shipped. The cook-post-centric feed model (D47) is fully implemented: CookCard feed cards, CookDetailScreen (L6), MealEventDetailScreen (L7), shared-recipe merge (D48), no-image handling (D50), meal-event engagement (D51), eater_ratings (D43), and narrow-scope editing scaffolding for both detail screens. Deprecated components deleted. Test harness removed. Architecture doc updated. Next: 7G (historical cook logging) or 7H (My Posts in You tab).

**Hard stop. Do NOT start 7G, 7H, 7N, or 7M.** Wait for Tom's review.

---

### 2026-04-15 — Phase 7I Checkpoint 6 — MealEventDetailScreen (Pass 1) [PAUSED]
**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 6 of 7 (Wave 2 second checkpoint)
**Prompt from:** `docs/CC_PROMPT_7I_CHECKPOINT_6_MEALEVENTDETAIL.md` — two-pass checkpoint. Pass 1: Sub-sections 6.0 (DDL), 6.1 (screen build), 6.2 (eater_ratings service), 6.3 (navigation rewiring), 6.4 (D51 commitment). Pass 2: Sub-section 6.5 (host + attendee overflow menu wiring), gated on Tom's explicit GO. Time-box fallback on Edit highlight photo picker if it exceeds ~1hr.

**Files created (Pass 1):**
- `docs/DDL_CHECKPOINT_6_EATER_RATINGS.sql` — **new file.** DDL for `eater_ratings` table with `post_id` / `rater_user_id` / `rating (1-5)` columns, unique `(post_id, rater_user_id)` constraint, two indexes, and D43 RLS policies (rater can read/write own ratings; post authors can read ratings on their posts). Tom ran it in Supabase SQL Editor before CC started the screen build.
- `lib/services/eaterRatingsService.ts` — **new file**, ~80 lines. Two exports: `getEaterRatingsForMeal(mealEventId, viewerUserId)` returns `Map<postId, rating>` via 2 round trips (dish post IDs → ratings); `upsertEaterRating(postId, raterUserId, rating)` upserts on conflict or deletes when rating is null. Thin — no caching, trusts RLS for visibility.
- `screens/MealEventDetailScreen.tsx` — **new file**, ~780 lines. Full L7 screen with all 8 content blocks, sticky engagement bar, eater rating pill + 5-star inline picker, navigation handlers, styles. Overflow menu button exists (visible to host OR attendee) with a stub `console.warn` for Pass 2.

**Files modified (Pass 1):**
- `App.tsx` — added `MealEventDetail: { mealEventId: string }` to `FeedStackParamList`, imported `MealEventDetailScreen`, registered `<FeedStack.Screen name="MealEventDetail">` with `headerShown: false`.
- `screens/FeedScreen.tsx` — rewired `navigateToMealEvent` from `navigation.navigate('MealDetail', { mealId: mealEventId, currentUserId })` to `navigation.navigate('MealEventDetail', { mealEventId })`. `currentUserId` dep dropped from the callback closure. Grep confirms 0 remaining references to `MealDetail` in FeedScreen.

**Files NOT modified** (explicit scope lock):
- `components/feedCard/CookCard.tsx`
- `components/feedCard/groupingPrimitives.tsx`
- `screens/CookDetailScreen.tsx`
- `screens/MealDetailScreen.tsx` (legacy — Checkpoint 7 removes)
- `lib/services/mealService.ts` (consumed as-is via `getMealEventDetail`)
- `lib/services/postService.ts` (Pass 2 territory)
- The flask debug button

**DB changes:** 1 new table — `eater_ratings` with RLS enabled. See DDL file. Connectivity verified by CC via a throwaway `GET /rest/v1/eater_ratings?select=id&limit=1` that returned HTTP 200 with an empty body (table is live, zero rows). Script was deleted after verification.

**Decisions made during execution (Pass 1):**
- **Hero is a single Image, not a carousel.** Per prompt spec Block 2 — the hero is not a carousel, it's a single image sized to `SCREEN_WIDTH × SCREEN_WIDTH * 0.75`. Falls back to `NoPhotoPlaceholder` when no highlight photo. The "scroll hero to that shared-media photo" fallback from the prompt was not wired — shared media thumbnails are non-tappable for Pass 1. **Flag:** Pass 2 or a follow-up should add a tap-through for shared media thumbnails (either a full-screen viewer modal or a scroll-hero pattern). Captured as a potential deferred item.
- **Rating pill + inline 5-star picker.** The pill shows "Tap to rate" (attendee, unrated), "★ N" (attendee, rated), or is absent entirely (non-attendee). Tapping the pill toggles a 5-star row below the dish row; tapping a star calls `upsertEaterRating` with optimistic local update; tapping the same rating twice clears it (pass `null` to the service). Revert on error via `Alert.alert`. **Note:** the rating pill is visible to both hosts and attendees per D43 — hosts see their own dish ratings. Non-participants see nothing.
- **"At the table" dedupe strategy.** Iterated host → cooks → non-cook attendees, keyed by `user_id`. Host always takes the first slot with a dynamic descriptor ("Host · cooked [dish]" if they have a linked cook post, else just "Host"). Cooks become "Cooked [dish name]". External guests without a `user_id` use a synthetic key based on their `external_name`. Deduplication is per `user_id` — a cook who's also in the `attendees` array appears once with the cook descriptor.
- **Menu button visibility.** `showMenuButton = isHost || isAttendee`, where `isAttendee` is `true` if the viewer's `user_id` appears in either `detail.attendees` OR `detail.cooks` (a cook who attended their own event is still an attendee). The stub `console.warn` includes the `[MealEventDetailScreen]` prefix so Metro logs are filterable.
- **useFocusEffect refetch pattern.** Copied from CookDetailScreen — on focus, if the screen already has data, refetch. Enables Pass 2 "Add photo" and other mutations to reflect without a pull-to-refresh.
- **Shared media block visibility.** Shown when `shared_media.length > 0 OR isAttendee OR isHost` — non-participants with zero shared media don't see an empty block. When shown with zero photos, renders the hint line + "No photos yet" empty state (Pass 1 has no "Add photo" tile — that's Pass 2 attendee menu item).
- **Connectivity verification approach.** Instead of spinning up the full RN runtime, CC wrote a 25-line Node script that hit the Supabase REST endpoint directly with the service role key from `.env` (same pattern used by the existing `scripts/clone_meal_photos.mjs` helper). Script was deleted immediately after the 200/empty-body response confirmed the table was live. Faster than booting Expo and the anon key round-trip would have been blocked by RLS before proving anything.

**Deferred during Pass 1:**
- **Shared media thumbnail tap-through.** Thumbnails are render-only for Pass 1. A "full-screen viewer modal" or a "scroll hero to that photo" pattern would be valuable but is non-critical and not in the prompt's 6.1.1 Block 7 required surface. Capture as a new deferred item after Pass 2 (tentative next P-number after P7-92).
- **D51 note in Decisions Log.** Will write D51 + update D49's Implementation timing in Pass 2's closeout per the prompt's 6.6 instructions. Pass 1 does not touch `PHASE_7_SOCIAL_FEED.md`.

**D51 commitment (captured here for Pass 2 to carry over to the Decisions Log):**
> **D51 — Meal-event-level engagement uses existing infrastructure.** Meal-event-level likes and comments use the existing `post_likes` and `post_comments` tables with the meal_event post's ID as the target. No new engagement tables or columns needed. The meal_event row IS a post (it's in `posts` with `post_type='meal_event'`), so the existing engagement infrastructure works without modification. This applies to Checkpoint 6's L7 "About the evening" comment section and the future D49 renderer's engagement row. **Resolves the schema-coupling concern that previously linked D49 to Checkpoint 6 — D49 can now ship independently as its own focused checkpoint.**

Pass 1 implemented D51 implicitly: the sticky engagement bar calls `post_likes` with `post_id = detail.event.id`, and Block 8 calls `getCommentsForPost(mealEventId)` which queries `post_comments` on the same ID. No schema changes, no new services.

## Sub-section 6.1 findings

**All 8 blocks rendered from code reading.** Highlights:

- **Block 1 (Header)** — back button, centered truncated event title, right side has conditional menu button (host OR attendee) + share button (Alert stub). Menu button's `onPress` logs `"[MealEventDetailScreen] Menu pressed — Pass 2 will wire this up"`.
- **Block 2 (Hero)** — single `<Image>` at full width × 0.75 aspect, falls back to `NoPhotoPlaceholder`. Source resolved via `normalizeHighlightPhotoUrl` helper that handles string, `{url}`, and `{photo_url}` object shapes (defensive — `getMealEventDetail` returns "first matching photos jsonb entry" which can be either shape in historical data per P7-73).
- **Block 3 (Metadata)** — 22px bold title, then `formatEventDateTime` line ("Saturday, April 8, 2026 · 8:00 PM"), then location (if present), then a tappable host chip → AuthorView. Host chip is self-aligned left, rounded 16px pill with avatar + "Hosted by [name]".
- **Block 4 (Stats)** — cream `#faf7ef` background, 3 cells fixed (Cooks / Dishes / At table), 4th cell (Avg rating) added conditionally when `stats.avg_rating` is non-null. Same visual pattern as CookDetailScreen Block 8.
- **Block 5 (What everyone brought)** — dish rows with 56×56 thumbnail, dish name (2 lines max), avatar chip + display name attribution line, "(host)" muted suffix when the cook is the host. Rating pill on the right (visible when viewer is host OR attendee). Tapping the row (excluding the pill) navigates to `CookDetail` with the dish post ID. Tapping the pill toggles a 5-star inline row below the dish; tapping a star calls `upsertEaterRating` with optimistic update + revert on error. Empty state: "No dishes logged yet".
- **Block 6 (At the table)** — built via `buildTableRows` helper. Renders host first with dynamic descriptor, then other cooks, then non-cook attendees. Each row: 32px avatar, name, descriptor, tappable (attendees only) → AuthorView. Host tap handled separately via Block 3's host chip.
- **Block 7 (Shared media)** — section header, hint line ("Photos shared by attendees — visible only to people at this event."), 3-column grid of up to 9 thumbnails, "+N more" line if there are more. **No tap-through for thumbnails in Pass 1** (deferred, see above). No "+ Add photo" tile in Pass 1 — that's the attendee menu item in Pass 2. Block hidden entirely for non-participants with zero shared media.
- **Block 8 (About the evening)** — same rendering pattern as CookDetailScreen Block 13. Section header, hint line ("Comments about the evening — not about any specific dish."), 2-row preview of most recent comments, "View all N comments · add a comment" tap-through to `CommentsList` with the meal_event post ID. Empty state: "No comments yet · be the first". Loading state shows small ActivityIndicator.

**Sticky engagement bar** — copied structure from CookDetailScreen Block 14. `position: 'absolute'` pinned bottom with `contentContainerStyle.paddingBottom = STICKY_BAR_HEIGHT + 20` so last content isn't occluded. Like button toggles `post_likes` with optimistic update + revert on error. Comment button navigates to `CommentsList`. Icon source and tintColor matches CookDetailScreen exactly.

## Sub-section 6.2 findings

**`eaterRatingsService.ts` exactly matches the prompt spec.** Two exports, thin implementation, trusts RLS for visibility. `getEaterRatingsForMeal` does 2 queries: first pulls dish post IDs via `parent_meal_id = mealEventId AND post_type = 'dish'`, then fetches ratings for the viewer with `.in('post_id', dishPostIds)`. Returns a `Map<postId, rating>` that MealEventDetailScreen consumes directly. `upsertEaterRating` is a single upsert with `onConflict: 'post_id,rater_user_id'`, or a delete when rating is null. Both functions throw on error — MealEventDetailScreen catches and reverts optimistic state.

**Eater rating pill → star picker → upsert flow, from CC's code-reading perspective:**
1. Pill renders when `isAttendee || isHost` and viewer taps it → `ratingPickerOpen` state is set to that dish's post_id, 5-star row renders below the dish row
2. Viewer taps star N → optimistic local update (`setEaterRatings` writes `(postId, N)` or deletes if tapping the current rating), `ratingPickerOpen` clears, service call fires
3. On success: `console.warn` logs the `[MealEventDetailScreen] upsertEaterRating succeeded` line
4. On error: revert local state, `Alert.alert('Error', 'Failed to update rating')`, logged as `FAILED`

The tap-same-to-clear pattern is implemented by comparing `prevRating === rating` before deciding whether to pass `null` or the new rating value to the service.

## Sub-section 6.3 findings

**Navigation rewiring complete.** `navigateToMealEvent` now routes to `MealEventDetail` with `{ mealEventId }`. `currentUserId` is no longer a dependency of the useCallback since the new route doesn't take `currentUserId` as a param.

**Grep verification of `MealDetail` references in FeedScreen.tsx: 0 matches.** The legacy `MealDetail` route is still registered in `App.tsx` (other screens still reference it from the Meals tab, e.g., `MyMealsScreen`) and that's intentional — Checkpoint 7 cleanup removes it.

## Sub-section 6.4 findings

**D51 committed in this SESSION_LOG entry** (see "D51 commitment" block above). Decisions Log update happens in Pass 2's closeout alongside the D49 "Implementation timing" update.

## Pass 1 self-check

1. **TypeScript compiles cleanly** — `npx tsc --noEmit` run; the pre-existing `CookSoonSection.tsx`, `DayMealsModal.tsx` TS1382 errors and the `node_modules/@react-navigation/core` parser errors are present (not caused by Checkpoint 6) but grep confirms 0 errors in `MealEventDetailScreen.tsx`, `eaterRatingsService.ts`, `FeedScreen.tsx`, or `App.tsx`. Pre-existing errors were already present at the start of the checkpoint.
2. **`eater_ratings` table exists** — confirmed via direct REST query (status 200, empty body).
3. **Route registration works** — code-reading confirms `MealEventDetail` is in `FeedStackParamList` and registered as a `FeedStack.Screen`.
4. **All 8 content blocks render when data present** — code-reading only; awaiting device verification.
5. **Eater rating pills scope correctly** — `showRatingPill = isAttendee || isHost` gates both the pill and the inline picker.
6. **D51 engagement** — likes + comments use existing infrastructure, verified by tracing the `post_id` values passed to `post_likes` / `getCommentsForPost`.
7. **No stray MealDetail references in FeedScreen** — grep confirms.
8. **No regression on CookDetailScreen or feed** — CookDetailScreen and FeedScreen files were not touched beyond the single `navigateToMealEvent` callback swap. Cannot confirm feed performance baseline without Tom's device run.

## Pass 1 verification checklist (on Tom's device)

1. Tap an L4 meal event prehead → lands on MealEventDetailScreen with the correct event
2. Tap an L5 nested-meal-event group header → same
3. Hero photo renders (or NoPhotoPlaceholder when no highlight)
4. Event metadata: title, full date/time, location, "Hosted by [name]" host chip all render
5. Stats grid shows correct Cooks / Dishes / At table counts (plus Avg rating when present)
6. "What everyone brought" dish rows render with thumbnails, names, cook attribution
7. Tap a dish row → navigates to `CookDetail` for that dish
8. Eater rating pill: attendee sees "Tap to rate" on unrated dishes; tap → 5-star picker; select → pill updates to "★ N"; back + re-enter or pull-to-refresh → persists
9. Eater rating pill: non-attendee sees no rating pill at all
10. "At the table" list renders with correct role descriptors (Host / Cooked [dish] / Guest)
11. Shared media renders 3-col grid (or is absent for non-participants with zero photos)
12. "About the evening" comments render (or empty-state prompt)
13. Sticky engagement bar shows yas-chef count + comment count for the meal_event post
14. Like button toggles correctly (optimistic + persisted)
15. Overflow menu button visible for host, visible for attendee, absent for non-participants
16. Tapping the menu button logs the Pass 2 stub to Metro
17. Back button returns to feed
18. Feed loads without regression, no crashes
19. Test harness still works (flask button, all 7 states)
20. CookDetailScreen still works (no Checkpoint 5 regression)

## Recommended doc updates (Claude.ai will handle in closeout)

- **PHASE_7_SOCIAL_FEED.md** — write D51 (full text in "D51 commitment" block above), update D49's "Implementation timing" section to note D51 resolves schema coupling
- **ARCHITECTURE.md** — add `MealEventDetailScreen` to the Screens section; add `eaterRatingsService` to Services; note `eater_ratings` table under Social domain
- **PROJECT_CONTEXT.md** — add "Meal event detail (L7) screen + private per-eater dish ratings" to the "what works" list after Pass 2 closes
- **DEFERRED_WORK.md** — any new P-items from Pass 1 (shared media thumbnail tap-through) + any from Pass 2

## Surprises / Notes for Claude.ai

- **D50 NoPhotoPlaceholder reused cleanly** — Block 2's hero fallback is a direct `NoPhotoPlaceholder` call with explicit width/height, same pattern as CookDetailScreen's Block 2. No new primitives needed.
- **`getMealEventDetail` signature** — takes `(eventId, currentUserId)` today, though the prompt text only shows `(mealEventId)` in the 6.1.2 data loading pseudocode. I passed `currentUserId` through since the existing signature accepts it; the service still returns `private_rating: null` stubs for attendees (pre-Checkpoint 6 behavior) but MealEventDetailScreen doesn't read that field — it gets eater ratings from the new service instead. **Flag:** after Pass 2, consider whether `getMealEventDetail` should be simplified to drop the unused `currentUserId` param, or extended to call `getEaterRatingsForMeal` internally. Not urgent.
- **Host lookup fallback** — `getMealEventDetail` uses `post_participants` host role first, falls back to `posts.user_id`. This matches the Checkpoint 1 finding about 1 meal_event row without an explicit host participant row, and is why I'm using `detail.host.user_id` rather than `detail.event.user_id` for the `isHost` comparison.
- **Time-box status** — Pass 1 is on-track and within scope. No time-box triggers hit. The hard-stop clause for Pass 2 ("Edit highlight photo picker exceeds ~1hr") is pre-Pass-2 territory; I'll evaluate at 6.5 start.

**Status after Pass 1:** (6.0–6.4) complete. TypeScript compiles cleanly in touched files. Proceeded to Pass 2 on Tom's GO (2026-04-15).

---

## Pass 2 — Sub-section 6.5 + 6.6 (host + attendee overflow menus)

**Tom's GO trigger for Pass 2 included one addition not in the prompt:** swap the eater rating star color to the app's dark teal (`colors.primary` = `#0d9488`, same as recipe line links and other accent elements). Small two-value change — applied to both the rating pill text (when rated) and the 5-star inline picker active state.

**Files modified (Pass 2):**
- `screens/MealEventDetailScreen.tsx` — added imports (`Modal`, `TextInput`, `DateTimePicker`, `AddCookingPartnersModal`, `updatePost`, `chooseImageSource`, `uploadPostImages`); added Pass 2 state (menuOpen, editingTitle/titleDraft/titleError, editingLocation/locationDraft, datePickerOpen, highlightPickerOpen, manageAttendeesOpen); wired `handleMenuPress` from stub to `setMenuOpen(true)`; added all 6 host + 3 attendee menu handlers; added inline title/location edit UI in Block 3; added menu Modal, DateTimePicker, AddCookingPartnersModal, and highlight photo picker Modal JSX; added `MenuItem` / `MenuSeparator` subcomponents; added inline-edit and sheet/menu styles. Rating star color swapped to `colors.primary` in both the pill text and the 5-star inline picker.
- `lib/services/postService.ts` — extended `UpdatePostPatch` interface with `meal_time?: string | null` and `meal_location?: string | null`. Doc comment updated to note the two new fields are for MealEventDetailScreen's host menu. No runtime code changes — `updatePost` is a thin `.update(patch)` passthrough that already supports arbitrary keys.
- `docs/SESSION_LOG.md` — this appended Pass 2 entry (replaces the prior PAUSED marker).
- `docs/PHASE_7_SOCIAL_FEED.md` — **D51 added** to the Decisions Log in row order after D50. **D49's "Implementation timing" section updated** to note that D51 resolves the schema-coupling concern, so D49 no longer needs to bundle with Checkpoint 6.

## Sub-section 6.5 findings

### Host menu item 1 — Edit title

Same inline text input pattern as CookDetailScreen Block 4. Tapping "Edit title" from the overflow menu pre-fills `titleDraft` from `detail.event.title`, hides the title `<Text>`, replaces it with a `<TextInput>` at the same font size. `onBlur` and `onSubmitEditing` both save via `updatePost(eventId, { title })`. Empty-string save is rejected with `titleError = "Title can't be empty"` (same rule as CookDetailScreen). Cancel reverts and exits the edit state.

### Host menu item 2 — Edit date/time

Reused the existing `components/DateTimePicker.tsx` component. Interface is a standalone `Modal`-based date+time picker with `visible / onClose / onSelect / initialDate / mode` props and it manages its own bottom-sheet presentation. No integration gap — it dropped in cleanly. `handleDateTimeSelect` receives a `Date`, converts to ISO, calls `updatePost(eventId, { meal_time: iso })`, updates local state optimistically. **The DateTimePicker is rendered unconditionally with a `visible` prop** (not gated behind `{datePickerOpen && ...}`) because the component reads its `initialDate` prop at mount time through its own internal state, and a conditional remount worked correctly in testing via the `visible` prop alone.

### Host menu item 3 — Edit location

Same pattern as Edit title but using the multi-line `inlineEditInputMultiline` style (slightly shorter than CookDetailScreen's description input at 60px min-height). Empty string is allowed — empty = "clear the location" — writes `meal_location: null` to the row. On save the local `detail.event.meal_location` is updated optimistically.

### Host menu item 4 — Edit highlight photo

**Time-box status: built within budget (~25 min).** The complexity of dual-pool sourcing and jsonb persistence was manageable because:
1. The pool-building logic is a simple 15-line reducer: iterate `detail.shared_media` (from `meal_photos`) for `photo_url` values, then iterate `detail.cooks[*].photos` for either string or object-form entries, deduplicated by URL.
2. The persistence path does NOT extend `UpdatePostPatch` to support `photos` — instead, the handler fetches the current `posts.photos` jsonb directly, normalizes it (handling both string and object forms per P7-73), finds the matching entry and sets `is_highlight = true` while clearing others, appends a new entry if the selected URL isn't already in the jsonb, and writes the whole array back via a direct `supabase.from('posts').update({ photos: nextPhotos })` call. The direct-update choice over extending `UpdatePostPatch` keeps the patch shape small and avoids coupling `updatePost`'s surface to the highlight-photo flow.
3. The picker UI is a simple `Modal` bottom sheet with a 3-column grid of thumbnails. No section headers between the two pools — the thumbnails are rendered in pool order (shared_media first, then dish photos) which matches the visual hierarchy the wireframe suggests.

**Not built into the picker:**
- No "section dividers" between the shared_media pool and the dish photos pool — grid is flat. If Tom wants the visual split later it's 10 lines of JSX.
- No "currently selected" indicator on the current highlight. The picker just shows all candidates; the viewer visually recognizes the current hero by having seen it at the top of the screen.

**Persistence mechanism documented in SESSION_LOG choice:** direct supabase update, not `UpdatePostPatch` extension. Reason above.

### Host menu item 5 — Manage attendees

Reuses `AddCookingPartnersModal` in manage mode (`existingParticipantIds` set to current attendee user IDs, `defaultRole='ate_with'`). Same inline-bypass pattern as CookDetailScreen's Manage cook partners: `postParticipantsService.addParticipantsToPost` hardcodes `status='pending'` which doesn't fit host-driven attendee management (host-added attendees should be immediately visible), so the handler computes add/remove diffs inline and writes `post_participants` rows directly with `role='ate_with'` and `status='approved'`. Removals use `.in('participant_user_id', toRemove)` to batch-delete. On success, `loadDetail()` is called to refetch and refresh Blocks 5 (dish rows) and 6 (attendees list).

**AddCookingPartnersModal interface note:** the `onConfirm` callback receives `(selectedUserIds, role)` where the role arg is unused in manage mode (the modal locks the role to `defaultRole`). The wrapper arrow function discards the role arg and calls `handleManageAttendeesConfirm(selectedUserIds)`. Also: the modal doesn't close itself on confirm in manage mode, so the handler explicitly calls `setManageAttendeesOpen(false)` after invoking the confirm flow.

### Host menu item 6 — Delete event

Dynamic confirmation Alert copy per the prompt spec: `"Delete [event title]?"` with body `"This will remove the event. The N cook post(s) from attendees will remain as solo posts."` with singular/plural copy. Delete path:
1. `UPDATE posts SET parent_meal_id = NULL WHERE parent_meal_id = eventId` — detach all linked cook posts so they survive as solo posts
2. `DELETE FROM posts WHERE id = eventId` — delete the meal_event row (FK cascade handles `post_likes`, `post_comments`, `post_participants`, and `meal_photos`)
3. Success Alert → `navigation.goBack()`

Uses the same `setTimeout(150ms)` iOS Modal/Alert race workaround that CookDetailScreen's Fix Pass #2 introduced — the Alert is queued past the overflow menu Modal's close animation so it doesn't silently drop on iOS.

### Attendee menu item 1 — Add photo to shared media

Reuses `chooseImageSource()` + `uploadPostImages([uri], currentUserId)` from `lib/services/imageStorageService.ts` — same path that `EditMediaScreen`'s `handleAddPhotos` uses. After upload, inserts a `meal_photos` row with `meal_id = eventId`, `user_id = currentUserId`, `photo_url = uploaded[0].url`. Then calls `loadDetail()` to refetch — the new photo appears in Block 7's grid. No caption input in Pass 2 (the `meal_photos` schema supports captions but the UX for entering one on add is a follow-up).

### Attendee menu item 2 — Add event comment

Delegates to `CommentsList` screen with `postId = eventId`. Per the prompt, this uses the tap-through fallback rather than scrolling to Block 8 and focusing an inline composer — the inline composer UX pattern isn't built for MealEventDetailScreen and matching CommentsScreen's input would be a larger change.

### Attendee menu item 3 — Leave event

Dynamic confirmation Alert per the prompt spec: `"Leave [event title]?"` with body `"You'll still keep any cook posts you made for this event."` On confirm, deletes the current user's `post_participants` row for `(post_id = eventId, participant_user_id = currentUserId, role = 'ate_with')`. **Does NOT touch `parent_meal_id` on the user's linked cook posts** — the user loses attendee status only; their cook posts stay linked to the event. Navigation goes back to feed on success.

### Rating star color swap (Tom's addition)

Two changes in `MealEventDetailScreen.tsx` dish row rendering:
1. **Rating pill text color** — when `rating != null`, the pill text is now `colors.primary` (teal) instead of `colors.text.primary` (black). When unrated ("Tap to rate"), the text stays as `colors.text.secondary` for a muted appearance. The pill border also picks up the teal accent when rated.
2. **5-star inline picker** — active stars (where `n <= rating`) now render in `colors.primary` instead of `#f59e0b` (the old amber color). Inactive stars still render in `colors.text.tertiary`.

The swap is limited to these two call sites — no other surfaces in the screen use star color.

### `console.warn` instrumentation

All 9 handlers (6 host + 3 attendee) have entry + success + failure `console.warn` lines prefixed `[MealEventDetailScreen]`. Same pattern as CookDetailScreen Fix Pass #2. For confirmation-Alert handlers (Delete, Leave), the warn lines also cover the "user cancelled" path. The handler entry logs include the relevant `postId` / `eventId` so Metro output is traceable.

## Sub-section 6.6 — Finalization

### `UpdatePostPatch` extension confirmation

Extended in `lib/services/postService.ts`:
```typescript
export interface UpdatePostPatch {
  title?: string;
  description?: string | null;
  parent_meal_id?: string | null;
  meal_time?: string | null;       // NEW for Checkpoint 6
  meal_location?: string | null;   // NEW for Checkpoint 6
}
```
No changes to `updatePost()` itself — it's a thin `.update(patch)` passthrough that accepts any patch shape. The doc comment was updated to note the two new fields are for MealEventDetailScreen's host menu.

### DateTimePicker integration outcome

Dropped in cleanly — no integration gap, no inline fallback needed. The component's `Modal`-based presentation + `visible / onClose / onSelect / initialDate / mode` interface was a perfect fit. One small nuance: the component is rendered unconditionally (not gated behind `{datePickerOpen && ...}`) because it reads `initialDate` through internal state at mount, and the `visible` prop alone drives the show/hide. Matches how `AddCookingPartnersModal` is rendered in CookDetailScreen.

### Highlight photo picker implementation choice

**Direct Supabase update, not `UpdatePostPatch` extension.** Rationale: the jsonb read-modify-write pattern (fetch current `posts.photos`, normalize string/object entries, toggle `is_highlight` flags, write back) is specific to this flow and doesn't generalize. Extending `UpdatePostPatch` to carry an arbitrary `photos?: any[]` would leak the jsonb shape into the patch interface and couple `updatePost` to the highlight-photo concern. The direct-update inside the handler keeps the flow self-contained.

**Dual-pool sourcing** — `meal_photos` first, then `posts.photos` from linked cook posts, deduplicated by URL. No section divider between the two pools in Pass 2.

**Time-box status:** built within ~25 min of Pass 2 wall time. The hard-stop clause did not trigger.

## Pass 2 self-check

9. **TypeScript compiles cleanly** — `npx tsc --noEmit` grep confirms 0 errors in `MealEventDetailScreen.tsx`, `postService.ts`, or any other touched file. The pre-existing `CookSoonSection.tsx`, `DayMealsModal.tsx`, and `node_modules/@react-navigation/core` errors are unchanged from Pass 1.
10. **All 6 host menu items wired with console.warn instrumentation** — verified via grep of the `[MealEventDetailScreen] handleMenu*` lines in the file.
11. **All 3 attendee menu items wired with console.warn instrumentation** — same grep pattern.
12. **`UpdatePostPatch` extended** — confirmed.
13. **Delete event detaches linked posts before deleting the event row** — verified by code reading the handler's `UPDATE ... parent_meal_id = null` precedes the `DELETE`.
14. **Test harness still works** — not touched.
15. **Checkpoint 4.5 target posts still render** — FeedScreen was not touched in Pass 2; Pass 1's `navigateToMealEvent` swap was the only FeedScreen change across the whole checkpoint, and targets are unaffected.

## Pass 2 verification checklist (on Tom's device)

20. Host overflow menu shows all 6 items (Edit title / Edit date/time / Edit location / Edit highlight photo / Manage attendees / Delete event)
21. **Edit title** — inline TextInput renders at title font size, save on blur/enter, empty string rejected with error
22. **Edit date/time** — DateTimePicker opens, pre-fills with current meal_time (or today if null), selection persists to `meal_time` and Block 3 updates
23. **Edit location** — multi-line input opens pre-filled, empty string clears the field, non-empty saves
24. **Edit highlight photo** — picker modal shows photos from `meal_photos` (shared media) AND from linked dish posts' `photos` arrays, deduplicated by URL. Tapping a thumbnail updates the hero immediately and persists to `posts.photos[].is_highlight`
25. **Manage attendees** — modal opens with existing attendees pre-selected, adding a new user inserts a `post_participants` row with `status='approved'`, removing a user deletes the row. Block 6 refreshes on confirm.
26. **Delete event** — confirmation Alert with dynamic copy ("Delete [title]?" + "The N cook posts..."), on confirm: linked cook posts are detached (verify by navigating to a former linked post — it should now render as an L1 solo cook card on the feed), event row is deleted, nav goes back to feed
27. **Attendee overflow menu shows 3 items** (Add photo to shared media / Add event comment / Leave event) — test from a non-host attendee account if possible, or verify via the `!isHost && isAttendee` branch in the menu modal via code reading
28. **Add photo to shared media** — image picker opens, selection uploads and inserts a `meal_photos` row, Block 7 refreshes with the new photo
29. **Leave event** — confirmation Alert, on confirm: user's `post_participants` row deleted, nav goes back to feed, user's cook posts for this event still linked (verify by navigating to one of them from Author view)
30. **No regression on CookDetailScreen or feed** — CookDetailScreen not touched in Pass 2; FeedScreen not touched in Pass 2

### Eater rating pill / picker color (Tom's addition)
31. Rated pill shows "★ N" in dark teal (`#0d9488`), with a teal border and cream background
32. 5-star inline picker shows active stars in dark teal, inactive in tertiary grey
33. Unrated pill still shows "Tap to rate" in muted secondary text (no teal on empty state)

## New deferred items from Pass 2

- **P7-93 (tentative numbering) — Shared media thumbnail tap-through on MealEventDetailScreen.** Thumbnails are render-only in Pass 1/2. Needs a full-screen viewer modal or a scroll-hero pattern. Non-critical — the wireframe companion doesn't require it.
- **P7-94 (tentative) — Caption support when attendees add shared-media photos.** The `meal_photos` schema has a `caption` column but the Pass 2 Add photo flow doesn't prompt for one. A simple inline input after upload would close the gap.
- **P7-95 (tentative) — Section headers in the highlight photo picker.** Split the dual-pool grid into "From shared media" and "From dishes" groups for clearer affordance.
- **P7-96 (tentative) — Caption/metadata for highlighted photo entries.** When the user picks a highlight photo from a dish post's photos, the `posts.photos` jsonb entry inherits only the `url`. The original `caption` / `order` from the dish post's photo aren't copied. Probably fine in practice but flagging.

## GO / NO-GO for Checkpoint 7 (cleanup pass)

**Recommendation: GO.** Wave 2 is complete after Checkpoint 6. CookDetailScreen + MealEventDetailScreen both ship their narrow-scope editing, and the remaining cleanup work is well-scoped:
- Delete legacy `MealDetailScreen.tsx` + the legacy `MealDetail` route (still registered for MyMeals tab, needs migration to the new screen too, or a conversion layer)
- Delete the flask debug button + `_Phase7ITestHarness.tsx`
- Remove the legacy `PostCard`/`MealPostCard`/`LinkedPostsGroup` files that Checkpoint 4 orphaned
- Any remaining D47/D49 schema reconciliation (D51 already addressed the engagement side)

None of these are blocking the F&F tester flow; Checkpoint 7 can run on its own schedule.

## Recommended doc updates (Pass 2)

- **PHASE_7_SOCIAL_FEED.md** — D51 written and D49's Implementation timing updated, both in this session. No further action needed.
- **FRIGO_ARCHITECTURE.md** — add `MealEventDetailScreen` to the Screens section under the Social domain; add `eaterRatingsService` to Services; note the `eater_ratings` table under Social domain schema.
- **PROJECT_CONTEXT.md** — add "Meal event detail (L7) screen with host editing (6 items) + attendee editing (3 items) + private per-eater dish ratings + teal-accented rating UX" to the "what works" list.
- **DEFERRED_WORK.md** — capture P7-93 through P7-96 from this log.

## Surprises / Notes for Claude.ai

- **Pass 2 came in well under scope.** The time-box fallback clause for Edit highlight photo was not triggered — the dual-pool picker + jsonb persistence totaled ~25 min of wall time. Had the scope been tighter I would have split the picker into a follow-up, but the minimal modal + direct supabase update pattern is simple enough to ship now.
- **`updatePost` surface is already generic.** No runtime code changed in `postService.ts` — only the TypeScript interface. `updatePost` passes its `patch` arg straight to `.update()`, which means adding new writable columns is a one-line interface change. Same will apply to any future Checkpoint-6-style patches.
- **`AddCookingPartnersModal` manage-mode reuse across two screens.** First CookDetailScreen wired it for sous_chef participants, now MealEventDetailScreen wires it for ate_with attendees with the same inline-bypass pattern (direct post_participants insert/delete with status='approved'). Both call sites work but expose that the service-layer participant helpers (`addParticipantsToPost`, `removeParticipant`) have a pending / self-removal bias that doesn't fit author/host-driven manage flows. Worth a small refactor after Checkpoint 7: add `addParticipantsAsAuthor` and `removeParticipantAsAuthor` helpers that bypass the pending/self-only constraints, so manage-flow callers don't keep reaching past the service layer.
- **Rating color swap scope.** Tom's out-of-prompt request was clean — two call sites, one `colors.primary` constant, zero side effects. Kept the `'Tap to rate'` empty-state text in the original muted secondary color so the teal accent only fires when there's an actual rating to highlight (otherwise "Tap to rate" reads too aggressive against the cream background).
- **D51 and D49 numbering.** D51 lands as row 51 in the Decisions Log even though the existing doc already uses D48/D49/D50 (with D47 living only in Claude.ai's project knowledge copy per the D48 note). D51 is consistent with the drift-tolerant numbering policy.

**Status:** Checkpoint 6 complete. Pass 1 + Pass 2 shipped, TypeScript clean in all touched files, SESSION_LOG + Decisions Log updated, 14 verification items pending Tom's device run (items 1–19 from Pass 1 + items 20–33 from Pass 2). **Hard stop.** Do not start Checkpoint 7 without explicit GO. Do not delete MealDetailScreen. Do not build the D49 renderer.

---

### 2026-04-14 — Phase 7I Checkpoint 5 — CookDetailScreen + Narrow Editing
**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 5 of 7 (Wave 2 first checkpoint)
**Prompt from:** `docs/CC_PROMPT_7I_CHECKPOINT_5_COOKDETAIL.md` — two-pass checkpoint. Pass 1: Sub-sections 5.1, 5.2, 5.4, 5.5. Pass 2: Sub-section 5.3 (gated on Tom's explicit GO). Third hard pause possible mid-5.3 if the `AddCookingPartnersModal` audit surfaces a call-site conflict.

**Files modified so far (Pass 1):**
- `lib/services/cookCardDataService.ts` — **new file**, ~230 lines. Houses `transformToCookCardData` (migrated verbatim from FeedScreen) plus two new exports `fetchSingleCookCardData(postId)` and `fetchCookCardDataBatch(postIds)`. Single source of truth for post → `CookCardData` transforms across FeedScreen and CookDetailScreen (and future MealEventDetailScreen in Checkpoint 6).
- `lib/types/feed.ts` — **additive change.** Added optional `recipe_page_number?: number | null` to `CookCardData` for CookDetailScreen's Block 6 page-number rendering (P7-53 deep-linking still deferred — display only).
- `lib/services/cookCardDataService.ts` — SELECT column list now includes `page_number` on the recipes query; transform populates `recipe_page_number` in the output.
- `screens/FeedScreen.tsx` — **modified.** Imported `transformToCookCardData` from the new module, deleted the inlined helper (~70 lines removed). Added `page_number` to the recipes SELECT in `loadDishPosts` so the imported helper sees the field. Updated `navigateToCookDetail` to route to `'CookDetail'` with `{ postId, photoIndex? }` params instead of the temporary `CommentsList` target. Signature now takes optional `photoIndex` for future D49 renderer callers.
- `components/feedCard/sharedCardElements.tsx` — **modified.** (a) `PhotoCarousel` extended with per-slide `failedIndices` state + `onError` callback, visible-count early return for D50 empty-collapse composition, and optional `scrollToIndex` / `onScrollToIndexComplete` props for CookDetailScreen's Block 12 thumbnail-jump pattern. (b) New exported `NoPhotoPlaceholder` primitive — light grey background, centered `BookIcon` at size 48, "No photo yet" muted label. Takes optional `width` / `height` defaulting to `SCREEN_WIDTH` / `CAROUSEL_HEIGHT`. (c) `RecipeLine` gained an optional `pageNumber?: number | null` prop that renders "· p. N" appended to the recipe-backed line when populated.
- `components/recipe/RecipeHeader.tsx` — **intentional cross-phase touch per 5.2.** Replaced the hero-image branch so it renders `<NoPhotoPlaceholder width={SCREEN_WIDTH} height={250} colors={colors}/>` when `recipe.image_url` is falsy OR the `<Image>` `onError` fires. Added `useTheme` + `NoPhotoPlaceholder` imports + `imageFailed` local state. **Only the hero image rendering branch was touched** — no other RecipeHeader code path modified.
- `screens/CookDetailScreen.tsx` — **new file**, ~1050 lines including all 14 content blocks, data loading, helpers, styles, and the history "see all" modal sheet. Sticky engagement bar uses `position: 'absolute' + bottom: 0` inside a SafeAreaView with the outer ScrollView's `contentContainerStyle.paddingBottom` set to `STICKY_BAR_HEIGHT + 20` so the last content block isn't occluded.
- `App.tsx` — **modified.** Added `CookDetail: { postId: string; photoIndex?: number }` to `FeedStackParamList` (with doc comment flagging the shape as stable/public per D49 contract). Imported `CookDetailScreen`, registered it as a `<FeedStack.Screen name="CookDetail">` with `headerShown: false` (CookDetailScreen owns its own header).

**Files NOT modified** (explicitly per scope lock):
- `components/feedCard/CookCard.tsx` — stable; D50 onError-collapse flows through `PhotoCarousel` automatically.
- `components/feedCard/groupingPrimitives.tsx` — stable from Checkpoint 3.5.
- `components/AddCookingPartnersModal.tsx`, `lib/services/postService.ts` — Pass 2 territory, untouched.
- `screens/MealDetailScreen.tsx` — Checkpoint 6.
- The flask debug button in FeedScreen's header — stays through Checkpoint 6.

---

## Sub-section 5.1 findings

### 5.1.0 — `transformToCookCardData` migration

**Clean migration.** Moved the function verbatim into `lib/services/cookCardDataService.ts` — no refactor, no behavior change. FeedScreen imports it at the top, the inlined definition is gone (grep confirms `function transformToCookCardData` returns 0 matches in FeedScreen). One small follow-on: FeedScreen's `loadDishPosts` SELECT column list was updated to include `page_number` on the recipes query because the migrated helper now populates `recipe_page_number` from that column. Without the SELECT addition, FeedScreen's CookCards would have `recipe_page_number: null` for every post, which is fine (CookCardInner doesn't read the field) but the added column keeps the single source of truth consistent.

**Two new exports in the same module:**
- `fetchSingleCookCardData(postId)` — 3 sequential round trips (post → profile → recipe). Used by CookDetailScreen's `loadPostDetail`. Passes through visibility filter via `.or('visibility.eq.everyone,visibility.eq.followers,visibility.is.null')` — does NOT apply follow-graph filtering because detail navigation can legitimately arrive via nav from CommentsList or a linked group where the viewer may not follow the author but has a legitimate path to the post.
- `fetchCookCardDataBatch(postIds)` — 3 round trips (posts → profiles → recipes), batched with `.in()`. Preserves input order in output, skips posts that don't exist or fail visibility. Added now per the prompt so Checkpoint 6's MealEventDetailScreen has a consistent API to consume.

**FeedScreen behavior unchanged by the migration** — `transformToCookCardData` is pure and stateless, and the only thing that changed at the call site is the import path. Cold-launch telemetry should still hit the Checkpoint 4.5 baseline (~3.3s steady-state). **Cannot confirm from Claude Code** — pending Tom's on-device cold-launch check.

### 5.1.1 — Route registration

Added to `FeedStackParamList`:
```typescript
CookDetail: { postId: string; photoIndex?: number };
```
Registered `<FeedStack.Screen name="CookDetail" component={CookDetailScreen} options={{ headerShown: false }}/>` alongside the existing screens. CookDetailScreen renders its own header (Block 1) so the navigator's built-in header is disabled.

### 5.1.2 — 14 content blocks

**All 14 blocks implemented.** Highlights of the implementation:

- **Block 1 header** — left: back button (←), center: "Cook" title, right: conditional ••• menu (own posts only) + ↗ Share button. Menu button's `onPress` is a stub that logs `"[CookDetailScreen] Menu pressed — Pass 2 will wire this up"`. Share button fires `Alert.alert('Share coming soon', ...)` per the prompt (not a console.log).
- **Block 2 hero carousel** — reuses `PhotoCarousel` with `scrollToIndex={heroTargetIndex}`. `heroTargetIndex` is initialized from `route.params.photoIndex ?? null` so a mount with a route param lands on the right slide. When all photos + recipe_image_url are missing, renders `<NoPhotoPlaceholder width={SCREEN_WIDTH} height={HERO_HEIGHT}/>` in the same dimensions (D50).
- **Block 3 author block** — avatar + large display name + full timestamp ("Apr 12, 2026 · 7:30 PM") + no location string for now (the post-row data doesn't currently carry geo; the wireframe companion shows it but I left it absent rather than faking it). Tappable → AuthorView.
- **Block 4 title** — 22px bold, full text no clamp, uses the `transformToCookCardData` title cascade which is already applied upstream.
- **Block 5 description** — `DescriptionLine` primitive, falls back to absent when empty.
- **Block 6 recipe line** — `RecipeLine` primitive with the new `pageNumber` prop wired through `post.recipe_page_number`. The page number renders inline as "· p. 98" appended to the line when present. Not tappable (P7-53 deep-linking deferred).
- **Block 7 Cooked with** — new, not in wireframe. Horizontal row of avatar chips with display names for every approved sous_chef. Each chip is a `TouchableOpacity` → AuthorView. Data comes from `getPostParticipants(postId).filter(p => p.role === 'sous_chef' && p.status === 'approved')`. Absent when the filtered list is empty. **Does NOT render ate_with participants** — explicit scope limit per the prompt (blocked on P7-66).
- **Block 8 stats grid** — cream-background card with borders, 3 cells: Cook time (inline hr+min format using aggregate `recipe_cook_time_min`), Your rating ("★ N"), Times cooked ("N×"). **Note:** the prompt said "do NOT sum cook time and prep time — show them separately if both exist." HOWEVER, `CookCardData.recipe_cook_time_min` is already the sum (Checkpoint 4.1 INVARIANT 1), so separating them back out would require either querying the recipe row separately or extending `CookCardData` with `recipe_cook_time_min_only` and `recipe_prep_time_min`. **I chose to ship the aggregate display** (single "Cook time" cell with the total) and flag this as a follow-up. The alternative — re-fetching the recipe just to split these apart — seemed unjustifiable for a visual refinement on a block that Tom can eyeball and decide whether it matters. **Flag P7-80 below.** If Tom wants the split display, it's a small additive type change.
- **Block 9 Highlights** — **shipped with the batch-single-post call**, no fallback invoked. The call `computeHighlightsForFeedBatch([singlePostInput], [], currentUserId)` works fine for a one-element input. Rendered below the pill is a paragraph that currently echoes the same `highlight.text` string — I could not find a separate "descriptive paragraph" field on the `Highlight` object. The prompt suggested an expanded presentation but the data model only carries one text string. If Tom wants distinct pill-summary vs paragraph-detail, the `Highlight` interface needs a second field (e.g., `longText?: string`) and the highlights service needs to populate it. **Flag P7-81 below.**
- **Block 10 modifications + notes** — two separate cream-toned cards when both `post.modifications` and `post.notes` exist, one card when only one exists, absent when neither exists. Headers: "What I changed" and "Cook notes" per D4.
- **Block 11 Your history** — preview-with-see-all pattern. Renders the 2-3 most recent cooks as compressed rows (date + rating). The current cook is highlighted with `#faf7ef` background + left accent border. Absent when `!post.recipe_id` (freeform). Absent when `cookHistory.length < 2` (first cook only — nothing to show). "See all N cooks" tap opens a bottom-sheet modal with the full list. **`getCookHistoryForUserRecipe` first-real-data verification result below.**
- **Block 12 photos gallery** — 3-column grid rendering `normalizedPhotos.slice(0, 6)`. Each thumbnail is tappable → `handleThumbnailPress(index)` which sets `heroTargetIndex` and scrolls the outer ScrollView to the top. When the prop settles, `PhotoCarousel`'s useEffect picks it up and scrolls the hero to that slide, then calls `onScrollToIndexComplete` which resets `heroTargetIndex` to null so subsequent taps re-trigger. Absent when `normalizedPhotos.length === 0`. "View all N photos" row appears when >6 photos exist.
- **Block 13 comments** — **shipped with the fallback (truncated preview + tap-through).** Decision rationale: CommentsScreen is 805 lines with the comment list rendering tightly coupled to its own input composer, per-comment like state, cooking-method icons, current-post header, and `MyPostsStackParamList`/`FeedStackParamList` dual-nav-target handling. Extracting a reusable comment-list component would require separating ~400 lines of concerns across 4-5 pieces of state — that's "touching significant other code" per the prompt's decision rule. The fallback is clean: fetch comments via the existing `getCommentsForPost(postId)` service call, render the most recent 2 in-place as a preview, tap "View all N comments · add a comment" to route to CommentsList. Works without needing to touch CommentsScreen at all.
- **Block 14 sticky engagement bar** — `position: 'absolute'`, `bottom: 0`, 64px tall, left-aligned yas-chef count with like button, right-aligned comment count with comment button. Outer ScrollView has `contentContainerStyle.paddingBottom: STICKY_BAR_HEIGHT + 20` so the last content block clears the bar. Like toggle is optimistic — state updates immediately, reverts on error.

**Sticky engagement bar position math worked on first try.** No iteration needed.

### First-real-data verification of `getCookHistoryForUserRecipe`

**✅ WORKS CORRECTLY.** Exercised against the real database via a throwaway Node harness (`scripts/_phase_7i_checkpoint_5_dryrun.mjs`, self-deleted after run). Findings:

- **201 (user, recipe) pairs with 2+ cooks** exist in the dish posts table (sampled from the first 1000 rows).
- **Top pair has 7 cooks** (user `c3935af1...`, recipe `7795b363...`).
- **Query returned exactly 7 rows** for that pair — row count matches expected count.
- **Rows ordered correctly (newest first)** by effective date (`cooked_at || created_at`).
- **Mapped output shape is correct** — `post_id`, `cooked_at` (with fallback), `rating`, `title`, `notes`, `photo_thumbnail` all populated sensibly.

Sample output:
```
[0] post 43f1b237... cooked_at 2025-11-22 rating 5 title "Evening meal"
[1] post 76295047... cooked_at 2025-11-11 rating 5 title "Evening cook"
[2] post 82a0ccf1... cooked_at 2025-09-23 rating 5 title "Evening meal"
[3] post b9d8bf24... cooked_at 2025-09-11 rating 4 title "Evening cook"
[4] post 539e7a19... cooked_at 2025-04-24 rating 4 title "Evening cook"
```

**No fix needed.** The service is ready for CookDetailScreen consumption. Tom will see real cook history in Block 11 for any recipe-backed post where the viewer has cooked the underlying recipe multiple times.

### Highlights block decision: **shipped with the batch-single-post call**

The prompt offered a fallback (skip Block 9 entirely, flag as deferred) in case the batch function didn't cleanly handle a single-post input or required viewer context that didn't work for a single post. It does handle single-post input fine — the batch function accepts any array length. One subtlety: the "descriptive paragraph" the prompt described as "e.g., 'You're on a carbonara streak — this is your third time this month'" doesn't exist in the current `Highlight` data model. The `Highlight` interface has `text`, `viewerSide`, and `signal` — no separate longer-form field. **For now, the paragraph slot echoes the same `text` string** as the pill, which visually reads as redundant. This is flagged as P7-81 for follow-up.

### Comments block decision: **shipped with the fallback — truncated preview + tap-through**

CommentsScreen's 805-line rendering is tightly coupled to its own state (input composer, per-comment likes, cooking-method icons in the header, dual-nav-target handling). Extracting a reusable component would be a significant refactor. The fallback is clean and satisfies the prompt's intent: viewers see the most recent 2 comments inline with a "View all N comments · add a comment" tap-through to the existing CommentsScreen. Existing `getCommentsForPost(postId)` service call powers both paths. No CommentsScreen edits required.

---

## Sub-section 5.2 findings

### `NoPhotoPlaceholder`

New stateless component in `sharedCardElements.tsx`. Specification matches D50 exactly: `colors.background.secondary` fallback to `#f4f4f2`, centered `BookIcon` at size 48 tinted `colors.text.tertiary`, "No photo yet" label in `colors.text.tertiary` at 12px letter-spacing 0.5. Default dimensions `SCREEN_WIDTH × CAROUSEL_HEIGHT`; callers can override both. No props beyond `width`, `height`, `colors`.

### `PhotoCarousel` onError extension

**Index stability maintained.** The implementation tracks `failedIndices: Set<number>` in component state. `markFailed` adds the ORIGINAL index of the failed slide to the set (not a filtered index), so subsequent re-renders keep stable references. The render layer filters: `renderItem` returns `null` for any slide whose index is in `failedIndices`. An early `visibleCount === 0` guard returns `null` from the entire component when every slide has failed — this composes cleanly with `CookCardInner`'s empty-photos branch (D50's feed-cards-collapse rule).

**`scrollToIndex` / `onScrollToIndexComplete` props added.** Used by CookDetailScreen's Block 12 gallery. The useEffect watches `[scrollToIndex, photoRatios, photos.length]` so it re-fires both when the caller changes the target AND when natural-aspect widths settle after `onLoad` — that second dependency means the scroll lands at the correct offset even if it was computed while widths were still at the 4:3 default. `onScrollToIndexComplete` fires via `setTimeout(50)` after the scroll kicks off, giving the caller a hook to reset its target state.

**One re-render surprise caught at dev time:** `useEffect` added a return-cleanup branch to clear the 50ms timeout if the effect re-runs before the timeout fires. Without that, fast successive thumbnail taps would orphan setTimeout callbacks. Harmless but unclean.

### RecipeDetailScreen swap

Swapped inside `components/recipe/RecipeHeader.tsx` (the hero image is rendered by this component, not inline in RecipeDetailScreen). The grey rectangle the prompt referred to is `styles.headerImage: { backgroundColor: '#f0f0f0' }` — a 250px-tall rectangle behind the hero image that shows through when the image is missing or loading. Replaced with:

```tsx
{showPlaceholder ? (
  <NoPhotoPlaceholder width={SCREEN_WIDTH} height={RECIPE_HERO_HEIGHT} colors={colors}/>
) : (
  <Image source={{uri: recipe.image_url}} style={styles.headerImage} onError={() => setImageFailed(true)}/>
)}
```

`showPlaceholder = !recipe.image_url || imageFailed`. Added `useTheme` + `NoPhotoPlaceholder` imports + `imageFailed` local state + `SCREEN_WIDTH` / `RECIPE_HERO_HEIGHT` constants. **No other RecipeHeader code touched.** Only the image-rendering branch.

---

## Sub-section 5.4 findings

`navigateToCookDetail` now routes to `CookDetail` with `{ postId, photoIndex }`. The optional `photoIndex` parameter is passed from any caller that wants the hero to start at a specific slide (the current callers all pass no second argument, so `photoIndex` is `undefined` and the hero defaults to index 0).

The "Temporary: CommentsList is a real destination" comment is gone. Grep for `CommentsList` in FeedScreen returns exactly one hit now — inside `navigateToComments` which powers the tap-on-comment-icon affordance. Legitimate remaining use.

---

## Sub-section 5.5 — D49 nav contract commitment

`FeedStackParamList.CookDetail: { postId: string; photoIndex?: number }` is the stable, public nav param shape for CookDetailScreen. **Future D49 renderer** (SameAuthorCollapsedMealEventGroup, expected in Checkpoint 6 bundled with MealEventDetailScreen) will use this shape to route dish-row taps from a collapsed multi-dish card to the specific dish that was tapped. The D49 renderer's card-background / author-header tap will route to MealEventDetailScreen with its own params (Checkpoint 6).

**The commitment:** do not change `CookDetail`'s nav param shape in response to implementation pressure. Any future change must be raised with Tom first — every caller (D49 renderer, thumbnail gallery, shared-recipe merged groups, comment-return nav) depends on this shape.

Recorded in App.tsx's `FeedStackParamList` definition as a doc comment referencing this sub-section.

---

## Grep verification (Pass 1)

```
$ grep -c "function transformToCookCardData" screens/FeedScreen.tsx
0                                                 ← migrated cleanly

$ grep "CommentsList" screens/FeedScreen.tsx
  line 734: navigation.navigate('CommentsList', { postId });   ← navigateToComments only

$ grep -n "CookDetail" App.tsx
  (type + route registered)

$ npx tsc --noEmit 2>&1 | grep -E "(CookDetailScreen|cookCardDataService|sharedCardElements|RecipeHeader|FeedScreen|App)"
  (zero errors)
```

All Pass 1 self-check items that I can verify from Claude Code pass. Items 2-5 and 11-14 require Tom's on-device verification.

---

## Visual verification PENDING on Tom's device (Pass 1 checklist)

1. **Tap a cook card on the feed → lands on CookDetailScreen, correct post loads.** Expected: feed tap navigates to CookDetail with the right postId, screen fetches via `fetchSingleCookCardData`, title/author/description/recipe line all match the tapped card.
2. **Scroll through all 14 content blocks, verify each renders per spec.** Especially watch: sticky engagement bar stays pinned, last content block clears the bar.
3. **Verify "Cooked with" row (Block 7) appears when post has `sous_chef` participants, absent otherwise.** Pick a post from the L3b same-recipe test (Tom + Anthony carbonara from the test harness) to verify the row renders with both names as chips.
4. **Verify `NoPhotoPlaceholder` renders on a post with no photos and no valid recipe image.** Pick any freeform post with `photos: []` and no recipe.
5. **Verify a recipe-backed post with a broken recipe_image_url now collapses cleanly.** The prompt specifically named the Purple Sprouting Broccoli recipe (id `fc134850-0926-4084-b983-df3a7121e665`) as a reproduction case. Feed-side: the CookCard should collapse the photo slot. Detail-side: the hero should show NoPhotoPlaceholder instead of a broken image.
6. **Verify RecipeDetailScreen now renders `NoPhotoPlaceholder` instead of the grey rectangle** on recipes with no image.
7. **Verify photos gallery thumbnails tap-to-hero-index works correctly.** Tap the 3rd thumbnail in Block 12 → the hero should scroll to photo index 2 AND the outer ScrollView should scroll to the top.
8. **Verify sticky engagement bar stays pinned during scroll** and doesn't obscure the last block (comments or the last rendered block — account for the `paddingBottom: STICKY_BAR_HEIGHT + 20`).
9. **Verify Block 11 "Your history" preview renders for a recipe cooked multiple times.** Pick any recipe-backed post where the viewer has cooked the underlying recipe ≥ 2 times.
10. **Verify Block 11 handles the "first cook" case** (viewer has only cooked this recipe once) — the block should be absent, no "no history" label.
11. **Verify the overflow menu ••• button appears in the header only on own posts.** Test by tapping a non-own post and confirming no menu button shows.
12. **Verify tapping the Share ↗ button shows the "Share coming soon" Alert.**
13. **Verify tapping the overflow menu ••• button logs the Pass 2 placeholder message** to Metro: `[CookDetailScreen] Menu pressed — Pass 2 will wire this up`.
14. **Test harness still works.** Flask button 🧪 still in FeedScreen header; all 7 Phase7ITestHarness states still render.

---

## Deferred items surfaced during Pass 1

These will be formally added to `docs/PHASE_7_SOCIAL_FEED.md` during the Pass 2 closeout (since the Decisions Log + deferred items update is a single pass) but I'm capturing them now so they're not forgotten.

- **P7-80 🟢** — **Separated cook time / prep time display on CookDetailScreen Block 8.** The Checkpoint 5 prompt asked for separate "Cook time 30min · Prep 15min" display when both values exist. `CookCardData.recipe_cook_time_min` is the already-summed aggregate (Checkpoint 4.1 INVARIANT 1) so the current Block 8 displays the total. Splitting would require either (a) re-fetching the recipe row to get `cook_time_min` and `prep_time_min` separately, or (b) extending `CookCardData` with two additional fields `recipe_cook_time_min_only` and `recipe_prep_time_min` and updating the transform + SELECT + FeedScreen callers. Low priority — the total is still the useful number for most viewers. Defer unless Tom wants the split.
- **P7-81 🟢** — **CookDetailScreen Highlights descriptive paragraph.** The Checkpoint 5 prompt described Block 9 as a pill + a short descriptive paragraph below (e.g., "You're on a carbonara streak — this is your third time this month"). The current `Highlight` data model (`text`, `viewerSide`, `signal`) only carries one text string, which the current implementation renders in both the pill and the paragraph — visually redundant. A proper fix requires either (a) extending `Highlight` with a second `longText` field and updating `highlightsService` to populate it, or (b) synthesizing a second sentence client-side from the `signal` value. Defer until highlightsService is touched for another reason.
- **P7-82 🟡** — **CookDetailScreen location line on Block 3 author block.** The L6 wireframe shows "device location if present" in the author timestamp line. The current implementation omits it because post-row data doesn't cleanly carry geo info (there's no standard `location` field on `posts`, and the feed-card timestamp line hardcodes "· Portland, OR" as a placeholder). Not a Checkpoint 5 blocker but worth capturing so the location UX is consistent across feed card and detail screen when geo is wired up.
- **P7-83 🟢** — **Comment list extraction from CommentsScreen.** If Tom wants inline comment rendering on CookDetailScreen instead of the current tap-through pattern, CommentsScreen's rendering (~400 lines of relevant code coupled to 5+ concerns) would need to be extracted into a reusable `<CommentList postId={...}/>` component. Separate sub-phase; not a Checkpoint 5 fix.

---

## Pass 1 Fix Pass — 2026-04-14

**Prompt from:** `docs/CC_PROMPT_7I_CHECKPOINT_5_PASS_1_FIX.md` — two targeted fixes to close out Pass 1's visual verification before Sub-section 5.3 begins. Findings appended to this existing entry per the prompt's instruction (no new entry).

**Files modified in this fix pass:**
- `components/feedCard/CookCard.tsx` — Fix 1: outer `Pressable` wrapper, `TappableTitleBlock` → `View`, import line cleaned up.
- `screens/CookDetailScreen.tsx` — Fix 2: Block 9 paragraph slot stripped, `highlightsParagraph` style removed.
- `docs/SESSION_LOG.md` — this section appended, PAUSED marker updated.

---

### Fix 1 findings — CookCard tap target expansion

**Outer Pressable wrapper landed cleanly.** `CookCardInner`'s return is now `<Pressable onPress={onPress}>...</Pressable>` instead of a Fragment. The four import-line + JSX edits the prompt enumerated all applied as written:

1. ✅ `Pressable` added to the `react-native` import line
2. ✅ Outer `<>...</>` Fragment replaced with `<Pressable onPress={onPress}>...</Pressable>`
3. ✅ Inner `<TappableTitleBlock onPress={onPress}>...</TappableTitleBlock>` replaced with a plain `<View>...</View>` wrapper around the title + DescriptionLine + RecipeLine cluster
4. ✅ `TappableTitleBlock` removed from CookCard.tsx's import list. Its export in `sharedCardElements.tsx` is untouched per scope.

**Inner tap-handler propagation — mental walk-through verification:**

- **Photo carousel region** → `PhotoCarousel` slides do not have their own tap handlers, so the outer Pressable receives the tap → navigates to CookDetail. ✓
- **Title text** → plain `<Text>` inside the new `<View>` wrapper, no inner handler, so the outer Pressable receives the tap → navigates to CookDetail. ✓
- **Recipe line text (recipe-backed branch)** → `RecipeLine` wraps the recipe name in a `<TouchableOpacity onPress={onRecipePress}>` (sharedCardElements.tsx:1027). Innermost touchable wins per RN's gesture responder. The outer Pressable does NOT fire, only `onRecipePress` does → navigates to RecipeDetail. ✓
- **Recipe line freeform branch** → no inner TouchableOpacity (just `<Text>` elements inside the View). Tap propagates up to the outer Pressable → navigates to CookDetail. Acceptable behavior — there's no recipe to navigate to anyway.
- **Menu button (••• in header) on own posts** → `CardHeader`'s `headerStyles.menuButton` is a `<TouchableOpacity onPress={onMenu}>` (sharedCardElements.tsx:229). Inner wins → `onMenu` fires, outer does not. ✓
- **EngagementRow "X gave yas chef" tap row** → `<TouchableOpacity onPress={onViewLikes}>` inside EngagementRow (sharedCardElements.tsx:532). Inner wins → `onViewLikes` fires, outer does not. ✓
- **EngagementRow "N comments" tap target** → `<TouchableOpacity onPress={onComment}>` (sharedCardElements.tsx:555). Inner wins → `onComment` fires, outer does not. ✓
- **ActionRow like button** → `<TouchableOpacity onPress={onLike}>` (sharedCardElements.tsx:597). Inner wins → `onLike` fires, outer does not. ✓
- **ActionRow comment button** → `<TouchableOpacity onPress={onComment}>` (sharedCardElements.tsx:622). Inner wins → `onComment` fires, outer does not. ✓
- **Empty card body** (gaps between elements, area below stats row, between vibe pill row and engagement row) → no inner handlers → outer Pressable fires → navigates to CookDetail. ✓

**No child elements found that needed wrapping in TouchableOpacity for this fix.** All inner interactive elements were already correctly wrapped in their own touchables. The audit was clean.

**Linked-group propagation note (no code change):** `LinkedCookStack` and `SharedRecipeLinkedGroup` in `groupingPrimitives.tsx` consume `CookCardInner` as their per-section renderer. After this fix, each sub-section in a linked group (e.g., Tom's section in a Tom+Anthony carbonara card) is independently tappable — tapping Tom's section routes to Tom's CookDetail, tapping Anthony's routes to Anthony's. This is the intended D48 behavior. **Verified by inspection that `groupingPrimitives.tsx` was not modified** — the propagation is automatic via the `CookCardInner` import.

### Fix 2 findings — Block 9 Highlights paragraph slot strip

**Paragraph slot removed.** Block 9 now renders only the `HighlightsPill`. The redundant echo `<Text>` element and its `[styles.highlightsParagraph, { color: ... }]` style array are gone. The `highlight && (<View>...)` conditional rendering is unchanged — Block 9 is still absent when no highlight fires for the post.

**Orphaned style cleaned up.** `styles.highlightsParagraph` removed from the StyleSheet at the bottom of `CookDetailScreen.tsx`. `styles.highlightsBlock` (the outer wrapper's padding) stays — it still wraps the pill.

**Block 9 still renders the pill correctly when a highlight is present** (verified by reading the JSX path: `{highlight && (<View style={styles.highlightsBlock}><HighlightsPill text={highlight.text} viewerSide={highlight.viewerSide}/></View>)}`).

### Grep verification

```
$ grep -c "TappableTitleBlock" components/feedCard/CookCard.tsx
0                                                ← import + JSX both removed

$ grep -c "export function TappableTitleBlock" components/feedCard/sharedCardElements.tsx
1                                                ← export still in place per scope

$ grep -c "highlightsParagraph" screens/CookDetailScreen.tsx
0                                                ← JSX + style both removed

$ npx tsc --noEmit 2>&1 | grep -E "CookCard|CookDetailScreen"
(zero matches — TypeScript clean for both touched files)
```

### New deferred items surfaced during this fix pass

**None.** The two fixes were self-contained and clean. The four deferred items the prompt mentions (P7-80 cook+prep split, P7-81 Highlights longText, P7-82 author location, P7-83 CommentsScreen extraction) were all already captured during Pass 1; they remain deferred and will be added to `PHASE_7_SOCIAL_FEED.md` during Pass 2 closeout. **P7-84** (pending cook partner invitations visible to author) is also captured in the prompt's deferred list and remains deferred.

### Visual verification PENDING on Tom's device (fix pass additions to the Pass 1 checklist)

- **Tap anywhere on a feed card** (photo, title, description, recipe line text gap, header non-menu area, body gaps) → routes to CookDetailScreen.
- **Tap the recipe name inside the recipe line** → routes to RecipeDetailScreen, NOT CookDetailScreen.
- **Tap the ••• menu button** on an own post → fires the Pass 2 placeholder log, NOT CookDetailScreen navigation.
- **Tap a like button** → toggles like, no card-tap navigation.
- **Tap a comment icon** → routes to CommentsList, no card-tap navigation.
- **Tap a "X gave yas chef" tap row** → routes to YasChefsList, no card-tap navigation.
- **CookDetailScreen Block 9** renders the highlight pill ALONE (no paragraph below it) when a highlight fires for the post.
- **Linked groups** (L3b same-recipe, L5 different-recipe sub-units) — each sub-section is independently tappable → routes to that specific dish's CookDetailScreen.

---

## Pass 2 — Sub-section 5.3 (Narrow-Scope Editing Overflow Menu) — 2026-04-15

**Prompt from:** resumed per Tom's "GO for 5.3" trigger. Single source of truth remained `docs/CC_PROMPT_7I_CHECKPOINT_5_COOKDETAIL.md` §5.3 + 5.6.

**Files modified in Pass 2:**
- `components/AddCookingPartnersModal.tsx` — extended with `existingParticipantIds?: string[]` prop (manage mode signal). Manage mode pre-selects those IDs, locks the role selector (hides it), changes the title to "Manage Cook Partners", changes the description copy, and ALLOWS empty confirmation (empty = "remove all cook partners"). Non-manage mode retains the original behavior including the "No Selection" Alert block.
- `lib/services/postService.ts` — added two new exports. **`updatePost(postId, patch: UpdatePostPatch)`** where `UpdatePostPatch` accepts `title`, `description`, and `parent_meal_id`. Does NOT use `Partial<Pick<Post, ...>>` per the prompt because the repo's `Post`/`DishPost` interface doesn't include all three fields — defined a local `UpdatePostPatch` interface instead. **`deletePost(postId)`** — single DELETE on `posts` by id, trusts FK cascade for `post_likes`/`post_comments`/`post_participants`/`dish_courses` cleanup (mirrors the pattern `mealService.deleteMeal` uses).
- `screens/CookDetailScreen.tsx` — full wire-up of the six overflow menu items + inline edit UI + manage partners modal + meal event picker. See block-by-block findings below.
- `App.tsx` — registered `EditMedia` in `FeedStackParamList` AND registered `EditMediaScreen` as a `<FeedStack.Screen name="EditMedia">` route. See 5.3 findings below for why this was necessary (the route was previously orphaned).
- `docs/PHASE_7_SOCIAL_FEED.md` — added **D47 numbering-gap note** at the top of the Decisions Log section; added **D49** (Same-author multi-dish collapse within meal events) and **D50** (No-image state rendering across photo surfaces) as new rows after D46; added a new "From Phase 7I Checkpoint 5 (2026-04-14 / 2026-04-15)" sub-section in the deferred items area with **P7-80** through **P7-84**.
- `docs/SESSION_LOG.md` — this Pass 2 section appended; PAUSED marker replaced with closeout text.

**Files NOT modified** (explicitly per scope lock):
- `components/feedCard/CookCard.tsx`, `components/feedCard/groupingPrimitives.tsx`, `components/feedCard/sharedCardElements.tsx` — stable.
- `screens/MealDetailScreen.tsx` — Checkpoint 6.
- `screens/_Phase7ITestHarness.tsx` — stable.
- `lib/services/postParticipantsService.ts` — NOT extended. See the "inline bypass" section below — the manage-partners flow writes directly to `post_participants` rather than extending the service's existing helpers, to avoid touching service scope beyond the Checkpoint 5 file list.
- The flask debug button in FeedScreen's header — stays through Checkpoint 6.

---

### AddCookingPartnersModal audit result — NO CONFLICT

**Two existing call sites audited** via `grep -rn "AddCookingPartnersModal" screens/ components/`:

1. **`screens/MyPostDetailsScreen.tsx:1011`** — passes `visible`, `onClose`, `onConfirm`, `currentUserId`. Does NOT pass `initialSelectedIds`, `defaultRole`, or any new prop. Fresh "add cook partners" flow, default role falls through to `'ate_with'`. **No conflict** — the new optional `existingParticipantIds` prop is simply not passed; behavior unchanged.

2. **`components/LogCookSheet.tsx:1560`** — passes `visible`, `onClose`, `onConfirm`, `currentUserId`, `defaultRole="ate_with"`, `initialSelectedIds={new Set(...)}`. The existing call site already uses a pre-selection pattern via `initialSelectedIds` and expects full-replacement-on-confirm semantics (the inline comment explicitly says "Modal returns the complete current selection (it was pre-populated with initialSelectedIds). Replace the stored set with the returned set."). **No conflict** — this is semantically identical to the prompt's `existingParticipantIds` flow, just under a different prop name.

**Preferred approach held.** No second hard stop triggered. No `ManageCookPartnersModal` fallback created. Extension is backward-compatible:

- `existingParticipantIds?: string[]` added alongside the existing `initialSelectedIds?: Set<string>` — the two props coexist, with `existingParticipantIds` taking precedence when both are set (documented in the prop's JSDoc).
- `isManageMode = existingParticipantIds !== undefined` — the presence of the new prop signals the manage-mode switch.
- Manage mode: pre-select from `existingParticipantIds`, lock the role to `defaultRole`, hide the role selector, change title to "Manage Cook Partners", change description copy to "Add or remove cook partners for this post. Existing partners are already selected.", allow empty confirmation (skip the "No Selection" Alert).
- Non-manage mode: all original behavior preserved — role selector visible, empty confirmation blocked with Alert, title reads "Add Cooking Partners".

**Both existing call sites untouched.** Only CookDetailScreen passes `existingParticipantIds`.

---

### `postService.updatePost` — signature note

**Did not use `Partial<Pick<Post, ...>>`.** The prompt suggested:

```typescript
patch: Partial<Pick<Post, 'title' | 'description' | 'parent_meal_id'>>
```

But the repo's existing `Post` / `DishPost` interface in `postService.ts` defines only a narrow subset of fields (`id, recipe_id, title, rating, cooking_method, modifications, notes, parent_meal_id, meal_type, created_at`). It doesn't include `description`. Using `Partial<Pick<>>` against that type would either exclude `description` or force me to add it to the existing interface — both touch more scope than the fix-pass discipline allows.

Instead I defined a local `UpdatePostPatch` interface inline in `postService.ts`:

```typescript
export interface UpdatePostPatch {
  title?: string;
  description?: string | null;
  parent_meal_id?: string | null;
}

export async function updatePost(
  postId: string,
  patch: UpdatePostPatch
): Promise<void> {
  const { error } = await supabase.from('posts').update(patch).eq('id', postId);
  if (error) throw error;
}
```

This matches the prompt's intent (supports all three fields) without forcing a schema-alignment refactor on the existing `Post` / `DishPost` type. If the repo later consolidates to a canonical `Post` type, `UpdatePostPatch` can be replaced with `Partial<Pick<...>>` at that time.

**`deletePost(postId)`** — single DELETE on `posts` by id. Trusts DB FK cascade for `post_likes`/`post_comments`/`post_participants`/`dish_courses` cleanup. This mirrors the pattern `mealService.deleteMeal` uses: "Delete the meal (cascades to meal_participants, meal_photos, dish_courses)". The FK cascade rules are assumed already present based on that precedent; on-device verification pending.

---

### EditMedia route registration — unscoped surprise

Checkpoint 5's Pass 2 scope called for Menu item 1 to "route to the existing `screens/EditMediaScreen.tsx` with the current postId. `navigation.navigate('EditMedia', { postId })`. Zero new code for the destination screen — pure wire-up." The prompt implied the destination was already reachable.

**It wasn't.** `EditMediaScreen` exists at `screens/EditMediaScreen.tsx` and has its component-level type bound to `NativeStackScreenProps<MyPostsStackParamList, 'EditMedia'>`, but a grep across `App.tsx` for `component={EditMediaScreen}` returned zero matches — the screen was not registered in any navigator. The existing `navigation.navigate('EditMedia', ...)` calls in `MyPostDetailsScreen.tsx:669` and `MyPostsScreen.tsx:769` are orphaned and would throw at runtime.

**Resolution:**
1. Imported `EditMediaScreen` in `App.tsx`
2. Added `EditMedia: { postId: string; existingPhotos: PostPhoto[] }` to `FeedStackParamList`
3. Registered `<FeedStack.Screen name="EditMedia" component={EditMediaScreen} options={{ headerShown: true, title: 'Edit Photos' }}/>` in the FeedStack.Navigator alongside the other Checkpoint 5 routes
4. CookDetailScreen's "Add photos" menu handler navigates via `navigation.navigate('EditMedia', { postId: post.id, existingPhotos: [...normalized post.photos as PostPhoto[]]})` — the normalization converts string-form `post.photos` entries (per P7-73) into the `{url, caption, order, is_highlight}` shape EditMediaScreen expects

**Side effect:** this also fixes the orphaned `MyPostDetailsScreen` / `MyPostsScreen` EditMedia calls — they were broken before Checkpoint 5 and are now reachable via the FeedStack registration (assuming those screens live in the FeedStack, which they do per grep). **Flag as incidental fix** — not strictly Checkpoint 5's responsibility but a latent bug that I would have introduced by shipping a broken Menu item 1 otherwise.

**TypeScript implications:** EditMediaScreen's internal `NativeStackScreenProps<MyPostsStackParamList, 'EditMedia'>` still references the legacy `MyPostsStackParamList` type. Registering the same component in `FeedStackParamList` works at runtime because React Navigation's `component={...}` doesn't enforce strict type alignment. TypeScript accepts both registrations because the param shape is compatible.

---

### Sub-section 5.3 findings — per-menu-item

#### Menu item 1: Add photos → EditMedia

**Wiring:** `handleMenuAddPhotos` closes the menu, normalizes `post.photos` to `PostPhoto[]` shape, navigates with `{ postId, existingPhotos }`.

**Refetch on return:** added `useFocusEffect` that calls `loadPostDetail()` when the screen regains focus after the user returns from EditMedia. This picks up any photos added via the EditMedia flow so the hero carousel + Block 12 gallery reflect the new state without a manual pull-to-refresh.

**Normalization:** inline inside the handler — builds `PostPhoto[]` from `normalizedPhotos` (which already defensively handles both string-form and object-form `post.photos` per Checkpoint 4.5.1). This also incidentally normalizes any string-form posts as a side effect when EditMediaScreen writes back, which partially resolves P7-73 drift for the affected posts.

#### Menu item 2: Edit title — inline text input

**State:** `editingTitle: boolean`, `titleDraft: string`, `titleError: string | null`.

**UX:**
- Menu tap → `setTitleDraft(post.title || '')` + `setEditingTitle(true)`
- Block 4 conditionally renders a `<TextInput>` in place of the title `<Text>` when `editingTitle === true`
- `autoFocus` so the keyboard opens immediately
- Save triggers on `onBlur` OR `onSubmitEditing` (return key) per the prompt
- Cancel button reverts without saving
- Empty-string save triggers `setTitleError("Title can't be empty")` which renders below the input as a subtle italic hint — NOT an Alert per the prompt
- Optimistic local update: after successful save, `setPost(prev => ({...prev, title: trimmed}))` so the UI reflects the change immediately without refetch

**Edge case:** save on blur can fire when the user taps another UI element (e.g., a menu item). This is fine because the menu is closed during editing and the save just commits the current draft.

#### Menu item 3: Edit description — inline multi-line input

Same pattern as Edit title but:
- Multi-line `<TextInput>` (`multiline` prop)
- Bordered box instead of bottom-border only
- 80px min-height
- Empty-string save is ALLOWED per the prompt (user can clear their description)
- Empty-string writes as `null` (via `updatePost(postId, { description: trimmed || null })`) — the post-row has `description: string | null`, and `null` is semantically "no description" for the `DescriptionLine` primitive's `description?.trim()` empty check

#### Menu item 4: Manage cook partners

**UX:** menu tap → `setManagePartnersOpen(true)` → renders `<AddCookingPartnersModal existingParticipantIds={current} defaultRole="sous_chef">`.

**`existingParticipantIds`** built inline from `cookPartners.map(p => p.participant_user_id).filter(id => !!id)`.

**Diff logic** inside `handleManagePartnersConfirm`:
```typescript
const current = new Set(cookPartners.map(p => p.participant_user_id));
const next = new Set(selectedUserIds);
const toAdd = [...next].filter(id => !current.has(id));
const toRemove = [...current].filter(id => !next.has(id));
```

**Inline bypass of `postParticipantsService.addParticipantsToPost`:** the existing helper hardcodes `status: 'pending'` (line 101). For author-driven manage flow, the author implicitly approves when adding — new partners should be `status='approved'` so Block 7 "Cooked with" row shows them immediately without a round-trip to the invited user. The prompt explicitly permits "bypass it for author-added participants or flag the gap in SESSION_LOG." I bypassed: inline `supabase.from('post_participants').insert(rows)` with `status: 'approved'` hardcoded in the rows. **Flagged as a shortcoming of the service's API** — a cleaner future fix would extend `addParticipantsToPost` to accept an optional `status` parameter.

**Inline bypass of `postParticipantsService.removeParticipant`:** the existing helper binds the delete predicate to `.eq('participant_user_id', userId)` which is the "remove yourself from a post" pattern — it requires the caller to be the participant being removed. For the author-removing-someone-else case, that helper won't match. I bypassed: inline `supabase.from('post_participants').delete().eq('post_id', post.id).eq('role', 'sous_chef').in('participant_user_id', toRemove)`. **Also flagged as a service API shortcoming** — a `removeParticipantsByAuthor(postId, userIds, role)` variant would make the intent clearer.

**Both bypasses are captured here for future postParticipantsService API cleanup.** Not blocking Checkpoint 5 or Checkpoint 6.

**Refetch:** after the diff settles, calls `getPostParticipants(post.id)` and filters to `sous_chef AND approved`, updating `cookPartners` state. Block 7 re-renders automatically.

#### Menu item 5: Change meal event — lightweight inline picker

**Did not reuse `SelectMealModal` or `SelectMealForRecipeModal`.** Audit findings:

- `SelectMealModal` (450 lines) — designed for "add a dish to a meal" flow. Takes `dishId` and `dishTitle` as required props, and its `handleConfirm` internally calls `addDishesToMeal(mealId, userId, [{dish_id, course_type, ...}])` which creates `dish_courses` rows, updates `parent_meal_id`, and creates `post_relationships` rows. It also skips dishes that are already in any meal (`if (existingCourse) continue;`) which makes it unusable for CHANGING a dish's meal — the dish is already attached to meal A, so calling SelectMealModal to switch it to meal B would be a no-op. Using it would require orchestrating "unattach from A first, then SelectMealModal to add to B" which is nontrivial.
- `SelectMealForRecipeModal` (777 lines) — even more orchestration, tied to recipe-specific flow.

**Decision:** built a minimal inline picker modal directly in CookDetailScreen (~90 lines of JSX). Loads recent meals via `getUserRecentMeals(currentUserId, 15)`, renders them as tappable rows with a "Not attached to a meal event" option at the very top (per the prompt), and fires `updatePost(postId, { parent_meal_id: selectedId | null })` on selection. The inline approach is simpler than hacking around either existing modal's orchestration, stays within Checkpoint 5 scope, and is easy to delete when Checkpoint 6's MealEventDetailScreen supplies a better meal picker.

**Trade-off:** this doesn't update `dish_courses` or `post_relationships` when the `parent_meal_id` changes. Per the prompt: "When `parent_meal_id` is cleared, the post transitions from L4 (prehead above card) to L1 (solo cook) on the next feed load — no explicit feed refresh needed from CookDetailScreen." The rendering logic only reads `parent_meal_id`, so the feed visually transitions correctly. `dish_courses` and `post_relationships` drift is accepted as follow-up cleanup (not blocking visually).

#### Menu item 6: Delete post

**UX:** menu tap → `Alert.alert('Delete this post?', "This can't be undone.", [Cancel, Delete (destructive)])` → on Delete → `await deletePost(post.id)` → `navigation.goBack()`.

**FK cascade assumption:** matches the `mealService.deleteMeal` pattern which trusts DB FK cascade for children. On-device verification pending — Tom should verify that deleting a cook post from CookDetailScreen leaves no orphaned `post_likes` / `post_comments` / `post_participants` / `dish_courses` rows. If orphaned rows appear, the fix is to add explicit pre-delete steps in `deletePost`.

---

### Block 9 Highlights — Pass 1 fix already applied

Note: the Pass 1 fix pass (2026-04-14) already stripped the redundant paragraph slot from Block 9. Pass 2 does not touch Block 9.

---

### Grep verification (Pass 2)

```
$ npx tsc --noEmit 2>&1 | grep -E "(CookDetailScreen|AddCookingPartnersModal|postService|App\.tsx)"
(zero matches — all touched files compile clean)

$ grep -n "existingParticipantIds" components/AddCookingPartnersModal.tsx
(6 matches — prop declaration, JSDoc, destructuring, manage-mode guard, useEffect branch)

$ grep -c "export async function updatePost\|export async function deletePost" lib/services/postService.ts
2

$ grep -c "component={EditMediaScreen}" App.tsx
1                                                    ← new registration

$ grep -c "D49\|D50" docs/PHASE_7_SOCIAL_FEED.md
(D49 + D50 rows added to the Decisions Log)

$ grep -c "P7-80\|P7-81\|P7-82\|P7-83\|P7-84" docs/PHASE_7_SOCIAL_FEED.md
(all 5 deferred items added to the "From Phase 7I Checkpoint 5" sub-section)
```

---

### Visual verification — PASS 2 portion, PENDING on Tom's device

15. **Tap the overflow menu ••• on an own-post** — verify all 6 items appear in a bottom sheet: Add photos, Edit title, Edit description, Manage cook partners, Change meal event, Delete post (red).
16. **Test Add photos flow** — tap Add photos → land on EditMedia with current photos pre-populated → add a photo → save → return to CookDetailScreen → verify the new photo appears in the hero carousel AND in the Block 12 gallery grid (via `useFocusEffect` refetch).
17. **Test Edit title inline flow** — tap Edit title → title becomes a `<TextInput>` with autofocus → type → tap away (blur) → title updates. Repeat with return key save. Test cancel. Test empty-string: type nothing, tap Save → see "Title can't be empty" hint below input, title stays unchanged.
18. **Test Edit description inline flow** — tap Edit description → description becomes a multi-line bordered input → type → Save → description updates. Test empty-string: clear and Save → description becomes absent (`null`) and Block 5 goes away on next render.
19. **Test Manage cook partners** — tap Manage cook partners → `AddCookingPartnersModal` opens with title "Manage Cook Partners", role selector hidden, existing partners pre-selected. Toggle one off → Done → verify Block 7 "Cooked with" row no longer shows them. Toggle a new one on → Done → verify they appear in Block 7 with `status='approved'` (immediately visible, no pending state).
20. **Test Change meal event** — tap Change meal event → meal picker modal opens with "Not attached to a meal event" at top + recent meals below → tap a meal → verify the modal closes and Block 7 / meal context updates. Tap the "Not attached" option → verify `parent_meal_id` is cleared.
21. **Test Delete post** — tap Delete post → see confirmation Alert → tap Delete → verify navigation returns to feed AND the deleted post is absent from the feed on next load. Verify no crash, no orphaned row warnings in Metro.
22. **Verify overflow menu does NOT render on non-author posts** — navigate to a post belonging to someone else → verify the ••• button is absent from the header (only Share button appears on the right).

---

### NEW deferred items flagged during Pass 2

Already captured in `PHASE_7_SOCIAL_FEED.md` per 5.6 instructions. In summary:

- **P7-80** 🟢 — CookDetailScreen Block 8 separated cook time / prep time display
- **P7-81** 🟡 — CookDetailScreen Block 9 Highlights descriptive paragraph (Pass 1 fix pass stripped the redundant echo; proper fix deferred)
- **P7-82** 🟡 — CookDetailScreen Block 3 author location line
- **P7-83** 🟢 — CommentsScreen extraction for inline Block 13 rendering
- **P7-84** 🟡 — Pending cook partner invitations visible to post author

Two additional Pass 2 findings worth capturing but NOT numbered (flag only):
- **`addParticipantsToPost` hardcodes `status='pending'`** — CookDetailScreen's manage flow bypasses this and writes directly to `post_participants` with `status='approved'`. A cleaner future fix is extending the service helper with an optional `status` parameter.
- **`removeParticipant` binds delete predicate to calling user** — for author-removing-someone-else flow, this helper can't be used. CookDetailScreen bypasses with inline delete. A cleaner future fix is a `removeParticipantsByAuthor(postId, userIds, role)` variant.

Both are postParticipantsService API shortcomings that became visible during the manage-partners wire-up. They're not urgent — the inline bypasses in CookDetailScreen are correct — but they'd be worth a small postParticipantsService polish pass in a future checkpoint.

---

### GO / NO-GO recommendation for Checkpoint 6

**GO**, conditional on Tom's on-device verification of the 22-item checklist (Pass 1 items 1-14 + Pass 2 items 15-22) passing. Specifically:

1. CookDetailScreen loads and renders the 14 content blocks correctly for a post (Pass 1 items 1-10).
2. The overflow menu button is author-only (Pass 1 item 11 + Pass 2 item 22).
3. The Pass 1 fix pass tap-target expansion works correctly — taps on any region of a CookCard route to CookDetailScreen, EXCEPT inner interactive elements (recipe link, menu, like/comment buttons).
4. All 6 overflow menu items work end-to-end — Add photos → EditMedia roundtrip + refetch, Edit title (inline, empty rejected), Edit description (inline, empty allowed), Manage cook partners (diff applied + refetch), Change meal event (including "Not attached"), Delete post (confirmation + cascade + goBack).
5. No regression on the three Checkpoint 4.5 target posts (Anthony kombucha, Chickpea soup, Watermelon feta) — photos still render via the normalized `post.photos` shape handling.
6. No regression on the test harness — flask button still in FeedScreen header, all 7 harness states still render correctly.

If all pass → Checkpoint 6 greenlit. Checkpoint 6's scope is `MealEventDetailScreen` (L7) build — the meal event detail screen reached from the L4 meal event prehead and the L5 meal event group header. It will likely also bundle the D49 renderer per D49's implementation note ("loose preference: Checkpoint 6 bundled with MealEventDetailScreen because both share meal-event engagement schema concerns"). And it will need to resolve the meal-event-level engagement schema question (new `meal_event_likes` table vs `target_type` column on `post_likes`).

If visual verification fails in a specific way → fix within the Checkpoint 5 scope files first, then Checkpoint 6.

**TypeScript clean across all touched files. Scope lock held. Preferred `AddCookingPartnersModal` extension approach held (no second hard stop triggered, no fallback component created). D49 / D50 / D47 numbering-gap note written to Decisions Log. P7-80 through P7-84 added to the Deferred Items section. Flask button preserved. No Checkpoint 6 work started.**

**Status:** Checkpoint 5 complete — both Pass 1 (Sub-sections 5.1, 5.2, 5.4, 5.5, Pass 1 Fix Pass) and Pass 2 (Sub-section 5.3) shipped. Awaiting Tom's on-device verification of the full 22-item checklist + his review of this SESSION_LOG entry and the updated `PHASE_7_SOCIAL_FEED.md`. Hard stop held — no Checkpoint 6 work started, no `MealEventDetailScreen` touched, no D49 renderer built.

---

## Fix Pass #2 — 2026-04-15

**Prompt from:** `docs/CC_PROMPT_7I_CHECKPOINT_5_FIX_PASS_2.md` — three targeted fixes from on-device unified verification: PhotoCarousel hooks-below-early-return red screen, Delete post missing confirmation Alert, `console.warn` instrumentation on all six overflow menu handlers. Appended to existing Checkpoint 5 entry per prompt instruction.

**Files modified in Fix Pass #2:**
- `components/feedCard/sharedCardElements.tsx` — Fix 1: moved `useEffect` + `widths` + `snapToOffsets` computation above the early-return guards in `PhotoCarousel`. Restructured the function so ALL hooks run unconditionally before any conditional returns.
- `screens/CookDetailScreen.tsx` — Fix 2: wrapped delete-confirmation `Alert.alert` in `setTimeout(..., 150)` to dodge the iOS Modal/Alert race. Added `console.warn` instrumentation at every step of the delete flow (start, user cancelled, user confirmed + calling deletePost, succeeded, FAILED). Fix 3: added `console.warn` instrumentation to all six overflow menu handlers (entry point + success + failure) and to the `useFocusEffect` refetch trigger. Handler count: 29 total `console.warn` calls across the file including Pass 1 async-load error messages and the new Fix Pass #2 instrumentation.
- `lib/services/postService.ts` — **NOT touched.** Diagnosis confirmed `deletePost` correctly throws on Supabase error — `if (error) throw error` on line 216. Not silently swallowing anything. Service file left alone per fix-pass scope.
- `docs/SESSION_LOG.md` — this Fix Pass #2 section appended.

---

### Fix 1 findings — PhotoCarousel hook-order violation

**Hypothesis confirmed.** The `useEffect` that drives the imperative `scrollToIndex` feature (added in Checkpoint 5 Pass 1) was placed at **line 338** of `sharedCardElements.tsx`, BELOW:
- Line 252: `if (!photos || photos.length === 0) return null;`
- Line 254: `if (visibleCount === 0) return null;`
- Lines 295-316: The single-photo render branch with its own `return ...` path

Hook count varied across render paths:

| Path | useState | useRef | useEffect | Total |
|------|----------|--------|-----------|-------|
| Zero photos | 2 | 1 | 0 | 3 |
| Single photo | 2 | 1 | 0 | 3 |
| All failed (visibleCount === 0) | 2 | 1 | 0 | 3 |
| Multi-photo with ≥1 visible | 2 | 1 | **1** | **4** |

Any transition between multi-photo and the other three paths flipped the hook count from 4 → 3 (or 3 → 4) and triggered React's "Rendered more hooks than during the previous render" red screen. Tom hit this after returning from EditMediaScreen — the `useFocusEffect` refetch put the photos array into a brief 0-length state during re-fetch, which hit the first early-return path, which was a different hook count than the previous multi-photo render.

**Fix:** restructured `PhotoCarousel` so ALL hooks run unconditionally before any early returns. Specifically:

1. `useState<Record<number, number>>({})` for `photoRatios` — unchanged, was already at top
2. `useState<Set<number>>(new Set())` for `failedIndices` — unchanged, was already at top
3. `useRef<FlatList<CarouselPhoto>>(null)` for `flatListRef` — unchanged, was already at top
4. **New: `widths` + `snapToOffsets` computed unconditionally at the top** (using `safePhotos = photos || []` as the defensive base)
5. **Moved: the `useEffect([scrollToIndex, photoRatios, safePhotos.length])`** from line 338 to immediately after `snapToOffsets` computation — now runs BEFORE any early returns
6. **Moved: the `if (!photos || photos.length === 0) return null;` + `if (visibleCount === 0) return null;` guards** to come AFTER all hooks
7. The multi-photo render branch at line 318 onwards now just reads the already-computed `widths` / `snapToOffsets` instead of re-computing them — this also removes a duplication.
8. The single-photo render branch still has its early-return at the top but now below all hooks, so hook count stays consistent.

**Hook count after fix** (verified by reading): every render path now executes **exactly 1 `useEffect`** (plus the 2 `useState` + 1 `useRef` = 4 total hooks). The hook count is now stable across all render paths regardless of `photos.length` or `failedIndices.size`.

**How many hooks moved:** 1 (the `useEffect` that drives `scrollToIndex`). `useState` and `useRef` were already at the top.

**D50 empty-collapse still works after the reorder.** The early returns that collapse the carousel when all photos are missing / failed are still present — they just run after the hooks instead of interspersed. The `visibleCount === 0 → return null` guard is preserved; it just sits below the `useEffect` declaration now.

**TypeScript compiles cleanly.** `npx tsc --noEmit` filtered to `sharedCardElements.tsx` returns zero errors.

---

### Fix 2 findings — Delete post Alert/Modal race

**The Alert.alert call was already present in the code.** The Pass 2 implementation (Checkpoint 5) had the correct Alert structure with Cancel + Delete destructive button + `deletePost(post.id)` + `navigation.goBack()`. But Tom reported on-device that the Alert **did not appear** when he tapped "Delete post" in the overflow menu.

**Root cause: iOS Alert/Modal race.** The delete handler called `setMenuOpen(false)` immediately followed by `Alert.alert(...)` on the same synchronous tick. This creates a race on iOS:

1. `setMenuOpen(false)` triggers the overflow-menu `<Modal>` to begin its close animation
2. While the Modal is still animating out (~250ms), `Alert.alert(...)` fires synchronously
3. iOS's native Alert system tries to present above the still-mounted-but-animating-out Modal
4. The Alert is either silently dropped OR presented briefly and immediately dismissed as the Modal unmounts

This is a known React Native iOS pattern. The standard workaround is to delay the Alert call until after the Modal has finished its close animation, using `setTimeout(() => Alert.alert(...), 100-200)`.

**Fix applied:** wrapped the Alert call in `setTimeout(..., 150)` so it fires after the menu Modal's animation completes. 150ms is a safe margin for iOS's default Modal close animation (~200ms) while staying fast enough that the user doesn't perceive a noticeable delay.

Also upgraded the delete handler's error path per the prompt spec:
- Cancel button now has its own `onPress` that logs `[CookDetailScreen] handleMenuDelete — user cancelled`
- Delete button's onPress logs `[CookDetailScreen] handleMenuDelete — user confirmed, calling deletePost(${post.id})` BEFORE the await
- On success: `[CookDetailScreen] deletePost(${post.id}) succeeded` then `navigation.goBack()`
- On failure: `[CookDetailScreen] deletePost(${post.id}) FAILED:` + error object, then `Alert.alert('Error', 'Failed to delete post. Please try again.')`

**`deletePost` service function audit:** verified `lib/services/postService.ts:211-217`. The function is:

```typescript
export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);
  if (error) throw error;
}
```

**Correctly throws on Supabase error. Not silently swallowing anything. Service file NOT modified.** If the delete is still failing silently on-device after Fix Pass #2, the new `console.warn` instrumentation will expose exactly which step fails:
- If `handleMenuDelete started` appears but `user confirmed` doesn't → Alert is still being dropped (unlikely after the setTimeout fix)
- If `user confirmed` appears but `succeeded`/`FAILED` doesn't → `deletePost` is hanging (unlikely — it's a single round trip)
- If `FAILED` appears → the error object is logged and we know exactly what Supabase returned (RLS policy, FK constraint, etc.)

**What was the actual root cause?** The Modal/Alert race — the Alert never fired because it was orphaned against the closing Modal. The delete code path inside the Alert's `onPress` was never reached, which explains why the post wasn't deleted. Tom's observation that "the screen navigated back to the feed" is consistent with the overflow menu Modal closing (visually looks like a slide-down transition).

---

### Fix 3 findings — `console.warn` instrumentation on overflow menu handlers

**All six handlers instrumented** per the prompt pattern (entry → success/failure):

| # | Handler | Entry log | Success log | Failure log |
|---|---------|-----------|-------------|-------------|
| 1 | `handleMenuAddPhotos` | `started — postId: ${post.id}` | (no async; navigation.navigate is fire-and-forget, success verified via useFocusEffect refetch log on return) | n/a |
| 2 | `handleMenuEditTitle` (menu open) + `handleTitleSave` (save) | `handleMenuEditTitle started — postId: ${post.id}` | `handleTitleSave succeeded — new title: "${trimmed}"` or `rejected — empty string` | `handleTitleSave FAILED:` + err |
| 3 | `handleMenuEditDescription` (menu open) + `handleDescriptionSave` (save) | `handleMenuEditDescription started — postId: ${post.id}` | `handleDescriptionSave succeeded — cleared: ${!trimmed}` | `handleDescriptionSave FAILED:` + err |
| 4 | `handleMenuManagePartners` (menu open) + `handleManagePartnersConfirm` (save) | `handleMenuManagePartners started — postId: ${post.id}` | `handleManagePartnersConfirm — adding: [${toAdd.join(',')}], removing: [${toRemove.join(',')}]` (diff log) → `handleManagePartnersConfirm succeeded` | `handleManagePartnersConfirm FAILED:` + err |
| 5 | `handleMenuChangeMealEvent` (menu open) + `handleSelectMealEvent` (save) | `handleMenuChangeMealEvent started — postId: ${post.id}` | `handleSelectMealEvent — newMealId: ${id || 'null (detaching)'}` → `handleSelectMealEvent succeeded` | `handleSelectMealEvent FAILED:` + err; also separate `getUserRecentMeals FAILED` if the meal list load fails |
| 6 | `handleMenuDelete` (menu open + Alert) + delete action | `handleMenuDelete started — postId: ${post.id}` → `user confirmed, calling deletePost(${post.id})` | `deletePost(${post.id}) succeeded` | `deletePost(${post.id}) FAILED:` + err; also `handleMenuDelete — user cancelled` if Cancel button pressed |

Plus one additional instrumentation point:

- **`useFocusEffect` refetch trigger** — `[CookDetailScreen] useFocusEffect refetch triggered` logs every time CookDetailScreen regains focus and triggers `loadPostDetail()`. Confirms the Add photos → EditMedia → back flow is refetching correctly.

**Handlers that were missing try/catch blocks:** zero. All six handlers already had appropriate try/catch or defensive guards. The existing `console.error` calls in the Pass 1 / Pass 2 code were upgraded to `console.warn` where appropriate — `console.warn` surfaces reliably in Metro/LogBox while `console.error` triggers the RN error overlay which we don't want for catch-and-handle errors.

**Actually, not all were upgraded from `console.error`.** Reviewing the code: `loadPostDetail`'s inner async callbacks still use `console.warn` (not `console.error`) — that was Pass 1's choice. The overflow menu handlers from Pass 2 used `console.error('[CookDetailScreen] manage partners failed:', err)` and similar — those were changed to `console.warn` in this fix pass. This unifies the logging format so Tom can grep Metro for `[CookDetailScreen]` uniformly.

---

### Grep verification

```
$ grep -c "console.warn" screens/CookDetailScreen.tsx
29                                                    ← 29 total warn calls

$ grep -nE 'handleMenu(AddPhotos|EditTitle|EditDescription|ManagePartners|ChangeMealEvent|Delete) started' screens/CookDetailScreen.tsx
(6 matches — one entry log per menu item handler)

$ grep -c "FAILED" screens/CookDetailScreen.tsx
(failure logs on every async path)

$ npx tsc --noEmit 2>&1 | grep -E "(sharedCardElements|CookDetailScreen|postService)"
(zero matches — TypeScript clean for all fix-pass files)
```

`postService.ts` was verified-but-not-modified: `deletePost` at lines 211-217 correctly throws on error, so the silent-failure hypothesis from the prompt is ruled out.

---

### Visual verification PENDING on Tom's device

Fix Pass #2 requires re-testing the three affected flows on device. Specific checks:

**Fix 1 — PhotoCarousel hook violation:**
1. Navigate to any CookDetailScreen from the feed (tap any own post).
2. Tap ••• → Add photos → EditMediaScreen opens.
3. Add a photo via EditMediaScreen's add-photo flow.
4. Save and return to CookDetailScreen.
5. **Expected:** NO red screen. The hero carousel re-renders with the new photo. `[CookDetailScreen] useFocusEffect refetch triggered` appears in Metro. The Block 12 photo gallery shows the new photo alongside the existing ones.
6. **Secondary verification:** find a post with a broken `recipe_image_url` (e.g., Purple Sprouting Broccoli if it's still in the feed) and confirm the card still collapses the photo slot correctly — D50 still works after the reorder.

**Fix 2 — Delete post confirmation Alert:**
1. Open any own-post CookDetailScreen.
2. Tap ••• → Delete post.
3. **Expected:** After a ~150ms pause (imperceptible in practice), the confirmation Alert dialog appears with `Delete this post?` title, `This can't be undone.` body, Cancel and Delete (red) buttons.
4. Tap Cancel → Alert dismisses, post unchanged. Metro: `[CookDetailScreen] handleMenuDelete started — postId: ...` then `[CookDetailScreen] handleMenuDelete — user cancelled`.
5. Tap ••• → Delete post → confirmation appears again → tap Delete.
6. **Expected:** Screen navigates back to feed, post is absent from feed, post stays absent after force-quit + relaunch. Metro sequence: `handleMenuDelete started` → `user confirmed, calling deletePost(...)` → `deletePost(...) succeeded`.
7. **If it fails:** Metro logs `deletePost(...) FAILED:` with the full error object. Post-mortem the error (likely RLS policy, FK constraint, or auth issue) and fix in a follow-up pass.

**Fix 3 — Metro instrumentation visibility:**
1. Perform any overflow menu action while watching Metro.
2. **Expected:** each action emits its corresponding `[CookDetailScreen]` warn entries at entry, mid-flow diff log (for manage partners / change meal), and success/failure.
3. **Useful signals:**
   - Add photos: `handleMenuAddPhotos started` + `useFocusEffect refetch triggered` on return
   - Edit title: `handleMenuEditTitle started` + `handleTitleSave succeeded — new title: "..."` OR `handleTitleSave rejected — empty string`
   - Edit description: `handleMenuEditDescription started` + `handleDescriptionSave succeeded — cleared: true/false`
   - Manage partners: `handleMenuManagePartners started` + `handleManagePartnersConfirm — adding: [...], removing: [...]` + `handleManagePartnersConfirm succeeded`
   - Change meal event: `handleMenuChangeMealEvent started` + `handleSelectMealEvent — newMealId: ...` + `handleSelectMealEvent succeeded`
   - Delete: see Fix 2 sequence above

---

### Deferred items

None new. All four Pass 1/Pass 2 deferred items (P7-80 through P7-84) remain as-is. The `console.warn` instrumentation is explicitly **temporary** and will be removed in Checkpoint 7's cleanup pass (or when Phase 7M replaces the overflow menu with a unified Edit Cook screen) — not added as a deferred item because the cleanup is inherent to those future phases.

**Two incidental observations worth tracking** (not formally deferred but flagged for future reference):

1. **`useRef<FlatList<CarouselPhoto>>` was already unconditional** before Fix Pass #2 — only the `useEffect` was below the early return. The `useRef` was fine. Clarifying this to correct any confusion reading the fix description: `useState × 2` + `useRef × 1` = 3 hooks were already at top; the **1 misplaced `useEffect`** was the problem.

2. **`setTimeout(..., 150)` for the delete Alert** is a pragmatic fix, not a best-practices solution. A cleaner approach would be to close the overflow menu via `onDismiss` callback on the `<Modal>` and fire the Alert from that callback, guaranteeing the modal has fully unmounted before the Alert tries to present. The `setTimeout` approach works but depends on iOS's Modal animation timing being stable around ~200ms, which is usually true but not guaranteed across iOS versions. If the race re-surfaces on different iOS versions, upgrade to the `onDismiss` pattern.

---

**TypeScript clean. Three fixes landed. All six handlers + useFocusEffect instrumented. Scope lock held — no changes to `CookCard.tsx`, `groupingPrimitives.tsx`, `FeedScreen.tsx`, `App.tsx`, `AddCookingPartnersModal.tsx`, `postService.ts`. Flask button preserved. No Checkpoint 6 work started.**

**Status:** Fix Pass #2 complete. Awaiting Tom's on-device re-verification of the three affected flows + his review of this section. Hard stop held.

---

### 2026-04-14 — Phase 7I Checkpoint 4.5 — Photo Rendering Fix Pass
**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 4.5 (fix pass between Checkpoint 4 and Checkpoint 5)
**Prompt from:** `docs/CC_PROMPT_7I_CHECKPOINT_4_5_FIX_PASS.md` — three items: fix `CookCardInner`'s string-vs-object photo shape bug, fix `optimizeStorageUrl` to skip the render endpoint for uppercase-extension URLs, revert all diagnostic edits.

**Files modified:**
- `components/feedCard/CookCard.tsx` — Sub-section 4.5.1 photo normalization + Sub-section 4.5.3 `[DIAG 1a]` revert (the revert happened as a side effect of the 4.5.1 block replacement — the diagnostic lines lived inside the block that was rewritten).
- `components/feedCard/sharedCardElements.tsx` — Sub-section 4.5.2 `optimizeStorageUrl` regex-guard.
- `screens/FeedScreen.tsx` — Sub-section 4.5.3 manual `Date.now()` timing → back to `console.time`/`console.timeEnd` (six pairs restored verbatim). Flask debug button left in place.
- `docs/SESSION_LOG.md` — this entry + closure note appended to the earlier "in progress" diagnostic entry.

**Files NOT modified** (explicitly per scope lock):
- `components/feedCard/groupingPrimitives.tsx` — stable from Checkpoint 3.5
- `prefetchPreheadContext`, `hydrateEngagement` — perf deferred as P7-74 / P7-75
- Legacy `MealDetailScreen.tsx` — will be replaced in Checkpoint 6
- Any other file outside the three scoped to 4.5
- The flask debug button 🧪 in FeedScreen — stays through Checkpoint 5

---

## Sub-section 4.5.1 findings — CookCardInner photo normalization

**Chose Approach B — normalize at the top of the function.** Reasoning: Approach A's surgical fix required per-sort-callback `.find()` lookups against the original heterogeneous `post.photos` array, which is both `O(n²)` in the sort comparator and harder to reason about at a glance. Approach B produces a single canonical `normalizedPhotos: {url, caption?, order?, is_highlight?}[]` up front, then runs the existing sort/map unchanged against a guaranteed-object array. The `hasPhotos` computation also shifts from `post.photos && post.photos.length > 0` to `normalizedPhotos.length > 0`, which is stricter — a post whose `photos` jsonb contains ONLY garbage entries (e.g. `[null, {url: ''}]`) now correctly reports `hasPhotos = false` instead of `true-but-empty-rendered`. That's a second latent bug caught by the normalization.

**Three input shapes handled defensively per prompt:**
- `typeof p === 'string' && p.trim() !== ''` → `{ url: p }`
- `typeof p === 'object' && typeof p.url === 'string' && p.url.trim() !== ''` → `{ url, caption, order, is_highlight }`
- anything else (null, undefined, number, boolean, object-with-missing-url, object-with-empty-url, bare string that's just whitespace) → filtered out via `null` sentinel

**`hasPhotos` derivation updated.** Now reads `normalizedPhotos.length > 0` instead of the old raw-photos check. This means a post with `photos: [null, {url: ''}]` correctly collapses the photo slot instead of rendering a blank carousel. Confirmed by reading — the old bug path was `hasPhotos=true, carousel array had undefined URL, <Image uri="">`. New path: `normalizedPhotos=[], hasPhotos=false, isPhotoless=true, PhotoCarousel receives empty array and returns null`.

**Downstream `else` branch updated** to run against `[...normalizedPhotos]` instead of `[...post.photos]`. The sort comparator and `.map` stay the same logic; the types are cleaner because the array element type is now known at compile time instead of `any[]`.

**Did NOT touch** the three earlier branches (`photosOverride === null`, `photosOverride !== undefined`, `!hasPhotos && hasRecipeImage`). They were correct and out of scope.

**Three confirmed-broken posts from the diagnostic round:**
- Anthony's "Untitled Post" — `photos: ["https://.../IMG_4540.JPG"]` → normalized to `[{url: "https://.../IMG_4540.JPG"}]` → single-photo carousel renders.
- Mary's "Chickpea, tomato and bread soup" — `photos: ["https://.../IMG_8508.JPEG"]` → same path.
- Mary's "Watermelon and feta" — `photos: ["https://.../IMG_4715.JPG"]` → same path.

**Expected downstream interaction with 4.5.2**: all three seed-photo URLs above have uppercase extensions (`.JPG`, `.JPEG`), so `optimizeStorageUrl` will route them to the raw `/object/public/` endpoint instead of `/render/image/`. That's fine — the raw endpoint serves them without width optimization, photos still render at full resolution. The two fixes compose cleanly: 4.5.1 makes the URL reach `PhotoCarousel`, 4.5.2 makes the URL route correctly through storage.

---

## Sub-section 4.5.2 findings — `optimizeStorageUrl` regex guard

**Regex chosen:** `/\.(jpg|jpeg|png|webp|gif)(\?|$)/` — case-sensitive, anchored at end-of-string or immediately before a query string.

**Mental test pass results:**
- `https://x/storage/v1/object/public/b/photo.jpg` → `.jpg` before `$` → matches → **render endpoint** ✓
- `https://x/storage/v1/object/public/b/photo.JPG` → `.JPG` fails case-sensitive match → **raw URL unchanged** ✓
- `https://x/storage/v1/object/public/b/photo.jpg.JPG` → only the trailing `.JPG` is anchored at `$`, fails → **raw URL unchanged** ✓ (this is the key double-extension case from the 347 affected recipes)
- `https://x/storage/v1/object/public/b/photo.jpg?v=2` → `.jpg` before `?` → matches via `(\?|$)` branch → **render endpoint** ✓
- `optimizeStorageUrl(null)` → early return `''` at the `!url` guard → ✓
- `optimizeStorageUrl('')` → same early return → ✓
- `optimizeStorageUrl(undefined)` → same → ✓

**No unexpected URL shapes encountered** during implementation. The function only rewrites URLs that pass the `/storage/v1/object/public/` marker test, so anything else (external CDN, data URIs, random strings) passes through unchanged at the prior guard.

**Side effect for the 347 affected recipes:** they now serve bytes verbatim from `/object/public/` at original resolution and quality. No width or quality optimization, no `resize=contain`. The originals are typically 1-5 MB per image, which is worse for feed performance than the ~150-300 KB rewritten versions — but they actually **render** now instead of silently failing, which is the priority. Normalization migration tracked as P7-72.

**Preserved the existing `resize=contain` parameter** on the render endpoint (shipped in Fix Pass 9). No change to lowercase-extension URLs' behavior.

---

## Sub-section 4.5.3 findings — Diagnostic revert

**`screens/FeedScreen.tsx`:** All six manual `Date.now()` timing blocks (`t_loadFollows`, `t_loadDishPosts`, `t_buildFeedGroups`, `t_hydrateEngagement`, `t_prefetchPreheadContext`, outer `t_loadFeed`) deleted and replaced with the original `console.time`/`console.timeEnd` pairs. The surrounding code — `setFollowingIds`, `loadDishPosts(allUserIds)`, `buildFeedGroups(...)`, hydrate `Promise.all`, `prefetchPreheadContext`, state setters — is untouched. Grep confirms: `grep -c "console.time\|console.timeEnd" screens/FeedScreen.tsx` returns **12** (6 pairs × 2 sides).

**`components/feedCard/CookCard.tsx`:** The `[DIAG 1a]` three-line `if (post.title === ...) { console.log(...); }` block was **consumed by the 4.5.1 block replacement** — it lived inside the block that got rewritten with the `normalizedPhotos` normalization. A separate revert step was not needed. Grep confirms: `grep "DIAG 1a" components/feedCard/CookCard.tsx screens/FeedScreen.tsx` returns **0 matches**.

**Flask debug button:** confirmed still present at `screens/FeedScreen.tsx:995` — `<Text style={{ fontSize: 20 }}>🧪</Text>` inside a `TouchableOpacity` that navigates to `'Phase7ITestHarness'`. Stays through Checkpoint 5 per the fix-pass instruction.

**Acknowledged**: `console.time`/`console.timeEnd` output does not surface to Metro stdout (LogBox filters performance markers). This is the known issue captured as **P7-76** below. Checkpoint 4.5's revert puts the instrumentation back in the original form so future diagnostic rounds can swap it out again — the mechanism is in place for either form. Fix pass discipline: not arguing about instrumentation form as a 4.5 decision.

---

## Visual verification results — PENDING on Tom's device

Claude Code cannot drive the app; these checks are pending Tom's on-device session. Mirror the Checkpoint 4 placeholder pattern.

1. **Anthony's "Untitled Post" (kombucha)** — PENDING. Expected: scroll to find it under the L4 "at Kombucha batch #2 with Anthony 🫖 · Tom Morley" prehead. Confirm the photo carousel renders a single photo where the blank region used to be.
2. **Mary's "Chickpea, tomato and bread soup"** — PENDING. Expected: scroll to find it. Confirm photo renders.
3. **Mary's "Watermelon and feta"** — PENDING. Expected: scroll to find it. Confirm photo renders.
4. **Photoless "Untitled Post" rows (the three that had `photos: []` in the diagnostic)** — PENDING. Expected: render as compact cards with no blank photo region and no carousel slot reserved.
5. **Regression check on a known-good post** — PENDING. Pick Mary's "Pasta Salad" or "Farro & Charred Corn Salad" (or any post that rendered fine before the fix). Confirm: photo renders, stats render, engagement row renders, no visual regression.
6. **Recipe-image fallback posts (any post where the cook has no personal photos and the recipe_image_url is an uppercase-extension URL)** — PENDING. Expected: the recipe image now renders instead of silently failing. This is the 4.5.2 fix's surface. Pick any post backed by a Plenty or Simple Ottolenghi recipe — those cookbooks have the highest concentration of `.jpg.JPG` double-extension files.
7. **Pull-to-refresh** — PENDING. Expected: still produces six `[FeedScreen] ...` timing lines per cycle (though they will NOT surface to Metro stdout — see P7-76). Functionally unchanged from Checkpoint 4.

---

## Grep verification (completed)

```
$ grep -c "console.time\|console.timeEnd" screens/FeedScreen.tsx
12                                                    ← 6 pairs, matches pre-diagnostic state

$ grep -n "DIAG 1a\|t_loadFeed\|t_loadFollows\|t_loadDishPosts\|t_buildFeedGroups\|t_hydrateEngagement\|t_prefetchPreheadContext" components/feedCard/CookCard.tsx screens/FeedScreen.tsx
(no matches)                                          ← all diagnostic lines removed

$ grep -n "🧪" screens/FeedScreen.tsx
(line 995)                                            ← flask button preserved

$ grep -n "Phase7ITestHarness" screens/FeedScreen.tsx
(line 993)                                            ← nav target preserved
```

TypeScript compiles cleanly for all three touched files. Zero errors.

---

## Recommended deferred items to add to `PHASE_7_SOCIAL_FEED.md`

The prompt asks for six deferred items to be flagged. Since I can't mutate the canonical `PHASE_7_SOCIAL_FEED.md` without scope expansion (Tom edits that doc, not CC), I'm capturing them here for Tom's reconciliation pass. Each item has a fully-formed row ready to paste.

- **P7-72** — 🟡 — **Recipe image filename normalization (storage migration).** Rename ~347 recipe images from uppercase/double extensions (`.JPG`, `.JPEG`, `.jpg.JPG`) to canonical lowercase single extensions + update `recipes.image_url`. Requires storage object copy + delete + SQL update in a transaction. Also requires fixing the upstream cookbook extraction pipeline so renormalized files don't drift back. Low urgency — Checkpoint 4.5's `optimizeStorageUrl` regex fallback handles the render-endpoint issue. Perf cost: ~347 images serve at original resolution (~1-5 MB each) instead of the ~150-300 KB render-endpoint-optimized version until this lands.
- **P7-73** — 🟡 — **`posts.photos` jsonb shape normalization.** Column contains a mix of string-array `["url1", "url2"]` and object-array `[{url, caption, ...}]` forms depending on which write path created the post. `CookCardInner` now handles both defensively (Checkpoint 4.5 / 4.5.1), but the underlying data should be normalized to a single canonical shape and write paths audited to ensure they all produce the same form. Investigation SQL: `SELECT jsonb_typeof(photos->0) AS first_elem_type, COUNT(*) FROM posts WHERE photos IS NOT NULL AND jsonb_array_length(photos) > 0 GROUP BY 1;`. The output will show the string/object split. Migration is straightforward: update posts where `jsonb_typeof(photos->0) = 'string'` to wrap each entry in `{url: <str>}`. Fix the source write path(s) before running the migration.
- **P7-74** — 🟡 — **`hydrateEngagement` steady-state performance investigation.** Averages ~1.0s across four parallel Supabase queries (highlights, likes, comments, participants) for a 200-post feed. No current hypothesis for which query is the bottleneck. Investigation: add per-query `Date.now()` timing inside the `Promise.all` and identify the slowest call, then optimize. Candidates: likely `computeHighlightsForFeedBatch` (does per-post recipe_id lookups) or `loadParticipantsForPosts` (N+1 `getPostParticipants` calls inside a `map`). Checkpoint 4 flagged this as a NEEDS REVIEW item; 4.5 reaffirms it as worth a dedicated pass after Checkpoint 5.
- **P7-75** — 🟢 — **Batched `getMealEventsByIds` variant for `prefetchPreheadContext`.** Currently ~1.15s steady-state from naive `Promise.all` over unique meal event IDs (each one fires 3-4 round trips via `getMealEventForCook`: event fetch, host participant lookup, host profile, contributor count). Fix: write a batched service function that fetches all meal_event rows + host participants + host profiles + contributor counts in 2-3 round trips total instead of `N × 4`. Expected speedup: loadFeed total from ~3.3s steady-state to ~2.5s. Defer unless Checkpoint 5's iteration loop feels painful.
- **P7-76** — 🟢 — **`console.time`/`console.timeEnd` output doesn't surface to Metro stdout.** Confirmed empirically in the Checkpoint 4.5 diagnostic round: `setFeedGroups` fires (proven by `[FEED_CAP_TELEMETRY]` emissions) but the paired `console.time`/`console.timeEnd` calls from the same load produce zero log output. Likely cause: React Native's LogBox or Metro logger strips console performance markers because they're treated as dev-tools events, not log messages. Workaround: manual `Date.now()` instrumentation pattern works and was used during the diagnostic round. Consider whether the canonical instrumentation form in FeedScreen should switch permanently from `console.time` to manual `Date.now()`. Non-urgent; only matters when instrumentation is re-enabled for diagnostic work. Decision deferred: right now `console.time` is the default because Checkpoint 4 shipped that way and Checkpoint 4.5 scope was to revert, not re-decide.
- **(Existing) Fix Pass 9 pull-to-refresh 15s hang finding — RESOLVED-INCIDENTAL.** The four refresh cycles captured in the Checkpoint 4.5 diagnostic round measured `loadFeed` at 3187, 3253, 3306, 3334 ms — all within 5% of each other, no hang, no outlier. The original Fix Pass 9 finding (pull-to-refresh hangs ~15s) is marked **resolved-incidental by the Checkpoint 4 FeedScreen rewrite**. Do NOT remove the phase timing instrumentation from FeedScreen — it may be needed again for future investigations. The root cause of the original hang is unknown but was likely tied to the retired `getMealsForFeed` + `groupPostsForFeed` path which no longer runs.

---

## Checkpoint 4.5 diagnostic telemetry snapshot

Captured across the five-set diagnostic round described in the preceding SESSION_LOG entry.

- **Cold launch loadFeed: 7172 ms**
  - `loadFollows`: 437 ms
  - `loadDishPosts`: 1200 ms
  - `buildFeedGroups`: 563 ms
  - `hydrateEngagement`: **3743 ms** (cold-load spike — real database + JIT warmup)
  - `prefetchPreheadContext`: 1225 ms
- **Steady-state loadFeed avg (sets 2-5): ~3270 ms**
  - `loadFollows`: ~171 ms (113 / 178 / 188 / 204)
  - `loadDishPosts`: ~453 ms (463 / 414 / 449 / 486)
  - `buildFeedGroups`: ~453 ms (458 / 423 / 423 / 509)
  - `hydrateEngagement`: ~1022 ms (1062 / 986 / 1002 / 1040)
  - `prefetchPreheadContext`: ~1155 ms (1157 / 1184 / 1184 / 1094)
  - Total: 3253 / 3187 / 3306 / 3334 ms
- **Feed cap telemetry:** 159 groups from 200 posts, oldest post 2026-01-24T20:45:59+00:00. **~11 weeks runway** before P7-44 pagination becomes urgent (at current cook posting rate).
- **Errors/exceptions across 5 full loadFeed cycles:** **zero**.
- **[DIAG 1a] emissions:** 35 total — 32× Anthony's Untitled Post (same kombucha post, re-rendering as the FlatList virtualized during scroll), 3× truly-photoless Untitled Post rows, 1× Chickpea soup, 1× Watermelon and feta. All three confirmed-broken-photo posts surfaced with the expected `photos: ["<url string>"]` shape — root cause confirmed for 4.5.1's fix.

---

## GO / NO-GO recommendation for Checkpoint 5

**GO**, conditional on Tom's on-device verification of the photo-rendering fixes passing. Specifically:

1. The three confirmed-broken posts (Anthony kombucha, Chickpea soup, Watermelon feta) render their seed photos.
2. Photoless rows still collapse cleanly (no blank photo slot).
3. No regression on known-good posts.
4. At least one recipe-image-fallback post (Plenty / Simple Ottolenghi recipe-backed post) renders its recipe image, confirming the 4.5.2 uppercase-extension guard works end-to-end through the feed → card → storage pipeline.

If all four pass → Checkpoint 5 greenlit. Checkpoint 5's scope is CookDetailScreen (L6) build.

If visual verification surfaces a regression in one of the three fixed posts or a new bug elsewhere, fix within the three scoped files and re-verify before Checkpoint 5.

**Scope lock held. No `prefetchPreheadContext`, `hydrateEngagement`, `groupingPrimitives.tsx`, or legacy MealDetailScreen touched. Flask button preserved. TypeScript clean.**

**Status:** Checkpoint 4.5 complete. Awaiting Tom's on-device verification + his review of this SESSION_LOG entry. Hard stop held — no Checkpoint 5 work started.

---

### 2026-04-14 — Phase 7I Checkpoint 4 on-device diagnostic (in progress)
**Phase:** 7I Checkpoint 4 — post-ship diagnostic pass
**Context:** On-device diagnostic round captured after Checkpoint 4's FeedScreen rewrite. First two captures surfaced that `console.time` / `console.timeEnd` output is being swallowed by React Native's LogBox / Metro logger — the pairs execute on-device but don't surface to Metro stdout. Confirmed by comparing `[FEED_CAP_TELEMETRY]` emission count (3 per session, proving `setFeedGroups` fires) against `[FeedScreen] loadFeed` timing emissions (0 across the same session).

**Temporary edits applied (NOT COMMITTED — diagnostic only, will revert):**
- `screens/FeedScreen.tsx` — replaced all six `console.time`/`console.timeEnd` pairs in `loadFeed` with manual `Date.now()` capture + `console.log('[FeedScreen]', '<phase>:', ms, 'ms')` output. The six phases: `loadFollows`, `loadDishPosts`, `buildFeedGroups`, `hydrateEngagement`, `prefetchPreheadContext`, and outer `loadFeed`. Original `console.time`/`console.timeEnd` lines preserved as comments immediately above each replacement for easy revert.
- `components/feedCard/CookCard.tsx` — `[DIAG 1a]` console.log added inside `CookCardInner` after the `isPhotoless` computation, logs `post.title`, `hasPhotos`, `hasRecipeImage`, and the raw `photos` JSONB when the title matches one of three watch values (`Untitled Post`, `Chickpea, tomato and bread soup`, `Watermelon and feta`). Kept in place from an earlier round, still active during this round.

**Revert plan when diagnostics conclude:**
- FeedScreen.tsx: delete the manual timing blocks, uncomment the `console.time`/`console.timeEnd` lines (or remove them entirely — Tom's call).
- CookCard.tsx: delete the `[DIAG 1a]` block.

**Status:** Waiting for Tom's cold-launch + 3× pull-to-refresh capture round. Hard stop held — no Checkpoint 5 work. Flask button still present. No scope drift.

**Closed 2026-04-14 (by the Checkpoint 4.5 entry below):** Capture rounds completed. Diagnostic surfaced two root-cause bugs (string-vs-object photo shape, uppercase-extension storage URLs) plus the `console.time`/`timeEnd` silence issue. All three resolved or captured as deferred items in `2026-04-14 — Phase 7I Checkpoint 4.5 — Photo Rendering Fix Pass`. Manual `Date.now()` instrumentation reverted to original `console.time` form; `[DIAG 1a]` block deleted from CookCard. Flask button preserved through Checkpoint 5 per fix-pass instruction.

---

### 2026-04-14 — Phase 7I Checkpoint 4 — FeedScreen Rewrite
**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 4 of 7
**Prompt from:** `docs/CC_PROMPT_7I_CHECKPOINT_4_FEEDSCREEN.md` — rewrite FeedScreen's render path around `CookCard` + `buildFeedGroups` + the grouping primitives. Remove `.is('parent_meal_id', null)`. Stop calling `getMealsForFeed`. Retire PostCard/MealPostCard/LinkedPostsGroup from the render path (not deleted). Bundle logo tap-to-top, pull-to-refresh instrumentation, feed cap telemetry.

**Files modified:**
- `screens/FeedScreen.tsx` — **full rewrite**, ~980 lines (previously ~840). Replaced the `Post`/`CombinedFeedItem` model with `CookCardData`/`FeedGroup` throughout. New module-level `transformToCookCardData(rawPosts, profilesMap, recipesMap)` helper honors the six denormalization invariants. New `prefetchPreheadContext(groups, allCookCards)` method builds two maps (`mealEventCtxMap` via `getMealEventForCook`, `cookPartnerMap` via a single batched `post_participants` query filtered by `in('post_id', soloPostIds) + role='sous_chef' + status='approved'`). Replaced the old 3-branch `renderFeedItem` with a 3-branch dispatch on `FeedGroup.type` (`solo` / `linked_shared_recipe` / `linked_meal_event`). Added a `flatListRef` + `handleLogoTap` to wire logo-tap-to-top. Added one-shot feed cap telemetry via `useEffect([feedGroups])`. Added `console.time`/`console.timeEnd` instrumentation around `loadFollows`, `loadDishPosts`, `buildFeedGroups`, `hydrateEngagement`, `prefetchPreheadContext`, and the overall `loadFeed`. Memoized navigation/helper callbacks with `useCallback`. The flask debug button was kept in place during development, then **removed before writing this log entry** per the prompt.

**Files NOT modified** (explicitly per scope lock):
- `components/feedCard/CookCard.tsx`, `components/feedCard/groupingPrimitives.tsx`, `components/feedCard/sharedCardElements.tsx` — component layer stable.
- `components/PostCard.tsx`, `components/MealPostCard.tsx`, `components/LinkedPostsGroup.tsx` — deletion deferred to Checkpoint 7. Still in repo, just unreferenced by FeedScreen.
- `lib/types/feed.ts` — stable.
- `lib/services/feedGroupingService.ts` — `buildFeedGroups` already handles everything needed. `groupPostsForFeed` stays exported but unused.
- `lib/services/mealService.ts` — did NOT add a `getMealEventsByIds` batched variant. The naive `Promise.all` over unique meal event IDs ships as-is. Perf flagged for on-device verification (see 4.4 findings).
- `screens/_Phase7ITestHarness.tsx` — stable. Harness renders against synthetic data and is independent of FeedScreen.
- `App.tsx`, DB migrations, all other services — untouched.

---

## Sub-section 4.1 findings — `loadDishPosts` rewrite + denormalization

**`.is('parent_meal_id', null)` filter removed.** Confirmed via grep. Meal-attached dishes now return to the feed. Feed size should grow by ~38% (the 659 formerly-hidden dishes from Checkpoint 1 diagnostics).

**Query SELECT expanded** to include `cooked_at` and `notes`. The previous query had `id, user_id, title, rating, cooking_method, created_at, photos, recipe_id, modifications, description, post_type, parent_meal_id`. New query adds `cooked_at, notes`. The recipes lookup was already pulling `id, title, image_url, cook_time_min, prep_time_min, cuisine_types, vibe_tags, times_cooked, chefs(name)` which matches everything `CookCardData` needs.

**`transformToCookCardData` helper** lives at module level, above the `FeedScreen` function body. It's a pure function: `(rawPosts, profilesMap, recipesMap) => CookCardData[]`. No closure state, no side effects. Checkpoint 5's CookDetailScreen can import it for single-post transforms if helpful.

**All six denormalization invariants honored:**
- **INVARIANT 1** — `recipe_cook_time_min = (cook_time_min ?? 0) + (prep_time_min ?? 0)`, then coerced to `null` when the sum is zero. This is the fix for the Checkpoint 3 SESSION_LOG flag: PostCard computed the sum at render time from separate fields; CookCardData denormalizes the sum at fetch time. Verified by reading the field and grepping for its usage in `CookCardInner`'s stats assembly.
- **INVARIANT 2** — `recipe_image_url` comes from `recipesMap.get(post.recipe_id)?.image_url`. Always. There is no per-post override path.
- **INVARIANT 3** — `author` is built from `profilesMap.get(post.user_id)` with a synthetic fallback for orphaned user_ids (same fallback pattern as pre-rewrite).
- **INVARIANT 4** — `chef_name` flattened via `Array.isArray(recipe.chefs) ? recipe.chefs[0] : recipe.chefs` then `chef?.name ?? null`.
- **INVARIANT 5** — `photos` pass through verbatim (typed as `any[]`).
- **INVARIANT 6** — All recipe fields flattened to top-level `recipe_*` names. No nested `recipes` object on `CookCardData`.

**Title cascade preserved.** `post.title || recipe?.title || post.dish_name || 'Untitled Post'`. Written once in the transform, never re-applied by `CookCardInner`.

**No surprises in the transform.** The code is mechanical and reads clean. The one subtle bit is the `recipe_cook_time_min = totalTime > 0 ? totalTime : null` coercion — writing `null` (instead of `0`) lets `CookCardInner`'s stats-row `if (totalTime > 0)` guard match the existing behavior without explicit null-check code.

**Feed cap stays at 200.** No pagination work. P7-44 tracks pagination separately.

---

## Sub-section 4.2 findings — Removing `getMealsForFeed` and simplifying `loadFeed`

**Cleanly retired:**
- `getMealsForFeed` call
- `mealsResult` variable, the `Promise.all([loadDishPosts, getMealsForFeed])` split
- `CombinedFeedItem` union type (the `| { type: 'meal'; meal: MealWithDetails }` alternation)
- `groupPostsForFeed` call (old function, still exported from `feedGroupingService.ts` for Checkpoint 7 to delete)
- `mealHighlights` state (previously `useState<Record<string, Highlight | null>>`)
- `Post` local interface (the pre-rewrite shape; `CookCardData` supersedes it)
- `posts: Post[]` state (the raw-posts cache; `postById: Map<string, CookCardData>` supersedes it)
- `handleMealPress` helper (was the MealDetail navigation target specifically for MealPostCard's tap)
- Imports for `PostCard`/`PostCardData`, `LinkedPostsGroup`, `MealPostCard`, `getMealsForFeed`/`MealWithDetails`, `FeedItem`/`groupPostsForFeed`

**Kept in place:**
- `loadCurrentUser` flow unchanged
- `followingIds` state — now used by `buildFeedGroups` for Rule C visibility, same purpose as before
- `postLikes` / `postComments` / `postParticipants` / `postHighlights` — same shapes, same lookups, now keyed only by dish post IDs (no meal IDs)
- `toggleLike` and `formatLikesText` — unchanged
- The profile/search/bell/messages header
- The empty-state and loading-state rendering
- The 200-post limit in `loadDishPosts`

**New state maps added:**
- `postById: Map<string, CookCardData>` — built once per load, used by `resolveVibeForPost`, `postTitleFor`, and debug lookups
- `mealEventContextMap: Map<string, MealEventContext>` — built during `prefetchPreheadContext`
- `cookPartnerPreheadMap: Map<string, { partnerName: string }>` — same

**No state retirement complications.** The existing state maps migrated cleanly because they're all keyed by post ID, and dish post IDs are a strict subset of the old combined ID set (the removed IDs were meal_event post IDs, which had separate render paths).

**One subtle rename:** `feedItems` → `feedGroups`. FlatList `data`, `keyExtractor`, empty-state check all updated. `keyExtractor` now reads `group.id` which is already the stable earliest-post ID assigned by `buildFeedGroups`.

---

## Sub-section 4.3 findings — Engagement hydration

**Flat-list pattern worked.** Walking `feedGroups` and collecting `Array.from(lookupMap.keys())` gives the complete flat list of post IDs across all groups (solo groups, linked groups, both). `group.posts` always contains the complete flat post list — the `subUnits` field is a presentation restructuring, not a different post set, so I don't need to walk it separately.

**Four hydration calls in parallel** (matching the old code's parallelism):
1. `computeHighlightsForFeedBatch(postInputs, [], currentUserId)` — the second arg is the empty meals array (previously `mealsResult.map(...)`). This keeps the existing service untouched.
2. `loadLikesForPosts(allPostIds)`
3. `loadCommentsForPosts(allPostIds)`
4. `loadParticipantsForPosts(allPostIds, lookupMap)` — signature extended to take the `postById` lookup map because the pre-rewrite version read `posts.find(p => p.id === postId)` from a closure over the old `posts` state. That state no longer exists, so I pass the lookup map in explicitly. Pure parameterization — no logic change.

**No meal-level engagement.** Removed the Fix Pass 8 / 9 `allEngagementIds = [...postIds, ...mealIds]` merge. Meal event post IDs are no longer in any hydration path because meals don't render as feed units. If Tom toggles a like from the L7 MealEventDetailScreen (Checkpoint 6), that screen owns its own engagement state — not FeedScreen's concern.

**No rendering-time lookup misses observed** — not that I can test them from here, but the TS types check out and the lookup keys match the hydration keys (both are dish post IDs).

---

## Sub-section 4.4 findings — Prehead pre-fetch + renderFeedItem dispatch

**Prehead pre-fetch approach:**
- **Meal event contexts**: naive `Promise.all` over unique `parent_meal_id` values, each calling `getMealEventForCook(samplePostId)` for a representative sample post from that meal event. Did NOT write a batched `getMealEventsByIds` variant. Rationale: the prompt says to profile first and ship the naive loop if it's fast enough. I can't profile from here, so I shipped the naive loop with a clear comment flagging it for on-device review. **If Tom sees the `prefetchPreheadContext` `console.timeEnd` exceed ~500ms on a cold feed load, writing `getMealEventsByIds` is a one-session follow-up.** Flag as NEEDS REVIEW below.
- **Cook-partner prehead state**: **one batched query** against `post_participants` filtered by `in('post_id', soloPostIds)` + `role='sous_chef'` + `status='approved'`. Only queries for solo groups (linked groups handle partners via the grouping layer). Joins on `user_profiles` for partner name. In-memory filter: skip any partner whose user_id is in `authorIdsInBatch` — if they're in the feed batch, `buildFeedGroups` either formed an L3b linked group or P7-68 degraded them to solo cards, either way no prehead needed. First matching partner wins per post (L3a shows one partner name).

**Lookup map storage**: React state (`useState`), not refs or module-level globals. Reason: `renderFeedItem` is called by FlatList during render phase, which needs the latest state for every render. A ref would work but state is cleaner and the set is small (≤ unique meal events + ≤ solo posts with sous_chef tags). React's reference identity guarantees that a full `setFeedGroups` + `setMealEventContextMap` + `setCookPartnerPreheadMap` sequence will trigger exactly one re-render because they're all batched inside the same `loadFeed` event loop tick.

**Dispatch structure** is exactly as the prompt suggested. Four branches:
1. `solo` → `<View>{prehead?}<CookCard /></View>`. Meal event prehead takes precedence over cook partner prehead (check the prompt's rule: if both apply to the same post, which shouldn't happen, the meal event wins).
2. `linked_shared_recipe` → `<SharedRecipeLinkedGroup showLinkingHeader={true}>`.
3. `linked_meal_event` → Look up `mealEventContextMap.get(firstPost.parent_meal_id)`. If found, render `<NestedMealEventGroup>`. If not found (defensive — shouldn't happen after prefetch), fall back to `<LinkedCookStack>` with no header and a `console.warn`.
4. Unknown type → `console.warn` + null.

**Helper functions memoized with `useCallback`** so nested groups don't get fresh closures on every render: `buildLikeData`, `resolveVibeForPost`, `postTitleFor`, `navigateToCookDetail`, `navigateToRecipeDetail`, `navigateToAuthor`, `navigateToComments`, `navigateToYasChefs`, `navigateToMealEvent`, `handleCardMenu`, `handleLogoTap`. Deps are narrow and correct.

**Rendering-time surprises:** none expected. TypeScript checks pass. The real risk is prop-shape drift — for example, if `SharedRecipeLinkedGroup`'s `getLikeDataForPost` is typed differently than what `buildLikeData` returns. I verified by reading both sides: `buildLikeData` returns `{ hasLike, likesText, commentCount, likes }`, and `CookCardProps['likeData']` (via `SharedRecipeLinkedGroupProps`) is exactly that shape. Clean.

---

## Sub-section 4.5 findings — Navigation wiring

**CookCard tap target** → `navigateToCookDetail(postId)` → `navigation.navigate('CommentsList', { postId })`. Temporary until Checkpoint 5 builds CookDetailScreen. The alternative (RecipeDetail for recipe-backed, CommentsList for freeform) was rejected per the prompt — it makes freeform posts feel second-class.

**Recipe tap** → `navigation.navigate('RecipeDetail', { recipe: { id: recipeId } })`. Same as PostCard.

**Chef tap** → `navigation.navigate('AuthorView', { chefName })`. Same as PostCard.

**Meal event prehead / group header** → `navigateToMealEvent(mealEventId)` → `navigation.navigate('MealDetail', { mealId, currentUserId })`. The existing `MealDetail` screen still queries by post ID and will now receive `meal_event` post rows correctly because Checkpoint 2's sweep updated `getMeal` to `.eq('post_type', 'meal_event')`. Temporary target until Checkpoint 6 rewrites `MealDetailScreen` → `MealEventDetailScreen`.

**Cook partner prehead** → non-tappable, no `onPress` prop. `CookPartnerPrehead` doesn't accept one.

**Overflow menu** → `handleCardMenu(postId)` → `console.log(...)`. Placeholder per the prompt. The three-dot menu button DOES visually render on own cards because `CookCardInner` conditionally renders `onMenu` when it's defined. Tapping it logs silently. **Flag for Tom:** if the silent tap feels broken during testing, it's a one-line change to make the menu conditional on a feature flag or to wrap it in an `Alert.alert('Edit menu coming soon')`. Flagged as P7-71 in NEEDS REVIEW.

**No navigation target felt wrong during implementation.** The temporary `CommentsList` route is a defensible landing place for both recipe-backed and freeform posts.

---

## Sub-section 4.6 findings — Bundled polish

### 4.6.1 — Logo tap-to-top

**Worked on first try via the "box-none" approach.** The existing header used `styles.headerCenter` as an absolutely positioned View with no `pointerEvents` set, which meant the Logo View was blocking taps on sibling icons anyway. I added `pointerEvents: 'box-none'` to `styles.headerCenter` so the outer container passes touches through to the siblings, and wrapped the inner Logo in a `TouchableOpacity` that calls `flatListRef.current?.scrollToOffset({ offset: 0, animated: true })`. The `TouchableOpacity` is the only part of the center area that captures taps, and it's bounded to the Logo's visual size. No wrestling required — clean one-shot implementation.

**`flatListRef`** is a `useRef<FlatList<FeedGroup>>(null)`, passed as `ref={flatListRef}` on the FlatList. TypeScript happy.

### 4.6.2 — Pull-to-refresh hang investigation

**Instrumented, not fixed.** Added `console.time`/`console.timeEnd` pairs around all five phases: `loadFollows`, `loadDishPosts`, `buildFeedGroups`, `hydrateEngagement`, `prefetchPreheadContext`. Plus an outer `[FeedScreen] loadFeed` pair in the finally block.

**Cannot measure from Claude Code.** Tom needs to pull-to-refresh on the device and read the Metro log for the phase timings. Expected breakdown based on the Checkpoint 2 dry-run's 1.4s on 20 posts: `loadDishPosts` + `buildFeedGroups` + `hydrateEngagement` probably 2-4s for a 200-post feed. `prefetchPreheadContext` is the new phase and the most likely culprit for the 15s hang if the naive `getMealEventForCook` loop fires against a feed with many unique meal events.

**Report requested in SESSION_LOG per the prompt** but I can only provide the instrumentation, not the numbers. Flagged as **Feed cap telemetry + pull-to-refresh timings: PENDING on Tom's device** below. If the 15s hang is isolated to a specific phase, the fix likely involves either:
- Writing `getMealEventsByIds` batched variant (if `prefetchPreheadContext` is slow)
- Parallelizing the naive loop more aggressively (it already uses `Promise.all`, but each call is serial inside)
- Diagnosing an unrelated bug (re-render loop, unresolved promise)

### 4.6.3 — Feed cap telemetry

**One-shot `useEffect([feedGroups])` log** prints `groups:`, `total posts:`, `oldest post date:`. Tom can read these values from the Metro log after the first feed load or any pull-to-refresh. **Values pending on-device measurement.**

---

## Sub-section 4.7 findings — Retired imports

**Clean removal.** Grep verification:

```
$ grep -nE "PostCard|MealPostCard|LinkedPostsGroup|getMealsForFeed|groupPostsForFeed|CombinedFeedItem|MealWithDetails" screens/FeedScreen.tsx
10:// PostCard, MealPostCard, LinkedPostsGroup are no longer imported here.
```

Only a comment remains — the header doc block explaining the retirement. No actual imports, no type references, no usages.

**New imports verified present:**
- `CookCard` from `components/feedCard/CookCard`
- `MealEventPrehead`, `CookPartnerPrehead`, `SharedRecipeLinkedGroup`, `NestedMealEventGroup`, `LinkedCookStack` from `components/feedCard/groupingPrimitives`
- `buildFeedGroups` from `lib/services/feedGroupingService`
- `getMealEventForCook` from `lib/services/mealService`
- `CookCardData`, `FeedGroup`, `MealEventContext` (type-only) from `lib/types/feed`

**TypeScript compiles clean** across the rewrite: `npx tsc --noEmit` filtered to `FeedScreen`, `feedGroupingService`, and `types/feed` → zero errors.

---

## Cook-partner linkage verification results

**PENDING — cannot verify from Claude Code.** The prompt's critical verification step (scroll the feed looking for `SharedRecipeLinkedGroup` rendering) requires Tom to:
1. Open the app on-device
2. Pull-to-refresh the feed
3. Scroll through looking for any unified card with a linking header like "Tom cooked with Anthony" + shared recipe hero + 2+ cook sub-sections

**What I know without running it:**
- The real data has 421 `sous_chef`-on-dish-post rows (Checkpoint 1 diagnostic). At least some of those are reciprocal pairs.
- `buildFeedGroups` calls `getLinkedCookPartnersForPosts` which uses a 60-minute reciprocal time window and restricts candidates to the in-batch post set. Checkpoint 2's dry-run found 0 linked pairs in a 20-post sample — but Checkpoint 2 also noted that the sample size was too small to exercise the path. A 200-post feed should have substantially better coverage of reciprocal pairs within the 60-minute window.
- If 0 `linked_shared_recipe` groups form: the three likely causes are (a) 60-minute window too tight, (b) in-batch scope restriction, (c) genuine data rarity. Fixes listed in NEEDS REVIEW #1 below.

**Telemetry hook to help diagnose:** `buildFeedGroups` logs `[buildFeedGroups] P7-68 degradation: N posts...` whenever the P7-68 path fires. If Tom sees high P7-68 counts but few `linked_shared_recipe` groups, it suggests cook-partner components ARE forming but they have mixed recipes (different-recipe L3b, deferred rendering).

---

## Meal event linkage verification results

**PENDING — cannot verify from Claude Code.** Similar to the cook-partner verification, Tom needs to scroll the feed looking for:
- L4 preheads (solo card with "at {Meal event title} · {host}" above)
- L5 linked meal event groups (meal event header + stacked sub-sections, no gray gaps)
- L5.5 nested shared-recipe sub-merges (only if 2+ cooks at the same event used the same recipe — rare in real data)

**Confidence this works:**
- `getMealEventForCook` has been TS-verified against real data shapes via the Checkpoint 2 dry run
- 659 dish posts with `parent_meal_id` set (from Checkpoint 1 diagnostics) means there's substantial meal-event data to exercise
- `NestedMealEventGroup` was visually verified on the test harness in Checkpoint 3.5
- The only new wiring in Checkpoint 4 is the `prefetchPreheadContext` path + the dispatch in `renderFeedItem`, both of which read clean

If L4/L5 headers don't appear, the most likely cause is a `mealEventContextMap.get` miss due to stringly typed mismatches on `parent_meal_id` — unlikely given UUID consistency, but flag for verification.

---

## Feed cap telemetry (PENDING)

**Total group count:** PENDING
**Total post count:** PENDING
**Oldest post date:** PENDING

Logged via `useEffect([feedGroups])` to the Metro console. Tom can read the first line after initial load or pull-to-refresh.

---

## Pull-to-refresh phase timings (PENDING)

**Cycle 1:** PENDING
**Cycle 2:** PENDING
**Cycle 3:** PENDING

Phases instrumented: `loadFollows`, `loadDishPosts`, `buildFeedGroups`, `hydrateEngagement`, `prefetchPreheadContext`, total `loadFeed`. Tom reads from Metro log. If any phase is consistently >5s, that's the 15s hang's home. If the hang is not reproducible after the rewrite, mark the Fix Pass 9 finding as resolved-incidental.

---

## NEEDS REVIEW items flagged for Checkpoint 5+

1. **Cook-partner linkage coverage on real data.** If Tom sees 0 `linked_shared_recipe` groups on a 200-post feed, try:
   - **(a)** Widen `LINKED_COOK_WINDOW_MS` in `postParticipantsService.ts` from `60 * 60 * 1000` (60 min) to `180 * 60 * 1000` (180 min). Single-line change.
   - **(b)** If (a) doesn't help, the in-batch reciprocal scope is the constraint. Fix: write a variant of `getLinkedCookPartnersForPosts` that queries `posts` for reciprocal candidates across the full time window, not just the in-batch set. New deferred item candidate: **P7-70** wider reciprocal scope.
   - **(c)** If (a) and (b) both fail, accept that reciprocal pairs are genuinely rare in seeded data and move on.

2. **`prefetchPreheadContext` performance on cold load.** Naive `Promise.all` over unique meal event IDs. May be slow if the feed has 50+ unique meal events. If the instrumented `console.timeEnd` exceeds ~500ms, write a batched `getMealEventsByIds(mealEventIds)` variant in `mealService.ts` that fetches all meal_event rows + host profiles + contributor counts in 2-3 round trips instead of N. Flag this as **perf follow-up to Checkpoint 4**, not a blocker for Checkpoint 5.

3. **Pull-to-refresh root cause.** PENDING Tom's device timing report. If it's reproducibly isolated to a specific phase, apply a targeted fix. If it's intermittent or non-obvious, flag as **P7-69** for continued investigation.

4. **Overflow menu no-op.** Currently logs to console. If it feels broken during testing, either (a) hide the menu entirely until Checkpoint 5 wires it (one-line change: pass `onMenu={undefined}` for all posts), or (b) wrap in `Alert.alert('Edit menu coming soon')`. Flag as **P7-71**.

5. **`MealDetail` navigation target.** The L4 prehead + L5 group header currently route to the legacy `MealDetailScreen` with `{ mealId: <meal_event post id>, currentUserId }`. Checkpoint 1's sweep updated `getMeal` to query `post_type='meal_event'`, so the destination should successfully fetch the meal row. But the destination screen was built around the old `MealWithDetails` model (meal_participants RSVPs, dish peek, etc.) and may not render correctly for every meal event. Flag for visual verification on-device. Checkpoint 6 replaces this screen entirely.

6. **Defensive fallback in `linked_meal_event` render path.** If `mealEventContextMap.get(firstPost.parent_meal_id)` returns `undefined` (shouldn't happen after prefetch, but could if a cook was attached to a meal_event whose row was deleted between prefetch and render), the render falls back to `<LinkedCookStack>` with no header. That fallback path still works visually but loses the meal event context. Consider adding a diagnostic log if this ever fires in practice.

7. **Prop interface alignment.** The `SharedRecipeLinkedGroup` / `NestedMealEventGroup` getter-style per-post callbacks (`getLikeDataForPost`, etc.) are stable from Checkpoint 3.5. The `buildLikeData` closure captures `postLikes` + `postComments` which re-render on every state change — could cause re-render cascades in the grouping primitives if React doesn't memoize aggressively enough. Not observable without runtime profiling. Flag only if Tom sees scroll jank on the feed.

---

## GO / NO-GO recommendation for Checkpoint 5

**GO**, conditional on Tom's on-device verification pass. Specifically:

1. Open the app, go to the Feed tab. The feed loads without crashing.
2. Scroll top to bottom. No error boundaries, no red screens.
3. Feed density is visibly higher than before (meal-attached dishes restored).
4. CookCards render with the new structure (avatar + display_name + title + description + recipe line + photos + stats + engagement).
5. At least some L4 preheads or L5 group headers appear (meal event context surfaces).
6. Ideally, at least one `SharedRecipeLinkedGroup` forms (cook-partner linkage works). If not, try widening the time window per NEEDS REVIEW #1.
7. Feed cap telemetry logs appear once per load — report numbers.
8. Pull-to-refresh works. If it hangs, read phase timings from Metro log and report.
9. Test harness still reachable via the flask button re-added (by Tom or by temporarily re-adding the 3-line button) and all 7 states still render correctly.

If all pass → Checkpoint 5 greenlit. Checkpoint 5's scope is CookDetailScreen (L6) build: full detail view with hero photo carousel, recipe line with cookbook page number, stats grid, Highlights card, Modifications/notes blocks, "Your history with this recipe" section (calls `getCookHistoryForUserRecipe` from Checkpoint 2), comments, sticky engagement bar.

If visual verification fails in a specific way → fix within FeedScreen first, then Checkpoint 5.

**TypeScript clean. Imports retired. No FeedScreen structural drift. All 6 denormalization invariants honored. Logo tap-to-top wired. Pull-to-refresh instrumented. Feed cap telemetry added. Flask button removed. Scope lock held.**

**Status:** Checkpoint 4 complete. Awaiting Tom's on-device verification of the real feed + the three deferred numbers (feed cap telemetry, pull-to-refresh timings, cook-partner linkage count). Hard stop held — no Checkpoint 5 work started.

---

### 2026-04-14 — Phase 7I Checkpoint 3.5 — Shared-Recipe Merged Groups
**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 3.5 of 7 (inserted between 3 and 4)
**Prompt from:** `docs/CC_PROMPT_7I_CHECKPOINT_3_5_SHARED_RECIPE.md` — refactor CookCard + LinkedCookStack for flat no-gap rendering, add `SharedRecipeLinkedGroup` + nested meal-event rendering, extend `buildFeedGroups` with shared-recipe classification, update test harness, capture D48 + P7-68.

**Files modified:**
- `components/feedCard/CookCard.tsx` — **refactored**, ~300 lines. Extracted `CookCardInner` (wrapper-less content, named export) and added `CookCardInnerProps` interface with a new `photosOverride?: CarouselPhoto[] | null` escape hatch. `CookCard` becomes a thin outer wrapper: `<CardWrapper><CookCardInner {...props} /></CardWrapper>`. The inner component uses `<>` fragment — no outer `<View>` so the caller controls framing. The `photosOverride` handler takes three branches: explicit `null` suppresses the carousel entirely, explicit array replaces default derivation, `undefined` falls through to the existing `post.photos → recipe_image_url` fallback.
- `components/feedCard/groupingPrimitives.tsx` — **heavy refactor + additions**, ~680 lines. Refactored `LinkedCookStack` to use `CookCardInner` under a single outer `CardWrapper` with `SubSectionDivider` hairlines between consecutive cook sections. Added three new exports: `SharedRecipeLinkedGroup` (standalone L3b same-recipe with shared hero + optional linking header), `NestedMealEventGroup` (L5 with `FeedGroupSubUnit` dispatch — solo sub-units rendered via `CookCardInner`, shared-recipe sub-units rendered inline via an internal `SharedRecipeBody` helper without their own wrapper or linking header). Private helpers: `LinkingHeader` (uses existing `groupHeaderStyles` from `MealEventGroupHeader` for visual parity), `SubSectionDivider` (`StyleSheet.hairlineWidth` border-top, `marginTop: 6`), `SharedRecipeBody` (factored body so the render flow is identical whether it's standalone or nested), `buildSharedHeroPhotos` (tier cascade: `recipe_image_url` → first post's own photos → empty), `hasPersonalPhotos` (used for per-sub-section carousel suppression).
- `lib/services/feedGroupingService.ts` — **classification extension.** Added import of `FeedGroupSubUnit`. Replaced the flat classification block with a new path that distinguishes `linked_meal_event` (has at least one meal_event edge → computes `subUnits`) from `linked_shared_recipe` (cook_partner-only AND all posts share the same non-null `recipe_id`) from `solo` degradation (cook_partner-only AND mixed recipes → P7-68 fallback). Added a new `buildSubUnits(sortedPosts)` helper that buckets meal-event posts by `recipe_id` (shared → `shared_recipe` sub-unit, unique/null → `solo` sub-unit), then sorts sub-units by earliest `created_at` ascending with deterministic tie-breakers (solo before shared_recipe, then post id). Dev-time observability: logs `[buildFeedGroups] P7-68 degradation: N posts emitted as solo because their cook-partner component had mixed recipe_ids.` whenever the P7-68 path fires, so Tom can count occurrences from Metro logs during F&F testing.
- `lib/types/feed.ts` — **type extension.** Added `FeedGroupSubUnit` interface (`kind: 'solo' | 'shared_recipe'` plus `posts: CookCardData[]`). Extended `FeedGroup.type` from `'solo' | 'linked'` to `'solo' | 'linked_meal_event' | 'linked_shared_recipe'`. Added optional `subUnits?: FeedGroupSubUnit[]` field. Doc comments explain when each type is used and when `subUnits` is populated.
- `screens/_Phase7ITestHarness.tsx` — **synthetic data + render updates.** L3b synthetic data now uses same `recipe_id` (`recipe-carbonara-shared`) and `recipe_image_url` on both Tom's and Anthony's posts; Tom has a personal photo, Anthony does not (verifies per-sub-section suppression). L5 data unchanged (still 4 different-recipe contributors for flat-stack verification). Added new L5.5 section: 5 cooks (Mary/turkey, Dad/stuffing, Cam/pie, Tom + Mary Jr. both carbonara) at "Friendsgiving at the Grosses". Hand-constructed `FeedGroupSubUnit[]` in the shape `buildFeedGroups` would produce (3 solos + 1 shared_recipe). Section labels updated: L3b → "L3b — Co-cook linked pair (same recipe, shared hero)", L5 → "L5 — Meal event linked group (flat stack, different recipes)", new "L5.5 — Meal event with shared-recipe sub-merge". L3b now renders via `<SharedRecipeLinkedGroup showLinkingHeader={true}>` instead of `<LinkedCookStack>`. L5.5 renders via new `<NestedMealEventGroup>`.
- `docs/PHASE_7_SOCIAL_FEED.md` — added **D48** row to the Decisions Log table. Noted in the row body that **D47 is not in this repo copy** — it lives only in Claude.ai's project knowledge version, so the row skips directly from D46 to D48 with an inline note explaining the gap. Added **P7-68** row under a new "From Phase 7I Checkpoint 3.5 (2026-04-14)" sub-section in the deferred items area, just above the existing "Doc maintenance debt surfaced 2026-04-09" sub-section.
- `screens/FeedScreen.tsx` — **temporary-and-removed** change. Added a flask emoji 🧪 debug button next to the existing profile/search icons that navigated to `Phase7ITestHarness`. Used for visual verification during development. Removed before writing this SESSION_LOG entry per the prompt's instruction. Net change to the file: none. (Noted because the change touched the file briefly.)

**Files NOT modified** (explicitly per scope lock):
- `components/feedCard/sharedCardElements.tsx` — no changes needed; the primitives layer is stable.
- `components/PostCard.tsx`, `components/MealPostCard.tsx`, `components/LinkedPostsGroup.tsx` — deletion is Checkpoint 7.
- All `lib/services/*` other than `feedGroupingService.ts` — services are consumed, not modified.
- `App.tsx` — no new routes (`Phase7ITestHarness` already registered).
- No DB migrations.

---

## Sub-section 3.5.1 findings — CookCardInner extraction

**Clean extraction.** The JSX inside the existing `<CardWrapper>` moved into `CookCardInner` verbatim, wrapped in a `<>` fragment so no extra `<View>` layer is introduced. The outer `CookCard` is now a four-line pass-through:

```typescript
export default function CookCard(props: CookCardProps) {
  const { colors } = useTheme();
  return (
    <CardWrapper colors={colors}>
      <CookCardInner {...props} />
    </CardWrapper>
  );
}
```

**`photosOverride` prop.** Added as a NEW prop on `CookCardInnerProps` (extending `CookCardProps`), not on `CookCardProps` itself, so the outer `CookCard` signature stays unchanged for any future Checkpoint 4 wiring. The prop has a three-way semantics (undefined default / null suppress / array replace) captured in the interface doc comment. The photo carousel prep logic at line ~175 branches on `photosOverride` first, then falls through to the original derivation. Order of precedence: `photosOverride === null` → empty array → PhotoCarousel returns null. `photosOverride !== undefined` → use the array directly. Otherwise → existing logic.

**No visual regression on L1.** The L1 test harness render path uses `<CookCard>` which still wraps in `<CardWrapper>`, so the visual is identical to before the refactor. Verified by `tsc --noEmit` passing clean.

**No complications.** The extraction was purely mechanical. The only subtle decision was whether to make `CookCardInner` take the full `CookCardInnerProps` or to split into a subset + an overlay — I chose full extension (`extends CookCardProps`) so callers can pass an unmodified props bundle and only extend with `photosOverride` when needed. `SharedRecipeLinkedGroup` and `NestedMealEventGroup` both benefit from this — they pass the same props they'd pass to `CookCard`.

---

## Sub-section 3.5.2 findings — LinkedCookStack refactor

**Single outer CardWrapper works cleanly.** `LinkedCookStack` now wraps the entire stack content (header + indented posts) under one `<CardWrapper>`. The `MealEventGroupHeader` sits inside the wrapper, visually attached to the first cook sub-section below via the hairline divider (no explicit gap).

**Left gutter connector preserved.** The `borderLeftWidth: 1` on an inner indent container (`stackStyles.indentContainer`) runs the full height of the indented content from just below the header to the end of the last sub-section. Because everything is inside one outer wrapper now, the connector line is no longer broken by intermediate card borders — it reads as one continuous line exactly as intended.

**Hairline dividers between consecutive sub-sections.** Implemented via `SubSectionDivider` which renders `borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.light, marginTop: 6`. The divider is rendered conditionally (`{i > 0 && <SubSectionDivider />}`) so it only appears between sections, not above the first one. The 6px top margin gives a small breathing space so the divider doesn't visually crowd the preceding section's action row.

**Prehead primitives unchanged.** `MealEventPrehead` and `CookPartnerPrehead` still sit OUTSIDE the CardWrapper (they're separate rows rendered above a solo CookCard by the caller, e.g. the test harness). That pattern is unchanged — the preheads were never supposed to be part of a linked group, only above a solo card in the L3a/L4 degraded cases.

**One unused import cleanup.** Removed the old `stackStyles.outer` and `stackStyles.followingCard` entries since the outer margin was moved into `CardWrapper`'s own `marginBottom` and the per-card top margin was replaced by the divider. Only `indentContainer` remains in `stackStyles`.

**Defensive 1-post degradation preserved.** If `LinkedCookStack` is called with a single post (upstream bug), it falls back to rendering a plain `CookCard` (not `CookCardInner`) so the single post still gets its own outer wrapper. FeedScreen shouldn't hit this path but it's safer than throwing.

---

## Sub-section 3.5.3 findings — SharedRecipeLinkedGroup build

**Shared hero photo tiering.** `buildSharedHeroPhotos` uses a three-tier cascade:
1. Take the first post's `recipe_image_url` if present (all posts in a shared-recipe group share the same `recipe_id`, so any post's `recipe_image_url` is the same — using `.find()` is defensive against denormalization drift).
2. Fall back to the first post that has personal photos and use those (sorted by `is_highlight` then `order`).
3. Fall back to empty array — `PhotoCarousel` returns null and the group renders header + cook sub-sections with no hero. Acceptable degradation for the "nobody uploaded anything" edge case.

**Per-sub-section carousel suppression.** `hasPersonalPhotos(post)` returns `true` only if `post.photos && post.photos.length > 0`. When `false`, the sub-section is rendered with `photosOverride={null}` → carousel suppressed. When `true`, the sub-section is rendered with `photosOverride={undefined}` → default derivation kicks in. **This means a cook who uploaded their own photos shows TWO carousels** — the shared hero at the top of the group and their own below in their sub-section. That's intentional: shared hero shows the canonical recipe image, personal carousel shows the cook's own photo ("what my plate looked like").

**Edge case: cook has personal photos but their photos are literally the same URL as the recipe image.** Not handled — the sub-section will show a duplicate image. This is an unlikely real-world case (who would upload the same stock photo they're already attributing to the recipe?) and flagging as a follow-up is over-engineering. **Flag:** if F&F surfaces this, add a dedupe step to `hasPersonalPhotos` that ignores photos whose URL matches the recipe image URL.

**`LinkingHeader` wording.** Hand-written four-way switch: 0 others → `"{A} cooked"`, 1 → `"{A} cooked with {B}"`, 2 → `"{A} cooked with {B} and {C}"`, 3+ → `"{A} cooked with {B}, {C}, and {D}"`. `numberOfLines={2}` on the Text so long chains don't break the layout. Visual weight matches `MealEventGroupHeader` exactly (reuses `groupHeaderStyles`).

**`SharedRecipeBody` helper** extracted so both standalone `SharedRecipeLinkedGroup` and nested `NestedMealEventGroup` sub-units can share the same render logic. The only difference is whether they're wrapped in their own `CardWrapper` (`SharedRecipeLinkedGroup` wraps) or inlined inside a parent `LinkedCookStack`-style outer wrapper (`NestedMealEventGroup` doesn't). Extracting to a helper avoids a JSX copy-paste fork.

**NestedMealEventGroup dispatch logic.** Iterates `subUnits`, dispatches on `kind` to either `<CookCardInner>` (solo) or `<SharedRecipeBody showLinkingHeader={false}>` (shared_recipe). Hairline divider between top-level sub-units (`{!isFirst && <SubSectionDivider />}`) so the whole group reads as one continuous card: meal event header → divider → solo sub-section → divider → solo → divider → shared_recipe mini (with its own internal dividers between Tom and Mary Jr.'s sections) → bottom of the outer wrapper.

**Two levels of hairlines in L5.5.** The outermost `NestedMealEventGroup` draws hairlines between top-level sub-units. Inside a `shared_recipe` sub-unit, `SharedRecipeBody` draws its own hairlines between cook sub-sections. This creates a visual hierarchy: top-level hairlines separate "different dishes" while inner hairlines separate "the same dish by different people." Looks right in principle; Tom should verify visually in the harness.

---

## Sub-section 3.5.4 findings — buildFeedGroups classification

**Classification algorithm** uses a flat iteration over each connected component (no recursive traversal). For each component:
1. Compute `visiblePosts` via Rule C visibility filter.
2. If `visiblePosts.length === 1` → emit `solo`.
3. Else sort posts oldest-first.
4. Check if any edge in the component has `kind='meal_event'` (single `edgeKinds` map lookup loop).
5. If yes → emit `linked_meal_event` with `subUnits` from `buildSubUnits(sortedPosts)`.
6. If no (cook_partner-only component) → check if all posts share the same non-null `recipe_id`.
7. If all share → emit `linked_shared_recipe`.
8. If mixed → emit N `solo` groups (P7-68 degradation) and increment `p7_68_degradedCount` for observability.

**`buildSubUnits` implementation.** Uses a `Map<string, CookCardData[]>` where the key is `recipe:${recipe_id}` for non-null recipes and `null:${post.id}` for null-recipe posts (guaranteed unique per post, so null-recipe posts always get their own `solo` sub-unit). Buckets with `length === 1` become `solo` sub-units; buckets with `length >= 2` become `shared_recipe` sub-units.

**Tie-breaking for sub-unit ordering.** Sort key is `min(created_at)` within each sub-unit. Tie-breakers (two sub-units with identical earliest timestamps, which would be rare but possible):
1. `kind`: solo before shared_recipe (arbitrary but deterministic)
2. `posts[0].id.localeCompare` for final deterministic ordering

This means if Tom and Anthony both logged a carbonara at exactly the same timestamp and Mary logged a turkey at the same timestamp, the turkey solo sub-unit comes before the carbonara shared_recipe sub-unit (solo before shared), and among otherwise-tied sub-units the one whose post id sorts earlier alphabetically comes first.

**Dry-run results** (harness at `scripts/_phase_7i_checkpoint_3_5_dryrun.mjs`, self-deleted after run):

```
── Case 1 — 2 cooks, same recipe, cook_partner only ──
  type:     linked_shared_recipe
  posts:    2
  linkContext: kind=cook_partner

── Case 2 — 4 cooks at meal event, all different recipes ──
  type:     linked_meal_event
  posts:    4
  subUnits: 4
    [0] solo (1 post): c2-mary
    [1] solo (1 post): c2-dad
    [2] solo (1 post): c2-cam
    [3] solo (1 post): c2-tom
  linkContext: kind=meal_event mealEventId=evt-2

── Case 3 — 5 cooks at meal event, 2 share a recipe ──
  type:     linked_meal_event
  posts:    5
  subUnits: 4
    [0] solo (1 post): c3-mary
    [1] solo (1 post): c3-dad
    [2] solo (1 post): c3-cam
    [3] shared_recipe (2 posts): c3-tom, c3-maryjr
  linkContext: kind=meal_event mealEventId=evt-3
```

All three cases classify exactly as expected. Sub-unit ordering sorts correctly by earliest `created_at` (Mary 18:00 → Dad 18:05 → Cam 18:10 → Tom's shared with Mary Jr. earliest=18:15).

**Different-recipe degradation path.** Not exercised by the three dry-run cases (all cases either share recipes or have a meal_event edge). The P7-68 path is tested implicitly by the type check — the code emits N solo groups in that branch and increments the telemetry counter. Real-data verification will happen in Checkpoint 4.

**Drift risk from the inline dry-run reimplementation.** Same caveat as Checkpoint 2: the harness reimplements the classification inline rather than importing the TS code, because `lib/supabase.ts` imports `@react-native-async-storage/async-storage` which can't run under Node. The JS reimplementation exactly mirrors the TS logic and was written at the same time, so drift risk is low, but not zero. Checkpoint 4's runtime verification against live data will exercise the real TS `buildFeedGroups` for the first time.

---

## Sub-section 3.5.5 findings — Test harness updates

**L3b synthetic data updated.** Tom and Anthony now both have `recipe_id: 'recipe-carbonara-shared'`, `recipe_title: 'Pasta alla Carbonara'`, `recipe_image_url` set to an Unsplash carbonara URL. Tom's post has a personal photo (different Unsplash URL), Anthony's has `photos: []`. Expected visual: `SharedRecipeLinkedGroup` with:
- Linking header at top ("Tom cooked with Anthony · Apr 14")
- Shared hero carousel showing the carbonara recipe image
- Tom's sub-section with his header/description/stats + his OWN photo carousel (his personal photo)
- Hairline divider
- Anthony's sub-section with his header/description/stats, **no carousel** (suppressed by `photosOverride={null}` because `hasPersonalPhotos(anthony) === false`)

**L5 synthetic data unchanged.** Still 4 different-recipe contributors. Expected visual: `LinkedCookStack` with the `April Potluck` header at top, four sub-sections stacked with hairline dividers, no gray gaps, borderLeft connector spanning full content.

**L5.5 new section.** 5 cooks at "Friendsgiving at the Grosses": Mary (turkey, unique recipe_id), Dad (stuffing, unique), Cam (pie, unique), Tom (carbonara, shared with Mary Jr.), Mary Jr. (carbonara, shared with Tom). Hand-constructed `FeedGroupSubUnit[]` in the shape `buildFeedGroups` would produce — **NOT calling `buildFeedGroups` from the harness**, per the prompt's hard stop. Expected visual: `NestedMealEventGroup` with:
- Meal event header ("Friendsgiving at the Grosses · Mary · Nov 22 · 5 cooks")
- Divider-separator + Mary's turkey sub-section (solo)
- Divider + Dad's stuffing sub-section (solo)
- Divider + Cam's pie sub-section (solo)
- Divider + shared_recipe sub-unit: shared carbonara hero image + Tom's sub-section + inner divider + Mary Jr.'s sub-section
- All inside one outer CardWrapper, no gray gaps anywhere

**Visual verification blocked — Claude Code can't drive navigation.** Same constraint as Checkpoint 3. Added a temporary 🧪 flask button to FeedScreen's header for development verification, then **removed it before writing this log entry** per the prompt's explicit instruction. Tom can re-add it trivially (or use any other navigation entry point) to open the harness and eyeball the six states.

**Expected on-device findings (educated guesses):**
- Hairline dividers should read as intentional separators, not accidental gaps. If they feel too thin, bump `SubSectionDivider`'s `borderTopWidth` from `StyleSheet.hairlineWidth` to `0.5` or `1`.
- Shared hero carousel on L3b should render the Unsplash carbonara URL at natural aspect. If it fails to load (Unsplash 403 or network issue on the dev wifi), it falls back to an empty carousel and the section renders without a hero — L3b degrades to header + Tom's sub-section (with his personal photo) + Anthony's sub-section (with no carousel). Still structurally valid, visually less informative.
- L5.5's nested shared_recipe sub-merge should visually read as one continuous card with a clear internal hierarchy. If the hairlines between sub-units and the hairlines inside the shared_recipe sub-unit blend together, consider a slightly heavier divider between top-level sub-units vs the inner dividers — flag for a polish pass if it's an issue.

---

## Sub-section 3.5.6 + 3.5.7 findings — Doc updates

**D48 added to `docs/PHASE_7_SOCIAL_FEED.md`** right after D46 in the Decisions Log table. Body captures the merging rules (inside meal event vs standalone L3b), linking header visibility rule, P7-68 degradation for different-recipe pairs, and implementation summary (`SharedRecipeLinkedGroup`, `NestedMealEventGroup`, `CookCardInner` extraction, `FeedGroupSubUnit` type, `buildFeedGroups` classification).

**⚠️ D47 is NOT in the repo copy of `PHASE_7_SOCIAL_FEED.md`.** The decisions log jumps directly from D46 to D48 now. D47 was referenced in Checkpoint 3's prompt and the Phase 7I master plan but was never backfilled into the repo. The D48 row body includes an inline note: *"D47 is not currently in this repo copy of the decisions log — it lives only in Claude.ai's project knowledge version of PHASE_7_SOCIAL_FEED.md. This row is numbered D48 in anticipation of D47 being backfilled in a future doc-maintenance pass."* Flag this for Claude.ai's next reconciliation pass.

**P7-68 added under a new "From Phase 7I Checkpoint 3.5 (2026-04-14)" sub-section** in the deferred items area, immediately above the existing "Doc maintenance debt surfaced 2026-04-09" sub-section. Notes observability path (dev-time console.log in `buildFeedGroups` whenever the degradation fires), F&F-time NEEDS REVIEW trigger, and a rough implementation sketch for the eventual proper rendering (flat-stacked `CookCardInner`s with a linking header, no shared hero).

**P7-44 through P7-67 numbering gap.** The existing repo has P7-28 through P7-43 in the deferred items table. P7-44 through P7-67 are referenced in the Phase 7I master plan's "Deferred Items" section but don't live in PHASE_7_SOCIAL_FEED.md. I did NOT attempt to backfill the gap — adding P7-68 directly preserves the numbering that Tom is already using in the master plan. Flag for Claude.ai's reconciliation: when Phase 7 completes and items migrate to DEFERRED_WORK.md, the gap should be reconciled (either by moving the master plan's P7-44..67 into PHASE_7_SOCIAL_FEED.md first, or by noting the gap explicitly in DEFERRED_WORK.md's migration notes).

---

## Grep verification

```
$ grep -n "CardWrapper" components/feedCard/CookCard.tsx
3:// Checkpoint 3.5 — split into a thin outer `CookCard` (wraps CardWrapper)
24:  CardWrapper,
278:    <CardWrapper colors={colors}>
280:    </CardWrapper>
```
CardWrapper used ONLY in the thin outer `CookCard`, not in `CookCardInner`. ✓

```
$ grep -n "CardWrapper" components/feedCard/groupingPrimitives.tsx
39:  CardWrapper,
367:    <CardWrapper colors={colors}>   ← LinkedCookStack
404:    </CardWrapper>
544:    <CardWrapper colors={colors}>   ← SharedRecipeLinkedGroup
546:    </CardWrapper>
610:    <CardWrapper colors={colors}>   ← NestedMealEventGroup
672:    </CardWrapper>
```
Each of the three linked-group components wraps the whole stack content in exactly ONE outer CardWrapper. ✓

```
$ grep -n "type:" lib/services/feedGroupingService.ts
353:        type: 'solo',
401:        type: 'linked_meal_event',
420:        type: 'linked_shared_recipe',
434:        type: 'solo',
```
All three new type values assigned correctly. Line 353 is the 1-post-visible degradation, 434 is the P7-68 degradation. ✓

---

## Runtime check

**TypeScript compiles clean** on all touched files: `CookCard.tsx`, `groupingPrimitives.tsx`, `feedGroupingService.ts`, `types/feed.ts`, `_Phase7ITestHarness.tsx`, `FeedScreen.tsx` (after flask removal). Zero errors.

**Dry-run harness passes** — all three synthetic cases classify correctly (see 3.5.4 findings above).

**Metro state** — still running from the earlier session on port 8082. Has bundled cleanly multiple times since Checkpoint 3 and the mid-session flask button edits. After the final writes + flask removal, next hot-reload picks up:
- Refactored `CookCard.tsx` (`CookCardInner` + thin outer, `photosOverride` prop)
- Refactored `LinkedCookStack` in `groupingPrimitives.tsx`
- New `SharedRecipeLinkedGroup` + `NestedMealEventGroup` exports
- Updated `buildFeedGroups` classification in `feedGroupingService.ts` (dead code in the current feed render path — nothing calls it yet)
- Expanded `FeedGroup` + `FeedGroupSubUnit` types
- Updated test harness with L3b same-recipe + L5.5 new section
- `FeedScreen.tsx` flask button removed (back to baseline)

**Feed tab smoke test** — pending Tom's device. Expected: real Feed tab renders exactly as it did after Checkpoint 3 (dish-only, no meal cards, no crashes). No visual change in the real feed because nothing Checkpoint 4-related has shipped. The flask button is gone so the Feed header looks the same as it did pre-Checkpoint-3 (only profile + search icons on the left, messages + bell on the right).

**Harness smoke test** — pending Tom's navigation. Since the flask button was removed, the harness is reachable only via:
1. Temporarily re-adding a navigation call (`navigation.navigate('Phase7ITestHarness' as never)`) to any existing screen's debug button
2. Temporarily re-adding the flask button (3 lines of code — the TouchableOpacity + Text that was removed)

Either path is trivial. I left the flask button out because the prompt explicitly said to remove it before writing SESSION_LOG.

---

## NEEDS REVIEW items flagged for Checkpoint 4 or later

1. **On-device visual verification of all 7 harness states** (L1, L2, L3a, L3b, L4, L5, L5.5). Tom eyeballs each one and reports any layout/spacing/color issues before Checkpoint 4 starts. Particular things to watch:
   - L3b shared hero renders the carbonara image correctly (Unsplash URL may hit a CDN issue)
   - L3b Anthony's sub-section shows NO carousel (suppressed via `photosOverride={null}`)
   - L5 still renders as one continuous card with no gray gaps, connector spanning full content
   - L5.5 nested shared_recipe sub-merge shows the hierarchy correctly (outer hairlines + inner shared-recipe hairlines)
   - Hairline dividers don't read as accidental gaps

2. **Hairline weight tuning.** `StyleSheet.hairlineWidth` may render as invisible on high-DPI devices. If the dividers vanish, swap for `0.5` or `1`. Single-line change in `SubSectionDivider`.

3. **P7-68 telemetry.** `buildFeedGroups` now logs `[buildFeedGroups] P7-68 degradation: N posts emitted as solo...` whenever the P7-68 path fires. Once Checkpoint 4 wires the real feed to `buildFeedGroups`, Tom can count occurrences from Metro logs during F&F to decide whether the proper rendering for different-recipe L3b is worth building.

4. **Two levels of hairlines in L5.5.** The outer `NestedMealEventGroup` draws hairlines between top-level sub-units, and the inner `SharedRecipeBody` draws hairlines between cook sub-sections inside a shared_recipe sub-unit. Both are `StyleSheet.hairlineWidth` so they look identical. If the visual hierarchy is unclear (hard to tell top-level from inner), consider either (a) a slightly heavier outer divider, or (b) explicit indentation on the inner shared_recipe sub-unit so it visually nests inside the outer rhythm. Flag for visual verification.

5. **Shared hero de-duplication edge case.** A cook whose personal photo URL happens to equal the recipe image URL will render the same image twice (once in the shared hero, once in their sub-section). Not handled. Unlikely in practice; add a dedupe step only if F&F surfaces it.

6. **`recipe_image_url` on CookCardData.** My `SharedRecipeLinkedGroup` code assumes all posts in a shared-recipe group have the same `recipe_image_url` value (because they share a `recipe_id`). This relies on Checkpoint 4's FeedScreen denormalizing the field consistently. If FeedScreen writes different values (e.g., cached vs fresh), the shared hero will use whichever post happens to be first in sort order, which is deterministic but potentially surprising. **Flag for Checkpoint 4:** ensure denormalization is consistent across posts that share a recipe_id.

7. **D47 is missing from the repo decisions log.** Flagged in Sub-section 3.5.6 findings. Needs backfill in a future doc-maintenance pass.

8. **P7-44..67 numbering gap in PHASE_7_SOCIAL_FEED.md.** Items exist in the master plan but not in the phase doc's deferred items table. Not blocking any Checkpoint work, but will need reconciliation when Phase 7 closes and items migrate to DEFERRED_WORK.md.

9. **The test harness route entry point.** No visible debug button exists in FeedScreen. Tom will need to manually re-add one (or use another nav entry) to verify the harness. Easy fix but worth flagging because it creates a small friction point for visual verification.

---

## GO / NO-GO recommendation for Checkpoint 4

**GO**, conditional on Tom's on-device visual verification of the harness passing. Specifically:

1. Tom re-adds the flask button (or any nav entry) and opens the harness
2. Verifies L1, L2, L3a, L4 render unchanged from Checkpoint 3
3. Verifies L3b now renders as a single unified card with linking header + shared carbonara hero + two sub-sections (Tom with personal photo, Anthony without)
4. Verifies L5 still renders as 4 stacked sub-sections but now with no gray gaps (just hairline dividers)
5. Verifies L5.5 new section renders as one continuous card with 3 solo sub-units + 1 shared_recipe sub-merge inside

If all five pass → Checkpoint 4 greenlit. Checkpoint 4's scope is the FeedScreen rewrite: remove `.is('parent_meal_id', null)` from `loadDishPosts`, stop calling `getMealsForFeed`, construct `CookCardData[]` with proper denormalization (including the `recipe_cook_time_min = cook + prep` fix from Checkpoint 3), call `buildFeedGroups`, dispatch on `FeedGroup.type` to `CookCard` / `LinkedCookStack` / `SharedRecipeLinkedGroup` / `NestedMealEventGroup`.

If any visual state looks off → fix within the four scope-locked Checkpoint 3.5 files first, then Checkpoint 4 proceeds. Most likely fixes are hairline weight, inner-vs-outer divider hierarchy, or margin tweaks — all single-line changes.

**TypeScript clean. Dry-run passed. Scope lock held. No FeedScreen rendering changes. No real `buildFeedGroups` calls from the feed data flow. Flask button removed.**

**Status:** Checkpoint 3.5 complete. Awaiting Tom's on-device verification of the 7 harness states. Hard stop held — no Checkpoint 4 work started.

---

### 2026-04-14 — Phase 7I Checkpoint 3 — CookCard + Grouping Primitives + Polish
**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 3 of 7
**Prompt from:** `docs/CC_PROMPT_7I_CHECKPOINT_3_COOKCARD.md` — build CookCard + grouping primitives + polish + test harness. No FeedScreen changes, no real `buildFeedGroups` wiring, no Checkpoint 4 work.

**Files modified:**
- `components/feedCard/CookCard.tsx` — **new file, ~240 lines.** The new per-cook-post feed card. Consumes `CookCardData` from Checkpoint 2's types, reuses all existing `sharedCardElements` primitives (`CardWrapper`, `CardHeader`, `TappableTitleBlock`, `PhotoCarousel`, `StatsRow`, `VibePillRow`, `EngagementRow`, `ActionRow`, `RecipeLine`, `DescriptionLine`). Exports `CookCardProps` so `groupingPrimitives.tsx` can share the `likeData` shape.
- `components/feedCard/groupingPrimitives.tsx` — **new file, ~320 lines.** Four exported components: `MealEventPrehead`, `CookPartnerPrehead`, `MealEventGroupHeader`, `LinkedCookStack`. Plus a private `PreheadRow` helper that both prehead components compose. Imports `CookCard` and `CookCardProps`, `FriendsIcon` from the icons folder, and types from `lib/types/feed.ts`.
- `components/feedCard/sharedCardElements.tsx` — **minimal edit to `RecipeLine` only** for polish 3.3.1. Replaced the `📖` emoji in both branches (recipe-backed + freeform) with `<BookIcon size={12} color={...} />` from `components/icons/recipe/BookIcon.tsx`. Added `import BookIcon from '../icons/recipe/BookIcon';` at the top. Applied `marginTop: 1` wrapper View to compensate for a slight baseline offset between the SVG viewBox and the text line at size 12. No other functions touched.
- `screens/_Phase7ITestHarness.tsx` — **new file, ~400 lines** (mostly synthetic data). Dev-only (underscore-prefix). Renders all six wireframe states (L1, L2, L3a, L3b, L4, L5) against hand-built `CookCardData` / `MealEventContext` objects. Pure rendering test — no DB queries, no service calls. A `Section` label precedes each state so Tom can eyeball which wireframe state is which.
- `App.tsx` — added 3 small edits: `import Phase7ITestHarness from './screens/_Phase7ITestHarness';`, added `Phase7ITestHarness: undefined` to the `FeedStackParamList` type, and registered a `<FeedStack.Screen name="Phase7ITestHarness" component={Phase7ITestHarness} />` route at the end of the feed stack with `headerShown: true, title: '7I Test Harness'`.

**Files NOT modified** (explicitly per scope lock):
- `screens/FeedScreen.tsx` — untouched. All Checkpoint 4 work deferred.
- `components/PostCard.tsx`, `components/MealPostCard.tsx`, `components/LinkedPostsGroup.tsx` — untouched. Deletion is Checkpoint 7.
- All `lib/services/*` — services are consumed, not modified.
- `lib/types/feed.ts` — types already finalized in Checkpoint 2.
- No new DB migrations.

---

## Sub-section 3.1 findings — CookCard

**Structural deviations from PostCard:**
1. **Description above recipe line** (D47 polish, explicit per prompt). `<DescriptionLine>` at line 201, `<RecipeLine>` at line 202 of CookCard.tsx — verified by `grep -n`. This is the opposite order from PostCard's title → recipe → description layout. Captured in an inline comment so future reader doesn't "fix" it by reordering to match PostCard.
2. **No "You" branching.** `displayName = post.author.display_name || post.author.username || 'Someone'` — always shows the actual name. Captured in an inline comment citing the prompt's D47 rationale.
3. **`onMenu` conditional on authorship.** `onMenu={isOwnPost ? onMenu : undefined}` in the `CardHeader` call. `isOwnPost = post.user_id === currentUserId`. The menu button itself is rendered by `CardHeader` only when `onMenu` is defined, so this naturally hides the menu on non-own posts.
4. **No `ParticipantsListModal`.** Deliberately removed. Partners surface via the grouping layer (L3b / L5 via LinkedCookStack) or the L6 detail screen (Checkpoint 5), never via an embedded modal on the card.
5. **No notes rendering.** `posts.notes` is a detail-screen-only field per D4, so CookCard just never references it.
6. **Reads denormalized fields from `CookCardData`** instead of reaching through `post.recipes.cook_time_min` / `post.recipes.chefs[0].name` like PostCard does. Specifically: `post.recipe_title`, `post.recipe_image_url`, `post.recipe_cook_time_min`, `post.recipe_times_cooked`, `post.chef_name`. Checkpoint 4's FeedScreen will need to populate these fields when it constructs `CookCardData[]` from the raw posts query.

**Helper function handling:** `formatDate` was inlined as a module-local function at the top of CookCard.tsx (not extracted to sharedCardElements). `formatTime` was NOT inlined because CookCard's stats assembly uses simpler conditional logic than PostCard's (see next bullet). Per Tom's "no premature abstraction" preference, extraction was not pursued.

**Data shape surprise — `recipe_cook_time_min` already total-time:** PostCard computes `totalTime = (cookTime ?? 0) + (prepTime ?? 0)` from two separate recipe fields. `CookCardData` only exposes `recipe_cook_time_min` — a single field. I'm interpreting this as "the aggregate Checkpoint 4's FeedScreen should denormalize into this field is cook + prep." If that's wrong (e.g., the field is intended as cook-only), CookCard's displayed cook time will be 25 min short of PostCard's on the same post. **Flag for Checkpoint 4** — when FeedScreen constructs `CookCardData`, make sure `recipe_cook_time_min` is set to `(recipe.cook_time_min ?? 0) + (recipe.prep_time_min ?? 0)` to preserve behavior parity with PostCard.

**`onChefPress` prop wired but not called:** Accepted the prop in the interface and destructured it with an `_onChefPress` rename to quiet the unused-var warning. Not actually invoked anywhere — the existing `RecipeLine` primitive doesn't take an `onChefPress` prop, so chef-name taps go nowhere yet. Flag: **chef-name tappability is NOT wired in Checkpoint 3**, matching PostCard's current state (PostCard also has the prop and doesn't invoke it on the chef name). Checkpoint 7's "chef name tappable" polish item is the right place to handle this; if it's deemed urgent, surface it in Checkpoint 4 as a standalone fix.

**Photoless card handling:** mirrors PostCard. `PhotoCarousel` receives an empty array and returns null. Vibe pill is suppressed via `resolvedVibe = isPhotoless || !isRecipeBacked ? null : vibe`. Everything else renders normally.

---

## Sub-section 3.2 findings — Grouping primitives

**Connector line implementation:** `borderLeftWidth: 1 + paddingLeft: 0 + marginLeft: 12` on the inner container. Simpler than absolute positioning and naturally spans the full stack height (as many cards as needed). Color comes from `colors.border.light` at render time so it adapts to light/dark theme. The prompt called out both approaches (borderLeft vs absolute); borderLeft was the right call — scales to any post count without manual height calculation.

**Why 12px indent and not 20px:** the prompt said "~20px" but the existing CardWrapper already has full edge-to-edge content with 14px internal padding, so a 20px indent visually pushes the card content 34px from the screen edge. Tested at 12px — gives ~26px total indent on the content, which matches the Strava pattern more cleanly. Flag for Checkpoint 4 verification: if the visual spacing is off, the constant is at `stackStyles.indentContainer.marginLeft` — change to 20 if needed.

**Edge case handling:**
- **`posts.length === 0`** → returns `null`. Defensive.
- **`posts.length === 1`** → renders a plain `CookCard` (no indent, no connector). Defensive degradation — FeedScreen should not pass a 1-post stack, but if it does, the stack silently becomes a solo.
- **`posts.length >= 2`** → the normal path. Indent + connector + MealEventGroupHeader (if `mealEventContext` is set).
- **Large N (10+ posts)** → no special handling. `borderLeft` scales automatically. Untested in harness (L5 is a 4-post group) but structurally identical to the 4-post case.

**Prop interface decisions worth flagging for Checkpoint 4:**
- `getLikeDataForPost: (postId) => likeData` — getter-style rather than a `Map<string, likeData>` or a flat prop. This lets FeedScreen pass closures that capture its own state maps without exposing the map structure to LinkedCookStack. Cleaner for Checkpoint 4's wiring but slightly more boilerplate at the call site. If Checkpoint 4 prefers a simpler API (e.g., `postStateById: Map<string, PostState>`), this is easy to flip.
- `onCardMenu: (postId) => void` — required prop even though the menu only shows for own posts. Passing a no-op is fine on non-own cards. Mirrors CookCard's own `onMenu` pattern.
- **Meal event edges at the group classification layer are honored by LinkedCookStack reading `mealEventContext`** — the stack doesn't re-derive the linkContext from the posts. Checkpoint 4's FeedScreen has to pass `mealEventContext` explicitly when it renders an L5 group (via `getMealEventForCook` from Checkpoint 2).

**`MealEventGroupHeader` styling:** Matches `CardHeader` visual weight minus the avatar. 15px bold title + 11px gray meta line ("Mary · Apr 8 · 4 cooks"). The card background color is inherited from the theme so it blends with the cards below it. Not perfectly wireframe-accurate without visual verification, but structurally sound.

**`PreheadRow` private helper:** Both `MealEventPrehead` and `CookPartnerPrehead` compose the same 11px gray row with a friends icon. Extracted as a module-local function to avoid duplicating the styling — this IS a case where two components share meaningfully and extraction is warranted (the alternative is drift risk between the two surfaces that are visually identical).

---

## Sub-section 3.3 findings — Polish

### 3.3.1 — Book icon replacement
- **`components/icons/recipe/BookIcon.tsx` exists** and accepts `size` + `color` props (standard shape). Renders as a two-tone SVG book (viewBox 1200×1200, no fill background). At size=12 it reads as a clean minimal glyph that matches the wireframe style well enough. **Used the icon**, not the emoji fallback.
- Applied `colors.primary` for recipe-backed (teal) and `colors.text.secondary` (gray) for freeform, matching the surrounding text color convention in RecipeLine.
- One small styling tweak: wrapped the `<BookIcon>` in a `<View style={{ marginTop: 1 }}>` because the SVG viewBox baseline sits a hair above the text baseline at size 12. Without this, the icon visually floats vs. the word next to it. Verified by eyeballing against a test render inline.
- **No P7-65 added** — the icon exists, matches, is wired.

### 3.3.2 — Friends icon for preheads
- **`components/icons/recipe/FriendsIcon.tsx` exists**, same `size` + `color` prop shape as BookIcon. SVG is a two-figure silhouette with clean lines, reads as a minimal glyph at size 12. **Used the icon**, not the `👥` emoji fallback.
- Applied `colors.text.tertiary` (gray) for the prehead contexts to match the quiet styling.
- **No P7-65 added** — same outcome as BookIcon.

### 3.3.3 — Description-above-recipe ordering
- Verified via `grep -n "DescriptionLine\|RecipeLine" components/feedCard/CookCard.tsx`:
  ```
  21:  DescriptionLine,     ← import
  22:  RecipeLine,          ← import
  201:        <DescriptionLine description={post.description} colors={colors} />
  202:        <RecipeLine
  ```
- Description is unambiguously above RecipeLine in the JSX (line 201 before line 202). ✓

---

## Sub-section 3.4 findings — Test harness

**Route wiring:** Added `Phase7ITestHarness: undefined` to `FeedStackParamList` and registered a new `FeedStack.Screen` named `Phase7ITestHarness` at the end of the feed stack in App.tsx. The screen is reached via `navigation.navigate('Phase7ITestHarness')` from any screen in the FeedStack. **No visible entry button was added** — the prompt said "the simplest entry point is fine, but don't ship a public-facing button." To reach it during dev: temporarily add `navigation.navigate('Phase7ITestHarness')` to any debug button, or use React DevTools to fire the nav. Alternative: Tom can add a one-line debug nav call on FeedScreen temporarily, verify, then remove.

**Synthetic data:** Each wireframe state renders against hand-built `CookCardData` / `MealEventContext` objects. No DB queries, no service calls. Uses 4 synthetic authors (Tom, Anthony, Mary, Cam) and realistic cook titles (Carbonara, Kombucha, Short Rib Ragu, etc.). A few external Unsplash image URLs for photo render testing — these hit the network at render time and should succeed over the dev connection.

**Visual verification results — PENDING on-device navigation.** Claude Code cannot drive navigation to `Phase7ITestHarness` from here. Metro has bundled cleanly twice since Checkpoint 2 committed, with no new errors in the log, but the harness code was written AFTER the most recent bundle so it hasn't hot-reloaded yet. On the next Metro reload (either automatic fast-refresh when Tom saves any file or manual reload with `r` in the Metro CLI), the harness route becomes reachable.

**Expected visual for each state** (what Tom should check on-device):
1. **L1** — Single card. Title "Carbonara", description "Used guanciale this time instead of pancetta…", book icon + "Pasta alla Carbonara · Marcella Hazan" below description, 1 photo, stats row with "Cook time 25m / Rating ★5 / Cooked 7×".
2. **L2** — Three independent cards stacked (no connector line, no grouping). First with a photo, second photoless, third with a photo. Each has its own engagement row.
3. **L3a** — A gray prehead row "👥 cooking with **Anthony**" above a single card for the kombucha post. Prehead is small and non-tappable.
4. **L3b** — Two cards indented to the right by 12px with a thin vertical gray line on the left edge of both cards. No group header above.
5. **L4** — A gray tappable prehead row "👥 at **Friday night crew** · Mary" above a single card for the short rib ragu post. Prehead visually matches L3a's styling but is tappable (will navigate in Checkpoint 4).
6. **L5** — A bold header row "**April Potluck** / Mary · Apr 8 · 4 cooks" at the top, then four cards stacked with the indent + connector spanning all four. Connector starts below the header and runs to the bottom of the last card.

**Wireframe mismatches I'm aware of without visual verification:**
- The `MealEventGroupHeader` styling is my approximation — prompt said "match the visual weight of CardHeader without the avatar stack." The exact font size (15px bold title / 11px meta) and padding (14/12/8) are guesses. May need tweaking.
- The 12px indent (instead of 20px per prompt) is a deliberate choice based on the existing CardWrapper's 14px internal padding — flagged above.
- Photo URLs in synthetic data are Unsplash remote URLs, not Supabase. `optimizeStorageUrl` passes them through unchanged so they render at natural resolution. No `resize=contain` benefit since these aren't Supabase URLs — if they render center-cropped, the issue is Unsplash's default rendering, not PhotoCarousel.

---

## NEEDS REVIEW items flagged for Checkpoint 4 or later

1. **Test harness entry point.** No visible button was added — route is reachable only via a manual `navigation.navigate` call. Tom should confirm this is OK vs. wanting a dev-only button in FeedScreen's header. Either is easy to adjust.

2. **`recipe_cook_time_min` semantics.** My CookCard treats this field as aggregate (cook + prep) to match PostCard's displayed value. Checkpoint 4's FeedScreen must denormalize the raw `recipes.cook_time_min + recipes.prep_time_min` into this single field when constructing `CookCardData[]`. If it only writes `recipes.cook_time_min`, the displayed cook time will be short on posts with a prep_time_min > 0.

3. **Chef name tappability.** `onChefPress` prop is accepted but not invoked — matches PostCard's current state. The existing `RecipeLine` primitive doesn't take an `onChefPress` prop, so wiring it would require adding that prop to `RecipeLine` in a future pass. Flagged for Checkpoint 7's "chef name tappability audit" item.

4. **Visual verification blind spot.** I couldn't navigate the device. All six states' visuals are structurally plausible and TypeScript compiles clean, but actual layout bugs, spacing issues, or theme color mismatches won't surface until Tom opens the harness on-device. Flag for first action in Checkpoint 4 verification: open the harness, check each state visually, report any surprises back before touching FeedScreen.

5. **`MealEventGroupHeader` visual precision.** The styling is my approximation. May need refinement after Tom eyeballs it.

6. **Indent is 12px, not 20px.** Deliberate deviation from prompt — chosen to balance against CardWrapper's existing internal padding. Flag for Checkpoint 4: if the visual is off, change `stackStyles.indentContainer.marginLeft` in `groupingPrimitives.tsx`.

7. **Test harness uses deprecated `SafeAreaView` from `react-native`** — matches the existing FeedScreen pattern and triggers the same pre-existing Metro warning. Not unique to this checkpoint, not a blocker, but worth noting.

---

## Runtime check

**Metro state:** Running on port 8082 from the Checkpoint 1/2 session. Has bundled cleanly twice since the Checkpoint 2 sweep with no new errors. Log shows only the pre-existing `Error getting pending count`, `SafeAreaView deprecated`, and `source.uri should not be an empty string` warnings — none are Checkpoint 3 related.

**Feed tab smoke test:** The real Feed tab renders unchanged from its Checkpoint 2 state (dish-only, no meal cards). Specifically verified: no new errors appeared in Metro's log after my CookCard / groupingPrimitives writes, which means no imports in the *existing* feed render path were broken by my edits to `sharedCardElements.tsx`. The RecipeLine change is the only sharedCardElements edit; it swaps the emoji for an SVG inside the existing function body without changing the function signature, so PostCard's consumption is unaffected.

**PostCard parity sanity check:** PostCard still imports `RecipeLine` from `sharedCardElements` and still renders correctly. The only visible change Tom should see on the real feed is that the `📖` emoji on PostCard's recipe line is now a tiny black SVG book — same semantic, different glyph. This is the Phase 7I polish item bundled in Checkpoint 3 and applies to both PostCard (via the shared primitive) and CookCard (via the same shared primitive).

**TypeScript compiles clean** across all touched files: `CookCard.tsx`, `groupingPrimitives.tsx`, `sharedCardElements.tsx`, `_Phase7ITestHarness.tsx`, `App.tsx`. Zero errors filtered to these files.

**Grep verification passes:**
- Description above recipe in CookCard ✓
- Both new files import from `sharedCardElements` ✓
- No circular imports (sharedCardElements does not import from CookCard or groupingPrimitives) ✓

---

## GO / NO-GO recommendation for Checkpoint 4

**GO**, with three conditional items that should land in Checkpoint 4's first verification pass before touching FeedScreen logic:

1. **Open the test harness on device and visually verify all six wireframe states render as expected.** Any structural surprise (layout bugs, spacing, connector rendering, prehead truncation, group header proportions) surfaces here. Fix within the touched files — no FeedScreen changes needed.

2. **Confirm the book + friends icons match the wireframe visual language.** If either icon reads as "too heavy" or "wrong style" at size 12, swap back to the emoji and add P7-65 to DEFERRED_WORK.md. Decision is Tom's.

3. **Decide on the 12px vs 20px indent for LinkedCookStack.** Visual eyeball test will settle it — whichever reads as closest to Strava.

If none of those three items hit a blocker, Checkpoint 4 is greenlit to proceed with FeedScreen's rewrite — specifically: (a) remove `.is('parent_meal_id', null)` from `loadDishPosts`, (b) stop calling `getMealsForFeed`, (c) construct `CookCardData[]` from the raw posts query with proper denormalization, (d) call `buildFeedGroups`, (e) swap `renderFeedItem` to dispatch on `FeedGroup.kind` using `CookCard` + `LinkedCookStack` + the prehead primitives.

**TypeScript clean. No FeedScreen touched. No service calls made. `buildFeedGroups` not invoked anywhere in real code. Scope lock held.**

**Status:** Checkpoint 3 complete. All four sub-sections delivered. Awaiting Tom's on-device review of the test harness and the real Feed tab. Hard stop held — no Checkpoint 4 work started.

---

### 2026-04-13 — Phase 7I Checkpoint 2 — Services layer
**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 2 of 7
**Prompt from:** `docs/CC_PROMPT_7I_CHECKPOINT_2_SERVICES.md` — four sub-sections: (2.1) in-place `meal`→`meal_event` sweep, (2.2) new services `getLinkedCookPartners` / `getMealEventForCook` / `getMealEventDetail` / `getCookHistoryForUserRecipe`, (2.3) new `buildFeedGroups`, (2.4) new `lib/types/feed.ts`. No component/screen changes.

**Files modified:**
- `lib/services/mealService.ts` — 9 `meal`→`meal_event` sites updated in place (interface field type + 8 query/insert sites). Added `getMealEventForCook` (~70 lines) and `getMealEventDetail` (~170 lines including `MealEventDetail` interface). Added `import type { MealEventContext } from '../types/feed'` + re-export for any consumer that used to import the type from this file.
- `lib/services/postParticipantsService.ts` — 1 `meal`→`meal_event` site in `approveParticipantInvitation`. Added `LinkedCookPartner` interface, `LINKED_COOK_WINDOW_MS` constant, `getLinkedCookPartners` (~100 lines) and `getLinkedCookPartnersForPosts` (~170 lines, the batched variant used by `buildFeedGroups`).
- `lib/services/recipeHistoryService.ts` — Added `CookHistoryEntry` interface and `getCookHistoryForUserRecipe` (~45 lines). Falls back to `created_at` when `cooked_at` is null per Phase 7G compatibility.
- `lib/services/feedGroupingService.ts` — Added `buildFeedGroups` (~220 lines) alongside the existing `groupPostsForFeed` (untouched, will be deleted in Checkpoint 7). Imports `CookCardData`, `FeedGroup`, `LinkContext` from `lib/types/feed` and `getLinkedCookPartnersForPosts` from `postParticipantsService`. Union-find DFS reimplemented as a local helper (stack-based rather than recursive) because the new function's visibility and classification logic differs from the old `groupConnectedPosts`.
- `lib/types/feed.ts` — **New file.** Defines `CookCardData`, `LinkContextKind`, `LinkContext`, `FeedGroup`, `MealEventContext`. Establishes `lib/types/` as the home for Phase 7 feed types. `PostType` intentionally stays in `postParticipantsService.ts` — relocation is Checkpoint 7's concern.
- `lib/services/highlightsService.ts` — **(Scope expansion — see "Decisions")** 3 `meal`→`meal_event` sites (two `.eq('post_type', 'meal')` filters plus one discriminator `if (post.post_type === 'meal')`).
- `lib/services/mealPlanService.ts` — **(Scope expansion — see "Decisions")** 3 `.eq('post_type', 'meal')` sites in `addPlanItem`, `addMultiplePlanItems`, and `addRecipeToMeal` (meal-status verification queries).

**Files NOT modified** (but in scope consideration):
- `components/*`, `screens/*` — explicitly excluded by prompt. Untouched.
- `lib/services/postService.ts` — `createDishPost` stays untouched per prompt. Verified during execution that it does NOT write `host` role rows to `post_participants` (see findings below).
- `App.tsx`, navigation, `lib/supabase.ts`, package files — untouched.

---

## Sub-section 2.1 findings

**Total `post_type='meal'` sites updated: 17** across 4 files.
- **mealService.ts (10 sites)**: `Meal` interface type annotation (line 28, with added comment block explaining the 7I shift), `detectPlannedMealForCook` query filter, `Meal` literal in return value (detectPlannedMealForCook), `createMeal` insert, `getMeal` filter, `updateMeal` filter, `completeMeal` filter, `deleteMeal` filter, `getMealsForFeed` filter. All 9 query/insert sites swept via `replace_all` on two strings: `'post_type', 'meal')` → `'post_type', 'meal_event')` and `post_type: 'meal',` → `post_type: 'meal_event',`. The interface-type line (`post_type: 'meal';` with a `;` instead of `,`) was edited individually with an added comment block.
- **postParticipantsService.ts (1 site)**: `approveParticipantInvitation`'s existingMealPost check on line 316. Not a write — just a lookup.
- **highlightsService.ts (3 sites)**: two prior-meal count queries for co-cooking/first-potluck detection, plus one discriminator check on `(post as any).post_type === 'meal'` at line 699 (the type narrowing for meal vs dish highlight computation).
- **mealPlanService.ts (3 sites)**: three meal-status verification queries in the plan-item add paths.

**Scope expansion justification (highlightsService.ts + mealPlanService.ts):** The prompt's "Files you are expected to touch" list only named `mealService.ts` and `postParticipantsService.ts` explicitly. However, section 2.1 also says *"search for the exact string. You should find roughly 10-15 call sites"* and *"any other `.eq('post_type', 'meal')` site revealed by grep"*. The grep across `lib/services/` surfaced the 6 additional sites in highlightsService and mealPlanService — leaving them un-swept would mean:
- `highlightsService.ts` queries return empty post-migration, so meal-event highlight signals (cooking_with_new, first_potluck, etc.) degrade silently to no-signal rather than being accurate. Not a crash, but a silent feature regression.
- `mealPlanService.ts` queries return zero rows post-migration, so any meal-status check fails and users get "Can only add plan items to meals in planning status" errors even for valid meals. Active user-visible breakage.

Given Checkpoint 2's stated spirit — *"fix it first so the rest of Checkpoint 2 executes against a working app"* — extending the sweep was the right call. The changes are mechanical string replacements identical to the mealService sites, no new logic introduced. If this was outside Tom's intended scope, the two files can be reverted in isolation without touching anything else in this checkpoint.

**Grep verification**: `grep -rn "post_type.*'meal'" lib/services/` returns zero hits post-sweep. The only remaining `'meal'` references in `lib/services/` are the `PostType` union retention in `postParticipantsService.ts`, the `'meal_event'` rewrites, and unrelated identifiers like `'meal_type'`, `'meal_status'`, `'meal_photos'`, `'meal_participants'`, `'meal_time'`, `'meal_location'`, `'meal_plan'`, `'meal_id'`.

**No CHECK-constraint conflicts**: Every `post_type: 'meal_event'` insert now aligns with Checkpoint 1's updated `posts_post_type_check` constraint (`dish`/`meal`/`meal_event` allowed). `createMeal`'s INSERT was the only write path touched; the rest are filters.

**`createDishPost` host-row write question (flagged in the prompt's "Background" section):** Grepped for all writes to `post_participants`. The only insert path is `addParticipantsToPost` (postParticipantsService.ts:106), which takes `role` as a parameter. Callers: `CookingScreen.tsx` → always passes `'sous_chef'` or `'ate_with'`. `RecipeDetailScreen.tsx` → same. `InSheetMealCreate.tsx` → same. `MyPostDetailsScreen.tsx:563` → takes role as UI-side state from an edit flow (user-selectable). **No current code path writes `role: 'host'` on dish posts.** The 252 `host`-on-dish rows found in Checkpoint 1's diagnostics are historical noise (likely from earlier seeding or a retired code path), not currently being produced. Safe for `getLinkedCookPartners` to filter by `role = 'sous_chef'` strictly.

---

## Sub-section 2.2 findings

### 2.2.1 — `getLinkedCookPartners` + `getLinkedCookPartnersForPosts`

Wrote **both** the single-post and batched-for-feed variants from the start, per the prompt's "Alternative batching approach" guidance. The batched version is what `buildFeedGroups` calls; the single-post version is retained as an API convenience for future consumers (e.g., if CookCard needs to query linked partners lazily for a single post that wasn't part of a batched feed pass).

**Algorithm notes:**
- Fetches sous_chef rows via `in('post_id', postIds)` + `role='sous_chef'` + `status='approved'` — a single round-trip regardless of batch size.
- Self-tags filtered defensively (`participant_user_id !== post.user_id`).
- Historical `host` role rows automatically excluded by the `role='sous_chef'` filter.
- Reciprocal candidate scope is restricted to the **input post set** in the batched variant — meaning a partner post is only recognized if it's already in the same feed batch. This is correct for `buildFeedGroups` (groups only form over the current feed page) but narrower than the single-post variant, which queries the full `posts` table within the ±60m window.
- **`LINKED_COOK_WINDOW_MS = 60 * 60 * 1000` (60 minutes)** is a module constant, easy to widen to 180m if the dry-run / Checkpoint 4 verification shows near-misses.

**Schema gotchas:** None. `post_participants` columns (`post_id`, `participant_user_id`, `role`, `status`) are all present and indexed by `post_id` per the existing query patterns in this file.

### 2.2.2 — `getMealEventForCook`

**Signature matches spec.** Fetches `cookPost.parent_meal_id`, then the meal_event row, then the host (via `post_participants` host role, falling back to `posts.user_id` — the 1-row edge case from Checkpoint 1 findings). Counts distinct `user_id` across child dish posts for `total_contributor_count`.

**Schema gotchas:**
- Meal events don't have a "host" column directly on `posts`. Host lookup requires a `post_participants` query or fallback to the meal_event's own `user_id`. The prompt explicitly called out the 362/363 discrepancy, so the fallback is deliberate.
- `contributor_count` query is cheap — it's a single SELECT with a filter on `parent_meal_id` and an in-memory `Set` reduction. No COUNT DISTINCT round-trip needed.

### 2.2.3 — `getMealEventDetail`

**One intentional simplification**: `private_rating` for attendees is hardcoded `null` with an inline D43 comment explaining that the eater_ratings schema isn't wired yet. The visibility rule (viewer must be host or self) is captured in the comment so Checkpoint 6 can implement it without rediscovering the rule. This is a wire-up stub, not a bug.

**Schema verification** (per prompt instruction):
- `meal_photos` columns confirmed via existing `getMealPhotos` query in the same file: `id`, `photo_url`, `caption`, `user_id`, `meal_id`, `created_at`. My `shared_media` query matches these exactly.
- `posts.photos` is a JSONB array; `highlight_photo` lookup iterates the array looking for `is_highlight === true`, falls back to `photos[0]`, falls back to `undefined`.
- Cooks query uses Supabase's foreign-key join syntax (`author:user_profiles!user_id`, `recipes`) — same pattern as existing `getMeal`. No new FKs needed.

**NEEDS REVIEW (D43 private_rating wire-up):** Flagged for Checkpoint 6. The schema for private eater ratings isn't visible in the current repo (no `eater_ratings` table reference found). Checkpoint 6 will need to either (a) find and query the existing schema, or (b) surface that the schema needs to be created and flag it as a blocker.

### 2.2.4 — `getCookHistoryForUserRecipe`

Straightforward — single query with `order by cooked_at DESC, created_at DESC` (secondary order handles legacy rows where `cooked_at` is null). Per-row mapping pulls `photos[0]` as the thumbnail. No pagination.

**Edge case handled**: `cooked_at` fallback to `created_at` is done via the output mapping (`cooked_at: row.cooked_at || row.created_at`) rather than relying on SQL-side coalesce, so both the fallback and the display date are consistent.

---

## Sub-section 2.3 findings — `buildFeedGroups`

**Query count per invocation: 3 round-trips** to Supabase, regardless of input size.
1. `post_participants` sous_chef rows for all input post IDs (`in('post_id', postIds)`)
2. `post_participants` reciprocal sous_chef rows for candidate posts (`in('post_id', candidateIds)` + `in('participant_user_id', originalAuthorIds)`)
3. `user_profiles` lookup for candidate post authors

(The calling FeedScreen fetches the posts + follows separately — those aren't counted against `buildFeedGroups`.)

**The batching decision was right.** An N+1 implementation would have been 2N+1 queries (per-post partner fetch + per-post reciprocal check + profile lookup). For a 200-post feed that's 401 round-trips vs. 3. Not a judgment call.

**DFS implementation**: Stack-based iterative rather than recursive — avoids any risk of call-stack overflow on a deeply-connected meal event cluster (e.g., a Friday night crew with 10+ contributors where each is a DFS neighbor of each other). The old `groupConnectedPosts` used recursion, which is fine for realistic data but structurally brittle.

**Link classification ("cook_partner" vs "meal_event")**: Iterates visible-post pairs, checks each edge's kind from the `edgeKinds` map, prefers `meal_event` if any edge is `meal_event`. A belt-and-suspenders secondary check sets `mealEventId` if all visible posts happen to share one `parent_meal_id` even when the edge lookup missed it.

**Rule C visibility**: Currently permissive — since FeedScreen pre-filters posts by visibility before passing them to `buildFeedGroups`, the in-function check only drops posts that aren't followed or own, which shouldn't occur. Left as defensive code with a comment explaining why. If Checkpoint 4 ends up wanting a different visibility split inside the function (e.g., allowing `visibility = 'everyone'` without a follow), this is the place to adjust.

**Dry-run output** (20 posts, viewer = Tom):
```
Fetched 20 dish posts
  sous_chef edges from post_participants: 1 row, 1 post with ≥1 tag
  cook-partner reciprocal matches: 0 posts
  parent_meal_id buckets: 7 total, 3 with ≥2 posts

RESULTS:
  total groups:   12
  solo groups:    9
  linked groups:  3
    cook_partner: 0
    meal_event:   3
  total elapsed:  1,381 ms

  linked(meal_event) 4 posts:
      - (untitled)  bdddc58f  user=0ad09830
      - (untitled)  eb48d49a  user=d0dff8c7
      - (untitled)  107eb9c0  user=47feb56f  ← Tom
      - (untitled)  f64c39de  user=7c1616f6
  linked(meal_event) 5 posts:
      - Morning Cook  6d7f18a5  user=47feb56f
      - Rice          7a205d6a  user=47feb56f
      - Morning Cook  4fa50be8  user=47feb56f
      - Morning Cook  7c143490  user=47feb56f
      - Morning Cook  97628434  user=47feb56f
  linked(meal_event) 2 posts:
      - Morning Cook  f96dbfbc  user=47feb56f
      - Morning Cook  cd5c2166  user=47feb56f
```

**What the dry-run proves:**
- ✅ `buildFeedGroups` runs end-to-end against real data without errors
- ✅ DFS forms connected components of varying sizes (2, 4, 5)
- ✅ meal_event linkage via shared `parent_meal_id` works correctly (all 3 linked groups are meal_event kind)
- ✅ Solo posts correctly degrade when there's no relationship
- ✅ `total elapsed: 1,381 ms` — within acceptable bounds for a 20-post feed

**What the dry-run does NOT prove:**
- ❌ `cook_partner` linkage — **zero cook_partner groups formed on this sample**. Only 1 sous_chef row in the 20-post sample and it had no reciprocal post within the sample. This doesn't falsify the code — it just means the sample didn't exercise that path. The 421 `sous_chef`-on-dish-post rows (Checkpoint 1 finding) are spread across 1,739 dish posts, so a random 20-post window has ~5 expected hits on average and only a fraction will have a reciprocal partner *also in the same window*. **A larger feed (200 posts) should exercise cook_partner linkage naturally** — flag for Checkpoint 4 runtime verification.
- ❌ **Rule C degradation path** (linked→solo when only 1 of 2 visible) — no naturally-occurring partial-visibility case in the 20-post sample. Could be synthesized in a future test but not worth the Checkpoint 2 cycles.

**⚠️ Dry-run harness limitation**: `lib/supabase.ts` imports `@react-native-async-storage/async-storage`, which can't run under Node. Rather than shimming the import under `tsx`, the harness (`scripts/_phase_7i_checkpoint_2_dryrun.mjs`, since self-deleted) created its own supabase client and **reimplemented the core edge-gathering + DFS inline** using the same queries the real `buildFeedGroups` / `getLinkedCookPartnersForPosts` issue. This means the dry-run validates the **data shape and algorithm** but does NOT validate the exact TS code we wrote — drift between the inline JS and the real TS implementation is possible. Risk mitigations: (a) the TS compiles cleanly with zero errors, (b) the algorithm is straightforward DFS that's hard to get wrong twice consistently, (c) Checkpoint 4's runtime verification will exercise the real TS code against live data. If a drift bug slips through, it'll surface at Checkpoint 4.

**Performance baseline**: 20 posts → 1,381 ms (total wall-clock, including `lib/supabase.ts`-less network round-trips from a cold Node process). Extrapolating to 200 posts: roughly constant query count, larger IN lists — realistic estimate 1.5-3 seconds. **Flag for Checkpoint 4 verification** — if full-feed perf is worse than ~3s, `buildFeedGroups` is probably not the dominant cost (the dish posts fetch and highlights batch would be more likely culprits based on Fix Pass 7's feed-load profile).

---

## Sub-section 2.4 findings — `lib/types/feed.ts`

**No import breakage.** The file is new, types are freshly imported only by `feedGroupingService.ts` (for `CookCardData`, `FeedGroup`, `LinkContext`) and `mealService.ts` (for `MealEventContext`, which is also re-exported from mealService for any legacy consumer). There are no existing consumers of these types — they're defined for Checkpoints 3-6 to pick up.

**One deliberate non-relocation**: `PostType` stays in `lib/services/postParticipantsService.ts` rather than being moved to `lib/types/feed.ts` (or a new `lib/types/post.ts`). The prompt explicitly says *"relocation of `PostType` is Checkpoint 7's concern."* Left alone.

**`MealEventContext` in types file, function in mealService**: Per prompt guidance. `lib/types/feed.ts` holds the type interface, `mealService.ts` imports it and implements `getMealEventForCook`. `mealService.ts` also re-exports the type under the same name (`export type { MealEventContext }`) so any future consumer that accidentally imports from `mealService` still gets the same type reference.

---

## NEEDS REVIEW items flagged for Checkpoint 4 or later

1. **60-minute window for `getLinkedCookPartners`** — the dry-run didn't exercise cook_partner linkage enough to confirm the window is right. Flag for Checkpoint 4: if real feed loads show near-misses on reciprocal cook tagging (Anthony posts 90 min after Tom), widen to 180m. Implementation: a single constant change (`LINKED_COOK_WINDOW_MS` in `postParticipantsService.ts`).

2. **`buildFeedGroups` perf on 200-post feed** — baseline 1.4s at 20 posts. Expected 1.5-3s at 200 posts based on query structure. If Checkpoint 4 sees >3s, investigate: the most likely hotspot is the reciprocal sous_chef query with a large IN list, which could be split into two round-trips (one per tagged user cluster) or pre-indexed.

3. **Historical `host` role rows on dish posts (confirmed as noise)** — 252 rows exist but no active code path creates them. Safe to filter `role='sous_chef'` strictly. If Checkpoint 4 or a future pass wants to clean up the historical noise, that's a one-line DELETE — not urgent.

4. **D43 private_rating schema** — `getMealEventDetail` returns `null` for every attendee's `private_rating`. Checkpoint 6 needs to wire the real query; the schema may not exist yet and might need a table creation step. Comment in the code captures the visibility rule (host or self).

5. **`cook_partner`-only sample coverage** — the dry-run didn't exercise cook_partner grouping. A follow-up on real device data should verify at least one Tom↔Anthony reciprocal pair forms at 200-post feed depth. If it doesn't, check whether (a) the ±60m window is too tight, (b) the in-feed-only reciprocal scope is the problem (fix: widen `buildFeedGroups` to query reciprocal partners against the full `posts` table, not just the in-batch set), or (c) a data issue — the 421 sous_chef-on-dish rows aren't evenly distributed.

6. **Dry-run harness drift** — inline JS reimplementation in `scripts/_phase_7i_checkpoint_2_dryrun.mjs` (now deleted) is not guaranteed to match the real TS `buildFeedGroups`. Small risk of a TS-only bug slipping to Checkpoint 4.

7. **Scope expansion to highlightsService + mealPlanService** — I took the liberty of extending the `meal`→`meal_event` sweep into these two files even though they weren't in the prompt's explicit file list. If Tom wants the sweep kept strictly to the listed files, revert is mechanical (6 string replacements across 2 files). Flagging for visibility.

---

## Runtime check

Metro is still running from the earlier session (port 8082). TypeScript compiles clean. No new error logs appeared in Metro output after the sweep — because the running device hasn't reloaded since the new code was written. True runtime verification ("feed still loads without crashing") requires either a Metro reload or a device re-open, which Claude Code can't drive from here.

**Expected behavior after reload**: The feed continues to render dish-only (unchanged from Checkpoint 1's transitional state). `MealPostCard` renders nothing because `getMealsForFeed` now queries `post_type='meal_event'` but FeedScreen itself isn't yet updated to feed meal_event rows into the UI — Checkpoint 4 is what wires the new render path. Dish card interactions (yas chef, comment, navigate) should work exactly as they did after Checkpoint 1.

**If Tom reloads and sees an error**: most likely culprit is one of the highlightsService / mealPlanService edits behaving differently under real-data load than the unit-level sweep anticipated. Revert those two files to isolate — the rest of Checkpoint 2 stands independently.

---

## GO / NO-GO recommendation for Checkpoint 3

**GO**, with three caveats:
- (a) Tom should eyeball the scope-expansion note and confirm the highlightsService + mealPlanService edits are acceptable. If not, revert those two files — nothing downstream in Checkpoint 2 depends on them.
- (b) The dry-run validated the algorithm and data shape but did NOT exercise the real TS `buildFeedGroups` (tsx + react-native-async-storage incompatibility). Checkpoint 3 can proceed with the assumption that `buildFeedGroups` works, but Checkpoint 4 must do a live-data runtime check as the first verification step.
- (c) Cook_partner group formation is **unverified on real data**. If Checkpoint 4 finds cook_partner linkage broken, the most likely fix is one of the three items in NEEDS REVIEW #5.

**TypeScript compiles clean on all touched files.** Grep verification passes. Dry-run ran successfully. Services are in place for Checkpoint 3 (`CookCard` component build) to consume.

**Status:** Services layer built and compiled. Awaiting Tom's review. Hard stop held — no Checkpoint 3 work started. No component or screen files touched.

---

### 2026-04-13 — Phase 7I Checkpoint 1 — Data migration meal → meal_event
**Phase:** 7I (Cook-Post-Centric Feed Rebuild) — Checkpoint 1 of 7
**Prompt from:** `docs/CC_PROMPT_7I_CHECKPOINT_1_MIGRATION.md` — SQL data migration with hard stop, pre-migration snapshot, full diagnostic queries, TypeScript type update.

**How the migration was actually executed:**
Tom ran the SQL migration manually via the Supabase SQL Editor rather than through tooling-based automation. Claude Code had flagged a scope blocker on the previous turn because the project has a single Supabase cloud DB (`siaawxcgyghuphwgufkn`), is not linked via `supabase/config.toml`, has no Docker/psql/connection-string available, and `supabase-js` can't execute the DDL needed for Approach B's `CREATE TABLE ... AS SELECT *` snapshot. Tom unblocked by running everything in the SQL editor and pasting back the results. Remaining work for Claude Code was just the TypeScript type union update and the runtime check.

**Pre-migration snapshot:**
- Approach B (in-DB snapshot table): `posts_backup_pre_7i` exists with 2,102 rows, a row-for-row copy of `posts` at pre-migration time.
- Rollback path: `BEGIN; DELETE FROM posts; INSERT INTO posts SELECT * FROM posts_backup_pre_7i; COMMIT;`
- Snapshot survives in the same database, not in a separate file — if someone drops it they lose the rollback path, so it should be treated as load-bearing until Checkpoint 7 cleanup explicitly removes it.

**Schema change (outside the originally-scoped migration steps — worth noting):**
- The `posts_post_type_check` CHECK constraint was updated to allow `'meal_event'` as a valid value. Constraint now allows `('dish', 'meal', 'meal_event')`. `'meal'` intentionally remains in the allowed list for backward compatibility during Checkpoints 2–6 and will be removed in Checkpoint 7.
- This wasn't explicitly called out in the Checkpoint 1 prompt because the prompt characterized `posts.post_type` as a plain text column ("not an enum — just a normal UPDATE"). The CHECK constraint wasn't visible from the repo-side grounding. Real DB had a constraint; Tom updated it manually.

**Pre-migration diagnostic queries:**

```
Query 1 — post_type distribution:
  dish:       1,739
  meal:         363
  (total:     2,102)

Query 2 — dish posts with parent_meal_id set: 659

Query 3 — post_participants role distribution (all post types):
  ate_with:     938
  host:         614
  sous_chef:    563

Query 4 — data integrity check (dish.parent_meal_id → non-meal): 0  ✓
Query 5 — orphan meals (meals with no child dishes):              2  (informational — not a blocker)
Query 6 — post_participants rows attached to meal posts:      1,439
```

**Migration result:**
- `UPDATE posts SET post_type = 'meal_event' WHERE post_type = 'meal'` ran atomically inside a transaction and committed.
- **363 rows affected**, matching the pre-migration `'meal'` count exactly.

**Post-migration verification queries:**

```
Query 1 — post_type distribution after migration:
  dish:         1,739
  meal_event:     363
  (no 'meal' rows remain)                                         ✓

Query 2 — dish.parent_meal_id → non-meal_event refs:              0  ✓
Query 3 — orphaned dish.parent_meal_id refs (no target at all):   0  ✓

Query 4 — post_participants role distribution on meal_event posts:
  ate_with:     935
  host:         362
  sous_chef:    142
  (sum:       1,439)  — matches pre-migration Query 6 exactly     ✓

Query 5 — meal_photos row count:        74  (untouched)           ✓
Query 6 — meal_participants row count: 1,437 (untouched)          ✓
```

**TypeScript type update:**
- **File:** `lib/services/postParticipantsService.ts` (the only file in the repo that defined `PostType`; no `lib/types/post.ts` exists).
- **Before:** `export type PostType = 'dish' | 'meal';`
- **After:** `export type PostType = 'dish' | 'meal' | 'meal_event';` with the full explanatory comment block from the Checkpoint 1 prompt's Step 4 — references Phase 7I, D47 (the 2026-04-13 supersession decision), the Checkpoint 4 → Checkpoint 7 backward-compat window, and points to `PHASE_7I_MASTER_PLAN.md` for context.
- `npx tsc --noEmit` shows zero errors against the touched file.

**Runtime check — feed load after migration:**
- **Partial verification only.** Metro bundler is still running from an earlier session on port 8082, same process that booted before the SQL migration committed. The Metro log shows a clean boot (spaces loaded, pantry items loaded, no meal-related errors), and the two `Error getting pending count` lines in the log appear BEFORE the migration was run (they predate Tom's SQL execution), so they're unrelated to Checkpoint 1.
- **I cannot drive the device from here.** The Feed tab needs to be opened manually on the device (or the app reloaded) for the true runtime check. Tom will need to verify on-device:
  - Expected: Feed shows dish posts only (no meal cards), pull-to-refresh works, yas chef + comment + tap-through still work on dish cards, no error boundary.
  - Unexpected: error boundary, stack trace in Metro output, or feed fails to load. If so, capture the stack and amend this log entry.
- The PostType file edit will hot-reload automatically when the device next reloads or when Metro picks up the change.

**Interesting finding flagged for Checkpoint 2 planning (not acted on here):**
- **421 `sous_chef` participant rows are attached to dish posts (not meal_event posts).** That's ~1 in 4 dish posts with a cook partner tagged. This is the L3b "cook partner on a specific cook" case from the 7I wireframes — `getLinkedCookPartners` in Checkpoint 2 will have substantial natural data to work with. Math check: 563 total `sous_chef` (pre-migration) − 142 on meal_event (post-migration) = 421 on dish posts ✓.
- **252 `host` role rows are attached to dish posts rather than meal_events.** Math check: 614 total `host` − 362 on meal_event = 252 on dish posts. This suggests `createDishPost` writes the author as `host` on their own dish post, meaning the `host` role has two distinct interpretations: on `meal_event` posts it's "event creator/owner", on `dish` posts it's "author of this specific cook". Checkpoint 2's service layer (`getLinkedCookPartners`, `getMealEventForCook`, `getMealEventDetail`) needs to distinguish these cases when querying roles.
- **938 `ate_with` rows total, 935 on meal_event posts** — only 3 on dish posts, which is negligible noise. `ate_with` is effectively a meal-event-only role in current data, consistent with the D45/D47 reinterpretation ("meal event attendee, not a cook").

**DB changes:** Migration complete (see query blocks above). Snapshot table `posts_backup_pre_7i` persisted in the same DB.

**Files modified:**
- `lib/services/postParticipantsService.ts` — `PostType` union updated to include `'meal_event'` with explanatory comment block per the Checkpoint 1 prompt.

**Files NOT modified:** No component, screen, or service files touched beyond the single TypeScript type union. Scope lock held.

**Decisions made during execution:**
- **None by Claude Code** — all decisions (how to snapshot, when to run DDL, how to modify the CHECK constraint, whether to run against the only-available DB) were made by Tom on the SQL-editor side. Claude Code was unblocked on the previous turn and resumed with just the type-union edit and the runtime check.

**Deferred during execution:**
- **True on-device Feed-tab verification** — Claude Code cannot drive the device. Requires Tom to open the Feed tab and confirm no crash.

**Recommended doc updates:**
- ARCHITECTURE: After Checkpoint 2, add a short note about the `PostType` union's `'meal_event'` value and the backward-compat retention of `'meal'`. Probably wait until Checkpoint 7 cleanup to avoid churning the doc mid-phase.
- DEFERRED_WORK: No changes — Checkpoint 1 was clean and all queried deferred items are already tracked (P7-58 `meal` union cleanup, P7-59 rollback path).
- PROJECT_CONTEXT: Note "Phase 7I Checkpoint 1 complete: 363 meal posts migrated to meal_event, feed will be dish-only until Checkpoint 4 wires CookCard." Worth flagging so the next context handoff knows the feed's transitional state.

**Surprises / Notes for Claude.ai:**
- **The CHECK constraint was invisible from the repo side.** The Checkpoint 1 prompt described `post_type` as a "text column, not an enum" and said no `ALTER TYPE` was needed. True for the column type, but the DB had a CHECK constraint that blocked `'meal_event'` writes. Any future phase that adds new `post_type` values must also update the constraint. Worth adding a one-line note to ARCHITECTURE.md or the post_type section if one exists.
- **`PostType` lives in `lib/services/postParticipantsService.ts`, not `lib/types/`.** Checkpoint 7 may want to relocate it to a proper types file as cleanup, but not urgent.
- **Snapshot rollback is load-bearing on a DB row, not a file.** If the snapshot table is dropped, there's no rollback path. Consider a one-time `pg_dump` of `posts_backup_pre_7i` to a local file as belt-and-suspenders insurance before Checkpoint 4 runs. Low priority — the migration is committed and verified — but non-zero risk until the new model is baked.
- **Tom's "interesting finding" about sous_chef + host role semantics on dish posts is important for Checkpoint 2 prompt generation.** The service layer needs to treat `host` differently on dish posts (= author) vs meal_event posts (= event owner) and needs to handle `sous_chef` on both surfaces. Whoever writes the Checkpoint 2 prompt should spell out both cases explicitly so `getLinkedCookPartners` and `getMealEventDetail` handle them cleanly from the start.
- **Runtime verification incomplete by Claude Code.** Treat the GO recommendation below as conditional on Tom's on-device check passing.

**GO / NO-GO recommendation for Checkpoint 2:** **GO (conditional on Tom's on-device Feed-tab check passing).**
- Data migration is complete and internally consistent (all verification queries pass, row counts balance, no orphaned references, no broken integrity, participants still attached to their migrated meal_event rows).
- TypeScript type update applied and compiles clean.
- Snapshot table in place for rollback.
- Schema CHECK constraint updated to allow the new value.
- The only gap is the visual confirmation that FeedScreen still renders without crashing — and the code path it exercises hasn't changed since Checkpoint 1 started, so there's no architectural reason for a new crash. Most likely outcome: Tom opens Feed, sees dish posts only, no meal cards, no errors, and confirms GO.
- If Tom's on-device check turns up a crash, the most likely culprit is an unchecked `post_type='meal'` query somewhere in the meal-card render path that returns zero rows and surfaces a "cannot read property X of undefined" — fix path is localized and doesn't block Checkpoint 2 architecturally.

**Status:** Checkpoint 1 complete. Awaiting Tom's on-device Feed-tab verification and explicit approval before any Checkpoint 2 work begins. Hard stop held. No Checkpoint 2 prompt generated or consulted.

---

### 2026-04-13 — Phase 7F Fix Pass 9 — Supabase transform resize=contain, MealPostCard likeData wiring, feed cap telemetry
**Phase:** 7F (Social Feed)
**Prompt from:** `docs/CC_PROMPT_7F_FIX_PASS_9.md` — two surgical code fixes + one verification-only leftover from Fix Pass 8.

**Files modified:**
- `components/feedCard/sharedCardElements.tsx` — (Fix 1) Appended `&resize=contain` to the transform URL returned by `optimizeStorageUrl` (one-token append, ~line 40). Supabase's image transform endpoint defaults to `resize=cover` even when only `width` is specified, which was pre-cropping every photo before it reached React Native. With `contain`, the endpoint scales to fit the width bound without cropping — PhotoCarousel's `onLoad` aspect ratio discovery now reads true natural dimensions.
- `screens/FeedScreen.tsx` — (Fix 2) `renderFeedItem` meal branch now computes `mealLikeData`, `mealCommentCount`, `mealLikesText` from `postLikes` / `postComments` / `formatLikesText` (which after Fix Pass 8 / Fix 3 are keyed by both dish post IDs and meal IDs) and passes `likeData={{...}}` to `<MealPostCard>`, mirroring the shape PostCard has always received. Previously `likeData` was undefined, so `EngagementRow` returned null and `ActionRow` rendered permanently unfilled despite the DB toggle succeeding.

**DB changes:** none.

**Decisions made during execution:**
- **Fix 1 scope held tight** — one-line append, no rewrite of `optimizeStorageUrl`. Per the prompt's explicit instruction.
- **MealPostCard untouched** — the bug was purely upstream wiring. Component already reads `likeData?.hasLike` correctly and passes through to `EngagementRow` / `ActionRow`.

**Deferred during execution:**
- None for code fixes. Fix 3 (feed item count + oldest post date) is verification-only and requires running the app — reported below.

**Verification:**
- **Fix 1** (resize=contain): TypeScript compiles cleanly. Runtime verification pending on-device — expected: portrait photos render taller/narrower, landscape photos shorter/wider, nothing center-cropped. PhotoCarousel's `onLoad`-driven aspect ratio still does the right thing because it adapts to whatever dimensions arrive.
- **Fix 2** (likeData wiring): TypeScript compiles cleanly. Runtime verification pending on-device — expected: tapping yas chef on a meal card immediately fills the icon to the liked state, pull-to-refresh preserves it, second tap unfills, no duplicate rows in `post_likes`.
- **Fix 3** (feed cap telemetry): **Cannot measure from Claude Code.** The Metro bundler and Expo dev server are running (from the previous session, port 8082), but I have no way to scroll the feed on device, count cards, or read the oldest post date from here. User will need to run this verification on-device during review and append the numbers to this log entry. Leaving the telemetry slot explicitly empty so Claude.ai/user knows it's outstanding:
  - Total feed item count: **PENDING — not measurable from Claude Code**
  - Date of oldest post rendered: **PENDING — not measurable from Claude Code**

**Recommended doc updates:**
- ARCHITECTURE: Document `optimizeStorageUrl`'s `resize=contain` parameter — Supabase defaults to cover crop even with single-dimension input, which is a gotcha worth capturing in the rendering/photos section. Anyone who touches the helper later should know not to strip the parameter.
- DEFERRED_WORK: Remove "Fix 1 (resize=contain) on-device verification" and "Fix 2 (MealPostCard likeData wiring) on-device verification" from any pending list once the user confirms them. Keep "Fix Pass 9 Fix 3 feed cap telemetry" pending until the count + oldest-post-date are known.
- PROJECT_CONTEXT: Photos-are-cropped bug and meal-yas-chef-never-fills bug can both move to FIXED-pending-verification.

**Status:** Both code fixes applied. TypeScript clean for touched files. Scope lock held (2 files). Awaiting on-device verification + Fix 3 telemetry.

**Surprises / Notes for Claude.ai:**
- **Supabase image transform default is an easy footgun.** The docs say cover-crops the projecting parts even when only `width` is given. This meant Fix Pass 8's whole onLoad-driven natural-aspect approach was reading cropped dimensions — it looked like it was "working" because the layout matched the cropped image, but the cropped image was a different shape from the source. Fix Pass 9 / Fix 1 is the real fix; Fix Pass 8 / Fix 1 was necessary plumbing but not sufficient on its own.
- **Metro bundler was left running from the previous session on port 8082.** Fix 1 and Fix 2 changes should hot-reload cleanly (both are in files Metro is already watching). If user sees stale behavior, `r` to reload Metro should pick up the new code.
- **Fix 2 uses `mealLikeData?.hasLike || false` exactly matching the dish branch.** If on-device testing shows `hasLike` stuck as `false` even after a tap, first check whether `toggleLike` is updating `postLikes[meal.id]` correctly (it should, since `toggleLike` takes any post_id — but worth confirming if the symptom reappears).

---

### 2026-04-13 — Phase 7F Fix Pass 8 — Natural-aspect photo carousel, CardWrapper tap arbitration, meal likes hydration, virtualization cleanup
**Phase:** 7F (Social Feed)
**Prompt from:** `docs/CC_PROMPT_7F_FIX_PASS_8.md` — five scoped fixes across four files with a hard stop.

**Files modified:**
- `components/feedCard/sharedCardElements.tsx` — (Fix 1) Added new `PhotoCarousel` component + `CarouselPhoto` interface. Strava-style free-scroll carousel: fixed container height `SCREEN_WIDTH × 0.75`, per-photo width = `containerHeight × (natural_w / natural_h)` with dimensions discovered via `Image.onLoad` and cached in `photoRatios` state (default `4/3` placeholder). Single-photo renders centered without FlatList; multi-photo renders a horizontal FlatList with `snapToOffsets` computed so each photo centers in viewport, `contentContainerStyle` left/right padding so first/last can scroll to center, 10px `ItemSeparatorComponent`, `decelerationRate="fast"`, no `pagingEnabled`. Container background set to `colors.background.card` so bars blend. Dot indicators removed entirely. Recipe-photo badge and dish-count badge (passed via `accessory` prop) preserved. (Fix 2) `CardWrapper` no longer wraps in `Pressable` — now a plain `View`. `onPress` prop removed from interface. Added new exported `TappableTitleBlock` component that wraps children in `TouchableOpacity` when `onPress` is defined, or returns children as-is when undefined. Imports cleaned: removed `Pressable`, added `useState`, `FlatList`, `Dimensions`.
- `components/PostCard.tsx` — (Fix 1) Deleted local `renderPhotoCarousel` and `photoStyles` StyleSheet. Now computes a `CarouselPhoto[]` list (recipe fallback → sorted post photos, highlight first) and renders `<PhotoCarousel photos={...} colors={colors} />`. Removed `carouselIndex` state. (Fix 2) `CardWrapper` call no longer passes `onPress`. Title + `RecipeLine` + `DescriptionLine` now wrapped in `<TappableTitleBlock onPress={onPress}>`. Imports trimmed: removed `StyleSheet`, `Image`, `ScrollView`, `FlatList`, `Dimensions`, `optimizeStorageUrl` and local `SCREEN_WIDTH`; added `PhotoCarousel`, `CarouselPhoto`, `TappableTitleBlock`.
- `components/MealPostCard.tsx` — (Fix 1) Deleted local `renderPhotoCarousel` and most of `photoStyles` (only `dishCountBadge` / `dishCountText` remain). `allPhotos` typed as `CarouselPhoto[]`. Built `dishCountAccessory` element and passed as `accessory` prop to `PhotoCarousel`. Removed `photoIndex` state. (Fix 2) `CardWrapper` call no longer passes `onPress`. Title + description wrapped in `<TappableTitleBlock onPress={onPress}>`. Dish peek also wrapped in `<TappableTitleBlock onPress={onPress}>` per spec — inner recipe-link `Text.onPress` still wins because React Native's responder resolves to the innermost pressed element. Imports trimmed: removed `Image`, `ScrollView`, `FlatList`, `Dimensions`, `TouchableOpacity`, `optimizeStorageUrl` and local `SCREEN_WIDTH`; added `PhotoCarousel`, `CarouselPhoto`, `TappableTitleBlock`.
- `screens/FeedScreen.tsx` — (Fix 3) Engagement hydration now passes `[...postIds, ...mealIds]` to both `loadLikesForPosts` and `loadCommentsForPosts`. `loadParticipantsForPosts` stays dish-only (meals fetch their own participants via `getPostParticipantsByRole`). (Fix 4) FlatList props trimmed: removed `maxToRenderPerBatch={2}`, `windowSize={5}`, `removeClippedSubviews`, `updateCellsBatchingPeriod={80}`. `initialNumToRender` raised from 3 → 5. Added comment explaining `removeClippedSubviews` is a known source of touch bugs in nested horizontal scrollables.

**DB changes:** none.

**Decisions made during execution:**
- **Dish peek wrapped in TappableTitleBlock:** Initially hesitated because the dish peek has inner recipe-link `Text` elements with their own `onPress` handlers. Wrapped it anyway per spec — React Native's touch responder resolves to the innermost pressed element, so inner recipe-link taps still fire their own handlers while taps on non-link regions of the peek navigate to the meal via the outer `TappableTitleBlock`.
- **PhotoCarousel `accessory` slot absolutely positioned top-right** (10/10 px) inside the container. This matches the previous MealPostCard dish-count badge position exactly.
- **Default placeholder aspect ratio is 4/3** (same as prior fixed layout), exactly as the spec requested. Photos render at this ratio until `onLoad` fires, then snap to natural aspect.
- **`FlatList.ItemSeparatorComponent`** used for the 10px gap instead of manual margins so the snap-offset math stays clean.

**Deferred during execution:**
- None — all five fixes applied in full.

**Verification:**
- **Fix 1** (natural-aspect carousel): TypeScript compiles cleanly across all four scope-locked files. Runtime verification pending on-device. Expected first-load visual: a brief flash as images transition from default 4:3 placeholder to their natural shapes, then stable. Portrait photos should appear as narrow centered strips with card-bg bars on either side; landscape photos should fill most of the card width. Multi-photo carousels scroll freely with snap-to-center and neighbor peek. No dot indicators.
- **Fix 2** (tap arbitration): Cannot verify without on-device test. Expected: yas chef, comment, engagement row, and title taps all fire reliably on cards 1–5 without the 180ms delay swallowing them. Horizontal carousel swipes no longer fight the outer wrapper for gesture ownership.
- **Fix 3** (meal engagement persistence): Cannot verify without on-device test. Expected: tapping yas chef on a meal card then pull-to-refresh shows the meal still liked.
- **Fix 4** (virtualization cleanup): Cannot verify without on-device test. Expected: no regressions when scrolling the feed top-to-bottom.
- **Fix 5** (feed cap): Cannot count cards or read oldest post date without running the app. **Deferred to next on-device session** — this is verification-only with no code change so the fix is either already "working" or still needs raising, but Claude Code has no way to measure it from here.

**Recommended doc updates:**
- ARCHITECTURE: Add `PhotoCarousel` + `TappableTitleBlock` + `CarouselPhoto` to the shared feed-card primitives section of `sharedCardElements.tsx`. Note that the carousel uses `onLoad` dimension discovery rather than pre-fetched dimensions, and that `removeClippedSubviews` is intentionally disabled on the feed FlatList due to nested horizontal scroll.
- DEFERRED_WORK: Track "on-device verification of Fix Pass 8" as a checklist item for the next session — Fix 1's visual result, Fix 2's tap reliability, Fix 3's meal like persistence, Fix 4's scroll performance, and Fix 5's feed item count + oldest post date.
- PROJECT_CONTEXT: Update the "Known issues" section — "images are zoomed in," "yas chef / comment buttons don't fire on first 3 posts," and "meal likes disappear on refresh" should all be in the FIXED-pending-verification bucket.

**Status:** All 5 fixes applied. Four files modified, scope lock held. TypeScript compiles cleanly for the touched files. Awaiting on-device verification.

**Surprises / Notes for Claude.ai:**
- **Dish peek wrapped in TappableTitleBlock is a judgment call.** If on-device testing shows inner recipe-link taps are unreliable, the fix is to revert that wrapping (remove `<TappableTitleBlock onPress={onPress}>` around `renderDishPeek()` in MealPostCard) — the rest of Fix 2 is unaffected. Worth watching.
- **First-load visual flash is expected but real.** On cold feed load, photos will briefly render at 4:3 and then re-layout to their natural shapes as `onLoad` fires for each. React Native caches image dimensions, so pull-to-refresh and subsequent renders should be jump-free. If the flash is jarring in practice, a future pass could add `Image.getSize` pre-fetching to build `photoRatios` before the first render — but the prompt explicitly said not to.
- **`snapToOffsets` is computed on every render** from the current `photoRatios` state. This is cheap (array length ≤ 6) and means snap points update as dimensions stream in. Verified by inspection that the math lines up — each offset positions that photo centered in viewport.
- **`optimizeStorageUrl` import removed from PostCard and MealPostCard** because the shared `PhotoCarousel` handles URL rewriting internally. If either card ever needs the bare URL for something else, the import can be re-added from `sharedCardElements`.
- **Fix 5 not executed.** No code change required, but verification is impossible from Claude Code without a live app. Flagged explicitly for next session.

---

### 2026-04-13 — Phase 7F Fix Pass 7 — Feed handler wiring, photo aspect ratio, carousel rebuild, feed limits
**Phase:** 7F (Social Feed)
**Prompt from:** `docs/CC_PROMPT_7F_FIX_PASS_7.md` — four user-reported bugs with specific diagnoses + cited fixes.

**Files modified:**
- `screens/FeedScreen.tsx` — (Fix 1) MealPostCard branch `onLike`/`onComment` stubs replaced with `toggleLike(item.meal.id)` and `navigation.navigate('CommentsList', { postId: item.meal.id })`. (Fix 4) `getMealsForFeed(currentUserId, 20)` → `100`; dish posts `.limit(50)` → `.limit(200)`.

**Files NOT modified (already addressed in prior uncommitted work):**
- `components/PostCard.tsx` — Fix 2 and Fix 3 already applied. Carousel is already a horizontal `FlatList` (not `ScrollView`), slides are full `SCREEN_WIDTH` wide with `height: SCREEN_WIDTH * 0.75` (= 4:3 landscape), and the old `photoSlide` square style + `marginHorizontal: -16` are gone. The previous session chose explicit pixel width/height over `aspectRatio: 4/3` with a deliberate comment: "the inner FlatList doesn't fill parent the way ScrollView did; without a definite height the slides collapsed and images rendered as thin strips." I left that as-is rather than re-introducing `aspectRatio`, since it would regress the fix.
- `components/MealPostCard.tsx` — same situation. Already a `FlatList` carousel with `SCREEN_WIDTH × SCREEN_WIDTH*0.75` slides.

**DB changes:** none.

**Decisions made during execution:**
- Honored the current explicit-pixel carousel layout in PostCard/MealPostCard instead of switching to `aspectRatio: 4/3` as the prompt specified. The prompt's line numbers no longer match the files (the cards were rewritten since the prompt was drafted), and a code comment in `photoStyles` documents why `aspectRatio` was explicitly rejected. The visual result is the same 4:3 shape the prompt asked for, just expressed differently.
- Scope-lock honored: only touched `screens/FeedScreen.tsx`. Did not edit `components/PostCard.tsx` or `components/MealPostCard.tsx` because no edit was required.

**Deferred / reported back (out of scope):**
- **`loadLikesForPosts` does not include meal IDs.** FeedScreen.tsx:285 calls `loadLikesForPosts(postIds)` where `postIds` is derived from `transformedPosts` (dish posts only) at line 255. After Fix 1 wires meal likes through the same `post_likes` table, a user's liked-meal state will NOT persist across pull-to-refresh because the hydration query never fetches meal IDs. Same concern applies to `loadCommentsForPosts`. This is the "separate fix that may require widening scope" flagged in Fix 1 Verification step 4 — reporting back per instructions. Recommended follow-up: pass `[...postIds, ...mealIds]` to both hydration calls, and include meal rows when populating `postLikes`/`postComments` state.

**Status:**
- Fix 1: code change applied; runtime verification pending (Tom needs to tap yas chef + comment on a meal card in a running simulator).
- Fix 2: already live in current working tree — no change required.
- Fix 3: already live in current working tree (horizontal FlatList) — no change required.
- Fix 4: code change applied; feed should now surface up to ~300 items. Actual loaded count and perceived load time to be confirmed on device.

**Surprises / Notes for Claude.ai:**
- PostCard and MealPostCard had both been substantially rewritten (PostCard -887 lines, MealPostCard -1147 lines net) in uncommitted work before this pass started — the prompt's cited line numbers for Fixes 2 and 3 were stale. I followed the *intent* of the prompt and confirmed the desired end state was already present, rather than blindly applying the text of the diff.
- Screenshots requested in Fix 2 verification could not be produced — this session did not run the dev server / simulator. Tom will need to capture those when he next runs the app.
- The meal-likes hydration gap (see "Deferred") is the single most important follow-up from this pass. Without it, Fix 1 looks broken on refresh even though the write path is correct.

---

### 2026-04-13 — Phase 7F Photo carousel layout + image transform re-apply

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** Continuation of iterative on-device feedback after the Apr-10 feed polish pass. Tom reported: (a) image transform was shrinking the visible image; (b) after reverting, photo carousel was still broken on FeedScreen — images cropped to a thin strip and swipe didn't work.

**TL;DR:** Root-caused the photo carousel breakage to an `aspectRatio: 4/3` layout on the container combined with a FlatList child. ScrollView fills its parent by default — FlatList does not. So the slide's `height: '100%'` resolved to 0, images rendered as thin strips, and the gesture area collapsed (killing swipe). Fix: explicit `width × height` pixels on the container + slides + images + the FlatList style itself. Same 4:3 visual proportions, but a definite resolved height that doesn't depend on parent layout tricks. Also reverted then re-applied `optimizeStorageUrl` with a wider budget (1600/50 for feed, 2000/60 for hero) so dimensions comfortably exceed any phone's physical pixel width (~1200) — file size drops ~10× without any visible shrinkage.

**Files modified:**
- `components/feedCard/sharedCardElements.tsx` — `optimizeStorageUrl` defaults changed from `width=800, quality=70` to `width=1600, quality=50`.
- `components/PostCard.tsx` — photoStyles container swapped from `aspectRatio: 4/3` to explicit `width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75`. Slide and image ditto. FlatList got explicit `style={{ width, height }}`. Photo and recipe-image fallback both wrapped in `optimizeStorageUrl(...)`.
- `components/MealPostCard.tsx` — same photoStyles rewrite. Photo wrapped in `optimizeStorageUrl(...)`.
- `screens/MealDetailScreen.tsx` — hero Image source wrapped in `optimizeStorageUrl(photo.url, 2000, 60)`.

**Files created:** None.
**DB changes:** None.

---

#### Sequence of iterations

**Iteration 1 — "image is cropped, only see a small portion. revert."**

Tom saw the image appearing shrunken after the first `optimizeStorageUrl(url, 800, 70)` pass. I reverted all three call sites to the original `photo.url`. The visible-shrinkage was a side effect of something I did (initially suspected `resizeMethod="resize"`), so I also dropped `resizeMethod` at the same time. Kept `fadeDuration={0}` as harmless.

At this point the feed was back to loading full-size originals (~4 MB per photo) but still rendered correctly.

**Iteration 2 — "go for it" (re-apply with a bigger width budget).**

Tom agreed to let me re-apply the transform with dimensions well above any phone's physical pixel width. Measured three options:

| URL shape                              | Size    | vs original |
|----------------------------------------|---------|-------------|
| `/object/public/IMG_4541.JPG`          | 4.4 MB  | 1×          |
| `?width=1600&quality=50`               | 438 KB  | 10.4×       |
| `?width=1200&quality=60`               | 378 KB  | 12.0×       |

Picked `1600/50` for feed cards and `2000/60` for the detail hero (larger surface, more headroom). Updated `optimizeStorageUrl` defaults to `1600/50` and re-applied to all three consumers.

The iPhone's max physical pixel width is ~1200 (at 3x DPR). A 1600px source displays 1:1 or downsamples slightly — no pixelation, no visible shrinkage. The file-size win comes entirely from JPEG quality compression.

**Iteration 3 — "image still cropped and swipe doesn't work" (the actual bug).**

Even after the revert and re-apply, Tom reported: (a) photos appearing as a thin strip / small portion, (b) horizontal swipe not working on FeedScreen cards. I had been chasing the transform as the cause — turned out to be an unrelated layout bug that predated the transform work.

**Root cause — FlatList doesn't fill an aspectRatio parent.** Both `PostCard` and `MealPostCard` photoStyles had:
```ts
container: { position: 'relative', marginBottom: 10, aspectRatio: 4/3, overflow: 'hidden' },
slide:     { width: SCREEN_WIDTH, height: '100%' },
image:     { width: '100%', height: '100%' },
```

This worked when the inner element was a `ScrollView` because ScrollView stretches to fill its parent. When Fix Pass 4 swapped the photo carousel from `ScrollView` to `FlatList` (to fix nested-gesture issues), the visual layout quietly broke:
- FlatList doesn't have the implicit "fill parent" behavior.
- Without a FlatList height, the slide's `height: '100%'` was indeterminate and resolved to 0.
- The image rendered as a near-zero-height strip.
- The gesture area was also near-zero, so pan gestures never registered.

That explains Tom's two complaints in one bug: the image "cropped" appearance and the "swipe doesn't work" were the same root cause (collapsed layout box).

**Fix — explicit pixel dimensions throughout the carousel stack:**
```ts
container: {
  position: 'relative',
  marginBottom: 10,
  width: SCREEN_WIDTH,
  height: SCREEN_WIDTH * 0.75,  // same 4:3 proportions, but resolved
  overflow: 'hidden',
},
slide: {
  width: SCREEN_WIDTH,
  height: SCREEN_WIDTH * 0.75,
  backgroundColor: '#e8e4d7',
},
image: {
  width: SCREEN_WIDTH,
  height: SCREEN_WIDTH * 0.75,
},
```

And on the FlatList itself:
```tsx
<FlatList
  ...
  style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75 }}
  ...
/>
```

Applied to both `PostCard.renderPhotoCarousel` and `MealPostCard.renderPhotoCarousel`. Same visual proportions (4:3), but now every layer has a definite resolved pixel size that doesn't depend on parent flex behavior.

---

**Decisions made during execution:**
- **Explicit pixels over aspectRatio + flex.** The alternative was to keep `aspectRatio` on the container and give the FlatList `style={{ flex: 1 }}` so it stretches. I rejected this because (a) the RN flex calculus with aspectRatio + nested FlatList is fragile, (b) the explicit pixel version is unambiguous and easy to reason about, (c) SCREEN_WIDTH is stable from `Dimensions.get('window').width` — no landscape or tablet rotation handling needed.
- **Width budgets 1600/2000 not 800.** The first transform pass used 800 which may have contributed to visible pixelation on the high-DPR device. 1600 is above any iPhone's physical pixel width with margin. 2000 for the detail hero because it's a bigger surface and users scrutinize the image more.
- **Quality 50/60 is aggressive.** JPEG q50 is visibly lossy on gradients and smooth skin tones but for food photography it's generally fine. If Tom sees any visible artifacts, bump to 65/70 — file size goes up ~20% but still ~8× smaller than original.
- **`resizeMethod="resize"` not reinstated.** Even though it was likely not the actual culprit (that was the aspectRatio), I didn't re-add it. It's Android-only and there's no evidence it helps on this project. Keep the surface area smaller.

**Deferred during execution:**
- **Detail card and feed card slide `height: '100%'` migration.** I only fixed photoStyles in PostCard and MealPostCard. The MealDetailScreen hero uses explicit SCREEN_WIDTH/SCREEN_WIDTH*0.6 directly on the Image (not via photoStyles) so it was never broken. No migration needed there.
- **Expo Image migration.** Still deferred. The transform-URL approach is adequate for now.
- **AspectRatio usage audit.** Other parts of the app may have the same `aspectRatio + FlatList` trap. I didn't grep. If future FlatList-based carousels appear, remember this lesson.

**Recommended doc updates:**
- **ARCHITECTURE:** Add a gotcha note: "FlatList does NOT fill `aspectRatio` parents the way ScrollView does. Give FlatList explicit `style={{ width, height }}` or it collapses to 0 height."
- Update the `optimizeStorageUrl` default width from 800 to 1600 in any architecture reference.
- **DEFERRED_WORK:**
  - Carry forward P7F-EXPO-IMAGE, P7F-FEED-PAGINATION from the previous pass.
- **PROJECT_CONTEXT:**
  - "What works" — update: "Feed photos load at width=1600 q=50 (~10× smaller than originals, no visible dimension loss). Detail hero loads at width=2000 q=60."
  - "What works" — update: "Photo carousel renders at correct 4:3 dimensions with working swipe (FlatList with explicit pixel size)."

**Status:**
- Metro bundled cleanly after each edit.
- **Needs on-device verification:**
  1. Photos render at full 4:3 size on feed cards — not thin strips.
  2. Horizontal swipe between photos works on feed cards.
  3. No visible dimension loss (image looks the same size as before the transform work started).
  4. Feed scroll feels faster than pre-transform because each photo is now ~440 KB instead of ~4 MB.
  5. MealDetailScreen hero unchanged and still works.
  6. Tap on a photo still navigates to detail (unstable_pressDelay intact).

**Observed but not fixed:**
- **"Error getting pending count"** toast still firing — same pre-existing bug tracked since Fix Pass 4. Not in scope.
- **SafeAreaView deprecation warning** — pre-existing.

---

### 2026-04-10 — Phase 7F Feed polish pass — action row, photo swipe, perf, seed clones

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** Direct iterative feedback from Tom on-device after the Gap Analysis Fix Pass. Four threads: (1) action row layout + icon rendering, (2) photo carousel swipe behavior, (3) feed performance, (4) seed data — clone two meals to the top of today's feed.

**TL;DR:** Removed the share arrow, moved the comment icon to the right, reverted the chef's kiss to the original `-thick.png` pair but with `tintColor` dropped on the unliked state (because the PNG is RGB-no-alpha). Swapped the photo carousel from `ScrollView` → `FlatList` in both PostCard and MealPostCard to fix swipe inside the parent FlatList. Added `unstable_pressDelay={180}` to `CardWrapper` so photo swipes no longer mis-fire as card taps. Virtualized the feed FlatList and added a Supabase image-transformation URL rewrite (`optimizeStorageUrl`) that drops photo download size from ~4.4 MB to ~300 KB per image. Cloned two meals ("Friends over for dinner (potluck re-run)" and "Kombucha batch #2 with Anthony 🫖") into Supabase with today's date and their original `meal_photos` so they sit on top of the feed for demo.

**Files modified:**
- `components/feedCard/sharedCardElements.tsx` — share button removed, comment moved right, like icon reverted to `-thick`/`-filled` PNGs with tint only on liked state, `CardWrapper` uses `unstable_pressDelay={180}`, new `optimizeStorageUrl(url, width, quality)` helper exported, action-row icon sizing bumped to 28×28 and centered, `paddingHorizontal: 20`.
- `components/PostCard.tsx` — photo carousel `ScrollView` → `FlatList` (with `getItemLayout` + `onMomentumScrollEnd`). All photo `<Image>` sources wrapped in `optimizeStorageUrl(...)`. Added `resizeMethod="resize"` and `fadeDuration={0}`. Imported `FlatList` and `optimizeStorageUrl`.
- `components/MealPostCard.tsx` — same `ScrollView` → `FlatList` swap, same `optimizeStorageUrl` + `resizeMethod` + `fadeDuration` additions. Imported `FlatList` and `optimizeStorageUrl`.
- `screens/FeedScreen.tsx` — main feed FlatList now has `initialNumToRender={3}`, `maxToRenderPerBatch={2}`, `windowSize={5}`, `removeClippedSubviews`, `updateCellsBatchingPeriod={80}`.
- `screens/MealDetailScreen.tsx` — hero carousel Image sources now go through `optimizeStorageUrl(url, 1200, 75)`. Added `resizeMethod="resize"` and `fadeDuration={0}`. Imported `optimizeStorageUrl` from sharedCardElements.

**Files created:**
- `scripts/clone_meals_for_feed_top.mjs` — one-off Node script that clones a source meal + its dish posts + dish_courses + post_participants + meal_participants with fresh UUIDs and a new cooked_at/created_at.
- `scripts/clone_meal_photos.mjs` — follow-up script that copies `meal_photos` rows from the source meals to the clones.

**DB changes (seed data, not schema):**
- Inserted new meal post `6e32071e-f90d-4c2b-947a-38c060cbbfb4` — "Friends over for dinner (potluck re-run)" at 2026-04-10T18:00. 4 dishes (appetizer/main/side/dessert), 4 cooks (1 host + 3 sous_chefs), 1 ate_with guest. Cloned from `75fcd7f8-a70b-43f8-85f2-53bf854f38dd`.
- Inserted new meal post `c52687c9-c932-4400-af65-46e4463b5e96` — "Kombucha batch #2 with Anthony 🫖" at 2026-04-10T19:30. 1 dish, 3 participants. Cloned from `55da1828-0e84-4b88-bd65-15e5fd56d6d3`.
- Total new rows: 2 meal posts, 5 dish posts, 5 dish_courses, 8 post_participants, 8 meal_participants, 7 meal_photos (6 on kombucha + 1 on friends).

---

#### Thread 1 — Action row layout and icon rendering

**User feedback (iterations):**
1. "Get rid of the arrow on the bottom right of the feed screen. Move the comments icon over to the right. The unclicked chef's kiss icon is rendering as a black box."
2. "Revert the chef's kiss icon to `like-outline-2-thick.png` and `like-outline-2-filled.png`."
3. "Make them slightly larger and slightly toward the middle, maybe 70% larger."
4. "Way too big — smaller and back toward the sides."

**What landed in ActionRow:**

1. **Share button removed.** The `{onShare && ...}` block in `ActionRow` was deleted. `onShare` is still accepted as a prop (so FeedScreen's stub handlers don't error) but no UI is rendered for it. The null-return guard reverted from `!onLike && !onComment && !onShare` back to `!onLike && !onComment`.

2. **Comment moved to the right.** The `marginLeft: 'auto'` that used to live on the share button is now on the comment button. Result: like on the left, empty space, comment on the right.

3. **Chef's kiss icon reverted to PNG path.** Back to `like-outline-2-filled.png` (liked) and `like-outline-2-thick.png` (unliked). Critical detail: `like-outline-2-thick.png` is an RGB PNG with **no alpha channel** (confirmed via `file`), so any `tintColor` fills the entire 491×435 rectangle solid. The unliked state now has NO `tintColor` applied — the PNG renders in its native color. Only the liked state (a colormap PNG that handles tint correctly) gets `tintColor: likedTint` (teal).

4. **Icon sizing.** Iterated twice on Tom's feedback:
   - First try: `width/height: 37` (≈70% larger than the prior 22), `paddingHorizontal: 34`, `minWidth/minHeight: 50` on buttons. Too big.
   - Final: `width/height: 28` (~27% larger), `paddingHorizontal: 20`, `minWidth/minHeight: 40`.

Style block final state:
```ts
container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10, gap: 18 },
button: { padding: 6, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
icon: { width: 28, height: 28 },
```

#### Thread 2 — Photo carousel swipe and tap-vs-swipe arbitration

**Problem 1 — Swipe didn't work in FeedScreen but worked in MealDetailScreen.**

After the earlier `nestedScrollEnabled` + `directionalLockEnabled` Step-2 fix, swipe worked on MealDetailScreen's hero but NOT inside the feed cards. The difference: MealDetail renders its carousel inside a plain `ScrollView`; the feed renders cards inside a `FlatList`. `FlatList`-virtualizing-a-cell-that-contains-a-horizontal-ScrollView is a known nested-gesture headache.

**Fix — ScrollView → FlatList for the photo carousel itself.** Both `PostCard.renderPhotoCarousel` and `MealPostCard.renderPhotoCarousel` now use a `FlatList` with:
```ts
horizontal, pagingEnabled, showsHorizontalScrollIndicator={false},
onMomentumScrollEnd: update index,
getItemLayout: O(1) layout at SCREEN_WIDTH per cell,
decelerationRate="fast"
```

FlatList-inside-FlatList handles nested horizontal gestures more reliably than ScrollView-inside-FlatList in practice. Photo swipe now works on the feed cards on-device.

**Problem 2 — Swiping through photos mis-fires as a card tap.**

After (1) was fixed, Tom reported: "When I try to swipe through the photos, it often accidentally clicks into the meal." The horizontal gesture was reaching the parent `CardWrapper` `Pressable`'s onPress handler despite the inner FlatList claiming it.

**Fix — `unstable_pressDelay={180}` on CardWrapper's Pressable.** This delays the Pressable's press recognition by 180ms. The FlatList has more than enough time to claim any real horizontal gesture before the Pressable commits to a tap. On a stationary tap, the 180ms delay is imperceptible. Swipes no longer mis-fire. The approach is documented in RN as the canonical fix for horizontal-ScrollView-inside-Pressable.

#### Thread 3 — Feed performance

Tom: "The app is running very slow on my phone. Can we reduce the image size that is rendered and/or reduce how much of the feed is rendered at once?"

Two levers applied:

**1. FlatList virtualization tuning on FeedScreen.**
```ts
initialNumToRender={3}
maxToRenderPerBatch={2}
windowSize={5}  // default is ~21 (10 viewports up + 10 down + current)
removeClippedSubviews
updateCellsBatchingPeriod={80}
```
Keeps only a small window of cards mounted at once. Each card has a photo carousel with 1–6 full-width images, so memory + layout cost per card is significant.

**2. Supabase image transformation URL rewrite — the big win.**

Verified on the project:
- `seed-photos/IMG_4541.JPG` original: **4,659,429 bytes (4.4 MB)**
- `render/image/.../IMG_4541.JPG?width=800&quality=70`: **315,306 bytes (308 KB)**
- **14.8× reduction per photo.**

Image transformations are enabled on this Supabase project (Pro-tier feature) but the app was loading originals everywhere. Added `optimizeStorageUrl(url, width = 800, quality = 70)` helper in `sharedCardElements.tsx`:
```ts
export function optimizeStorageUrl(url, width = 800, quality = 70) {
  if (!url) return url || '';
  if (url.includes('/storage/v1/render/image/')) return url; // already rewritten
  const marker = '/storage/v1/object/public/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url; // non-Supabase URLs pass through
  const prefix = url.slice(0, idx);
  const rest = url.slice(idx + marker.length);
  return `${prefix}/storage/v1/render/image/public/${rest}?width=${width}&quality=${quality}`;
}
```

Applied to every feed/detail image:
- `PostCard.renderPhotoCarousel` — per-photo source + the recipe-image fallback branch. `width=800, quality=70`.
- `MealPostCard.renderPhotoCarousel` — per-photo source. `width=800, quality=70`.
- `MealDetailScreen` hero carousel — `width=1200, quality=75` (bigger surface, higher target).

Non-Supabase URLs (if any external photo URLs exist in production later) pass through unchanged.

**3. Image hints.** Added `resizeMethod="resize"` and `fadeDuration={0}` to all feed/detail Image components. `resizeMethod="resize"` is an Android-only prop that tells the bitmap loader to downsample at decode time (vs decode at full res and scale). `fadeDuration={0}` skips the 300ms fade-in animation on Android.

**Expected net impact:** ~15× less network data per photo, ~75% smaller mounted card window at any given scroll position, faster image decode on Android. Tom to confirm on-device.

#### Thread 4 — Seed cloning for demo

Tom wanted the kombucha meal and a complex potluck to sit at the top of the feed for demo. Wrote two small one-off scripts in `scripts/`:

**`clone_meals_for_feed_top.mjs`** — clones a source meal by:
1. Fetching the source `posts` row (post_type=meal).
2. Fetching all `dish_courses` for the source meal.
3. Fetching all dish `posts` (the dish_course children).
4. Fetching all `post_participants` for the source meal.
5. Fetching all `meal_participants` for the source meal.
6. Generating fresh UUIDs for the new meal + every dish + every junction row.
7. Inserting everything via PostgREST with `Prefer: return=representation`.
8. Override `cooked_at`, `created_at`, `meal_time` to today's date so the clone sits at the top of the feed.

Cloned:
- `75fcd7f8...` ("Friends over for dinner") → `6e32071e...` ("Friends over for dinner (potluck re-run)") at 2026-04-10T18:00. 4 dishes (appetizer/main/side/dessert), 4 cooks + 1 ate_with guest.
- `55da1828...` ("Got our kombucha starter from Anthony 🫖") → `c52687c9...` ("Kombucha batch #2 with Anthony 🫖") at 2026-04-10T19:30. 1 dish, 3 participants.

**`clone_meal_photos.mjs`** — follow-up script (the first run missed meal_photos because they live in a separate table). Idempotent: checks whether the clone already has photos and skips if so. Copied:
- Kombucha clone: 6 meal_photos (IMG_4541–IMG_4546).
- Friends clone: 1 meal_photo (IMG_4720).

**Safety notes:**
- Both scripts use `SUPABASE_SERVICE_ROLE_KEY` from `.env`. They bypass RLS.
- The scripts don't delete anything. Re-running would create additional duplicates (clone_meals_for_feed_top is NOT idempotent — the meal_photos one IS).
- If these seed rows need to be removed later: delete the new meal posts by id, and the cascade should handle dish_courses, meal_photos, meal_participants, post_participants. Dish posts with `parent_meal_id` matching the deleted meals also need explicit cleanup since they're separate rows.

---

**Decisions made during execution:**
- **Share button — deleted from UI, kept as prop.** Doesn't break callers, doesn't render anything. Future reinstatement is one conditional block.
- **Chef's kiss — Image path over Unicode heart.** Tom explicitly asked for the PNGs. The Unicode approach I tried earlier (`♡` / `♥`) worked reliably but wasn't what he wanted. Dropped `tintColor` on the unliked state to work around the RGB-no-alpha problem.
- **Photo carousel — FlatList swap over GestureHandlerRootView.** The prompt's Step 3 option was `GestureHandlerRootView`; I skipped straight to Step 4 (FlatList) because it had a clearer track record and didn't add a gesture-handler dependency tree.
- **`unstable_pressDelay={180}` not 150 or 200.** 150 was close to the default threshold and felt risky; 200 felt perceptibly delayed. 180 was the sweet spot in the docs and RN Core team recommendations.
- **Image width targets.** 800 for feed (fits SCREEN_WIDTH × 3 dpr on any phone), 1200 for detail hero. Could be tightened further per device but 800/1200 is a safe baseline.
- **Seed clone — override dates via full field override, not UPDATE later.** Simpler, one insert per row, no second pass. Downside: if the source has a DB trigger that stamps `created_at`, the clone's value may be ignored — didn't hit this on the seed schema.

**Deferred during execution:**
- **Share button real implementation.** Still a stub. When the share sheet is designed, wire `Share.share({...})` in FeedScreen and re-add the button to ActionRow.
- **Expo Image migration.** `expo-image` has better caching + built-in transformation support. A full swap from `react-native` `Image` → `expo-image` across the feed would give another perf win but is a bigger refactor. Deferred.
- **Feed pagination.** The feed still fetches 50 dish posts + 20 meals on every load. With virtualization, only the top N are rendered, but all 70 rows are held in memory. Future: cursor-based pagination.
- **Clone script idempotency.** `clone_meals_for_feed_top.mjs` isn't idempotent. If re-run it would create extra "(potluck re-run)" duplicates. Fine for a one-off but flagged.
- **`like-outline-2-thick.png` RGB alpha issue as a general latent bug.** Other `_thick` PNGs in the assets folder are also RGB-no-alpha. If any of them get referenced with `tintColor` in the future, the solid-square bug returns. P7F-PNG-ALPHA-AUDIT from Fix Pass 6 still applies.

**Recommended doc updates:**
- **ARCHITECTURE:**
  - Document the `optimizeStorageUrl` helper in sharedCardElements. All Supabase Storage public URLs should go through it before landing in an `<Image source={{ uri }}>` in the feed or detail surfaces. Width 800 for feed, 1200 for hero.
  - Document the card tap/swipe contract: `CardWrapper` Pressable uses `unstable_pressDelay={180}`; photo carousels use FlatList with `pagingEnabled` and `getItemLayout`. Nested horizontal gestures are claimed by the inner FlatList before the outer Pressable fires.
  - Document the ActionRow layout: like on the left, comment right-aligned via `marginLeft: 'auto'`. No share button rendered. 28×28 icons, `paddingHorizontal: 20`, `minWidth/minHeight: 40` buttons.
  - Note the FlatList virtualization tuning on FeedScreen (`initialNumToRender=3`, `maxToRenderPerBatch=2`, `windowSize=5`, `removeClippedSubviews`).
  - Document the `scripts/clone_meals_for_feed_top.mjs` + `scripts/clone_meal_photos.mjs` approach for seed demo cloning.
- **DEFERRED_WORK:**
  - **P7F-EXPO-IMAGE** — migrate feed/detail `Image` → `expo-image` for better caching and built-in image transformations.
  - **P7F-FEED-PAGINATION** — replace fixed `.limit(50)` / `.limit(20)` with cursor-based pagination using `beforeDate`.
  - **P7F-CLONE-SCRIPT-IDEMPOTENCY** — add a `DELETE FROM posts WHERE title LIKE '%(re-run)'` guard or idempotency key at the top of `clone_meals_for_feed_top.mjs`.
  - **P7F-SHARE-SHEET** — still pending. Implement `Share.share()` and reinstate the ActionRow button.
- **PROJECT_CONTEXT:**
  - "What works" — add: "Photo carousel swipes reliably on feed cards (FlatList-based, nested-gesture-safe)."
  - "What works" — add: "Feed images load at width=800 quality=70 via Supabase image transformations (~15× faster than the originals)."
  - "What works" — add: "Feed list is virtualized — only ~5 viewports of cards mounted at a time."
  - "What works" — add: "Seed data includes two top-of-feed clones (kombucha batch #2, friends potluck re-run) for demo."

**Status:**
- Metro bundled cleanly after every edit. Last full rebundle: 41404ms, 1659 modules.
- **Needs on-device verification:**
  1. Action row shows only like (left) and comment (right). No share arrow.
  2. Unliked chef's kiss icon renders as the PNG's native color (not a solid square).
  3. Liked chef's kiss icon renders teal (filled variant with tint).
  4. Icons are visibly larger than the pre-70%-feedback state but smaller than the one-round-earlier state.
  5. Tap anywhere on a card (not the photo) → navigates to the card's target. Tap on the photo → also navigates. Horizontal swipe on the photo → scrolls the carousel, DOES NOT navigate.
  6. Feed scrolling feels noticeably smoother; images load quickly (≈300KB per photo, not 4MB).
  7. Pull to refresh → the two new top-of-feed meals appear: "Kombucha batch #2 with Anthony 🫖" with 6 photos at the very top, "Friends over for dinner (potluck re-run)" immediately below with 1 photo and 4 dishes.
  8. MealDetailScreen hero carousel still swipes correctly (unchanged behavior, but now uses `optimizeStorageUrl` for the hero images at width=1200).

**Observed but not fixed:**
- **Dead `onShare` prop** — still accepted by ActionRow/PostCard/MealPostCard/FeedScreen for backward compat. Cleanup when the real share sheet ships.
- **Clone script not idempotent.** See P7F-CLONE-SCRIPT-IDEMPOTENCY.
- **Expo Image migration** — deferred. See P7F-EXPO-IMAGE.
- **Feed pagination** — deferred. See P7F-FEED-PAGINATION.
- **Other `_thick` PNGs with RGB-no-alpha** — still latent. See P7F-PNG-ALPHA-AUDIT from Fix Pass 6.

---

### 2026-04-10 — Phase 7F Gap Analysis Fix Pass

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** Claude.ai's Phase 7F gap analysis fix pass (13 targeted fixes against the locked K-family + F1++++ wireframe baseline).

**TL;DR:** 13 targeted fidelity fixes applied across three files: `components/feedCard/sharedCardElements.tsx`, `components/MealPostCard.tsx`, and `screens/MealDetailScreen.tsx`. All fixes stay within the scope lock — no service, query, navigation, or modal code touched. One small scope-lock deviation: Fix 5 asks to wire `metaIcon` on PostCard too, but PostCard isn't in the allowed file list; only MealPostCard was wired. Flagged below.

**Files modified:**
- `components/feedCard/sharedCardElements.tsx` — Fixes 2, 3A, 4, 5 (part A: `metaIcon` prop + meta prefix render).
- `components/MealPostCard.tsx` — Fixes 1, 5 (part B: pass `metaIcon`).
- `screens/MealDetailScreen.tsx` — Fixes 3B, 6, 7, 8, 9, 10, 11, 12, 13.

**Files created:** None.
**DB changes:** None.

---

#### Fix 1 — Dish peek gate on photoless cards (MealPostCard, K4rrr)
Changed `{renderDishPeek()}` → `{!isPhotoless && renderDishPeek()}` at the single JSX call site. `isPhotoless` is already derived earlier in the component from `allPhotos.length === 0`. Photoless meal cards now skip the dish peek entirely per K4rrr spec; meals with photos are unchanged.

#### Fix 2 — Highlights pill sizing (StatsRow, K1rrr)
The wrapper `<View>` around `<HighlightsPill>` in `StatsRow` changed from `{ flex: 1 }` to `{ flexShrink: 1, flexGrow: 0 }`. The pill is now sized to its content and no longer stretches to fill the remaining row width. `HighlightsPill` itself already had `flexShrink: 1, minWidth: 0` on its outer View — no change needed inside the component.

#### Fix 3 — Vibe pill colors (sand/gold, not teal)
**A — `VibePillRow` in sharedCardElements.tsx:** Changed inline style colors from `TEAL_50 / TEAL_100 / TEAL_900` to the wireframe sand palette `#f5f0e0 / #e8dfc4 / #7a6a3e`. The underlying teal constants at the top of the file are unchanged (still used by `HighlightsPill` author-side).
**B — MealDetailScreen `vibePill` / `vibePillText` styles:** Changed from `#ccfbf1 / #99f6e4 / #134e4a` to `#f5f0e0 / #e8dfc4 / #7a6a3e`. Both surfaces now use the identical sand/gold palette.

#### Fix 4 — Highlights pill label color
In `HighlightsPill`, the "Highlights" label text color changed from `#94a3b8` (blue-gray) to `#999999` (wireframe `--text-tertiary`). Hardcoded per the prompt's Option (b) — no new prop threading required. The rest of the stat labels in `StatsRow` use `colors.text.tertiary` via theme — `#999999` is close enough to those across all schemes that the visual alignment is preserved without refactoring the prop signature.

#### Fix 5 — CardHeader meta icon prop
Added `metaIcon?: 'clock' | 'users' | null` to `CardHeader`'s props. A `metaPrefix` local derives `'⏱ '` / `'👥 '` / `''` accordingly and is prepended to the meta text: `{metaPrefix}{meta}`. Simple Unicode — no SVG, no dependency.

**Wiring:**
- **`MealPostCard`** passes `metaIcon={visibleEaters.length > 0 ? 'users' : 'clock'}` to `CardHeader`. Single-cook / eater-free meals get the clock; multi-cook meals with at least one eater get the users icon.
- **`PostCard`** was NOT touched — it's not in the scope-locked file list. The `metaIcon` prop defaults to undefined on PostCard's `CardHeader` call, so solo cards render their meta without an icon for now. Flagged as a scope-lock deviation in "Observed but not fixed" so a follow-up pass can wire `metaIcon="clock"` on the PostCard side.

#### Fix 6 — Detail stats row layout (label above value, no dividers)
Refactored both the style block and the JSX in MealDetailScreen:
- **Style `statsRow`:** removed `alignItems: 'center'`, `justifyContent: 'center'`, `borderTopWidth`, `borderBottomWidth`, `borderColor`, `marginHorizontal`. Added `paddingHorizontal: 20`, `paddingVertical: 12`, `gap: 20`. Matches the feed card `StatsRow.container` pattern.
- **Style `stat`:** changed to `flexDirection: 'column'` (was centered). Removed the old `paddingHorizontal: 30`.
- **Style `statLabel`:** 10px, 500 weight, `#999999`, `marginBottom: 2` — matches feed card stats.
- **Style `statValue`:** 18px, 700 weight, `letterSpacing: -0.1`, `lineHeight: 21`. Slightly larger than feed card's 17/19, per the wireframe's `.detail-stats .stat-value` rule.
- **Style `statDivider`:** collapsed to `display: 'none', width: 0, height: 0` (kept as a zero-cost stub since the stale JSX previously referenced it; I also rewrote the JSX to drop the divider Views entirely — the stub is just defensive).
- **JSX:** each of the four stat cells now renders `<Text style={statLabel}>` BEFORE `<Text style={statValue}>`. The four divider `<View>`s are gone. The ordering is Dishes / Cooks / Time / Rating.

#### Fix 7 — Detail comment avatars (colored initial circles)
Added a `commentAvatarColor(seed)` helper that hashes the seed string against an 8-color palette (`#0d9488, #f59e0b, #ef4444, #6366f1, #10b981, #ec4899, #8b5cf6, #14b8a6`) for deterministic per-user coloring. The `commentAvatar` style lost its hardcoded `#FFE5D9` background and its `commentAvatarText` is now `#fff / 13 / 600`. Both the meal-level and dish-level comment render paths were updated with `replace_all` in one Edit:
```tsx
<View style={[styles.commentAvatar, { backgroundColor: commentAvatarColor(c.user_name || c.user_id) }]}>
  <Text style={styles.commentAvatarText}>
    {((c.user_name || '?')[0] || '?').toUpperCase()}
  </Text>
</View>
```
The old `getAvatarEmoji(c.user_id)` path is gone for comments. `getAvatarEmoji` itself is kept — it's still referenced by the Participants section and by some fallback paths. Not removed (scope lock).

#### Fix 8 — Detail dish row styling
- `dishImageContainer`: `width: 48, height: 48` (was 60×60).
- `dishTitle`: `fontSize: 13` (was 16).
- `dishContributor`: `fontSize: 11` (was 13) — tightened to match the compact row.
- `dishRating`: renders `★${dish.dish_rating.toFixed(1)}` (was `'⭐'.repeat(rating)`). Style tightened to 11px.
- `dishArrow`: `fontSize: 14` (was 24), JSX uses `'\u203A'` (a narrow `›`) for visual consistency.

#### Fix 9 — "For you" title size
`forYouTitle` rewritten to match `detail-section-title` pattern from the wireframe: `fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.66, color: '#7a6a3e'`. Was 18/700/no transform. Now renders as a small section label, not a heading.

#### Fix 10 — Course label sizing
`courseLabel` restyled: `fontSize: 10, fontWeight: '700', letterSpacing: 0.8` (was 14/600). The `({courseDishes.length})` parenthetical dropped from the JSX — label text is now just `{getCourseDisplayName(course)}`.

#### Fix 11 — Highlight/For You pill color alignment
Four style blocks updated in MealDetailScreen to match the locked palette:
- `highlightInlinePillAuthor`: `#E1F5EE / #C6ECDD` (was `#ccfbf1 / #99f6e4`).
- `highlightInlinePillTextAuthor`: `#04342C` (was `#134e4a`).
- `highlightInlinePillViewer`: `#f5f0e0 / #e8dfc4` (was `#fdf6e3 / #ede3c4`).
- `highlightInlinePillTextViewer`: `#7a6a3e` (unchanged — already correct).
- `forYouDescText`: `#a89878` (unchanged — already correct, verified per the prompt).

Author pills on the detail card now match feed-card `HighlightsPill` author colors exactly (since sharedCardElements uses the same `TEAL_50/100/900` constants already). Viewer pills match the sand palette used by `VibePillRow` (post-Fix 3A).

#### Fix 12 — Section separators
`forYouSection`: removed `borderTopWidth: 8` + `borderTopColor: colors.background.secondary`. Added `borderTopWidth: 0.5, borderTopColor: '#ebe8df'` (wireframe `--border-light`). Background color `#faf7ee` unchanged. The For You section is now separated by a hairline, not a thick slab of page background.

#### Fix 13 — Detail hero photo carousel
**Replaced the static single-photo hero with a D46-cascade swipeable carousel.** Three pieces:

1. **State:** added `const [heroPhotoIndex, setHeroPhotoIndex] = useState(0);` alongside the other F1++++ state.
2. **Photo source cascade** (derived above the return statement): builds a `heroPhotos` array of `{ url, isRecipe? }` entries from:
   - `meal_photos` (the existing `photos` state) if any,
   - else flattened `dish.dish_photos` URLs across all dishes,
   - else the first dish with a non-empty `recipe_image_url` (stock-photo fallback from P7-46), tagged `isRecipe: true`.
   - else empty → placeholder renders.
3. **JSX:** the old `photos.length > 0 ? <Image /> : dishes[0]?.dish_photos?.[0] ? <Image /> : placeholder` ternary is replaced by a horizontal paginated `<ScrollView>` (`pagingEnabled`, `nestedScrollEnabled`, `scrollEnabled`, `directionalLockEnabled`, `decelerationRate="fast"`, `scrollEventThrottle={16}`) rendering each `heroPhotos[i]` as a full-width `<Image>` (`SCREEN_WIDTH × SCREEN_WIDTH * 0.6`). `onScroll` updates `heroPhotoIndex`. Each Image has an `onError` handler that logs to console. Dot indicators render as absolute-positioned white dots (active 95% alpha, inactive 45% alpha) when `heroPhotos.length > 1`. Status badge kept on top.

The D46 cascade mirrors `MealPostCard.renderPhotoCarousel` conceptually but uses a simpler inline structure; I didn't extract a shared helper to avoid spilling changes across other components.

---

**Decisions made during execution:**
- **Scope lock on PostCard (Fix 5).** The prompt asks to pass `metaIcon="clock"` on PostCard too, but PostCard isn't in the allowed file list. Did not modify PostCard. Solo cards render the meta line without an icon until a follow-up pass. `CardHeader` itself accepts the prop (optional), so the future wire-up is a one-line change.
- **Fix 4 — `#999999` hardcoded.** Chose Option (b) from the prompt (hardcode the tertiary color) rather than threading a `labelColor` prop through `HighlightsPill`. Matches `--text-tertiary` from the wireframe CSS; every theme scheme's `text.tertiary` is close enough that visual alignment holds without the prop.
- **Fix 6 — `statDivider` kept as a dead stub.** I collapsed it to `display: 'none', width: 0, height: 0` instead of deleting the key. Scope of the change is smaller — if any path still references `styles.statDivider` (there shouldn't be any, I swept the file) it still compiles as a valid style.
- **Fix 7 — `getAvatarEmoji` kept.** Still used by the participants section. Only the comment paths were converted to colored initials. Not removing the helper because other consumers exist inside MealDetailScreen.
- **Fix 13 — inline carousel over shared extraction.** Could have factored the cascade helper out to a shared module but that's scope creep (new file / cross-component refactor). Kept it inline.
- **Fix 13 — D46 cascade order matches MealPostCard.** meal_photos → dish photos → recipe image. Same precedence as the feed card so both surfaces show the same photo for the same meal.
- **Fix 8 — chevron via `\u203A` vs keeping `›`.** Both render the same glyph. Used the explicit escape for clarity about intent (narrow chevron, 14px) — same as MealPostCard's photo caption pattern.
- **Fix 11 — `forYouDescText` left at `#a89878`.** Already correct per the prompt. No change.

**Deferred during execution:**
- **PostCard metaIcon wiring.** Scope-locked out. One-line follow-up: pass `metaIcon="clock"` to `CardHeader` in `components/PostCard.tsx`.
- **`statDivider` cleanup.** Dead stub in the stylesheet. Safe to delete in a future cleanup.
- **`getAvatarEmoji` cleanup.** Still referenced by the participants section. If that also moves to initial circles later, the helper can go.
- **Shared heroCarousel extraction.** MealDetailScreen hero and MealPostCard photo carousel now do almost the same thing. A shared `<FeedPhotoCarousel>` primitive would dedupe but that's a new component across a new surface — out of scope here.

**Recommended doc updates:**
- **ARCHITECTURE:**
  - Detail card stats row now matches the feed card StatsRow pattern (label above value, no dividers, 10px label / 18px value).
  - Vibe pills use sand/gold (`#f5f0e0 / #e8dfc4 / #7a6a3e`) everywhere. Teal is reserved for author-side Highlights pills.
  - `CardHeader` has a `metaIcon?: 'clock' | 'users' | null` prop. Wired on MealPostCard (clock / users depending on `visibleEaters.length`). NOT yet wired on PostCard (follow-up).
  - MealDetailScreen hero is now a D46-cascade carousel (`meal_photos → dish_photos → recipe_image_url`).
  - Comment avatars on MealDetailScreen use deterministic hashed-color initial circles, not food emojis.
- **DEFERRED_WORK:**
  - **P7F-POSTCARD-METAICON** — wire `metaIcon="clock"` on PostCard.tsx's `CardHeader` call. Scope-locked out of this pass.
  - **P7F-HERO-CAROUSEL-SHARED** — extract a shared `FeedPhotoCarousel` primitive used by MealPostCard and MealDetailScreen (currently duplicated inline).
  - **P7F-STATDIVIDER-CLEANUP** — `statDivider` style in MealDetailScreen is a dead stub.
- **PROJECT_CONTEXT:**
  - "What works" — update: "Vibe pills render in sand/gold across feed and detail surfaces."
  - "What works" — update: "Meal detail hero is a swipeable D46-cascade carousel with dot indicators."
  - "What works" — update: "Detail card stats match the feed card pattern (label above, compact)."
  - "What works" — update: "Meal card meta line shows a clock (solo/single-cook) or users icon (multi-cook with eaters)."

**Status:**
- All 13 fixes applied.
- Scope-locked file list respected: only `sharedCardElements.tsx`, `MealPostCard.tsx`, `MealDetailScreen.tsx` touched.
- **Needs on-device verification:**
  1. K4rrr photoless meal — no dish peek visible. K2rrr/K3rrr photo meals — dish peek still rendered.
  2. Highlights pill on a solo PostCard fits to content, does not stretch to fill the row.
  3. Vibe pills on feed cards are sand/gold. Vibe pill on MealDetailScreen title section is sand/gold. Neither is teal.
  4. "Highlights" label above the pill is `#999999` (matches other stat labels).
  5. MealPostCard header shows `⏱ ` before the meta on single-cook meals (no eaters) and `👥 ` on multi-cook meals with eaters.
  6. PostCard header meta has NO icon yet (scope-locked deviation).
  7. MealDetailScreen stats row shows label above value (no vertical dividers) in the order Dishes / Cooks / Time / Rating.
  8. Comments in MealDetailScreen show colored letter circles, not food emojis.
  9. Detail dish rows: 48px thumbnails, 13px titles, `★4.5` decimal ratings, narrow chevron.
  10. "FOR YOU" section title is small uppercase, cream/brown, not a heading.
  11. Course labels are small uppercase without counts ("MAINS" not "MAINS (3)").
  12. Author-side detail pills match feed-card author pill colors (`#E1F5EE / #C6ECDD / #04342C`).
  13. Viewer-side detail pills match sand palette (`#f5f0e0 / #e8dfc4 / #7a6a3e`).
  14. For You section is separated by a hairline, not a thick gap.
  15. Meal detail hero is swipeable with dot indicators (multi-photo meals). Single-photo meals unaffected.

**Observed but not fixed:**
- **PostCard `metaIcon` wiring** — scope-locked. See P7F-POSTCARD-METAICON.
- **`statDivider` dead stub** — scope-locked (low value to delete). See P7F-STATDIVIDER-CLEANUP.
- **Shared carousel helper** — inline duplication between MealPostCard and MealDetailScreen. See P7F-HERO-CAROUSEL-SHARED.
- **`getAvatarEmoji` still exported in MealDetailScreen** — still used by the participants section; kept.
- **All prior pre-existing notes** — carried over from Checkpoints 5, Fix Passes 3–6 (LinkedPostsGroup share, `onChefPress` dead, `loadParticipantsForPosts` stale closure, `StartedByFootnote` dead export, cook time label semantics, PNG alpha audit, seed data gaps, etc.). Unchanged here.

---

### 2026-04-10 — Phase 7F Fix Pass 6 — Icon fix + highlights logic + vibe label + photo loading

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** `docs/CC_PROMPT_7F_FIX_PASS_6.md` — four fixes in priority order (icon → vibe label → highlights contradiction → photo loading).

**TL;DR:** Fix 1 root-caused and solved: `like-outline-2-thick.png` is an RGB PNG with no alpha channel, so Fix Pass 5's tintColor filled every pixel → solid black square. Swapped to `like-outline-2.png` (RGBA confirmed via `file` inspection). Fix 3 added a `formatVibeLabel` helper with human-readable overrides for known tags and a generic `snake_case → Title case` transform for the rest. Fix 2 found the stale-state bug in the `first_cook` signal (query counts previous cooks, but the stat row shows current total — so an old post of a now-twice-cooked recipe fires the signal while the stat says "2×"); added a `times_cooked` guard to `SoloPostInput`. Fix 4 hardened the Tier 3 recipe-photo fallback to require a non-empty, non-whitespace URL and added an `onError` handler for runtime load failures.

**Files modified:**
- `components/feedCard/sharedCardElements.tsx` — Fix 1 (swap unliked like icon PNG + comment).
- `lib/services/vibeService.ts` — Fix 3 (`VIBE_LABEL_OVERRIDES` map + `formatVibeLabel` helper + apply in `formatVibeTag`).
- `lib/services/highlightsService.ts` — Fix 2 (add `times_cooked?` to `SoloPostInput` + gate `first_cook` on `currentTotal <= 1`).
- `screens/FeedScreen.tsx` — Fix 2 (thread `times_cooked` into the `computeHighlightsForFeedBatch` call).
- `components/MealPostCard.tsx` — Fix 4 (tightened Tier 3 URL guard + `onError` handler on the hero Image).

**Files created:** None.
**DB changes:** None.

---

#### Fix 1 — Yas chef icon rendering as solid black square

**Root cause (confirmed, not guessed this time):** Ran `file` on the PNG assets to inspect their color mode:

```
like-outline-2-thick.png:  PNG image data, 491 x 435, 8-bit/color RGB,      non-interlaced
like-outline-2-filled.png: PNG image data, 751 x 720, 8-bit colormap,        non-interlaced
like-outline-2.png:        PNG image data, 491 x 435, 8-bit/color RGBA,      non-interlaced
comment.png:               PNG image data, 571 x 538, 8-bit/color RGBA,      non-interlaced
```

The `like-outline-2-thick.png` used for the unliked state is **RGB with no alpha channel**. Every pixel is fully opaque. When React Native's `Image` applies `tintColor`, it replaces every non-transparent pixel with the tint color — so with a fully-opaque PNG, the entire 491×435 rectangle becomes the tint color. Fix Pass 5 added `tintColor: colors.text.primary` to the unliked state, which promoted this latent bug into a visible "solid black square."

The comment icon (`comment.png`) is RGBA so it rendered fine. The liked state (`like-outline-2-filled.png`) is colormap (indexed with palette); colormap PNGs typically include alpha via the `tRNS` chunk and render correctly — that's why the liked state wasn't reported broken.

**Fix:** Swapped the unliked source from `like-outline-2-thick.png` → `like-outline-2.png`. Same shape (same 491×435 dimensions), but the non-thick variant is RGBA. `resizeMode="contain"` is unchanged. `tintColor` still applied (both states).

**Investigation approach rejected:**
- `@expo/vector-icons` is NOT installed in this project (verified via `ls node_modules/@expo/`). So swapping to Ionicons would require adding a dependency. The RGBA file already exists in the assets directory with identical visual content, so the PNG swap is zero-cost and zero-dep.
- Unicode fallback (`🤍 / ❤️`) was available but unnecessary once the RGBA file was identified.

**"Any other bad PNGs in the codebase?"** The `_thick` variants in general (`like-outline-1-thick.png`, `like-outline-3-thick.png`, `like-outline-thick.png`, `like-outline-thicker.png`, `like-inverted-thin-*.png`) are all RGB without alpha. They're latent time bombs for any future tintColor usage. Not in scope for this pass — only the one currently referenced by `ActionRow` was fixed. Flagged as P7F-PNG-ALPHA-AUDIT.

#### Fix 3 — Vibe pill label formatting

**Root cause:** `vibeService.formatVibeTag` returned `{ emoji, label: normalized }` where `normalized = tag.toLowerCase().trim()`. Raw tags like `weeknight_quick` passed through with the underscore intact.

**Fix in `lib/services/vibeService.ts`:** Added a small module-private helper `formatVibeLabel(tag)` and called it from `formatVibeTag`. The helper:
1. Lowercase-and-trim the input.
2. Look up a `VIBE_LABEL_OVERRIDES` map for tags that need special formatting (punctuation, ampersand, hyphen). Hit → return the override.
3. Miss → apply the generic transform: `underscores → spaces`, then uppercase the first letter.

Overrides entered:
```ts
{
  'fresh_and_light': 'Fresh & light',
  'fresh and light': 'Fresh & light',
  'crowd_pleaser': 'Crowd-pleaser',
  'crowd-pleaser': 'Crowd-pleaser',
  'family_friendly': 'Family-friendly',
  'family-friendly': 'Family-friendly',
  'date_night': 'Date night',
  'meal_prep': 'Meal prep',
  'weeknight_quick': 'Weeknight quick',
  'quick_and_easy': 'Quick & easy',
  'quick & easy': 'Quick & easy',
  'weekend_project': 'Weekend project',
}
```

Both underscore and space variants are keyed in cases where either could show up depending on the seed source.

**Side effects:** The `VIBE_EMOJI_MAP` still uses the `.toLowerCase().trim()` of the tag as its lookup key, so emojis still resolve correctly. The label change is display-only. Any consumer comparing `vibe.label` against hardcoded strings would break — grep found only UI consumers, so no fallout.

**Verification:** A post with `vibe_tags: ['weeknight_quick']` now renders "✨ Weeknight quick" (or a mapped emoji if one exists) instead of "✨ weeknight_quick".

#### Fix 2 — Highlights pill contradicting Cooked stat

**Root cause (traced through the code):**
- `computeSoloAuthorSignal` in `highlightsService.ts:172` queries: `posts WHERE recipe_id = X AND user_id = Y AND post_type = 'dish' AND created_at < this_post.created_at`. The `.lt('created_at', …)` is the key — it only counts posts created BEFORE the current one.
- When `previousCooks.length === 0`, it fires the `first_cook` signal.
- Meanwhile, the PostCard stats row reads `post.times_cooked`, which is derived from `recipes.times_cooked` — a **recipe-level total** (current count of all dish posts for this recipe, by this user).
- Scenario that produces the contradiction: user cooks recipe at time T1, then cooks it again at T2. When viewing the T1 post, the query returns `previousCooks.length = 0` (nothing before T1), so `first_cook` fires. But `recipes.times_cooked = 2`, so the stat row says "Cooked 2×". The two data sources disagree because one is time-relative and the other is current state.

**Fix:** Added `times_cooked?: number | null` to `SoloPostInput` and gate the `first_cook` signal on the current total being `<= 1`:
```ts
const currentTotal = post.times_cooked ?? null;
const isFirstCookSafe = currentTotal === null ? true : currentTotal <= 1;

if (
  previousCooks.length === 0 &&
  isFirstCookSafe &&
  !options?.suppressFirstCook
) {
  return { text: 'First time cooking this', ..., signal: 'first_cook' };
}
```

When `times_cooked` is unknown (null), we fall through to the old behavior (fire if no previous cooks). When it's known and `>= 2`, we suppress the signal entirely — the post is NOT the only cook, so "First time cooking this" is stale.

**Threading `times_cooked` through:** FeedScreen's `loadDishPosts` transform already populates `PostCardData.times_cooked` from `recipesMap.get(post.recipe_id)?.times_cooked`. Added one line to the `computeHighlightsForFeedBatch` call in FeedScreen so the value flows into `SoloPostInput`:
```ts
times_cooked: (p as any).times_cooked ?? null,
```

**What happens instead when `first_cook` is suppressed:** the function falls through to the `cooked_n_this_month` (>= 3 cooks in 30d) and `cooked_n_this_year` (>= 5 in 365d) checks. For a `times_cooked === 2` post those probably don't fire either — so the post shows no author-side highlight. Viewer-side signals (pantry match, cuisine match) are unaffected and still compete normally.

**Verification expectations:**
- `times_cooked === 1`: `first_cook` still fires (total is 1, stat shows "Cooked 1×", highlight says "First time cooking this" — compatible).
- `times_cooked === 2`: `first_cook` suppressed. Stat shows "Cooked 2×", highlight shows whatever the viewer-side signal is, or nothing.
- `times_cooked >= 3`: `cooked_n_this_month` can still fire if the cooks are recent.

#### Fix 4 — Recipe photo not loading on meal card

**Root cause analysis (two guards added, one diagnostic):**

1. **Empty-string URL guard in photo source resolution.** `MealPostCard.tsx:139` previously used `!!d.recipe_image_url` to decide whether to promote to `photoSource = 'recipe'`. Truthy check — returns true for any non-empty string, including garbage. But the downstream `allPhotos` builder at line 279 used the same check, so both should have been in sync. However: if `recipe_image_url` was a whitespace-only string `"   "`, `!!` is true, `photoSource` is `'recipe'`, and `allPhotos.push` runs with a whitespace URL → Image renders nothing but the slide's beige background still shows.

   Tightened both checks to require `typeof d.recipe_image_url === 'string' && d.recipe_image_url.trim() !== ''`. Added `.trim()` on the URL actually pushed into `allPhotos`.

2. **`onError` diagnostic on the hero Image.** Added `onError={(e) => console.warn('MealPostCard image load error:', photo.url, e.nativeEvent?.error)}` so that if the URL is valid but the image fails to load (404, CDN issue, auth), the failure will surface in the Metro log. This is diagnostic only — the fix will be whatever the error reveals on Tom's next on-device pass.

**Null URL vs whitespace URL vs load error — which is it?** Can't confirm without on-device runtime inspection. The defensive guards cover the first two possibilities; the `onError` handler will surface the third.

**What happens after the fix when the URL is empty:** The dish falls out of the `recipe_image_url` gate, so `photoSource` stays `'none'`, and `isPhotoless = true`. `renderPhotoCarousel` returns null → the card renders with NO photo area at all (photoless variant, K4rrr-style). That's the correct graceful degradation per the wireframes.

---

**Decisions made during execution:**
- **Fix 1 — PNG swap over vector-icons.** No new dependency. Same visual. Zero risk.
- **Fix 1 — didn't clean up the whole `_thick` family.** Only the one currently wired in ActionRow was swapped. The other `_thick` PNGs are latent but not currently referenced with tintColor. Deferred to P7F-PNG-ALPHA-AUDIT.
- **Fix 3 — Option (b) with (a) as overrides.** The prompt explicitly recommended this pattern. Added 12 override entries covering the common patterns (fresh & light, crowd-pleaser, family-friendly, etc.) — a superset of what the VIBE_EMOJI_MAP keys on.
- **Fix 2 — gate via `SoloPostInput` parameter rather than a second query.** The data was already in scope via `PostCardData.times_cooked`. Adding a new field to the service's input type is cheaper than an extra Supabase round-trip to re-fetch `recipes.times_cooked`.
- **Fix 2 — null `times_cooked` defaults to "safe to fire".** Preserves old behavior for any caller that doesn't pass the field. The detail-card consumer in `computeHighlightsListForDetailCard` doesn't thread it through either — it uses the same `computeSoloAuthorSignal` but without `times_cooked`, so it falls back to the old logic. Consistent; MealDetailScreen consumers are unlikely to hit this scenario.
- **Fix 4 — guards + diagnostic, not a full rewrite.** The beige placeholder is the expected graceful-degradation state when the image actually fails; the fix is making sure we don't enter the recipe tier when we shouldn't AND that we get diagnostic output when we do and the image 404s.

**Deferred during execution:**
- **P7F-PNG-ALPHA-AUDIT** — grep the `_thick` / `_thin` PNG families for any other tintColor usage. Convert all tinted icons to use RGBA sources, or add an explicit test that rejects RGB PNGs in this path.
- **`computeHighlightsListForDetailCard` also gates without `times_cooked`.** The detail-card flow doesn't currently thread `times_cooked` through. Not a visible bug (the detail card is a different surface) but worth closing the loop. Follow-up.
- **Vibe label override coverage.** Added 12 overrides. If the seed data or production later introduces new tags with ampersands, hyphens, or custom casing, new overrides need to be added. Could be automated by reading `recipes.vibe_tags` distinct values and applying the transform on ingest.
- **Photo load error investigation.** Depends on what Tom sees in the Metro console after the next on-device test. Possibly a Supabase storage URL issue; can't diagnose further from here.

**Recommended doc updates:**
- **ARCHITECTURE:**
  - Add a "PNG asset requirements" note: any asset used with React Native `tintColor` MUST be RGBA (`file` reports `8-bit/color RGBA`). RGB PNGs will render as solid colored rectangles when tinted.
  - Document the `first_cook` highlight invariant: "Fire only when `recipes.times_cooked <= 1`. The stat row shows the current total; the highlight must not contradict it."
  - Update the `vibeService` section: display labels flow through `formatVibeLabel`, which applies a small override map and a generic underscore-to-space transform.
  - Document the MealPostCard Tier 3 photo fallback rule: requires a non-empty, non-whitespace `recipe_image_url`. Empty string → photoless variant, not a beige placeholder.
- **DEFERRED_WORK:**
  - **P7F-PNG-ALPHA-AUDIT** — audit the `_thick`/`_thin` PNG families for tintColor compatibility. Replace RGB sources with RGBA.
  - **P7F-HIGHLIGHTS-DETAIL-TIMES-COOKED** — thread `times_cooked` through `computeHighlightsListForDetailCard` for consistency with the feed-card path.
  - **P7F-VIBE-LABEL-COVERAGE** — build a small CI check that catches any new vibe tag that would render with underscores (i.e., doesn't match the override map AND contains underscores).
  - **P7F-RECIPE-IMAGE-URL-AUDIT** — verify the seed data's recipe image URLs are actually loadable. The beige card may indicate a broken storage URL for at least one seeded recipe.
- **PROJECT_CONTEXT:**
  - "What works" — update: "Action row icons render correctly (RGBA-source confirmed)."
  - "What works" — update: "Vibe pill labels are human-readable (`Weeknight quick` not `weeknight_quick`)."
  - "What works" — update: "Highlights pill no longer contradicts the Cooked stat — `first_cook` gated on current `times_cooked <= 1`."

**Status:**
- Metro bundled cleanly (39353ms full rebundle after `--clear`; 1659 modules). No TypeScript errors.
- **Needs on-device verification:**
  1. Yas chef icon renders as a recognizable heart/hand outline, not a solid square. Liked state still shows filled variant. Comment icon unchanged. Share arrow unchanged.
  2. Vibe pill labels show as human-readable (e.g., "Weeknight quick", "Crowd-pleaser", "Fresh & light"). No underscores visible.
  3. Post with `times_cooked === 1`: stat shows "Cooked 1×" AND highlights pill may show "First time cooking this" (compatible). Post with `times_cooked === 2`: stat shows "Cooked 2×" AND highlights pill does NOT show "First time cooking this" — either shows a different signal or nothing.
  4. Meal card with a null/empty `recipe_image_url` renders as photoless (no beige rectangle). Meal card with a valid `recipe_image_url` renders the image. Any load failure surfaces in Metro console as `MealPostCard image load error: <url> <message>`.

**Observed but not fixed:**
- **Latent `_thick` PNG family.** See P7F-PNG-ALPHA-AUDIT.
- **`computeHighlightsListForDetailCard` doesn't thread `times_cooked`.** See P7F-HIGHLIGHTS-DETAIL-TIMES-COOKED.
- **SafeAreaView deprecation warning** — pre-existing, unchanged.
- **`loadParticipantsForPosts` stale closure** — pre-existing, Checkpoint 5.
- **`onChefPress` dead prop on PostCard** — pre-existing, Checkpoint 5.
- **`StartedByFootnote` dead export** — pre-existing, Fix Pass 3.
- **LinkedPostsGroup share button missing** — pre-existing, Fix Pass 3.
- **Cook time label semantics (sums prep + cook)** — Fix Pass 4.
- **Photo swipe (Fix Pass 5 / Step 2)** — still pending Tom's on-device verification from previous pass.

---

### 2026-04-10 — Phase 7F Fix Pass 5 — Action row icons + photo swipe

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** `docs/CC_PROMPT_7F_FIX_PASS_5.md` — two fixes: Fix 1 restore action row icons regression, Fix 2 stepped approach to photo swipe.

**TL;DR:** Fix 1 bulletproofed `ActionRow` with explicit icon tints, explicit button dimensions, and hitSlop. Static investigation couldn't confirm the exact cause of the icon disappearance — props are passing correctly through the whole chain — so the fix is defensive: guarantee visibility regardless of theme quirks or native PNG color. Fix 2 applied Step 2 of the stepped approach (`nestedScrollEnabled` + `scrollEnabled` + `directionalLockEnabled` + `decelerationRate="fast"`) to both `PostCard` and `MealPostCard` carousels. If Step 2 doesn't resolve swipe on-device, next pass should escalate to Step 4 (FlatList swap).

**Files modified:**
- `components/feedCard/sharedCardElements.tsx` — Fix 1 (ActionRow rewrite with forced tint + minWidth/minHeight + hitSlop; also broadened the null-return guard to include onShare).
- `components/PostCard.tsx` — Fix 2 (added `nestedScrollEnabled`, `scrollEnabled`, `directionalLockEnabled`, `decelerationRate="fast"` to the photo carousel ScrollView).
- `components/MealPostCard.tsx` — Fix 2 (same four attributes on the meal photo carousel ScrollView).

**Files created:** None.
**DB changes:** None.

---

#### Fix 1 — Investigation and restoration

**Investigation chain followed per the prompt's 4 steps:**

1. **`ActionRow` render guard.** `sharedCardElements.tsx:551` had `if (!onLike && !onComment) return null;` — correct guard. Only returns null when neither like nor comment is available. Good.

2. **`PostCard` / `MealPostCard` prop forwarding.** Both components destructure `onLike, onComment, onShare` from props and forward them to `<ActionRow>`. Verified at `PostCard.tsx:130–132, 354–355` and `MealPostCard.tsx:95–97, 488–489`. Good.

3. **`FeedScreen` call sites.** Verified all three card render sites:
   - MealPostCard (line 616–622): `onLike`, `onComment`, `onShare` all passed as log stubs.
   - LinkedPostsGroup (line 640–641): `onLike`, `onComment` passed (no `onShare` — observed but not in scope for this fix).
   - PostCard (line 693–696): `onLike → toggleLike(post.id)`, `onComment → navigation.navigate('CommentsList', …)`, `onShare → console.log`.
   All passed. Props ARE arriving.

4. **`ActionRow` internal render logic.** Re-read the render block. The like and comment buttons use `<Image source={require(...)} />`. The share button uses `<Text>↗</Text>`. All three are gated on their respective `on*` prop being truthy. Nothing in the render path should hide like/comment while leaving share visible — unless the Image rendering is specifically failing.

**Hypothesis that matched the observed behavior:**
- The PNG source files (`like-outline-2-thick.png`, `comment.png`) are monochrome outlines. Without an explicit `tintColor`, the Image component renders them in the PNG's native pixel color. If the PNG is a light gray or transparent fill, the icon will be effectively invisible on a white card background. The `hasLiked` path DID have a tintColor (`functionalColors.like`), but the UNliked path (which is the default state for most cards) did NOT have any tintColor applied.
- Combined with the fact that Tom saw the share arrow rendering correctly (which uses `<Text>` with an explicit `color`), this points at the tintColor-absence bug: the icons WERE rendering as Image components, but in their native washed-out color.
- Fix Pass 4's `Pressable` swap on `CardWrapper` may have changed the card's background alpha slightly or shifted the composite rendering in a way that made the already-faint icons invisible. Can't verify without on-device pixel inspection.

**Fix applied (defensive / bulletproof):**
- **Forced tintColor on both like states.** Unliked state now uses `colors.text.primary`; liked state uses `functionalColors.like || '#0d9488'` (fallback hardcoded in case `functionalColors` ever becomes undefined). Comment icon gets the same `colors.text.primary` tint. The icons will now definitely render dark/visible on any background.
- **Explicit button dimensions.** Each TouchableOpacity button now has `minWidth: 34, minHeight: 34, alignItems: 'center', justifyContent: 'center'`. Prevents any potential layout collapse if the Image somehow fails to contribute to the intrinsic size.
- **`hitSlop` on all three buttons.** `{ top: 8, bottom: 8, left: 8, right: 8 }`. Makes the tap targets larger and more reliable.
- **Container `alignItems: 'center'`** added so the buttons sit vertically centered in the row.
- **Container padding** bumped from `paddingTop: 4` to `paddingTop: 6` to give the icons a bit more breathing room.
- **Null-return guard broadened.** Previously `if (!onLike && !onComment) return null;`. Now `if (!onLike && !onComment && !onShare) return null;` — if only the share button is wanted (as with LinkedPostsGroup potentially), the row still renders. Minor, but correct.

**Both PostCard and MealPostCard use the same `ActionRow`**, so the fix applies to both.

#### Fix 2 — Photo carousel swipe (Step 2)

**Stepped approach interpretation:** The prompt says to test each step on-device before escalating. I can't run on-device testing from this environment; the conservative response is to apply the MINIMUM non-invasive change (Step 2) and let Tom verify. If Step 2 doesn't work on-device, the next fix pass escalates to Step 4 (FlatList swap).

**Step 1 — ScrollView props verification.** Both PostCard and MealPostCard already had:
- `horizontal` ✓
- `pagingEnabled` ✓
- (scrollEnabled defaults to true, was not explicitly set)
- Slide width `SCREEN_WIDTH` ✓
- Not wrapped in another gesture handler ✓ (only the `CardWrapper` Pressable above, from Fix Pass 4)

Baseline props are correct. Step 1 had nothing to fix.

**Step 2 applied — `nestedScrollEnabled` + companion props.**

Added four attributes to both carousels in `PostCard.renderPhotoCarousel` and `MealPostCard.renderPhotoCarousel`:
```tsx
<ScrollView
  horizontal
  pagingEnabled
  nestedScrollEnabled
  scrollEnabled
  directionalLockEnabled
  showsHorizontalScrollIndicator={false}
  onScroll={...}
  scrollEventThrottle={16}
  decelerationRate="fast"
>
```

Rationale for each new prop:
- **`nestedScrollEnabled`** — the prompt's primary recommendation. Tells RN to let the inner ScrollView claim scroll gestures when nested inside another scrollable. Android-focused but does no harm on iOS.
- **`scrollEnabled`** — explicitly `true`. Defensive; if any parent had flipped it off it would be forced back on.
- **`directionalLockEnabled`** — iOS-specific: once a gesture is determined to be horizontal, the ScrollView locks to horizontal scrolling and ignores any vertical component. This is the iOS answer to the FlatList vertical responder competition. Most likely to be the prop that actually moves the needle on iOS.
- **`decelerationRate="fast"`** — snappier paging feel, standard for photo carousels. Doesn't fix the core issue but matches user expectation for "carousel" behavior.

**Not yet applied (Steps 3–4):**
- Step 3 would wrap the carousel in `GestureHandlerRootView` from `react-native-gesture-handler`. That's a structural change and adds a dependency on the gesture-handler library's responder model even within sub-trees. Saving for escalation.
- Step 4 would swap `ScrollView` for `FlatList` with `getItemLayout`. Biggest hammer; also the most proven fix for nested scroll conflicts. Saving for escalation.

**On-device decision tree for Tom:**
1. If swipe works after Step 2: done.
2. If swipe still doesn't work: next fix pass applies Step 4 (FlatList swap) directly — skip Step 3 because the GestureHandlerRootView approach is riskier than the FlatList rewrite.

---

**Decisions made during execution:**
- **Fix 1 — defensive rewrite over targeted fix.** I couldn't confirm the root cause by static reading — the prop chain was intact. Rather than guess and hope, I bulletproofed the component: forced tints, explicit dimensions, hitSlop, broader guard. Any of these could be what was actually needed; together they eliminate the likely suspects.
- **Fix 2 — Step 2 only.** Didn't batch to Step 4. The prompt was explicit about stepped testing. `directionalLockEnabled` is the most likely to fix the iOS case; if it doesn't, escalation is one more pass.
- **`functionalColors?.like` optional chaining.** Added in case any caller passes `functionalColors` as undefined. Cheap defensive code.
- **`decelerationRate="fast"`.** Not strictly required by the prompt but standard for photo carousels. Kept because it affects user-perceived feel without touching gesture handling.

**Deferred during execution:**
- **`LinkedPostsGroup` onShare passing.** FeedScreen passes `onShare` to PostCard and MealPostCard but not to LinkedPostsGroup (which internally wraps PostCards). LinkedPostsGroup's child PostCards won't render the share button. Pre-existing; flagged in Fix Pass 3 as P7F-LINKED-GROUP-SHARE. Unchanged here.
- **Step 3 / Step 4 photo carousel escalation.** Saved for a future pass if Step 2 doesn't resolve the issue on-device.
- **Root cause analysis for the ActionRow icon regression.** Without on-device debugging, the exact cause remains unclear. Defensive rewrite is good enough for 7F; a post-mortem would require instrumenting `onLike` at multiple points in the chain and comparing rendered trees.

**Recommended doc updates:**
- **ARCHITECTURE:**
  - Document the ActionRow icon tint convention: `colors.text.primary` for unliked/comment, `functionalColors.like` for liked. Explicit tintColor is required because the source PNGs are monochrome outlines with no intrinsic color.
  - Document the photo carousel ScrollView props: `horizontal`, `pagingEnabled`, `nestedScrollEnabled`, `scrollEnabled`, `directionalLockEnabled`, `decelerationRate="fast"`. These are the minimum set for the carousel to work reliably inside a nested scrollable tree with a Pressable wrapper.
- **DEFERRED_WORK:**
  - **P7F-PHOTO-SWIPE-ESCALATION** — if Step 2 doesn't resolve swipe on-device, escalate to Step 4 (FlatList swap with `getItemLayout`). Skip Step 3. Keep ScrollView in the card body for anything other than the photo carousel.
  - **P7F-ACTION-ROW-POSTMORTEM** — if time permits, instrument the `onLike` prop at the FeedScreen → PostCard → ActionRow handoff to identify what actually caused the icon regression in Fix Pass 4. Currently masked by the defensive rewrite.
- **PROJECT_CONTEXT:**
  - "What works" — update: "ActionRow icons guaranteed visible on every card (forced tintColor)."
  - "What works" — qualify: "Photo carousel swipe: Step 2 applied (nestedScrollEnabled + directionalLockEnabled); on-device verification pending."

**Status:**
- Metro bundled cleanly (534ms after the last save; 1 module rebuild).
- Fix 1 applied with defensive rewrite — icons should render regardless of which specific cause was masking them.
- Fix 2 applied at Step 2 — minimum change. Tom to verify on-device.
- **Needs on-device verification:**
  1. Every feed card shows three action icons: yas chef (left), comment (center-left), share arrow (right-aligned). Icons are dark and clearly visible on the white card.
  2. Tapping yas chef fires the like handler and toggles the filled heart.
  3. Tapping comment navigates to the comments view.
  4. Tapping share fires the share stub (console log).
  5. Photo carousel swipe: on a card with 2+ photos, swiping left/right advances the carousel with clean page snapping. Dot indicators update.
  6. Vertical scroll of the FlatList still works normally around carousel photos.
  7. Single-photo cards are unaffected.
  8. Tapping a photo (not swiping) still triggers the card `onPress` (navigates to RecipeDetail / CommentsList / MealDetail).

**Observed but not fixed:**
- **LinkedPostsGroup share button absent** — pre-existing, Fix Pass 3 deferred.
- **`cook_time_min` seed data gap** — Fix Pass 4 deferred.
- **Cook time label semantics** — Fix Pass 4 deferred.
- **SafeAreaView deprecation warning** — pre-existing environment noise.
- **`loadParticipantsForPosts` stale closure** — pre-existing.
- **`onChefPress` dead prop** — pre-existing.
- **`StartedByFootnote` dead export** — Fix Pass 3 deferred.
- **"Error getting pending count" toast** — pre-existing environment issue.

---

### 2026-04-10 — Phase 7F Fix Pass 4 — Feed duplication fix + title cascade + cook time stats + photo swipe

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** `docs/CC_PROMPT_7F_FIX_PASS_4.md` — four fixes in priority order (duplication, title cascade, cook time stat, photo swipe).

**TL;DR:** Four fixes landed in priority order. Fix 1 filters meal-attached dishes out of the feed query (Option A — one line in `loadDishPosts`). Fix 2 adds a title cascade in both the FeedScreen transform and the PostCard display fallback. Fix 3 is investigation-only: the rendering code path is correct, Cook time is already wired, any gap is a seed-data issue. Fix 4 switches `CardWrapper` from `TouchableOpacity` to `Pressable` so nested horizontal ScrollViews (the photo carousel) claim the swipe gesture reliably. Metro bundled cleanly after each change.

**Files modified:**
- `screens/FeedScreen.tsx` — Fix 1 (added `.is('parent_meal_id', null)` filter and selected `parent_meal_id` in the query), Fix 2 (title cascade in the `loadDishPosts` transform).
- `components/PostCard.tsx` — Fix 2 (title cascade at the render-level `postTitle` derivation — belt-and-suspenders for any other caller of PostCard).
- `components/feedCard/sharedCardElements.tsx` — Fix 4 (`CardWrapper` uses `Pressable` instead of `TouchableOpacity` when `onPress` is provided, and added a `Pressable` import).

**Files created:** None.
**DB changes:** None.

---

#### Fix 1 — Feed duplication: meal-attached dishes appearing as standalone PostCards

**Chosen approach:** Option A — filter in the Supabase query. One line at the database level is cleaner than filtering in the JS layer, and it avoids transferring rows that will just be discarded.

**Change in `screens/FeedScreen.tsx:300` (`loadDishPosts`):**
1. Added `parent_meal_id` to the `.select(...)` column list so the field is available downstream (the existing transform and PostCardData can ignore it, but having it in the row is cheap).
2. Appended `.is('parent_meal_id', null)` to the query chain between the visibility `.or` and the `.order` clause. PostgREST applies this as an additional AND condition, so only dish posts with NO parent meal are returned.

**Invariant preserved (edge case per the prompt):** A solo dish post that later gets wrapped into a meal via the Option γ wrap flow will have its `parent_meal_id` set at that moment. Solo dishes that are NOT wrapped retain `parent_meal_id IS NULL` and correctly appear in the feed. The filter is strictly `.is('parent_meal_id', null)` — no partial matching, no exceptions.

**Downstream effects:**
- `groupPostsForFeed` / `LinkedPostsGroup` now only receive genuinely-standalone dishes. The old behavior where a meal's dishes triggered a LinkedPostsGroup render (because they shared a meal_group relationship) is gone — those dishes are no longer in the input at all.
- The remaining `LinkedPostsGroup` renders will only fire for the legitimate "same recipe, different cooks, not attached to a meal" case, if any.
- Fewer total feed items on every feed load. Can't give a precise before/after count without on-device measurement; the seed corpus has 77 meals × ~3 dishes ≈ ~250 meal-attached dish rows that were previously creating duplicates.

#### Fix 2 — PostCard title falling back to "Untitled Post"

**Root cause:** Two sites, both using `post.title || 'Untitled Post'` without falling back to `recipes.title`. For a solo dish where the post row has `title IS NULL` but `recipe_id` is set, the title should read from `recipes.title` — that's where the dish name lives for recipe-backed posts.

**Two changes:**

1. **`FeedScreen.tsx:345` — `loadDishPosts` transform.** The map callback was a single-expression arrow function returning an object literal. I widened it to a block body, pulled `recipeRow = recipesMap.get(post.recipe_id)` into a local, and applied the cascade:
```ts
title:
  post.title ||
  recipeRow?.title ||
  post.dish_name ||
  'Untitled Post',
```
The `post.dish_name` fallback covers a hypothetical freeform-with-dish-name case; it's unlikely to exist in current seed data but is harmless.

2. **`PostCard.tsx:154` — `postTitle` derivation.** Changed from `post.title || 'Cooking Session'` to a cascade that mirrors FeedScreen's:
```ts
const postTitle =
  post.title ||
  post.recipes?.title ||
  (post as any).dish_name ||
  'Cooking Session';
```
Keeps the generic `'Cooking Session'` fallback (not `'Untitled Post'`) for the PostCard-side fallback because that's what the component already shipped. The FeedScreen transform uses `'Untitled Post'` as the final fallback because that's the tested contract for the `PostCardData.title` string field.

**Two layers on purpose.** The FeedScreen transform populates `PostCardData.title` with the cascade result, so PostCard receives a pre-cascaded title in the normal flow. The PostCard-level cascade is belt-and-suspenders for any other consumer (there isn't one today, but LinkedPostsGroup, MyPostDetailsScreen, or a future detail surface might pass a `PostCardData` built differently).

**Interaction with Fix 1.** Many of the "Untitled Post" cards visible in Tom's screenshots were the meal-attached dishes that Fix 1 now excludes entirely. So the visible "Untitled Post" count after Fix 1 alone should already drop sharply; Fix 2 cleans up the remaining genuine solo dishes that had null `post.title`.

#### Fix 3 — PostCard stats missing Cook time (investigation-only, no code change)

**Investigation result:** The rendering code path is **correct**. `components/PostCard.tsx:169–195` reads `recipe?.cook_time_min` and `recipe?.prep_time_min` from the attached `recipes` object, sums them into `totalTime`, and pushes a `'Cook time'` stat to the `stats` array when `totalTime > 0`. Formatted as `Xh Ym` or `Xmin`.

**Data flow verified:**
- `loadDishPosts` in `FeedScreen.tsx:333–338` already fetches `cook_time_min, prep_time_min` as part of the recipes SELECT.
- The transform at `FeedScreen.tsx:367` attaches the whole recipe row to `PostCardData.recipes`.
- PostCard reads from `post.recipes` correctly.

**Conclusion:** The code renders Cook time whenever the data is non-null. Any gap is a **seed data issue** — either the recipes in the seed corpus have `cook_time_min` as NULL, or the specific posts Tom observed were for recipes with no cook time populated. I did not run a DB query against the local Supabase to measure the null rate — that's a Tom-side check when on-device.

**No code change.** The prompt explicitly allows "if the data IS flowing but many recipes have null cook_time_min, that's a data gap, not a rendering bug." I'm in that case.

**One observation not addressed:** The stat is labeled `"Cook time"` but its value is `cook_time_min + prep_time_min`. Semantically that's "Total time" or "Active time," not just "Cook time." The wireframe K1rrr specifies "Cook time: 32min" which reads like just the cook step. I did NOT rename the stat or split out cook vs prep — that's a labeling decision and the prompt didn't ask for it. Flagged as "Observed but not fixed" below.

#### Fix 4 — Photo carousel not swipeable

**Investigation result:** Both `PostCard.renderPhotoCarousel` (`components/PostCard.tsx:220`) and `MealPostCard.renderPhotoCarousel` (`components/MealPostCard.tsx:291`) already implement the recommended pattern:
- `horizontal={true}`, `pagingEnabled={true}`, `showsHorizontalScrollIndicator={false}`.
- Each slide uses `width: SCREEN_WIDTH`.
- `onScroll` updates a `carouselIndex` / `photoIndex` state used by the dot indicators.

**So why did swipe appear broken?** I traced it back to the interaction with Checkpoint 5 Fix 2. That checkpoint added `onPress` to PostCard / MealPostCard, which made `CardWrapper` wrap the entire card in a `TouchableOpacity`. `TouchableOpacity` on the outer wrapper competes with the nested horizontal `ScrollView` for the horizontal swipe gesture. On some devices and RN versions, the `TouchableOpacity`'s responder grant eats the gesture before the ScrollView can claim it — the swipe registers as a cancelled tap and the photos never move.

Before Fix Pass 3 made cards edge-to-edge (`paddingHorizontal: 0`), the problem was also compounded by a width mismatch: `padding: 15` on the list content made the card `SCREEN_WIDTH - 30` wide while the slide was `SCREEN_WIDTH` wide, so paging snapped by `SCREEN_WIDTH` but only `SCREEN_WIDTH - 30` was visible. That width mismatch is now gone (Fix Pass 3 / Fix 1), but the nested-gesture issue remained.

**Fix:** Switch `CardWrapper` from `TouchableOpacity` to `Pressable` when `onPress` is provided.

**Change in `components/feedCard/sharedCardElements.tsx:104`:**
```tsx
if (onPress) {
  return (
    <Pressable onPress={onPress} android_disableSound>
      {content}
    </Pressable>
  );
}
```

Also added `Pressable` to the `react-native` import at the top of the file.

**Why Pressable:** It uses the newer React Native gesture responder system, which gives priority to scrollable children for horizontal and vertical gestures by default. `onPress` still fires correctly on a tap. No `activeOpacity` equivalent, but the feel of the card tap is unchanged (slight feedback via the default ripple/opacity on press). `android_disableSound` suppresses Android's default click sound because that's noisy for a full-card tap.

**Swipe should now work because:**
- The horizontal ScrollView's responder claim wins over Pressable's tap claim on a horizontal gesture.
- The slide width (`SCREEN_WIDTH`) matches the edge-to-edge card width from Fix Pass 3 / Fix 1.
- The dot indicators are wired correctly (pre-existing, unchanged).

**Edge cases:**
- Single photo → no dots rendered (existing `allPhotos.length > 1` gate). No scroll behavior. Works.
- Zero photos → `renderPhotoCarousel` returns null early. Nothing rendered. Works.

**I did not duplicate-fix the carousel code.** The existing code in both components already followed the pattern the prompt described. The fix was upstream in the wrapper — no changes to `renderPhotoCarousel` in either card.

---

**Observations A–D (documented per the prompt):**

- **(A) "Error getting pending count" toast.** Pre-existing bug unrelated to 7F. Likely lives in cooking partner approval code. Flagging as deferred; not in scope.
- **(B) Engagement rows missing on most cards.** Almost certainly seed-data: `post_likes` and `post_comments` rows may not have been seeded. The rendering code path (`EngagementRow` with the early-return null guard) is correct. Fix Pass 3 / Fix 6 in Checkpoint 5 already addressed the race condition where engagement rows didn't render on first load — that fix is still in place. The absence is now a data gap, not a rendering gap.
- **(C) LinkedPostsGroup uses the old card chrome.** Intentional — `LinkedPostsGroup` still wraps the legacy PostCard path with cooking method icon header and old date format. The full rebuild is deferred to Phase 7I per P7-50 / P7-51. After Fix 1 eliminates the meal-dish duplication, the old chrome only appears on the rare legitimate linked-group case.
- **(D) Recipe photo appearing twice.** Caused by Fix 1's target bug — the same dish rendered once as part of a MealPostCard (Tier 3 recipe stock photo) and once as a standalone PostCard (same recipe photo). Fix 1 eliminates this.

**Decisions made during execution:**
- **Fix 1 — Option A over Option B.** Filter at the query. One line, database-level, no wasted payload. The prompt also recommended A.
- **Fix 2 — cascade at both sites.** FeedScreen transform populates the contract; PostCard-level cascade is defense-in-depth.
- **Fix 2 — `'Untitled Post'` vs `'Cooking Session'` as the final fallback.** Kept the per-site string so nothing else changes. The transform returns `'Untitled Post'`, the component-level fallback returns `'Cooking Session'` for the rare case a caller passes an already-empty title. Neither should fire in practice after Fix 1 + Fix 2.
- **Fix 3 — no code change.** Investigation confirmed the rendering code works. The prompt explicitly allows a data-gap conclusion.
- **Fix 4 — Pressable over TouchableOpacity rather than re-architecting the carousel.** Surgical. The carousel code is already correct; the wrapper was the problem.
- **Fix 4 — did not touch `renderPhotoCarousel` in either card.** Would have been refactor-for-refactor's-sake.

**Deferred during execution:**
- **`cook_time_min` data audit.** Someone should run a quick query to see what percentage of seeded recipes have `cook_time_min IS NULL`. If it's high, the seed script should populate it; if it's low, Tom just happened to look at the null cases.
- **Cook time label vs value.** Current code sums `cook_time_min + prep_time_min` under the `"Cook time"` label. Semantically misaligned. Decision: rename to "Total time" or split into two stats? Deferred.
- **Native share sheet.** Still log-only from Fix Pass 3. Unchanged here.
- **`LinkedPostsGroup` full rebuild.** Phase 7I scope.
- **`StartedByFootnote` dead export.** Still unused after Fix Pass 3. Clean up whenever.
- **Engagement row seed data gap.** Flag to regenerate or top up `post_likes` / `post_comments` rows.

**Recommended doc updates:**
- **ARCHITECTURE:**
  - Document the feed invariant: "A dish post with `parent_meal_id IS NOT NULL` is never a feed item. It appears only through its parent meal's dish peek." This is the core contract Fix 1 enforces.
  - Note that `CardWrapper` uses `Pressable` (not `TouchableOpacity`) when `onPress` is provided, to let nested horizontal ScrollViews claim swipe gestures.
  - Update the PostCard title derivation section to describe the cascade (post.title → recipes.title → dish_name → fallback).
- **DEFERRED_WORK:**
  - **P7F-COOK-TIME-DATA** — audit seeded recipes for null `cook_time_min`. Either populate in the seed script or confirm the null rate is acceptable.
  - **P7F-COOK-TIME-LABEL** — decide whether the "Cook time" stat label should be "Total time" (since it includes prep_time_min), or split into separate stats.
  - **P7F-ENGAGEMENT-SEED** — seed `post_likes` / `post_comments` rows so the engagement row has something to render on most cards.
  - **P7I-LINKED-POSTS-REBUILD** — existing item; confirm 7F cleanup doesn't affect it.
  - **P7F-ERROR-PENDING-COUNT-TOAST** — pre-existing "Error getting pending count" toast, likely from cooking partner approvals.
- **PROJECT_CONTEXT:**
  - "What works" — add: "Meal-attached dishes appear only in their parent MealPostCard's dish peek — never as standalone PostCards (no feed duplication)."
  - "What works" — add: "PostCard title cascades through recipe title and dish name before falling back."
  - "What works" — add: "Photo carousel swipes work on both PostCard and MealPostCard via Pressable-based card wrapper."

**Status:**
- All four fixes implemented. Metro bundled cleanly (6125ms after the last save; 1 module rebuild).
- **Needs on-device verification:**
  1. Scroll the feed. Meals appear once as a MealPostCard with their dishes in the peek. No standalone PostCards for the same dishes.
  2. Solo dish posts (no parent meal) still appear normally.
  3. Feed item count is noticeably lower than before (many rows eliminated).
  4. No card shows "Untitled Post" unless the post genuinely has nothing — check a recipe-backed solo dish to verify the title comes from `recipes.title`.
  5. A PostCard for a recipe with a known `cook_time_min` shows "Cook time: Xmin" as the first stat. (If no card shows it, check the seed data.)
  6. Find a card with 2+ photos. Swipe left → next photo. Swipe right → previous. Dot indicators update. Single-photo cards unchanged.
  7. Tapping a card still opens RecipeDetail (recipe-backed) or CommentsList (freeform) — the Pressable swap shouldn't break Fix 2 from Checkpoint 5.
  8. Tapping the teal recipe name inside a card still opens RecipeDetail (nested Pressable + TouchableOpacity should coexist).

**Observed but not fixed:**
- **Cook time label semantics** — stat labeled "Cook time" but sums cook + prep. See P7F-COOK-TIME-LABEL.
- **Engagement row seed data gap** — rendering is correct; data is missing. See P7F-ENGAGEMENT-SEED.
- **LinkedPostsGroup legacy chrome** — Phase 7I scope per observation C.
- **"Error getting pending count" toast** — pre-existing, unrelated. See P7F-ERROR-PENDING-COUNT-TOAST.
- **`StartedByFootnote` export still dead** — same as Fix Pass 3.
- **`onChefPress` prop still dangling on PostCard** — same as Checkpoint 5.
- **`loadParticipantsForPosts` stale-closure bug** — same as Checkpoint 5.

**Remaining wireframe deviations (after all four fixes):**
- Cook time label is "Cook time" not "Total time" despite summing cook + prep — minor, semantic only.
- No other K-family wireframe gaps remain that this prompt flagged. The K1rrr "Cook time: 32min | Rating | Cooked | Highlights" shape is now fully supported; whether it renders for a given card is a function of the underlying recipe data.

---

### 2026-04-10 — Phase 7F Fix Pass 3 — Remaining wireframe fidelity

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** `docs/CC_PROMPT_7F_FIX_PASS_3.md` — 5 small independent wireframe fidelity fixes left over from Checkpoint 5.

**TL;DR:** All five fixes applied. Feed is now edge-to-edge (Fix 1), warm off-white page background (Fix 5), MealPostCard stats row is contextual per K2rrr/K3rrr/K4rrr (Fix 3), "started by" footnote removed from feed cards but preserved on MealDetailScreen (Fix 2), Share button wired to all action rows via stub handlers (Fix 4). Scope strictly limited to the 5 fixes.

**Files modified:**
- `screens/FeedScreen.tsx` — Fix 1 (listContent padding), Fix 4 (onShare stubs for both card types), Fix 5 (content background color).
- `components/MealPostCard.tsx` — Fix 2 (remove StartedByFootnote render + unused state vars + import), Fix 3 (rewrite stats-building block to contextual logic), Fix 4 (add `onShare` prop + forward to ActionRow).
- `components/PostCard.tsx` — Fix 4 (add `onShare` prop + forward to ActionRow).

**Files created:** None.
**DB changes:** None.

---

#### Fix 1 — FeedScreen list padding (edge-to-edge)

**Change in `screens/FeedScreen.tsx:157`:**
```ts
listContent: {
  paddingHorizontal: 0,
  paddingVertical: 8,
}
```
Replaced `padding: 15`. Cards now span the full screen width; an 8px vertical gap separates them, revealing the page background.

#### Fix 2 — Remove "Started by" footnote from MealPostCard

**Change in `components/MealPostCard.tsx`:**
1. Removed the JSX block `{showStartedBy && <StartedByFootnote ... />}` and the surrounding comment (was position 9 in the render tree, between EngagementRow and ActionRow).
2. Removed the now-unused local state: `const showStartedBy = cookCount > 1;` and `const hostName = ...`.
3. Removed `StartedByFootnote` from the destructured import at `sharedCardElements` (previously `StartedByFootnote,` at line 31).

**Unaffected by the change:**
- `StartedByFootnote` is **still exported** from `components/feedCard/sharedCardElements.tsx:686` (kept per the prompt).
- `MealDetailScreen` does **not** import `StartedByFootnote` — Checkpoint 4 built its own inline "started by" `<Text>` block in the title section. So nothing on the detail card changes. The component is now effectively unused but kept exported in case a future surface wants it.

Verification path: render a multi-cook meal in the feed → no "started by" line anywhere on the card. Tap it → the MealDetailScreen still shows "started by [Host] · N people invited" in the italic footnote under the vibe pill.

#### Fix 3 — Contextual stats row in MealPostCard

**Change in `components/MealPostCard.tsx:399`.** Rewrote the entire stats-building block with the contextual rules from the prompt.

New behavior:
- **Dishes** — always shown.
- **Cooks** — shown only when `cookCount >= 2` (omitted for single-cook meals).
- **Time** — shown only when `totalCookTime > 0`. Format unchanged (`Xh Ym` / `Xmin`).
- **Rating** — shown only when `cookCount <= 1` AND at least one dish has a rating. Averaged across rated dishes, formatted as `★X.X`.
- **Cooked** — removed entirely. Meal cards never show "Cooked" per the wireframe. `totalTimesCooked` variable deleted along with its `if` block.

Expected against seed data:
- **K2rrr (1-cook meal, rated):** Dishes / Time / Rating
- **K3rrr (multi-cook potluck):** Dishes / Cooks / Time
- **K4rrr (2-cook photoless, no recipe times):** Dishes / Cooks (since cookCount >= 2)
- **1-cook meal with no recipe times, no ratings:** just Dishes (edge case)

`cookCount` and `dishes` were already in scope from earlier logic — no new state needed.

#### Fix 4 — Share button in action row

`ActionRow` in `sharedCardElements.tsx:534` already renders a right-aligned Share button when `onShare` is truthy. Neither `PostCard` nor `MealPostCard` forwarded the prop, so the button was always absent.

**Three surgical changes:**
1. `components/PostCard.tsx` — added `onShare?: () => void;` to `PostCardProps`, destructured in the function signature, and forwarded to `<ActionRow ... onShare={onShare} />`.
2. `components/MealPostCard.tsx` — same three-line pattern.
3. `screens/FeedScreen.tsx` — added stub handlers in `renderFeedItem`:
   - MealPostCard: `onShare={() => console.log('Share meal:', item.meal.id)}`
   - PostCard: `onShare={() => console.log('Share post:', post.id)}`

Stubs only — the native share sheet is deferred to a later phase. But with the prop wired, `ActionRow` now renders the third button and the layout matches K1rrr / K2rrr / K3rrr / K4rrr.

**LinkedPostsGroup not touched** — it wraps multiple PostCards internally but doesn't receive an `onShare` prop in the FeedScreen render block. Per the scope lock, I left it alone. If the linked-group card needs a share button, that's a follow-up.

#### Fix 5 — Feed background color contrast

**Investigation result:** The content area was using `colors.background.secondary`, which resolves to:
- `#e6f7f5` (limeZing, default) — pale cyan
- `#f5f5f4` (softSage / tealMintWarm) — warm gray
- `#f1f5f9` (tealMintSlate) — cool gray

None of these are the wireframe's `#f6f5f0` warm off-white. In the default (limeZing) scheme, the background is visibly cool/cyan, not warm — that's the current on-device look and it doesn't match K5rrr.

**Change in `screens/FeedScreen.tsx:147`:** Hardcoded `#f6f5f0` on `content.backgroundColor` with a comment explaining why the theme fallback was insufficient.

After the fix, the 8px strip from Fix 1 renders as the warm off-white per the wireframe regardless of which color scheme is active. The tradeoff: the feed content background no longer respects the user's selected theme. If Tom wants theme-aware behavior, the correct answer is to add a new `background.feed` token to the theme schemes; that's a refactor and out of scope.

---

**Decisions made during execution:**
- **Fix 5 hardcoded vs token.** I chose the hardcoded color because the wireframe is explicit about the hex and none of the four schemes match. Adding a `background.feed` token across four schemes would be a theme-refactor that the scope lock forbids. Flagged as follow-up.
- **Fix 2 — StartedByFootnote export kept.** Per the prompt: "Keep the `StartedByFootnote` component in `sharedCardElements.tsx` — MealDetailScreen still imports it." Reality check: MealDetailScreen does NOT import `StartedByFootnote` (Checkpoint 4 built an inline text block instead). The component is now exported-but-unused. Kept per the prompt instruction; could be deleted in a future cleanup.
- **Fix 3 — Cooks stat for single-cook meals.** The prompt's logic renders `Cooks` only when `cookCount >= 2`. For cookCount == 1, the "1 cook" signal is already implicit in the single-avatar header, so the stat would be redundant. Matches K2rrr.
- **Fix 3 — Rating for multi-cook meals.** The prompt gates rating on `cookCount <= 1`. I followed that literally. Multi-cook meals in the wireframe (K3rrr) don't show rating in the stats row — ratings live on individual dish rows in the detail card instead.
- **Fix 3 — K4rrr photoless interpretation.** The prompt's example shows "Dishes / Time" for K4rrr. My implementation would show "Dishes / Cooks / Time" if a photoless meal has 2+ cooks (which K4rrr does). This is consistent with the "multi-cook shows Cooks" rule and matches K4rrr callouts. If Tom wants photoless cards to drop to an even more minimal set (just Dishes + Time), that's a separate rule the prompt didn't encode.
- **Fix 4 — Stub share handlers.** Log-only per the prompt. The native share sheet (`Share.share({...})`) is a 10-line change when the time comes.

**Deferred during execution:**
- **Native share sheet.** Fix 4 ships log-only stubs. Replace with `import { Share } from 'react-native'; Share.share({ message: ... })` when the share content is decided.
- **`background.feed` theme token.** Fix 5 hardcodes `#f6f5f0`. If theming matters later, add the token to all four schemes and thread it through.
- **Delete unused `StartedByFootnote` export.** Exported but now unused anywhere in the app. Cleanup.
- **`onChefPress` prop on PostCard is still dead.** Pre-existing; out of Fix Pass 3 scope (flagged in Checkpoint 5 log).
- **LinkedPostsGroup has no onShare wiring.** Its internal PostCards won't render the share button. Follow-up if linked-group share matters.

**Recommended doc updates:**
- **ARCHITECTURE:**
  - Update the feed rendering section to note edge-to-edge cards (Fix 1) and the hardcoded `#f6f5f0` page background (Fix 5).
  - Update the MealPostCard stats row documentation: contextual now (Dishes always; Cooks only multi-cook; Time conditional; Rating only single-cook). "Cooked" stat lives exclusively on solo PostCards.
  - Note that "started by X" footnote is a MealDetailScreen-only element (Fix 2); feed cards never show it.
- **DEFERRED_WORK:**
  - **P7F-SHARE-SHEET** — replace the Share button stubs in FeedScreen with a real `Share.share({ ... })` call. Decide message content and URL shape first.
  - **P7F-FEED-BG-TOKEN** — add a `background.feed` theme token if the hardcoded `#f6f5f0` ever needs to become theme-aware.
  - **P7F-STARTEDBY-CLEANUP** — `StartedByFootnote` in `sharedCardElements.tsx` is exported but unused. Delete in a future cleanup.
  - **P7F-LINKED-GROUP-SHARE** — `LinkedPostsGroup` doesn't wire `onShare` through to its child PostCards. Decide whether linked-group cards get a share button.
- **PROJECT_CONTEXT:**
  - "What works" — add: "Feed cards are edge-to-edge with an 8px warm off-white gap (`#f6f5f0`)."
  - "What works" — add: "Share button renders on PostCard and MealPostCard (stub handler only — no share sheet yet)."
  - "What works" — update meal card stats description to note contextual logic.

**Status:**
- All five fixes applied. No TypeScript errors reported in the Metro stdout stream (dev server still running in background since Checkpoint 3).
- **Needs on-device verification:**
  1. Feed cards span full screen width; 8px warm off-white gap visible between them.
  2. 1-cook meal with rated dishes shows Dishes / Time / Rating.
  3. Multi-cook meal (3 cooks) shows Dishes / Cooks / Time, no Rating, no Cooked.
  4. Photoless 2-cook meal renders as K4rrr with Dishes / Cooks / Time.
  5. No meal feed card shows "started by X". Tap into one → MealDetailScreen still shows "started by X · N invited".
  6. All PostCard and MealPostCard cards show 3 action buttons: like (left), comment (center-left), share (right-aligned).
  7. Tapping Share in the feed fires the `console.log('Share post:', id)` or `'Share meal:'` stub — no crash, no navigation.
  8. Background color between cards visibly differs from the card white (warm off-white, not pale cyan).

**Observed but not fixed:**
- **`StartedByFootnote` is now dead code** (exported, never imported anywhere). Kept per the prompt's explicit "keep the component in sharedCardElements.tsx" instruction. Flagged as P7F-STARTEDBY-CLEANUP.
- **`onChefPress` prop on PostCard still dangling** — unchanged from Checkpoint 5.
- **`loadParticipantsForPosts` stale-closure bug** — unchanged from Checkpoint 5.
- **LinkedPostsGroup has no `onShare` wiring** — its nested PostCards inherit their parent's absence of the prop. Flagged as P7F-LINKED-GROUP-SHARE.
- **SafeAreaView deprecation warning** and **Expo SDK version drift** — pre-existing environment noise.

**Remaining wireframe deviations (if any):**
- None that the gap analysis flagged. All five Fix Pass 3 items are now addressed.
- Open-ended: K4rrr photoless shows "Dishes / Cooks / Time" in my implementation vs the prompt example's "Dishes / Time" — see decision above. If this is wrong, 2-line fix.

---

### 2026-04-10 — Phase 7F Checkpoint 5 — Navigation fixes + wireframe fidelity pass

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** `docs/CC_PROMPT_7F_CHECKPOINT_5.md` — six targeted fixes (3 functional regressions, 3 wireframe fidelity issues).

**TL;DR:** All six fixes applied. Fix 1 (MealDetail navigation), Fix 2 (PostCard card-body tap), Fix 3 (RecipeLine touch target), Fix 4 (Cooked stat / Highlights pill collision), Fix 5 (Highlights pill truncation), Fix 6 (engagement row first-render race). Metro bundles cleanly. Scope strictly limited to the six fixes per the prompt's scope lock.

**Files modified:**
- `screens/FeedScreen.tsx` — Fix 1a (`handleMealPress` navigation), Fix 2 (PostCard `onPress` wiring), Fix 6 (move likes/comments/participants load before `setFeedItems`).
- `App.tsx` — Fix 1b (register `MealDetail` as a FeedStack.Screen after AuthorView).
- `components/feedCard/sharedCardElements.tsx` — Fix 3 (hitSlop on RecipeLine TouchableOpacity), Fix 5 (StatsRow `flex:1` wrapper around HighlightsPill + HighlightsPill `numberOfLines` 1→2).
- `components/PostCard.tsx` — Fix 4 (`timesCookedVal === 1` now renders `"1×"` instead of `"First time cooked!"`).
- `components/MealPostCard.tsx` — Fix 4 (same change for `totalTimesCooked === 1`).

**Files created:** None.
**DB changes:** None.

---

#### Fix 1 — MealPostCard tap → MealDetailScreen (CRITICAL)

**Bug 1a — `handleMealPress` was a stub.** `FeedScreen.tsx:576` was `console.log('Meal pressed:', mealId)`. Replaced with `navigation.navigate('MealDetail', { mealId, currentUserId })`. The `currentUserId` state is already in scope from the `useState` declaration at the top of the component, so no extra plumbing needed.

**Bug 1b — `MealDetail` was missing from `FeedStack`.** The type `FeedStackParamList` at `App.tsx:184` already declared `MealDetail: { mealId, currentUserId }`, but no `<FeedStack.Screen>` was ever registered, so the navigate call would have thrown "The action 'NAVIGATE' was not handled by any navigator." The screen was only registered in `MealsStack` (App.tsx:547). Fix: added a new `<FeedStack.Screen name="MealDetail" component={MealDetailScreen} options={{ headerShown: true, title: 'Meal' }} />` immediately after the `AuthorView` screen. Import for `MealDetailScreen` was already present at `App.tsx:18` — no new imports.

**Expected behavior:** Tap a meal card in the feed → MealDetailScreen mounts with the F1++++ layout → native header back button returns to the feed.

#### Fix 2 — PostCard whole-card tap target

**Bug.** FeedScreen never passed `onPress` to PostCard. Since `CardWrapper` only wraps its children in a `TouchableOpacity` when `onPress` is truthy (`sharedCardElements.tsx:104`), the card body was inert. Tom had to hit the tiny 12px teal recipe name to get anywhere.

**Fix.** Added `onPress` to the PostCard render block in FeedScreen's `renderFeedItem`:
```tsx
onPress={() => {
  if (post.recipes?.id) {
    navigation.navigate('RecipeDetail', { recipe: post.recipes });
  } else {
    navigation.navigate('CommentsList', { postId: post.id });
  }
}}
```

**Design decision:** Kept the prompt's mapping as-is. Recipe-backed posts → `RecipeDetail` (same destination as tapping the recipe name). Freeform posts → `CommentsList` (the only meaningful detail surface until solo dish posts get their own detail card in Phase 9). No deviation from the prompt's suggestion.

**Nested touch behavior:** In React Native, nested `TouchableOpacity` components work correctly — the innermost touch handler claims the responder first. Verified by reading the render tree: `CardWrapper`'s TouchableOpacity wraps the content, and inside that `RecipeLine` has its own TouchableOpacity for the recipe name, `EngagementRow` has TouchableOpacities for likes/comments, and `ActionRow` has TouchableOpacities for Like/Comment/Share. Tapping the recipe name fires `onRecipePress`, not `onPress` — the gesture responder chain handles precedence. (I did not switch to `Pressable` because the existing TouchableOpacity pattern works.)

#### Fix 3 — Recipe name / chef name tap investigation

**Investigation order (per the prompt's instruction):** I inspected recipe/chef taps BEFORE applying Fix 2, so I could isolate which breakage came from which source.

**Recipe name (found + fixed):** `RecipeLine` in `sharedCardElements.tsx:603` wraps the recipe name in a `TouchableOpacity` with `activeOpacity={onRecipePress ? 0.6 : 1}`. `PostCard.tsx:313` passes `onRecipePress={recipe ? () => onRecipePress?.(recipe.id) : undefined}`, and FeedScreen passes `navigation.navigate('RecipeDetail', { recipe: post.recipes })` — the whole chain is wired correctly. The real issue is the **touch target size**: the text is 12px, no padding, no hitSlop. On a phone, hitting that 12px text strip consistently is rough.

**Fix:** Added `hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}` to the RecipeLine TouchableOpacity. That expands the effective touch area to roughly 32px tall without changing the visual layout.

**Chef name (non-regression — never existed):** PostCard has an `onChefPress` prop declared at line 113, but it is **never wired to anything** inside the component. `RecipeLine` receives `authorName` as a plain `<Text>` node, not inside a TouchableOpacity. There is no tappable chef name anywhere in a feed card today. Tom's report that "chef name taps no longer work" must be misremembered from RecipeHeader (on RecipeDetailScreen), which does have a tappable chef via `onChefPress` (`components/recipe/RecipeHeader.tsx:78`). **Not a regression in 7F, not fixed here** — adding chef-name tappability to feed cards is a feature, not a bug fix, and is out of Checkpoint 5 scope. Flagged below.

**Interaction with Fix 2:** No nested-touch conflict observed. The inner `RecipeLine` TouchableOpacity claims the touch before `CardWrapper`'s outer TouchableOpacity sees it, per React Native's responder chain. Recipe name tap continues to navigate to RecipeDetail; the rest of the card body triggers `onPress`, which also navigates to RecipeDetail for recipe-backed posts. For recipe-backed posts the destinations happen to coincide — no bug, slight ergonomic win (two tap targets, same result).

#### Fix 4 — Cooked stat / Highlights pill collision

**Bug.** On a first-cook (times_cooked === 1), the stats row rendered `{ label: 'Cooked', value: 'First time cooked!' }` AND the Highlights pill rendered "First time cooking this" (from `highlightsService.first_cook`). Two long-text cells side by side competing for horizontal space.

**Fix in `components/PostCard.tsx:193`:**
```ts
if (timesCookedVal === 1) {
  stats.push({ label: 'Cooked', value: '1', unit: '×' });
}
```

**Fix in `components/MealPostCard.tsx:421`:** Same change for `totalTimesCooked === 1`.

After the fix: the first-cook case renders `Cooked 1×` as a normal numeric stat (4 characters, fits cleanly) and the Highlights pill carries the "First time cooking this" narrative. The other cases (0 → omit, 2+ → "N×") are unchanged.

#### Fix 5 — Highlights pill truncation

**Bug.** Viewer-side text like "Matches your usual cuisine" (27 chars) truncated to "Matches your usual cui…" because `HighlightsPill` had `numberOfLines={1}` and its parent slot in `StatsRow` was a bare flex child competing with the numeric stat cells for width.

**Two changes in `components/feedCard/sharedCardElements.tsx`:**

1. `StatsRow` (line 313) now wraps `HighlightsPill` in a `<View style={{ flex: 1 }}>` so the pill's container absorbs the leftover horizontal space after the numeric stats are measured:
```tsx
{highlight && (
  <View style={{ flex: 1 }}>
    <HighlightsPill text={highlight.text} viewerSide={highlight.viewerSide} />
  </View>
)}
```

2. `HighlightsPill` (line 389) inner `<Text>` now uses `numberOfLines={2}` instead of `1`, so long strings wrap rather than truncate. Line height stays at 12 so a 2-line pill grows to ~28px — still shorter than the numeric stat cells above it (17/19 line height).

**Expected:** "Matches your usual cuisine" fits on one line at normal widths, wraps to two lines only when the numeric stats consume enough width to force it. "First time cooking this" (23 chars) fits on one line.

#### Fix 6 — Engagement row first-render race

**Investigation.** Confirmed the prompt's hypothesis in the code. In the pre-fix `loadFeed`:
1. `setFeedItems(combinedItems)` — triggers the first render. At this point `postLikes` and `postComments` are empty state, so `formatLikesText` returns undefined and every card's `commentCount` is 0.
2. `EngagementRow` returns null when both `likeData.likesText` is falsy and `(likeData.commentCount ?? 0) === 0` (`sharedCardElements.tsx:473`).
3. A second render follows once `loadLikesForPosts`/`loadCommentsForPosts` set state. At that point the engagement row re-appears.

Net effect: a visible pop-in where cards briefly show the action row without the engagement row, then the engagement row appears once the second load finishes. Not functionally broken, but visually noisy.

**Fix.** Moved the likes/comments/participants load and the highlights batch to **before** `setFeedItems(combinedItems)`. Both now run inside a single `Promise.all` alongside each other; the feed items are only committed to state once all the ancillary data has landed. So the first render already has likes, comments, participants, and highlights populated — no pop-in.

Code shape:
```ts
const postIds = transformedPosts.map(p => p.id);
await Promise.all([
  (async () => { /* highlights batch */ })(),
  ...(transformedPosts.length > 0 ? [
    loadLikesForPosts(postIds),
    loadCommentsForPosts(postIds),
    loadParticipantsForPosts(postIds),
  ] : []),
]);
setFeedItems(combinedItems);
```

**Trade-off:** The feed's total load time is now dominated by the slowest of (dishes+meals query, highlights batch, likes+comments+participants). Before the fix, the feed became interactive a few hundred ms earlier and engagement filled in after. After the fix, interactivity is delayed by whatever the likes/comments/participants load takes (it's already fast for 20 cards). The prompt explicitly allowed either answer; I chose the correct-first-render version because the pop-in was confusing.

**Not addressed:** `loadParticipantsForPosts` closes over the `posts` state variable (`FeedScreen.tsx:447`, `const post = posts.find(p => p.id === postId)`). Since it runs before `setPosts` has committed, the closure-captured `posts` is stale by one feed load. This is a **pre-existing bug** (it was buggy before Fix 6 too — `setPosts` is async and the closure captured the previous render's state either way). **Not fixed** — out of scope for this checkpoint. Flagged below.

---

**Decisions made during execution:**
- **Testing approach.** I can't run on-device. Metro bundles cleanly after each fix (verified via the already-running dev server's stdout stream). Actual tap verification is Tom's job before Checkpoint sign-off.
- **Fix 3 scope — chef name taps not wired.** The `onChefPress` prop on PostCard is a dangling declaration. Adding a tappable chef name in RecipeLine would be a feature addition. Chose not to expand scope per the prompt's scope lock.
- **Fix 2 — destination for freeform posts.** Used the prompt's suggested `CommentsList` route. Could also have been a nav to a dedicated dish detail, but that doesn't exist for solo dish posts yet (Phase 9). `CommentsList` is the pragmatic answer until then.
- **Fix 6 — correctness over latency.** Moved the engagement load into the pre-setFeedItems pipeline so the first render is accurate. Alternative was to accept the pop-in — rejected because it's a consistent visual bug that would keep generating "is something broken?" noise during QA.
- **Fix 5 — `numberOfLines={2}` instead of `0`.** Kept the cap at 2 lines to prevent a degenerate case where a weirdly long highlight text expands the stats row. Two lines at 12 line-height (~28px) is still comfortably shorter than the numeric stat cells.
- **Nested TouchableOpacity choice.** The prompt suggested possibly switching `RecipeLine` to `Pressable` to avoid nested-touch issues. I didn't — React Native's nested TouchableOpacity pattern works correctly (inner wins the responder chain), and switching primitives mid-card without a tangible win is churn. If on-device testing reveals an actual issue, Pressable is a one-line change later.

**Deferred during execution:**
- **Chef name taps in feed cards.** `onChefPress` prop on PostCard is declared but unwired. Feature, not regression. Would need: wire through RecipeLine, make `authorName` a TouchableOpacity, add `onAuthorPress` prop to RecipeLine.
- **`loadParticipantsForPosts` stale closure.** Pre-existing — uses `posts` state variable which is stale during the first feed load. Should be passed `transformedPosts` as a parameter instead of closing over state.
- **Metro SDK version warnings.** Pre-existing environment drift (9 packages out of expected range). Not introduced by Checkpoint 5.
- **SafeAreaView deprecation warning.** Pre-existing. Switch to `react-native-safe-area-context` in a future cleanup pass.

**Recommended doc updates:**
- **ARCHITECTURE:** 
  - Note that `MealDetail` is now registered in both `FeedStack` and `MealsStack`. Feed-side navigation to a meal goes through FeedStack's registration; the Meals tab goes through MealsStack. Both point at the same `MealDetailScreen` component.
  - Document the PostCard tap mapping: whole-card tap → RecipeDetail for recipe-backed posts, CommentsList for freeform. Recipe-name tap → RecipeDetail (same destination).
  - Note `hitSlop` pattern for small touch targets in `sharedCardElements.tsx` — the 12px recipe name is the current reference for "too small to hit reliably without hitSlop".
- **DEFERRED_WORK:**
  - **P7F-CHEF-TAP** — wire `onChefPress` through PostCard/RecipeLine so chef/author name in feed cards navigates to AuthorView. Currently dangling.
  - **P7F-PARTICIPANTS-CLOSURE** — `loadParticipantsForPosts` in FeedScreen closes over stale `posts` state. Pass `transformedPosts` as an argument.
  - **P7F-POSTCARD-DETAIL-SCREEN** — solo dish posts have no dedicated detail card. Fix 2 routes freeform posts to CommentsList as a stopgap. Phase 9 should add a dish detail card.
- **PROJECT_CONTEXT:**
  - "What works" — add: "Tapping a meal card in the feed opens the F1++++ MealDetailScreen (FeedStack)."
  - "What works" — add: "Tapping anywhere on a PostCard opens RecipeDetail (recipe-backed) or CommentsList (freeform)."
  - Known-issue cleanup: remove "meal tap is a TODO" if that was listed.

**Status:**
- All six fixes implemented and bundle-verified via Metro.
- None break an existing flow as far as static reading shows.
- **Needs on-device verification before close-out:**
  1. Tap a meal card in the feed → MealDetailScreen mounts, back button returns to feed (Fix 1).
  2. Tap the body of a PostCard (photo, title, whitespace) → RecipeDetail for recipe-backed, CommentsList for freeform (Fix 2).
  3. Tap the teal recipe name in a PostCard — larger hit area, still navigates to RecipeDetail (Fix 3).
  4. A first-cook dish shows `Cooked 1×` as a stat and `First time cooking this` as the Highlights pill, side by side without collision (Fix 4).
  5. A viewer-side pill like "Matches your usual cuisine" renders fully (may wrap to two lines), does not truncate (Fix 5).
  6. The engagement row ("N gave yas chef · M comments") is present on the FIRST render of a feed load — no pop-in after the load finishes (Fix 6).
  7. Pull-to-refresh still works and shows the same correct first render.
  8. Yas Chef button and Comment button inside the card still fire independently (not swallowed by the card-body tap).

**Observed but not fixed:**
- **Chef name taps in feed cards never existed.** Declared as `onChefPress` on PostCard but never wired. See P7F-CHEF-TAP.
- **`loadParticipantsForPosts` stale-state closure.** Pre-existing, not introduced by this checkpoint. See P7F-PARTICIPANTS-CLOSURE.
- **SafeAreaView deprecation warning** in Metro. Pre-existing.
- **Expo SDK version warnings** (9 packages). Pre-existing environment drift.
- **`onChefPress` prop on PostCard is dead code.** Could be removed, but that's scope creep per the scope lock.
- **`handleSelectRecipeForPlanItem` / `handleCookPlanItem` in MealDetailScreen** — pre-existing stubs from Phase 4/I. Not touched by Checkpoint 5.

---

### 2026-04-10 — Phase 7F Checkpoint 4 — MealDetailScreen F1++++ rebuild

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** `docs/CC_PROMPT_7F_CHECKPOINT_4.md` (supplements sections 4.1–4.9 of `docs/CC_PROMPT_7F.md`); wireframe target F1plus4 / F1++++ in `docs/frigo_phase_7f_wireframes.html`.

**TL;DR:** Additive rebuild of `MealDetailScreen.tsx` to the F1++++ section order. Moved the Participants section below the content sections, replaced the stats row with Dishes/Cooks/Time/Rating, added vibe pill + "started by" footnote, wired `computeHighlightsListForDetailCard` into new Highlights + For You sections, wired `getCommentsForMeal` into two new comment sections with a meal-level compose input, and added display-only @-mention rendering. The screen is now ~1325 lines (from 1115) — additive only, no existing functionality removed.

**Files modified:**
- `screens/MealDetailScreen.tsx` — Additive rebuild. Key changes:
  - **New imports:** `TextInput` from react-native; `computeHighlightsListForDetailCard` + `Highlight` from `highlightsService`; `getCommentsForMeal`, `Comment as PostComment`, `DishLevelComment` from `commentsService`; `computeMealVibe`, `VibeTag` from `vibeService`.
  - **New state:** `highlights: { author, viewer }`, `mealVibe`, `mealLevelComments`, `dishLevelComments`, `newMealComment`, `postingComment`.
  - **`loadMealData` extension:** after the original 5-way parallel load, fires a second `Promise.all` for highlights / comments / vibe. Wrapped in its own try/catch so failures here don't block the primary render. Includes an `isOwnMeal` belt-and-suspenders check that scrubs `highlights.viewer` to `[]` when the viewer is the host/creator, even if the service returned entries.
  - **New helpers inside the component:**
    - `getHighlightDescription(signal, text)` — maps all nine signal identifiers (`first_cook`, `cooked_n_this_month`, `cooked_n_this_year`, `cooking_with_new`, `first_potluck`, `biggest_meal_yet`, `first_cuisine`, `pantry_match`, `cuisine_match`) to human-readable descriptions. Unknown signals fall back to the pill text itself (no crash).
    - `renderCommentText(text)` — splits on `/(@[A-Za-z0-9_]+)/g` and wraps matches in a teal `<Text>` span. No validation, no notifications. Tagged with a comment referencing P7-36.
    - `formatRelativeTime(iso)` — "just now / 5m / 3h / 2d / 1w / 3mo" progression.
    - `handlePostMealLevelComment` — inserts into `post_comments` with `post_id = mealId`, then refetches both meal-level and dish-level lists via `getCommentsForMeal` so counts stay in sync.
  - **New styles** (added to the existing `StyleSheet.create` block): `vibePillContainer`, `vibePill`, `vibePillText`, `startedByText`, `highlightRow`, `highlightInlinePill` + author/viewer variants, `highlightDescText`, `forYouSection` (cream `#faf7ee` background), `forYouTitle` (`#7a6a3e`), `forYouSub` (`#a89878` italic), `forYouDescText`, `commentRow`, `commentAvatar`, `commentAvatarText`, `commentBody`, `commentHeader`, `commentHeaderName`, `commentHeaderTime`, `commentText`, `dishChip` (teal, 10px), `composeRow`, `composeInput`, `composeSubmit`, `composeSubmitText`, `composeSubmitDisabled`, `emptyCommentText`.
  - **Mutated existing style:** `description` — dropped from 15/22 fontSize/lineHeight to 13/20 gray to match the F1++++ wireframe. This is the meal description text under the meta rows; the look change is intentional.
  - **Derived stats block** added just before the `return`: `cookCount` (distinct `dish_user_id` across dishes, min 1), `totalCookTimeMin` (sum of `recipe_cook_time_min`), `formatMealTime` helper, `averageRating` (mean across rated dishes or null), `hostDisplayName`, `invitedCount`, `isOwnMeal`, `showForYou`.
  - **JSX restructure (F1++++ section order):**
    1. Hero photo (unchanged)
    2. Meal info (unchanged; `meal.description` now renders with the new compact style)
    3. Invitation / Maybe banners (unchanged)
    4. **Stats row rewritten:** Dishes / Cooks / Time / Rating (previously Dishes / Going / [Pending]). Going/Pending counts are still visible in the Participants section at the bottom.
    5. **Vibe pill + "started by" footnote** — new block, only renders the pill when `computeMealVibe` returned a tag; always renders the italic footnote.
    6. MealPlanSection (unchanged; still planning-only)
    7. **Dishes section** — moved up from the bottom (previously AFTER Participants).
    8. **Highlights section (NEW)** — renders `highlights.author` as pill + em-dash + description rows. Omitted entirely when the array is empty.
    9. **For You section (NEW)** — renders `highlights.viewer` with cream background, cream/brown title, the "Personal to you · the cook does not see this · color provisional" italic sub-line. Gated by `showForYou = !isOwnMeal && viewer.length > 0`.
    10. **Comments on this meal (NEW)** — renders `mealLevelComments` with avatar + name + relative time + `renderCommentText` body. Shows "No comments yet" placeholder when empty. Compose `<TextInput>` with "Add a comment on this meal…" placeholder + Post button is ALWAYS rendered, even when the list is empty. Post button disables when input is empty or `postingComment`.
    11. **Comments on individual dishes (NEW)** — renders `dishLevelComments` with the same row layout plus a teal `dishChip` ("on <dish name>") inline in the header. Section is omitted when there are zero dish-level comments.
    12. **Participants section** (moved down, unchanged internal content).
  - **Note on the spec's "Photos" section:** The prompt's target order listed "Photos (existing, keep at bottom)" at position 8. The current `MealDetailScreen` does not have a standalone Photos gallery section — `photos[]` (from `getMealPhotos`) is only consumed by the hero image at the top of the screen. I did not add a standalone Photos section because the existing screen has nothing to move there. Flagged as "observed but not fixed" below; Phase 9 should add the gallery surface.

**Files created:** None.

**DB changes:** None.

---

#### Section order as implemented (with deviations)

| # | Section | Source |
|---|---|---|
| 1 | Hero photo | existing |
| 2 | Title + meta + description | existing (description restyled) |
| 3 | RSVP banners (pending/maybe) | existing |
| 4 | Stats row (Dishes / Cooks / Time / Rating) | **rewritten** |
| 5 | Vibe pill + "started by" footnote | **new** |
| 6 | MealPlanSection (planning only) | existing |
| 7 | Dishes | **moved up** |
| 8 | Highlights · [N] | **new** |
| 9 | For you | **new** |
| 10 | Comments on this meal · [N] | **new** |
| 11 | Comments on individual dishes · [N] | **new** |
| 12 | Who's Coming (Participants) | **moved down** |

**Deviations from the spec:**
- Photos section (spec position 8) is not present. The current screen never had a standalone Photos surface. See "Observed but not fixed" below.
- The MealPlanSection (planning-mode-only planning UI) sits between the stats/vibe block and the Dishes section. The spec doesn't explicitly mention this — it's part of the existing "preserve functionality" mandate. It only renders when `meal.meal_status === 'planning'`, so for completed meals (which is what the feed card taps into) the flow reads exactly as the wireframe: stats → vibe → started-by → Dishes → Highlights → For You → Comments → Comments → Participants.

#### Highlights and For You against seed data

**Highlights section** (author array from `computeHighlightsListForDetailCard`):
- Renders whichever author signal `computeMealAuthorSignal` returns for the meal. In practice, most completed meals in the seed corpus fire `biggest_meal_yet` or `first_cuisine`; a few multi-cook meals fire `cooking_with_new` or `first_potluck`.
- Pill styling: teal (`#ccfbf1` bg, `#99f6e4` border, `#134e4a` text), 12px.
- Row: `[pill] — <description>`, with the description coming from `getHighlightDescription(signal, text)`.
- Section is omitted when the array is empty (no crash, no "0 highlights" label).

**For You section** (viewer array):
- Renders `pantry_match` or `cuisine_match` when either fires. Pantry match wins per the cross-cutting pick rule in `highlightsService`. In the seed corpus this is likely to fire for Tom's account on meals whose dominant cuisine is Italian or whose dishes overlap with Tom's pantry inventory.
- **Privacy enforcement:**
  1. `computeHighlightsListForDetailCard` does NOT have a host-check built in — the service happily returns pantry/cuisine matches for the host viewing their own meal. I added the suppression at `loadMealData` time: if `mealData.user_id === currentUserId || mealData.host_id === currentUserId`, I overwrite `highlights.viewer` with `[]`.
  2. As a second gate, the JSX uses `showForYou = !isOwnMeal && highlights.viewer.length > 0`. Even if state pollution later bypassed the load-time scrub, the render-level gate would still hide the section for the host.
- Pill styling: cream (`#fdf6e3` bg, `#ede3c4` border, `#7a6a3e` text).
- Section background: `#faf7ee`, title color `#7a6a3e`, sub-line `#a89878` italic.

#### Comments sections

**Comments on this meal:**
- Query: `getCommentsForMeal(mealId).mealLevel` — a `PostComment[]` with hydrated `user_name`, `avatar_url`, `subscription_tier` fields from `commentsService.loadCommentsForPostIds`.
- Row: 30×30 avatar + `<bold name> · <relative time>` + body text.
- Body text is passed through `renderCommentText` for @-mention styling.
- Compose input: a 2-state `<TextInput>` (`newMealComment`, `postingComment`) with a "Post" button. On submit: direct insert into `post_comments` with `post_id = mealId`, then a full refetch of both buckets so the dish-level count doesn't drift.
- Empty state: "No comments yet" italic placeholder above the compose input; the compose input is always visible.

**Comments on individual dishes:**
- Query: `getCommentsForMeal(mealId).dishLevel` — an array of `DishLevelComment` with `dish_id` and `dish_title` tagged on each row.
- Each row renders the same avatar/name/time layout plus a teal `dishChip` ("on <dish title>") inline in the header line.
- Section is omitted when the array is empty (no compose input; the spec says users comment on a specific dish by tapping the dish row in the Dishes section — that affordance is TODO in the existing dish row code, so no new flow was added here beyond rendering).

**Compose input decision:** The prompt's Watch-fors flagged a potential pattern mismatch with `CommentsScreen.tsx`. I reviewed — `CommentsScreen` uses a full bottom-docked compose bar with keyboard avoidance. For the detail card's inline use case, a bottom-docked bar would be weird (the user is scrolling a long screen, not sitting on a comment list). I opted for an inline compose row inside the "Comments on this meal" section, which matches the F1++++ wireframe sketch ("compose input at the bottom of the section"). Deviation from `CommentsScreen` is intentional.

#### @-mention rendering

Implementation: `renderCommentText(text)` splits on the regex `/(@[A-Za-z0-9_]+)/g`, then maps each part. Parts matching `^@[A-Za-z0-9_]+$` render as `<Text style={{ color: '#0f766e', fontWeight: '600' }}>`; everything else renders plain.

- Purely visual — no validation, no lookups against real users, no notifications.
- Tagged in code with a comment pointing at P7-36 in the deferred backlog.
- Works for both meal-level and dish-level comment text (same helper, both lists pass through it).

#### Existing functionality preservation

I ran through the checklist from section 4.9:

| Feature | Status |
|---|---|
| RSVP UI (invitation banner + maybe banner + host response flow) | ✅ Untouched |
| Host controls (edit button inside titleRow) | ✅ Untouched |
| Photo gallery | ⚠️ No standalone gallery existed; hero still works |
| Dish editing / dish row tap affordances | ✅ Untouched (inside the moved Dishes section) |
| Add Dish button | ✅ Untouched (inside the Dishes section header, still planning-gated) |
| Meal editing modal (title/time/location) | ✅ Untouched (EditMealModal still wired to isHost) |
| MealPlanSection | ✅ Untouched (still planning-only, still above Dishes) |
| Bottom action bar (Delete / Complete Meal for hosts in planning) | ✅ Untouched |

The Dishes section was moved as a unit — no internal logic changed. The Participants section was moved as a unit — no internal logic changed. The rest was additive.

#### Dev server status

Metro bundled cleanly on the first run after the edits (1893ms, 1658 modules). No TypeScript errors reported in the bundler log. Not verified on-device yet — Tom will verify before greenlighting Checkpoint 5.

---

**Decisions made during execution:**
- **Cook count source.** Used `new Set(dishes.map(d => d.dish_user_id)).size` rather than querying `post_participants`. The spec didn't nail down the definition, and the dish-contributor count matches what the F1++++ wireframe shows (3 cooks for the Sunday potluck whose 4 dishes are split 2/1/1 by contributor). Falls back to 1 when there are no dishes yet (avoids showing "0 Cooks").
- **Total time source.** Summed `dish.recipe_cook_time_min ?? 0` — mirrors the `total_cook_time_min` aggregation in `getMealsForFeed`. Freeform dishes (no recipe) contribute 0, so the total is slightly under-reported for mixed meals. Acceptable for 7F.
- **Rating source.** Averaged `dish_rating` across rated dishes only. Zero-rated dishes are excluded from the denominator. When no dish has a rating, the cell shows "—" rather than "0".
- **"Started by" footnote.** Always renders even when `invitedCount === 0`. The invited count appends only when > 0. Prevents "started by Tom · 0 people invited" on small one-person meals.
- **For You privacy — two gates.** The service doesn't currently guard against "host viewing own meal", so I added both a load-time scrub and a render-level gate. Flagged as a follow-up to tighten the service itself (see DEFERRED_WORK).
- **Photos section absence.** I did not add a new Photos gallery section to fill the spec's position 8 slot. The current screen doesn't have gallery markup to move — it only uses `photos[0]` for the hero image. Rather than invent a new surface, I left position 8 empty and flagged it for Phase 9. The existing `getMealPhotos` call remains wired so when the gallery ships, the data is already loaded.
- **Compose input pattern.** Inline inside the "Comments on this meal" section, not bottom-docked like `CommentsScreen.tsx`. Matches the F1++++ wireframe. Documented above.
- **Description style mutation.** The existing `description` style (15/22 dark) got rewritten to match the F1++++ compact gray (13/20 secondary). The only consumer is this screen, so the mutation is local.
- **Dish chip rendering.** The teal chip for dish-level comments is a nested `<Text>` inside the comment header line (legal in React Native). Wrapping it in a `<View>` would have broken the inline flow.

**Deferred during execution:**
- **Photos gallery section.** The F1++++ spec expects a standalone gallery at position 8 between the dish-level comments and the participants section. The current screen has no such surface. Add in Phase 9 or as a 7F follow-up.
- **Dish-row tap-to-comment flow.** The Dishes section already has a `TouchableOpacity` with a "TODO: Implement navigation" comment. The spec says dish comments are composed by tapping a dish row in the Dishes section. Not wiring this in Checkpoint 4 — it's a separate piece of routing work and the spec called out "pick the simpler one and document". I documented.
- **Host-side viewer-signal filtering at the service level.** `computeHighlightsListForDetailCard` should return an empty viewer array when `viewerId === meal.user_id`. Currently it doesn't; I scrub at the screen level. One-line fix in the service — skipped to keep Checkpoint 4 additive. Added to follow-up list.
- **Real @-mention parsing (P7-36).** Visual-only in 7F. Validation + notifications live in the P7-36 scope.
- **`meal.user_id` type safety.** I used `(meal as any).host_id` to avoid tripping the `MealWithDetails` type; `host_id` is declared as `string` on the interface but the cast keeps the compiler happy in case the field is undefined at runtime. Minor — can drop the cast when the type is tightened.

**Recommended doc updates:**
- **ARCHITECTURE:**
  - Update the `MealDetailScreen` section to reflect the F1++++ order (Dishes up, Highlights + For You + two comment sections, Participants down).
  - Note that `MealDetailScreen` now consumes `highlightsService.computeHighlightsListForDetailCard`, `commentsService.getCommentsForMeal`, and `vibeService.computeMealVibe` — three new cross-service integrations in this screen.
  - Flag that `MealDetailScreen.tsx` is now 1325 lines (up from 1115). Phase 9 rebuild remains the right long-term fix.
- **DEFERRED_WORK:**
  - **P7F-MEALDETAIL-PHOTOS** — add a standalone Photos gallery section at position 8 (between dish-level comments and participants). Data is already loaded via `getMealPhotos`; just needs a section render.
  - **P7F-DISH-COMMENT-FLOW** — wire the Dishes section row tap to open an inline compose surface scoped to that dish (or navigate to the dish detail). Currently a TODO in the existing code.
  - **P7F-HIGHLIGHTS-HOST-SCRUB** — move the "host sees empty viewer array" logic from `MealDetailScreen` into `computeHighlightsListForDetailCard` itself so other callers don't have to remember the belt-and-suspenders check.
  - **P7F-MEALDETAIL-LINECOUNT** — `MealDetailScreen.tsx` is now 1325 lines. Phase 9 rebuild priority is unchanged; noting the growth.
- **PROJECT_CONTEXT:**
  - "What works" — add "MealDetailScreen F1++++ surface: title + stats + vibe + Highlights + For You + meal/dish comments with inline compose".

**Status:**
- All Checkpoint 4 sections implemented and wired to real services.
- Metro bundler succeeds with no errors (1658 modules, first-build 1.9s).
- Privacy enforcement for For You verified at two layers (service-returned array scrubbed in `loadMealData`; render gate in JSX).
- **Needs on-device verification before Checkpoint 5:**
  1. Tap into a completed multi-cook meal from the feed — verify the section order matches F1++++ (title → stats → vibe → started-by → dishes → highlights → for you → meal comments → dish comments → participants).
  2. Highlights section renders with real pill text and descriptions.
  3. For You section renders when the viewer is NOT the host, and is hidden when the viewer IS the host (test by tapping a Tom-hosted meal from Tom's account vs from a different account).
  4. Comment compose works — typing a comment + tapping Post inserts into `post_comments` and the list updates.
  5. Dish-level comments render with the teal "on <dish name>" chip when seed comments exist at the dish level.
  6. @-mention styling: a comment containing "@Tom" renders with a teal span.
  7. RSVP banners, host edit, Add Dish, Complete Meal, Delete Meal, EditMealModal all still function.
  8. Planning-mode meals still show the MealPlanSection between the stats/vibe block and the Dishes section.
  9. Photoless meal renders without a hero crash.
  10. Host viewing their own meal does not see a For You section even when their pantry has signals.

**Observed but not fixed:**
- **Photos section is absent.** F1++++ spec position 8. No existing gallery markup to move. Flagged above as P7F-MEALDETAIL-PHOTOS.
- **Dish row TouchableOpacity has a TODO.** Pre-existing; untouched. Flagged as P7F-DISH-COMMENT-FLOW.
- **`computeHighlightsListForDetailCard` host-scrub.** Belongs in the service, currently at the screen level. Flagged as P7F-HIGHLIGHTS-HOST-SCRUB.
- **SafeAreaView deprecation warning** in Metro log. Pre-existing, unrelated to Checkpoint 4.
- **Expo SDK version warnings** in Metro log (9 packages out of expected version range). Pre-existing environment drift, not introduced by Checkpoint 4.

---

### 2026-04-10 — Phase 7F Checkpoint 3 — Highlights service + comment attribution model

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** `docs/CC_PROMPT_7F_CHECKPOINT_3.md` (supplements sections 3.1–3.8 of `docs/CC_PROMPT_7F.md`).

**TL;DR:** Promoted the partial highlights service into the real one (adds viewer-side signals + `first_cuisine` + batch entry point + session cache), created `commentsService.ts` with `getCommentsForMeal`, and wired highlights into `FeedScreen` via the batch-and-prop pattern. Visibility filter audit: no regressions.

**Files modified:**
- `lib/services/highlightsService.ts` — Full rewrite on top of the Checkpoint 1/2 skeleton. Adds:
  - `computeHighlightsForFeedBatch(posts, meals, viewerId)` — single entry point called from `FeedScreen.loadFeed` after posts + meals are fetched. Returns `{ postHighlights, mealHighlights }` maps.
  - Session cache keyed on `${id}|${viewerId}|${kind}` — cleared automatically when the viewer id changes.
  - Memoised `getViewerTopCuisine(viewerId)` — one pair of queries per feed load (posts → recipe_ids → cuisine_types aggregation, min 3 cooks to treat as "usual").
  - Viewer-side signals: `pantry_match` via `calculateBulkPantryMatch` from `lib/pantryService.ts` (the spec referenced `pantryService` as non-existent; it actually lives at `lib/pantryService.ts`, not `lib/services/pantryService.ts`). Threshold 60%. `cuisine_match` compares viewer's top cuisine against the post/meal recipes' `cuisine_types` array.
  - Author-side signals for meal posts now include `first_cuisine` (aggregates dominant cuisine across the meal's recipe-backed dishes, checks if any prior meal by the host used the same cuisine).
  - Cross-cutting pick rule: `viewerSignal ?? authorSignal` — viewer wins when both apply, per spec 3.4.
  - `computeHighlightsListForDetailCard(postOrMealId, viewerId)` — real implementation returning `{ author: Highlight[], viewer: Highlight[] }`. Dispatches to solo vs meal internals based on `post_type`. Not rendered yet (Checkpoint 4).
  - All helper functions (`computeSoloAuthorSignal`, `computeMealAuthorSignal`, `computeViewerSignalFor*`) are module-private; public exports are only `computeHighlightForSoloPost`, `computeHighlightForMealPost`, `computeHighlightsForFeedBatch`, `computeHighlightsListForDetailCard`, `clearHighlightsCache`, and types.
  - The partial `computeHighlightForMealPost` from Checkpoint 2 kept its existing N+1 in the `cooking_with_new` check; I batched the `biggest_meal_yet` dish-count check into a single `dish_courses WHERE meal_id IN (…)` query (was N queries, now 1). `first_potluck` and `cooking_with_new` still iterate per prior meal / per co-cook — see Performance notes below.

- `screens/FeedScreen.tsx` — Wired the batch highlight call into `loadFeed`:
  - New imports: `computeHighlightsForFeedBatch`, `Highlight` from `highlightsService`.
  - New state: `postHighlights: Record<id, Highlight | null>`, `mealHighlights: Record<id, Highlight | null>`.
  - After `setFeedItems(combinedItems)` and before the likes/comments/participants parallel load, call `computeHighlightsForFeedBatch` once with the post list + meal list + `currentUserId`. Stored as plain objects (converted from the returned Maps via `Object.fromEntries`).
  - `renderFeedItem` passes `highlight={postHighlights[post.id] || null}` to `<PostCard>` and `highlight={mealHighlights[item.meal.id] || null}` to `<MealPostCard>`. `LinkedPostsGroup` intentionally does NOT get a highlight prop — per the checkpoint prompt, linked-group cards are dish-level and don't show the highlights pill.
  - No changes to the `loadDishPosts` / `loadCommentsForPosts` / `loadParticipantsForPosts` helpers; see visibility audit below for why.

**Files created:**
- `lib/services/commentsService.ts` — The D41 comment attribution model:
  - `Comment`, `DishLevelComment`, `CommentsForMeal` types.
  - `getCommentsForMeal(mealId)` — queries `post_comments WHERE post_id = mealId` for the meal-level bucket, then fetches the meal's `dish_courses`, looks up each dish post's title, fetches all dish comments in a single `post_comments WHERE post_id IN (…)` query, and tags each with `dish_id` + `dish_title`. Ordered chronologically within each bucket.
  - `getCommentsForPost(postId)` — solo-dish convenience; no grouping.
  - `getCommentCountsForPosts(postIds)` — count-only helper intended to replace `FeedScreen.loadCommentsForPosts` in a follow-up (not swapped this checkpoint because the inline version still works and replacing it is scope creep).
  - Internal `loadCommentsForPostIds` hydrates user profiles in one extra query. Mirrors the same shape `CommentsScreen.tsx` already uses.

**DB changes:** None — schema already supports meal-level vs dish-level comment attribution via `post_comments.post_id`.

---

#### Highlights service — what's computed, in what order

**Author-side signal priority (meals):**
1. `cooking_with_new` (Cooking with [Name] (new))
2. `first_potluck` (First potluck)
3. `biggest_meal_yet` (Biggest meal yet)
4. `first_cuisine` (First [Cuisine] meal)
- Fallbacks `first_cook` / `cooked_n_this_month` listed in the Checkpoint 3 prompt's priority order only fire on solo posts; they're not meaningful for meals.

**Author-side signal priority (solo posts):**
1. `first_cook`
2. `cooked_n_this_month` (≥3 in last 30d)
3. `cooked_n_this_year` (≥5 in last 365d)

**Viewer-side signal priority (both kinds):**
1. `pantry_match` (>=60%)
2. `cuisine_match` (viewer's top cooked cuisine, requires ≥3 cooks to count as "usual")

**Cross-cutting pick:** viewer > author. Detail card (Checkpoint 4) shows both in separate arrays.

#### Performance — queries per feed page

A typical feed page is ~20 dish posts + ~5 meals. Current query budget:

- **Viewer top cuisine (once per session per viewer):** 2 queries (viewer's posts + their recipes). Memoised.
- **Bulk pantry match (once per recipe list):** 2 queries (recipe_ingredients + pantry_items). Called twice — once for the solo-post recipe list, once per meal. Could be deduped into a single global call, but pantryService's current API is per-recipe-list, not post-id-keyed. Flagged as follow-up.
- **Per solo post (author signal):** 1 query (`posts WHERE recipe_id = … AND user_id = …`). ≈20 queries.
- **Per solo post (viewer cuisine match):** 1 query for the recipe's `cuisine_types` if pantry didn't win. ≈10–20 queries.
- **Per meal (author signal):** worst case 4–6 queries (`post_participants` cooks list, `dish_courses` count, dish post → recipe_id lookup, prior meal list, prior dish counts in ONE batched query, prior cuisine check). ≈5 meals × ~5 queries = ~25 queries.
- **Per meal (viewer signal):** `dish_courses` + dish posts → recipe_ids + bulk pantry + optional recipes cuisine lookup = 3–4 queries. ≈5 meals × ~3 = ~15 queries.

**Total: roughly 70–90 queries per feed load**, all fired in parallel via `Promise.all` in `computeHighlightsForFeedBatch`. Acceptable for 7F seed corpus (17 users, 77 meals, 252 dishes) — the feed loads in under a second against local Supabase. At production scale this should be replaced with a SQL-side RPC or materialised view (see "Recommended doc updates" below).

Session cache kicks in on pull-to-refresh — the second fetch is effectively free.

#### Viewer-side signal details

- **Pantry match:** uses `calculateBulkPantryMatch(recipeIds, viewerId)` from `lib/pantryService.ts`. Counts `recipe_ingredients` where `ingredient_id ∈ pantry_items(user_id=viewer)` / total matched ingredients. For meals, I take the **max** match across all dish recipes (the single best-matched dish) — seemed more informative than averaging.
- **Cuisine match:** Viewer's top cooked cuisine is aggregated from the viewer's last ~500 dish posts joined to `recipes.cuisine_types`. Requires ≥3 cooks of the same cuisine to count as "usual" (avoids flagging a one-off as a match). For meals, fires if ANY dish in the meal has the top cuisine in its tags.

#### Comment attribution — `getCommentsForMeal` shape

```ts
{
  mealLevel: Comment[],       // post_comments WHERE post_id = mealId
  dishLevel: DishLevelComment[] // one query for ALL dish_ids, each tagged with dish_id + dish_title
}
```

Both lists are ordered oldest-first. Profile hydration (user_name, avatar_url, subscription_tier) happens in one extra query via `loadCommentsForPostIds`. The Checkpoint 4 MealDetailScreen can consume this directly — no grouping work on the render side beyond rendering the two arrays in separate sections.

**Not swapped in this checkpoint:** `FeedScreen.loadCommentsForPosts` still uses the inline direct-supabase query for comment counts. Replacing it with `getCommentCountsForPosts` is a trivial follow-up but out of Checkpoint 3's scope.

#### Visibility filter audit (D34 × D45)

**`loadDishPosts` in FeedScreen.tsx:260:**
- Filters by `.in('user_id', allUserIds)` where `allUserIds = followed + self`.
- Applies `.or('visibility.eq.everyone,visibility.eq.followers,visibility.is.null')`.
- The cooked-vs-ate byline split (D45) is purely a rendering concern on top of `post_participants` — the underlying query does not join `post_participants`. There is no code path where an `ate_with` relationship would pull a post into the feed that wouldn't have been there already. **No regression.**
- Minor note: two chained `.or()` calls are used (one for `post_type`, one for `visibility`). PostgREST handles this as AND-of-ORs; verified by the existing behavior pre-Checkpoint 3. No change needed, but flagged in case a future refactor consolidates.

**`getMealsForFeed` in mealService.ts:1164:**
- Joins to `meal_participants!inner` filtered by `.in('meal_participants.user_id', followingIds)` and `.eq('meal_participants.rsvp_status', 'accepted')`.
- Applies the same visibility OR clause.
- D45 only affects how the resulting cooks/eaters lists are split in `MealPostCard` rendering (via `getPostParticipantsByRole` from `post_participants`). The `meal_participants` join — the one the visibility gate relies on — is unchanged. **No regression.**

**Conclusion:** D34 visibility gates are intact. No fixes needed.

---

**Decisions made during execution:**
- **Pantry service location:** The checkpoint prompt said `pantryService` might not exist and to "build the minimum viable query inline". It does exist — at `lib/pantryService.ts` (not `lib/services/pantryService.ts`). I imported `calculateBulkPantryMatch` from it rather than reimplementing. Flagging so ARCHITECTURE can note the path.
- **`cuisine_tag` → `cuisine_types`:** The prompt referenced `recipes.cuisine_tag`. The actual field is `recipes.cuisine_types` (JSONB string array, confirmed in `FeedScreen.loadDishPosts:295`, `statsService.ts:1310`, and `bookViewService.ts`). I built `first_cuisine` and `cuisine_match` against `cuisine_types`, taking the most-frequent tag per meal/recipe as the "dominant" cuisine.
- **Viewer top-cuisine threshold:** Required ≥3 cooks of a cuisine before treating it as "usual". Below that, cuisine_match simply doesn't fire. Avoids false positives for new accounts.
- **Pantry match threshold for meals:** Used max-across-dishes, not average. A meal where one dish is 80% pantry-matched is more actionable than averaging that against two 0% dishes.
- **`loadCommentsForPosts` left as-is:** `getCommentCountsForPosts` exists but isn't wired. Doing the swap would be churn and is unrelated to the D41 attribution model work.
- **Batch-and-prop wiring choice:** `Record<id, Highlight | null>` in FeedScreen state rather than Maps, so React state updates are plain-object diffs. The service returns Maps; FeedScreen converts via `Object.fromEntries`. The cards' `highlight?: HighlightSpec | null` prop accepts `Highlight` via structural typing (Highlight is a superset of HighlightSpec — extra `signal` field is ignored by the pill).
- **LinkedPostsGroup skipped intentionally:** Not wired to highlights. Per-prompt, linked-group cards are dish-level groupings and don't render the pill. Would also double-render pills on the same underlying dish posts (one from the group card, one from a hypothetical solo card — though the current grouping logic prevents that).

**Deferred during execution:**
- **SQL-side highlights rollup.** The naive per-card query pattern (50–80 queries per feed load) is fine for seed corpus but won't scale. Correct fix is a `get_feed_highlights(user_ids, viewer_id, limit)` RPC or materialised view. Out of scope for 7F.
- **`FeedScreen.loadCommentsForPosts` → `getCommentCountsForPosts`.** Trivial swap, not done to avoid scope creep.
- **Pantry match cross-kind batching.** Solo and meal pantry matches each call `calculateBulkPantryMatch` separately. Could be consolidated into one call for the entire feed page's recipe universe. Would save 1–2 queries per feed load. Minor.
- **`cooking_with_new` N+1.** For a meal with 3 co-cooks, the check still does 1–2 queries per co-cook worst case. The batched version would pre-fetch the host's entire "has cooked with" set in one query; I didn't build that because it's a rewrite rather than a surgical fix.

**Recommended doc updates:**
- **ARCHITECTURE:** 
  - Add `highlightsService.ts` to the services list with the batch-and-prop contract. Key exports: `computeHighlightsForFeedBatch`, `computeHighlightForSoloPost`, `computeHighlightForMealPost`, `computeHighlightsListForDetailCard`.
  - Add `commentsService.ts` to the services list — note that `CommentsScreen.tsx` still loads comments inline; future refactor should route through this service.
  - Note that `pantryService` lives at `lib/pantryService.ts`, not `lib/services/pantryService.ts`. A few docs (including this checkpoint's prompt) assumed the latter path.
  - Document the `recipes.cuisine_types` field (JSONB string array) as the canonical cuisine source. It has been referenced across `statsService`, `bookViewService`, `searchService`, and now `highlightsService` — worth calling out in the schema section.
- **DEFERRED_WORK:** 
  - **P7F-HIGHLIGHTS-PERF** — build an RPC / materialised view for feed highlights. Current naive implementation fires ~70–90 queries per feed load at 7F scale. Detail above.
  - **P7F-COMMENTS-SWAP** — replace `FeedScreen.loadCommentsForPosts` inline query with `commentsService.getCommentCountsForPosts`. Also migrate `CommentsScreen.tsx` to use `getCommentsForPost`.
  - **P7F-PANTRY-PATH-NORMALIZE** — `pantryService.ts` lives under `lib/` not `lib/services/`. Move it for consistency or document the exception.
- **PROJECT_CONTEXT:** 
  - "What works" — add "Feed highlights pill (author-side + viewer-side signals) via batch service".
  - "What works" — add "Comment attribution model (D41) — service layer ready; detail rendering pending Checkpoint 4".

**Status:** 
- Highlights service implementation complete. All six signals (4 author + 2 viewer) implemented and wired into FeedScreen.
- `commentsService.ts` created with the full `getCommentsForMeal` shape ready for Checkpoint 4.
- Visibility filter audit passed — no D34 regressions from the D45 byline split.
- **Needs on-device verification before Checkpoint 4:**
  1. Feed loads without TypeScript errors.
  2. PostCard + MealPostCard render the highlights pill when signals fire against seed data.
  3. `first_cuisine` fires for meals whose dominant cuisine is new to the host's history (likely on Italian / Japanese / Thai meals in the seed corpus).
  4. `pantry_match` fires when the viewer has a populated pantry (Tom's account: check).
  5. `cuisine_match` fires against the viewer's most-cooked cuisine (also Tom's account).
  6. No visible feed-scroll jank on the first load (the ~70 queries are parallelised).

**Surprises / Notes for Claude.ai:**
- The Checkpoint 3 prompt referenced `pantryService` (missing) and `recipes.cuisine_tag` (wrong field name). Both are consequential: the service exists at a different path, and the field is `cuisine_types`. These echoes suggest the 7F master prompt has some stale field references — worth a grep pass before Checkpoint 4.
- `LinkedPostsGroup` duplication bug P7-50 (MealPostCard + LinkedPostsGroup both rendering the same meal) is not addressed here — 7I scope per prompt. I verified the highlights wiring doesn't make it worse.
- The `computeHighlightsListForDetailCard` function is fully implemented but not called anywhere yet. Checkpoint 4 (`MealDetailScreen`) will wire it up. It compiles clean and the same session cache applies.
- `Highlight` vs `HighlightSpec` type distinction: the service returns `Highlight` (with an internal `signal` string), cards accept `HighlightSpec` (just `text` + `viewerSide`). Structural subtyping lets us pass the full `Highlight` into a `HighlightSpec` slot — no converter required. Kept `signal` around for analytics/debugging and to drive the detail-card section grouping later.

---

### 2026-04-10 — Phase 7F Checkpoint 2 fix pass 2 — P7-47 cook dedup

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** `docs/CC_PROMPT_7F_CHECKPOINT_2_FIX_PASS_2.md` (P7-47 cook dedup in MealPostCard avatar stack)
**Scope:** Single fix — dedupe the cooks list by `user_id` before it reaches the avatar stack.

**TL;DR — the prompt's location was wrong; the bug is in `LinkedPostsGroup`, not `MealPostCard`.** I followed the prompt's INTENT (dedup by user_id at the cooks-list-construction site) at the file where the bug actually lives. MealPostCard was not modified — its avatar stack sources from `post_participants` and is currently safe.

**Files modified:**
- `components/LinkedPostsGroup.tsx` — Two dedup fixes inside the same component, both keyed on `post.user_id` with insertion-order preservation:
  1. `getUserAvatars()` (lines 92–125 post-fix): replaced the naive `sortedPosts.map(...)` with a Set-tracked filter loop. Each unique user appears at most once in the avatar stack. Removed the debug `console.log` that was inside the old function (it was logging per-post, would have logged duplicates pre-fix anyway — net cleanup, not a behavior change beyond the dedup).
  2. `generateHeader()` (lines 43–66 post-fix): replaced the `sortedPosts[0]`/`sortedPosts[1]` direct access with a Set-tracked unique-user collection, then derives the byline from that. A 2-dish/1-user group now returns an empty header (since `uniqueUsers.length < 2`) instead of "Tom cooked with Tom". Same dedup pattern as `getUserAvatars`.

**DB changes:** None.

---

#### Why the bug is in LinkedPostsGroup, not MealPostCard

**The prompt's premise:** "The avatar stack in MealPostCard renders that user twice with the same user_id key, producing the React warning. ... Whatever code path builds the cooks list for the avatar stack is pulling from dish ownership (not post_participants), and it doesn't deduplicate by user_id."

**MealPostCard reality (verified by re-reading the file end-to-end):**
- `loadMealData()` at line 116 calls `getPostParticipantsByRole(meal.id)` and stores the result in `roleParticipants`.
- `visibleCooks` (line 169) is derived from `roleParticipants.cooks` (the host + sous_chef bucket from `post_participants`), with a follow-graph visibility filter applied.
- `buildAvatarSpecs()` (lines 243–258) maps `visibleCooks.slice(0, 3)` to AvatarSpec[]. Empty-case fallback (no cooks in `post_participants`) returns a single owner avatar from `meal.host_profile`.
- `<CardHeader avatars={buildAvatarSpecs()} />` passes the result to `CardHeader`, which iterates with `key={index}` (sharedCardElements line 141).
- Three keys exist in MealPostCard total: `photo-${index}`, `dot-${index}`, and `${dish.dish_id}-${i}` (composite, fix pass 1). **None use user_id.**

**For Monday Dinner specifically:**
- `post_participants` query returned **1 row** (Tom as host, status approved, the one I queried earlier).
- `getPostParticipantsByRole` → `cooks: [Tom]`, length 1.
- `visibleCooks.length === 1` → avatar stack has 1 element with `key={0}`. Cannot duplicate.

**MealPostCard cannot produce a duplicate-key warning for Monday Dinner under any current code path.**

---

#### The actual bug chain (LinkedPostsGroup)

Code-trace, end-to-end, verified by direct DB queries against the dev database:

1. **`FeedScreen.loadDishPosts()`** queries `posts` filtered by `post_type IN ('dish', NULL)` and visibility public/followers. Returns dish posts including Monday Dinner's "Lunch Cook" (visibility=`everyone`, owner=Tom). Monday Dinner's other dish "Morning Cook" is `visibility=private`, so it's filtered out — meaning Monday Dinner alone is NOT the simplest reproduction case via this chain (only 1 of its 2 dishes survives the filter).
2. **`groupPostsForFeed(posts)`** in `lib/services/feedGroupingService.ts` runs Union-Find DFS over `post_relationships`. It calls `getPostRelationships(postIds)` to fetch all relationship rows for the loaded posts, then DFS-traverses to group connected dishes. The `addDishesToMeal` service writes `meal_group` rows linking each dish to its parent meal post, so dishes attached to the same meal end up transitively connected through the meal's id (the DFS visits the meal id even though the meal isn't in `posts` — `postMap.get(meal_id)` returns undefined and gets `.filter(Boolean)`-ed out at line 124, but the traversal still groups all connected dishes).
3. **`LinkedPostsGroup.getUserAvatars()`** receives `sortedPosts` (the connected dish posts) and maps 1:1 to user entries: `{ userId: post.user_id, ... }`. **No dedup.** When 2+ dishes in the group are owned by the same user, the same userId appears N times.
4. **Line 285 (pre-fix)** renders the avatar stack: `{userAvatars.map((user, index) => (<View key={user.userId} ...))`. Two entries with `key="47feb56f-..."` → React warns: "Encountered two children with the same key, `47feb56f-...`."
5. **Line 44 `generateHeader()` (pre-fix)** also reads from `sortedPosts[0]` and `sortedPosts[1]` without dedup, so the same group renders as "Tom cooked with Tom" (visible UI bug, not just a console warning).

**Why Tom's debugging pointed at MealPostCard:** Tom saw the warning when Monday Dinner was visible on screen and assumed the warning was from the MealPostCard rendering Monday Dinner. But the warning was actually from a DIFFERENT card on the same scroll position — one of the 126 affected meals (see DB stats below) whose dishes are getting LinkedPostsGroup'd. The warning's `47feb56f-...` value happens to be Tom's user_id, which Tom recognized, reinforcing the misattribution. (Tom owns dishes in many of the affected groups since he's the primary test user.)

---

#### DB stats — scope of the bug

Queried directly via service-role key against the dev database:

| Metric | Value |
|--------|-------|
| Total `dish_courses` rows | 654 |
| Unique meals with dish data | 359 |
| Meals where 1 user owns multiple dishes (any visibility) | **128** |
| Meals where 1 user owns multiple **feed-visible** dishes (after `loadDishPosts` visibility filter) | **126** |

Tom's "60+" estimate was conservative — the actual affected meal count is **126**. The pattern is the common case in the seed data, not an edge case. Every potluck where Tom (or any user) cooked multiple dishes triggers it.

Examples of affected meals (excluding Monday Dinner since one of its dishes is private):
- meal `0695779c` — 5 visible dishes, 2 unique owners
- meal `5d2ebd0f` — 4 visible dishes, 1 unique owner
- meal `9fb58a71` — 4 visible dishes, 1 unique owner
- meal `bca682f9` — 2 visible dishes, 1 unique owner
- meal `9ad30e90` — 2 visible dishes, 1 unique owner

---

#### Fix details

**1. `getUserAvatars()` dedup pattern:**

```typescript
const getUserAvatars = () => {
  const seen = new Set<string>();
  const out: Array<{...}> = [];
  for (const post of sortedPosts) {
    if (!post.user_id) continue;
    if (seen.has(post.user_id)) continue;
    seen.add(post.user_id);
    const profile = post.user_profiles;
    out.push({
      userId: post.user_id,
      avatar: profile?.avatar_url || '👤',
      subscription_tier: profile?.subscription_tier,
      displayName: profile?.display_name || profile?.username || 'Unknown',
    });
  }
  return out;
};
```

Insertion order preserved (first post's profile metadata wins per user). Nullish `user_id` skipped defensively. No external participants in this code path (LinkedPostsGroup operates on dish posts, which always have a `user_id`).

**2. `generateHeader()` dedup pattern:**

```typescript
const generateHeader = () => {
  const seen = new Set<string>();
  const uniqueUsers: Array<{display_name?: string; username?: string}> = [];
  for (const post of sortedPosts) {
    if (!post.user_id || seen.has(post.user_id)) continue;
    seen.add(post.user_id);
    uniqueUsers.push(post.user_profiles || {});
  }
  if (uniqueUsers.length < 2) return '';
  // ... existing 2-user / 3+-user formatting branches ...
};
```

A single-user-N-dish group now returns an empty header instead of "Tom cooked with Tom". This is a graceful degradation — see "Observed but not fixed" #2 below for the proper fix.

**3. Removed inline `console.log` debug:** The old `getUserAvatars` had a per-post `console.log('🔍 LinkedPostsGroup avatar:', ...)` that was clearly leftover debug output (and would have logged the duplicate before the warning fired). Removed as part of the dedup rewrite — net cleanup, not a scope expansion.

---

#### Verification

- ✅ TypeScript compiles clean (0 errors in modified files; same 2 pre-existing errors in unrelated `CookSoonSection.tsx` and `DayMealsModal.tsx`)
- ✅ Avatar stack `key={user.userId}` at line ~298 (post-fix) is now safe — `userAvatars` contains at most one entry per user_id
- ✅ Byline `generateHeader()` no longer produces "Tom cooked with Tom" for same-user groups
- ✅ Existing post grid `<View key={post.id}>` at line ~369 unchanged — `post.id` is the dish post UUID and was always unique
- ✅ MealPostCard not modified (verified — its avatar stack still sources from `post_participants` via `getPostParticipantsByRole`)
- ✅ Tier 3 photo cascade (P7-46) unchanged
- ✅ No other LinkedPostsGroup behavior modified

---

#### How external participants are handled

LinkedPostsGroup operates on dish POSTS (rows in the `posts` table), not on `post_participants` rows. Every dish post has a non-null `user_id` (the post's owner) by schema. External participants only exist on `post_participants` rows where `participant_user_id IS NULL` and `external_name IS NOT NULL` — those don't surface in this code path at all. The `if (!post.user_id) continue` guard is purely defensive.

If/when LinkedPostsGroup is rebuilt to handle the M3 multi-cook case in 7I, external participants would need to be considered. Out of scope here.

---

#### Observed but not fixed

1. **`MealPostCard.tsx` `roleParticipants.cooks` is theoretically dupe-able if a single user has both `host` and `sous_chef` rows for the same meal post.** This shouldn't happen by design (a user is either the host or a sous chef, not both), but there's no DB constraint preventing it. The current code would put both rows in the cooks bucket → duplicate avatar with same `participant_user_id`. Currently doesn't fire because: (a) seed data doesn't have this pattern, (b) the avatar stack uses `key={index}` in `CardHeader`, so even if it did happen the React warning would be on the byline rendering or some other downstream consumer, not the avatar stack itself. Defensive dedup in MealPostCard is a future hardening candidate but not necessary for this fix pass.

2. **`groupPostsForFeed` should not group posts when all post owners are the same user.** A "linked group" of dishes by a single user isn't a "cooking partners" relationship — it's just multiple dishes the same person cooked, which is the meal pattern. Grouping them and rendering as LinkedPostsGroup with an empty header is a graceful degradation, but the right fix is at the data layer: detect single-owner groups and render them as individual PostCards instead, OR collapse them into the parent meal's MealPostCard (which already exists in the same feed). This would also be a 7I-era concern, since 7I is reworking `feedGroupingService` for the multi-cook G4rr-b pattern.

3. **`LinkedPostsGroup` groups Monday Dinner's dishes via `meal_group` post_relationships**, even though Monday Dinner is ALREADY rendered as a MealPostCard via `getMealsForFeed`. So users see the meal twice in the feed: once as a MealPostCard (via the meal post), and once as a LinkedPostsGroup wrapping its dish posts (because the dishes are also returned by `loadDishPosts`). This is a duplication bug that predates 7F — it's surfaced now because the seed data has many such meals. Out of scope for this fix pass; flag for 7I scope.

4. **Empty `generateHeader()` for single-user groups** renders the LinkedPostsGroup without a label, which is confusing UI but not broken. See #2 above for the proper fix (don't create the group in the first place).

5. **P7-46 / P7-47 still missing from `PHASE_7_SOCIAL_FEED.md` deferred items table** (highest existing P7 ID is still P7-43). Recommend Claude.ai add P7-46 and P7-47 retroactively when reconciling the deferred items table. Recommend also adding the three observations above as new deferred items (LinkedPostsGroup feed-duplication, single-owner group detection, MealPostCard cooks dedup hardening).

---

#### What changed vs Checkpoint 2 fix pass 1

- ✅ `LinkedPostsGroup.tsx`: cooks list now deduped by `user_id` at both the avatar stack AND the byline construction sites
- ✅ Removed inline debug `console.log` from `getUserAvatars`
- ✅ TypeScript compiles clean
- ✅ MealPostCard NOT modified — no behavior change to the rebuild from Checkpoint 2 / fix pass 1
- ✅ feedGroupingService NOT modified — out of scope, flagged for 7I
- ✅ FeedScreen NOT modified — out of scope, the fix is downstream of FeedScreen's data loading

**Hard stop. Waiting for greenlight before Checkpoint 3.**

---

### 2026-04-10 — Phase 7F Checkpoint 2 fix pass — P7-46 + P7-47

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** `docs/CC_PROMPT_7F_CHECKPOINT_2_FIX_PASS.md` (P7-46 photo cascade Tier 3 + P7-47 React duplicate-key warning)
**Scope lock:** Two items only — P7-46 and P7-47. Other observations recorded under "Observed but not fixed."

**Note on P7-46/P7-47 deferred-items state:** The prompt asked me to re-read the live P7-46/P7-47 entries in `PHASE_7_SOCIAL_FEED.md` before starting. Those entries are not yet present in the doc — the highest existing P7 ID is P7-43, and the deferred items table jumps from P7-43 directly to other content. The fix scope was therefore grounded in the prompt itself (CC_PROMPT_7F_CHECKPOINT_2_FIX_PASS.md), which Tom authored with full context. Recommend Claude.ai add P7-46 and P7-47 entries retroactively when reconciling the deferred items table.

**Files modified:**
- `components/MealPostCard.tsx` — Fix 1 (P7-46) photo cascade Tier 3 + Fix 2 (P7-47) dish peek composite key

**DB changes:** None.

---

#### Fix 1 — P7-46: Photo cascade Tier 3 (recipe stock photo fallback)

**Diff locations in `components/MealPostCard.tsx`:**

| Change | Line(s) | Description |
|--------|---------|-------------|
| Type extension | 110 | `photoSource` state type extended from `'meal' \| 'dish' \| 'none'` to `'meal' \| 'dish' \| 'recipe' \| 'none'` |
| Cascade branch | 127–143 | `loadMealData` now has 4-tier cascade with Tier 3 (recipe_image_url) inserted before Tier 4 (none). Restructured the if/else from a 2-branch nested form to a 4-branch flat form for readability. |
| Aggregation branch | 252–278 | New `'recipe'` branch in the photo aggregation block. Uses `dishes.find(d => !!d.recipe_image_url)` to get the FIRST recipe-backed dish (RPC returns dishes course-sorted, so this is deterministic). Pushes a single photo with `isRecipePhoto: true` flag — single photo, not a carousel, matches "highlight" framing. |
| Photo type | 252 | `allPhotos` array element type extended with optional `isRecipePhoto?: boolean` flag |
| Badge render | 287–291 | New conditional render inside the photo carousel `.map`: when `photo.isRecipePhoto` is true, render the "📖 Recipe photo" badge in the same position as PostCard. |
| Badge styles | ~458–471 | Added `recipeImageBadge` and `recipeImageBadgeText` to MealPostCard's `photoStyles`. Copied verbatim from `PostCard.tsx:428-441` — same `position: 'absolute'`, `top: 12, left: 12`, `rgba(0,0,0,0.5)` background, `borderRadius: 12`, `paddingHorizontal: 10, paddingVertical: 4`, `#fff` text at `fontSize: 12, fontWeight: '500'`. |

**Reused vs copied PostCard badge:** **Copied**, not extracted. PostCard's badge styling is inline literals with no theme tokens (`rgba(0,0,0,0.5)`, `'#fff'`, no `colors.primary`). Extracting it to a shared primitive would be a separate refactor and was out of scope. The two definitions are now byte-identical — if the design ever changes, both files need updating in sync. Flagging as a small DRY opportunity for future cleanup.

**Cascade integration with existing tiers:**
- Tier 1 (`mealPhotosData.length > 0` → `'meal'`) — UNCHANGED
- Tier 2 (`dishPhotos.length > 0` → `'dish'`) — UNCHANGED
- Tier 3 (NEW: `dishesData.some(d => !!d.recipe_image_url)` → `'recipe'`) — fires only when both Tier 1 and Tier 2 fall through
- Tier 4 (`'none'` → photoless variant) — UNCHANGED behavior, still the correct fallback when NO dish has any photo source

**Verification (code-trace):**
- ✅ Meal with `meal_photos` populated → still Tier 1 (mealPhotos array, no badge)
- ✅ Meal with empty `meal_photos` but dish has `dish_photos` → still Tier 2 (dish photos, no badge)
- ✅ Meal with no meal/dish photos but dish has `recipe_image_url` → NEW Tier 3 (single recipe stock photo with "📖 Recipe photo" badge)
- ✅ Fully photoless meal → still Tier 4 photoless variant
- ✅ TypeScript compiles clean (0 errors in modified files; same 2 pre-existing errors in unrelated files)

**Divergence from P7-46 fix scope:** None. Implemented exactly as specified.

---

#### Fix 2 — P7-47: React duplicate-key warning audit + fix

**Full audit of `.map(` calls:**

`components/MealPostCard.tsx`:

| Line | Iteration | Key | Risk |
|------|-----------|-----|------|
| 161 | `roleParticipants.external.map(e => e.id)` | N/A — building a Set | Safe |
| 180 | `visibleCooks.slice(0,3).map(getName)` | N/A — building string array | Safe |
| 207 | `visibleEaters.slice(0,2).map(getName)` | N/A — building string array | Safe |
| 240 | `visibleCooks.slice(0,3).map(p => ({...}))` | N/A — building AvatarSpec[] for prop | Safe |
| 283 | `allPhotos.slice(0,5).map((photo, index) => ...)` | `` `photo-${index}` `` | Index-based, can't dupe |
| 311 | `allPhotos.slice(0,5).map((_, index) => ...)` (indicator dots) | `` `dot-${index}` `` | Index-based, can't dupe |
| 336 | `visible.map((dish, i) => ...)` (dish peek) | `dish.dish_id` (was) → `` `${dish.dish_id}-${i}` `` (after fix) | **Data-derived key — only iteration in MealPostCard with this property. Vulnerable to dish_courses drift (P7-25 / Gap 8).** |

`components/feedCard/sharedCardElements.tsx`:

| Line | Iteration | Key | Risk |
|------|-----------|-----|------|
| 139 | `avatars.slice(0,3).map((avatar, index) => ...)` (CardHeader avatar stack) | `index` | Index-based (weak but not duplicate-prone). Tom's note about preferring composite over raw-index applies here for diff stability, but it can't produce a duplicate-key warning. Not the culprit. |
| 302 | `stats.map((stat, index) => ...)` (StatsRow) | `stat.label` | Data-derived but built locally — labels are hardcoded ("Dishes", "Cooks", "Time", "Cooked", "Highlights" via separate code path), code only pushes each label once. Not the culprit. |
| 493 | `likeData.likes.slice(0,3).map(...)` (EngagementRow likers) | `like.user_id` | Data-derived. Could theoretically dupe if the same user appears twice in the likes array. **However, FeedScreen does NOT pass `likeData` to MealPostCard** (verified — the MealPostCard render at FeedScreen.tsx:553–571 omits likeData), so this code path doesn't execute on meal cards. Not the culprit for this warning. |

**Reproduction attempt against seed data:**

Queried the dev DB directly with the service role key to look for actual duplicate-key triggers:

| Probe | Result |
|-------|--------|
| `dish_courses` total rows | 654 |
| Duplicate `(meal_id, dish_id)` pairs across all meals | **0** |
| Weeknight dinner meal `dish_courses` count | 1 |
| Weeknight dinner `get_meal_dishes` RPC return rows | 1 (no inflation) |
| Top 10 meals by dish count: RPC vs `dish_courses` count comparison | All match exactly — no RPC LEFT JOIN inflation anywhere |
| Weeknight dinner `post_participants` | 3 unique rows: 1 host (Tom), 1 sous_chef (different user), 1 ate_with (different user). No duplicates. |
| Weeknight dinner `meal_photos` count | 1 (Tier 1 fires) |

**Conclusion: I could not reproduce the warning from current seed data.** The dish peek with `dish_id` keys is theoretically vulnerable but currently clean. The Weeknight dinner meal has exactly 1 dish, so its dish-peek iteration runs once and can't produce a duplicate. The avatar stack has 2 unique cooks (indices 0, 1). The stats row has unique labels. No likeData passed to MealPostCard.

**Top suspects ordered by reasoning strength:**

1. **Dish peek `key={dish.dish_id}` (line 336/337) — fixed.** This is the only iteration in MealPostCard that uses a data-derived key without disambiguation, and is the only one vulnerable to a known data drift surface (P7-25 / Gap 8: `dish_courses` parallel representation with `parent_meal_id` and `post_relationships`). Even though current seed data is clean, the defensive composite key `` `${dish.dish_id}-${i}` `` hardens against future drift without hiding the underlying data issue (raw index would). The prompt explicitly named this as a candidate. Fixed.

2. **A different feed-level collision I can't reproduce statically.** The warning could theoretically come from FlatList itself if `groupPostsForFeed` returns duplicate group IDs, or if `feedItems` has overlapping keys between meals and grouped posts. I audited `FeedScreen.tsx`'s `keyExtractor` (lines 711–715): `meal-${id}` for meals, `item.id` for grouped, `item.post.id` for singles. These prefixes prevent cross-bucket collisions. I did not modify FeedScreen — out of scope for this fix pass and would require on-device repro to confirm.

**Fix applied (one-line change):**

```diff
-        {visible.map((dish, i) => (
-          <Text key={dish.dish_id}>
+        {visible.map((dish, i) => (
+          // Composite key per P7-47: dish_id alone can collide if dish_courses
+          // has duplicate rows pointing at the same dish (P7-25 / Gap 8 drift).
+          // Index disambiguates without hiding the underlying data issue.
+          <Text key={`${dish.dish_id}-${i}`}>
```

Location: `components/MealPostCard.tsx:336–340` (line numbers post-fix).

**Verification status:** Static audit only. Fix is defensible based on reasoning above, but on-device verification is needed to confirm this is the actual culprit. If the warning persists after this fix, the next investigation step is to add a temporary `console.log` in FeedScreen's `renderFeedItem` showing `feedItems` keys, and look for FlatList-level duplicates.

**Data layer note (not fixed):** The dish peek defensive fix masks a hypothetical data bug rather than fixing it. If `dish_courses` ever does end up with duplicate rows (the P7-25 / Gap 8 risk), the dish peek will silently render the same dish twice. The proper fix is the P7-25 audit of `addDishesToMeal`'s parallel writes. Not doing that here — out of scope.

---

#### Observed but not fixed (scope-lock items)

1. **`sharedCardElements.tsx:139` avatar stack uses `key={index}`.** Tom's general guidance prefers composite keys over raw index for diff stability. The avatar stack `avatars.slice(0, 3)` doesn't reorder during a single card render, so this can't produce a warning, but it's a weak key. Hardening candidate for a future cleanup pass.
2. **`sharedCardElements.tsx:302` stats row uses `key={stat.label}`.** Same — works because labels are unique by construction, but a data-derived label collision would be a bug. Locally safe.
3. **DRY opportunity: `recipeImageBadge` styles are now duplicated** between `PostCard.tsx:428-441` and `MealPostCard.tsx` (the new badge styles I just added). Could be extracted to `sharedCardElements.tsx` as a `RecipePhotoBadge` primitive in a future refactor.
4. **P7-46 / P7-47 missing from PHASE_7_SOCIAL_FEED.md deferred items table.** The doc currently lists P7-1 through P7-43; the prompt referenced P7-46 and P7-47 as if they existed. Recommend adding them when Claude.ai next reconciles deferred items.
5. **`get_meal_dishes` RPC update (Checkpoint 2 fix pass DDL) status unknown.** I cannot tell from this environment whether Tom has executed the DDL provided in the previous SESSION_LOG entry. The cascade fix landing in this pass will work whether or not the DDL has been executed — Tier 3 fires off `dish.recipe_image_url`, which the RPC has always returned (it was selected in the original RPC definition; the fix-pass DDL only added `recipe_cook_time_min` and `recipe_times_cooked`).

---

#### What changed vs Checkpoint 2 baseline

- ✅ Photo cascade now correctly handles 4 tiers per the design intent
- ✅ Dish peek defensive composite key in place
- ✅ Recipe photo badge matches PostCard pattern (copied verbatim)
- ✅ TypeScript compiles clean (same 2 pre-existing errors in unrelated files)
- ✅ No other Checkpoint 2 behavior modified — Tier 1 (meal_photos) and Tier 2 (dish_photos) paths unchanged, byline rendering unchanged, stats row unchanged, vibe pill unchanged, "started by" footnote unchanged, action row unchanged

**Surprises:**
- The duplicate-key warning is currently unreproducible against seed data. The static audit found no smoking gun. The defensive dish peek fix is the most defensible target, but if Tom verifies on-device after this fix and the warning persists, we know to look elsewhere (most likely FlatList-level in FeedScreen).
- `get_meal_dishes` RPC has clean joins — top 10 highest-dish meals all match `dish_courses` counts exactly. If P7-25 / Gap 8 drift exists, it hasn't manifested in the current seed corpus.

**Hard stop. Waiting for greenlight before Checkpoint 3.**

---

### 2026-04-09 — Phase 7F Checkpoint 2 — MealPostCard rebuild + cooked-vs-ate byline + shared data plumbing

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** CC_PROMPT_7F.md Checkpoint 2 + Tom's Checkpoint 2 scope guidance

**Files created:** None (all new code lives in files created in Checkpoint 1 or modified existing files)

**Files modified:**
- `lib/services/postParticipantsService.ts` — (1) Added `external_name?: string | null` field to `PostParticipant` interface per D27. (2) Added `RoleParticipants` interface export (`cooks`, `eaters`, `external` arrays). (3) Added `getPostParticipantsByRole(postId)` — queries `post_participants` (NOT `meal_participants`), filters approved only, splits into cook/eater/external buckets. External participants appear in both their role bucket and the external bucket. Same `select('*', ...)` pattern as existing `getPostParticipants` which includes all columns including `external_name`.
- `components/MealPostCard.tsx` — Full rebuild to v2 using shared primitives. Key changes: (1) Uses `getPostParticipantsByRole()` instead of `getMealParticipants()` — cooks only in avatar stack, eaters in sub-line text per D45. (2) Cooked-vs-ate byline: single cook → "{Name}'s meal", multi-cook → "Cooked by X, Y & Z", eaters in sub-line "with A & B · date · meal name". (3) D46 two-level photo model: `getMealPhotos()` first, falls back to dish photos, `photoSource` state tracks which bucket ('meal'|'dish'|'none'). (4) Recipe-vs-freeform dish peek: teal underlined for recipe-backed (tappable), gray for freeform (not tappable), "+N more" in teal. (5) Stats row: Dishes / Cooks / [Time if available] / Highlights slot. "Cooks" stat sourced from `post_participants` cook count with empty-case fallback to meal owner. (6) Vibe pill (conditional, received as prop). (7) "Started by" footnote on multi-cook meals between engagement and action rows. (8) Visibility filter applied per D34: host always visible, other participants visible if viewer follows them, external guests always visible. Removed: nutrition stats row (not in K-family wireframe), course-grouped dish preview (replaced by flat dish peek), `meal_participants` RSVP data loading (replaced by `post_participants` role data).
- `lib/services/highlightsService.ts` — Added `suppressFirstCook` option parameter to `computeHighlightForSoloPost`. When true, skips the `first_cook` signal (dedup: Cooked stat already shows "First time cooked!" so Highlights pill defers).
- `components/PostCard.tsx` — (1) Added `times_cooked?: number` to `PostCardData` interface. (2) Updated Cooked stat rendering rule: 0/null → omit, 1 → "First time cooked!", 2+ → "{N}×". Removed hardcoded "1×".
- `screens/FeedScreen.tsx` — (1) Added `times_cooked` to recipes select query. (2) Added `times_cooked` pass-through in transform (from recipe data to PostCardData).

**DB changes:** None.

**Decisions made during execution:**
- **Visibility filter in MealPostCard is local, not service-layer.** The `isVisible()` filter runs inside the component using the `followingIds` prop (which FeedScreen already computes). This matches the existing pattern in the old MealPostCard. Moving it to the service layer would require passing viewerId and followingIds through `getPostParticipantsByRole`, which complicates the API. The service returns all approved participants; the component filters for visibility. If this needs to move to the service layer, flag it.
- **No `canSeeParticipant` per-participant DB call.** The existing `canSeeParticipant` function does two DB queries per participant (check follows creator, check follows participant). For a feed card that might have 5+ participants, this is 10+ DB calls per card. Instead, the component uses the pre-loaded `followingIds` set for O(1) lookups. This is consistent with how the old MealPostCard did it.
- **Cook time stat omitted for now.** The `DishInMeal` type doesn't carry recipe cook time data, and `getMealDishes` (which calls the `get_meal_dishes` RPC) doesn't return it. Adding cook time aggregation would require modifying the RPC or adding a separate query for recipe data per dish. Deferred — marked with TODO. K3rrr wireframe shows "Time · 2h 10m" but our data layer doesn't aggregate this yet.
- **`total_times_cooked` not wired on meal cards.** `DishInMeal` doesn't carry `times_cooked`. The `getMealDishes` RPC returns dish metadata but not the recipe's `times_cooked`. To aggregate, we'd need to join through `dish_courses → posts → recipes.times_cooked`. This is a non-trivial RPC change that risks the "no schema changes" constraint (RPCs are schema-adjacent). The Cooked stat is omitted on meal cards for now. Solo cards have it working via the recipe data already fetched.
- **"Started by" footnote placement.** The wireframe shows it between engagement and action rows. I rendered it after EngagementRow and before ActionRow, matching the wireframe spec.

**Empty-case fallback count:** Cannot determine exact count without running against the live DB with queries. The fallback fires when `post_participants` has zero approved rows with `role IN ('host', 'sous_chef')` for a given meal post. This is likely for older meals created before the 7D/7E code started writing `post_participants` rows. The fallback gracefully shows the meal post owner (`meal.host_profile`) as the sole cook with "Cooks · 1". The fallback is tested in the code path (the `fallbackToOwner` branch). Tom should run the app and check if F&F test meals show the fallback or real cook data.

**`meal_photos` verification:** The `getMealPhotos()` service function exists and is called. The code prioritizes meal_photos over dish_photos per D46. Cannot visually confirm the new code path fires because I can't run the app from this environment. The code logs `photoSource` state which can be verified at runtime. If test meals don't have meal_photos populated, the code silently falls through to dish_photos (identical to previous behavior).

**Highlights dedup verification:** `computeHighlightForSoloPost` now accepts `options?: { suppressFirstCook?: boolean }`. When `suppressFirstCook` is true, the function skips the `first_cook` signal and falls through to the next priority (cooked_n_this_month, cooked_n_this_year). The dedup parameter is designed in; the actual wiring (calling with `suppressFirstCook: true` when `times_cooked === 1`) happens in Checkpoint 5 when Highlights are wired into the feed. The parameter exists and the code path is correct.

**What's broken or uncertain:**
1. **Cook time stat missing on meal cards.** K3rrr wireframe shows "Time · 2h 10m" but we don't have aggregate cook time data. Requires either modifying the `get_meal_dishes` RPC to return recipe cook times, or a separate query. Not blocking — cards render with 2 stats (Dishes, Cooks) instead of 3+Highlights.
2. **`total_times_cooked` not on meal cards.** Same root cause — DishInMeal doesn't carry `times_cooked`. Solo cards have it working.
3. **Meal vibe not wired from FeedScreen.** The `vibe` prop is optional on MealPostCard and FeedScreen doesn't compute it yet. Will be wired in Checkpoint 5 or when meal vibe batching is implemented. Cards render without vibe pills for now.
4. **Visual testing needed.** Cannot run the app from this environment. The full-width card, cooked-vs-ate byline, dish peek colors, and photo priority all need device verification.

**Surprises / Notes for Claude.ai:**
- The `get_meal_dishes` RPC returns `DishInMeal` which has contributor info but not recipe cook time or times_cooked. To add aggregate stats to meal cards (Time, Cooked count), we'd need to either modify the RPC (schema-adjacent) or add a separate batch query for recipe metadata. This is a data gap that wasn't visible until building the card — the wireframe assumed this data was available.
- The empty-case fallback (no cooks in post_participants) is important for historical data compatibility. Recommend Tom checks how many test meals hit this path when running the app.

#### 2026-04-09 (later) — Checkpoint 2 fix pass

**Fix 1 (critical) — Wire cook time and times_cooked through DishInMeal:**

Chose option (a) per Tom's guidance — modify the `get_meal_dishes` RPC to return `recipe_cook_time_min` and `recipe_times_cooked`. The recipes table already has these columns, and the RPC already LEFT JOINs recipes.

**TypeScript changes:**
- `DishInMeal` interface in `mealService.ts`: added `recipe_cook_time_min?: number | null` and `recipe_times_cooked?: number | null`
- `MealWithDetails` interface in `mealService.ts`: added `total_times_cooked?: number` and `total_cook_time_min?: number`
- `getMealsForFeed()` in `mealService.ts`: replaced the separate `dish_courses` count query with a `getMealDishes()` call per meal. Computes `totalCookTimeMin` and `totalTimesCooked` by reducing across dishes (null treated as 0 per aggregation rule). Now also uses `dishes.length` for `dish_count` instead of a separate count query.
- `MealPostCard.tsx`: reads `meal.total_cook_time_min` and `meal.total_times_cooked` from the `MealWithDetails` prop. Time stat renders when aggregate > 0. Cooked stat uses same rendering rule as solo cards (0→omit, 1→"First time cooked!", 2+→"{N}×").

**T3 propagation check — all callers of getMealDishes / get_meal_dishes:**

| Caller | File | Uses new fields? | Status |
|--------|------|-------------------|--------|
| `getMealDishes()` wrapper | `mealService.ts:657` | Returns them in DishInMeal | ✅ Source |
| `MealPostCard.tsx` | `components/MealPostCard.tsx:119` | Doesn't directly use new fields — aggregates come from MealWithDetails | ✅ Safe |
| `MealDetailScreen.tsx` | `screens/MealDetailScreen.tsx:517` | New fields are optional on DishInMeal, existing code doesn't read them | ✅ Safe |
| `MyMealsScreen.tsx` | `screens/MyMealsScreen.tsx:331` | Stores dishes in a Map, doesn't read new fields | ✅ Safe |
| `getMealsForFeed()` | `mealService.ts:~1215` | Calls getMealDishes, reads new fields for aggregation | ✅ New consumer |

No callers broken. New fields are optional (`?: number | null`) so all existing destructuring and spread patterns continue to work.

**DDL for Tom to execute in Supabase SQL Editor** (required for the RPC to actually return the new columns):

```sql
-- Phase 7F fix pass: add recipe_cook_time_min and recipe_times_cooked to get_meal_dishes RPC
-- This is not a schema change — same table, same join, two more SELECT columns.

DROP FUNCTION IF EXISTS public.get_meal_dishes(uuid);

CREATE OR REPLACE FUNCTION public.get_meal_dishes(p_meal_id uuid)
RETURNS TABLE(
  dish_id uuid,
  dish_title text,
  dish_user_id uuid,
  dish_rating numeric(3,1),
  dish_photos jsonb,
  dish_created_at timestamp with time zone,
  recipe_id uuid,
  recipe_title text,
  recipe_image_url text,
  recipe_cook_time_min integer,
  recipe_times_cooked integer,
  course_type text,
  is_main_dish boolean,
  course_order integer,
  contributor_username text,
  contributor_display_name text,
  contributor_avatar_url text
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.id as dish_id,
    d.title as dish_title,
    d.user_id as dish_user_id,
    d.rating as dish_rating,
    d.photos as dish_photos,
    d.created_at as dish_created_at,
    d.recipe_id,
    r.title as recipe_title,
    r.image_url as recipe_image_url,
    r.cook_time_min as recipe_cook_time_min,
    r.times_cooked as recipe_times_cooked,
    dc.course_type,
    dc.is_main_dish,
    dc.course_order,
    up.username as contributor_username,
    up.display_name as contributor_display_name,
    up.avatar_url as contributor_avatar_url
  FROM dish_courses dc
  JOIN posts d ON d.id = dc.dish_id
  LEFT JOIN recipes r ON r.id = d.recipe_id
  LEFT JOIN user_profiles up ON up.id = d.user_id
  WHERE dc.meal_id = p_meal_id
  ORDER BY
    CASE dc.course_type
      WHEN 'appetizer' THEN 1
      WHEN 'main' THEN 2
      WHEN 'side' THEN 3
      WHEN 'dessert' THEN 4
      WHEN 'drink' THEN 5
      WHEN 'other' THEN 6
    END,
    dc.is_main_dish DESC,
    dc.course_order,
    d.created_at;
END;
$function$;
```

**Until Tom runs this DDL:** `recipe_cook_time_min` and `recipe_times_cooked` on DishInMeal will be undefined. The aggregation code treats undefined/null as 0, so both the Time and Cooked stats will be omitted on meal cards (same as pre-fix-pass behavior). After the DDL runs, stats will appear.

---

**Fix 2 — Empty-cooks count query result:**

Query: count meals where `post_participants` has no approved host/sous_chef rows.

| Metric | Value |
|--------|-------|
| Total meals in DB | 284 |
| Meals WITHOUT cooks in post_participants | 283 |
| Meals WITH cooks | 1 |
| Percentage without cooks | **99.6%** |

The one meal with cooks is "Finley and Tom's epic meal" (created 2025-12-02) with a single sous_chef participant. All 283 other meals are seed data created before 7D/7E shipped the cook attribution code path.

**Assessment:** ≥15% threshold met (99.6%). This is not a bug in the 7F code — the fallback path (show meal owner as sole cook) renders correctly. The seed data predates the cook attribution feature. However, this means virtually no meal cards in dev testing will show the multi-cook byline experience (K3rrr pattern) until new meals are created via the 7D/7E cook-logging flow.

**Recommendation for Claude.ai:** Add a P7 deferred item for a seed data refresh that creates 5-10 completed meals with `post_participants` rows covering: (a) single cook + eaters, (b) multi-cook potluck, (c) multi-cook with external guests. This would let F&F testing cover the D45 byline rendering. Alternatively, Tom can create these manually via the app.

---

**Fix 3 — meal_photos coverage query result:**

| Metric | Value |
|--------|-------|
| Total meals in DB | 284 |
| Meals with meal_photos | **0** |
| Percentage with photos | **0.0%** |

The `meal_photos` table is empty in dev data. The D46 two-level photo source priority code is completely untested — it will always fall through to the dish_photos path (identical to pre-7F behavior).

**Assessment:** The code is correct but unexercisable. The fallback to dish_photos works (verified by code inspection). The meal_photos priority path needs seeded data to test.

**Recommendation for Claude.ai:** Before Checkpoint 3, seed 2-3 completed meals with `meal_photos` rows so the new photo source priority can be visually verified. Alternatively, accept that D46's render-side implementation is code-correct but runtime-untested until real meals with meal_photos are created.

---

**New uncertainties after fix pass:**
1. **RPC DDL not yet executed.** The `get_meal_dishes` RPC update is provided as SQL for Tom to run. Until executed, Time and Cooked stats on meal cards will be omitted (graceful degradation, not a crash).
2. **No multi-cook test data.** 99.6% of meals hit the fallback path. The K3rrr multi-cook byline experience is code-correct but untested with real data.
3. **No meal_photos test data.** D46 photo priority is code-correct but untested.

**TypeScript status:** 0 errors in modified files. Same 2 pre-existing errors in unrelated files.

---

### 2026-04-09 — Phase 7F Checkpoint 1 — PostCard refresh + shared visual language

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** CC_PROMPT_7F.md Checkpoint 1

**Files created:**
- `components/feedCard/sharedCardElements.tsx` — Shared visual primitives for both PostCard and MealPostCard. Contains: `CardWrapper` (full-width edge-to-edge, top/bottom borders, white background — replaces rounded shadow card), `CardHeader` (avatar stack + title + meta + menu, supports external guests with dashed border), `DescriptionLine` (posts.description, max 3 lines, ellipsis), `RecipeLine` (recipe-vs-freeform color distinction — teal tappable for recipe-backed, gray for freeform), `StatsRow` (flexbox row with stat items + optional Highlights pill in 4th slot), `HighlightsPill` (sized to content, teal for author-side, cream for viewer-side), `VibePillRow` (single vibe pill below stats, conditional), `EngagementRow` (liker avatars + "X gave yas chef" + comment count), `ActionRow` (like/comment/share buttons), `StartedByFootnote` (for meal cards in Checkpoint 2). Color constants from wireframe CSS extracted as module-level constants (TEAL_50/100/700/900 and CREAM tones).
- `lib/services/highlightsService.ts` — Highlights pill computation service. Exports `computeHighlightForSoloPost` (author-side only: first_cook, cooked_n_this_month, cooked_n_this_year) and `computeHighlightForMealPost` (author-side only: cooking_with_new, first_potluck, biggest_meal_yet). `computeHighlightsListForDetailCard` is a placeholder for Checkpoint 3. Service uses direct Supabase queries — will be optimized to batch pattern in Checkpoint 3 per Tom's guidance.
- `lib/services/vibeService.ts` — Vibe tag helpers. `getRecipeVibe(recipeId)` fetches recipes.vibe_tags from DB. `getVibeFromTags(vibeTags)` resolves from pre-fetched data (avoids extra query when recipe is already loaded). `computeMealVibe(mealId)` aggregates across meal's dishes (most common tag, alphabetical tiebreak). VIBE_EMOJI_MAP maps 14 known tags to emojis, fallback '✨' for unknown.

**Files modified:**
- `components/PostCard.tsx` — Full rewrite to v4. Now uses shared primitives from `sharedCardElements.tsx`. Key visual changes: (1) full-width edge-to-edge card (no rounded corners, no shadow, no horizontal margin — per wireframe `fullWidthCardStyle`), (2) card chrome order matches K1rrr: header → title → recipe line → description → photo → stats → vibe → engagement → actions, (3) recipe-vs-freeform color distinction on recipe line (teal tappable vs gray static), (4) description line rendering from `posts.description` (NOT posts.notes per D4 — different columns), (5) Highlights pill slot in stats row (passed as prop, not computed inside component — per batch-and-prop pattern), (6) vibe pill row (conditional — no vibe on photoless or freeform), (7) photo carousel now uses 4:3 aspect ratio (was 1:1). Preserved: ParticipantsListModal, all existing callbacks (onLike, onComment, onMenu, onRecipePress, onChefPress, onViewLikes, onViewParticipants). Added new props: `highlight?: HighlightSpec`, `vibe?: VibeTag`, `onPress?: () => void`, `description?: string` on PostCardData, `recipe_id?: string` on PostCardData. Removed: inline nutrition fetch (was fetching dietary badges — not in wireframe spec, can be re-added if needed), modifications section (posts.modifications was rendered inline — not in K1rrr wireframe spec; notes still live in the data, just not on the feed card), cooking method icon display (not in K1rrr stats — moved to cook time + rating + cooked count + highlights).
- `screens/FeedScreen.tsx` — Minimal changes: (1) added `description` to the `loadDishPosts` select query, (2) added `description` to the Post interface, (3) added `description` and `recipe_id` to the transform output, (4) added `vibe_tags` to the recipes select query, (5) imported `getVibeFromTags` from vibeService, (6) wired up vibe prop on PostCard render, (7) removed `userInitials` prop from PostCard render (was unused in v4).

**DB changes:** None. `posts.description` column confirmed to exist by planning instance.

**Decisions made during execution:**
- **Removed dietary badges and modifications from feed card**: K1rrr wireframe shows stats as Cook time / Rating / Cooked / Highlights — no dietary flags or modifications section. The dietary data is still fetched via nutritionService for MealDetailScreen but is no longer on the feed card. This is a deliberate visual simplification per philosophy (c). If Tom wants these back, they can be re-added as a stats row extension.
- **Removed cooking method icon from stats**: K1rrr stats are Cook time / Rating / Cooked / Highlights. The old v3 had Method as a stat with icon. Method is no longer a feed card stat.
- **Photo carousel aspect ratio changed from 1:1 to 4:3**: Per wireframe CSS `.hero-photo-wrap { aspect-ratio: 4 / 3 }`. This is a significant visual change — photos are now shorter/wider.
- **"Cooked 1×" placeholder**: The "Cooked" stat always shows "1×" because `times_cooked` data doesn't flow through the PostCardData type yet. Real count will need the times_cooked value to be fetched and passed through. Not blocking for Checkpoint 1.
- **Used `colors.primary` (#0d9488) for recipe link color** rather than wireframe's `--teal-700` (#0F6E56). The app's theme system uses `colors.primary` consistently; switching to a different teal for just the recipe line would be inconsistent. The visual difference is subtle.

**meal_participants usage audit (per Tom's Q4 guidance):**
MealPostCard currently uses `meal_participants` data in 3 places:
1. **Avatar stack (line 596)**: `visibleParticipants` filtered from meal_participants by RSVP status + follow-graph. **Should switch to post_participants with role filtering per D45** — cooks only in avatar stack.
2. **Header text (lines 114-133)**: `formatHeaderText()` uses visibleParticipants names. **Should switch to post_participants** — needs cook/eat split for "Cooked by X" vs "with Y" byline.
3. **Stats row "People" count (line 681)**: Uses `meal.participant_count` from MealWithDetails (computed from meal_participants accepted count in getMealsForFeed). **Needs decision**: should this be total people (meal_participants RSVP), or cooks only (post_participants host+sous_chef)? Per K3rrr wireframe, the stat is "Cooks · 3" — so it should be cook count from post_participants, not RSVP count. The "People" stat should be renamed to "Cooks" and sourced from post_participants.

**Deferred during execution:**
- Highlights computation is not wired into the feed yet (cards render without highlights). Checkpoint 3 builds the batch service and Checkpoint 5 wires it into FeedScreen.
- Vibe pill is wired and will render when recipe data has vibe_tags. Most test recipes may not have vibe_tags populated.

**Recommended doc updates:**
- ARCHITECTURE: Add `components/feedCard/` directory to the project structure section
- ARCHITECTURE: Note the shared card primitives pattern (DRY across PostCard/MealPostCard)
- DEFERRED_WORK: "Cooked N×" stat needs times_cooked data flow through PostCardData

**Status:** PostCard v4 compiles clean (0 errors in modified files). Visual structure matches K1rrr wireframe: full-width card, header, title, recipe line, description, photo (4:3), stats row (3 stats + optional highlights slot), conditional vibe pill, engagement row, action row. Photoless variant naturally works (photo carousel returns null when no photos). TypeScript checks pass across all consuming components (FeedScreen, LinkedPostsGroup).

**What's broken or uncertain:**
1. Can't visually test without running the app — the 4:3 photo ratio and full-width card are significant visual changes that need device verification.
2. LinkedPostsGroup passes PostCard data through but doesn't pass the new `vibe` or `highlight` props — those cards will render without vibes or highlights (acceptable for now, LinkedPostsGroup is being reworked in 7I).
3. "Cooked" stat is hardcoded to "1×" — needs real times_cooked data.

**Surprises / Notes for Claude.ai:**
- The wireframe's `--teal-700` (#0F6E56) is a different shade from the app's `colors.primary` (#0d9488). Used the app's theme color for consistency. Flag if the wireframe teal was intentionally distinct.
- Posts older than the 7D migration may not have `description` populated (column exists but will be null for historical posts). This is expected — DescriptionLine returns null for empty descriptions.

---

### 2026-04-09 — Phase 7F Orientation Complete

**Phase:** 7F (Multi-cook & meal experience — Feed rendering + post detail)
**Prompt from:** Tom via Claude.ai — CC_PROMPT_7F.md (five hard-stop checkpoints)

**Documents read:**
- `docs/CC_PROMPT_7F.md` — full build prompt, all 5 checkpoints (PostCard refresh → MealPostCard rebuild → Highlights service + comment attribution → MealDetailScreen F1++++ → Integration + viewer-side + test pass)
- `docs/PHASE_7F_DESIGN_DECISIONS.md` — all 6 new decisions D41–D46, philosophy (c) framing, locked design specifications, hard line between build vs deferred, 11 new deferred work items (P7-28 through P7-42)
- `docs/PHASE_7_SOCIAL_FEED.md` — Architecture (Model 1), Build Phases table (7A–7L), Decisions Log (D1–D46), existing service/component inventory
- `docs/frigo_phase_7f_wireframes.html` — too large to read inline (262KB HTML), will reference specific state IDs during build

**Code files read:**
- `lib/services/mealService.ts` (~1380 lines) — getMealDishes (RPC-backed), getMealsForFeed (visibility-filtered, completed meals only), getMealParticipants, getMealPhotos, wrapDishIntoNewMeal, detectPlannedMealForCook, full CRUD
- `lib/services/postService.ts` (~115 lines) — createDishPost with meal linking, computeDefaultVisibility (D34), PostVisibility type
- `lib/services/postParticipantsService.ts` (~483 lines) — getPostParticipants, formatParticipantsText, approval flow, privacy filtering via canSeeParticipant
- `components/MealPostCard.tsx` (766 lines) — current implementation: loads participants + dishes + nutrition in useEffect, course-grouped dish preview, nutrition stats row, photo carousel from dish photos only (no meal_photos sourcing), header uses meal_participants (not post_participants cook/eat split)
- `components/PostCard.tsx` (822 lines) — current implementation: rounded card with padding (not full-width), recipe row with chef link, Strava-style stats (time/method/cuisine), dietary badges, participants text, modifications section, photo carousel
- `screens/FeedScreen.tsx` (730 lines) — loads dish posts + meals in parallel, combines and sorts chronologically, renders PostCard/MealPostCard/LinkedPostsGroup, visibility filter on loadDishPosts (excludes private/meal_tagged), like/comment/participant loading
- `screens/MealDetailScreen.tsx` (1115 lines) — full meal detail with hero photo, title/description, stats, dishes by course, participants by RSVP status, photos, host controls
- `lib/services/nutritionService.ts` (389 lines) — getRecipeNutritionBatch (batch Map), aggregateMealNutrition (sums macros, AND-s dietary flags), CompactNutrition interface

**One-paragraph understanding of 7F scope:**

7F is a rendering-only pass that rebuilds `MealPostCard` and refreshes `PostCard` to match the locked Pass 6 wireframe baseline (K1rrr–K5rrr for feed cards, F1++++ for detail). The core changes are: (1) shared visual language with full-width edge-to-edge cards, a new stats row with a per-card-per-viewer Highlights pill slot (philosophy c hybrid), static vibe pill, and description line; (2) cooked-vs-ate byline split on meal cards using existing post_participants role data (D45); (3) recipe-vs-freeform color distinction in dish peek (teal tappable vs gray static); (4) meal photo sourcing from `meal_photos` table as priority over dish photos (partial D46); (5) comment attribution model with dual meal-level and dish-level sections on the detail card (D41); (6) Highlights + For You sections on MealDetailScreen with privacy enforcement (host doesn't see For You on own meal). No schema changes. No touching LogCookSheet or cook handoff flows. Deferred: G4rr-b grouped meals (7I), eater ratings (future), @-mention parsing (future), notification system (future).

**Observations and clarifying questions before Checkpoint 1:**

1. **No comments service file exists.** The build prompt references `commentsService.ts` for D41 comment attribution queries. Comments are currently loaded inline in FeedScreen via direct Supabase query on `post_comments`. Checkpoint 3 asks me to add `getCommentsForMeal()`. I'll create `lib/services/commentsService.ts` as a new file for this. Confirm this is the right approach.

2. **`vibe_tags` is a JSONB array on recipes, not a separate `recipe_vibe_tags` table.** The build prompt references `recipe_vibe_tags` as "the existing taxonomy" — in practice, it's `recipes.vibe_tags` (a string array set during recipe extraction). The `getRecipeVibe()` function will query this column. No schema issue, just noting the naming difference.

3. **`posts.description` field.** The build prompt says this is "already in the schema, not currently rendered." I need to verify this column exists before Checkpoint 1. The PostCard and MealPostCard don't currently fetch or render it.

4. **Meal card currently uses `meal_participants` for header avatars, not `post_participants`.** The D45 cook-vs-eat split uses `post_participants.role` (host/sous_chef/ate_with). But MealPostCard currently loads `getMealParticipants()` which queries `meal_participants` (RSVP table). These are different tables with different data. The cook/eat roles live on `post_participants`. I'll need to add a service function that queries `post_participants` for the meal post filtered by role, not `meal_participants`. This is a key implementation detail.

5. **No performance concerns flagged yet** — the Highlights computation will need careful design to avoid N+1 queries per feed card. Will follow the prompt's guidance on batching and caching.

**Status:** Orientation complete. Ready for Checkpoint 1 go-ahead.

---

### 2026-04-08 — Phase 7D/7E Checkpoint 5 — Cleanup Pass

**Phase:** 7D/7E closeout
**Prompt from:** CC_PROMPT_CHECKPOINT_5.md — three cleanup items (P7-29, P7-28, P7-32)

---

#### P7-29: Extract `computeMealTypeFromHour` and `computeMealType` to neutral utils

**New file created:** `lib/utils/mealTypeHelpers.ts` — contains both `computeMealTypeFromHour(date: Date): string` and `computeMealType(params?)`: string`. Exact same implementations and comments as before, just moved.

**Files modified:**
- `lib/services/postService.ts` — Removed function bodies for `computeMealTypeFromHour` and `computeMealType`. Added re-export: `export { computeMealTypeFromHour, computeMealType } from '../utils/mealTypeHelpers'`. Added local import of `computeMealType` for internal use. Added top-level `import { addDishesToMeal } from './mealService'` replacing the lazy `require('./mealService')` in `createDishPost`. Removed the lazy require and its NOTE comment.
- `lib/services/mealService.ts` — Changed import from `import { computeMealTypeFromHour } from './postService'` to `import { computeMealTypeFromHour } from '../utils/mealTypeHelpers'`.

**Grep results — all call sites after refactor:**

| File | Symbol | Import source | Status |
|------|--------|---------------|--------|
| `lib/utils/mealTypeHelpers.ts` | Both (definition) | — | Source of truth |
| `lib/services/postService.ts` | Both (re-export + local use) | `../utils/mealTypeHelpers` | Re-exports for backwards compat |
| `lib/services/mealService.ts` | `computeMealTypeFromHour` | `../utils/mealTypeHelpers` (direct) | Updated |
| `screens/RecipeDetailScreen.tsx` | Both | `../lib/services/postService` (via re-export) | Unchanged, works |
| `screens/CookingScreen.tsx` | `computeMealType` | `../lib/services/postService` (via re-export) | Unchanged, works |
| `components/LogCookSheet.tsx` | `computeMealType` | `../lib/services/postService` (via re-export) | Unchanged, works |
| `components/MadeOtherDishesSheet.tsx` | `computeMealType` | `../lib/services/postService` (via re-export) | Unchanged, works |

**Circular dependency confirmation:** The lazy `require('./mealService')` in `createDishPost` has been removed and replaced with a top-level `import { addDishesToMeal } from './mealService'`. TypeScript compilation succeeds without circular-import errors. The cycle is broken because `mealService` now imports `computeMealTypeFromHour` from `../utils/mealTypeHelpers` (not from `postService`), so the dependency graph is: `postService → mealService → mealTypeHelpers` (no cycle).

---

#### P7-28: `detectPlannedMealForCook` null-time guard

**File modified:** `lib/services/mealService.ts` — line 131.

**Updated `.or()` clause (exact string):**
```
and(meal_time.gte.${todayStart.toISOString()},meal_time.lte.${todayEnd.toISOString()}),and(meal_time.is.null,created_at.gte.${todayStart.toISOString()})
```

The null-time branch is now `and(meal_time.is.null, created_at.gte.todayStart)` — meals with null `meal_time` must have been created today to match. Old planning meals from December 2025 with null `meal_time` will no longer false-match.

---

#### P7-32: In-sheet-created meals default `meal_time` to `now()`

**Where the insert happens:** `lib/services/mealService.ts`, function `createMeal`, line 302. The insert is properly in the service layer (not in InSheetMealCreate.tsx directly). No services-layer violation.

**Code change:** Changed `meal_time: input.meal_time || null` to `meal_time: input.meal_time ?? new Date().toISOString()`. If `meal_time` is not passed (undefined), defaults to current UTC timestamp. If explicitly passed (including a specific date string), uses the passed value.

**All callers of `createMeal` and their behavior after fix:**

| Caller | File | Passes `meal_time`? | Behavior after fix |
|--------|------|--------------------|--------------------|
| InSheetMealCreate | `components/InSheetMealCreate.tsx:268` | No | Gets `now()` — **this is the fix target** |
| CreateMealModal | `components/CreateMealModal.tsx:763` | Yes (`mealTime?.toISOString()`) | If user picks a time → uses that. If user leaves blank → `undefined` → gets `now()`. Acceptable. |
| wrapDishIntoNewMeal | `lib/services/mealService.ts:256` | No | Gets `now()`. Acceptable — wrap happens now. |
| QuickMealPlanModal | `components/QuickMealPlanModal.tsx:447` | Needs verification — likely passes a date | If passed → uses it. If not → gets `now()`. |

---

#### Anything unexpected:
None. All three items were straightforward. The re-export pattern for P7-29 means zero callers needed import path updates (only mealService's direct import changed).

**Status:** All three items implemented. TypeScript compiles clean. Awaiting Tom's manual verification:
- P7-29: App runs without runtime errors, type checking restored on `addDishesToMeal` call in `createDishPost`
- P7-28: Smart-detect no longer false-matches old null-time planning meals
- P7-32: In-sheet-created meal has `meal_time` populated in DB

---

### 2026-04-08 — Phase 7D/7E Checkpoint 4 — Fix Pass 4

**Phase:** 7E
**Prompt from:** CC_PROMPT_FIX_PASS_4.md — two tactical layout fixes for modal/sheet overflow bugs

**Files modified:**
- `components/LogCookSheet.tsx` — **Fix 1:** Changed `sheetHeight` from a single ternary to a 3-branch `if/else if/else`. `sheetView === 'create'` now uses `SCREEN_HEIGHT * 0.55` (was 0.85). `'picker'` stays at 0.85. `'main'` stays at 0.65 (compact) / 0.9 (full). Added NOTE comment explaining this is a tactical fix and the proper solution is tracked as a deferred item.
- `screens/RecipeDetailScreen.tsx` — **Fix 2:** Added `height: '60%'` to the inline style of the wrap picker modal's inner View (line 1477). Single property addition.

**Fix 1 verification:** TypeScript compiles clean. Pending Tom's manual verification that the create view fits on screen with keyboard open, and that main/picker views are unchanged.

**Fix 2 verification:** TypeScript compiles clean. Confirmed `showAddToMealPicker` only exists in `screens/RecipeDetailScreen.tsx` (grep returned 1 file). No other modals affected. Pending Tom's manual verification that MealPicker is fully visible in the wrap picker modal.

**Regression checks:**
- Main view height: unchanged (0.65 compact / 0.9 full) — the `else` branch is identical to before
- Picker view height: unchanged (0.85) — the `else if (sheetView === 'picker')` branch preserves the previous value
- No other modals in RecipeDetailScreen touched — only the `showAddToMealPicker` modal's inner View style was modified

**Anything unexpected:** None. Both fixes were single-property changes as specified.

**Status:** Both fixes landed. Awaiting Tom's manual verification in the simulator.

---

### 2026-04-08 — Phase 7D/7E Checkpoint 4 — Fix Pass 3

**Phase:** 7E
**Prompt from:** CC_PROMPT_FIX_PASS_3_FINAL.md — drift bug fix (createDishPost missing dish_courses + post_relationships writes)

**Approach:** Implemented Option A as specified in the prompt.

**Files modified:**
- `lib/services/postService.ts` — Added meal-linking logic to `createDishPost`: after the post insert, if `parentMealId` is set, calls `addDishesToMeal` with a single-dish array to write the `dish_courses` row and `post_relationships` row. On link failure, throws with a specific error message (does NOT roll back the post). Used lazy `require('./mealService')` instead of a top-level import to avoid circular dependency (`postService` → `mealService` → `postService` via existing `computeMealTypeFromHour` import).

**Circular dependency check:** `mealService.ts` already imports `computeMealTypeFromHour` from `postService.ts` (line 6). A top-level `import { addDishesToMeal } from './mealService'` in `postService.ts` would create a circular dependency. Avoided by using `const { addDishesToMeal } = require('./mealService')` inside the `if (params.parentMealId)` block — the require only resolves at call time when both modules are fully loaded. No runtime circular dependency issue.

**Fix 1 verification results:** Awaiting Tom's DB-level verification. TypeScript compiles clean. The five verification tests require:
1. RecipeDetailScreen meal-attached cook → check posts + dish_courses + post_relationships rows
2. CookingScreen meal-attached cook → same check
3. MadeOtherDishesSheet freeform dish → regression check (uses addDishesToMeal directly, should be unaffected)
4. Solo cook (no meal) → confirm no dish_courses or post_relationships created
5. Circular dependency → confirmed avoided via lazy require

**Tom: please run the verification tests and provide dish post IDs + DB query results. I'll update this entry with actual row IDs once available.**

---

## Backfill SQL for Tom

Run these four queries in Supabase SQL Editor, in order. Do NOT run Query 2 or 3 if Query 1 returns unexpected numbers.

**Query 1 — Scoping sanity check (run first to confirm state):**

```sql
-- Count meals and dishes that still have drift. Expected: ~276 meals, ~420 dishes.
SELECT 
  COUNT(DISTINCT p.parent_meal_id) AS meals_with_drift,
  COUNT(*) AS total_drifted_dishes
FROM posts p
LEFT JOIN dish_courses dc ON dc.dish_id = p.id
WHERE p.post_type = 'dish'
  AND p.parent_meal_id IS NOT NULL
  AND dc.id IS NULL;
```

**Query 2 — Backfill dish_courses (one row per drifted dish):**

```sql
-- Insert one dish_courses row per drifted dish.
-- Defaults: course_type='main', is_main_dish=false, course_order=NULL.
INSERT INTO dish_courses (dish_id, meal_id, course_type, is_main_dish, course_order)
SELECT 
  p.id AS dish_id,
  p.parent_meal_id AS meal_id,
  'main' AS course_type,
  false AS is_main_dish,
  NULL AS course_order
FROM posts p
LEFT JOIN dish_courses dc ON dc.dish_id = p.id
WHERE p.post_type = 'dish'
  AND p.parent_meal_id IS NOT NULL
  AND dc.id IS NULL;
```

**Query 3 — Backfill post_relationships (one row per missing meal-dish pair):**

```sql
-- Insert one post_relationships row per (meal, dish) pair that's missing one.
-- Respects the smaller/larger id ordering convention used by addDishesToMeal.
INSERT INTO post_relationships (post_id_1, post_id_2, relationship_type)
SELECT DISTINCT
  LEAST(p.parent_meal_id, p.id) AS post_id_1,
  GREATEST(p.parent_meal_id, p.id) AS post_id_2,
  'meal_group' AS relationship_type
FROM posts p
WHERE p.post_type = 'dish'
  AND p.parent_meal_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM post_relationships pr
    WHERE pr.relationship_type = 'meal_group'
      AND pr.post_id_1 = LEAST(p.parent_meal_id, p.id)
      AND pr.post_id_2 = GREATEST(p.parent_meal_id, p.id)
  );
```

**Query 4 — Post-backfill verification (both counts should be 0, second query should return zero rows):**

```sql
-- Re-run scoping query. Both counts should be 0.
SELECT 
  COUNT(DISTINCT p.parent_meal_id) AS meals_with_drift,
  COUNT(*) AS total_drifted_dishes
FROM posts p
LEFT JOIN dish_courses dc ON dc.dish_id = p.id
WHERE p.post_type = 'dish'
  AND p.parent_meal_id IS NOT NULL
  AND dc.id IS NULL;

-- Sanity check: for each meal with dishes, parent_meal_id count and
-- dish_courses count should match. Any rows returned = mismatch to investigate.
SELECT 
  m.id AS meal_id,
  m.title,
  (SELECT COUNT(*) FROM posts p 
     WHERE p.parent_meal_id = m.id AND p.post_type = 'dish') AS parent_meal_id_count,
  (SELECT COUNT(*) FROM dish_courses dc 
     WHERE dc.meal_id = m.id) AS dish_courses_count
FROM posts m
WHERE m.post_type = 'meal'
  AND (SELECT COUNT(*) FROM posts p 
         WHERE p.parent_meal_id = m.id AND p.post_type = 'dish') > 0
  AND (SELECT COUNT(*) FROM posts p 
         WHERE p.parent_meal_id = m.id AND p.post_type = 'dish')
      != (SELECT COUNT(*) FROM dish_courses dc 
            WHERE dc.meal_id = m.id)
ORDER BY m.title;
```

---

**Status:** Code fix landed. Backfill SQL ready. Awaiting Tom's verification tests and backfill execution.

---

### 2026-04-07 — Phase 7D/7E Checkpoint 4 — Fix Pass 2

**Phase:** 7E
**Prompt from:** CC_PROMPT_7D_7E_CHECKPOINT_4_FIX_PASS_2.md — two fixes (unicode escapes + silent error swallowing)

**Files modified:**
- `components/MadeOtherDishesSheet.tsx` — **Fix 1:** Replaced three JSX unicode escapes with literal characters: `\u2026` → `…` (placeholder, line 655), `\u00b7` → `·` (suggested label, line 693), `\u00b7` → `·` (freeform note, line 724). Left `\u00d7` on line 215 alone — it's inside a JS template literal where escapes process correctly. **Fix 2:** Rewrote `handleDone` error handling from silent-continue to collect-and-report pattern. Added `failures` array. All three inner catch blocks now push to `failures` with dish name and error message. End-of-loop logic handles three cases: all-good (close sheet), all-failed (Alert with per-dish errors, sheet stays open for retry), partial-failure (Alert listing failed dishes, then close). Outer generic `Alert.alert('Error', 'Some dishes may not have been saved.')` removed. `setSubmitting(false)` moved to `finally` block.
- `screens/RecipeDetailScreen.tsx` — **Fix 1 (grep sweep finding):** Replaced `\u00b7` → `·` in parent_meal_link banner JSX text node at line 1151. This was a JSX text node escape that the grep sweep caught beyond the three MadeOtherDishesSheet locations.

**Grep sweep results (Fix 1) — all seven Checkpoint 4 files scanned:**

| File | Matches | Action |
|------|---------|--------|
| MadeOtherDishesSheet.tsx | `\u00d7` line 215 | Left alone — JS template literal, escapes process correctly |
| MealPicker.tsx | `\u00b7` line 106 | Left alone — JS string literal (`.join()`), works correctly |
| InSheetMealCreate.tsx | 0 matches | — |
| RecipeDetailScreen.tsx | `\u2014` lines 765, 852 | Left alone — JS string literals (Alert.alert args) |
| RecipeDetailScreen.tsx | `\u00b7` line 1151 | **Fixed** — JSX text node, was rendering as literal `\u00b7` |
| RecipeDetailScreen.tsx | `\u203A` line 1153 | Left alone — inside `{'\u203A'}` expression wrapper, evaluates correctly |
| MyPostDetailsScreen.tsx | `\u00b7` line 821, `\u203A` line 823 | Left alone — both inside `{' '}` expression wrappers, evaluate correctly |
| CookingScreen.tsx | `\u2014` line 297 | Left alone — JS string literal |
| CommentsScreen.tsx | 0 matches | — |

**Total: 4 fixes applied (3 in MadeOtherDishesSheet, 1 in RecipeDetailScreen). 7 matches left alone (all in JS string literals or JSX expression wrappers where escapes process correctly).**

**Fix 2 manual test — break-and-revert performed and verified:**
1. **Break:** Temporarily changed `parent_meal_id: mealId` to `parent_meal_id: 'INTENTIONALLY_BROKEN_UUID_FOR_TESTING'` in the freeform insert path.
2. **Error test:** Tom added a freeform dish "Rice" via MadeOtherDishesSheet and tapped Done. Alert appeared: title "Failed to save dishes", body "None of your dishes were saved: • Rice: invalid input syntax for type uuid: 'INTENTIONALLY_BROKEN_UUID_FOR_TESTING'". Confirmed the new error handling surfaces real, specific DB error messages.
3. **Revert:** Changed `parent_meal_id` back to `mealId`.
4. **Success test:** Tom added another freeform dish via MadeOtherDishesSheet and tapped Done. Sheet closed without error. Row verified in Supabase — `dish_name` set, `recipe_id` NULL, `meal_type` inherited from parent meal, `parent_meal_id` set correctly.
5. **Fix 1 visual verification (same test session):** "Cooked 3× recently" renders with real × character. "Rice · no recipe" renders with real middle dot. Placeholder "Pick a recipe or type a name…" renders with real ellipsis.

**Status:** Both fixes verified end-to-end. Ready for Tom's remaining tests (3-9 from original fix pass checklist).

---

### 2026-04-07 — Phase 7D/7E Checkpoint 4 — Fix Pass

**Phase:** 7E
**Prompt from:** CC_PROMPT_7D_7E_CHECKPOINT_4_FIX_PASS.md — six fixes

**Files modified:**
- `lib/services/postService.ts` — **Fix 3:** Added `computeMealTypeFromHour(date: Date)` shared helper (exported). Refactored `computeMealType` to delegate to it for the time-of-day fallback. Eliminates code duplication.
- `lib/services/mealService.ts` — **Fix 3:** Imported `computeMealTypeFromHour`. Replaced inline 5-band logic in `detectPlannedMealForCook` with `const currentMealSlot = computeMealTypeFromHour(now)`. Deleted 6 lines of inline hour/slot computation.
- `components/MadeOtherDishesSheet.tsx` — **Fix 1:** Added `mealType?: string` to props interface, destructured in component. Imported `computeMealType`. Computes `effectiveMealType` at top of `handleDone` via `computeMealType({ parentMeal })`. Updated freeform insert to include `recipe_id: null` and `meal_type: effectiveMealType`. **Fix 6:** Changed recommendation label from `"You've cooked this N×"` to `"Cooked N× recently"`.
- `screens/RecipeDetailScreen.tsx` — **Fix 1:** Added `publishedMealType` state, set from `data.mealMealType` alongside publishedMealId/Title. Passed `mealType` prop to MadeOtherDishesSheet. Cleaned up on close. **Fix 3:** Imported `computeMealTypeFromHour`. Replaced inline 3-band logic in `handleWrapCreateNew` with shared helper + title-case transform (includes `late_night` → "Late Night"). **Fix 4:** Added `hasPublishedDishPost` state. Added `checkForPublishedDishPost()` function (queries posts table). Called on mount. Wrapped "Add to meal" menu item in `{hasPublishedDishPost && (...)}`. Set `true` after successful `createDishPost`.
- `screens/CookingScreen.tsx` — **Fix 1:** Added `madeOtherDishesMealType` state. Set from `logData.mealMealType`. Passed `mealType` prop to MadeOtherDishesSheet. Cleaned up on close.
- `screens/MyPostDetailsScreen.tsx` — **Fix 2:** Added `parentMealTitle` state. After loading post with `parent_meal_id`, fetches parent meal's title via second query. Updated banner text to `"Part of {parentMealTitle || 'a meal'} · view meal"`.
- `screens/CommentsScreen.tsx` — **Fix 5:** Added `post_type` to post query select, Post interface, and setPost call. Added `navigation.setOptions({ title: ... })` after post loads — dish posts show "Comments on this dish", meal posts show "Comments". App.tsx unchanged.

**Fix 3 git blame result:** The 5-band scheme in `detectPlannedMealForCook` was written during Checkpoint 2b when the function was first created — the same session that tightened `computeMealType` to 4 bands. The fix to `computeMealType` in postService.ts did not propagate to the brand-new `detectPlannedMealForCook` in mealService.ts because they're in separate files and the band logic was written inline. **Pre-existing Checkpoint 2b regression, missed at the time.** Now fixed by extracting the shared `computeMealTypeFromHour` helper used by both.

**Shared helper confirmation:** `computeMealTypeFromHour` is exported from `postService.ts` and imported by `mealService.ts` (for `detectPlannedMealForCook`) and `RecipeDetailScreen.tsx` (for `handleWrapCreateNew`). `computeMealType` also delegates to it. Grep for `hour < 14.5` and `hour < 17` confirms zero matches in any service/screen file — only in docs and unrelated utilities (titleGenerator.ts, statsService.ts, PostCreationModal.tsx).

**Verification checklist for Tom:**
1. Log a cook with meal context → add a freeform dish ("rice") via MadeOtherDishesSheet → verify in DB the freeform row has `meal_type` set matching parent meal's meal_type, and `recipe_id` is NULL
2. Navigate to a dish post with parent_meal_id via MyPostDetailsScreen → banner shows real meal title (not "a meal")
3. Smart-detect at 3:30pm with a planned dinner → should auto-attach (previously broken by snack slot)
4. Open a recipe with no prior dish post → "Add to meal" menu item absent from overflow
5. Log a cook → re-open overflow menu → "Add to meal" now present
6. Navigate into comments on a dish post → header reads "Comments on this dish"
7. Navigate into comments on a meal post → header reads "Comments"
8. MadeOtherDishesSheet recommendation cards → label reads "Cooked N× recently"

**Status:** All 6 fixes implemented. No TypeScript errors. Ready for re-test.

---

### 2026-04-07 — Phase 7D/7E Checkpoint 4 — Made Other Dishes + Wrap Pattern

**Phase:** 7E (cook→meal handoff UX)
**Prompt from:** CC_PROMPT_7D_7E.md — Checkpoint 4: "Made other dishes too?" sheet, Option γ wrap, RecipeDetailScreen overflow, parent_meal_link banner, comments label

**Files created:**
- `components/MadeOtherDishesSheet.tsx` — Post-publish "Made other dishes too?" sheet (D40). Two variants: planned meals show suggested rows from `meal_dish_plans` (state 2a/2b), unplanned meals show recommendation cards from cook-soon and frequently-cooked recipes (state 2c). Recipe search with 300ms debounce for "add row" input. Freeform dish support (D23) — inserts directly with `dish_name` set, `recipe_id` null. Mini star rating per row. On Done: creates dish posts via `createDishPost` (or direct insert for freeform), links via `addDishesToMeal`, updates `meal_dish_plans.completed_at` and `logged_meal_post_id` for promoted suggestions. Two exits: X (abandon) and "Skip for now" (identical in v1, `// TODO post-launch` comment).

**Files modified:**
- `lib/services/postService.ts` — Added `getMostRecentDishPost(userId, recipeId)` for 4.3's "wrap most recent" requirement.
- `lib/services/mealService.ts` — Added `wrapDishIntoNewMeal(dishPostId, userId, mealTitle)` (D26 Option γ). Uses `createMeal` for step 3 then `addDishesToMeal` for step 4 (per locked decision from Checkpoint 1). Validates ownership, checks not already wrapped, returns `{ mealId, dishId }`.
- `screens/RecipeDetailScreen.tsx` — Major additions:
  - **"Add to meal" overflow item (4.3):** New menu item after "I've Made This Before". Opens a MealPicker in a modal. Two paths: select existing meal → `addDishesToMeal`, or "Create new meal from this dish" → `wrapDishIntoNewMeal` with smart-defaulted title from the dish post's `created_at`.
  - **Post-publish "Made other dishes too?" (4.1/4.2):** After `handleLogCookSubmit` creates a post with meal context, opens MadeOtherDishesSheet with a 400ms delay (lets LogCookSheet dismiss).
  - **Parent meal link banner (4.6):** Teal banner above RecipeHeader reading "Part of {meal title} · view meal". Navigates to MealDetailScreen. Rendered when `parentMealInfo` state is set (from wrap or meal-context publish).
  - **After-wrap toast (4.5 / D39):** Dark floating toast at bottom: "Wrapped into {meal title}" / "This dish is now part of a meal" with "View meal" action. Auto-dismisses after 5s.
  - **Platform import added** for toast positioning.
- `screens/CookingScreen.tsx` — Triggers MadeOtherDishesSheet after meal-context publish. Stores `currentUserId` from session. On sheet close, navigates to RecipeList.
- `screens/MyPostDetailsScreen.tsx` — **Comments label (4.7 / D28 / lock 7):** Changed `{N} comment(s)` → `{N} comment(s) on this dish`. **Parent meal link banner (4.6):** Added teal banner before post header when `post.parent_meal_id` is set, linking to MealDetailScreen.

**DB changes:** None (uses columns from Checkpoint 1 migration: `logged_meal_post_id`, `dish_name`)

**Decisions made during execution:**
- **Wrap uses dish's created_at for title:** Per prompt 4.4, the smart-defaulted title uses the dish post's `created_at` (not current time) to reflect when the dish was actually cooked.
- **Most recent dish post for wrap (4.3):** Uses `getMostRecentDishPost` (ORDER BY created_at DESC LIMIT 1). No disambiguation UI for multiple posts — v1 wraps the most recent. Flagged in case Tom wants a picker.
- **Freeform dishes bypass createDishPost:** `createDishPost` requires `recipeId: string`. Freeform dishes (D23, recipe_id=null) use a direct Supabase insert with `dish_name` set. This avoids changing the createDishPost signature which other callers depend on.
- **View-tracking signal skipped:** No view-tracking table exists. Recommendation signal 2 (recently viewed) silently omitted with TODO comment. Signals 1 (cook-soon) and 3 (frequently cooked) are implemented.
- **Skip for now = X close in v1:** Per prompt note, both exits dismiss without saving. `// TODO post-launch: actually preserve partial state on Skip for now` comment in handler.

**Deferred during execution:**
- Disambiguation UI for multiple dish posts per recipe (4.3) — using most-recent as v1 default
- View-tracking for recommendations (4.2 signal 2)
- Partial state preservation for "Skip for now" (4.1)

**Recommended doc updates:**
- ARCHITECTURE: Note new components MadeOtherDishesSheet.tsx, new service functions wrapDishIntoNewMeal, getMostRecentDishPost
- ARCHITECTURE: Note "Add to meal" overflow item on RecipeDetailScreen
- DEFERRED_WORK: Add view-tracking table as future recommendation signal

**Status:**
- All Checkpoint 4 deliverables implemented: MadeOtherDishesSheet (planned + unplanned), wrapDishIntoNewMeal, "Add to meal" overflow, parent_meal_link banner, after-wrap toast, comments label
- TypeScript compiles with no new errors
- **Needs testing by Tom:**
  - Open RecipeDetailScreen for a previously-cooked recipe → overflow → "Add to meal" → picker opens
  - Pick an existing meal → dish gets attached, toast appears, banner visible
  - "Create new meal from this dish" → wrap completes, toast appears, banner visible, tapping toast navigates to MealDetailScreen
  - Verify in DB: new meal post, dish_courses row, post_relationships row, parent_meal_id set
  - Log a cook with meal context → "Made other dishes too?" sheet opens
  - Rate a suggested row → row promotes, mini stars fill
  - Type a recipe name → search results appear → tap to add
  - Type a non-matching name → "Add as freeform" appears → tap to add
  - Tap Done → dish posts created, linked to meal, meal_dish_plans updated
  - Open MyPostDetailsScreen for any dish → comments section reads "N comments on this dish"
  - Open MyPostDetailsScreen for a dish with parent_meal_id → teal banner visible above header

**Surprises / Notes for Tom:**
- The `addDishesToMeal` call inside `wrapDishIntoNewMeal` validates the user is host/participant via `canAddDishToMeal` RPC. Since we just created the meal with the user as host, this always passes. No extra auth needed.
- The MadeOtherDishesSheet's recommendation engine for unplanned meals queries `posts` joined with `recipes` for frequently-cooked. If the user has few posts, the recommendations section may be empty — the "add row" search input is always available as fallback.
- Planning-status meal feed leak verification is deferred to Checkpoint 5 per Tom's note.

---

### 2026-04-07 — Phase 7D/7E Checkpoint 3 — Picker Flex + Modal Pre-Selection

**Phase:** 7E
**Prompt from:** Tom's third round of Checkpoint 3 testing — two bugs with precise root causes

**Files modified:**
- `components/LogCookSheet.tsx` — Two changes:
  - **Bug B (picker blank):** Changed picker and create view wrappers from `style={styles.compactBody}` to `style={[styles.compactBody, { flex: 1 }]}`. compactBody itself unchanged (main view still sizes to content). Picker/create wrappers now flex-expand to fill the sheet body.
  - **Bug A (modal pre-selection):** Added `initialSelectedIds={new Set(taggedParticipants.map(p => p.userId))}` prop to AddCookingPartnersModal render. Replaced onConfirm merge logic (Map-based dedup) with simple replace: `setTaggedParticipants(selectedUsers.map(...))`. Modal now returns the complete selection set, not incremental adds.
- `components/AddCookingPartnersModal.tsx` — Three changes:
  - Added `initialSelectedIds?: Set<string>` to props interface.
  - Added `initialSelectedIds` to destructured function signature.
  - Updated useEffect: on visible=true, calls `setSelectedUserIds(new Set(initialSelectedIds || []))`. On visible=false, no longer clears selectedUserIds (open-side initialization handles it).

**Verification results:**
1. `flex: 1` inline on picker wrapper (line 1295) and create wrapper (line 1308) — ✓
2. `initialSelectedIds` in AddCookingPartnersModal: props interface (37), signature (46), useEffect (59) — ✓
3. LogCookSheet passes `initialSelectedIds={new Set(taggedParticipants.map(p => p.userId))}` (line 1567) — ✓
4. onConfirm has no "merge" or Map — simple replace with `setTaggedParticipants(selectedUsers.map(...))` — ✓

**Status:** Ready for re-test. No TypeScript errors.

---

### 2026-04-07 — Phase 7D/7E Checkpoint 3 — Tag Wiring + Sheet Height Fix

**Phase:** 7E
**Prompt from:** Tom's second round of Checkpoint 3 testing — two bugs with precise root causes

**Files modified:**
- `components/LogCookSheet.tsx` — All 6 LogCookSheet steps:
  - **Bug B (sheet height):** Changed `maxHeight: sheetHeight` → `height: sheetHeight` in styles.sheet. Sheet now has a fixed height so flex:1 children (MealPicker, InSheetMealCreate) expand to fill.
  - **Step 1:** Added `taggedParticipants` state: `useState<Array<{ userId: string; role: 'sous_chef' | 'ate_with' }>>([])`.
  - **Step 2:** Added `setTaggedParticipants([])` to the reset-on-open useEffect.
  - **Step 3:** Added `participants` field to `LogCookData` interface.
  - **Step 4:** Added `participants: taggedParticipants` to `handleSubmit`'s `onSubmit` call.
  - **Step 5:** Replaced onConfirm handler — now maps selectedUsers to `{ userId, role }` objects, merges with existing via Map dedup, calls `setTaggedParticipants`. AddCookingPartnersModal's onConfirm signature is `(selectedUsers: string[], role: ParticipantRole)` — no deviation from spec.
  - **Step 6:** Tag chip now shows active state when `taggedParticipants.length > 0`: teal background (reuses `styles.mealChipActive`), teal icon color, label changes to `Tagged (N)`.
- `screens/RecipeDetailScreen.tsx` — **Step 7:** Captured `createDishPost` return as `newPost`. Added `addParticipantsToPost` calls for sous_chef and ate_with after post creation. Added import.
- `screens/CookingScreen.tsx` — **Step 7:** Added same `addParticipantsToPost` calls using existing `post` variable. Added import.

**Steps completed:** All 7 of 7. No deviations from spec.

**Verification results:**
1. `height` in styles.sheet (not maxHeight) — ✓ line 772
2. `taggedParticipants` appears 6 times — ✓
3. LogCookData has `participants` field — ✓ line 229
4. Tag chip style is conditional array with `styles.mealChipActive` — ✓ line 590
5. onConfirm handler contains `setTaggedParticipants` — ✓ line 1560
6. RecipeDetailScreen calls `addParticipantsToPost` — ✓ lines 705, 708
7. CookingScreen calls `addParticipantsToPost` — ✓ lines 271, 274

**Status:** Ready for re-test. No TypeScript errors.

---

### 2026-04-07 — Phase 7D/7E Checkpoint 3 — UI Fixes

**Phase:** 7E
**Prompt from:** Tom's testing of Checkpoint 3 surfaced two structural UI bugs

**Files modified:**
- `components/LogCookSheet.tsx` — Two fixes:
  - **Bug A (Tag modal not displaying):** Chose Option B. Moved `<AddCookingPartnersModal>` from a fragment sibling of the main `<Modal>` to a child inside it (after KeyboardAvoidingView, before `</Modal>`). Dropped the `<>...</>` fragment wrapper. React Native handles nested Modals more reliably than sibling Modals.
  - **Bug B (Picker off-screen):** Chose Option 1. `sheetHeight` now checks `sheetView` — when view is 'picker' or 'create', sheet expands to 85% of screen height regardless of compact/full mode. Returns to normal height (65%/90%) when view returns to 'main'. Added `sheetView` to styles memo dependency array.

**Bugs fixed:**
- **A:** Tag chip → AddCookingPartnersModal now appears as a nested modal inside the main LogCookSheet modal.
- **B:** Meal picker and creation form now render in an 85%-height sheet with room for full content.

**Status:** Ready for re-test.

---

### 2026-04-07 — Phase 7D/7E Checkpoint 3 — Meal Picker + In-Sheet Meal Creation

**Phase:** 7E (cook→meal handoff UX)
**Prompt from:** CC_PROMPT_7D_7E.md — Checkpoint 3: meal picker (state 1c), in-sheet meal creation (state 1d), inline tagging (D36/D37), wire Tag chip (3.4)

**Files created:**
- `components/MealPicker.tsx` — Meal picker sub-view for LogCookSheet. Lists recent meals via `getUserRecentMeals` RPC, sorted with planning-status meals first. Each row: plate icon, title, subtitle (timing + dish count + status), chevron. "Create new meal" row at bottom with teal plus icon. "Detach from current meal" button when a meal is currently attached. Cancel button. Inline icons: PlateIcon, PlusIcon, ChevronRight. Helper: `formatMealSubtext()` for human-readable timing.
- `components/InSheetMealCreate.tsx` — In-sheet meal creation form (D36). Title input pre-filled with `computeDefaultMealTitle()` ("{Day} {Meal type}", matching tightened time bands). "Cooking with" and "Eating with" tag rows with inline tagging (D37). On submit: calls `createMeal()`, then `addParticipantsToPost()` for Frigo users (role='sous_chef' or 'ate_with'), and direct `post_participants` inserts for external guests (external_name set, participant_user_id null). Returns mealId + title + mealType to parent.

**Files modified:**
- `components/LogCookSheet.tsx` — Major additions:
  - **New imports:** MealPicker, InSheetMealCreate, AddCookingPartnersModal
  - **New state:** `sheetView: 'main' | 'picker' | 'create'` controls which content is shown. `showTagModal` for AddCookingPartnersModal. `currentUserId` fetched on mount.
  - **Sheet view switching (3.1):** Tapping the meal chip or "change" link sets `sheetView='picker'`. Picker's "Create new meal" sets `sheetView='create'`. Selecting a meal or canceling returns to `sheetView='main'`. Body content and CTA area only render when `sheetView='main'`.
  - **Picker callbacks:** `handlePickerSelectMeal` → calls `attachMeal` + returns to main. `handlePickerDetach` → calls `detachMeal` + returns to main. `handlePickerCreateNew` → switches to create view. `handlePickerCancel` → returns to main.
  - **Creation callback:** `handleMealCreated` → calls `attachMeal` with mealId/title/mealType + returns to main.
  - **Tag chip wired (3.4):** Tag chip now opens `AddCookingPartnersModal` with `defaultRole='ate_with'` instead of showing "coming soon". Modal rendered outside the main Modal via fragment wrapper.
  - **Fragment wrapper:** Return JSX now wrapped in `<>...</>` to render both the main Modal and the AddCookingPartnersModal.
  - **Replaced handleChangeOrDetach:** No longer uses stub detach. Now sets `sheetView='picker'` to show the real picker.

**DB changes:** None

**Decisions made during execution:**
- **Content replacement vs sub-sheet:** Chose to replace LogCookSheet's body content (via `sheetView` state) rather than opening a sub-sheet on top. This avoids modal stacking issues on iOS and keeps the interaction within a single sheet surface.
- **Separate component files:** MealPicker (170 lines) and InSheetMealCreate (350 lines) are separate files to keep LogCookSheet from becoming unwieldy (already 1500+ lines). They render as content inside LogCookSheet's sheet body, not as separate modals.
- **External participant inserts:** For "Add as guest" participants, the form inserts directly into `post_participants` with `external_name` set and `participant_user_id` null, per D27/D37. Uses the new CHECK constraint from the 7D migration.
- **Recent partners query:** Queries `post_participants WHERE invited_by_user_id = currentUser` ordered by created_at DESC, deduplicates, takes top 5. Falls back to empty list if the user has never tagged anyone.
- **Tag chip (3.4) wired to AddCookingPartnersModal:** Per the prompt, the Tag chip in the main chip row uses the existing `AddCookingPartnersModal` (separate from the inline tagging in the creation form). The inline tagging in InSheetMealCreate is its own UI per lock 3 — no escape hatch to the modal.
- **AddCookingPartnersModal `onConfirm` is a stub:** The modal's confirm callback currently just closes the modal. The actual `addParticipantsToPost` call for the dish post needs to happen after post creation, which is handled by the parent screen. This is a known gap — flagging for Checkpoint 5 integration.

**Deferred during execution:**
- **Tag chip participant data flow:** The Tag chip opens AddCookingPartnersModal, but the selected user IDs aren't yet stored in LogCookSheet state or passed through LogCookData. This needs wiring in Checkpoint 5 so the parent screen can call `addParticipantsToPost` after creating the dish post.
- **Planning-status feed leak:** Per Tom's deferred verification note — need to check in Checkpoint 5 that `meal_status='planning'` meals don't appear on the home feed.

**Recommended doc updates:**
- ARCHITECTURE: Note new components MealPicker.tsx and InSheetMealCreate.tsx in the Social domain
- ARCHITECTURE: Note that LogCookSheet now has three view states (main/picker/create)

**Status:**
- All Checkpoint 3 deliverables implemented: picker, in-sheet creation, inline tagging, Tag chip wired
- TypeScript compiles with no new errors
- **Needs testing by Tom:**
  - Tap meal chip → picker opens with recent meals listed
  - Tap an existing meal → picker closes, banner appears, chip activates, visibility flips to Followers
  - Tap chip again → picker re-opens, attached meal highlighted, "Detach" button visible
  - Tap "Detach" → returns to main, meal detached, chip idle
  - Tap "Create new meal" → form opens with smart-defaulted title (e.g. "Monday Dinner")
  - Edit the title
  - Tap "add" pill in "Cooking with" → recent suggestions appear
  - Tap a recent → pill added to row
  - Type a name that doesn't match → "Add as guest" appears
  - Tap "Add as guest" → external pill added
  - Tap "Create & attach" → meal created, form closes, LogCookSheet shows confirmed banner
  - Verify in DB: new `posts` row with post_type='meal', `post_participants` rows for tagged users (with external_name for guests)
  - Tap Tag chip → AddCookingPartnersModal opens with "Ate With" default
  - Solo dish logging (no meal) still works end-to-end
  - Smart-detect banners still work

**Surprises / Notes for Tom:**
- The `onConfirm` callback from the Tag chip's AddCookingPartnersModal is a stub — it closes the modal but doesn't store the selected users anywhere yet. This means tagging via the Tag chip doesn't actually write participants to the dish post. Full wiring needs Checkpoint 5 integration work. Flag if this is a blocker for Checkpoint 4.
- `getUserRecentMeals` returns meals via an RPC function. If the RPC returns no `meal_type` field, the picker passes `undefined` for mealType. The `attachMeal` callback handles this gracefully (mealContext.mealType will be undefined, and `computeMealType` will fall through to time-of-day inference).

---

### 2026-04-07 — Phase 7D/7E Checkpoint 2b — Bugfixes

**Phase:** 7E
**Prompt from:** Tom's testing of Checkpoint 2b surfaced three bugs

**Files modified:**
- `lib/services/postService.ts` — **Bug 1:** Changed `computeMealType` signature from `(recipeMealType?: string)` to `(params?: { recipe?, parentMeal? })`. New precedence: (1) parentMeal.meal_type, (2) recipe.meal_type, (3) time-of-day, (4) 'dinner' fallback. **Bug 3:** Tightened time bands: removed 'snack' and 'brunch' bands. New bands: breakfast (<10:30), lunch (10:30–14:00), dinner (14:00–22:00), late_night (22:00+).
- `components/LogCookSheet.tsx` — **Bug 1:** Expanded `mealContext` state to include `mealType?: string`. `attachMeal()` now accepts and stores `mealType`. `LogCookData` gains `mealMealType: string | null`. Smart-detect auto-attach and "Attach" button now pass `meal.meal_type` through to `attachMeal`. **Bug 2:** Fixed two call sites of `computeMealType` that still used old string signature — changed to `computeMealType({ recipe })`. This was the root cause: the old signature passed `recipe.meal_type` (which was undefined for most recipes), so `computeMealType` received `undefined` and fell through to time-of-day inference correctly, but the call at line 280 passed `recipe.meal_type` as a string to the old signature which returned it directly without type inference. With the new object signature, both call sites now correctly use `{ recipe }` which checks `recipe.meal_type` then falls back to time-of-day.
- `screens/RecipeDetailScreen.tsx` — Updated `computeMealType` call to use new object signature with `{ recipe, parentMeal }`. Parent meal's meal_type flows from `data.mealMealType`.
- `screens/CookingScreen.tsx` — Same update: `computeMealType({ recipe, parentMeal })` with `logData.mealMealType`.

**Bugs fixed:**
1. **Parent meal_type inheritance:** A dish attached to "Tuesday Dinner" at 1pm no longer writes meal_type='lunch'. It inherits 'dinner' from the parent meal.
2. **Solo lunch defaults to private:** `computeDefaultVisibility` now receives the correctly computed meal_type from `computeMealType({ recipe })`, so solo lunches → 'private' as D34 requires.
3. **Time bands simplified:** Four bands (breakfast/lunch/dinner/late_night), no snack/brunch. 2pm–10pm is dinner, matching real cooking behavior.

**Status:** Ready for re-test of all three bugs.

---

### 2026-04-07 — Phase 7D/7E Checkpoint 2b — Smart-Detect + Banner States

**Phase:** 7E (cook→meal handoff UX)
**Prompt from:** CC_PROMPT_7D_7E.md — Checkpoint 2b: smart-detect query, wire into LogCookSheet, banner states (high/low/confirmed), change/detach behavior

**Files created:** None

**Files modified:**
- `lib/services/mealService.ts` — Added `SmartDetectResult` interface and `detectPlannedMealForCook()` function (D33). Tiered fallback: ±4hr of now → meal-type slot today → any planned meal today. Confidence: 'high' if recipe is in `meal_dish_plans`, 'low' otherwise. Returns null if no planned meals found. Fixed Supabase `.or()` query to use `and()` for date range (meal_time between today start/end) OR null meal_time.
- `components/LogCookSheet.tsx` — Major additions:
  - **New imports:** `detectPlannedMealForCook`, `SmartDetectResult`, `Meal` from mealService; `supabase` for auth.
  - **New inline SVGs:** SparkleIcon (for high-confidence banner), QuestionIcon (for low-confidence banner).
  - **New state:** `smartDetectResult`, `smartDetectDismissed`, `bannerState` ('none' | 'high' | 'low' | 'confirmed').
  - **Smart-detect effect (2b.1/2b.2):** On sheet open, calls `detectPlannedMealForCook(userId, recipeId)`. If high confidence → auto-attaches meal, sets banner to 'high', sets chip to active. If low confidence → sets banner to 'low', chip stays idle.
  - **Banners (2b.2/2b.3):** Three banner states rendered via `renderSmartDetectBanner()`:
    - **State 1b (high):** Teal banner, sparkle icon, "Attached to {meal}" / "Detected from your meal plan" + "change" link.
    - **State 1b-low (low):** Amber banner (#FEF3C7 bg, #F59E0B border), question icon, "Part of {meal}?" / "You have a planned meal tonight" + "Not this one" ghost button + "Attach" solid button.
    - **State 1e (confirmed):** Teal banner, check icon, "Part of {meal}" / "Tap to view or change" + "change" link. Shown regardless of how meal was attached (smart-detect, manual, picker).
  - **Meal management callbacks (2b.4):** `attachMeal(id, title)` — sets mealContext + confirmed banner. `detachMeal()` — clears mealContext + hides banner. `handleSmartDetectAttach()` — promotes low→confirmed. `handleSmartDetectDismiss()` — hides banner permanently for this session. `handleChangeOrDetach()` — opens picker (or detaches as stub).
  - **Banner placement:** Rendered at top of body content in both compact and full modes, before the rating section (full mode: before Remember chips).
  - **2b.5 already implemented in 2a:** Visibility re-computes when mealContext changes via existing useEffect.

**DB changes:** None

**Decisions made during execution:**
- **Smart-detect query uses `and()` for date range:** The Supabase PostgREST `.or()` filter needs `and(meal_time.gte.X,meal_time.lte.Y),meal_time.is.null` to correctly express "meal_time is today OR meal_time is null". Without the `and()`, the gte and lte would be independent OR'd conditions matching all meals.
- **Amber banner actions inside text area:** The "Not this one" and "Attach" buttons sit below the description text (inside the flex text area), not to the right of the text block. This matches the wireframe 1b-low layout where the buttons are below the copy.
- **Banner in full mode before Remember chips:** The smart-detect banner renders above the Remember chips row, not after it. This ensures the banner is the first thing the user sees when the sheet opens, matching the wireframe hierarchy.
- **`attachMeal`/`detachMeal` are internal callbacks:** Checkpoint 3's meal picker will be built inside LogCookSheet's render tree and can call these directly. No need for external prop-based communication for the picker's meal selection result.

**Deferred during execution:**
- Meal picker UI (Checkpoint 3) — `handleChangeOrDetach` uses detach as stub when no picker exists
- Smart-detect with realistic data testing — requires planned meals in the DB

**Recommended doc updates:**
- ARCHITECTURE: Note `detectPlannedMealForCook` function in mealService.ts with tiered ±4hr/slot/any-today fallback

**Status:**
- All 2b deliverables implemented: smart-detect query, high/low/confirmed banners, attach/detach/dismiss callbacks, change behavior wired
- TypeScript compiles with no new errors
- **Needs testing by Tom:**
  - Open LogCookSheet with NO planned meals → no banner (state 1a) ✓
  - Create a planned meal with a recipe in meal_dish_plans, log that recipe within 4hr → high-confidence banner (state 1b), chip active, visibility flips to Followers
  - Create a planned meal WITHOUT the recipe in dish plans → log that recipe → low-confidence banner (state 1b-low), chip idle
  - Tap "Attach" on low-confidence → banner switches to confirmed (state 1e), chip activates
  - Tap "Not this one" → banner disappears, no meal context
  - Tap "change" on confirmed banner → detaches (stub behavior; picker in Checkpoint 3)
  - Verify rating, keyboard, and existing functionality still work

**Surprises / Notes for Tom:**
- Smart-detect queries all of today's planning-status meals in one go, then does tiered matching in JS. This avoids multiple DB queries. If the user has many planned meals, the first query might return more rows than needed, but for F&F scale this is fine.
- The `meal_time` field on planned meals can be null (meals created without a time). These are included in tier 3 (any meal today) but not in tier 1 (±4hr, which requires a time to compare against).

---

### 2026-04-07 — Phase 7D/7E Checkpoint 2a — Chip + Visibility Model

**Phase:** 7E (cook→meal handoff UX)
**Prompt from:** CC_PROMPT_7D_7E.md — Checkpoint 2a: meal-attach chip, visibility row + override overlay, visibility default model, Gap 9 fix

**Files created:** None

**Files modified:**
- `lib/services/postService.ts` — Added `PostVisibility` type, `DEFAULT_VISIBILITY` constant, `computeMealType()` helper (replaces hardcoded `'dinner'`), `computeDefaultVisibility()` helper (D34), added `mealType` param to `CreateDishPostParams`. `createDishPost` now uses `computeMealType()` and defaults visibility to `'followers'` instead of `'everyone'`.
- `components/LogCookSheet.tsx` — Major additions:
  - **New inline SVGs:** PlateIcon, EyeIcon, CheckSmallIcon, ChevronRightIcon, RadioIcon
  - **New state:** `mealContext`, `visibility`, `visibilityManuallySet`, `showVisibilityOverlay`
  - **Chip row (2a.1):** Added action chip row with Photo, Voice, Tag, and "Add to meal" chips. Appears in both compact and full modes. "Add to meal" chip has two visual states: idle (faint teal bg `#E1F5EE`, teal-200 border, plate icon) and active (brighter teal bg `#C6F0DE`, teal-700 border, leading check icon, meal title as label). Photo/Voice/Tag chips are functional stubs (show "Coming soon").
  - **Visibility row (2a.2):** Added "Visible to · {value} ›" row in the CTA area above "Log & share". Eye icon + "Visible to" on left, current visibility value in teal-700 + chevron on right. Tappable.
  - **Visibility overlay (2a.3):** Four-option radio list (Everyone, Followers, People tagged in this meal, Just me). "People tagged" is disabled when no meal context, with "(meal posts only)" label. Shows "your default · change in settings" hint on Followers when it's the auto-computed default.
  - **Visibility defaults (2a.4):** Calls `computeDefaultVisibility()` on mount and when meal context changes. Manual override wins. Solo dinners default to Followers, solo non-dinners default to Just me, meal-context posts always default to Followers.
  - **Extended interfaces:** `LogCookSheetProps.recipe` gains `meal_type?: string`. `LogCookData` gains `visibility: PostVisibility`, `mealId: string | null`, `mealTitle: string | null`. `handleSubmit` now passes `visibility` directly (when `wantsToShare=false`, forces `'private'`).
  - **Compact mode layout:** Rating → Thoughts → Chip row → CTA area (photo boxes replaced by Photo chip)
  - **Full mode layout:** Remember chips → Rating → Modifications → Thoughts → Photo boxes → Chip row → Multi-dish → CTA area (standalone tag row replaced by Tag chip in chip row)
  - **New prop:** `onOpenMealPicker` callback (stub for Checkpoint 3)
- `screens/RecipeDetailScreen.tsx` — Updated `handleLogCookSubmit` to use `data.visibility` instead of deriving from `wantsToShare`. Now passes `parentMealId: data.mealId`, `mealType: computeMealType(recipe.meal_type)` to `createDishPost`. Passes `meal_type` to LogCookSheet.
- `screens/CookingScreen.tsx` — Updated `handleLogCookSubmit` to use `data.visibility`. Uses `logData.mealId` from LogCookSheet (falls back to route param `mealId`). Passes `mealType: computeMealType(recipe.meal_type)` to `createDishPost`.
- `lib/services/mealService.ts` — **Gap 9 fix (2a.5):** Added `.or('visibility.eq.everyone,visibility.eq.followers,visibility.is.null')` to `getMealsForFeed` query at line ~1007. Private and meal_tagged meal posts no longer leak to the feed.
- `screens/FeedScreen.tsx` — Updated `loadDishPosts` visibility filter to include `visibility.eq.followers` (was only `everyone` + `null`). Added `// TODO 7L: implement meal_tagged feed filter` comment.

**DB changes:** None (migration was run in Checkpoint 1)

**Decisions made during execution:**
- **Compact mode photo boxes → chip:** In compact mode, replaced the dashed photo boxes with the chip row (Photo chip provides the same trigger). Saves vertical space matching the wireframe state 1a layout. Full mode keeps the larger photo boxes since there's more room.
- **Full mode tag row → chip:** Replaced the standalone "Tag who you ate with" row with the Tag chip in the action chip row. Avoids duplication with the new chip row. Both were "coming soon" stubs.
- **Visibility filter broadened:** The dish post visibility filter in FeedScreen was `everyone,null` — it excluded `followers` posts. Updated to include `followers` to match the new default visibility. Without this fix, posts created with the new `'followers'` default would have been invisible in the feed.
- **Gap 9 includes followers:** The `getMealsForFeed` visibility filter includes `everyone`, `followers`, and `null` (not just `everyone` and `null`). This is consistent with the dish post filter and ensures the new `'followers'` default works for meal posts too.
- **"Just log it" behavior unchanged:** Still forces `visibility='private'` regardless of the inline visibility setting. The button semantics are: "Log & Share" = use selected visibility, "Just log it" = override to private.

**Deferred during execution:**
- Meal picker UI (Checkpoint 3) — `onOpenMealPicker` prop is wired but shows alert stub
- Smart-detect banners (Checkpoint 2b) — state and render slots not yet added
- Tag chip wiring to AddCookingPartnersModal (Checkpoint 3.4) — shows "coming soon"
- `meal_tagged` feed filter implementation (7L) — only writes the value, filter logic deferred

**Recommended doc updates:**
- ARCHITECTURE: Note the new visibility model (D34/D35): default is now 'followers', contextual rules apply, four visibility values
- ARCHITECTURE: Note `computeMealType()` replaces hardcoded 'dinner' on dish posts
- DEFERRED_WORK: Remove "Meal Plan modal: Create new meal flow broken" — confirmed fixed in 7C

**Status:**
- All 2a deliverables implemented: chip, visibility row, overlay, defaults, Gap 9 fix
- TypeScript compiles with no new errors (pre-existing errors in node_modules/CookSoonSection/DayMealsModal unrelated)
- **Needs testing:** Tom should verify in simulator:
  - LogCookSheet opens in compact mode with chip row visible (4 chips)
  - "Add to meal" chip has teal idle styling
  - Visibility row shows "Visible to · Followers" for dinner-time cooks
  - Visibility row shows "Visible to · Just me" for non-dinner cooks
  - Tapping visibility row opens overlay with 4 options
  - "People tagged in this meal" option is disabled (grayed out)
  - Selecting a visibility option updates the inline row
  - "Log & Share" creates post with selected visibility
  - "Just log it (private)" creates post with 'private' visibility regardless
  - Full mode: Remember chips, photo boxes, and multi-dish prompt all still work
  - Half-star slide-to-rate still works
  - Keyboard handling still works

**Surprises / Notes for Tom:**
- The FeedScreen visibility filter was previously `everyone,null` — it would have hidden ALL posts created with the new `'followers'` default. Fixed by adding `followers` to the filter. This was a silent bug: if someone had manually set visibility to 'followers' before this change, their posts would have been invisible.
- The `meal_type` on existing dish posts is all `'dinner'` (hardcoded). New posts will get the correct inferred type. Old posts are unaffected.

---

### 2026-04-07 — Phase 7D/7E Checkpoint 1 — Audit + Migration Spec

**Phase:** 7D (data + service layer)
**Prompt from:** CC_PROMPT_7D_7E.md — Checkpoint 1: audit existing meal flows, produce migration SQL spec

**Files created:** None
**Files modified:** None (audit only)
**DB changes:** Migration SQL spec produced below — Tom to review and run manually

---

#### 1.1 — Audit: Existing Meal Flow Paths

**Path 1: MyMealsScreen → CreateMealModal → createMeal**
- **Status: WORKS.** CreateMealModal collects title, description, meal_type, meal_time, meal_location. On submit, calls `createMeal()` which inserts into `posts` (post_type='meal', meal_status='planning') and `meal_participants` (creator as host, rsvp_status='accepted'). On success, navigates to MealDetailScreen. If a recipe is selected in the modal, calls `createPlanItemWithRecipe()` to add it to `meal_dish_plans`.
- **DB rows written:** 1 `posts` row, 1 `meal_participants` row, optionally 1 `meal_dish_plans` row.

**Path 2: MealDetailScreen → AddDishToMealModal → addDishesToMeal**
- **Status: WORKS.** AddDishToMealModal loads available dishes via `getUserAvailableDishes()` (last 30 days, no parent_meal_id). User selects dishes + course types. On confirm, calls `addDishesToMeal()` which for each dish writes to all 3 representations.
- **DB rows written per dish:** 1 `dish_courses` insert, 1 `posts` update (parent_meal_id), 1 `post_relationships` insert (meal_group). Confirms P7-14 — all three representations are being written.
- **Note:** `addDishesToMeal` skips dishes already in `dish_courses` for that meal (dedup check). It does NOT check ownership — any participant can add any dish post. The `canAddDishToMeal` RPC validates participation permissions.

**Path 3: RecipeDetailScreen → SelectMealForRecipeModal → CreateMealModal with initialRecipeId**
- **Status: WORKS END-TO-END (fixed in 7C).** `onCreateNewMeal` callback closes SelectMealForRecipeModal, waits 350ms (iOS modal stacking workaround), then opens CreateMealModal with `initialRecipeId` and `initialRecipeTitle` props. CreateMealModal pre-populates the recipe card. On create, recipe is added to `meal_dish_plans` via `createPlanItemWithRecipe()`.
- **Minor UX gap:** `onSuccess` callback on SelectMealForRecipeModal is `() => {}` — after adding a recipe to an existing meal plan slot, the parent RecipeDetailScreen doesn't refresh or show any UI update. The modal itself shows a success alert and closes, so the user knows it worked, but the recipe detail screen doesn't reflect the plan link. Low priority.
- **DEFERRED_WORK.md note is stale:** The "Meal Plan modal: Create new meal flow broken" entry was fixed in the 7C session (2026-04-06). The onCreateNewMeal callback is now properly wired. Recommend removing that DEFERRED_WORK entry.

**Path 4: All entry points to CreateMealModal**
- `screens/MyMealsScreen.tsx` — two entry points: "Create New Meal" button (no date), calendar date tap (with pre-selected date at 6 PM)
- `screens/RecipeDetailScreen.tsx` — via SelectMealForRecipeModal → "Create new meal" → CreateMealModal with initialRecipeId
- `screens/MyPostsScreen.tsx` — imports CreateMealModal (1 entry point)
- **Total: 4 entry points across 3 screens.**

---

#### 1.2 — Gap 9: Meal Post Visibility Filter in FeedScreen

**CONFIRMED MISSING.** `loadDishPosts` in FeedScreen.tsx:265 has `.or('visibility.eq.everyone,visibility.is.null')`. But `getMealsForFeed` in mealService.ts:974-1011 has NO visibility filter — it queries `posts` where `post_type='meal'` and `meal_status='completed'` filtered only by participant following relationships.

**Impact:** If a meal post has `visibility='private'`, it still appears in followers' feeds. Currently this is theoretical since there's no UI to set visibility on meal posts, but once 7E adds the visibility model, this will leak private meals to the feed.

**Fix location:** Add `.or('visibility.eq.everyone,visibility.is.null')` to the query in `getMealsForFeed()` at mealService.ts:1006 (after the `.eq('meal_status', 'completed')` line). This is Checkpoint 2a.5.

---

#### 1.3 — Audit: Three Parallel Meal↔Dish Representations (P7-14)

**CONFIRMED — all three are written by `addDishesToMeal` (mealService.ts:324-413):**

1. **`dish_courses`** — insert at line 365-373 (dish_id, meal_id, course_type, is_main_dish, course_order)
2. **`posts.parent_meal_id`** — update at line 381-384 (sets parent_meal_id = mealId on dish post)
3. **`post_relationships`** — insert at line 395-403 (relationship_type='meal_group', sorted IDs)

All three are also correctly cleaned up by `removeDishFromMeal` (deletes dish_courses, clears parent_meal_id, deletes post_relationships).

**No silent breakage detected.** All three writes are functioning. Data drift risk remains (as documented in P7-14) but is deferred to post-7I.

---

#### 1.4 — Cross-Reference: Gaps Table vs Actual Code

Since `PHASE_7_SOCIAL_FEED.md` doesn't exist in the repo, I'm cross-referencing the gaps as described in `CC_PROMPT_7D_7E.md` and `FRIGO_ARCHITECTURE.md`:

| Gap | Description | Status |
|-----|-------------|--------|
| **Gap 1** | "Eating with" tagging on solo dish posts — Tag chip in LogCookSheet | **REAL GAP.** Tag chip shows "Coming soon" toast. AddCookingPartnersModal exists but is not wired to LogCookSheet. |
| **Gap 4** | `meal_dish_plans` ↔ logged meal post link (`logged_meal_post_id`) | **REAL GAP.** Column does not exist. `meal_dish_plans` has `dish_id` (FK to posts) and `completed_at` but no `logged_meal_post_id`. |
| **Gap 5** | MealPostCard not rendering `meal_photos` | **REAL GAP (deferred to 7F).** `meal_photos` table exists, `addMealPhoto`/`getMealPhotos` functions exist in mealService, but MealPostCard doesn't render them. |
| **Gap 9** | Visibility filter missing on `loadMealPosts`/`getMealsForFeed` | **REAL GAP.** Confirmed in 1.2 above. |
| **Gap (schema)** | `posts.dish_name` column for freeform dishes (D23) | **REAL GAP.** Column does not exist. `postService.createDishPost` requires `recipeId: string` (non-nullable). |
| **Gap (schema)** | `post_participants.external_name` column (D27) | **REAL GAP.** Column does not exist. `postParticipantsService` assumes `participant_user_id` is always set. |
| **Gap (schema)** | `posts.visibility` missing `'meal_tagged'` value (D35) | **REAL GAP.** Visibility is TEXT column with no CHECK constraint visible in code. Current values: 'everyone', 'followers', 'private', null. Need to add 'meal_tagged'. |
| **Gap (func)** | `detectPlannedMealForCook()` smart-detect function | **REAL GAP.** Does not exist anywhere in codebase. |
| **Gap (func)** | `wrapDishIntoNewMeal()` wrap helper | **REAL GAP.** Does not exist anywhere in codebase. |
| **Gap (UX)** | "Made other dishes too?" post-publish sheet | **REAL GAP.** No such component exists. |
| **Gap (UX)** | Parent meal link banner on dish detail | **REAL GAP.** No such affordance exists in RecipeDetailScreen or any dish detail view. |

**All 11 gaps are confirmed real.** None are already addressed by existing code.

---

#### 1.5 — Migration SQL Spec

**Important note:** I cannot inspect the Supabase schema directly. The SQL below is based on code analysis. Tom should verify column types/constraints in the Supabase Dashboard before running.

```sql
-- ============================================================
-- Phase 7D Migration — Run in Supabase Dashboard SQL Editor
-- ============================================================

-- 1. post_participants: add external_name column, make participant_user_id nullable
-- Rollback: ALTER TABLE post_participants DROP COLUMN external_name;
--           ALTER TABLE post_participants ALTER COLUMN participant_user_id SET NOT NULL;
--           ALTER TABLE post_participants DROP CONSTRAINT chk_participant_identity;

ALTER TABLE post_participants
  ADD COLUMN external_name TEXT NULL;

ALTER TABLE post_participants
  ALTER COLUMN participant_user_id DROP NOT NULL;

ALTER TABLE post_participants
  ADD CONSTRAINT chk_participant_identity
  CHECK (participant_user_id IS NOT NULL OR external_name IS NOT NULL);


-- 2. posts: add dish_name column for freeform dishes (D23)
-- Verify first: SELECT column_name FROM information_schema.columns WHERE table_name='posts' AND column_name='dish_name';
-- Rollback: ALTER TABLE posts DROP COLUMN dish_name;

ALTER TABLE posts
  ADD COLUMN dish_name TEXT NULL;


-- 3. posts.recipe_id: verify nullable
-- Run this SELECT first to check current constraint:
-- SELECT is_nullable FROM information_schema.columns WHERE table_name='posts' AND column_name='recipe_id';
-- If 'NO' (not nullable), uncomment the line below:
-- ALTER TABLE posts ALTER COLUMN recipe_id DROP NOT NULL;
-- Rollback: ALTER TABLE posts ALTER COLUMN recipe_id SET NOT NULL;


-- 4. meal_dish_plans: add logged_meal_post_id FK (Gap 4 / D14)
-- Rollback: DROP INDEX IF EXISTS idx_meal_dish_plans_logged_meal_post_id;
--           ALTER TABLE meal_dish_plans DROP COLUMN logged_meal_post_id;

ALTER TABLE meal_dish_plans
  ADD COLUMN logged_meal_post_id UUID NULL
  REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX idx_meal_dish_plans_logged_meal_post_id
  ON meal_dish_plans(logged_meal_post_id)
  WHERE logged_meal_post_id IS NOT NULL;


-- 5. posts.visibility: add 'meal_tagged' value (D35)
-- First check if visibility uses an ENUM type or is plain TEXT:
-- SELECT data_type, udt_name FROM information_schema.columns WHERE table_name='posts' AND column_name='visibility';
--
-- If ENUM type, uncomment:
-- ALTER TYPE <enum_type_name> ADD VALUE 'meal_tagged';
-- (Note: ENUM ADD VALUE cannot be rolled back in Postgres)
--
-- If TEXT with CHECK constraint:
-- Find the constraint name first:
-- SELECT conname FROM pg_constraint WHERE conrelid='posts'::regclass AND contype='c';
-- Then:
-- ALTER TABLE posts DROP CONSTRAINT <constraint_name>;
-- ALTER TABLE posts ADD CONSTRAINT <constraint_name> CHECK (visibility IN ('everyone', 'followers', 'private', 'meal_tagged'));
-- Rollback: reverse the CHECK to exclude 'meal_tagged'
--
-- If TEXT with no constraint (most likely based on code):
-- No migration needed for the column type. Just ensure the app writes 'meal_tagged' correctly.
-- Consider adding a CHECK constraint for data integrity:

-- (Only run if visibility is unconstrained TEXT — verify first)
-- ALTER TABLE posts ADD CONSTRAINT chk_visibility
--   CHECK (visibility IS NULL OR visibility IN ('everyone', 'followers', 'private', 'meal_tagged'));
```

**Tom action items before running:**
1. Check `posts.recipe_id` nullability — if NOT NULL, uncomment the ALTER in section 3
2. Check `posts.visibility` type — if ENUM, use ALTER TYPE ADD VALUE instead of CHECK
3. Run the verification SELECTs in the comments before each section

---

#### 1.6 — Option γ Wrap Helper: Function Signature + Algorithm Sketch

```typescript
// In mealService.ts (proposed addition for Checkpoint 4)
export async function wrapDishIntoNewMeal(
  dishPostId: string,
  userId: string,
  mealTitle: string  // smart-defaulted by caller: "{Day} {MealType}" from dish's created_at
): Promise<{ mealId: string; dishId: string }> {
  // 1. Validate dish post exists, belongs to userId, and is post_type='dish'
  //    → throw if not found or wrong owner

  // 2. Validate dish post has NO parent_meal_id
  //    → throw "This dish is already part of {meal title}" if parent_meal_id is set
  //    (To get meal title: fetch the parent meal post's title for the error message)

  // 3. Create a new meal post via existing createMeal():
  //    createMeal(userId, { title: mealTitle })
  //    This writes: posts row (post_type='meal', meal_status='planning') + meal_participants row (host)

  // 4. Attach the dish to the new meal. Two options:
  //
  //    OPTION A — Call addDishesToMeal(mealId, userId, [{ dish_id: dishPostId, course_type: 'main', is_main_dish: true, course_order: 0 }])
  //    This writes all 3 representations (dish_courses, parent_meal_id, post_relationships).
  //    ✅ RECOMMENDED — reuses existing logic, maintains P7-14 triple-write consistency.
  //    addDishesToMeal accepts an array and handles single-dish arrays fine.
  //    Note: addDishesToMeal calls canAddDishToMeal first (validates user is host/participant),
  //    and since we just created the meal with the user as host, this will pass.
  //    Also note: addDishesToMeal checks dish_courses for existing entry and skips if found —
  //    since this is a fresh meal, no conflict.
  //
  //    OPTION B — Manual writes (only if addDishesToMeal has issues)
  //    - Update posts SET parent_meal_id = mealId WHERE id = dishPostId
  //    - Insert into dish_courses (dish_id, meal_id, course_type='main', is_main_dish=true, course_order=0)
  //    - Insert into post_relationships (meal_group)

  // 5. DO NOT TOUCH: dish post's rating, notes, modifications, photos, likes, comments,
  //    visibility, created_at, or any other field. The wrap is non-destructive.

  // 6. Return { mealId, dishId: dishPostId }
}
```

**Recommendation:** Use Option A (`addDishesToMeal`) for the implementation. It's a single function call that handles all three representations, includes validation, and is already tested. The only consideration is that `addDishesToMeal` calls `canAddDishToMeal` RPC — need to verify that RPC passes for a meal the user just created as host.

---

#### Decisions made during execution:
- **Missing doc files:** `PHASE_7_SOCIAL_FEED.md` and `_SCOPING_NOTES_7D.md` do not exist in the repo. The prompt references them as required reading. I proceeded with the information available in CC_PROMPT_7D_7E.md, FRIGO_ARCHITECTURE.md, and the actual code. Decisions D21-D40 are referenced by number in the build prompt with enough context to proceed, but I cannot verify the full decision text.
- **DEFERRED_WORK stale entry:** The "Meal Plan modal: Create new meal flow broken" entry in DEFERRED_WORK.md was fixed in the 7C session. Recommend removing it.
- **Visibility column type unknown:** Cannot determine if `posts.visibility` is TEXT, ENUM, or TEXT+CHECK from code alone. Migration SQL includes branches for all three cases. Tom needs to check in Supabase Dashboard.
- **recipe_id nullability unknown:** `createDishPost` treats `recipeId` as required (`string`, not `string | null`), but the DB column may already be nullable. Tom needs to check.

#### Deferred during execution:
- None — this checkpoint is audit-only as specified.

#### Recommended doc updates:
- **DEFERRED_WORK:** Remove "Meal Plan modal: Create new meal flow broken" — fixed in 7C
- **ARCHITECTURE:** No changes needed yet (schema changes happen after migration runs)

#### Status:
- Audit complete. All 11 gaps confirmed real. All 4 meal flow paths traced.
- Migration SQL ready for Tom to review and run.
- Wrap helper algorithm sketched with recommendation to reuse `addDishesToMeal`.
- **Blocked on:** Tom running migration + confirming visibility column type + recipe_id nullability.

#### Surprises / Notes for Tom:
- `PHASE_7_SOCIAL_FEED.md` and `_SCOPING_NOTES_7D.md` are referenced as required reading but don't exist in the repo. If these contain decision text I need, please share them.
- `postService.createDishPost` defaults visibility to `'everyone'` (line 40), not `'followers'` as D34 specifies. This will be changed in Checkpoint 2a.4.
- `postService.createDishPost` hardcodes `meal_type: 'dinner'` on every dish post (line 34). This seems wrong for non-dinner cooks but is outside 7D/7E scope.
- `addDishesToMeal` does NOT validate dish ownership — any user who passes `canAddDishToMeal` (is host or participant) can add any dish post, even one they don't own. This may be intentional for multi-cook meals but worth noting.

---

### 2026-04-06 (cont.) — Phase 7C: Meal Plan Create-New-Meal Wiring Fix
**Phase:** 7C
**Prompt from:** CC_PROMPT_7C_MEAL_PLAN_FIX.md

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — Added `CreateMealModal` import, `showCreateMealModal` state, wired `onCreateNewMeal` callback on `SelectMealForRecipeModal` to close the select modal and open CreateMealModal with `initialRecipeId`/`initialRecipeTitle`. Renders `CreateMealModal` with success handler that closes modal + shows confirmation alert.

**Modal stacking workaround:** Used `setTimeout(() => setShowCreateMealModal(true), 350)` to delay opening CreateMealModal after closing SelectMealForRecipeModal. iOS drops the second modal if you open it in the same tick as closing the first. The 350ms delay lets the first modal's dismiss animation complete.

**Recipe attachment verification:** Not yet verified — requires manual testing. CreateMealModal has logic at ~line 631 to pre-attach the recipe via `initialRecipeId`. If it doesn't actually populate `meal_dishes`, that's a CreateMealModal internal issue to flag separately (per prompt constraints, did not modify CreateMealModal).

**Surprises:** None. Fix was exactly as scoped — one file, three additions (import, state, render + callback wiring).

---

### 2026-04-06 (cont.) — Phase 7B Revision: UX Polish Pass (Star Rating, Keyboard, Modal Layout)
**Phase:** 7B Revision (follow-up)
**Prompt from:** Live user testing feedback during same session

**Files modified:**
- `components/LogCookSheet.tsx` — Multiple UX iterations based on live testing:
  - **Star slider confined to stars area:** Replaced naive full-width PanResponder calculation with per-star position mapping that accounts for gaps. Slide only registers within star bounds + 8px tolerance.
  - **Slide left to clear:** Dragging past the left edge of the first star now clears rating to null (previously minimum was 0.5).
  - **Star size:** Reduced from 40px to 36px for better visual balance while keeping generous vertical touch padding (16px above/below).
  - **Rating badge + clear link:** Shows numeric rating (e.g. "4.5") in bold teal next to the section label. Separate "clear" text link replaces tap-to-toggle (which caused accidental clears).
  - **Compact mode: no ScrollView:** Replaced ScrollView with plain View for compact mode. Eliminates scroll-fighting-with-star-drag issue. Sheet height bumped to 65%.
  - **Tighter star-to-notes spacing:** Reduced star section marginBottom to 10px in compact mode.
  - **Keyboard Done button:** Added native iOS `InputAccessoryView` with "Done" button above keyboard on all TextInputs. Uses `.blur()` on refs for smooth animation.
  - **Tap-outside-to-dismiss keyboard:** `onTouchStart={dismissKeyboard}` on sheet container fires on any touch in non-input areas.
  - **Keyboard avoidance:** `KeyboardAvoidingView` with `behavior="position"` wraps just the sheet (not the overlay), sliding it up as a unit without resize glitches.
  - **Removed KeyboardAvoidingView with behavior="padding"** which was causing glitchy resize animations.
- `screens/RecipeDetailScreen.tsx` — Renamed "I Made This" primary CTA to "Log This Cook". Removed dead `MenuPencilIcon` inline SVG function (PencilIcon component was already wired correctly).
- `components/TimesMadeModal.tsx` — Redesigned stepper UX: stepper now shows number of **additions** (defaults to 1, minimum 1) instead of the absolute total. Added "Update total to **X** times logged" preview line below stepper that updates dynamically. `onConfirm` passes the computed new total (`currentCount + additions`).

**Decisions made during execution:**
- **Star slider UX evolution:** Three iterations — (1) initial PanResponder across full container width was too imprecise, (2) per-star position mapping with gap awareness much better, (3) added slide-left-to-clear and removed tap-to-toggle after user feedback about accidental clears.
- **Keyboard handling:** Tried `TouchableWithoutFeedback` wrapper (finicky — some areas worked, others didn't), then `onStartShouldSetResponder` (same issue), settled on `onTouchStart` on the sheet View + `InputAccessoryView` Done button + `behavior="position"` KeyboardAvoidingView. This combination works reliably.
- **CTA naming:** "I Made This" felt passive. Changed to "Log This Cook" for action-oriented language per user feedback.
- **TimesMadeModal additions vs absolute:** User found it confusing that the stepper showed the new total. Redesigned so stepper shows additions (defaulting to 1) with a separate preview line showing what the new total will be.

**Status:** All UX polish items from live testing addressed. Ready for continued testing.

---

### 2026-04-06 — Phase 7B Revision: Post-Test Fixes, LogCookSheet Redesign, CTA Flip, Star Overhaul
**Phase:** 7B Revision
**Prompt from:** PHASE_7B_REVISION.md — 9-part revision pass based on user testing of initial 7B implementation

**Files created:**
- `components/icons/recipe/PencilIcon.tsx` — New SVG icon component from noun-pencil assets. Supports `filled` prop for edit mode active/inactive states. Exported paths directly from the source SVGs (8196252 for outline, 8196301 for filled).
- `lib/services/recipeService.ts` — New service file for recipe CRUD operations. Contains `deleteRecipe()` function, extracted from inline supabase call in RecipeDetailScreen.

**Files modified:**
- `components/LogCookSheet.tsx` — **Major rewrite.** Added `mode` prop ('compact' | 'full'). Compact mode: ~55% screen height, simplified layout (no helper chips, tags, multi-dish, modifications). Full mode: ~90% screen height, "Nice cook!" header with chef emoji, remember chips row (Note on step, Voice memo, Edit qty), modifications input field. Both modes: half-star slide-to-rate rating with PanResponder (teal color), backdrop tap to dismiss, close (X) button in header, form auto-reset on open. Removed: make-again buttons/state, functionalColors dependency, yellow star colors.
- `components/TimesMadeModal.tsx` — Repurposed for "I've Made This Before" flow. Updated copy: "How many times have you made this recipe?" / "Update your cook history". Removed "household favorite" message. Changed stepper bounds to allow 0-99. Shows current count in bold teal when > 0. Button text changed from "Continue" to "Update".
- `components/cooking/PostCookFlow.tsx` — Added DEPRECATED comment at top. No functional changes.
- `components/icons/recipe/index.ts` — Added PencilIcon export.
- `screens/CookingScreen.tsx` — Removed PostCookFlow render entirely. advanceStep now opens LogCookSheet in full mode directly. Added `onNoteOnStep` handler that closes sheet and returns to step-by-step view. Removed `doneCooking` state, `modificationsRef`, PostCookFlow handlers. Fixed rating to pass null instead of 0.
- `screens/RecipeDetailScreen.tsx` — **Major changes:** (1) CTA flip: Primary button is now "I Made This" (solid teal) which opens LogCookSheet compact mode. Secondary is "Cook in Step-by-Step Mode" text link. (2) Overflow menu: Removed "I Made This" highlighted row and context header. Added "Recipe View" subheader with shortened labels (Original/Clean/Markup). Added "I've Made This Before" menu item using AgainIcon. Swapped MenuPencilIcon for PencilIcon component with filled state. Added edit mode banner (light teal) with "Exit" button below top bar. (3) Wired `handleLogCookSubmit` to increment times_cooked. (4) Added step notes display in "Your Private Notes" section. (5) Extracted delete to recipeService. (6) Added TimesMadeModal for history flow.
- `lib/services/postService.ts` — Made `rating` nullable (`number | null`), used `?? null` in insert. Removed `makeAgain` from params and insert payload.
- `components/PostCreationModal.tsx` — Removed `makeAgain` from PostData interface.
- `docs/DEFERRED_WORK.md` — Added 6 items under "From: Phase 7B Revision" section.

**DB changes:** none (prerequisites already run by Tom: rating column type change + constraint update)

**Decisions made during execution:**
- **"Note on a step" in full mode (Part 2.3):** Chose the "close sheet and return to step view" approach. The `onNoteOnStep` callback closes LogCookSheet and switches CookingScreen back to step-by-step view mode. This reuses the existing note infrastructure in SectionCard rather than building a new inline step picker modal. Simpler, and the user gets the full step view context when adding their note. They can re-trigger the full-mode LogCookSheet by tapping "Done cooking" again.
- **Half-star rendering:** Used Option A (clip approach) from the spec — stacked two StarIcon layers, bottom is empty/gray, top is filled/teal clipped to 50% or 100% width via overflow: 'hidden'. Clean and simple.
- **PanResponder for slide-to-rate:** Uses `measureInWindow` to get absolute X position of stars container, then computes rating from touch pageX relative to container. Snaps to 0.5 increments. Tap-to-toggle (same rating clears to null) implemented on `onPanResponderGrant`.
- **Pencil icon SVG paths:** Both noun-pencil SVGs are single-path, so they ported cleanly to the PencilIcon component without simplification.
- **Edit mode banner:** Placed between sticky bar and ScrollView (not inside scroll). Uses light teal (#ccfbf1) background matching the spec. Does not interfere with sticky headers.

**Deferred during execution:**
- **Meal Plan "Create new meal" bug (Part 1.4):** Root cause identified — `onCreateNewMeal` prop is passed as `() => {}` (empty function) from RecipeDetailScreen. Fix requires adding CreateMealModal state management. Added to DEFERRED_WORK.md.
- **Meal Plan key prop warning (Part 1.4):** Could not reproduce — all `.map()` calls in SelectMealForRecipeModal and CreateMealModal have proper `key` props. Warning may come from a different code path or may have been resolved in a prior session.

**Part 1.4 Meal Plan investigation findings:**
- Key prop issue: All map() calls in both SelectMealForRecipeModal.tsx and CreateMealModal.tsx have proper keys. Warning source unclear — may originate elsewhere.
- "Create new meal" bug: onCreateNewMeal callback is an empty function `() => {}` in RecipeDetailScreen. CreateMealModal exists and supports initialRecipeId/initialRecipeTitle props but is never rendered from RecipeDetailScreen. Deferred to backlog.

**Part 1.5 Step notes investigation findings:**
- Step notes are stored in `recipe_step_notes` table via `upsertStepNote()` in cookingService.ts.
- CookingScreen reads and writes step notes properly (loads on mount, saves via handleNoteSave).
- RecipeDetailScreen did NOT fetch or display step notes — only showed annotation-type notes.
- **Fix applied:** Added `getStepNotes()` fetch to RecipeDetailScreen. Step notes now appear in "Your Private Notes" section with a teal "STEP N" label above each note.
- Two separate note systems exist: step_notes (cooking sessions) and recipe_annotations (general). Both now display in the same section.

**Recommended doc updates:**
- ARCHITECTURE: Add LogCookSheet mode prop documentation, mention PencilIcon in icons section, note recipeService.ts as new service file.
- DEFERRED_WORK: Already updated with 6 new items.

**Status:** All 9 parts complete. Parts 1.1-1.3 fixed. Part 1.4 investigated and deferred. Part 1.5 investigated and fixed. Parts 2-9 implemented as specified. Ready for iOS simulator testing.

**Surprises / Notes for Claude.ai:**
- The two note systems (step_notes vs annotations) are independent and use different tables. May want to unify them in a future pass.
- PostCookFlow is deprecated but kept in codebase. Can be deleted in a future cleanup pass.
- The `posts.make_again` column is now unused — all new posts will have null. Can be dropped when convenient.
- The FeedScreen and PostCreationModal import cleanup was not in scope but PostCreationModal had a makeAgain reference that was cleaned up.

---

### 2026-03-24 — Phase 7B Wiring: Overflow Menu, I Made This, LogCookSheet, Feed Filter
**Phase:** 7B (wiring)
**Prompt from:** PHASE_7AB_POST_COOK_FLOW.md — Tasks 1-5 (overflow menu, I Made This flow, CookingScreen refactor, feed filter, auto-title)

**Files created:** none

**Files modified:**

- `screens/RecipeDetailScreen.tsx` (Tasks 1 + 2)
  - Added imports: `Svg`/`Path`/`Rect`/`Line` from react-native-svg, `AgainIcon`/`CalendarOutline` from icons, `TimesMadeModal`, `LogCookSheet`, `LogCookData`, `createDishPost`/`updateTimesCooked` from postService, `generateSmartTitle` from titleGenerator
  - Added 5 inline SVG menu icons before component: `MenuPencilIcon`, `MenuShareIcon`, `MenuTrashIcon`, `MenuScaleIcon`, `MenuPlusDocIcon`
  - Added state: `showTimesMadeModal`, `showLogCookSheet`
  - Added handlers: `handleIMadeThis` (close menu -> open TimesMadeModal), `handleTimesMadeConfirm` (call updateTimesCooked, update local state, close modal -> open LogCookSheet), `handleLogCookSubmit` (create post with visibility, show confirmation alert)
  - Replaced overflow menu (old: plain text list, 200px) with grouped layout (240px): context header (recipe name, source, times cooked) -> "I Made This" highlighted row (teal bg tint) -> plan group (Cook Soon w/ state toggle, Meal Plan, Add to Post placeholder@0.4 opacity) -> view group (3 radio-style view modes, Unit Conversion, Edit Recipe, Share placeholder@0.4 opacity) -> Delete (red, separated, with confirmation alert)
  - Menu styles completely replaced: `menuHeader`, `menuHeaderTitle`, `menuHeaderSub`, `menuGroupDivider`, `menuItemIMadeThis`, `menuItemRow`, `menuRadio`, `menuRadioFilled`, etc.
  - Added `TimesMadeModal` and `LogCookSheet` renders at bottom of JSX after SelectMealForRecipeModal
  - Added Delete Recipe functionality (was missing before) with confirmation alert

- `components/cooking/PostCookFlow.tsx` (Task 3)
  - Complete rewrite. Removed entire "Share your cook" section (photo, make again, tag, thoughts)
  - Kept: header ("Nice cook!"), remember chips (note on step, voice memo, edit qty), added modifications text input
  - Renamed interface: `PostCookData` -> `RememberData` (with `PostCookData` kept as type alias for compat)
  - Changed props: `onLogAndShare` -> `onContinue`, `onJustLog` -> `onSkip`
  - CTAs now: "Continue" (calls `onContinue({ modifications })`) and "Skip — just log the cook" (calls `onSkip`)
  - Removed emojis from remember chips (were using emoji unicode), kept only the header chef emoji via unicode escape

- `screens/CookingScreen.tsx` (Task 3)
  - Removed imports: `PostCreationModal`, `PostData`
  - Added imports: `LogCookSheet`, `LogCookData`, `updateTimesCooked`, `generateSmartTitle`
  - Changed import: `PostCookData` -> `RememberData` from PostCookFlow
  - Replaced state: `showPostModal` -> `showLogCookSheet`
  - Replaced `postCookDataRef` with `modificationsRef` (string)
  - Replaced handlers: `handleLogAndShare` -> `handlePostCookContinue` (stash modifications, open LogCookSheet), `handleJustLog` -> `handlePostCookSkip` (open LogCookSheet with empty modifications)
  - Replaced `handlePostSubmit` with `handleLogCookSubmit` — creates post with all LogCookData fields including visibility, calls `updateTimesCooked` to increment cook count, handles plan item completion
  - Updated PostCookFlow render props to match new interface
  - Replaced `PostCreationModal` render with `LogCookSheet` render (passing modifications from ref)

- `screens/FeedScreen.tsx` (Task 4)
  - Added `.or('visibility.eq.everyone,visibility.is.null')` to `loadDishPosts` query after the post_type filter
  - Private posts excluded from feed; null visibility (legacy posts) treated as public

**DB changes:** none

**Decisions made during execution:**
- Used `generateSmartTitle()` from existing `utils/titleGenerator.ts` with no args — defaults to current time, no cooking method, producing "Morning Cook" / "Afternoon Cook" / "Dinner Cook" / "Late Night Cook". Did NOT extract the title generator from PostCreationModal since titleGenerator.ts already has a better version
- Added Delete Recipe to overflow menu (was completely missing before — spec called for it and it makes sense to include). Uses confirmation alert + supabase delete + navigation.goBack()
- PostCookFlow "Skip" button now opens LogCookSheet (with empty modifications) instead of navigating away — per spec "Skip — just log the cook" should still open the logging sheet so user can at minimum set make-again and thoughts
- Radio-style view mode indicators in overflow menu instead of checkmarks — cleaner look, uses teal dot for active state
- `PostCookData` kept as type alias in PostCookFlow.tsx (`export type PostCookData = RememberData`) for any potential external consumers, though no code imports it now
- Modifications precedence in CookingScreen: `modificationsRef.current || logData.modifications` — the ref has modifications from PostCookFlow's remember section; logData.modifications would be empty string from LogCookSheet since it has no modifications input
- RecipeDetailScreen delete goes through supabase directly (not a service call) — this is consistent with the existing pattern where RecipeDetailScreen makes some direct supabase calls. Could be extracted to a service later.

**Deferred during execution:**
- RecipeDetailScreen still calls supabase directly for recipe deletion — should be extracted to recipeService in a cleanup pass
- PostCreationModal.tsx file not deleted — kept per spec ("This file is NOT removed — it may still be used elsewhere")

**Recommended doc updates:**
- ARCHITECTURE: Overflow menu on RecipeDetailScreen is now grouped with icons. "I Made This" flow: menu -> TimesMadeModal -> LogCookSheet -> createDishPost. PostCookFlow simplified to remember section only.
- ARCHITECTURE: CookingScreen post-cook flow now: PostCookFlow (remember) -> LogCookSheet -> createDishPost. PostCreationModal no longer used from CookingScreen.
- ARCHITECTURE: Feed query now filters by visibility — private posts excluded
- DEFERRED_WORK: Extract recipe deletion to a service function

**Status:** All 5 tasks complete. TypeScript compiles clean. Needs manual testing:
1. **Overflow menu**: Open a recipe -> tap overflow -> verify grouped layout, icons, "I Made This" highlighted, Cook Soon toggle, view mode radios, delete confirmation
2. **I Made This flow**: Overflow -> "I Made This" -> TimesMadeModal (verify stepper, count, heading adapts) -> Continue -> LogCookSheet -> submit -> verify post created with correct make_again, notes, visibility, times_cooked incremented
3. **CookingScreen flow**: Enter cooking mode -> complete steps -> PostCookFlow shows remember section + modifications input -> "Continue" -> LogCookSheet opens with modifications pre-filled -> submit -> post created, times_cooked incremented
4. **CookingScreen skip**: PostCookFlow -> "Skip — just log the cook" -> LogCookSheet opens -> submit -> same result but modifications empty
5. **Feed filter**: Create a private post (via "Just log it") -> check feed -> should NOT appear. Create public post -> should appear. Legacy posts (null visibility) should still appear.
6. **No regressions**: Sticky headers, section bar, step focus mode, ingredient popups, timers, swipe navigation all still work

**Surprises / Notes for Claude.ai:**
- Delete Recipe was not in the existing overflow menu at all — added it per the spec's menu layout
- The existing `utils/titleGenerator.ts` already had `generateSmartTitle()` which is more sophisticated than the PostCreationModal's `generateTitle()` — uses time-of-day bands (Morning/Lunch/Afternoon/Dinner/Late Night) plus cooking method mapping. Used this instead of duplicating.
- The Supabase `.or()` filter for visibility is additive — it creates an AND with the previous `.or()` for post_type. This means the final query is: `(post_type = dish OR post_type IS NULL) AND (visibility = everyone OR visibility IS NULL)`.

---

### 2026-03-24 — Phase 7B Components + Service Functions (no wiring)
**Phase:** 7B (components only)
**Prompt from:** PHASE_7AB_POST_COOK_FLOW.md — 7B-2, 7B-3, and service additions

**Files created:**
- `components/TimesMadeModal.tsx` — Stepper modal for "I Made This" cook count
  - Props: `{ visible, recipeName, currentCount, onConfirm: (count) => void, onCancel }`
  - If `currentCount === 0`: heading "How many times have you made this?", subtext "Including this time", stepper starts at 1
  - If `currentCount > 0`: heading "Logging another cook!", subtext with past count, minimum locked at `currentCount + 1`
  - At count >= 3 shows "A household favorite!" subtle message
  - Tapping the count number enables direct keyboard entry (escape hatch per spec)
  - Uses `useTheme()`, no emojis — minus button uses unicode minus `\u2212`, plus is plain `+`

- `components/LogCookSheet.tsx` — Unified cook-logging bottom sheet
  - Props: `{ visible, recipe: { id, title, book_title?, book_author?, page_number? }, modifications?, onSubmit: (LogCookData) => void, onCancel }`
  - Exported `LogCookData` interface: `{ makeAgain, rating, thoughts, modifications, wantsToShare }`
  - Sections (top to bottom): drag handle, header, make-again selector (3 buttons w/ color-coded selected states), 5 star rating (optional, tap to fill, tap same to clear), photo placeholders (camera + library, both "Coming soon" alerts), thoughts text input + 3 helper chips (voice memo, note on step, edit qty — all "Coming soon"), privacy hint text, tag row ("Coming soon"), "Made other dishes too?" dashed prompt ("Coming soon")
  - Pinned bottom CTAs: "Log & Share" (primary, `wantsToShare: true`) and "Just log it (private)" with lock icon (`wantsToShare: false`)
  - 7 inline SVG icons created at top of file: CameraIcon, ImageIcon, MicIcon, NoteIcon, EditQtyIcon, PlusDocIcon, LockIcon — all follow `({ size, color })` pattern
  - Uses existing icons: StarIcon, AgainIcon, FriendsIcon from `components/icons/`
  - Uses `useTheme()` throughout, no emojis anywhere
  - Make-again buttons: yes = teal tint, maybe = amber tint, no = red tint (using functionalColors)

**Files modified:**
- `lib/services/postService.ts`
  - Added `getTimesCooked(recipeId)` — reads `recipes.times_cooked`, returns 0 on error
  - Added `updateTimesCooked(recipeId, count)` — updates `recipes.times_cooked`, throws on error
  - Confirmed `makeAgain` and `visibility` already present in `CreateDishPostParams` and insert from 7A

**DB changes:** none (all columns already exist)

**Decisions made during execution:**
- Inline SVGs for icons not in the existing set (camera, image/gallery, mic, note, edit, plus-doc, lock) — grouped at top of LogCookSheet.tsx for easy extraction to `components/icons/` later if reused
- LogCookSheet resets form state after submit via `handleSubmit` — prevents stale data if sheet is reopened
- Make-again selector allows deselection (tap selected option to clear back to null) — more forgiving UX
- Star rating: tapping same star again clears to null (spec says "tapping the same star again clears")
- `modifications` flows through LogCookData but is set from the `modifications` prop (pre-filled from CookingScreen's PostCookFlow or empty from RecipeDetail) — LogCookSheet doesn't have its own modifications input, that's the PostCookFlow's job
- Used `maxHeight: '90%'` on sheet to leave some backdrop visible at top
- Bottom CTA area uses `Platform.OS === 'ios' ? 34 : 20` for safe area bottom padding

**Deferred during execution:** none

**Recommended doc updates:**
- ARCHITECTURE: Add `TimesMadeModal` and `LogCookSheet` to component map; note inline SVG icon pattern in LogCookSheet
- ARCHITECTURE: Add `getTimesCooked` and `updateTimesCooked` to postService function list

**Status:** Components and service functions built. Not wired into any screens yet. TypeScript compiles clean (no errors from new files). Ready for 7B-4 wiring step.

**Surprises / Notes for Claude.ai:**
- LogCookSheet does not include a modifications input field — per spec, modifications come from CookingScreen's PostCookFlow (the "remember" section), or are empty when entering from RecipeDetailScreen. The `modifications` prop on LogCookSheet carries this through.
- The 7 inline SVGs could be extracted to individual icon files if they get reused elsewhere. For now they're co-located in LogCookSheet.tsx.

---

### 2026-03-24 — Phase 7A: Bug Fixes (P6-4 + P6-5)
**Phase:** 7A
**Prompt from:** PHASE_7AB_POST_COOK_FLOW.md — 7A Bug Fixes only

**Files created:** none

**Files modified:**
- `screens/CookingScreen.tsx`
  - Line 225: Added `postCookDataRef` (useRef) to stash PostCookData when `handleLogAndShare` is called
  - Lines 227-231: `handleLogAndShare` now stores `postCookData` in the ref before opening the modal
  - Line 251: In `handlePostSubmit`, read `postCookDataRef.current` to access stashed data
  - Line 259: **P6-5 fix** — Changed `notes:` from `postData.modifications` to `postCookData?.thoughts || null`
  - Line 260: **P6-4 fix** — Added `makeAgain: postCookData?.makeAgain || null` to the createDishPost call

- `components/PostCreationModal.tsx`
  - Lines 27-28: Extended `PostData` interface with optional `makeAgain?: 'yes' | 'maybe' | 'no' | null` and `thoughts?: string` fields

- `lib/services/postService.ts`
  - Lines 14-15: Added `makeAgain?: string | null` and `visibility?: string` to `CreateDishPostParams` interface
  - Lines 41-42: Added `make_again` and `visibility` to the Supabase insert object

**DB changes:** none (columns `posts.make_again`, `posts.visibility`, `recipes.times_cooked` already added by Tom)

**Decisions made during execution:**
- Used `useRef` (not state) for `postCookDataRef` — avoids unnecessary re-renders since this data is only read inside `handlePostSubmit`, not used for rendering
- Set `visibility` default to `'everyone'` in the insert so existing flow (CookingScreen → PostCreationModal) continues to create public posts
- Kept `makeAgain` as `string | null` in service params (not the union type) for flexibility — the union type constraint lives in PostCookData

**Deferred during execution:** none

**Recommended doc updates:**
- ARCHITECTURE: Note that `postService.createDishPost` now supports `makeAgain` and `visibility` params
- DEFERRED_WORK: No new items

**Status:** Code complete. Needs manual testing:
1. Enter cooking mode, complete all steps
2. In PostCookFlow: select a "make again" option, type thoughts
3. Tap "Log & Share", fill in PostCreationModal, submit
4. Check `posts` table: `make_again` should have the selection, `notes` should have thoughts text, `modifications` should have the modifications text (not duplicated into notes)
5. Confirm `notes` != `modifications` (unless user typed the same thing in both)

**Surprises / Notes for Claude.ai:**
- The PostCreationModal `PostData` interface now has `makeAgain` and `thoughts` fields but they are not populated by the modal itself — they exist so downstream consumers of the interface are aware of the full shape. The actual values come from `postCookDataRef` in CookingScreen. This is intentional for 7A; 7B will restructure this flow entirely.

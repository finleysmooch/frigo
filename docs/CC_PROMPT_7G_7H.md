# CC Prompt: Phase 7G + 7H — Historical Cook Logging + My Posts Navigation Fix

**Date:** 2026-04-15
**Issuer:** Claude.ai planning session
**Scope:** Two hard-stop checkpoints. Checkpoint 1 = 7G. Checkpoint 2 = 7H.
**Estimated effort:** 1-2 sessions total.

---

## Context

Every cook logged in Frigo currently gets `cooked_at = now()` because `createDishPost` never sets the column. This means:
- Tom's feed timeline is compressed (weeks of cooking all appears as today)
- Stats show cooks in the wrong week/month
- There's no way to log a cook from last Tuesday

The `posts.cooked_at` column already exists in the DB (`timestamp with time zone, DEFAULT now()`). The stats service (`statsService.ts`) already uses `cooked_at` for all its date range queries (confirmed — line 5 says "Uses cooked_at (not created_at) for all time queries"). **No migration needed. This is purely a wiring + UI job.**

Phase 7H is a small navigation fix: StatsScreen's My Posts section currently navigates to RecipeDetailScreen when you tap a post. Post-7I, the correct destination is CookDetailScreen (L6). This checkpoint also switches the My Posts date display and sort order to use `cooked_at`.

### Key files (read these first)

- `lib/services/postService.ts` — `createDishPost`, `CreateDishPostParams`, `LogCookData`
- `components/LogCookSheet.tsx` — the cook-logging bottom sheet (compact + full modes)
- `components/DateTimePicker.tsx` — existing date/time picker with calendar + spinner views (reuse this, do NOT install a new picker library)
- `screens/FeedScreen.tsx` — `loadDishPosts` query, ordering
- `lib/services/feedGroupingService.ts` — `buildFeedGroups`, sort/group logic
- `lib/services/cookCardDataService.ts` — `transformToCookCardData`, maps `cooked_at`
- `lib/types/feed.ts` — `CookCardData` interface (already has `cooked_at?: string | null`)
- `components/CookCard.tsx` — `formatDate`, date display on feed cards
- `screens/CookDetailScreen.tsx` — date display on Block 3 author section
- `screens/StatsScreen.tsx` — My Posts toggle, `MyPostsContent`, `ActivityCard`
- `lib/services/statsService.ts` — **already uses `cooked_at`** everywhere, do not change

### Reference docs

- `docs/PHASE_7_SOCIAL_FEED.md` — active phase doc
- `docs/FRIGO_ARCHITECTURE.md` — codebase map (v3.2)
- `docs/DEFERRED_WORK.md` — cross-phase items

---

## Checkpoint 1: Historical Cook Logging (7G)

### 1A. Service layer — pass `cooked_at` through `createDishPost`

**File:** `lib/services/postService.ts`

1. Add `cookedAt?: string | null` to `CreateDishPostParams`.
2. In `createDishPost`, add `cooked_at: params.cookedAt || new Date().toISOString()` to the insert object. This ensures:
   - Backdated cooks get the user's chosen date
   - Normal cooks get `now()` explicitly (not relying on DB default)
3. Add `cookedAt` to `LogCookData` interface (in the same file or wherever `LogCookData` is defined — check imports in LogCookSheet).

### 1B. LogCookSheet — date picker UI

**File:** `components/LogCookSheet.tsx`

Add a date picker row to LogCookSheet. **Reuse the existing `components/DateTimePicker.tsx`** (a 700+ line custom component with calendar view, spinner view, `minimumDate`/`maximumDate` props, and `mode='date'|'datetime'`). Do NOT install `@react-native-community/datetimepicker` or build a new picker.

**DateTimePicker modification needed first** (file: `components/DateTimePicker.tsx`):

The existing quick-select buttons are "Now", "Tomorrow", "Next Week" — these are future-facing for meal planning. For 7G's past-facing use case, these need to change when `maximumDate` is set. Add a `quickSelectPreset` prop:

```typescript
interface DateTimePickerProps {
  // ... existing props ...
  quickSelectPreset?: 'future' | 'past';  // default: 'future' (existing behavior)
}
```

When `quickSelectPreset === 'past'`:
- Replace "Tomorrow" button with "Yesterday" (date = today - 1, time = 18:00)
- Replace "Next Week" button with "Last Week" (date = today - 7, time = 18:00)
- Keep "Now" / "Today" as-is

When `quickSelectPreset` is `'future'` or unset, existing behavior is unchanged.

**Back to LogCookSheet — the date picker row UX:**

**Compact mode** (from RecipeDetailScreen "Log This Cook"):
- New "When did you cook this?" row between the star rating and the meal-attach chip.
- Default display: "Today" with a calendar icon or subtle chevron.
- Tapping opens `<DateTimePicker mode="date" maximumDate={new Date()} quickSelectPreset="past" />`.
- When a non-today date is selected, the row updates to show the formatted date (e.g., "Mar 15, 2026") in teal text so it's visually distinct from the default.
- User can tap again to change, or tap an "×" to reset to today.
- This row should be visually prominent — backdating is a primary use case for the compact mode entry point.

**Full mode** (from CookingScreen post-cook):
- Show the current date/time as tappable text in the metadata area (e.g., "Today, 2:30 PM"). No explicit "When did you cook this?" label — the user just finished cooking, so "now" is almost always correct.
- Tapping opens the same `<DateTimePicker mode="date" maximumDate={new Date()} quickSelectPreset="past" />`.
- This is a low-frequency override, not a primary action.

**Both modes:**
- Date picker should allow selecting any date in the past, up to today. `maximumDate={new Date()}` handles this — but also verify the quick-select buttons respect it (the "Yesterday" and "Last Week" buttons always produce past dates so they're fine, but "Now"/"Today" should also respect `maximumDate` if it's earlier than today — unlikely but be defensive).
- The selected date should be stored as a `Date` in component state.
- Pass the selected date through to `onSubmit` as the `cookedAt` field in `LogCookData`.

**State additions:**
```typescript
const [cookedAt, setCookedAt] = useState<Date>(new Date());
const [showDatePicker, setShowDatePicker] = useState(false);
const [dateManuallySet, setDateManuallySet] = useState(false);
```

Reset `cookedAt` to `new Date()` and `dateManuallySet` to `false` in the existing `useEffect` that resets form state when `visible` changes.

**In `handleSubmit`:** Add `cookedAt: cookedAt.toISOString()` to the `onSubmit` data.

### 1C. Callers of LogCookSheet — pass `cookedAt` through

Find all callers that receive `LogCookData` from `onSubmit` and pass it to `createDishPost`. These are likely:
- `screens/RecipeDetailScreen.tsx` (compact mode)
- `screens/CookingScreen.tsx` (full mode)

Each caller should pass `cookedAt: data.cookedAt` to `createDishPost`.

**Grep pattern:** `onSubmit.*LogCookData\|createDishPost` across all screen files.

### 1D. Feed — switch sort/display from `created_at` to `cooked_at`

**File:** `screens/FeedScreen.tsx`

1. **Add `cooked_at` to the SELECT string in `loadDishPosts`.** The current SELECT (around line 332) lists specific columns but does NOT include `cooked_at`. Without it in the SELECT, the sort key won't be available for pagination or for passing to `CookCardData`. Add `cooked_at` to the SELECT column list.
2. Change `.order('created_at', { ascending: false })` to `.order('cooked_at', { ascending: false })`.
3. In the pagination logic (the "oldest post date" calculation around line 216): switch from `created_at` to `cooked_at`.
4. Any other `created_at` references used for feed ordering should switch to `cooked_at`. The `created_at` on post_likes/post_reactions should NOT change — those are about when the like happened.

**File:** `components/CookCard.tsx`

1. In `formatDate` call (around line 272): change `formatDate(post.created_at)` to `formatDate(post.cooked_at ?? post.created_at)`. The fallback to `created_at` handles legacy posts where `cooked_at` might be null (though in practice the DB default means they should all have values).
2. The meta line currently shows something like "Apr 15 · Portland, OR". Keep the same format but driven by `cooked_at`.

**File:** `lib/services/feedGroupingService.ts`

This is the **highest-risk change** in this checkpoint. The grouping service uses dates for:
- Sorting within groups (oldest-first for narrative order)
- Sorting across groups (newest-first by max date)
- Potentially for same-day grouping logic

**Audit every `created_at` reference in this file** and switch to `cooked_at` where the intent is "when was this cooked" (timeline position). Keep `created_at` only where the intent is "when was this published" (if any such case exists — likely none do).

Key locations from grep:
- Line ~137: `.sort((a, b) => new Date(a.created_at)...` — switch to `cooked_at`
- Lines ~165-171: cross-group sort — switch to `cooked_at`
- Line ~221: `created_at: p.created_at` — check if this is mapping into a type that should carry `cooked_at`
- Lines ~360-362: within-group sort — switch to `cooked_at`

### 1E. CookDetailScreen — date display

**File:** `screens/CookDetailScreen.tsx`

Line ~725: `const createdDate = new Date(post.created_at)` → `const createdDate = new Date(post.cooked_at ?? post.created_at)`.

This drives the Block 3 author section date display (e.g., "Apr 15, 2026 · 2:30 PM"). A backdated cook should show the cook date, not the publish date.

### 1F. cookCardDataService — verify mapping

**File:** `lib/services/cookCardDataService.ts`

Line ~81 already maps `cooked_at: post.cooked_at ?? null`. Verify the SELECT string (line ~105) includes `cooked_at`. Both should already be correct — just confirm, don't change if already working.

### Checkpoint 1 verification

After completing 1A-1F:

1. **Date picker renders in compact mode** — open "Log This Cook" from RecipeDetailScreen, confirm "When did you cook this?" row is visible, defaults to "Today", tap opens picker, selecting a past date updates the display.
2. **Date picker renders in full mode** — complete a cook in CookingScreen, confirm date appears as tappable text, tap opens picker.
3. **Backdated cook writes correctly** — log a cook with a past date. Query Supabase: `SELECT id, cooked_at, created_at FROM posts ORDER BY created_at DESC LIMIT 1`. Confirm `cooked_at` matches the selected date and `created_at` is today.
4. **Feed sort order** — backdated cook appears in the feed at the `cooked_at` position, not at the top. If you log a cook dated March 15, it should appear between other March 15 cooks, not above today's cooks.
5. **CookCard date display** — feed card shows the `cooked_at` date, not `created_at`.
6. **CookDetailScreen date** — tap into the backdated cook's detail screen, confirm the date line shows the cook date.
7. **Stats accuracy** — go to StatsScreen, confirm the backdated cook appears in the correct week's count (stats already use `cooked_at`, so this should work automatically — but verify).

**HARD STOP.** Do not proceed to Checkpoint 2 until Tom verifies Checkpoint 1.

---

## Checkpoint 2: My Posts Navigation Fix (7H)

### 2A. StatsScreen My Posts — navigate to CookDetailScreen

**File:** `screens/StatsScreen.tsx`

In `MyPostsContent`, the `onPress` handler for `ActivityCard` currently navigates to `RecipeDetail`:
```typescript
onPress={() => {
  if (post.recipe_id && post.recipes) {
    navigation.navigate('RecipeDetail', { recipe: { id: post.recipe_id, title: post.recipes.title } });
  }
}}
```

Change to navigate to `CookDetail` (the new CookDetailScreen from 7I):
```typescript
onPress={() => {
  navigation.navigate('CookDetail', { postId: post.id });
}}
```

Check the navigation type (`StatsStackParamList`) to confirm `CookDetail` is a valid route. If it's not registered in the Stats stack, you'll need to add it. Look at how FeedScreen navigates to CookDetail for the pattern.

**Important:** Every post should be tappable, not just posts with a `recipe_id`. Freeform dishes (D23, `recipe_id` null) should also navigate to CookDetail.

### 2B. My Posts date display — switch to `cooked_at`

**File:** `screens/StatsScreen.tsx`

1. In the `loadMyPosts` query (~line 182): add `cooked_at` to the SELECT string. Change `.order('created_at', { ascending: false })` to `.order('cooked_at', { ascending: false })`.
2. In `MyPostItem` interface (~line 47): add `cooked_at: string;`.
3. In `ActivityCard` (~line 552): change `const date = new Date(post.created_at)` to `const date = new Date(post.cooked_at ?? post.created_at)`.

### 2C. Verify no regressions on the stats/myposts toggle

The toggle between "Cooking Stats" and "My Posts" should continue to work exactly as before. Stats sub-tabs (Overview, Cooking, Nutrition, Insights) should be unaffected.

### Checkpoint 2 verification

1. **My Posts navigation** — tap on a post in My Posts, confirm it opens CookDetailScreen (L6) with the correct post data.
2. **Freeform dish navigation** — if any freeform dish posts exist (recipe_id null), confirm they're also tappable and open CookDetail.
3. **My Posts date display** — confirm posts show `cooked_at` dates, not `created_at`. A backdated cook logged in Checkpoint 1 should show its cook date.
4. **My Posts sort order** — posts are ordered by `cooked_at` descending. The backdated cook appears in chronological position.
5. **Stats toggle** — toggle between Cooking Stats and My Posts, confirm both work.
6. **Stats sub-tabs** — confirm Overview/Cooking/Nutrition/Insights still render correctly (no regression from the My Posts changes).

---

## Constraints

- **Services handle ALL Supabase calls.** Components never call the database directly.
- **Never remove existing functionality** unless explicitly instructed.
- **Console.warn instrumentation:** Add `console.warn` with `[LogCookSheet]` or `[StatsScreen]` prefixes on the new date picker interactions and navigation changes so Tom can see them in Metro during testing.
- **Date picker:** Reuse the existing `components/DateTimePicker.tsx`. Do NOT install `@react-native-community/datetimepicker` or any other date picker library. Do NOT build a new picker from scratch.
- **Fallback pattern:** Always use `post.cooked_at ?? post.created_at` when displaying dates, never bare `post.cooked_at`. This handles any edge case where `cooked_at` is null.

## Watch-fors

1. **feedGroupingService date switch is the riskiest change.** The grouping logic is complex (union-find, Rule C visibility, multi-type dispatch). Changing the sort key could subtly break group ordering. Test with mixed dates — some backdated, some today — and verify groups still form correctly.
2. **Navigation stack types.** `CookDetail` may not be in `StatsStackParamList`. Check `App.tsx` for the Stats tab's navigator definition. If `CookDetail` isn't registered, add it following the pattern from the Feed tab's stack.
3. **DateTimePicker quick-select buttons.** The existing "Tomorrow" and "Next Week" buttons will still render even with `maximumDate` set — `maximumDate` only disables calendar days, not the quick buttons. The `quickSelectPreset='past'` prop you're adding must actually swap the button labels and date logic, not just hide them. Verify that tapping "Yesterday" produces yesterday's date and "Last Week" produces 7 days ago.
4. **Pagination after sort key change.** FeedScreen's pagination uses the oldest post's date to fetch the next page. If you switch the sort key from `created_at` to `cooked_at`, the pagination cursor must also switch. Otherwise you'll get duplicate or missing posts when scrolling.

## SESSION_LOG reminder

After completing each checkpoint, write a SESSION_LOG entry with:
- What was built
- Files created/modified (with line counts)
- Any decisions made
- Any deferred items surfaced
- Verification results

Use the standard format from prior 7I checkpoint entries.

---

## Post-execution: tracker row data

After both checkpoints are verified, generate tracker rows for the Google Sheet:

| Sub-phase | Checkpoint | Description | Status |
|-----------|-----------|-------------|--------|
| 7G | CP1 | Historical cook logging: cooked_at wiring, date picker on LogCookSheet, feed/detail/grouping sort switch | |
| 7H | CP2 | My Posts navigation fix: CookDetailScreen target, cooked_at sort/display | |

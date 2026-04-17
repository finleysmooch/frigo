# CC Prompt: Phase 7M — Full Edit Cook Screen (Strava Edit Activity Pattern)

**Date:** 2026-04-17
**Issuer:** Claude.ai planning session
**Scope:** 3 hard-stop checkpoints. New `EditPostScreen` replaces the narrow-scope overflow menu editing on CookDetailScreen.
**Estimated effort:** 3-5 sessions.
**Reference:** Strava's "Edit Activity" screen (see screenshots in the planning session). Also see `docs/PHASE_7_SOCIAL_FEED.md` 7M section in Build Phases table for the original scope description.

---

## Context

CookDetailScreen currently has 6 overflow menu items for editing (Add photos, Edit title, Edit description, Manage cook partners, Change meal event, Delete post). Each uses inline editing or navigates to a separate modal. This was explicitly built as narrow-scope scaffolding in 7I CP5 with the understanding that 7M would replace it with a unified EditPostScreen.

The target UX: a single full-screen edit form modeled on Strava's "Edit Activity" — all editable fields visible in a scrollable form, "Update Cook" button at bottom, Cancel in header with unsaved-changes detection. The overflow menu on CookDetailScreen collapses from 6 items to 2: "Edit post" (opens EditPostScreen) and "Delete post" (stays as a direct action with confirmation).

### Key files

- `screens/CookDetailScreen.tsx` (~2035 lines) — overflow menu + 6 inline edit handlers to replace
- `lib/services/postService.ts` — `updatePost`, `deletePost`, `UpdatePostPatch` interface
- `lib/types/feed.ts` — `CookCardData` interface
- `components/LogCookSheet.tsx` — has the half-star slide-to-rate component (reuse pattern)
- `components/DateTimePicker.tsx` — existing date picker with `quickSelectPreset` prop
- `components/AddCookingPartnersModal.tsx` — cook partner management modal
- `screens/EditMediaScreen.tsx` — photo management (navigate to from EditPostScreen)
- `lib/services/imageStorageService.ts` — `chooseImageSourceMulti`, `uploadPostImages`
- `App.tsx` — route registrations (FeedStack, StatsStack)

### DB schema reference (posts table, editable columns)

```
title           text
description     text (nullable)
rating          numeric(3,1) (nullable, 0-5 in 0.5 steps)
cooking_method  varchar (nullable)
notes           text (nullable)
modifications   text (nullable)
visibility      text ('everyone'|'followers'|'private'|'meal_tagged')
cooked_at       timestamptz
parent_meal_id  uuid (nullable, FK to posts)
photos          jsonb
```

Fields explicitly NOT editable in 7M: `recipe_id` (changing recipe link is deferred — too complex for this phase), `post_type`, `user_id`, `meal_type`.

---

## Checkpoint 1: EditPostScreen Scaffold + Navigation

### 1A. Create `screens/EditPostScreen.tsx`

New screen file. Full-screen form with header + scrollable content + sticky bottom button.

**Header:**
- Left: "Cancel" text button (teal)
- Center: "Edit Cook" title
- Right: empty (save button is at the bottom, not in header)

**Scrollable form sections (render all fields, editable, pre-populated from the post data):**

**Section 1 — Core content**
- Title: `<TextInput>` single line, pre-filled with `post.title`, border + rounded corners (matching Strava's input card style)
- Description: `<TextInput>` multi-line, pre-filled with `post.description`, placeholder "How'd it go? Share more about your cook"

**Section 2 — Media**
- Photo grid showing current photos as small thumbnails (3-column, same as EditMediaScreen's grid but read-only here). Tapping navigates to EditMedia with the current photos.
- If fewer than 10 photos: show an "Add Photos" dashed card at the end (tapping also navigates to EditMedia)
- The photos are not directly editable on this screen — EditMedia handles add/delete/reorder/highlight. EditPostScreen just shows the current state and navigates.
- **Add a `useFocusEffect` that re-fetches post data when EditPostScreen regains focus**, so the photo grid reflects changes made in EditMedia. Same pattern as CookDetailScreen's existing useFocusEffect.
- **After CP3, the only path to edit photos is through EditPostScreen → EditMedia.** The extra tap vs. today's direct overflow menu item is intentional and matches Strava's pattern where all editing flows through the unified edit screen.

**Section 3 — Details (section header: "Details")**
- Rating: half-star slide-to-rate component. Reuse the star rating pattern from LogCookSheet (the `PanResponder`-based slide-to-rate with teal stars, half-star positions, slide-left-to-clear). Pre-filled with current `post.rating`. Size and layout should match LogCookSheet's compact mode rating row.
- Cooking method: tappable row with current value + chevron. Tapping opens a picker/dropdown with the canonical options list. Pre-filled with `post.cooking_method`. Use a simple Modal with a list, not a system picker. **Create `constants/cookingMethods.ts` with the canonical list.** Before defining the list, run `SELECT DISTINCT cooking_method FROM posts WHERE cooking_method IS NOT NULL` to see what values exist in the DB. The canonical list must cover all existing values. Starting point: Stovetop, Oven, Grill, Air Fryer, Slow Cooker, Sous Vide, Smoker, Deep Fry, Steamer, No Cook, Other.
- Date cooked: tappable row showing formatted date. Tapping opens `<DateTimePicker mode="date" maximumDate={new Date()} quickSelectPreset="past" />`. Pre-filled with `post.cooked_at`.
- Modifications: `<TextInput>` multi-line, pre-filled with `post.modifications`, placeholder "What did you change from the recipe?"
- Notes: `<TextInput>` multi-line, pre-filled with `post.notes`, placeholder "Private notes — only you can see these". Add a 🔒 icon before the placeholder to signal privacy (matches Strava's "Jot down private notes here").
- Meal event: tappable row showing current meal event title (or "Not attached to a meal event"). Tapping opens the same meal picker pattern from CookDetailScreen's `handleMenuChangeMealEvent`. Pre-filled with `post.parent_meal_id`.
- Cook partners: tappable row showing current partner chips (or "No cook partners"). Tapping opens `<AddCookingPartnersModal>`. Pre-filled with current approved sous_chef participants.

**Section 4 — Visibility (section header: "Visibility")**
- "Who can see" tappable row with current visibility value + chevron. Tapping opens a picker with the 4 options: Everyone, Followers, Just me, People tagged in meal (last option disabled when no meal context, same as LogCookSheet's visibility overlay).

**Bottom of scroll content:**
- "Delete Post" text button in red (same confirmation Alert as current `handleMenuDelete`)

**Sticky bottom bar (outside ScrollView, position: absolute bottom):**
- "Update Cook" full-width teal button. Disabled when no changes have been made (not dirty).

**Navigation params:**
```typescript
EditPost: { postId: string }
```

### 1B. Route registration

**File:** `App.tsx`

Register `EditPost` in both `FeedStackParamList` and `StatsStackParamList`:
```typescript
EditPost: { postId: string };
```

Register the screen in both `FeedStackNavigator` and `StatsStackNavigator`:
```jsx
<Stack.Screen
  name="EditPost"
  component={EditPostScreen}
  options={{ headerShown: false }}
/>
```

Import `EditPostScreen` at the top of `App.tsx`.

### 1C. Data loading

EditPostScreen loads its own data via `fetchSingleCookCardData(postId)` (same as CookDetailScreen). It also needs:
- Current cook partners via `getPostParticipants(postId)` filtered to `role='sous_chef' && status='approved'`
- Current visibility from the post row (note: `CookCardData` doesn't include `visibility` — you'll need to either extend the type or fetch it separately via a direct supabase query on `posts.visibility`)

**Important:** `CookCardData` does not include `visibility`. Fetch it separately:
```typescript
const { data: visRow } = await supabase
  .from('posts')
  .select('visibility')
  .eq('id', postId)
  .single();
```

Note: `cooked_at` IS already on `CookCardData` as `cooked_at?: string | null`, so no separate fetch needed for it. Use it directly for the date picker's `initialDate`.

### Checkpoint 1 verification

1. Navigate from CookDetailScreen overflow menu to EditPostScreen (temporary "Edit post" menu item — add it as item 0 above "Add photos" for testing, will be cleaned up in CP3)
2. All fields render pre-populated with the correct current values
3. All field inputs are interactive (can type in text fields, tap rating stars, open pickers)
4. "Cancel" navigates back
5. "Update Cook" button renders at bottom (disabled for now — save logic in CP2)
6. "Delete Post" renders in red at bottom of scroll
7. Photo grid shows current photos; tapping navigates to EditMedia
8. Route works from both FeedStack and StatsStack

**HARD STOP.** Do not proceed to Checkpoint 2 until Tom verifies.

---

## Checkpoint 2: Save Logic + Dirty State + Delete

### 2A. Extend `UpdatePostPatch`

**File:** `lib/services/postService.ts`

Add the missing fields to `UpdatePostPatch`:
```typescript
export interface UpdatePostPatch {
  title?: string;
  description?: string | null;
  parent_meal_id?: string | null;
  meal_time?: string | null;
  meal_location?: string | null;
  // Phase 7M additions:
  rating?: number | null;
  cooking_method?: string | null;
  modifications?: string | null;
  notes?: string | null;
  visibility?: string;
  cooked_at?: string;  // Phase 7M: never null — 7G ensures every post has an explicit value
}
```

`updatePost` already does a generic `.update(patch)` so no other service changes needed — the new fields just pass through.

### 2B. Dirty state detection

**File:** `screens/EditPostScreen.tsx`

Track initial values for every field in a ref (captured at load time). Compare current form state against initial values to determine if the form is dirty.

```typescript
const initialValues = useRef<{
  title: string;
  description: string;
  rating: number | null;
  cookingMethod: string;
  cookedAt: string;
  modifications: string;
  notes: string;
  visibility: string;
  parentMealId: string | null;
  partnerIds: string[];
}>({...});

const isDirty = useMemo(() => {
  // Compare each field against initialValues.current
  // Return true if any field differs
}, [title, description, rating, cookingMethod, cookedAt, modifications, notes, visibility, parentMealId, partnerIds]);
```

Photos are handled separately — EditMedia saves photos directly to the DB, so returning from EditMedia means photos are already saved. EditPostScreen doesn't track photo dirtiness.

### 2C. Save handler

When "Update Cook" is tapped:

1. Build the patch from all changed fields (only include fields that actually changed — don't send unchanged fields to the DB). Convert `cookedAt` Date to ISO string via `.toISOString()` before including in the patch.
2. Call `updatePost(postId, patch)` for the post-level fields.
3. For cook partners: compute the add/remove diff (same pattern as CookDetailScreen's `handleManagePartnersConfirm`) and apply.
4. On success: navigate back to CookDetailScreen. The `useFocusEffect` refetch on CookDetailScreen will pick up the changes.
5. On error: show an Alert, stay on EditPostScreen.

### 2D. Cancel with unsaved changes

When "Cancel" is tapped:
- If not dirty: navigate back immediately
- If dirty: show `Alert.alert('Discard changes?', 'You have unsaved changes.', [{ text: 'Keep editing' }, { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }])`

### 2E. Delete post

Wire the "Delete Post" button at the bottom of the scroll content:
- Same confirmation flow as CookDetailScreen's `handleMenuDelete` (Alert with Cancel/Delete, delayed 150ms past any Modal close)
- On delete success: navigate back TWO screens (to the feed, not to CookDetailScreen which would show a deleted post). Use `navigation.pop(2)` or `navigation.navigate('FeedMain')`.

### 2F. "Update Cook" button state

- Disabled (grayed out) when `!isDirty`
- Enabled (teal) when `isDirty`
- Shows spinner when save is in progress
- Disable Cancel and Delete while save is in progress

### Checkpoint 2 verification

1. Change title → "Update Cook" becomes enabled → tap → saves → returns to CookDetailScreen showing new title
2. Change rating → saves correctly
3. Change visibility → saves correctly
4. Change cooking method → saves correctly
5. Change cooked_at date → saves correctly
6. Change modifications/notes → saves correctly
7. Change meal event → saves correctly
8. Change cook partners → saves correctly
9. Change multiple fields at once → single save writes all changes
10. Cancel with no changes → navigates back immediately
11. Cancel with changes → shows discard confirmation
12. Delete post → confirmation → deletes → returns to feed (not to CookDetailScreen)
13. "Update Cook" disabled when no changes made
14. "Update Cook" shows spinner during save

**HARD STOP.** Do not proceed to Checkpoint 3 until Tom verifies.

---

## Checkpoint 3: CookDetailScreen Overflow Menu Cleanup

### 3A. Replace overflow menu items

**File:** `screens/CookDetailScreen.tsx`

Replace the current 6-item overflow menu with 2 items:

1. **"Edit post"** — navigates to `EditPost` with `{ postId: post.id }`
2. **"Delete post"** (red, destructive) — keeps the existing `handleMenuDelete` logic

### 3B. Remove inline edit state and handlers

Delete from CookDetailScreen:
- `editingTitle`, `titleDraft`, `titleError`, `setEditingTitle` state
- `editingDescription`, `descriptionDraft`, `setEditingDescription` state
- `managePartnersOpen`, `setManagePartnersOpen` state
- `mealPickerOpen`, `recentMeals`, `mealPickerLoading` state
- `handleMenuEditTitle`, `handleTitleSave`, `handleTitleCancel`
- `handleMenuEditDescription`, `handleDescriptionSave`, `handleDescriptionCancel`
- `handleMenuManagePartners`, `handleManagePartnersConfirm`
- `handleMenuChangeMealEvent`, `handleSelectMealEvent`
- `handleMenuAddPhotos` (EditPostScreen handles photo navigation now)
- The `AddCookingPartnersModal` mount
- The meal picker Modal
- The inline edit conditional renders in Blocks 4 and 5 (title and description inline edit TextInputs)
- The `inlineEdit*` styles

### 3C. Simplify Block 4 and Block 5 rendering

With inline editing removed, Block 4 (title) and Block 5 (description) go back to being simple `<Text>` renders — no conditional `editingTitle ? <TextInput> : <Text>` branching.

### 3D. Remove `console.warn` instrumentation from narrow-scope edit handlers

The instrumentation was explicitly left in for dogfooding per the 7I CP5 handoff. Since 7M replaces the editing surface, the instrumentation goes away with the handlers. Add new `console.warn` instrumentation on EditPostScreen's save, cancel, and delete actions instead.

### 3E. Verify CookDetailScreen line count reduction

After cleanup, CookDetailScreen should drop by ~400-500 lines (the inline edit state, handlers, modals, and conditional renders). Document the before/after line count in the SESSION_LOG.

### Checkpoint 3 verification

1. CookDetailScreen overflow menu shows exactly 2 items: "Edit post" and "Delete post"
2. Tapping "Edit post" opens EditPostScreen with correct data
3. No inline editing on CookDetailScreen — title and description are plain text
4. No AddCookingPartnersModal mounted on CookDetailScreen
5. No meal picker modal on CookDetailScreen
6. "Delete post" still works from the overflow menu
7. CookDetailScreen renders correctly after edit (useFocusEffect refetch picks up changes)
8. No TypeScript errors from removed state/handlers
9. CookDetailScreen line count decreased by 400+ lines
10. **End-to-end flow:** CookDetailScreen → Edit post → make changes to 2+ fields → Update Cook → return to CookDetailScreen → verify updated data displays correctly

---

## Constraints

- **Services handle ALL Supabase calls.** The one exception: cook partner add/remove uses inline supabase calls (same pattern as the current CookDetailScreen, see `handleManagePartnersConfirm`). This is acceptable because `postParticipantsService` doesn't support the author-driven manage flow (it hardcodes `status='pending'`). A proper service refactor is deferred.
- **Never remove existing functionality** unless explicitly instructed (CP3 explicitly instructs removal).
- **Console.warn instrumentation** on EditPostScreen's save, cancel, delete, and each field change.
- **Feed card overflow menu entry point is deferred from 7M.** The only entry point to EditPostScreen is CookDetailScreen → overflow → "Edit post". Wiring `PostActionMenu` into CookCard for direct "Edit post" from the feed is out of scope.
- **MealEventDetailScreen's editing stays as-is.** A future phase may build an equivalent EditMealEventScreen. Do NOT touch MealEventDetailScreen in this prompt.
- **Do NOT allow editing `recipe_id`.** The recipe link is read-only on EditPostScreen. Show it as a non-editable display row — recipe name + author in muted text. Tappable to navigate to RecipeDetailScreen for context (navigating doesn't change anything). No chevron, no edit affordance — just a tappable text link in teal for the recipe name, same style as CookDetailScreen's Block 6 RecipeLine.
- **Photos save independently.** When the user navigates to EditMedia from EditPostScreen and saves photos there, the photos are written directly to the DB by EditMedia. EditPostScreen doesn't need to track photo dirtiness or include photos in its save payload. It just needs to refetch/refresh the photo grid when returning from EditMedia (same `useFocusEffect` pattern as CookDetailScreen).

## Watch-fors

1. **Half-star slide-to-rate reuse.** LogCookSheet has the star rating implementation inline (~80 lines of PanResponder + position math + star rendering). Extract it into a reusable `<StarRating>` component in `components/` so both LogCookSheet and EditPostScreen can use it. Don't duplicate the code.
2. **Visibility requires a separate fetch.** `CookCardData` doesn't include `visibility`. EditPostScreen needs to fetch it from the `posts` table directly. Don't assume it's available on the data model.
3. **Cook partner diff logic.** The add/remove diff pattern is duplicated from CookDetailScreen. After CP3 deletes it from CookDetailScreen, the only copy lives in EditPostScreen. Consider extracting to a helper in `postParticipantsService` — but don't block on this.
4. **Navigation after delete.** `navigation.goBack()` from EditPostScreen returns to CookDetailScreen, which would show a deleted post. Use `navigation.pop(2)` or `navigation.navigate('FeedMain')` to go back to the feed.
5. **Cooking method options list.** Create `constants/cookingMethods.ts` with the canonical list per section 1A. Run `SELECT DISTINCT cooking_method FROM posts WHERE cooking_method IS NOT NULL` first to ensure coverage. Import the list in both EditPostScreen and LogCookSheet (if LogCookSheet has a cooking method picker).
6. **Large screen (CP1) — keep it under 600 lines.** EditPostScreen is a form, not a detail screen. Each field should be a compact row, not an elaborate multi-component render. Aim for a clean, dense form like Strava's.

## SESSION_LOG reminder

After completing each checkpoint, write a SESSION_LOG entry with: files created/modified (with line counts), decisions made, deferred items, verification results. Use the standard format.

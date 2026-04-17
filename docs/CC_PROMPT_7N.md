# CC Prompt: Phase 7N — Detail Screen Polish + Feed Carousel UX

**Date:** 2026-04-15
**Issuer:** Claude.ai planning session
**Scope:** Two hard-stop checkpoints. 8 items total.
**Estimated effort:** 1-2 sessions.

---

## Context

Phase 7I shipped the cook-post-centric feed rebuild with CookDetailScreen (L6) and MealEventDetailScreen (L7). Phase 7G added historical cook logging. Both are verified and working. 7N is a polish pass that fixes real UX friction items before F&F testers arrive. Items are drawn from the Phase 7 deferred items list (P7-85 through P7-99).

**What this is NOT:** This is not a feature phase. No new data models, no schema changes, no new screens. Every item is a fix or refinement to existing surfaces.

### Key files

- `screens/CookDetailScreen.tsx` (~2035 lines) — Block 1 header, Block 8 rating label, Block 14 sticky engagement bar
- `screens/MealEventDetailScreen.tsx` (~2170 lines) — eater rating star picker, sticky engagement bar
- `screens/CommentsScreen.tsx` (~806 lines) — KeyboardAvoidingView, text input
- `components/feedCard/CookCard.tsx` (~350 lines) — outer Pressable wrapping PhotoCarousel
- `components/sharedCardElements.tsx` (~1144 lines) — `PhotoCarousel` (FlatList-based, snap-to-center)
- `lib/services/imageStorageService.ts` — `pickImage()`, `chooseImageSource()`, `uploadPostImages()`
- `screens/EditMediaScreen.tsx` — photo management screen reached from CookDetailScreen overflow

---

## Checkpoint 1: Feed + Navigation Polish (5 items)

### 1A. P7-85 — CommentsScreen keyboard avoidance fix

**File:** `screens/CommentsScreen.tsx`

**Problem:** The comment text input is hidden behind the keyboard when CommentsScreen opens from CookDetailScreen or MealEventDetailScreen. The existing `KeyboardAvoidingView` (line 689) has `keyboardVerticalOffset={0}`, which doesn't account for the navigation header height.

**Fix:**
1. Change `keyboardVerticalOffset={0}` to `keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}`. The 90px offset accounts for the SafeAreaView top inset (~47px) + the navigation header (~44px). This is a standard RN pattern.
2. If 90 doesn't land right, the proper approach is to measure the header height dynamically using `useHeaderHeight()` from `@react-navigation/elements`. Check if that package is available in `node_modules` — if so, use it. If not, the hardcoded 90 is fine for now.
3. Test: open CommentsScreen from CookDetailScreen, tap the text input. The input should be fully visible above the keyboard with no overlap.

### 1B. P7-87 — Photo carousel peek

**File:** `components/sharedCardElements.tsx` — `PhotoCarousel` component

**Problem:** Multi-photo carousels don't visually signal that more photos exist. Users don't know they can swipe.

**Current state:** `PhotoCarousel` uses a FlatList with `snapToOffsets` and `decelerationRate="fast"`. Comment at line 196 says "neighbors peek in from the sides" — but the current `CAROUSEL_HEIGHT` and item widths may not produce enough visible peek on all screen sizes.

**Fix:**
1. Ensure the first photo's width is narrower than screen width so adjacent slides peek visibly. The target: each photo should occupy ~85-90% of screen width, leaving 5-7.5% visible on each side for the neighboring slides.
2. The current logic computes photo width from aspect ratio (`CAROUSEL_HEIGHT * ratio`). If the computed width >= SCREEN_WIDTH, clamp it to `SCREEN_WIDTH * 0.88` so peek is always visible.
3. Add a subtle "1/N" photo count indicator in the top-right corner of the carousel when `photos.length > 1`. Small semi-transparent pill (e.g., `rgba(0,0,0,0.5)` background, white text, 10px font, 4px padding). This gives a second signal beyond the peek.
4. This applies to BOTH feed cards (via CookCard) and CookDetailScreen's hero carousel (same `PhotoCarousel` component).
5. Single-photo carousels: no count indicator, no width clamping. Keep existing behavior.

### 1C. P7-90 — CookDetailScreen title in header bar

**File:** `screens/CookDetailScreen.tsx`

**Problem:** The nav header says "Cook" (line 759-760). Should show the post title so the user knows what they're looking at, matching Strava's activity detail pattern.

**Fix:**
1. Replace the hardcoded "Cook" text on line 760 with `postTitle` (already computed on line 714 as `post.title || post.recipe_title || 'Cooking Session'`).
2. Add `numberOfLines={1}` to the header title `<Text>` so long titles truncate with ellipsis rather than wrapping.
3. The "not found" state header (line 698) can stay as "Cook" since there's no post data to show.

### 1D. P7-96 (label fix only) — Rating label on CookDetailScreen

**File:** `screens/CookDetailScreen.tsx`

**Problem:** Block 8 stats grid shows "Your rating" for ALL posts, including posts by other users. Should say "[Author]'s rating" when viewing someone else's post.

**Fix:**
1. Find the "Your rating" or "RATING" label in the Block 8 stats grid area.
2. When `isOwnPost` is true: label = "Your rating"
3. When `isOwnPost` is false: label = `${displayName}'s rating` (where `displayName` is already computed on line 711-712)
4. **Do NOT add an eater rating affordance for viewers** — that's the deferred second half of P7-96. Only fix the label.

### 1E. Feed card swipe reliability

**File:** `components/feedCard/CookCard.tsx` + `components/sharedCardElements.tsx`

**Problem:** Horizontal swipe gestures on the photo carousel inside feed cards sometimes register as taps (navigating to CookDetail) instead of scrolling the carousel.

**Important — check existing mitigation first:** `CardWrapper` in `sharedCardElements.tsx` already wraps its children in a `<Pressable>` with `unstable_pressDelay={180}` specifically to address this swipe-vs-tap conflict. The tap-to-navigate wrapping is NOT in `CookCard.tsx` at line 262 — it's in `CardWrapper`. **Before building a restructure, check whether the existing 180ms press delay is already making swipe reliability acceptable.** If it is, document that finding ("swipe reliability is acceptable with the existing `unstable_pressDelay={180}` on CardWrapper — no restructure needed") and move on.

**If the existing delay is NOT sufficient** (i.e., swipes still frequently misfire as taps), apply this restructure:

1. In `CardWrapper` (or wherever the outer Pressable lives), split it so the photo carousel area is NOT wrapped in the Pressable. Only the non-carousel content (title, author, description, stats, engagement) should be pressable.

   Concretely:
   ```
   <View>
     {/* Photo carousel — NOT wrapped in Pressable */}
     <PhotoCarousel ... />
     
     {/* Everything else — wrapped in Pressable for tap-to-detail */}
     <Pressable onPress={onPress} unstable_pressDelay={180}>
       {/* Title, description, recipe line, stats, engagement */}
     </Pressable>
   </View>
   ```

2. In `PhotoCarousel` (`sharedCardElements.tsx`), add an `onPhotoPress` prop. When the user taps (not swipes) a photo, fire `onPhotoPress`. CookCard passes its navigate-to-detail handler as the `onPhotoPress`, so tapping a photo still opens the detail screen.

3. To distinguish tap from swipe inside `PhotoCarousel`: the FlatList already handles swipe natively. For tap detection, wrap each rendered photo `<Image>` in a `<Pressable>` that fires `onPhotoPress`. FlatList's scroll gesture will naturally consume horizontal swipes, and the inner Pressable only fires on clean taps.

4. **Test carefully:** 
   - Single-finger horizontal swipe on a photo → carousel scrolls, no navigation
   - Single-finger tap on a photo → navigates to CookDetail
   - Tap on title/description/stats area → navigates to CookDetail
   - Verify grouped card types (linked_cook_partner, linked_meal_event, linked_shared_recipe) still render correctly — they compose CookCard internally

### Checkpoint 1 verification

1. **CommentsScreen keyboard** — open comments from CookDetailScreen, tap input, input visible above keyboard
2. **Photo carousel peek** — multi-photo feed card shows edges of adjacent slides + "1/3" count pill
3. **Carousel peek on detail screen** — CookDetailScreen hero carousel also shows peek + count
4. **Single-photo card** — no count pill, no width clamping
5. **Header title** — CookDetailScreen header shows post title, truncated with ellipsis if long
6. **Rating label (own post)** — "Your rating" on Block 8
7. **Rating label (other's post)** — "[Name]'s rating" on Block 8
8. **Swipe reliability** — swipe on feed card photo scrolls carousel, tap on photo navigates to detail, tap on card text navigates to detail

**HARD STOP.** Do not proceed to Checkpoint 2 until Tom verifies Checkpoint 1.

---

## Checkpoint 2: Detail Screen Polish (3 items)

### 2A. P7-88 — Multi-photo select from library

**File:** `lib/services/imageStorageService.ts`

**Problem:** `pickImage()` returns a single URI. When adding photos to a post, users must pick one photo at a time.

**Fix — additive, do NOT change existing function signatures:**

1. Add a new `pickMultipleImages()` function:
   ```typescript
   export async function pickMultipleImages(): Promise<string[]> {
     const hasPermission = await requestMediaLibraryPermission();
     if (!hasPermission) return [];
     try {
       const result = await ImagePicker.launchImageLibraryAsync({
         mediaTypes: ImagePicker.MediaTypeOptions.Images,
         allowsMultipleSelection: true,
         quality: 0.8,
         selectionLimit: 10,
       });
       if (result.canceled) return [];
       return result.assets.map(a => a.uri);
     } catch (error) {
       console.error('Error picking multiple images:', error);
       Alert.alert('Error', 'Failed to select images. Please try again.');
       return [];
     }
   }
   ```

2. Add a new `chooseImageSourceMulti()` function that returns `string[]`:
   ```typescript
   export async function chooseImageSourceMulti(): Promise<string[]> {
     return new Promise((resolve) => {
       Alert.alert(
         'Choose Photos',
         'Select photos from your library or take a new one',
         [
           {
             text: 'Take Photo',
             onPress: async () => {
               const uri = await takePicture();
               resolve(uri ? [uri] : []);
             },
           },
           {
             text: 'Choose from Library',
             onPress: async () => {
               const uris = await pickMultipleImages();
               resolve(uris);
             },
           },
           { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
         ]
       );
     });
   }
   ```

3. **Do NOT modify `pickImage()` or `chooseImageSource()`.** These existing functions return `string | null` and have callers across the codebase (recipe images, profile photos, etc.). Changing their return type would be a breaking change. The new `Multi` variants are additive.

4. **Update only the post-photo callers** to use the new multi-select functions. Grep for callers of `chooseImageSource` across the entire codebase first. The post-photo flow (EditMediaScreen's "add photo" button, and CookDetailScreen's overflow "Add photos" if it calls chooseImageSource directly) should switch to `chooseImageSourceMulti()`. All other callers stay on the original single-select functions.

5. **EditMediaScreen update:** The "add" button handler currently expects a single URI. Update it to receive `string[]` from `chooseImageSourceMulti()` and append each URI as a new photo entry in the grid.

### 2B. P7-97 — Star picker stay-open behavior

**File:** `screens/MealEventDetailScreen.tsx`

**Problem:** The eater rating star picker auto-closes immediately after a star is selected (line 699: `setRatingPickerOpen(null)`). This is disorienting — the user taps a star, the picker vanishes, and they can't easily verify or adjust their rating.

**Fix:**
1. Remove `setRatingPickerOpen(null)` from `handleRatingSelect` (line 699). The picker should stay open after a star is selected.
2. Add a dismiss mechanism: the picker closes when the user taps outside it OR taps a small "×" button in the picker row. The "tap outside" behavior can be implemented with a `<Pressable>` overlay behind the picker that calls `setRatingPickerOpen(null)` on press.
3. The "tap same rating to clear" behavior (line 690: `prevRating === rating ? null : rating`) should remain — tapping an already-selected star clears it, and the picker stays open showing no selection.
4. Add `console.warn` instrumentation: `[MealEventDetailScreen] star picker opened for postId: ${postId}` and `[MealEventDetailScreen] star picker dismissed`.

### 2C. P7-98 — Inline engagement bar (not sticky)

**Files:** `screens/CookDetailScreen.tsx` + `screens/MealEventDetailScreen.tsx`

**Problem:** Both detail screens have a sticky engagement bar at `position: absolute, bottom: 0`. This overlaps the last ~60px of scroll content and feels heavy. The engagement bar should be inline within the scroll content.

**Fix for CookDetailScreen:**
1. Move Block 14 (the engagement bar, starting at line 1279) from OUTSIDE the ScrollView to INSIDE it, positioned after the comments preview section (Block 13).
2. Remove the `position: 'absolute'` and `bottom: 0` from the `stickyBar` style. Replace with standard inline styling (padding, border-top, margin-top for spacing from the comments section above).
3. Add `paddingBottom: 80` (or equivalent) to the ScrollView's `contentContainerStyle` so the engagement bar doesn't butt up against the bottom of the screen — leave room for comfortable scrolling past.
4. The engagement bar content (like button + count, comment button + count, share button) stays identical.

**Fix for MealEventDetailScreen:**
1. Same pattern: move the sticky engagement bar (line 1359) from outside the ScrollView to inside it, positioned after the "What everyone brought" section (the dishes list).
2. Remove absolute positioning, add inline styling.
3. Add bottom padding to ScrollView contentContainerStyle.

**Both screens:** The engagement bar should feel like a natural part of the content, not a floating overlay. It scrolls with the content. Users can scroll past it.

### Checkpoint 2 verification

1. **Multi-photo select** — from CookDetailScreen overflow → Add photos → EditMedia → "Choose from Library" → select multiple photos → all appear in EditMedia grid
2. **Single photo paths unaffected** — recipe image picker, profile photo still work (single select)
3. **Star picker stays open** — on MealEventDetailScreen, tap "Rate" on a dish → stars appear → tap a star → rating saves but picker stays open → tap "×" or outside → picker closes
4. **Star picker clear** — tap the same star again → rating clears, picker stays open
5. **Inline engagement (CookDetail)** — scroll to bottom of CookDetailScreen → engagement bar is inline after comments, no absolute overlay, can scroll past it
6. **Inline engagement (MealEventDetail)** — same pattern, bar after "What everyone brought"
7. **No content hidden** — verify the last content block above the engagement bar is fully visible (no overlap)

---

## Constraints

- **Services handle ALL Supabase calls.** Components never call the database directly.
- **Never remove existing functionality** unless explicitly instructed.
- **Console.warn instrumentation:** Add `console.warn` with screen-name prefixes on new interactions.
- **PhotoCarousel changes affect multiple surfaces.** CookCard (feed), CookDetailScreen (hero), MealEventDetailScreen (shared media), and grouped card types all use `PhotoCarousel`. Test that changes to peek/count don't break any of these.
- **Don't touch EditMediaScreen's core layout** — P7-86 (Strava-style EditMedia redesign) is deferred to 7M. Just update it to handle multi-select arrays from the image picker.

## Watch-fors

1. **Swipe reliability (1E) may already be solved.** The existing `unstable_pressDelay={180}` on `CardWrapper` in `sharedCardElements.tsx` was specifically added for this issue. CC should test the current behavior first before restructuring. If the delay is already sufficient, skip the restructure and document the finding. If the restructure IS needed, it affects every feed card — test all 4 group types.
2. **PhotoCarousel width clamping (1B) could affect snap offsets.** The existing `snapToOffsets` computation uses photo widths. If you clamp widths, recompute snap offsets to match. The snap array is already computed dynamically from `widths[]` so this should cascade automatically — but verify.
3. **Inline engagement bar (2C) changes scroll behavior.** The absolute-positioned bar currently doesn't affect scroll content height. Moving it inline adds ~60px to the scroll content. Verify that the ScrollView's bottom padding is sufficient and that the engagement bar doesn't get cut off on short posts.
4. **`allowsMultipleSelection` on Android.** `expo-image-picker`'s multi-select works on iOS but may have quirks on Android (some devices don't support it). Add a fallback: if `result.assets` has length 0 on Android, fall back to single-select. Or just document the limitation. Note: the additive `chooseImageSourceMulti` function means no existing callers are affected — only EditMediaScreen switches to the new function.
5. **CommentsScreen keyboard offset.** The 90px hardcoded offset works for standard iPhone screen sizes. On iPad or with non-standard nav bars, it may be wrong. If `useHeaderHeight` is available, prefer it.

## SESSION_LOG reminder

After completing each checkpoint, write a SESSION_LOG entry with: what was built, files modified (with line counts), decisions made, deferred items, verification results. Use the standard format from prior entries.

---

## Deferred from 7N (stay in Phase 7 for a later pass)

These items were triaged out of 7N scope. They remain in the Phase 7 deferred items list:

| # | Item | Reason deferred |
|---|------|-----------------|
| P7-89 | CookDetailScreen inline photos layout | Layout restructure with side-effect risk; photos visible in carousel already |
| P7-91 | "Create event" in meal picker | Edge case; other creation paths available |
| P7-93 | Half-star eater ratings | DDL change on eater_ratings table; wait for F&F usage data |
| P7-94 | Eater rating privacy label | Bundle with P7-93 |
| P7-95 | Shared media thumbnail tap-through | Render-only is fine for F&F |
| P7-96 (affordance) | Eater rating on CookDetail for viewers | New feature, not polish; deferred second half of P7-96 |
| P7-99 | Highlight picker section headers | Cosmetic |

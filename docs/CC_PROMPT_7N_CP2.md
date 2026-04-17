# CC Prompt: Phase 7N Checkpoint 2 — Detail Screen Polish + Swipe Fix

**Date:** 2026-04-17
**Issuer:** Claude.ai planning session
**Scope:** 6 items. Checkpoint 1 is already verified on device.
**Estimated effort:** 1 session.

---

## Context

Checkpoint 1 shipped 5 items (P7-85, P7-87, P7-90, P7-96 label fix, 1E swipe delay). Device testing confirmed 4 of 5 work correctly. Two items need follow-up fixes from CP1, and 3 new items ship in this checkpoint.

### Key files

- `components/feedCard/CookCard.tsx` (~350 lines) — `CookCardInner` with the outer Pressable that needs restructuring
- `components/feedCard/sharedCardElements.tsx` (~1100+ lines) — `PhotoCarousel`, `TappableTitleBlock` (currently dead code), `CardWrapper`
- `screens/CookDetailScreen.tsx` (~2035 lines) — Block 1 header, Block 14 sticky engagement bar
- `screens/MealEventDetailScreen.tsx` (~2170 lines) — eater rating star picker, sticky engagement bar
- `screens/CommentsScreen.tsx` (~806 lines) — keyboard return key
- `lib/services/imageStorageService.ts` — `pickImage()`, `chooseImageSource()`
- `screens/EditMediaScreen.tsx` — photo management, caller of chooseImageSource

---

## Item 1: Swipe reliability fix (RESTRUCTURE — replaces the CP1 `unstable_pressDelay` approach)

**Files:** `components/feedCard/CookCard.tsx` + `components/feedCard/sharedCardElements.tsx`

**Problem:** The CP1 fix added `unstable_pressDelay={180}` to the outer Pressable on `CookCardInner`. Device testing shows this is NOT sufficient — swipes on photos still frequently misfire as taps, navigating to CookDetailScreen instead of scrolling the carousel. `unstable_pressDelay` only delays the visual press-in feedback; it does NOT prevent the Pressable from claiming the gesture responder. The FlatList inside PhotoCarousel loses the gesture race on slower or slightly diagonal swipes.

**Root cause:** The entire card — including `PhotoCarousel` — is wrapped in a single `<Pressable onPress={onPress}>`. The carousel's horizontal FlatList and the outer Pressable both compete for the gesture. The outer Pressable wins too often.

**Fix — split the Pressable so PhotoCarousel is NOT inside it:**

In `CookCardInner` (file: `components/feedCard/CookCard.tsx`), replace the current structure:

```jsx
// CURRENT (broken):
<Pressable onPress={onPress} unstable_pressDelay={180}>
  <CardHeader ... />
  <View> {/* title + description + recipe */} </View>
  <PhotoCarousel ... />
  <StatsRow ... />
  <VibePillRow ... />
  <EngagementRow ... />
  <ActionRow ... />
</Pressable>
```

With this structure:

```jsx
// NEW (fixed):
<View>
  {/* Top section — tappable */}
  <Pressable onPress={onPress}>
    <CardHeader ... />
    <View> {/* title + description + recipe */} </View>
  </Pressable>

  {/* Photo carousel — NOT in a Pressable. Swipe gestures go to FlatList. */}
  <PhotoCarousel photos={carouselPhotos} colors={colors} onPhotoPress={onPress} />

  {/* Bottom section — tappable */}
  <Pressable onPress={onPress}>
    <StatsRow ... />
    <VibePillRow ... />
    <EngagementRow ... />
    <ActionRow ... />
  </Pressable>
</View>
```

**Key points:**
- Remove `unstable_pressDelay={180}` entirely — it's no longer needed.
- The two Pressable sections (top and bottom) handle tap-to-navigate for non-photo areas. No delay needed because there's no competing scroll gesture in those areas.
- `EngagementRow` and `ActionRow` have their own inner `TouchableOpacity` elements (like button, comment button, likers list). React Native's "innermost touchable wins" rule means those still work — they intercept their own taps and don't propagate to the outer Pressable. This is the same behavior as before.

**PhotoCarousel changes** (file: `components/feedCard/sharedCardElements.tsx`):

1. Add `onPhotoPress?: () => void` to the `PhotoCarousel` props interface.

2. In the multi-photo FlatList's `renderItem`, wrap the existing slide content in a `<Pressable onPress={onPhotoPress}>`:

```jsx
renderItem={({ item, index }) => {
  if (failedIndices.has(index)) return null;
  return (
    <Pressable onPress={onPhotoPress}>
      {renderSlide(item, index)}
    </Pressable>
  );
}}
```

3. In the single-photo branch, wrap the slide in the same `<Pressable onPress={onPhotoPress}>`.

4. **Why this works:** Inside a horizontal FlatList, a child Pressable only fires `onPress` on a clean tap. When the user swipes horizontally, the FlatList's scroll gesture handler claims the responder and cancels the Pressable's press. This is React Native's standard "scroll cancels press" behavior — no `unstable_pressDelay`, no `PanResponder`, no gesture handler library needed.

**Verification — this is the MOST IMPORTANT test in this checkpoint:**
- Horizontal swipe on a photo → carousel scrolls, NO navigation to CookDetail
- Tap on a photo → navigates to CookDetail
- Tap on title/description/recipe area → navigates to CookDetail
- Tap on stats/engagement area → navigates to CookDetail
- Tap on like button → fires like (not navigate)
- Tap on comment button → fires comment (not navigate)
- Tap on recipe line → fires recipe navigation (not CookDetail)
- Tap on overflow menu → fires menu (not navigate)
- All 4 feed group types still render correctly (solo, linked_cook_partner, linked_meal_event, linked_shared_recipe)

---

## Item 2: CommentsScreen keyboard return key

**File:** `screens/CommentsScreen.tsx`

**Problem:** The blue "send" button to the right of the spacebar on the iOS keyboard should be a dark gray "return" button.

**Fix:** Find the `<TextInput>` for comment input (around line 779). Change `returnKeyType="send"` to `returnKeyType="default"`. Keep the `onSubmitEditing={submitComment}` handler — the return key should still submit the comment, it just shouldn't look like a blue "send" button.

---

## Item 3: CookDetailScreen header title truncation

**File:** `screens/CookDetailScreen.tsx`

**Problem:** CP1 replaced the hardcoded "Cook" header with `postTitle`, but long titles run off the right edge instead of truncating with ellipsis. The title Text element doesn't have a width constraint, so `numberOfLines={1}` has no bounded width to trigger truncation.

**Fix:** Find the Block 1 header (around line 752-770). The header layout is: back button (left) — title (center) — menu button or spacer (right). Add `style={{ flex: 1 }}` to the title `<Text>` element so it fills the available space between the two side elements. This gives `numberOfLines={1}` a bounded width, and ellipsis truncation will kick in automatically.

The title should stay visually centered between the back button and the right element. If `flex: 1` alone doesn't center it (because the back button and menu button are different widths), add `textAlign: 'center'` to the title style.

---

## Item 4: Multi-photo select from library (P7-88)

**File:** `lib/services/imageStorageService.ts`

**Problem:** `pickImage()` returns a single URI. Users must pick one photo at a time.

**Fix — additive, do NOT change existing function signatures:**

1. Add `pickMultipleImages()`:
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

2. Add `chooseImageSourceMulti()`:
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

3. **Do NOT modify `pickImage()` or `chooseImageSource()`.** They return `string | null` and have callers across the codebase. The new `Multi` variants are additive.

4. **Update only post-photo callers** to use the new multi-select functions. Grep for all callers of `chooseImageSource` across the entire codebase first. The post-photo flow (EditMediaScreen's "add photo" button) should switch to `chooseImageSourceMulti()`. All other callers stay on the original.

5. **EditMediaScreen update:** The "add" button handler currently expects a single URI. Update it to receive `string[]` from `chooseImageSourceMulti()` and append each URI as a new photo entry in the grid.

---

## Item 5: Star picker stay-open behavior (P7-97)

**File:** `screens/MealEventDetailScreen.tsx`

**Problem:** The eater rating star picker auto-closes immediately after selecting a star (line 699: `setRatingPickerOpen(null)` inside `handleRatingSelect`). Disorienting — user can't verify or adjust.

**Fix:**
1. Remove `setRatingPickerOpen(null)` from `handleRatingSelect` (line 699). The picker stays open after selection.
2. Add a dismiss mechanism: a small "×" button at the right end of the star picker row that calls `setRatingPickerOpen(null)`.
3. Also add a `<Pressable>` overlay behind the picker (transparent, full-width) so tapping outside the star row also closes it. The overlay should cover the area between the dish row and the next dish row — NOT the entire screen.
4. The "tap same rating to clear" behavior (line 690) remains unchanged.
5. Add `console.warn` instrumentation: `[MealEventDetailScreen] star picker opened for postId: ${postId}` and `[MealEventDetailScreen] star picker dismissed`.

---

## Item 6: Inline engagement bar — not sticky (P7-98)

**Files:** `screens/CookDetailScreen.tsx` + `screens/MealEventDetailScreen.tsx`

**Problem:** Both detail screens have a sticky engagement bar at `position: absolute, bottom: 0`. Overlaps last ~60px of scroll content.

**Fix for CookDetailScreen:**
1. Move Block 14 (engagement bar, starting around line 1279) from OUTSIDE the `<ScrollView>` to INSIDE it, positioned after the comments preview section (Block 13).
2. Remove `position: 'absolute'`, `bottom: 0`, `left: 0`, `right: 0` from the `stickyBar` style.
3. Replace with inline styling: keep the `borderTopWidth`, `borderTopColor`, `backgroundColor`, horizontal padding. Add `marginTop: 12` for spacing from the content above.
4. Add `paddingBottom: 100` to the ScrollView's `contentContainerStyle` so there's comfortable space to scroll past the engagement bar.

**Fix for MealEventDetailScreen:**
1. Same pattern: move the sticky engagement bar (around line 1359) from outside ScrollView to inside it, after the "What everyone brought" dishes section.
2. Same style changes: remove absolute positioning, add inline styling, add bottom padding to ScrollView.

**Both screens:** The engagement bar scrolls with the content. It's part of the page, not a floating overlay.

---

## Constraints

- **Services handle ALL Supabase calls.** Components never call the database directly.
- **Never remove existing functionality** unless explicitly instructed.
- **Console.warn instrumentation** on new interactions.
- **Do NOT modify `pickImage()` or `chooseImageSource()`** — they have callers outside the post-photo flow. The new multi-select functions are additive.
- **The swipe fix (Item 1) affects all 4 feed group types.** Test that linked_cook_partner, linked_meal_event, and linked_shared_recipe groups still render and tap correctly — they all compose `CookCardInner`.

## Watch-fors

1. **Item 1 is the highest-priority fix.** If the restructured Pressable approach somehow breaks tap handling on non-photo areas (stats, engagement, etc.), the fallback is to wrap EACH non-interactive section in its own Pressable rather than grouping them into two blocks.
2. **`TappableTitleBlock` in sharedCardElements.tsx is dead code.** It was built for this exact purpose (Fix Pass 8) but went unused after CP5 reintroduced the card-wide Pressable. You can either delete it or leave it — but do NOT try to use it as-is, because the restructure here applies to `CookCardInner` specifically and `TappableTitleBlock` wraps in `TouchableOpacity` rather than `Pressable`.
3. **Inline engagement bar (Item 6) changes scroll content height.** Short posts may have the engagement bar near the bottom of the visible area. The 100px bottom padding handles this — but verify on a post with minimal content (no photos, short title, no comments).
4. **Multi-photo select (Item 4) — grep for ALL callers of `chooseImageSource` before touching anything.** Missed callers will silently break.

## SESSION_LOG reminder

Write a SESSION_LOG entry when done with: files modified, decisions made, deferred items, verification results.

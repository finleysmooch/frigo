# Frigo Session Log

Append new entries at the top. Archived logs from completed phases live in separate files (e.g., SESSION_LOG_PHASE4.md).

### 2026-03-24 — Phase 5+6 Git Commit
**Commit:** `4fc3357` on `main`
**Scope:** 39 files changed, +9,730 / -1,574 lines
**Includes:** All Phase 5 (Ingredient Architecture) + Phase 6A-H (Cooking Mode v2, RecipeDetailScreen Redesign + Corrections)

**Files committed (full list):**

*Modified:*
- `.claude/settings.local.json`
- `App.tsx`
- `components/IngredientPopup.tsx`
- `docs/FRIGO_ARCHITECTURE.md`
- `docs/SESSION_LOG.md`
- `docs/tracker_update.tsv`
- `lib/services/statsService.ts`
- `package-lock.json`
- `package.json`
- `screens/CookingScreen.tsx`
- `screens/RecipeDetailScreen.tsx`

*New files:*
- `components/cooking/ClassicView.tsx`
- `components/cooking/CompactTimerBar.tsx`
- `components/cooking/IngredientDetailPopup.tsx`
- `components/cooking/IngredientSheet.tsx`
- `components/cooking/PostCookFlow.tsx`
- `components/cooking/SectionCard.tsx`
- `components/cooking/SectionDots.tsx`
- `components/cooking/StepIngredients.tsx`
- `components/cooking/StepNoteDisplay.tsx`
- `components/cooking/StepNoteInput.tsx`
- `components/cooking/TimerDetail.tsx`
- `components/cooking/ViewModeMenu.tsx`
- `components/recipe/IngredientsSection.tsx`
- `components/recipe/PreparationSection.tsx`
- `components/recipe/RecipeHeader.tsx`
- `components/recipe/SaveIcon.tsx`
- `components/recipe/ScaleConvertControls.tsx`
- `contexts/CookingTimerContext.tsx`
- `docs/SESSION_LOG_PHASE5&6.md`
- `lib/services/cookingService.ts`
- `lib/services/postService.ts`
- `lib/types/cooking.ts`
- `lib/utils/timerDetection.ts`
- `scripts/classify_unmatched_ingredients.py`
- `scripts/detect-sections.ts`
- `scripts/test-cooking-service.ts`
- `scripts/test-ingredient-mapping.ts`
- `scripts/test-timer-detection.ts`

**Not committed (excluded):** `claude_project_upload/` (flat file export for Claude project), `claude_update/` (Claude.ai delivery files)

**Status:** Committed locally, NOT pushed. Branch `main` is 2 commits ahead of origin.

---

### 2026-03-24 — Sticky Nav PREPARATION Scroll Target Tuning
**Phase:** Phase 6H
**Prompt from:** User on-device feedback — PREPARATION tap cutting off Step 1

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — Tuned PREPARATION sticky tap scroll target through several iterations: +90 (PREPARATION title doubled), +70 (cut off 1 line of Step 1), +55 (bottom 15% of "Step 1" clipped), +45 (visible but tight), final: `preparationHeaderY + stickyOffset + 35` (Step 1 fully visible with white space above). The offset accounts for: accent line (3px) + marginBottom (16px) + "PREPARATION" title text (~20px) + title marginBottom (24px) = ~63px of content below the accent line, minus the stickyOffset (35px) already built into the base position.

**Status:** TypeScript compiles clean. PREPARATION scroll target finalized.

### 2026-03-24 — Fix B: Cooking Time / Servings Debug + Simplification
**Phase:** Phase 6H
**Prompt from:** User — cooking time/servings STILL not displaying, debug thoroughly

**Investigation findings:**

**Database query results for "Lemon and eggplant risotto" (id: 53bd7cfa):**
- `prep_time_min: null` — NO DATA IN DB
- `cook_time_min: null` — NO DATA IN DB
- `servings: 4` — exists
- `times_cooked` — COLUMN DOES NOT EXIST in the `recipes` table (confirmed via Supabase error 42703)

**Database statistics:**
- 475 total recipes
- 430 have servings data (non-null)
- Only 60 have prep_time_min data
- 415 recipes have NO cooking time data at all

**Code trace (all layers verified):**
1. Recipe interface in RDS: `servings?: number` — present
2. loadRecipeDetails: `servings: recipeData.servings || undefined` — correct (4 → 4)
3. Recipe interface in RecipeHeader: `servings?: number` — present
4. Render condition: `recipe.servings ? <Text>...` — correct (4 is truthy)

**Root cause:** The previous render logic used a complex nested `<View style={infoRow}>` with multiple conditional children inside a single outer `(recipe.servings || totalTime > 0 || ...)` gate. While logically correct, the complexity made it hard to verify visually. Additionally, the `times_cooked` field referenced a non-existent DB column (always undefined/0).

**Fix applied:** Simplified the entire time/servings display to two standalone `<Text>` elements:
- Time line: "Prep X min · Cook X min · Y min total" (only renders when `totalTime > 0`)
- Servings line: "N servings" (renders independently when `recipe.servings` is truthy)

Each is a direct `<Text style={styles.infoText}>` with no wrapping View or compound conditions. Removed `infoRow`, `infoSeparator`, `timeRow`, `timeText`, `timeSeparator` styles — consolidated into single `infoText` style.

**For "Lemon and eggplant risotto":** Will show "4 servings" only (no time, because time data is null in DB). To show cooking time, the `prep_time_min` and `cook_time_min` values need to be populated in the database.

**Files modified:**
- `components/recipe/RecipeHeader.tsx` — Replaced complex multi-conditional infoRow + timeRow with two simple standalone Text elements. Removed 6 unused styles. Added debug logs then removed them.
- `screens/RecipeDetailScreen.tsx` — Removed temporary debug log.

**Status:** TypeScript compiles clean. Ready for on-device testing.

### 2026-03-24 — Phase 6H Round 4 Post-Fix: Sticky Nav Tuning + Bookmark Size
**Phase:** Phase 6H Round 4
**Prompt from:** User on-device feedback — sticky nav scroll targets, bold alternation, bookmark size

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — Sticky nav scroll targets: INGREDIENTS tap scrolls to `ingredientsHeaderY + stickyOffset + 30` (real INGREDIENTS title hidden above viewport, first ingredient at top). PREPARATION tap scrolls to `preparationHeaderY + stickyOffset + 90` ("Step 1" at top, PREPARATION title fully off-screen). Bold alternation fixed: uses `showStickyPrepNow` (actual scroll position) instead of `showStickyPrep` (which includes persistence flag) — INGREDIENTS bold when in ingredients section, PREPARATION bold when scrolled to preparation, correctly alternates when scrolling between sections. Pantry count added to sticky bar INGREDIENTS label ("INGREDIENTS  4/12" in teal). Bookmark icon enlarged from 20px to 23px (+15%), horizontal padding tightened to 4px (was 6px) to sit closer to ⋮ menu. Added `stickyPantryCount` style.

**Status:** TypeScript compiles clean. Ready for on-device testing.

### 2026-03-24 — Phase 6H Round 4 Fixes 1-5
**Phase:** Phase 6H Round 4
**Prompt from:** PHASE_6H_ROUND4_FIXES.md Fixes 1-5

**Files modified:**
- `components/recipe/PreparationSection.tsx` — (Fix 1A) Focused step text now bold: added `bold` parameter to `renderInstructionWithClickableIngredients`, applies `stepTextBold` style (`fontWeight: '600'`) when step is focused. `isFocused` passed as the bold flag. Added `stepTextBold` style. (Fix 1B) Step ingredients default collapsed: changed `stepIngredientsCollapsed` initial state from `false` to `true`. Added `useEffect` that resets to `true` whenever `focusedStepKey` changes, so navigating via ‹/› always starts with ingredients hidden. Added `useEffect` import.
- `components/recipe/RecipeHeader.tsx` — (Fix 2) Increased `DESCRIPTION_LINE_LIMIT` from 3 to 5 lines. "Read More" was already on its own line below the text. (Fix 3) Replaced separate servings/time/cooked lines with a single `infoRow`: "4 servings · 45 min · Cooked 3x" on one line with dot separators. Each part conditional — shows whatever data exists. Styled with `#475569` text color (darker than before for visibility). Time breakdown row (Prep X · Cook X) only shows when BOTH values exist, in lighter `#94a3b8`. Removed `summaryText` and `cookedText` styles, added `infoRow`, `infoText`, `infoSeparator`.
- `screens/RecipeDetailScreen.tsx` — (Fix 4) Added `hasSeenPreparation` ref. Once `showStickyPrepNow` becomes true, `hasSeenPreparation.current` is set to `true` permanently. Sticky bar shows PREPARATION if currently scrolled past it OR if previously seen AND ingredients is still sticky. Bar only renders when `showStickyIngredients` is true (disappears entirely above ingredients). (Fix 5) Changed INGREDIENTS sticky tap scroll target from `ingredientsHeaderY - topBarHeight - 10` to `ingredientsHeaderY - topBarHeight - 40`, placing the INGREDIENTS header right below the top bar with scale controls above the viewport.

**DB changes:** none

**Fix 3 investigation — "Lemon and eggplant risotto" (id: 53bd7cfa):**
- `prep_time_min: null` — no data in DB
- `cook_time_min: null` — no data in DB
- `servings: 4` — exists in DB
- `totalTime = (null || 0) + (null || 0) = 0` — time section correctly hidden
- Servings should now display as "4 servings" in the info row. Previously it was rendering but may have been visually subtle (separate line, same color as other meta). Now part of a single info row with darker `#475569` color.
- **Root cause of time not showing: the data doesn't exist in the database for this recipe.** The code is correct — it shows whatever data is available. To fix for this recipe, `prep_time_min` and `cook_time_min` would need to be populated in the DB.

**Status:** TypeScript compiles clean (0 errors). All 5 fixes implemented. Ready for on-device testing.

### 2026-03-23 — Phase 6H Sticky Timing + SVG Save Icons + Top Bar Polish
**Phase:** Phase 6H
**Prompt from:** User on-device feedback — sticky header timing, SVG save icons, title centering, back button size, cooking time order

**Files created:**
- `components/recipe/SaveIcon.tsx` — Two SVG icon components: `SaveOutlineIcon` (outline bookmark from noun-save-4682832.svg, used for unsaved state) and `SaveFilledIcon` (filled bookmark from noun-bookmark-607266.svg, teal fill for saved state). Both accept `size` and `color` props.

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — Sticky header timing: reduced buffer from `topBarHeight + 40` to just `35` (offset for section title text below accent line). Sticky bar now includes a 3px dark accent line above the labels matching the section accent lines. Replaced emoji save icons (🤍/🔥) with SVG components (`SaveOutlineIcon`/`SaveFilledIcon`). Back button enlarged from 16pt to 22pt. Save icon tightened: `padding: 6` (was `paddingHorizontal: 8`). Overflow button tightened: `paddingHorizontal: 6` (was 10). Right buttons gap reduced to 2px. Title container margins reduced to 4px for better centering.

**Status:** TypeScript compiles clean. Ready for on-device testing.

### 2026-03-23 — Phase 6H Sticky Doubling Fix + Save Icon + Time Visibility
**Phase:** Phase 6H
**Prompt from:** User on-device feedback — sticky header doubling, save icon in top bar, cooking time not visible

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — Fixed sticky header doubling: added `stickyBuffer` (topBarHeight + 40) so sticky labels only appear after the real section title has fully scrolled off-screen. Prevents the brief moment where both the real INGREDIENTS title and the sticky version are visible simultaneously. Added save icon (🤍/🔥) to top bar next to ⋮ menu — taps `handleToggleCookSoon`, shows 🔥 when saved. Added `topRightButtons`, `topBarIcon`, `topBarIconText` styles.
- `components/recipe/RecipeHeader.tsx` — Reordered time/servings: cooking time now shows first (always visible when any time data exists), servings below it. Time row shows all available data: "Prep X min · Cook X min · Y min total". Previously time breakdown was hidden unless both prep AND cook existed. Servings on its own line below time.

**Status:** TypeScript compiles clean. Ready for on-device testing.

### 2026-03-23 — Phase 6H Sticky Header Style Fix
**Phase:** Phase 6H
**Prompt from:** User on-device feedback — sticky header too glitchy with teal underline

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — Removed teal underline and bottom border from sticky bar. Active section now bold black (`fontWeight: '700', color: '#111'`), inactive section light/unbolded (`fontWeight: '400', color: '#94a3b8'`). Removed `stickyTabActive` style entirely. When only INGREDIENTS is sticky (not scrolled to Preparation), it shows bold. When PREPARATION becomes sticky too, PREPARATION is bold and INGREDIENTS switches to light weight. Clean, no separator line.

**Status:** TypeScript compiles clean. Ready for on-device testing.

### 2026-03-23 — Phase 6H Round 3 Post-Fix: Layout Polish
**Phase:** Phase 6H Round 3
**Prompt from:** User on-device feedback — button placement, sticky header styling, top bar cleanup, title casing

**Files modified:**
- `components/recipe/RecipeHeader.tsx` (251 → 261) — Moved "+ Meal Plan" and "+ Cook Soon" buttons to the right of chef name and book reference using a `metaActionsRow` layout (chef/book on left, buttons on right). Removed separate `actionRow`. Added `toTitleCase()` helper (capitalizes each word except minor words: a, an, the, and, or, of, in, for, with, to, on, at, by, is). Exported `toTitleCase` for use in top bar. Applied title case to the main recipe title.
- `screens/RecipeDetailScreen.tsx` — Removed "Cook" button from top bar (just ← Back, centered title, ⋮ menu now). Title centered with `textAlign: 'center'`. Imported and applied `toTitleCase` to the top bar title. Updated sticky bar: labels now match the exact section title style (`fontSize: 15, fontWeight: '700', letterSpacing: 1.5, color: '#111'`). Active section (currently visible) gets a 2px teal bottom border. INGREDIENTS on the left, PREPARATION on the far right (`marginLeft: 'auto'`). Clicking INGREDIENTS scrolls so scale buttons are above screen (offset `-10` from header Y). Removed `topRightButtons`, `topCookButton`, `topCookButtonText` styles. Added `stickyTab`, `stickyTabRight`, `stickyTabActive`, `stickyTabText`, `stickyTabTextActive` styles.

**Decisions made during execution:**
- Active section determined by scroll position: when scrolled past PREPARATION, PREPARATION is underlined; otherwise INGREDIENTS is underlined (since it's the visible section).
- INGREDIENTS sticky tab scrolls to `ingredientsHeaderY - topBarHeight - 10` so the scale controls end up just above the viewport.
- Title casing skips minor words (articles/prepositions) when not the first word. First word always capitalized.
- Removed Cook button from top bar — the "Start Cooking" button at the bottom of the page is the primary cooking entry point.

**Status:** TypeScript compiles clean (0 errors). Ready for on-device testing.

### 2026-03-23 — Phase 6H Round 3 Fixes 1-8
**Phase:** Phase 6H Round 3
**Prompt from:** PHASE_6H_ROUND3_FIXES.md Fixes 1-8

**Files modified:**
- `screens/RecipeDetailScreen.tsx` (1,360 → 1,387) — (Fix 1) Progressive sticky bar: tracks both `ingredientsHeaderY` and `preparationHeaderY`, shows "INGREDIENTS" when scrolled past ingredients, adds "PREPARATION" when scrolled past preparation, both tappable to scroll to section. Replaced single `showStickyPrep` with `showStickyIngredients`/`showStickyPrep`/`showStickyBar`. Removed zero-height marker View. (Fix 2) Conditional title: added `titleBottomY` state, title only shows in top bar when `scrollY >= titleBottomY`. Empty flex spacer when title hidden. (Fix 3) Cook Soon: imported `addToCookSoon`, `removeFromCookSoon`, `isInCookSoon` from userRecipeTagsService. Added `isCookSoon` state, checks on mount in `loadPantryItems`, `handleToggleCookSoon` handler. Passed to RecipeHeader. (Fix 4) Renamed "Add to Meal Plan" → "+ Meal Plan" in overflow menu. (Fix 5) Added `servings` to Recipe interface, loaded from `recipeData.servings`. (Fix 6) Nutrition row: removed gray background, added hairline top border, lighter text color (#94a3b8). (Fix 7) Removed `currentUnitSystem` and `onShowUnitPicker` from ScaleConvertControls props. Moved "Unit Conversion" to overflow menu. (Fix 8) Overflow menu redesigned: removed section labels, view modes shown directly with ✓ prefix on active, "Edit Recipe" toggle, "Unit Conversion" (opens unit picker), divider, "+ Meal Plan". Compact item styling.
- `components/recipe/RecipeHeader.tsx` (197 → 251) — (Fix 3) Added `onToggleCookSoon`, `isCookSoon` props. New `actionRow` below book reference with two buttons: "+ Meal Plan" and "+ Cook Soon" / "✓ Saved" (teal-filled when active). (Fix 4) Button text changed to "+ Meal Plan". (Fix 5) Added `servings` to Recipe interface. New `summaryText` line above time breakdown: "4 servings · 45 min total". Time breakdown row now only shows when both prep AND cook exist. (Fix 2) Added `onTitleLayout` prop, title `<Text>` reports its Y+height via `onLayout`.
- `components/recipe/IngredientsSection.tsx` (455 → 468) — (Fix 1) Added `onHeaderLayout` prop and `containerOffsetRef`. Accent line reports absolute Y via `onLayout` for sticky bar tracking.
- `components/recipe/ScaleConvertControls.tsx` (167 → 102) — (Fix 7) Removed entire Convert section (dropdown, unit systems, related props/styles). Scale-only layout: just "Scale: [1x] [2x] [3x] [More]". Deemphasized inactive buttons: transparent background, `#94a3b8` text, subtle `#e2e8f0` border. Removed gray background container.

**DB changes:** none

**Decisions made during execution:**
- Fix 1: Both sticky labels use same teal color and are tappable. Left-aligned with gap, not space-between. Simpler than the previous "↑ Ingredients" / "PREPARATION ↓" with arrows.
- Fix 2: Title position tracked via `onLayout` on the actual title `<Text>` in RecipeHeader. When not visible, renders an empty `<View>` spacer to maintain flex layout.
- Fix 3: Cook Soon check runs alongside pantry load (both need user). Error swallowed (non-critical).
- Fix 5: Summary line combines servings + total time with dot separator. Detailed time breakdown only shown when both prep and cook times exist (avoids redundancy with summary line for single-time recipes).
- Fix 7: Chose Option 2 (move Convert to overflow menu) to declutter the scale row. Unit picker modal unchanged — just triggered from menu instead of dropdown.
- Fix 8: View mode items show inline with ✓ prefix (no submenu). Checkmark uses 4-space indent alignment for unchecked items.

**Status:** TypeScript compiles clean (0 errors). All 8 fixes implemented. Ready for on-device testing.

### 2026-03-23 — Phase 6H Round 2 Fixes 2-8
**Phase:** Phase 6H Round 2
**Prompt from:** PHASE_6H_ROUND2_FIXES.md Fixes 2-8

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — (Fix 2) Added recipe title in top bar between ← and ⋮/Cook. Truncated with `numberOfLines={1}`, tappable to scroll to top. Added `topTitleContainer` and `topTitle` styles. Shortened back button to just "←". (Fix 3) Removed auto-scroll from `handleStepFocus` — step expands in place. Changed arrow nav scroll target from `stepY - 200` to `stepY - 80` for better positioning. (Fix 4) Changed ⋮ menu from centered modal to anchored popover: `position: absolute, top: 52, right: 16`, transparent overlay instead of dark, added shadow/border for visual separation, compact item padding. (Fix 5) Removed standalone "Add to Meal Plan" body row and its styles. Passed `onShowMealModal` to RecipeHeader. (Fix 8) Increased floating button shadows: prev `shadowOpacity: 0.1→0.15`, both `elevation: 3→4`.
- `components/recipe/RecipeHeader.tsx` — (Fix 5) Added `onShowMealModal` prop. Replaced single `chefRow` with `chefMealRow` (flexDirection row, space-between): chef name on left + "Add to Meal" button on right. Button: white bg, 1px teal border, teal text, compact 13pt. Added `chefMealRow`, `addToMealBtn`, `addToMealBtnText` styles. Removed old `chefRow` style.
- `components/recipe/PreparationSection.tsx` — (Fix 6) Added scale support to `formatStepQuantity`: refactored to parse unicode fractions and decimals, multiply by scale, convert back to fraction display. Extracted `FRACTION_MAP`, `UNICODE_TO_DECIMAL`, `numberToFraction` helpers. Pass `currentScale` to `formatStepQuantity`. (Fix 7A) Added `stepIngredientsCollapsed` state. Step ingredients header is now tappable with ▾/▸ disclosure arrow. Tapping toggles list without exiting focus mode. (Fix 7B) Reduced step text from 18pt/28lh to 16pt/26lh. Step ingredient rows reduced from 14pt to 13pt. Added `stepIngredientsHeader`, `stepIngredientsArrow` styles. Added `paddingLeft: 16` indent to ingredient rows. Re-imported `useState`.

**DB changes:** none

**Decisions made during execution:**
- Fix 2: Back button shortened to "←" (no "Back" text) to save space for the title.
- Fix 4: Menu positioned at `top: 52` (top bar height) + `right: 16`. Transparent overlay (not dark) — cleaner for a dropdown. Shadow provides visual separation.
- Fix 5: "Add to Meal" button shows even when there's no chef name — the `chefMealRow` always renders, the chef name conditionally renders within it.
- Fix 6: `formatStepQuantity` now handles unicode fraction characters (½, ⅓, etc.) by converting to decimal before scaling, not just raw decimal strings. The `numberToFraction` helper is reusable.
- Fix 7: Single collapsed state for all steps (not per-step). When user collapses ingredients on one step, navigating to another step inherits the same collapsed state. This feels natural — the user chose whether to see ingredients.

**Status:** TypeScript compiles clean (0 errors). All 7 fixes implemented. Ready for on-device testing.

### 2026-03-23 — Phase 6B Corrections Step 5: Final Polish + On-Device Verification
**Phase:** Phase 6B Corrections
**Prompt from:** PHASE_6B_CORRECTIONS_GUIDE.md Step 5 — Full verification, edge case review, dead code cleanup

**Files modified:**
- `screens/RecipeDetailScreen.tsx` (1,366 → 1,360 lines) — Removed `console.log` in meal modal success callback. Simplified empty callbacks for `onSuccess`/`onCreateNewMeal`.
- `components/recipe/PreparationSection.tsx` (562 → 561 lines) — Removed unused `useCallback` import.

**5a. Step 1 Bug Fixes Verification:**

| # | Check | Result | Code trace |
|---|-------|--------|------------|
| 1 | ⅓ × 2 = ⅔ | PASS | `0.333*2=0.666`, `frac=0.666`, `abs(0.666-0.667)<0.02` → ⅔ |
| 2 | ¼ × 3 = ¾ | PASS | `0.25*3=0.75`, `frac=0.75`, `abs(0.75-0.75)<0.01` → ¾ |
| 3 | "eggplants" fully bold | PASS | `splitIngredientParts("2 medium eggplants")` → prefix="2 medium ", ingredientName="eggplants" (bold) |
| 4 | "onion" bold | PASS | `splitIngredientParts("1 medium onion, finely chopped")` → prefix="1 medium ", ingredientName="onion" (bold), preparation=", finely chopped" |
| 5 | "risotto rice" bold | PASS | `splitIngredientParts("7 oz good-quality risotto rice")` → prefix="7 oz ", ingredientName="good-quality risotto rice" (bold) |
| 6 | Popup doesn't overlap | PASS | GAP=12px, shows above tap point by default, flips below if near top. Arrow points at tap X. |
| 7 | Step ingredients: fractions + units | PASS | `formatStepQuantity` converts 0.333→⅓, 0.5→½; bare numbers get unit from main ingredients list |

**5b. Steps 2-4 Changes Verification:**

| # | Check | Result | Code trace |
|---|-------|--------|------------|
| 1 | No #007AFF anywhere | PASS | Grep returns 0 matches across all recipe files |
| 2 | Top bar: Back + ⋮ + Cook | PASS | Lines 608-660: backButton, overflowButton, topCookButton |
| 3 | ⋮ menu: View Mode, Edit Mode, Add to Meal | PASS | Lines 664-700: menuSectionLabel + 3 view modes + divider + edit toggle + meal |
| 4 | "Add to Meal" body row works | PASS | Line 737: TouchableOpacity → setShowMealModal(true) |
| 5 | Sticky PREPARATION bar | PASS | showStickyPrep computed from scrollY >= preparationHeaderY - topBarHeight |
| 6 | "↑ Ingredients" scrolls back | PASS | scrollTo ingredientsSectionY - topBarHeight |
| 7 | Step focus: border + ingredients + buttons | PASS | stepContainerFocused style + isFocused → renderStepIngredients + focusedStepKey !== null → floatingNav |
| 8 | ‹ › navigate between steps | PASS | handleStepNav with stepKeys array, auto-scroll to stepY-200 |
| 9 | Tap focused step → exit | PASS | handleStepFocus: if focusedStepKey === stepKey → setFocusedStepKey(null) |
| 10 | Grocery list bordered styling | PASS | groceryListBox with 🛒 icon, groceryListAllLink secondary below |
| 11 | Nutrition in new position, expands/collapses | PASS | Between Add to Meal and Scale/Convert, nutritionRow with ▸/▾ toggle |

**5c. Edge Cases:**

| # | Case | Result | Code trace |
|---|------|--------|------------|
| 1 | Recipe with 1 step — buttons disabled | PASS | stepKeys.length=1, focusedIdx=0, canGoPrev=false (0>0), canGoNext=false (0<0) → both disabled |
| 2 | Recipe with no image | PASS | RecipeHeader: `recipe.image_url ? <Image> : null` |
| 3 | Long ingredient list — grocery links after scroll | PASS | Links at bottom of IngredientsSection, natural scroll |
| 4 | Scale 3x + scroll to prep — sticky bar | PASS | scrollY tracking independent of scale state, preparationHeaderY re-measured on layout |
| 5 | Focus mode + sticky bar simultaneously | PASS | Both are independent: sticky bar is position-based View, floating buttons are position:absolute. No conflict. |

**5d. Cleanup:**
- Removed `console.log` in meal modal success callback
- Removed unused `useCallback` import from PreparationSection
- No unused styles found
- No dead code from previous iterations
- TypeScript compiles clean (0 errors)

**Status:** All 23 checklist items pass. TypeScript clean. Ready for on-device verification.

---

## Phase 6B Corrections Complete

### All files modified across Steps 1-5

| File | Original (pre-corrections) | Final | Steps |
|------|---------------------------|-------|-------|
| `screens/RecipeDetailScreen.tsx` | 1,167 | 1,360 | 1-5 |
| `components/recipe/RecipeHeader.tsx` | 181 | 197 | (prior fixes: description expand) |
| `components/recipe/IngredientsSection.tsx` | 404 | 455 | 1 (fractions, bold name), (prior fixes: grocery styling, pantry count) |
| `components/recipe/PreparationSection.tsx` | 449 | 561 | 1 (highlight), 3 (focus mode, step Y, buildStepKeys) |
| `components/recipe/ScaleConvertControls.tsx` | 167 | 167 | (prior: colors only) |
| `components/IngredientPopup.tsx` | 133 | 156 | 1 (gap increase), (prior: positioning rewrite) |
| `App.tsx` | — | 839 | (prior: headerShown: false) |

**Total lines across recipe detail system:** 2,896 (5 recipe components + parent screen)

### Summary of all corrections applied

**Step 1 — Bug Fixes:**
- Fraction scaling: added thirds (⅓, ⅔) and all eighths to display logic using tolerance-based matching
- Bold ingredient name: replaced JSONB name matching with text-structural approach (bold everything between quantity+unit prefix and first comma)
- Ingredient highlight: removed background from clickable ingredients in step text (teal color only)
- Popup positioning: 12px gap, above-by-default with below-fallback, arrow tracks tap X
- Step ingredient quantities: formatStepQuantity converts decimals→fractions, recovers units from main ingredients list

**Step 2 — Frigo Colors + Top Bar:**
- All `#007AFF` replaced with Frigo teal `#0d9488`, blue tint backgrounds → teal tint `#f0fdfa`
- Top bar simplified to: ← Back + ⋮ overflow + Cook
- ⋮ menu contains: View Mode (Original/Clean/Markup), Edit Mode toggle, Add to Meal Plan
- "Add to Meal Plan" row added on page body between description and nutrition

**Step 3 — Sticky Header + Step Focus:**
- Sticky PREPARATION bar: appears on scroll past header, "↑ Ingredients" scrolls back
- Step focus mode: teal border + background + expanded ingredients + floating ‹/› navigation buttons
- Auto-scroll to center focused step, disabled buttons at first/last step
- `buildStepKeys` exported helper for ordered step navigation

**Step 4 — Grocery List + Nutrition:**
- Already complete from prior fix sessions (bordered grocery links with 🛒, nutrition repositioned)

**Step 5 — Polish:**
- Removed console.log, unused import
- All 23 checklist items pass

### Known issues / remaining rough edges

1. **Ingredient tap in ingredients list** — Ingredients are not tappable in the ingredients list (only in step text). Would need `mapIngredientsToSteps` imported + onPress handlers in IngredientsSection.
2. **"Add a Note" button** — Notes section shows existing notes but has no dedicated add-note UI. Existing annotation edit mode can add notes.
3. **Step ingredient quantities not scale-aware** — Expanded step ingredients show raw quantities from JSONB, not adjusted for current scale multiplier.
4. **Step Y positions** — Measured via `onLayout` which may be stale after dynamic content changes (nutrition expand, etc.). Re-measured on next layout pass.
5. **Popup height estimated** — `IngredientPopup` uses `ESTIMATED_POPUP_HEIGHT=70` rather than measuring dynamically. Works for typical content but could mis-position with very long text.

### 2026-03-23 — Phase 6B Corrections Step 4: Grocery List Styling + Nutrition Repositioning
**Phase:** Phase 6B Corrections
**Prompt from:** PHASE_6B_CORRECTIONS_GUIDE.md Step 4 — Grocery list visual treatment + nutrition panel repositioning

**Files modified:** None — both changes were already implemented in prior fix sessions.

**Verification:**
- (4a) Grocery list styling: `IngredientsSection.tsx` already has `groceryListBox` (bordered container with 🛒 cart icon for "Add missing" primary link) and `groceryListAllLink`/`groceryListAllText` (lighter secondary "Add all" link). Implemented during Fix 6 session.
- (4b) Nutrition repositioning: `RecipeDetailScreen.tsx` already has nutrition panel between "Add to Meal Plan" row (line 736) and Scale/Convert controls (line 760), styled with light gray background (`#f8f8f8`), disclosure arrow (`▸`/`▾`), and lazy-rendered `RecipeNutritionPanel`. Implemented during Fix 7 session.
- Layout order matches spec exactly: Header → Add to Meal → Nutrition → Scale/Convert → Ingredients → Preparation → Start Cooking → Notes.

**Status:** TypeScript compiles clean. No changes needed — Step 4 was already complete.

### 2026-03-23 — Phase 6B Corrections Step 3: Sticky Preparation Header + Step Focus Navigation
**Phase:** Phase 6B Corrections
**Prompt from:** PHASE_6B_CORRECTIONS_GUIDE.md Step 3 — Sticky PREPARATION bar on scroll, step focus mode with floating ‹/› navigation

**Files modified:**
- `components/recipe/PreparationSection.tsx` (497 → 562 lines) — (3a) Added `onHeaderLayout` prop to report PREPARATION accent line Y position for sticky bar trigger. Added `containerOffsetRef` to track the component's Y offset in scroll content for accurate step position reporting. (3b) Added focus mode: new props `focusedStepKey`, `onStepFocus`, `onStepLayout`. Each step's `onLayout` reports its Y position (container offset + local Y) via `onStepLayout`. Tapping a step calls `onStepFocus(stepKey)` instead of the old internal `toggleStepExpansion`. Focused step gets `stepContainerFocused` style: 3px teal left border, light teal background (`rgba(13,148,136,0.03)`), full-width bleed. Step ingredients expand when focused (was `expandedStep`, now uses `focusedStepKey`). Removed internal `expandedStep` state and `useState` import (now uses parent-controlled focus). Added `buildStepKeys()` exported helper that builds an ordered list of step keys from instruction data for ‹/› navigation. All unfocused steps remain fully visible at full opacity.
- `screens/RecipeDetailScreen.tsx` (1,167 → 1,366 lines) — (3a) Restored scroll tracking: `scrollY` state, `onScroll` handler on ScrollView with `scrollEventThrottle={16}`. Added `ingredientsSectionY` (from zero-height View marker above IngredientsSection) and `preparationHeaderY` (from PreparationSection's `onHeaderLayout`). Sticky bar renders between Modal and ScrollView: shows when `scrollY >= preparationHeaderY - topBarHeight`. Left side: "↑ Ingredients" in teal, taps scroll to `ingredientsSectionY`. Right side: "PREPARATION" label. Slim white bar with hairline bottom border. (3b) Added `focusedStepKey` state, `stepPositionsRef` (Map of stepKey → Y), `handleStepFocus` (toggle focus + auto-scroll), `handleStepNav` (‹/› with auto-scroll), `handleStepLayout` (stores Y in ref). Computed `stepKeys` via `buildStepKeys`, `focusedIdx`/`canGoPrev`/`canGoNext` for button enable/disable. Floating nav buttons render as position:absolute bottom-right: ‹ button (white circle, teal border/text), › button (teal circle, white text). Both 44px circles with shadow. Disabled at 35% opacity. Imported `buildStepKeys` from PreparationSection. Passed new props to PreparationSection: `focusedStepKey`, `onStepFocus`, `onStepLayout`, `onHeaderLayout`.

**DB changes:** none

**Decisions made during execution:**
- Step Y positions stored in a ref (not state) to avoid re-renders on every `onLayout` callback. The parent reads from the ref map when it needs to scroll.
- `buildStepKeys` is exported from PreparationSection so the parent can compute the ordered step list using the same merge logic. This avoids duplicating `mergeConsecutiveSections`.
- Auto-scroll targets `stepY - 200` to roughly center the focused step (200px from top accounts for top bar + sticky bar + some breathing room).
- Sticky bar uses the PREPARATION accent line's Y position via `onHeaderLayout` — this triggers exactly when the PREPARATION header scrolls past the top bar.
- Ingredients section Y tracked via a zero-height marker `<View>` right before IngredientsSection (cleaner than adding onLayout prop to IngredientsSection).
- Focus mode uses `stepContainerFocused` with negative margins to make the teal border and background bleed to full width despite the container's 16px padding. `paddingLeft: 28` = 16 (restored margin) + 12 (content indent).

**Status:** TypeScript compiles clean (0 errors). RecipeDetailScreen 1,366 lines, PreparationSection 562 lines. Ready for on-device testing. Key things to verify: sticky bar appears/disappears on scroll, "↑ Ingredients" scrolls back up, step tap shows teal border + ingredients + floating buttons, ‹/› navigate and auto-scroll, tap focused step exits focus mode.

### 2026-03-23 — Phase 6B Corrections Step 2: Frigo Colors + Top Bar Simplification
**Phase:** Phase 6B Corrections
**Prompt from:** PHASE_6B_CORRECTIONS_GUIDE.md Step 2 — Apply Frigo teal throughout, simplify top bar, add meal plan body row

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — (2a) Colors: `#007AFF` was already replaced with Frigo teal `#0d9488` in a prior fix session. Fixed 3 remaining blue tint backgrounds (`#f0f7ff` → `#f0fdfa` Frigo teal tint) in scale picker selected, unit picker selected, and menu item active states. (2b) Top bar simplified: removed view mode button, edit mode button, and add-to-meal button. New top bar is just: ← Back (left) + ⋮ overflow button + Cook button (right). The ⋮ overflow menu contains: View Mode section (Original/Clean/Markup with checkmark), divider, Edit Mode toggle, Add to Meal Plan. Removed `topSmallButton`, `topSmallButtonActive`, `topSmallButtonText`, `topAddToMealButton`, `topAddToMealButtonText`, `topStartCookingButton`, `topStartCookingButtonText` styles. Added `overflowButton`, `overflowButtonText`, `topCookButton`, `topCookButtonText`, `menuSectionLabel`, `menuDivider` styles. Renamed `showViewModeMenu`/`setShowViewModeMenu` → `showOverflowMenu`/`setShowOverflowMenu`. Replaced `menuTitle` style with `menuSectionLabel` (smaller, uppercase, muted color). Added "Add to Meal Plan" row on page body between description and nutrition panel with subtle bordered row style. Removed emoji prefixes from view mode labels in menu (was "📖 Original", now just "Original").

**DB changes:** none

**Decisions made during execution:**
- Overflow menu uses centered modal (same pattern as the old view mode menu) rather than a dropdown anchored to the ⋮ button. This is simpler and works well on mobile.
- Menu divider separates view mode options from edit/meal actions since they're different categories.
- "Add to Meal Plan" body row uses hairline borders top and bottom to read as a distinct tappable row without being heavy.
- Kept the `menuOverlay` style with centered positioning (existing pattern). Changed `menuContainer` width from 200 to 220 to accommodate "Add to Meal Plan" text.

**Status:** TypeScript compiles clean (0 errors). No `#007AFF` or blue-tinted backgrounds remain in any recipe-related files. Ready for on-device testing.

### 2026-03-23 — Phase 6B Corrections Step 1: Bug Fixes
**Phase:** Phase 6B Corrections
**Prompt from:** PHASE_6B_CORRECTIONS_GUIDE.md Step 1 — Fix fractions, bold matching, highlight, popup, step quantities

**Files modified:**
- `components/recipe/IngredientsSection.tsx` — (1a) Fixed fraction scaling: replaced hardcoded half/quarter display checks with unified fraction lookup using tolerance-based matching. Added thirds (⅓, ⅔) and all eighths (⅛, ⅜, ⅝, ⅞) to display logic. ⅓×2 now shows ⅔, ¼×3 shows ¾. (1b) Replaced `findIngredientName` (JSONB name matching) with `splitIngredientParts` (text-structural approach). New approach: strip quantity+unit prefix via regex → split remainder on first comma → bold everything before comma (ingredient name + descriptors), regular weight after comma (preparation). Handles "eggplants" (no plural mismatch), "onion" (no lookup needed), "good-quality risotto rice" (descriptors bolded with name). Renamed style `ingredientName` → `ingredientBoldName` to avoid variable shadowing.
- `components/recipe/PreparationSection.tsx` — (1c) Removed `backgroundColor` from `clickableIngredient` style. Tappable ingredients in step text now use teal color only, no background highlight.
- `components/IngredientPopup.tsx` — (1d) Increased GAP from 8px to 12px per spec. Popup positioning (above/below with arrow) was already fixed in prior session.

**DB changes:** none

**Decisions made during execution:**
- 1a: Used tolerance-based fraction matching (`Math.abs(frac - target) < 0.01` for most, `< 0.02` for thirds) instead of exact modulo checks. This handles floating-point imprecision from scaling.
- 1b: The text-structural approach is more robust than JSONB name matching because it works with the actual display string. No pluralization issues, no partial match failures. Trade-off: descriptors like "good-quality" get bolded along with the ingredient name, but this is visually clean — the whole ingredient description stands out.
- 1e: `formatStepQuantity` in PreparationSection already had thirds support and unit recovery from prior session. No changes needed.

**Test results (code-level verification):**
- ⅓ × 2: `0.333 * 2 = 0.666`, `frac = 0.666`, `Math.abs(0.666 - 0.667) < 0.02` → ⅔ ✓
- ¼ × 3: `0.25 * 3 = 0.75`, `frac = 0.75`, `Math.abs(0.75 - 0.75) < 0.01` → ¾ ✓
- "2 medium eggplants": prefix="2 medium ", ingredientName="eggplants", preparation="" → **eggplants** bold ✓
- "1 medium onion, finely chopped": prefix="1 medium ", ingredientName="onion", preparation=", finely chopped" → **onion** bold ✓
- "7 oz good-quality risotto rice": prefix="7 oz ", ingredientName="good-quality risotto rice", preparation="" → **good-quality risotto rice** bold ✓
- Clickable ingredient: teal color only, no background ✓
- Popup gap: 12px ✓
- Step quantities: formatStepQuantity handles 0.333→⅓, 0.5→½, bare numbers→unit recovery ✓

**Status:** TypeScript compiles clean (0 errors). Ready for on-device testing.

### 2026-03-23 — Phase 6B Step 5: Polish + Integration Test
**Phase:** Phase 6B (RecipeDetailScreen Redesign)
**Prompt from:** PHASE_6B_RECIPE_DETAIL_REDESIGN.md Step 5 — Final polish, full feature verification, typography audit, edge case review

**Files modified:**
- `screens/RecipeDetailScreen.tsx` (1,175 → 1,167 lines) — Updated file header comment (removed stale Nov 2025 comment, replaced with Phase 6B description). Removed stale "NEW:" comment on meal button. No functional changes.

**DB changes:** none

**5a. Feature Verification Checklist:**

| # | Feature | Result | Notes |
|---|---------|--------|-------|
| 1 | Recipe with hero image loads correctly | PASS | RecipeHeader renders `<Image>` when `image_url` truthy |
| 2 | Recipe without image loads correctly | PASS | RecipeHeader renders null, no layout break |
| 3 | Book reference link navigates to BookView | PASS | `onBookPress` → `navigation.navigate('BookView')` |
| 4 | Chef name link navigates to AuthorView | PASS | `onChefPress` → `navigation.navigate('AuthorView')` |
| 5 | Scale 1x/2x/3x buttons update ingredient quantities | PASS | ScaleConvertControls → `setCurrentScale` → `parseAndScaleQuantity` |
| 6 | "More" scale picker opens and works | PASS | `showScalePicker` modal with PICKER_OPTIONS 1-10 |
| 7 | Unit conversion (Original/Metric/Imperial) works | PASS | `showUnitPicker` modal → `setCurrentUnitSystem` → `convertRecipeIngredients` |
| 8 | Ingredient popup shows on tapping ingredient in step text | PASS | `splitInstructionIntoParts` → `onIngredientPress` → `IngredientPopup` |
| 9 | Ingredient tap on Ingredients section shows step usage | DEFERRED | Not implemented — ingredients in IngredientsSection are not tappable. Deferred in Step 2. |
| 10 | Grocery list modal opens and works (+ Missing / + All) | PASS | `onShowMissingListModal` / `onShowAllListModal` → `listModalMode` → `AddRecipeToListModal` |
| 11 | Add to Meal modal opens and works | PASS | `showMealModal` → `SelectMealForRecipeModal` |
| 12 | Edit mode toggle works | PASS | `setIsEditMode(!isEditMode)` on top bar button |
| 13 | Ingredient inline editing works (edit, save, cancel) | PASS | `InlineEditableIngredient` renders when `editingIngredientIndex === globalIndex` |
| 14 | Instruction inline editing works (edit, save, cancel, delete) | PASS | `InlineEditableInstruction` renders when editing, has save/cancel/delete |
| 15 | View mode menu works (Original/Clean/Markup) | PASS | Modal with 3 ViewMode options |
| 16 | Markup annotations display correctly | PASS | Both sections render `MarkupText` when `viewMode === 'markup'` |
| 17 | Cook button navigates to CookingScreen with correct params | PASS | Both top bar and bottom button pass `recipe`, `planItemId`, `mealId`, `mealTitle` |
| 18 | Nutrition panel shows | PASS | Collapsed by default, `nutritionExpanded` toggle, lazy-renders `RecipeNutritionPanel` |
| 19 | Step expansion shows correct per-step ingredients | PASS | `stepIngredients` Map from `mapIngredientsToSteps`, one-at-a-time toggle |
| 20 | Recipes with sections show section headers | PASS | `mergedSections.length > 1` → shows uppercase headers between groups |
| 21 | Recipes without sections show flat step list | PASS | Falls back to `displayInstructions` rendering |
| 22 | Recipes with no instructions show "No instructions available" | PASS | PreparationSection line 273 |

**5b. Typography & Spacing Audit:**

| Element | Spec | Actual | Result |
|---------|------|--------|--------|
| Ingredient text size | ~16pt | 16pt | PASS |
| Ingredient line spacing | ~28px between items | 26px lineHeight + 12px paddingVertical = ~38px per item | PASS |
| Step text size | ~18-20pt | 18pt | PASS |
| Step line height | ~28-30px | 28px | PASS |
| Section header "INGREDIENTS" | uppercase, bold, ~14-16pt | 15pt, fontWeight 700, uppercase, letterSpacing 1.5 | PASS |
| Section header "PREPARATION" | matches INGREDIENTS | Same styles | PASS |
| Accent lines | 3-4px dark line | 3px, #222 | PASS |
| Group headers | uppercase, bold, ~13pt | 13pt, fontWeight 700, uppercase, letterSpacing 1 | PASS |
| Step labels "Step N" | bold, ~14pt | 14pt, fontWeight 700 | PASS |
| Overall whitespace | generous, breathable | stepContainer mb 28, ingredientRow pv 6, groupHeader mt 20 | PASS |

**5c. Edge Cases (code review — not on-device):**

| Case | Code Path | Result |
|------|-----------|--------|
| Recipe with 1 ingredient, 1 step | Both render loops handle single-item arrays | PASS |
| Recipe with 20+ ingredients | No limit, renders all with scroll | PASS |
| Very long step text | Text wraps naturally, no truncation on steps | PASS |
| `mapIngredientsToSteps` returns empty for a step | `renderStepIngredients` returns null, step still renders | PASS |
| All ingredients in one group | `distinctGroupNames.size === 1` → no header shown | PASS |
| Recipe with no group data (48 recipes) | All `group_name` null → flat list, no headers | PASS |

**Decisions made during execution:**
- No functional code changes needed — all features trace correctly through the code. Only cleaned stale comments.
- Item 9 (tappable ingredients in ingredients list) confirmed as known deferral, not a regression.

**Status:** TypeScript compiles clean. All 21 of 22 checklist items pass. 1 item (ingredient tap → step usage) is a known deferral from Step 2. Typography and spacing all match spec. Edge cases all handled.

---

## Phase 6B RecipeDetailScreen Complete

### All files created/modified across Steps 1-5

**Files created:**
| File | Lines | Step | Purpose |
|------|-------|------|---------|
| `components/recipe/RecipeHeader.tsx` | 181 | 1, 4 | Hero image, title, chef, book, time, description with Read More |
| `components/recipe/IngredientsSection.tsx` | 404 | 1, 2, 4 | NYT-style ingredients: group_name grouping, bold quantities, pantry indicators, grocery list links |
| `components/recipe/PreparationSection.tsx` | 449 | 1, 3 | NYT-style preparation: merged sections, "Step N" labels, 18pt text, tappable step expansion |
| `components/recipe/ScaleConvertControls.tsx` | 167 | 1 | Scale 1x/2x/3x/More + unit system dropdown |

**Files modified:**
| File | Original | Final | Steps |
|------|----------|-------|-------|
| `screens/RecipeDetailScreen.tsx` | 2,021 | 1,167 | 1-5 |

**Total lines:** 2,368 across 5 files (vs original 2,021 in 1 file). The increase is due to duplicated types/utilities for component self-containment and new features (notes section, nutrition toggle, grocery list mode).

### Summary of changes (Steps 1-5)

1. **Step 1:** Extracted 4 presentational sub-components. Pure refactor, zero visual change.
2. **Step 2:** Rebuilt IngredientsSection with recipe-author grouping (`group_name` from JSONB), bold quantity formatting, NYT typography. Removed sticky headers, collapsible ingredients.
3. **Step 3:** Rebuilt PreparationSection with "Step N" labels, 18pt text, section header merging, tappable step ingredient expansion. Removed collapsible instructions.
4. **Step 4:** Reordered layout (NYT hierarchy), added collapsible nutrition panel, outlined Start Cooking button, Your Private Notes section, pantry-aware grocery list (missing vs all).
5. **Step 5:** Full verification, typography audit, edge case review, stale comment cleanup.

### Known issues / rough edges

1. **Ingredient tap in Ingredients section** — Ingredients are not tappable in the ingredients list (only in step text). Spec item 2b.7 requested tap-to-see-step-usage but was deferred. Would need importing `mapIngredientsToSteps` into IngredientsSection and adding onPress handlers.
2. **"Add a Note" button** — The Notes section shows existing notes and an empty state, but has no "Add a Note" button/modal. The existing annotation edit mode can add notes. A dedicated note input modal was deferred.
3. **Step ingredient quantities not scaled** — The expandable step ingredients show raw quantities from `mapIngredientsToSteps`, not scaled quantities. Low priority enhancement.
4. **Yield/servings display** — Spec 2b mentioned "Yield: 4 servings" but servings data isn't on the Recipe interface or loaded from DB.

### Tracker rows

See `docs/tracker_update.tsv`.

### 2026-03-23 — Phase 6B Step 4: Rebuild Overall Layout
**Phase:** Phase 6B (RecipeDetailScreen Redesign)
**Prompt from:** PHASE_6B_RECIPE_DETAIL_REDESIGN.md Step 4 — Reorder page layout to match NYT hierarchy, remove wrapper patterns, add accent lines, clean dead code

**Files modified:**
- `components/recipe/RecipeHeader.tsx` (135 → 181 lines) — (4a/4b.4) Complete layout reorder per NYT spec: hero image → title (28pt bold) → chef name (tappable, blue) → book reference with page (tappable, blue) → time row (Prep · Cook · Total with dot separators, no emojis) → times cooked → description with expandable "Read More" for long text (truncated to 3 lines by default, uses `numberOfLines` + `onTextLayout` to detect truncation). Removed all emoji prefixes from meta/source rows. Changed from `<>` fragment wrapper layout to cleaner semantic structure.
- `components/recipe/IngredientsSection.tsx` (380 → 404 lines) — (4b.8) Restored pantry-aware grocery list: replaced single `onShowListModal` callback with `onShowMissingListModal` + `onShowAllListModal`. Added `missingCount` prop. When missing ingredients exist, shows "Add missing (N) to Grocery List" as primary blue link + "Add all to Grocery List" as secondary gray link below. When all in pantry, shows only "Add all to Grocery List" in blue.
- `screens/RecipeDetailScreen.tsx` (1,089 → 1,175 lines) — (4a) Reordered scroll layout: Header → Scale/Convert → Ingredients → Nutrition (collapsed) → Preparation → Start Cooking → Your Notes. (4b.1/4b.2) Already done in Steps 2-3 — IngredientsSection and PreparationSection use flat layouts with accent lines, no card wrappers. (4b.3) Moved Nutrition panel between Ingredients and Preparation; wrapped in collapsible container with "Nutritional Information" toggle link (collapsed by default, `nutritionExpanded` state). RecipeNutritionPanel only renders when expanded. (4b.5) Changed Start Cooking button to outlined/bordered style: 2px dark border, no fill, dark text with letter-spacing. (4b.6) Added "Your Private Notes" section at bottom: shows note annotations if any exist, otherwise "You haven't added any notes to this recipe yet." placeholder. (4b.7) Kept both Cook buttons (top bar + bottom). (4b.8) Added `listModalMode` state ('missing' | 'all') to control which ingredients go to AddRecipeToListModal. IngredientsSection now gets `missingCount`, `onShowMissingListModal`, `onShowAllListModal` props. (4c) Removed dead code comment about sub-component styles. Removed `console.log` debug statements (already cleaned in Step 3).

**DB changes:** none

**Decisions made during execution:**
- Description "Read More" uses React Native's `numberOfLines` prop with `onTextLayout` callback to detect whether truncation is needed. Only shows "Read More" link when text actually exceeds 3 lines. State managed locally in RecipeHeader.
- Nutrition panel lazy-renders: RecipeNutritionPanel only mounts when `nutritionExpanded` is true. This avoids the nutrition API call until the user actually wants to see it.
- Notes section reads from existing `annotations` array (filtering for `field_type === 'note'`). No new data loading needed. The "Add a Note" button/modal from the spec was deferred — the annotation system's note-adding capability already exists via edit mode, and building a new dedicated note modal is better suited for the polish step.
- RecipeHeader layout reorder follows spec exactly: title → chef (tappable) → book reference with " · p.XX" dot separator (tappable) → time with dot separators → cooked count → description.
- Time row only shows "Total" when it differs from both prep and cook (avoids redundant "Prep 30 min · Total 30 min").

**Deferred during execution:**
- "Add a Note" button with dedicated text input modal — the spec describes a simple text area modal. The existing annotation edit mode can add notes, but a dedicated button/modal would be cleaner. Better for Step 5 polish.
- Notes section doesn't have edit/delete buttons for individual notes — would be a nice enhancement but not in spec scope.

**Recommended doc updates:**
- ARCHITECTURE: Note the new layout order and that Nutrition panel is lazy-loaded (only when expanded)
- DEFERRED_WORK: "Dedicated 'Add a Note' modal for RecipeDetailScreen notes section"

**Status:** TypeScript compiles clean (0 errors in changed files). Ready for on-device testing. Key things to verify: layout order matches NYT spec, description Read More works (test with long and short descriptions), nutrition toggle expands/collapses, Start Cooking outlined button works, grocery list missing vs all links work, notes section shows.

**Surprises / Notes for Claude.ai:**
- RecipeDetailScreen grew slightly from 1,089 to 1,175 lines due to the new nutrition toggle, notes section, and grocery list mode handling. The total across all 5 files is 2,376 lines (vs original 2,021 single file). The code is now far more maintainable — each component has a clear single responsibility.
- File totals: RecipeDetailScreen 1,175 lines, RecipeHeader 181, IngredientsSection 404, PreparationSection 449, ScaleConvertControls 167.

### 2026-03-23 — Phase 6B Step 3: Rebuild PreparationSection
**Phase:** Phase 6B (RecipeDetailScreen Redesign)
**Prompt from:** PHASE_6B_RECIPE_DETAIL_REDESIGN.md Step 3 — Rebuild PreparationSection with NYT-style step layout, section headers, tappable step expansion

**Files modified:**
- `screens/RecipeDetailScreen.tsx` (1,100 → 1,089 lines) — (3c) Added `mapIngredientsToSteps` import from cookingService and `StepIngredient` import from lib/types/cooking. Added `stepIngredients` state (`Map<number, StepIngredient[]>`). Added `mapIngredientsToSteps(recipeData)` call in `loadRecipeDetails` (wrapped in try/catch — non-critical if it fails). Removed `instructionsCollapsed` state, `expandedSections` state, `toggleSection` handler. Removed console.log debug statements from instruction sections loading. Updated PreparationSection JSX props: removed `expandedSections`, `onToggleSection`, `instructionsCollapsed`, `onToggleCollapsed`; added `stepIngredients`.
- `components/recipe/PreparationSection.tsx` (470 → 449 lines) — Complete rebuild. (3a.1) Added `mergeConsecutiveSections()` to merge consecutive instruction sections with the same `section_title` (known data quality fix). Section headers rendered as simple text between step groups (not tappable accordions) — only shown when multiple sections exist. (3a.2) Removed collapsible behavior — no `instructionsCollapsed`, no expand/collapse toggle, all steps always visible. (3a.3) Replaced "📝 Instructions" with "PREPARATION" header with 3px dark accent line above, matching INGREDIENTS style. (3a.4) Step labels: "Step 1" as bold 14pt label above the step text, not "1." inline. (3a.5) Generous typography: step text 18pt with 28px line height. (3a.6) Clickable ingredients in step text preserved via `splitInstructionIntoParts`. (3a.7) Tappable step expansion: tapping a step toggles display of ingredients for that step from `stepIngredients` map. Only one step expanded at a time. Shows ingredient name and quantity/preparation in a compact two-column list. (3a.8) Edit mode preserved: reorder buttons + edit button shown above step when isEditMode. InlineEditableInstruction for editing. Markup annotations via MarkupText. Removed unused `formatIngredientForPopup` and `TextPart` imports.

**DB changes:** none

**Decisions made during execution:**
- `mergeConsecutiveSections` clones section objects and concatenates steps arrays — doesn't mutate original data. Also sums `estimated_time_min` across merged sections.
- Only one step expanded at a time (NYT pattern). Tapping an expanded step collapses it. State managed locally with `expandedStep` string key.
- Section headers only shown when there are 2+ distinct merged sections (single-section recipes show no header).
- Edit controls (move up/down + edit button) rendered in a horizontal row above the step label, not inline with the text — cleaner for the new layout where step label and text are stacked vertically.
- `stepIngredients` loaded from `mapIngredientsToSteps(recipeData)` using the sync version since `recipeData` (raw from Supabase, includes JSONB) is available at that point. Wrapped in try/catch since step expansion is nice-to-have, not critical.
- Removed card wrapper (sectionCard/sectionCardInner with shadow) — now flat layout with accent line, matching IngredientsSection pattern from Step 2.

**Deferred during execution:**
- Step expansion doesn't scale quantities when currentScale > 1 — the `StepIngredient.quantity` comes from the raw JSONB via `mapIngredientsToSteps`, not the scaled version. Could be enhanced by applying `parseAndScaleQuantity` to the quantity display, but this would require importing the function and also knowing the unit system. Not critical for now.

**Recommended doc updates:**
- ARCHITECTURE: Note that PreparationSection now uses `mergeConsecutiveSections` to handle duplicate section names, and `stepIngredients` from `mapIngredientsToSteps` for expandable step display
- DEFERRED_WORK: "Scale-aware step ingredient quantities in expandable step view" (low priority)

**Status:** TypeScript compiles clean (0 errors in changed files). Ready for on-device testing. Key things to verify: section headers appear between step groups in multi-section recipes, no header for single-section, flat list fallback for no-section recipes, tapping a step expands ingredient list, "Step N" labels render above step text, large readable text.

**Surprises / Notes for Claude.ai:**
- RecipeDetailScreen is now 1,089 lines (down from 2,021 original). Most remaining bulk is modals (scale/unit pickers, view mode menu, ingredient popup, grocery list, meal) + handlers + styles.
- The `mergeConsecutiveSections` function handles the known data quality issue where e.g. "Prepare Oven and Roast Vegetables" appears as two adjacent entries. Confirmed the approach matches the spec (merge by matching consecutive same-name sections).

### 2026-03-23 — Phase 6B Step 2: Rebuild IngredientsSection + Remove Sticky Headers
**Phase:** Phase 6B (RecipeDetailScreen Redesign)
**Prompt from:** PHASE_6B_RECIPE_DETAIL_REDESIGN.md Step 2 — Rebuild ingredients with group_name grouping, bold quantities, NYT typography; Step 2c — remove sticky headers

**Files modified:**
- `screens/RecipeDetailScreen.tsx` (1,207 → 1,100 lines) — (2a) Updated `Ingredient` interface with `group_name: string | null` and `group_number: number | null`. Updated `loadRecipeDetails` to merge `group_name`/`group_number` from `recipes.ingredients` JSONB by matching on `original_text` or `sequence_order`. (2c) Removed all sticky header code: `scrollY`, `ingredientsHeaderY`, `instructionsHeaderY` state vars; `handleScroll` function; `showIngredientsSticky`/`showInstructionsSticky` computed values; two sticky header JSX blocks (~50 lines); all sticky header styles (stickyHeader, stickyHeaderLeft, stickySectionTitle, stickySectionIcon, stickyHeaderButtons, stickyInlineButton, stickyInlineButtonText); removed `ingredientsCollapsed` state (section always visible now); removed `onScroll`/`scrollEventThrottle` from ScrollView; removed unused imports (LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent); simplified IngredientsSection props (removed ingredients, recipe, missingIngredients, annotations, ingredientsCollapsed, onToggleCollapsed, onLayout).
- `components/recipe/IngredientsSection.tsx` (398 → 380 lines) — Complete rebuild. (2b.1) Groups by `group_name` instead of `family`, sorted by `group_number`. Null/ungrouped ingredients shown in flat list. Single-group recipes show no header. Multiple groups show uppercase bold headers. (2b.2) Bold quantity formatting via `splitQuantityAndIngredient()` — parses displayText to separate quantity+unit portion (rendered with fontWeight 700) from ingredient name. Regex handles tablespoons, teaspoons, cups, oz, g, etc. plus compound quantities like "1 tablespoon plus 1½ teaspoons". (2b.3) Removed collapsible behavior — no collapse toggle, no collapse state, section always visible. (2b.4) Removed sticky header support (no onLayout prop). (2b.5) Replaced emoji header "🥬 Ingredients" with uppercase "INGREDIENTS" with 3px dark accent line above. (2b.6) Have/need indicators replaced: green dot (7px circle) for "have", nothing for "need" (cleaner). (2b.8) Edit mode preserved — edit button shows per ingredient when isEditMode. Markup annotations preserved. (2b.9) Scale/convert still works — parseAndScaleQuantity applied before bold splitting. (2b.10) "Add to Grocery List" link below ingredients replaces the old "+ Missing" / "+ All" buttons in header. (Typography) Section header: 15pt bold, 1.5 letter-spacing. Group headers: 13pt bold uppercase. Ingredient text: 16pt, 26px line height. Generous vertical spacing (6px padding per row + 28px group gaps).
- `components/recipe/PreparationSection.tsx` — Removed `onLayout` prop and `LayoutChangeEvent` import (sticky header tracking no longer needed). Updated Ingredient interface with group_name/group_number fields.

**DB changes:** none

**Decisions made during execution:**
- Bold quantity parsing uses regex rather than relying on structured `quantity_amount`/`quantity_unit` — the displayText is the source of truth for what the user sees, and the regex approach handles compound quantities ("1 tablespoon plus 1½ teaspoons") that structured data can't represent. The regex covers common units (tablespoons, cups, oz, grams, etc.) and fraction characters.
- Replaced card wrapper (sectionCard/sectionCardInner with shadow/border-radius) with simple flat layout (paddingHorizontal + accent line) — matches NYT's no-cards approach.
- "Add to Grocery List" is a single text link at the bottom rather than two buttons ("+ Missing" / "+ All") — cleaner, matches spec. The existing modal handles both cases.
- Kept the `displayIngredients` (annotation-applied) as the main data source. Removed `ingredients` (raw) and `recipe` from props since they're no longer needed for family grouping.
- Removed `annotations` and `missingIngredients` from IngredientsSection props — annotations are already applied via `displayIngredients`, and missing count is no longer shown in the header.

**Deferred during execution:**
- Tappable ingredient behavior on the Ingredients section (spec item 2b.7: show popup with step usage from mapIngredientsToSteps) — requires importing cookingService and adding new popup behavior. Currently ingredients are not tappable in the ingredients list (only in instruction text). Will implement when PreparationSection is rebuilt in Step 3.
- "Yield: 4 servings" display — requires servings data which is not currently on the Recipe interface or loaded from the DB.

**Recommended doc updates:**
- ARCHITECTURE: Note that IngredientsSection now uses group_name from JSONB for ingredient grouping (not family from ingredients table)
- DEFERRED_WORK: Add "Ingredient tap-to-see-steps in IngredientsSection" and "Yield/servings display"

**Status:** TypeScript compiles clean (0 errors in changed files). This is the first visual change — ingredients now display with NYT-style typography, recipe-author grouping, bold quantities, and accent line. Ready for on-device testing. Key things to verify: bold quantities render correctly, group headers appear for multi-group recipes, no header for single-group, flat list for no-group recipes, grocery list modal still opens.

**Surprises / Notes for Claude.ai:**
- The `splitQuantityAndIngredient` regex handles most common patterns but may miss edge cases like "a pinch of salt" (no numeric quantity). These render fine — just without bold formatting, which is correct behavior.
- RecipeDetailScreen is now 1,100 lines (down from original 2,021). Step 3 will further reduce it.

### 2026-03-23 — Phase 6B Step 1: Extract Sub-Components (Pure Refactor)
**Phase:** Phase 6B (RecipeDetailScreen Redesign)
**Prompt from:** PHASE_6B_RECIPE_DETAIL_REDESIGN.md Step 1 — Extract render sections into presentational sub-components

**Files created:**
- `components/recipe/RecipeHeader.tsx` (135 lines) — Hero image, title, description, meta row (prep/cook/total time, times cooked), source row (book + chef links). Receives recipe object + totalTime + navigation handlers via props.
- `components/recipe/IngredientsSection.tsx` (398 lines) — Full ingredients section: section header with collapse toggle, family-grouped ingredient rows, have/need indicators, edit mode with InlineEditableIngredient, markup view with MarkupText. Contains local copy of `parseAndScaleQuantity` for ingredient scaling. Groups by family with sorted order (Protein > Vegetables > Pantry > Spices > Other).
- `components/recipe/PreparationSection.tsx` (474 lines) — Full instructions section: section header with collapse toggle, instruction sections with expandable subsections, flat instructions fallback, step numbering, clickable ingredient text via `splitInstructionIntoParts`, edit mode with InlineEditableInstruction, markup annotations. Contains local `getInstructionText` and `renderInstructionWithClickableIngredients`.
- `components/recipe/ScaleConvertControls.tsx` (167 lines) — Scale buttons (1x/2x/3x/More) and unit system dropdown (Original/Metric/Imperial). Contains local copies of FIXED_SCALE_OPTIONS and UNIT_SYSTEMS constants.

**Files modified:**
- `screens/RecipeDetailScreen.tsx` — Reduced from 2,021 to 1,207 lines. Replaced inline render sections with the 4 new sub-components. Removed unused imports (Image, InlineEditableIngredient, InlineEditableInstruction, MarkupText, splitInstructionIntoParts, TextPart, convertUnit, ConversionResult). Removed FIXED_SCALE_OPTIONS constant and parseAndScaleQuantity function (moved to sub-components). Removed ~150 styles that are now in sub-components. Parent retains all state, data loading, handlers, modals, sticky headers, and the top bar.

**DB changes:** none

**Decisions made during execution:**
- Duplicated `parseAndScaleQuantity` into IngredientsSection rather than creating a shared util — keeps this a pure extraction with no new shared modules. Can be deduplicated in a later step if desired.
- Duplicated `getInstructionText` into PreparationSection for the same reason.
- Duplicated style definitions into each sub-component rather than sharing — each component is self-contained. Some styles are identical across components (sectionCard, sectionCardInner, etc.) which is expected for a pure refactor.
- Kept UNIT_SYSTEMS constant in parent (still needed for Unit Picker Modal) and also in sub-components that use it.
- Added `onLayout` prop to IngredientsSection and PreparationSection so the parent can still track header Y positions for sticky headers.
- Added `onMoveStepUp`/`onMoveStepDown` props to PreparationSection (existing step reordering stubs).
- Passed `displayIngredients` as a separate prop to IngredientsSection (in addition to raw `ingredients`) because the parent computes it via `applyIngredientAnnotations`.

**Deferred during execution:**
- Style deduplication across sub-components — not needed for this pure refactor step
- Removing sticky header code entirely (spec says to remove in Step 2/3, kept for now)

**Recommended doc updates:**
- ARCHITECTURE: Add `components/recipe/` directory with the 4 new presentational components
- DEFERRED_WORK: No new items

**Status:** TypeScript compiles clean (0 errors in changed files). All pre-existing errors are in node_modules and unrelated components. This is a pure refactor — zero visual changes. Ready for on-device testing.

**Surprises / Notes for Claude.ai:**
- RecipeDetailScreen still has ~1,200 lines after extraction. The remaining bulk is: state declarations (~60 lines), data loading (~100 lines), handlers (~200 lines), modals (view mode menu, scale picker, unit picker, ingredient popup, grocery list modal, meal modal — ~250 lines), sticky headers (~50 lines), top bar (~50 lines), and styles (~400 lines). Steps 2-4 will further reduce this.

### 2026-03-19 — Phase 6 Step 8: Classic View + View Switcher + Post-Cook Flow
**Phase:** Phase 6 (Cooking Mode v2)
**Prompt from:** PHASE_6_CLAUDE_CODE_GUIDE.md Step 8 — classic cookbook view, view mode switcher, post-cook retrospective, fix Supabase violation

**Files created:**
- `lib/services/postService.ts` — `createDishPost()` service function. Extracts the direct `supabase.from('posts').insert(...)` call from CookingScreen into a proper service, fixing the Supabase violation.
- `components/cooking/ViewModeMenu.tsx` — Dropdown menu with "Step-by-Step" and "Classic" options. Shows active mode highlighted. Positioned top-right per wireframe.
- `components/cooking/ClassicView.tsx` — Full scrollable cookbook view: progress bar ("On Step X / Y" + "Step view →" link), recipe photo, full ingredient list, all steps with section headers, current step highlighted with teal border + "← you're here", saved notes displayed. Tapping a step jumps to it.
- `components/cooking/PostCookFlow.tsx` — Post-cook retrospective screen matching wireframe Screen 9. Header (chef emoji + recipe title + book ref), "Anything to remember?" chips (📝 Note, 🎙 Voice, ✏️ Edit quantity), divider, "Share your cook" section (📷 photo placeholder, Yes/Maybe/No make-again buttons, 👥 tag, thoughts text input), "Log & Share" primary button, "Just log it" secondary link.

**Files modified:**
- `screens/CookingScreen.tsx` — Major update:
  - Added view mode state (`viewMode`), persisted via AsyncStorage
  - Header shows "Classic" badge when in classic mode, ⋮ button opens ViewModeMenu
  - `renderContent()` conditionally renders ClassicView or step-by-step UI based on viewMode
  - Done-cooking state now renders PostCookFlow instead of the simple done screen
  - `handlePostSubmit` rewritten to use `createDishPost()` service — no more direct Supabase calls
  - Added `handleLogAndShare`, `handleJustLog`, `handlePostCookNoteOnStep` callbacks
  - "Note on a step" chip in post-cook flow returns user to step-by-step mode
- `docs/SESSION_LOG.md` — This entry

**DB changes:** none

**Decisions made during execution:**
- View mode preference stored in AsyncStorage under key `frigo_cooking_view_mode`. Loaded on mount, updated on change.
- ClassicView shows all ingredients as a flat list (using `recipe.ingredients` directly, handles both string and structured formats), then all steps in order with section headers injected between groups.
- PostCookFlow's "Log & Share" opens the existing PostCreationModal to collect title/rating/method/modifications. The PostCreationModal still handles the form UI — PostCookFlow just collects the pre-post retrospective data (make-again, thoughts).
- "Note on a step" chip in PostCookFlow sets `doneCooking=false` and switches to step-by-step mode, returning the user to cooking mode where they can tap 📝 on any step.
- Photo upload, voice memo, quantity editing, and tagging are all placeholder buttons that show "Coming soon" toasts. These are natural extensions but not in scope for Phase 6.
- The `createDishPost` service takes a clean params object — no more raw Supabase calls in screen components.

**Supabase violation fix:**
- Before: `screens/CookingScreen.tsx` line 237: `await supabase.from('posts').insert({...})`
- After: `await createDishPost({userId, recipeId, title, rating, ...})` via `lib/services/postService.ts`
- Verified: `grep` confirms zero `from('posts').insert` calls remain in CookingScreen

**Deferred during execution:**
- Photo upload in PostCookFlow (needs image picker integration)
- Voice memo recording
- Quantity editing from post-cook
- Tagging cooking partners from post-cook
- Timeline overview (3rd view mode mentioned in spec) — ViewModeMenu only has step-by-step and classic for now

**Final component architecture:**
```
CookingScreen.tsx
  ├── ViewModeMenu (dropdown, modal)
  ├── [viewMode === 'classic']
  │     └── ClassicView (scrollable, ingredients + all steps + section headers)
  │           └── StepNoteDisplay
  ├── [viewMode === 'step_by_step']
  │     ├── SectionDots
  │     ├── SectionCard (swipeable via PanResponder)
  │     │     ├── StepIngredients
  │     │     ├── StepNoteInput
  │     │     └── StepNoteDisplay
  │     └── advance button
  ├── CompactTimerBar → TimerDetail (overlay)
  ├── IngredientSheet (modal) → IngredientDetailPopup (modal)
  ├── PostCookFlow (when doneCooking=true)
  ├── PostCreationModal (existing)
  └── CookingTimerProvider (wraps everything)
```

**Recommended doc updates:**
- ARCHITECTURE: Add postService.ts, ViewModeMenu.tsx, ClassicView.tsx, PostCookFlow.tsx. Update CookingScreen entry to reflect the full Phase 6 rebuild.
- DEFERRED_WORK: Timeline view mode, photo upload in post-cook, voice memos, quantity editing, tagging

**Status:** Step 8 complete. All Phase 6 cooking mode steps (1-8) done. TypeScript compiles clean. CookingScreen fully rebuilt with: section-card step-by-step view, classic cookbook view, view mode switcher with persisted preference, timer system with auto-detection and notifications, ingredient bottom sheet with detail popup, per-step notes (save/load/edit), and post-cook retrospective flow with service-based post creation.

**Surprises / Notes for Claude.ai:**
- The original CookingScreen's `handlePostSubmit` had a bug: it set `notes: postData.modifications` (duplicating modifications into notes). Preserved this behavior in the service to avoid breaking anything, but it should probably be `notes: postData.notes` or removed.
- PostCookFlow collects `makeAgain` and `thoughts` data but these aren't passed through to the PostCreationModal yet — the modal's `PostData` interface doesn't have fields for them. This is a natural next step: either extend PostData or save them separately.

---

## Phase 6 Complete

**All files created during Phase 6 (Steps 1-8):**

Services:
- `lib/types/cooking.ts` — 7 type interfaces
- `lib/services/cookingService.ts` — 15 exported functions (normalization, sections, ingredients, notes, sessions)
- `lib/services/postService.ts` — `createDishPost()` service
- `lib/utils/timerDetection.ts` — `detectTimersInText()` + `formatTime()`

Contexts:
- `contexts/CookingTimerContext.tsx` — Timer state management + expo-notifications

Components (components/cooking/):
- `SectionDots.tsx` — Progress dots
- `StepIngredients.tsx` — Per-step ingredient list
- `SectionCard.tsx` — Section card with step states, timers, notes
- `CompactTimerBar.tsx` — Timer pills
- `TimerDetail.tsx` — Expanded timer overlay
- `IngredientSheet.tsx` — Bottom sheet grouped by step
- `IngredientDetailPopup.tsx` — Ingredient detail modal
- `StepNoteInput.tsx` — Note input
- `StepNoteDisplay.tsx` — Saved note card
- `ViewModeMenu.tsx` — View mode dropdown
- `ClassicView.tsx` — Classic cookbook view
- `PostCookFlow.tsx` — Post-cook retrospective

Screens:
- `screens/CookingScreen.tsx` — Full rewrite (was ~327 lines, now ~640 lines)

Scripts:
- `scripts/detect-sections.ts` — Batch job (populated 475 recipes)
- `scripts/test-cooking-service.ts` — Service tests
- `scripts/test-ingredient-mapping.ts` — Ingredient mapping tests
- `scripts/test-timer-detection.ts` — Timer detection tests

**DB changes:**
- `recipes.instruction_sections` JSONB column populated for all 475 recipes

**Packages added:**
- `expo-notifications`

**Known rough edges:**
- PanResponder swipe may feel less smooth than react-native-gesture-handler
- PostCookFlow's makeAgain/thoughts data not yet passed through to PostCreationModal
- Photo upload, voice memos, tagging are placeholder buttons
- Timeline overview (3rd view mode) not implemented
- `notes: postData.modifications` bug preserved from original code

---

### 2026-03-19 — Phase 6 Step 7: Notes System
**Phase:** Phase 6 (Cooking Mode v2)
**Prompt from:** PHASE_6_CLAUDE_CODE_GUIDE.md Step 7 — quick note per step with text input, voice/camera placeholders, saved note display on return visits

**Files created:**
- `components/cooking/StepNoteInput.tsx` — Inline note input component (yellow bg matching wireframe). Text field with placeholder, 🎙 mic button (shows "Coming soon" toast), Save button. Accepts existing text for editing. Calls `onSave` callback with async handling.
- `components/cooking/StepNoteDisplay.tsx` — Saved note card displayed below a step. Yellow background with left border accent (#b8942d). Shows "💡 {note text}", date (formatted as "Mar 19" etc.), and "Edit" link.

**Files modified:**
- `components/cooking/SectionCard.tsx` — Added `notesByStep` and `onNoteSave` props, `editingNoteStep` state. The 📝 button now toggles the note input for that step. Saved notes render as StepNoteDisplay below each step that has one. Editing opens StepNoteInput with existing text pre-filled.
- `screens/CookingScreen.tsx` — Added `notesByStep` state (Map<number, StepNote>), loads notes on mount via `getStepNotes()`, `handleNoteSave` callback using `upsertStepNote()`. Passes both to SectionCard. Also passes note text to IngredientDetailPopup for the selected ingredient's step.
- `docs/SESSION_LOG.md` — This entry

**DB changes:** none (recipe_step_notes table already exists from Step 1)

**Decisions made during execution:**
- Notes load on component mount using `supabase.auth.getSession()` → `getStepNotes(recipeId, userId)`. Silently fails if user not authenticated (notes are optional enhancement).
- Note save uses `upsertStepNote` which does a Supabase upsert on (user_id, recipe_id, step_number). On success, updates the local `notesByStep` map immediately for instant UI feedback.
- The 📝 button on SectionCard toggles the input — tapping again closes it. Only one note input can be open at a time (tracked by `editingNoteStep`).
- StepNoteDisplay shows on ALL steps with saved notes (not just current step), so users see their notes when reviewing past steps or navigating back.
- IngredientDetailPopup now shows the note for the step the ingredient was tapped from (the yellow "YOUR NOTE" card from the wireframe).
- Camera button omitted from the input (spec mentioned it but the wireframe only shows mic). Can be added later.

**Deferred during execution:** none

**Recommended doc updates:**
- ARCHITECTURE: Add StepNoteInput.tsx and StepNoteDisplay.tsx to components/cooking/

**Status:** Step 7 complete. Notes system fully functional: save, load, edit, display on return visits, display in ingredient detail popup. TypeScript compiles clean. Ready for Step 8 (final step).

**Surprises / Notes for Claude.ai:** none

---

### 2026-03-19 — Phase 6 Step 6: Ingredient Bottom Sheet + Detail Popup
**Phase:** Phase 6 (Cooking Mode v2)
**Prompt from:** PHASE_6_CLAUDE_CODE_GUIDE.md Step 6 — pull-up ingredient sheet grouped by step, tappable ingredient detail popup

**Files created:**
- `components/cooking/IngredientSheet.tsx` — Modal-based bottom sheet with slide-up animation. Ingredients grouped by step number with section name. Current step group has teal "NOW" badge and highlighted background. Past steps dimmed (opacity 0.4). Each ingredient row is tappable → opens detail popup.
- `components/cooking/IngredientDetailPopup.tsx` — Centered modal popup showing ingredient name (large), Quantity and Prep boxes (side by side), "Used in" section listing all steps where the ingredient appears with text snippets, and personal note card (yellow bg, left border accent) if a note exists.

**Files modified:**
- `screens/CookingScreen.tsx` — Added IngredientSheet + IngredientDetailPopup imports, state for sheet visibility and selected ingredient, `handleIngredientTap` callback, `selectedUsedInSteps` memo that finds all steps using the selected ingredient, wired ingredient handle onPress to open sheet, added both components to render tree
- `docs/SESSION_LOG.md` — This entry

**DB changes:** none

**Decisions made during execution:**
- Used React Native Modal with Animated slide-up rather than installing @gorhom/bottom-sheet — avoids a new dependency and keeps the approach consistent with TimerDetail overlay.
- IngredientSheet receives all steps and sections as props, computes step groups internally. Only shows steps that have at least one ingredient mapped to them.
- When an ingredient is tapped in the sheet, the sheet closes and the detail popup opens. The popup's "Used in" section shows ALL steps where that ingredient appears (computed from ingredientsByStep map), not just the step it was tapped from.
- Personal note display is wired in the popup UI but always empty for now — Step 7 (notes system) will provide the data.
- The ingredient handle in the bottom bar ("🥬 Ingredients ↑") now opens the sheet on tap.

**Deferred during execution:** none

**Component architecture update:**
```
CookingScreen.tsx
  ├── SectionDots
  ├── SectionCard → StepIngredients
  ├── CompactTimerBar
  ├── TimerDetail
  ├── IngredientSheet (Modal, slide-up)
  │     └── ingredient rows → onTap → IngredientDetailPopup
  ├── IngredientDetailPopup (Modal, centered)
  └── PostCreationModal
```

**Recommended doc updates:**
- ARCHITECTURE: Add IngredientSheet.tsx and IngredientDetailPopup.tsx to components/cooking/

**Status:** Step 6 complete. Ingredient bottom sheet and detail popup fully functional. TypeScript compiles clean. Ready for Step 7 (notes system).

**Surprises / Notes for Claude.ai:** none — straightforward implementation matching the wireframe spec.

---

### 2026-03-19 — Phase 6 Step 5: Timer System
**Phase:** Phase 6 (Cooking Mode v2)
**Prompt from:** PHASE_6_CLAUDE_CODE_GUIDE.md Step 5 — CookingTimerContext, auto-detection regex, compact timer bar, timer detail expand, recommended vs actual, expo-notifications

**Files created:**
- `lib/utils/timerDetection.ts` — `detectTimersInText()` regex-based timer auto-detection + `formatTime()` helper. Matches all spec patterns including ranges ("10-15 minutes" → midpoint), qualifiers ("about", "exactly"), "more" modifier ("10 more min"), hours, minutes, seconds.
- `contexts/CookingTimerContext.tsx` — `CookingTimerProvider` + `useCookingTimers` hook. Manages timer state with actions: startTimer, pauseTimer, resumeTimer, resetTimer, addTime, dismissTimer. 1-second setInterval tick. expo-notifications integration for push notifications on timer completion.
- `components/cooking/CompactTimerBar.tsx` — Single-line scrollable timer pills matching wireframe format: `⏱ Soak 14:22 /20:00 · Onion ✓ · Crisp 4:30 /7:00`. Running timers in green, done timers in teal with checkmark, paused in amber.
- `components/cooking/TimerDetail.tsx` — Expanded timer detail overlay with large countdown, progress bar, recommended vs actual display, Pause/Resume/Reset/+1min/Dismiss controls. Dark theme (#0f2b29 bg) matching wireframe Screen 3.
- `scripts/test-timer-detection.ts` — Test script for timer auto-detection

**Files modified:**
- `screens/CookingScreen.tsx` — Wrapped in CookingTimerProvider, replaced static timer placeholder with CompactTimerBar, added TimerDetail overlay, restructured to single return with renderContent() for clean provider wrapping
- `components/cooking/SectionCard.tsx` — Added timer auto-detection per step, renders "⏱ ~Xm Start" buttons for detected timers on current step, calls startTimer from context
- `docs/SESSION_LOG.md` — This entry

**DB changes:** none

**Package changes:**
- Installed `expo-notifications` for push notifications on timer completion

**Decisions made during execution:**
- SectionCard calls `useCookingTimers` directly rather than receiving an `onTimerStart` prop — cleaner since it's always rendered inside the provider
- CookingScreen restructured from 3 separate return statements to a single return with `renderContent()` helper, allowing one CookingTimerProvider wrapper for all render paths
- Timer detection regex handles "more" modifier (e.g., "10 more min") which is common in recipes
- Notification scheduling uses `TIME_INTERVAL` trigger type, scheduled when timer starts, cancelled on pause/reset/dismiss, rescheduled on resume/addTime
- Timer pills use monospace-style tabular numbers (`fontVariant: ['tabular-nums']`) for stable widths as time ticks
- Timer IDs use timestamp + random suffix for uniqueness

**Deferred during execution:** none

**Timer detection test results (all spec patterns + real recipe text):**
```
"cook for 20 minutes"        → Cook: 20m (1200s)
"bake 45 min"                → Bake: 45m (2700s)
"simmer 1 hour"              → Simmer: 60m (3600s)
"rest 10-15 minutes"         → Rest: 12m 30s (750s)
"set aside for 30 minutes"   → Set aside: 30m (1800s)
"about 6 minutes"            → Timer: 6m (360s)
"8 to 10 minutes"            → Timer: 9m (540s)
"exactly 16 minutes"         → Timer: 16m (960s)
"1–2 minutes"                → Timer: 1m 30s (90s)
"30 seconds"                 → Timer: 30s (30s)

Real recipe steps:
"...cook undisturbed...8–10 min"        → Cook: 9m
"...crisp...6–8 min more"              → Crisp: 7m
"...exactly 16 min...Steam...10 more min" → Heat: 16m, Steam: 10m (2 timers!)
"...roast...20 to 25 minutes"          → Brown: 22m 30s
"...fry for 7–8 minutes"              → Fry: 7m 30s
"...soak for 30 minutes"              → Soak: 30m
```

**Recommended doc updates:**
- ARCHITECTURE: Add contexts/CookingTimerContext.tsx, lib/utils/timerDetection.ts, components/cooking/CompactTimerBar.tsx, components/cooking/TimerDetail.tsx

**Status:** Step 5 complete. Timer system fully functional: auto-detection, context-based state management, compact bar, detail view, notifications. TypeScript compiles clean. Ready for Step 6.

**Surprises / Notes for Claude.ai:**
- expo-notifications was not previously installed — added it. app.json may need notification channel config for Android in production.
- The "10 more min" pattern is common in recipes but wasn't in the original spec patterns. Added "more" as an optional modifier between number and unit.
- Timer labels extract the nearest preceding verb. Some steps without a clear verb before the time get "Timer" as a fallback label. This is acceptable — the user sees it briefly and can identify the timer by step context.

---

### 2026-03-19 — Phase 6 Step 4: CookingScreen Rebuild — Section Card Layout
**Phase:** Phase 6 (Cooking Mode v2)
**Prompt from:** PHASE_6_CLAUDE_CODE_GUIDE.md Step 4 — full rewrite of CookingScreen with section-card layout, swipe navigation, per-step ingredients, book reference, progress dots

**Files created:**
- `components/cooking/SectionDots.tsx` — Progress dots component (one per section, current elongated, past dimmed)
- `components/cooking/StepIngredients.tsx` — Compact two-column ingredient list (name left, qty+prep right)
- `components/cooking/SectionCard.tsx` — Main section card component with all steps, current/done/future states, auto-expansion, ingredients, action buttons. Auto-scrolls to current step.

**Files modified:**
- `screens/CookingScreen.tsx` — Full rewrite from scroll-based layout to section-card cooking mode
- `docs/SESSION_LOG.md` — This entry

**DB changes:** none

**Decisions made during execution:**
- Used `PanResponder` for swipe navigation instead of installing react-native-gesture-handler (not in the project's dependencies). `Animated.View` wraps the section card with translateX for swipe animation. Threshold: 60px horizontal swipe to change sections.
- Used `getInstructionSectionsSync` (sync) rather than the async version since Step 3 populated the JSONB column for all 475 recipes — the recipe object passed via route params will have `instruction_sections` available.
- Similarly used `normalizeInstructions` (sync) and `mapIngredientsToSteps` (sync) — all run from the recipe object without DB calls.
- Auto-expand logic: collapses non-current steps to 2 lines when the current step has >200 chars of text or >4 ingredients.
- Added an explicit "Next step →" / "Done cooking →" button below the section card for accessibility, in addition to the step-tap and swipe navigation.
- Post-cook flow preserved: "Done cooking" state shows recipe title, book reference, "Log & Share" button → PostCreationModal. Also added "Just go back" skip option.
- The existing `handlePostSubmit` still uses direct Supabase calls (known violation from the original code). Step 8 will fix this to use a service.
- Removed hardcoded credentials from the original `handlePostSubmit` (re-auth block with plaintext email/password). Now uses session-only auth check.
- Timer bar and ingredient handle rendered as static placeholders — will become functional in Steps 5 and 6.
- Note button rendered as static placeholder — will become functional in Step 7.

**Deferred during execution:**
- Timer context and timer functionality (Step 5)
- Ingredient bottom sheet (Step 6)
- Notes input UI (Step 7)
- Classic view toggle and view switcher (Step 8)
- Post-cook retrospective refinement (Step 8)
- Fix handlePostSubmit Supabase violation (Step 8)

**Screen structure (top to bottom):**
1. Header: ← Exit | Recipe title (truncated) | 📋 | ⋮
2. Book reference line (if recipe has book_id): "📖 {book} · {author} · p.{page}"
3. Meal banner (if cooking for a meal plan)
4. Section progress dots
5. Previous section peek (faded, name + step count)
6. Divider
7. Section card (flex: 1, scrollable): section header, all steps with current/done/future states, per-step ingredients, action buttons
8. Advance button row
9. Divider + Next section peek
10. Bottom bar (dark bg #0f2b29): timer placeholder, ingredient handle

**Component architecture:**
```
CookingScreen.tsx
  ├── SectionDots (progress indicator)
  ├── SectionCard (main content, swipeable via PanResponder)
  │     └── StepIngredients (per-step ingredient list)
  └── PostCreationModal (existing, preserved)
```

**Recommended doc updates:**
- ARCHITECTURE: Add components/cooking/ directory with SectionDots, StepIngredients, SectionCard. Update CookingScreen entry to reflect the rebuild.

**Status:** Step 4 complete. CookingScreen fully rewritten with section-card layout. TypeScript compiles clean (0 errors in new files). Ready for Step 5 (timer system).

**Surprises / Notes for Claude.ai:**
- The original CookingScreen had hardcoded email/password in handlePostSubmit for re-authentication. This has been removed — the new version just checks the session and fails gracefully.
- No gesture handler library was installed, so swipe navigation uses React Native's built-in PanResponder. Works but may feel less smooth than react-native-gesture-handler. Could be upgraded later if needed.
- The wireframe shows a very detailed layout. The implementation follows the spec closely but some visual tuning may be needed once running on-device (font sizes, spacing, etc.).

---

### 2026-03-19 — Phase 6 Step 3: Section Detection Batch Job
**Phase:** Phase 6 (Cooking Mode v2)
**Prompt from:** PHASE_6_CLAUDE_CODE_GUIDE.md Step 3 — populate recipes.instruction_sections JSONB for all 475 recipes

**Files created:**
- `scripts/detect-sections.ts` — Batch script with 4 processing modes: table-only, section-field, short recipes, and Claude Haiku AI. Supports `--dry-run`, `--ai-only`, `--no-ai` flags. Includes validation (coverage checks, gap/overlap detection) and verification query.

**Files modified:**
- `docs/SESSION_LOG.md` — This entry

**DB changes:**
- `recipes.instruction_sections` JSONB column populated for ALL 475 recipes
  - Format: `[{"name": "Section Name", "startStep": 1, "endStep": 3}, ...]`
  - Phase 6 format as specified in PROMPT_STEP1_CORRECTION.md

**Decisions made during execution:**
- Split processing into 4 categories to minimize AI costs and maximize deterministic accuracy:
  - 8 table-only recipes (instructions=[]): Converted from instruction_sections + instruction_steps DB tables with global step renumbering
  - 94 recipes with {section} fields in instructions JSONB: Grouped consecutive steps by section name directly
  - 151 short recipes (≤3 steps): Each step becomes its own "Step N" section — trivial, no AI
  - 222 long recipes (4+ steps): Claude Haiku AI with structured prompt and validation
- AI processing uses batches of 5 concurrent requests with 200ms delay between batches
- 3 initial AI failures (validation errors: wrong start step, gap between sections, JSON parse error) were retried with boundary-fixing logic that auto-corrects minor AI output issues
- Used `claude-haiku-4-5-20251001` model via direct fetch() to Anthropic API (SDK not needed for simple calls)
- SUPABASE_SERVICE_ROLE_KEY used throughout to bypass RLS

**Deferred during execution:** none

**Test results:**

Processing summary:
```
Category           Count   Success   Failed
Table-only             8       8        0
Section field         94      94        0
Short ≤3 steps       151     151        0
AI (4+ steps)        222     219→222    3→0 (retried)
TOTAL                475     475        0
```

Verification: `475/475 recipes have instruction_sections (0 missing)`

Sample outputs:
```
"One-Pot Chicken & Schmaltzy Rice" (18 steps, from section fields):
  "Prep the rice" → step 1
  "Crisp up the chicken" → steps 2-4
  "While the chicken cooks, do some prep" → steps 5-6
  "Drain the rice" → step 7
  "Add the aromatics and toast the rice" → steps 8-11
  "Make the lemony yogurt" → step 12
  "Chop some stuff" → steps 13-16
  "Fluff and finish" → steps 17-18

"Almond Butter Oatmeal Cups" (8 steps, from DB tables):
  "Prepare Muffin Pan" → step 1
  "Make Batter" → steps 2-4
  "Bake and Serve" → steps 5-8

"Roasted Cauliflower with Date-Parsley Gremolata" (6 steps, AI):
  "Prepare oven" → step 1
  "Prep and roast cauliflower" → steps 2-3
  "Make gremolata" → steps 4-5
  "Assemble and serve" → step 6

"Clams on Toast with Bacon & Old Bay Mayo" (14 steps, AI):
  "Mise it out" → steps 1-5
  "Make the Old Bay mayo" → step 6
  "Build the broth" → steps 7-10
  "Cook the clams" → step 11
  "Fry the bread" → steps 12-13
  "Serve" → step 14
```

**Recommended doc updates:**
- ARCHITECTURE: Note that recipes.instruction_sections JSONB is now populated for all 475 recipes. The Phase 6 format `[{name, startStep, endStep}]` is the canonical section source for cooking mode.
- DEFERRED_WORK: The instruction_sections + instruction_steps DB tables (extraction pipeline) still exist but are now redundant for cooking mode purposes. Consider whether to keep them for the extraction pipeline or migrate fully to the JSONB column.

**Status:** Step 3 complete. All 475 recipes have instruction_sections. `getInstructionSections` in cookingService will now always find data via priority source #1 (JSONB column). Ready for Step 4.

**Surprises / Notes for Claude.ai:**
- The Anthropic API was accessible from the local environment — no Edge Function needed.
- AI quality was very good — only 3/222 had minor format issues (wrong start step, gaps, trailing text after JSON), all fixed with boundary auto-correction on retry.
- The Roasted Cauliflower recipe (6 steps, plain strings) got much better sections from AI ("Prepare oven" / "Prep and roast cauliflower" / "Make gremolata" / "Assemble and serve") than the Step 1 fallback of individual "Step N" sections.
- One "Blueberry Cornflake Crisp" recipe from Cook This Book had a section named "Main" from its {section} field data — this is a minor data quality issue in the extraction pipeline, not a cooking mode bug.

---

### 2026-03-19 — Phase 6 Step 2: Ingredient-to-Step Text Matching
**Phase:** Phase 6 (Cooking Mode v2)
**Prompt from:** PHASE_6_CLAUDE_CODE_GUIDE.md Step 2 — add mapIngredientsToSteps to cookingService, test against Bulgur and 18-step Schmaltzy Rice

**Files created:**
- `scripts/test-ingredient-mapping.ts` — Test script for ingredient mapping against both recipes

**Files modified:**
- `lib/services/cookingService.ts` — Added mapIngredientsToSteps, mapIngredientsToStepsAsync, plus helpers: extractKeywords, stemVariants, parseIngredients, parseIngredientString, escapeRegex. Added StepIngredient to imports.
- `docs/SESSION_LOG.md` — This entry

**DB changes:** none

**Decisions made during execution:**
- Keyword extraction splits ingredient names on whitespace/commas, filters stop words (units, articles, common words), and generates singular/plural stem variants for each keyword. This handles "lemons"↔"lemon", "thighs"↔"thigh", "peas"↔"pea", "cloves"↔"clove" etc.
- Compound ingredients ("salt and black pepper") split on " and " into sub-ingredients, each matched independently.
- Uses word-boundary regex matching (`\b`) for precision — avoids "rice" matching "price" or "oil" matching "boiling" etc.
- "to serve"/"to garnish" ingredients that don't match any step get force-mapped to the final step. Ingredients that match nothing and aren't garnish are left unmapped (not force-mapped).
- Added `mapIngredientsToStepsAsync` for table-only recipes (instructions=[]). It fetches DB section/step data, builds a synthetic recipe object, then delegates to the sync version.
- Ingredient parsing handles both formats: structured objects (with `ingredient`, `quantity`, `preparation`, `original_text` fields) and plain strings.

**Deferred during execution:**
- Stemming produces some nonsensical variants like "flak" from "flakes" — harmless (no false positives) but could be improved with a food-specific stemming dictionary later.

**Test results:**

**Bulgur with mushrooms and feta (4 steps, 12 ingredients):**
```
Step 1: bulgur wheat, salt and black pepper, boiling water
Step 2: olive oil, large onion, cumin seeds
Step 3: bulgur wheat, salt and black pepper, olive oil, large onion, cumin seeds,
        mixed mushrooms, thyme leaves, balsamic vinegar, dill, feta, Urfa chile flakes
Step 4: bulgur wheat, olive oil, mixed mushrooms, dill
```
Step 3 expected: mushrooms, cumin, thyme, balsamic vinegar, dill, feta, chile flakes ✓ (all present)
Step 3 also correctly maps: bulgur, salt/pepper, oil, onion, cumin — all genuinely referenced in the step text ("Stir in the bulgur, onion, dill, feta, and chile flakes")
No false positives. No unmatched ingredients.

**One-Pot Chicken & Schmaltzy Rice (18 steps, 11 ingredients):**
```
Step 1 [Prep the rice]: basmati rice
Step 2 [Crisp up the chicken]: chicken thighs, salt/pepper
Step 3 [Crisp up the chicken]: chicken thighs
Step 4 [Crisp up the chicken]: chicken thighs
Step 5 [While chicken cooks]: onion
Step 6 [While chicken cooks]: garlic cloves
Step 7 [Drain the rice]: basmati rice
Step 8 [Add aromatics/toast rice]: onion, chicken thighs
Step 9 [Add aromatics/toast rice]: garlic, salt/pepper
Step 10 [Add aromatics/toast rice]: basmati rice
Step 11 [Add aromatics/toast rice]: butter, chicken thighs, basmati rice, salt/pepper
Step 12 [Make lemony yogurt]: garlic, lemons, yogurt, salt/pepper
Step 13 [Chop some stuff]: sugar snap peas
Step 14 [Chop some stuff]: pistachios
Step 15 [Chop some stuff]: dill or cilantro
Step 16 [Chop some stuff]: lemons
Step 17 [Fluff and finish]: chicken thighs, basmati rice
Step 18 [Fluff and finish]: lemons, snap peas, dill, yogurt, chicken, rice, salt/pepper, pistachios
```
No unmatched ingredients. All 11 ingredients mapped to at least one step. ✓

**Recommended doc updates:**
- ARCHITECTURE: Add mapIngredientsToSteps to cookingService catalog

**Status:** Step 2 complete. Ingredient-to-step mapping works accurately for both test recipes. Ready for Step 3.

**Surprises / Notes for Claude.ai:**
- The spec expected Bulgur step 3 to NOT include bulgur, but the step text literally says "Stir in the bulgur" — so including it is correct behavior.
- RLS blocks anon key from seeing the 18-step Schmaltzy Rice, Bulgur, and Oatmeal Cups recipes. Test scripts use SUPABASE_SERVICE_ROLE_KEY. The app won't have this issue since users are authenticated.

---

### 2026-03-19 — Phase 6 Step 1 Correction: Fix cookingService Data Source Handling
**Phase:** Phase 6 (Cooking Mode v2)
**Prompt from:** PROMPT_STEP1_CORRECTION.md — fix normalizeInstructions for table-only recipes, fix getInstructionSections priority order (Phase 6 JSONB first), test against 4 specific recipes

**Files created:** none

**Files modified:**
- `lib/services/cookingService.ts` — Major rewrite of normalization and section logic to handle all 3 data sources
- `scripts/test-cooking-service.ts` — Rewritten to test exact 4 recipes from the correction spec, uses service role key to bypass RLS
- `docs/SESSION_LOG.md` — This entry

**DB changes:** none

**Decisions made during execution:**
- Made `normalizeInstructions` accept optional `dbSections` param (pre-fetched DB data) to keep it synchronous when possible. Added `normalizeInstructionsAsync` that auto-fetches from DB tables if JSONB is empty.
- Created internal `DBSectionWithSteps` interface and three helper functions (`fetchDBSectionSteps`, `dbSectionsToNormalizedSteps`, `dbSectionsToInstructionSections`) for clean separation of DB table logic.
- `getInstructionSections` now follows the correct 4-source priority: (1) recipes.instruction_sections JSONB column, (2) instruction_sections + instruction_steps tables, (3) structured {section} fields in instructions JSONB, (4) fallback per-step sections.
- `getInstructionSectionsSync` documented as only checking sources 1 (if on recipe object), 3, and 4 — cannot check DB tables.
- Test script uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS — several test recipes (Schmaltzy 18-step, Bulgur, Oatmeal Cups) aren't visible to the anon key.

**Deferred during execution:** none

**Test results (all 4 recipes pass):**

**Test 1 — Plain string (Roasted Cauliflower):** 6 steps, 6 single-step sections. Unchanged from before. ✓

**Test 2 — Structured with sections (18-step Schmaltzy Rice, Cook This Book):**
- ID: `07737de5-33fd-401b-9c68-dcb35f1395a9`, book_id: `a7a56abb`
- 18 NormalizedSteps with section names from {section} fields
- 8 sections extracted: "Prep the rice" (1), "Crisp up the chicken" (2-4), "While the chicken cooks, do some prep" (5-6), "Drain the rice" (7), "Add the aromatics and toast the rice" (8-11), "Make the lemony yogurt" (12), "Chop some stuff" (13-16), "Fluff and finish" (17-18) ✓

**Test 3 — Table-only (Almond Butter Oatmeal Cups):**
- ID: `122263d6-0e96-4d31-aec2-3b117e5864c7`, instructions JSONB = []
- normalizeInstructionsAsync falls back to DB tables → 8 globally-numbered steps
- 3 sections: "Prepare Muffin Pan" (1), "Make Batter" (2-4), "Bake and Serve" (5-8) ✓

**Test 4 — Structured without sections (Bulgur):**
- ID: `6f2f5544-7ac6-46c6-a975-98c2c15bab11`, book_id: `b0886981`
- 4 structured steps, no {section} field → 4 single-step sections ✓

**Recommended doc updates:**
- ARCHITECTURE: Note that 8 recipes have instructions only in DB tables (instructions=[]), and the cookingService handles this via async DB fallback
- DEFERRED_WORK: None

**Status:** All 3 fixes applied and verified. Ready for Step 2.

**Surprises / Notes for Claude.ai:**
- RLS blocks the anon key from seeing several recipes (the 18-step Schmaltzy, Bulgur, Oatmeal Cups). The test script and any future scripts that need these recipes must use `SUPABASE_SERVICE_ROLE_KEY`. The app itself should be fine since authenticated users will have access.
- 8 recipes in the DB have `instructions = []` with data only in the instruction_sections/instruction_steps tables. All are correctly handled now.
- The `recipes.instruction_sections` JSONB column (Phase 6 format) is currently null for all 475 recipes. Step 3's batch job will populate it.

---

### 2026-03-19 — Phase 6 Step 1: Cooking Types + CookingService Foundation
**Phase:** Phase 6 (Cooking Mode v2)
**Prompt from:** PHASE_6_CLAUDE_CODE_GUIDE.md Step 1 — types file, cookingService with normalization, sections, step notes CRUD, cooking sessions

**Files created:**
- `lib/types/cooking.ts` — All cooking mode types: StepNote, CookingSession, TimerHistoryEntry, InstructionSection, StepIngredient, NormalizedStep
- `lib/services/cookingService.ts` — Core cooking service with 11 functions: normalizeInstructions, getInstructionSections (async, queries DB first), getInstructionSectionsSync (pure, JSONB only), getStepNotes, upsertStepNote, deleteStepNote, startCookingSession, updateSessionProgress, completeCookingSession, getSessionHistory, getCookCount
- `scripts/test-cooking-service.ts` — Test script that queries real Supabase data to verify functions

**Files modified:**
- `docs/SESSION_LOG.md` — This entry

**DB changes:** none (tables already existed: instruction_sections, instruction_steps, recipe_step_notes, cooking_sessions)

**Decisions made during execution:**
- Added `getInstructionSectionsSync()` as a pure function alternative to the async version, for cases where you already have the recipe object and don't need DB section lookup. The async version queries instruction_sections table first, then falls back to JSONB parsing.
- The DB section lookup (`getInstructionSectionsFromDB`) uses a global step counter rather than per-section step_number, since the cooking mode UI needs globally-indexed steps (1 through N across all sections).
- Existing `instructionSectionsService.ts` reads/writes the DB tables for extraction; the new cookingService wraps it for cooking mode's simpler InstructionSection type (name, startStep, endStep).
- Used `onConflict: 'user_id,recipe_id,step_number'` for step note upsert — assumes a unique constraint exists on those columns.

**Deferred during execution:**
- None

**Test results:**
- Plain string recipe ("Roasted Cauliflower with Date-Parsley Gremolata", 6 steps): normalizeInstructions returns 6 NormalizedSteps, sections returns 6 single-step sections. Correct.
- Schmaltzy Rice recipe ("One-Pot Chicken with Schmaltzy Rice and Lemony Yog", 9 steps): stored as plain strings (not structured objects). Normalizes to 9 steps, 9 single-step sections. Correct for the format.
- No recipes with structured object instructions (with section fields) found in DB — all current recipes use plain string arrays. The structured object code path is implemented but untested against live data.
- DB tables confirmed: instruction_sections (has rows), recipe_step_notes (exists), cooking_sessions (exists).

**Recommended doc updates:**
- ARCHITECTURE: Add cooking.ts types file and cookingService.ts to the services catalog
- DEFERRED_WORK: None

**Status:** Step 1 complete. Types and service created, all DB tables verified. Ready for Step 2 (ingredient-to-step text matching).

**Surprises / Notes for Claude.ai:**
- The Schmaltzy Rice recipe in the DB is a 9-step plain string version, not the 18-step structured version with sections referenced in the wireframes. The section-aware code path works but hasn't been tested against real structured data since none exists in the DB yet. Step 3 (section detection batch job) will populate instruction_sections for all recipes.
- All recipes currently in the DB appear to use plain string instruction arrays. Structured object format (`{step, text, section}`) may only come from newer extraction code that hasn't been run on these recipes yet.

---

### 2026-03-17 — Phase 5A-3: Code Cleanup + Audits
**Phase:** Phase 5A (cross-cutting)
**Prompt from:** PROMPT_5A3_CODE_CLEANUP.md — 5 tasks: remove debug logs, export helper, verify cooking methods, trace extraction save flow, audit ingredient matching code

**Files created:** none

**Files modified:**
- `lib/services/statsService.ts` — exported `getMondayOfWeek` helper (was internal `function`, now `export function`)

**DB changes:** none

**Decisions made during execution:**
- Task 1 (console.logs): No debug console.logs with `[MyPosts]`, `[StatsScreen]`, or `[Partners]` tags found in the codebase. They were already removed in the 2026-03-05 session (commit fc1e331). Only a `console.error('[MyPosts] Query error:')` remains in StatsScreen.tsx:190, which is correct to keep per the prompt's "keep console.error" rule.

**Task 2 — getMondayOfWeek export:**
- Was `function getMondayOfWeek` (not exported) at statsService.ts:121. Now exported. Used internally in 10 places within statsService.ts.

**Task 3 — Cooking Methods verification:**

UI values (PostCreationModal.tsx lines 29-40):
| UI Value | UI Label |
|----------|----------|
| cook | Cook |
| bake | Bake |
| bbq | BBQ |
| meal_prep | Meal Prep |
| snack | Snack |
| eating_out | Eat Out |
| breakfast | Breakfast |
| slow_cook | Slow Cook |
| soup | Soup/Stew |
| preserve | Preserve |

DB constraint values: roast, grill, saute, braise, fry, steam, bake, stew, slow_cook, no_cook

**Comparison:**
- In BOTH: `bake`, `slow_cook`
- In UI only (not in DB constraint): `cook`, `bbq`, `meal_prep`, `snack`, `eating_out`, `breakfast`, `soup`, `preserve`
- In DB constraint only (missing from UI): `roast`, `grill`, `saute`, `braise`, `fry`, `steam`, `stew`, `no_cook`

**Conclusion:** The UI and DB constraint are fundamentally misaligned. The UI uses activity/meal-type values (eating_out, breakfast, snack) while the DB constraint uses cooking technique values (roast, grill, braise). Only `bake` and `slow_cook` overlap. This is a design decision for Claude.ai — the PostCreationModal type definition (`PostData.cooking_method`) would need to be updated along with the DB constraint if alignment is desired.

**Task 4 — B19 Extraction Save Flow (READ-ONLY):**

Save path: RecipeReviewScreen `handleSave()` → `saveRecipeToDatabase()` (recipeService.ts:16) → `saveRecipe()` (line 96) + `saveIngredients()` (line 170)

Recipe-level fields in insert (recipeService.ts:117-154):
| Field | Status | Notes |
|-------|--------|-------|
| hero_ingredients | present | Line 148, `recipe.hero_ingredients \|\| []` |
| vibe_tags | present | Line 149, `recipe.vibe_tags \|\| []` |
| serving_temp | present | Line 150, `recipe.serving_temp \|\| null` |
| course_type | present | Line 151, `recipe.course_type \|\| null` |
| make_ahead_score | present | Line 152, `recipe.make_ahead_score \|\| null` |
| cooking_concept | present | Line 153, `recipe.cooking_concept \|\| null` |

Per-ingredient fields in insert (recipeService.ts:174-190):
| Field | Status | Notes |
|-------|--------|-------|
| ingredient_classification | present | Line 188, `ing.ingredient_classification \|\| 'secondary'` |
| flavor_tags | present | Line 189, `ing.flavor_tags \|\| []` |

**All 8 Phase 3A fields are present in the save path.**

**Task 5 — Ingredient Matching/Parsing Code Audit (READ-ONLY):**

| File | Purpose | Lines | Imported by | Relevant to 5D? |
|------|---------|-------|-------------|-----------------|
| `lib/ingredientsParser.ts` | Full ingredient parser with confidence scoring, OR-pattern detection, DB matching, migration helper | 755 | `recipeExtraction/ingredientMatcher.ts`, `lib/testParser.ts`, `screens/AdminScreen.tsx` | YES — core matching logic lives here |
| `lib/services/recipeExtraction/ingredientMatcher.ts` | Wrapper: calls `ingredientsParser.matchToDatabase()` for extraction flow, adds confidence grouping | 122 | `screens/AddRecipeFromUrlScreen.tsx` | YES — orchestrates matching during extraction |
| `utils/ingredientMatcher.ts` | Instruction text ingredient highlighter — finds ingredient names in step text for clickable highlights (NOT DB matching) | 224 | `screens/RecipeDetailScreen.tsx` | NO — UI highlighting only, not DB matching |
| `lib/services/ingredientService.ts` | Ingredient CRUD: create, search, exists check, getById, getAll | 211 | `screens/MissingIngredientsScreen.tsx` | MAYBE — search/create functions could be reused |
| `lib/services/ingredientSuggestionService.ts` | AI-powered (Claude Haiku) ingredient metadata suggestions: family, storage, shelf life, type | 274 | `lib/services/ingredientService.ts` (type import), `screens/MissingIngredientsScreen.tsx` | MAYBE — could suggest metadata for new ingredients found during matching |

**Key findings for Phase 5D:**
- The main matching pipeline is `ingredientsParser.ts` (755 lines). It does: parse text → extract quantity/unit/prep → match to DB (exact → fuzzy → partial → generic parent). Has OR-pattern handling with color-variant detection.
- `recipeExtraction/ingredientMatcher.ts` is a thin wrapper that calls `ingredientsParser.matchToDatabase()`.
- `utils/ingredientMatcher.ts` is completely separate — it highlights ingredient names in instruction text for the cooking mode UI. Not relevant to matching improvements.

**Deferred during execution:** none

**Recommended doc updates:**
- DEFERRED_WORK: Mark B19 as resolved — all Phase 3A fields are in the save path
- DEFERRED_WORK: Add item for cooking method UI/DB constraint misalignment (Task 3 findings)
- ARCHITECTURE: Add note that `getMondayOfWeek` is now exported from statsService.ts

**Status:** Task 1: 0 logs removed (already clean). Task 2: exported. Task 3: significant UI/DB mismatch reported. Task 4: all 8 fields present. Task 5: audit complete.

**Surprises / Notes for Claude.ai:**
- The cooking method mismatch (Task 3) is significant — the UI and DB constraint appear to have been designed for different purposes. The UI tracks "what kind of meal activity" while the DB constraint tracks "what cooking technique." This needs a product decision before any code fix.
- B19 can be closed — the save path is complete for all Phase 3A fields.

---

### 2026-03-05 — Phase 4/I wrap-up: cleanup + commit
**Phase:** Phase I - Stats Polish (final)
**Prompt from:** user request (3 tasks)

**Files created:**
- `docs/SESSION_LOG_PHASE4.md` — archived session log from Phase 4/I (40 sessions)
- `docs/SESSION_LOG.md` — fresh session log for next phase

**Files modified:**
- `screens/StatsScreen.tsx` — removed 3 debug `console.log` lines (MyPosts loading, query results, user profile)
- `components/stats/StatsOverview.tsx` — removed 1 debug `console.log` line (Partners avatarUrls)
- `App.tsx` — moved StatsStack ("You") tab to last position; order is now Home, Recipes, Meals, Pantry, Grocery, You

**DB changes:** none

**Decisions made during execution:**
- Kept all `console.error` lines intact — useful for production debugging
- Archived session log without underscore prefix (file was `SESSION_LOG.md`, not `_SESSION_LOG.md`)

**Deferred during execution:** none
**Recommended doc updates:** none
**Status:** committed as `fc1e331`. Not pushed — Tom will review and push manually.
**Surprises / Notes for Claude.ai:** none

---

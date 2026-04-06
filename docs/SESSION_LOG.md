# Session Log

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

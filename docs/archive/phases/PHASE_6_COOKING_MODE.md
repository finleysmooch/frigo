# Phase 6: Cooking Mode v2
**Started:** March 19, 2026
**Status:** ✅ Complete (6A-H). On-device tested. Ready for next phase.
**Completed:** March 19, 2026 (CookingScreen build) · March 24, 2026 (RecipeDetailScreen redesign + corrections finalized)
**Master Plan:** See FF_LAUNCH_MASTER_PLAN.md for full F&F context

---

## Goals

Transform the cooking experience from a scrollable text view into a purpose-built cooking companion. This is the app's core promise — being useful in the kitchen — and the single biggest UX improvement before F&F.

**Why this is Phase 6:** Self-contained, high-impact, no dependency on other phases. The ingredient architecture from Phase 5 doesn't affect cooking mode. This transforms the daily cooking experience.

**Updated success criteria (after design pivot D6-13 and on-device testing):**
- **RecipeDetailScreen is the primary cooking surface** — clean single-scroll layout matching NYT Cooking's recipe page. Ingredients grouped by recipe-author sections. Bold ingredient names. Generous typography. Tappable steps with per-step ingredient expansion and floating step navigation. Sticky progressive section header for quick jumping. Cook Soon save button. Simplified top bar.
- **CookingScreen is an optional focused mode** — entered via "Start Cooking" button. Section-card navigation, timers, notes, classic view, post-cook flow. Functional but needs simplification (deferred).
- Section-card navigation: swipe between recipe sections, steps within a section shown together with current step highlighted
- Auto-expansion: when current step is complex (long text + ingredients + timers), other steps in the section collapse to give it room
- Per-step ingredient detail: each step shows the ingredients it uses with quantity and prep method, scaled to current recipe scale
- Timer system: auto-detect time references, compact single-line timer bar at bottom, recommended vs actual time tracking
- Push notifications for timers when phone is locked
- Screen stays awake during cooking (already implemented via expo-keep-awake)
- Ingredient bottom sheet: pull-up from bottom bar, ingredients grouped by step
- Tappable ingredient detail: tap any ingredient to see quantity, prep, which step, personal notes
- Quick notes per step: text or voice, persisted, shown on return visits
- Classic cookbook view toggle: single scrollable page for users who prefer it
- Post-cook flow: "Anything to remember?" prompts → photo → rating → tag people → thoughts → Log & Share
- Book/page reference on every screen so user can grab the physical cookbook
- Works with flour on your hands (large tap targets, swipe navigation)
- Feels purpose-built, not like reading a webpage

---

## Prerequisites

- Phase 5 complete ✅ (completed March 19, 2026)
- expo-keep-awake available ✅ (already in CookingScreen)
- expo-notifications for push notification infrastructure
- Current CookingScreen.tsx exists as scrollable ingredients + steps

---

## Scope

**Note:** This phase's scope is not fixed. As work progresses, items may be added, removed, or moved to other phases. When scope changes, update this doc, FF_LAUNCH_MASTER_PLAN.md, and PROJECT_CONTEXT.md immediately.

### Product Feature Roadmap Items Touched
| # | Feature | Action |
|---|---------|--------|
| 49 | Cooking mode | Full rebuild: CookingScreen (section cards, timers, notes, classic view) + RecipeDetailScreen redesign (NYT-style primary cooking surface) |
| 50 | Offline cooking | Explicitly deferred to post-F&F |
| 83 | Unit converter | Moved to ⋮ overflow menu (from inline controls) |
| 94 | Talk-to-text | Explicitly deferred (voice note placeholder only) |

### Core Features (must ship)
- **RecipeDetailScreen as primary cooking surface (6G+6H):** NYT-style single scroll with recipe-author ingredient grouping, bold ingredient names, generous typography, tappable steps with per-step ingredient expansion, floating step navigation (‹ ›), sticky PREPARATION header with "↑ Ingredients" jump-back, collapsible nutrition panel, pantry-aware grocery list, "Add to Meal" on page body, Cook Soon save, notes section. Simplified top bar: ← Back + title + bookmark + ⋮ overflow + Cook. Frigo teal color scheme throughout.
- **Section-card layout (CookingScreen):** Sections are the primary navigation unit. Swipe between sections, not individual steps. Within a section, all steps visible with current step highlighted/expanded. Auto-expansion for complex steps. For non-sectioned recipes, each step is its own section (identical to step-by-step).
- **Per-step ingredient detail:** Below each step's instruction text, a compact list of ingredients used in that step with quantity and prep method.
- **Timer system:** Auto-detect time references in instruction text (regex). Compact single-line timer bar at bottom showing all active timers with recommended vs actual time. Tap pill to expand to detail view with pause/reset/+1min controls. Push notifications via expo-notifications.
- **Ingredient bottom sheet:** Pull-up from bottom bar. Ingredients grouped by step. Current step's group highlighted. Tappable for ingredient detail popup (quantity, prep, which step, personal notes).
- **Quick notes per step:** Text input + voice recording button (voice transcription placeholder for now). Notes persist in `recipe_step_notes` table. Shown automatically on return visits.
- **Classic cookbook view:** Toggle via menu. Full scrollable page with all ingredients and steps. Progress indicator shows position if coming from step-by-step. Optional step highlighting.
- **Post-cook flow:** After last step: "Anything to remember?" prompts (note on step, voice memo, edit quantity) → photo upload → "Would you make again?" rating → tag people → free-text thoughts → Log & Share (routes to PostCreationModal) or "Just log it" (skip post).
- **Book/page reference:** Small line under title on all screens: "📖 Simple · Ottolenghi · p.164". Enough to grab the physical book.
- **Section detection for existing recipes:** Batch job to generate section labels for recipes that don't have them (e.g., Ottolenghi SIMPLE). Uses Claude Haiku to analyze instruction text and group steps.
- **Screen-awake lock:** Already implemented (expo-keep-awake). Preserved.

### Deferred (from original scope)
- Serving size adjuster (strong v2 candidate — proportional ingredient recalc)
- Voice commands ("Next step" / "Start timer")
- Offline cooking mode
- Unit converter embedded in cooking view
- Wearable companion (WatchOS app — v2)
- Multi-recipe meal dashboard (v2 — design exists in wireframes)
- Interleaved AI timeline across recipes (v3)
- Recipe markup/editing review (was deferred from Phase 5 — assess during Phase 6 build)
- Ingredient alternatives ("try X instead of Y") — v2 ingredient detail enhancement

---

## Architecture

### RecipeDetailScreen Layout (Final — Phase 6G+6H)

**Single continuous scroll (no tabs on main page — D6-15):**
1. Top bar: ← (left) | recipe title (centered, appears on scroll, tappable → scroll to top) | bookmark save icon + ⋮ overflow (right)
2. Hero image (full width)
3. Title (28pt bold, title-cased), chef name (tappable, Frigo teal) + [+ Meal Plan] [🔥 Cook Soon] buttons, book reference + page (tappable)
4. Servings + total time summary ("4 servings · 45 min total")
5. Description (expandable "Read More", 5-line truncation)
6. Nutritional Information (collapsible, clean row with disclosure arrow, lazy-loaded)
7. Scale controls (1x / 2x / 3x / More — inactive buttons deemphasized, Convert moved to ⋮ menu)
8. **INGREDIENTS** — accent line + header with "X/Y in pantry" counter. Grouped by `group_name` from JSONB. Bold ingredient names. Pantry checkmarks (✓). Bordered "🛒 Add missing (N)" + secondary "Add all" grocery links.
9. **PREPARATION** — accent line + header. Steps with "Step N" labels, 16pt text. Section headers between groups (merged duplicates). Clickable ingredients (teal, no background). Tappable step focus mode.
10. Floating ‹ › step navigation buttons (bottom-right, appear during focus mode)
11. Progressive sticky section bar (INGREDIENTS appears first, PREPARATION joins when scrolled to, PREPARATION persists once seen)
12. "Start Cooking" button (outlined)
13. "Your Private Notes" section

**⋮ Overflow menu:** Clean View (✓) / Original View / Markup View | Edit Recipe | Unit Conversion | + Meal Plan

**Step focus mode interaction (D6-23):**
1. Normal state: all steps visible, full opacity, no floating buttons
2. Tap a step → bold text + teal left border + light teal background + collapsed ingredient list (expandable via ▸ toggle) + floating ‹ › buttons appear + NO auto-scroll
3. Tap › → next step focuses, current unfocuses, auto-scrolls so last ~3 lines of previous step visible above
4. Tap ‹ → previous step focuses
5. Tap focused step again → exit focus mode, everything returns to normal, buttons disappear
6. Tap different step while one focused → focus transfers

**Progressive sticky bar (D6-24):**
- INGREDIENTS appears when its header scrolls offscreen
- PREPARATION joins when its header scrolls offscreen
- Once PREPARATION has appeared, it persists even when scrolling back to ingredients (`hasSeenPreparation` flag)
- Bar disappears entirely when scrolled above INGREDIENTS header
- Active section is bold, inactive is light gray
- Both tappable — INGREDIENTS scrolls to ingredients (scale controls above viewport), PREPARATION scrolls to preparation

**Component structure:**
```
screens/RecipeDetailScreen.tsx (parent — state, data loading, handlers, modals, sticky bar, floating nav)
  ├── components/recipe/RecipeHeader.tsx (hero, title, meta, description, Cook Soon, Meal Plan)
  ├── components/recipe/ScaleConvertControls.tsx (scale only — Convert moved to menu)
  ├── components/recipe/IngredientsSection.tsx (group_name grouping, bold names, pantry, grocery links)
  ├── RecipeNutritionPanel (existing, lazy-loaded, collapsible)
  ├── components/recipe/PreparationSection.tsx (steps, sections, focus mode, step Y reporting, scaled ingredients)
  ├── components/recipe/SaveIcon.tsx (SVG bookmark icons for Cook Soon)
  ├── Floating ‹ › buttons (positioned absolute, bottom-right)
  ├── Progressive sticky section bar (scroll-position-driven)
  ├── IngredientPopup (positioned above/below tap point)
  ├── AddRecipeToListModal, SelectMealForRecipeModal (existing)
  └── ⋮ Overflow menu (anchored popover, top-right)
```

**Data flow:**
- Ingredients loaded from `recipe_ingredients` table (for pantry matching via ingredient_id), supplemented with `group_name`/`group_number` from `recipes.ingredients` JSONB by matching on `original_text` or `sequence_order`
- Instruction sections loaded from `instruction_sections` + `instruction_steps` DB tables
- Step-ingredient mapping computed via `mapIngredientsToSteps` from cookingService (sync, wrapped in try/catch)
- Cook Soon state via `userRecipeTagsService` (`isCookSoon`, `addToCookSoon`, `removeFromCookSoon`)
- Servings from `recipes.servings` column (430/475 recipes have data)
- Cooking time from `recipes.prep_time_min` + `recipes.cook_time_min` (only 60/475 recipes have data — backfill needed)
- Annotations, scale/convert, edit mode all preserved from pre-redesign

### CookingScreen Layout Model: Section Cards with Auto-Expansion (Phase 6A-F)

**Status:** Functional but needs simplification (deferred). On-device testing showed it's too busy.

**Primary navigation:** Swipe between sections. Progress dots show sections, not steps.

**Section card contents:** All steps in the section visible. Current step is highlighted (teal left border, larger text, ingredients + timers shown). Other steps in section shown smaller/dimmed. Done steps show checkmark.

**Auto-expansion rule:** When the current step's text + ingredients + timers would exceed ~60% of card height, the other steps in the section collapse to just step number + first ~40 chars. The current step gets the remaining space. This prevents the "wall of text" problem on complex steps (e.g., Molly Baz step 11).

**Non-sectioned recipes:** Each step is its own section. Behavior identical to step-by-step card-swipe.

**Adjacent section peek:** Previous section peeked above (faded, just section name + step count). Next section peeked below.

### CookingScreen Navigation
- **Primary:** Full-screen swipe gesture (left/right between sections)
- **Within section:** Tap a step to make it current. Or advance via "Next" button within a step's timer/action area.
- **Timeline overview:** Accessible via 📋 icon. Shows all steps in a vertical railroad with section groupings, completed/current/future state, timer history.
- **Classic view toggle:** Via ⋮ menu or 📋 icon. Remembers preference in AsyncStorage.

### Timer Architecture
- **CookingTimerContext:** React Context wrapping the CookingScreen. Holds array of active timers. Each timer: `{ id, label, stepNumber, recommendedSeconds, elapsedSeconds, status: 'running'|'paused'|'done' }`.
- **Auto-detection:** Regex parse on instruction text for patterns like "cook for 20 minutes", "bake 45 min", "simmer 1 hour", "rest 10-15 minutes", "set aside for 30 minutes". Pre-fills timer suggestion button on each step.
- **Display:** Compact single-line bar in the dark bottom area. Format: `⏱ Soak 14:22 /20:00 · Onion 6:05 /8:00`. All timers on one line.
- **Detail expand:** Tap any timer pill → expands in bottom sheet with large countdown, progress bar, recommended vs actual, pause/reset/+1min controls.
- **Push notifications:** expo-notifications. Fire when timer completes and app is backgrounded/phone locked. Permission prompt on first timer start.
- **History:** Timer results (recommended vs actual) stored in `cooking_sessions` table for post-cook stats and timeline view.

### DB Tables (created ✅ March 19)

```sql
-- Per-step personal notes
CREATE TABLE recipe_step_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  note_text TEXT,
  voice_url TEXT,           -- Supabase Storage path for voice recordings (v2)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, recipe_id, step_number)
);

-- Cooking session log (timer history + session metadata)
CREATE TABLE cooking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  recipe_id UUID NOT NULL REFERENCES recipes(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  timer_history JSONB DEFAULT '[]',  -- [{label, stepNumber, recommendedSec, actualSec}]
  steps_completed INTEGER DEFAULT 0,
  total_steps INTEGER,
  view_mode TEXT DEFAULT 'step_by_step',  -- 'step_by_step' | 'classic'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**recipes table additions:**
```sql
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS instruction_sections JSONB;
-- Format: [{"name": "Crisp the chicken", "startStep": 2, "endStep": 4}, ...]
-- startStep and endStep are 1-indexed and inclusive
-- Every step must belong to exactly one section
-- Sections must be consecutive (no gaps or overlaps)
```

**recipes table existing columns used:**
- `instruction_sections` JSONB — populated for all 475 recipes
- `servings` integer (default 4) — 430/475 have data
- `prep_time_min` integer — only 60/475 have data (backfill needed)
- `cook_time_min` integer — only 60/475 have data (backfill needed)
- `ingredients` JSONB — structured objects with `group_name`/`group_number` on 427/475 recipes

### CookingScreen Rebuild Strategy
- **Full rewrite** of CookingScreen.tsx (original version was 327 lines of basic scrollable view with direct Supabase calls in the post handler — violates services rule)
- **New service:** `cookingService.ts` — handles recipe_step_notes CRUD, cooking_sessions CRUD, section detection utility, instruction normalization, ingredient-to-step mapping
- **New context:** `CookingTimerContext.tsx` — timer state management, notification scheduling
- **Post-cook flow:** Integrates with existing PostCreationModal. New fields (photos, rating, tags, thoughts) already exist in PostCreationModal — the post-cook screen is a bridge that collects retrospective data before opening the modal.

### Ingredient-to-Step Mapping

The `recipe_ingredients` table has `sequence_order` but no `step_number`. For per-step ingredient display, we need to map ingredients to steps. Three options considered:

1. **AI mapping at extraction time** — Have Claude assign step numbers to ingredients during extraction. Best long-term accuracy. Requires extraction pipeline change (modify the prompt to output step associations). Would need backfill for existing recipes. High effort, high accuracy.

2. **Runtime text matching** — Match ingredient names from `recipe_ingredients` against instruction text at each step. Fuzzy matching on key words. Works without schema changes. Medium accuracy — will miss ingredients referenced indirectly ("add the remaining oil") and may over-match common words. Fast to implement.

3. **Manual mapping field** — Add `step_numbers INTEGER[]` to `recipe_ingredients`. Most accurate. Requires migration + backfill for all 5,300+ recipe_ingredient rows. Could be AI-assisted backfill. High effort, high accuracy.

**Decision (D6-10): Option 2 (runtime text matching) for v1.** Fast to implement, no migration needed. The `ingredients_json` on the recipes table already has ingredient text we can match against instruction text. If accuracy is poor during testing, upgrade to Option 1 (extraction-time mapping) or Option 3 (manual field with AI backfill) in a follow-up pass.

### Ingredient Grouping for RecipeDetailScreen (Phase 6G)

The `recipes.ingredients` JSONB contains structured objects with `group_name` and `group_number` fields representing the recipe author's ingredient groupings. 427/475 recipes have this data. The `recipe_ingredients` table has no `group_name` column.

**Strategy:** Load from `recipe_ingredients` (for pantry matching via ingredient_id). Supplement with `group_name` from JSONB by matching on `original_text` or `sequence_order`. Group ingredients by `group_name` (sorted by `group_number`) instead of `family`. Single-group recipes show no header. No-group recipes show flat list.

### CookingScreen Component Architecture (Phase 6A-F)

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

---

## Build Phases

| Sub-phase | Scope | Sessions | Status |
|-----------|-------|----------|--------|
| **6A** | Types + cookingService.ts + section detection batch job | 4 (Step 1 + correction + Step 2 + Step 3) | ✅ |
| **6B** | CookingScreen rebuild — section card layout, swipe navigation, auto-expansion, per-step ingredients, book reference, progress dots | 1 (Step 4) | ✅ |
| **6C** | Timer system — CookingTimerContext, auto-detection regex, compact bottom bar, timer detail expand, recommended vs actual, expo-notifications | 1 (Step 5) | ✅ |
| **6D** | Ingredient bottom sheet + ingredient detail popup + ingredients-by-step grouping | 1 (Step 6) | ✅ |
| **6E** | Notes system — quick note per step (text + voice placeholder), saved note display, recipe_step_notes CRUD | 1 (Step 7) | ✅ |
| **6F** | Classic cookbook view toggle + view mode switcher + post-cook flow (retrospective → PostCreationModal bridge) | 1 (Step 8) | ✅ |
| **6G** | RecipeDetailScreen redesign — extract sub-components, rebuild ingredients (author grouping, bold quantities), rebuild preparation (clean steps, expandable ingredients), new layout (NYT-style scroll), polish | 5 (Steps 1-5) | ✅ |
| **6H** | RecipeDetailScreen corrections + enhancements — bug fixes, Frigo colors, top bar simplification, sticky PREPARATION header, step focus navigation, grocery styling, nutrition reposition, Cook Soon, servings, menu, SVG icons, progressive sticky bar, scroll tuning | ~12 (Rounds 1-4 + post-fixes) | ✅ |

**Total: ~28 Claude Code sessions across 6A-6H**

**Execution guides:**
- `PHASE_6_CLAUDE_CODE_GUIDE.md` — Steps 1-8 (CookingScreen build, sub-phases 6A-6F)
- `PHASE_6B_RECIPE_DETAIL_REDESIGN.md` — Steps 1-5 (RecipeDetailScreen redesign, sub-phase 6G)
- `PHASE_6B_CORRECTIONS_GUIDE.md` — Steps 1-5 (Corrections round 1, sub-phase 6H)
- `PHASE_6H_ROUND2_FIXES.md` — Corrections round 2
- `PHASE_6H_ROUND3_FIXES.md` — Corrections round 3
- `PHASE_6H_ROUND4_FIXES.md` — Corrections round 4

---

## Decisions Log

| Decision | Rationale | Date | Origin |
|----------|-----------|------|--------|
| D6-1: Section cards as primary CookingScreen navigation | Respects author's intent (sections group related steps), reduces swipe count, degrades cleanly for non-sectioned recipes. Auto-expansion handles complex steps. | Mar 19 | Wireframe planning session |
| D6-2: Layout = card-swipe with adjacent section peek | Maximum readability for phone-on-counter cooking. Swipe gesture for messy hands. Previous/next section peeking for context. | Mar 19 | Wireframe planning session |
| D6-3: Timer bar = compact single line at bottom | All timers on one line (label + time + recommended). Not a row per timer. Sits in the dark bottom bar area. Tap to expand. | Mar 19 | Wireframe planning session |
| D6-4: Timer shows recommended vs actual | Users want to see "recipe says 10:00, you're at 8:32". Delta visible. +1min button for real-world adjustment. | Mar 19 | Wireframe planning session |
| D6-5: CookingScreen ingredients grouped by step, not checkable | No checkboxes. Ingredients ordered by which step uses them. Current step's group highlighted. Tappable for detail. Checkboxes felt like a to-do list, not a cooking tool. | Mar 19 | Wireframe planning session |
| D6-6: Classic cookbook view as toggle option | Not everyone wants step-by-step. Classic = single scrollable page. Shows progress indicator if user has been in step mode. Accessible via ⋮ menu. | Mar 19 | Wireframe planning session |
| D6-7: Post-cook = simple retrospective + post bridge | No stats display. "Anything to remember?" → photo → rating → tag people → thoughts → Log & Share. Feeds into existing PostCreationModal. | Mar 19 | Wireframe planning session |
| D6-8: Book/page reference on every screen | Small "📖 Book · Author · p.XX" line. Users should be able to grab the physical book easily. | Mar 19 | Wireframe planning session |
| D6-9: Section detection for existing recipes | Batch job using Claude Haiku to analyze instruction text and generate section labels for recipes that lack them. Stored in instruction_sections field. | Mar 19 | Wireframe planning session |
| D6-10: Runtime text matching for ingredient-to-step mapping | v1 approach. Match ingredient names against instruction text per step. No schema change needed. Upgrade to AI mapping (Option 1) or manual field (Option 3) if accuracy is poor. See Architecture > Ingredient-to-Step Mapping for full options analysis. | Mar 19 | Architecture planning |
| D6-11: Full rewrite of CookingScreen | Current screen is 327 lines with direct Supabase calls. Not worth patching — rebuild from scratch following services pattern. | Mar 19 | Architecture planning |
| D6-12: Wearable + multi-recipe deferred to v2 | Watch companion and multi-recipe dashboard wireframed but not in F&F scope. Shapes architecture (timer context needs to be extensible) but not built yet. | Mar 19 | Wireframe planning session |
| D6-13: Design pivot — RecipeDetailScreen as primary cooking surface | On-device testing showed section-card CookingScreen is too busy. Partner Mary uses NYT Cooking and just cooks from the recipe page. RecipeDetailScreen should be the main cooking surface with ingredient/step toggle, expandable steps showing per-step ingredients, tappable ingredient detail. Dedicated CookingScreen becomes optional power-user mode. | Mar 23 | On-device testing |
| D6-14: Ingredients grouped by recipe-author `group_name`, not `family` | The `recipes.ingredients` JSONB has `group_name` fields (e.g., "FOR THE FISH:", "At Home", "Sauce") on 427/475 recipes. This represents the recipe author's intended grouping and is what cooks actually need. The current family-based grouping (Protein/Vegetables/Pantry) is useful for grocery/pantry contexts but wrong for the cooking surface. `recipe_ingredients` table has no `group_name` column — merge from JSONB by matching on `original_text` or `sequence_order`. | Mar 23 | Data discovery session |
| D6-15: NYT main page is single scroll, NOT tabbed | Initial assumption was that NYT's recipe page uses INGREDIENTS/PREPARATION tabs. Tom corrected: tabs are only in the "Start Cooking" enhanced mode. The main recipe page is a single continuous scroll. RecipeDetailScreen redesign follows this — no tab toggle on the main page. | Mar 23 | Screenshot review |
| D6-16: Bold ingredient NAME, not quantity | Initially implemented bold quantity (like NYT). On-device testing showed that with pantry indicators (✓ checkmarks), users need to scan for *what* they have, not *how much*. Reversed to bold the ingredient name instead. Layout: `✓ quantity unit` **ingredient name**`, preparation`. Parse by bolding everything after quantity+unit until the first comma (or end of string). | Mar 23 | On-device testing (revised from original design session) |
| D6-17: Tappable steps show per-step ingredients | On the Preparation section, tapping a step expands to show the ingredients used in that step (from `mapIngredientsToSteps`). Leverages Phase 6 Step 2 infrastructure. Different from tapping highlighted ingredient text (which shows quantity/prep popup). One step expanded at a time. Collapsible via ▸ toggle. | Mar 23 | Design session |
| D6-18: Tappable ingredients on Ingredients section show usage context (deferred) | Tapping an ingredient on the Ingredients section shows: which steps use it, pantry status, personal notes. Different from the Preparation tab popup (which shows quantity/prep). Quantity/prep are already visible on the ingredients list, so the popup adds complementary info. **Not implemented in 6G.** | Mar 23 | Design session |
| D6-19: Nutrition panel collapsed by default, positioned near recipe overview | Initially placed between Ingredients and Preparation. On-device testing moved it higher — between description and Scale/Convert controls, near the recipe overview where users expect it. Collapsible row with disclosure arrow (▸/▾). Lazy-loaded (RecipeNutritionPanel only mounts when expanded). | Mar 23 | Design session (revised after on-device testing) |
| D6-20: Merge consecutive duplicate instruction_sections at display time | The JSONB `instruction_sections` has a data quality issue: consecutive entries with the same name (e.g., "Prepare Oven and Roast Vegetables" appears twice). Merge at display time via `mergeConsecutiveSections()` — if adjacent entries share a name, treat as one section. Runtime fix, no data migration. | Mar 23 | Data discovery |
| D6-21: RecipeDetailScreen modularized into sub-components | 2,021-line file broken into: RecipeHeader, IngredientsSection, PreparationSection, ScaleConvertControls. Parent keeps state and data loading. Pure refactor step before visual changes. | Mar 23 | Architecture planning |
| D6-22: Top bar = ← + title + bookmark + ⋮ | The emoji icon buttons (👁️ ✏️ 🍽️) were unclear and gimmicky. View mode, edit mode, unit conversion, and add-to-meal moved to ⋮ overflow menu. Cook button removed from top bar (Start Cooking at bottom is primary). Title appears centered on scroll (disappears when real title visible). SVG bookmark icon for Cook Soon. | Mar 23 | On-device testing |
| D6-23: Step focus mode with floating ‹ › navigation | Tapping a step enters focus mode: bold text + teal left border + light background + collapsed ingredients (expandable via ▸) + floating circular ‹ › buttons appear bottom-right. No auto-scroll on tap — step expands in place. ‹ › arrows scroll to show last ~3 lines of previous step above focused step. Tapping the focused step again exits focus mode and buttons disappear. Other steps remain fully visible (no dimming). Concept B from wireframe exploration chosen. | Mar 23 | On-device testing + wireframe session |
| D6-24: Progressive sticky section bar with persistence | When scrolling past INGREDIENTS header, "INGREDIENTS" appears in sticky bar. When scrolling past PREPARATION header, "PREPARATION" joins the bar on the right. Once PREPARATION has appeared, it persists even when scrolling back to ingredients (`hasSeenPreparation` flag). Bar disappears entirely when above INGREDIENTS header. Active section bold, inactive light gray. Both tappable to jump to section. | Mar 23-24 | On-device testing |
| D6-25: Frigo teal color scheme throughout RecipeDetailScreen | All system blue (#007AFF) replaced with Frigo primary teal (#0d9488). Applies to: links (chef, book, Read More), clickable ingredients in step text, accent lines, active scale button, grocery list links, pantry indicators. Ingredient text in steps uses teal color only (no background highlight — reduced from previous implementation). | Mar 23 | On-device testing |
| D6-26: "Add to Meal" + "Cook Soon" buttons on page body | Next to chef name in RecipeHeader. Cook Soon via userRecipeTagsService (addToCookSoon, removeFromCookSoon, isCookSoon). Visible during browse flow — RecipeDetailScreen serves both cooking and recipe browsing. | Mar 23 | On-device testing |
| D6-27: Convert moved to ⋮ menu, scale controls deemphasized | Convert is power-user feature. Inactive scale buttons show gray/transparent instead of prominent white-with-border. ScaleConvertControls reduced from 167 to 102 lines. | Mar 23 | On-device testing |
| D6-28: Step ingredients default collapsed, independently toggleable | ▸/▾ disclosure arrow on "INGREDIENTS FOR THIS STEP" header. Collapsed by default when entering focus mode. Tapping toggles without exiting focus mode. Single collapsed state shared across steps — resets to collapsed on step navigation. | Mar 24 | On-device testing |
| D6-29: Focused step text becomes bold | Entire instruction text gets fontWeight 600 when step is in focus mode. Visual distinction from surrounding steps without dimming them. | Mar 24 | On-device testing |

---

## Deferred Items

### High Priority (F&F blockers or near-term)

| Item | Type | Origin | Notes |
|------|------|--------|-------|
| **Cooking time data backfill** | 🔧 | Mar 24 on-device | Only 60/475 recipes have `prep_time_min`/`cook_time_min` data. Need AI-assisted backfill or extraction pipeline update. RecipeDetailScreen correctly shows data when available. |
| **CookingScreen simplification** | 🔨 | Mar 23 design pivot | Section-card layout too busy. Consider: strip NOW badges/section dots/header bars, ClassicView as default, tabs (INGREDIENTS/PREPARATION) like NYT's "Start Cooking". Fix double header (nav header + custom header). May want to hide "Start Cooking" button until simplified. |
| **Multi-recipe cooking** | 🚀 | Mar 24 | Cook dinner = protein + side + salad simultaneously. Shared timers across recipes, interleaved steps. Architecture exists (CookingTimerContext extensible). High-impact feature for real cooking. |
| **PostCookFlow makeAgain/thoughts data gap** | 🔧 | 6F Step 8 | PostCookFlow collects `makeAgain` (Yes/Maybe/No) and `thoughts` but PostCreationModal's PostData interface has no fields for them. Data gathered then dropped. Wire up before F&F. |
| **notes/modifications duplication bug** | 🔧 | 6F Step 8 | `createDishPost` sets `notes: postData.modifications` (preserved from original). Duplicates modifications into notes field. |

### Medium Priority (polish + UX improvements)

| Item | Type | Origin | Notes |
|------|------|--------|-------|
| Rethink pantry fraction next to INGREDIENTS title | 💡 | Mar 24 on-device | "4/14 in pantry" may confuse users. Consider: move to bottom near grocery links, or use plain text "4 items in pantry", or remove entirely. |
| Rethink "Add missing to Grocery List" button | 💡 | Mar 24 on-device | Current bordered box with 🛒 may not be the right treatment. Consider integrating with grocery flow more naturally. |
| Add timer options to step focus mode | 💡 | Mar 24 on-device | When a step is focused, show timer auto-detection buttons (like CookingScreen has). Let users start timers from RecipeDetailScreen without entering cooking mode. |
| Ingredient tap-to-see-steps in IngredientsSection | 💡 | 6G Step 2 | D6-18. Show step usage, pantry status, notes on tap. Would need mapIngredientsToSteps imported into IngredientsSection and onPress handlers. |
| Dedicated "Add a Note" modal | 💡 | 6G Step 4 | Simple text area modal (like NYT). Currently annotation edit mode is the only way to add notes. |
| Read More inline fade effect | 💡 | Mar 24 | NYT has "Read More" inline at end of truncated text with fade. Current implementation is on its own line. Works fine, just not as polished. |
| Bold variance on ingredient names | 🔧 | Mar 23 on-device | Text-structural approach bolds descriptors with ingredient name. "good-quality risotto rice" all bold vs just "onion". Hard to fix without AI parsing. Low impact. |
| ⋮ overflow menu feel | 💡 | Mar 24 | Anchored popover implemented but may need more polish. Consider native ActionSheet on iOS. |

### Lower Priority (v2 features)

| Item | Type | Origin | Notes |
|------|------|--------|-------|
| Wearable companion (WatchOS) | 🚀 | Mar 19 wireframes | Wireframed (screens 10-11). Needs react-native-watch-connectivity. v2. |
| Multi-recipe meal dashboard | 🚀 | Mar 19 wireframes | Wireframed (screen 12). Timers unified across recipes. Related to multi-recipe cooking above. v2. |
| Interleaved AI timeline | 💡 | Mar 19 wireframes | AI merges steps across recipes. v3 moonshot. |
| Serving size adjuster | 🚀 | Phase 6 doc | Proportional ingredient recalc. Non-linear baking edge cases. Strong v2. |
| Voice commands | 💡 | Phase 6 doc | "Next step" / "Start timer". Post-F&F. |
| Offline cooking | 💡 | Phase 6 doc | Cache recipe locally. Significant scope. |
| Ingredient alternatives | 💡 | Mar 19 wireframes | "Try X instead of Y" in ingredient detail. Needs data source. v2. |
| Voice note transcription | 💡 | Mar 19 | Voice recording button in notes UI, but actual transcription is v2. Placeholder exists. |
| Timeline overview view mode | 🚀 | 6F Step 8 | ViewModeMenu only has step-by-step and classic. Timeline (3rd option — vertical railroad) deferred. |
| Post-cook photo upload | 🚀 | 6F Step 8 | PostCookFlow has placeholder button. Needs image picker integration. |
| Post-cook voice memo | 💡 | 6F Step 8 | Placeholder button in PostCookFlow. Needs recording + transcription. |
| Post-cook partner tagging | 🚀 | 6F Step 8 | Placeholder in PostCookFlow. Should connect to existing AddCookingPartnersModal. |
| "Mark as Cooked" + Rate row on RecipeDetailScreen | 💡 | Mar 23 design session | NYT has this between description and ingredients. Nice UX — log a cook without entering cooking mode. |
| Clickable page references in step text | 💡 | Mar 23 on-device | Some recipes reference other pages (e.g., "see page 116"). Could detect via regex and link to book view. Technically complex for minor UX gain. |
| Yield/servings display enhancement | 💡 | 6G Step 2 | Currently shows servings when data exists. Could add yield text from recipe. |
| Step quantities scale in instruction text | 🔧 | Mar 23 on-device | Quantities mentioned in step prose don't update at 2x. Deep — would need in-text number replacement. |
| RecipeDetailScreen tab toggle (INGREDIENTS/PREPARATION) | 💡 | Mar 23 design session | Initially planned for main page, but NYT only uses tabs in the enhanced cooking mode. Defer to CookingScreen simplification. |
| Ingredient alternatives popup | 💡 | Mar 23 design session | Show alternative ingredients when tapping on the Ingredients section. Needs data source. v2. |

### Tech Debt

| Item | Type | Origin | Notes |
|------|------|--------|-------|
| PanResponder → gesture handler upgrade | 🔧 | 6B Step 4 review | CookingScreen swipe nav uses PanResponder (no gesture handler installed). May feel janky or conflict with vertical scroll within long section cards. Test on-device; upgrade to react-native-gesture-handler if issues. |
| Table-only recipes missing step text | 🔧 | 6B Step 4 review | 8 recipes have `instructions=[]` with text only in `instruction_steps` table. `normalizeInstructions` (sync) returns empty for these. Section headers render but step text may be blank. |
| Android notification channel config | 🔧 | 6C Step 5 review | expo-notifications installed but Android notification channel not configured in app.json. Required for Android production builds. Not blocking iOS F&F testing. |
| Blueberry Cornflake Crisp "Main" section name | 🔧 | 6A Step 3 review | Extraction pipeline stored section as "Main" instead of descriptive name. Data quality issue. |
| instruction_sections + instruction_steps table redundancy | 💡 | 6A Step 3 review | DB tables still exist but redundant for cooking mode since recipes.instruction_sections JSONB is canonical. Decide whether to keep for extraction or migrate to JSONB. |
| Recipe markup/editing review | 🔧 | Phase 5 deferred | Tom flagged as "clunky". Assess in future phase. |
| "Error getting pending count" toast | 🔧 | Mar 23 on-device | Error toast visible on RecipeDetailScreen. Not from Phase 6 work — likely a notification or badge count query failing elsewhere. Investigate separately. |

---

## Wireframe References

Design exploration artifacts created during planning. Two key files are saved in the **project folder** for Claude Code to reference during implementation:

1. **`cooking-mode-sections.jsx`** (in project folder) — Final converged design: section card layout with auto-expansion, section progress dots, adjacent section peek, compact timer bar, book reference. Real recipe data (Molly Baz + Ottolenghi). **Primary reference for CookingScreen Steps 4-5.**
2. **`cooking-mode-v3.jsx`** (in project folder) — Full screen set: timer detail expand, ingredient bottom sheet (grouped by step), ingredient detail popup, quick note input, saved note display, classic cookbook view, view mode switcher, post-cook flow. All in Frigo color scheme. **Primary reference for CookingScreen Steps 5-8.**

Earlier exploration artifacts (in Claude.ai outputs, not in project folder):
3. `cooking-mode-wireframes.jsx` — Initial 22-concept exploration across 7 categories
4. `cooking-mode-refined.jsx` — Composite design with 12 screens
5. `cooking-mode-real-recipes.jsx` — Real data testing with Bulgur + One-Pot Chicken

These wireframes are HTML/CSS for browser rendering. Claude Code should use them as **visual reference for layout, spacing, and component hierarchy**, but implement in React Native StyleSheet.

**NYT Cooking screenshots** (in project knowledge, uploaded Mar 23) — Primary design reference for Phase 6G RecipeDetailScreen redesign. Shows NYT's recipe detail page (single scroll: hero → metadata → ingredients grouped by section → preparation with large text → Start Cooking → notes) and enhanced cooking mode (tabbed INGREDIENTS/PREPARATION with checkboxes).

**Step focus wireframe** (in Claude.ai, Mar 23) — Concept B chosen: minimal sticky bar ("↑ Ingredients" + "PREPARATION") + floating ‹ › circular buttons bottom-right. Steps remain fully visible (no dimming). Focus indicated by teal left border + light teal background + bold text.

---

## Claude Code Prompts Issued

| Prompt | Date | Session | Result |
|--------|------|---------|--------|
| **CookingScreen (6A-6F):** | | | |
| Step 1: Types + CookingService | Mar 19 | 1 | ✅ |
| Step 1 Correction: Data source handling | Mar 19 | 2 | ✅ (3 fixes) |
| Step 2: Ingredient-to-step matching | Mar 19 | 3 | ✅ |
| Step 3: Section detection batch job | Mar 19 | 4 | ✅ (475/475) |
| Step 4: CookingScreen rebuild | Mar 19 | 5 | ✅ |
| Step 5: Timer system | Mar 19 | 6 | ✅ |
| Step 6: Ingredient bottom sheet | Mar 19 | 7 | ✅ |
| Step 7: Notes system | Mar 19 | 8 | ✅ |
| Step 8: Classic view + post-cook + Supabase fix | Mar 19 | 9 | ✅ |
| **RecipeDetailScreen redesign (6G):** | | | |
| Step 1: Extract sub-components (pure refactor) | Mar 23 | 10 | ✅ |
| Step 2: Rebuild IngredientsSection | Mar 23 | 11 | ✅ |
| Step 3: Rebuild PreparationSection | Mar 23 | 12 | ✅ |
| Step 4: Rebuild overall layout | Mar 23 | 13 | ✅ |
| Step 5: Polish + integration test | Mar 23 | 14 | ✅ (21/22 pass, 1 deferred) |
| **Corrections + enhancements (6H):** | | | |
| Round 1 Step 1: Bug fixes (fractions, bold, highlight, popup, step qty) | Mar 23 | 15 | ✅ |
| Round 1 Step 2: Frigo colors + top bar simplification | Mar 23 | 16 | ✅ |
| Round 1 Step 3: Sticky header + step focus nav | Mar 23 | 17 | ✅ |
| Round 1 Step 5: Final polish + verification | Mar 23 | 18 | ✅ (23/23) |
| Round 2 Fixes 2-8: Title, popover, meal button, scaling, collapse, shadows | Mar 23 | 19 | ✅ |
| Round 3 Fixes 1-8: Progressive sticky, Cook Soon, servings, nutrition, scale, menu | Mar 23 | 20 | ✅ |
| Round 3 Post-fix: Button placement, sticky styling, title casing | Mar 23 | 21 | ✅ |
| Round 3 Post-fix: Sticky timing, SVG icons, top bar | Mar 23-24 | 22-24 | ✅ |
| Round 4 Fixes 1-5: Bold focus, Read More, time debug, sticky persistence, scroll target | Mar 24 | 25 | ✅ |
| Round 4 Post-fix: Sticky tuning, bookmark size | Mar 24 | 26 | ✅ |
| Fix B: Cooking time/servings debug + simplification | Mar 24 | 27 | ✅ (data issue found) |
| Sticky PREPARATION scroll target tuning | Mar 24 | 28 | ✅ |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-17 | Created scaffold during F&F planning session. Three layout options documented, timer design questions captured, sub-phases estimated. |
| 2026-03-19 | **Planning complete.** Extensive wireframe exploration (5 artifacts, 50+ wireframe screens). All design decisions resolved (D6-1 through D6-12). Build plan detailed (6A-6F, 6-8 sessions). Architecture documented: section cards with auto-expansion, CookingTimerContext, runtime ingredient-step matching (with full options analysis), DB schema. Real recipe data tested (Bulgur + One-Pot Chicken). Wireframe files (cooking-mode-sections.jsx, cooking-mode-v3.jsx) saved to project folder for Claude Code reference. |
| 2026-03-19 | **CookingScreen build complete (6A-6F).** All 8 steps executed by Claude Code. 1 correction issued (Step 1 data source handling — 3 fixes for instruction format coverage). All TypeScript compiles clean. 12 new components, 3 new services, 1 new context, 1 new util. 475 recipes populated with instruction_sections. expo-notifications added. Supabase violation fixed (postService.ts). |
| 2026-03-23 | **On-device testing + design pivot.** Tom tested on-device. CookingScreen section-card layout is too busy. Decision (D6-13): RecipeDetailScreen should be the primary cooking surface (like NYT Cooking), with dedicated cooking mode as optional upgrade. PHASE_6B_HANDOFF.md created. All backend/service work carries forward — pivot is UI-layer only. |
| 2026-03-23 | **RecipeDetailScreen redesign planned (6G).** Discovered `group_name` in recipes.ingredients JSONB (427/475 recipes have author ingredient groupings). Corrected tab assumption (D6-15: NYT tabs are cooking-mode only, not main page). Detailed 5-step Claude Code execution guide created (PHASE_6B_RECIPE_DETAIL_REDESIGN.md). Key decisions: D6-14 through D6-21. |
| 2026-03-23 | **RecipeDetailScreen redesign complete (6G).** All 5 steps executed by Claude Code. 0 corrections needed. RecipeDetailScreen transformed from 2,021-line monolith to 5 modular files (2,368 lines total). Ingredients now grouped by recipe-author sections with bold quantities. Steps shown with 18pt text, section headers, tappable expansion showing per-step ingredients. Layout matches NYT hierarchy. 21/22 integration test items pass (1 deferred: ingredient tap-to-see-steps). 4 components created: RecipeHeader, IngredientsSection, PreparationSection, ScaleConvertControls. |
| 2026-03-23 | **On-device testing round 2 + corrections planned (6H).** Bugs found: fraction scaling missing thirds, bold matching misses, ingredient highlight too heavy, popup overlaps, step quantities raw decimals. UX improvements: top bar simplified (D6-22), step navigation (D6-23), sticky header (D6-24), bold names not quantity (D6-16 revised), Frigo colors (D6-25), add-to-meal on body (D6-26). |
| 2026-03-23 | **6H Rounds 1-3 complete.** Bug fixes, Frigo teal throughout, top bar simplified, sticky header + step focus implemented, ⋮ anchored popover, Cook Soon button, meal plan in header, step ingredient scaling, collapsible step ingredients, progressive sticky bar, SVG save icons, title casing. |
| 2026-03-24 | **6H Round 4 + final tuning.** Focused step bold text (D6-29), ingredients collapsed by default (D6-28), Read More 5 lines, servings display, sticky bar timing/scroll targets tuned. Cooking time debug revealed: only 60/475 recipes have time data — backfill needed, not a code issue. |
| 2026-03-24 | **Phase 6 closed.** All sub-phases (6A-6H) complete. ~28 Claude Code sessions. Deferred items documented across 4 priority tiers. Ready for next phase. |

# [DRAFT] CC Prompt 3 — Phase 8B-CP2 Staples UI on PantryScreen

> **⚠️ DRAFT v2 — pending second audit review.** Renamed from 8B-CP3 per sub-phase restructure (D8-24). Absorbs color softening (was standalone 8A-CP3 in v2.0). Fixes from first audit: lib/theme/ (folder, not constants/theme.ts), useActiveSpaceId from contexts/SpaceContext.tsx, 8A-CP2 wording "extends" not "revives", canonical session log, Rule E check, accessibility verification added.

**Session type:** Execution
**Checkpoint:** 8B-CP2 — Staples UI on PantryScreen with soft color treatment
**Estimated duration:** One session
**Dependencies:** 8A-CP1 complete (schema + types), 8B-CP1 complete (pantryStaplesService.ts available)

---

## Context

With schema and service landed, this checkpoint puts staples on the pantry screen with their final visual treatment. Users can now: see staples at the top of the screen, tap the dot to cycle state, tap the label to drill into ingredient detail (stub for now — Ingredient Detail screen ships in 8C-CP5), add new staples via "+ Add new," and see unknown-state staples clearly flagged so they know what to confirm.

**Why this checkpoint is UI-only:** Schema and service are stable. UI wiring is mechanical. This is the first big user-facing insert to a screen users interact with daily — regressions here are expensive.

**Key UX decisions landed in wireframes (all D8-N, see phase doc Decisions Log):**
- **D8-7 / D8-9:** Staples are a separate data class with unknown / good / running_low / out states.
- **Out state visual priority (audit-adjusted):** Out staples auto-sort to the top-left of the grid. Label weight 500, subtle color emphasis — but not alarming. "Slightly distinct," per Tom.
- **D8-17:** Unknown staples render with distinct dashed border, italic label, empty outlined dot. Canonical example: Paprika.
- **Split tap zones:** **dot** (~28-32px tap area) cycles state; **label** opens Ingredient Detail. Prevents accidental state changes when users want to drill in.
- **Softer color treatment (audit-adjusted from v2.0):** Low and out states use border-left accent + subtle tint, not saturated backgrounds. See v5 wireframe. This absorbs what was originally planned as a standalone 8A-CP3 checkpoint.

**What's not in this checkpoint:**
- Ingredient Detail screen (8C-CP5) — label tap shows Alert.alert for now
- "See all / Add new" full management screen — routes are stubbed
- Cook-post depletion updating staple state (8B-CP4)
- Staple-to-grocery routing (8C-CP4)

**Primary reference:** `docs/phase_8_system_prototype_v5.html` when available (will be at that path after wireframe setup commit), **Pantry tab**.

---

## Inputs to read

**Required:**
1. `docs/PHASE_8_PANTRY_INTELLIGENCE.md` v2.1 — 8B-CP2 section + architectural notes on staples UI.
2. `docs/phase_8_system_prototype_v5.html` (when available) — **Pantry tab**. Primary visual reference.
3. `screens/PantryScreen.tsx` — current implementation. Insert the staples grid at the top but preserve all existing functionality:
   - SpaceSwitcher (top bar)
   - Current 2-option Family/Storage view toggle (8A-CP2 will extend this with a third option; **not in this CP's scope**)
   - Expiring Soon banner
   - Category/family accordion hierarchy (3-level: Family → Type → Item)
   - PantryItemRow rendering
   - Floating action button ("+ Add item")
   - Legend at bottom (Fridge/Freezer/Pantry/Counter colors)
4. `components/PantryItemRow.tsx` — reference for tap-zone splitting pattern (row already has multiple tap zones).
5. `lib/pantryStaplesService.ts` — from 8B-CP1. Your data layer.
6. `lib/types/pantry.ts` — `PantryStaple`, `StapleState`.
7. `lib/theme/` — theme lives in a folder, not a single file. Read `lib/theme/ThemeContext.tsx` (hook exposing current theme) and `lib/theme/index.ts` (token exports). Use existing color tokens; don't invent new ones. First audit caught "constants/theme.ts" as wrong path.
8. `contexts/SpaceContext.tsx` — exports `useSpace`, `useActiveSpaceId`, `useSpacePermissions` hooks. First audit caught "lib/hooks/useActiveSpace.ts" as wrong path.
9. `docs/DOC_MAINTENANCE_PROCESS.md` Section 8 — canonical SESSION_LOG entry format.
10. `docs/PK_CODE_SNAPSHOTS.md` — check before writing SESSION_LOG (Rule E).

---

## Task

Add a staples section to PantryScreen at the top, above the Expiring Soon banner and Pantry shelf. Create new components for the grid and cells.

### Component structure

```
screens/PantryScreen.tsx (parent — adds StaplesGrid rendering, owns data loading)
  ├── components/pantry/StaplesGrid.tsx (container — grid layout, "See all" footer)
  │   └── components/pantry/StapleCell.tsx (single cell — dot tap zone + label tap zone)
```

### `StaplesGrid.tsx`

Props:
```typescript
interface StaplesGridProps {
  spaceId: string;
  onStapleLabelTap: (staple: PantryStaple) => void;  // opens ingredient detail (stubbed in this CP)
  onSeeAllTap: () => void;
  onAddNewTap: () => void;
}
```

Behavior:
- On mount + on `spaceId` change: loads staples via `getStaplesBySpace(spaceId)`
- Renders a 2-column grid of `StapleCell` components
- Shows at most 8 cells; if more exist, the 8th slot shows "+ N more" styled like an unknown cell with tap → `onSeeAllTap`
- Below the grid: centered footer row "See all N staples · Add new" (both tap targets — split `onSeeAllTap` / `onAddNewTap`)
- Section header above the grid: "STAPLES" in section-label style (uppercase, 12px, letter-spaced, secondary color) with right-aligned hint text "tap dot · tap label" in section-hint style
- Empty state: if no staples, render instructional empty-state card — "Add your first staple" button that routes to `onAddNewTap`
- Loading state: match PantryScreen's convention (skeleton or hide-until-loaded)
- **Optimistic updates:** when `StapleCell` cycles state, reflect the new state immediately without waiting for refetch. Use local state copy of `staples` array + update on cycle.
- **Re-sort on state change:** after state update, re-sort array via state-priority rule (out → running_low → good → unknown, alphabetical within). Instant re-render is acceptable — animation is nice-to-have but not required for v1.

### `StapleCell.tsx`

Props:
```typescript
interface StapleCellProps {
  staple: PantryStaple & { ingredient_name?: string | null };
  onLabelTap: () => void;
  onCycleComplete: (updated: PantryStaple) => void;
  // Called with the updated staple after the service call succeeds.
  // Parent uses this to update its local state array.
}
```

**Layout (matches v5 wireframe):**
- Cell container: 8px padding, rounded 8px, space-between flex row
- Label on left (flex 1): tap target opens ingredient detail
- Dot tap zone on right: **28-32px minimum touch target** (for iOS 44pt guideline compliance within the row's overall touch area), contains the colored dot
- Display name from `getStapleDisplayName(staple)` — helper from pantryStaplesService
- Label text format:
  - Good: just the name
  - Low: `{name} · low`
  - Out: `{name} · out` (label weight 500)
  - Unknown: just the name (italic, tertiary color)

**State styling (match wireframe — use existing theme tokens, adapt if exact tokens don't exist):**
- `good`: subtle background (use `colors.background.tertiary` or equivalent), dot uses success green (`functionalColors.success`)
- `running_low`: soft tint (success-warning mix, look up existing warning-tinted backgrounds in app for reference), border-left 2px accent, dot uses warning amber, label color warning-dark, label weight 500
- `out`: soft red tint (red-tinted background if a token exists; otherwise warning-heavy or a new minimal token), border-left 2px red accent, dot uses error red, label color error-dark, label weight 500
- `unknown`: transparent background, border 0.5px dashed with strong border color, dot empty/outlined (no fill, 1px dashed border), label italic, tertiary color

**Tap behavior:**
- **Dot tap zone:** calls `cycleStapleState(staple.id)`, catches errors, on success calls `onCycleComplete(updated)`. Shows brief toast: "{name} → {newState}" (use existing toast pattern from elsewhere in the app).
- **Label tap zone:** calls `onLabelTap()`. Parent decides what that means (in this CP, parent stubs with Alert.alert).
- Don't propagate tap events across the two zones. Use `event.stopPropagation` if needed.

**Accessibility (required for this CP):**
- Dot tap zone: `accessibilityLabel="Cycle {name} state — currently {state}"`, `accessibilityRole="button"`, minimum 44×44pt hit target (can use `hitSlop` to extend beyond visual dot)
- Label tap zone: `accessibilityLabel="Open {name} details"`, `accessibilityRole="button"`, minimum 44×44pt hit target

### `PantryScreen.tsx` changes

1. Add `activeSpaceId` usage if not already present (should be — SpaceSwitcher relies on it). Import `useActiveSpaceId` from `contexts/SpaceContext` (confirmed path; first audit caught incorrect `lib/hooks/useActiveSpace.ts`).
2. Render `<StaplesGrid />` between the SpaceSwitcher/header area and the Expiring Soon banner. Section padding matches other sections (16px horizontal, 14px bottom).
3. Wire the three callbacks:
   - `onStapleLabelTap={(staple) => { /* TODO (8C-CP5): navigation.navigate('IngredientDetail', { ingredientId: staple.ingredient_id, customName: staple.custom_name }); */ Alert.alert('Ingredient Detail', 'Coming in 8C-CP5'); }}`
   - `onSeeAllTap={() => Alert.alert('Manage Staples', 'Coming in 8B-CP3')}`
   - `onAddNewTap={() => Alert.alert('Add Staple', 'Coming in 8B-CP3')}`
4. **Do NOT change** the rest of the screen. The 2-option Family/Storage view toggle stays as-is (8A-CP2 will extend it to 3 options in a separate checkpoint — not here). Expiring Soon banner stays. Category accordion stays. FAB stays.
5. Update pull-to-refresh to also reload staples (add `getStaplesBySpace` call to the refresh handler or pass a ref down into StaplesGrid to trigger its internal refresh).

### Reusable patterns to follow

- **Space-aware data loading** — `StaplesGrid` re-loads when `spaceId` prop changes. PantryScreen re-renders on space switch via existing context pattern.
- **Optimistic UI** — cycle state on the cell immediately, reconcile with service result. If service errors, revert + toast the error.
- **Toast on state change** — don't block UI. Fire and forget.
- **Re-sort after cycle** — state changes shift positions; intentional, not a bug.

---

## Constraints

1. **UI only.** No service changes, no schema changes. Consumes `pantryStaplesService.ts` from 8B-CP1 as-is.
2. **Preserve existing PantryScreen behavior.** Smoke-test: every existing feature (SpaceSwitcher, 2-option view toggle, Expiring Soon, accordion, FAB, legend) still works after the change.
3. **No routing changes.** Ingredient Detail / Manage Staples / Add Staple stubs use `Alert.alert` — don't add navigation stack entries for screens that don't exist yet.
4. **Reuse existing design tokens.** Read `lib/theme/index.ts` and `lib/theme/ThemeContext.tsx` to find available tokens. If the wireframe references a visual treatment (e.g., soft amber tint) that maps to an existing token, use it. If the closest existing token is clearly inadequate, flag in SESSION_LOG — don't invent new top-level tokens without discussion.
5. **Match existing component file conventions.** Named exports, StyleSheet at bottom, typed props, functional components with hooks.
6. **Keep `StapleCell` under ~150 lines.** Keep `StaplesGrid` under ~200 lines.
7. **No new dependencies.** Use React Native primitives + existing icons/tokens.
8. **Handle the no-staples case.** Empty-state card with "Add your first staple" button. Don't leave a blank gap.
9. **Don't introduce the 3-option view toggle yet** (Category/Storage/Expiry). That's 8A-CP2 scope.
10. **Don't move or restyle the Expiring Soon banner.** Staples go ABOVE it. Banner stays exactly where it is.
11. **Accessibility verification (required):** All new tap targets ≥44×44pt effective (use hitSlop where visual target is smaller). All new interactive elements have accessibilityLabel and accessibilityRole.
12. **PK snapshot staleness check (Rule E).** Before writing SESSION_LOG, run Rule E check against `docs/PK_CODE_SNAPSHOTS.md` for `screens/PantryScreen.tsx` (likely tier-1). Refresh or flag.
13. **Session log format: canonical only.** Write SESSION_LOG entry per canonical format in `docs/DOC_MAINTENANCE_PROCESS.md` Section 8. Required fields as specified in 8A-CP1.

---

## Verification steps

1. **TypeScript compiles clean.** `npx tsc --noEmit` exits 0.
2. **Visual smoke test on-device or simulator:**
   - PantryScreen loads without errors when 0 staples exist → empty state shows
   - Add a staple manually via Supabase dashboard (ingredient_id + space_id + state='unknown') → it appears on refresh
   - Unknown staple renders with dashed border + italic label + empty dot
   - Tapping dot on unknown → confirms to good (solid green dot, normal label, subtle background), toast shows
   - Tapping dot on good → running_low (amber tint + border-left, amber dot, label color + weight change, text shows "· low")
   - Tapping dot on running_low → out (red tint + border-left, red dot, label weight 500, shows "· out")
   - Tapping dot on out → good (back to green)
   - Tapping label (not dot) → Alert appears ("Ingredient Detail coming in 8C-CP5")
   - "See all N · Add new" footer shows below grid, both tap zones work
3. **Sort behavior:** manually create 4 staples (one in each state). Observe: out, running_low, good, unknown order. Alphabetical within each group.
4. **Space switching:** switch spaces via SpaceSwitcher → staples re-load for new space. Previous space's staples don't leak through.
5. **No regressions in existing PantryScreen features:**
   - SpaceSwitcher still works
   - 2-option view toggle still works
   - Expiring Soon banner still renders when applicable
   - Accordion expand/collapse still works at all 3 levels
   - FAB still opens Add Item flow
   - Pull-to-refresh still works and now also refreshes staples
6. **Tap zone separation:** tap label ≠ tap dot. Test repeatedly at zone boundaries. Dot tap should have effective 44×44pt hit area via hitSlop.
7. **Unknown state UX:** a Paprika-style unknown staple is visually distinct enough that a tester immediately recognizes "oh I need to confirm that."
8. **Optimistic update smoothness:** cycling state is immediate — no perceptible lag before color/position changes. Service call completes in background.
9. **Accessibility verification:** all new tap targets ≥44×44pt effective; accessibilityLabel present on all interactive elements; VoiceOver announces state correctly.
10. **Rule E check completed.** PK snapshot refreshed or flagged.
11. **SESSION_LOG written in canonical format.**

---

## Open questions to flag

STOP and flag if you hit these:

1. **Existing color tokens don't cleanly map to wireframe visual treatment.** Wireframe uses "soft amber tint with border-left accent" / "soft red tint" — if the closest existing tokens are saturated (not soft), map to the closest available and note mapping in SESSION_LOG. If no reasonable mapping exists, flag as question — don't invent tokens.
2. **Section header "STAPLES" styling reuse.** Does PantryScreen already have a section-header pattern? If so, reuse it. If not, use the closest equivalent rather than inventing a third pattern.
3. **Animation on re-sort.** React Native doesn't animate flexbox reorders natively. If instant-reorder is too jarring, log as post-F&F followup and defer. Don't reach for Reanimated for v1.
4. **Legend at bottom** — staples don't show storage-location dots. Does the legend need a note, or is it fine as-is since it applies only to the Pantry shelf section? Flag the call.
5. **Pull-to-refresh scope.** Currently onRefresh reloads `pantry_items`. Adding staples reload — simple approach: call both. Complex approach: pass a refresh handler down to StaplesGrid. Pick one and note in log.
6. **Empty state UX.** Show "Add your first staple" CTA, or hide the empty state entirely until first staple added? Default: show. Flag if you think it's wrong.

---

## What this unblocks

After this checkpoint:
- Users can manage their staples (basic cycling) end-to-end
- **8B-CP3** can build the Add/Manage Staples screen that the "Add new" and "See all" stubs point to
- **8B-CP4** can wire cook-post depletion to update staple state and reflect on the grid
- **8C-CP4** can use staple state to auto-populate grocery Now/Could wait tiers
- **8C-CP5** Ingredient Detail screen becomes the real target for label taps (replace Alert stub with navigation)
- **8D-CP3** recipe tap-sheet actions ("Mark low", "Mark out", "Actually have") call `setStapleState` with immediate visual feedback on the pantry screen

---

## Notes for the audit instance

This checkpoint is deliberately heavy on the "preserve existing functionality" side. The first big user-facing change to a screen users already use daily. Regressions here are the expensive kind. If the audit instance spots issues:
- Tap target sizes too small? Bump via hitSlop.
- Color token mappings ambiguous? Flag for discussion, don't let CC pick arbitrarily.
- Unknown state visual doesn't stand out enough? This is the core UX pattern for Paprika-case — bolder treatment is fine.
- Ingredient Detail stub using Alert.alert feels cheap? That's fine for this CP; 8C-CP5 replaces it with real navigation in ~1 line of code.

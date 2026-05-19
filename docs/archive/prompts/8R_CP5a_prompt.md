# CC Prompt — Phase 8R-CP5a: Views/Needs UX — View Infrastructure

**Phase:** 8R-CP5a (screens-only rewrite — Lists home + View detail + view creator/edit modal + per-view render modes)
**Predecessor:** 8R-CP4.6 (highlightsService stub + pantryHelpers deletion). Last live pantry-era import (`setStapleState` in `screens/GroceryListDetailScreen.tsx`) gets cleaned up here.
**Successor:** 8R-CP5b (AddNeedSheet + Expanded Regulars sheet + cross-screen wiring). CP5a explicitly stubs the interactive surfaces CP5b will own.

---

## Context

Phase 8R replaces the lists-as-containers model with **views over a unified needs+supplies bag**. Schema + service layer + types are live (CP1, CP2a, CP2b shipped 2026-04-29 → 2026-04-30). Cook-flow + supplies UX are rewired (CP3, CP4 shipped 2026-04-30). Dead code purged (CP4.5, CP4.6).

**This CP rewrites three screens against the new model:**

1. `screens/GroceryListsScreen.tsx` → **ViewsScreen** (wireframe Tab 1 — default views + custom views as cards)
2. `screens/GroceryListDetailScreen.tsx` → **ViewDetailScreen** (wireframe Tabs 2-3 — needs filtered by view predicates, render modes Tier/Aisle/Flat)
3. New view creator/edit modal (wireframe Tab 4 Variants A/B/C — opened from Lists home + ⋯ on detail)

**This CP also:**

- Deletes `components/InlineQuantityPicker.tsx` (orphan flagged in CP4.6 — 0 consumers)
- Removes the last live pantry-era import (`setStapleState` from deleted `pantryStaplesService` at `GroceryListDetailScreen.tsx:43,839,1119`)
- Removes old `groceryListsService` imports from `GroceryListsScreen.tsx`
- Stubs the "+ Add need" bottom bar → `Alert` ("Coming in CP5b")
- Stubs "Open ▸" on collapsed Regulars strip → `Alert` ("Coming in CP5b")
- Stubs ⋯ menu's "Edit view" / "Delete view" actions → wired to viewsService (real); but new-view creation IS implemented (so Lists home is functional end-to-end)

**This CP does NOT touch:**

- `components/AddGroceryItemModal.tsx` (CP5b — replaced by AddNeedSheet)
- `components/QuickAddSection.tsx` (CP5b — likely deleted, decision deferred)
- Spawn-on-out toast (Tab 9, deferred to CP6)
- Supply create flow (Tab 12, deferred to CP6)
- Edit-need modal (Tab 9, deferred to CP6)

The collapsed Regulars strip itself IS rendered (with status counts) — only the "Open ▸" expansion is stubbed.

---

## Inputs to read

1. `docs/PHASE_8R_UNIFIED_NEEDS.md` (v0.4) — full decisions log, especially D8R-Q2, Q5, Q11, Q16, Q19, Q20, Q21, Q25, Q28, Q29, Q32, Q36, Q37, Q42, Q49, Q50.
2. `docs/wireframes/phase_8r/phase_8r_wireframes_README.md` — tab→checkpoint mapping; CP5a is Tabs 1, 2, 3, 4.
3. `docs/wireframes/phase_8r/phase_8r_wireframes_v3.html` — Tab 1 (Lists home), Tab 2 (View detail Variants A/B/C), Tab 3 (View detail with implicit filter), Tab 4 (View creator Variants A/B/C). Tabs 10/11/12/9 are CP5b/CP6 scope — read for context but do NOT implement.
4. `docs/SESSION_LOG.md` — most recent CP entries (CP2b for service layer, CP3 for cook-flow, CP4 for supplies UX, CP4.5/4.6 for dead code).
5. `lib/services/viewsService.ts` — all functions you'll consume.
6. `lib/services/needsService.ts` — `getNeedsForView`, `mergeNeedsForDisplay`, `cycleNeedStatus`.
7. `lib/services/suppliesService.ts` — `getSuppliesForSpace` (for Regulars strip status counts).
8. `lib/services/tagsService.ts` — `getTagsForSpace`, `getOrCreateTag`, `setNeedTags` (used in view creator's tag picker).
9. `lib/types/views.ts` — `View`, `ViewWithFilters`, `ViewFilter`, `ViewFilterDimension`, `RenderMode`, `CreateViewParams`, `UpdateViewParams`, `ViewFilterInput`.
10. `lib/types/needs.ts` — `Need`, `NeedWithDetails`, `MergedNeedGroup`, `NeedStatus`.
11. `lib/types/supplies.ts` — `Supply`, `SupplyWithTags`, `SupplyStatus`.
12. `lib/types/tags.ts` — `Tag`, `TagDimension`.
13. `screens/PantryScreen.tsx` (post-CP4) — reference for SpaceContext usage + activeSpaceId pattern.
14. `screens/ManageSuppliesScreen.tsx` (post-CP4) — reference for search bar + autocomplete pattern (similar UI affordances will appear in view creator's tag picker).
15. `App.tsx` — current `GroceryStackParamList` (route names + params will need updates; `GroceryLists` → `Views`, `GroceryListDetail` → `ViewDetail`).

---

## Task

### Part 1 — Rewrite `screens/GroceryListsScreen.tsx` → `ViewsScreen`

**Reference:** Wireframe Tab 1.

Delete the entire current file content. The new file:

- Renames the default export to `ViewsScreen`. (Filename can stay `GroceryListsScreen.tsx` for this CP; rename in CP5b or CP6 to avoid touching navigation refs in two CPs.)
- Top header: title "Lists" (per Q2), subtitle showing total view count.
- Body: vertical list of view cards.
  - **Default views first** (4 of them, in seeded sort order): Tonight, This week, All needs, In cart. Each card:
    - Emoji + name (e.g., 🌙 Tonight)
    - Subtitle = filter rule (per Q19). Format: `"urgency: today"` for single-dimension; `"urgency: today, this-week"` for multi-value; AND-joined across dimensions. For "All needs" subtitle reads `"status: need"` per Q49.
    - Right-side count badge: number of needs matching the view (call `needsService.getNeedsForView(viewId)` then count after `mergeNeedsForDisplay`).
    - Tap → `navigation.navigate('ViewDetail', { viewId })`.
    - Long-press → reveal "Hide" action (defaults are non-deletable but hidable per Q19). Hidden defaults disappear from list but reappear via a "Show hidden" footer toggle.
  - **Custom views below defaults**, in user-set sort_order. Each card same shape but:
    - Long-press → reveal "Edit" + "Delete". "Delete" calls `viewsService.deleteView(viewId)` (which catches `DefaultViewDeleteError` for safety; defaults won't reach this branch).
    - Tap "Edit" → opens View Creator modal (Part 3) in edit mode.
- Bottom: "+ New view" button → opens View Creator modal in create mode.
- Show hidden toggle: footer link "Show N hidden views" / "Hide" — toggles whether hidden defaults render. State is screen-local; not persisted.
- Pull-to-refresh: re-fetches views + recounts.
- Empty state (custom views): not applicable since 4 defaults always render.

**Implementation notes:**

- Use `useActiveSpaceId()` from SpaceContext.
- Load via `viewsService.getViewsForSpace(spaceId)` — returns `ViewWithFilters[]`.
- Counts via parallel `Promise.all` of `needsService.getNeedsForView(viewId)` per view; reduce via `mergeNeedsForDisplay` then `.length`.
  > Note: this is N+1 by design — at F&F scale (4-7 views per space) it's negligible. If view count grows post-launch, consider a `getViewCountsForSpace(spaceId)` aggregate RPC. Add a one-line comment in the code flagging it as an optimization candidate.
- Loading state: show skeletons or spinner; do not block.
- Error state: toast + retry; do not show empty list.
- Remove ALL imports from `lib/groceryListsService` (deleted in CP2b).
- Remove ALL imports from `lib/groceryService` (deleted in CP2b).
- Remove ALL imports from `lib/types/grocery.ts` (still exists for now, but CP6 will delete it).

### Part 2 — Rewrite `screens/GroceryListDetailScreen.tsx` → `ViewDetailScreen`

**Reference:** Wireframe Tab 2 (Variants A = Tier, B = Aisle, C = Flat) + Tab 3 (implicit filter chip when view has explicit filter dimension).

Delete the entire current file content. The new file:

- Header: emoji + view name + back button + ⋯ menu.
  - ⋯ menu actions: "Edit view" (default views: disabled with tooltip "Default views can't be edited" — D8R-Q19), "Delete view" (default views: hidden), "Hide view" (default views only).
  - Edit/Delete wired to viewsService; Hide calls `viewsService.toggleViewHidden(viewId)` then navigates back.
- Sub-header row: render mode toggle (3 segmented buttons: Tier / Aisle / Flat). Selected mode persisted via `viewsService.setViewRenderMode(viewId, mode)` on tap; loaded from `view.render_mode`.
- Filter chip row (Tab 3): renders ONLY if view has at least one explicit filter dimension (urgency, store, recipe, etc.). Format: chip per dimension showing `"urgency: today"` etc. Chips are read-only in CP5a (no remove-chip-to-broaden affordance). Background subtitle below chips: count of merged needs.
- **Collapsed Regulars strip** (per Q20):
  - Always rendered (never collapsed-into-nothing).
  - One-line format: `Regulars · {N} out · {N} low · {N} in stock · Open ▸`
  - Counts derived from `suppliesService.getSuppliesForSpace(spaceId)` filtered to supplies whose tags match the current view's tags (intersection — same predicate engine as needs filter, applied to supply tags).
  - Tap "Open ▸" → `Alert.alert('Regulars', 'Coming in CP5b')` (stub).
- **Body: rendered needs**, filtered + merged + grouped per render mode.
  - Load via `needsService.getNeedsForView(viewId)` → `NeedWithDetails[]`.
  - Apply `needsService.mergeNeedsForDisplay(needs)` → `MergedNeedGroup[]`.
  - **Tier mode** (default for non-aisle-friendly views): group by `urgency` tag value. Order: today → this-week → this-month → no-urgency. Section headers: "Today", "This week", "This month", "No urgency". If view's filter narrows to a single urgency value, that section is the only one rendered (others empty-suppress).
  - **Aisle mode** (per Q29 — render mode, NOT tag dimension): group by `ingredient.typical_store_section`. Section headers: title-cased section name (e.g., "Produce", "Dairy", "Pantry"). Custom-named needs (where `ingredient_id` is null) bucket into a "Other" section. Within each section, sort alphabetically by display name.
  - **Flat mode**: single ungrouped list, sorted alphabetically by display name.
- Each rendered need row:
  - Display name: `getNeedDisplayName(merged)` (use the helper).
  - Quantity + unit: from `merged.quantity_display + ' ' + merged.unit_display` if both present; else hide quantity.
  - Status indicator: dot (need=hollow circle; in_cart=filled circle with checkmark; acquired=filled checkmark, dimmed).
  - Tap row → `needsService.cycleNeedStatus(needId)` (cycles need → in_cart → acquired; acquired is terminal per Q50). Optimistic update. On error: revert + toast.
  - Recipe attribution (if any): subtle subtitle "From {N} recipes" (count from `merged.recipes.length`). Tap → no-op in CP5a (recipe chip filter is CP6).
  - Tag chips: if view's filter context implies tags, do NOT show those tags on the row (they're guaranteed). Show non-implied tags as small chips below the name (max 2 visible, "+N" overflow).
- Bottom bar: "+ Add need" button (full-width).
  - Tap → `Alert.alert('Add need', 'Coming in CP5b')` (stub).

**Implementation notes:**

- Use `useActiveSpaceId()` from SpaceContext.
- Hydrate view via `viewsService.getViewById(viewId)` for filter context + render_mode + emoji + name.
- Hydrate needs via `needsService.getNeedsForView(viewId)`.
- Hydrate supplies for Regulars strip via `suppliesService.getSuppliesForSpace(spaceId)`. Filter to supplies whose tags overlap the view's tag filters (use existing tag-matching predicate from needsService internals; if not exposed, replicate the logic — flag in SESSION_LOG).
- All three load in parallel via `Promise.all`.
- Use `useFocusEffect` to refetch on focus (parallel to PantryScreen).
- **REMOVE** `import { setStapleState } from '../lib/pantryStaplesService'` at line 43 — this is the last live pantry-era import in the codebase.
- **REMOVE** the ParamList row reference to old grocery list params; new ParamList expects `{ viewId: string }`.
- Verify by grep that this file has zero references to `groceryListsService`, `groceryService`, or `pantryStaplesService` post-rewrite.

### Part 3 — New View Creator/Edit Modal

**Reference:** Wireframe Tab 4 Variants A/B/C.

Create new file: `components/ViewCreatorModal.tsx`.

Modal sheet from bottom (use existing modal primitives from `components/QuickAddSection.tsx` or similar — flag if no shared primitive available). Two modes: **create** and **edit**.

**Header:** "New list" or "Edit list" (per Q2 — UI says "list" not "view"). Cancel + Save buttons.

**Body fields:**

- Name (text input, required).
- Emoji picker (single emoji slot — tap opens emoji picker; default 📋).
- **Filter section** — accordion or tabbed UI per Q16 (AND across dimensions, multi-value within dimension):
  - **Status** (default `['need']` per Q49 + Q32). Multi-select chips: need / in_cart / acquired. CP5a default behavior: pre-selected to `['need']`. User can multi-select.
  - **Urgency** (tag dimension). Multi-select from existing tags-of-dimension via `tagsService.getTagsForSpace(spaceId, 'urgency')`. Plus "+ Add new" inline → creates via `tagsService.getOrCreateTag(spaceId, 'urgency', value, userId)`.
  - **Store** — same pattern, `dimension='store'`.
  - **Recipe** — same pattern, `dimension='recipe'`.
  - **For-user** — multi-select from space members. Empty = "Everyone" (per Q37).
- **Render mode** — segmented (Tier/Aisle/Flat). Default: Tier.
- **Sort order** — number input (defaults to next available; users rarely touch this).

**Footer:** Save button.

**Save behavior:**

- Create mode: `viewsService.createView(params)` — `CreateViewParams` already includes `filters: ViewFilterInput[]`, so a single call covers view + filters atomically. Pass `is_default: false`, `is_hidden: false`, `created_by: userId`, `space_id: activeSpaceId`, `filters: [...]`.
- Edit mode: `viewsService.updateView(viewId, params)` for view fields + `viewsService.updateViewFilters(viewId, filterInputs)` for filter dimensions (two calls — the filter table is replace-all). Default views: `is_default` should be display-only (locked); allow renaming/emoji/render-mode editing per Q19's "non-deletable but hidable" — Tom's call whether full edit is allowed on defaults. **Flag in SESSION_LOG: do default views allow filter editing?** My read of Q19 is no (defaults are immutable except hide/show); CP5a should disable filter edits on defaults.
- Validation: name required, at least one filter dimension OR status filter set (otherwise the view is a no-op).
- On success: close modal + refresh parent screen (Lists home or View detail).
- On error: toast + keep modal open.

### Part 4 — Delete `components/InlineQuantityPicker.tsx`

Per CP4.6 SESSION_LOG, this file is a sibling pattern to `InlineExpirationPicker` (deleted in CP4.6) — orphaned (0 consumers verified by grep). Delete via plain `rm` (not in PK snapshot tables) or `git rm` (if tracked).

```bash
git ls-files --error-unmatch components/InlineQuantityPicker.tsx
```

If tracked: `git rm components/InlineQuantityPicker.tsx`. If untracked: `rm components/InlineQuantityPicker.tsx`.

### Part 5 — Update navigation params in `App.tsx`

Update `GroceryStackParamList` type definition:

- `GroceryLists` route stays (for backward-compat; consider rename in CP5b or CP6 to avoid touching nav refs in two CPs).
- `GroceryListDetail: { listId: string }` → `GroceryListDetail: { viewId: string }`. (Param name change; route name stays for now.)

Update Screen registrations to import the new screen names if you renamed exports.

Verify no other files reference the old `listId` param via grep:

```bash
grep -rn "listId" --include="*.ts" --include="*.tsx" screens/ components/ lib/
```

Replace any `listId` references in nav callers with `viewId`. Most likely call sites: PantryScreen (if it links to lists), FeedScreen (unlikely), highlightsService (no UI).

---

## Constraints

1. **DO NOT** touch `components/AddGroceryItemModal.tsx`, `components/QuickAddSection.tsx`, supply-create flow (Tab 12), spawn-on-out toast (Tab 9), or edit-need modal (Tab 9). All deferred to CP5b or CP6.
2. **DO NOT** delete `lib/types/grocery.ts` — still has live consumers (e.g., GroceryListItem used elsewhere). CP6 cleans it up.
3. **DO NOT** modify any service file (`viewsService.ts`, `needsService.ts`, `suppliesService.ts`, `tagsService.ts`). Service layer is frozen at CP2a/2b ship.
4. **DO NOT** re-seed default views — they're already in DB (4 per space, seeded by `seedDefaultViews` RPC at space creation).
5. **DO NOT** invent new tag dimensions. The set is fixed: urgency, store, recipe, for-user (per types/tags.ts `TagDimension`). Aisle is render-mode-only (Q29).
6. **DO NOT** rename files in this CP if it requires updating navigation refs (e.g., don't rename `GroceryListsScreen.tsx` → `ViewsScreen.tsx`). The export name change is sufficient; full rename happens in CP5b or CP6.
7. **DO NOT** implement spawn-on-out toast handling. The supplies service handles spawn server-side; the UI toast is CP6.
8. **DO NOT** add new routes to navigation. The two existing routes (Lists, ListDetail) cover CP5a's surfaces. New routes (e.g., RegularsExpanded) come in CP5b.
9. **DO NOT** bump versions on living docs (`PHASE_8R_UNIFIED_NEEDS.md`, etc.) unless explicitly authorized. Per Standing Rule A.
10. **TARGET LINE COUNTS** (soft, ~20-30% tolerance — heavy components):
    - ViewsScreen: ~250-300 lines
    - ViewDetailScreen: ~550-650 lines (the heaviest file; render-mode logic + Regulars strip + filter chips + need rows + ⋯ menu + status cycling)
    - ViewCreatorModal: ~350-450 lines
    - Total new code: ~1150-1400 lines. Flag if substantially over (e.g., >1700).

---

## Verification (run after edits)

1. `npx tsc --noEmit -p tsconfig.json` — confirm zero new errors. Baseline is 181 (179 in `node_modules/@react-navigation/core` parse-error cascade + 2 pre-existing project errors at `CookSoonSection.tsx:264` and `DayMealsModal.tsx:296`). Post-CP5a should also be 181. Any TS2307 ("Cannot find module") errors are real and need fixing.
2. `grep -rn "from.*pantryStaplesService" screens/ components/ lib/ --include="*.ts" --include="*.tsx"` — must return 0 matches. CP5a closes the last live pantry-era import.
3. `grep -rn "from.*groceryListsService" screens/ components/ lib/ --include="*.ts" --include="*.tsx"` — must return 0 matches.
4. `grep -rn "from.*groceryService" screens/ components/ lib/ --include="*.ts" --include="*.tsx"` — must return 0 matches (this was deleted in CP2b but old refs may have lingered if CP3/CP4 missed any).
5. `ls components/InlineQuantityPicker.tsx 2>&1` — should print "No such file or directory."
6. Navigation params: `grep -rn "listId:" screens/ components/ App.tsx` — should return 0 matches in active code (only doc/comment references allowed).
7. Smoke-test plan (deferred to Tom — code-only verification this session):
   - **Lists home loads** — 4 default views render with correct emoji + counts.
   - **Tap Tonight** — opens ViewDetail; needs filtered to urgency=today.
   - **Render mode toggle** — switch Tier ↔ Aisle ↔ Flat; persists across navigation away+back.
   - **Default view edit blocked** — ⋯ menu's "Edit view" disabled on Tonight/This week/All needs/In cart.
   - **Hide default + show hidden** — hide "In cart" → disappears from Lists home → tap "Show hidden" → reappears.
   - **Create custom view** — "+ New view" → modal → set name "Costco" + store=Costco + render=Aisle + status=need → Save → appears on Lists home → tap → ViewDetail filters to needs with store=Costco tag.
   - **Delete custom view** — long-press Costco → Delete → confirmation → removed from Lists home.
   - **Edit custom view** — long-press → Edit → modal pre-populated → change emoji → Save → reflected on Lists home.
   - **Regulars strip** — counts match supplies in space matching view's tags.
   - **"+ Add need" stub** — taps fire `Alert.alert('Add need', 'Coming in CP5b')`.
   - **"Open ▸" stub** — tap fires `Alert.alert('Regulars', 'Coming in CP5b')`.
   - **Status cycle** — tap need row → cycles need → in_cart → acquired (terminal). Re-render reflects.
   - **Custom item rendering in Aisle mode** — needs with `ingredient_id=null` bucket into "Other" section.

---

## Open questions to flag (per Rule D — STOP and report, don't improvise)

- **Q1: Filter edits on default views.** My read of D8R-Q19 ("defaults non-deletable but hidable") implies default views' FILTERS are immutable too — only render_mode + hide/show are user-editable. CP5a disables filter edits on defaults. **Flag if Tom intends defaults to allow filter edits.**
- **Q2: Modal vs full-screen for view creator.** Tab 4 wireframe Variants suggest bottom sheet. If existing project precedent (e.g., AddRecipeToNeedsModal) uses bottom-sheet pattern, follow that. **Flag if no existing pattern matches.**
- **Q3: Tag-matching predicate for Regulars strip filtering.** ViewDetailScreen needs to filter supplies whose tags overlap the view's filter. needsService has the tag-matching logic in `getNeedsForView` (per Q42). If that logic isn't exposed as a pure helper, replicate it client-side OR add a temporary inline JS predicate. **Flag the choice in SESSION_LOG.**
- **Q4: Sort order for custom views on Lists home.** Defaults are first (in seeded sort_order). Custom views: by user-set sort_order, then alphabetical, then created_at? Not specified in any Q. Default to user-set sort_order ASC, then created_at DESC. **Flag for Tom's confirmation.**
- **Q5: ⋯ menu primitive.** Use existing `Alert.alert` action sheet pattern, or import a sheet primitive? **Flag in SESSION_LOG which approach you took.**
- **Q6: PK snapshot staleness.** Per Rule E, edited files in PK snapshot tables get HIGH-flagged. Files affected:
  - `screens/GroceryListsScreen.tsx` (tracked, was bumped HIGH in 8C-Shared-CP2 — CP5a likely keeps HIGH)
  - `screens/GroceryListDetailScreen.tsx` (tracked, was bumped HIGH in 8C-Shared-CP2b — CP5a keeps HIGH)
  - `components/ViewCreatorModal.tsx` (NEW — needs deliberate tier assignment per Rule E, NOT mechanical)
  - Update `docs/PK_CODE_SNAPSHOTS.md` accordingly. Defer ViewCreatorModal tier assignment to Tom (Tier 3 by analogy to other modal components).

---

## SESSION_LOG entry format

Per `docs/DOC_MAINTENANCE_PROCESS.md` Section 8. Single entry. Include:

- Date + phase + status
- Files modified / created / deleted
- Function inventory (for new components)
- Verification results (per checklist above)
- Deviations from prompt (if any)
- Recommended doc updates: 4 living docs (PHASE_8R_UNIFIED_NEEDS, FRIGO_ARCHITECTURE, DEFERRED_WORK, PROJECT_CONTEXT, FF_LAUNCH_MASTER_PLAN) — even if "none" for each.
- Recommended next steps for Tom
- Surprises / Notes for Claude.ai

Tracker rows per `docs/TRACKER_SPEC.md` for each modified/created/deleted file.

---

## Recommended commit message (when smoke test passes)

```
git commit -m "feat(views): Phase 8R-CP5a — Views screens + view creator modal + render modes; closes pantry-era imports" -- screens/GroceryListsScreen.tsx screens/GroceryListDetailScreen.tsx components/ViewCreatorModal.tsx components/InlineQuantityPicker.tsx App.tsx docs/PK_CODE_SNAPSHOTS.md docs/SESSION_LOG.md
```

(Adjust path list based on actual files touched; `components/InlineQuantityPicker.tsx` will be `D` not `M`.)

# CC Prompt — Phase 8R-CP5b: Views/Needs UX — Add-Need Sheet + Expanded Regulars

**Phase:** 8R-CP5b (interaction layer — `getNeedsForView` signature extension + AddNeedSheet + Expanded Regulars sheet + cross-screen wiring + cleanup)
**Predecessor:** 8R-CP5a (ViewsScreen + ViewDetailScreen + ViewCreatorModal + render modes). CP5a stubbed the "+ Add need" bar and "Open ▸" Regulars expansion with `Alert` placeholders. CP5a also surfaced a `NeedWithTags` vs `NeedWithDetails` shape mismatch on `getNeedsForView` — the empty-recipes synthesis at call sites is a known band-aid and Part 0 here closes it properly.
**Successor:** 8R-CP6 (integration + cleanup — supply create flow Tab 12, spawn-on-out toast Tab 9, edit-need modal Tab 9, type cleanup, navigation rename if desired).

---

## Context

CP5a delivered the views/needs structural rewrite. CP5b layers the interactive depth on top:

- **AddNeedSheet** (wireframe Tab 11) — replaces the deleted `AddGroceryItemModal`. Implements **configure-once-and-done** (D8R-Q21): autocomplete on existing supplies (fast path) + ingredients (full configure with optional "Save as regular"). Supplies-as-regulars become the operating principle.
- **ExpandedRegularsSheet** (wireframe Tab 10) — full multi-select panel for the Regulars zone. Out items pre-selected on open (D8R-Q20). Sorted out → low → in_stock with categories collapsing for in-stock.
- **Cross-screen wiring** — replaces CP5a's two `Alert.alert` stubs with real sheet opens. AddNeedSheet inherits filter context from the active view (auto-applies tags per D8R-Q11/Q24).
- **Deletion of orphaned components** — `components/AddGroceryItemModal.tsx` and `components/QuickAddSection.tsx` (decision below).

**This CP does NOT touch:**

- Supply create flow (Tab 12) — deferred to CP6. The AddNeedSheet's "Save as regular" toggle creates a supply inline using existing `suppliesService.createSupply`; the standalone Tab 12 supply-create surface is separate.
- Spawn-on-out toast (Tab 9 — ephemeral toast on supply→out transition) — deferred to CP6.
- Edit-need modal (Tab 9 — invoked from row long-press) — deferred to CP6. Until then, status cycling via tap is the only need-edit affordance.
- Tab 12's "+ Add new supply" within Expanded Regulars — stubs to `Alert.alert` ("Coming in CP6").
- Type cleanup (`lib/types/grocery.ts` deletion) — deferred to CP6.

---

## Inputs to read

1. `docs/PHASE_8R_UNIFIED_NEEDS.md` (v0.4) — focus on D8R-Q11, Q15, Q20, Q21, Q22, Q24, Q27, Q28, Q33, Q36, Q37.
2. `docs/wireframes/phase_8r/phase_8r_wireframes_README.md` — Tab 10 (Expanded Regulars), Tab 11 (Add need sheet) mappings.
3. `docs/wireframes/phase_8r/phase_8r_wireframes_v3.html` — Tab 10 + Tab 11 detailed UI. Tab 12 (supply create) is CP6 scope but read for context on the "+ Add new supply" stub destination.
4. `docs/SESSION_LOG.md` — most recent CP5a entry for any deviations from the original prompt.
5. `lib/services/needsService.ts` — `getNeedsForView` (Part 0 edits this), `createNeed`, `addNeedFromRecipe`, `setNeedTags` (used in AddNeedSheet).
6. `lib/services/suppliesService.ts` — `getSuppliesForSpace`, `getSuppliesByStatus`, `cycleSupplyStatus`, `createSupply` (used by "Save as regular" toggle), `setSupplyStatus`.
7. `lib/services/tagsService.ts` — `getTagsForSpace`, `getOrCreateTag`, `setNeedTags`, `setSupplyTags`.
8. `lib/services/viewsService.ts` — `getViewById` (for filter context inheritance).
9. `lib/types/needs.ts`, `lib/types/supplies.ts`, `lib/types/views.ts`, `lib/types/tags.ts`.
10. `screens/ViewDetailScreen` (post-CP5a) — to wire up the "+ Add need" + "Open ▸" handlers.
11. `screens/ManageSuppliesScreen.tsx` — reference for `search_ingredients` RPC + supply autocomplete pattern. AddNeedSheet's autocomplete is similar but adds a "search supplies" tier.
12. `lib/supabase.ts` — for direct `search_ingredients` RPC calls.

---

## Task

### Part 0 — Extend `needsService.getNeedsForView` to hydrate recipes

**Why:** CP5a surfaced a shape mismatch — `getNeedsForView` returns `NeedWithTags[]`, but `mergeNeedsForDisplay` (the merge predicate per D8R-Q28/Q36) requires `NeedWithDetails[]` (which adds `recipes: NeedRecipe[]`). CP5a synthesized `recipes: []` at call sites as a band-aid, causing every need row in ViewDetailScreen to display "From 0 recipes" subtitle. Part 0 closes the gap properly so AddNeedSheet, ExpandedRegularsSheet, and ViewDetailScreen all work against a consistent shape.

**Edits to `lib/services/needsService.ts`:**

1. Change `getNeedsForView` return type: `Promise<NeedWithTags[]>` → `Promise<NeedWithDetails[]>`.
2. Add second param: `includeRecipes: boolean = false` (defaults to false to preserve existing call-site semantics).
3. When `includeRecipes=false` (default): return needs with `recipes: []` populated for type compatibility — no extra DB query. Existing ViewsScreen count call site keeps working unchanged.
4. When `includeRecipes=true`: after the existing needs+tags query resolves, batch-fetch `needs_recipes` joined with `recipes` for the result set's `need.id` values. Hydrate each need's `recipes` array. One extra query for the whole batch (not N+1).
5. Verify `NeedRecipe` type shape in `lib/types/needs.ts` — should already exist from CP1 schema (junction table `needs_recipes`). If the type doesn't exist or doesn't match the join shape, **STOP and flag** (per Rule D — do not invent type definitions).

**Edits to call sites:**

1. `screens/GroceryListsScreen.tsx` (ViewsScreen) — count call. Leave as default (`includeRecipes` omitted = false). Remove the `recipes: []` synthesis shim (no longer needed since the service now returns the right shape). Net diff: ~3 lines removed.
2. `screens/GroceryListDetailScreen.tsx` (ViewDetailScreen) — body call. Change to `getNeedsForView(viewId, true)`. Remove the synthesis shim. The "From N recipes" subtitle should now show real counts for needs added from recipes (added via Phase 8C-Shared's `addNeedFromRecipe` flow).

**Implementation notes:**

- The needs_recipes table schema (from CP1): `need_id UUID FK`, `recipe_id UUID FK`, `attribution_metadata JSONB`, `added_by UUID FK`. Join to `recipes` for title.
- Use a single `.in('need_id', needIds)` query with embedded recipe relation: `supabase.from('needs_recipes').select('*, recipes(*)').in('need_id', needIds)`.
- Group results by need_id client-side, then merge into the needs array.
- F&F scale: ~5-50 needs per view → one extra query of ~10-100 rows. Negligible.

**Out of scope for Part 0:**
- Do NOT modify any other service function. The signature extension is surgical.
- Do NOT touch any other view/sheet's call to `getNeedsForView` beyond the two listed call sites (verify via grep — should only be those two; if more, flag).

### Part 1 — New `components/AddNeedSheet.tsx`

**Reference:** Wireframe Tab 11. Implements configure-once-and-done (D8R-Q21).

Bottom sheet modal. Two design tiers: **fast path** (existing supply autocomplete match) and **full configure** (new item).

**Header:** "Add to {view name}" (dynamic; falls back to "Add need" if no view context).

**Body — search input:**

- Single text input. Placeholder: "Search supplies or ingredients…"
- Live autocomplete (debounce 200ms):
  - **Tier 1: existing supplies in space** — match supply.display_name (custom_name OR ingredient.name) ILIKE `%query%`. Top 5 results. Prefix marker: 🏠 (existing supply).
  - **Tier 2: catalog ingredients** — call `supabase.rpc('search_ingredients', { query_text: query })`. Filter out ingredients that are ALREADY a supply (cross-reference Tier 1). Top 10 results. Prefix marker: 🆕 (new from catalog).
  - **Tier 3: custom name** — if query has 2+ chars and no match in Tier 1/2, surface "Add custom: '{query}'" row at bottom.

**Body — selection state changes form:**

- **Tier 1 select (existing supply)** — fast path. Show:
  - Supply name + tags (read-only).
  - Quantity input + unit dropdown (defaults: 1 + `supply.ingredient?.typical_unit` if joined ingredient exists; empty for custom-name supplies — supplies are status-only per Q15, no quantity/unit fields).
  - Submit button: "Add need" → calls `needsService.createNeed({ space_id, supply_id, ingredient_id: supply.ingredient_id, custom_name: supply.custom_name, quantity_display, unit_display, status: 'need', added_from: 'manual', added_by: userId })` + applies tags via `setNeedTags`. Tags = view's filter tags (per D8R-Q11) **unioned with** supply's tags (per D8R-Q21 — supply IS the config, view adds urgency, both sets merge onto the need). For-user-ids: inherit from supply.
- **Tier 2 select (catalog ingredient)** — full configure:
  - Ingredient name + typical unit display (read-only).
  - Quantity input + unit dropdown (default: 1 + ingredient's typical_unit).
  - Tag chips: pre-populate with view's filter tags. User can add/remove.
  - Store chip(s): pre-populate from view's store filter; user can override.
  - For-user multi-select: defaults to view's for-user filter (or empty = "Everyone" per Q37).
  - **"Save as regular" toggle** — defaults ON for Tier 2 (the user is configuring something new; they likely want it stored). When ON, on Submit: calls `suppliesService.createSupply` first, then `needsService.createNeed` with the new `supply_id`. When OFF: only creates the need (one-off purchase).
  - Submit button: "Add need" or "Add need + save as regular" (label changes based on toggle).
- **Tier 3 select (custom name)** — same as Tier 2 but `ingredient_id` is null and `custom_name` is set.
  - Same "Save as regular" toggle, defaults ON.

**Validation:**

- Quantity must be positive number OR empty (D8R-Q15 — quantity is optional in F&F).
- Tags optional.
- Submit button disabled until valid.

**Submit flow (with "Save as regular" toggle ON):**

1. Call `suppliesService.createSupply({ space_id, ingredient_id, custom_name, status: 'in_stock', for_user_ids, brands: [], added_by, notes: null })` — creates supply.
2. If supply has tags (store + custom): call `tagsService.setSupplyTags(supplyId, tagIds)`.
3. Call `needsService.createNeed({ space_id, supply_id: newSupplyId, ingredient_id, custom_name, quantity_display, unit_display, status: 'need', added_from: 'manual', added_by })`.
4. If need has tags (urgency + recipe): call `tagsService.setNeedTags(needId, tagIds)`.
5. On success: close sheet + toast "Added to {view name}" + refresh parent screen.
6. On error: show error inline; do NOT auto-close.

**Submit flow (with "Save as regular" toggle OFF, or Tier 1 fast path):**

1-4 (skip 1-2 if Tier 1; supply already exists).
5-6 same.

**Implementation notes:**

- Use `useActiveSpaceId()` from SpaceContext.
- `userId` from `supabase.auth.getUser()` once on mount.
- View context (filter tags + store + for-user defaults) passed in as props from ViewDetailScreen.
- Sheet primitive: bottom-sheet with `keyboardAvoid` (matches existing modal patterns).
- Search debounce: 200ms (matches CP2b autocomplete pattern).
- `search_ingredients` RPC signature: `(query_text TEXT)` — single param (per CP4 SESSION_LOG note).
- Cross-reference Tier 1/2: client-side filter on Tier 2 results using set of supply ingredient_ids.
- Tag chip picker: use existing tag dimensions (urgency/store/recipe). Allow inline "+ Add new tag" → calls `tagsService.getOrCreateTag`.

### Part 2 — New `components/ExpandedRegularsSheet.tsx`

**Reference:** Wireframe Tab 10. Implements expanded Regulars zone (D8R-Q20).

Bottom sheet (or full-screen modal — flag if precedent unclear). Title: "Regulars".

**Body:**

- **Section: Out** (header with count badge). All supplies with `status='out'` matching the view's tag filter. **Pre-selected on open** (D8R-Q20). Each row:
  - Display name + tags + status dot (red/error tint).
  - Checkbox toggle (selected = will create need on Submit).
- **Section: Low** (header with count badge). Supplies with `status='low'` OR `status='critical'` matching view's tags. NOT pre-selected. Same row format (amber/warning tint).
- **Section: In stock** — collapsed by default. Tap header to expand. Same row format (no tint or muted). NOT pre-selected.
- **"+ Add new supply" footer** — stubs to `Alert.alert('Add supply', 'Coming in CP6')` (Tab 12 deferred).
- **Bottom action bar:**
  - Selected count display: "{N} selected".
  - "Add to {view name}" button (full-width, disabled if 0 selected).

**Submit flow:**

For each selected supply, call `needsService.createNeed`:
- `space_id`, `supply_id: supply.id`, `ingredient_id: supply.ingredient_id`, `custom_name: supply.custom_name`, `quantity_display: null`, `unit_display: null` (per Q15 — supplies don't track quantity), `status: 'need'`, `added_from: 'manual'`, `added_by: userId`.

> ⚠️ `added_from` CHECK constraint (CP1 schema) allows ONLY `'recipe' | 'supply_spawn' | 'manual'`. Regulars-zone needs use `'manual'` (the user manually selected them). Do NOT invent a `'regulars'` value — it will throw at the DB level.
- Tags: inherit from supply (store-dimension supply_tags copied to need_tags) + view's filter tags (urgency mostly).
- For-user-ids: inherit from supply.
- Bulk: `Promise.all` for parallel writes; aggregate errors.

On success: close sheet + toast "Added N needs to {view name}" + refresh parent screen.
On any error: show error inline; do NOT auto-close (let user retry or cancel).

**Idempotency note:** Q48 spawn-on-out idempotency handles the "supply→out auto-creates need" case — but in this manual path, a user might select a supply that already has an active need. The `addNeedFromRegulars` call should check for an existing active need (status in 'need' or 'in_cart') for that supply and NO-OP if found. **Implementation: add a check in the loop OR call needsService.createNeed which already has supply_id-based dedup logic — verify the dedup is in place; if not, add inline check.** Flag in SESSION_LOG which approach you took.

### Part 3 — Wire ViewDetailScreen to the new sheets

In `screens/GroceryListDetailScreen.tsx` (post-CP5a):

- Replace the "+ Add need" `Alert.alert` stub with: open AddNeedSheet, passing the current `view` as filter context.
- Replace the "Open ▸" `Alert.alert` stub with: open ExpandedRegularsSheet, passing the current `view` as tag filter context.
- Both sheets close on success → trigger `loadNeeds()` reload to refresh the rendered list.

State management: add two booleans `addNeedSheetOpen` + `expandedRegularsSheetOpen`. Render sheets conditionally at end of JSX.

### Part 4 — Delete `components/AddGroceryItemModal.tsx` and decide on `components/QuickAddSection.tsx`

**`AddGroceryItemModal.tsx`** — replaced by AddNeedSheet. Verify 0 consumers post-CP5a:

```bash
grep -rn "AddGroceryItemModal" --include="*.ts" --include="*.tsx"
```

If 0 hits in active code: delete via `git rm` (tracked) or `rm` (untracked). Per CP2b SESSION_LOG, this file had imports from `groceryListsService` (deleted) — already runtime-broken. Removal is overdue.

**`QuickAddSection.tsx`** — was a regulars-style quick-add panel within the old GroceryListDetail. Per CP4.5 SESSION_LOG: imports from `groceryService` (deleted CP2b). 0 consumers in PK snapshots. **Recommendation: delete.** AddNeedSheet's Tier 1 (existing supply autocomplete) covers the "fast add a regular" use case more cleanly. Verify 0 consumers + delete.

**Flag in SESSION_LOG if either has unexpected consumers** — STOP and report rather than chase the dependency tree.

### Part 5 — PK_CODE_SNAPSHOTS updates

Per Rule E:

- `screens/GroceryListDetailScreen.tsx` — already HIGH from CP5a. CP5b touches it; keep HIGH.
- `components/AddNeedSheet.tsx` — NEW. Deliberate tier assignment needed (Tier 3 by analogy to other component modals — but defer to Tom).
- `components/ExpandedRegularsSheet.tsx` — NEW. Same.
- `components/AddGroceryItemModal.tsx` — DELETED. Remove row from PK_CODE_SNAPSHOTS.
- `components/QuickAddSection.tsx` — DELETED. Remove row from PK_CODE_SNAPSHOTS.

---

## Constraints

1. **DO NOT** implement spawn-on-out toast (Tab 9). The supplies service handles the spawn server-side; the UI toast is CP6.
2. **DO NOT** implement edit-need modal (Tab 9). Until CP6, status cycling via tap is the only need-edit path.
3. **DO NOT** implement supply create flow (Tab 12). The AddNeedSheet's "Save as regular" creates supplies inline; the standalone Tab 12 surface is CP6.
4. **DO NOT** modify any service file **except `needsService.ts` per Part 0** (signature extension only — no other functions touched). Service layer otherwise frozen at CP2a/2b ship.
5. **DO NOT** delete `lib/types/grocery.ts` — CP6 cleanup.
6. **DO NOT** rename screens or routes — keep navigation refs stable until CP6.
7. **DO NOT** add new tag dimensions. Set is fixed (urgency, store, recipe, for-user per `TagDimension`).
8. **DO NOT** invent new RPC functions. The only RPC used is `search_ingredients` (already shipped 2026-04-28).
9. **DO NOT** bump versions on living docs unless explicitly authorized. Per Standing Rule A.
10. **TARGET LINE COUNTS** (soft, ~20-30% tolerance — these are heavy components):
    - `needsService.getNeedsForView` extension (Part 0): +25-40 lines (signature + recipe-batch-fetch branch)
    - Call-site shim removals (ViewsScreen + ViewDetailScreen): -3 to -5 lines each
    - AddNeedSheet: ~550-600 lines (autocomplete + 3 tiers + form + submit logic + tag pickers)
    - ExpandedRegularsSheet: ~300-350 lines (3 sections + multi-select state + bulk submit)
    - ViewDetailScreen edits (sheet wiring): +50-80 lines (sheet state + handlers + 2 sheet render blocks)
    - Total new code: ~920-1080 lines. Flag if substantially over (e.g., >1300).

---

## Verification (run after edits)

1. `npx tsc --noEmit -p tsconfig.json` — confirm zero new errors. Baseline 181.
2. **Part 0 verification:**
   - `grep -n "recipes: \[\]" screens/GroceryListsScreen.tsx screens/GroceryListDetailScreen.tsx` — must return 0 matches in active code (the synthesis shims are removed). Comment-line mentions OK.
   - `grep -rn "getNeedsForView" --include="*.ts" --include="*.tsx"` — confirm only 2 call sites: ViewsScreen (default) + ViewDetailScreen (with `true`). If a third surfaces, flag.
   - Inspect `needsService.getNeedsForView` signature: `(viewId: string, includeRecipes?: boolean): Promise<NeedWithDetails[]>`.
3. `grep -rn "AddGroceryItemModal" --include="*.ts" --include="*.tsx"` — must return 0 matches.
4. `grep -rn "QuickAddSection" --include="*.ts" --include="*.tsx"` — must return 0 matches.
5. `ls components/AddGroceryItemModal.tsx components/QuickAddSection.tsx 2>&1` — both should print "No such file or directory."
6. `grep -rn "from.*groceryListsService\|from.*groceryService\|from.*pantryStaplesService" --include="*.ts" --include="*.tsx"` — must return 0 matches (full pantry/grocery-era purge complete after CP5b).
7. Smoke-test plan (deferred to Tom — code-only verification this session):
   - **Part 0 — Recipe attribution:** ViewDetail loads. Any need that was added via `addNeedFromRecipe` (Phase 8C-Shared cook flow) shows "From N recipes" subtitle with the correct count. Needs added manually show no subtitle (or "From 0 recipes" hidden when count is zero).
   - **AddNeedSheet — Tier 1 fast path:** Search "olive oil" with existing supply → autocomplete shows 🏠 row → tap → form pre-populates with supply's defaults → tap Add → need created with supply_id linked → toast → sheet closes → ViewDetail refreshes.
   - **AddNeedSheet — Tier 2 new from catalog:** Search "saffron" with no existing supply → autocomplete shows 🆕 row → tap → full configure form → tags pre-populate from view's filter → "Save as regular" toggle ON → Submit → supply + need created; supply_id linked.
   - **AddNeedSheet — Tier 3 custom:** Search "duct tape" → no catalog match → "Add custom: 'duct tape'" row → tap → full configure form → Save as regular OFF → Submit → need created with custom_name, no supply.
   - **AddNeedSheet — view context inheritance:** Open from "Tonight" view (urgency=today filter) → Tier 2 form's urgency tag chip pre-populated to "today".
   - **ExpandedRegularsSheet:** Open from ViewDetail's "Open ▸" → Out section expanded with all 3 out items pre-selected → Low section expanded, none pre-selected → In stock section collapsed → tap In stock header → expands → no items pre-selected → select 2 from Low + leave 3 from Out → "Add to {view}" → 5 needs created → toast → sheet closes.
   - **Regulars idempotency:** Open ExpandedRegularsSheet on a view where one of the Out supplies already has an active need (from prior spawn-on-out) → that supply's row skipped or no-op'd on Submit → final toast count adjusts. Verify in DB no duplicate active needs.
   - **"+ Add new supply" stub:** Tap → `Alert.alert('Add supply', 'Coming in CP6')`.
   - **Cancel paths:** AddNeedSheet's swipe-down or Cancel button → no DB writes.
   - **Smoke-test data preservation:** All 4 default views still load needs correctly post-CP5b (regression check on CP5a).

---

## Open questions to flag (per Rule D)

- **Q1: Sheet primitive choice.** AddNeedSheet is a tall form (3 tiers + autocomplete + form fields). Bottom-sheet vs full-screen modal? Bottom-sheet matches the wireframe but may be cramped on small devices. **Flag the choice in SESSION_LOG.**
- **Q2: Regulars idempotency.** ExpandedRegularsSheet bulk-submit could create duplicate needs if `needsService.createNeed` lacks supply_id-based dedup. **Verify by reading needsService.createNeed; if no dedup, add inline check OR flag for service-layer fix in CP6.**
- **Q3: Tag chip picker UX.** Multi-select chips with "+ Add new" inline — use existing component pattern OR build custom? **Flag in SESSION_LOG.**
- **Q4: For-user multi-select picker.** Same question — existing primitive OR custom? Per D8R-Q27/Q37, "Everyone" = empty array semantics need clear UX (e.g., "Default: Everyone (no specific user)" vs explicit checkbox).
- **Q5: "Save as regular" default.** My read: ON for Tier 2 (catalog) and Tier 3 (custom), since the user is configuring something new. OFF for Tier 1 (existing supply — the regular already exists). **Flag if Tom intends a different default.**
- **Q6: Cross-screen state refresh.** After AddNeedSheet/ExpandedRegularsSheet success, ViewDetail re-fetches needs. Should Lists home counts also refresh? Currently no; Lists home re-fetches on focus. **Flag if Tom wants explicit cross-screen invalidation.**
- **Q7: Quantity unit dropdown source.** AddNeedSheet's unit dropdown — pull from `measurement_units` table OR hardcoded list (cup/tsp/tbsp/g/kg/oz/lb)? Per CP4.5's UnitPicker rewrite, `measurement_units` is the source. **Use the same query pattern.**

---

## SESSION_LOG entry format

Per `docs/DOC_MAINTENANCE_PROCESS.md` Section 8. Single entry. Include all sections from CP5a's pattern.

Tracker rows per `docs/TRACKER_SPEC.md`.

---

## Recommended commit message (when smoke test passes)

```
git commit -m "feat(views): Phase 8R-CP5b — getNeedsForView recipe hydration + AddNeedSheet (configure-once-and-done) + Expanded Regulars; full pantry/grocery-era purge complete" -- lib/services/needsService.ts components/AddNeedSheet.tsx components/ExpandedRegularsSheet.tsx components/AddGroceryItemModal.tsx components/QuickAddSection.tsx screens/GroceryListsScreen.tsx screens/GroceryListDetailScreen.tsx docs/PK_CODE_SNAPSHOTS.md docs/SESSION_LOG.md
```

(`AddGroceryItemModal` + `QuickAddSection` will be `D` not `M`. Adjust if `git rm` was used.)

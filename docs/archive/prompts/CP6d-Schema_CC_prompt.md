# CC PROMPT — Phase 8R-CP6d-Schema (Services)

**Phase:** 8R-CP6d-Schema (service-layer changes following the SQL migration)
**Estimated cost:** L. ~400-600 lines net.
**Prerequisite:** Tom has run `cp6d_schema_migration.sql` in Supabase and confirmed via the included validation queries that all 5 columns exist, 3 CHECK constraints exist, 3 indexes exist, and backfill distributions look sensible.

---

## Context

Phase 8R refactored grocery + pantry into a unified-needs model. Phase 8R-CP1 through 8R-CP6c shipped between 2026-04-29 and 2026-04-30 (see `docs/SESSION_LOG.md` for per-CP history). Tom paused before smoke-testing CP6c and ran a full UX gap audit, resulting in `8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` — the canonical reference for this CP series.

This prompt covers **CP6d-Schema service-layer work**. The SQL migration has been run separately by Tom. Your job is to update the TypeScript service layer to consume the new schema and ship the behavior changes that depend on it.

The full CP6d series sequencing (per the audit doc):
1. **CP6d-Schema (this prompt)** — service-layer foundation. Must ship first.
2. CP6d-Pantry — Pantry-side UX overhaul.
3. CP6d-ViewDetail — grocery-side UX (inline-add, tap-zones, +/- qty, cart-as-section).
4. CP6d-Sheets — UnitPicker swap, ExpandedRegulars search bar.
5. CP6d-Recipe — RecipeDetailScreen dual CTAs + AddRecipeToNeedsModal rebuild.
6. CP6d-SupplyDetail — new SupplyDetailScreen + ManageSupplies deletion.

All subsequent CPs depend on this one. Land cleanly.

---

## Inputs to read

Read in this order before writing any code:

1. `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` — Decisions Locked + CP6d-Schema sections especially.
2. `lib/types/supplies.ts` — current Supply type, SupplyStatus enum, SupplyWithTags interface.
3. `lib/types/needs.ts` — Need types referenced by createNeed.
4. `lib/services/suppliesService.ts` — full file. Pay attention to `createSupply`, `setSupplyStatus`, `getSuppliesForSpace`, and the `InvalidInitialStatusError` class.
5. `lib/services/needsService.ts` — focus on `createNeed` (the dedup guard added in CP6a is the thing being softened here).
6. `lib/services/tagsService.ts` — referenced for store/urgency tag lookups in priority spawn logic.

You don't need to read screen files for this CP — services only. UI consumers come in subsequent CPs.

---

## Tasks

### Task 1 — `lib/types/supplies.ts`: extend types

Add to the `Supply` and `SupplyWithTags` interfaces:

```ts
tracking_mode: 'restock' | 'track_only';
storage_location: 'fridge' | 'freezer' | 'pantry' | 'counter' | null;
archived_at: string | null;
is_priority: boolean;
usage_level: number;  // 0-5 inclusive
```

Export a new union type:
```ts
export type TrackingMode = 'restock' | 'track_only';
export type StorageLocation = 'fridge' | 'freezer' | 'pantry' | 'counter';
```

If `StorageLocation` already exists inlined in another file (e.g., `ingredientSuggestionService.ts` from CP4.5 — check), leave the inline copy; this is the canonical export from now forward and other files can switch on their own time.

Update `CreateSupplyParams` to accept optional new fields:
```ts
export interface CreateSupplyParams {
  // ... existing fields ...
  trackingMode?: TrackingMode;     // defaults via inference
  storageLocation?: StorageLocation; // defaults via inference
  isPriority?: boolean;             // defaults to false
}
```

### Task 2 — `lib/services/suppliesService.ts`: createSupply inference

Update `createSupply` to:

1. **Infer `storageLocation`** from `ingredient.default_storage_location` if not provided. NULL if neither provided nor inferable (custom_name supplies with no ingredient_id).
2. **Infer `trackingMode`** using the inference logic:
   ```
   shelf_life = CASE storageLocation
     WHEN 'freezer' → ingredient.shelf_life_days_freezer
     WHEN 'fridge'  → ingredient.shelf_life_days_fridge
     WHEN 'pantry'  → ingredient.shelf_life_days_pantry
     WHEN 'counter' → ingredient.shelf_life_days_pantry
     ELSE → COALESCE(shelf_life_days_fridge, shelf_life_days_pantry)
   trackingMode = (shelf_life IS NOT NULL AND shelf_life < 14) ? 'track_only' : 'restock'
   ```
   Default 'restock' if no ingredient_id (custom_name supplies — user manages manually).
3. **Pass `usage_level`** derived from initial status: in_stock=5, low=2, out=0. (critical not allowed at create per Q35; preserve existing `InvalidInitialStatusError` check.)
4. **Pass `is_priority`** from `params.isPriority ?? false`.
5. **Pass `archived_at: null`** explicitly on create (just defensive).

DO NOT change Q35 status restriction. DO NOT spawn-on-out-at-create (Constraint 9 from CP6b — preserved).

### Task 3 — `lib/services/suppliesService.ts`: setSupplyStatus behavior gates

Currently `setSupplyStatus` updates status and conditionally spawns a need on `out` transition (CP3-era). Update:

1. **Update `usage_level`** alongside status. Map: in_stock → 5 (don't override 4 or 3 if already at those — only bump up if going from low/critical/out to in_stock; if already 4 or 3, preserve), low → 2, critical → 1, out → 0. Easier rule: clamp on transition.
   - Transition INTO in_stock from any lower status → set usage_level = 5 (full restock signal)
   - Transition INTO low → 2
   - Transition INTO critical → 1
   - Transition INTO out → 0
   - No transition (status didn't change) → leave usage_level alone

2. **Gate spawn-on-out on `tracking_mode`:**
   - If transitioning to `out` AND `supply.tracking_mode === 'restock'` → existing spawn behavior (createNeed with supply_id, store_tags inheritance, urgency inheritance from supply tags).
   - If transitioning to `out` AND `supply.tracking_mode === 'track_only'` → DO NOT spawn. Instead, set `archived_at = NOW()` on the supply row. Return `{ supply: <updated row with archived_at set>, spawnedNeed: null, autoArchived: true }`.

3. **Add priority spawn-on-low:**
   - If transitioning INTO `low` (i.e., previous status was in_stock or NULL, new status is low) AND `supply.is_priority === true` → fire spawn. Spawned need gets `urgency: today` tag override (regardless of supply's urgency tags).
   - Use `getOrCreateTag(spaceId, 'urgency', 'today', userId)` to ensure the tag exists.
   - Mechanism: createNeed with the supply's tag_ids EXCLUDING any urgency tag, then explicitly add the 'today' urgency tag via setNeedTags.
   - Note: priority spawn-on-low must coexist with restock spawn-on-out. A priority+restock supply going in_stock → low → out would spawn TWICE (once on low with urgency=today, once on out with default urgency). The createNeed dedup guard (Task 4) handles this — second spawn returns existing need. **Test this case explicitly.**

4. **Update `SupplyStatusResult` type** to include `autoArchived: boolean` field.

5. **Track previous status** in the function. Currently you have to fetch the row to know old status — preserve this. The transition logic needs both old and new.

### Task 4 — `lib/services/needsService.ts`: createNeed dedup softening (Gap-G41)

The current dedup guard (CP6a) blocks creation when `(supply_id, status IN ['need','in_cart'])` matches. Soften to match the **display merge predicate** (Q28):

`(supply_id, unit_display, store_tag_ids, for_user_ids, status IN ['need','in_cart'])` matches → return existing.

Implementation:
1. Fetch active needs matching `supply_id` AND `space_id` AND `status IN ['need', 'in_cart']`.
2. For each candidate, compare:
   - `unit_display === params.unit_display` (treat NULL/undefined/'' as equivalent)
   - Set of store tag IDs equal: query the candidate's tag_ids, filter to `store` dimension via tagsService.getTagsForSpace lookup, compare as Sets.
   - `for_user_ids` equal: array equality after sorting (treat NULL/undefined as `[]`).
3. If a match found: return that existing need (current behavior — log via `console.log('🔄 createNeed dedup hit (softened predicate)')`).
4. If no match: proceed with insert.

This unblocks the olive-oil scenario (small-bottle-tonight + Costco-bulk-this-week as two coexisting needs).

DO NOT remove the existing dedup. DO NOT change behavior for non-supply-linked needs.

### Task 5 — `lib/services/suppliesService.ts`: getSuppliesForSpace archived filter

Current behavior excludes archived rows by default? VERIFY before changing. If yes, no change. If no, add `WHERE archived_at IS NULL` to the default query, plus an optional `includeArchived?: boolean` param that lifts the filter.

Resurrection path needs `includeArchived: true` for the search-by-name lookup. Subsequent CP (CP6d-SupplyDetail) wires this into SupplyCreateSheet T1; this CP just exposes the param.

### Task 6 — Type re-exports

Make sure `TrackingMode`, `StorageLocation`, and the extended `Supply` shape are imported correctly across consumers. Likely consumers to verify (no logic changes needed, just imports):
- `components/pantry/SupplyRow.tsx`
- `components/pantry/SuppliesSection.tsx`
- `components/SupplyCreateSheet.tsx`
- `components/AddNeedSheet.tsx`
- `components/EditNeedSheet.tsx`
- `components/ExpandedRegularsSheet.tsx`
- `screens/PantryScreen.tsx`
- `screens/ViewDetailScreen.tsx`
- `screens/RecipeDetailScreen.tsx`

Just confirm they compile against the extended type. UI consumption of new fields lands in subsequent CPs.

---

## Constraints

- **DO NOT** modify any UI/screen/component files in this CP. Service layer only. The audit doc explicitly separates Schema (this) from Pantry/ViewDetail/etc (subsequent).
- **DO NOT** change Q35 (initial status restriction at create). Preserved.
- **DO NOT** change Constraint 9 (createSupply with status='out' does NOT spawn). Preserved.
- **DO NOT** remove the existing CP6a createNeed dedup guard — soften it, don't replace it.
- **DO NOT** change the cookDepletionService integration. CP3-era pattern stays. The fact that depletion goes through `setSupplyStatus` means it auto-inherits the new tracking_mode + priority behavior for free.
- **DO NOT** invent new schema columns or modify table definitions. The SQL migration was authoritative; all 5 columns are already present.
- **PRESERVE all existing exports.** Other modules consume `createSupply`, `setSupplyStatus`, etc. Their signatures may grow (new optional params); they must not shrink or break.

---

## Verification

After implementing, verify these scenarios manually using the Supabase dashboard or a small test script:

1. **createSupply inference works.** Create a supply for "mushrooms" without specifying tracking_mode → row should land with `tracking_mode = 'track_only'` and `storage_location = 'fridge'` (or whatever ingredient.default_storage_location says).
2. **createSupply with override works.** Create a supply for "mushrooms" with `trackingMode: 'restock'` explicitly → row should land with `tracking_mode = 'restock'` regardless of inference.
3. **setSupplyStatus spawn-on-out gates correctly.** Cycle a `track_only` supply to `out` → no need spawned, `archived_at` set. Cycle a `restock` supply to `out` → need spawned as before, `archived_at` still NULL.
4. **Priority spawn-on-low.** Create a supply with `isPriority: true`, status in_stock. Cycle to low → need spawned with `urgency: today` tag.
5. **createNeed dedup softening.** With supply S existing, create need with no unit, no store tag → success. Create another need with `unit_display: 'L'`, store tag 'Costco' → success (DOES NOT dedupe). Create third need matching the second exactly → DOES dedupe.
6. **getSuppliesForSpace filtering.** Default call → archived rows excluded. Call with `includeArchived: true` → archived rows included.

If any of these fail, fix and re-verify before moving on. **Do not trust your tests-pass message; actually walk these through against the live DB state.**

Smoke testing of UI flows is deferred to end-of-CP6d (Tom's call). Don't break what's working in the app surface — just don't trust unverified UI consumption either.

---

## SESSION_LOG entry format

Append to `docs/SESSION_LOG.md` under a new `## 2026-05-XX — 8R-CP6d-Schema — Service updates` section:

```
**Phase:** 8R-CP6d-Schema (service-layer; SQL migration ran separately)
**Prompt from:** docs/cc_prompts/CP6d-Schema_prompt.md
**Status:** ✅ Complete

**Files modified:**
- lib/types/supplies.ts (was X → now Y, +Z lines). Extended Supply / SupplyWithTags. New TrackingMode + StorageLocation exports. CreateSupplyParams extended with optional fields.
- lib/services/suppliesService.ts (was X → now Y, +Z lines). createSupply inference logic, setSupplyStatus tracking_mode gate + auto-archive + priority spawn + usage_level updates. getSuppliesForSpace gains includeArchived param.
- lib/services/needsService.ts (was X → now Y, +Z lines). createNeed dedup softened to match merge predicate.

**Notes for Claude.ai:**
- [Any deviations from the prompt — e.g., types you found already inlined elsewhere]
- [Any verification surprises — e.g., a test scenario behaved unexpectedly]
- [Anything Tom should manually verify in next session]

**Tracker rows:** [generate per docs/TRACKER_SPEC.md, 1 row per file modified]

**Open questions for Tom / next claude.ai instance:**
1. [Any decisions that came up during build that need resolution before next CP]
2. [Anything ambiguous in the prompt that you resolved by judgment]
```

Drop the SESSION_LOG file in `_pk_sync/` for Tom's manual upload to PK after the run.

# CC Prompt — CP6e-Services-b · cookDepletion rewrite + lotsService manual override

**Date:** 2026-05-06
**Author:** Claude.ai planning instance
**Type:** Service-layer rewrite + small schema add + lotsService extension
**Estimated effort:** ~1 CC session, ~500-700 lines net
**Depends on:** CP6e-Services-a SHIPPED. Verifies lotsService exports exist before starting.

---

## Context

CP6e-Services-a is complete. lotsService exists with `createLot`, `updateLot`, `archiveLot`, `getLotsForSupply`, `getLotAggregate`, `deductFromOldest`, `moveLotStorage`. suppliesService has `setSupplyTracksLots` and the `includeLots` option on read functions.

This is the SECOND of three service-layer prompts. -b reverses the existing cookDepletionService behavior per D8R-Q53:

**Current behavior (8R-CP3):** every cook event demotes supply.status one step (`in_stock → low → critical → out`) for matching ingredients, regardless of recipe scale. No quantity tracking.

**New behavior (D8R-Q53 + Q44):**
- For tracks_lots=true supplies: deduct actual recipe qty from oldest-expiring lot (cross-lot draw if needed). Status auto-flips to `out` only when total active qty=0 (Q44 from -a's _maybeAutoOutOfStock).
- For tracks_lots=false supplies: **NO-OP**. No status demote. User manages status manually.
- Reversal works against persistent record on `posts.lot_depletions` so undo survives app restart.

This prompt also adds `deductFromSpecificLots` to lotsService (was deferred from -a per planning S6 / B2 — it's the manual override path the cookDepletion rewrite consumes).

**No UI changes in -b.** Services + schema only.

**No smoke testing in -b.** Tom smoke-tests at end of full -a/-b/-c build.

---

## Inputs to read

1. **`docs/PHASE_8R_UNIFIED_NEEDS.md`** — D8R-Q44 (auto-out), Q48 (lot consume → archive), Q52 (oldest-first depletion default), Q53 (no auto-demote on cook). All v0.6 post-merge.

2. **`lib/services/cookDepletionService.ts`** — existing service. Read end-to-end. You will rewrite the internals while preserving the four exported functions: `computeDepletion`, `applyDepletion`, `rollbackDepletion`, `runPostCookDepletion`. Existing signatures stay (modulo new optional args). UI consumers will continue to work unmodified.

3. **`lib/services/lotsService.ts`** — read full module. Confirm `deductFromOldest` exists with the shape from -a. You'll be calling it. You'll also be ADDING `deductFromSpecificLots` to this file.

4. **`lib/services/suppliesService.ts`** — confirm `setSupplyStatus` is callable; confirm the `includeLots` option on `getSuppliesForSpace`. You'll use both.

5. **`lib/types/supplies.ts`** — confirm `LotDeductionResult` and `LotDeductionPlanItem` types from -a's draft. If `LotDeductionPlanItem` isn't exported yet (planning S6 deferred it to -b), add it here.

6. **`recipe_ingredients` table** — current `cookDepletionService.computeDepletion` only reads `ingredient_id`. New behavior needs `quantity_amount` and `quantity_unit` too. Verify these columns exist on `recipe_ingredients` via the schema CSVs in PK or via direct DB query if needed.

7. **`posts` table schema** — verify it has no existing `lot_depletions` column. You will add one in Task 1.

---

## Tasks — execute in order

### Task 1 — Schema migration

Create a single migration file: `docs/cp6e_services_b_schema_migration.sql`.

```sql
-- ============================================
-- FRIGO — CP6e-Services-b schema additions
-- ============================================
-- Adds the durable lot_depletions record for cook → revert support.
-- Idempotent.
-- ============================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS lot_depletions JSONB NULL;

COMMENT ON COLUMN posts.lot_depletions IS
  'D8R-Q44+Q52+Q53. Per-cook lot deduction record. Format: array of supply
   entries each containing: { supply_id, recipe_quantity, recipe_quantity_unit,
   status_before, status_after, lots_affected: [{lot_id, qty_deducted, ...,
   archived: boolean}], shortfall, shortfall_reason }. NULL when post is not a
   cook OR cook had no tracks_lots supplies in its recipe.';

-- No index — column is queried only by post_id (already PK lookup).
-- No backfill — pre-existing posts have no lot data; column is forward-only.
```

Tom will run this in Supabase SQL editor before the service code lands. **Do not run the SQL yourself — just commit the file.** Tom executes.

### Task 2 — Add `LotDeductionPlanItem` type and `deductFromSpecificLots` function

In `lib/types/supplies.ts`, add (if not already added in -a):

```ts
export interface LotDeductionPlanItem {
  lot_id: string;
  quantity: number;
  quantity_unit: string;
}
```

In `lib/services/lotsService.ts`, add a new exported function:

```ts
export async function deductFromSpecificLots(
  supplyId: string,
  plan: LotDeductionPlanItem[]
): Promise<LotDeductionResult>
```

#### Implementation notes for `deductFromSpecificLots`

1. Validate every `lot_id` in `plan` belongs to `supplyId`. If any doesn't, throw `Error('Lot ID does not belong to supply')`.
2. Validate every plan item has `quantity > 0`. Skip entries with quantity = 0 (allow caller to pass them but treat as no-op).
3. For each plan item, in plan order:
   - Read the lot.
   - Check unit compatibility via unitConverter. If incompatible, treat as a soft fail: append to `lots_affected` with `quantity_deducted: 0` and continue. Track in shortfall.
   - Deduct (convert if necessary). If deduction reaches qty=0, set `consumed_at = NOW()`.
   - Append to `lots_affected` with the deducted qty (in lot's native unit) and `archived` flag.
4. After all items: call private helper `_maybeAutoOutOfStock` (already in lotsService from -a) to handle Q44.
5. Compute total shortfall = sum of (planned qty - actually deducted qty) across all items, in the requested units (no conversion — caller passed mixed units, caller deals with reconciliation).
6. Set `shortfall_reason = 'no_compatible_unit'` if any item failed unit check; `'insufficient_stock'` if all items succeeded but total deducted < total requested; `null` if everything matched perfectly.

The function shares `_maybeAutoOutOfStock` with `deductFromOldest` (private helper from -a). It does NOT share oldest-first logic — caller has already specified which lots and how much.

### Task 3 — Rewrite `cookDepletionService.ts`

Preserve external API. Internal logic gets fully replaced.

#### Type extensions in cookDepletionService.ts

Extend `DepletionSupply` (additive — keep existing fields):

```ts
export interface DepletionSupply {
  supply_id: string;
  display_name: string;

  // Existing — preserve names for back-compat with banner UI
  old_status: SupplyStatus;     // alias for status_before; kept for UI compat
  new_status: SupplyStatus;     // alias for status_after; kept for UI compat
  spawned_need_id: string | null;

  // NEW — recipe context, populated at compute time
  recipe_quantity: number;       // amount from recipe_ingredients
  recipe_quantity_unit: string;  // unit from recipe_ingredients
  is_lot_supply: boolean;        // true if supply.tracks_lots — drives apply path

  // NEW — populated at apply time by deductFromOldest/deductFromSpecificLots
  lots_affected: Array<{
    lot_id: string;
    quantity_before: number;
    quantity_deducted: number;
    quantity_after: number;
    quantity_unit: string;
    archived: boolean;
  }>;
  shortfall: number;
  shortfall_reason: 'no_compatible_unit' | 'insufficient_stock' | null;
}
```

Note: `old_status` / `new_status` are kept as alias names. They're still semantically correct (status before / status after the cook event). Banner UI continues to read these fields.

#### Rewrite `computeDepletion`

Same signature. New body:

1. Read post → recipe_id (existing). Freeform = null = silent.
2. Read recipe_ingredients with **`ingredient_id, quantity_amount, quantity_unit`** (was: just ingredient_id).
3. Build a map `{ingredient_id → {quantity, unit}}` from recipe_ingredients.
4. Read supplies via `getSuppliesForSpace(spaceId, { includeLots: true })` — note `includeLots: true` is now required so the plan can show context.
5. For each supply where `ingredient_id IN ingredient_ids`:
   - **If `supply.tracks_lots = false`: SKIP entirely.** Q53. Do not include in plan, do not demote status, do not log. Silent.
   - **If `supply.tracks_lots = true`:**
     - Build a DepletionSupply entry with: recipe_quantity, recipe_quantity_unit, is_lot_supply=true, old_status=current status, new_status=current status (will be updated at apply), lots_affected=[], shortfall=0, shortfall_reason=null.
6. If `planSupplies.length === 0`, return null.
7. Return plan.

#### Rewrite `applyDepletion`

Signature change: add optional `options` arg.

```ts
export async function applyDepletion(
  plan: DepletionPlan,
  options?: {
    overrides?: Record<string, LotDeductionPlanItem[]>
  }
): Promise<void>
```

New body:

1. For each entry in `plan.supplies`:
   - Capture `status_before = entry.old_status`.
   - Look up override: `overridePlan = options?.overrides?.[entry.supply_id]`.
   - If override present: call `lotsService.deductFromSpecificLots(entry.supply_id, overridePlan)`.
   - If no override: call `lotsService.deductFromOldest(entry.supply_id, entry.recipe_quantity, entry.recipe_quantity_unit)`.
   - Capture the `LotDeductionResult`.
   - Update entry in place with: `lots_affected`, `shortfall`, `shortfall_reason`.
   - If `result.status_changed_to !== null`, set `entry.new_status = result.status_changed_to` and refetch supply to populate `entry.spawned_need_id` (if Q44 fired and Q-existing spawn-on-out chained — but Q44's auto-flip is now via lotsService's _maybeAutoOutOfStock which calls setSupplyStatus, which has spawn-on-out wired; so this should work transparently).
   - Per-supply errors: log, set `entry.shortfall = entry.recipe_quantity` and `shortfall_reason = 'insufficient_stock'`, continue.
2. After loop: write the structured `lot_depletions` JSONB to `posts.lot_depletions`. Format: array of objects matching DepletionSupply shape (omit display_name to keep DB record concise — UI re-derives from supply lookup on read). Include shortfall info for revert correctness.
3. Mutate the in-memory plan with all updates so caller (banner) sees final state.

Note on the spawn-on-out chain: from -a, `_maybeAutoOutOfStock` calls `setSupplyStatus`, and `setSupplyStatus` already has the spawn-on-out (Q10β/Q48) wiring. So when lots → 0 → status flips to out → spawn fires. The chain is preserved without explicit logic in cookDepletion.

#### Rewrite `rollbackDepletion`

Signature unchanged:

```ts
export async function rollbackDepletion(
  plan: DepletionPlan,
  excludeIds: string[] = []
): Promise<void>
```

New body:

1. For each entry in plan NOT in excludeIds:
   - For each lot in `entry.lots_affected`:
     - Update lot: `quantity = quantity_before` (re-add the deducted qty).
     - If `lot.archived === true`: set `consumed_at = NULL` (un-archive).
   - If `entry.new_status !== entry.old_status` (status changed during apply):
     - Restore: `setSupplyStatus(entry.supply_id, entry.old_status)`.
     - This may trigger spawn-on-out reversal if applicable; existing setSupplyStatus logic handles.
   - If `entry.spawned_need_id`: delete the spawned need (existing logic, preserve).
2. Clear `posts.lot_depletions` (set to NULL).

#### NEW function: `rollbackFromPersistedRecord`

```ts
export async function rollbackFromPersistedRecord(
  postId: string,
  excludeIds: string[] = []
): Promise<void>
```

Implementation:
1. Read `posts.lot_depletions` for the postId. If NULL or empty, return silently.
2. Reconstruct a DepletionPlan from the JSONB (display_name re-derived via supply lookup).
3. Call `rollbackDepletion(plan, excludeIds)`.

Used when user reverts depletion after app restart (UI lost the in-memory plan).

#### `runPostCookDepletion` — minimal change

Same signature. Internally just orchestrates compute + apply as before. The new behavior bubbles up through `applyDepletion`. No changes needed beyond what compute + apply already do.

Optionally update the doc comment to reflect lot semantics.

---

## Constraints

1. **No UI changes.** No edits to `/screens/` or `/components/`. Banner UI keeps consuming `old_status` / `new_status` / `spawned_need_id` as before — those names are preserved in the DepletionSupply shape.

2. **No edits to `needsService.ts`.** That's CP6e-Services-c.

3. **Preserve spawn-on-out chain.** Don't manually duplicate spawn-on-out logic in cookDepletionService. Let it flow through setSupplyStatus → _maybeAutoOutOfStock (already wired in -a).

4. **No tests.** Smoke at end of full build.

5. **TypeScript strict.** Match existing strictness.

6. **Idempotency at apply.** Calling `applyDepletion` twice on the same plan is undefined behavior — caller is expected to track state. Don't add idempotency guards. Same as existing.

7. **Match existing style.** cookDepletionService uses `console.log` / `console.error` with emoji prefixes. Mirror that.

8. **Plan persistence:** the JSONB record on `posts.lot_depletions` is the durable artifact. The in-memory plan returned from `runPostCookDepletion` is a transient mirror for the banner UI. They should be structurally identical except `display_name` is omitted from the persisted record.

9. **Supplies with no recipe_ingredients qty.** Some recipe_ingredients rows may have `quantity_amount = NULL` (text-only recipes from extraction). For those, skip depletion of that ingredient — don't try to deduct null qty. Log: `console.log('⏭️ Skipping depletion for ingredient with no quantity:', ingredientId)`. Continue with other ingredients.

10. **Spawn-on-out double-fire prevention.** Q48's idempotency guard handles this — setSupplyStatus checks for existing active need before spawning. If a tracks_lots supply was already at status='out' before this cook, Q44's auto-out-flip is a no-op; setSupplyStatus is idempotent on re-fire. Don't add additional guards in cookDepletionService.

---

## What this prompt does NOT do

- Grocery acquire path → lot create (-c).
- UI components.
- Tests.
- Migration of existing posts.lot_depletions data (no existing data; column is new).

---

## SESSION_LOG entry format

Append to `SESSION_LOG.md`:

```
## 2026-05-06 — CP6e-Services-b · cookDepletion rewrite + lotsService.deductFromSpecificLots

**Type:** Service-layer rewrite + schema add + lotsService extension.

**Files modified/created:**
- docs/cp6e_services_b_schema_migration.sql (NEW) — adds posts.lot_depletions JSONB
- lib/types/supplies.ts (extended) — LotDeductionPlanItem added (if not in -a)
- lib/services/lotsService.ts (extended) — deductFromSpecificLots added (~80 lines)
- lib/services/cookDepletionService.ts (REWRITE internals, preserve API) — N lines

**Behavior change summary (D8R-Q53):**
- Tracks_lots supplies: lot qty deducted (oldest-first default; manual override via apply opts).
- Non-tracks_lots supplies: NO-OP. No status demote on cook. (Was: one-step demote per cook.)
- Status auto-flip to out via Q44 (lotsService._maybeAutoOutOfStock when total qty=0).
- Spawn-on-out chain preserved (setSupplyStatus → existing Q10β/Q48 logic).

**API preserved:**
- computeDepletion(postId, spaceId) → DepletionPlan | null  [body rewritten]
- applyDepletion(plan, options?: { overrides? }) → void  [signature extended; body rewritten]
- rollbackDepletion(plan, excludeIds?) → void  [body rewritten]
- runPostCookDepletion(postId, spaceId) → DepletionPlan | null  [unchanged]

**API added:**
- rollbackFromPersistedRecord(postId, excludeIds?) → void  [for cross-session-restart revert]

**DepletionSupply shape: extended.** Existing fields preserved (old_status, new_status,
spawned_need_id). New fields: recipe_quantity, recipe_quantity_unit, is_lot_supply,
lots_affected[], shortfall, shortfall_reason. Banner UI consumes existing fields
unchanged.

**Schema migration:** docs/cp6e_services_b_schema_migration.sql committed but NOT
executed by CC. Tom runs in Supabase SQL editor.

**Cross-lot deduction edge cases verified (S3 from planning):**
- variant_label mixing: silent across variants
- unit incompatibility: short-circuit shortfall
- insufficient stock: partial deplete + auto-out

**No UI touched. No needsService touched. No tests written.**

**Next:** Tom runs schema migration, then CP6e-Services-c (grocery acquire → lot create).
```

---

## If anything blocks

- **lotsService API doesn't match -a's contract.** The deductFromOldest signature should be `(supplyId, quantity, quantityUnit) → LotDeductionResult` per the -a prompt. If it's different, STOP and report — don't paper over the mismatch by writing adapter code.
- **recipe_ingredients schema doesn't have `quantity_amount` / `quantity_unit`.** STOP and report. Read schema CSVs to verify column names; if they're called something else (`amount` / `unit`), use the actual names.
- **`posts` table doesn't exist OR has different name.** STOP and report.
- **The existing cookDepletionService uses an internal pattern I don't recognize.** Ask before rewriting.
- **Spawn-on-out chain breaks during dry-read.** Trace from `_maybeAutoOutOfStock` through `setSupplyStatus`. If the chain is broken, report which link.
- **Existing UI consumer expects DepletionSupply field that I removed.** Restore the field. Banner UI compat is mandatory.

Don't invent service behavior. The decisions list above is exhaustive. If you encounter a case I didn't cover, stop and report.

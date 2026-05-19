# CC Prompt — CP6e-Services-a · lotsService + suppliesService extensions

**Date:** 2026-05-06
**Author:** Claude.ai planning instance
**Type:** Service-layer build (new module + extensions)
**Estimated effort:** ~1 CC session, ~400-600 lines net new code
**Depends on:** CP6e-Schema (shipped 2026-05-06; supplies.tracks_lots + supply_lots table + tsvector + RPC live in DB)

---

## Context

CP6e-Schema migration is complete. The DB now has:
- `supplies.tracks_lots BOOLEAN DEFAULT false`
- `supply_lots` table (full schema per D8R-Q46)
- tsvector + GIN indexes + triggers on supplies and supply_lots
- `search_supplies(query_text, p_space_id)` RPC
- 280 ingredients with `plural_name = NULL` (catalog audit complete)
- All RLS policies in place

This is the FIRST of three service-layer prompts. -a builds the foundation (lotsService module + suppliesService extensions). -b and -c will rewrite cookDepletion and grocery acquire respectively, both depending on -a.

**No UI changes in -a.** No screen edits. No component touches. Only services + types.

**No smoke testing in -a.** Tom will smoke-test once at the end of the full -a/-b/-c build.

Read `docs/PHASE_8R_UNIFIED_NEEDS.md` (now v0.6 post-merge) for the design context — D8R-Q43 through Q60 are all relevant. Specifically:
- Q43 (tracks_lots opt-in)
- Q44 (status auto-flip to out when total qty=0)
- Q45 (status auto-flip to in_stock when lot added to low/critical/out supply)
- Q46 (supply_lots fields)
- Q47 (storage move recomputes expiration unless overridden)
- Q48 (lot consume → auto-archive)
- Q60 (tracks_lots toggle hidden when lots exist)

---

## Inputs to read

Before writing any code:

1. **`docs/PHASE_8R_UNIFIED_NEEDS.md`** — sections "Lot tracking (D8R-Q43-Q60)" in Architectural concept; "Decisions from lot tracking iteration" rows Q43-Q48, Q60.

2. **`lib/services/suppliesService.ts`** — existing service. You will extend it. Read end-to-end first to match conventions: error handling style, tag-loading pattern, type imports, return types.

3. **`lib/types/supplies.ts`** — existing types. Read to understand `Supply`, `SupplyWithTags`, `SupplyStatus` shapes. You will extend with new types here.

4. **`lib/services/needsService.ts`** — read selected functions: `createNeed`, `getNeedsForView`. Don't modify. Just understand the dedup/idempotency patterns since lotsService will follow similar shape.

5. **`lib/types/needs.ts`** — for type style reference.

6. **`docs/cp6e_schema_migration.sql`** — confirm column names match what you'll reference. The file is in the repo if you need to look up exact field types.

7. **`lib/services/cookDepletionService.ts`** — read for context only. -a doesn't touch this file. -b will rewrite it. Reading helps you understand what `deductFromOldest` is going to be called by.

---

## Tasks — execute in order

### Task 1 — Type additions in `lib/types/supplies.ts`

Add these types (don't remove anything):

```ts
// D8R-Q46. Lot row.
export interface SupplyLot {
  id: string;
  supply_id: string;

  quantity: number;
  quantity_unit: string;

  storage_location: 'fridge' | 'freezer' | 'pantry' | 'counter';
  acquired_at: string;            // ISO
  expires_at: string | null;      // ISO; computed default at create time, user-overridable
  expires_at_overridden: boolean; // true → future storage moves preserve expires_at

  variant_label: string | null;
  brand: string | null;
  notes: string | null;

  consumed_at: string | null;     // ISO; soft-delete on full consumption (D8R-Q48)

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Aggregate metadata for a supply's lots — useful for display + decision logic
export interface SupplyLotAggregate {
  total_quantity: number;          // sum across active lots, in canonical unit
  canonical_unit: string | null;   // null if lots have mixed unconvertible units
  lot_count: number;               // active lots only
  storage_locations: string[];     // distinct active storage locations
  variant_labels: string[];        // distinct active variant_labels (excluding null)
  oldest_expiration: string | null; // ISO; nearest future expiration across active lots
  has_expiring_soon: boolean;      // true if any active lot expires within 7 days
}

// Extend SupplyWithTags interface to optionally include lots
// Modify the existing SupplyWithTags interface to add:
//   lots?: SupplyLot[];           // populated when getSuppliesForSpace called with includeLots=true
//   lot_aggregate?: SupplyLotAggregate; // computed from lots when present

// Lot creation / update params
export interface CreateLotParams {
  supply_id: string;
  quantity: number;
  quantity_unit: string;
  storage_location: 'fridge' | 'freezer' | 'pantry' | 'counter';
  acquired_at?: string;            // defaults to NOW
  expires_at?: string;             // if omitted, computed from acquired_at + ingredient.shelf_life_days_<storage>
  variant_label?: string;
  brand?: string;
  notes?: string;
}

export interface UpdateLotParams {
  quantity?: number;
  quantity_unit?: string;
  storage_location?: 'fridge' | 'freezer' | 'pantry' | 'counter';
  acquired_at?: string;
  expires_at?: string;             // setting this also sets expires_at_overridden = true
  variant_label?: string | null;
  brand?: string | null;
  notes?: string | null;
}

// Result of deductFromOldest — used by cookDepletion + manual deplete
export interface LotDeductionResult {
  lots_affected: Array<{
    lot_id: string;
    quantity_before: number;
    quantity_deducted: number;
    quantity_after: number;
    archived: boolean;             // true if this deduction set consumed_at
  }>;
  status_changed_to: 'in_stock' | 'low' | 'critical' | 'out' | null; // null if status didn't change
  shortfall: number;               // > 0 if couldn't satisfy requested qty
  shortfall_reason: 'no_compatible_unit' | 'insufficient_stock' | null;
}
```

If `SupplyWithTags` already exists, add the two optional fields (`lots?`, `lot_aggregate?`) to it. Do not redefine the interface from scratch.

### Task 2 — Create `lib/services/lotsService.ts`

New module. Functions to export:

```ts
// CRUD
export async function createLot(params: CreateLotParams): Promise<SupplyLot>
export async function updateLot(lotId: string, params: UpdateLotParams): Promise<SupplyLot>
export async function archiveLot(lotId: string): Promise<void>     // sets consumed_at = NOW
export async function deleteLot(lotId: string): Promise<void>      // hard delete; rare

// Read
export async function getLotsForSupply(supplyId: string, options?: { includeArchived?: boolean }): Promise<SupplyLot[]>
export async function getLotById(lotId: string): Promise<SupplyLot | null>
export async function getLotAggregate(lots: SupplyLot[]): SupplyLotAggregate  // pure function on already-loaded lots

// Decision-relevant operations
export async function deductFromOldest(
  supplyId: string,
  quantity: number,
  quantityUnit: string
): Promise<LotDeductionResult>

// Storage move (D8R-Q47 — recomputes expires_at unless expires_at_overridden)
export async function moveLotStorage(
  lotId: string,
  newStorage: 'fridge' | 'freezer' | 'pantry' | 'counter'
): Promise<{ lot: SupplyLot; expiration_recomputed: boolean }>
```

#### Implementation notes for lotsService

**`createLot`:**
1. Default `acquired_at` to NOW if not supplied.
2. If `expires_at` not supplied, compute from `acquired_at + ingredient.shelf_life_days_<storage_location>`. Look up via JOIN to ingredients via supply.ingredient_id. If no shelf life on the ingredient for that storage, leave `expires_at` NULL.
3. Insert. The DB trigger handles search_vector. Also handles updated_at.
4. AFTER insert, call `_maybeAutoRestock(supplyId)` (private helper, see Task 3) to handle D8R-Q45 status auto-flip.
5. Return the inserted lot.

**`updateLot`:**
1. If params include `expires_at`, also set `expires_at_overridden = true`. (User explicitly set the date; treat as authoritative.)
2. If params include `quantity` and the new qty is 0, also set `consumed_at = NOW` (D8R-Q48). Then call `_maybeAutoOutOfStock(supplyId)` after the update — D8R-Q44 auto-flip if all lots now archived.
3. Otherwise, simple update. Trigger handles search_vector + updated_at.

**`archiveLot`:**
1. Sets `consumed_at = NOW()`.
2. After: call `_maybeAutoOutOfStock(supplyId)` to handle D8R-Q44.

**`getLotsForSupply`:**
- Default: only active (consumed_at IS NULL). Order by `expires_at ASC NULLS LAST, acquired_at ASC` (oldest-expiring first; ties broken by acquisition date).
- With `includeArchived: true`: include consumed_at IS NOT NULL too. Same ordering, archived lots sorted to the end.

**`getLotAggregate(lots)` — pure function:**
- Filter to active lots only (consumed_at IS NULL).
- Sum `quantity` across lots that share a unit. If lots have multiple units AND not all convertible via `lib/services/unitConverter`, set `canonical_unit = null` and `total_quantity = 0` (caller's signal that aggregation isn't meaningful).
- If all lots' units convert to a single canonical unit (e.g., all weights to lb, or all volumes to cup), aggregate to that unit.
- `oldest_expiration`: MIN(expires_at WHERE expires_at IS NOT NULL). NULL if no lot has an expiration.
- `has_expiring_soon`: any active lot with `expires_at` within 7 days from NOW.

**`deductFromOldest(supplyId, quantity, quantityUnit)`:**
1. Get active lots for supply, sorted oldest-expiration-first.
2. Walk through lots. For each lot:
   - Check unit compatibility via `lib/services/unitConverter`. If incompatible AND no other lot has compatible unit → SHORT-CIRCUIT: return result with `shortfall = quantity`, `shortfall_reason = 'no_compatible_unit'`, `lots_affected = []`. Do not start partial draws.
   - Convert lot's quantity into requested unit.
   - Deduct min(remaining_to_draw, lot_qty_in_request_unit) from this lot.
   - Update lot: new quantity, set `consumed_at = NOW()` if hit 0.
   - Append to `lots_affected`.
   - If `remaining_to_draw <= 0`, break.
3. After walking: if `remaining_to_draw > 0`, set `shortfall = remaining_to_draw`, `shortfall_reason = 'insufficient_stock'`. Status auto-flips to `out` (D8R-Q44 — total active qty is now 0).
4. If qty=0 reached → `_maybeAutoOutOfStock` triggers status flip.
5. If status flipped, populate `status_changed_to`.

**Cross-lot decrement edge cases (S3 from planning):**
- (a) Cross-lot draw spans different `variant_label`s — silently mix. Variant_label is a tag, not a constraint.
- (b) Cross-lot draw spans different `quantity_unit`s — use unitConverter; skip lots with incompatible unit. If NO lot has compatible unit, return shortfall with reason='no_compatible_unit' (don't partial-draw).
- (c) Recipe needs more than total available — partial deplete to 0 across all lots; shortfall reflects the gap; status auto-flips to `out`. Do not block. Caller (cookDepletion) is responsible for surfacing the shortfall to the user via UI.

**`moveLotStorage(lotId, newStorage)`:**
1. Read current lot.
2. Update `storage_location = newStorage`.
3. If `expires_at_overridden = false` AND ingredient has a shelf_life for the new storage:
   - Recompute `expires_at = NOW() + shelf_life_days_<newStorage>` (using NOW, not original acquired_at — moving fresh-to-freezer extends from this moment).
   - Set `expiration_recomputed = true` in return value.
4. If `expires_at_overridden = true` OR no shelf life data: leave expires_at as-is. `expiration_recomputed = false`.
5. Return updated lot + the boolean.

**Private helpers (not exported):**

```ts
// Returns ingredient's shelf_life_days for the given storage. Null if missing.
async function _getShelfLifeDays(supplyId: string, storage: string): Promise<number | null>

// D8R-Q44. Called after operations that may have brought total qty to 0.
// If all active lots qty=0 (or no active lots) AND tracks_lots=true,
// flip supply.status to 'out' (only if not already 'out').
// Returns the new status if changed, else null.
async function _maybeAutoOutOfStock(supplyId: string): Promise<SupplyStatus | null>

// D8R-Q45. Called after createLot.
// If supply.tracks_lots=true AND supply.status IN ('low', 'critical', 'out')
// AND now has at least one active lot with qty > 0, flip status to 'in_stock'.
// Returns the new status if changed, else null.
async function _maybeAutoRestock(supplyId: string): Promise<SupplyStatus | null>
```

These helpers should call `setSupplyStatus` from suppliesService (which you'll extend in Task 3 to handle the cascade properly).

### Task 3 — Extend `lib/services/suppliesService.ts`

Add these new exported functions:

```ts
// D8R-Q43. Toggle tracks_lots on/off.
// When flipping ON: optionally pass `initialLot` to seed first lot from existing
//   state (e.g., status=in_stock implies "we have some" — create a placeholder lot).
//   If null, no initial lot created (user adds one manually after).
// When flipping OFF: rejects if any active lots exist (D8R-Q60). User must
//   archive lots first via SupplyDetail UI.
export async function setSupplyTracksLots(
  supplyId: string,
  value: boolean,
  initialLot?: CreateLotParams
): Promise<SupplyWithTags>
```

#### Implementation notes for setSupplyTracksLots

1. Read current supply.
2. If `value === true`:
   - Update `supplies.tracks_lots = true`.
   - If `initialLot` provided, call `lotsService.createLot(initialLot)`. The createLot's auto-restock handles status if needed.
   - Return updated supply.
3. If `value === false`:
   - Query active lots for this supply. If count > 0, throw `Error('Cannot disable lot tracking while active lots exist. Archive all lots first.')`.
   - Update `supplies.tracks_lots = false`.
   - Return updated supply.

### Task 4 — Modify `getSuppliesForSpace` in suppliesService

Existing function signature (approximately):
```ts
export async function getSuppliesForSpace(spaceId: string, options?: { ... }): Promise<SupplyWithTags[]>
```

Add an option:
```ts
{
  ...existing options,
  includeLots?: boolean;  // when true, hydrates supply.lots and supply.lot_aggregate
}
```

When `includeLots` is true:
1. After loading supplies (existing logic), batch-load all active lots for those supply IDs in one query (`SELECT * FROM supply_lots WHERE supply_id IN (...) AND consumed_at IS NULL`).
2. Group lots by supply_id; attach to each supply as `supply.lots`.
3. For each supply with lots, compute `supply.lot_aggregate` via `lotsService.getLotAggregate`.
4. Supplies with `tracks_lots = false` always get `lots: []` and `lot_aggregate: undefined`.
5. Return supplies with extensions populated.

Default `includeLots` to `false` (back-compat — existing callers don't expect lots).

### Task 5 — Modify `getSupplyById` in suppliesService

Add same `includeLots?: boolean` option. Same hydration logic, scoped to a single supply.

### Task 6 — Update `setSupplyStatus` in suppliesService — minor change

The existing `setSupplyStatus` likely just updates `supplies.status` and returns. Make sure it does NOT have any auto-derive logic for tracks_lots supplies — Q44/Q45 cascades happen from the lots side via the private helpers in lotsService, not from the status side.

If `setSupplyStatus` currently has any logic like "when setting to out, also do X to lots" — leave it alone. The only required change is: confirm the function does not block manual status changes on tracks_lots supplies. User can still manually flip `out → in_stock` via the badge tap even if lots are 0 (they may be testing or just want to override). Q44 is automatic, but doesn't lock manual control.

If you find any existing check like `if (supply.tracks_lots) return existing.status;` — REMOVE it. Status remains user-controllable.

---

## Constraints

1. **No UI changes.** No edits to any files in `/screens/` or `/components/`. If a UI consumer needs an updated type, update only `lib/types/`.

2. **No edits to `cookDepletionService.ts`.** That's CP6e-Services-b. Same for `needsService.ts` (some -c grocery acquire path lives there) — read-only here.

3. **Service patterns must match existing style.** Look at how `createSupply` in suppliesService handles errors, logging, type returns. Mirror that style. Don't introduce new error-handling patterns or logging libraries.

4. **No tests.** Smoke testing happens at end of full -a/-b/-c build. Write code as if tests exist (clear contracts, no hidden state) but don't write tests.

5. **TypeScript strict.** Match existing strictness. No `any` unless existing code uses it for the same shape.

6. **Idempotency on createLot, archiveLot.** A duplicate createLot (same supply, same qty/unit/storage, same exp date within ~5min window) should NOT dedup — lots are physical instances and the user might genuinely have two identical packs. archiveLot is naturally idempotent (re-archiving sets consumed_at to a later NOW; observable but harmless).

7. **No N+1 queries.** `getSuppliesForSpace` with includeLots must batch lot loading.

---

## What this prompt does NOT do

These are deferred to -b or -c:
- cookDepletionService rewrite (-b)
- Grocery acquire → lot create (-c)
- UI components (CP6e-PantryUI / CP6e-FlowsUI later)
- Tests (smoke at end of full build)

---

## SESSION_LOG entry format

Append to `SESSION_LOG.md`:

```
## 2026-05-06 — CP6e-Services-a · lotsService + suppliesService extensions

**Type:** Service-layer build.

**Files modified/created:**
- lib/types/supplies.ts (extended) — N lines added
- lib/services/lotsService.ts (NEW) — N lines
- lib/services/suppliesService.ts (extended) — N lines added/changed

**Public API added:**
- lotsService: createLot, updateLot, archiveLot, deleteLot, getLotsForSupply,
  getLotById, getLotAggregate (pure), deductFromOldest, moveLotStorage
- suppliesService: setSupplyTracksLots
- suppliesService.getSuppliesForSpace + getSupplyById: new `includeLots` option

**Q-rule wiring confirmed:**
- D8R-Q44 (auto-out) wired via _maybeAutoOutOfStock helper, called from updateLot + archiveLot + deductFromOldest
- D8R-Q45 (auto-restock) wired via _maybeAutoRestock helper, called from createLot
- D8R-Q47 (storage move recomputes expiration) implemented in moveLotStorage; respects expires_at_overridden
- D8R-Q48 (lot consume → archive) implemented in updateLot when qty=0 + archiveLot direct
- D8R-Q60 (tracks_lots toggle blocked when lots exist) enforced in setSupplyTracksLots

**Cross-lot deduction rules (S3 from planning):**
- Variant mixing: silent (silently draws across variant_labels)
- Unit incompatibility: short-circuit with shortfall_reason='no_compatible_unit', no partial draw
- Insufficient stock: partial deplete + shortfall_reason='insufficient_stock' + auto-out

**No UI touched. No cookDepletion touched. No tests written.**

**Next:** CP6e-Services-b (cookDepletion rewrite).
```

---

## If anything blocks

- **Existing `setSupplyStatus` has tracks_lots-aware logic that conflicts.** Stop and report. Don't refactor existing behavior unilaterally; ask.
- **`unitConverter` doesn't have a function for what I need.** Stop and report. Read its API; if missing, ask Claude.ai.
- **`SupplyWithTags` shape unclear how to extend safely.** Stop and report.
- **DB column name doesn't match what I expect.** Read `cp6e_schema_migration.sql` in repo. If still unclear, stop and ask.
- **Schema RLS issue surfaces during writes.** Report verbatim error; Claude.ai will diagnose.

Don't invent service behavior on your own. The decisions list above is exhaustive for this CP. If you encounter a case I didn't cover, stop and report — don't make a unilateral call.

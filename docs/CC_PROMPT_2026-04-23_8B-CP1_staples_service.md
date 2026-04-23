# [DRAFT] CC Prompt 2 — Phase 8B-CP1 Staples Service Layer

> **⚠️ DRAFT v2 — pending second audit review.** Renamed from 8B-CP2 per sub-phase restructure (D8-24). Fixes from first audit: lib/services/spaceService.ts path, inline meta-commentary removed, cycling logic clarified (insert = NULL, ALL transitions including unknown→good = NOW()), canonical session log format, Rule E check.

**Session type:** Execution
**Checkpoint:** 8B-CP1 — Staples service layer (first checkpoint of 8B after schema foundation)
**Estimated duration:** Half to one session
**Dependencies:** 8A-CP1 complete (schema migration run, pantry_staples table exists, PantryStaple types in lib/types/pantry.ts)

---

## Context

Phase 8B introduces staples as a first-class concept. This checkpoint builds the service layer that the UI (8B-CP2) will consume. No UI changes — just the logic, data access, and state cycling rules that make staples work.

**Why a dedicated service, not extending `pantryService.ts`:** Staples are a different data shape (no quantity, no expiration, state-based). Mixing CRUD and matching logic across both tables in one service gets messy. Cleaner to have `pantryStaplesService.ts` own staples concerns end-to-end. Cross-surface code (e.g., "is this ingredient_id covered as either a tracked item or a staple?") will live in a small helper later — not in either base service.

**State cycling rules (canonical):**
- Insert creates staple with `state='unknown'` and `last_confirmed_at=NULL`
- First tap on an unknown staple: sets `state='good'`, sets `last_confirmed_at=NOW()`. Unknown state exits permanently.
- Subsequent taps cycle: `good → running_low → out → good → ...`
- **Every state transition bumps `last_confirmed_at=NOW()`**, including the unknown→good first confirmation. Every user engagement is a confirmation.
- Unknown is never re-entered via cycle. To get back to unknown, delete and re-add.

**Why `last_confirmed_at` auto-bump matters:** Path B (tracked-item staleness) deferred post-F&F, but the same timestamp is the source of truth for "how recently did the user engage with this." Bumping on every state change sets us up for post-launch work without schema changes.

---

## Inputs to read

**Required:**
1. `docs/planning/PHASE_8_PANTRY_INTELLIGENCE.md` v2.1 — sub-phase 8B section, specifically 8B-CP1. Read the "Architectural decisions" block under 8B (D8-7, D8-8, D8-9, D8-25).
2. `docs/wireframes/phase_8/phase_8_system_prototype_v5.html` (when available) — open the **Pantry tab**. Observe the staples grid behavior:
   - Paprika (unknown) — dashed border, italic label, empty dot
   - Tapping Paprika's dot confirms to good
   - Cholula (out) — auto-sorted top-left, label bold
   - Butter (low) — second position
   - Good staples fill the remainder
3. `lib/types/pantry.ts` — `PantryStaple`, `PantryStapleInsert`, `PantryStapleUpdate`, `StapleState` (added in 8A-CP1).
4. `lib/pantryService.ts` — reference for service patterns (error handling, Supabase client usage, function naming conventions). **Don't modify it**, just read it.
5. `lib/supabase.ts` — Supabase client initialization pattern.
6. `lib/services/spaceService.ts` — understand how `activeSpaceId` is obtained programmatically. Staples are space-scoped. (Note the path: `lib/services/spaceService.ts`, not `lib/spacesService.ts` — first audit caught this.)
7. `contexts/SpaceContext.tsx` — React context layer over the space service. Exports `useSpace`, `useActiveSpaceId`, `useSpacePermissions` hooks. Not used in this service (service is pure data access) but relevant for understanding what consumers will have available.
8. `docs/DOC_MAINTENANCE_PROCESS.md` Section 8 — canonical SESSION_LOG entry format.
9. `docs/PK_CODE_SNAPSHOTS.md` — check for Rule E after edit.

**Reference only:**
- `SHARED_PANTRIES_FEATURE_SPEC.md` — established patterns for space-scoped CRUD
- `supabase/migrations/20260424_phase_8_schema_foundation.sql` — the schema this service operates on

---

## Task

Create `lib/pantryStaplesService.ts` implementing CRUD and state cycling. Export typed functions. No React, no UI. Consumed by 8B-CP2 and later checkpoints.

### Functions to implement

```typescript
// READ

/**
 * Get all staples for a space. Sorted by state priority (out → running_low → good → unknown),
 * then alphabetically by display name within each state group.
 */
export async function getStaplesBySpace(spaceId: string): Promise<PantryStaple[]>

/**
 * Get a single staple by ID. Returns null if not found or not accessible (RLS hides it).
 */
export async function getStapleById(stapleId: string): Promise<PantryStaple | null>

/**
 * Check whether a given ingredient_id is already a staple in this space.
 * Used by the UI to prevent adding duplicates before the DB rejects it.
 */
export async function isIngredientAlreadyStaple(
  spaceId: string,
  ingredientId: string
): Promise<boolean>

// CREATE

/**
 * Add a staple by ingredient_id. Default state is 'unknown' with last_confirmed_at=NULL.
 * User confirms via cycleStapleState on first tap.
 * Throws DuplicateStapleError on unique-constraint violation.
 */
export async function addStapleByIngredient(
  spaceId: string,
  ingredientId: string,
  addedBy: string,
  initialState?: StapleState  // defaults to 'unknown'
): Promise<PantryStaple>

/**
 * Add a custom-named staple (branded item, doesn't map to ingredients table).
 * Example: "Motor City pizza", "Banza pasta — rotini shape".
 * Default state 'unknown' with last_confirmed_at=NULL.
 */
export async function addStapleByCustomName(
  spaceId: string,
  customName: string,
  addedBy: string,
  initialState?: StapleState
): Promise<PantryStaple>

// UPDATE — state cycling is the heart of the service

/**
 * Cycle a staple's state per the canonical rules.
 * - unknown → good (first confirmation)
 * - good → running_low
 * - running_low → out
 * - out → good
 * Bumps last_confirmed_at = NOW() on EVERY transition (including unknown→good).
 * Returns the staple with its new state.
 * Throws StapleNotFoundError if ID doesn't exist in user's accessible spaces.
 */
export async function cycleStapleState(stapleId: string): Promise<PantryStaple>

/**
 * Set a staple's state directly (not via cycle). For explicit state changes from
 * the recipe tap-sheet's "Mark low" action or cook-post depletion.
 * Bumps last_confirmed_at = NOW().
 */
export async function setStapleState(
  stapleId: string,
  newState: StapleState
): Promise<PantryStaple>

/**
 * Update a staple's custom_name (for branded-item staples). Does NOT bump
 * last_confirmed_at (metadata editing, not state engagement).
 */
export async function updateStapleCustomName(
  stapleId: string,
  customName: string
): Promise<PantryStaple>

// DELETE

/**
 * Remove a staple entirely. Hard delete.
 */
export async function deleteStaple(stapleId: string): Promise<void>

// HELPER

/**
 * Get a display name for a staple regardless of whether it's ingredient-mapped or custom.
 * Returns ingredient.name if ingredient_id is set, otherwise returns custom_name.
 * Used by UI rendering.
 * If you denormalize by joining ingredients(name) in getStaplesBySpace, this helper
 * becomes a pure function — preferred.
 */
export function getStapleDisplayName(staple: PantryStaple & { ingredient_name?: string | null }): string
```

### Canonical state cycling rule (clarified — no ambiguity)

```
Insert:
  state = 'unknown'
  last_confirmed_at = NULL

Tap on unknown staple:
  state → 'good'
  last_confirmed_at → NOW()
  Unknown state exits permanently.

Tap on confirmed staple:
  state cycles good → running_low → out → good → ...
  last_confirmed_at → NOW() on every transition

To return to unknown:
  Must delete and re-add. Intentional — "unknown" is an unconfirmed-by-user state,
  not a "forgot about it" state.
```

**Every transition bumps `last_confirmed_at = NOW()`.** No exceptions. Even unknown→good. User engagement = confirmation.

### Sort order for `getStaplesBySpace`

v5 wireframe auto-sorts "out" staples to top-left. Grid reads left-to-right, top-to-bottom, so sort determines grid position:

```
1. out         (most urgent)
2. running_low
3. good
4. unknown     (last — unconfirmed items shouldn't crowd the top)

Within each state group: alphabetical by display name (ingredient.name or custom_name).
```

Implement via SQL `ORDER BY CASE ... END, display_name ASC`. Faster than application-level sorting.

### Error handling

- All functions throw on DB errors (RLS denial, constraint violation, etc.). Caller catches.
- `addStapleByIngredient` / `addStapleByCustomName` catch unique-constraint violations (PostgreSQL error code `23505`) and throw typed `DuplicateStapleError`.
- `cycleStapleState` / `setStapleState` throw `StapleNotFoundError` if ID doesn't exist in user's accessible spaces.
- Logging: `console.log` with 📦 emoji prefix for ops (matches pantryService convention). Errors with ❌.

### Types to define (in-file, not types/)

```typescript
export class DuplicateStapleError extends Error {
  constructor(name: string) {
    super(`Staple "${name}" is already on your list`);
    this.name = 'DuplicateStapleError';
  }
}

export class StapleNotFoundError extends Error {
  constructor(id: string) {
    super(`Staple ${id} not found or not accessible`);
    this.name = 'StapleNotFoundError';
  }
}
```

---

## Constraints

1. **Service file only.** `lib/pantryStaplesService.ts`. No UI changes. No other service files touched.
2. **No breaking changes to existing services.** `pantryService.ts`, `groceryService.ts`, etc. stay as-is.
3. **Use existing Supabase client pattern.** Import `supabase` from `lib/supabase`. Same as `pantryService.ts`.
4. **Match pantryService error/logging style.** `console.log('📦 Loading staples for space:', spaceId)` etc. Error logs prefix with ❌.
5. **Don't implement depletion logic here.** Cook-post depletion hooks into `setStapleState` but the orchestration is 8B-CP4. This service just provides the primitives.
6. **Don't build a staples-auto-to-grocery router.** The "out staple → Now tier" routing lives in `groceryService` later (8C-CP4). This service just handles state changes.
7. **Don't add ingredient search for staple suggestions.** That's 8B-CP2's concern; it uses existing ingredient search. This service just handles the add.
8. **RLS does the space-access check.** Don't duplicate space-membership checks in service code — rely on the DB policies from 8A-CP1.
9. **All DB access goes through Supabase client.** No raw SQL beyond `.rpc()` if needed (shouldn't be needed).
10. **Keep the file under ~350 lines.**
11. **Accessibility check.** This is a service-only checkpoint — no UI. Accessibility verification does not apply here.
12. **PK snapshot staleness check (Rule E).** Before writing SESSION_LOG, run Rule E check against `docs/PK_CODE_SNAPSHOTS.md` for any tier-1 snapshots of `lib/pantryStaplesService.ts` (new file — likely no existing snapshot, but confirm).
13. **Session log format: canonical only.** Write SESSION_LOG entry per canonical format in `docs/DOC_MAINTENANCE_PROCESS.md` Section 8. Required fields as specified in 8A-CP1.

---

## Verification steps

Before marking complete:

1. **TypeScript compiles clean.** `npx tsc --noEmit` exits 0.
2. **All exported function signatures match the stubs above.** If you deviated, note why in SESSION_LOG.
3. **Manual sanity test via scratch file** (create `lib/_test_staples.ts` or similar, then delete after verification). Run through:
   - Add a staple by ingredient_id → returns with `state: 'unknown'`, `last_confirmed_at: null`
   - Cycle it → state becomes `'good'`, `last_confirmed_at` set to NOW()
   - Cycle again → `'running_low'`
   - Cycle again → `'out'`
   - Cycle again → back to `'good'` (NOT unknown)
   - Set state directly to `'running_low'` → works, bumps timestamp
   - Try to add same ingredient_id again → throws `DuplicateStapleError`
   - Get by space → returns correctly sorted (out first, unknown last)
   - Delete → gone
4. **`getStapleDisplayName` handles both cases.** Ingredient-mapped returns `ingredient.name`; custom returns `custom_name`.
5. **Sort order matches wireframe.** Out items appear first (top-left in grid); unknown items last.
6. **No service imports React or UI packages.**
7. **`isIngredientAlreadyStaple` returns correct boolean.**
8. **Error handling verified.** RLS violation → throws. Duplicate add → throws typed error.
9. **Rule E check completed.** PK snapshot (if existing) refreshed or flagged.
10. **SESSION_LOG written in canonical format.**

---

## Open questions to flag

STOP and flag if you hit these:

1. **`PantryStaple` types aren't in `lib/types/pantry.ts` yet.** 8A-CP1 prerequisite missed. Don't proceed.
2. **`pantry_staples` table doesn't exist in DB.** Same — 8A-CP1 migration wasn't run. Don't proceed.
3. **RLS policies missing on `pantry_staples`.** Service will appear to work but leak data across spaces. Verify with a scratch test across two users if possible.
4. **`getStapleDisplayName` needs to join `ingredients`** — do this in the main `getStaplesBySpace` query via Supabase relation (`select('*, ingredient:ingredients(name)')`). Use the denormalized shape; the helper becomes pure. Flag the decision in SESSION_LOG.
5. **`DuplicateStapleError` detection** — Supabase returns PostgreSQL error code `23505` for unique violations. Confirm the error shape matches (might be wrapped). If unclear, try it and log the raw error structure.

---

## What this unblocks

After this checkpoint:
- **8B-CP2** can build the staples grid UI on PantryScreen using `getStaplesBySpace`, `cycleStapleState`, `addStapleByIngredient`
- **8B-CP3** (bulk pre-populate) can call `addStapleByIngredient` / `addStapleByCustomName` in a loop from a one-time script
- **8B-CP4** (cook post depletion) can use `setStapleState` to mark staples as `running_low` or `out` after a cook
- **8C-CP4** (staple-to-grocery routing) can query staples by state to auto-populate grocery Now tier
- **8D-CP3** (recipe tap-sheet) can call `setStapleState` from the "Mark low" / "Mark out" / "Actually have" actions

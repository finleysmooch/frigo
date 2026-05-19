# [DRAFT] CC Prompt — 8C-Shared-CP2: Service layer + sharing toggle on creation

> Phase 8C-Shared sub-phase, Checkpoint 2. F&F-prerequisite. Widens grocery service queries to read shared lists via space membership, consolidates the duplicate `CreateGroceryListParams` interfaces (resolves P8-16), and adds the inline sharing toggle/picker to `CreateGroceryListModal` defaulting ON per D8C-Shared-8 (CF1).
>
> Estimated work: ~3.5–4 hr (service + types + modal + 2 call-site updates + smoke test).
>
> See `docs/PHASE_8_PANTRY_INTELLIGENCE.md` for architectural decisions D8C-Shared-1, D8C-Shared-4, D8C-Shared-5, D8C-Shared-8, plus the new D8C-Shared-CP2-3 (multi-space picker default = first-created accepted space).

---

## Context

CP1 shipped the schema + RLS floor. Service-layer queries still filter by `user_id` (owner-only); the sharing toggle in the creation modal doesn't exist; routing service still owner-only (CP3's scope). CP2 widens what the user can read and how lists get created.

**Three concurrent threads of work:**

1. **Service-query widening.** Drop the explicit `.eq('user_id', userId)` filter on the two list-read functions; let CP1's widened RLS handle owner+member visibility. Add space-name joins for CP4's subtitle data. Widen the cross-list ingredient query per D8C-Shared-5 (XL2 — owner OR shared-via-membership).

2. **P8-16 consolidation.** Resolve the duplicate `CreateGroceryListParams` interfaces. Service-internal version (in `lib/groceryListsService.ts`) currently requires `user_id` as a param and only writes 3 fields to the DB; canonical version (in `lib/types/grocery.ts`) doesn't have `user_id`, has a richer field set including the CP1-added `space_id`. Delete the service-internal one, import canonical, have `createGroceryList` resolve `user_id` itself via `supabase.auth.getUser()`, widen the insert body to write all canonical fields. Update 2 call sites that currently pass `user_id` explicitly.

3. **Modal sharing toggle.** Add the D8C-Shared-8 (CF1) inline toggle + picker. Defaults: toggle ON (sharing enabled), picker selected to first-created accepted space (D8C-Shared-CP2-3). For F&F's single-space case (Tom only has "Home"), the picker is effectively a single-option list. Pass `space_id` through to `createGroceryList` on submit. Toggle OFF → `space_id = null` (private).

**Junction RLS verification (do NOT redo).** Tom verified the live junction policies use parent-row reach-through (no `user_id` predicate). Junction visibility cascades automatically through CP1's `grocery_list_items` widening. CP2 has zero junction-table work.

**Deferred to later CPs (do NOT touch in CP2):**
- `addItemToList` populating `grocery_list_item_recipes.added_by` from `auth.uid()` → **CP3**
- Routing service (`routeStapleToGroceryList`) preferring shared lists → **CP3**
- Owner-only-hard-delete UI enforcement → **CP4**
- List-card subtitle render ("Shared with [space name]" / "Private") → **CP4**
- List-detail header icon (👥 / 🔒) → **CP4**
- Settings affordance for post-creation sharing edit → **CP4**

---

## Inputs to read

**Required:**
1. `docs/PHASE_8_PANTRY_INTELLIGENCE.md` — read the `### 8C-Shared` sub-phase block + Decisions Log entries D8C-Shared-1, 4, 5, 8 + D8C-Shared-CP2-3 (the new multi-space picker default = first-created decision).
2. `lib/groceryListsService.ts` — current shape of `getUserGroceryLists`, `getUserGroceryListsWithCounts`, `getOtherListsContainingIngredient`, `createGroceryList`, `addIngredientsToDefaultList`, and the service-internal `CreateGroceryListParams` interface. Note: this file is at `lib/` top-level, not `lib/services/`.
3. `lib/types/grocery.ts` — current shape of `GroceryList`, `GroceryListWithCounts`, `CreateGroceryListParams` (canonical, with CP1's `space_id` addition), `GroceryListItemRecipe`. Note CP1's three type extensions are already in place.
4. `lib/services/spaceService.ts` — locate the function that fetches the current user's accepted spaces. The modal needs this for the picker.
5. `components/CreateGroceryListModal.tsx` (path may be slightly different — locate by name or by usage in `screens/GroceryListsScreen.tsx`). The modal where the new toggle/picker UI lands.
6. `screens/GroceryListsScreen.tsx` — likely host of the modal; one of the 2 call sites for `createGroceryList` post-consolidation.
7. `docs/DEFERRED_WORK.md` — read P8-16 ("CreateGroceryListParams shape unification") for context on the consolidation. CP2 closes this item.
8. `docs/DOC_MAINTENANCE_PROCESS.md` Section 8 — canonical SESSION_LOG entry format.
9. `docs/PK_CODE_SNAPSHOTS.md` — Rule E check for `lib/types/grocery.ts` + `lib/groceryListsService.ts` after CP2 ships.

**Reference only (do not modify):**
- `lib/cookDepletionService.ts` — has its own `space_id` patterns for pantry-side flows; nothing to do here, just don't accidentally touch it.
- `screens/GroceryListDetailScreen.tsx` — list detail UX. CP2 doesn't change it; CP4 adds the icon header.

---

## Task

Five parts. Do them in order. Parts 1 and 2 can be done together since types and service file co-evolve; Part 3 depends on Part 2's types being in place.

### Part 1 — Type updates (`lib/types/grocery.ts`)

**1a. New `GroceryListWithSpace` interface.** Place after the existing `GroceryList` interface, before `GroceryListWithCounts`:

```typescript
// Phase 8C-Shared-CP2: GroceryList enriched with joined space name.
// Returned by getUserGroceryLists + getUserGroceryListsWithCounts when the
// service-side query joins spaces(name). space_name is null when space_id
// is null (private list); also null defensively if the join failed (e.g.,
// orphaned space_id pointing to a deleted space).
export interface GroceryListWithSpace extends GroceryList {
  space_name: string | null;
}
```

**1b. Re-root `GroceryListWithCounts` to extend `GroceryListWithSpace`.** Currently extends `GroceryList` directly:

```typescript
// Before:
export interface GroceryListWithCounts extends GroceryList {
  total_items: number;
  // ...
}

// After:
export interface GroceryListWithCounts extends GroceryListWithSpace {
  total_items: number;
  // ...
}
```

This means anyone using `GroceryListWithCounts` post-CP2 gets `space_name` for free. The aggregating function in the service layer (Part 2c) will populate it in the same pass as the count rollups.

**1c. Verify canonical `CreateGroceryListParams` shape.** This interface already has CP1's `space_id?: string | null` addition. Compare against the service-internal version in `lib/groceryListsService.ts` to confirm what fields P8-16 consolidation will need to bridge:

| Canonical field | Service-internal field | Action |
|----|----|----|
| `name: string` | `name: string` | Same |
| `emoji?` | (absent) | Add to insert body in Part 2e |
| `isActive?` (or `is_active?`) | (absent) | Add to insert body |
| `isTemplate?` (or `is_template?`) | (absent) | Add to insert body |
| `sortOrder?` (or `sort_order?`) | (absent) | Add to insert body |
| `storeName?` (or `store_name?`) | `store_name?: string` | Same field, possibly different case |
| `space_id?: string \| null` | (absent) | CP1 addition; new in service |
| (absent) | `user_id: string` | DELETE — `createGroceryList` resolves via `auth.getUser()` |

If the canonical interface uses mixed snake_case/camelCase (P8-16 noted "only `store_name` → `storeName` aligned in 8C-CP1a; larger refactor pending"), align ALL fields to whichever convention dominates the rest of the file. Prefer camelCase (per P8-16's stated direction). If aligning would change existing field names, do it now as part of the consolidation — the only currently-zero callers of `space_id` mean a rename `space_id` → `spaceId` is non-breaking. Note any aligned-rename in the SESSION_LOG.

### Part 2 — Service file updates (`lib/groceryListsService.ts`)

**2a. P8-16 consolidation — delete service-internal interface, import canonical.**

Delete the service-internal `CreateGroceryListParams` interface near the top of the file. Add import:

```typescript
import type { CreateGroceryListParams, GroceryListWithSpace } from './types/grocery';
```

(Adjust path if `lib/types/grocery.ts` is imported differently elsewhere in this file — match the existing import style.)

**2b. Modify `getUserGroceryLists`.**

Current shape:
```typescript
export async function getUserGroceryLists(userId: string): Promise<GroceryList[]> {
  // ...
  const { data, error } = await supabase
    .from('grocery_lists')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  // ...
}
```

Three changes:
1. Drop `.eq('user_id', userId)` — RLS gates visibility now (returns owner + shared-via-membership lists).
2. Add space-name join: `.select('*, space:spaces(name)')`.
3. Map result client-side to flatten `space.name` → `space_name` field; return `GroceryListWithSpace[]`.

The `userId` param can stay in the function signature for backwards compatibility — preserve it but flag in a code comment that RLS handles visibility now and the param is unused. Don't break callers.

Mapping pattern (reference from existing `getRecipesForItem` in the same file):
```typescript
type Row = GroceryList & { space: { name: string } | null };
const rows = (data as unknown as Row[]) || [];
return rows.map((r) => ({
  ...r,
  space_name: r.space?.name ?? null,
  space: undefined,  // strip the join scaffolding from the returned shape
})) as GroceryListWithSpace[];
```

**2c. Modify `getUserGroceryListsWithCounts`** (the variant with the `now_count`/`could_wait_count`/`in_cart_count` rollups added in 8C-CP1).

Same three changes as 2b: drop `.eq('user_id', userId)`, add `space:spaces(name)` to the select, map `space_name` field. Return type updates from `GroceryListWithCounts[]` to `GroceryListWithCounts[]` — the type itself now carries `space_name` via the new `extends GroceryListWithSpace` re-rooting from Part 1b. No return-type-name change needed.

The count aggregation logic (whatever shape it has — likely a join to `grocery_list_items` with COUNT/FILTER aggregates) does not need changes: count visibility is governed by item-level RLS, which CP1 widened. Members get accurate counts on shared lists automatically.

**2d. Modify `getOtherListsContainingIngredient`** (D8C-Shared-5: XL2 widening).

Current shape (search by name, find the function):
```typescript
.eq('user_id', userId)
.eq('is_active', true)
.eq('is_in_cart', false)
// ...
```

Drop `.eq('user_id', userId)`. RLS handles visibility — post-CP1, this returns lists the user can see (owner + shared-via-membership), which is exactly the XL2 scope. The other filters (`is_active`, `is_in_cart`, `ingredient_id`) all remain.

The defensive client-side post-filter on `list.user_id === userId` (if present) — DROP that too; it would re-narrow the result to owner-only and defeat the XL2 widening.

**2e. Modify `createGroceryList`.**

Current shape:
```typescript
export async function createGroceryList(params: CreateGroceryListParams): Promise<GroceryList> {
  // ...
  const { data, error } = await supabase
    .from('grocery_lists')
    .insert({
      user_id: params.user_id,
      name: params.name,
      store_name: params.store_name ?? null,
    })
    // ...
}
```

Three changes:
1. Resolve `user_id` from authenticated session:
   ```typescript
   const { data: { user }, error: authError } = await supabase.auth.getUser();
   if (authError || !user) {
     console.error('❌ createGroceryList: no authenticated user', authError);
     throw authError ?? new Error('Not authenticated');
   }
   ```
2. Widen the insert body to include all canonical fields:
   ```typescript
   .insert({
     user_id: user.id,
     name: params.name,
     emoji: params.emoji ?? undefined,         // DB default: '🛒'
     is_active: params.isActive ?? undefined,  // DB default: true
     is_template: params.isTemplate ?? undefined,  // DB default: false
     sort_order: params.sortOrder ?? undefined,    // DB default: 0
     store_name: params.storeName ?? null,
     space_id: params.spaceId ?? null,         // CP1 column; defaults to null (private) if not provided
   })
   ```
   Adjust field-name casing on the params side to whatever Part 1c settled. The DB-column-name side stays snake_case.
3. The function now requires the user to be authenticated. Existing callers that ran in unauthenticated contexts (if any) will surface an error — flag any such call sites in SESSION_LOG.

**2f. Update `createGroceryList` call sites.**

Two known call sites (find them via grep on `createGroceryList(`):
- **`addIngredientsToDefaultList`** in same file. Currently: `createGroceryList({ user_id: userId, name: 'This Week' })`. Update to: `createGroceryList({ name: 'This Week' })`. The outer `addIngredientsToDefaultList(userId, ...)` param stays — it's still used elsewhere in the function (e.g., the `getUserGroceryLists(userId)` lookup before falling through to creation).
- **Modal/screen call site** (likely `screens/GroceryListsScreen.tsx` or directly in `CreateGroceryListModal.tsx`). Currently passing `{ user_id: ..., name: ... }`; update to drop `user_id` and add `space_id` (Part 3 wires the latter). Find the exact location, update, ensure no orphan `userId` variables get stranded.

If grep surfaces a third call site I didn't anticipate, flag in SESSION_LOG and update consistently.

### Part 3 — `CreateGroceryListModal` updates

Locate the modal (likely `components/CreateGroceryListModal.tsx`; if it's inline in `screens/GroceryListsScreen.tsx`, work in that file's modal block).

**3a. Fetch user's accepted spaces on modal mount.**

Use `spaceService` (locate the function — likely `getUserSpaces` or `getAcceptedSpaces`). Call on modal open in a `useEffect`, store in component state. The fetched shape should be `{ id: string, name: string, created_at: string }[]` or similar — at minimum `id` and `name`; `created_at` lets us pick first-created.

If fetch fails or returns empty: graceful degrade. Default to private (toggle hidden, `space_id = null` on submit). Log the case but don't block creation.

**3b. Picker default per D8C-Shared-CP2-3.**

Order accepted spaces by `created_at` ASC. The first element is the default selection.

**3c. UI — inline toggle + picker.**

Add these elements to the modal's form, between any name/emoji inputs and the submit button:

- **Toggle:** label "Share this list" — defaults ON (per CF1).
- **Picker:** when toggle is ON, show the picker. Format: dropdown / segmented control / single-line label depending on accepted-spaces count:
  - **0 accepted spaces:** toggle disabled; show muted helper text ("No shared spaces available — list will be private"). `space_id = null`.
  - **1 accepted space:** picker renders as a static label "Sharing with [space name]". No interaction needed; default picker value = that single space's id.
  - **2+ accepted spaces:** dropdown or segmented control showing all accepted space names. Default value = first-created (per 3b).
- **Toggle OFF:** picker hidden; `space_id` resolves to `null` on submit.

Match existing modal styling — emoji picker / store-name input use whatever component primitives are already in this codebase. Don't introduce new UI libraries. Use the same form-field primitives.

**3d. Submit handler.**

When user submits, pass `space_id` to `createGroceryList`:
- Toggle ON, picker has selection: `space_id = picker_value`
- Toggle OFF (or 0 spaces): `space_id = null`

Use the canonical `CreateGroceryListParams` field name — `spaceId` if Part 1c renamed it; `space_id` if not.

**3e. Loading + error states.**

While accepted-spaces fetch is in-flight, disable the toggle/picker (show loading indicator). If fetch errors out, surface a non-blocking error and degrade to private-default. Don't block the user from creating a private list.

### Part 4 — P8-16 closure

Mark P8-16 as ✅ resolved in `docs/DEFERRED_WORK.md`:

1. Locate the P8-16 row.
2. Add a ✅ marker + resolution note: `✅ Resolved by 8C-Shared-CP2 (2026-04-XX). Service-internal CreateGroceryListParams deleted; canonical now imported throughout. createGroceryList resolves user_id via auth.getUser(). Field-naming convention aligned [camelCase / preserved per CC's call] across the canonical interface. Two call sites updated.`
3. Update version header on DEFERRED_WORK to bump (e.g., 5.14 → 5.15) per Rule for living-doc edits.
4. Prepend a changelog row at the top of the changelog table.

### Part 5 — Verification

**5a. CC-side (compile-level):**
- `npx tsc --noEmit` — confirm no new TypeScript errors. Pre-existing baseline errors (per CP1's SESSION_LOG: `CookSoonSection.tsx:264`, `DayMealsModal.tsx:296`, plus `node_modules/@react-navigation/core/lib/typescript/src/types.d.ts` parse errors) are expected; flag anything beyond.
- Lint pass on changed files. Match codebase conventions.

**5b. Smoke-test plan for Tom (capture in SESSION_LOG; Tom executes post-session):**

1. **Create a private list.** Open modal, set name, toggle OFF, submit. Confirm: list appears on `GroceryListsScreen`, DB row has `space_id = NULL`.
2. **Create a shared list (single-space case — Tom has only "Home").** Open modal, name, toggle ON (default), confirm picker shows "Home" as static label, submit. Confirm: list appears, DB row has `space_id = '7aa945ab-...'`.
3. **Verify outer-join behavior.** After creating both lists above, observe `GroceryListsScreen`. Both should render correctly. The `space_name` field should be `'Home'` for the shared list, `null` for the private list. Inspect via debug logging or React DevTools if needed — flag any join failure.
4. **Confirm the cross-list ingredient query widening.** With multiple shared lists containing the same ingredient, check off that ingredient on one list. The cross-list prompt (CookDepletion-style banner from 8C-CP2) should surface the OTHER shared lists too, not just owner-owned ones. Currently a no-op for Tom's solo setup but verify nothing regressed.
5. **(Cross-user, deferred until Mary's account is set up.)** Mary logs in on a separate device/sim. Confirm: she sees the shared lists Tom created. She can add items. Tom sees those items. Critical end-to-end test for CP1 + CP2 working in concert; not blocking CP2 ship if Mary's account isn't ready yet.

---

## Constraints

1. **No DB migration changes.** CP2 is service + UI only. The schema, RLS, and indexes shipped in CP1 are sufficient.
2. **No CP3 work bleed.** Don't touch `addItemToList`'s recipe-attribution write path (CP3 adds `auth.uid()` to `grocery_list_item_recipes.added_by`). Don't touch `routeStapleToGroceryList` (CP3 widens routing). Don't touch `cookDepletionService.ts`.
3. **No CP4 UX work.** Don't add the list-card subtitle render. Don't add the list-detail header icon. Don't add the post-creation sharing-edit affordance. Don't add owner-only-hard-delete UI enforcement.
4. **Match codebase conventions.** Use existing form-field primitives in the modal. Use existing service-layer error-logging patterns (`console.error('❌ ...')` + throw). Match the file's existing import style.
5. **Junction RLS verification not redone.** Tom verified during planning; CP2 does not query `grocery_list_item_recipes` directly.
6. **Field-naming convention.** Resolve P8-16's mixed convention by aligning ALL `CreateGroceryListParams` fields to whatever dominates the file. Note the rename if any (e.g., `space_id` → `spaceId`) in SESSION_LOG.
7. **`getUserGroceryLists`'s `userId` param is preserved-but-unused.** Don't remove it from the signature — that's a breaking change to callers. Add a code comment noting RLS handles visibility now.
8. **`createGroceryList` is now async-on-auth-resolution.** Was already async; just one more await. No call-site signature change.

---

## Verification checklist

Confirm before submitting:

- [ ] Part 1: `GroceryListWithSpace` interface added, `GroceryListWithCounts` re-rooted to extend it
- [ ] Part 1: `CreateGroceryListParams` field-naming convention reviewed; aligned consistently
- [ ] Part 2a: service-internal `CreateGroceryListParams` deleted; canonical imported
- [ ] Part 2b: `getUserGroceryLists` widened (RLS handles visibility, space-name joined, mapped to `GroceryListWithSpace[]`)
- [ ] Part 2c: `getUserGroceryListsWithCounts` widened (same 3 changes)
- [ ] Part 2d: `getOtherListsContainingIngredient` widened (drop owner-only filter, drop any defensive client-side filter)
- [ ] Part 2e: `createGroceryList` resolves user via `auth.getUser()`; insert body widened to all canonical fields; throws on no auth
- [ ] Part 2f: 2 (or more — flag if 3+) call sites updated; no orphan `userId` arg threading
- [ ] Part 3a: accepted-spaces fetch wired in modal `useEffect`
- [ ] Part 3b: first-created (by `created_at` ASC) selected as picker default
- [ ] Part 3c: toggle + picker rendered with correct degradation for 0 / 1 / 2+ accepted-spaces cases
- [ ] Part 3d: submit handler passes `space_id` (or `spaceId`) to `createGroceryList`; toggle OFF → null
- [ ] Part 3e: loading + error states handled gracefully
- [ ] Part 4: P8-16 marked ✅ resolved in DEFERRED_WORK.md with version bump + changelog row
- [ ] Part 5a: `tsc --noEmit` clean (baseline errors only)
- [ ] Part 5b: smoke-test plan documented in SESSION_LOG for Tom
- [ ] PK_CODE_SNAPSHOTS staleness flag set on `lib/groceryListsService.ts` AND `lib/types/grocery.ts` (HIGH, Last Touched By = "Phase 8C-Shared-CP2") per Rule E
- [ ] `_pk_sync/` copies staged for both `lib/groceryListsService.ts` + `lib/types/grocery.ts` (Tom uploads after commit)
- [ ] `components/CreateGroceryListModal.tsx` (or wherever the modal lives) considered for `_pk_sync/` if Tier 1; check PK_CODE_SNAPSHOTS

---

## SESSION_LOG entry format

Use the canonical Section 8 format. Include:

- **Phase:** 8C-Shared-CP2 (service layer + edit permissions + sharing toggle on creation)
- **Prompt from:** `docs/DRAFT_CC_PROMPT_8C-Shared-CP2.md` (or whatever path Tom uses)
- **Status:** Shipped / Blocked / Partial — with one-sentence reason
- **Scope:** What you did. Reference D8C-Shared-1, 4, 5, 8 + D8C-Shared-CP2-3 by ID. Note: P8-16 ✅ resolved as part of CP2 (consolidation thread).
- **Files modified:** Full list with line counts.
- **CC verification table:** TypeScript compile (✅ baseline only / new errors flagged), lint (✅ / list of warnings), call-site grep (2 found / 3 found).
- **Smoke-test plan for Tom:** the 5-item plan from Part 5b, repeated verbatim so Tom has a clean checklist.
- **`_pk_sync/` staging:** 2-3 files (`lib/groceryListsService.ts`, `lib/types/grocery.ts`, optionally the modal). Tom uploads after commit per standard workflow.
- **Recommended next steps for Tom:**
  - Run the 5-item smoke-test plan (steps 1-4 immediately; step 5 deferred until Mary's account is provisioned)
  - Commit (suggested: `feat(grocery): 8C-Shared-CP2 — service widening + sharing toggle + P8-16 consolidation`)
  - Reconcile living docs (Claude.ai handles in follow-up doc-hygiene CP — phase doc CP2 line flip + build plan note + v2.14 changelog row + P8-16 closure + new D8C-Shared-CP2-3 decision row)
  - Queue 8C-Shared-CP3 design (routing service + cross-list query handled in CP2 already; CP3's remaining scope is `addItemToList.added_by` population + `routeStapleToGroceryList` shared-list preference — narrower than originally scoped)
- **Surprises / Notes for Claude.ai:**
  - Anything unexpected: 3rd `createGroceryList` call site discovered, modal location not where prompt assumed, canonical interface field-naming dominant convention determination, etc.
  - If field-naming alignment changed any currently-existing field name (e.g., `store_name` → `storeName` was already done; if `space_id` → `spaceId` happens, note it), document for downstream awareness.
  - Outer-join behavior on `space:spaces(name)` — confirm via smoke test that `space_id IS NULL` lists return `space_name = null` rather than throwing or returning a stale value.
  - Any modal UX deviation from prompt's spec — if the existing modal's primitives don't support a clean toggle+picker combination, propose alternative and flag.
  - 16th visible 2026-04-27/28+ SESSION_LOG entry across the Phase 8C arc.

---

## Open questions for CC to flag

If any of these are NOT true at runtime, flag in SESSION_LOG:

- The canonical `CreateGroceryListParams` in `lib/types/grocery.ts` actually has `space_id?: string | null` from CP1 (verify by reading)
- The service-internal `CreateGroceryListParams` exists in `lib/groceryListsService.ts` and is the duplicate P8-16 references
- `getUserGroceryListsWithCounts` exists (added in 8C-CP1)
- `getOtherListsContainingIngredient` filters on `user_id` currently (the function added in 8C-CP2, the cross-list checkoff prompt)
- `CreateGroceryListModal` exists as a separate component file (vs. inline in `GroceryListsScreen.tsx`)
- A space service function exists that returns the user's accepted spaces with `id`, `name`, `created_at` (or equivalents that let the modal pick the first-created)
- Exactly 2 call sites for `createGroceryList` post-grep (flag if 1 or 3+)

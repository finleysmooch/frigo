# 8R-CP2a — Types + Tags Service + Supplies Service

**Phase:** 8R — Unified Household Needs  
**Checkpoint:** CP2a (of CP2a / CP2b split)  
**Type:** Service layer foundation  
**Estimated:** 1 session

---

## Context

Phase 8R replaces the old grocery-lists + pantry-staples model with a unified supplies/needs/tags/views model. CP1 shipped the schema migration (all old tables dropped; 8 new tables live with RLS, indexes, triggers, and 4 default views seeded for Tom + Mary's space).

CP2a creates the type definitions and two of the four new services. CP2b (next session) adds needsService + viewsService + deletes old service files.

**Decision references:** D8R-Q1 through Q48 in `docs/PHASE_8R_UNIFIED_NEEDS.md`. Key ones for this checkpoint:
- Q7: supply status cycle (in_stock → low → critical → out → in_stock)
- Q10β: spawn-on-out (service-level, not DB trigger — Q41)
- Q14: identity = ingredient_id XOR custom_name
- Q27/Q37: for_user_ids write semantics (empty = everyone; explicit = frozen)
- Q35: initial supply status restricted to in_stock/low/out
- Q39: split tag tables (supply_tags + need_tags)
- Q44: services in lib/services/
- Q45: split type files (supplies.ts, needs.ts, tags.ts, views.ts)
- Q46: all param/return types in canonical type files; NO service-internal type defs
- Q48: spawn idempotency (check for existing active need before spawning)

---

## Inputs to read

1. `docs/PHASE_8R_UNIFIED_NEEDS.md` — decisions log (Q1-Q48).
2. `supabase/migrations/` — find the 8R-CP1 migration file for exact column names, CHECK constraints, and FK relationships.
3. `lib/types/pantry.ts` — reference for existing type conventions (Omit patterns, Insert/Update types).
4. `lib/types/grocery.ts` — reference for existing type conventions.
5. `lib/services/spaceService.ts` — reference for Supabase client usage, error handling, logging patterns.
6. `lib/pantryStaplesService.ts` — reference for service patterns (state cycling, error classes, sort logic, emoji logging). **Read only — do not modify.**
7. `lib/supabase.ts` — Supabase client import pattern.
8. `docs/DOC_MAINTENANCE_PROCESS.md` Section 8 — SESSION_LOG entry format.
9. `docs/CLAUDE.md` — session logging rules + tracker row format.

---

## Task

Create 6 files:

### Part 1 — Type files (4 files in `lib/types/`)

#### `lib/types/tags.ts`

```typescript
export type TagDimension = 'store' | 'urgency' | 'recipe' | 'event' | 'storage';

export interface Tag {
  id: string;
  space_id: string;
  dimension: TagDimension;
  value: string;
  created_by: string | null;
  created_at: string;
}

export interface SupplyTagRow {
  id: string;
  supply_id: string;
  tag_id: string;
  created_at: string;
}

export interface NeedTagRow {
  id: string;
  need_id: string;
  tag_id: string;
  created_at: string;
}
```

#### `lib/types/supplies.ts`

```typescript
import { Tag } from './tags';

export type SupplyStatus = 'in_stock' | 'low' | 'critical' | 'out';

// The 3 statuses allowed at creation time (Q35: critical only via state-cycling)
export type SupplyInitialStatus = 'in_stock' | 'low' | 'out';

export interface Supply {
  id: string;
  space_id: string;
  ingredient_id: string | null;
  custom_name: string | null;
  status: SupplyStatus;
  for_user_ids: string[];
  brands: string[];
  added_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplyIngredient {
  id: string;
  name: string;
  plural_name: string | null;
  family: string;
  ingredient_type: string | null;
  typical_store_section: string | null;
}

export interface SupplyWithTags extends Supply {
  tags: Tag[];
  ingredient: SupplyIngredient | null;
}

export interface CreateSupplyParams {
  spaceId: string;
  ingredientId?: string;
  customName?: string;
  status: SupplyInitialStatus;
  forUserIds?: string[];
  brands?: string[];
  addedBy: string;
  notes?: string;
  tagIds?: string[];
}

export interface UpdateSupplyParams {
  customName?: string;
  forUserIds?: string[];
  brands?: string[];
  notes?: string;
}

// Return type for status-change operations (includes optional spawned need)
export interface SupplyStatusResult {
  supply: SupplyWithTags;
  spawnedNeed?: {
    id: string;
    ingredient_id: string | null;
    custom_name: string | null;
    status: string;
    supply_id: string;
  };
}
```

#### `lib/types/needs.ts`

```typescript
import { Tag } from './tags';

export type NeedStatus = 'need' | 'in_cart' | 'acquired';
export type NeedAddedFrom = 'recipe' | 'supply_spawn' | 'manual';

export interface Need {
  id: string;
  space_id: string;
  ingredient_id: string | null;
  custom_name: string | null;
  status: NeedStatus;
  quantity_display: number | null;
  unit_display: string | null;
  for_user_ids: string[];
  supply_id: string | null;
  added_by: string | null;
  added_from: NeedAddedFrom | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface NeedIngredient {
  id: string;
  name: string;
  plural_name: string | null;
  family: string;
  ingredient_type: string | null;
  typical_store_section: string | null;
}

export interface NeedWithTags extends Need {
  tags: Tag[];
  ingredient: NeedIngredient | null;
}

export interface NeedRecipe {
  id: string;
  need_id: string;
  recipe_id: string;
  recipe_quantity_amount: number | null;
  recipe_quantity_unit: string | null;
  added_by: string | null;
  created_at: string;
  recipe_title?: string;
}

export interface NeedWithDetails extends NeedWithTags {
  recipes: NeedRecipe[];
}

export interface CreateNeedParams {
  spaceId: string;
  ingredientId?: string;
  customName?: string;
  status?: NeedStatus;
  quantityDisplay?: number;
  unitDisplay?: string;
  forUserIds?: string[];
  supplyId?: string;
  addedBy: string;
  addedFrom: NeedAddedFrom;
  notes?: string;
  tagIds?: string[];
}

export interface AddNeedFromRecipeParams {
  spaceId: string;
  ingredientId: string;
  quantityDisplay: number;
  unitDisplay: string;
  recipeId: string;
  recipeQuantityAmount?: number;
  recipeQuantityUnit?: string;
  addedBy: string;
  tagIds?: string[];
}

export interface UpdateNeedParams {
  quantityDisplay?: number;
  unitDisplay?: string;
  forUserIds?: string[];
  notes?: string;
}

// Display-merged group for view rendering (Q28/Q36)
export interface MergedNeedGroup {
  key: string;
  ingredientId: string | null;
  customName: string | null;
  unitDisplay: string | null;
  forUserIds: string[];
  storeTagIds: string[];
  totalQuantity: number | null;
  needs: NeedWithDetails[];
  allRecipes: NeedRecipe[];
}
```

#### `lib/types/views.ts`

```typescript
import { TagDimension } from './tags';

export type RenderMode = 'tier' | 'aisle' | 'flat';
export type ViewFilterDimension = 'status' | TagDimension;

export interface View {
  id: string;
  space_id: string;
  name: string;
  emoji: string;
  is_default: boolean;
  is_hidden: boolean;
  render_mode: RenderMode;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViewFilter {
  id: string;
  view_id: string;
  dimension: ViewFilterDimension;
  values: string[];
  created_at: string;
}

export interface ViewWithFilters extends View {
  filters: ViewFilter[];
}

export interface CreateViewParams {
  spaceId: string;
  name: string;
  emoji?: string;
  renderMode?: RenderMode;
  filters: ViewFilterInput[];
  createdBy: string;
}

export interface ViewFilterInput {
  dimension: ViewFilterDimension;
  values: string[];
}

export interface UpdateViewParams {
  name?: string;
  emoji?: string;
  renderMode?: RenderMode;
  sortOrder?: number;
}
```

### Part 2 — tagsService (`lib/services/tagsService.ts`)

Import `supabase` from `../supabase`. Import types from `../types/tags`.

**Functions to implement:**

```typescript
// ----- Tag CRUD -----

// Get all tags for a space, optionally filtered by dimension.
// Sort: alphabetical by value within each dimension.
getTagsForSpace(spaceId: string, dimension?: TagDimension): Promise<Tag[]>

// Get a single tag by ID. Returns null if not found / RLS-hidden.
getTagById(tagId: string): Promise<Tag | null>

// Find-or-create pattern. If tag exists (space + dimension + value), return it.
// If not, create and return. Avoids duplicate tag values.
// IMPORTANT: case-insensitive match on value (trim + lowercase comparison).
getOrCreateTag(spaceId: string, dimension: TagDimension, value: string, createdBy: string): Promise<Tag>

// Delete a tag. CASCADE handles junction rows automatically.
deleteTag(tagId: string): Promise<void>

// ----- Supply tag management (Q39) -----

// Get tags attached to a supply. Returns Tag[] (not junction rows).
// Query: supply_tags JOIN tags, filtered by supply_id.
getSupplyTags(supplyId: string): Promise<Tag[]>

// Replace all tags on a supply. Delete existing supply_tags, insert new ones.
// Idempotent: calling with same tagIds is a no-op structurally.
setSupplyTags(supplyId: string, tagIds: string[]): Promise<void>

// Add a single tag to a supply. No-op if already attached (upsert-style).
addSupplyTag(supplyId: string, tagId: string): Promise<void>

// Remove a single tag from a supply. No-op if not attached.
removeSupplyTag(supplyId: string, tagId: string): Promise<void>

// ----- Need tag management (Q39) -----
// Parallel structure to supply tag functions.

getNeedTags(needId: string): Promise<Tag[]>
setNeedTags(needId: string, tagIds: string[]): Promise<void>
addNeedTag(needId: string, tagId: string): Promise<void>
removeNeedTag(needId: string, tagId: string): Promise<void>
```

**Logging:** Use 🏷️ emoji prefix for tag operations, ❌ for errors.

### Part 3 — suppliesService (`lib/services/suppliesService.ts`)

Import `supabase` from `../supabase`. Import types from `../types/supplies`, `../types/tags`, `../types/needs` (for the spawn return shape).

**Functions to implement:**

```typescript
// ----- READ -----

// Get all supplies for a space with ingredient + tags eagerly loaded.
// Supabase query: select('*, ingredient:ingredients(...), supply_tags(tag:tags(*))')
// Flatten supply_tags from [{tag: Tag}] to Tag[] in mapping.
// Sort: out → critical → low → in_stock, then alphabetical by display name.
getSuppliesForSpace(spaceId: string): Promise<SupplyWithTags[]>

// Single supply by ID with ingredient + tags. Returns null if not found.
getSupplyById(supplyId: string): Promise<SupplyWithTags | null>

// Filtered by status array.
getSuppliesByStatus(spaceId: string, statuses: SupplyStatus[]): Promise<SupplyWithTags[]>

// ----- CREATE -----

// Create a supply. Validates initial status is in_stock/low/out (Q35).
// If tagIds provided, calls tagsService.setSupplyTags after insert.
// for_user_ids: defaults to [] if not provided (Q37 — empty = everyone).
createSupply(params: CreateSupplyParams): Promise<SupplyWithTags>

// ----- UPDATE -----

// Update non-status fields on a supply.
updateSupply(supplyId: string, params: UpdateSupplyParams): Promise<SupplyWithTags>

// Set status directly (tap-to-set on detail view per Q30).
// **SPAWN-ON-OUT LOGIC (Q10β + Q41 + Q48):**
//   If newStatus is 'out':
//     1. Check for existing active need where supply_id = this supply AND status IN ('need', 'in_cart')
//     2. If one exists → skip spawn (Q48 idempotency)
//     3. If none → INSERT into needs:
//        - same ingredient_id / custom_name
//        - same for_user_ids
//        - supply_id = this supply's id
//        - added_from = 'supply_spawn'
//        - status = 'need'
//        - quantity_display = null, unit_display = null (supplies don't track quantity per Q15)
//        Then copy store-dimension tags from supply to the new need (via need_tags)
//   Return SupplyStatusResult with supply + optional spawnedNeed.
setSupplyStatus(supplyId: string, newStatus: SupplyStatus): Promise<SupplyStatusResult>

// Cycle status: in_stock → low → critical → out → in_stock (Q7).
// Calls setSupplyStatus internally for the spawn-on-out path.
cycleSupplyStatus(supplyId: string): Promise<SupplyStatusResult>

// ----- DELETE -----

deleteSupply(supplyId: string): Promise<void>

// ----- HELPERS -----

// Pure function. Returns ingredient.name if available, else custom_name.
getSupplyDisplayName(supply: SupplyWithTags): string
```

**Spawn-on-out implementation detail:**

The spawn must copy store-dimension tags from the supply to the new need. Sequence:
1. Read supply's current tags (via supply_tags junction).
2. Filter to dimension = 'store' tags only.
3. After inserting the new need, insert need_tags rows for those store tag IDs.

This is 3-4 Supabase calls (read supply + tags, update status, insert need, insert need_tags). Not transactional, but Q48 idempotency prevents double-spawn. At F&F scale, acceptable.

**Error handling:**
- `SupplyNotFoundError` — thrown by getById / setStatus / cycle when ID not found or RLS-hidden.
- `InvalidInitialStatusError` — thrown by createSupply if status is 'critical'.
- Error classes defined in the service file (these are runtime constructs, not data shapes — Q46 applies to interfaces/types, not error classes).

**Logging:** Use 📦 emoji prefix (matches pantryStaplesService convention), ❌ for errors.

**Sort order for getSuppliesForSpace:**
```
1. out         (most urgent)
2. critical
3. low
4. in_stock

Within each status group: alphabetical by display name.
```

Implement via application-level sort after Supabase fetch (the sort depends on display name which is a joined field).

---

## Constraints

1. **6 files only.** 4 type files + 2 service files. No UI changes. No screen modifications.
2. **No service-internal type definitions (Q46).** All interfaces and type aliases used as function params or return types MUST live in `lib/types/`. Error classes are exempt (runtime constructs).
3. **Use existing Supabase client pattern.** `import { supabase } from '../supabase'`.
4. **RLS does the space-access check.** Do NOT duplicate space-membership checks in service code.
5. **All DB access through Supabase client.** No raw SQL beyond `.rpc()` (shouldn't be needed for CP2a).
6. **Do NOT modify old services.** `pantryStaplesService.ts`, `groceryListsService.ts`, `groceryService.ts` stay untouched. Deletion happens in CP2b.
7. **Do NOT modify any screens or UI components.**
8. **Keep each service file under ~400 lines.** If approaching limit, split helpers into a separate module.
9. **tagsService must NOT import from suppliesService or vice versa.** Keep services independent. suppliesService does its own Supabase calls for spawn logic (INSERT into needs + need_tags tables directly), not through a future needsService.

---

## Verification steps

Before marking complete:

1. **TypeScript compiles clean.** `npx tsc --noEmit 2>&1 | grep -c "error TS"` — count must be **equal to or less than** the count before this session (record the "before" count at session start). Zero new errors introduced.
2. **All exported function signatures match the stubs above.** If you deviated, explain why in SESSION_LOG.
3. **All param/return types importable from `lib/types/`.** Run: `grep "interface\|type " lib/types/tags.ts lib/types/supplies.ts lib/types/needs.ts lib/types/views.ts` and confirm every param/return used by services is defined there.
4. **No service-internal type definitions.** Run: `grep "interface\|type " lib/services/tagsService.ts lib/services/suppliesService.ts` — should only show error classes, not interfaces or type aliases.
5. **tagsService has 12 exported functions** (4 CRUD + 4 supply-tag + 4 need-tag).
6. **suppliesService has 8 exported functions** (3 read + 1 create + 1 update + 2 status + 1 delete) + 1 pure helper.
7. **Spawn-on-out path includes Q48 idempotency check.** Read the `setSupplyStatus` function and confirm: before inserting a need, it queries `needs` table for `supply_id = X AND status IN ('need', 'in_cart')`. If found, skip spawn.
8. **createSupply rejects 'critical' as initial status (Q35).** Confirm the validation exists.
9. **No React or UI imports in any new file.** Run: `grep -r "from 'react\|from 'react-native" lib/types/tags.ts lib/types/supplies.ts lib/types/needs.ts lib/types/views.ts lib/services/tagsService.ts lib/services/suppliesService.ts` — 0 matches.
10. **File line counts.** Report `wc -l` for each of the 6 new files.

---

## SESSION_LOG entry format

```
## 8R-CP2a — Types + Tags Service + Supplies Service
**Date:** YYYY-MM-DD
**Status:** ✅ Complete | ⚠️ Partial | ❌ Blocked

**Files created:**
- lib/types/tags.ts (N lines)
- lib/types/supplies.ts (N lines)
- lib/types/needs.ts (N lines)
- lib/types/views.ts (N lines)
- lib/services/tagsService.ts (N lines)
- lib/services/suppliesService.ts (N lines)

**TypeScript error count:** before=N, after=N (delta=±N)

**Function inventory:**
- tagsService: N exported functions
- suppliesService: N exported functions + N helpers

**Spawn-on-out Q48 check:** [confirmed / deviation noted]
**Q35 initial status validation:** [confirmed / deviation noted]

**Deviations from prompt:** [list or "none"]

**Recommended next steps:** CP2b (needsService + viewsService + old service deletion)
```

---

## Tracker row

```
| 8R-CP2a | Types + tagsService + suppliesService | lib/types/{tags,supplies,needs,views}.ts, lib/services/{tagsService,suppliesService}.ts | — |
```

# 8R-CP4.5 — UnitPicker Fix + Dead-Code Purge

**Phase:** 8R — Unified Household Needs  
**Checkpoint:** CP4.5 (mini — mechanical cleanup between CP4 and CP5)  
**Type:** Bug fix + file deletions  
**Estimated:** <30 min

---

## Context

CP4 deleted `pantryService.ts`. This created a runtime regression in `UnitPicker.tsx` (dynamic import of deleted module) and left 11 orphaned files with broken imports. Both are mechanical fixes — no architectural decisions, no UI redesign.

---

## Inputs to read

1. `components/UnitPicker.tsx` — the file to fix. Study the dynamic imports of `pantryService` (`getIngredientUnits`, `getAllMeasurementUnits`). Understand what they return and how the component uses the results.
2. `lib/pantryService.ts` — **deleted**, but retrievable via `git show HEAD~1:lib/pantryService.ts` (or check SESSION_LOG for the function signatures). The two functions query `measurement_units` and `ingredient_common_units` tables.
3. `lib/supabase.ts` — Supabase client import path.
4. `docs/CLAUDE.md` — session logging rules.

---

## Task

### Part 1 — Fix UnitPicker runtime regression

`components/UnitPicker.tsx` uses dynamic imports:
```typescript
const { getIngredientUnits } = await import('../lib/pantryService');
const { getAllMeasurementUnits } = await import('../lib/pantryService');
```

These throw at runtime because `pantryService.ts` was deleted in CP4.

**Fix:** Replace the dynamic imports with direct Supabase queries inline in UnitPicker. The `measurement_units` table is live (not dropped in CP1).

The old `getIngredientUnits(ingredientId)` did:
```sql
SELECT mu.* FROM ingredient_common_units icu
JOIN measurement_units mu ON mu.id = icu.unit_id
WHERE icu.ingredient_id = $1
ORDER BY icu.sort_order
```

The old `getAllMeasurementUnits()` did:
```sql
SELECT * FROM measurement_units ORDER BY sort_order
```

Replace the dynamic imports with equivalent inline Supabase calls:
```typescript
import { supabase } from '../lib/supabase';

// Where getIngredientUnits was called:
const { data } = await supabase
  .from('ingredient_common_units')
  .select('unit_id, sort_order, measurement_units(id, unit, display_singular, display_plural)')
  .eq('ingredient_id', ingredientId)
  .order('sort_order');

// Where getAllMeasurementUnits was called:
const { data } = await supabase
  .from('measurement_units')
  .select('id, unit, display_singular, display_plural, sort_order')
  .order('sort_order');
```

Adapt the result mapping to match UnitPicker's existing `UnitOption` interface (or whatever shape it expects). The key fields are: `unit_id` (or `id`), `display_name` (from `display_plural`), `is_common` (true for ingredient-specific results, false for all-units fallback), and `sort_order`.

Remove any remaining `pantryService` references from the file. Add `import { supabase } from '../lib/supabase'` if not already present.

### Part 2 — Dead-code purge

Delete these 11 files. All confirmed zero-consumer post-CP4 (per CP4 SESSION_LOG orphan analysis):

1. `components/AddPantryItemModal.tsx`
2. `components/ItemDetailModal.tsx`
3. `components/QuickAddModal.tsx`
4. `components/QuantityPicker.tsx`
5. `components/StoragePicker.tsx`
6. `components/ExpirationPicker.tsx`
7. `components/StorageChangePrompt.tsx`
8. `components/RemainderPrompt.tsx`
9. `components/InlineStoragePicker.tsx`
10. `lib/services/highlightsService.ts`
11. `utils/pantryConversions.ts`

**Before bulk-deleting**, run a single grep to confirm zero live consumers:
```bash
grep -rn "AddPantryItemModal\|ItemDetailModal\|QuickAddModal\|QuantityPicker\|StoragePicker\|ExpirationPicker\|StorageChangePrompt\|RemainderPrompt\|InlineStoragePicker\|highlightsService\|pantryConversions" screens/ components/ lib/ contexts/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v SESSION_LOG | grep -v CLAUDE.md
```

If any match appears in a file NOT in the deletion list, note it in SESSION_LOG and either:
- (a) If it's a comment/doc reference → safe to proceed with deletion.
- (b) If it's a live import in a non-orphaned file → do NOT delete that target. Note in SESSION_LOG for Claude.ai.

---

## Constraints

1. **Do NOT modify** any service files (`suppliesService`, `needsService`, etc.).
2. **Do NOT modify** any screen files except `UnitPicker.tsx`.
3. **Verification is grep-based** (per tsc-blindness process).

---

## Verification steps

1. **UnitPicker has zero pantryService references.** Run:
   ```
   grep "pantryService" components/UnitPicker.tsx
   ```
   Expected: 0 matches.

2. **UnitPicker imports supabase.** Run:
   ```
   grep "supabase" components/UnitPicker.tsx
   ```
   Expected: at least 1 match.

3. **All 11 files deleted.** Run:
   ```
   ls components/AddPantryItemModal.tsx components/ItemDetailModal.tsx components/QuickAddModal.tsx components/QuantityPicker.tsx components/StoragePicker.tsx components/ExpirationPicker.tsx components/StorageChangePrompt.tsx components/RemainderPrompt.tsx components/InlineStoragePicker.tsx lib/services/highlightsService.ts utils/pantryConversions.ts 2>&1
   ```
   Expected: "No such file or directory" for all 11.

4. **Zero orphaned pantry-era references remaining.** Run:
   ```
   grep -rn "pantryService\|pantryStaplesService\|types/pantry\|pantryConversions\|PantryItem\|PantryStaple\|StapleState\|StapleCell\|StaplesGrid" lib/ screens/ components/ contexts/ utils/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v SESSION_LOG | grep -v CLAUDE.md
   ```
   List any remaining references. Expected: only (a) the `GroceryListDetailScreen.tsx` `setStapleState` import (CP5 scope) and (b) comment-only references in renamed files.

5. **File line counts.** Report `wc -l` for UnitPicker.tsx (before and after).

---

## SESSION_LOG entry format

```
## 2026-MM-DD — 8R-CP4.5 — UnitPicker Fix + Dead-Code Purge

**Phase:** 8R-CP4.5
**Status:** ✅ Complete | ⚠️ Partial | ❌ Blocked

**Files modified:**
- components/UnitPicker.tsx (was N lines → now N lines)

**Files deleted (11):**
- [list each with line count]

**Pre-deletion grep results:** [any unexpected matches noted]
**Post-deletion grep (step 4):** [remaining refs listed]

**Verification (5 steps):** [pass/fail for each]
**Deviations from prompt:** [list or "none"]
**Recommended next steps:** Smoke-test, then CP5
```

---

## Tracker row

```
| 8R-CP4.5 | UnitPicker fix + dead-code purge | UnitPicker.tsx pantryService→direct Supabase; 11 orphaned files deleted | — |
```

# 8R-CP4.6 — highlightsService Stub + pantryHelpers Deletion

**Phase:** 8R  
**Checkpoint:** CP4.6 (micro — 2 changes)  
**Estimated:** <10 min

---

## Task

### Part 1 — Stub `calculateBulkPantryMatch` in `lib/services/highlightsService.ts`

The file imports `calculateBulkPantryMatch` from `'../pantryService'` (deleted in CP4). Three screens consume highlightsService (CookDetailScreen, FeedScreen, MealDetailScreen) and will throw at runtime.

**Fix:** Remove the `pantryService` import. Add an inline stub at the top of the file:

```typescript
// Stub: pantryService deleted in 8R-CP4. Highlights pantry-match disabled until 8R rewire.
// TODO: 8R-CP6 — rewire against suppliesService.getSuppliesForSpace for real matching.
const calculateBulkPantryMatch = async (..._args: any[]): Promise<Map<string, number>> => new Map();
const calculateBulkSpacePantryMatch = async (..._args: any[]): Promise<Map<string, number>> => new Map();
```

Check whether `calculateBulkSpacePantryMatch` is also imported from pantryService — if so, stub it too (same pattern). Remove ALL pantryService imports from the file. Do not modify any other logic.

### Part 2 — Delete `utils/pantryHelpers.ts`

Confirmed 0 live consumers (CP4.5 SESSION_LOG: `grep -rn "from.*pantryHelpers"` returned 0 hits). Delete the file.

---

## Verification

1. `grep "pantryService" lib/services/highlightsService.ts` — 0 import matches (stub comment is fine).
2. `ls utils/pantryHelpers.ts 2>&1` — "No such file or directory".
3. `grep -rn "pantryHelpers" lib/ screens/ components/ utils/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v SESSION_LOG | grep -v CLAUDE.md` — 0 matches.

---

## SESSION_LOG entry

```
## 2026-MM-DD — 8R-CP4.6 — highlightsService Stub + pantryHelpers Deletion

**Phase:** 8R-CP4.6
**Status:** ✅ Complete

**Files modified:**
- lib/services/highlightsService.ts — pantryService import replaced with inline stubs

**Files deleted:**
- utils/pantryHelpers.ts (484 lines)

**Verification:** [pass/fail for each of 3 steps]
**Deviations:** [list or "none"]
```

## Tracker row

```
| 8R-CP4.6 | highlightsService stub + pantryHelpers deletion | highlightsService.ts pantryService→stub; pantryHelpers.ts deleted | — |
```

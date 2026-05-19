# CC Prompt — Phase 8R-CP6a: Service dedup + Add-Need polish + Pantry long-press

**Phase:** 8R-CP6a (small/low-risk: service-layer dedup + 2 UX polish items)
**Predecessor:** 8R-CP5b shipped 2026-04-30. Pantry/grocery-era purge complete.
**Successor:** 8R-CP6b (Tab 12 supply create + Tab 9 spawn toast + edit-need modal). CP6a is prerequisite for CP6b's Tab 12 (which calls `createNeed` for the "save as regular AND add to needs" path) and for CP6c's bulk-acquire (which builds on createNeed dedup).

---

## Context

CP6 was originally scoped with 5 items but PK review of repo state on 2026-04-30 surfaced:
- **Item 2 ("RecipeDetailScreen pantry-match fix") is not needed** — the screen already migrated to `getSuppliesForSpace` in a prior CP. The basmati-rice smoke-test bug was a data-shape issue (likely Tom's "basmati rice" supply was added via AddNeedSheet T3 with `ingredient_id=null`, while the recipe's matching ingredient has an `ingredient_id` from catalog), not a code bug. Deferred to D20 catalog audit + monitoring.
- **Item 3 ("UnitPicker swap") is not buildable as scoped** — no standalone UnitPicker component exists; CP4.5's "UnitPicker rewrite" was actually deletion of pantryService unit helpers. Building one is medium effort + not F&F-blocking. Deferred to DEFERRED_WORK as P8R-D22.
- **Item 5 ("highlightsService rewire") was scope creep** — Tom never reported feed highlights as broken; the pantry-match signal silently returns 0% but cuisine_match falls through. Deferred to DEFERRED_WORK as P8R-D23.

CP6a's actual scope is 3 items: service-layer dedup + 2 small component polish items.

---

## Inputs to read

1. `lib/services/needsService.ts` (current state in `_pk_sync/lib__services__needsService_2026-04-30.ts`) — `createNeed` function signature + body. Item 1 modifies this.
2. `components/AddNeedSheet.tsx` (current state in `_pk_sync/components__AddNeedSheet_2026-04-30.tsx`) — search/autocomplete useEffect block + `handleSelectResult`. Item 2 modifies the result composition.
3. `components/pantry/SupplyRow.tsx` (current state in `_pk_sync/components__pantry__SupplyRow_2026-04-30.tsx`) — dot-tap handler. Item 3 adds long-press handler.
4. `lib/services/suppliesService.ts` — for `setSupplyStatus(supplyId, newStatus)` signature (called by item 3's action-sheet handlers).
5. `lib/types/needs.ts` — `CreateNeedParams` type (verify `supply_id` is optional + nullable, which it is from CP5b).
6. `lib/types/supplies.ts` — `SupplyStatus` enum (verify values: `'in_stock' | 'low' | 'critical' | 'out'`).
7. `docs/PHASE_8R_UNIFIED_NEEDS.md` v0.5 — D8R-Q21 (configure-once-and-done) + Q35 (supply state restrictions on create) for context only; CP6a doesn't touch those decisions.
8. `docs/SESSION_LOG.md` — last entry (CP5b ship). CP6a's entry follows the same shape.

---

## Task

### Part 1 — `needsService.createNeed` supply_id dedup hoisting

**Why:** Smoke test (2026-04-30) confirmed AddNeedSheet T1 fast path can create duplicate active needs for the same supply if user adds twice. ExpandedRegularsSheet has inline dedup (CP5b Q2 fix); the rest don't. Hoisting to service-layer means all consumers benefit (AddNeedSheet T1, ExpandedRegularsSheet, future bulk-acquire flow, addNeedFromRecipe).

**Edits to `lib/services/needsService.ts`:**

In `createNeed`, BEFORE the insert block, add a dedup check that runs ONLY when `params.supplyId` is set (not null):

```ts
// Dedup: when supply_id is set, return the existing active need
// (status IN ('need','in_cart')) for the same space + supply rather than
// create a duplicate. Resolves CP5b Q2 race + closes AddNeedSheet T1 gap.
// Acquired needs do NOT block — the user can re-add a supply they already
// finished with.
if (params.supplyId) {
  const { data: existing, error: dedupError } = await supabase
    .from('needs')
    .select(NEED_SELECT)
    .eq('space_id', params.spaceId)
    .eq('supply_id', params.supplyId)
    .in('status', ['need', 'in_cart'])
    .maybeSingle();

  if (dedupError) {
    console.error('❌ Error checking dedup for createNeed:', dedupError);
    throw dedupError;
  }

  if (existing) {
    console.log('🛒 createNeed dedup hit — returning existing need:', (existing as any).id);
    // Optionally extend tags: union the requested tagIds with the existing
    // need's tags. This handles the "Tom adds 'urgent' tag to a need that
    // exists without it" case. If params.tagIds is empty/undefined, no-op.
    if (params.tagIds && params.tagIds.length > 0) {
      const existingTagIds = ((existing as any).need_tags ?? [])
        .map((row: any) => row.tag?.id)
        .filter((id: string | undefined) => !!id) as string[];
      const merged = Array.from(new Set([...existingTagIds, ...params.tagIds]));
      if (merged.length > existingTagIds.length) {
        await setNeedTags((existing as any).id, merged);
      }
    }
    // Re-read to return the joined shape with potentially updated tags.
    const refreshed = await getNeedByIdWithTagsOnly((existing as any).id);
    if (!refreshed) throw new NeedNotFoundError((existing as any).id);
    return refreshed;
  }
}
```

Keep the existing insert block UNCHANGED below this guard.

**Implementation notes:**
- The `NEED_SELECT` constant should already exist in needsService — used by `getNeedByIdWithTagsOnly`. Verify by grep before referencing; if it has a different name, use the correct one. **STOP and flag** if the constant doesn't exist or has a different shape.
- Use `.maybeSingle()` not `.single()` — zero rows is the expected non-dedup case and shouldn't throw.
- The tag-merge behavior is intentional: it lets users "upgrade" an existing need's tags by re-adding with new tags. Without this, the dedup would silently discard the user's tag intent. **Flag if you think this is the wrong default** (alternative: discard new tags entirely on dedup hit; let user edit existing need to add tags).
- DO NOT add a `recipes` array merge here — recipe attribution lives in `needs_recipes` junction; `addNeedFromRecipe` already has its own duplicate-row handling via the `code === '23505'` catch.

**Smoke-test path Tom will exercise:**
- Add olive oil from AddNeedSheet T1 → first call creates need.
- Open AddNeedSheet again, search olive oil, T1 select, add → dedup hits, no duplicate row, toast still says "Added to {view}" (the user gets the same UX even though no row was created).
- Inspect DB: only one active need exists for that supply.

### Part 2 — AddNeedSheet T3 row repositioned to TOP of results

**Why:** Smoke test (2026-04-30): "the add custom supply is confusing — i think it should just be a feature of what you can do at the top of add supplies. so like i typed in 'protein powder' and it should have just had an option of creating a custom supply off of that". Currently T3 (custom name) appears at the BOTTOM of the result list, only when no exact T1/T2 match. Tom wants it surfaced at the TOP whenever 2+ chars are typed, even if there are catalog/supply matches.

**Edits to `components/AddNeedSheet.tsx`:**

Locate the search useEffect block where results are composed. The current code looks like:

```ts
const merged: SearchResult[] = [...tier1, ...tier2];
if (
  q.length >= 2 &&
  !merged.some((r) => r.display_name.toLowerCase() === lower)
) {
  merged.push({
    tier: 'tier3',
    id: `custom:${q}`,
    display_name: q,
  });
}
```

Replace with:

```ts
// T3 always-visible at top when 2+ chars typed (smoke test 2026-04-30).
// User can always see the "Add custom: '{query}'" affordance even when
// catalog matches exist — gives consistent UX across "I want this exact
// catalog ingredient" vs "I want my own custom variant" intents.
// Suppressed only when an EXACT name match already exists in T1/T2 to
// avoid the "Add custom: 'olive oil'" row appearing alongside the
// existing 'olive oil' supply (would be confusing duplication).
const exactMatch = [...tier1, ...tier2].some(
  (r) => r.display_name.toLowerCase() === lower
);

const merged: SearchResult[] = [];
if (q.length >= 2 && !exactMatch) {
  merged.push({
    tier: 'tier3',
    id: `custom:${q}`,
    display_name: q,
  });
}
merged.push(...tier1, ...tier2);
```

**Implementation notes:**
- The exact-match suppression is a deliberate UX call: if user types "olive oil" and that's already a supply (T1) or catalog ingredient (T2), don't show "Add custom: 'olive oil'" — that would be 2 rows for the same name and confusing. Tom's "protein powder" example was a case with NO exact match anywhere.
- The 2-char minimum stays — single-char queries don't trigger T3.
- T3's row rendering already exists in the result list (each row dispatches by `result.tier`); only the position-in-array changes. No render-side edits needed.

**Smoke-test path Tom will exercise:**
- Open AddNeedSheet on any view. Type "protein" → T3 row "Add custom: 'protein'" appears at TOP, T1/T2 results below.
- Type "olive oil" (assuming "olive oil" exists as supply or catalog ingredient) → T3 row suppressed; T1 🏠 row appears at top.
- Type "ol" (2 chars, no exact match) → T3 "Add custom: 'ol'" at top, partial matches below.
- Type "o" (1 char) → no T3 (below threshold).

### Part 3 — SupplyRow long-press → status jump-set action sheet

**Why:** Smoke test (2026-04-30): "long press on any item in pantry should result in ability to modify it's criticality to any option". Currently SupplyRow's status dot has tap-to-cycle (in_stock → low → critical → out → in_stock). Long-press should bypass the cycle and jump to any status directly via action sheet.

**Edits to `components/pantry/SupplyRow.tsx`:**

Add an `onLongPress` handler to the dot's `TouchableOpacity` (the one currently wrapping `<View style={styles.dot} />`). Action: open `Alert.alert` with 4 status options + Cancel.

Add this handler near the existing `handleDotTap`:

```ts
const handleDotLongPress = () => {
  if (cycling) return;
  Alert.alert(
    `Set status for ${displayName}`,
    undefined,
    [
      {
        text: 'In stock',
        onPress: () => applyStatus('in_stock'),
      },
      {
        text: 'Low',
        onPress: () => applyStatus('low'),
      },
      {
        text: 'Critical',
        onPress: () => applyStatus('critical'),
      },
      {
        text: 'Out',
        style: 'destructive',
        onPress: () => applyStatus('out'),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]
  );
};

const applyStatus = async (newStatus: SupplyStatus) => {
  if (newStatus === supply.status) return; // no-op if same
  setCycling(true);
  try {
    const result = await setSupplyStatus(supply.id, newStatus);
    onCycleComplete(result);
  } catch (error) {
    console.error('❌ Error setting supply status from long-press:', error);
    onCycleError?.(error);
  } finally {
    setCycling(false);
  }
};
```

Update the dot's `TouchableOpacity` props to add `onLongPress={handleDotLongPress}` and `delayLongPress={400}` (default is 500ms; 400 gives a snappier feel without misfiring on regular taps).

Add `Alert` to the imports from `react-native`. Add `setSupplyStatus` to the imports from `../../lib/services/suppliesService`.

**Implementation notes:**
- `setSupplyStatus(supplyId, newStatus)` is the existing service function (verify signature in suppliesService — should accept supply ID + status, return `SupplyStatusResult` matching `cycleSupplyStatus`'s return shape). **STOP and flag** if the return shape differs — the `onCycleComplete` callback's contract relies on the same `SupplyStatusResult`.
- The "Out" option is marked `destructive` (red text on iOS) — visually signals it's a "more deliberate" action since out-state spawns a need (per CP3 spawn-on-out logic).
- The action sheet uses `Alert.alert` (not a custom modal) — matches existing project precedent (e.g., ManageSuppliesScreen.handleDelete, CP5a's ⋯ menu in ViewDetailScreen).
- `delayLongPress: 400` is the only opinionated value — feel free to leave at default (500) if you prefer; flag the choice in SESSION_LOG either way.

**Smoke-test path Tom will exercise:**
- Tap the dot → cycles in_stock → low → critical → out → in_stock (existing behavior unchanged).
- Long-press the dot → action sheet appears with 4 status options + Cancel.
- Pick "Critical" on an "in stock" supply → status jumps directly to critical, row re-renders.
- Long-press again → action sheet → tap "Out" → red destructive style, status → out, spawn-on-out fires (need created via existing CP3 logic in `setSupplyStatus`).
- Long-press an already-low supply → action sheet → tap "Low" → no-op (same status).

---

## Constraints

1. **DO NOT** modify the cycle behavior on dot tap. Long-press is additive; tap behavior stays.
2. **DO NOT** modify `cycleSupplyStatus` in suppliesService — it's used elsewhere and CP6a is component-side only.
3. **DO NOT** add long-press to the name TouchableOpacity (only the dot). The name's tap navigates to supply detail (CP5 stub); long-press there would be confusing.
4. **DO NOT** modify any other service file beyond `needsService.ts` per Part 1.
5. **DO NOT** rebuild the result list in AddNeedSheet beyond the position swap. Don't change render logic, don't change result row click handler, don't change tier visual treatments.
6. **DO NOT** invent new types or status enums. Use existing `SupplyStatus`, `SupplyStatusResult`, `CreateNeedParams`.
7. **DO NOT** bump versions on living docs. Per Standing Rule A.
8. **DO NOT** touch DEFERRED_WORK or any other doc — CP6a is code-only. Doc reconciliation comes after CP6a/b/c smoke-tests in a dedicated pass.
9. **TARGET LINE COUNTS:**
   - `needsService.createNeed` Part 1: +30-50 lines (dedup guard + tag-merge logic)
   - `AddNeedSheet` Part 2: ~5-line net change (T3 reorder)
   - `SupplyRow` Part 3: +50-70 lines (handler + applyStatus + import additions)
   - **Total CP6a:** ~85-125 lines net change. Flag if substantially over (e.g., >200).

---

## Verification

1. `npx tsc --noEmit -p tsconfig.json` — confirm zero new errors. Baseline 181 from CP5b.
2. **Part 1 verification:**
   - `grep -n "supply_id" lib/services/needsService.ts` — confirm dedup guard present in createNeed.
   - Inspect `createNeed` signature: unchanged (no new params).
   - Quick mental smoke test: with `params.supplyId = null`, the guard short-circuits, behavior identical to pre-CP6a.
3. **Part 2 verification:**
   - `grep -n "merged.push" components/AddNeedSheet.tsx` — confirm T3 prepended, not appended.
   - Open AddNeedSheet code; confirm T3 row appears at index 0 of `merged` when 2+ chars and no exact match.
4. **Part 3 verification:**
   - `grep -n "onLongPress" components/pantry/SupplyRow.tsx` — confirm handler attached.
   - `grep -n "setSupplyStatus" components/pantry/SupplyRow.tsx` — confirm import added.
   - `grep -n "Alert" components/pantry/SupplyRow.tsx` — confirm Alert imported from react-native.
5. Smoke-test plan (deferred to Tom — code-only verification this session):
   - **Part 1:** Add olive oil twice via AddNeedSheet T1 → second add returns existing need (no DB duplicate). Verify in Supabase Studio: `SELECT count(*) FROM needs WHERE supply_id = '...' AND status IN ('need','in_cart')` returns 1.
   - **Part 1 tag merge:** Add olive oil with no tags → re-add with urgency=today tag → existing need now has urgency=today tag.
   - **Part 1 acquired re-add:** Mark olive oil need as acquired → re-add via T1 → NEW need created (acquired needs don't block dedup).
   - **Part 2:** Type "protein" → T3 at top + ✏️ marker. Type "olive oil" (existing) → no T3. Type "o" → no T3.
   - **Part 3:** Long-press dot → action sheet. Tap each status → row re-renders. Tap same-status → no-op. Tap "Out" → spawn-on-out toast in console (CP3 existing path).

---

## Open questions to flag (per Rule D)

- **Q1: Tag-merge on dedup hit.** Part 1's tag-merge behavior (union new tagIds with existing) is a UX call. Alternative: discard new tags entirely on dedup hit. **Flag in SESSION_LOG which you implemented and rationale.** I went with union; if you disagree based on what `addNeedFromRecipe` does (it's unchanged in CP6a but builds on top of createNeed post-CP6a), flag for reconsideration.
- **Q2: NEED_SELECT constant name in needsService.** Part 1 uses `NEED_SELECT` for the dedup query's select clause. If the actual constant has a different name in the file, use that. **STOP and flag** if no equivalent constant exists.
- **Q3: setSupplyStatus return shape.** Part 3 assumes `setSupplyStatus(id, status)` returns a `SupplyStatusResult` matching `cycleSupplyStatus`'s shape (i.e., includes `supply: SupplyWithTags` and optional `spawnedNeed`). If the signature differs, the `onCycleComplete(result)` call site needs an adapter. **STOP and flag** the actual return shape.
- **Q4: delayLongPress value.** I picked 400ms. Default React Native is 500ms. Either is fine; flag the choice.
- **Q5: PK_CODE_SNAPSHOTS staleness.** Per Rule E:
  - `lib/services/needsService.ts` — already in PK snapshot tables; CP6a edit doesn't change tier; flag staleness for next reconciliation pass.
  - `components/AddNeedSheet.tsx` — new in CP5b, tier assignment pending; CP6a edit is small (5-line net), tier still pending.
  - `components/pantry/SupplyRow.tsx` — was in PK snapshot tables (post-CP4); CP6a edit doesn't change tier; flag staleness.
  - **DO NOT update `docs/PK_CODE_SNAPSHOTS.md`** per Rule A. Reconciliation lives in CP6c per the planning doc.

---

## SESSION_LOG entry format

Per `docs/DOC_MAINTENANCE_PROCESS.md` Section 8. Single entry. Include:
- Date + phase + status
- Files modified (3 expected)
- Function inventory (the new `applyStatus` + `handleDotLongPress` in SupplyRow; nothing else net-new)
- Verification results (per checklist above)
- Deviations from prompt (if any)
- Open questions answered/flagged (Q1-Q5 above)
- Recommended doc updates: 4 living docs (note PK_CODE_SNAPSHOTS staleness via Q5; otherwise none)
- Recommended next steps for Tom

Tracker rows per `docs/TRACKER_SPEC.md` for each modified file.

---

## Recommended commit message

```
git commit -m "feat(needs+pantry): Phase 8R-CP6a — createNeed supply_id dedup + AddNeedSheet T3 top + SupplyRow long-press status jump-set" -- lib/services/needsService.ts components/AddNeedSheet.tsx components/pantry/SupplyRow.tsx docs/SESSION_LOG.md
```

(Adjust file list if any deviations land outside the 3 listed.)

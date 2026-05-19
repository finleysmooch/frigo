# [DRAFT] CC Prompt — 8C-Shared-CP2b.1: Autocomplete polish

> Patch to 8C-Shared-CP2b. Three smoke-test-discovered issues with the add-item autocomplete: short-query typo gap ("corr" only matched "corn"), exact match not ranking first ("tomatoes" buried below "Cherry tomatoes"), no Enter-key affordance to auto-select exact match. Updates the RPC scoring and adds an Enter-key handler in the screen.
>
> Estimated work: ~30 min (SQL migration move + RPC body verification + ~10 lines of screen-side code).

---

## Context

CP2b shipped the add-item bottom-sheet flow + initial fuzzy search RPC. End-to-end smoke test (Tom + Mary) passed all 6 steps but Tom flagged three autocomplete-quality issues during the run:

1. **"corr" only matched "corn"** — the trigram similarity threshold (0.3) was too high for short queries; "corr" → "coriander" similarity ~0.11. User had to type to "corria" before coriander surfaced. UX problem: typo tolerance should kick in earlier.

2. **Exact match wasn't first** — typing "tomatoes" returned several substring matches all scored 1.0 (because the previous score formula treated ANY substring hit as 1.0); secondary alphabetical sort meant "Cherry tomatoes" ranked above "Tomatoes". User expects exact-name typing to surface that name first.

3. **No Enter-key affordance** — when an exact match exists in results, pressing Return on the keyboard should auto-select it without forcing the user to scroll/tap.

CP2b.1 ships fixes for all three:

- **SQL** — replaces the RPC with a 5-tier scoring formula that ranks exact-match (2.0) > substring-starts-with (1.5) > substring-anywhere (1.0) > prefix-3char-min (0.95) > similarity (0.25-1.0). Threshold lowered 0.3 → 0.25. Tiebreak now name-length-ASC then name-ASC (shorter/simpler names win ties).
- **Screen** — `onSubmitEditing` handler on the search input that checks if `addItemResults[0]` is an exact match (case-insensitive on name OR plural_name) and auto-selects it via `handleSelectIngredient(addItemResults[0])`. No-op if no exact match.

---

## Inputs to read

**Required:**
1. `phase_8c_shared_cp2b1_search_rpc_v2.sql` (Tom places at `docs/` or repo root before handing prompt to CC) — the standalone SQL Tom pasted into Supabase. CC moves it; do not modify.
2. `screens/GroceryListDetailScreen.tsx` — locate the search `<TextInput>` inside the add-item Modal block (CP2b ship; styles are `addItemInput`); add `onSubmitEditing` handler.
3. `lib/groceryListsService.ts` — reference only; no changes needed (RPC interface unchanged, only its body changes via the migration).
4. `docs/DOC_MAINTENANCE_PROCESS.md` Section 8 — canonical SESSION_LOG format.

**Reference only (do not modify):**
- `supabase/migrations/20260428_phase_8c_shared_cp2b_search_rpc.sql` — the original CP2b migration. The CP2b.1 migration is a sibling file with a body that supersedes it via `CREATE OR REPLACE`. Don't edit or delete the original.

---

## Task

Three parts.

### Part 1 — Move the migration file

Tom places `phase_8c_shared_cp2b1_search_rpc_v2.sql` at `docs/` (preferred) or repo root.

Search order: `docs/` first, repo root fallback. If found in neither, STOP and flag in SESSION_LOG.

Move to `supabase/migrations/20260428_phase_8c_shared_cp2b1_search_rpc_v2.sql` (or actual current date if not 2026-04-28). Per Rule C: untracked source → `mv` + `git add`, NOT `git mv`. No content edits.

### Part 2 — Add Enter-key auto-select handler

In `screens/GroceryListDetailScreen.tsx`, locate the search `<TextInput>` in the add-item Modal block (the one with `style={styles.addItemInput}`, `value={addItemQuery}`).

**Add a new handler function near the other CP2b handlers** (after `handleSelectCustomItem`, before `resetAddItemSheet`):

```typescript
// Phase 8C-Shared-CP2b.1: Enter-key auto-select for exact match.
// When user presses Return while results are showing, if the top result
// (by score) is a case-insensitive exact match against name or plural_name,
// auto-select it. No-op for partial matches — user must scroll/tap.
const handleAddItemSubmitEditing = () => {
  const query = addItemQuery.trim().toLowerCase();
  if (query.length === 0) return;
  if (addItemResults.length === 0) return;

  const top = addItemResults[0];
  const nameMatch = top.name.toLowerCase() === query;
  const pluralMatch = top.plural_name?.toLowerCase() === query;

  if (nameMatch || pluralMatch) {
    handleSelectIngredient(top);
  }
  // No-op otherwise — user must explicitly tap a result. Avoids
  // accidentally selecting a fuzzy/partial match on Enter.
};
```

**Wire it to the TextInput.** Find:
```tsx
<TextInput
  style={styles.addItemInput}
  value={addItemQuery}
  onChangeText={setAddItemQuery}
  placeholder="Search ingredients..."
  placeholderTextColor={colors.text.tertiary}
  autoFocus
/>
```

Add `onSubmitEditing={handleAddItemSubmitEditing}` and `returnKeyType="done"`:
```tsx
<TextInput
  style={styles.addItemInput}
  value={addItemQuery}
  onChangeText={setAddItemQuery}
  placeholder="Search ingredients..."
  placeholderTextColor={colors.text.tertiary}
  autoFocus
  returnKeyType="done"
  onSubmitEditing={handleAddItemSubmitEditing}
/>
```

`returnKeyType="done"` makes the keyboard's return key visually labeled "Done" — clearer affordance that pressing it does something useful.

### Part 3 — Verification

**3a. Source-code verification:**
- Confirm the migration file content matches what was authored (no in-flight edits during move)
- Confirm `handleAddItemSubmitEditing` is wired correctly (no missing import; uses existing `handleSelectIngredient` reference)
- `npx tsc --noEmit` clean (only the 2 pre-existing baseline errors per CP2b)

**3b. Smoke-test plan for Tom (capture in SESSION_LOG):**

1. **Re-test "corr" → coriander.** Open sheet, type "cori" (4 chars). "Coriander" should now appear in results via Tier 2 starts-with (score 1.5) — earlier than the previous "corria" threshold. NOT a regression check; this is a new behavior.

2. **Re-test "tomatoes" exact match.** Open sheet, type "tomatoes" exactly. Top result should be canonical "Tomatoes" (or whatever the exact-name ingredient is) with score 2.0. "Cherry tomatoes" / "Roma tomatoes" appear below at score 1.0. Regression check.

3. **Enter-key auto-select.** Type a fully-spelled ingredient name (e.g., "milk" or "tomato" — depending on what's an exact match in your DB), wait for results, press Return on the keyboard. Sheet should immediately shift to selected state showing that ingredient. Quantity defaults populated.

4. **Enter-key NO-op for partial match.** Type "tom" (partial), wait for results, press Return. Should be a no-op — sheet stays in search state, no auto-selection. User must tap a result explicitly.

5. **"corriander" typo path still works (regression check on lowered threshold).** Same as CP2b smoke-test step 2; coriander should still appear via Tier 5 similarity.

---

## Constraints

1. **Do NOT modify the migration SQL** during the move.
2. **Do NOT touch other CP2b code** — service file unchanged; existing 9 state vars / 4 handlers / 17 styles all preserved.
3. **No CP3 / CP4 work bleed.** Just the autocomplete polish.
4. **Match codebase patterns.** New handler uses the same `console.log` / null-check style as the existing CP2b handlers.
5. **PK_CODE_SNAPSHOTS staleness flag:** `lib/groceryListsService.ts` not modified this session; flag NOT updated. `screens/GroceryListDetailScreen.tsx` not in PK snapshot tier per Q7 (CP2b decision); flag also NOT updated. No `_pk_sync/` staging this session.

---

## Verification checklist

- [ ] Migration file moved from `docs/` (or repo root fallback) to `supabase/migrations/YYYYMMDD_phase_8c_shared_cp2b1_search_rpc_v2.sql`
- [ ] `handleAddItemSubmitEditing` handler added to `screens/GroceryListDetailScreen.tsx`
- [ ] Search `<TextInput>` updated with `returnKeyType="done"` and `onSubmitEditing={handleAddItemSubmitEditing}`
- [ ] No other code changes
- [ ] `tsc --noEmit` clean (baseline only)
- [ ] No service files modified
- [ ] No `_pk_sync/` staging this session
- [ ] SESSION_LOG entry written per Section 8 format
- [ ] 5-step smoke-test plan included in SESSION_LOG

---

## SESSION_LOG entry format

Use canonical Section 8 format. Include:

- **Phase:** 8C-Shared-CP2b.1 (autocomplete polish patch — RPC tiered scoring + Enter-key auto-select)
- **Prompt from:** `docs/DRAFT_CC_PROMPT_8C-Shared-CP2b1.md`
- **Status:** Shipped / Blocked / Partial
- **Scope:** 1-paragraph summary. Reference the three smoke-test issues addressed (short-query gap, exact-match ordering, Enter-key affordance).
- **Files modified:** SQL migration (moved), `screens/GroceryListDetailScreen.tsx` (one new handler + 2 props on existing TextInput).
- **CC verification table:** TS compile + source-code check
- **Smoke-test plan for Tom:** 5 steps from Part 3b
- **No `_pk_sync/` staging this session.**
- **Recommended next steps for Tom:**
  - Run smoke-test plan; flag if any step fails
  - Commit (suggested: `feat(grocery): 8C-Shared-CP2b.1 — autocomplete polish (tiered scoring + Enter-key auto-select)`)
  - Queue 8C-Shared-CP3 design pass with Claude.ai (narrowed scope per yesterday's hygiene)
- **Surprises / Notes for Claude.ai:**
  - If `<TextInput>` already had `returnKeyType` set to something else (unlikely but possible), note the change
  - If `handleSelectIngredient` reference doesn't exist as expected (CP2b ship would have created it; flag if missing)
  - 19th visible 2026-04-27/28+ SESSION_LOG entry

---

## Open questions for CC to flag

If any are NOT true at runtime:
- Migration file at `docs/` or repo root
- `handleSelectIngredient` exists in `screens/GroceryListDetailScreen.tsx` per CP2b ship
- Existing `<TextInput style={styles.addItemInput}>` matches the CP2b shape described
- `addItemResults` state variable exists per CP2b ship

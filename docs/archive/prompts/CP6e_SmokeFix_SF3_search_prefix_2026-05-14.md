# CC PROMPT — CP6e-SmokeFix-SF3 · search_supplies tsquery prefix wildcard

**Phase:** 8R · CP6e-Lots closeout smoke
**Source:** SF-3 in `CP6e_SMOKE_FINDINGS_2026-05-14.md`
**Severity:** 🔴 Blocker (regression from FlowsUI-b2)
**Estimated effort:** 10-15 min (single SQL migration + verification)
**F&F target:** late August / early September 2026

---

## Context

The `search_supplies` RPC shipped in CP6e-Schema and was wired into the UI in CP6e-FlowsUI-b2 (2026-05-13). Live smoke surfaced that partial-word queries don't match:

- `"oliv"` → 0 results (despite "olive oil" being in the user's pantry)
- `"ket"` → 0 results (despite "ketchup" being present)
- `"ketchup"` (full word) → matches correctly
- `"olive"` (full word) → would match

**Root cause:** The RPC builds a tsquery with each token as an exact-token match. Postgres `simple` dictionary doesn't do stemming, and tsquery without modifiers requires complete-token equivalence. `oliv` (4 chars) is matched against the tsvector lexeme `olive` (5 chars) and fails because they aren't equal.

**Fix:** Append `:*` prefix wildcard to each token (or each synonym within a token's expanded group) so the tsquery matches any tsvector lexeme starting with the token. `oliv:*` matches `olive`, `olives`, `olive_oil`, etc.

---

## Task

Apply a SQL migration that replaces the body of `public.search_supplies(query_text TEXT, p_space_id UUID)` with a version that appends `:*` to each synonym in the tsquery construction.

### Current function body (relevant section)

```sql
FOR raw_token IN SELECT unnest(tokens)
LOOP
  expanded_synonyms := expand_storage_synonyms(raw_token);
  expanded_tokens := array_append(
    expanded_tokens,
    '(' || array_to_string(expanded_synonyms, ' | ') || ')'
  );
END LOOP;

ts_query_str := array_to_string(expanded_tokens, ' & ');
```

### New function body (the change)

```sql
FOR raw_token IN SELECT unnest(tokens)
LOOP
  expanded_synonyms := expand_storage_synonyms(raw_token);
  -- Append :* prefix wildcard to each synonym so partial-word matches fire.
  -- E.g. 'oliv' becomes 'oliv:*' which matches tsvector lexemes 'olive', 'olives', etc.
  expanded_tokens := array_append(
    expanded_tokens,
    '(' || array_to_string(
      ARRAY(SELECT t || ':*' FROM unnest(expanded_synonyms) AS t),
      ' | '
    ) || ')'
  );
END LOOP;

ts_query_str := array_to_string(expanded_tokens, ' & ');
```

Everything else in the function stays identical. The query continues to be `archived_at IS NULL`, `space_id = p_space_id`, with the same tsvector union over supplies + active lots, same ts_rank ordering, same return shape `(supply_id, rank, match_count)`.

### Migration file path

Create a new migration file in the repo:

```
supabase/migrations/<timestamp>_search_supplies_prefix_wildcard.sql
```

(Use `date +%Y%m%d%H%M%S` for the timestamp prefix.)

Contents: the full `CREATE OR REPLACE FUNCTION public.search_supplies(...)` block with the new body. Tom will run it directly in the Supabase SQL editor (consistent with prior CP6e-Schema migration pattern).

---

## Verification

### SQL-side (run in Supabase SQL editor after applying)

These three queries should now return results that they didn't before:

```sql
-- Verify olive matches via 'oliv'
SELECT * FROM search_supplies('oliv', '7aa945ab-fb32-4197-ae11-e6dbd3392587');
-- Expected: at least one row if 'olive oil' (or any olive-prefixed) supply exists in Home space

-- Verify ketchup matches via 'ket'
SELECT * FROM search_supplies('ket', '7aa945ab-fb32-4197-ae11-e6dbd3392587');
-- Expected: ketchup supply returned

-- Regression check — full-word still works
SELECT * FROM search_supplies('ketchup', '7aa945ab-fb32-4197-ae11-e6dbd3392587');
-- Expected: ketchup supply returned (same as before)

-- Multi-token AND still works
SELECT * FROM search_supplies('oliv oil', '7aa945ab-fb32-4197-ae11-e6dbd3392587');
-- Expected: olive oil supply (or similar) returned via prefix match on both tokens

-- Synonym expansion still works (storage)
SELECT * FROM search_supplies('frozen', '7aa945ab-fb32-4197-ae11-e6dbd3392587');
-- Expected: supplies with any freezer-located lot
```

### UI-side (after SQL ships)

Tom will smoke through P4-S4 (Name match), P4-S5 (Plural-name match), P4-S15 (Cross-dimension search) using partial-word queries. The pills should populate correctly because the client-side `computeSupplySearchMatch` already does substring matching — only the server-side gate was failing.

### Edge case to verify

Single-character tokens. The existing length-≥2 guard in `SuppliesSection`'s debounced effect means single-char queries don't reach the RPC. But if they did, `o:*` would match a lot of stuff. The threshold guard handles this; no additional logic needed.

---

## Constraints

1. **No changes to** the tsvector triggers (`supplies_search_vector_trigger`, `supply_lots_search_vector_trigger`, `supply_lots_compute_search_vector`), `expand_storage_synonyms`, RLS policies, or indexes. Only the `search_supplies` function body.
2. **Preserve the function signature exactly:** `(query_text TEXT, p_space_id UUID) RETURNS TABLE(supply_id UUID, rank REAL, match_count INTEGER)`. Callers in `lib/services/suppliesService.ts` rely on this.
3. **No client-side changes.** `computeSupplySearchMatch` in `lib/utils/lotSearch.ts` already does substring matching; no changes needed there.

---

## SESSION_LOG entry template

```
## 2026-05-14 — CP6e-SmokeFix-SF3 · search_supplies tsquery prefix wildcard

**Type:** SQL migration. Single-function-body fix to close partial-word search regression from FlowsUI-b2 smoke.

**Files modified:**
- `supabase/migrations/<timestamp>_search_supplies_prefix_wildcard.sql` (NEW)

**Schema-side change:**
- `public.search_supplies(query_text TEXT, p_space_id UUID)` body updated. Each synonym in the expanded token array gets `:*` suffix before tsquery construction.
- Signature unchanged. Return shape unchanged. RLS / indexes / triggers unchanged.

**Verification queries (all returned expected results in Supabase SQL editor):**
- `search_supplies('oliv', ...)` → returned olive-related supply(ies)
- `search_supplies('ket', ...)` → returned ketchup
- `search_supplies('ketchup', ...)` → still returns ketchup (full-word regression check)
- `search_supplies('oliv oil', ...)` → multi-token AND works with prefix
- `search_supplies('frozen', ...)` → synonym expansion still works (freezer lots)

**Maps to:** Closes SF-3 in CP6e_SMOKE_FINDINGS_2026-05-14.md.

**Surprises / Notes for Claude.ai:**
[anything worth flagging]
```

---

End of prompt.
